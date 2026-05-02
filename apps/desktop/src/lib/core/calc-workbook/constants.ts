/**
 * 워크북 레이아웃 상수 — Python PoC 와 컬럼 letter 동일하게 유지.
 * Cross-sheet 수식이 모두 이 상수 기반으로 생성되므로, 변경 시 모든 빌더 동시 업데이트 필요.
 */

// ============================================================================
// 시트 이름
// ============================================================================

export const SHEET_COVER = '표지'
export const SHEET_PRODUCTION = '제품 생산량'
export const SHEET_BOM_INPUT = 'BOM 입력물'
export const SHEET_BOM_OUTPUT = 'BOM 출력물'
export const SHEET_ELECTRICITY = '전기 사용량'
export const SHEET_WASTE = '폐기물 처리 실적'
export const SHEET_EF_DB = '사용한 2차 데이터 목록'
export const SHEET_LCIA = 'LCIA'
export const SHEET_SENSITIVITY = '민감도 분석'

// ============================================================================
// 한글 월 라벨
// ============================================================================

export const KOREAN_MONTHS: readonly string[] = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
] as const

// ============================================================================
// 제품 생산량 시트
// ============================================================================

export const PRODUCTION_HEADER_ROW = 2 // HEADER_TOP
export const PRODUCTION_HEADER_SUB_ROW = 3 // HEADER_SUB
export const PROD_MONTH_FIRST_COL = 5 // E
export const PROD_MONTH_LAST_COL = 16 // P
export const PROD_SUM_COL = 17 // Q — FU anchor 합계 셀

export const PROD_FU_ANCHOR_LETTER = 'Q'

// ============================================================================
// BOM 입력물 시트
// ============================================================================

export const BOM_INPUT_HEADER_ROW = 2
export const BOM_INPUT_HEADER_SUB_ROW = 3

export const BOM_IN_MONTH_FIRST_COL = 6 // F
export const BOM_IN_MONTH_LAST_COL = 17 // Q
export const BOM_IN_SUM_COL = 18 // R = SUM(F:Q)
export const BOM_IN_CONC_COL = 19 // S 농도(%)
export const BOM_IN_APPLY_COL = 20 // T 농도 적용 여부 (Y/N)
export const BOM_IN_QTY_COL = 21 // U 적용수량 = IF(T="Y", R*S/100, R)
export const BOM_IN_DIST_COL = 22 // V 운송거리(km)
export const BOM_IN_DQI_COL = 23 // W
export const BOM_IN_NOTE_COL = 24 // X

// ============================================================================
// BOM 출력물 시트 (제품만 — 폐기물은 별도 시트)
// ============================================================================

export const BOM_OUTPUT_HEADER_ROW = 2
export const BOM_OUTPUT_HEADER_SUB_ROW = 3

export const BOM_OUT_MONTH_FIRST_COL = 6 // F
export const BOM_OUT_MONTH_LAST_COL = 17 // Q
export const BOM_OUT_SUM_COL = 18 // R
export const BOM_OUT_DQI_COL = 19 // S
export const BOM_OUT_NOTE_COL = 20 // T

// ============================================================================
// 전기 사용량 시트
// ============================================================================

export const ELEC_HEADER_ROW = 2
export const ELEC_HEADER_SUB_ROW = 3

export const ELEC_MONTH_FIRST_COL = 6 // F
export const ELEC_MONTH_LAST_COL = 17 // Q
export const ELEC_SUM_COL = 18 // R
export const ELEC_SUPPLIER_COL = 19 // S
export const ELEC_DQI_COL = 20 // T
export const ELEC_NOTE_COL = 21 // U

// ============================================================================
// 폐기물 처리 실적 시트
// ============================================================================

export const WASTE_HEADER_ROW = 2
export const WASTE_HEADER_SUB_ROW = 3

export const WASTE_MONTH_FIRST_COL = 8 // H
export const WASTE_MONTH_LAST_COL = 19 // S
export const WASTE_SUM_COL = 20 // T
export const WASTE_FACILITY_COL = 21 // U
export const WASTE_DIST_COL = 22 // V
export const WASTE_DQI_COL = 23 // W
export const WASTE_NOTE_COL = 24 // X

// ============================================================================
// 사용한 2차 데이터 목록 시트
// ============================================================================

export const EF_DB_HEADER_ROW = 7
export const EF_DB_DATA_START_ROW = 8

/** ef_seq (1-base) → EF DB 시트의 절대 행 번호 */
export function efDbRow(efSeq: number): number {
  return EF_DB_DATA_START_ROW + (efSeq - 1)
}

// ============================================================================
// 제품별 CFP 시트
// ============================================================================

export const PRODUCT_CFP_DATA_START_ROW = 4

// ============================================================================
// 폐기물 카테고리 (라우팅용)
// ============================================================================

export const WASTE_CATEGORIES: ReadonlySet<string> = new Set([
  '매립',
  '지정폐기물',
  '폐수',
  '소각',
  '재활용',
  '위탁처리',
])

// ============================================================================
// 컬럼 인덱스 → letter 변환
// ============================================================================

/** 1-base 컬럼 인덱스 → Excel letter (A, B, ..., AA, AB, ...) */
export function colLetter(idx: number): string {
  let result = ''
  let n = idx
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}
