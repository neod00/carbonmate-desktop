/**
 * ISO 14067 5항 원칙 종합 준수 검사기
 * 완전성(5.7), 투명성(5.11), 중복배제(5.12), 과학적 접근(5.5), 관련성(5.6)을 종합 평가합니다.
 */

import { BoundaryType } from './store'
import { checkCompleteness, CompletenessCheckResult, getCompletenessGrade } from './completeness-checker'
import { checkAllStagesDuplicates, DuplicateCheckResult } from './duplicate-detector'
import { calculateScientificScore, determineScientificTier, SCIENTIFIC_TIERS, ScientificTier } from './scientific-tiers'

// =============================================================================
// 타입 정의
// =============================================================================

export interface Section5ComplianceResult {
    overallScore: number
    overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
    isCompliant: boolean

    // 개별 원칙별 점수
    principles: {
        completeness: {
            score: number
            grade: string
            issues: number
            details: CompletenessCheckResult
        }
        transparency: {
            score: number
            grade: string
            documentedItems: number
            totalItems: number
        }
        noDuplicates: {
            score: number
            grade: string
            warnings: number
            details: DuplicateCheckResult
        }
        scientificBasis: {
            score: number
            grade: string
            dominantTier: ScientificTier
            distribution: Record<ScientificTier, number>
        }
        relevance: {
            score: number
            grade: string
            avgDataQuality: number
            lowQualityItems: number
        }
    }

    // 보고서용 요약
    summary: {
        strengths: string[]
        improvements: string[]
        criticalIssues: string[]
    }
}

// =============================================================================
// 등급 계산 함수
// =============================================================================

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A'
    if (score >= 75) return 'B'
    if (score >= 60) return 'C'
    if (score >= 40) return 'D'
    return 'F'
}

// =============================================================================
// 종합 5항 준수 검사
// =============================================================================

export function checkSection5Compliance(
    boundary: BoundaryType,
    selectedStages: string[],
    activityData: Record<string, any>,
    detailedActivityData?: any
): Section5ComplianceResult {
    const strengths: string[] = []
    const improvements: string[] = []
    const criticalIssues: string[] = []

    // 1. 완전성 검사 (5.7)
    const completenessResult = checkCompleteness(boundary, selectedStages, activityData, detailedActivityData)
    const completenessGrade = getCompletenessGrade(completenessResult.score)

    if (completenessResult.score >= 90) {
        strengths.push('시스템 경계 내 모든 필수 단계가 포함되어 있습니다.')
    } else if (completenessResult.score < 60) {
        criticalIssues.push(`완전성 점수가 ${completenessResult.score}점으로 낮습니다. 누락된 단계를 확인하세요.`)
    }

    // 2. 투명성 검사 (5.11)
    let documentedItems = 0
    let totalItems = 0
    const allItems = getAllActivityItems(detailedActivityData)
    totalItems = allItems.length
    documentedItems = allItems.filter(item =>
        item.transparencyInfo?.dataSource ||
        item.lciGuide?.recommendationReason ||
        item.proxyInfo?.assumption
    ).length

    const transparencyScore = totalItems > 0 ? Math.round((documentedItems / totalItems) * 100) : 100

    if (transparencyScore >= 80) {
        strengths.push('대부분의 데이터에 출처가 명시되어 있습니다.')
    } else if (transparencyScore < 50) {
        improvements.push('데이터 출처 및 가정을 더 상세히 문서화하세요.')
    }

    // 3. 중복 배제 검사 (5.12)
    const duplicateResult = checkAllStagesDuplicates(detailedActivityData)
    const duplicateScore = duplicateResult.hasDuplicates
        ? Math.max(0, 100 - (duplicateResult.warnings.length * 20))
        : 100

    if (!duplicateResult.hasDuplicates) {
        strengths.push('중복 계산 항목이 발견되지 않았습니다.')
    } else {
        const errorCount = duplicateResult.warnings.filter(w => w.severity === 'error').length
        if (errorCount > 0) {
            criticalIssues.push(`${errorCount}개의 중복 계산 의심 항목이 있습니다.`)
        } else {
            improvements.push('유사한 이름의 항목이 있습니다. 중복 여부를 확인하세요.')
        }
    }

    // 4. 과학적 근거 검사 (5.5)
    const tiers: ScientificTier[] = allItems.map(item => determineScientificTier({
        type: item.dataQuality?.type || 'secondary',
        isProxy: item.isProxy,
        lciGuide: item.lciGuide
    }))
    const scientificResult = calculateScientificScore(tiers.length > 0 ? tiers : ['tier3'])

    if (scientificResult.score >= 75) {
        strengths.push('대부분의 데이터가 높은 과학적 근거를 가지고 있습니다.')
    } else if (scientificResult.score < 50) {
        improvements.push('추정값 및 프록시 데이터의 비율이 높습니다. 가능하면 측정값이나 산업평균 데이터를 사용하세요.')
    }

    // 5. 관련성 검사 (5.6)
    let totalQuality = 0
    let lowQualityItems = 0
    for (const item of allItems) {
        const isoScore = item.lciGuide?.isoScores?.overall || 70
        totalQuality += isoScore
        if (isoScore < 60) lowQualityItems++
    }
    const avgDataQuality = totalItems > 0 ? Math.round(totalQuality / totalItems) : 70
    const relevanceScore = Math.min(100, avgDataQuality + (lowQualityItems === 0 ? 10 : 0))

    if (avgDataQuality >= 80) {
        strengths.push('데이터 품질(지역적, 시간적, 기술적 대표성)이 우수합니다.')
    } else if (lowQualityItems > 0) {
        improvements.push(`${lowQualityItems}개 항목의 데이터 품질이 낮습니다. 더 적합한 데이터를 검토하세요.`)
    }

    // 종합 점수 계산 (가중 평균)
    const weights = {
        completeness: 0.25,
        transparency: 0.20,
        noDuplicates: 0.15,
        scientificBasis: 0.20,
        relevance: 0.20
    }

    const overallScore = Math.round(
        completenessResult.score * weights.completeness +
        transparencyScore * weights.transparency +
        duplicateScore * weights.noDuplicates +
        scientificResult.score * weights.scientificBasis +
        relevanceScore * weights.relevance
    )

    const overallGrade = scoreToGrade(overallScore)
    const isCompliant = overallScore >= 60 && criticalIssues.length === 0

    return {
        overallScore,
        overallGrade,
        isCompliant,
        principles: {
            completeness: {
                score: completenessResult.score,
                grade: completenessGrade.label,
                issues: completenessResult.issues.length,
                details: completenessResult
            },
            transparency: {
                score: transparencyScore,
                grade: scoreToGrade(transparencyScore),
                documentedItems,
                totalItems
            },
            noDuplicates: {
                score: duplicateScore,
                grade: scoreToGrade(duplicateScore),
                warnings: duplicateResult.warnings.length,
                details: duplicateResult
            },
            scientificBasis: {
                score: scientificResult.score,
                grade: scoreToGrade(scientificResult.score),
                dominantTier: scientificResult.dominantTier,
                distribution: scientificResult.distribution
            },
            relevance: {
                score: relevanceScore,
                grade: scoreToGrade(relevanceScore),
                avgDataQuality,
                lowQualityItems
            }
        },
        summary: {
            strengths,
            improvements,
            criticalIssues
        }
    }
}

// =============================================================================
// 헬퍼: 모든 활동 데이터 아이템 추출
// =============================================================================

function getAllActivityItems(detailedActivityData: any): any[] {
    if (!detailedActivityData) return []

    const items: any[] = []

    // 원자재
    if (detailedActivityData.raw_materials) {
        items.push(...detailedActivityData.raw_materials)
    }

    // 제조
    if (detailedActivityData.manufacturing) {
        if (detailedActivityData.manufacturing.electricity) {
            items.push(...detailedActivityData.manufacturing.electricity)
        }
        if (detailedActivityData.manufacturing.fuels) {
            items.push(...detailedActivityData.manufacturing.fuels)
        }
        if (detailedActivityData.manufacturing.processEmissions) {
            items.push(...detailedActivityData.manufacturing.processEmissions)
        }
    }

    // 운송
    if (detailedActivityData.transport) {
        items.push(...detailedActivityData.transport)
    }

    // 포장
    if (detailedActivityData.packaging) {
        items.push(...detailedActivityData.packaging)
    }

    // 사용
    if (detailedActivityData.use) {
        if (detailedActivityData.use.electricity) {
            items.push(...detailedActivityData.use.electricity)
        }
        if (detailedActivityData.use.consumables) {
            items.push(...detailedActivityData.use.consumables)
        }
    }

    // 폐기
    if (detailedActivityData.eol) {
        if (detailedActivityData.eol.disposal) {
            items.push(...detailedActivityData.eol.disposal)
        }
        if (detailedActivityData.eol.recycling) {
            items.push(...detailedActivityData.eol.recycling)
        }
    }

    return items
}

// =============================================================================
// 보고서용 5항 준수 현황 텍스트 생성
// =============================================================================

export function generateSection5ReportText(result: Section5ComplianceResult): string {
    const lines: string[] = []

    lines.push('## ISO 14067 5항 원칙 준수 현황\n')
    lines.push(`**종합 점수: ${result.overallScore}점 (${result.overallGrade}등급)**\n`)
    lines.push(`준수 여부: ${result.isCompliant ? '✅ 적합' : '⚠️ 개선 필요'}\n`)

    lines.push('\n### 원칙별 평가\n')
    lines.push(`| 원칙 | 점수 | 등급 | 비고 |`)
    lines.push(`|------|------|------|------|`)
    lines.push(`| 5.7 완전성 | ${result.principles.completeness.score}점 | ${result.principles.completeness.grade} | ${result.principles.completeness.issues}개 이슈 |`)
    lines.push(`| 5.11 투명성 | ${result.principles.transparency.score}점 | ${result.principles.transparency.grade} | ${result.principles.transparency.documentedItems}/${result.principles.transparency.totalItems} 문서화 |`)
    lines.push(`| 5.12 중복배제 | ${result.principles.noDuplicates.score}점 | ${result.principles.noDuplicates.grade} | ${result.principles.noDuplicates.warnings}개 경고 |`)
    lines.push(`| 5.5 과학적 접근 | ${result.principles.scientificBasis.score}점 | ${result.principles.scientificBasis.grade} | ${SCIENTIFIC_TIERS[result.principles.scientificBasis.dominantTier].label} 주도 |`)
    lines.push(`| 5.6 관련성 | ${result.principles.relevance.score}점 | ${result.principles.relevance.grade} | 평균 DQI ${result.principles.relevance.avgDataQuality}점 |`)

    if (result.summary.strengths.length > 0) {
        lines.push('\n### 강점')
        for (const s of result.summary.strengths) {
            lines.push(`- ✅ ${s}`)
        }
    }

    if (result.summary.improvements.length > 0) {
        lines.push('\n### 개선 권장사항')
        for (const i of result.summary.improvements) {
            lines.push(`- 💡 ${i}`)
        }
    }

    if (result.summary.criticalIssues.length > 0) {
        lines.push('\n### 주요 이슈')
        for (const c of result.summary.criticalIssues) {
            lines.push(`- ⚠️ ${c}`)
        }
    }

    return lines.join('\n')
}
