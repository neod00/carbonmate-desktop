/**
 * 매트릭스 기반 LCI 연산 엔진 (Matrix-based LCI Engine)
 * 
 * 이론적 근거:
 * - Heijungs & Suh (2002) "The Computational Structure of Life Cycle Assessment"
 * - ISO 14044:2006 4.3.4 할당 절차
 * - ISO 14067:2018 6.4.6 할당
 * 
 * 핵심 수식: g = B · A⁻¹ · f
 * - A (Technology Matrix): 공정 간 기술적 흐름 행렬
 * - B (Intervention Matrix): 환경 부하 행렬
 * - f (Final Demand Vector): 최종 수요 벡터 (기능 단위)
 * - g (Inventory Result): 환경 배출 결과 벡터
 * 
 * @version 1.0.0
 */

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 단위 공정 (Unit Process)
 */
export interface UnitProcess {
    id: string
    name: string
    nameKo: string

    // 입력물 (Inputs)
    inputs: ProcessFlow[]

    // 출력물 (Outputs) — 다중 출력 가능
    outputs: ProcessFlow[]

    // 환경 개입 (Environmental Interventions)
    emissions: EmissionFlow[]

    // 메타데이터
    sector?: string
    location?: string
    dataQuality?: 'primary' | 'secondary' | 'estimated'
}

/**
 * 공정 흐름 (기술계 내 흐름)
 */
export interface ProcessFlow {
    id: string
    name: string
    quantity: number
    unit: string

    // 연결된 공정 ID (업스트림 또는 다운스트림)
    linkedProcessId?: string

    // 흐름 유형
    type: 'product' | 'co_product' | 'waste' | 'by_product'

    // 할당 관련 속성
    economicValue?: number          // 경제적 가치 (원/단위)
    energyContent?: number          // 에너지 함량 (MJ/단위)
    carbonContent?: number          // 탄소 함량 (kg C/단위)
    mass?: number                   // 질량 (kg)
}

/**
 * 환경 배출 흐름
 */
export interface EmissionFlow {
    substance: string               // 물질명 (CO2, CH4, N2O 등)
    compartment: 'air' | 'water' | 'soil'
    quantity: number                 // 배출량 (kg)
    gwp?: number                    // 지구온난화지수
}

/**
 * 매트릭스 (2D 배열)
 */
type Matrix = number[][]
type Vector = number[]

/**
 * 할당 결과
 */
export interface AllocationCalculationResult {
    // 할당된 배출량
    mainProductEmission: number            // kg CO2e
    coProductEmissions: {
        name: string
        emission: number                   // kg CO2e
        share: number                      // 0-1
    }[]

    // 할당 비율
    allocationShares: {
        productName: string
        share: number
        basis: string                      // 할당 기준
        basisValue: number                 // 할당 기준값
        basisUnit: string                  // 할당 기준 단위
    }[]

    // 총 배출량 (할당 전)
    totalEmissionBeforeAllocation: number   // kg CO2e

    // 할당 방법
    method: string
    methodKo: string

    // ISO 준수 정보
    isoHierarchyLevel: 1 | 2 | 3          // ISO 14044 위계 수준
    justification: string
}

/**
 * 시스템 확장 결과
 */
export interface SystemExpansionResult {
    // 원래 공정 배출량
    originalEmission: number

    // 대체 크레딧
    substitutionCredits: {
        coProductName: string
        substitutedProduct: string
        avoidedEmission: number            // kg CO2e (회피된 배출)
        qualityFactor: number              // 0-1
        netCredit: number                  // 회피 배출 × 품질계수
    }[]

    // 최종 할당된 배출량
    netEmission: number

    justification: string
}

/**
 * 통합 할당 시나리오 결과
 */
export interface IntegratedAllocationResult {
    // 각 방법별 결과
    scenarios: {
        method: string
        methodKo: string
        isoLevel: 1 | 2 | 3
        mainProductEmission: number
        allocationShares: { name: string, share: number }[]
        recommended: boolean
        confidence: 'high' | 'medium' | 'low'
    }[]

    // 추천 시나리오
    recommendedScenario: string

    // 민감도 분석
    sensitivityRange: {
        min: number
        max: number
        rangePercent: number               // 최대-최소 / 평균 × 100
    }

    // 정당화
    justification: string
    justificationKo: string
}

// =============================================================================
// 행렬 연산 유틸리티 (소규모 행렬용 — 순수 TypeScript 구현)
// =============================================================================

/**
 * 항등 행렬 생성
 */
const identityMatrix = (n: number): Matrix => {
    const I: Matrix = Array.from({ length: n }, () => Array(n).fill(0))
    for (let i = 0; i < n; i++) I[i][i] = 1
    return I
}

/**
 * 행렬 곱셈: C = A × B
 */
const matMul = (A: Matrix, B: Matrix): Matrix => {
    const rowsA = A.length
    const colsA = A[0].length
    const colsB = B[0].length

    const C: Matrix = Array.from({ length: rowsA }, () => Array(colsB).fill(0))

    for (let i = 0; i < rowsA; i++) {
        for (let j = 0; j < colsB; j++) {
            for (let k = 0; k < colsA; k++) {
                C[i][j] += A[i][k] * B[k][j]
            }
        }
    }

    return C
}

/**
 * 행렬-벡터 곱셈: y = A × x
 */
const matVecMul = (A: Matrix, x: Vector): Vector => {
    const rows = A.length
    const cols = A[0].length
    const y: Vector = Array(rows).fill(0)

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            y[i] += A[i][j] * x[j]
        }
    }

    return y
}

/**
 * 가우스-조르단 소거법으로 역행렬 계산
 * 소규모 행렬 (최대 ~50×50)에 적합
 */
const invertMatrix = (M: Matrix): Matrix | null => {
    const n = M.length
    if (n === 0 || M[0].length !== n) return null

    // 확장 행렬 [M | I] 생성
    const augmented: Matrix = M.map((row, i) => {
        const identRow = Array(n).fill(0)
        identRow[i] = 1
        return [...row, ...identRow]
    })

    // 전진 소거 (Forward Elimination)
    for (let col = 0; col < n; col++) {
        // 피벗 탐색 (부분 피벗)
        let maxVal = Math.abs(augmented[col][col])
        let maxRow = col
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(augmented[row][col]) > maxVal) {
                maxVal = Math.abs(augmented[row][col])
                maxRow = row
            }
        }

        // 특이 행렬 검사
        if (maxVal < 1e-12) return null

        // 행 교환
        if (maxRow !== col) {
            [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]]
        }

        // 피벗 정규화
        const pivot = augmented[col][col]
        for (let j = 0; j < 2 * n; j++) {
            augmented[col][j] /= pivot
        }

        // 소거
        for (let row = 0; row < n; row++) {
            if (row === col) continue
            const factor = augmented[row][col]
            for (let j = 0; j < 2 * n; j++) {
                augmented[row][j] -= factor * augmented[col][j]
            }
        }
    }

    // 역행렬 추출
    return augmented.map(row => row.slice(n))
}

// =============================================================================
// 매트릭스 기반 LCI 계산 (핵심 엔진)
// =============================================================================

/**
 * 공정 목록에서 Technology Matrix (A) 구축
 * 
 * 열(Column) = 공정, 행(Row) = 제품
 * a_ij > 0: 공정 j가 제품 i를 생산
 * a_ij < 0: 공정 j가 제품 i를 소비
 */
export const buildTechnologyMatrix = (
    processes: UnitProcess[]
): { A: Matrix, productIndex: Map<string, number>, processIndex: Map<string, number> } => {
    // 모든 고유 제품 흐름 수집
    const allProducts = new Map<string, number>()
    let productIdx = 0

    for (const proc of processes) {
        for (const output of proc.outputs) {
            if (!allProducts.has(output.id)) {
                allProducts.set(output.id, productIdx++)
            }
        }
        for (const input of proc.inputs) {
            if (!allProducts.has(input.id)) {
                allProducts.set(input.id, productIdx++)
            }
        }
    }

    const n = Math.max(allProducts.size, processes.length)
    const A: Matrix = Array.from({ length: n }, () => Array(n).fill(0))

    const processIndex = new Map<string, number>()
    processes.forEach((proc, idx) => processIndex.set(proc.id, idx))

    // 행렬 채우기
    for (let j = 0; j < processes.length; j++) {
        const proc = processes[j]

        // 출력물 (양수)
        for (const output of proc.outputs) {
            const i = allProducts.get(output.id)
            if (i !== undefined) {
                A[i][j] = output.quantity
            }
        }

        // 입력물 (음수)
        for (const input of proc.inputs) {
            const i = allProducts.get(input.id)
            if (i !== undefined) {
                A[i][j] = -input.quantity
            }
        }
    }

    return { A, productIndex: allProducts, processIndex }
}

/**
 * Intervention Matrix (B) 구축
 * 행 = 환경 배출물, 열 = 공정
 */
export const buildInterventionMatrix = (
    processes: UnitProcess[],
    gwpFactors: Record<string, number>
): { B: Matrix, emissionIndex: Map<string, number> } => {
    // 모든 고유 배출물 수집
    const allEmissions = new Map<string, number>()
    let emIdx = 0

    for (const proc of processes) {
        for (const em of proc.emissions) {
            const key = `${em.substance}_${em.compartment}`
            if (!allEmissions.has(key)) {
                allEmissions.set(key, emIdx++)
            }
        }
    }

    const rows = allEmissions.size
    const cols = processes.length
    const B: Matrix = Array.from({ length: rows }, () => Array(cols).fill(0))

    for (let j = 0; j < processes.length; j++) {
        for (const em of processes[j].emissions) {
            const key = `${em.substance}_${em.compartment}`
            const i = allEmissions.get(key)
            if (i !== undefined) {
                // GWP 적용하여 CO2e로 변환
                const gwp = em.gwp || gwpFactors[em.substance] || 1
                B[i][j] = em.quantity * gwp
            }
        }
    }

    return { B, emissionIndex: allEmissions }
}

/**
 * LCI 계산 실행: g = B · A⁻¹ · f
 * 
 * @param processes 단위 공정 목록
 * @param finalDemand 최종 수요 (기능 단위)
 * @param gwpFactors GWP 계수 목록
 * @returns 환경 배출 결과
 */
export const calculateMatrixLCI = (
    processes: UnitProcess[],
    finalDemand: { productId: string, quantity: number },
    gwpFactors: Record<string, number> = DEFAULT_GWP_FACTORS
): {
    totalGHG: number                    // 총 GHG 배출 (kg CO2e)
    emissionsByProcess: { processId: string, processName: string, emission: number }[]
    emissionsBySubstance: { substance: string, emission: number }[]
    scalingVector: Vector               // 각 공정의 가동 배수
    success: boolean
    error?: string
} => {
    try {
        // 1. Technology Matrix (A) 구축
        const { A, productIndex, processIndex } = buildTechnologyMatrix(processes)

        // 2. Intervention Matrix (B) 구축
        const { B, emissionIndex } = buildInterventionMatrix(processes, gwpFactors)

        // 3. Final Demand Vector (f) 구축
        const n = A.length
        const f: Vector = Array(n).fill(0)
        const demandIdx = productIndex.get(finalDemand.productId)
        if (demandIdx === undefined) {
            return {
                totalGHG: 0,
                emissionsByProcess: [],
                emissionsBySubstance: [],
                scalingVector: [],
                success: false,
                error: `제품 ID "${finalDemand.productId}"를 찾을 수 없습니다`
            }
        }
        f[demandIdx] = finalDemand.quantity

        // 4. A의 역행렬 계산
        const A_inv = invertMatrix(A)
        if (!A_inv) {
            return {
                totalGHG: 0,
                emissionsByProcess: [],
                emissionsBySubstance: [],
                scalingVector: [],
                success: false,
                error: '기술 행렬(A)의 역행렬을 계산할 수 없습니다. 다중 출력 공정에 할당이 필요할 수 있습니다.'
            }
        }

        // 5. Scaling Vector: s = A⁻¹ · f
        const s = matVecMul(A_inv, f)

        // 6. Inventory Result: g = B · s
        const g = matVecMul(B, s)

        // 7. 결과 정리
        const totalGHG = g.reduce((sum, val) => sum + val, 0)

        // 공정별 배출량 (B의 각 열 × s)
        const emissionsByProcess = processes.map((proc, j) => {
            let emission = 0
            for (let i = 0; i < B.length; i++) {
                emission += B[i][j] * s[j]
            }
            return {
                processId: proc.id,
                processName: proc.nameKo || proc.name,
                emission
            }
        })

        // 물질별 배출량
        const emissionsBySubstance: { substance: string, emission: number }[] = []
        for (const [key, idx] of emissionIndex.entries()) {
            emissionsBySubstance.push({
                substance: key.split('_')[0],
                emission: g[idx]
            })
        }

        return {
            totalGHG,
            emissionsByProcess,
            emissionsBySubstance,
            scalingVector: s,
            success: true
        }
    } catch (err) {
        return {
            totalGHG: 0,
            emissionsByProcess: [],
            emissionsBySubstance: [],
            scalingVector: [],
            success: false,
            error: `LCI 계산 오류: ${err instanceof Error ? err.message : String(err)}`
        }
    }
}

// =============================================================================
// 다중 출력 할당 해결기 (Multi-output Allocation Resolver)
// =============================================================================

/**
 * 다중 출력 공정에 할당을 적용하여 단일 출력 공정으로 분해
 * → Technology Matrix를 정방행렬로 변환
 */
export const resolveMultiOutputAllocation = (
    process: UnitProcess,
    method: 'physical_mass' | 'physical_energy' | 'physical_carbon' | 'economic',
    totalProcessEmission: number
): AllocationCalculationResult => {
    const outputs = process.outputs.filter(o => o.type === 'product' || o.type === 'co_product')

    if (outputs.length <= 1) {
        return {
            mainProductEmission: totalProcessEmission,
            coProductEmissions: [],
            allocationShares: [{
                productName: outputs[0]?.name || process.name,
                share: 1,
                basis: '단일 출력',
                basisValue: outputs[0]?.quantity || 1,
                basisUnit: outputs[0]?.unit || 'kg'
            }],
            totalEmissionBeforeAllocation: totalProcessEmission,
            method: 'none',
            methodKo: '할당 불필요 (단일 출력)',
            isoHierarchyLevel: 1,
            justification: '단일 출력 공정으로 할당이 필요하지 않습니다.'
        }
    }

    // 할당 기준값 추출
    let basisValues: number[]
    let basisUnit: string
    let methodName: string
    let methodNameKo: string
    let isoLevel: 1 | 2 | 3

    switch (method) {
        case 'physical_mass':
            basisValues = outputs.map(o => o.mass ?? o.quantity)
            basisUnit = 'kg'
            methodName = 'Physical (Mass)'
            methodNameKo = '물리적 할당 (질량)'
            isoLevel = 2
            break

        case 'physical_energy':
            basisValues = outputs.map(o => o.energyContent ?? 0)
            basisUnit = 'MJ'
            methodName = 'Physical (Energy)'
            methodNameKo = '물리적 할당 (에너지)'
            isoLevel = 2
            break

        case 'physical_carbon':
            basisValues = outputs.map(o => o.carbonContent ?? 0)
            basisUnit = 'kg C'
            methodName = 'Physical (Carbon Content)'
            methodNameKo = '물리적 할당 (탄소 함량)'
            isoLevel = 2
            break

        case 'economic':
            basisValues = outputs.map(o => (o.economicValue ?? 0) * o.quantity)
            basisUnit = '원'
            methodName = 'Economic'
            methodNameKo = '경제적 할당'
            isoLevel = 3
            break

        default:
            basisValues = outputs.map(o => o.quantity)
            basisUnit = outputs[0]?.unit || 'kg'
            methodName = 'Physical (Mass)'
            methodNameKo = '물리적 할당 (질량)'
            isoLevel = 2
    }

    // 할당 비율 계산
    const totalBasis = basisValues.reduce((sum, v) => sum + v, 0)

    if (totalBasis === 0) {
        return {
            mainProductEmission: totalProcessEmission,
            coProductEmissions: [],
            allocationShares: outputs.map(o => ({
                productName: o.name,
                share: 1 / outputs.length,
                basis: methodNameKo,
                basisValue: 0,
                basisUnit
            })),
            totalEmissionBeforeAllocation: totalProcessEmission,
            method: methodName,
            methodKo: methodNameKo,
            isoHierarchyLevel: isoLevel,
            justification: `할당 기준값이 0이므로 균등 분배를 적용합니다.`
        }
    }

    const shares = basisValues.map(v => v / totalBasis)

    // 주제품 = 첫 번째 product 타입 출력물
    const mainIdx = outputs.findIndex(o => o.type === 'product')
    const mainProductIdx = mainIdx >= 0 ? mainIdx : 0

    return {
        mainProductEmission: totalProcessEmission * shares[mainProductIdx],
        coProductEmissions: outputs
            .filter((_, idx) => idx !== mainProductIdx)
            .map((o, idx) => {
                const actualIdx = idx >= mainProductIdx ? idx + 1 : idx
                return {
                    name: o.name,
                    emission: totalProcessEmission * shares[actualIdx],
                    share: shares[actualIdx]
                }
            }),
        allocationShares: outputs.map((o, idx) => ({
            productName: o.name,
            share: shares[idx],
            basis: methodNameKo,
            basisValue: basisValues[idx],
            basisUnit
        })),
        totalEmissionBeforeAllocation: totalProcessEmission,
        method: methodName,
        methodKo: methodNameKo,
        isoHierarchyLevel: isoLevel,
        justification: generateAllocationJustification(methodNameKo, outputs, shares, basisValues, basisUnit)
    }
}

// =============================================================================
// 시스템 확장 (System Expansion) 계산
// =============================================================================

/**
 * 시스템 확장 방법으로 할당 회피
 * 부산물이 대체하는 제품의 배출량을 크레딧으로 차감
 */
export const calculateSystemExpansion = (
    totalProcessEmission: number,
    coProducts: {
        name: string
        quantity: number                   // kg
        substitutedProduct: string         // 대체되는 제품명
        substitutedEmissionFactor: number  // 대체 제품의 배출계수 (kg CO2e/kg)
        qualityFactor: number              // 품질 계수 (0-1, 다운사이클링 시 <1)
    }[]
): SystemExpansionResult => {
    const credits = coProducts.map(cp => ({
        coProductName: cp.name,
        substitutedProduct: cp.substitutedProduct,
        avoidedEmission: cp.quantity * cp.substitutedEmissionFactor,
        qualityFactor: cp.qualityFactor,
        netCredit: cp.quantity * cp.substitutedEmissionFactor * cp.qualityFactor
    }))

    const totalCredit = credits.reduce((sum, c) => sum + c.netCredit, 0)

    return {
        originalEmission: totalProcessEmission,
        substitutionCredits: credits,
        netEmission: totalProcessEmission - totalCredit,
        justification: `시스템 확장법을 적용하여 ${coProducts.length}개 부산물의 대체 크레딧 ` +
            `${totalCredit.toFixed(2)} kg CO₂e를 차감했습니다. ` +
            `원래 배출량 ${totalProcessEmission.toFixed(2)} kg CO₂e → ` +
            `순 배출량 ${(totalProcessEmission - totalCredit).toFixed(2)} kg CO₂e. ` +
            `(ISO 14044 4.3.4.2 시스템 확장 원칙 준수)`
    }
}

// =============================================================================
// 통합 할당 시나리오 비교기 (Integrated Scenario Comparator)
// =============================================================================

/**
 * 여러 할당 방법을 동시에 적용하여 결과를 비교
 * → 민감도 분석 및 최적 방법 추천
 */
export const runIntegratedAllocationScenarios = (
    process: UnitProcess,
    totalProcessEmission: number,
    systemExpansionData?: {
        name: string
        quantity: number
        substitutedProduct: string
        substitutedEmissionFactor: number
        qualityFactor: number
    }[]
): IntegratedAllocationResult => {
    const scenarios: IntegratedAllocationResult['scenarios'] = []

    // 데이터 가용성 체크
    const outputs = process.outputs.filter(o => o.type === 'product' || o.type === 'co_product')
    const hasMassData = outputs.every(o => (o.mass ?? o.quantity) > 0)
    const hasEnergyData = outputs.every(o => (o.energyContent ?? 0) > 0)
    const hasCarbonData = outputs.every(o => (o.carbonContent ?? 0) > 0)
    const hasEconomicData = outputs.every(o => (o.economicValue ?? 0) > 0)

    // 시나리오 1: 질량 기반 물리적 할당
    if (hasMassData) {
        const result = resolveMultiOutputAllocation(process, 'physical_mass', totalProcessEmission)
        scenarios.push({
            method: 'Physical (Mass)',
            methodKo: '물리적 할당 (질량)',
            isoLevel: 2,
            mainProductEmission: result.mainProductEmission,
            allocationShares: result.allocationShares.map(s => ({ name: s.productName, share: s.share })),
            recommended: false,
            confidence: 'high'
        })
    }

    // 시나리오 2: 에너지 기반 물리적 할당
    if (hasEnergyData) {
        const result = resolveMultiOutputAllocation(process, 'physical_energy', totalProcessEmission)
        scenarios.push({
            method: 'Physical (Energy)',
            methodKo: '물리적 할당 (에너지)',
            isoLevel: 2,
            mainProductEmission: result.mainProductEmission,
            allocationShares: result.allocationShares.map(s => ({ name: s.productName, share: s.share })),
            recommended: false,
            confidence: 'high'
        })
    }

    // 시나리오 3: 탄소 함량 기반 물리적 할당
    if (hasCarbonData) {
        const result = resolveMultiOutputAllocation(process, 'physical_carbon', totalProcessEmission)
        scenarios.push({
            method: 'Physical (Carbon)',
            methodKo: '물리적 할당 (탄소 함량)',
            isoLevel: 2,
            mainProductEmission: result.mainProductEmission,
            allocationShares: result.allocationShares.map(s => ({ name: s.productName, share: s.share })),
            recommended: false,
            confidence: 'medium'
        })
    }

    // 시나리오 4: 경제적 할당
    if (hasEconomicData) {
        const result = resolveMultiOutputAllocation(process, 'economic', totalProcessEmission)
        scenarios.push({
            method: 'Economic',
            methodKo: '경제적 할당',
            isoLevel: 3,
            mainProductEmission: result.mainProductEmission,
            allocationShares: result.allocationShares.map(s => ({ name: s.productName, share: s.share })),
            recommended: false,
            confidence: 'low'  // 가격 변동성
        })
    }

    // 시나리오 5: 시스템 확장
    if (systemExpansionData && systemExpansionData.length > 0) {
        const result = calculateSystemExpansion(totalProcessEmission, systemExpansionData)
        scenarios.push({
            method: 'System Expansion',
            methodKo: '시스템 확장 (대체)',
            isoLevel: 1,
            mainProductEmission: result.netEmission,
            allocationShares: [
                { name: outputs[0]?.name || '주제품', share: 1 },
                ...systemExpansionData.map(d => ({
                    name: d.name,
                    share: 0  // 크레딧으로 처리
                }))
            ],
            recommended: false,
            confidence: 'medium'
        })
    }

    if (scenarios.length === 0) {
        return {
            scenarios: [],
            recommendedScenario: 'none',
            sensitivityRange: { min: totalProcessEmission, max: totalProcessEmission, rangePercent: 0 },
            justification: '할당이 필요하지 않거나 데이터가 부족합니다.',
            justificationKo: '할당이 필요하지 않거나 데이터가 부족합니다.'
        }
    }

    // 추천 결정 (ISO 위계 우선, 동일 위계 내에서는 신뢰도 우선)
    const sorted = [...scenarios].sort((a, b) => {
        if (a.isoLevel !== b.isoLevel) return a.isoLevel - b.isoLevel
        const confOrder = { high: 0, medium: 1, low: 2 }
        return confOrder[a.confidence] - confOrder[b.confidence]
    })
    sorted[0].recommended = true

    // 원본 scenarios 배열에서도 추천 마크
    const recIdx = scenarios.findIndex(s => s.method === sorted[0].method)
    if (recIdx >= 0) scenarios[recIdx].recommended = true

    // 민감도 분석
    const emissions = scenarios.map(s => s.mainProductEmission)
    const minEmission = Math.min(...emissions)
    const maxEmission = Math.max(...emissions)
    const avgEmission = emissions.reduce((sum, v) => sum + v, 0) / emissions.length

    const rangePercent = avgEmission > 0
        ? ((maxEmission - minEmission) / avgEmission) * 100
        : 0

    return {
        scenarios,
        recommendedScenario: sorted[0].method,
        sensitivityRange: {
            min: minEmission,
            max: maxEmission,
            rangePercent
        },
        justification: `Recommended: ${sorted[0].method} (ISO hierarchy level ${sorted[0].isoLevel}). ` +
            `Sensitivity range: ${rangePercent.toFixed(1)}% across ${scenarios.length} methods.`,
        justificationKo: `추천: ${sorted[0].methodKo} (ISO 위계 ${sorted[0].isoLevel}단계). ` +
            `${scenarios.length}개 방법 간 민감도 범위: ${rangePercent.toFixed(1)}%. ` +
            `최소 ${minEmission.toFixed(2)} ~ 최대 ${maxEmission.toFixed(2)} kg CO₂e.`
    }
}

// =============================================================================
// GWP 기본 계수 (IPCC AR6)
// =============================================================================

const DEFAULT_GWP_FACTORS: Record<string, number> = {
    'CO2': 1,
    'CH4': 27.9,      // IPCC AR6 GWP100 (fossil)
    'N2O': 273,
    'SF6': 25200,
    'HFC-134a': 1526,
    'CF4': 7380,
    'C2F6': 12400,
    'NF3': 17400
}

// =============================================================================
// 정당화 문구 생성
// =============================================================================

const generateAllocationJustification = (
    methodKo: string,
    outputs: ProcessFlow[],
    shares: number[],
    basisValues: number[],
    basisUnit: string
): string => {
    const productNames = outputs.map(o => o.name).join(', ')
    const shareTexts = outputs.map((o, i) =>
        `${o.name}: ${(shares[i] * 100).toFixed(1)}% (${basisValues[i].toFixed(2)} ${basisUnit})`
    ).join(', ')

    return `본 공정은 ${outputs.length}개의 산출물(${productNames})을 생산하는 다중 출력 공정입니다. ` +
        `ISO 14044:2006 4.3.4절 및 ISO 14067:2018 6.4.6절의 할당 위계에 따라 ` +
        `${methodKo}을 적용하였습니다. ` +
        `할당 비율: ${shareTexts}. ` +
        `이 방법은 공정의 물리적/경제적 인과관계를 반영하며, ` +
        `결과의 재현성과 투명성을 보장합니다.`
}
