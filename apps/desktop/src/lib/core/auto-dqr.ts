/**
 * 자동 데이터 품질 스코어링 (Auto DQR)
 * 
 * 목적: 활동 데이터 입력 시 메타데이터(출처, 수집 시기, 지역, 공정 유형)를 기반으로
 *       Pedigree Matrix DQI를 자동으로 산출
 * 
 * 기존 `data-quality.ts`의 Pedigree Matrix + DQI 계산을 활용
 * 
 * ISO 14067:2018 6.3.5:
 * - 모든 데이터 항목에 대한 품질 평가 필수
 * - 평가 기준: 신뢰성, 완전성, 시간적/지리적/기술적 상관성
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-14
 */

import {
    DataQualityIndicators,
    DataSourceType,
    DataQualityLevel,
    calculateDQI,
    getDQILevel,
    DQI_LEVEL_LABELS,
    estimateUncertaintyFromDQI,
    generateDataQualitySummary,
    DataQualitySummary
} from './data-quality'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 데이터 입력 메타데이터 (자동 DQR 판정용)
 */
export interface DataInputMetadata {
    fieldName: string               // 필드명 (예: 'electricity', 'raw_material')
    fieldLabel: string              // 한국어 필드명
    // 출처 정보
    sourceType: DataSourceType      // 데이터 출처 유형
    sourceDetail?: string           // 출처 상세 (예: 'KEITI DB', '자체 계량기')
    // 시간 정보
    dataYear?: number               // 데이터 수집 연도
    referenceYear?: number          // 기준 연도 (기본: 현재 연도)
    // 지리 정보
    dataCountry?: string            // 데이터 수집 국가 (ISO 코드)
    targetCountry?: string          // 적용 국가 (기본: 'KR')
    // 기술 정보
    isSameProcess?: boolean         // 동일 공정 여부
    isSameTechnology?: boolean      // 동일 기술 여부
    // 완전성
    sampleCoverage?: number         // 샘플 커버리지 (%, 0-100)
    isVerified?: boolean            // 제3자 검증 여부
}

/**
 * 자동 DQR 판정 결과
 */
export interface AutoDQRResult {
    fieldName: string
    fieldLabel: string
    indicators: DataQualityIndicators
    dqi: number                     // 종합 DQI (1-5)
    level: DataQualityLevel
    levelLabel: string
    uncertainty: number             // 불확실성 (%)
    confidence: 'auto' | 'manual'   // 판정 방법
    rationale: DQRRationale         // 각 지표별 판정 근거
    summary: DataQualitySummary
}

/**
 * 판정 근거 (각 지표별)
 */
export interface DQRRationale {
    reliability: { score: number; reason: string }
    completeness: { score: number; reason: string }
    temporalCorrelation: { score: number; reason: string }
    geographicalCorrelation: { score: number; reason: string }
    technologicalCorrelation: { score: number; reason: string }
}

/**
 * 전체 DQR 보고서
 */
export interface DQRReport {
    projectName?: string
    assessmentDate: string
    totalItems: number
    averageDQI: number
    overallLevel: DataQualityLevel
    itemResults: AutoDQRResult[]
    criticalItems: AutoDQRResult[]  // DQI > 3.5인 항목
    improvements: string[]          // 개선 제안
    isoCompliance: {
        clause: string
        satisfied: boolean
        notes: string
    }[]
    reportTextKo: string
    reportTextEn: string
}

// =============================================================================
// 지리적 유사성 매핑
// =============================================================================

// 동일 대륙/경제권
const GEO_GROUPS: Record<string, string[]> = {
    'EAST_ASIA': ['KR', 'JP', 'CN', 'TW'],
    'SOUTHEAST_ASIA': ['VN', 'TH', 'ID', 'SG', 'MY', 'PH'],
    'SOUTH_ASIA': ['IN', 'BD', 'LK'],
    'EU': ['DE', 'FR', 'IT', 'ES', 'NL', 'GB', 'BE', 'AT', 'SE', 'FI', 'PL', 'CZ'],
    'NORTH_AMERICA': ['US', 'CA', 'MX'],
    'OCEANIA': ['AU', 'NZ']
}

function getGeoSimilarity(dataCountry: string, targetCountry: string): 1 | 2 | 3 | 4 | 5 {
    if (!dataCountry || !targetCountry) return 3

    if (dataCountry === targetCountry) return 1

    // 같은 경제권
    for (const group of Object.values(GEO_GROUPS)) {
        if (group.includes(dataCountry) && group.includes(targetCountry)) return 2
    }

    // OECD 내 비교
    const oecd = ['KR', 'JP', 'US', 'CA', 'DE', 'FR', 'GB', 'IT', 'NL', 'AU', 'NZ']
    if (oecd.includes(dataCountry) && oecd.includes(targetCountry)) return 3

    // 'GLOBAL' 데이터
    if (dataCountry === 'GLOBAL' || dataCountry === 'EU') return 3

    return 4
}

// =============================================================================
// 핵심 함수
// =============================================================================

/**
 * 단일 데이터 항목의 DQR 자동 판정
 */
export const assessDataQuality = (metadata: DataInputMetadata): AutoDQRResult => {
    const currentYear = new Date().getFullYear()
    const refYear = metadata.referenceYear || currentYear

    // 1. 신뢰성 (Reliability) 판정
    const reliability = assessReliability(metadata)

    // 2. 완전성 (Completeness) 판정
    const completeness = assessCompleteness(metadata)

    // 3. 시간적 상관성 판정
    const temporalCorrelation = assessTemporal(metadata, refYear)

    // 4. 지리적 상관성 판정
    const geographicalCorrelation = assessGeographical(metadata)

    // 5. 기술적 상관성 판정
    const technologicalCorrelation = assessTechnological(metadata)

    const indicators: DataQualityIndicators = {
        reliability: reliability.score as 1 | 2 | 3 | 4 | 5,
        completeness: completeness.score as 1 | 2 | 3 | 4 | 5,
        temporalCorrelation: temporalCorrelation.score as 1 | 2 | 3 | 4 | 5,
        geographicalCorrelation: geographicalCorrelation.score as 1 | 2 | 3 | 4 | 5,
        technologicalCorrelation: technologicalCorrelation.score as 1 | 2 | 3 | 4 | 5
    }

    const dqi = calculateDQI(indicators)
    const level = getDQILevel(dqi)
    const uncertainty = estimateUncertaintyFromDQI(dqi)
    const summary = generateDataQualitySummary(indicators)

    return {
        fieldName: metadata.fieldName,
        fieldLabel: metadata.fieldLabel,
        indicators,
        dqi: Math.round(dqi * 100) / 100,
        level,
        levelLabel: DQI_LEVEL_LABELS[level].labelKo,
        uncertainty: uncertainty.geometric,
        confidence: 'auto',
        rationale: {
            reliability,
            completeness,
            temporalCorrelation,
            geographicalCorrelation,
            technologicalCorrelation
        },
        summary
    }
}

/**
 * 여러 데이터 항목의 DQR 보고서 생성
 */
export const generateDQRReport = (
    items: DataInputMetadata[],
    projectName?: string
): DQRReport => {
    const itemResults = items.map(item => assessDataQuality(item))
    const totalItems = itemResults.length
    const averageDQI = totalItems > 0
        ? Math.round(itemResults.reduce((sum, r) => sum + r.dqi, 0) / totalItems * 100) / 100
        : 0
    const overallLevel = getDQILevel(averageDQI)

    const criticalItems = itemResults.filter(r => r.dqi > 3.5)

    // 개선 제안 생성
    const improvements = generateImprovements(itemResults)

    // ISO 준수 확인
    const isoCompliance = [
        {
            clause: 'ISO 14067:2018 6.3.5',
            satisfied: totalItems > 0 && itemResults.every(r => r.dqi <= 4.0),
            notes: `전체 ${totalItems}개 데이터 항목 중 ${criticalItems.length}개가 낮은 품질 (DQI > 3.5)`
        },
        {
            clause: 'ISO 14067:2018 6.3.5 (1차 데이터 비율)',
            satisfied: itemResults.filter(r =>
                r.rationale.reliability.score <= 2
            ).length / Math.max(totalItems, 1) >= 0.5,
            notes: '핵심 공정(Foreground)은 1차 데이터 50% 이상 권장'
        },
        {
            clause: 'ISO 14044:2006 4.2.3.6.2',
            satisfied: true,
            notes: '데이터 품질 요구사항이 목표에 부합하는지 확인 필요'
        }
    ]

    return {
        projectName,
        assessmentDate: new Date().toISOString(),
        totalItems,
        averageDQI,
        overallLevel,
        itemResults,
        criticalItems,
        improvements,
        isoCompliance,
        reportTextKo: generateReportKo(itemResults, averageDQI, overallLevel, criticalItems),
        reportTextEn: generateReportEn(itemResults, averageDQI, overallLevel, criticalItems)
    }
}

// =============================================================================
// 개별 지표 판정 함수
// =============================================================================

function assessReliability(metadata: DataInputMetadata): { score: number; reason: string } {
    switch (metadata.sourceType) {
        case 'primary_measured':
            if (metadata.isVerified) {
                return { score: 1, reason: '검증된 직접 측정 데이터' }
            }
            return { score: 1, reason: '직접 측정 데이터 (자체 공정)' }

        case 'primary_calculated':
            if (metadata.isVerified) {
                return { score: 1, reason: '검증된 계산 기반 1차 데이터' }
            }
            return { score: 2, reason: '계산 기반 1차 데이터 (부분 검증)' }

        case 'secondary_verified':
            return { score: 2, reason: '검증된 2차 데이터 (공인 DB)' }

        case 'secondary_database':
            return { score: 3, reason: '2차 데이터베이스 (비검증)' }

        case 'estimated':
            return { score: 4, reason: '추정 데이터' }

        default:
            return { score: 4, reason: '출처 유형 미지정' }
    }
}

function assessCompleteness(metadata: DataInputMetadata): { score: number; reason: string } {
    const coverage = metadata.sampleCoverage

    if (coverage === undefined) {
        // 출처 유형 기반 추정
        switch (metadata.sourceType) {
            case 'primary_measured':
                return { score: 1, reason: '직접 계량 (100% 커버리지 추정)' }
            case 'primary_calculated':
                return { score: 2, reason: '계산 기반 (50%+ 커버리지 추정)' }
            case 'secondary_verified':
                return { score: 2, reason: '검증 DB (충분한 샘플 크기)' }
            case 'secondary_database':
                return { score: 3, reason: '일반 DB (샘플 크기 불명확)' }
            case 'estimated':
                return { score: 4, reason: '추정치 (제한된 데이터)' }
            default:
                return { score: 3, reason: '기본값' }
        }
    }

    if (coverage >= 90) return { score: 1, reason: `커버리지 ${coverage}% (매우 높음)` }
    if (coverage >= 50) return { score: 2, reason: `커버리지 ${coverage}% (높음)` }
    if (coverage >= 30) return { score: 3, reason: `커버리지 ${coverage}% (보통)` }
    if (coverage >= 10) return { score: 4, reason: `커버리지 ${coverage}% (낮음)` }
    return { score: 5, reason: `커버리지 ${coverage}% (매우 낮음)` }
}

function assessTemporal(metadata: DataInputMetadata, refYear: number): { score: number; reason: string } {
    const dataYear = metadata.dataYear

    if (!dataYear) {
        // 출처 유형 기반 추정
        if (metadata.sourceType === 'primary_measured') {
            return { score: 1, reason: '직접 측정 (최신으로 간주)' }
        }
        return { score: 3, reason: '데이터 수집 연도 미지정' }
    }

    const diff = Math.abs(refYear - dataYear)

    if (diff <= 3) return { score: 1, reason: `${dataYear}년 데이터 (${diff}년 이내)` }
    if (diff <= 6) return { score: 2, reason: `${dataYear}년 데이터 (${diff}년 이내)` }
    if (diff <= 10) return { score: 3, reason: `${dataYear}년 데이터 (${diff}년 전)` }
    if (diff <= 15) return { score: 4, reason: `${dataYear}년 데이터 (${diff}년 전, 오래됨)` }
    return { score: 5, reason: `${dataYear}년 데이터 (${diff}년+ 전, 매우 오래됨)` }
}

function assessGeographical(metadata: DataInputMetadata): { score: number; reason: string } {
    const dataCountry = metadata.dataCountry || ''
    const targetCountry = metadata.targetCountry || 'KR'

    if (!dataCountry) {
        if (metadata.sourceType === 'primary_measured') {
            return { score: 1, reason: '자체 사업장 데이터 (동일 지역)' }
        }
        return { score: 3, reason: '데이터 수집 지역 미지정' }
    }

    const similarity = getGeoSimilarity(dataCountry, targetCountry)
    const reasons: Record<number, string> = {
        1: `동일 국가 (${dataCountry})`,
        2: `유사 경제권 (${dataCountry} → ${targetCountry})`,
        3: `유사 지역 평균 (${dataCountry} → ${targetCountry})`,
        4: `다른 지역 (${dataCountry} → ${targetCountry})`,
        5: `전혀 다른 지역 (${dataCountry} → ${targetCountry})`
    }

    return { score: similarity, reason: reasons[similarity] || '지역 불명' }
}

function assessTechnological(metadata: DataInputMetadata): { score: number; reason: string } {
    if (metadata.isSameProcess === true) {
        return { score: 1, reason: '동일 공정 데이터' }
    }
    if (metadata.isSameTechnology === true) {
        return { score: 2, reason: '동일 기술, 다른 기업/공정' }
    }

    // 출처 타입 기반 추정
    switch (metadata.sourceType) {
        case 'primary_measured':
        case 'primary_calculated':
            return { score: 1, reason: '1차 데이터 (동일 공정 추정)' }
        case 'secondary_verified':
            return { score: 2, reason: '검증 DB (동일 기술 범주)' }
        case 'secondary_database':
            return { score: 3, reason: '일반 DB (유사 기술)' }
        case 'estimated':
            return { score: 4, reason: '추정치 (관련 기술)' }
        default:
            return { score: 3, reason: '기본값' }
    }
}

// =============================================================================
// 보고서 생성
// =============================================================================

function generateImprovements(results: AutoDQRResult[]): string[] {
    const improvements: string[] = []
    const highDQI = results.filter(r => r.dqi > 3.0)

    if (highDQI.length > 0) {
        const names = highDQI.map(r => r.fieldLabel).join(', ')
        improvements.push(`다음 항목의 품질 개선 필요: ${names}`)
    }

    // 시간적 상관성 낮은 항목
    const oldData = results.filter(r => r.rationale.temporalCorrelation.score >= 4)
    if (oldData.length > 0) {
        improvements.push(`${oldData.length}개 항목의 데이터가 오래되었습니다. 최신 데이터로 업데이트하세요.`)
    }

    // 지리적 상관성 낮은 항목
    const geoMismatch = results.filter(r => r.rationale.geographicalCorrelation.score >= 4)
    if (geoMismatch.length > 0) {
        improvements.push(`${geoMismatch.length}개 항목의 지역 대표성이 낮습니다. 국가별 데이터로 교체를 권장합니다.`)
    }

    // 추정 데이터 비율
    const estimated = results.filter(r => r.rationale.reliability.score >= 4)
    if (estimated.length > results.length * 0.3) {
        improvements.push(`⚠️ 추정 데이터 비율이 ${Math.round(estimated.length / results.length * 100)}%로 높습니다. 1차 데이터 수집을 확대하세요.`)
    }

    if (improvements.length === 0) {
        improvements.push('전반적으로 양호한 데이터 품질입니다.')
    }

    return improvements
}

function generateReportKo(
    results: AutoDQRResult[], avgDQI: number,
    level: DataQualityLevel, critical: AutoDQRResult[]
): string {
    let report = `=== 데이터 품질 평가 보고서 (ISO 14067:2018 6.3.5) ===\n\n`
    report += `평가 일시: ${new Date().toLocaleDateString('ko-KR')}\n`
    report += `평가 항목 수: ${results.length}\n`
    report += `종합 DQI: ${avgDQI.toFixed(2)} (${DQI_LEVEL_LABELS[level].labelKo})\n\n`

    report += `--- 항목별 상세 ---\n`
    results.forEach((r, i) => {
        report += `\n${i + 1}. ${r.fieldLabel}\n`
        report += `   DQI: ${r.dqi.toFixed(2)} (${r.levelLabel})\n`
        report += `   신뢰성: ${r.rationale.reliability.score}점 — ${r.rationale.reliability.reason}\n`
        report += `   완전성: ${r.rationale.completeness.score}점 — ${r.rationale.completeness.reason}\n`
        report += `   시간: ${r.rationale.temporalCorrelation.score}점 — ${r.rationale.temporalCorrelation.reason}\n`
        report += `   지리: ${r.rationale.geographicalCorrelation.score}점 — ${r.rationale.geographicalCorrelation.reason}\n`
        report += `   기술: ${r.rationale.technologicalCorrelation.score}점 — ${r.rationale.technologicalCorrelation.reason}\n`
    })

    if (critical.length > 0) {
        report += `\n⚠️ 품질 주의 항목 (DQI > 3.5): ${critical.map(c => c.fieldLabel).join(', ')}\n`
    }

    return report
}

function generateReportEn(
    results: AutoDQRResult[], avgDQI: number,
    level: DataQualityLevel, critical: AutoDQRResult[]
): string {
    let report = `=== Data Quality Assessment Report (ISO 14067:2018 6.3.5) ===\n\n`
    report += `Assessment date: ${new Date().toLocaleDateString('en-US')}\n`
    report += `Total items: ${results.length}\n`
    report += `Overall DQI: ${avgDQI.toFixed(2)} (${DQI_LEVEL_LABELS[level].label})\n\n`

    results.forEach((r, i) => {
        report += `${i + 1}. ${r.fieldName}: DQI ${r.dqi.toFixed(2)} (${r.level})\n`
    })

    if (critical.length > 0) {
        report += `\n⚠️ Low quality items (DQI > 3.5): ${critical.map(c => c.fieldName).join(', ')}\n`
    }

    return report
}
