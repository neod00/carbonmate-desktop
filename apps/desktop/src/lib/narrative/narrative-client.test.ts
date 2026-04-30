/**
 * narrative-client 회귀 테스트
 *
 * - fetch mock으로 license-server proxy 응답 시뮬레이션
 * - 라이선스 미인증 / 정상 / 에러 케이스
 * - 6개 슬롯 batch 진행
 * - 비용 추정 합산
 *
 * 주: OpenAI API 키는 license-server DB에 저장되므로 클라이언트 측 검증 없음.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  generateNarrative,
  generateAllNarratives,
  estimateTotalCost,
  NarrativeError,
  type BatchGenerateProgress,
} from './narrative-client'
import type { NarrativeContext, NarrativeGenerateResponse } from '@lca/shared'

// =============== localStorage mock (Node) ===============
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
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

// crypto.randomUUID — getMachineId가 사용
if (!(globalThis as any).crypto) {
  ;(globalThis as any).crypto = { randomUUID: () => 'test-uuid' }
} else if (!(globalThis as any).crypto.randomUUID) {
  ;(globalThis as any).crypto.randomUUID = () => 'test-uuid'
}

// =============== 공통 fixtures ===============
const SAMPLE_CONTEXT: NarrativeContext = {
  product: { name: '황산니켈 (NiSO₄)' },
  functionalUnit: '1 ton 황산니켈',
  systemBoundary: 'cradle-to-gate',
  totalCFP: { value: 1065.43, unit: 'kg CO₂e/ton', uncertaintyPercent: 16 },
  stageBreakdown: [
    { stage: '제조', value: 696.95, sharePercent: 65.4 },
    { stage: '원료', value: 309.03, sharePercent: 29.0 },
  ],
}

const SAMPLE_RESPONSE: NarrativeGenerateResponse = {
  slot: 'pcr',
  paragraphs: ['단락 1 본문...', '단락 2 본문...'],
  citations: [],
  usage: {
    inputTokens: 5000,
    cachedInputTokens: 3000,
    outputTokens: 2000,
    estimatedCostUSD: 0.012,
  },
  model: 'gpt-5.4-mini',
  generatedAt: '2026-04-30T00:00:00Z',
}

function setValidLicense() {
  localStorageMock.setItem(
    'carbonmate_license',
    JSON.stringify({
      key: 'CMATE-TEST-1234-ABCD',
      valid: true,
      plan: 'standard',
      lastVerifiedAt: new Date().toISOString(),
    })
  )
  localStorageMock.setItem('carbonmate_machine_id', 'test-machine-id')
}

beforeEach(() => {
  localStorageMock.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// =============== generateNarrative ===============
describe('generateNarrative — 사전 검증', () => {
  it('라이선스 미인증 → no-license 에러', async () => {
    await expect(generateNarrative('pcr', SAMPLE_CONTEXT)).rejects.toMatchObject({
      code: 'no-license',
    })
  })
})

describe('generateNarrative — 정상 호출', () => {
  it('200 응답 → NarrativeGenerateResponse 반환', async () => {
    setValidLicense()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateNarrative('pcr', SAMPLE_CONTEXT)
    expect(result.slot).toBe('pcr')
    expect(result.paragraphs).toHaveLength(2)
    expect(result.usage.estimatedCostUSD).toBe(0.012)

    // 요청 body 검증 — openaiApiKey, model 포함되지 않아야 함 (서버 DB가 보유)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/narrative/generate')
    const body = JSON.parse(init.body)
    expect(body.licenseKey).toBe('CMATE-TEST-1234-ABCD')
    expect(body.machineId).toBe('test-machine-id')
    expect(body.slot).toBe('pcr')
    expect(body.context).toBeDefined()
    expect(body.openaiApiKey).toBeUndefined()
    expect(body.model).toBeUndefined()
  })

  it('useWebSearch=true override 시 요청에 포함', async () => {
    setValidLicense()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await generateNarrative('systemBoundary', SAMPLE_CONTEXT, { useWebSearch: true })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.useWebSearch).toBe(true)
  })

  it('useWebSearch override 없음 → 요청에 미포함 (서버 default 사용)', async () => {
    setValidLicense()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await generateNarrative('pcr', SAMPLE_CONTEXT)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.useWebSearch).toBeUndefined()
  })
})

describe('generateNarrative — 에러 응답 처리', () => {
  it('서버 401 (invalid-license) → NarrativeError', async () => {
    setValidLicense()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: '유효하지 않은 라이선스 키입니다.',
            code: 'invalid-license',
          }),
          { status: 401 }
        )
      )
    )

    await expect(generateNarrative('pcr', SAMPLE_CONTEXT)).rejects.toMatchObject({
      code: 'invalid-license',
      httpStatus: 401,
    })
  })

  it('서버 503 (narrative-disabled) → NarrativeError', async () => {
    setValidLicense()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'narrative 비활성',
            code: 'narrative-disabled',
          }),
          { status: 503 }
        )
      )
    )

    await expect(generateNarrative('pcr', SAMPLE_CONTEXT)).rejects.toMatchObject({
      code: 'narrative-disabled',
      httpStatus: 503,
    })
  })

  it('서버 503 (no-server-key) → NarrativeError', async () => {
    setValidLicense()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'OpenAI 키 미설정',
            code: 'no-server-key',
          }),
          { status: 503 }
        )
      )
    )

    await expect(generateNarrative('pcr', SAMPLE_CONTEXT)).rejects.toMatchObject({
      code: 'no-server-key',
    })
  })

  it('서버 502 (openai-api-error) → NarrativeError + details', async () => {
    setValidLicense()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'OpenAI API 오류 (500)',
            code: 'openai-api-error',
            details: 'Internal server error',
          }),
          { status: 502 }
        )
      )
    )

    const err = await generateNarrative('pcr', SAMPLE_CONTEXT).catch((e) => e)
    expect(err).toBeInstanceOf(NarrativeError)
    expect(err.code).toBe('openai-api-error')
    expect(err.details).toBe('Internal server error')
  })

  it('네트워크 에러 → code=network', async () => {
    setValidLicense()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const err = await generateNarrative('pcr', SAMPLE_CONTEXT).catch((e) => e)
    expect(err).toBeInstanceOf(NarrativeError)
    expect(err.code).toBe('network')
  })
})

// =============== generateAllNarratives (batch) ===============
describe('generateAllNarratives — 6개 슬롯 batch', () => {
  it('6개 슬롯 모두 성공 시 배열 반환', async () => {
    setValidLicense()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url, init) => {
        const body = JSON.parse((init as RequestInit).body as string)
        return new Response(
          JSON.stringify({ ...SAMPLE_RESPONSE, slot: body.slot }),
          { status: 200 }
        )
      })
    )

    const progresses: BatchGenerateProgress[][] = []
    const result = await generateAllNarratives(SAMPLE_CONTEXT, (p) => {
      progresses.push(p)
    })

    expect(result).toHaveLength(6)
    expect(result.every((r) => r.status === 'success')).toBe(true)
    expect(result.map((r) => r.slot).sort()).toEqual(
      [
        'pcr',
        'systemBoundary',
        'allocation',
        'datasetRationale',
        'dataQuality',
        'resultInterpretation',
      ].sort()
    )

    // onProgress가 in-progress + success 페어로 호출되어야 함
    expect(progresses.length).toBe(12)
  })

  it('일부 슬롯 실패 시 다른 슬롯은 정상 완료', async () => {
    setValidLicense()
    let callCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url, init) => {
        callCount++
        const body = JSON.parse((init as RequestInit).body as string)
        if (body.slot === 'allocation') {
          return new Response(
            JSON.stringify({ error: 'rate limited', code: 'rate-limited' }),
            { status: 429 }
          )
        }
        return new Response(
          JSON.stringify({ ...SAMPLE_RESPONSE, slot: body.slot }),
          { status: 200 }
        )
      })
    )

    const result = await generateAllNarratives(SAMPLE_CONTEXT)
    expect(callCount).toBe(6)
    const allocation = result.find((r) => r.slot === 'allocation')!
    expect(allocation.status).toBe('error')
    expect(allocation.error?.code).toBe('rate-limited')

    const others = result.filter((r) => r.slot !== 'allocation')
    expect(others.every((r) => r.status === 'success')).toBe(true)
  })
})

// =============== estimateTotalCost ===============
describe('estimateTotalCost', () => {
  it('성공 슬롯의 비용을 합산', () => {
    const progress: BatchGenerateProgress[] = [
      { slot: 'pcr', status: 'success', result: { ...SAMPLE_RESPONSE, slot: 'pcr', usage: { ...SAMPLE_RESPONSE.usage, estimatedCostUSD: 0.01 } } },
      { slot: 'systemBoundary', status: 'success', result: { ...SAMPLE_RESPONSE, slot: 'systemBoundary', usage: { ...SAMPLE_RESPONSE.usage, estimatedCostUSD: 0.02 } } },
      { slot: 'allocation', status: 'error' },
    ]
    const cost = estimateTotalCost(progress)
    expect(cost.totalUSD).toBeCloseTo(0.03)
    expect(cost.totalKRW).toBe(42)
    expect(cost.perSlot).toHaveLength(2)
  })

  it('빈 배열 → 0', () => {
    const cost = estimateTotalCost([])
    expect(cost.totalUSD).toBe(0)
    expect(cost.totalKRW).toBe(0)
  })
})
