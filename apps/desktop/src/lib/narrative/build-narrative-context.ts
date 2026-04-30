/**
 * build-narrative-context — PCFStore + 산정 결과 → NarrativeContext 변환.
 *
 * narrative 생성 라우트에 보낼 컨텍스트를 만드는 어댑터.
 * 사용자 컨텍스트 메모는 narrative-store에서 별도로 가져와 합칩니다.
 */
import type { NarrativeContext } from '@lca/shared'
import type { PCFState } from '@/lib/core/store'
import {
  calculateTotalEmissions,
  type StageEmissionResult,
} from '@/lib/core/emission-calculator'
import type { ContextMemo } from './narrative-store'

/** 사용자 친화 단계 라벨 */
const STAGE_LABELS: Record<string, string> = {
  raw_materials: '원료 채취',
  manufacturing: '제조',
  transport: '운송',
  packaging: '포장',
  use: '사용',
  eol: '폐기·EoL',
}

function stageBoundaryToISO(
  boundary: string | undefined
): NarrativeContext['systemBoundary'] {
  if (boundary === 'cradle-to-grave') return 'cradle-to-grave'
  if (boundary === 'gate-to-gate') return 'gate-to-gate'
  return 'cradle-to-gate'
}

interface BuildOpts {
  /** 사용자 컨텍스트 메모 (narrative-store에서 가져옴) */
  contextMemos?: ContextMemo[]
  /** 외부에서 미리 계산한 총배출량을 주입 가능 (계산 비용 절감용) */
  precomputedStageResults?: Record<string, StageEmissionResult>
}

export function buildNarrativeContext(
  state: PCFState,
  opts: BuildOpts = {}
): NarrativeContext {
  // 단계별 배출량 계산
  const stageResults =
    opts.precomputedStageResults ??
    calculateTotalEmissions(state.stages, {
      activityData: state.activityData as Record<string, unknown>,
      detailedActivityData: state.detailedActivityData as never,
      recyclingAllocation: state.recyclingAllocation,
    }).stageResults

  const total = Object.values(stageResults).reduce((sum, r) => sum + r.total, 0)
  const stageBreakdown = Object.entries(stageResults)
    .map(([stage, r]) => ({
      stage: STAGE_LABELS[stage] ?? stage,
      value: r.total,
      sharePercent: total > 0 ? (r.total / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)

  // 상위 기여자 (단계 단위 — 추후 활동 단위로 세분화 가능)
  const sortedStages = [...stageBreakdown].sort((a, b) => b.value - a.value)
  let cumulative = 0
  const topContributors = sortedStages.map((s, i) => {
    cumulative += s.sharePercent
    return {
      rank: i + 1,
      item: s.stage,
      value: s.value,
      sharePercent: s.sharePercent,
      cumulativePercent: cumulative,
    }
  })

  // 할당 결정 — multi-output + recycling
  const allocationDecisions: NonNullable<NarrativeContext['allocationDecisions']> = []
  if (state.multiOutputAllocation) {
    const m = state.multiOutputAllocation
    // method: 'subdivision' | 'system_expansion' | 'physical' | 'economic'
    const methodMap: Record<string, NonNullable<NarrativeContext['allocationDecisions']>[number]['method']> = {
      subdivision: 'subdivision',
      system_expansion: 'system-expansion',
      physical: 'mass',
      economic: 'economic',
    }
    const mapped = methodMap[m.method]
    if (mapped && m.coProducts && m.coProducts.length > 0) {
      allocationDecisions.push({
        material: '다중 산출물 (Co-product)',
        method: mapped,
        rationale: m.justification || '다중 산출물 할당 적용',
      })
    }
  }
  if (state.recyclingAllocation) {
    const r = state.recyclingAllocation
    // method: 'cut_off' | 'eol_recycling' | 'fifty_fifty' | 'substitution' | 'pef_formula'
    if (r.method === 'cut_off') {
      allocationDecisions.push({
        material: '재활용 (Recycling)',
        method: 'cut-off',
        rationale: r.justification || 'Cut-off 적용 (recycled content 수령자 부담)',
      })
    } else if (r.method === 'substitution') {
      allocationDecisions.push({
        material: '재활용 (Recycling)',
        method: 'system-expansion',
        rationale: r.justification || '대체(시스템 확장) 적용',
      })
    } else if (r.method) {
      allocationDecisions.push({
        material: '재활용 (Recycling)',
        method: 'mass',
        rationale: r.justification || `재활용 할당: ${r.method}`,
      })
    }
  }

  // DQR — dataQualityMeta가 단순화돼 있어 가능한 범위만 제공
  const dqMeta = state.dataQualityMeta
  const dqr = dqMeta
    ? {
        averageTiR: 2.5, // overallType이 1차/2차 mix면 보수적 추정
        averageTeR: 2.5,
        averageGeR: 2.5,
        weightedAverage: 2.5,
      }
    : undefined

  // 불확실도 — sensitivityAnalysis가 baseline 대비 최대 변동을 가지면 그것 사용 (없으면 undefined)
  const uncertaintyPercent = (() => {
    const s = state.sensitivityAnalysis
    if (!s || !s.scenarios?.length) return undefined
    const maxAbs = Math.max(
      ...s.scenarios.map((sc) => Math.abs(sc.percentageChange ?? 0))
    )
    return Number.isFinite(maxAbs) && maxAbs > 0 ? Math.round(maxAbs) : undefined
  })()

  return {
    product: {
      name: state.productInfo.name || '(미입력)',
      ...(state.productInfo.category ? { application: state.productInfo.category } : {}),
    },
    functionalUnit: state.productInfo.unit || '1 unit',
    systemBoundary: stageBoundaryToISO(state.productInfo.boundary),
    totalCFP: {
      value: total,
      unit: `kg CO₂e/${state.productInfo.unit || 'unit'}`,
      ...(uncertaintyPercent !== undefined ? { uncertaintyPercent } : {}),
    },
    stageBreakdown,
    topContributors,
    ...(allocationDecisions.length ? { allocationDecisions } : {}),
    ...(dqr ? { dqr } : {}),
    ...(opts.contextMemos && opts.contextMemos.length
      ? {
          userContextNotes: opts.contextMemos
            .map((m) => m.text.trim())
            .filter((t) => t.length > 0),
        }
      : {}),
  }
}
