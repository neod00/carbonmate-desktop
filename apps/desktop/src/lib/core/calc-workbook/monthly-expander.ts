/**
 * 월별 분해 — 연 합계를 12개월로 분해 (KS I ISO 14067 §6.3.6 시간 경계 충족)
 *
 * Python PoC 의 `_expand_monthly` / `_attach_monthly_to_bom` 1:1 포팅.
 */

import type { BomItem } from './types'

/**
 * 산업 평균 12개월 가중치 — 합계 12.0
 * 1·2월 설 연휴 ~5%↓, 6~8월 여름철 가동률 ~5%↑, 11~12월 ~5%↓
 */
export const DEFAULT_MONTHLY_WEIGHTS_NISO4: readonly number[] = [
  0.92, 0.92, 1.0, 1.04, 1.05, 1.06,
  1.05, 1.05, 1.02, 1.0, 0.95, 0.94,
] as const

/** Powder 변형 — 1Q 강세 (다른 시장 가정) */
export const DEFAULT_MONTHLY_WEIGHTS_POWDER: readonly number[] = [
  1.1, 1.05, 1.0, 0.98, 0.95, 0.93,
  0.92, 0.95, 1.0, 1.05, 1.05, 1.02,
] as const

const FLOAT_TOLERANCE = 1e-9

/** 가중치 합이 12.0 인지 검증 (tolerance 허용) */
export function validateWeights(weights: readonly number[]): void {
  if (weights.length !== 12) {
    throw new Error(`Monthly weights must have length 12, got ${weights.length}`)
  }
  const sum = weights.reduce((a, b) => a + b, 0)
  if (Math.abs(sum - 12.0) > FLOAT_TOLERANCE) {
    throw new Error(`Monthly weights must sum to 12.0, got ${sum}`)
  }
}

/**
 * 연 합계를 12개월로 분해. 반올림 오차는 마지막 월에 흡수.
 */
export function expandMonthly(
  annualTotal: number,
  weights: readonly number[] = DEFAULT_MONTHLY_WEIGHTS_NISO4,
): number[] {
  validateWeights(weights)
  const monthlyAvg = annualTotal / 12.0
  const raw = weights.map((w) => round(monthlyAvg * w, 4))
  const diff = round(annualTotal - raw.reduce((a, b) => a + b, 0), 4)
  raw[raw.length - 1] = round(raw[raw.length - 1] + diff, 4)
  return raw
}

/** 모든 BOM 항목에 monthly 분해를 부착 (in-place). null/undefined 인 항목만 채움. */
export function attachMonthlyToBom(
  bom: BomItem[],
  weights: readonly number[] = DEFAULT_MONTHLY_WEIGHTS_NISO4,
): void {
  for (const it of bom) {
    if (it.collectedMonthly == null) {
      it.collectedMonthly = expandMonthly(it.collectedQty, weights)
    }
    const monthlySum = it.collectedMonthly.reduce((a, b) => a + b, 0)
    const delta = Math.abs(monthlySum - it.collectedQty)
    const allowed = 0.01 + Math.abs(it.collectedQty) * 1e-4
    if (delta > allowed) {
      throw new Error(
        `월별 합계 불일치: "${it.name}" monthly_sum=${monthlySum} vs ` +
        `collectedQty=${it.collectedQty} (delta=${delta})`,
      )
    }
  }
}

function round(n: number, digits: number): number {
  const m = 10 ** digits
  return Math.round(n * m) / m
}
