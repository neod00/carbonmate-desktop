/**
 * build-narrative-context 회귀 테스트
 *
 * PCFStore 상태 → NarrativeContext 변환 정확성 검증.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { buildNarrativeContext } from './build-narrative-context'
import { usePCFStore } from '@/lib/core/store'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] || null,
  }
})()
;(globalThis as any).localStorage = localStorageMock

beforeEach(() => {
  localStorageMock.clear()
  usePCFStore.getState().reset()
})

describe('buildNarrativeContext', () => {
  it('빈 store → 기본 context (PCFStore default: 6단계 모두 활성, 활동데이터 없음)', () => {
    const ctx = buildNarrativeContext(usePCFStore.getState())
    expect(ctx.product.name).toBe('(미입력)')
    expect(ctx.functionalUnit).toBe('1 kg')
    expect(ctx.systemBoundary).toBe('cradle-to-gate')
    expect(ctx.totalCFP.value).toBe(0)
    // 활동데이터 없으면 모든 단계 배출량 0 — stageBreakdown은 길이 6, 합 0
    expect(ctx.stageBreakdown.every((s) => s.value === 0)).toBe(true)
  })

  it('productInfo 반영', () => {
    usePCFStore.getState().setProductInfo({
      name: '황산니켈',
      category: 'EV 배터리 양극재',
      unit: '1 ton',
      boundary: 'cradle-to-gate',
      referenceFlow: '',
    })
    const ctx = buildNarrativeContext(usePCFStore.getState())
    expect(ctx.product.name).toBe('황산니켈')
    expect(ctx.product.application).toBe('EV 배터리 양극재')
    expect(ctx.functionalUnit).toBe('1 ton')
  })

  it('cradle-to-grave boundary 변환', () => {
    usePCFStore.getState().setProductInfo({
      name: '제품',
      category: '',
      unit: '1 kg',
      boundary: 'cradle-to-grave',
      referenceFlow: '',
    })
    const ctx = buildNarrativeContext(usePCFStore.getState())
    expect(ctx.systemBoundary).toBe('cradle-to-grave')
  })

  it('contextMemos가 빈 텍스트는 제외하고 trim', () => {
    const ctx = buildNarrativeContext(usePCFStore.getState(), {
      contextMemos: [
        { id: 'a', text: '  PCR 미발견  ' },
        { id: 'b', text: '' },
        { id: 'c', text: '   ' },
        { id: 'd', text: '공급사 membrane cell' },
      ],
    })
    expect(ctx.userContextNotes).toEqual(['PCR 미발견', '공급사 membrane cell'])
  })

  it('contextMemos 없으면 userContextNotes 미포함', () => {
    const ctx = buildNarrativeContext(usePCFStore.getState())
    expect(ctx.userContextNotes).toBeUndefined()
  })

  it('precomputedStageResults 사용 시 stageBreakdown 정확', () => {
    const ctx = buildNarrativeContext(usePCFStore.getState(), {
      precomputedStageResults: {
        manufacturing: {
          total: 696.95,
          fossil: 696.95,
          biogenic: 0,
          aircraft: 0,
          uncertainty: 0,
          ghgBreakdown: {},
          details: [],
        },
        raw_materials: {
          total: 309.03,
          fossil: 309.03,
          biogenic: 0,
          aircraft: 0,
          uncertainty: 0,
          ghgBreakdown: {},
          details: [],
        },
      },
    })

    expect(ctx.totalCFP.value).toBeCloseTo(1005.98)
    expect(ctx.stageBreakdown).toHaveLength(2)
    // 내림차순 정렬 (제조 > 원료)
    expect(ctx.stageBreakdown[0].stage).toBe('제조')
    expect(ctx.stageBreakdown[0].sharePercent).toBeCloseTo(69.28, 1)
    expect(ctx.stageBreakdown[1].stage).toBe('원료 채취')
  })

  it('topContributors 누적% 정확', () => {
    const ctx = buildNarrativeContext(usePCFStore.getState(), {
      precomputedStageResults: {
        manufacturing: {
          total: 700,
          fossil: 700,
          biogenic: 0,
          aircraft: 0,
          uncertainty: 0,
          ghgBreakdown: {},
          details: [],
        },
        raw_materials: {
          total: 200,
          fossil: 200,
          biogenic: 0,
          aircraft: 0,
          uncertainty: 0,
          ghgBreakdown: {},
          details: [],
        },
        transport: {
          total: 100,
          fossil: 100,
          biogenic: 0,
          aircraft: 0,
          uncertainty: 0,
          ghgBreakdown: {},
          details: [],
        },
      },
    })

    expect(ctx.topContributors).toHaveLength(3)
    expect(ctx.topContributors![0].cumulativePercent).toBeCloseTo(70, 1)
    expect(ctx.topContributors![1].cumulativePercent).toBeCloseTo(90, 1)
    expect(ctx.topContributors![2].cumulativePercent).toBeCloseTo(100, 1)
  })
})
