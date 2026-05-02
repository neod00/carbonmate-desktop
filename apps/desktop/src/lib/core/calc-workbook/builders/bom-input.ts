/**
 * BOM 입력물 시트 — Python PoC `build_bom_input` 1:1 포팅.
 *
 * 12개월 컬럼 + 농도 cascade 살아있는 수식.
 * 전기 사용량으로 라우팅된 항목은 제외.
 */

import type { Worksheet } from 'exceljs'

import {
  BOM_IN_APPLY_COL,
  BOM_IN_CONC_COL,
  BOM_IN_DIST_COL,
  BOM_IN_DQI_COL,
  BOM_IN_MONTH_FIRST_COL,
  BOM_IN_MONTH_LAST_COL,
  BOM_IN_NOTE_COL,
  BOM_IN_QTY_COL,
  BOM_IN_SUM_COL,
  BOM_INPUT_HEADER_ROW,
  BOM_INPUT_HEADER_SUB_ROW,
  colLetter,
  KOREAN_MONTHS,
  SHEET_BOM_INPUT,
} from '../constants'
import { bomItemSheet } from '../sheet-router'
import {
  applyFill,
  applyPrintDefaults,
  LIGHT_GRAY_FILL,
  styleBody,
  styleHeader,
  SUBTITLE_FONT,
  TITLE_FONT,
  WARN_FILL,
} from '../styles'
import type { BomItem, ProductCFP } from '../types'
import { HEADER_FONT_BOLD_VARIANT } from './shared-style-aliases'

/** 반환: {product.code: {bom_index_in_full_list: row_number}} */
export function buildBomInput(
  ws: Worksheet,
  bomsByProduct: Record<string, BomItem[]>,
  products: ProductCFP[],
): Record<string, Record<number, number>> {
  ws.getColumn('A').width = 4
  ws.getColumn('B').width = 18
  ws.getColumn('C').width = 14
  ws.getColumn('D').width = 36
  ws.getColumn('E').width = 8
  for (let c = BOM_IN_MONTH_FIRST_COL; c <= BOM_IN_MONTH_LAST_COL; c += 1) {
    ws.getColumn(colLetter(c)).width = 9
  }
  ws.getColumn(colLetter(BOM_IN_SUM_COL)).width = 13
  ws.getColumn(colLetter(BOM_IN_CONC_COL)).width = 9
  ws.getColumn(colLetter(BOM_IN_APPLY_COL)).width = 9
  ws.getColumn(colLetter(BOM_IN_QTY_COL)).width = 12
  ws.getColumn(colLetter(BOM_IN_DIST_COL)).width = 11
  ws.getColumn(colLetter(BOM_IN_DQI_COL)).width = 7
  ws.getColumn(colLetter(BOM_IN_NOTE_COL)).width = 32

  const lastCol = BOM_IN_NOTE_COL
  const titleCell = ws.getCell(1, 1)
  titleCell.value = '4. BOM — 입력물 (원료/보조/유틸/연료/스팀/운송/포장) — 월별 12 컬럼'
  titleCell.font = TITLE_FONT
  ws.mergeCells(1, 1, 1, lastCol)

  const HEADER_TOP = BOM_INPUT_HEADER_ROW
  const HEADER_SUB = BOM_INPUT_HEADER_SUB_ROW

  const fixedLeft: Array<[number, string]> = [
    [1, '순번'],
    [2, '적용 제품'],
    [3, '분류'],
    [4, '명칭'],
    [5, '단위'],
  ]
  for (const [col, lbl] of fixedLeft) {
    const c = ws.getCell(HEADER_TOP, col)
    c.value = lbl
    styleHeader(c)
    ws.mergeCells(HEADER_TOP, col, HEADER_SUB, col)
  }
  const monthGroup = ws.getCell(HEADER_TOP, BOM_IN_MONTH_FIRST_COL)
  monthGroup.value = '월별 사용량 (kg / m³ / kWh / Nm³ / ton-km)'
  styleHeader(monthGroup)
  ws.mergeCells(HEADER_TOP, BOM_IN_MONTH_FIRST_COL, HEADER_TOP, BOM_IN_MONTH_LAST_COL)
  KOREAN_MONTHS.forEach((m, i) => {
    const c = ws.getCell(HEADER_SUB, BOM_IN_MONTH_FIRST_COL + i)
    c.value = m
    styleHeader(c)
  })
  const rightHeaders: Array<[number, string]> = [
    [BOM_IN_SUM_COL, '합계 (=SUM)'],
    [BOM_IN_CONC_COL, '농도 (%)'],
    [BOM_IN_APPLY_COL, '농도 적용'],
    [BOM_IN_QTY_COL, '적용수량'],
    [BOM_IN_DIST_COL, '운송거리(km)'],
    [BOM_IN_DQI_COL, 'DQI'],
    [BOM_IN_NOTE_COL, '비고'],
  ]
  for (const [col, lbl] of rightHeaders) {
    const c = ws.getCell(HEADER_TOP, col)
    c.value = lbl
    styleHeader(c)
    ws.mergeCells(HEADER_TOP, col, HEADER_SUB, col)
  }

  const result: Record<string, Record<number, number>> = {}
  let r = HEADER_SUB + 1
  let seq = 1
  const sumFirst = colLetter(BOM_IN_MONTH_FIRST_COL)
  const sumLast = colLetter(BOM_IN_MONTH_LAST_COL)
  const tLet = colLetter(BOM_IN_APPLY_COL)
  const rLet = colLetter(BOM_IN_SUM_COL)
  const sLet = colLetter(BOM_IN_CONC_COL)

  for (const p of products) {
    const bom = bomsByProduct[p.code] ?? []
    result[p.code] = {}

    // 제품 구분 행 (시각적 분리)
    const dividerCell = ws.getCell(r, 1)
    dividerCell.value = `▼ ${p.code}`
    dividerCell.font = SUBTITLE_FONT
    ws.mergeCells(r, 1, r, lastCol)
    applyFill(dividerCell, LIGHT_GRAY_FILL)
    r += 1

    bom.forEach((it, fullIdx) => {
      if (it.direction !== 'input') return
      if (bomItemSheet(it) !== SHEET_BOM_INPUT) return

      const seqCell = ws.getCell(r, 1)
      seqCell.value = seq
      styleBody(seqCell, { numeric: true, format: '0' })
      const productCell = ws.getCell(r, 2)
      productCell.value = p.code
      styleBody(productCell)
      const catCell = ws.getCell(r, 3)
      catCell.value = it.category
      styleBody(catCell)
      const nameCell = ws.getCell(r, 4)
      nameCell.value = it.name
      styleBody(nameCell)
      const unitCell = ws.getCell(r, 5)
      unitCell.value = it.collectedUnit
      styleBody(unitCell)

      // 월별
      const monthly = it.collectedMonthly ?? Array<number>(12).fill(it.collectedQty / 12.0)
      monthly.forEach((mv, i) => {
        const c = ws.getCell(r, BOM_IN_MONTH_FIRST_COL + i)
        c.value = mv
        styleBody(c, { numeric: true })
      })
      // R 합계 SUM 수식
      const sumCell = ws.getCell(r, BOM_IN_SUM_COL)
      sumCell.value = { formula: `SUM(${sumFirst}${r}:${sumLast}${r})` }
      styleBody(sumCell, { numeric: true })
      sumCell.font = HEADER_FONT_BOLD_VARIANT
      // S 농도
      const concCell = ws.getCell(r, BOM_IN_CONC_COL)
      concCell.value = it.concentrationPct
      styleBody(concCell, { numeric: true, format: '0.0' })
      // T 농도 적용
      const applyCell = ws.getCell(r, BOM_IN_APPLY_COL)
      applyCell.value = it.applyConcentration ? 'Y' : 'N'
      styleBody(applyCell)
      // U 적용수량
      const qtyCell = ws.getCell(r, BOM_IN_QTY_COL)
      qtyCell.value = {
        formula: `IF(${tLet}${r}="Y",${rLet}${r}*${sLet}${r}/100,${rLet}${r})`,
      }
      styleBody(qtyCell, { numeric: true })
      // V 운송거리
      const distCell = ws.getCell(r, BOM_IN_DIST_COL)
      if (it.transportDistanceKm) {
        distCell.value = it.transportDistanceKm
        styleBody(distCell, { numeric: true })
      } else {
        distCell.value = ''
        styleBody(distCell)
      }
      // W DQI
      const dqi = it.dqr.ter <= 2 && it.dqr.ger <= 2 ? 'M' : 'C'
      const dqiCell = ws.getCell(r, BOM_IN_DQI_COL)
      dqiCell.value = dqi
      styleBody(dqiCell)
      // X 비고
      const noteCell = ws.getCell(r, BOM_IN_NOTE_COL)
      noteCell.value = it.cutOff || it.note || ''
      styleBody(noteCell)
      if (it.cutOff) {
        for (let col = 1; col <= lastCol; col += 1) {
          applyFill(ws.getCell(r, col), WARN_FILL)
        }
      }

      result[p.code][fullIdx] = r
      r += 1
      seq += 1
    })
  }

  applyPrintDefaults(ws, true)
  return result
}
