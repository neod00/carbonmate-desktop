/**
 * 사용한 2차 데이터 목록 시트 (EF DB).
 * Python PoC `build_secondary_data` 1:1 포팅.
 */

import type { Worksheet } from 'exceljs'

import { EF_DB_DATA_START_ROW, EF_DB_HEADER_ROW } from '../constants'
import {
  applyPrintDefaults,
  LEFT_ALIGN,
  NOTE_FONT,
  styleBody,
  styleHeader,
  TITLE_FONT,
} from '../styles'
import type { SecondaryDataItem } from '../types'

export function buildEfDb(ws: Worksheet, items: SecondaryDataItem[]): void {
  ws.getColumn('A').width = 2
  ws.getColumn('B').width = 6
  ws.getColumn('C').width = 22
  ws.getColumn('D').width = 24
  ws.getColumn('E').width = 38
  ws.getColumn('F').width = 10
  ws.getColumn('G').width = 32
  ws.getColumn('H').width = 8
  ws.getColumn('I').width = 10
  ws.getColumn('J').width = 12
  ws.getColumn('K').width = 28

  // 메타 (LCIA 메서드)
  const metaPairs: Array<[string, string]> = [
    ['Method', 'IPCC AR6 / KS I ISO 14067:2018'],
    ['Category', 'climate change'],
    ['Indicator', 'global warming potential (GWP100)'],
  ]
  metaPairs.forEach(([k, v], i) => {
    const r = 2 + i
    const kc = ws.getCell(r, 10)
    kc.value = k
    styleHeader(kc)
    const vc = ws.getCell(r, 11)
    vc.value = v
    styleBody(vc)
  })

  // 인트로 노트 (좌측)
  const intro = [
    'ㅇ 1차 데이터 수집이 실행 가능하지 않은 투입물·산출물에 한해 2차 데이터를 사용함.',
    'ㅇ 모든 2차 데이터는 출처(Owner)·UUID·지리적 범위를 명시하여 추적 가능성을 확보함.',
    'ㅇ ISO 14067 §6.3.5 (데이터 품질) 및 §7.3 d) (데이터원 기록 의무) 준수.',
  ]
  intro.forEach((line, i) => {
    const c = ws.getCell(2 + i, 4)
    c.value = line
  })

  // 헤더
  const r = EF_DB_HEADER_ROW
  const headers = [
    '순번',
    'Data set owner',
    'Activity UUID / Product UUID',
    'Activity Name',
    'Geography',
    'Reference Product Name',
    'Unit',
    'Amount',
    'kg CO₂-Eq',
    '비고',
  ]
  headers.forEach((h, i) => {
    const c = ws.getCell(r, 2 + i)
    c.value = h
    styleHeader(c)
  })

  // 데이터
  items.forEach((it, i) => {
    const row = EF_DB_DATA_START_ROW + i
    const cells: Array<[number, unknown, { numeric?: boolean; format?: string } | undefined]> = [
      [2, it.seq, { numeric: true, format: '0' }],
      [3, it.owner, undefined],
      [4, it.uuid || '(N/A — 내장 DB)', undefined],
      [5, it.activityName, undefined],
      [6, it.geography, { numeric: true }],
      [7, it.referenceProduct, undefined],
      [8, it.unit, { numeric: true }],
      [9, it.amount, { numeric: true }],
      [10, it.efKgCo2e, { numeric: true, format: '#,##0.0000' }],
      [11, it.note ?? '', undefined],
    ]
    for (const [col, val, opt] of cells) {
      const c = ws.getCell(row, col)
      c.value = val as never
      styleBody(c, opt)
    }
  })

  // 푸터 노트
  const footerRow = EF_DB_DATA_START_ROW + items.length + 1
  const footer = ws.getCell(footerRow, 2)
  footer.value =
    '※ 한국환경공단(KECO) 전력 EF는 매년 갱신됨. 검증 시점에 따라 가장 최근 공표값을 적용해야 한다 ' +
    '(ISO 14067 §6.3.6 시간 경계 / §6.4.9.4 전력).'
  footer.font = NOTE_FONT
  footer.alignment = LEFT_ALIGN
  ws.mergeCells(footerRow, 2, footerRow, 11)

  applyPrintDefaults(ws, true)
}
