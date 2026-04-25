/**
 * Step Validation Module
 * 
 * 각 단계에서 "다음" 버튼 클릭 시 최소 데이터 입력 여부를 검증하여
 * 불완전한 데이터로 진행하는 것을 방지합니다.
 * 
 * ISO 14067 준수를 위한 필수 항목과 권장 항목을 구분합니다.
 */

import type { PCFState } from './store'

// =============================================================================
// 타입 정의
// =============================================================================

export interface ValidationResult {
    isValid: boolean
    errors: string[]    // 진행 불가 — 필수 항목 누락
    warnings: string[]  // 진행 가능 — 권장 항목 누락
}

// =============================================================================
// 단계별 검증 로직
// =============================================================================

/**
 * Step 1: 제품 정보 (ISO 14067 6.3)
 */
function validateProductInfo(state: PCFState): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!state.productInfo.name || state.productInfo.name.trim() === '') {
        errors.push('제품명을 입력해주세요.')
    }

    if (!state.productInfo.unit || state.productInfo.unit.trim() === '') {
        errors.push('기능 단위(Functional Unit)를 입력해주세요.')
    }

    if (!state.productInfo.boundary) {
        errors.push('시스템 경계를 선택해주세요.')
    }

    if (!state.productInfo.referenceFlow) {
        warnings.push('기준 흐름(Reference Flow)을 입력하면 결과의 정확도가 높아집니다.')
    }

    return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Step 2: 시스템 경계 (ISO 14067 6.3.2)
 */
function validateSystemBoundary(state: PCFState): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (state.stages.length === 0) {
        errors.push('최소 1개의 라이프사이클 단계를 선택해주세요.')
    }

    // Cradle-to-grave인데 use/eol이 없으면 경고
    if (state.productInfo.boundary === 'cradle-to-grave') {
        if (!state.stages.includes('use')) {
            warnings.push('Cradle-to-grave 경계에서 사용 단계 포함을 권장합니다.')
        }
        if (!state.stages.includes('eol')) {
            warnings.push('Cradle-to-grave 경계에서 폐기 단계 포함을 권장합니다.')
        }
    }

    return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Step 3: 활동 데이터 (ISO 14067 6.4)
 */
function validateActivityData(state: PCFState): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 각 선택된 단계에 최소 1개 값 입력 확인
    const stageFields: Record<string, string[]> = {
        raw_materials: ['raw_material_weight'],
        manufacturing: ['electricity', 'gas'],
        transport: ['transport_weight', 'transport_distance'],
        packaging: ['packaging_weight'],
        use: ['use_electricity', 'use_years'],
        eol: ['waste_weight']
    }

    const data = state.activityData as Record<string, any>
    const detailed = state.detailedActivityData

    for (const stageId of state.stages) {
        const fields = stageFields[stageId] || []
        const hasSimpleData = fields.some(f => {
            const val = data[f]
            return val !== undefined && val !== null && val !== 0 && val !== ''
        })

        // detailedActivityData도 확인 (BOM 등 고급 입력)
        let hasDetailedData = false
        if (detailed) {
            switch (stageId) {
                case 'raw_materials':
                    hasDetailedData = (detailed.raw_materials?.length ?? 0) > 0
                    break
                case 'manufacturing':
                    hasDetailedData = (detailed.manufacturing?.electricity?.length ?? 0) > 0 ||
                        (detailed.manufacturing?.fuels?.length ?? 0) > 0
                    break
                case 'transport':
                    hasDetailedData = (detailed.transport?.length ?? 0) > 0
                    break
                case 'packaging':
                    hasDetailedData = (detailed.packaging?.length ?? 0) > 0
                    break
                case 'use':
                    hasDetailedData = (detailed.use?.electricity?.length ?? 0) > 0
                    break
                case 'eol':
                    hasDetailedData = (detailed.eol?.disposal?.length ?? 0) > 0 ||
                        (detailed.eol?.recycling?.length ?? 0) > 0
                    break
            }
        }

        const stageLabels: Record<string, string> = {
            raw_materials: '원자재',
            manufacturing: '제조',
            transport: '운송',
            packaging: '포장',
            use: '사용',
            eol: '폐기'
        }

        if (!hasSimpleData && !hasDetailedData) {
            warnings.push(`${stageLabels[stageId] || stageId} 단계에 활동 데이터가 입력되지 않았습니다.`)
        }
    }

    return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Step 4: 데이터 품질 (ISO 14067 6.3.5)
 * — 경고만, 필수 아님
 */
function validateDataQuality(state: PCFState): ValidationResult {
    const warnings: string[] = []

    if (state.dataQualityMeta.overallType === 'estimated') {
        warnings.push('추정 데이터(Estimated Data)만 사용 중입니다. 실측 데이터 확보를 권장합니다.')
    }

    return { isValid: true, errors: [], warnings }
}

/**
 * Step 5: 할당 (ISO 14067 6.4.6)
 * — 경고만, 필수 아님
 */
function validateAllocation(_state: PCFState): ValidationResult {
    return { isValid: true, errors: [], warnings: [] }
}

// =============================================================================
// 공개 API
// =============================================================================

/**
 * 특정 단계의 유효성 검증 수행
 * @param stepId 1-based 단계 번호
 * @param state PCF 스토어 상태
 */
export function validateStep(stepId: number, state: PCFState): ValidationResult {
    switch (stepId) {
        case 1: return validateProductInfo(state)
        case 2: return validateSystemBoundary(state)
        case 3: return validateActivityData(state)
        case 4: return validateDataQuality(state)
        case 5: return validateAllocation(state)
        default: return { isValid: true, errors: [], warnings: [] }
    }
}
