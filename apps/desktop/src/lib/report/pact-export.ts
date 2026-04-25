/**
 * PACT Pathfinder 데이터 교환 모듈
 * 
 * WBCSD PACT (Partnership for Carbon Transparency) Pathfinder
 * Technical Specifications v2.2 기반
 * 
 * CFP 연구 결과를 PACT ProductFootprint JSON으로 변환하여
 * 글로벌 공급망 탄소 데이터 교환에 활용
 * 
 * 참조:
 * - PACT Tech Spec: https://wbcsd.github.io/data-exchange-protocol/v2/
 * - CO₂ 단위: kgCO₂e / declared unit
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-14
 */

import type { CFPReportData } from './report-template'

// =============================================================================
// PACT 데이터 모델 (Tech Spec v2.2)
// =============================================================================

/**
 * CarbonFootprint (PACT 핵심 데이터 구조)
 */
export interface PACTCarbonFootprint {
    /** 선언단위 (예: "1 kg of product X") */
    declaredUnit: PACTDeclaredUnit
    /** 단위 수량 */
    unitaryProductAmount: number

    /** 화석 기원 GHG 배출 (바이오 제외), kgCO2e/declared unit */
    pcfExcludingBiogenic: number
    /** 바이오 기원 포함 총 GHG, kgCO2e/declared unit */
    pcfIncludingBiogenic?: number

    /** 화석 GHG 배출 */
    fossilGhgEmissions: number
    /** 화석 탄소 함량 */
    fossilCarbonContent?: number

    /** 바이오 기원 GHG 배출 */
    biogenicCarbonContent?: number
    /** 바이오 기원 탄소 포집 */
    biogenicCarbonWithdrawal?: number

    /** 직접 토지이용 변화 (dLUC) GHG */
    dLucGhgEmissions?: number
    /** 토지 관리 GHG */
    landManagementGhgEmissions?: number
    /** 기타 바이오 GHG */
    otherBiogenicGhgEmissions?: number

    /** 항공 운송 GHG — ISO 14067 7.2(e) */
    aircraftGhgEmissions?: number

    /** 적용 표준 */
    crossSectoralStandardsUsed: PACTCrossSectoralStandard[]
    /** 제품/산업 특수 규칙 */
    productOrSectorSpecificRules?: PACTProductRule[]

    /** 경계 */
    boundaryProcessesDescription?: string
    /** 특성화 계수 */
    characterizationFactors: 'AR5' | 'AR6'

    /** 데이터 참조 기간 */
    referencePeriodStart: string  // ISO 8601
    referencePeriodEnd: string

    /** 지리적 범위 */
    geographyCountry?: string
    geographyRegionOrSubregion?: string

    /** 1차 데이터 비중 (0~100) */
    primaryDataShare?: number

    /** 불확실성 (%) */
    coveragePercent?: number

    /** 배출 분류 (Scope 1~3) */
    exemptedEmissionsPercent?: number
    exemptedEmissionsDescription?: string

    /** 패키징 배출 (별도) */
    packagingEmissionsIncluded?: boolean
    packagingGhgEmissions?: number
}

export type PACTDeclaredUnit =
    | 'liter'
    | 'kilogram'
    | 'cubic meter'
    | 'kilowatt hour'
    | 'megajoule'
    | 'ton kilometer'
    | 'square meter'
    | 'piece'

export type PACTCrossSectoralStandard =
    | 'GHG Protocol Product standard'
    | 'ISO Standard 14067'
    | 'ISO Standard 14044'

export interface PACTProductRule {
    operator: 'PEF' | 'EPD International' | 'Other'
    ruleNames: string[]
    otherOperatorName?: string
}

/**
 * PACT ProductFootprint (최상위 구조)
 */
export interface PACTProductFootprint {
    /** 고유 식별자 (UUID v4) */
    id: string
    /** 사양 버전 */
    specVersion: string
    /** 이전 버전 ID */
    precedingPfIds?: string[]
    /** 풋프린트 버전 */
    version: number
    /** 생성 일시 */
    created: string
    /** 최종 수정 일시 */
    updated?: string
    /** 유효 상태 */
    status: 'Active' | 'Deprecated'
    /** 유효 기간 */
    validityPeriodStart?: string
    validityPeriodEnd?: string

    /** 회사 이름 */
    companyName: string
    /** 회사 ID */
    companyIds: string[]

    /** 제품 설명 */
    productDescription: string
    /** 제품 ID (GTIN, CAS 등) */
    productIds: PACTProductId[]
    /** 제품 카테고리 */
    productCategoryCpc: string
    /** 제품명 (자유 입력) */
    productNameCompany?: string

    /** 코멘트 */
    comment?: string

    /** 탄소발자국 데이터 */
    pcf: PACTCarbonFootprint
}

export interface PACTProductId {
    type: 'urn:pathfinder:product:customcode:vendor-assigned' | 'urn:pathfinder:product:id:cas' | string
    id: string
}

// =============================================================================
// 변환 함수
// =============================================================================

/**
 * CFPReportData → PACT ProductFootprint 변환
 */
export const convertToPACTFormat = (reportData: CFPReportData): PACTProductFootprint => {
    const now = new Date().toISOString()

    const pcf: PACTCarbonFootprint = {
        declaredUnit: mapUnit(reportData.product.functionalUnit),
        unitaryProductAmount: 1,

        pcfExcludingBiogenic: reportData.results.totalCFP - (reportData.results.biogenicEmissions || 0),
        pcfIncludingBiogenic: reportData.results.totalCFP,

        fossilGhgEmissions: reportData.results.fossilEmissions,
        biogenicCarbonContent: reportData.results.biogenicEmissions || undefined,
        dLucGhgEmissions: reportData.results.dlucEmissions || undefined,
        aircraftGhgEmissions: reportData.results.aircraftEmissions || undefined,

        crossSectoralStandardsUsed: ['ISO Standard 14067'],
        characterizationFactors: reportData.methodology.gwpSource.includes('AR6') ? 'AR6' : 'AR5',

        referencePeriodStart: reportData.scope.timeBoundary?.dataCollectionStart
            ? `${reportData.scope.timeBoundary.dataCollectionStart}-01T00:00:00Z`
            : `${reportData.dataQuality.baseYear}-01-01T00:00:00Z`,
        referencePeriodEnd: reportData.scope.timeBoundary?.dataCollectionEnd
            ? `${reportData.scope.timeBoundary.dataCollectionEnd}-01T00:00:00Z`
            : `${reportData.dataQuality.baseYear}-12-31T23:59:59Z`,

        primaryDataShare: reportData.dataQuality.primaryDataShare,

        boundaryProcessesDescription: reportData.scope.systemBoundary,
        packagingEmissionsIncluded: reportData.scope.lifecycleStages.includes('packaging')
    }

    // 제품 규칙 매핑
    if (reportData.scope.studyGoal?.cfpPcrReference) {
        pcf.productOrSectorSpecificRules = [{
            operator: 'Other',
            ruleNames: [reportData.scope.studyGoal.cfpPcrReference],
            otherOperatorName: 'CFP-PCR'
        }]
    }

    // 스테이지별 배출 → 본문에 포함
    const stageComment = reportData.results.stageBreakdown
        .map(s => `${s.stage}: ${s.emission.toFixed(4)} kgCO₂e (${s.percentage.toFixed(1)}%)`)
        .join('; ')

    return {
        id: generatePACTDataModelId(),
        specVersion: '2.2.0',
        version: 1,
        created: now,
        status: 'Active',

        companyName: reportData.product.manufacturer || 'Unknown',
        companyIds: [],

        productDescription: reportData.product.description || reportData.product.name,
        productIds: [{
            type: 'urn:pathfinder:product:customcode:vendor-assigned',
            id: reportData.reportId
        }],
        productCategoryCpc: mapCPC(reportData.product.category),
        productNameCompany: reportData.product.name,

        comment: `CarbonMate 자동 생성 | ${reportData.methodology.standard} | Stages: ${stageComment}`,

        pcf
    }
}

// =============================================================================
// 검증 함수
// =============================================================================

export interface PACTValidationResult {
    valid: boolean
    errors: string[]
    warnings: string[]
    mandatoryFieldsCount: number
    filledFieldsCount: number
    coverage: number  // %
}

/**
 * PACT 필수 필드 검증
 */
export const validatePACTCompliance = (pf: PACTProductFootprint): PACTValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    // 필수 필드 체크
    const mandatoryChecks: [string, unknown][] = [
        ['id', pf.id],
        ['specVersion', pf.specVersion],
        ['version', pf.version],
        ['created', pf.created],
        ['status', pf.status],
        ['companyName', pf.companyName],
        ['productDescription', pf.productDescription],
        ['productCategoryCpc', pf.productCategoryCpc],
        ['pcf.declaredUnit', pf.pcf.declaredUnit],
        ['pcf.unitaryProductAmount', pf.pcf.unitaryProductAmount],
        ['pcf.pcfExcludingBiogenic', pf.pcf.pcfExcludingBiogenic],
        ['pcf.fossilGhgEmissions', pf.pcf.fossilGhgEmissions],
        ['pcf.crossSectoralStandardsUsed', pf.pcf.crossSectoralStandardsUsed],
        ['pcf.characterizationFactors', pf.pcf.characterizationFactors],
        ['pcf.referencePeriodStart', pf.pcf.referencePeriodStart],
        ['pcf.referencePeriodEnd', pf.pcf.referencePeriodEnd]
    ]

    let filledCount = 0
    mandatoryChecks.forEach(([field, value]) => {
        if (value === undefined || value === null || value === '') {
            errors.push(`필수 필드 누락: ${field}`)
        } else {
            filledCount++
        }
    })

    // UUID 형식 검증
    if (pf.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pf.id)) {
        errors.push('id는 UUID v4 형식이어야 합니다')
    }

    // 음수 배출 체크
    if (pf.pcf.pcfExcludingBiogenic < 0) {
        warnings.push('pcfExcludingBiogenic가 음수입니다 (탄소 크레딧?)')
    }

    // ISO 날짜 형식 체크
    if (pf.pcf.referencePeriodStart && !isValidISO8601(pf.pcf.referencePeriodStart)) {
        errors.push('referencePeriodStart: ISO 8601 형식 필요')
    }
    if (pf.pcf.referencePeriodEnd && !isValidISO8601(pf.pcf.referencePeriodEnd)) {
        errors.push('referencePeriodEnd: ISO 8601 형식 필요')
    }

    // 권장 필드 경고
    if (!pf.pcf.primaryDataShare && pf.pcf.primaryDataShare !== 0) {
        warnings.push('primaryDataShare 제공 권장 (1차 데이터 비중)')
    }
    if (!pf.pcf.geographyCountry) {
        warnings.push('geographyCountry 제공 권장 (국가 코드)')
    }
    if (pf.productIds.length === 0) {
        warnings.push('productIds에 GTIN/CAS 등 제품 식별자 추가 권장')
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        mandatoryFieldsCount: mandatoryChecks.length,
        filledFieldsCount: filledCount,
        coverage: (filledCount / mandatoryChecks.length) * 100
    }
}

// =============================================================================
// JSON 내보내기
// =============================================================================

/**
 * PACT JSON 문자열 생성
 */
export const exportPACTJSON = (reportData: CFPReportData): string => {
    const pf = convertToPACTFormat(reportData)
    return JSON.stringify(pf, null, 2)
}

/**
 * PACT 검증 보고서 (한국어)
 */
export const generatePACTValidationReport = (pf: PACTProductFootprint): string => {
    const result = validatePACTCompliance(pf)
    const lines: string[] = [
        '# PACT Pathfinder 적합성 검증 보고서',
        '',
        `생성일: ${new Date().toLocaleDateString('ko-KR')}`,
        `사양 버전: ${pf.specVersion}`,
        `제품: ${pf.productNameCompany || pf.productDescription}`,
        '',
        `## 결과: ${result.valid ? '✅ 적합' : '❌ 부적합'}`,
        '',
        `- 필수 필드: ${result.filledFieldsCount}/${result.mandatoryFieldsCount} (${result.coverage.toFixed(0)}%)`,
        `- 오류: ${result.errors.length}건`,
        `- 경고: ${result.warnings.length}건`,
        ''
    ]

    if (result.errors.length > 0) {
        lines.push('### 오류 (수정 필수)')
        result.errors.forEach(e => lines.push(`- ❌ ${e}`))
        lines.push('')
    }

    if (result.warnings.length > 0) {
        lines.push('### 경고 (권장 수정)')
        result.warnings.forEach(w => lines.push(`- ⚠️ ${w}`))
        lines.push('')
    }

    lines.push('### PACT 데이터 요약')
    lines.push(`| 항목 | 값 |`)
    lines.push(`|------|------|`)
    lines.push(`| GHG (바이오 제외) | ${pf.pcf.pcfExcludingBiogenic.toFixed(4)} kgCO₂e |`)
    lines.push(`| 화석 GHG | ${pf.pcf.fossilGhgEmissions.toFixed(4)} kgCO₂e |`)
    if (pf.pcf.aircraftGhgEmissions) {
        lines.push(`| 항공 GHG | ${pf.pcf.aircraftGhgEmissions.toFixed(4)} kgCO₂e |`)
    }
    lines.push(`| 적용 표준 | ${pf.pcf.crossSectoralStandardsUsed.join(', ')} |`)
    lines.push(`| 특성화 계수 | ${pf.pcf.characterizationFactors} |`)
    lines.push(`| 참조 기간 | ${pf.pcf.referencePeriodStart} ~ ${pf.pcf.referencePeriodEnd} |`)

    return lines.join('\n')
}

// =============================================================================
// 유틸리티
// =============================================================================

/**
 * UUID v4 생성
 */
export const generatePACTDataModelId = (): string => {
    const hex = '0123456789abcdef'
    const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return template.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return hex[v]
    })
}

/**
 * CarbonMate 단위 → PACT 선언단위 매핑
 */
function mapUnit(functionalUnit: string): PACTDeclaredUnit {
    const lower = functionalUnit.toLowerCase()
    if (lower.includes('kg') || lower.includes('킬로그램')) return 'kilogram'
    if (lower.includes('liter') || lower.includes('리터') || lower.includes('l')) return 'liter'
    if (lower.includes('kwh') || lower.includes('킬로와트')) return 'kilowatt hour'
    if (lower.includes('mj') || lower.includes('메가줄')) return 'megajoule'
    if (lower.includes('m³') || lower.includes('m3') || lower.includes('세제곱미터')) return 'cubic meter'
    if (lower.includes('m²') || lower.includes('m2') || lower.includes('제곱미터')) return 'square meter'
    if (lower.includes('tkm') || lower.includes('톤킬로')) return 'ton kilometer'
    return 'piece'
}

/**
 * 제품 카테고리 → CPC (Central Product Classification) 코드 매핑
 */
function mapCPC(category: string): string {
    const cpcMap: Record<string, string> = {
        'electronics': '473',      // 전자제품
        'chemicals': '35',         // 화학제품
        'plastics': '361',         // 기초 플라스틱
        'metals': '41',            // 기초 금속
        'food': '21',              // 식품
        'textiles': '26',          // 섬유
        'machinery': '43',         // 기계류
        'construction': '54',      // 건설
        'automotive': '491',       // 자동차
        'paper': '321',            // 종이
        'glass': '371',            // 유리
        'rubber': '362',           // 고무
        'general': '0',            // 기타
    }

    const lower = category.toLowerCase()
    for (const [key, value] of Object.entries(cpcMap)) {
        if (lower.includes(key)) return value
    }
    return '0' // 미분류
}

/**
 * ISO 8601 날짜 형식 검증
 */
function isValidISO8601(dateStr: string): boolean {
    const d = new Date(dateStr)
    return !isNaN(d.getTime())
}
