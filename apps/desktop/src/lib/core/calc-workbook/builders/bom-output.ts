/**
 * BOM 출력물 시트 — 제품 행만 (폐기물은 별도 시트로 라우팅).
 * Python PoC `build_bom_output` 1:1 포팅.
 */

import type { Worksheet } from 'exceljs'

import {
  BOM_OUT_DQI_COL,
  BOM_OUT_MONTH_FIRST_COL,
  BOM_OUT_MONTH_LAST_COL,
  BOM_OUT_NOTE_COL,
  BOM_OUT_SUM_COL,
  BOM_OUTPUT_HEADER_ROW,
  BOM_OUTPUT_HEADER_SUB_ROW,
  colLetter,
  KOREAN_MONTHS,
  SHEET_BOM_OUTPUT,
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
} from '../styles'
import type { BomItem, ProductCFP } from '../types'
import { HEADER_FONT_BOLD_VARIANT } from './shared-style-aliases'

export function buildBomOutput(
  ws: Worksheet,
  bomsByProduct: Record<string, BomItem[]>,
  products: ProductCFP[],
): Record<string, Record<number, number>> {
  ws.getColumn('A').width = 4
  ws.getColumn('B').width = 18
  ws.getColumn('C').width = 14
  ws.getColumn('D').width = 36
  ws.getColumn('E').width = 8
  for (let c = BOM_OUT_MONTH_FIRST_COL; c <= BOM_OUT_MONTH_LAST_COL; c += 1) {
    ws.getColumn(colLetter(c)).width = 9
  }
  ws.getColumn(colLetter(BOM_OUT_SUM_COL)).width = 12
  ws.getColumn(colLetter(BOM_OUT_DQI_COL)).width = 7
  ws.getColumn(colLetter(BOM_OUT_NOTE_COL)).width = 32

  const lastCol = BOM_OUT_NOTE_COL
  const titleCell = ws.getCell(1, 1)
  titleCell.value = '5. BOM — 출력물 (제품) — 월별 12 컬럼'
  titleCell.font = TITLE_FONT
  ws.mergeCells(1, 1, 1, lastCol)

  const HEADER_TOP = BOM_OUTPUT_HEADER_ROW
  const HEADER_SUB = BOM_OUTPUT_HEADER_SUB_ROW
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
  const monthGroup = ws.getCell(HEADER_TOP, BOM_OUT_MONTH_FIRST_COL)
  monthGroup.value = '월별 발생량 (kg / m³)'
  styleHeader(monthGroup)
  ws.mergeCells(HEADER_TOP, BOM_OUT_MONTH_FIRST_COL, HEADER_TOP, BOM_OUT_MONTH_LAST_COL)
  KOREAN_MONTHS.forEach((m, i) => {
    const c = ws.getCell(HEADER_SUB, BOM_OUT_MONTH_FIRST_COL + i)
    c.value = m
    styleHeader(c)
  })
  for (const [col, lbl] of [
    [BOM_OUT_SUM_COL, '합계 (=SUM)'],
    [BOM_OUT_DQI_COL, 'DQI'],
    [BOM_OUT_NOTE_COL, '비고'],
  ] as Array<[number, string]>) {
    const c = ws.getCell(HEADER_TOP, col)
    c.value = lbl
    styleHeader(c)
    ws.mergeCells(HEADER_TOP, col, HEADER_SUB, col)
  }

  const result: Record<string, Record<number, number>> = {}
  let r = HEADER_SUB + 1
  let seq = 1
  const sumFirst = colLetter(BOM_OUT_MONTH_FIRST_COL)
  const sumLast = colLetter(BOM_OUT_MONTH_LAST_COL)

  for (const p of products) {
    const bom = bomsByProduct[p.code] ?? []
    result[p.code] = {}
    const divider = ws.getCell(r, 1)
    divider.value = `▼ ${p.code}`
    divider.font = SUBTITLE_FONT
    ws.mergeCells(r, 1, r, lastCol)
    applyFill(divider, LIGHT_GRAY_FILL)
    r += 1

    bom.forEach((it, fullIdx) => {
      if (it.direction !== 'output') return
      if (bomItemSheet(it) !== SHEET_BOM_OUTPUT) return

      const seqCell = ws.getCell(r, 1)
      seqCell.value = seq
      styleBody(seqCell, { numeric: true, format: '0' })
      const pCell = ws.getCell(r, 2)
      pCell.value = p.code
      styleBody(pCell)
      const catCell = ws.getCell(r, 3)
      catCell.value = it.category
      styleBody(catCell)
      const nameCell = ws.getCell(r, 4)
      nameCell.value = it.name
      styleBody(nameCell)
      const unitCell = ws.getCell(r, 5)
      unitCell.value = it.appliedUnit
      styleBody(unitCell)

      const monthly = it.collectedMonthly ?? Array<number>(12).fill(it.appliedQty / 12.0)
      monthly.forEach((mv, i) => {
        const c = ws.getCell(r, BOM_OUT_MONTH_FIRST_COL + i)
        c.value = mv
        styleBody(c, { numeric: true })
      })
      const sumCell = ws.getCell(r, BOM_OUT_SUM_COL)
      sumCell.value = { formula: `SUM(${sumFirst}${r}:${sumLast}${r})` }
      styleBody(sumCell, { numeric: true })
      sumCell.font = HEADER_FONT_BOLD_VARIANT
      const dqi = it.dqr.ter <= 2 && it.dqr.ger <= 2 ? 'M' : 'C'
      const dqiCell = ws.getCell(r, BOM_OUT_DQI_COL)
      dqiCell.value = dqi
      styleBody(dqiCell)
      const noteCell = ws.getCell(r, BOM_OUT_NOTE_COL)
      noteCell.value = it.note ?? ''
      styleBody(noteCell)

      if (it.category === '제품') {
        for (let col = 1; col <= lastCol; col += 1) {
          applyFill(ws.getCell(r, col), LIGHT_GRAY_FILL)
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
