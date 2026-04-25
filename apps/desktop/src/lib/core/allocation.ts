/**
 * ISO 14067 할당(Allocation) 로직
 * 
 * ISO 14067:2018
 * - 6.4.6 Allocation (할당)
 * - 6.4.6.3 Allocation procedure for reuse and recycling
 * 
 * 참고: ISO 14044:2006 4.3.4
 */

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 다중 출력 프로세스 할당 방법
 * ISO 14067 6.4.6.2 (할당 절차)
 */
export type MultiOutputAllocationMethod =
    | 'subdivision'      // 하위 분할 - 할당 회피
    | 'system_expansion' // 시스템 확장 - 할당 회피
    | 'physical'         // 물리적 관계 (질량, 에너지 등)
    | 'economic'         // 경제적 관계 (가격 기반)

/**
 * 물리적 할당 기준
 */
export type PhysicalAllocationBasis =
    | 'mass'            // 질량 기준
    | 'energy'          // 에너지 함량 기준
    | 'volume'          // 부피 기준
    | 'carbon_content'  // 탄소 함량 기준
    | 'other_physical'  // 기타 물리적 관계

/**
 * 재사용/재활용 할당 방법
 * ISO 14067 6.4.6.3 (재활용 할당)
 */
export type RecyclingAllocationMethod =
    | 'cut_off'         // Cut-off (재활용 부담 없음, 100:0)
    | 'eol_recycling'   // EOL 재활용 방법 (0:100)
    | 'fifty_fifty'     // 50:50 분배
    | 'substitution'    // 대체 (시스템 확장)
    | 'pef_formula'     // PEF Circular Footprint Formula

/**
 * 루프 타입
 */
export type LoopType = 'closed_loop' | 'open_loop'

// =============================================================================
// 다중 출력 프로세스 할당 설정
// =============================================================================

export interface MultiOutputAllocation {
    method: MultiOutputAllocationMethod
    physicalBasis?: PhysicalAllocationBasis

    // 할당 비율 (주 제품 기준)
    mainProductShare: number // 0-1 사이 값

    // 주 제품 정보 (할당 계산용)
    mainProductData?: MainProductData

    // 공동 제품 정보
    coProducts: CoProduct[]

    // 총 공정 배출량 (할당 전, kg CO2e)
    totalProcessEmission?: number

    // 설명/정당화
    justification: string
}

export interface CoProduct {
    id: string
    name: string
    quantity: number
    unit: string

    // 할당 기준값 (기본 — 질량 기반)
    allocationValue: number // 질량 기준 (kg)
    allocationUnit: string

    // 에너지 기반 할당 데이터
    energyContent?: number      // MJ/단위
    energyUnit?: string         // MJ

    // 경제적 할당 데이터
    economicValue?: number      // 단가 (원/단위)
    economicUnit?: string       // 원

    // 탄소 함량 기반 할당 데이터
    carbonContent?: number      // kg C/단위
    carbonUnit?: string         // kg C

    // 계산된 할당 비율
    allocationShare?: number
}

/**
 * 주제품 데이터 (Multi-Output 할당 시 주제품 정보)
 */
export interface MainProductData {
    name: string
    quantity: number
    unit: string

    // 물리적 속성
    mass: number                // kg
    energyContent?: number      // MJ
    economicValue?: number      // 원/단위
    carbonContent?: number      // kg C
}

// 기본 주제품 데이터
export const DEFAULT_MAIN_PRODUCT_DATA: MainProductData = {
    name: '',
    quantity: 0,
    unit: 'kg',
    mass: 0,
    energyContent: undefined,
    economicValue: undefined,
    carbonContent: undefined
}


// =============================================================================
// 재사용/재활용 할당 설정
// =============================================================================

export interface RecyclingAllocation {
    method: RecyclingAllocationMethod
    loopType: LoopType

    // 재활용률
    recyclingRate: number // 0-1 사이 값

    // 재활용 원료 함량 (투입)
    recycledContentInput: number // 0-1 사이 값

    // 재활용 가능률 (산출)
    recyclabilityOutput: number // 0-1 사이 값

    // 대체 원료 정보 (substitution 방법용)
    substitutedMaterial?: {
        name: string
        emissionFactor: number // kg CO2e/kg
    }

    // 품질 계수 (다운사이클링 고려)
    qualityFactorInput?: number  // Qs,in - 투입 품질 계수 (0-1)
    qualityFactorOutput?: number // Qs,out - 산출 품질 계수 (0-1)

    // 설명/정당화
    justification: string
}

// =============================================================================
// 할당 방법 상수 정의
// =============================================================================

export const MULTI_OUTPUT_ALLOCATION_METHODS: Record<MultiOutputAllocationMethod, {
    name: string
    nameKo: string
    description: string
    descriptionKo: string
    priority: number // ISO 14044 우선순위 (1이 가장 높음)
    isAvoidance: boolean
}> = {
    subdivision: {
        name: 'Subdivision',
        nameKo: '하위 분할',
        description: 'Divide the unit process into sub-processes for each output',
        descriptionKo: '단위 공정을 각 출력물별 하위 공정으로 분할하여 할당 회피',
        priority: 1,
        isAvoidance: true
    },
    system_expansion: {
        name: 'System Expansion',
        nameKo: '시스템 확장',
        description: 'Expand system boundary to include functions of co-products',
        descriptionKo: '시스템 경계를 확장하여 공동 제품의 기능을 포함 (대체 공정 고려)',
        priority: 1,
        isAvoidance: true
    },
    physical: {
        name: 'Physical Allocation',
        nameKo: '물리적 할당',
        description: 'Allocate based on physical relationships (mass, energy, etc.)',
        descriptionKo: '물리적 관계(질량, 에너지, 부피 등)에 따라 배출량 배분',
        priority: 2,
        isAvoidance: false
    },
    economic: {
        name: 'Economic Allocation',
        nameKo: '경제적 할당',
        description: 'Allocate based on economic value (market price)',
        descriptionKo: '경제적 가치(시장 가격)에 따라 배출량 배분',
        priority: 3,
        isAvoidance: false
    }
}

export const PHYSICAL_ALLOCATION_BASIS_OPTIONS: Record<PhysicalAllocationBasis, {
    name: string
    nameKo: string
    unit: string
    description: string
}> = {
    mass: {
        name: 'Mass',
        nameKo: '질량',
        unit: 'kg',
        description: '질량 비율에 따른 할당 (가장 일반적)'
    },
    energy: {
        name: 'Energy Content',
        nameKo: '에너지 함량',
        unit: 'MJ',
        description: '에너지 함량 비율에 따른 할당 (연료, 에너지 제품에 적합)'
    },
    volume: {
        name: 'Volume',
        nameKo: '부피',
        unit: 'L',
        description: '부피 비율에 따른 할당 (액체, 기체 제품에 적합)'
    },
    carbon_content: {
        name: 'Carbon Content',
        nameKo: '탄소 함량',
        unit: 'kg C',
        description: '탄소 함량 비율에 따른 할당 (화학 제품에 적합)'
    },
    other_physical: {
        name: 'Other Physical Property',
        nameKo: '기타 물리적 특성',
        unit: '-',
        description: '기타 물리적 관계에 따른 할당'
    }
}

export const RECYCLING_ALLOCATION_METHODS: Record<RecyclingAllocationMethod, {
    name: string
    nameKo: string
    description: string
    descriptionKo: string
    formula: string
    suitableFor: string[]
}> = {
    cut_off: {
        name: 'Cut-off (100:0)',
        nameKo: '컷오프 (100:0)',
        description: 'No burden/credit for recycling - burden stays with producer',
        descriptionKo: '재활용에 대한 부담/크레딧 없음. 생산자가 모든 부담',
        formula: 'CFP = E_virgin × (1 - R_in) + E_process + E_disposal × (1 - R_out)',
        suitableFor: ['Open-loop', 'Unknown end-of-life', 'Conservative approach']
    },
    eol_recycling: {
        name: 'EOL Recycling (0:100)',
        nameKo: 'EOL 재활용 (0:100)',
        description: 'Burden allocated to final product user who recycles',
        descriptionKo: '재활용하는 최종 사용자에게 부담 할당',
        formula: 'CFP = E_virgin + E_process + E_recycling × R_out - E_credit',
        suitableFor: ['High recyclability', 'Established recycling systems']
    },
    fifty_fifty: {
        name: '50:50 Allocation',
        nameKo: '50:50 할당',
        description: 'Equal sharing of recycling burden between producer and user',
        descriptionKo: '생산자와 사용자가 재활용 부담을 동등하게 분배',
        formula: 'CFP = 0.5 × E_virgin + 0.5 × E_recycled + E_process + 0.5 × E_disposal',
        suitableFor: ['Balanced approach', 'Uncertain allocation']
    },
    substitution: {
        name: 'Substitution (System Expansion)',
        nameKo: '대체 (시스템 확장)',
        description: 'Credit for avoided production of virgin material',
        descriptionKo: '버진 원료 생산 회피에 대한 크레딧 부여',
        formula: 'CFP = E_virgin × (1 - R_in) + E_process - E_avoided × R_out × Q',
        suitableFor: ['Closed-loop', 'Clear substitution relationship']
    },
    pef_formula: {
        name: 'PEF Circular Footprint Formula',
        nameKo: 'PEF 순환 발자국 공식',
        description: 'EU Product Environmental Footprint formula for recycling',
        descriptionKo: 'EU PEF 방법론의 순환 발자국 공식',
        formula: 'CFP = (1-R1)×Ev + R1×(A×Erecycled + (1-A)×Ev×Qs/Qp) + (1-A)×R2×(Erecycling-Evirgin×Qs/Qp) + (1-R2-R3)×Ed',
        suitableFor: ['EU compliance', 'Complex recycling scenarios', 'PEF studies']
    }
}

// =============================================================================
// 할당 계산 함수
// =============================================================================

/**
 * 물리적 할당 비율 계산
 */
export const calculatePhysicalAllocation = (
    mainProduct: { value: number },
    coProducts: { value: number }[]
): { mainShare: number, coProductShares: number[] } => {
    const total = mainProduct.value + coProducts.reduce((sum, p) => sum + p.value, 0)

    if (total === 0) {
        return { mainShare: 1, coProductShares: coProducts.map(() => 0) }
    }

    const mainShare = mainProduct.value / total
    const coProductShares = coProducts.map(p => p.value / total)

    return { mainShare, coProductShares }
}

/**
 * 경제적 할당 비율 계산
 */
export const calculateEconomicAllocation = (
    mainProduct: { quantity: number, price: number },
    coProducts: { quantity: number, price: number }[]
): { mainShare: number, coProductShares: number[] } => {
    const mainValue = mainProduct.quantity * mainProduct.price
    const coProductValues = coProducts.map(p => p.quantity * p.price)
    const total = mainValue + coProductValues.reduce((sum, v) => sum + v, 0)

    if (total === 0) {
        return { mainShare: 1, coProductShares: coProducts.map(() => 0) }
    }

    const mainShare = mainValue / total
    const coProductShares = coProductValues.map(v => v / total)

    return { mainShare, coProductShares }
}

/**
 * Cut-off 방법 계산
 * 재활용 투입물의 부담 없음, 재활용 산출물에 크레딧 없음
 */
export const calculateCutOffAllocation = (
    emissionVirgin: number,      // 버진 원료 배출량 (kg CO2e/kg)
    emissionProcess: number,     // 공정 배출량 (kg CO2e)
    emissionDisposal: number,    // 폐기 배출량 (kg CO2e/kg)
    recycledContentInput: number, // R_in: 재활용 투입 비율 (0-1)
    recyclingRateOutput: number,  // R_out: 재활용 산출 비율 (0-1)
    productMass: number          // 제품 질량 (kg)
): number => {
    // CFP = E_virgin × (1 - R_in) × Mass + E_process + E_disposal × (1 - R_out) × Mass
    const virginEmission = emissionVirgin * (1 - recycledContentInput) * productMass
    const processEmission = emissionProcess
    const disposalEmission = emissionDisposal * (1 - recyclingRateOutput) * productMass

    return virginEmission + processEmission + disposalEmission
}

/**
 * EOL 재활용 방법 계산 (0:100)
 */
export const calculateEOLRecyclingAllocation = (
    emissionVirgin: number,
    emissionProcess: number,
    emissionRecycling: number,   // 재활용 공정 배출량 (kg CO2e/kg)
    emissionCredit: number,      // 회피된 버진 생산 배출량 (kg CO2e/kg)
    recyclingRateOutput: number,
    productMass: number
): number => {
    // CFP = E_virgin × Mass + E_process + E_recycling × R_out × Mass - E_credit × R_out × Mass
    const virginEmission = emissionVirgin * productMass
    const processEmission = emissionProcess
    const recyclingEmission = emissionRecycling * recyclingRateOutput * productMass
    const creditEmission = emissionCredit * recyclingRateOutput * productMass

    return virginEmission + processEmission + recyclingEmission - creditEmission
}

/**
 * 50:50 할당 방법 계산
 */
export const calculateFiftyFiftyAllocation = (
    emissionVirgin: number,
    emissionRecycled: number,    // 재활용 원료 배출량 (kg CO2e/kg)
    emissionProcess: number,
    emissionDisposal: number,
    recycledContentInput: number,
    recyclingRateOutput: number,
    productMass: number
): number => {
    // 입력측: 50% 버진 + 50% 재활용
    const inputEmission = (
        0.5 * emissionVirgin * (1 - recycledContentInput) +
        0.5 * emissionRecycled * recycledContentInput
    ) * productMass

    // 출력측: 50% 폐기
    const outputEmission = 0.5 * emissionDisposal * (1 - recyclingRateOutput) * productMass

    return inputEmission + emissionProcess + outputEmission
}

/**
 * 대체(Substitution) 방법 계산
 */
export const calculateSubstitutionAllocation = (
    emissionVirgin: number,
    emissionProcess: number,
    emissionRecycling: number,
    emissionAvoided: number,     // 회피된 생산 배출량 (kg CO2e/kg)
    recycledContentInput: number,
    recyclingRateOutput: number,
    qualityFactor: number,       // Q: 품질 계수 (다운사이클링 시 <1)
    productMass: number
): number => {
    // CFP = E_virgin × (1 - R_in) × Mass + E_process + E_recycling × R_out - E_avoided × R_out × Q × Mass
    const virginEmission = emissionVirgin * (1 - recycledContentInput) * productMass
    const processEmission = emissionProcess
    const recyclingEmission = emissionRecycling * recyclingRateOutput * productMass
    const avoidedEmission = emissionAvoided * recyclingRateOutput * qualityFactor * productMass

    return virginEmission + processEmission + recyclingEmission - avoidedEmission
}

/**
 * PEF Circular Footprint Formula 계산
 * EU PEF 방법론
 */
export const calculatePEFCircularFootprint = (
    params: {
        Ev: number         // 버진 원료 배출량 (kg CO2e/kg)
        Erecycled: number  // 재활용 원료 배출량 (kg CO2e/kg)
        Erecycling: number // 재활용 공정 배출량 (kg CO2e/kg)
        Ed: number         // 폐기 배출량 (kg CO2e/kg)
        R1: number         // 재활용 투입 비율 (0-1)
        R2: number         // 재활용 산출 비율 (0-1)
        R3: number         // 에너지 회수 비율 (0-1)
        A: number          // 할당 계수 (기본 0.5)
        Qs: number         // 2차 원료 품질 (0-1)
        Qp: number         // 1차 원료 품질 (보통 1)
        mass: number       // 제품 질량 (kg)
    }
): number => {
    const { Ev, Erecycled, Erecycling, Ed, R1, R2, R3, A, Qs, Qp, mass } = params

    // (1-R1) × Ev: 버진 원료 부담
    const term1 = (1 - R1) * Ev

    // R1 × (A × Erecycled + (1-A) × Ev × Qs/Qp): 재활용 투입 부담
    const term2 = R1 * (A * Erecycled + (1 - A) * Ev * (Qs / Qp))

    // (1-A) × R2 × (Erecycling - Ev × Qs/Qp): 재활용 산출 크레딧
    const term3 = (1 - A) * R2 * (Erecycling - Ev * (Qs / Qp))

    // (1 - R2 - R3) × Ed: 폐기 부담
    const term4 = (1 - R2 - R3) * Ed

    return (term1 + term2 + term3 + term4) * mass
}

// =============================================================================
// 할당 설정 기본값
// =============================================================================

export const DEFAULT_MULTI_OUTPUT_ALLOCATION: MultiOutputAllocation = {
    method: 'physical',
    physicalBasis: 'mass',
    mainProductShare: 1,
    mainProductData: DEFAULT_MAIN_PRODUCT_DATA,
    coProducts: [],
    totalProcessEmission: 0,
    justification: '단일 제품 공정으로 할당 불필요'
}

export const DEFAULT_RECYCLING_ALLOCATION: RecyclingAllocation = {
    method: 'cut_off',
    loopType: 'open_loop',
    recyclingRate: 0,
    recycledContentInput: 0,
    recyclabilityOutput: 0,
    qualityFactorInput: 1,
    qualityFactorOutput: 1,
    justification: 'Cut-off 방법 적용 - 보수적 접근'
}

// =============================================================================
// 할당 방법 선택 가이드
// =============================================================================

export interface AllocationGuidance {
    scenario: string
    scenarioKo: string
    recommendedMethod: MultiOutputAllocationMethod | RecyclingAllocationMethod
    reasoning: string
    reasoningKo: string
}

export const ALLOCATION_GUIDANCE: AllocationGuidance[] = [
    {
        scenario: 'Single product process',
        scenarioKo: '단일 제품 공정',
        recommendedMethod: 'subdivision',
        reasoning: 'No allocation needed for single product processes',
        reasoningKo: '단일 제품 공정은 할당이 필요하지 않음'
    },
    {
        scenario: 'Co-products with clear physical relationship',
        scenarioKo: '명확한 물리적 관계가 있는 공동 제품',
        recommendedMethod: 'physical',
        reasoning: 'Physical allocation preferred when clear physical relationship exists',
        reasoningKo: '명확한 물리적 관계가 있을 때 물리적 할당 권장'
    },
    {
        scenario: 'Co-products with no physical relationship',
        scenarioKo: '물리적 관계가 없는 공동 제품',
        recommendedMethod: 'economic',
        reasoning: 'Economic allocation when physical relationship is not determinable',
        reasoningKo: '물리적 관계를 결정할 수 없을 때 경제적 할당 적용'
    },
    {
        scenario: 'Recycled content in product',
        scenarioKo: '제품 내 재활용 원료',
        recommendedMethod: 'cut_off',
        reasoning: 'Cut-off is conservative and widely accepted for recycled content',
        reasoningKo: 'Cut-off는 보수적이며 재활용 원료에 널리 수용됨'
    },
    {
        scenario: 'Closed-loop recycling (same product)',
        scenarioKo: '폐쇄 루프 재활용 (동일 제품)',
        recommendedMethod: 'substitution',
        reasoning: 'Substitution appropriate when recycled material replaces virgin',
        reasoningKo: '재활용 원료가 버진 원료를 대체할 때 대체 방법 적합'
    },
    {
        scenario: 'EU PEF compliance required',
        scenarioKo: 'EU PEF 준수 필요',
        recommendedMethod: 'pef_formula',
        reasoning: 'PEF Circular Footprint Formula required for EU compliance',
        reasoningKo: 'EU 준수를 위해 PEF 순환 발자국 공식 필요'
    },
    {
        scenario: 'Uncertain end-of-life scenario',
        scenarioKo: '불확실한 폐기 시나리오',
        recommendedMethod: 'cut_off',
        reasoning: 'Cut-off is conservative when EOL fate is uncertain',
        reasoningKo: '폐기 운명이 불확실할 때 Cut-off가 보수적'
    }
]

/**
 * 시나리오에 따른 할당 방법 추천
 */
export const getRecommendedAllocationMethod = (
    hasCoProducts: boolean,
    hasPhysicalRelationship: boolean,
    hasRecycledContent: boolean,
    isClosedLoop: boolean,
    requiresPEF: boolean
): AllocationGuidance => {
    if (requiresPEF && hasRecycledContent) {
        return ALLOCATION_GUIDANCE[5] // PEF formula
    }

    if (hasRecycledContent) {
        if (isClosedLoop) {
            return ALLOCATION_GUIDANCE[4] // Substitution
        }
        return ALLOCATION_GUIDANCE[3] // Cut-off
    }

    if (hasCoProducts) {
        if (hasPhysicalRelationship) {
            return ALLOCATION_GUIDANCE[1] // Physical
        }
        return ALLOCATION_GUIDANCE[2] // Economic
    }

    return ALLOCATION_GUIDANCE[0] // Single product
}

