/**
 * narrative-client — license-server proxy 호출 클라이언트.
 *
 * 사용법:
 *   const result = await generateNarrative('pcr', context)
 *
 * OpenAI API 키 / 모델 / web search 기본값은 license-server의 DB에 저장됨.
 * 데스크톱은 키를 모름 — 라이선스 + machineId + slot + context만 보냄.
 *
 * 6개 슬롯을 한 번에 생성하려면 generateAllNarratives(context) 사용.
 */
import {
  type NarrativeContext,
  type NarrativeErrorResponse,
  type NarrativeGenerateRequest,
  type NarrativeGenerateResponse,
  type NarrativeSlot,
  NARRATIVE_SLOTS,
} from '@lca/shared'
import { getMachineId, getStoredLicense } from '@/lib/license/license-client'

const LICENSE_SERVER =
  import.meta.env.VITE_LICENSE_SERVER_URL || 'http://localhost:3000'

export class NarrativeError extends Error {
  constructor(
    message: string,
    public readonly code: NarrativeErrorResponse['code'] | 'no-license' | 'network',
    public readonly httpStatus?: number,
    public readonly details?: string
  ) {
    super(message)
    this.name = 'NarrativeError'
  }
}

interface GenerateOpts {
  /** Web search 보고서 단위 override (default: 서버 설정 따름) */
  useWebSearch?: boolean
  /** AbortSignal */
  signal?: AbortSignal
}

/**
 * 단일 narrative 슬롯 생성.
 */
export async function generateNarrative(
  slot: NarrativeSlot,
  context: NarrativeContext,
  opts: GenerateOpts = {}
): Promise<NarrativeGenerateResponse> {
  const license = getStoredLicense()
  if (!license || !license.valid) {
    throw new NarrativeError('유효한 라이선스가 필요합니다.', 'no-license')
  }
  const machineId = await getMachineId()

  const body: NarrativeGenerateRequest = {
    licenseKey: license.key,
    machineId,
    slot,
    context,
    ...(opts.useWebSearch !== undefined ? { useWebSearch: opts.useWebSearch } : {}),
  }

  let resp: Response
  try {
    resp = await fetch(`${LICENSE_SERVER}/api/narrative/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    })
  } catch (e) {
    throw new NarrativeError(
      e instanceof Error ? `네트워크 오류: ${e.message}` : '네트워크 오류',
      'network'
    )
  }

  if (!resp.ok) {
    let parsed: NarrativeErrorResponse | null = null
    try {
      parsed = (await resp.json()) as NarrativeErrorResponse
    } catch {
      /* ignore */
    }
    throw new NarrativeError(
      parsed?.error ?? `서버 오류 (${resp.status})`,
      parsed?.code ?? 'server-error',
      resp.status,
      parsed?.details
    )
  }

  return (await resp.json()) as NarrativeGenerateResponse
}

export interface BatchGenerateProgress {
  slot: NarrativeSlot
  status: 'pending' | 'in-progress' | 'success' | 'error'
  result?: NarrativeGenerateResponse
  error?: NarrativeError
}

/**
 * 6개 슬롯을 순차 생성 (서버 부하 + rate limit 회피용 직렬).
 * onProgress 콜백으로 진행 상황 실시간 전달.
 */
export async function generateAllNarratives(
  context: NarrativeContext,
  onProgress?: (progress: BatchGenerateProgress[]) => void,
  opts: GenerateOpts = {}
): Promise<BatchGenerateProgress[]> {
  const slots = [...NARRATIVE_SLOTS]
  const progress: BatchGenerateProgress[] = slots.map((slot) => ({
    slot,
    status: 'pending',
  }))

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    progress[i] = { slot, status: 'in-progress' }
    onProgress?.([...progress])

    try {
      const result = await generateNarrative(slot, context, opts)
      progress[i] = { slot, status: 'success', result }
    } catch (e) {
      const error = e instanceof NarrativeError ? e : new NarrativeError(
        e instanceof Error ? e.message : '알 수 없는 오류',
        'server-error'
      )
      progress[i] = { slot, status: 'error', error }
    }

    onProgress?.([...progress])
  }

  return progress
}

/**
 * 보고서당 총 생성 비용 추정 (USD)
 */
export function estimateTotalCost(progress: BatchGenerateProgress[]): {
  totalUSD: number
  totalKRW: number
  perSlot: Array<{ slot: NarrativeSlot; usd: number }>
} {
  const USD_TO_KRW = 1400
  const perSlot = progress
    .filter((p) => p.status === 'success' && p.result)
    .map((p) => ({
      slot: p.slot,
      usd: p.result!.usage.estimatedCostUSD,
    }))
  const totalUSD = perSlot.reduce((sum, p) => sum + p.usd, 0)
  return {
    totalUSD,
    totalKRW: Math.round(totalUSD * USD_TO_KRW),
    perSlot,
  }
}
