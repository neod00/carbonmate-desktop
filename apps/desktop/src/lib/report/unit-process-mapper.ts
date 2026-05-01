/**
 * P2-8: 중요 단위공정 자동 식별 (ISO 14067 7.3 c)
 * 
 * 활동 데이터 항목을 ISO 표준 단위공정으로 매핑하고,
 * 기여도 기준으로 "중요/비중요" 자동 분류합니다.
 */

import type { PCFState } from '@/lib/core/store'
import type { TotalEmissionResult } from '@/lib/core/emission-calculator'

// ── 단위공정 타입 ──

export interface UnitProcess {
    id: string
    name: string              // 영문 명칭
    nameKo: string            // 한글 명칭
    stageId: string           // 해당 생애주기 단계
    category: 'energy' | 'material' | 'transport' | 'waste' | 'process' | 'packaging'
    emission: number          // kg CO₂e
    contribution: number      // 기여도 (%)
    isSignificant: boolean    // 중요 여부 (기여도 ≥ 5% 또는 cut-off 미만 아닌 경우)
    dataSource: string        // 데이터 출처
    dataQuality: 'primary' | 'secondary' | 'estimated'
}

export interface UnitProcessAnalysis {
    totalCFP: number
    unitProcesses: UnitProcess[]
    significantProcesses: UnitProcess[]
    insignificantProcesses: UnitProcess[]
    significantCoverage: number       // 중요 공정이 차지하는 비율 (%)
    totalProcessCount: number
    significantThreshold: number      // 중요 판별 기준 (%)
}

// ── 활동 데이터 → 단위공정 매핑 ──

const ACTIVITY_TO_PROCESS_MAP: Record<string, { name: string; nameKo: string; category: UnitProcess['category'] }> = {
    // 원료
    raw_material_weight: { name: 'Raw Material Production', nameKo: '주원료 생산', category: 'material' },
    // 제조
    electricity: { name: 'Grid Electricity', nameKo: '전력 소비 (그리드)', category: 'energy' },
    gas: { name: 'Natural Gas Combustion', nameKo: '천연가스 연소', category: 'energy' },
    diesel: { name: 'Diesel Combustion', nameKo: '경유 연소', category: 'energy' },
    // 운송
    transport_distance: { name: 'Road Transport', nameKo: '도로 운송', category: 'transport' },
    aircraft_transport_distance: { name: 'Air Transport', nameKo: '항공 운송', category: 'transport' },
    // 포장
    packaging_weight: { name: 'Packaging Material', nameKo: '포장재 생산', category: 'packaging' },
    // 사용
    use_electricity: { name: 'Use Phase Electricity', nameKo: '사용 단계 전력', category: 'energy' },
    // 폐기
    waste_weight: { name: 'End-of-Life Treatment', nameKo: '폐기물 처리', category: 'waste' },
}

const STAGE_MAP: Record<string, string> = {
    raw_material_weight: 'raw_materials',
    electricity: 'manufacturing',
    gas: 'manufacturing',
    diesel: 'manufacturing',
    transport_distance: 'transport',
    aircraft_transport_distance: 'transport',
    packaging_weight: 'packaging',
    use_electricity: 'use',
    waste_weight: 'eol',
}

// ── 상세 활동 데이터 → 단위공정 매핑 ──

function mapDetailedActivityData(
    state: PCFState,
    result: TotalEmissionResult,
    significantThreshold: number
): UnitProcess[] {
    const processes: UnitProcess[] = []
    const totalCFP = result.allocation?.applied
        ? result.allocation.allocatedTotal
        : result.totalEmission

    if (totalCFP === 0) return processes

    const detailed = state.detailedActivityData

    // 원자재
    // P0-C 버그 수정: `|| 1` 은 EF=0 (cut-off zero-burden 원료, 예: 폐원료) 일 때
    //   EF를 1로 잘못 fallback하여 emission = quantity × 1 (가짜 배출량) 로 계산되었음.
    //   r1 보고서에서 조황산니켈 1,450 kg × 1 = 1,450 kgCO₂e → 190.9% 기여도 표시.
    //   `??` 로 변경하여 0과 undefined를 구분하고, emission = 0 인 항목은 제외.
    if (detailed?.raw_materials && Array.isArray(detailed.raw_materials)) {
        for (const mat of detailed.raw_materials) {
            const ef = mat.customEmissionFactor ?? 0
            const emission = mat.quantity * ef
            if (emission <= 0) continue  // EF=0 (cut-off) 또는 quantity=0 항목은 단위공정에서 제외
            const contrib = (emission / totalCFP) * 100
            processes.push({
                id: `up_${mat.id}`,
                name: mat.name,
                nameKo: mat.name,
                stageId: 'raw_materials',
                category: 'material',
                emission,
                contribution: contrib,
                isSignificant: contrib >= significantThreshold,
                dataSource: mat.dataQuality?.source || '미지정',
                dataQuality: (mat.dataQuality?.type as any) || 'secondary',
            })
        }
    }

    // 운송
    if (detailed?.transport && Array.isArray(detailed.transport)) {
        for (const tr of detailed.transport) {
            const stageResult = result.stageResults['transport']
            const emission = stageResult
                ? stageResult.total / (detailed.transport.length || 1)
                : 0
            const contrib = totalCFP > 0 ? (emission / totalCFP) * 100 : 0
            processes.push({
                id: `up_${tr.id}`,
                name: tr.name || 'Transport',
                nameKo: tr.name || '운송',
                stageId: 'transport',
                category: 'transport',
                emission,
                contribution: contrib,
                isSignificant: contrib >= significantThreshold,
                dataSource: tr.dataQuality?.source || '미지정',
                dataQuality: (tr.dataQuality?.type as any) || 'secondary',
            })
        }
    }

    // 포장 — P0-C 버그 수정: 원자재와 동일 패턴
    if (detailed?.packaging && Array.isArray(detailed.packaging)) {
        for (const pkg of detailed.packaging) {
            const ef = pkg.customEmissionFactor ?? 0
            const emission = pkg.quantity * ef
            if (emission <= 0) continue
            const contrib = (emission / totalCFP) * 100
            processes.push({
                id: `up_${pkg.id}`,
                name: pkg.name || 'Packaging',
                nameKo: pkg.name || '포장',
                stageId: 'packaging',
                category: 'packaging',
                emission,
                contribution: contrib,
                isSignificant: contrib >= significantThreshold,
                dataSource: pkg.dataQuality?.source || '미지정',
                dataQuality: (pkg.dataQuality?.type as any) || 'secondary',
            })
        }
    }

    return processes
}

// ── 간소화된 활동 데이터 → 단위공정 매핑 ──

function mapSimplifiedActivityData(
    state: PCFState,
    result: TotalEmissionResult,
    significantThreshold: number
): UnitProcess[] {
    const processes: UnitProcess[] = []
    const totalCFP = result.allocation?.applied
        ? result.allocation.allocatedTotal
        : result.totalEmission

    if (totalCFP === 0) return processes

    // 각 단계별 배출량을 단위공정으로 변환
    for (const [stageId, stageResult] of Object.entries(result.stageResults)) {
        if (!stageResult || stageResult.total === 0) continue

        const contrib = (stageResult.total / totalCFP) * 100

        // 상세 데이터가 없으면 단계 전체를 하나의 단위공정으로 취급
        const stageLabels: Record<string, string> = {
            raw_materials: '원료 채취·가공',
            manufacturing: '제조 공정',
            transport: '운송',
            packaging: '포장',
            use: '사용 단계',
            eol: '폐기·재활용',
        }
        processes.push({
            id: `up_stage_${stageId}`,
            name: stageId,
            nameKo: stageLabels[stageId] || stageId,
            stageId,
            category: stageId === 'transport' ? 'transport'
                : stageId === 'packaging' ? 'packaging'
                    : stageId === 'eol' ? 'waste'
                        : stageId === 'raw_materials' ? 'material'
                            : 'energy',
            emission: stageResult.total,
            contribution: contrib,
            isSignificant: contrib >= significantThreshold,
            dataSource: state.dataQualityMeta.sources[0] || '미지정',
            dataQuality: state.dataQualityMeta.overallType as any || 'secondary',
        })
    }

    return processes
}

// ── 메인 분석 함수 ──

/**
 * 단위공정을 자동으로 식별하고 중요도를 분류합니다.
 * 
 * @param state - PCFState (활동 데이터 포함)
 * @param result - 계산된 총 배출량 결과
 * @param significantThreshold - 중요 판별 기준 (기본 5%)
 */
export function analyzeUnitProcesses(
    state: PCFState,
    result: TotalEmissionResult,
    significantThreshold: number = 5
): UnitProcessAnalysis {
    const totalCFP = result.allocation?.applied
        ? result.allocation.allocatedTotal
        : result.totalEmission

    // 상세 활동 데이터 우선, 없으면 간소화 데이터 사용
    const hasDetailed = state.detailedActivityData
        && (
            (Array.isArray(state.detailedActivityData.raw_materials) && state.detailedActivityData.raw_materials.length > 0) ||
            (Array.isArray(state.detailedActivityData.transport) && state.detailedActivityData.transport.length > 0) ||
            (Array.isArray(state.detailedActivityData.packaging) && state.detailedActivityData.packaging.length > 0)
        )

    let processes: UnitProcess[]
    if (hasDetailed) {
        processes = mapDetailedActivityData(state, result, significantThreshold)
        // 상세 데이터에 없는 단계는 간소화 데이터로 보충
        const coveredStages = new Set(processes.map(p => p.stageId))
        const simplified = mapSimplifiedActivityData(state, result, significantThreshold)
        for (const sp of simplified) {
            if (!coveredStages.has(sp.stageId)) {
                processes.push(sp)
            }
        }
    } else {
        processes = mapSimplifiedActivityData(state, result, significantThreshold)
    }

    // 기여도 내림차순 정렬
    processes.sort((a, b) => b.contribution - a.contribution)

    const significant = processes.filter(p => p.isSignificant)
    const insignificant = processes.filter(p => !p.isSignificant)
    const sigCoverage = significant.reduce((sum, p) => sum + p.contribution, 0)

    return {
        totalCFP,
        unitProcesses: processes,
        significantProcesses: significant,
        insignificantProcesses: insignificant,
        significantCoverage: sigCoverage,
        totalProcessCount: processes.length,
        significantThreshold,
    }
}
