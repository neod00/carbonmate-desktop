/**
 * 제품별 CFP 시트 — Python PoC `build_product_cfp` 1:1 포팅 (차트 제외 v1).
 *
 * 27 컬럼 × N행:
 *   A 구분 / B 분류 / C 명칭
 *   D-E 데이터 수집 (단위, 수량 cross-ref)
 *   F-G 데이터 적용 (단위, 수량 cross-ref)
 *   H cut-off
 *   I-K activity name / flow / location (EF DB cross-ref)
 *   L EF (EF DB cross-ref)
 *   M-N 제품 (FU 단위, FU 환산량 = G/Q{anchor})
 *   O-Q 운송 (수단, 거리 cross-ref, ton-km 수식)
 *   R 비고 (cross-ref)
 *   S 배출량 = L*N
 *   T 기여도 = S/$S$total
 *   U-W DQR (TeR/GeR/TiR)
 *   X-Z 가중평균 DQR (= $T*U/V/W)
 *   AA 종합 DQR (합계 행만)
 *
 *   합계 행: SUM, AVERAGE
 *   검증 요약 + Cut-off 누적 표
 */

import type { Worksheet } from 'exceljs'

import {
  BOM_IN_DIST_COL,
  BOM_IN_NOTE_COL,
  BOM_IN_QTY_COL,
  BOM_IN_SUM_COL,
  BOM_OUT_NOTE_COL,
  BOM_OUT_SUM_COL,
  colLetter,
  efDbRow,
  ELEC_NOTE_COL,
  ELEC_SUM_COL,
  PROD_FU_ANCHOR_LETTER,
  PRODUCT_CFP_DATA_START_ROW,
  SHEET_BOM_INPUT,
  SHEET_BOM_OUTPUT,
  SHEET_EF_DB,
  SHEET_ELECTRICITY,
  SHEET_PRODUCTION,
  SHEET_WASTE,
  WASTE_NOTE_COL,
  WASTE_SUM_COL,
} from '../constants'
import { bomItemSheet } from '../sheet-router'
import {
  applyFill,
  applyPrintDefaults,
  LIGHT_GRAY_FILL,
  NOTE_FONT,
  styleBody,
  styleHeader,
  SUBTITLE_FONT,
  TITLE_FONT,
  WARN_FILL,
} from '../styles'
import type { BomItem, ProductCFP } from '../types'
import { HEADER_FONT_BOLD_VARIANT } from './shared-style-aliases'

interface HeaderSpec {
  col: number
  top: string
  sub: string // '' = 단일 머지
}

const HEADERS: HeaderSpec[] = [
  { col: 1, top: '구분', sub: '' },
  { col: 2, top: '분류', sub: '' },
  { col: 3, top: '명칭', sub: '' },
  { col: 4, top: '데이터 수집', sub: '단위' },
  { col: 5, top: '데이터 수집', sub: '수량' },
  { col: 6, top: '데이터 적용', sub: '단위' },
  { col: 7, top: '데이터 적용', sub: '수량' },
  { col: 8, top: 'cut-off rule', sub: '' },
  { col: 9, top: 'activity name', sub: '' },
  { col: 10, top: 'flow name', sub: '' },
  { col: 11, top: 'Location', sub: '' },
  { col: 12, top: 'EF (kgCO₂e/unit)', sub: '' },
  { col: 13, top: '제품', sub: 'FU 단위' },
  { col: 14, top: '제품', sub: 'FU 환산량' },
  { col: 15, top: '운송', sub: '운송수단' },
  { col: 16, top: '운송', sub: '운송거리(km)' },
  { col: 17, top: '운송', sub: 'ton-km' },
  { col: 18, top: '비고', sub: '' },
  { col: 19, top: '온실가스 배출량 (kgCO₂e)', sub: '' },
  { col: 20, top: '기여도', sub: '' },
  { col: 21, top: 'DQR', sub: 'TeR' },
  { col: 22, top: 'DQR', sub: 'GeR' },
  { col: 23, top: 'DQR', sub: 'TiR' },
  { col: 24, top: '가중평균 DQR', sub: 'TeR×T' },
  { col: 25, top: '가중평균 DQR', sub: 'GeR×T' },
  { col: 26, top: '가중평균 DQR', sub: 'TiR×T' },
]

const COL_WIDTHS: Record<number, number> = {
  1: 8, 2: 12, 3: 36, 4: 8, 5: 12, 6: 8, 7: 12, 8: 32, 9: 36, 10: 22, 11: 10,
  12: 12, 13: 8, 14: 12, 15: 12, 16: 10, 17: 10, 18: 28, 19: 14, 20: 9,
  21: 5, 22: 5, 23: 5, 24: 7, 25: 7, 26: 7, 27: 11,
}

interface BuildProductCfpOptions {
  product: ProductCFP
  bom: BomItem[]
  bomInputRows: Record<number, number>
  bomOutputRows: Record<number, number>
  electricityRows: Record<number, number>
  wasteRows: Record<number, number>
  fuAnchorRow: number
}

/** 반환: total_row (LCIA cross-ref 시 사용) */
export function buildProductCfp(ws: Worksheet, opts: BuildProductCfpOptions): number {
  const { product, bom, bomInputRows, bomOutputRows, electricityRows, wasteRows, fuAnchorRow } = opts

  // 컬럼 너비
  for (const [col, w] of Object.entries(COL_WIDTHS)) {
    ws.getColumn(colLetter(Number(col))).width = w
  }

  // 제목
  const titleCell = ws.getCell(1, 1)
  titleCell.value = `${product.displayName} 탄소발자국 산정 데이터`
  titleCell.font = TITLE_FONT
  ws.mergeCells(1, 1, 1, 26)

  // 헤더 — 그룹 머지
  const HEADER_TOP = 2
  const HEADER_SUB = 3
  const placedGroups = new Set<string>()
  const groupRanges: Record<string, [number, number]> = {
    '데이터 수집': [4, 5],
    '데이터 적용': [6, 7],
    제품: [13, 14],
    운송: [15, 17],
    DQR: [21, 23],
    '가중평균 DQR': [24, 26],
  }
  for (const h of HEADERS) {
    if (h.sub && groupRanges[h.top] && !placedGroups.has(h.top)) {
      const [sc, ec] = groupRanges[h.top]
      const groupCell = ws.getCell(HEADER_TOP, sc)
      groupCell.value = h.top
      styleHeader(groupCell)
      if (sc !== ec) {
        ws.mergeCells(HEADER_TOP, sc, HEADER_TOP, ec)
      }
      placedGroups.add(h.top)
      const subCell = ws.getCell(HEADER_SUB, h.col)
      subCell.value = h.sub
      styleHeader(subCell)
    } else if (h.sub && groupRanges[h.top] && placedGroups.has(h.top)) {
      const subCell = ws.getCell(HEADER_SUB, h.col)
      subCell.value = h.sub
      styleHeader(subCell)
    } else {
      const c = ws.getCell(HEADER_TOP, h.col)
      c.value = h.top
      styleHeader(c)
      ws.mergeCells(HEADER_TOP, h.col, HEADER_SUB, h.col)
    }
  }

  // FU anchor 위치 결정
  let fuRow: number | null = null
  bom.forEach((it, idx) => {
    if (it.direction === 'output' && it.category === '제품' && fuRow === null) {
      fuRow = PRODUCT_CFP_DATA_START_ROW + idx
    }
  })
  if (fuRow === null) {
    throw new Error('BOM에 output 제품 행이 없습니다 (FU anchor 필요)')
  }

  const totalRow = PRODUCT_CFP_DATA_START_ROW + bom.length
  const fuAnchorRef = `'${SHEET_PRODUCTION}'!${PROD_FU_ANCHOR_LETTER}${fuAnchorRow}`

  // 데이터 행
  bom.forEach((item, idx) => {
    const r = PRODUCT_CFP_DATA_START_ROW + idx
    const targetSheet = bomItemSheet(item)

    // 시트별 컬럼 letter 매핑
    let bomRow: number
    let bomSheet: string
    let collectedCol: string
    let appliedCol: string
    let noteCol: string

    if (targetSheet === SHEET_ELECTRICITY) {
      bomRow = electricityRows[idx]
      bomSheet = SHEET_ELECTRICITY
      collectedCol = colLetter(ELEC_SUM_COL)
      appliedCol = colLetter(ELEC_SUM_COL)
      noteCol = colLetter(ELEC_NOTE_COL)
    } else if (targetSheet === SHEET_WASTE) {
      bomRow = wasteRows[idx]
      bomSheet = SHEET_WASTE
      collectedCol = colLetter(WASTE_SUM_COL)
      appliedCol = colLetter(WASTE_SUM_COL)
      noteCol = colLetter(WASTE_NOTE_COL)
    } else if (item.direction === 'input') {
      bomRow = bomInputRows[idx]
      bomSheet = SHEET_BOM_INPUT
      collectedCol = colLetter(BOM_IN_SUM_COL)
      appliedCol = colLetter(BOM_IN_QTY_COL)
      noteCol = colLetter(BOM_IN_NOTE_COL)
    } else {
      bomRow = bomOutputRows[idx]
      bomSheet = SHEET_BOM_OUTPUT
      collectedCol = colLetter(BOM_OUT_SUM_COL)
      appliedCol = colLetter(BOM_OUT_SUM_COL)
      noteCol = colLetter(BOM_OUT_NOTE_COL)
    }

    // A 구분 / B 분류 / C 명칭
    ws.getCell(r, 1).value = item.direction
    ws.getCell(r, 2).value = item.category
    ws.getCell(r, 3).value = item.name
    // D-E 수집
    ws.getCell(r, 4).value = item.collectedUnit
    ws.getCell(r, 5).value = { formula: `'${bomSheet}'!${collectedCol}${bomRow}` }
    // F-G 적용
    ws.getCell(r, 6).value = item.appliedUnit
    ws.getCell(r, 7).value = { formula: `'${bomSheet}'!${appliedCol}${bomRow}` }
    // H cut-off
    ws.getCell(r, 8).value = item.cutOff || ''
    // I~L EF DB cross-ref
    if (item.efSeq > 0) {
      const efRow = efDbRow(item.efSeq)
      ws.getCell(r, 9).value = { formula: `'${SHEET_EF_DB}'!E${efRow}` }
      ws.getCell(r, 10).value = { formula: `'${SHEET_EF_DB}'!G${efRow}` }
      ws.getCell(r, 11).value = { formula: `'${SHEET_EF_DB}'!F${efRow}` }
      ws.getCell(r, 12).value = { formula: `'${SHEET_EF_DB}'!J${efRow}` }
    } else {
      ws.getCell(r, 9).value = '—'
      ws.getCell(r, 10).value = '—'
      ws.getCell(r, 11).value = '—'
      ws.getCell(r, 12).value = 0
    }
    // M FU 단위
    ws.getCell(r, 13).value = 'kg'
    // N FU 환산량
    if (r === fuRow) {
      ws.getCell(r, 14).value = 1
    } else {
      ws.getCell(r, 14).value = { formula: `G${r}/${fuAnchorRef}` }
    }
    // O-Q 운송
    ws.getCell(r, 15).value = item.transportMode ?? ''
    if (item.transportDistanceKm) {
      const distLetter = colLetter(BOM_IN_DIST_COL)
      ws.getCell(r, 16).value = { formula: `'${SHEET_BOM_INPUT}'!${distLetter}${bomRow}` }
      ws.getCell(r, 17).value = { formula: `N${r}*P${r}/1000` }
    } else {
      ws.getCell(r, 16).value = null
      ws.getCell(r, 17).value = null
    }
    // R 비고
    ws.getCell(r, 18).value = { formula: `'${bomSheet}'!${noteCol}${bomRow}` }
    // S 배출량
    if (item.direction === 'output' && item.category === '제품') {
      ws.getCell(r, 19).value = 0
    } else if (item.cutOff) {
      ws.getCell(r, 19).value = 0
    } else {
      ws.getCell(r, 19).value = { formula: `L${r}*N${r}` }
    }
    // T 기여도
    if (item.direction === 'output' && item.category === '제품') {
      ws.getCell(r, 20).value = '—'
    } else {
      ws.getCell(r, 20).value = { formula: `IFERROR(S${r}/$S$${totalRow},0)` }
    }
    // DQR
    ws.getCell(r, 21).value = item.dqr.ter
    ws.getCell(r, 22).value = item.dqr.ger
    ws.getCell(r, 23).value = item.dqr.tir
    // 가중평균
    if (item.direction === 'output' && item.category === '제품') {
      ws.getCell(r, 24).value = '—'
      ws.getCell(r, 25).value = '—'
      ws.getCell(r, 26).value = '—'
    } else {
      ws.getCell(r, 24).value = { formula: `IFERROR($T${r}*U${r},0)` }
      ws.getCell(r, 25).value = { formula: `IFERROR($T${r}*V${r},0)` }
      ws.getCell(r, 26).value = { formula: `IFERROR($T${r}*W${r},0)` }
    }

    // 셀 스타일
    for (let col = 1; col <= 26; col += 1) {
      const c = ws.getCell(r, col)
      const numericCols = new Set([5, 7, 12, 14, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26])
      const numeric = numericCols.has(col)
      let fmt = '#,##0.00###'
      if (col === 20) fmt = '0.00%'
      else if (col === 21 || col === 22 || col === 23) fmt = '0'
      else if (col === 12) fmt = '#,##0.0000'
      styleBody(c, { numeric, format: fmt })

      if (item.cutOff && col >= 1 && col <= 18) {
        applyFill(c, WARN_FILL)
      }
      if (item.direction === 'output' && item.category === '제품') {
        applyFill(c, LIGHT_GRAY_FILL)
      }
    }
  })

  // 합계 행
  const totalLabel = ws.getCell(totalRow, 1)
  totalLabel.value = '합계'
  styleHeader(totalLabel)
  ws.getCell(totalRow, 2).value = ''
  styleHeader(ws.getCell(totalRow, 2))
  ws.mergeCells(totalRow, 2, totalRow, 18)
  // S 합계
  const sCell = ws.getCell(totalRow, 19)
  sCell.value = {
    formula: `SUM(S${PRODUCT_CFP_DATA_START_ROW}:S${totalRow - 1})`,
  }
  styleBody(sCell, { numeric: true })
  sCell.font = HEADER_FONT_BOLD_VARIANT
  // T 100%
  const tCell = ws.getCell(totalRow, 20)
  tCell.value = { formula: `IFERROR(S${totalRow}/$S$${totalRow},0)` }
  styleBody(tCell, { numeric: true, format: '0.00%' })
  // X/Y/Z 가중합
  for (const [letter, col] of [
    ['X', 24],
    ['Y', 25],
    ['Z', 26],
  ] as Array<[string, number]>) {
    const c = ws.getCell(totalRow, col)
    c.value = { formula: `SUM(${letter}${PRODUCT_CFP_DATA_START_ROW}:${letter}${totalRow - 1})` }
    styleBody(c, { numeric: true })
  }
  // AA 평균
  ws.getColumn('AA').width = 11
  const aaCell = ws.getCell(totalRow, 27)
  aaCell.value = { formula: `AVERAGE(X${totalRow}:Z${totalRow})` }
  styleBody(aaCell, { numeric: true })
  // U~W 라벨 (DQR 합계 영역)
  const dqrLabel = ws.getCell(totalRow, 21)
  dqrLabel.value = '전체 DQR (가중평균)'
  styleHeader(dqrLabel)
  ws.mergeCells(totalRow, 21, totalRow, 23)

  // 검증 요약 블록
  let r = totalRow + 2
  const summaryTitle = ws.getCell(r, 1)
  summaryTitle.value = '검증 요약 (KS I ISO 14067 §6.3.4.3 / §5.7)'
  summaryTitle.font = SUBTITLE_FONT
  ws.mergeCells(r, 1, r, 10)
  r += 1
  const inputCount = bom.filter((it) => it.direction === 'input').length
  const cutOffCount = bom.filter((it) => it.cutOff).length
  const outputCount = bom.filter((it) => it.direction === 'output').length
  const summary: Array<[string, string | number, boolean]> = [
    ['제품 (Functional Unit)', `${product.fuLabel} (${product.functionalUnit})`, false],
    ['총 CFP', `=S${totalRow}`, true],
    ['CFP / FU (kgCO₂e/ton)', `=S${totalRow}*1000/G${fuRow}`, true],
    ['입력 항목 수 (cut-off 포함)', String(inputCount), false],
    ['Cut-off 적용 항목 수', String(cutOffCount), false],
    ['출력 항목 수 (제품 + 폐기물)', String(outputCount), false],
  ]
  for (const [label, value, isFormula] of summary) {
    const labelCell = ws.getCell(r, 1)
    labelCell.value = label
    styleHeader(labelCell)
    ws.mergeCells(r, 1, r, 4)
    const valCell = ws.getCell(r, 5)
    if (isFormula && typeof value === 'string' && value.startsWith('=')) {
      valCell.value = { formula: value.substring(1) }
      styleBody(valCell, { numeric: true })
    } else {
      valCell.value = value as never
      styleBody(valCell)
    }
    ws.mergeCells(r, 5, r, 10)
    r += 1
  }

  // Cut-off 누적 표
  r += 1
  const cutOffTitle = ws.getCell(r, 1)
  cutOffTitle.value = 'Cut-off 누적 질량 기여도 — §6.3.4.3 제외 기준'
  cutOffTitle.font = SUBTITLE_FONT
  ws.mergeCells(r, 1, r, 10)
  r += 1
  const cutOffHeaders = [
    '순번',
    '분류',
    '명칭',
    '단위',
    '투입량',
    '비율(%)',
    '누적 질량 기여도(%)',
    '비고',
  ]
  cutOffHeaders.forEach((h, i) => {
    const c = ws.getCell(r, 1 + i)
    c.value = h
    styleHeader(c)
  })
  r += 1
  const cutOffStart = r
  const inputs = bom.filter((it) => it.direction === 'input')
  const massItems = inputs.filter((it) => it.appliedUnit === 'kg').sort((a, b) => b.appliedQty - a.appliedQty)
  const nonMassItems = inputs.filter((it) => it.appliedUnit !== 'kg')

  let seq = 1
  massItems.forEach((it) => {
    const cells: Array<[number, unknown, { numeric?: boolean; format?: string } | undefined]> = [
      [1, seq, { numeric: true, format: '0' }],
      [2, it.category, undefined],
      [3, it.name, undefined],
      [4, it.appliedUnit, { numeric: true }],
      [5, it.appliedQty, { numeric: true }],
    ]
    for (const [col, val, opt] of cells) {
      const c = ws.getCell(r, col)
      c.value = val as never
      styleBody(c, opt)
    }
    // F = E_r / SUM(E_first:E_last)
    const massEnd = cutOffStart + massItems.length - 1
    const ratioCell = ws.getCell(r, 6)
    ratioCell.value = {
      formula: `E${r}/SUM($E$${cutOffStart}:$E$${massEnd})`,
    }
    styleBody(ratioCell, { numeric: true, format: '0.00%' })
    // G 누적
    const cumCell = ws.getCell(r, 7)
    if (r === cutOffStart) {
      cumCell.value = { formula: `F${r}` }
    } else {
      cumCell.value = { formula: `G${r - 1}+F${r}` }
    }
    styleBody(cumCell, { numeric: true, format: '0.00%' })
    // H 비고
    const noteCell = ws.getCell(r, 8)
    noteCell.value = it.cutOff || '포함'
    styleBody(noteCell)
    if (it.cutOff) {
      for (let col = 1; col <= 8; col += 1) {
        applyFill(ws.getCell(r, col), WARN_FILL)
      }
    }
    r += 1
    seq += 1
  })

  if (nonMassItems.length > 0) {
    const labelCell = ws.getCell(r, 1)
    labelCell.value = '—'
    styleBody(labelCell)
    const noteCell = ws.getCell(r, 2)
    noteCell.value = '비질량 입력 (참고)'
    styleBody(noteCell)
    ws.mergeCells(r, 2, r, 8)
    r += 1
    nonMassItems.forEach((it) => {
      const cells: Array<[number, unknown, { numeric?: boolean; format?: string } | undefined]> = [
        [1, seq, { numeric: true, format: '0' }],
        [2, it.category, undefined],
        [3, it.name, undefined],
        [4, it.appliedUnit, { numeric: true }],
        [5, it.appliedQty, { numeric: true }],
        [6, '—', undefined],
        [7, '—', undefined],
        [8, '질량 기준 비교 대상 외 — 별도 평가', undefined],
      ]
      for (const [col, val, opt] of cells) {
        const c = ws.getCell(r, col)
        c.value = val as never
        styleBody(c, opt)
      }
      r += 1
      seq += 1
    })
  }

  // 행 높이 헤더만
  ws.getRow(2).height = 18
  ws.getRow(3).height = 18

  applyPrintDefaults(ws, true)

  // unused import suppression
  void NOTE_FONT
  return totalRow
}
