/**
 * KS I ISO 14067:2018 표준 요구사항 로더.
 * 원본 LRQA-formatted xlsx (260 행) 의 텍스트를 JSON 리소스로 임베드.
 */

import rowsJson from './ks-iso-14067-rows.json'
import type { KsRequirement } from './types'

export const KS_REQUIREMENTS: readonly KsRequirement[] = rowsJson as KsRequirement[]

/** 조항 prefix 별로 그룹화 — 보고서/매트릭스 출력 시 사용 */
export function groupByClausePrefix(): Record<string, KsRequirement[]> {
  const groups: Record<string, KsRequirement[]> = {}
  for (const r of KS_REQUIREMENTS) {
    const prefix = r.clause.split('.')[0] || ''
    if (!groups[prefix]) groups[prefix] = []
    groups[prefix].push(r)
  }
  return groups
}

/** clause 정확히 일치하는 요구사항 (있으면 첫 번째 반환) */
export function findByClause(clause: string): KsRequirement | undefined {
  return KS_REQUIREMENTS.find((r) => r.clause === clause)
}
