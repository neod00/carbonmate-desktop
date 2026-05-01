/**
 * dqr-calculator 회귀 테스트.
 *
 * P0-G 회귀 방어: r2 보고서 §6.5 narrative "DQR 2.5" vs 표 14 "3.5" 모순.
 *   build-narrative-context.ts의 하드코딩 2.5를 §6.2 표와 동일 로직으로 통일.
 */
import { describe, it, expect } from 'vitest'
import { computeDQR, estimateUncertaintyFromDQR } from './dqr-calculator'

function makeState(rawMaterials: any[]): any {
  return {
    detailedActivityData: { raw_materials: rawMaterials },
  }
}

describe('computeDQR — §6.2 표 14와 동일 로직', () => {
  it('데이터 없으면 hasData=false', () => {
    const result = computeDQR(makeState([]))
    expect(result.hasData).toBe(false)
    expect(result.weighted).toBeNull()
  })

  it('각 재료의 TiR/TeR/GeR 평균 계산', () => {
    const result = computeDQR(makeState([
      { name: 'NaOH', lciGuide: { dataQuality: { time: 4, technology: 3, geography: 3 } } },
    ]))
    expect(result.rows[0].tir).toBe(4)
    expect(result.rows[0].ter).toBe(3)
    expect(result.rows[0].ger).toBe(3)
    expect(result.rows[0].average).toBeCloseTo(3.33, 2)
    expect(result.rows[0].interpretation).toBe('보통')
  })

  it('가중평균 = 모든 재료 평균', () => {
    const result = computeDQR(makeState([
      { name: 'A', lciGuide: { dataQuality: { time: 4, technology: 4, geography: 3 } } },
      { name: 'B', lciGuide: { dataQuality: { time: 4, technology: 3, geography: 3 } } },
    ]))
    expect(result.weighted!.tir).toBe(4)
    expect(result.weighted!.ter).toBe(3.5)
    expect(result.weighted!.ger).toBe(3)
    expect(result.weighted!.overall).toBeCloseTo(3.5, 1)
  })

  it('r2 시나리오 — 가중평균 3.5 (보통) 재현', () => {
    // r2 보고서 §6.2 표 14의 실제 값
    const result = computeDQR(makeState([
      { name: '조황산니켈', lciGuide: { dataQuality: { time: 4, technology: 4, geography: 3 } } },
      { name: '배터리슬러지', lciGuide: { dataQuality: { time: 4, technology: 4, geography: 3 } } },
      { name: 'NaOH', lciGuide: { dataQuality: { time: 4, technology: 3, geography: 3 } } },
      { name: 'H2O2', lciGuide: { dataQuality: { time: 4, technology: 3, geography: 3 } } },
      { name: 'H2SO4', lciGuide: { dataQuality: { time: 4, technology: 4, geography: 2 } } },
      { name: '공업용수', lciGuide: { dataQuality: { time: 4, technology: 4, geography: 3 } } },
    ]))
    // r2: 가중평균 3.5, 보통
    expect(result.weighted!.overall).toBeGreaterThanOrEqual(3.0)
    expect(result.weighted!.overall).toBeLessThanOrEqual(3.7)
    // narrative가 절대로 2.5로 하드코딩되지 않도록 보장
    expect(result.weighted!.overall).not.toBe(2.5)
    expect(result.weighted!.interpretation).toBe('보통')
  })

  it('lciGuide 누락 항목은 default 3 사용', () => {
    const result = computeDQR(makeState([{ name: 'X' /* lciGuide 없음 */ }]))
    expect(result.rows[0].tir).toBe(3)
    expect(result.rows[0].ter).toBe(3)
    expect(result.rows[0].ger).toBe(3)
    expect(result.rows[0].average).toBe(3)
  })
})

describe('interpret — ILCD 척도', () => {
  it('1.33 → 최우수', () => {
    const r = computeDQR(makeState([
      { name: 'A', lciGuide: { dataQuality: { time: 1, technology: 1, geography: 2 } } },
    ]))
    expect(r.rows[0].interpretation).toBe('최우수')
  })

  it('2.5 → 우수', () => {
    const r = computeDQR(makeState([
      { name: 'A', lciGuide: { dataQuality: { time: 2, technology: 3, geography: 2 } } },
    ]))
    expect(r.rows[0].interpretation).toBe('우수')
  })

  it('3.5 → 보통', () => {
    const r = computeDQR(makeState([
      { name: 'A', lciGuide: { dataQuality: { time: 4, technology: 3, geography: 3 } } },
    ]))
    expect(r.rows[0].interpretation).toBe('보통')
  })

  it('4.0 → 미흡', () => {
    const r = computeDQR(makeState([
      { name: 'A', lciGuide: { dataQuality: { time: 4, technology: 4, geography: 4 } } },
    ]))
    expect(r.rows[0].interpretation).toBe('미흡')
  })
})

describe('estimateUncertaintyFromDQR — EU 배터리법 매핑', () => {
  it('DQR 1.5 → ±10%', () => expect(estimateUncertaintyFromDQR(1.5)).toBe(10))
  it('DQR 2.5 → ±15%', () => expect(estimateUncertaintyFromDQR(2.5)).toBe(15))
  it('DQR 3.0 → ±20%', () => expect(estimateUncertaintyFromDQR(3.0)).toBe(20))
  it('DQR 3.5 → ±25%', () => expect(estimateUncertaintyFromDQR(3.5)).toBe(25))
  it('DQR 4.0 → ±30%', () => expect(estimateUncertaintyFromDQR(4.0)).toBe(30))
})
