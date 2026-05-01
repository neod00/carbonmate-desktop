/**
 * material-balance — 물질수지 검증 helper.
 *
 * P0-D 회귀 방어:
 *   r1 보고서 §3.4 물질수지 표에서
 *     "총 투입 3,658 kg / 산출 1,000 kg / 차이 2,658 kg / 차이율 72.7% / ⚠️"
 *   라는 워닝이 그대로 노출됨.
 *
 *   원인: 정제수·공업용수가 BOM 합산에 포함되어 단순 산술 차이가 큼.
 *         실제 공정에서는 물의 일부는 결정수로 흡수, 일부는 폐수/증발로 분배되므로
 *         "총 투입 vs 제품 산출" 의 1:1 비교는 부적합.
 *
 *   해결: 물 항목을 분리하여 두 가지 관점으로 검증.
 *     1. 무수 기준(dry-basis): 물 제외 BOM vs 제품 + 폐기물
 *     2. 수분 흐름(water-flow): 입력 물 vs 결정수 추정 + 외부 폐수 (참고용)
 */

/**
 * 항목 이름이 "물"에 해당하는지 판별.
 * - 한국어: 정제수, 공업용수, 용수, 물, 순수
 * - 영어: water, deionised water, demineralized water, tap water, process water
 *
 * 화학식 H2O 단독 항목도 매칭. NaOH·H2O 같이 결합된 화합물은 매칭 안 됨.
 */
export function isWaterMaterial(name: string): boolean {
  if (!name) return false
  const normalized = name.toLowerCase().trim()

  // 한국어 키워드 (단어 경계 고려)
  const koreanKeywords = ['정제수', '공업용수', '냉각수', '순수', '용수', '담수']
  for (const kw of koreanKeywords) {
    if (normalized.includes(kw)) return true
  }

  // "물" 단독 또는 "○○물" 형태 — 단, "폐기물", "산출물", "투입물", "보조물" 등 제외
  if (/^물$|^물\s|^.+용?\s*물$/.test(name) && !/(폐기|산출|투입|보조|구성)물/.test(name)) {
    return true
  }

  // 영어 키워드
  const englishKeywords = [
    'deionised water',
    'deionized water',
    'demineralized water',
    'demineralised water',
    'tap water',
    'process water',
    'cooling water',
    'industrial water',
    'fresh water',
    'water (',
  ]
  for (const kw of englishKeywords) {
    if (normalized.includes(kw)) return true
  }

  // 단순 "water" 단독 단어 (다른 단어의 일부가 아닐 때)
  if (/\bwater\b/i.test(normalized) && !/wastewater|waste\s*water/i.test(normalized)) {
    return true
  }

  return false
}

/**
 * 화학량론 어떤 행이 단위 m³ 인 경우 kg으로 환산.
 * 물 1 m³ = 1000 kg (밀도 1).
 */
export function normalizeMassToKg(quantity: number, unit: string | undefined): number {
  if (!unit) return quantity
  const u = unit.trim().toLowerCase()
  if (u === 'kg') return quantity
  if (u === 't' || u === 'ton' || u === '톤') return quantity * 1000
  if (u === 'g') return quantity / 1000
  if (u === 'm³' || u === 'm3' || u === '㎥') return quantity * 1000 // 물 가정
  if (u === 'l' || u === '리터') return quantity // 물 가정 (1 L ≈ 1 kg)
  return quantity
}

export interface MaterialBalanceItem {
  name: string
  quantity: number
  unit?: string
}

export interface MaterialBalanceResult {
  /** 무수 기준 (물 제외) */
  dryBasis: {
    inputKg: number
    outputKg: number
    diffKg: number
    diffPct: number
    /** ✅ 정합 / ℹ️ 일반적 범위 / ⚠️ 검토 필요 */
    verdict: 'ok' | 'normal' | 'warning'
    verdictText: string
  }
  /** 수분 흐름 (참고용) */
  waterFlow: {
    inputKg: number
    /** 결정수 추정 (제품 질량의 default 0; 화학식 알려지지 않으면 0) */
    crystalWaterKg: number
    /** 산출 폐수 + 증발 추정 = 입력 물 - 결정수 */
    effluentEstimateKg: number
    note: string
  }
  /** 표시용 메타 */
  hasWaterItems: boolean
}

interface ComputeOpts {
  /** 1 ton 산출 기준 (default 1000 kg). 선언단위가 다르면 호출 측에서 변환. */
  productKg?: number
  /** 산출 폐기물 합 (kg) — 슬러지, 일반/지정 폐기물 등 */
  outputWasteKg?: number
  /** 산출 폐수 (m³). 외부 시스템으로 빠지는 폐수 — 시스템 경계 외 */
  effluentVolumeM3?: number
  /** 결정수 비율 (0~1). 예: NiSO₄·6H₂O = 6×18 / 263 ≈ 0.41
   *  알려지지 않으면 0으로 두고 보고서에 "추정 미실시" 표기. */
  crystalWaterFraction?: number
}

/**
 * BOM 항목들로부터 무수 기준 + 수분 흐름 두 관점의 물질수지 계산.
 */
export function computeMaterialBalance(
  items: MaterialBalanceItem[],
  opts: ComputeOpts = {}
): MaterialBalanceResult {
  const productKg = opts.productKg ?? 1000
  const outputWasteKg = opts.outputWasteKg ?? 0
  const effluentVolumeM3 = opts.effluentVolumeM3 ?? 0
  const crystalWaterFraction = opts.crystalWaterFraction ?? 0

  let inputDryKg = 0
  let inputWaterKg = 0
  let hasWaterItems = false

  for (const item of items) {
    const massKg = normalizeMassToKg(item.quantity || 0, item.unit)
    if (isWaterMaterial(item.name)) {
      inputWaterKg += massKg
      hasWaterItems = true
    } else {
      inputDryKg += massKg
    }
  }

  // 무수 출력 = 무수 제품 + 무수 폐기물
  // 결정수가 있으면 제품 질량의 일부는 물 → 무수 제품에서 제외
  const productDryKg = productKg * (1 - crystalWaterFraction)
  const outputDryKg = productDryKg + outputWasteKg
  const dryDiff = inputDryKg - outputDryKg
  const dryDiffPct = inputDryKg > 0 ? (dryDiff / inputDryKg) * 100 : 0

  // 무수 기준 검증 의견
  let verdict: 'ok' | 'normal' | 'warning'
  let verdictText: string
  const absDiffPct = Math.abs(dryDiffPct)
  if (absDiffPct < 5) {
    verdict = 'ok'
    verdictText = '✅ 정합'
  } else if (absDiffPct < 50) {
    verdict = 'normal'
    verdictText = 'ℹ️ 화학반응 손실 (시약 → 폐수 용해 등) 일반적 범위'
  } else {
    verdict = 'warning'
    verdictText = '⚠️ 검토 필요 — 누락 산출물 또는 단위 오류 가능성'
  }

  // 수분 흐름
  const crystalWaterKg = productKg * crystalWaterFraction
  const effluentFromBom = Math.max(0, inputWaterKg - crystalWaterKg)
  const effluentReportedKg = effluentVolumeM3 * 1000
  const effluentEstimateKg = effluentReportedKg > 0 ? effluentReportedKg : effluentFromBom

  let note: string
  if (!hasWaterItems) {
    note = '용수 입력 없음'
  } else if (crystalWaterFraction > 0) {
    note = `결정수 추정 ${crystalWaterKg.toFixed(0)} kg (제품 ${productKg.toFixed(0)} kg × ${(crystalWaterFraction * 100).toFixed(1)}%) + 폐수/증발 ${effluentEstimateKg.toFixed(0)} kg`
  } else {
    note = `폐수/증발 추정 ${effluentEstimateKg.toFixed(0)} kg (결정수 비율 미입력 — 보고서 §2.10 가정 참조)`
  }

  return {
    dryBasis: {
      inputKg: inputDryKg,
      outputKg: outputDryKg,
      diffKg: dryDiff,
      diffPct: dryDiffPct,
      verdict,
      verdictText,
    },
    waterFlow: {
      inputKg: inputWaterKg,
      crystalWaterKg,
      effluentEstimateKg,
      note,
    },
    hasWaterItems,
  }
}
