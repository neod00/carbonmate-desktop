/**
 * narrative-store — 보고서 narrative 상태 관리.
 *
 * - 사용자 컨텍스트 메모 (위저드 step 8 입력)
 * - 6개 슬롯의 narrative 레코드 (생성·편집·승인)
 * - localStorage 영속화 (프로젝트별로는 추후 project-file에 통합)
 *
 * 보고서 생성 시 PR-3에서 이 store를 읽어 narrative를 본문에 삽입합니다.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  NARRATIVE_SLOTS,
  type NarrativeCitation,
  type NarrativeRecord,
  type NarrativeSlot,
} from '@lca/shared'
import { sanitizeCitation, sanitizeText } from './narrative-sanitizer'
import { isContextHashStale } from './context-hash'

const STORAGE_KEY = 'carbonmate_narrative_v1'

/** 컨텍스트 메모 한 줄 (사용자가 step 8에서 자유 입력) */
export interface ContextMemo {
  id: string
  text: string
}

interface NarrativeStateData {
  /** 사용자가 입력한 컨텍스트 메모 (5~10개 권장) */
  contextMemos: ContextMemo[]
  /** slot → record 매핑. record가 없으면 미생성 상태. */
  records: Partial<Record<NarrativeSlot, NarrativeRecord>>
}

interface NarrativeStore extends NarrativeStateData {
  // ============== Context memos ==============
  addMemo: () => void
  updateMemo: (id: string, text: string) => void
  removeMemo: (id: string) => void
  setMemos: (memos: ContextMemo[]) => void

  // ============== Narrative records ==============
  /** 새 record 저장 (생성 직후 호출). approved=false, edited=false로 시작. */
  saveRecord: (params: {
    slot: NarrativeSlot
    paragraphs: string[]
    title?: string
    citations: NarrativeCitation[]
    model: string
    /** 생성 당시 컨텍스트 해시 (P0-B stale 방지) */
    contextHash?: string
  }) => void
  /** 사용자가 본문 편집 (단락 단위) */
  editRecord: (slot: NarrativeSlot, paragraphs: string[], title?: string) => void
  /** 승인 토글 */
  setApproved: (slot: NarrativeSlot, approved: boolean) => void
  /** 단일 record 삭제 (재생성 직전 호출) */
  removeRecord: (slot: NarrativeSlot) => void
  /**
   * 현재 컨텍스트 해시와 일치하지 않는 (stale) record 일괄 삭제.
   * 보고서 export 직전 또는 BOM·EF 변경 후 호출.
   * 사용자가 편집한 (edited=true) record는 보존.
   */
  invalidateStaleRecords: (currentContextHash: string) => number

  // ============== Helpers ==============
  /** 모든 6개 슬롯의 record가 존재하고 approved=true면 true */
  isAllApproved: () => boolean
  /** 승인된 슬롯 수 */
  approvedCount: () => number
  /** 특정 슬롯의 record가 stale 인지 */
  isStale: (slot: NarrativeSlot, currentContextHash: string) => boolean
  /** 전체 reset (신규 프로젝트 시) */
  reset: () => void
}

const DEFAULT_DATA: NarrativeStateData = {
  contextMemos: [],
  records: {},
}

function genId(): string {
  // crypto.randomUUID()는 브라우저/Node에서 사용 가능
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `memo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useNarrativeStore = create<NarrativeStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_DATA,

      addMemo: () =>
        set((state) => ({
          contextMemos: [...state.contextMemos, { id: genId(), text: '' }],
        })),

      updateMemo: (id, text) =>
        set((state) => ({
          contextMemos: state.contextMemos.map((m) => (m.id === id ? { ...m, text } : m)),
        })),

      removeMemo: (id) =>
        set((state) => ({
          contextMemos: state.contextMemos.filter((m) => m.id !== id),
        })),

      setMemos: (memos) => set({ contextMemos: memos }),

      saveRecord: ({ slot, paragraphs, title, citations, model, contextHash }) => {
        const now = new Date().toISOString()
        set((state) => ({
          records: {
            ...state.records,
            [slot]: {
              slot,
              paragraphs: paragraphs.map(sanitizeText),
              title: title ? sanitizeText(title) : title,
              citations: citations.map(sanitizeCitation),
              approved: false,
              edited: false,
              generatedAt: now,
              updatedAt: now,
              model,
              contextHash,
            },
          },
        }))
      },

      editRecord: (slot, paragraphs, title) =>
        set((state) => {
          const existing = state.records[slot]
          if (!existing) return state
          return {
            records: {
              ...state.records,
              [slot]: {
                ...existing,
                paragraphs: paragraphs.map(sanitizeText),
                title: title !== undefined ? sanitizeText(title) : existing.title,
                edited: true,
                updatedAt: new Date().toISOString(),
              },
            },
          }
        }),

      setApproved: (slot, approved) =>
        set((state) => {
          const existing = state.records[slot]
          if (!existing) return state
          return {
            records: {
              ...state.records,
              [slot]: {
                ...existing,
                approved,
                updatedAt: new Date().toISOString(),
              },
            },
          }
        }),

      removeRecord: (slot) =>
        set((state) => {
          const next = { ...state.records }
          delete next[slot]
          return { records: next }
        }),

      invalidateStaleRecords: (currentContextHash) => {
        let removedCount = 0
        set((state) => {
          const next: Partial<Record<NarrativeSlot, NarrativeRecord>> = {}
          for (const [slot, rec] of Object.entries(state.records) as Array<[
            NarrativeSlot,
            NarrativeRecord,
          ]>) {
            if (!rec) continue
            // 사용자가 직접 편집한 record는 stale이라도 보존 (의뢰자 의도 우선)
            if (rec.edited) {
              next[slot] = rec
              continue
            }
            if (isContextHashStale(rec.contextHash, currentContextHash)) {
              removedCount++
              continue // 폐기
            }
            next[slot] = rec
          }
          return { records: next }
        })
        return removedCount
      },

      isStale: (slot, currentContextHash) => {
        const rec = get().records[slot]
        if (!rec) return false
        if (rec.edited) return false
        return isContextHashStale(rec.contextHash, currentContextHash)
      },

      isAllApproved: () => {
        const { records } = get()
        return NARRATIVE_SLOTS.every((slot) => records[slot]?.approved === true)
      },

      approvedCount: () => {
        const { records } = get()
        return NARRATIVE_SLOTS.filter((slot) => records[slot]?.approved === true).length
      },

      reset: () => set({ ...DEFAULT_DATA }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state): NarrativeStateData => ({
        contextMemos: state.contextMemos,
        records: state.records,
      }),
    }
  )
)
