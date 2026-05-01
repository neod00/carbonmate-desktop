/**
 * narrative-sanitizer — AI 생성 narrative의 흔적 제거.
 *
 * GPT/Gemini 등의 출력에 흔히 섞이는 노이즈:
 *  - URL 추적 파라미터 (?utm_source=openai 등)
 *  - 프롬프트 노출형 어투 ("사용자가", "본 컨텍스트에는")
 *  - 모호한 hedging ("수%~수십% 범위")
 *
 * 검증심사원이 보는 보고서에는 이런 흔적이 남아서는 안 된다.
 * narrative-store 저장 시점과 보고서 출력 시점 양쪽에서 호출.
 */
import type { NarrativeCitation } from '@lca/shared'

/** URL 쿼리 파라미터 중 추적·분석용 키 (제거 대상) */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'source',
]

/** 본문 치환 규칙 — [정규식, 대체 문자열] 페어 */
const TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  // 프롬프트 노출형 화자 표현 — "사용자"는 보고서에 등장해선 안 됨
  [/사용자가\s*제공한/g, '의뢰자가 제공한'],
  [/사용자가\s*제시한/g, '의뢰자가 제시한'],
  [/사용자가\s*명시한\s*바와\s*같이/g, '의뢰자가 명시한 바와 같이'],
  [/사용자가\s*명시한/g, '의뢰자가 명시한'],
  [/사용자가\s*입력한/g, '의뢰자가 입력한'],
  [/사용자\s*입력/g, '의뢰자 입력'],

  // AI 컨텍스트 메타 표현 — 보고서가 아니라 채팅 어투
  [/본\s*컨텍스트에는?/g, '본 산정에서는'],
  [/본\s*컨텍스트에서는?/g, '본 산정에서는'],
  [/주어진\s*컨텍스트에서는?/g, '본 산정에서는'],
  [/제공된\s*컨텍스트에서는?/g, '본 산정에서는'],

  // 모호 hedging — 검증심사원이 가장 싫어하는 표현
  [/대략\s*수%~수십%\s*범위/g, '추정 변동 범위'],
  [/수%~수십%\s*범위/g, '추정 변동 범위'],
  [/수%\s*수준/g, '소폭'],
  [/대략\s*수%/g, '소폭'],
  [/한\s*자릿수\s*%에서\s*두\s*자릿수\s*%까지/g, '유의 수준의'],
  [/대략적으로\s*판단/g, '판단'],

  // P2-25: 단위 표기 통일 — 표지·§5.1과 동일 형식 'kg CO₂e' 로 정규화
  //   AI가 'kgCO2e', 'kg CO2e', 'kgCO₂e' 등 변종을 생성하므로 일괄 치환.
  [/(\d+(?:\.\d+)?)\s*kgCO2e/g, '$1 kg CO₂e'],
  [/(\d+(?:\.\d+)?)\s*kg\s*CO2e/g, '$1 kg CO₂e'],
  [/(\d+(?:\.\d+)?)\s*kgCO₂e/g, '$1 kg CO₂e'],
  [/(\d+(?:\.\d+)?)\s*kg\s*CO₂eq?\b/g, '$1 kg CO₂e'],
  [/\bkgCO2e\b/g, 'kg CO₂e'],
  [/\bkg\s*CO2e\b/g, 'kg CO₂e'],
  [/\bkgCO₂e\b/g, 'kg CO₂e'],
  [/\bCO2e\b/g, 'CO₂e'],
]

/**
 * URL에서 추적 파라미터를 제거.
 * - 알려진 호스트가 아니어도 동작 (단순 query string 파싱)
 * - 잘못된 URL이면 원본 반환
 */
export function stripTrackingParams(url: string): string {
  if (!url) return url
  try {
    // URL 객체로 파싱 — 상대경로면 throw
    const parsed = new URL(url)
    for (const key of TRACKING_PARAMS) {
      parsed.searchParams.delete(key)
    }
    // 빈 query string이면 ? 도 제거
    const result = parsed.toString()
    return result.endsWith('?') ? result.slice(0, -1) : result
  } catch {
    // URL 파싱 실패 — 정규식 fallback
    let cleaned = url
    for (const key of TRACKING_PARAMS) {
      cleaned = cleaned
        .replace(new RegExp(`[?&]${key}=[^&#]*`, 'g'), '')
        .replace(/[?&]+/g, (match, offset) => (offset === cleaned.indexOf('?') ? '?' : '&'))
        .replace(/\?&/, '?')
        .replace(/[?&]$/, '')
    }
    return cleaned
  }
}

/**
 * 본문 텍스트에서 AI 흔적 + 인라인 URL의 추적 파라미터 제거.
 */
export function sanitizeText(text: string): string {
  if (!text) return text
  let result = text

  // 1. 본문 표현 치환
  for (const [pattern, replacement] of TEXT_REPLACEMENTS) {
    result = result.replace(pattern, replacement)
  }

  // 2. 인라인 URL의 추적 파라미터 제거
  //    Markdown 링크 [label](url) 형태 + 평문 URL 모두 처리
  result = result.replace(/\((https?:\/\/[^\s)]+)\)/g, (_, url: string) => `(${stripTrackingParams(url)})`)
  result = result.replace(/(?<![\(\[])(https?:\/\/[^\s\)\]]+)/g, (url: string) => stripTrackingParams(url))

  return result
}

/**
 * Citation 객체 정화 — URL의 추적 파라미터 제거.
 */
export function sanitizeCitation(citation: NarrativeCitation): NarrativeCitation {
  return {
    ...citation,
    url: stripTrackingParams(citation.url),
  }
}

/**
 * paragraphs 배열 + citations 배열을 한 번에 정화.
 * narrative-store.saveRecord / report DOCX 삽입 직전에 호출.
 */
export function sanitizeNarrativePayload<T extends { paragraphs: string[]; citations: NarrativeCitation[] }>(
  payload: T
): T {
  return {
    ...payload,
    paragraphs: payload.paragraphs.map((p) => sanitizeText(p)),
    citations: payload.citations.map(sanitizeCitation),
  }
}
