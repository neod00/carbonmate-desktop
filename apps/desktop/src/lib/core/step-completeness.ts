// =============================================================================
// Step Completeness Calculator
// 각 단계의 입력 완성도를 0~100%로 계산
// =============================================================================

import type { PCFState } from "@/lib/core/store"

/**
 * 단계별 완성도를 0~100 (정수)으로 반환
 */
export function getStepCompleteness(stepId: number, state: PCFState): number {
    switch (stepId) {
        case 1: return getProductInfoCompleteness(state)
        case 2: return getSystemBoundaryCompleteness(state)
        case 3: return getActivityDataCompleteness(state)
        case 4: return getDataQualityCompleteness(state)
        case 5: return getAllocationCompleteness(state)
        case 6: return getSensitivityCompleteness(state)
        case 7: return 0 // 결과 — 계산 전까지 0%
        default: return 0
    }
}

function getProductInfoCompleteness(state: PCFState): number {
    const pi = state.productInfo
    let filled = 0
    let total = 5

    if (pi.name?.trim()) filled++
    if (pi.unit?.trim()) filled++
    if (pi.boundary) filled++
    if (pi.category) filled++
    if (pi.studyGoal?.applicationPurpose) filled++

    return Math.round((filled / total) * 100)
}

function getSystemBoundaryCompleteness(state: PCFState): number {
    const pi = state.productInfo
    let filled = 0
    let total = 2

    if (pi.boundary) filled++
    if (state.stages && state.stages.length > 0) filled++

    return Math.round((filled / total) * 100)
}

function getActivityDataCompleteness(state: PCFState): number {
    const stages = state.stages || []
    if (stages.length === 0) return 0

    let filledStages = 0
    const ad = state.activityData as Record<string, any>
    const detailed = state.detailedActivityData

    for (const stage of stages) {
        switch (stage) {
            case 'raw_materials':
                if ((detailed?.raw_materials?.length || 0) > 0) filledStages++
                break
            case 'manufacturing':
                if ((ad['electricity_kwh'] || 0) > 0 || (ad['natural_gas_m3'] || 0) > 0) filledStages++
                break
            case 'transport':
                if ((ad['transport_distance'] || 0) > 0) filledStages++
                break
            case 'packaging':
                if ((ad['packaging_weight'] || 0) > 0) filledStages++
                break
            case 'use':
                if ((ad['use_phase_energy'] || 0) > 0) filledStages++
                break
            case 'eol':
                if ((ad['waste_weight'] || 0) > 0) filledStages++
                break
        }
    }

    return Math.round((filledStages / stages.length) * 100)
}

function getDataQualityCompleteness(state: PCFState): number {
    const dq = state.dataQualityMeta
    let filled = 0
    let total = 2

    if (dq?.overallType) filled++
    if (dq?.sources && dq.sources.length > 0) filled++

    return Math.round((filled / total) * 100)
}

function getAllocationCompleteness(state: PCFState): number {
    let filled = 0
    let total = 1

    if (state.multiOutputAllocation?.method) filled++

    return Math.round((filled / total) * 100)
}

function getSensitivityCompleteness(state: PCFState): number {
    // 민감도 분석은 선택적이므로 데이터가 있으면 100%, 없으면 0%
    const sa = state.sensitivityAnalysis
    if (!sa) return 0
    if ((sa as any).scenarios && (sa as any).scenarios.length > 0) return 100
    return 0
}
