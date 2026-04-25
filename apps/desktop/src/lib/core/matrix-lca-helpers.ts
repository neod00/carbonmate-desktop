/**
 * Matrix LCA 엔진 GUI 헬퍼
 * 
 * 목적: 기존 `matrix-lci-engine.ts`(848줄)의 강력한 매트릭스 LCI 엔진을
 *       UI에서 쉽게 사용할 수 있도록 래퍼 함수들을 제공
 * 
 * 핵심 기능:
 * 1. 단위 공정(Unit Process) CRUD 관리
 * 2. Technology Matrix / Intervention Matrix 시각화 데이터 생성
 * 3. 빈 공정/흐름 템플릿 생성
 * 4. 계산 결과를 UI 친화적 포맷으로 변환
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-14
 */

import {
    UnitProcess,
    ProcessFlow,
    EmissionFlow,
    calculateMatrixLCI,
    buildTechnologyMatrix,
    buildInterventionMatrix,
    resolveMultiOutputAllocation,
    calculateSystemExpansion,
    runIntegratedAllocationScenarios
} from '../allocation/matrix-lci-engine'

// Matrix / Vector are internal types in the engine, redefined here
type Matrix = number[][]
type Vector = number[]

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 매트릭스 시각화 데이터
 */
export interface MatrixView {
    rowLabels: string[]
    colLabels: string[]
    data: number[][]
    type: 'technology' | 'intervention' | 'inverse'
}

/**
 * 공정 네트워크 시각화 데이터 (Mermaid 등에 사용)
 */
export interface ProcessNetwork {
    nodes: { id: string; label: string; type: 'process' | 'product' | 'emission' }[]
    edges: { from: string; to: string; label: string; value: number }[]
    mermaidCode: string
}

/**
 * 계산 결과 UI 포맷
 */
export interface MatrixLCAUIResult {
    success: boolean
    error?: string
    // 총 배출
    totalGWP: number
    totalGWPUnit: string
    // 공정별 기여
    processContributions: {
        processId: string
        processName: string
        scalingFactor: number
        emission: number
        share: number
    }[]
    // 물질별 배출
    substanceEmissions: {
        substance: string
        emission: number
        share: number
    }[]
    // 매트릭스 뷰
    technologyMatrix: MatrixView
    interventionMatrix: MatrixView
    // 네트워크 뷰
    processNetwork: ProcessNetwork
}

// =============================================================================
// 팩토리 함수 (빈 데이터 생성)
// =============================================================================

/**
 * 빈 단위 공정 생성
 */
export const createEmptyProcess = (index: number): UnitProcess => ({
    id: `process_${Date.now()}_${index}`,
    name: `Process ${index + 1}`,
    nameKo: `공정 ${index + 1}`,
    inputs: [],
    outputs: [{
        id: `flow_out_${Date.now()}`,
        name: `Product ${index + 1}`,
        quantity: 1,
        unit: 'kg',
        type: 'product'
    }],
    emissions: [{
        substance: 'CO2',
        compartment: 'air',
        quantity: 0,
        gwp: 1
    }],
    dataQuality: 'primary'
})

/**
 * 빈 공정 흐름 생성
 */
export const createEmptyFlow = (type: ProcessFlow['type'] = 'product', name?: string): ProcessFlow => ({
    id: `flow_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name || '',
    quantity: 0,
    unit: 'kg',
    type
})

/**
 * 빈 배출 흐름 생성
 */
export const createEmptyEmission = (): EmissionFlow => ({
    substance: 'CO2',
    compartment: 'air',
    quantity: 0,
    gwp: 1
})

// 기본 GWP 계수 (IPCC AR6)
const DEFAULT_GWP: Record<string, number> = {
    'CO2': 1,
    'CH4': 29.8,
    'N2O': 273,
    'HFC-134a': 1530,
    'SF6': 25200,
    'CF4': 7380
}

// =============================================================================
// 핵심 함수
// =============================================================================

/**
 * 매트릭스 LCA 전체 계산 실행 (UI 친화적 래퍼)
 */
export const runMatrixLCA = (
    processes: UnitProcess[],
    finalDemandMap: Record<string, number>,
    gwpFactors?: Record<string, number>
): MatrixLCAUIResult => {
    if (processes.length === 0) {
        return createEmptyResult('공정을 추가해 주세요.')
    }

    const gwp = gwpFactors || DEFAULT_GWP

    // finalDemandMap의 첫 번째 항목을 사용 (엔진은 단일 제품 수요를 받음)
    const entries = Object.entries(finalDemandMap)
    if (entries.length === 0) {
        return createEmptyResult('최종 수요를 지정해 주세요.')
    }
    const [productId, quantity] = entries[0]

    // 기술행렬, 환경행렬 빌드 (시각화용)
    const { A, productIndex, processIndex } = buildTechnologyMatrix(processes)
    const { B, emissionIndex } = buildInterventionMatrix(processes, gwp)

    // LCI 계산 (엔진 API: { productId, quantity })
    const result = calculateMatrixLCI(processes, { productId, quantity }, gwp)

    if (!result.success) {
        return createEmptyResult(result.error || '계산 실패')
    }

    // 공정별 기여 계산 (엔진 결과 활용)
    const totalGHG = result.totalGHG
    const processContributions = result.emissionsByProcess.map((ep) => ({
        processId: ep.processId,
        processName: ep.processName,
        scalingFactor: 0,
        emission: ep.emission,
        share: totalGHG > 0 ? (ep.emission / totalGHG) * 100 : 0
    }))

    // 스케일링 벡터에서 factor 업데이트
    processContributions.forEach((pc, idx) => {
        pc.scalingFactor = result.scalingVector[idx] || 0
    })

    // 물질별 배출
    const substanceEmissions = result.emissionsBySubstance.map(e => ({
        substance: e.substance,
        emission: e.emission,
        share: totalGHG > 0 ? (e.emission / totalGHG) * 100 : 0
    }))

    // 매트릭스 뷰 생성
    const technologyMatrix = createMatrixView(A, productIndex, processIndex, 'technology')
    const interventionMatrix = createMatrixView(B, emissionIndex, processIndex, 'intervention')

    // 네트워크 뷰 생성
    const processNetwork = createProcessNetwork(processes)

    return {
        success: true,
        totalGWP: totalGHG,
        totalGWPUnit: 'kgCO2e',
        processContributions,
        substanceEmissions,
        technologyMatrix,
        interventionMatrix,
        processNetwork
    }
}

/**
 * 다중 출력 할당 시나리오 비교 실행 (UI 래퍼)
 */
export const runAllocationComparison = (
    process: UnitProcess,
    totalEmission: number,
    systemExpansionData?: {
        name: string
        quantity: number
        substitutedProduct: string
        substitutedEmissionFactor: number
        qualityFactor: number
    }[]
) => {
    return runIntegratedAllocationScenarios(process, totalEmission, systemExpansionData)
}

// =============================================================================
// 내부 유틸리티
// =============================================================================

function createMatrixView(
    matrix: Matrix,
    rowIndex: Map<string, number>,
    colIndex: Map<string, number>,
    type: MatrixView['type']
): MatrixView {
    const rowLabels = Array.from(rowIndex.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([name]) => name)

    const colLabels = Array.from(colIndex.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([name]) => name)

    return { rowLabels, colLabels, data: matrix, type }
}

function createProcessNetwork(processes: UnitProcess[]): ProcessNetwork {
    const nodes: ProcessNetwork['nodes'] = []
    const edges: ProcessNetwork['edges'] = []
    const productNodes = new Set<string>()

    // 공정 노드
    processes.forEach(proc => {
        nodes.push({
            id: proc.id,
            label: proc.nameKo || proc.name,
            type: 'process'
        })

        // 출력 제품 노드 + 엣지
        proc.outputs.forEach(out => {
            const productId = `product_${out.name}`
            if (!productNodes.has(productId)) {
                productNodes.add(productId)
                nodes.push({ id: productId, label: out.name, type: 'product' })
            }
            edges.push({
                from: proc.id,
                to: productId,
                label: `${out.quantity} ${out.unit}`,
                value: out.quantity
            })
        })

        // 입력 흐름
        proc.inputs.forEach(inp => {
            if (inp.linkedProcessId) {
                edges.push({
                    from: inp.linkedProcessId,
                    to: proc.id,
                    label: `${inp.name}: ${inp.quantity} ${inp.unit}`,
                    value: inp.quantity
                })
            } else {
                const inputId = `input_${inp.name}`
                if (!productNodes.has(inputId)) {
                    productNodes.add(inputId)
                    nodes.push({ id: inputId, label: inp.name, type: 'product' })
                }
                edges.push({
                    from: inputId,
                    to: proc.id,
                    label: `${inp.quantity} ${inp.unit}`,
                    value: inp.quantity
                })
            }
        })

        // 배출
        proc.emissions.forEach(em => {
            const emId = `emission_${em.substance}_${em.compartment}`
            if (!productNodes.has(emId)) {
                productNodes.add(emId)
                nodes.push({ id: emId, label: `${em.substance} (${em.compartment})`, type: 'emission' })
            }
            edges.push({
                from: proc.id,
                to: emId,
                label: `${em.quantity} kg`,
                value: em.quantity
            })
        })
    })

    // Mermaid 코드 생성
    const mermaidCode = generateMermaid(nodes, edges)

    return { nodes, edges, mermaidCode }
}

function generateMermaid(nodes: ProcessNetwork['nodes'], edges: ProcessNetwork['edges']): string {
    let code = 'flowchart LR\n'

    nodes.forEach(node => {
        const shape = node.type === 'process' ? `[["${node.label}"]]`
            : node.type === 'emission' ? `(("${node.label}"))`
                : `["${node.label}"]`
        code += `    ${node.id}${shape}\n`
    })

    code += '\n'

    edges.forEach(edge => {
        code += `    ${edge.from} -->|"${edge.label}"| ${edge.to}\n`
    })

    // 스타일
    const processIds = nodes.filter(n => n.type === 'process').map(n => n.id)
    const emissionIds = nodes.filter(n => n.type === 'emission').map(n => n.id)

    if (processIds.length > 0) {
        code += `\n    style ${processIds.join(',')} fill:#3b82f6,color:#fff\n`
    }
    if (emissionIds.length > 0) {
        code += `    style ${emissionIds.join(',')} fill:#ef4444,color:#fff\n`
    }

    return code
}

function createEmptyResult(error: string): MatrixLCAUIResult {
    return {
        success: false,
        error,
        totalGWP: 0,
        totalGWPUnit: 'kgCO2e',
        processContributions: [],
        substanceEmissions: [],
        technologyMatrix: { rowLabels: [], colLabels: [], data: [], type: 'technology' },
        interventionMatrix: { rowLabels: [], colLabels: [], data: [], type: 'intervention' },
        processNetwork: { nodes: [], edges: [], mermaidCode: '' }
    }
}
