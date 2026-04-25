/**
 * ISO 14067:2018 6.3.4.3 Cut-off Criteria (제외 기준)
 * 
 * 중요도가 낮은 물질/에너지 흐름을 제외하기 위한 기준 정의 및 적용 로직
 * 
 * ISO 14067 6.3.4.3 요구사항:
 * - 일반적으로 분석 대상 시스템에 귀속되는 모든 공정과 흐름은 포함되어야 함
 * - 개별 물질/에너지 흐름이 특정 단위공정의 탄소발자국에 중요하지 않은 경우 실용적 이유로 제외 가능
 * - 일관된 제외 기준을 목표 및 범위 정의 단계에서 정의해야 함
 * - 선택된 제외 기준이 연구 결과에 미치는 영향을 평가하고 CFP 연구 보고서에 설명해야 함
 */

import { SimplifiedActivityData } from './store'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 제외 기준 설정
 */
export interface CutOffCriteria {
    massThreshold: number           // % - 질량 기준 (전체 투입 질량 대비)
    energyThreshold: number         // % - 에너지 기준 (전체 투입 에너지 대비)
    environmentalThreshold: number  // % - 환경 영향 기준 (전체 CFP 대비)
    enabled: boolean                // 제외 기준 활성화 여부
    description: string             // 기준 설명
}

/**
 * 제외 기준 프리셋
 */
export type CutOffPreset = 'none' | 'standard' | 'strict' | 'custom'

/**
 * 개별 항목의 기여도 정보
 */
export interface ItemContribution {
    id: string
    name: string
    nameKo: string
    stage: string
    stageKo: string
    quantity: number
    unit: string
    emission: number                // kg CO2e
    massContribution?: number       // % - 질량 기여도
    energyContribution?: number     // % - 에너지 기여도
    emissionContribution: number    // % - 배출량 기여도
    isExcluded: boolean             // 제외 여부
    exclusionReason?: string        // 제외 사유
}

/**
 * 제외 기준 적용 결과
 */
export interface CutOffResult {
    criteria: CutOffCriteria
    totalItems: number              // 전체 항목 수
    excludedItems: number           // 제외된 항목 수
    includedItems: number           // 포함된 항목 수
    totalMass: number               // 전체 질량 (kg)
    excludedMass: number            // 제외된 질량 (kg)
    excludedMassPercent: number     // 제외된 질량 비율 (%)
    totalEnergy: number             // 전체 에너지 (MJ)
    excludedEnergy: number          // 제외된 에너지 (MJ)
    excludedEnergyPercent: number   // 제외된 에너지 비율 (%)
    totalEmission: number           // 전체 배출량 (kg CO2e)
    excludedEmission: number        // 제외된 배출량 (kg CO2e)
    excludedEmissionPercent: number // 제외된 배출량 비율 (%)
    items: ItemContribution[]       // 모든 항목 (포함/제외 여부 포함)
    excludedItemsList: ItemContribution[]  // 제외된 항목 목록
    isoCompliance: {
        clause: string
        requirement: string
        satisfied: boolean
        notes: string
    }[]
}

// =============================================================================
// 상수 및 프리셋
// =============================================================================

/**
 * 제외 기준 비활성화 (모든 항목 포함)
 */
export const NO_CUT_OFF: CutOffCriteria = {
    massThreshold: 0,
    energyThreshold: 0,
    environmentalThreshold: 0,
    enabled: false,
    description: '제외 기준 없음 - 모든 항목 포함'
}

/**
 * 표준 제외 기준 (ISO 14044 참조, 일반적으로 1%)
 */
export const STANDARD_CUT_OFF: CutOffCriteria = {
    massThreshold: 1,
    energyThreshold: 1,
    environmentalThreshold: 1,
    enabled: true,
    description: '전체 투입물의 1% 미만인 항목은 제외 가능 (ISO 14067 6.3.4.3)'
}

/**
 * 엄격한 제외 기준 (0.1%)
 */
export const STRICT_CUT_OFF: CutOffCriteria = {
    massThreshold: 0.1,
    energyThreshold: 0.1,
    environmentalThreshold: 0.1,
    enabled: true,
    description: '엄격한 기준: 전체의 0.1% 미만인 항목만 제외'
}

/**
 * 프리셋 가져오기
 */
export const getCutOffPreset = (preset: CutOffPreset): CutOffCriteria => {
    switch (preset) {
        case 'none':
            return NO_CUT_OFF
        case 'standard':
            return STANDARD_CUT_OFF
        case 'strict':
            return STRICT_CUT_OFF
        case 'custom':
        default:
            return { ...STANDARD_CUT_OFF }
    }
}

/**
 * 프리셋 옵션 목록
 */
export const CUT_OFF_PRESETS = [
    {
        id: 'none' as CutOffPreset,
        name: 'No Cut-off',
        nameKo: '제외 기준 없음',
        description: '모든 항목을 포함합니다',
        descriptionKo: '모든 물질 및 에너지 흐름을 계산에 포함합니다'
    },
    {
        id: 'standard' as CutOffPreset,
        name: 'Standard (1%)',
        nameKo: '표준 (1%)',
        description: 'Items < 1% are excluded',
        descriptionKo: '질량/에너지/환경영향 기준 1% 미만 항목 제외'
    },
    {
        id: 'strict' as CutOffPreset,
        name: 'Strict (0.1%)',
        nameKo: '엄격 (0.1%)',
        description: 'Items < 0.1% are excluded',
        descriptionKo: '질량/에너지/환경영향 기준 0.1% 미만 항목만 제외'
    },
    {
        id: 'custom' as CutOffPreset,
        name: 'Custom',
        nameKo: '사용자 정의',
        description: 'Define your own thresholds',
        descriptionKo: '제외 기준을 직접 설정합니다'
    }
]

// =============================================================================
// 단계 및 항목 정보
// =============================================================================

const STAGE_LABELS: Record<string, { ko: string; en: string }> = {
    raw_materials: { ko: '원료 채취', en: 'Raw Materials' },
    manufacturing: { ko: '제조', en: 'Manufacturing' },
    transport: { ko: '운송', en: 'Transport' },
    packaging: { ko: '포장', en: 'Packaging' },
    use: { ko: '사용', en: 'Use' },
    eol: { ko: '폐기', en: 'End-of-Life' }
}

const ITEM_LABELS: Record<string, { ko: string; en: string; unit: string; type: 'mass' | 'energy' | 'other' }> = {
    raw_material_weight: { ko: '원자재', en: 'Raw Materials', unit: 'kg', type: 'mass' },
    electricity: { ko: '전력', en: 'Electricity', unit: 'kWh', type: 'energy' },
    gas: { ko: '천연가스', en: 'Natural Gas', unit: 'MJ', type: 'energy' },
    diesel: { ko: '경유', en: 'Diesel', unit: 'L', type: 'energy' },
    transport_weight: { ko: '운송 화물', en: 'Transport Cargo', unit: 'kg', type: 'mass' },
    packaging_weight: { ko: '포장재', en: 'Packaging', unit: 'kg', type: 'mass' },
    use_electricity: { ko: '사용 단계 전력', en: 'Use Phase Electricity', unit: 'kWh', type: 'energy' },
    waste_weight: { ko: '폐기물', en: 'Waste', unit: 'kg', type: 'mass' },
    aircraft_transport_weight: { ko: '항공 운송 화물', en: 'Air Transport Cargo', unit: 'kg', type: 'mass' }
}

// =============================================================================
// 배출계수 (간소화된 버전)
// =============================================================================

const EMISSION_FACTORS: Record<string, number> = {
    raw_material_weight: 2.0,       // kg CO2e/kg (기본 원료)
    electricity: 0.4173,             // kg CO2e/kWh (한국 전력 2023 소비단, 2025 공식)
    gas: 0.0561,                     // kg CO2e/MJ
    diesel: 2.68,                    // kg CO2e/L
    transport: 0.062,                // kg CO2e/tkm (트럭)
    packaging_weight: 2.5,           // kg CO2e/kg (평균)
    use_electricity: 0.4173,         // kg CO2e/kWh (2025 공식)
    waste: 0.58,                     // kg CO2e/kg (매립)
    aircraft_transport: 1.13         // kg CO2e/tkm (항공)
}

// 에너지 환산 계수 (MJ로 통일)
const ENERGY_FACTORS: Record<string, number> = {
    electricity: 3.6,    // kWh -> MJ
    gas: 1,              // MJ
    diesel: 36,          // L -> MJ (디젤 에너지 밀도)
    use_electricity: 3.6 // kWh -> MJ
}

// =============================================================================
// 제외 기준 적용 함수
// =============================================================================

/**
 * 활동 데이터에 제외 기준을 적용하고 결과 반환
 */
export const applyCutOffCriteria = (
    activityData: SimplifiedActivityData,
    criteria: CutOffCriteria,
    stages: string[]
): CutOffResult => {
    const items: ItemContribution[] = []

    // 1단계: 모든 항목의 기여도 계산
    let totalMass = 0
    let totalEnergy = 0
    let totalEmission = 0

    // 원자재 (질량)
    if (activityData.raw_material_weight && activityData.raw_material_weight > 0 && stages.includes('raw_materials')) {
        const emission = activityData.raw_material_weight * EMISSION_FACTORS.raw_material_weight
        totalMass += activityData.raw_material_weight
        totalEmission += emission
        items.push({
            id: 'raw_material_weight',
            name: 'Raw Materials',
            nameKo: '원자재',
            stage: 'raw_materials',
            stageKo: '원료 채취',
            quantity: activityData.raw_material_weight,
            unit: 'kg',
            emission,
            massContribution: 0,
            emissionContribution: 0,
            isExcluded: false
        })
    }

    // 전력 (에너지)
    if (activityData.electricity && activityData.electricity > 0 && stages.includes('manufacturing')) {
        const emission = activityData.electricity * EMISSION_FACTORS.electricity
        const energy = activityData.electricity * ENERGY_FACTORS.electricity
        totalEnergy += energy
        totalEmission += emission
        items.push({
            id: 'electricity',
            name: 'Electricity',
            nameKo: '전력',
            stage: 'manufacturing',
            stageKo: '제조',
            quantity: activityData.electricity,
            unit: 'kWh',
            emission,
            energyContribution: 0,
            emissionContribution: 0,
            isExcluded: false
        })
    }

    // 천연가스 (에너지)
    if (activityData.gas && activityData.gas > 0 && stages.includes('manufacturing')) {
        const emission = activityData.gas * EMISSION_FACTORS.gas
        totalEnergy += activityData.gas
        totalEmission += emission
        items.push({
            id: 'gas',
            name: 'Natural Gas',
            nameKo: '천연가스',
            stage: 'manufacturing',
            stageKo: '제조',
            quantity: activityData.gas,
            unit: 'MJ',
            emission,
            energyContribution: 0,
            emissionContribution: 0,
            isExcluded: false
        })
    }

    // 경유 (에너지)
    if (activityData.diesel && activityData.diesel > 0 && stages.includes('manufacturing')) {
        const emission = activityData.diesel * EMISSION_FACTORS.diesel
        const energy = activityData.diesel * ENERGY_FACTORS.diesel
        totalEnergy += energy
        totalEmission += emission
        items.push({
            id: 'diesel',
            name: 'Diesel',
            nameKo: '경유',
            stage: 'manufacturing',
            stageKo: '제조',
            quantity: activityData.diesel,
            unit: 'L',
            emission,
            energyContribution: 0,
            emissionContribution: 0,
            isExcluded: false
        })
    }

    // 운송
    if (activityData.transport_weight && activityData.transport_distance && stages.includes('transport')) {
        const tkm = (activityData.transport_weight * activityData.transport_distance) / 1000
        const emission = tkm * EMISSION_FACTORS.transport
        totalMass += activityData.transport_weight
        totalEmission += emission
        items.push({
            id: 'transport',
            name: 'Transport',
            nameKo: '운송',
            stage: 'transport',
            stageKo: '운송',
            quantity: tkm,
            unit: 'tkm',
            emission,
            massContribution: 0,
            emissionContribution: 0,
            isExcluded: false
        })
    }

    // 항공 운송 (별도)
    if (activityData.aircraft_transport_weight && activityData.aircraft_transport_distance && stages.includes('transport')) {
        const tkm = (activityData.aircraft_transport_weight * activityData.aircraft_transport_distance) / 1000
        const emission = tkm * EMISSION_FACTORS.aircraft_transport
        totalMass += activityData.aircraft_transport_weight
        totalEmission += emission
        items.push({
            id: 'aircraft_transport',
            name: 'Air Transport',
            nameKo: '항공 운송',
            stage: 'transport',
            stageKo: '운송',
            quantity: tkm,
            unit: 'tkm',
            emission,
            massContribution: 0,
            emissionContribution: 0,
            isExcluded: false
        })
    }

    // 포장재
    if (activityData.packaging_weight && activityData.packaging_weight > 0 && stages.includes('packaging')) {
        const emission = activityData.packaging_weight * EMISSION_FACTORS.packaging_weight
        totalMass += activityData.packaging_weight
        totalEmission += emission
        items.push({
            id: 'packaging',
            name: 'Packaging',
            nameKo: '포장재',
            stage: 'packaging',
            stageKo: '포장',
            quantity: activityData.packaging_weight,
            unit: 'kg',
            emission,
            massContribution: 0,
            emissionContribution: 0,
            isExcluded: false
        })
    }

    // 사용 단계 전력
    if (activityData.use_electricity && activityData.use_years && stages.includes('use')) {
        const totalElectricity = activityData.use_electricity * activityData.use_years
        const emission = totalElectricity * EMISSION_FACTORS.use_electricity
        const energy = totalElectricity * ENERGY_FACTORS.use_electricity
        totalEnergy += energy
        totalEmission += emission
        items.push({
            id: 'use_electricity',
            name: 'Use Phase Electricity',
            nameKo: '사용 단계 전력',
            stage: 'use',
            stageKo: '사용',
            quantity: totalElectricity,
            unit: 'kWh',
            emission,
            energyContribution: 0,
            emissionContribution: 0,
            isExcluded: false
        })
    }

    // 폐기
    if (activityData.waste_weight && activityData.waste_weight > 0 && stages.includes('eol')) {
        const recyclingRate = (activityData.recycling_rate || 0) / 100
        const disposalWeight = activityData.waste_weight * (1 - recyclingRate)
        const emission = disposalWeight * EMISSION_FACTORS.waste
        totalMass += activityData.waste_weight
        totalEmission += emission
        items.push({
            id: 'waste',
            name: 'Waste Disposal',
            nameKo: '폐기물 처리',
            stage: 'eol',
            stageKo: '폐기',
            quantity: activityData.waste_weight,
            unit: 'kg',
            emission,
            massContribution: 0,
            emissionContribution: 0,
            isExcluded: false
        })
    }

    // 2단계: 기여도 비율 계산
    items.forEach(item => {
        if (item.massContribution !== undefined && totalMass > 0) {
            // 질량 기여도는 해당 항목의 quantity가 질량인 경우에만
            if (item.unit === 'kg') {
                item.massContribution = (item.quantity / totalMass) * 100
            }
        }
        if (item.energyContribution !== undefined && totalEnergy > 0) {
            // 에너지 기여도
            let itemEnergy = 0
            if (item.id === 'electricity') itemEnergy = item.quantity * ENERGY_FACTORS.electricity
            else if (item.id === 'gas') itemEnergy = item.quantity
            else if (item.id === 'diesel') itemEnergy = item.quantity * ENERGY_FACTORS.diesel
            else if (item.id === 'use_electricity') itemEnergy = item.quantity * ENERGY_FACTORS.use_electricity
            item.energyContribution = (itemEnergy / totalEnergy) * 100
        }
        item.emissionContribution = totalEmission > 0 ? (item.emission / totalEmission) * 100 : 0
    })

    // 3단계: 제외 기준 적용
    let excludedMass = 0
    let excludedEnergy = 0
    let excludedEmission = 0

    if (criteria.enabled) {
        items.forEach(item => {
            let shouldExclude = false
            const reasons: string[] = []

            // 질량 기준 체크
            if (item.massContribution !== undefined && item.massContribution < criteria.massThreshold) {
                shouldExclude = true
                reasons.push(`질량 ${item.massContribution.toFixed(2)}% < ${criteria.massThreshold}%`)
            }

            // 에너지 기준 체크
            if (item.energyContribution !== undefined && item.energyContribution < criteria.energyThreshold) {
                shouldExclude = true
                reasons.push(`에너지 ${item.energyContribution.toFixed(2)}% < ${criteria.energyThreshold}%`)
            }

            // 환경영향(배출량) 기준 체크
            if (item.emissionContribution < criteria.environmentalThreshold) {
                shouldExclude = true
                reasons.push(`배출량 ${item.emissionContribution.toFixed(2)}% < ${criteria.environmentalThreshold}%`)
            }

            // 모든 조건을 만족해야 제외 (OR 조건)
            // ISO 14044에서는 일반적으로 질량, 에너지, 환경영향 중 하나라도 기준 미만이면 제외 가능
            // 하지만 보수적 접근을 위해 환경영향 기준만 적용하는 옵션도 고려
            if (shouldExclude && item.emissionContribution < criteria.environmentalThreshold) {
                item.isExcluded = true
                item.exclusionReason = reasons.join(', ')
                excludedEmission += item.emission

                if (item.unit === 'kg') {
                    excludedMass += item.quantity
                }
                if (item.energyContribution !== undefined) {
                    let itemEnergy = 0
                    if (item.id === 'electricity') itemEnergy = item.quantity * ENERGY_FACTORS.electricity
                    else if (item.id === 'gas') itemEnergy = item.quantity
                    else if (item.id === 'diesel') itemEnergy = item.quantity * ENERGY_FACTORS.diesel
                    else if (item.id === 'use_electricity') itemEnergy = item.quantity * ENERGY_FACTORS.use_electricity
                    excludedEnergy += itemEnergy
                }
            }
        })
    }

    // 4단계: ISO 준수 여부 확인
    const excludedItemsList = items.filter(item => item.isExcluded)
    const excludedEmissionPercent = totalEmission > 0 ? (excludedEmission / totalEmission) * 100 : 0

    const isoCompliance = [
        {
            clause: 'ISO 14067:2018 6.3.4.3',
            requirement: '제외 기준은 목표 및 범위 정의 단계에서 정의되어야 함',
            satisfied: criteria.enabled || !criteria.enabled, // 기준 정의됨
            notes: criteria.enabled
                ? `질량 ${criteria.massThreshold}%, 에너지 ${criteria.energyThreshold}%, 환경영향 ${criteria.environmentalThreshold}% 기준 적용`
                : '제외 기준 없이 모든 항목 포함'
        },
        {
            clause: 'ISO 14067:2018 6.3.4.3',
            requirement: '제외된 항목은 데이터 제외로 보고되어야 함',
            satisfied: true,
            notes: excludedItemsList.length > 0
                ? `${excludedItemsList.length}개 항목 제외: ${excludedItemsList.map(i => i.nameKo).join(', ')}`
                : '제외된 항목 없음'
        },
        {
            clause: 'ISO 14067:2018 6.3.4.3',
            requirement: '제외 기준이 연구 결과에 미치는 영향 평가',
            satisfied: excludedEmissionPercent < 5, // 5% 미만이면 영향 미미
            notes: `제외된 배출량: ${excludedEmission.toFixed(4)} kg CO₂e (${excludedEmissionPercent.toFixed(2)}%)`
        },
        {
            clause: 'ISO 14044:2006 4.2.3.3.3',
            requirement: '제외된 물질/에너지 흐름의 총합이 의미있는 영향을 미치지 않아야 함',
            satisfied: excludedEmissionPercent < 5,
            notes: excludedEmissionPercent >= 5
                ? '⚠️ 제외 비율이 높음 - 기준 재검토 권장'
                : '제외 기준이 적절함'
        }
    ]

    return {
        criteria,
        totalItems: items.length,
        excludedItems: excludedItemsList.length,
        includedItems: items.length - excludedItemsList.length,
        totalMass,
        excludedMass,
        excludedMassPercent: totalMass > 0 ? (excludedMass / totalMass) * 100 : 0,
        totalEnergy,
        excludedEnergy,
        excludedEnergyPercent: totalEnergy > 0 ? (excludedEnergy / totalEnergy) * 100 : 0,
        totalEmission,
        excludedEmission,
        excludedEmissionPercent,
        items,
        excludedItemsList,
        isoCompliance
    }
}

/**
 * 제외 기준 적용 후 조정된 배출량 계산
 */
export const getAdjustedEmission = (cutOffResult: CutOffResult): number => {
    return cutOffResult.totalEmission - cutOffResult.excludedEmission
}

/**
 * 제외 기준 영향 평가 요약 생성
 */
export const generateCutOffSummary = (cutOffResult: CutOffResult): string => {
    const { criteria, excludedItems, excludedEmissionPercent, excludedItemsList } = cutOffResult

    if (!criteria.enabled) {
        return '제외 기준이 적용되지 않았습니다. 모든 물질 및 에너지 흐름이 계산에 포함되었습니다.'
    }

    if (excludedItems === 0) {
        return `제외 기준(질량 ${criteria.massThreshold}%, 에너지 ${criteria.energyThreshold}%, 환경영향 ${criteria.environmentalThreshold}%)을 적용한 결과, 모든 항목이 기준을 초과하여 제외된 항목이 없습니다.`
    }

    return `제외 기준(질량 ${criteria.massThreshold}%, 에너지 ${criteria.energyThreshold}%, 환경영향 ${criteria.environmentalThreshold}%)을 적용한 결과, ${excludedItems}개 항목(${excludedItemsList.map(i => i.nameKo).join(', ')})이 제외되었습니다. 제외된 배출량은 전체의 ${excludedEmissionPercent.toFixed(2)}%입니다.`
}

/**
 * 제외 기준 검증 - 너무 많이 제외되는지 확인
 */
export const validateCutOffCriteria = (cutOffResult: CutOffResult): {
    isValid: boolean
    warnings: string[]
    recommendations: string[]
} => {
    const warnings: string[] = []
    const recommendations: string[] = []

    // 5% 이상 제외되면 경고
    if (cutOffResult.excludedEmissionPercent >= 5) {
        warnings.push(`제외된 배출량이 ${cutOffResult.excludedEmissionPercent.toFixed(1)}%로 높습니다`)
        recommendations.push('제외 기준을 더 엄격하게 설정하거나 제외 없이 계산하는 것을 권장합니다')
    }

    // 너무 많은 항목이 제외되면 경고
    if (cutOffResult.excludedItems > cutOffResult.totalItems / 2) {
        warnings.push(`전체 ${cutOffResult.totalItems}개 항목 중 ${cutOffResult.excludedItems}개가 제외되었습니다`)
        recommendations.push('제외 기준 임계값을 낮추는 것을 권장합니다')
    }

    // 질량 또는 에너지가 5% 이상 제외되면 경고
    if (cutOffResult.excludedMassPercent >= 5) {
        warnings.push(`제외된 질량이 ${cutOffResult.excludedMassPercent.toFixed(1)}%입니다`)
    }
    if (cutOffResult.excludedEnergyPercent >= 5) {
        warnings.push(`제외된 에너지가 ${cutOffResult.excludedEnergyPercent.toFixed(1)}%입니다`)
    }

    return {
        isValid: warnings.length === 0,
        warnings,
        recommendations
    }
}

export default {
    applyCutOffCriteria,
    getAdjustedEmission,
    generateCutOffSummary,
    validateCutOffCriteria,
    getCutOffPreset,
    NO_CUT_OFF,
    STANDARD_CUT_OFF,
    STRICT_CUT_OFF,
    CUT_OFF_PRESETS
}

