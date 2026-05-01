/**
 * dqr-calculator — DQR Pedigree Matrix 계산 helper.
 *
 * P0-G 회귀 방어:
 *   r2 보고서 §6.5 narrative에서 "DQR 가중평균 2.5"로 기재되었으나,
 *   §6.2 표 14의 실제 계산 결과는 가중평균 3.5 (보통).
 *
 *   원인: build-narrative-context.ts가 DQR을 하드코딩 2.5로 설정하고
 *         AI에 prompt 전달.
 *
 *   해결: §6.2 표 생성과 동일한 계산 로직을 helper로 분리하여
 *         build-narrative-context 가 동일 로직 호출.
 */
import type { PCFState } from '@/lib/core/store'

export interface DQRRow {
  name: string
  tir: number
  ter: number
  ger: number
  average: number
  interpretation: '최우수' | '우수' | '보통' | '미흡'
}

export interface DQRSummary {
  rows: DQRRow[]
  weighted: {
    tir: number
    ter: number
    ger: number
    overall: number
    interpretation: '최우수' | '우수' | '보통' | '미흡'
  } | null
  hasData: boolean
}

function interpret(avg: number): '최우수' | '우수' | '보통' | '미흡' {
  if (avg <= 1.6) return '최우수'
  if (avg <= 2.5) return '우수'
  if (avg <= 3.5) return '보통'
  return '미흡'
}

/**
 * detailedActivityData.raw_materials 의 lciGuide.dataQuality 에서 DQR 계산.
 * §6.2 표 14 와 정확히 같은 로직.
 */
export function computeDQR(state: PCFState): DQRSummary {
  const mats = state.detailedActivityData?.raw_materials || []
  if (mats.length === 0) {
    return { rows: [], weighted: null, hasData: false }
  }

  const rows: DQRRow[] = mats.map((m) => {
    const dq = m.lciGuide?.dataQuality
    const tir = dq?.time ?? 3
    const ter = dq?.technology ?? 3
    const ger = dq?.geography ?? 3
    const average = (tir + ter + ger) / 3
    return {
      name: m.name,
      tir,
      ter,
      ger,
      average,
      interpretation: interpret(average),
    }
  })

  const sumTir = mats.reduce((a, m) => a + (m.lciGuide?.dataQuality?.time ?? 3), 0)
  const sumTer = mats.reduce((a, m) => a + (m.lciGuide?.dataQuality?.technology ?? 3), 0)
  const sumGer = mats.reduce((a, m) => a + (m.lciGuide?.dataQuality?.geography ?? 3), 0)
  const avgTir = sumTir / mats.length
  const avgTer = sumTer / mats.length
  const avgGer = sumGer / mats.length
  const overall = (avgTir + avgTer + avgGer) / 3

  return {
    rows,
    weighted: {
      tir: avgTir,
      ter: avgTer,
      ger: avgGer,
      overall,
      interpretation: interpret(overall),
    },
    hasData: true,
  }
}

/**
 * 종합 불확실성 % 계산 — DQR 가중평균을 기준으로 추정.
 *
 * EU 배터리 규정 Ares(2024)/3131389 기준:
 *   DQR ≤ 2.0 → ±10%
 *   DQR ≤ 2.5 → ±15%
 *   DQR ≤ 3.0 → ±20%
 *   DQR ≤ 3.5 → ±25%
 *   DQR > 3.5 → ±30%
 */
export function estimateUncertaintyFromDQR(weightedDQR: number): number {
  if (weightedDQR <= 2.0) return 10
  if (weightedDQR <= 2.5) return 15
  if (weightedDQR <= 3.0) return 20
  if (weightedDQR <= 3.5) return 25
  return 30
}
