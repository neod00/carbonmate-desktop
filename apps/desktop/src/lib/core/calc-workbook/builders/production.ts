/**
 * 제품 생산량 시트 빌더 — Python PoC `build_production` 1:1 포팅.
 *
 * KS I ISO 14067 §6.3.6 — 12개월 컬럼 + Q열 SUM (FU anchor).
 */

import type { Worksheet } from 'exceljs'

import {
  colLetter,
  KOREAN_MONTHS,
  PROD_MONTH_FIRST_COL,
  PROD_MONTH_LAST_COL,
  PROD_SUM_COL,
  PRODUCTION_HEADER_ROW,
  PRODUCTION_HEADER_SUB_ROW,
} from '../constants'
import { DEFAULT_MONTHLY_WEIGHTS_NISO4, expandMonthly } from '../monthly-expander'
import {
  applyPrintDefaults,
  HEADER_FONT_BOLD_VARIANT,
} from './shared-style-aliases'
import { LEFT_ALIGN, NOTE_FONT, styleBody, styleHeader, TITLE_FONT } from '../styles'
import type { ProductCFP } from '../types'

export interface ProductionBuildOptions {
  fuKgByProduct: Record<string, number>
  /** product.code → 12개월 가중치 (없으면 디폴트) */
  monthlyWeightsByProduct?: Record<string, number[]>
}

/** 반환: {product.code: fu_anchor_row} */
export function buildProduction(
  ws: Worksheet,
  products: ProductCFP[],
  opts: ProductionBuildOptions,
): Record<string, number> {
  ws.getColumn('A').width = 4
  ws.getColumn('B').width = 14
  ws.getColumn('C').width = 36
  ws.getColumn('D').width = 8
  for (let c = PROD_MONTH_FIRST_COL; c <= PROD_MONTH_LAST_COL; c += 1) {
    ws.getColumn(colLetter(c)).width = 9
  }
  ws.getColumn(colLetter(PROD_SUM_COL)).width = 13

  const lastCol = PROD_SUM_COL

  const titleCell = ws.getCell(1, 1)
  titleCell.value = '3. 제품 생산량 — 월별 12 컬럼 (FU 분모 = Q 열 합계)'
  titleCell.font = TITLE_FONT
  ws.mergeCells(1, 1, 1, lastCol)

  const HEADER_TOP = PRODUCTION_HEADER_ROW
  const HEADER_SUB = PRODUCTION_HEADER_SUB_ROW

  const fixedLeft: Array<[number, string]> = [
    [1, '순번'],
    [2, '제품구분'],
    [3, '제품명 (코드)'],
    [4, '단위'],
  ]
  for (const [col, lbl] of fixedLeft) {
    const cell = ws.getCell(HEADER_TOP, col)
    cell.value = lbl
    styleHeader(cell)
    ws.mergeCells(HEADER_TOP, col, HEADER_SUB, col)
  }
  const monthGroupCell = ws.getCell(HEADER_TOP, PROD_MONTH_FIRST_COL)
  monthGroupCell.value = '월별 생산량 (kg)'
  styleHeader(monthGroupCell)
  ws.mergeCells(HEADER_TOP, PROD_MONTH_FIRST_COL, HEADER_TOP, PROD_MONTH_LAST_COL)
  KOREAN_MONTHS.forEach((mlabel, i) => {
    const c = ws.getCell(HEADER_SUB, PROD_MONTH_FIRST_COL + i)
    c.value = mlabel
    styleHeader(c)
  })
  const sumHeaderCell = ws.getCell(HEADER_TOP, PROD_SUM_COL)
  sumHeaderCell.value = '합계 (=SUM, FU 기준)'
  styleHeader(sumHeaderCell)
  ws.mergeCells(HEADER_TOP, PROD_SUM_COL, HEADER_SUB, PROD_SUM_COL)

  const fuRows: Record<string, number> = {}
  let r = HEADER_SUB + 1
  const sumFirst = colLetter(PROD_MONTH_FIRST_COL)
  const sumLast = colLetter(PROD_MONTH_LAST_COL)
  products.forEach((p, i) => {
    const fu = opts.fuKgByProduct[p.code] ?? 1000.0
    const weights =
      opts.monthlyWeightsByProduct?.[p.code] ?? Array.from(DEFAULT_MONTHLY_WEIGHTS_NISO4)
    const monthly = expandMonthly(fu, weights)

    const seq = ws.getCell(r, 1)
    seq.value = i + 1
    styleBody(seq, { numeric: true, format: '0' })
    const cat = ws.getCell(r, 2)
    cat.value = '주제품'
    styleBody(cat)
    const name = ws.getCell(r, 3)
    name.value = `${p.displayName}  [${p.code}]`
    styleBody(name)
    const unit = ws.getCell(r, 4)
    unit.value = 'kg'
    styleBody(unit)
    monthly.forEach((mv, j) => {
      const c = ws.getCell(r, PROD_MONTH_FIRST_COL + j)
      c.value = mv
      styleBody(c, { numeric: true })
    })
    const sumCell = ws.getCell(r, PROD_SUM_COL)
    sumCell.value = { formula: `SUM(${sumFirst}${r}:${sumLast}${r})` }
    styleBody(sumCell, { numeric: true })
    sumCell.font = HEADER_FONT_BOLD_VARIANT
    fuRows[p.code] = r
    r += 1
  })

  const noteCell = ws.getCell(r + 1, 1)
  noteCell.value =
    '※ Q 열 (합계) 가 각 제품 CFP 시트의 N (FU 환산) 수식 분모로 참조됩니다. ' +
    '월별 셀을 사용자가 직접 수정해도 합계·CFP 모두 자동 갱신됩니다 (살아있는 수식).'
  noteCell.font = NOTE_FONT
  noteCell.alignment = LEFT_ALIGN
  ws.mergeCells(r + 1, 1, r + 1, lastCol)

  applyPrintDefaults(ws, true)

  return fuRows
}
