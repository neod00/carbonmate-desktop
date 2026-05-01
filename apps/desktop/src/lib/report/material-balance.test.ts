/**
 * material-balance 회귀 테스트.
 *
 * P0-D 회귀 방어: r1 보고서에서 정제수·공업용수가 BOM 합산에 포함되어
 *   "차이 2,658 kg / 차이율 72.7% / ⚠️ 수분 증발/Cut-off 검토 권고" 워닝이 노출된 사고.
 */
import { describe, it, expect } from 'vitest'
import {
  isWaterMaterial,
  normalizeMassToKg,
  computeMaterialBalance,
} from './material-balance'

describe('isWaterMaterial — 한국어 키워드', () => {
  it('정제수 ✓', () => expect(isWaterMaterial('정제수')).toBe(true))
  it('공업용수 ✓', () => expect(isWaterMaterial('공업용수')).toBe(true))
  it('순수 ✓', () => expect(isWaterMaterial('순수')).toBe(true))
  it('냉각수 ✓', () => expect(isWaterMaterial('냉각수')).toBe(true))
  it('용수 ✓', () => expect(isWaterMaterial('용수 (공정)')).toBe(true))

  it('NaOH (50% 용액, 중화) ✗ — 시약', () => expect(isWaterMaterial('NaOH (50% 용액, 중화)')).toBe(false))
  it('황산 ✗ — 시약', () => expect(isWaterMaterial('황산')).toBe(false))
  it('폐기물 ✗', () => expect(isWaterMaterial('폐기물 처리')).toBe(false))
})

describe('isWaterMaterial — 영어 키워드', () => {
  it('water ✓', () => expect(isWaterMaterial('Water (deionised)')).toBe(true))
  it('tap water ✓', () => expect(isWaterMaterial('tap water production, KR')).toBe(true))
  it('process water ✓', () => expect(isWaterMaterial('process water')).toBe(true))
  it('wastewater ✗', () => expect(isWaterMaterial('wastewater treatment')).toBe(false))
})

describe('normalizeMassToKg — 단위 환산', () => {
  it('kg → kg', () => expect(normalizeMassToKg(1000, 'kg')).toBe(1000))
  it('m³ → kg (물 가정)', () => expect(normalizeMassToKg(3, 'm³')).toBe(3000))
  it('m3 → kg (대체 표기)', () => expect(normalizeMassToKg(3, 'm3')).toBe(3000))
  it('ton → kg', () => expect(normalizeMassToKg(2, 'ton')).toBe(2000))
  it('g → kg', () => expect(normalizeMassToKg(500, 'g')).toBe(0.5))
  it('L → kg (물 가정)', () => expect(normalizeMassToKg(1000, 'L')).toBe(1000))
  it('단위 미입력 → 그대로', () => expect(normalizeMassToKg(150, undefined)).toBe(150))
})

describe('computeMaterialBalance — r1 토리컴 황산니켈 시나리오', () => {
  // r1 보고서의 정확한 입력값 재현
  const r1Bom = [
    { name: '조황산니켈(Crude NiSO₄) 투입', quantity: 1450, unit: 'kg' },
    { name: 'NaOH (50% 용액, 중화)', quantity: 150, unit: 'kg' },
    { name: 'H₂SO₄ (98%, pH 조정)', quantity: 30, unit: 'kg' },
    { name: 'H₂O₂ (35%, Fe 산화)', quantity: 20, unit: 'kg' },
    { name: '정제수', quantity: 2000, unit: 'kg' },
    { name: '응집제(폴리머/PAC)', quantity: 5, unit: 'kg' },
    { name: '공업용수', quantity: 3, unit: 'm³' },
  ]

  it('물 항목이 무수 BOM에서 분리되어야 함', () => {
    const result = computeMaterialBalance(r1Bom, {
      productKg: 1000,
      outputWasteKg: 80,
      effluentVolumeM3: 11,
    })

    // 무수 입력 = 1450 + 150 + 30 + 20 + 5 = 1655 kg
    expect(result.dryBasis.inputKg).toBeCloseTo(1655, 2)

    // 수분 입력 = 정제수 2000 + 공업용수 3 m³ × 1000 = 5000 kg
    expect(result.waterFlow.inputKg).toBeCloseTo(5000, 2)
    expect(result.hasWaterItems).toBe(true)
  })

  it('무수 차이율이 r1의 72.7% 보다 훨씬 작아야 함', () => {
    const result = computeMaterialBalance(r1Bom, {
      productKg: 1000,
      outputWasteKg: 80,
      effluentVolumeM3: 11,
    })
    // r1: 차이율 72.7% (워닝 노출)
    // 새 로직: 무수 기준 → 화학반응 손실 (시약→폐수 용해) 일반 범위 ~30-50%
    expect(Math.abs(result.dryBasis.diffPct)).toBeLessThan(72.7)
  })

  it('워닝 텍스트가 ⚠️ 가 아닌 ℹ️ 또는 ✅ 이어야 함', () => {
    const result = computeMaterialBalance(r1Bom, {
      productKg: 1000,
      outputWasteKg: 80,
      effluentVolumeM3: 11,
    })
    // r1의 ⚠️ 가 아닌 정보성 메시지여야 함
    expect(result.dryBasis.verdictText).not.toMatch(/⚠️/)
    expect(['ok', 'normal']).toContain(result.dryBasis.verdict)
  })

  it('수분 흐름 행이 별도 표시되어야 함', () => {
    const result = computeMaterialBalance(r1Bom, {
      productKg: 1000,
      outputWasteKg: 80,
      effluentVolumeM3: 11,
    })
    // 폐수 11 m³ = 11,000 kg 가 수분 흐름 추정에 사용
    expect(result.waterFlow.effluentEstimateKg).toBeCloseTo(11000, 2)
    expect(result.waterFlow.note).toContain('폐수/증발')
  })
})

describe('computeMaterialBalance — 정합 시나리오', () => {
  it('완벽한 무수 균형 → ✅ 정합', () => {
    const result = computeMaterialBalance(
      [
        { name: 'A', quantity: 500, unit: 'kg' },
        { name: 'B', quantity: 500, unit: 'kg' },
      ],
      { productKg: 1000, outputWasteKg: 0 }
    )
    expect(result.dryBasis.diffPct).toBe(0)
    expect(result.dryBasis.verdict).toBe('ok')
    expect(result.dryBasis.verdictText).toContain('✅')
  })

  it('무수 차이 5% 이내 → ✅', () => {
    const result = computeMaterialBalance(
      [{ name: 'A', quantity: 1030, unit: 'kg' }],
      { productKg: 1000, outputWasteKg: 0 }
    )
    expect(result.dryBasis.verdict).toBe('ok')
  })

  it('무수 차이 50% 초과 → ⚠️', () => {
    const result = computeMaterialBalance(
      [{ name: 'A', quantity: 5000, unit: 'kg' }],
      { productKg: 1000, outputWasteKg: 0 }
    )
    expect(result.dryBasis.verdict).toBe('warning')
    expect(result.dryBasis.verdictText).toContain('⚠️')
  })
})

describe('computeMaterialBalance — 결정수 비율 적용', () => {
  it('NiSO₄·6H₂O 결정수 비율 0.41 적용 시 무수 산출 감소', () => {
    const result = computeMaterialBalance(
      [
        { name: 'A', quantity: 600, unit: 'kg' },
        { name: '정제수', quantity: 500, unit: 'kg' },
      ],
      {
        productKg: 1000,
        outputWasteKg: 0,
        crystalWaterFraction: 0.41, // NiSO₄·6H₂O
      }
    )
    // 무수 제품 = 1000 × (1 - 0.41) = 590 kg
    expect(result.dryBasis.outputKg).toBeCloseTo(590, 1)
    // 결정수 = 1000 × 0.41 = 410 kg
    expect(result.waterFlow.crystalWaterKg).toBeCloseTo(410, 1)
  })
})
