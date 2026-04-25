/**
 * CFP 성과 추적 (ISO 14067 6.4.7)
 * 
 * ISO 14067:2018 6.4.7 CFP 성과 추적
 * - 평가는 서로 다른 시점에 수행되어야 함
 * - 시간 경과에 따른 CFP 변화량은 동일한 기능단위를 가진 제품에 대해 계산
 * - 동일한 PCR을 사용하여 계산
 * 
 * @see ISO 14067:2018 6.4.7
 */

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * CFP 스냅샷 - 특정 시점의 CFP 측정 결과
 */
export interface CFPSnapshot {
    /** 고유 식별자 */
    id: string
    /** 측정 일시 (ISO 8601) */
    date: string
    /** CFP 값 (kg CO2e / 기능단위) */
    cfpValue: number
    /** 기능단위 */
    functionalUnit: string
    /** 시스템 경계 */
    boundary: 'cradle_to_gate' | 'cradle_to_grave' | 'gate_to_gate'
    /** PCR 참조 (있는 경우) */
    pcrReference?: string
    /** 메모/변경 사항 */
    notes?: string
    /** 생애주기 단계별 배출량 */
    stageBreakdown?: {
        stageId: string
        stageName: string
        emission: number
    }[]
    /** 데이터 품질 점수 (1-5) */
    dataQualityScore?: number
}

/**
 * CFP 추세 방향
 */
export type CFPTrend = 'improving' | 'stable' | 'worsening'

/**
 * CFP 추적 결과
 */
export interface CFPTrackingResult {
    /** 제품 ID */
    productId: string
    /** 제품명 */
    productName: string
    /** 스냅샷 이력 (시간순 정렬) */
    snapshots: CFPSnapshot[]
    /** 추세 방향 */
    trend: CFPTrend
    /** 첫 측정 대비 변화율 (%) */
    totalChangePercent: number
    /** 연평균 변화율 (%) */
    annualChangePercent: number
    /** 기준 연도 (첫 측정) */
    baselineYear: number
    /** 최신 측정 연도 */
    latestYear: number
    /** 개선 여부 */
    isImproving: boolean
}

/**
 * 변화량 비교 결과
 */
export interface CFPComparisonResult {
    /** 이전 CFP */
    previousCFP: number
    /** 현재 CFP */
    currentCFP: number
    /** 절대 변화량 */
    absoluteChange: number
    /** 변화율 (%) */
    percentChange: number
    /** 측정 간격 (일) */
    daysBetween: number
    /** 개선 여부 */
    isImprovement: boolean
}

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 고유 스냅샷 ID 생성
 */
export const generateSnapshotId = (): string => {
    return `cfp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 현재 날짜를 ISO 8601 형식으로 반환
 */
export const getCurrentDateISO = (): string => {
    return new Date().toISOString()
}

// =============================================================================
// 핵심 함수
// =============================================================================

/**
 * 두 스냅샷 간 CFP 비교
 * 
 * @param previous 이전 스냅샷
 * @param current 현재 스냅샷
 * @returns 비교 결과
 */
export const compareCFPSnapshots = (
    previous: CFPSnapshot,
    current: CFPSnapshot
): CFPComparisonResult => {
    const absoluteChange = current.cfpValue - previous.cfpValue
    const percentChange = previous.cfpValue !== 0
        ? ((current.cfpValue - previous.cfpValue) / previous.cfpValue) * 100
        : 0

    const previousDate = new Date(previous.date)
    const currentDate = new Date(current.date)
    const daysBetween = Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24))

    return {
        previousCFP: previous.cfpValue,
        currentCFP: current.cfpValue,
        absoluteChange,
        percentChange,
        daysBetween,
        isImprovement: absoluteChange < 0
    }
}

/**
 * CFP 추세 판단 (5% 임계값)
 * 
 * @param changePercent 변화율 (%)
 * @returns 추세 방향
 */
export const determineTrend = (changePercent: number): CFPTrend => {
    if (changePercent < -5) return 'improving'
    if (changePercent > 5) return 'worsening'
    return 'stable'
}

/**
 * 연평균 변화율 계산 (CAGR)
 * 
 * @param startValue 시작 값
 * @param endValue 종료 값
 * @param years 연수
 * @returns 연평균 변화율 (%)
 */
export const calculateAnnualChangeRate = (
    startValue: number,
    endValue: number,
    years: number
): number => {
    if (years <= 0 || startValue <= 0) return 0
    const cagr = Math.pow(endValue / startValue, 1 / years) - 1
    return cagr * 100
}

/**
 * CFP 추적 결과 계산
 * 
 * ISO 14067 6.4.7 요구사항:
 * - 시간 경과에 따른 CFP 변화량 추적
 * - 동일한 기능단위 및 PCR 사용
 * 
 * @param productId 제품 ID
 * @param productName 제품명
 * @param snapshots 스냅샷 배열 (시간순 정렬 필요)
 * @returns CFP 추적 결과
 */
export const calculateCFPTrend = (
    productId: string,
    productName: string,
    snapshots: CFPSnapshot[]
): CFPTrackingResult | null => {
    if (snapshots.length === 0) return null

    // 시간순 정렬
    const sorted = [...snapshots].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const baseline = sorted[0]
    const latest = sorted[sorted.length - 1]

    // 총 변화율
    const totalChangePercent = baseline.cfpValue !== 0
        ? ((latest.cfpValue - baseline.cfpValue) / baseline.cfpValue) * 100
        : 0

    // 연수 계산
    const baselineYear = new Date(baseline.date).getFullYear()
    const latestYear = new Date(latest.date).getFullYear()
    const years = latestYear - baselineYear

    // 연평균 변화율
    const annualChangePercent = years > 0
        ? calculateAnnualChangeRate(baseline.cfpValue, latest.cfpValue, years)
        : 0

    return {
        productId,
        productName,
        snapshots: sorted,
        trend: determineTrend(totalChangePercent),
        totalChangePercent,
        annualChangePercent,
        baselineYear,
        latestYear,
        isImproving: totalChangePercent < 0
    }
}

/**
 * 스냅샷 유효성 검증
 * 
 * ISO 14067 6.4.7 요구:
 * - 동일한 기능단위
 * - 동일한 시스템 경계
 * - 동일한 PCR (있는 경우)
 * 
 * @param snapshots 검증할 스냅샷들
 * @returns 유효성 검증 결과
 */
export const validateSnapshotsConsistency = (
    snapshots: CFPSnapshot[]
): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (snapshots.length < 2) {
        return { valid: true, errors: [] }
    }

    const baseline = snapshots[0]

    for (let i = 1; i < snapshots.length; i++) {
        const current = snapshots[i]

        // 기능단위 확인
        if (current.functionalUnit !== baseline.functionalUnit) {
            errors.push(`스냅샷 ${i + 1}: 기능단위 불일치 (${baseline.functionalUnit} ≠ ${current.functionalUnit})`)
        }

        // 시스템 경계 확인
        if (current.boundary !== baseline.boundary) {
            errors.push(`스냅샷 ${i + 1}: 시스템 경계 불일치 (${baseline.boundary} ≠ ${current.boundary})`)
        }

        // PCR 확인 (둘 다 있는 경우만)
        if (baseline.pcrReference && current.pcrReference &&
            baseline.pcrReference !== current.pcrReference) {
            errors.push(`스냅샷 ${i + 1}: PCR 참조 불일치`)
        }
    }

    return {
        valid: errors.length === 0,
        errors
    }
}

/**
 * 단계별 변화량 분석
 * 
 * @param previous 이전 스냅샷
 * @param current 현재 스냅샷
 * @returns 단계별 변화량
 */
export const analyzeStageChanges = (
    previous: CFPSnapshot,
    current: CFPSnapshot
): { stageId: string; stageName: string; change: number; changePercent: number }[] | null => {
    if (!previous.stageBreakdown || !current.stageBreakdown) return null

    const changes: { stageId: string; stageName: string; change: number; changePercent: number }[] = []

    for (const currStage of current.stageBreakdown) {
        const prevStage = previous.stageBreakdown.find(s => s.stageId === currStage.stageId)

        if (prevStage) {
            const change = currStage.emission - prevStage.emission
            const changePercent = prevStage.emission !== 0
                ? (change / prevStage.emission) * 100
                : 0

            changes.push({
                stageId: currStage.stageId,
                stageName: currStage.stageName,
                change,
                changePercent
            })
        }
    }

    return changes
}

/**
 * CFP 감축 목표 대비 진척도 계산
 * 
 * @param baseline 기준 CFP
 * @param current 현재 CFP
 * @param targetReduction 목표 감축률 (%, 예: 30 = 30% 감축)
 * @returns 진척도 정보
 */
export const calculateProgressToTarget = (
    baseline: number,
    current: number,
    targetReduction: number
): {
    targetCFP: number
    currentReduction: number
    progressPercent: number
    remainingReduction: number
    isAchieved: boolean
} => {
    const targetCFP = baseline * (1 - targetReduction / 100)
    const currentReduction = ((baseline - current) / baseline) * 100
    const progressPercent = Math.min((currentReduction / targetReduction) * 100, 100)
    const remainingReduction = Math.max(targetReduction - currentReduction, 0)

    return {
        targetCFP,
        currentReduction,
        progressPercent,
        remainingReduction,
        isAchieved: currentReduction >= targetReduction
    }
}

// =============================================================================
// 보고용 포맷터
// =============================================================================

/**
 * 추세 아이콘 반환
 */
export const getTrendIcon = (trend: CFPTrend): string => {
    switch (trend) {
        case 'improving': return '📉'
        case 'worsening': return '📈'
        case 'stable': return '➡️'
    }
}

/**
 * 추세 레이블 반환 (한글)
 */
export const getTrendLabel = (trend: CFPTrend): string => {
    switch (trend) {
        case 'improving': return '개선'
        case 'worsening': return '악화'
        case 'stable': return '안정'
    }
}

/**
 * 변화율 포맷팅
 */
export const formatChangePercent = (percent: number): string => {
    const sign = percent > 0 ? '+' : ''
    return `${sign}${percent.toFixed(1)}%`
}
