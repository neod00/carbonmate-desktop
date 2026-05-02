/**
 * 전기 사용량 시트 — KS I ISO 14067 §6.4.9.4 (전력 처리 4유형 분류 의무).
 * Python PoC `build_electricity` 1:1 포팅.
 */

import type { Worksheet } from 'exceljs'

import {
  colLetter,
  ELEC_DQI_COL,
  ELEC_HEADER_ROW,
  ELEC_HEADER_SUB_ROW,
  ELEC_MONTH_FIRST_COL,
  ELEC_MONTH_LAST_COL,
  ELEC_NOTE_COL,
  ELEC_SUM_COL,
  ELEC_SUPPLIER_COL,
  KOREAN_MONTHS,
  SHEET_ELECTRICITY,
} from '../constants'
import { bomItemSheet } from '../sheet-router'
import {
  applyFill,
  applyPrintDefaults,
  LEFT_ALIGN,
  LIGHT_GRAY_FILL,
  NOTE_FONT,
  styleBody,
  styleHeader,
  SUBTITLE_FONT,
  TITLE_FONT,
} from '../styles'
import type { BomItem, ProductCFP } from '../types'
import { HEADER_FONT_BOLD_VARIANT } from './shared-style-aliases'

export function buildElectricity(
  ws: Worksheet,
  bomsByProduct: Record<string, BomItem[]>,
  products: ProductCFP[],
): Record<string, Record<number, number>> {
  ws.getColumn('A').width = 4
  ws.getColumn('B').width = 18
  ws.getColumn('C').width = 30
  ws.getColumn('D').width = 14
  ws.getColumn('E').width = 7
  for (let c = ELEC_MONTH_FIRST_COL; c <= ELEC_MONTH_LAST_COL; c += 1) {
    ws.getColumn(colLetter(c)).width = 9
  }
  ws.getColumn(colLetter(ELEC_SUM_COL)).width = 13
  ws.getColumn(colLetter(ELEC_SUPPLIER_COL)).width = 30
  ws.getColumn(colLetter(ELEC_DQI_COL)).width = 7
  ws.getColumn(colLetter(ELEC_NOTE_COL)).width = 32

  const lastCol = ELEC_NOTE_COL
  const titleCell = ws.getCell(1, 1)
  titleCell.value = '6. 전기 사용량 — 월별 12 컬럼 (KS I ISO 14067 §6.4.9.4)'
  titleCell.font = TITLE_FONT
  ws.mergeCells(1, 1, 1, lastCol)

  const HEADER_TOP = ELEC_HEADER_ROW
  const HEADER_SUB = ELEC_HEADER_SUB_ROW
  const fixedLeft: Array<[number, string]> = [
    [1, '순번'],
    [2, '적용 제품'],
    [3, '사용처'],
    [4, '전원 구분'],
    [5, '단위'],
  ]
  for (const [col, lbl] of fixedLeft) {
    const c = ws.getCell(HEADER_TOP, col)
    c.value = lbl
    styleHeader(c)
    ws.mergeCells(HEADER_TOP, col, HEADER_SUB, col)
  }
  const monthGroup = ws.getCell(HEADER_TOP, ELEC_MONTH_FIRST_COL)
  monthGroup.value = '월별 사용량 (kWh)'
  styleHeader(monthGroup)
  ws.mergeCells(HEADER_TOP, ELEC_MONTH_FIRST_COL, HEADER_TOP, ELEC_MONTH_LAST_COL)
  KOREAN_MONTHS.forEach((m, i) => {
    const c = ws.getCell(HEADER_SUB, ELEC_MONTH_FIRST_COL + i)
    c.value = m
    styleHeader(c)
  })
  for (const [col, lbl] of [
    [ELEC_SUM_COL, '합계 (=SUM)'],
    [ELEC_SUPPLIER_COL, '공급자 / EF 출처'],
    [ELEC_DQI_COL, 'DQI'],
    [ELEC_NOTE_COL, '비고'],
  ] as Array<[number, string]>) {
    const c = ws.getCell(HEADER_TOP, col)
    c.value = lbl
    styleHeader(c)
    ws.mergeCells(HEADER_TOP, col, HEADER_SUB, col)
  }

  const result: Record<string, Record<number, number>> = {}
  let r = HEADER_SUB + 1
  let seq = 1
  const sumFirst = colLetter(ELEC_MONTH_FIRST_COL)
  const sumLast = colLetter(ELEC_MONTH_LAST_COL)

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
      if (bomItemSheet(it) !== SHEET_ELECTRICITY) return

      const seqCell = ws.getCell(r, 1)
      seqCell.value = seq
      styleBody(seqCell, { numeric: true, format: '0' })
      const pCell = ws.getCell(r, 2)
      pCell.value = p.code
      styleBody(pCell)
      const useCell = ws.getCell(r, 3)
      useCell.value = it.name
      styleBody(useCell)
      const srcCell = ws.getCell(r, 4)
      srcCell.value = it.powerSourceType ?? '외부그리드'
      styleBody(srcCell)
      const unitCell = ws.getCell(r, 5)
      unitCell.value = it.collectedUnit
      styleBody(unitCell)

      const monthly = it.collectedMonthly ?? Array<number>(12).fill(it.collectedQty / 12.0)
      monthly.forEach((mv, i) => {
        const c = ws.getCell(r, ELEC_MONTH_FIRST_COL + i)
        c.value = mv
        styleBody(c, { numeric: true })
      })
      const sumCell = ws.getCell(r, ELEC_SUM_COL)
      sumCell.value = { formula: `SUM(${sumFirst}${r}:${sumLast}${r})` }
      styleBody(sumCell, { numeric: true })
      sumCell.font = HEADER_FONT_BOLD_VARIANT

      const supCell = ws.getCell(r, ELEC_SUPPLIER_COL)
      supCell.value = it.powerSupplier ?? ''
      styleBody(supCell)
      const dqi = it.dqr.ter <= 2 && it.dqr.ger <= 2 ? 'M' : 'C'
      const dqiCell = ws.getCell(r, ELEC_DQI_COL)
      dqiCell.value = dqi
      styleBody(dqiCell)
      const noteCell = ws.getCell(r, ELEC_NOTE_COL)
      noteCell.value = it.note ?? ''
      styleBody(noteCell)

      result[p.code][fullIdx] = r
      r += 1
      seq += 1
    })
  }

  // 검증 노트 (§6.4.9.4 4 유형 분류)
  r += 1
  const noteLines = [
    '※ KS I ISO 14067 §6.4.9.4 — 전력 처리 4 유형 분류 의무',
    '  ① 외부그리드: 한국 평균(KECO) EF 적용 / ② 자체발전: 자체 LCI 데이터 수집',
    '  ③ 직접연결: 공급자 특정 EF / ④ REC인증재생: 5.12 중복배제 + 인증서 추적',
  ]
  for (const line of noteLines) {
    const c = ws.getCell(r, 1)
    c.value = line
    c.font = NOTE_FONT
    c.alignment = LEFT_ALIGN
    ws.mergeCells(r, 1, r, lastCol)
    r += 1
  }

  applyPrintDefaults(ws, true)
  return result
}
