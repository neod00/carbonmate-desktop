/**
 * 배출량 계산 엔진 (ISO 14067 6.4, 6.5 준수)
 * 
 * results.tsx와 sensitivity-analysis.tsx에서 공유하는 순수 계산 로직.
 * UI 의존성 없이 순수 함수로만 구성됨.
 */

import {
    ELECTRICITY_EMISSION_FACTORS,
    TRANSPORT_EMISSION_FACTORS,
    MATERIAL_EMISSION_FACTORS,
    EOL_EMISSION_FACTORS,
    getDefaultElectricityFactor,
    getDefaultTransportFactor
} from '@/lib/emission-factors'
import type { RecyclingAllocation, MultiOutputAllocation } from '@/lib/allocation'
import { calculatePhysicalAllocation, calculateEconomicAllocation } from '@/lib/allocation'

// =============================================================================
// 타입 정의
// =============================================================================

export interface EmissionDetail {
    source: string
    value: number
    type: string
    emissionFactor: string
    quantity: number
    unit: string
}

export interface StageEmissionResult {
    total: number
    fossil: number
    biogenic: number
    aircraft: number
    uncertainty: number
    ghgBreakdown: Record<string, number> // P1-3: GHG별 분해 (CO2, CH4, N2O 등) - kg CO2e 단위
    details: EmissionDetail[]
}

export interface CalculationInput {
    activityData: Record<string, any>
    detailedActivityData?: {
        raw_materials?: any[]
        transport?: any[]
        packaging?: any[]
    } | null
    recyclingAllocation: RecyclingAllocation
}

// =============================================================================
// 단계별 배출량 계산
// =============================================================================

/**
 * 단일 생애주기 단계의 배출량을 계산합니다.
 * 
 * @param stageId - 단계 ID (raw_materials, manufacturing, transport, packaging, use, eol)
 * @param input - 계산 입력 데이터
 * @returns StageEmissionResult
 */
export function calculateStageEmission(
    stageId: string,
    input: CalculationInput
): StageEmissionResult {
    const { activityData, detailedActivityData, recyclingAllocation } = input

    const result: StageEmissionResult = {
        total: 0,
        fossil: 0,
        biogenic: 0,
        aircraft: 0,
        uncertainty: 0,
        ghgBreakdown: {}, // P1-3 초기화
        details: []
    }

    switch (stageId) {
        case 'raw_materials': {
            const rawMaterials = detailedActivityData?.raw_materials || []

            // 1. 다중 원자재 입력 처리
            if (rawMaterials.length > 0) {
                rawMaterials.forEach(material => {
                    // 수량 정규화 (P1: 다양한 단위 지원)
                    // - 질량 단위(g/kg/t)는 kg 기준으로 자동 변환
                    // - 부피·기체·에너지 단위(m³, L, Nm³, kWh, MJ)는 변환 없이 EF와 1:1 곱셈
                    //   → 사용자는 EF를 해당 단위 기준(예: kgCO2e/m³)으로 입력해야 함
                    let weight = material.quantity || 0
                    const unitRaw = material.unit || 'kg'
                    const unit = unitRaw.toLowerCase()
                    if (unit === 'g') weight = weight / 1000
                    else if (unit === 't' || unit === 'ton') weight = weight * 1000
                    // m³, l, nm³, kwh, mj 등 비질량 단위는 그대로 두고 EF와 곱셈

                    // P1-run03-01: 용액 농도(%) 적용 — 50% NaOH 380kg → 100% 기준 190kg로 환산
                    const concentration = (material as any).concentrationPercent
                    if (typeof concentration === 'number' && concentration > 0 && concentration < 100) {
                        weight = weight * (concentration / 100)
                    }

                    // 배출계수 결정: 사용자 입력 > 시스템 DB > 없음
                    let emissionFactorValue: number | null = null
                    let emissionFactorUnit = 'kgCO2e/kg'
                    let emissionFactorSource = ''
                    let sourceType: 'fossil' | 'biogenic' | 'mixed' = 'fossil'
                    let uncertainty = 30 // 기본 불확실성

                    // 1순위: 사용자 직접 입력한 배출계수 (0은 cut-off로 유효)
                    if (typeof material.customEmissionFactor === 'number' && material.customEmissionFactor >= 0) {
                        emissionFactorValue = material.customEmissionFactor
                        emissionFactorSource = '사용자 입력'
                        uncertainty = 25
                    }
                    // 2순위: 시스템 기본 DB에서 materialType으로 조회
                    else {
                        const materialId = material.materialType
                        const factor = materialId
                            ? MATERIAL_EMISSION_FACTORS.find(f => f.id === materialId)
                            : null

                        if (factor) {
                            emissionFactorValue = factor.value
                            emissionFactorUnit = factor.unit
                            emissionFactorSource = factor.source
                            sourceType = factor.sourceType
                            uncertainty = factor.uncertainty
                        }
                    }

                    // 3순위: 없거나 음수면 미입력 처리 (사용자가 명시적으로 입력한 0은 위 1순위에서 cut-off로 통과)
                    if (emissionFactorValue === null || emissionFactorValue < 0) {
                        result.details.push({
                            source: `⚠️ ${material.name} (배출계수 미입력)`,
                            value: 0,
                            type: 'fossil',
                            emissionFactor: '미입력',
                            quantity: weight,
                            unit: unitRaw
                        })
                        return // 이 항목은 배출량 0으로 처리
                    }

                    const emission = weight * emissionFactorValue
                    result.total += emission

                    // P1-3: GHG 분해 집계
                    distributeGHG(result.ghgBreakdown, emission, sourceType)

                    if (sourceType === 'fossil') {
                        result.fossil += emission
                    } else if (sourceType === 'biogenic') {
                        result.biogenic += emission
                    } else {
                        result.fossil += emission * 0.5
                        result.biogenic += emission * 0.5
                    }

                    result.uncertainty = Math.max(result.uncertainty, uncertainty)

                    result.details.push({
                        source: material.name,
                        value: emission,
                        type: sourceType,
                        emissionFactor: `${emissionFactorValue} ${emissionFactorUnit}`,
                        quantity: weight,
                        unit: unitRaw
                    })
                })
            }
            // 2. 레거시/단일 입력 처리 (Fallback)
            else {
                const weight = activityData['raw_material_weight'] || 0
                const materialId = activityData['raw_material_type'] || 'material_steel_primary'
                const factor = MATERIAL_EMISSION_FACTORS.find(f => f.id === materialId)
                    || MATERIAL_EMISSION_FACTORS.find(f => f.id === 'material_steel_primary')!

                if (weight > 0 && factor) {
                    const emission = weight * factor.value
                    result.total += emission

                    // P1-3: GHG 분해 집계
                    distributeGHG(result.ghgBreakdown, emission, factor.sourceType)

                    if (factor.sourceType === 'fossil') {
                        result.fossil += emission
                    } else if (factor.sourceType === 'biogenic') {
                        result.biogenic += emission
                    } else {
                        result.fossil += emission * 0.5
                        result.biogenic += emission * 0.5
                    }

                    result.uncertainty = factor.uncertainty
                    result.details.push({
                        source: factor.nameKo,
                        value: emission,
                        type: factor.sourceType,
                        emissionFactor: `${factor.value} ${factor.unit}`,
                        quantity: weight,
                        unit: 'kg'
                    })
                }
            }
            break
        }

        case 'manufacturing': {
            // 전력
            const electricity = activityData['electricity'] || 0
            const gridId = activityData['electricity_grid'] || 'electricity_korea_2023_consumption'
            const gridFactor = ELECTRICITY_EMISSION_FACTORS.find(f => f.id === gridId)
                || getDefaultElectricityFactor()

            // P2-run03-02 (인계 직전 수정): 사용자 직접 입력 EF가 있으면 그리드 EF보다 우선 적용
            const electricityEFOverrideRaw = activityData['electricity_ef_override']
            const hasOverride = typeof electricityEFOverrideRaw === 'number' && electricityEFOverrideRaw >= 0
            const effectiveEF = hasOverride ? (electricityEFOverrideRaw as number) : (gridFactor?.value ?? 0)
            const effectiveEFUnit = gridFactor?.unit ?? 'kgCO2e/kWh'

            if (electricity > 0 && (hasOverride || gridFactor)) {
                const emission = electricity * effectiveEF
                result.total += emission
                result.fossil += emission

                // P1-3: GHG 분해 집계
                distributeGHG(result.ghgBreakdown, emission, 'fossil')

                result.uncertainty = Math.max(result.uncertainty, gridFactor?.uncertainty ?? 10)
                result.details.push({
                    source: hasOverride ? '전력 (사용자 EF)' : '전력',
                    value: emission,
                    type: 'fossil',
                    emissionFactor: `${effectiveEF} ${effectiveEFUnit}`,
                    quantity: electricity,
                    unit: 'kWh'
                })
            }

            // 천연가스 (P1: MJ 또는 Nm³ 단위 지원)
            const gas = activityData['gas'] || 0
            const gasUnit = (activityData['gas_unit'] as unknown as string) || 'MJ'
            if (gas > 0) {
                const gasEF = gasUnit === 'Nm³' ? 2.75 : 0.0561
                const gasEmission = gas * gasEF
                result.total += gasEmission
                result.fossil += gasEmission

                // P1-3: GHG 분해 집계
                distributeGHG(result.ghgBreakdown, gasEmission, 'fossil')
                result.details.push({
                    source: '천연가스',
                    value: gasEmission,
                    type: 'fossil',
                    emissionFactor: `${gasEF} kgCO2e/${gasUnit}`,
                    quantity: gas,
                    unit: gasUnit
                })
            }

            // 경유
            const diesel = activityData['diesel'] || 0
            if (diesel > 0) {
                const dieselEmission = diesel * 2.68 // IPCC
                result.total += dieselEmission
                result.fossil += dieselEmission

                // P1-3: GHG 분해 집계
                distributeGHG(result.ghgBreakdown, dieselEmission, 'fossil')
                result.details.push({
                    source: '경유',
                    value: dieselEmission,
                    type: 'fossil',
                    emissionFactor: '2.68 kgCO2e/L',
                    quantity: diesel,
                    unit: 'L'
                })
            }

            // 스팀/열에너지 (P0-2)
            const steam = activityData['steam'] || 0
            const steamEFRaw = activityData['steam_ef']
            const steamEF = typeof steamEFRaw === 'number' && steamEFRaw >= 0 ? steamEFRaw : 0.22 // 기본: 가스 보일러
            if (steam > 0) {
                const steamEmission = steam * steamEF
                result.total += steamEmission
                result.fossil += steamEmission

                distributeGHG(result.ghgBreakdown, steamEmission, 'fossil')
                result.details.push({
                    source: '스팀',
                    value: steamEmission,
                    type: 'fossil',
                    emissionFactor: `${steamEF} kgCO2e/kg`,
                    quantity: steam,
                    unit: 'kg'
                })
            }

            // 공정 폐기물 처리 (P0-3)
            const wasteCategories: Array<{
                qtyKey: string
                efKey: string
                defaultEF: number
                label: string
                unit: string
            }> = [
                { qtyKey: 'waste_general_qty', efKey: 'waste_general_ef', defaultEF: 0.03, label: '일반 폐기물 매립', unit: 'kg' },
                { qtyKey: 'waste_hazardous_qty', efKey: 'waste_hazardous_ef', defaultEF: 1.20, label: '지정 폐기물 처리', unit: 'kg' },
                { qtyKey: 'waste_water_qty', efKey: 'waste_water_ef', defaultEF: 0.40, label: '산업폐수 처리', unit: 'm³' }
            ]
            for (const cat of wasteCategories) {
                const qty = activityData[cat.qtyKey] || 0
                const efRaw = activityData[cat.efKey]
                const ef = typeof efRaw === 'number' && efRaw >= 0 ? efRaw : cat.defaultEF
                if (qty > 0) {
                    const wasteEmission = qty * ef
                    result.total += wasteEmission
                    result.fossil += wasteEmission

                    distributeGHG(result.ghgBreakdown, wasteEmission, 'fossil')
                    result.details.push({
                        source: cat.label,
                        value: wasteEmission,
                        type: 'fossil',
                        emissionFactor: `${ef} kgCO2e/${cat.unit}`,
                        quantity: qty,
                        unit: cat.unit
                    })
                }
            }
            break
        }

        case 'transport': {
            const transportList = detailedActivityData?.transport || []

            // 1. 다중 운송 단계 처리
            if (transportList.length > 0) {
                transportList.forEach((item: any, index: number) => {
                    const weight = item.weight || 0
                    const distance = item.distance || 0
                    const mode = item.transportMode || 'truck'
                    const truckClass = item.truckClass || 'medium_large' // P1: 트럭 톤수 클래스 (small/medium/medium_large/large)

                    if (weight > 0 && distance > 0) {
                        const tkm = (weight * distance) / 1000 // ton-km

                        // 운송 모드별 배출계수 매핑
                        let transportFactor = getDefaultTransportFactor()
                        if (mode === 'rail') {
                            transportFactor = TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_rail_freight')!
                        } else if (mode === 'ship') {
                            transportFactor = TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_ship_container')!
                        } else if (mode === 'aircraft') {
                            transportFactor = TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_aircraft_cargo')!
                        } else {
                            // 트럭: 톤수 클래스별 EF (P1: 16-32t 기본, 사용자 선택 가능)
                            const truckId =
                                truckClass === 'small' ? 'transport_truck_small' :
                                truckClass === 'medium' ? 'transport_truck_medium' :
                                truckClass === 'large' ? 'transport_truck_large' :
                                'transport_truck_medium_large'
                            transportFactor = TRANSPORT_EMISSION_FACTORS.find(f => f.id === truckId)
                                || TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_truck_medium_large')
                                || getDefaultTransportFactor()
                        }

                        const emission = tkm * transportFactor.value
                        result.total += emission

                        // P1-3: GHG 분해 집계
                        distributeGHG(result.ghgBreakdown, emission, 'fossil')

                        if (mode === 'aircraft') {
                            result.aircraft += emission
                        }
                        result.fossil += emission
                        result.uncertainty = Math.max(result.uncertainty, transportFactor.uncertainty)

                        result.details.push({
                            source: `${transportFactor.nameKo} #${index + 1}`,
                            value: emission,
                            type: 'fossil',
                            emissionFactor: `${transportFactor.value} ${transportFactor.unit}`,
                            quantity: tkm,
                            unit: 'tkm'
                        })
                    }
                })
            }
            // 2. 레거시 단일 입력 처리
            else {
                const weight = activityData['transport_weight'] || 0
                const distance = activityData['transport_distance'] || 0
                const mode = activityData['transport_mode'] || 'truck'

                if (weight > 0 && distance > 0) {
                    const tkm = (weight * distance) / 1000 // ton-km

                    let transportFactor = getDefaultTransportFactor()
                    if (mode === 'rail') {
                        transportFactor = TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_rail_freight')!
                    } else if (mode === 'ship') {
                        transportFactor = TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_ship_container')!
                    } else if (mode === 'aircraft') {
                        transportFactor = TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_aircraft_cargo')!
                    }

                    const emission = tkm * transportFactor.value
                    result.total += emission

                    // P1-3: GHG 분해 집계
                    distributeGHG(result.ghgBreakdown, emission, 'fossil')

                    if (mode === 'aircraft') {
                        result.aircraft += emission
                    }
                    result.fossil += emission
                    result.uncertainty = Math.max(result.uncertainty, transportFactor.uncertainty)

                    result.details.push({
                        source: transportFactor.nameKo,
                        value: emission,
                        type: 'fossil',
                        emissionFactor: `${transportFactor.value} ${transportFactor.unit}`,
                        quantity: tkm,
                        unit: 'tkm'
                    })
                }
            }

            // 항공 운송 (별도 입력, ISO 14067 7.2 e)
            const aircraftWeight = activityData['aircraft_transport_weight'] || 0
            const aircraftDistance = activityData['aircraft_transport_distance'] || 0
            if (aircraftWeight > 0 && aircraftDistance > 0) {
                const aircraftTkm = (aircraftWeight * aircraftDistance) / 1000
                const aircraftFactor = TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_aircraft_cargo')!
                const aircraftEmission = aircraftTkm * aircraftFactor.value

                result.total += aircraftEmission
                result.fossil += aircraftEmission
                result.aircraft += aircraftEmission

                // P1-3: GHG 분해 집계
                distributeGHG(result.ghgBreakdown, aircraftEmission, 'fossil')

                result.details.push({
                    source: '항공 운송 (별도 입력)',
                    value: aircraftEmission,
                    type: 'fossil',
                    emissionFactor: `${aircraftFactor.value} ${aircraftFactor.unit}`,
                    quantity: aircraftTkm,
                    unit: 'tkm'
                })
            }
            break
        }

        case 'packaging': {
            const packagingList = detailedActivityData?.packaging || []

            // 1. 다중 포장재 입력 처리
            if (packagingList.length > 0) {
                packagingList.forEach((item: any, index: number) => {
                    const weight = item.quantity || 0
                    const materialId = item.materialType || 'material_paper_cardboard'
                    const factor = MATERIAL_EMISSION_FACTORS.find(f => f.id === materialId)
                        || MATERIAL_EMISSION_FACTORS.find(f => f.id === 'material_paper_cardboard')!

                    // 포장재 EF override (인계 직전 수정): 사용자 입력 EF가 있으면 우선 적용 (0 cut-off 포함)
                    const hasOverride = typeof item.customEmissionFactor === 'number' && item.customEmissionFactor >= 0
                    const effectiveEF = hasOverride ? (item.customEmissionFactor as number) : factor.value
                    const effectiveSource = hasOverride ? 'fossil' : factor.sourceType
                    const effectiveLabel = hasOverride ? `${item.name} (사용자 EF)` : item.name

                    if (weight > 0 && (hasOverride || factor)) {
                        const emission = weight * effectiveEF
                        result.total += emission

                        // P1-3: GHG 분해 집계
                        distributeGHG(result.ghgBreakdown, emission, effectiveSource)

                        if (effectiveSource === 'fossil') {
                            result.fossil += emission
                        } else if (effectiveSource === 'biogenic') {
                            result.biogenic += emission
                        } else {
                            result.fossil += emission * 0.5
                            result.biogenic += emission * 0.5
                        }

                        result.uncertainty = Math.max(result.uncertainty, factor?.uncertainty ?? 20)

                        result.details.push({
                            source: effectiveLabel,
                            value: emission,
                            type: effectiveSource,
                            emissionFactor: `${effectiveEF} ${factor?.unit ?? 'kgCO2e/kg'}`,
                            quantity: weight,
                            unit: 'kg'
                        })
                    }
                })
            }
            // 2. 레거시 단일 입력 처리
            else {
                const weight = activityData['packaging_weight'] || 0
                const materialId = activityData['packaging_material'] || 'material_paper_cardboard'
                const factor = MATERIAL_EMISSION_FACTORS.find(f => f.id === materialId)
                    || MATERIAL_EMISSION_FACTORS.find(f => f.id === 'material_paper_cardboard')!

                if (weight > 0 && factor) {
                    const emission = weight * factor.value
                    result.total += emission

                    // P1-3: GHG 분해 집계
                    distributeGHG(result.ghgBreakdown, emission, factor.sourceType)

                    if (factor.sourceType === 'fossil') {
                        result.fossil += emission
                    } else if (factor.sourceType === 'biogenic') {
                        result.biogenic += emission
                    } else {
                        result.fossil += emission * 0.5
                        result.biogenic += emission * 0.5
                    }

                    result.uncertainty = factor.uncertainty
                    result.details.push({
                        source: factor.nameKo,
                        value: emission,
                        type: factor.sourceType,
                        emissionFactor: `${factor.value} ${factor.unit}`,
                        quantity: weight,
                        unit: 'kg'
                    })
                }
            }
            break
        }

        case 'use': {
            const electricity = activityData['use_electricity'] || 0
            const gridFactor = getDefaultElectricityFactor()

            if (electricity > 0) {
                const emission = electricity * gridFactor.value
                result.total += emission
                result.fossil += emission

                // P1-3: GHG 분해 집계
                distributeGHG(result.ghgBreakdown, emission, 'fossil')

                result.uncertainty = gridFactor.uncertainty

                result.details.push({
                    source: '사용 중 전력',
                    value: emission,
                    type: 'fossil',
                    emissionFactor: `${gridFactor.value} ${gridFactor.unit}`,
                    quantity: electricity,
                    unit: 'kWh'
                })
            }
            break
        }

        case 'eol': {
            const wasteWeight = activityData['waste_weight'] || 0

            // 재활용 할당 설정에서 파라미터 가져오기
            const recyclingRateFromAllocation = recyclingAllocation.recyclabilityOutput
            const recycledContentInput = recyclingAllocation.recycledContentInput
            const recyclingMethod = recyclingAllocation.method
            const qualityFactor = recyclingAllocation.qualityFactorOutput || 1

            // 활동 데이터 또는 할당 설정에서 재활용률 사용
            const recyclingRate = recyclingRateFromAllocation > 0
                ? recyclingRateFromAllocation
                : (activityData['recycling_rate'] || 0) / 100

            if (wasteWeight > 0) {
                const disposalFactor = EOL_EMISSION_FACTORS.find(f => f.id === 'eol_landfill_mixed')!
                const recyclingFactor = EOL_EMISSION_FACTORS.find(f => f.id === 'eol_recycling_metal')!
                const virginFactor = 2.0 // 버진 원료 배출계수 (kg CO2e/kg)

                // 재활용 할당 방법에 따른 계산
                switch (recyclingMethod) {
                    case 'cut_off': {
                        // Cut-off: 재활용 크레딧 없음, 폐기만 계산
                        const disposalWeight = wasteWeight * (1 - recyclingRate)
                        const disposalEmission = disposalWeight * disposalFactor.value

                        result.total += disposalEmission

                        // P1-3: GHG 분해 집계
                        distributeGHG(result.ghgBreakdown, disposalEmission, 'mixed')

                        result.fossil += disposalEmission * 0.5
                        result.biogenic += disposalEmission * 0.5

                        result.details.push({
                            source: `매립/소각 (Cut-off)`,
                            value: disposalEmission,
                            type: 'mixed',
                            emissionFactor: `${disposalFactor.value} ${disposalFactor.unit}`,
                            quantity: disposalWeight,
                            unit: 'kg'
                        })
                        break
                    }

                    case 'substitution': {
                        // Substitution: 재활용으로 회피된 생산 크레딧 부여
                        const disposalWeight = wasteWeight * (1 - recyclingRate)
                        const disposalEmission = disposalWeight * disposalFactor.value
                        const recyclingWeight = wasteWeight * recyclingRate
                        const avoidedEmission = recyclingWeight * virginFactor * qualityFactor // 크레딧

                        result.total += disposalEmission - avoidedEmission

                        // P1-3: GHG 분해 집계
                        distributeGHG(result.ghgBreakdown, disposalEmission, 'mixed')
                        distributeGHG(result.ghgBreakdown, -avoidedEmission, 'fossil')

                        result.fossil += (disposalEmission - avoidedEmission) * 0.5
                        result.biogenic += (disposalEmission - avoidedEmission) * 0.5

                        result.details.push({
                            source: '매립/소각',
                            value: disposalEmission,
                            type: 'mixed',
                            emissionFactor: `${disposalFactor.value} ${disposalFactor.unit}`,
                            quantity: disposalWeight,
                            unit: 'kg'
                        })

                        if (recyclingRate > 0) {
                            result.details.push({
                                source: `재활용 대체 크레딧 (Q=${qualityFactor})`,
                                value: -avoidedEmission,
                                type: 'credit',
                                emissionFactor: `-${virginFactor * qualityFactor} kgCO2e/kg`,
                                quantity: recyclingWeight,
                                unit: 'kg'
                            })
                        }
                        break
                    }

                    case 'fifty_fifty': {
                        // 50:50: 절반씩 분배
                        const disposalWeight = wasteWeight * (1 - recyclingRate)
                        const disposalEmission = 0.5 * disposalWeight * disposalFactor.value
                        const recyclingWeight = wasteWeight * recyclingRate
                        const recyclingCredit = 0.5 * recyclingWeight * recyclingFactor.value

                        result.total += disposalEmission + recyclingCredit

                        // P1-3: GHG 분해 집계
                        distributeGHG(result.ghgBreakdown, disposalEmission, 'mixed')
                        distributeGHG(result.ghgBreakdown, recyclingCredit, 'fossil')

                        result.fossil += (disposalEmission + recyclingCredit) * 0.5
                        result.biogenic += (disposalEmission + recyclingCredit) * 0.5

                        result.details.push({
                            source: '매립/소각 (50:50)',
                            value: disposalEmission,
                            type: 'mixed',
                            emissionFactor: `0.5 × ${disposalFactor.value} ${disposalFactor.unit}`,
                            quantity: disposalWeight,
                            unit: 'kg'
                        })

                        if (recyclingRate > 0) {
                            result.details.push({
                                source: '재활용 크레딧 (50:50)',
                                value: recyclingCredit,
                                type: 'credit',
                                emissionFactor: `0.5 × ${recyclingFactor.value} ${recyclingFactor.unit}`,
                                quantity: recyclingWeight,
                                unit: 'kg'
                            })
                        }
                        break
                    }

                    case 'pef_formula': {
                        // PEF Circular Footprint Formula (간소화)
                        const A = 0.5 // 기본 할당 계수
                        const R1 = recycledContentInput
                        const R2 = recyclingRate
                        const R3 = 0 // 에너지 회수 (미구현)
                        const Qs = qualityFactor
                        const Qp = 1

                        // (1-R2-R3) × Ed
                        const disposalWeight = wasteWeight * (1 - R2 - R3)
                        const disposalEmission = disposalWeight * disposalFactor.value

                        // (1-A) × R2 × (Erecycling - Ev × Qs/Qp)
                        const recyclingCredit = (1 - A) * R2 * wasteWeight * (
                            Math.abs(recyclingFactor.value) - virginFactor * (Qs / Qp)
                        )

                        result.total += disposalEmission + recyclingCredit

                        // P1-3: GHG 분해 집계
                        distributeGHG(result.ghgBreakdown, disposalEmission, 'mixed')
                        distributeGHG(result.ghgBreakdown, recyclingCredit, 'fossil')

                        result.fossil += (disposalEmission + recyclingCredit) * 0.5
                        result.biogenic += (disposalEmission + recyclingCredit) * 0.5

                        result.details.push({
                            source: '폐기 (PEF)',
                            value: disposalEmission,
                            type: 'mixed',
                            emissionFactor: `${disposalFactor.value} ${disposalFactor.unit}`,
                            quantity: disposalWeight,
                            unit: 'kg'
                        })

                        result.details.push({
                            source: '재활용 조정 (PEF CFF)',
                            value: recyclingCredit,
                            type: recyclingCredit < 0 ? 'credit' : 'mixed',
                            emissionFactor: 'PEF Formula',
                            quantity: wasteWeight * R2,
                            unit: 'kg'
                        })
                        break
                    }

                    default: {
                        // 기본 (eol_recycling 또는 기타)
                        const disposalWeight = wasteWeight * (1 - recyclingRate)
                        const disposalEmission = disposalWeight * disposalFactor.value

                        result.total += disposalEmission

                        // P1-3: GHG 분해 집계
                        distributeGHG(result.ghgBreakdown, disposalEmission, 'mixed')

                        result.fossil += disposalEmission * 0.5
                        result.biogenic += disposalEmission * 0.5

                        result.details.push({
                            source: '매립/소각',
                            value: disposalEmission,
                            type: 'mixed',
                            emissionFactor: `${disposalFactor.value} ${disposalFactor.unit}`,
                            quantity: disposalWeight,
                            unit: 'kg'
                        })

                        if (recyclingRate > 0) {
                            const recyclingWeight = wasteWeight * recyclingRate
                            const recyclingCredit = recyclingWeight * recyclingFactor.value

                            result.total += recyclingCredit

                            // P1-3: GHG 분해 집계
                            distributeGHG(result.ghgBreakdown, recyclingCredit, 'fossil')

                            result.fossil += recyclingCredit

                            result.details.push({
                                source: '재활용 크레딧',
                                value: recyclingCredit,
                                type: 'credit',
                                emissionFactor: `${recyclingFactor.value} ${recyclingFactor.unit}`,
                                quantity: recyclingWeight,
                                unit: 'kg'
                            })
                        }
                    }
                }

                result.uncertainty = 50 // EOL 높은 불확실성
            }
            break
        }
    }

    return result
}

// =============================================================================
// 전체 배출량 계산 (모든 단계 합산)
// =============================================================================

export interface TotalEmissionResult {
    stageResults: Record<string, StageEmissionResult>
    totalEmission: number
    totalFossil: number
    totalBiogenic: number
    totalAircraft: number
    avgUncertainty: number
    /** PR-V08: 불확도 산출 방법 식별자 — 보고서 §5.7 disclosure 용. */
    uncertaintyMethod?: 'contribution_weighted_rss' | 'simple_mean' | 'fixed_default'
    ghgBreakdown: Record<string, number> // P1-3: 전체 GHG별 분해 합계

    // P1-1: 다중 산출물 할당 결과 (ISO 14067 6.4.6)
    allocation?: {
        applied: boolean
        method: string
        methodLabel: string
        mainProductShare: number     // 주제품 할당 비율 (0~1)
        allocatedTotal: number       // 할당 적용된 총 배출량
        allocatedFossil: number
        allocatedBiogenic: number
        allocatedAircraft: number
        allocatedStageResults: Record<string, { total: number; fossil: number; biogenic: number; aircraft: number }>
        coProductsReduction: number  // 부산물로 배분된 배출량
        justification: string
    }
}

/**
 * 다중 산출물 할당 비율을 계산합니다.
 * ISO 14067 6.4.6에 따른 할당 계층 구조 적용.
 */
function calculateAllocationFactor(allocation: MultiOutputAllocation): number {
    // subdivision, system_expansion은 할당 회피 접근법 (ISO 14067 6.4.6.2)
    if (!allocation || allocation.method === 'subdivision' || allocation.method === 'system_expansion') {
        return 1.0
    }

    const mainProduct = allocation.mainProductData
    const coProducts = allocation.coProducts

    if (!mainProduct || !coProducts || coProducts.length === 0) {
        return 1.0 // 공동 산출물 없으면 100% 할당
    }

    if (allocation.method === 'physical') {
        const basis = allocation.physicalBasis || 'mass'
        if (basis === 'mass') {
            const result = calculatePhysicalAllocation(
                { value: mainProduct.mass || mainProduct.quantity || 0 },
                coProducts.map(cp => ({ value: cp.quantity || cp.allocationValue || 0 }))
            )
            return result.mainShare
        } else if (basis === 'energy') {
            const result = calculatePhysicalAllocation(
                { value: mainProduct.energyContent || 0 },
                coProducts.map(cp => ({ value: cp.energyContent || 0 }))
            )
            return result.mainShare
        }
    }

    if (allocation.method === 'economic') {
        const result = calculateEconomicAllocation(
            { quantity: mainProduct.quantity || 1, price: mainProduct.economicValue || 0 },
            coProducts.map(cp => ({
                quantity: cp.quantity || cp.allocationValue || 0,
                price: cp.economicValue || 0
            }))
        )
        return result.mainShare
    }

    // mainProductShare가 직접 설정된 경우
    if (allocation.mainProductShare > 0 && allocation.mainProductShare <= 1) {
        return allocation.mainProductShare
    }

    return 1.0
}

/**
 * 할당 방법에 대한 한글 라벨을 반환합니다.
 */
function getAllocationMethodLabel(method: string, basis?: string): string {
    const labels: Record<string, string> = {
        'none': '할당 없음',
        'subdivision': '하위 분할',
        'physical': '물리적 할당',
        'economic': '경제적 할당',
        'system_expansion': '시스템 확장'
    }
    const basisLabels: Record<string, string> = {
        'mass': '질량 기준',
        'energy': '에너지 기준',
        'volume': '부피 기준'
    }
    let label = labels[method] || method
    if (method === 'physical' && basis) {
        label += ` (${basisLabels[basis] || basis})`
    }
    return label
}

/**
 * 모든 선택된 단계의 배출량을 계산하고 합산합니다.
 * 
 * @param stages - 포함된 생애주기 단계 목록
 * @param input - 계산 입력 데이터
 * @param multiOutputAllocation - (선택) 다중 산출물 할당 설정. 제공되면 할당 적용 결과도 함께 반환.
 */
export function calculateTotalEmissions(
    stages: string[],
    input: CalculationInput,
    multiOutputAllocation?: MultiOutputAllocation
): TotalEmissionResult {
    const stageResults = stages.reduce((acc, stage) => {
        acc[stage] = calculateStageEmission(stage, input)
        return acc
    }, {} as Record<string, StageEmissionResult>)

    const totalEmission = Object.values(stageResults).reduce((a, b) => a + b.total, 0)
    const totalFossil = Object.values(stageResults).reduce((a, b) => a + b.fossil, 0)
    const totalBiogenic = Object.values(stageResults).reduce((a, b) => a + b.biogenic, 0)
    const totalAircraft = Object.values(stageResults).reduce((a, b) => a + b.aircraft, 0)

    // P1-3: 전체 GHG별 분해 합계 계산
    const totalGHGBreakdown: Record<string, number> = {}
    Object.values(stageResults).forEach(res => {
        Object.entries(res.ghgBreakdown).forEach(([ghg, val]) => {
            totalGHGBreakdown[ghg] = (totalGHGBreakdown[ghg] || 0) + val
        })
    })

    // PR-V08: 단순 평균 대신 기여도 가중 RSS (root-sum-square) 적용.
    // ISO 14067 §6.3.10 / §6.6 + ISO 14064-3 §B.3.1(i) 불확도 disclosure 충족.
    // 공식: σ_total = √( Σ (w_i × σ_i)² ),  w_i = stage_i / Σ stage
    // 기여도가 큰 단계의 σ가 주도하도록 가중 — 검증인이 신뢰구간을 평가 가능.
    const stageEntries = Object.values(stageResults).filter(r => r.uncertainty > 0 && r.total > 0)
    let avgUncertainty: number
    let uncertaintyMethod: TotalEmissionResult['uncertaintyMethod']
    if (stageEntries.length === 0) {
        avgUncertainty = 30
        uncertaintyMethod = 'fixed_default'
    } else {
        const sumEmissions = stageEntries.reduce((acc, r) => acc + r.total, 0)
        if (sumEmissions <= 0) {
            avgUncertainty = stageEntries.reduce((a, b) => a + b.uncertainty, 0) / stageEntries.length
            uncertaintyMethod = 'simple_mean'
        } else {
            const sumSquared = stageEntries.reduce((acc, r) => {
                const w = r.total / sumEmissions
                return acc + (w * r.uncertainty) ** 2
            }, 0)
            avgUncertainty = Math.sqrt(sumSquared)
            uncertaintyMethod = 'contribution_weighted_rss'
        }
    }

    // P1-1: 다중 산출물 할당 적용
    let allocationResult: TotalEmissionResult['allocation'] = undefined

    if (multiOutputAllocation &&
        multiOutputAllocation.method !== 'subdivision' &&
        multiOutputAllocation.method !== 'system_expansion' &&
        multiOutputAllocation.coProducts &&
        multiOutputAllocation.coProducts.length > 0) {

        const factor = calculateAllocationFactor(multiOutputAllocation)

        if (factor < 1.0) {
            const allocatedStageResults: Record<string, { total: number; fossil: number; biogenic: number; aircraft: number; ghgBreakdown: Record<string, number> }> = {}
            for (const [stageId, result] of Object.entries(stageResults)) {
                // GHG 분해 결과에도 할당 비율 적용
                const allocatedGHG: Record<string, number> = {}
                Object.entries(result.ghgBreakdown).forEach(([ghg, val]) => {
                    allocatedGHG[ghg] = val * factor
                })

                allocatedStageResults[stageId] = {
                    total: result.total * factor,
                    fossil: result.fossil * factor,
                    biogenic: result.biogenic * factor,
                    aircraft: result.aircraft * factor,
                    ghgBreakdown: allocatedGHG
                }
            }

            allocationResult = {
                applied: true,
                method: multiOutputAllocation.method,
                methodLabel: getAllocationMethodLabel(
                    multiOutputAllocation.method,
                    multiOutputAllocation.physicalBasis
                ),
                mainProductShare: factor,
                allocatedTotal: totalEmission * factor,
                allocatedFossil: totalFossil * factor,
                allocatedBiogenic: totalBiogenic * factor,
                allocatedAircraft: totalAircraft * factor,
                allocatedStageResults,
                coProductsReduction: totalEmission * (1 - factor),
                justification: multiOutputAllocation.justification || ''
            }
        }
    }

    return {
        stageResults,
        totalEmission,
        totalFossil,
        totalBiogenic,
        totalAircraft,
        avgUncertainty,
        uncertaintyMethod,
        ghgBreakdown: totalGHGBreakdown, // P1-3 결과 반환
        allocation: allocationResult
    }
}

/**
 * 간소화된 총 배출량 계산 (민감도 분석용)
 * 활동 데이터만으로 빠르게 총 배출량을 계산합니다.
 */
export function calculateSimplifiedEmission(
    activityData: Record<string, any>,
    detailedActivityData?: CalculationInput['detailedActivityData'],
    recyclingAllocation?: RecyclingAllocation
): number {
    const defaultRecycling: RecyclingAllocation = recyclingAllocation || {
        method: 'cut_off',
        loopType: 'open_loop',
        recyclingRate: 0,
        recycledContentInput: 0,
        recyclabilityOutput: 0,
        qualityFactorInput: 1,
        qualityFactorOutput: 1,
        justification: 'Cut-off 방법 적용 - 보수적 접근'
    }

    const input: CalculationInput = {
        activityData,
        detailedActivityData: detailedActivityData || null,
        recyclingAllocation: defaultRecycling
    }

    const allStages = ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol']
    let total = 0

    for (const stage of allStages) {
        const result = calculateStageEmission(stage, input)
        total += result.total
    }

    return total
}

// =============================================================================
// GHG 분해 헬퍼 (P1-3)
// =============================================================================

/**
 * 특정 온실가스 배출량을 기여도 맵에 합산합니다.
 */
export function addGHGToBreakdown(
    breakdown: Record<string, number>,
    ghgName: string,
    value: number
): void {
    breakdown[ghgName] = (breakdown[ghgName] || 0) + value
}

/**
 * 기원(fossil, biogenic)에 따라 총 배출량을 개별 온실가스로 분산시킵니다.
 * 데이터 소스에서 구체적인 GHG 정보가 없을 때 사용합니다 (보수적 기본값).
 */
export function distributeGHG(
    breakdown: Record<string, number>,
    totalCO2e: number,
    type: 'fossil' | 'biogenic' | 'mixed' = 'fossil'
): void {
    if (totalCO2e <= 0) return

    if (type === 'biogenic') {
        // 생물 기원은 주로 CO2로 간주
        addGHGToBreakdown(breakdown, 'CO2 (biogenic)', totalCO2e)
    } else {
        // 화석 기원의 경우 전형적인 에너지 배출 비율 (보수적 추정)
        // CO2: 99%, CH4: 0.5%, N2O: 0.5% (kg CO2e 기준)
        addGHGToBreakdown(breakdown, 'CO2', totalCO2e * 0.99)
        addGHGToBreakdown(breakdown, 'CH4', totalCO2e * 0.005)
        addGHGToBreakdown(breakdown, 'N2O', totalCO2e * 0.005)
    }
}
