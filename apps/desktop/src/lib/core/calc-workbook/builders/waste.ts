/**
 * 폐기물 처리 실적 시트 — KS I ISO 14067 §6.3.8 (폐기 시나리오).
 * Python PoC `build_waste` 1:1 포팅.
 */

import type { Worksheet } from 'exceljs'

import {
  colLetter,
  KOREAN_MONTHS,
  SHEET_WASTE,
  WASTE_DIST_COL,
  WASTE_DQI_COL,
  WASTE_FACILITY_COL,
  WASTE_HEADER_ROW,
  WASTE_HEADER_SUB_ROW,
  WASTE_MONTH_FIRST_COL,
  WASTE_MONTH_LAST_COL,
  WASTE_NOTE_COL,
  WASTE_SUM_COL,
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

export function buildWaste(
  ws: Worksheet,
  bomsByProduct: Record<string, BomItem[]>,
  products: ProductCFP[],
): Record<string, Record<number, number>> {
  ws.getColumn('A').width = 4
  ws.getColumn('B').width = 18
  ws.getColumn('C').width = 18
  ws.getColumn('D').width = 12
  ws.getColumn('E').width = 14
  ws.getColumn('F').width = 28
  ws.getColumn('G').width = 7
  for (let c = WASTE_MONTH_FIRST_COL; c <= WASTE_MONTH_LAST_COL; c += 1) {
    ws.getColumn(colLetter(c)).width = 9
  }
  ws.getColumn(colLetter(WASTE_SUM_COL)).width = 12
  ws.getColumn(colLetter(WASTE_FACILITY_COL)).width = 24
  ws.getColumn(colLetter(WASTE_DIST_COL)).width = 11
  ws.getColumn(colLetter(WASTE_DQI_COL)).width = 7
  ws.getColumn(colLetter(WASTE_NOTE_COL)).width = 30

  const lastCol = WASTE_NOTE_COL
  const titleCell = ws.getCell(1, 1)
  titleCell.value = '7. 폐기물 처리 실적 — 월별 12 컬럼 + 처리방법/업체/운송'
  titleCell.font = TITLE_FONT
  ws.mergeCells(1, 1, 1, lastCol)

  const HEADER_TOP = WASTE_HEADER_ROW
  const HEADER_SUB = WASTE_HEADER_SUB_ROW
  const fixedLeft: Array<[number, string]> = [
    [1, '순번'],
    [2, '적용 제품'],
    [3, '발생공정'],
    [4, '분류'],
    [5, '처리방법'],
    [6, '명칭'],
    [7, '단위'],
  ]
  for (const [col, lbl] of fixedLeft) {
    const c = ws.getCell(HEADER_TOP, col)
    c.value = lbl
    styleHeader(c)
    ws.mergeCells(HEADER_TOP, col, HEADER_SUB, col)
  }
  const monthGroup = ws.getCell(HEADER_TOP, WASTE_MONTH_FIRST_COL)
  monthGroup.value = '월별 발생량'
  styleHeader(monthGroup)
  ws.mergeCells(HEADER_TOP, WASTE_MONTH_FIRST_COL, HEADER_TOP, WASTE_MONTH_LAST_COL)
  KOREAN_MONTHS.forEach((m, i) => {
    const c = ws.getCell(HEADER_SUB, WASTE_MONTH_FIRST_COL + i)
    c.value = m
    styleHeader(c)
  })
  for (const [col, lbl] of [
    [WASTE_SUM_COL, '합계 (=SUM)'],
    [WASTE_FACILITY_COL, '처리업체'],
    [WASTE_DIST_COL, '운송거리(km)'],
    [WASTE_DQI_COL, 'DQI'],
    [WASTE_NOTE_COL, '비고'],
  ] as Array<[number, string]>) {
    const c = ws.getCell(HEADER_TOP, col)
    c.value = lbl
    styleHeader(c)
    ws.mergeCells(HEADER_TOP, col, HEADER_SUB, col)
  }

  const result: Record<string, Record<number, number>> = {}
  let r = HEADER_SUB + 1
  let seq = 1
  const sumFirst = colLetter(WASTE_MONTH_FIRST_COL)
  const sumLast = colLetter(WASTE_MONTH_LAST_COL)

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
      if (bomItemSheet(it) !== SHEET_WASTE) return

      const seqCell = ws.getCell(r, 1)
      seqCell.value = seq
      styleBody(seqCell, { numeric: true, format: '0' })
      const pCell = ws.getCell(r, 2)
      pCell.value = p.code
      styleBody(pCell)
      const procCell = ws.getCell(r, 3)
      procCell.value = '제품 생산 공정'
      styleBody(procCell)
      const catCell = ws.getCell(r, 4)
      catCell.value = it.category
      styleBody(catCell)
      const methodCell = ws.getCell(r, 5)
      methodCell.value = it.treatmentMethod ?? ''
      styleBody(methodCell)
      const nameCell = ws.getCell(r, 6)
      nameCell.value = it.name
      styleBody(nameCell)
      const unitCell = ws.getCell(r, 7)
      unitCell.value = it.appliedUnit
      styleBody(unitCell)

      const monthly = it.collectedMonthly ?? Array<number>(12).fill(it.appliedQty / 12.0)
      monthly.forEach((mv, i) => {
        const c = ws.getCell(r, WASTE_MONTH_FIRST_COL + i)
        c.value = mv
        styleBody(c, { numeric: true })
      })
      const sumCell = ws.getCell(r, WASTE_SUM_COL)
      sumCell.value = { formula: `SUM(${sumFirst}${r}:${sumLast}${r})` }
      styleBody(sumCell, { numeric: true })
      sumCell.font = HEADER_FONT_BOLD_VARIANT

      const facCell = ws.getCell(r, WASTE_FACILITY_COL)
      facCell.value = it.treatmentFacility ?? ''
      styleBody(facCell)
      const distCell = ws.getCell(r, WASTE_DIST_COL)
      if (it.treatmentDistanceKm) {
        distCell.value = it.treatmentDistanceKm
        styleBody(distCell, { numeric: true })
      } else {
        distCell.value = ''
        styleBody(distCell)
      }
      const dqi = it.dqr.ter <= 2 && it.dqr.ger <= 2 ? 'M' : 'C'
      const dqiCell = ws.getCell(r, WASTE_DQI_COL)
      dqiCell.value = dqi
      styleBody(dqiCell)
      const noteCell = ws.getCell(r, WASTE_NOTE_COL)
      noteCell.value = it.note ?? ''
      styleBody(noteCell)

      result[p.code][fullIdx] = r
      r += 1
      seq += 1
    })
  }

  applyPrintDefaults(ws, true)
  return result
}
