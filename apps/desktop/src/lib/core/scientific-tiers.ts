/**
 * ISO 14067 5.5 과학적 근거 등급 (Scientific Tiers)
 * 배출계수의 과학적 근거 수준을 정의합니다.
 */

// =============================================================================
// 타입 정의
// =============================================================================

export type ScientificTier = 'tier1' | 'tier2' | 'tier3' | 'tier4'

export interface TierConfig {
    tier: ScientificTier
    label: string
    labelEn: string
    description: string
    color: string
    bgColor: string
    borderColor: string
    priority: number // 낮을수록 높은 품질
}

// =============================================================================
// 등급 설정
// =============================================================================

export const SCIENTIFIC_TIERS: Record<ScientificTier, TierConfig> = {
    tier1: {
        tier: 'tier1',
        label: '측정값',
        labelEn: 'Measured',
        description: '직접 측정 데이터, 공정 시뮬레이션 (자연과학 기반)',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        priority: 1
    },
    tier2: {
        tier: 'tier2',
        label: '산업평균',
        labelEn: 'Industry Average',
        description: '산업 평균값, 유사 공정 데이터 (다른 과학적 접근)',
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        priority: 2
    },
    tier3: {
        tier: 'tier3',
        label: '국제표준',
        labelEn: 'Standard',
        description: 'IPCC 기본값, 국가 LCI DB, 국제 협약 기반',
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
        priority: 3
    },
    tier4: {
        tier: 'tier4',
        label: '추정값',
        labelEn: 'Estimated',
        description: '추정값, 프록시 데이터, 가치 선택 기반',
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500/30',
        priority: 4
    }
}

// =============================================================================
// 등급 결정 함수
// =============================================================================

export interface DataSourceInfo {
    type: 'primary' | 'secondary' | 'proxy' | 'estimated'
    source?: string
    isProxy?: boolean
    lciGuide?: {
        isoScores?: {
            overall: number
        }
        matchConfidence?: string
    }
}

export function determineScientificTier(info: DataSourceInfo): ScientificTier {
    // 프록시 데이터인 경우 Tier 4
    if (info.isProxy || info.type === 'proxy' || info.type === 'estimated') {
        return 'tier4'
    }

    // 1차 데이터 (측정값)
    if (info.type === 'primary') {
        return 'tier1'
    }

    // LCI 데이터가 있는 경우 ISO 점수로 판단
    if (info.lciGuide?.isoScores?.overall) {
        const score = info.lciGuide.isoScores.overall
        if (score >= 85) return 'tier2' // 높은 품질의 2차 데이터
        if (score >= 70) return 'tier3' // 표준 품질
        return 'tier4' // 낮은 품질
    }

    // 매칭 신뢰도로 판단
    if (info.lciGuide?.matchConfidence) {
        switch (info.lciGuide.matchConfidence) {
            case 'high':
                return 'tier2'
            case 'medium':
                return 'tier3'
            default:
                return 'tier4'
        }
    }

    // 기본 2차 데이터는 Tier 3
    if (info.type === 'secondary') {
        return 'tier3'
    }

    return 'tier4'
}

// =============================================================================
// 종합 과학적 근거 점수 계산
// =============================================================================

export function calculateScientificScore(tiers: ScientificTier[]): {
    score: number
    dominantTier: ScientificTier
    distribution: Record<ScientificTier, number>
} {
    const distribution: Record<ScientificTier, number> = {
        tier1: 0,
        tier2: 0,
        tier3: 0,
        tier4: 0
    }

    for (const tier of tiers) {
        distribution[tier]++
    }

    const total = tiers.length || 1

    // 가중 점수 계산 (Tier1=100, Tier2=75, Tier3=50, Tier4=25)
    const weights: Record<ScientificTier, number> = {
        tier1: 100,
        tier2: 75,
        tier3: 50,
        tier4: 25
    }

    let weightedSum = 0
    for (const tier of tiers) {
        weightedSum += weights[tier]
    }
    const score = Math.round(weightedSum / total)

    // 가장 많은 등급 확인
    let dominantTier: ScientificTier = 'tier3'
    let maxCount = 0
    for (const [tier, count] of Object.entries(distribution)) {
        if (count > maxCount) {
            maxCount = count
            dominantTier = tier as ScientificTier
        }
    }

    return {
        score,
        dominantTier,
        distribution
    }
}
