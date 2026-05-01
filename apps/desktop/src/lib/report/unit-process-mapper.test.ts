/**
 * unit-process-mapper 회귀 테스트.
 *
 * P0-C 회귀 방어: r1 보고서 §3.6 표에서 조황산니켈(EF=0)이
 *   "1450.0000 kgCO₂e / 190.9% 기여도" 로 잘못 표시된 버그.
 *
 * 원인: `mat.customEmissionFactor || 1` — `||` 연산자가 0을 falsy로 보고
 *       1로 fallback → quantity × 1 = 가짜 배출량.
 *
 * 수정: `?? 0` 사용 + emission ≤ 0 항목은 단위공정에서 제외.
 */
import { describe, it, expect } from 'vitest'
import { analyzeUnitProcesses } from './unit-process-mapper'

/**
 * 최소한의 PCFState 모형 — analyzeUnitProcesses가 필요로 하는 필드만 채움.
 */
function makeState(rawMaterials: Array<{ id: string; name: string; quantity: number; customEmissionFactor?: number }>): any {
  return {
    detailedActivityData: {
      raw_materials: rawMaterials,
    },
    dataQualityMeta: {
      sources: ['국가 LCI DB'],
      overallType: 'secondary',
    },
  }
}

function makeResult(stageEmissions: Record<string, number>, totalEmission: number): any {
  return {
    totalEmission,
    stageResults: Object.fromEntries(
      Object.entries(stageEmissions).map(([k, v]) => [k, { total: v }])
    ),
    allocation: undefined,
  }
}

describe('analyzeUnitProcesses — P0-C 컬럼 매핑 버그 회귀', () => {
  it('EF=0인 cut-off 원료(조황산니켈)는 단위공정에서 제외되어야 함', () => {
    const state = makeState([
      { id: 'crude_niso4', name: '조황산니켈(Crude NiSO₄)', quantity: 1450, customEmissionFactor: 0 },
      { id: 'naoh', name: 'NaOH (50% 용액, 중화)', quantity: 150, customEmissionFactor: 1.12 },
    ])
    const result = makeResult({ raw_materials: 168, manufacturing: 591.72 }, 759.72)

    const analysis = analyzeUnitProcesses(state, result)

    // 조황산니켈은 EF=0이므로 단위공정 목록에서 제외되어야 함
    const crude = analysis.unitProcesses.find((p) => p.id === 'up_crude_niso4')
    expect(crude).toBeUndefined()

    // NaOH는 정상적으로 포함되어야 함
    const naoh = analysis.unitProcesses.find((p) => p.id === 'up_naoh')
    expect(naoh).toBeDefined()
    expect(naoh!.emission).toBeCloseTo(168, 2)
    expect(naoh!.contribution).toBeCloseTo(22.1, 1)
  })

  it('어떤 단위공정도 100%를 초과하는 기여도를 가질 수 없음', () => {
    const state = makeState([
      { id: 'crude_niso4', name: '조황산니켈', quantity: 1450, customEmissionFactor: 0 },
      { id: 'naoh', name: 'NaOH', quantity: 150, customEmissionFactor: 1.12 },
      { id: 'h2so4', name: 'H2SO4', quantity: 30, customEmissionFactor: 0.18 },
      { id: 'h2o2', name: 'H2O2', quantity: 20, customEmissionFactor: 1.5 },
    ])
    const result = makeResult({ raw_materials: 203.4, manufacturing: 556.32 }, 759.72)

    const analysis = analyzeUnitProcesses(state, result)

    for (const proc of analysis.unitProcesses) {
      expect(proc.contribution).toBeLessThanOrEqual(100)
      expect(proc.contribution).toBeGreaterThanOrEqual(0)
    }
  })

  it('customEmissionFactor가 undefined인 항목도 단위공정에서 제외', () => {
    const state = makeState([
      { id: 'unknown', name: '미입력 원료', quantity: 100 /* EF undefined */ },
      { id: 'naoh', name: 'NaOH', quantity: 150, customEmissionFactor: 1.12 },
    ])
    const result = makeResult({ raw_materials: 168 }, 168)

    const analysis = analyzeUnitProcesses(state, result)

    // customEmissionFactor 미입력 항목은 emission=0이 되어 제외
    expect(analysis.unitProcesses.find((p) => p.id === 'up_unknown')).toBeUndefined()
    expect(analysis.unitProcesses.find((p) => p.id === 'up_naoh')).toBeDefined()
  })

  it('quantity=0 항목도 단위공정에서 제외', () => {
    const state = makeState([
      { id: 'zero_qty', name: '입력 안 함', quantity: 0, customEmissionFactor: 1.5 },
      { id: 'naoh', name: 'NaOH', quantity: 150, customEmissionFactor: 1.12 },
    ])
    const result = makeResult({ raw_materials: 168 }, 168)

    const analysis = analyzeUnitProcesses(state, result)

    expect(analysis.unitProcesses.find((p) => p.id === 'up_zero_qty')).toBeUndefined()
    expect(analysis.unitProcesses.find((p) => p.id === 'up_naoh')).toBeDefined()
  })

  it('r1 토리컴 황산니켈 시나리오 — significantProcesses에 잘못된 항목 없음', () => {
    // r1 보고서 §3.6에서 잘못 표시되었던 정확한 입력값 재현
    const state = makeState([
      { id: 'crude_niso4', name: '조황산니켈(Crude NiSO₄) 투입', quantity: 1450, customEmissionFactor: 0 },
      { id: 'naoh', name: 'NaOH (50% 용액, 중화)', quantity: 150, customEmissionFactor: 1.12 },
      { id: 'h2so4', name: 'H₂SO₄ (98%, pH 조정)', quantity: 30, customEmissionFactor: 0.18 },
      { id: 'h2o2', name: 'H₂O₂ (35%, Fe 산화)', quantity: 20, customEmissionFactor: 1.5 },
      { id: 'water', name: '정제수', quantity: 2000, customEmissionFactor: 0.0003 },
      { id: 'pac', name: '응집제(폴리머/PAC)', quantity: 5, customEmissionFactor: 0.6 },
    ])
    const result = makeResult({ raw_materials: 207.9, manufacturing: 511.34, transport: 40.48 }, 759.72)

    const analysis = analyzeUnitProcesses(state, result)

    // 조황산니켈은 절대로 significantProcesses에 들어가서는 안 됨 (EF=0)
    const crudeInSignificant = analysis.significantProcesses.find((p) =>
      p.nameKo.includes('조황산니켈')
    )
    expect(crudeInSignificant).toBeUndefined()

    // 모든 significant 기여도는 100% 이하
    for (const proc of analysis.significantProcesses) {
      expect(proc.contribution).toBeLessThanOrEqual(100)
    }
  })
})
