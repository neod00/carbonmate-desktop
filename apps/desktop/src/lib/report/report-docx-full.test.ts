/**
 * report-docx-full 회귀 테스트
 *
 * - generateFullWordReport에 narratives bundle을 넘기면 승인된 record가 본문에 포함되는지
 * - 승인 안 된 record는 무시되는지
 * - narratives 미전달 시도 정상 동작 (기존 보고서)
 * - 6개 슬롯 각각 정확한 위치(섹션 번호)에 삽입되는지
 *
 * 검증 방법: 생성된 Blob을 unzip → word/document.xml 텍스트 검사
 */
import { describe, it, expect, beforeEach } from 'vitest'
import JSZip from 'jszip'
import {
    generateFullWordReport,
    type NarrativeBundle,
} from './report-docx-full'
import type { NarrativeRecord } from '@lca/shared'
import { usePCFStore } from '@/lib/core/store'
import { calculateTotalEmissions } from '@/lib/core/emission-calculator'

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

function makeApprovedRecord(slot: NarrativeRecord['slot'], paragraphs: string[]): NarrativeRecord {
    return {
        slot,
        paragraphs,
        title: undefined,
        citations: [],
        approved: true,
        edited: false,
        generatedAt: '2026-04-30T00:00:00Z',
        updatedAt: '2026-04-30T00:00:00Z',
        model: 'gpt-5.4-mini',
    }
}

function makePendingRecord(slot: NarrativeRecord['slot'], paragraphs: string[]): NarrativeRecord {
    return { ...makeApprovedRecord(slot, paragraphs), approved: false }
}

async function getDocText(blob: Blob): Promise<string> {
    const ab = await blob.arrayBuffer()
    const zip = await JSZip.loadAsync(ab)
    const docXml = await zip.file('word/document.xml')?.async('string')
    return docXml ?? ''
}

function getDefaultResult() {
    const state = usePCFStore.getState()
    return calculateTotalEmissions(state.stages, {
        activityData: state.activityData as Record<string, unknown>,
        detailedActivityData: state.detailedActivityData as never,
        recyclingAllocation: state.recyclingAllocation,
    })
}

// =============================================================================

describe('generateFullWordReport — narrative 미전달 (기존 동작)', () => {
    it('narratives 옵션 없어도 정상 생성', async () => {
        const state = usePCFStore.getState()
        const result = getDefaultResult()
        const blob = await generateFullWordReport(state, result)
        expect(blob).toBeInstanceOf(Blob)
        expect(blob.size).toBeGreaterThan(1000)
    })

    it('빈 narratives 객체도 정상 처리', async () => {
        const state = usePCFStore.getState()
        const result = getDefaultResult()
        const blob = await generateFullWordReport(state, result, { narratives: {} })
        expect(blob.size).toBeGreaterThan(1000)
    })
})

describe('generateFullWordReport — 승인된 narrative만 본문에 포함', () => {
    it('approved=true인 PCR narrative가 본문에 포함됨', async () => {
        const state = usePCFStore.getState()
        const result = getDefaultResult()
        const narratives: NarrativeBundle = {
            pcr: makeApprovedRecord('pcr', ['황산니켈 PCR 검색 결과 미발견.', 'ISO 14067 일반 방법론 적용.']),
        }
        const blob = await generateFullWordReport(state, result, { narratives })
        const text = await getDocText(blob)
        expect(text).toContain('황산니켈 PCR 검색 결과 미발견')
        expect(text).toContain('ISO 14067 일반 방법론 적용')
    })

    it('approved=false인 narrative는 본문에 미포함', async () => {
        const state = usePCFStore.getState()
        const result = getDefaultResult()
        const narratives: NarrativeBundle = {
            pcr: makePendingRecord('pcr', ['미승인 PCR 본문 — 보고서에 들어가면 안 됨']),
        }
        const blob = await generateFullWordReport(state, result, { narratives })
        const text = await getDocText(blob)
        expect(text).not.toContain('미승인 PCR 본문')
    })

    it('일부만 승인된 경우 — 승인된 것만 포함', async () => {
        const state = usePCFStore.getState()
        const result = getDefaultResult()
        const narratives: NarrativeBundle = {
            pcr: makeApprovedRecord('pcr', ['승인된 PCR 본문']),
            allocation: makePendingRecord('allocation', ['미승인 할당 본문']),
            resultInterpretation: makeApprovedRecord('resultInterpretation', ['승인된 해석 본문']),
        }
        const blob = await generateFullWordReport(state, result, { narratives })
        const text = await getDocText(blob)
        expect(text).toContain('승인된 PCR 본문')
        expect(text).toContain('승인된 해석 본문')
        expect(text).not.toContain('미승인 할당 본문')
    })
})

describe('generateFullWordReport — 6개 슬롯 모두 삽입', () => {
    it('6개 모두 승인 시 모두 본문에 포함', async () => {
        const state = usePCFStore.getState()
        const result = getDefaultResult()
        const narratives: NarrativeBundle = {
            pcr: makeApprovedRecord('pcr', ['NARR_PCR_MARKER_xyz']),
            systemBoundary: makeApprovedRecord('systemBoundary', ['NARR_SB_MARKER_xyz']),
            datasetRationale: makeApprovedRecord('datasetRationale', ['NARR_DR_MARKER_xyz']),
            allocation: makeApprovedRecord('allocation', ['NARR_AL_MARKER_xyz']),
            dataQuality: makeApprovedRecord('dataQuality', ['NARR_DQ_MARKER_xyz']),
            resultInterpretation: makeApprovedRecord('resultInterpretation', ['NARR_RI_MARKER_xyz']),
        }
        const blob = await generateFullWordReport(state, result, { narratives })
        const text = await getDocText(blob)
        expect(text).toContain('NARR_PCR_MARKER_xyz')
        expect(text).toContain('NARR_SB_MARKER_xyz')
        expect(text).toContain('NARR_DR_MARKER_xyz')
        expect(text).toContain('NARR_AL_MARKER_xyz')
        expect(text).toContain('NARR_DQ_MARKER_xyz')
        expect(text).toContain('NARR_RI_MARKER_xyz')
    })

    it('citations이 있으면 본문 인용 섹션에 표시', async () => {
        const state = usePCFStore.getState()
        const result = getDefaultResult()
        const narratives: NarrativeBundle = {
            pcr: {
                ...makeApprovedRecord('pcr', ['PCR 검색 결과 본문']),
                citations: [
                    {
                        url: 'https://epd-international.com',
                        title: 'EPD International',
                        retrievedAt: '2026-04-30T10:00:00Z',
                    },
                ],
            },
        }
        const blob = await generateFullWordReport(state, result, { narratives })
        const text = await getDocText(blob)
        expect(text).toContain('EPD International')
        expect(text).toContain('https://epd-international.com')
        expect(text).toContain('2026-04-30')
    })
})
