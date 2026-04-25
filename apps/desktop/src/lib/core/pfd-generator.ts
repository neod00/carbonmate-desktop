/**
 * 공정 흐름도(PFD) 시각화 엔진
 * 
 * 목적: 제품 시스템의 물질·에너지 흐름을 시각적으로 표현
 * - 검증 시 필수 제출 문서 (ISO 14044:2006 4.2.3.3)
 * - ISO 14067:2018 7.3 d) — 단위 공정 목록 및 연결 시각화
 * 
 * 데이터 소스:
 * - `store.ts`의 PCFState (SimplifiedActivityData + DetailedActivityData)
 * - 시스템 경계 타입 (Cradle-to-Gate, Gate-to-Gate 등)
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-14
 */

import type {
    BoundaryType,
    SimplifiedActivityData,
    StageActivityData,
    ProductInfo
} from './store'

// =============================================================================
// 타입 정의
// =============================================================================

export type PFDNodeType =
    | 'raw_material'       // 원료 투입
    | 'energy'             // 에너지 투입
    | 'process'            // 단위 공정
    | 'product'            // 제품 산출
    | 'co_product'         // 부산물
    | 'emission'           // 환경 배출
    | 'waste'              // 폐기물
    | 'transport'          // 운송
    | 'packaging'          // 포장
    | 'use_phase'          // 사용 단계
    | 'eol'                // 폐기 단계
    | 'boundary'           // 시스템 경계 표시

export type PFDEdgeType =
    | 'material_flow'      // 물질 흐름
    | 'energy_flow'        // 에너지 흐름
    | 'emission_flow'      // 배출 흐름
    | 'transport_flow'     // 운송 흐름
    | 'waste_flow'         // 폐기물 흐름
    | 'recycle_flow'       // 재활용 흐름

export interface PFDNode {
    id: string
    type: PFDNodeType
    label: string
    labelKo: string
    value?: number         // 수량
    unit?: string          // 단위
    stage?: string         // 생애주기 단계
    metadata?: Record<string, string | number>
}

export interface PFDEdge {
    id: string
    from: string
    to: string
    type: PFDEdgeType
    label?: string
    value?: number
    unit?: string
}

/**
 * 전체 PFD 그래프
 */
export interface PFDGraph {
    nodes: PFDNode[]
    edges: PFDEdge[]
    boundary: BoundaryType
    productName: string
    functionalUnit: string
    // 렌더링 데이터
    mermaidCode: string
    sankeyData: SankeyData
    // 메타 정보
    stageGroups: { stage: string; stageKo: string; nodeIds: string[] }[]
    totalInputs: number
    totalOutputs: number
    totalEmissions: number
}

/**
 * Sankey 다이어그램 데이터
 */
export interface SankeyData {
    nodes: { name: string; color: string }[]
    links: { source: number; target: number; value: number; color?: string }[]
}

// =============================================================================
// 스테이지 라벨
// =============================================================================

const STAGE_INFO: Record<string, { ko: string; en: string; color: string }> = {
    'raw_materials': { ko: '원료 채취', en: 'Raw Materials', color: '#10b981' },
    'manufacturing': { ko: '제조', en: 'Manufacturing', color: '#3b82f6' },
    'transport': { ko: '운송', en: 'Transport', color: '#f59e0b' },
    'packaging': { ko: '포장', en: 'Packaging', color: '#8b5cf6' },
    'use': { ko: '사용', en: 'Use Phase', color: '#06b6d4' },
    'eol': { ko: '폐기', en: 'End of Life', color: '#ef4444' }
}

const NODE_COLORS: Record<PFDNodeType, string> = {
    'raw_material': '#10b981',
    'energy': '#f59e0b',
    'process': '#3b82f6',
    'product': '#6366f1',
    'co_product': '#8b5cf6',
    'emission': '#ef4444',
    'waste': '#6b7280',
    'transport': '#f97316',
    'packaging': '#a855f7',
    'use_phase': '#06b6d4',
    'eol': '#dc2626',
    'boundary': '#d1d5db'
}

// =============================================================================
// 핵심 함수: PFD 그래프 생성
// =============================================================================

/**
 * Store 데이터에서 PFD 그래프 자동 생성
 */
export const generatePFD = (
    productInfo: ProductInfo,
    activityData: SimplifiedActivityData,
    stages: string[],
    detailedData?: Partial<StageActivityData>
): PFDGraph => {
    const nodes: PFDNode[] = []
    const edges: PFDEdge[] = []
    const stageGroups: PFDGraph['stageGroups'] = []

    // 제품 노드 (최종 산출물)
    const productNodeId = 'product_final'
    nodes.push({
        id: productNodeId,
        type: 'product',
        label: productInfo.name || 'Product',
        labelKo: productInfo.name || '제품',
        value: 1,
        unit: productInfo.unit || 'unit'
    })

    // === 원료 채취 단계 ===
    if (stages.includes('raw_materials')) {
        const stageNodeIds: string[] = []
        const processId = 'proc_raw_materials'

        nodes.push({
            id: processId,
            type: 'process',
            label: 'Raw Material Processing',
            labelKo: '원료 가공',
            stage: 'raw_materials'
        })
        stageNodeIds.push(processId)

        if (activityData.raw_material_weight) {
            const matId = 'input_raw_mat'
            nodes.push({
                id: matId,
                type: 'raw_material',
                label: activityData.raw_material_type || 'Raw Material',
                labelKo: activityData.raw_material_type || '원자재',
                value: activityData.raw_material_weight,
                unit: 'kg',
                stage: 'raw_materials'
            })
            edges.push({
                id: `e_${matId}_${processId}`,
                from: matId, to: processId,
                type: 'material_flow',
                label: `${activityData.raw_material_weight} kg`,
                value: activityData.raw_material_weight,
                unit: 'kg'
            })
            stageNodeIds.push(matId)
        }

        // 상세 데이터가 있는 경우
        if (detailedData?.raw_materials) {
            detailedData.raw_materials.forEach((mat, i) => {
                const matId = `input_mat_${i}`
                nodes.push({
                    id: matId,
                    type: 'raw_material',
                    label: mat.name,
                    labelKo: mat.name,
                    value: mat.quantity,
                    unit: mat.unit,
                    stage: 'raw_materials'
                })
                edges.push({
                    id: `e_${matId}_${processId}`,
                    from: matId, to: processId,
                    type: 'material_flow',
                    label: `${mat.quantity} ${mat.unit}`,
                    value: mat.quantity,
                    unit: mat.unit
                })
                stageNodeIds.push(matId)
            })
        }

        edges.push({
            id: `e_${processId}_mfg`,
            from: processId, to: 'proc_manufacturing',
            type: 'material_flow',
            label: '중간재'
        })

        stageGroups.push({ stage: 'raw_materials', stageKo: '원료 채취', nodeIds: stageNodeIds })
    }

    // === 제조 단계 ===
    if (stages.includes('manufacturing')) {
        const stageNodeIds: string[] = []
        const processId = 'proc_manufacturing'

        nodes.push({
            id: processId,
            type: 'process',
            label: 'Manufacturing',
            labelKo: '제조 공정',
            stage: 'manufacturing'
        })
        stageNodeIds.push(processId)

        // 전력 투입
        if (activityData.electricity) {
            const elecId = 'input_electricity'
            nodes.push({
                id: elecId,
                type: 'energy',
                label: `Electricity (${activityData.electricity_grid || 'Grid'})`,
                labelKo: `전력 (${activityData.electricity_grid || '계통전력'})`,
                value: activityData.electricity,
                unit: 'kWh',
                stage: 'manufacturing'
            })
            edges.push({
                id: `e_${elecId}_${processId}`,
                from: elecId, to: processId,
                type: 'energy_flow',
                label: `${activityData.electricity} kWh`,
                value: activityData.electricity,
                unit: 'kWh'
            })
            stageNodeIds.push(elecId)
        }

        // 가스 투입
        if (activityData.gas) {
            const gasId = 'input_gas'
            nodes.push({
                id: gasId,
                type: 'energy',
                label: 'Natural Gas',
                labelKo: '천연가스',
                value: activityData.gas,
                unit: 'Nm³',
                stage: 'manufacturing'
            })
            edges.push({
                id: `e_${gasId}_${processId}`,
                from: gasId, to: processId,
                type: 'energy_flow',
                label: `${activityData.gas} Nm³`,
                value: activityData.gas,
                unit: 'Nm³'
            })
            stageNodeIds.push(gasId)
        }

        // 디젤 투입
        if (activityData.diesel) {
            const dieselId = 'input_diesel'
            nodes.push({
                id: dieselId,
                type: 'energy',
                label: 'Diesel',
                labelKo: '경유',
                value: activityData.diesel,
                unit: 'L',
                stage: 'manufacturing'
            })
            edges.push({
                id: `e_${dieselId}_${processId}`,
                from: dieselId, to: processId,
                type: 'energy_flow',
                label: `${activityData.diesel} L`,
                value: activityData.diesel,
                unit: 'L'
            })
            stageNodeIds.push(dieselId)
        }

        // 대기 배출 노드
        const emissionId = 'emission_co2'
        nodes.push({
            id: emissionId,
            type: 'emission',
            label: 'CO₂ Emissions',
            labelKo: 'CO₂ 배출',
            stage: 'manufacturing'
        })
        edges.push({
            id: `e_${processId}_${emissionId}`,
            from: processId, to: emissionId,
            type: 'emission_flow',
            label: 'GHG'
        })
        stageNodeIds.push(emissionId)

        // 제조 → 포장 또는 제품
        if (stages.includes('packaging')) {
            edges.push({
                id: `e_mfg_pkg`,
                from: processId, to: 'proc_packaging',
                type: 'material_flow',
                label: '반제품'
            })
        } else {
            edges.push({
                id: `e_mfg_product`,
                from: processId, to: productNodeId,
                type: 'material_flow',
                label: productInfo.name || '제품'
            })
        }

        stageGroups.push({ stage: 'manufacturing', stageKo: '제조', nodeIds: stageNodeIds })
    }

    // === 포장 단계 ===
    if (stages.includes('packaging') && activityData.packaging_weight) {
        const stageNodeIds: string[] = []
        const processId = 'proc_packaging'

        nodes.push({
            id: processId,
            type: 'process',
            label: 'Packaging',
            labelKo: '포장',
            stage: 'packaging'
        })

        const pkgMatId = 'input_packaging'
        nodes.push({
            id: pkgMatId,
            type: 'packaging',
            label: activityData.packaging_material || 'Packaging Material',
            labelKo: activityData.packaging_material || '포장재',
            value: activityData.packaging_weight,
            unit: 'kg',
            stage: 'packaging'
        })
        edges.push({
            id: `e_${pkgMatId}_${processId}`,
            from: pkgMatId, to: processId,
            type: 'material_flow',
            label: `${activityData.packaging_weight} kg`,
            value: activityData.packaging_weight,
            unit: 'kg'
        })
        edges.push({
            id: `e_pkg_product`,
            from: processId, to: productNodeId,
            type: 'material_flow',
            label: '포장 완제품'
        })

        stageNodeIds.push(processId, pkgMatId)
        stageGroups.push({ stage: 'packaging', stageKo: '포장', nodeIds: stageNodeIds })
    }

    // === 운송 단계 ===
    if (stages.includes('transport') && activityData.transport_distance) {
        const stageNodeIds: string[] = []
        const transportId = 'proc_transport'
        const modeLabels: Record<string, string> = {
            'truck': '트럭', 'rail': '철도', 'ship': '해운', 'aircraft': '항공'
        }

        nodes.push({
            id: transportId,
            type: 'transport',
            label: `Transport (${activityData.transport_mode || 'Truck'})`,
            labelKo: `운송 (${modeLabels[activityData.transport_mode || 'truck'] || '트럭'})`,
            value: activityData.transport_distance,
            unit: 'km',
            stage: 'transport'
        })
        stageNodeIds.push(transportId)

        // 항공 운송 별도 (ISO 14067 7.2(e))
        if (activityData.aircraft_transport_distance) {
            const airId = 'proc_air_transport'
            nodes.push({
                id: airId,
                type: 'transport',
                label: 'Air Transport ⚠️',
                labelKo: '항공 운송 ⚠️ (분리보고)',
                value: activityData.aircraft_transport_distance,
                unit: 'km',
                stage: 'transport',
                metadata: { iso_note: 'ISO 14067 7.2(e) 분리 보고 필수' }
            })
            stageNodeIds.push(airId)
        }

        stageGroups.push({ stage: 'transport', stageKo: '운송', nodeIds: stageNodeIds })
    }

    // === 사용 단계 ===
    if (stages.includes('use') && activityData.use_electricity) {
        const stageNodeIds: string[] = []
        const useId = 'proc_use'

        nodes.push({
            id: useId,
            type: 'use_phase',
            label: `Use Phase (${activityData.use_years || 1} years)`,
            labelKo: `사용 단계 (${activityData.use_years || 1}년)`,
            stage: 'use'
        })

        const useElecId = 'input_use_elec'
        nodes.push({
            id: useElecId,
            type: 'energy',
            label: 'Electricity (Use)',
            labelKo: '사용 전력',
            value: activityData.use_electricity,
            unit: 'kWh',
            stage: 'use'
        })
        edges.push({
            id: `e_${useElecId}_${useId}`,
            from: useElecId, to: useId,
            type: 'energy_flow',
            label: `${activityData.use_electricity} kWh`,
            value: activityData.use_electricity,
            unit: 'kWh'
        })

        stageNodeIds.push(useId, useElecId)
        stageGroups.push({ stage: 'use', stageKo: '사용', nodeIds: stageNodeIds })
    }

    // === 폐기 단계 ===
    if (stages.includes('eol') && activityData.waste_weight) {
        const stageNodeIds: string[] = []
        const eolId = 'proc_eol'

        nodes.push({
            id: eolId,
            type: 'eol',
            label: 'End of Life',
            labelKo: '폐기/재활용',
            stage: 'eol'
        })

        if (activityData.recycling_rate && activityData.recycling_rate > 0) {
            const recycleId = 'output_recycle'
            nodes.push({
                id: recycleId,
                type: 'raw_material',
                label: 'Recycled Material',
                labelKo: '재활용 소재',
                value: activityData.waste_weight * (activityData.recycling_rate / 100),
                unit: 'kg',
                stage: 'eol'
            })
            edges.push({
                id: `e_${eolId}_${recycleId}`,
                from: eolId, to: recycleId,
                type: 'recycle_flow',
                label: `${activityData.recycling_rate}% 재활용`,
                value: activityData.waste_weight * (activityData.recycling_rate / 100),
                unit: 'kg'
            })
            stageNodeIds.push(recycleId)
        }

        const wasteId = 'output_waste'
        const wasteAmount = activityData.waste_weight * (1 - (activityData.recycling_rate || 0) / 100)
        nodes.push({
            id: wasteId,
            type: 'waste',
            label: 'Waste',
            labelKo: '폐기물',
            value: wasteAmount,
            unit: 'kg',
            stage: 'eol'
        })
        edges.push({
            id: `e_${eolId}_${wasteId}`,
            from: eolId, to: wasteId,
            type: 'waste_flow',
            label: `${wasteAmount.toFixed(1)} kg`,
            value: wasteAmount,
            unit: 'kg'
        })

        stageNodeIds.push(eolId, wasteId)
        stageGroups.push({ stage: 'eol', stageKo: '폐기/재활용', nodeIds: stageNodeIds })
    }

    // 통계
    const totalInputs = nodes.filter(n => n.type === 'raw_material' || n.type === 'energy' || n.type === 'packaging').length
    const totalOutputs = nodes.filter(n => n.type === 'product' || n.type === 'co_product').length
    const totalEmissions = nodes.filter(n => n.type === 'emission' || n.type === 'waste').length

    // Mermaid / Sankey 생성
    const mermaidCode = generateMermaidPFD(nodes, edges, stageGroups, productInfo.boundary)
    const sankeyData = generateSankeyData(nodes, edges)

    return {
        nodes, edges, boundary: productInfo.boundary,
        productName: productInfo.name,
        functionalUnit: productInfo.unit,
        mermaidCode, sankeyData, stageGroups,
        totalInputs, totalOutputs, totalEmissions
    }
}

// =============================================================================
// Mermaid 코드 생성
// =============================================================================

function generateMermaidPFD(
    nodes: PFDNode[], edges: PFDEdge[],
    stageGroups: PFDGraph['stageGroups'],
    boundary: BoundaryType
): string {
    let code = 'flowchart LR\n\n'

    // 시스템 경계 표시
    const boundaryLabel = {
        'cradle-to-gate': 'Cradle-to-Gate',
        'cradle-to-grave': 'Cradle-to-Grave',
        'gate-to-gate': 'Gate-to-Gate'
    }[boundary] || boundary

    code += `    %% System Boundary: ${boundaryLabel}\n\n`

    // 스테이지별 서브그래프
    stageGroups.forEach(sg => {
        const info = STAGE_INFO[sg.stage]
        code += `    subgraph SG_${sg.stage}["${info?.ko || sg.stageKo}"]\n`

        const stageNodes = nodes.filter(n => sg.nodeIds.includes(n.id))
        stageNodes.forEach(node => {
            code += `        ${node.id}${getMermaidShape(node)}\n`
        })
        code += '    end\n\n'
    })

    // 서브그래프에 속하지 않은 노드
    const groupedIds = new Set(stageGroups.flatMap(sg => sg.nodeIds))
    const ungrouped = nodes.filter(n => !groupedIds.has(n.id))
    ungrouped.forEach(node => {
        code += `    ${node.id}${getMermaidShape(node)}\n`
    })

    code += '\n'

    // 엣지
    edges.forEach(edge => {
        const style = getEdgeStyle(edge.type)
        const label = edge.label ? `|"${edge.label}"|` : ''
        code += `    ${edge.from} ${style}${label} ${edge.to}\n`
    })

    // 노드 스타일
    code += '\n'
    const typeGroups = new Map<PFDNodeType, string[]>()
    nodes.forEach(n => {
        const ids = typeGroups.get(n.type) || []
        ids.push(n.id)
        typeGroups.set(n.type, ids)
    })

    typeGroups.forEach((ids, type) => {
        const color = NODE_COLORS[type]
        if (ids.length > 0 && color) {
            ids.forEach(id => {
                code += `    style ${id} fill:${color},color:#fff,stroke:${color}\n`
            })
        }
    })

    return code
}

function getMermaidShape(node: PFDNode): string {
    const label = node.value && node.unit
        ? `${node.labelKo}\\n${node.value} ${node.unit}`
        : node.labelKo

    switch (node.type) {
        case 'process':
            return `[["${label}"]]`              // stadium shape
        case 'raw_material':
            return `[/"${label}"/]`               // parallelogram
        case 'energy':
            return `{{"${label}"}}`               // hexagon
        case 'product':
        case 'co_product':
            return `[["${label}"]]`               // double bracket
        case 'emission':
            return `(("${label}"))`               // circle
        case 'waste':
            return `>"${label}"]`                 // flag
        case 'transport':
            return `["${label}"]`                 // rectangle
        case 'packaging':
            return `["${label}"]`
        case 'use_phase':
            return `["${label}"]`
        case 'eol':
            return `["${label}"]`
        default:
            return `["${label}"]`
    }
}

function getEdgeStyle(type: PFDEdgeType): string {
    switch (type) {
        case 'material_flow': return '==>'       // thick arrow
        case 'energy_flow': return '-.->'        // dotted arrow
        case 'emission_flow': return '-->'       // normal arrow
        case 'transport_flow': return '--->'     // longer arrow
        case 'waste_flow': return '-.->'         // dotted
        case 'recycle_flow': return '==>'        // thick (circular)
        default: return '-->'
    }
}

// =============================================================================
// Sankey 다이어그램 데이터 생성
// =============================================================================

function generateSankeyData(nodes: PFDNode[], edges: PFDEdge[]): SankeyData {
    const nodeNames = nodes.map(n => ({
        name: n.labelKo,
        color: NODE_COLORS[n.type] || '#6b7280'
    }))

    const nodeIndexMap = new Map<string, number>()
    nodes.forEach((n, i) => nodeIndexMap.set(n.id, i))

    const links = edges
        .filter(e => nodeIndexMap.has(e.from) && nodeIndexMap.has(e.to))
        .map(e => ({
            source: nodeIndexMap.get(e.from)!,
            target: nodeIndexMap.get(e.to)!,
            value: e.value || 1,
            color: undefined as string | undefined
        }))

    return { nodes: nodeNames, links }
}

// =============================================================================
// ISO 14067 시스템 경계 포함 단계 확인
// =============================================================================

export const BOUNDARY_STAGES: Record<BoundaryType, string[]> = {
    'cradle-to-gate': ['raw_materials', 'manufacturing', 'transport'],
    'cradle-to-grave': ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol'],
    'gate-to-gate': ['manufacturing']
}

/**
 * 시스템 경계에 포함되는 단계 조회
 */
export const getIncludedStages = (boundary: BoundaryType): string[] => {
    return BOUNDARY_STAGES[boundary] || BOUNDARY_STAGES['cradle-to-gate']
}

/**
 * PFD 요약 통계
 */
export const getPFDSummary = (pfd: PFDGraph): {
    inputCount: number
    processCount: number
    outputCount: number
    emissionCount: number
    edgeCount: number
    stages: string[]
    summaryKo: string
} => {
    const inputCount = pfd.nodes.filter(n => ['raw_material', 'energy', 'packaging'].includes(n.type)).length
    const processCount = pfd.nodes.filter(n => n.type === 'process').length
    const outputCount = pfd.nodes.filter(n => ['product', 'co_product'].includes(n.type)).length
    const emissionCount = pfd.nodes.filter(n => ['emission', 'waste'].includes(n.type)).length
    const stages = pfd.stageGroups.map(sg => sg.stageKo)

    const summaryKo = [
        `공정 흐름도: ${pfd.productName}`,
        `시스템 경계: ${pfd.boundary}`,
        `포함 단계: ${stages.join(', ')}`,
        `투입: ${inputCount}개 | 공정: ${processCount}개 | 산출: ${outputCount}개 | 배출: ${emissionCount}개`,
        `총 흐름: ${pfd.edges.length}개`
    ].join('\n')

    return { inputCount, processCount, outputCount, emissionCount, edgeCount: pfd.edges.length, stages, summaryKo }
}
