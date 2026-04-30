/**
 * narrative-store 회귀 테스트
 * - 컨텍스트 메모 추가/수정/삭제
 * - narrative record 저장/편집/승인/삭제
 * - isAllApproved / approvedCount 게이트 로직
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useNarrativeStore } from './narrative-store'

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

if (!(globalThis as any).crypto) {
  ;(globalThis as any).crypto = { randomUUID: () => `uuid-${Math.random()}` }
} else if (!(globalThis as any).crypto.randomUUID) {
  ;(globalThis as any).crypto.randomUUID = () => `uuid-${Math.random()}`
}

beforeEach(() => {
  localStorageMock.clear()
  useNarrativeStore.getState().reset()
})

// ========== Context memos ==========
describe('narrative-store: 컨텍스트 메모', () => {
  it('초기 상태는 빈 배열', () => {
    expect(useNarrativeStore.getState().contextMemos).toEqual([])
  })

  it('addMemo로 빈 메모 추가', () => {
    useNarrativeStore.getState().addMemo()
    const memos = useNarrativeStore.getState().contextMemos
    expect(memos).toHaveLength(1)
    expect(memos[0].text).toBe('')
    expect(memos[0].id).toBeTruthy()
  })

  it('updateMemo로 텍스트 수정', () => {
    useNarrativeStore.getState().addMemo()
    const id = useNarrativeStore.getState().contextMemos[0].id
    useNarrativeStore.getState().updateMemo(id, 'PCR 검색 결과 미발견')
    expect(useNarrativeStore.getState().contextMemos[0].text).toBe('PCR 검색 결과 미발견')
  })

  it('removeMemo로 삭제', () => {
    useNarrativeStore.getState().addMemo()
    useNarrativeStore.getState().addMemo()
    const id = useNarrativeStore.getState().contextMemos[0].id
    useNarrativeStore.getState().removeMemo(id)
    expect(useNarrativeStore.getState().contextMemos).toHaveLength(1)
  })

  it('setMemos로 일괄 교체', () => {
    useNarrativeStore.getState().setMemos([
      { id: 'a', text: 'foo' },
      { id: 'b', text: 'bar' },
    ])
    expect(useNarrativeStore.getState().contextMemos).toHaveLength(2)
  })
})

// ========== Narrative records ==========
describe('narrative-store: narrative record', () => {
  it('saveRecord 후 records[slot]에 저장', () => {
    useNarrativeStore.getState().saveRecord({
      slot: 'pcr',
      paragraphs: ['단락 1', '단락 2'],
      title: 'PCR 검토',
      citations: [],
      model: 'gpt-5.4-mini',
    })
    const r = useNarrativeStore.getState().records.pcr
    expect(r).toBeDefined()
    expect(r?.paragraphs).toHaveLength(2)
    expect(r?.title).toBe('PCR 검토')
    expect(r?.approved).toBe(false)
    expect(r?.edited).toBe(false)
    expect(r?.model).toBe('gpt-5.4-mini')
  })

  it('editRecord 후 edited=true', () => {
    useNarrativeStore.getState().saveRecord({
      slot: 'pcr',
      paragraphs: ['원본'],
      citations: [],
      model: 'gpt-5.4-mini',
    })
    useNarrativeStore.getState().editRecord('pcr', ['수정된 본문', '두번째 단락'])
    const r = useNarrativeStore.getState().records.pcr
    expect(r?.edited).toBe(true)
    expect(r?.paragraphs).toEqual(['수정된 본문', '두번째 단락'])
  })

  it('editRecord — record 없을 시 무시', () => {
    useNarrativeStore.getState().editRecord('pcr', ['x'])
    expect(useNarrativeStore.getState().records.pcr).toBeUndefined()
  })

  it('setApproved 토글', () => {
    useNarrativeStore.getState().saveRecord({
      slot: 'pcr',
      paragraphs: ['x'],
      citations: [],
      model: 'gpt-5.4-mini',
    })
    useNarrativeStore.getState().setApproved('pcr', true)
    expect(useNarrativeStore.getState().records.pcr?.approved).toBe(true)
    useNarrativeStore.getState().setApproved('pcr', false)
    expect(useNarrativeStore.getState().records.pcr?.approved).toBe(false)
  })

  it('removeRecord', () => {
    useNarrativeStore.getState().saveRecord({
      slot: 'pcr',
      paragraphs: ['x'],
      citations: [],
      model: 'gpt-5.4-mini',
    })
    useNarrativeStore.getState().removeRecord('pcr')
    expect(useNarrativeStore.getState().records.pcr).toBeUndefined()
  })
})

// ========== Approval gate ==========
describe('narrative-store: 승인 게이트', () => {
  const SLOTS = [
    'pcr',
    'systemBoundary',
    'allocation',
    'datasetRationale',
    'dataQuality',
    'resultInterpretation',
  ] as const

  it('빈 상태 → isAllApproved=false, approvedCount=0', () => {
    expect(useNarrativeStore.getState().isAllApproved()).toBe(false)
    expect(useNarrativeStore.getState().approvedCount()).toBe(0)
  })

  it('5개만 승인 → isAllApproved=false, approvedCount=5', () => {
    SLOTS.forEach((slot) => {
      useNarrativeStore.getState().saveRecord({
        slot,
        paragraphs: ['x'],
        citations: [],
        model: 'gpt-5.4-mini',
      })
    })
    SLOTS.slice(0, 5).forEach((slot) => useNarrativeStore.getState().setApproved(slot, true))
    expect(useNarrativeStore.getState().approvedCount()).toBe(5)
    expect(useNarrativeStore.getState().isAllApproved()).toBe(false)
  })

  it('6개 모두 승인 → isAllApproved=true', () => {
    SLOTS.forEach((slot) => {
      useNarrativeStore.getState().saveRecord({
        slot,
        paragraphs: ['x'],
        citations: [],
        model: 'gpt-5.4-mini',
      })
      useNarrativeStore.getState().setApproved(slot, true)
    })
    expect(useNarrativeStore.getState().isAllApproved()).toBe(true)
    expect(useNarrativeStore.getState().approvedCount()).toBe(6)
  })

  it('6개 record 있지만 1개 승인 취소 → false', () => {
    SLOTS.forEach((slot) => {
      useNarrativeStore.getState().saveRecord({
        slot,
        paragraphs: ['x'],
        citations: [],
        model: 'gpt-5.4-mini',
      })
      useNarrativeStore.getState().setApproved(slot, true)
    })
    useNarrativeStore.getState().setApproved('allocation', false)
    expect(useNarrativeStore.getState().isAllApproved()).toBe(false)
    expect(useNarrativeStore.getState().approvedCount()).toBe(5)
  })
})

// ========== Reset ==========
describe('narrative-store: reset()', () => {
  it('contextMemos + records 모두 비움', () => {
    useNarrativeStore.getState().addMemo()
    useNarrativeStore.getState().saveRecord({
      slot: 'pcr',
      paragraphs: ['x'],
      citations: [],
      model: 'gpt-5.4-mini',
    })
    useNarrativeStore.getState().reset()
    expect(useNarrativeStore.getState().contextMemos).toEqual([])
    expect(useNarrativeStore.getState().records).toEqual({})
  })
})
