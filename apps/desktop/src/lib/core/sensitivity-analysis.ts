/**
 * ISO 14067 민감도 분석 (Sensitivity Analysis) 로직
 * 
 * ISO 14067:2018
 * - 3.1.4.7: 민감도 분석 정의
 * - 6.4.5: 시스템 경계 정제 시 민감도 분석
 * - 6.4.6.1: 할당 절차 선택 시 민감도 분석
 * - 6.4.9.4: 전력 그리드 믹스 민감도 분석
 * - 6.6: 해석 단계에서의 민감도 분석
 * - 7.3 h), k): 보고서 요구사항
 */

import { 
    ELECTRICITY_EMISSION_FACTORS, 
    MATERIAL_EMISSION_FACTORS,
    TRANSPORT_EMISSION_FACTORS,
    ElectricityEmissionFactor,
    MaterialEmissionFactor,
    TransportEmissionFactor
} from './emission-factors'
import { 
    RecyclingAllocationMethod,
    MultiOutputAllocationMethod,
    RECYCLING_ALLOCATION_METHODS,
    MULTI_OUTPUT_ALLOCATION_METHODS
} from './allocation'
import { SimplifiedActivityData, TransportMode } from './store'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 민감도 분석 유형
 */
export type SensitivityAnalysisType = 
    | 'electricity_grid'      // 전력 그리드 믹스 (ISO 14067 6.4.9.4)
    | 'allocation_method'     // 할당 방법 (ISO 14067 6.4.6.1)
    | 'recycling_allocation'  // 재활용 할당 방법
    | 'emission_factor'       // 배출계수 변동
    | 'activity_data'         // 활동 데이터 변동
    | 'use_phase'            // 사용 단계 가정 (ISO 14067 6.4.5)
    | 'eol_scenario'         // 폐기 시나리오
    | 'transport_mode'       // 운송 모드
    | 'system_boundary'      // 시스템 경계

/**
 * 민감도 분석 시나리오
 */
export interface SensitivityScenario {
    id: string
    name: string
    nameKo: string
    description: string
    type: SensitivityAnalysisType
    parameterChanged: string
    baseValue: string | number
    alternativeValue: string | number
    baseEmission: number
    alternativeEmission: number
    absoluteChange: number
    percentageChange: number
    isSignificant: boolean  // > 5% 변화 시 유의미
}

/**
 * 민감도 분석 결과
 */
export interface SensitivityAnalysisResult {
    analysisDate: string
    baselineCFP: number
    scenarios: SensitivityScenario[]
    significantFactors: string[]
    recommendations: string[]
    isoCompliance: {
        clause: string
        requirement: string
        satisfied: boolean
    }[]
}

/**
 * 파라미터 변동 범위
 */
export interface ParameterVariation {
    parameterId: string
    parameterName: string
    parameterNameKo: string
    baseValue: number
    minValue: number
    maxValue: number
    unit: string
    variationPercent: number  // ±%
}

// =============================================================================
// 민감도 분석 상수
// =============================================================================

/**
 * 유의성 임계값 (ISO 14067 기준)
 */
export const SIGNIFICANCE_THRESHOLD = 5  // 5% 이상 변화 시 유의미

/**
 * 기본 변동 범위 (±%)
 */
export const DEFAULT_VARIATION_RANGES: Record<SensitivityAnalysisType, number> = {
    electricity_grid: 30,      // 그리드 믹스 불확실성
    allocation_method: 100,    // 할당 방법 간 차이 큼
    recycling_allocation: 100,
    emission_factor: 20,       // 배출계수 불확실성
    activity_data: 15,         // 활동 데이터 불확실성
    use_phase: 30,            // 사용 패턴 불확실성
    eol_scenario: 50,         // 폐기 시나리오 불확실성
    transport_mode: 50,       // 운송 모드 선택
    system_boundary: 20       // 경계 포함/제외
}

/**
 * ISO 14067 민감도 분석 요구사항
 */
export const SENSITIVITY_REQUIREMENTS = [
    {
        clause: '6.4.5',
        title: 'Refining the system boundary',
        titleKo: '시스템 경계 정제',
        requirement: 'Decisions regarding data to be included or excluded shall be based on a sensitivity analysis',
        requirementKo: '데이터 포함/제외 결정은 민감도 분석에 기반해야 함',
        mandatory: true,
        condition: 'CFP-PCR 미사용 시'
    },
    {
        clause: '6.4.6.1',
        title: 'Allocation',
        titleKo: '할당',
        requirement: 'Whenever several alternative allocation procedures are applicable, a sensitivity analysis shall be conducted',
        requirementKo: '여러 할당 절차가 적용 가능한 경우 민감도 분석 필수',
        mandatory: true,
        condition: '다중 할당 방법 적용 가능 시'
    },
    {
        clause: '6.4.9.4',
        title: 'Electricity',
        titleKo: '전력',
        requirement: 'Sensitivity analysis applying the relevant consumption grid mix shall be conducted',
        requirementKo: '관련 소비 그리드 믹스를 적용한 민감도 분석 수행',
        mandatory: true,
        condition: '재생에너지 인증서 등 특수 전력 속성 사용 시'
    },
    {
        clause: '6.6',
        title: 'Interpretation',
        titleKo: '해석',
        requirement: 'Sensitivity analysis of significant inputs, outputs and methodological choices',
        requirementKo: '중요 투입물, 산출물, 방법론 선택에 대한 민감도 분석',
        mandatory: false,
        condition: '권장사항'
    }
]

// =============================================================================
// 전력 그리드 민감도 분석 (ISO 14067 6.4.9.4)
// =============================================================================

/**
 * 전력 그리드 민감도 분석 수행
 */
export const analyzeElectricityGridSensitivity = (
    electricityConsumption: number,  // kWh
    currentGridId: string,
    baselineCFP: number
): SensitivityScenario[] => {
    const scenarios: SensitivityScenario[] = []
    const currentGrid = ELECTRICITY_EMISSION_FACTORS.find(f => f.id === currentGridId)
    
    if (!currentGrid || electricityConsumption <= 0) return scenarios

    const baseEmission = electricityConsumption * currentGrid.value

    // 다른 그리드 믹스로 계산
    ELECTRICITY_EMISSION_FACTORS.forEach(grid => {
        if (grid.id === currentGridId) return

        const alternativeEmission = electricityConsumption * grid.value
        const absoluteChange = alternativeEmission - baseEmission
        const percentageChange = baselineCFP > 0 
            ? (absoluteChange / baselineCFP) * 100 
            : 0

        scenarios.push({
            id: `grid_${grid.id}`,
            name: `Grid: ${grid.name}`,
            nameKo: `전력 그리드: ${grid.nameKo}`,
            description: `전력 그리드를 ${currentGrid.nameKo}에서 ${grid.nameKo}로 변경`,
            type: 'electricity_grid',
            parameterChanged: 'electricity_grid',
            baseValue: currentGrid.nameKo,
            alternativeValue: grid.nameKo,
            baseEmission,
            alternativeEmission,
            absoluteChange,
            percentageChange,
            isSignificant: Math.abs(percentageChange) >= SIGNIFICANCE_THRESHOLD
        })
    })

    return scenarios.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
}

// =============================================================================
// 할당 방법 민감도 분석 (ISO 14067 6.4.6.1)
// =============================================================================

/**
 * 재활용 할당 방법 민감도 분석
 */
export const analyzeRecyclingAllocationSensitivity = (
    params: {
        emissionVirgin: number       // 버진 원료 배출량 (kg CO2e/kg)
        emissionRecycled: number     // 재활용 원료 배출량 (kg CO2e/kg)
        emissionProcess: number      // 공정 배출량 (kg CO2e)
        emissionDisposal: number     // 폐기 배출량 (kg CO2e/kg)
        recycledContentInput: number // 재활용 투입 비율 (0-1)
        recyclingRateOutput: number  // 재활용 산출 비율 (0-1)
        productMass: number          // 제품 질량 (kg)
    },
    currentMethod: RecyclingAllocationMethod,
    baselineCFP: number
): SensitivityScenario[] => {
    const scenarios: SensitivityScenario[] = []
    const { emissionVirgin, emissionRecycled, emissionProcess, emissionDisposal, 
            recycledContentInput, recyclingRateOutput, productMass } = params

    // 각 할당 방법별 계산
    const methods: RecyclingAllocationMethod[] = ['cut_off', 'eol_recycling', 'fifty_fifty', 'substitution']
    
    const calculateByMethod = (method: RecyclingAllocationMethod): number => {
        switch (method) {
            case 'cut_off':
                // CFP = E_virgin × (1 - R_in) × Mass + E_process + E_disposal × (1 - R_out) × Mass
                return emissionVirgin * (1 - recycledContentInput) * productMass 
                    + emissionProcess 
                    + emissionDisposal * (1 - recyclingRateOutput) * productMass

            case 'eol_recycling':
                // 재활용 산출에 크레딧 부여
                return emissionVirgin * productMass 
                    + emissionProcess 
                    - emissionVirgin * recyclingRateOutput * productMass * 0.9

            case 'fifty_fifty':
                // 50:50 분배
                return (0.5 * emissionVirgin * (1 - recycledContentInput) 
                    + 0.5 * emissionRecycled * recycledContentInput) * productMass
                    + emissionProcess 
                    + 0.5 * emissionDisposal * (1 - recyclingRateOutput) * productMass

            case 'substitution':
                // 대체 크레딧
                return emissionVirgin * (1 - recycledContentInput) * productMass 
                    + emissionProcess 
                    - emissionVirgin * recyclingRateOutput * productMass

            default:
                return emissionVirgin * productMass + emissionProcess
        }
    }

    const baseEmission = calculateByMethod(currentMethod)

    methods.forEach(method => {
        if (method === currentMethod) return

        const methodInfo = RECYCLING_ALLOCATION_METHODS[method]
        const alternativeEmission = calculateByMethod(method)
        const absoluteChange = alternativeEmission - baseEmission
        const percentageChange = baselineCFP > 0 
            ? (absoluteChange / baselineCFP) * 100 
            : 0

        scenarios.push({
            id: `recycling_${method}`,
            name: `Recycling: ${methodInfo.name}`,
            nameKo: `재활용 할당: ${methodInfo.nameKo}`,
            description: methodInfo.descriptionKo,
            type: 'recycling_allocation',
            parameterChanged: 'recycling_allocation_method',
            baseValue: RECYCLING_ALLOCATION_METHODS[currentMethod].nameKo,
            alternativeValue: methodInfo.nameKo,
            baseEmission,
            alternativeEmission,
            absoluteChange,
            percentageChange,
            isSignificant: Math.abs(percentageChange) >= SIGNIFICANCE_THRESHOLD
        })
    })

    return scenarios.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
}

// =============================================================================
// 활동 데이터 민감도 분석
// =============================================================================

/**
 * 활동 데이터 변동에 따른 민감도 분석
 */
export const analyzeActivityDataSensitivity = (
    activityData: SimplifiedActivityData,
    calculateEmission: (data: SimplifiedActivityData) => number,
    baselineCFP: number,
    variationPercent: number = 20
): SensitivityScenario[] => {
    const scenarios: SensitivityScenario[] = []
    
    const parameters: { key: keyof SimplifiedActivityData; nameKo: string; unit: string }[] = [
        { key: 'raw_material_weight', nameKo: '원자재 중량', unit: 'kg' },
        { key: 'electricity', nameKo: '전력 사용량', unit: 'kWh' },
        { key: 'gas', nameKo: '가스 사용량', unit: 'm³' },
        { key: 'transport_distance', nameKo: '운송 거리', unit: 'km' },
        { key: 'transport_weight', nameKo: '운송 중량', unit: 'kg' },
        { key: 'packaging_weight', nameKo: '포장재 중량', unit: 'kg' },
        { key: 'use_electricity', nameKo: '사용 단계 전력', unit: 'kWh' },
        { key: 'use_years', nameKo: '사용 기간', unit: '년' },
        { key: 'waste_weight', nameKo: '폐기물 중량', unit: 'kg' },
        { key: 'recycling_rate', nameKo: '재활용률', unit: '%' }
    ]

    parameters.forEach(param => {
        const baseValue = activityData[param.key] as number
        if (!baseValue || baseValue <= 0) return

        // +변동
        const highData = { ...activityData, [param.key]: baseValue * (1 + variationPercent / 100) }
        const highEmission = calculateEmission(highData)
        const highChange = highEmission - baselineCFP
        const highPercentage = (highChange / baselineCFP) * 100

        scenarios.push({
            id: `${param.key}_high`,
            name: `${param.nameKo} +${variationPercent}%`,
            nameKo: `${param.nameKo} +${variationPercent}%`,
            description: `${param.nameKo}를 ${variationPercent}% 증가`,
            type: 'activity_data',
            parameterChanged: param.key,
            baseValue: `${baseValue.toFixed(2)} ${param.unit}`,
            alternativeValue: `${(baseValue * (1 + variationPercent / 100)).toFixed(2)} ${param.unit}`,
            baseEmission: baselineCFP,
            alternativeEmission: highEmission,
            absoluteChange: highChange,
            percentageChange: highPercentage,
            isSignificant: Math.abs(highPercentage) >= SIGNIFICANCE_THRESHOLD
        })

        // -변동
        const lowData = { ...activityData, [param.key]: baseValue * (1 - variationPercent / 100) }
        const lowEmission = calculateEmission(lowData)
        const lowChange = lowEmission - baselineCFP
        const lowPercentage = (lowChange / baselineCFP) * 100

        scenarios.push({
            id: `${param.key}_low`,
            name: `${param.nameKo} -${variationPercent}%`,
            nameKo: `${param.nameKo} -${variationPercent}%`,
            description: `${param.nameKo}를 ${variationPercent}% 감소`,
            type: 'activity_data',
            parameterChanged: param.key,
            baseValue: `${baseValue.toFixed(2)} ${param.unit}`,
            alternativeValue: `${(baseValue * (1 - variationPercent / 100)).toFixed(2)} ${param.unit}`,
            baseEmission: baselineCFP,
            alternativeEmission: lowEmission,
            absoluteChange: lowChange,
            percentageChange: lowPercentage,
            isSignificant: Math.abs(lowPercentage) >= SIGNIFICANCE_THRESHOLD
        })
    })

    return scenarios.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
}

// =============================================================================
// 운송 모드 민감도 분석
// =============================================================================

/**
 * 운송 모드 변경에 따른 민감도 분석
 */
export const analyzeTransportModeSensitivity = (
    transportWeight: number,  // kg
    transportDistance: number, // km
    currentMode: TransportMode,
    baselineCFP: number
): SensitivityScenario[] => {
    const scenarios: SensitivityScenario[] = []
    
    if (transportWeight <= 0 || transportDistance <= 0) return scenarios

    const tkm = (transportWeight * transportDistance) / 1000  // ton-km

    const modeFactors: Record<TransportMode, { factor: TransportEmissionFactor | undefined, nameKo: string }> = {
        truck: { 
            factor: TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_truck_large'),
            nameKo: '트럭'
        },
        rail: { 
            factor: TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_rail_freight'),
            nameKo: '철도'
        },
        ship: { 
            factor: TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_ship_container'),
            nameKo: '선박'
        },
        aircraft: { 
            factor: TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_aircraft_cargo'),
            nameKo: '항공'
        }
    }

    const currentFactor = modeFactors[currentMode].factor
    if (!currentFactor) return scenarios

    const baseEmission = tkm * currentFactor.value

    const modes: TransportMode[] = ['truck', 'rail', 'ship', 'aircraft']
    
    modes.forEach(mode => {
        if (mode === currentMode) return
        
        const modeInfo = modeFactors[mode]
        if (!modeInfo.factor) return

        const alternativeEmission = tkm * modeInfo.factor.value
        const absoluteChange = alternativeEmission - baseEmission
        const percentageChange = baselineCFP > 0 
            ? (absoluteChange / baselineCFP) * 100 
            : 0

        scenarios.push({
            id: `transport_${mode}`,
            name: `Transport: ${modeInfo.nameKo}`,
            nameKo: `운송 모드: ${modeInfo.nameKo}`,
            description: `운송 모드를 ${modeFactors[currentMode].nameKo}에서 ${modeInfo.nameKo}로 변경`,
            type: 'transport_mode',
            parameterChanged: 'transport_mode',
            baseValue: modeFactors[currentMode].nameKo,
            alternativeValue: modeInfo.nameKo,
            baseEmission,
            alternativeEmission,
            absoluteChange,
            percentageChange,
            isSignificant: Math.abs(percentageChange) >= SIGNIFICANCE_THRESHOLD
        })
    })

    return scenarios.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
}

// =============================================================================
// 사용 단계 시나리오 민감도 분석 (ISO 14067 6.4.5)
// =============================================================================

/**
 * 사용 단계 가정 변경에 따른 민감도 분석
 */
export const analyzeUsePhaseScenarios = (
    useElectricity: number,      // kWh/년
    useYears: number,            // 사용 기간
    electricityFactor: number,   // kg CO2e/kWh
    baselineCFP: number
): SensitivityScenario[] => {
    const scenarios: SensitivityScenario[] = []
    
    if (useElectricity <= 0 || useYears <= 0) return scenarios

    const baseEmission = useElectricity * useYears * electricityFactor

    // 사용 기간 변동 시나리오
    const yearVariations = [
        { years: useYears * 0.5, label: '50%', nameKo: '사용 기간 50%' },
        { years: useYears * 0.75, label: '75%', nameKo: '사용 기간 75%' },
        { years: useYears * 1.25, label: '125%', nameKo: '사용 기간 125%' },
        { years: useYears * 1.5, label: '150%', nameKo: '사용 기간 150%' }
    ]

    yearVariations.forEach(variation => {
        const alternativeEmission = useElectricity * variation.years * electricityFactor
        const absoluteChange = alternativeEmission - baseEmission
        const percentageChange = baselineCFP > 0 
            ? (absoluteChange / baselineCFP) * 100 
            : 0

        scenarios.push({
            id: `use_years_${variation.label}`,
            name: `Use Phase: ${variation.label} lifetime`,
            nameKo: variation.nameKo,
            description: `사용 기간을 ${useYears}년에서 ${variation.years.toFixed(1)}년으로 변경`,
            type: 'use_phase',
            parameterChanged: 'use_years',
            baseValue: `${useYears}년`,
            alternativeValue: `${variation.years.toFixed(1)}년`,
            baseEmission,
            alternativeEmission,
            absoluteChange,
            percentageChange,
            isSignificant: Math.abs(percentageChange) >= SIGNIFICANCE_THRESHOLD
        })
    })

    // 사용 강도 변동 시나리오
    const intensityVariations = [
        { factor: 0.5, label: '저사용', nameKo: '저사용 시나리오' },
        { factor: 0.75, label: '평균 이하', nameKo: '평균 이하 사용' },
        { factor: 1.25, label: '평균 이상', nameKo: '평균 이상 사용' },
        { factor: 1.5, label: '고사용', nameKo: '고사용 시나리오' }
    ]

    intensityVariations.forEach(variation => {
        const alternativeEmission = useElectricity * variation.factor * useYears * electricityFactor
        const absoluteChange = alternativeEmission - baseEmission
        const percentageChange = baselineCFP > 0 
            ? (absoluteChange / baselineCFP) * 100 
            : 0

        scenarios.push({
            id: `use_intensity_${variation.label}`,
            name: `Use Intensity: ${variation.label}`,
            nameKo: variation.nameKo,
            description: `사용 강도를 ${(variation.factor * 100).toFixed(0)}%로 변경`,
            type: 'use_phase',
            parameterChanged: 'use_electricity',
            baseValue: `${useElectricity} kWh/년`,
            alternativeValue: `${(useElectricity * variation.factor).toFixed(1)} kWh/년`,
            baseEmission,
            alternativeEmission,
            absoluteChange,
            percentageChange,
            isSignificant: Math.abs(percentageChange) >= SIGNIFICANCE_THRESHOLD
        })
    })

    return scenarios.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
}

// =============================================================================
// 폐기 시나리오 민감도 분석
// =============================================================================

/**
 * 폐기 시나리오 변경에 따른 민감도 분석
 */
export const analyzeEOLScenarios = (
    wasteWeight: number,         // kg
    currentRecyclingRate: number, // 0-1
    landfillFactor: number,      // kg CO2e/kg
    incinerationFactor: number,  // kg CO2e/kg
    recyclingCredit: number,     // kg CO2e/kg (음수)
    baselineCFP: number
): SensitivityScenario[] => {
    const scenarios: SensitivityScenario[] = []
    
    if (wasteWeight <= 0) return scenarios

    // 기준 시나리오 계산
    const baseEmission = wasteWeight * (
        (1 - currentRecyclingRate) * landfillFactor + 
        currentRecyclingRate * recyclingCredit
    )

    // 폐기 시나리오들
    const eolScenarios = [
        { 
            id: 'landfill_100',
            name: '100% Landfill',
            nameKo: '100% 매립',
            recyclingRate: 0,
            landfillRate: 1,
            incinerationRate: 0
        },
        { 
            id: 'incineration_100',
            name: '100% Incineration',
            nameKo: '100% 소각',
            recyclingRate: 0,
            landfillRate: 0,
            incinerationRate: 1
        },
        { 
            id: 'recycling_50',
            name: '50% Recycling',
            nameKo: '50% 재활용',
            recyclingRate: 0.5,
            landfillRate: 0.5,
            incinerationRate: 0
        },
        { 
            id: 'recycling_80',
            name: '80% Recycling',
            nameKo: '80% 재활용',
            recyclingRate: 0.8,
            landfillRate: 0.2,
            incinerationRate: 0
        },
        { 
            id: 'mixed',
            name: 'Mixed (30/30/40)',
            nameKo: '혼합 (매립30/소각30/재활용40)',
            recyclingRate: 0.4,
            landfillRate: 0.3,
            incinerationRate: 0.3
        }
    ]

    eolScenarios.forEach(scenario => {
        const alternativeEmission = wasteWeight * (
            scenario.landfillRate * landfillFactor +
            scenario.incinerationRate * incinerationFactor +
            scenario.recyclingRate * recyclingCredit
        )
        
        const absoluteChange = alternativeEmission - baseEmission
        const percentageChange = baselineCFP > 0 
            ? (absoluteChange / baselineCFP) * 100 
            : 0

        scenarios.push({
            id: `eol_${scenario.id}`,
            name: `EOL: ${scenario.name}`,
            nameKo: `폐기: ${scenario.nameKo}`,
            description: scenario.nameKo,
            type: 'eol_scenario',
            parameterChanged: 'eol_scenario',
            baseValue: `재활용 ${(currentRecyclingRate * 100).toFixed(0)}%`,
            alternativeValue: scenario.nameKo,
            baseEmission,
            alternativeEmission,
            absoluteChange,
            percentageChange,
            isSignificant: Math.abs(percentageChange) >= SIGNIFICANCE_THRESHOLD
        })
    })

    return scenarios.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
}

// =============================================================================
// 종합 민감도 분석
// =============================================================================

/**
 * 종합 민감도 분석 수행
 */
export const performComprehensiveSensitivityAnalysis = (
    params: {
        baselineCFP: number
        activityData: SimplifiedActivityData
        electricityGridId: string
        transportMode: TransportMode
        recyclingMethod: RecyclingAllocationMethod
        recycledContentInput: number
        recyclingRateOutput: number
        productMass: number
        calculateEmission: (data: SimplifiedActivityData) => number
    }
): SensitivityAnalysisResult => {
    const { 
        baselineCFP, activityData, electricityGridId, transportMode,
        recyclingMethod, recycledContentInput, recyclingRateOutput, 
        productMass, calculateEmission 
    } = params

    const allScenarios: SensitivityScenario[] = []

    // 1. 전력 그리드 민감도 분석
    const electricityScenarios = analyzeElectricityGridSensitivity(
        activityData.electricity || 0,
        electricityGridId,
        baselineCFP
    )
    allScenarios.push(...electricityScenarios)

    // 2. 운송 모드 민감도 분석
    const transportScenarios = analyzeTransportModeSensitivity(
        activityData.transport_weight || 0,
        activityData.transport_distance || 0,
        transportMode,
        baselineCFP
    )
    allScenarios.push(...transportScenarios)

    // 3. 재활용 할당 민감도 분석
    if (recycledContentInput > 0 || recyclingRateOutput > 0) {
        const recyclingScenarios = analyzeRecyclingAllocationSensitivity(
            {
                emissionVirgin: 2.0,  // 기본 버진 원료 배출계수
                emissionRecycled: 0.5,
                emissionProcess: baselineCFP * 0.3,  // 공정 배출 추정
                emissionDisposal: 0.5,
                recycledContentInput,
                recyclingRateOutput,
                productMass
            },
            recyclingMethod,
            baselineCFP
        )
        allScenarios.push(...recyclingScenarios)
    }

    // 4. 활동 데이터 민감도 분석
    const activityScenarios = analyzeActivityDataSensitivity(
        activityData,
        calculateEmission,
        baselineCFP,
        20
    )
    allScenarios.push(...activityScenarios)

    // 5. 사용 단계 민감도 분석
    if (activityData.use_electricity && activityData.use_years) {
        const electricityFactor = ELECTRICITY_EMISSION_FACTORS.find(
            f => f.id === electricityGridId
        )?.value || 0.4594

        const useScenarios = analyzeUsePhaseScenarios(
            activityData.use_electricity,
            activityData.use_years,
            electricityFactor,
            baselineCFP
        )
        allScenarios.push(...useScenarios)
    }

    // 6. 폐기 시나리오 민감도 분석
    if (activityData.waste_weight) {
        const eolScenarios = analyzeEOLScenarios(
            activityData.waste_weight,
            activityData.recycling_rate || 0,
            0.58,   // 매립 배출계수
            0.42,   // 소각 배출계수
            -0.8,   // 재활용 크레딧
            baselineCFP
        )
        allScenarios.push(...eolScenarios)
    }

    // 유의미한 요인 식별
    const significantFactors = allScenarios
        .filter(s => s.isSignificant)
        .map(s => s.nameKo)

    // 권장사항 생성
    const recommendations = generateRecommendations(allScenarios)

    // ISO 준수 체크
    const isoCompliance = checkISOCompliance(allScenarios, params)

    return {
        analysisDate: new Date().toISOString(),
        baselineCFP,
        scenarios: allScenarios,
        significantFactors,
        recommendations,
        isoCompliance
    }
}

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 민감도 분석 결과 기반 권장사항 생성
 */
const generateRecommendations = (scenarios: SensitivityScenario[]): string[] => {
    const recommendations: string[] = []

    const significantScenarios = scenarios.filter(s => s.isSignificant)
    
    if (significantScenarios.length === 0) {
        recommendations.push('민감도 분석 결과, 유의미한 영향을 미치는 파라미터가 없습니다.')
        return recommendations
    }

    // 가장 민감한 파라미터 식별
    const mostSensitive = significantScenarios
        .sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
        .slice(0, 3)

    recommendations.push(
        `가장 민감한 파라미터: ${mostSensitive.map(s => s.nameKo).join(', ')}`
    )

    // 유형별 권장사항
    const typeGroups = significantScenarios.reduce((acc, s) => {
        if (!acc[s.type]) acc[s.type] = []
        acc[s.type].push(s)
        return acc
    }, {} as Record<SensitivityAnalysisType, SensitivityScenario[]>)

    if (typeGroups.electricity_grid) {
        recommendations.push('전력 그리드 선택이 결과에 유의미한 영향을 미칩니다. 지역별 그리드 데이터 정확성을 확인하세요.')
    }

    if (typeGroups.recycling_allocation) {
        recommendations.push('재활용 할당 방법 선택이 결과에 유의미한 영향을 미칩니다. 할당 방법 선택 근거를 문서화하세요.')
    }

    if (typeGroups.activity_data) {
        const activityParams = typeGroups.activity_data.map(s => s.parameterChanged)
        recommendations.push(`활동 데이터 정확성 개선 필요: ${[...new Set(activityParams)].join(', ')}`)
    }

    if (typeGroups.use_phase) {
        recommendations.push('사용 단계 가정이 결과에 유의미한 영향을 미칩니다. 실제 사용 패턴 데이터 수집을 권장합니다.')
    }

    if (typeGroups.eol_scenario) {
        recommendations.push('폐기 시나리오가 결과에 유의미한 영향을 미칩니다. 실제 폐기 경로 데이터 확보를 권장합니다.')
    }

    return recommendations
}

/**
 * ISO 14067 준수 여부 체크
 */
const checkISOCompliance = (
    scenarios: SensitivityScenario[],
    params: {
        recycledContentInput: number
        recyclingRateOutput: number
    }
): SensitivityAnalysisResult['isoCompliance'] => {
    const compliance: SensitivityAnalysisResult['isoCompliance'] = []

    // 6.4.5 시스템 경계 정제
    compliance.push({
        clause: '6.4.5',
        requirement: '시스템 경계 정제 시 민감도 분석 수행',
        satisfied: scenarios.some(s => s.type === 'activity_data' || s.type === 'system_boundary')
    })

    // 6.4.6.1 할당 절차
    const hasRecycling = params.recycledContentInput > 0 || params.recyclingRateOutput > 0
    compliance.push({
        clause: '6.4.6.1',
        requirement: '다중 할당 방법 적용 시 민감도 분석 수행',
        satisfied: !hasRecycling || scenarios.some(s => s.type === 'recycling_allocation')
    })

    // 6.4.9.4 전력
    compliance.push({
        clause: '6.4.9.4',
        requirement: '전력 그리드 믹스 민감도 분석 수행',
        satisfied: scenarios.some(s => s.type === 'electricity_grid')
    })

    // 6.6 해석
    compliance.push({
        clause: '6.6',
        requirement: '중요 투입물, 산출물, 방법론 선택에 대한 민감도 분석',
        satisfied: scenarios.filter(s => s.isSignificant).length > 0
    })

    return compliance
}

/**
 * 토네이도 차트용 데이터 생성
 */
export const generateTornadoChartData = (
    scenarios: SensitivityScenario[]
): { parameter: string; low: number; high: number; base: number }[] => {
    // 파라미터별로 그룹화
    const parameterGroups = scenarios.reduce((acc, s) => {
        const key = s.parameterChanged
        if (!acc[key]) {
            acc[key] = { low: 0, high: 0, name: s.nameKo.split(' ')[0] }
        }
        if (s.percentageChange < acc[key].low) {
            acc[key].low = s.percentageChange
        }
        if (s.percentageChange > acc[key].high) {
            acc[key].high = s.percentageChange
        }
        return acc
    }, {} as Record<string, { low: number; high: number; name: string }>)

    return Object.entries(parameterGroups)
        .map(([param, data]) => ({
            parameter: data.name,
            low: data.low,
            high: data.high,
            base: 0
        }))
        .sort((a, b) => (Math.abs(b.high) + Math.abs(b.low)) - (Math.abs(a.high) + Math.abs(a.low)))
}

/**
 * 민감도 분석 요약 생성
 */
export const generateSensitivitySummary = (
    result: SensitivityAnalysisResult
): string => {
    const significantCount = result.scenarios.filter(s => s.isSignificant).length
    const totalCount = result.scenarios.length

    let summary = `## 민감도 분석 요약\n\n`
    summary += `- 분석 일자: ${new Date(result.analysisDate).toLocaleDateString('ko-KR')}\n`
    summary += `- 기준 CFP: ${result.baselineCFP.toFixed(2)} kg CO₂e\n`
    summary += `- 분석 시나리오 수: ${totalCount}개\n`
    summary += `- 유의미한 영향 요인: ${significantCount}개\n\n`

    if (result.significantFactors.length > 0) {
        summary += `### 유의미한 영향 요인 (>5% 변화)\n`
        result.significantFactors.forEach(factor => {
            summary += `- ${factor}\n`
        })
        summary += '\n'
    }

    summary += `### 권장사항\n`
    result.recommendations.forEach(rec => {
        summary += `- ${rec}\n`
    })
    summary += '\n'

    summary += `### ISO 14067 준수 현황\n`
    result.isoCompliance.forEach(item => {
        const status = item.satisfied ? '✓' : '✗'
        summary += `- ${status} ${item.clause}: ${item.requirement}\n`
    })

    return summary
}

