/**
 * BomItem → 어느 시트에 들어가는지 분류 (Python PoC `_bom_item_sheet` 1:1 포팅)
 *
 *   '전기 사용량'   : input + 카테고리 '에너지' + 명칭에 '전력' 포함
 *   '폐기물 처리 실적': output + 카테고리 in WASTE_CATEGORIES
 *   'BOM 입력물'   : 기타 input
 *   'BOM 출력물'   : 기타 output (실질적으로 제품 행만)
 */

import {
  SHEET_BOM_INPUT,
  SHEET_BOM_OUTPUT,
  SHEET_ELECTRICITY,
  SHEET_WASTE,
  WASTE_CATEGORIES,
} from './constants'
import type { BomItem } from './types'

export function bomItemSheet(it: BomItem): string {
  if (it.direction === 'input') {
    if (it.category === '에너지' && it.name.includes('전력')) {
      return SHEET_ELECTRICITY
    }
    return SHEET_BOM_INPUT
  }
  if (WASTE_CATEGORIES.has(it.category)) {
    return SHEET_WASTE
  }
  return SHEET_BOM_OUTPUT
}

/** Stage 매핑 — Python `_build_stage_row_map` 1:1 포팅 */
const STAGE_CATEGORY_MAP: ReadonlyMap<string, readonly string[]> = new Map([
  ['원료 채취', ['원료물질', '유틸리티']],
  ['제조', ['에너지', '매립', '지정폐기물', '폐수']],
  ['운송', ['육상운송']],
  ['포장', ['포장']],
])

/** 전과정 단계명 → product CFP 시트의 행 번호 리스트 (LCIA cross-ref 합산용) */
export function buildStageRowMap(
  bom: BomItem[],
  productDataStartRow: number,
): Record<string, number[]> {
  const result: Record<string, number[]> = {}
  for (const stage of STAGE_CATEGORY_MAP.keys()) {
    result[stage] = []
  }
  bom.forEach((it, idx) => {
    const row = productDataStartRow + idx
    for (const [stage, cats] of STAGE_CATEGORY_MAP) {
      if (cats.includes(it.category)) {
        result[stage].push(row)
        break
      }
    }
  })
  return result
}
