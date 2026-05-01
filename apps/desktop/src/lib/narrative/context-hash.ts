/**
 * context-hash — narrative 생성 당시 컨텍스트 스냅샷 해시.
 *
 * P0-B 회귀 방어:
 *   r1 보고서 §1.2 / §2.5 / §3.6 / §6.5 / §8.1 narrative에 옛 보고서의
 *   "34.50 kgCO₂e/ton" 값이 그대로 박혀 있어, 표지·§5.1의 759.72와
 *   한 보고서 안에 두 결과값이 공존한 사고.
 *
 *   원인: narrative-store가 BOM·EF가 변경된 뒤에도 옛 record를 stale 상태로 유지.
 *   해결: record 저장 시 컨텍스트 해시를 함께 저장하고, 보고서 export 시
 *         현재 해시와 비교. 다르면 stale로 분류해 본문에 삽입하지 않음.
 */
import type { NarrativeContext } from '@lca/shared'

/**
 * djb2 해시 — 빠르고 충돌 가능성 낮음. Cryptographic 보안용 아님.
 */
function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  // 부호 없는 32비트로 변환 후 16진수 8자리
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * NarrativeContext에서 결정적(deterministic) 해시를 계산.
 *
 * 포함되는 필드:
 *  - totalCFP (가장 강한 신호 — 결과값이 바뀌면 narrative도 stale)
 *  - 단계별 배출량 (stage breakdown)
 *  - BOM 합계 (질량·EF 변동 감지)
 *  - 시스템 경계
 *  - 할당 방법 / R_in / R_out
 *
 * 제외되는 필드:
 *  - 사용자 메모 (메모만 바꿔도 narrative 재생성 강제하면 비용 증가)
 *  - 제품명 (오타 수정 등 narrative와 무관)
 *  - 타임스탬프 (해시 안정성 위반)
 */
export function computeContextHash(ctx: NarrativeContext): string {
  // 정렬된 단계 배열 (순서 안정성)
  const stages = [...(ctx.stageBreakdown ?? [])]
    .sort((a, b) => a.stage.localeCompare(b.stage))
    .map((s) => `${s.stage}:${s.value.toFixed(4)}`)
    .join('|')

  const bomSummary = (() => {
    const bom = (ctx as { bom?: Array<{ id?: string; quantity?: number; ef?: number }> }).bom
    if (!Array.isArray(bom)) return ''
    return [...bom]
      .map((b) => `${b.id ?? ''}:${(b.quantity ?? 0).toFixed(2)}:${(b.ef ?? 0).toFixed(4)}`)
      .sort()
      .join('|')
  })()

  const allocation = (() => {
    const a = (ctx as { allocation?: { method?: string; rIn?: number; rOut?: number } }).allocation
    if (!a) return ''
    return `${a.method ?? ''}:${(a.rIn ?? 0).toFixed(2)}:${(a.rOut ?? 0).toFixed(2)}`
  })()

  const totalValue = typeof ctx.totalCFP === 'number' ? ctx.totalCFP : ctx.totalCFP?.value ?? 0
  const total = totalValue.toFixed(4)
  const boundary = ctx.systemBoundary ?? ''

  const serialized = [
    `total=${total}`,
    `boundary=${boundary}`,
    `stages=${stages}`,
    `bom=${bomSummary}`,
    `alloc=${allocation}`,
  ].join('||')

  return djb2(serialized)
}

/**
 * 두 해시가 동일하면 narrative가 최신 상태.
 */
export function isContextHashStale(
  recordHash: string | undefined,
  currentHash: string
): boolean {
  // 해시가 없으면 stale로 간주 (구버전 record)
  if (!recordHash) return true
  return recordHash !== currentHash
}
