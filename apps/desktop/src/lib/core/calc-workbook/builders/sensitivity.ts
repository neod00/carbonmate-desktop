/**
 * 민감도 분석 시트 — Python PoC `build_sensitivity` 1:1 포팅 (차트 제외 v1).
 */

import type { Worksheet } from 'exceljs'

import {
  applyFill,
  applyPrintDefaults,
  LEFT_ALIGN,
  NOTE_FONT,
  styleBody,
  styleHeader,
  TITLE_FONT,
  WARN_FILL,
} from '../styles'
import type { ProductCFP, SensitivityScenario } from '../types'

export function buildSensitivity(
  ws: Worksheet,
  product: ProductCFP,
  scenarios: SensitivityScenario[],
): void {
  ws.getColumn('A').width = 2
  ws.getColumn('B').width = 30
  ws.getColumn('C').width = 22
  ws.getColumn('D').width = 14
  ws.getColumn('E').width = 12
  ws.getColumn('F').width = 10
  ws.getColumn('G').width = 36

  const titleCell = ws.getCell(1, 2)
  titleCell.value = '민감도 분석'
  titleCell.font = TITLE_FONT

  const intro = [
    `ㅇ 본 분석은 ${product.displayName} (${product.fuLabel})의 CFP ` +
      `${product.total.toLocaleString('en', { maximumFractionDigits: 2 })} ${product.unit} 를 기준으로 한다.`,
    'ㅇ 주요 활동량/EF/방법론 변경이 최종 결과에 미치는 영향을 정량 평가한다.',
    "ㅇ 변화율 ±10% 이내를 '범위 내'로 판단하며, 그 외는 추가 분석 또는 개선 권고 대상이다.",
    'ㅇ ISO 14067 §6.4.6.1 (대체 할당 절차 적용 시 민감도 분석 의무) 및 §6.6 (해석 단계 민감도 분석 의무) 준수.',
  ]
  intro.forEach((line, i) => {
    const c = ws.getCell(2 + i, 2)
    c.value = line
    c.alignment = LEFT_ALIGN
    ws.mergeCells(2 + i, 2, 2 + i, 9)
  })

  // 영향범주
  let r = 7
  const ic1 = ws.getCell(r, 2)
  ic1.value = '영향범주'
  styleHeader(ic1)
  ws.mergeCells(r, 2, r, 9)
  r += 1
  const ic2 = ws.getCell(r, 2)
  ic2.value = product.impactCategory
  styleBody(ic2)
  ws.mergeCells(r, 2, r, 9)
  r += 2

  // 시나리오 표 헤더 — 보고서(report-docx-full) 와 동일하게 base/alt/% 3컬럼 + delta
  const headers = [
    '시나리오',
    '기준값 (parameter)',
    '기준 CFP (kgCO₂e)',
    '대안 CFP (kgCO₂e)',
    '변화량 (kgCO₂e)',
    '변화율',
    '범위 내',
    '비고',
  ]
  headers.forEach((h, i) => {
    const c = ws.getCell(r, 2 + i)
    c.value = h
    styleHeader(c)
  })
  // 컬럼 폭 보강
  ws.getColumn('I').width = 10 // 비고로 밀려난 8번째 컬럼 폭
  r += 1

  // 기준값 행 (Baseline)
  const baselineRow = r
  const baselineCfp = scenarios.find((s) => s.baselineEmission !== undefined)?.baselineEmission ?? product.total
  const baselineCells: Array<[number, unknown, { numeric?: boolean; format?: string } | undefined]> = [
    [2, `기준값 (${product.fuLabel} CFP)`, undefined],
    [3, '—', undefined],
    [4, baselineCfp, { numeric: true }],
    [5, baselineCfp, { numeric: true }],
    [6, 0, { numeric: true }],
    [7, 0, { numeric: true, format: '0.0%' }],
    [8, '—', undefined],
    [9, '기준 (Baseline)', undefined],
  ]
  for (const [col, val, opt] of baselineCells) {
    const c = ws.getCell(baselineRow, col)
    c.value = val as never
    styleBody(c, opt)
  }
  r += 1

  for (const s of scenarios) {
    const baseEmission = s.baselineEmission ?? baselineCfp
    const altEmission = s.alternativeEmission ?? baseEmission + s.deltaKgCo2e
    const cells: Array<[number, unknown, { numeric?: boolean; format?: string } | undefined]> = [
      [2, s.name, undefined],
      [3, s.baseline, undefined],
      [4, baseEmission, { numeric: true }],
      [5, altEmission, { numeric: true }],
      [6, s.deltaKgCo2e, { numeric: true }],
      [7, s.deltaPct, { numeric: true, format: '0.0%' }],
      [8, s.inRange ? 'O' : '!', { numeric: true }],
      [9, s.note ?? '', undefined],
    ]
    for (const [col, val, opt] of cells) {
      const c = ws.getCell(r, col)
      c.value = val as never
      styleBody(c, opt)
    }
    if (!s.inRange) {
      for (let col = 2; col <= 9; col += 1) {
        applyFill(ws.getCell(r, col), WARN_FILL)
      }
    }
    r += 1
  }

  // 결론
  r += 1
  const conclusion = ws.getCell(r, 2)
  conclusion.value =
    'ㅇ 결론: 가장 큰 단일 변동 인자를 식별하고 범위 밖 시나리오는 추가 분석/개선 권고. ' +
    '대체 할당 절차 적용 시 민감도 분석은 ISO 14044 §5.3.5 / ISO 14067 §6.4.6.1 의무.'
  conclusion.alignment = LEFT_ALIGN
  conclusion.font = NOTE_FONT
  ws.mergeCells(r, 2, r, 9)

  applyPrintDefaults(ws, true)
}
