/**
 * KS I ISO 14067 적합성 매트릭스 .xlsx 생성기.
 *
 * 원본 KS xlsx (260 행) 의 컬럼 구조를 그대로 재현하면서, 자동 판정 결과를 채워넣음.
 *   조항 / Section / shall·should·may / 규격 요구사항 / 확인사항(NEW) /
 *   시정조치(NEW) / status(NEW) / 증빙자료(NEW)
 */

import ExcelJS from 'exceljs'

import { autoCheck } from './auto-checks'
import { KS_REQUIREMENTS } from './requirements'
import type {
  CheckedRequirement,
  ComplianceMatrixSummary,
  ComplianceStatus,
} from './types'
import type { PCFState } from '../store'

const COL = {
  no: 1,
  clause: 2,
  section: 3,
  obligation: 4,
  text: 5,
  finding: 6,
  action: 7,
  status: 8,
  evidence: 9,
} as const

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFBFBFBF' } }
const STATUS_COLORS: Record<ComplianceStatus, string> = {
  pass: 'FFD4EDDA', // 연녹색
  fail: 'FFF8D7DA', // 연빨강
  partial: 'FFFFF3CD', // 연노랑
  manual: 'FFD1ECF1', // 연파랑
  na: 'FFE2E3E5', // 연회색
  info: 'FFFFFFFF', // 흰색
}
const STATUS_LABEL: Record<ComplianceStatus, string> = {
  pass: '통과',
  fail: '미충족',
  partial: '부분 충족',
  manual: '수동 확인',
  na: '비적용',
  info: '정보',
}

const HEADER_FONT = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF000000' } }
const BODY_FONT = { name: '맑은 고딕', size: 10 }

const THIN = { style: 'thin' as const, color: { argb: 'FF808080' } }
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }
const CENTER = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }
const LEFT = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }

function obligationFromText(o: string): string {
  if (o === 'shall') return 'shall (필수)'
  if (o === 'should') return 'should (권고)'
  if (o === 'may') return 'may (선택)'
  return ''
}

export interface BuildKsMatrixResult {
  blob: Blob
  summary: ComplianceMatrixSummary
  checked: CheckedRequirement[]
}

export async function buildKsComplianceMatrix(state: PCFState): Promise<BuildKsMatrixResult> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CarbonMate'
  wb.created = new Date()

  const ws = wb.addWorksheet('적합성 매트릭스')

  // 컬럼 너비
  ws.getColumn('A').width = 5
  ws.getColumn('B').width = 9
  ws.getColumn('C').width = 22
  ws.getColumn('D').width = 14
  ws.getColumn('E').width = 60
  ws.getColumn('F').width = 38
  ws.getColumn('G').width = 38
  ws.getColumn('H').width = 12
  ws.getColumn('I').width = 24

  // 제목
  const title = ws.getCell(1, 1)
  title.value = 'KS I ISO 14067:2018 적합성 매트릭스 (자가점검)'
  title.font = { name: '맑은 고딕', size: 14, bold: true }
  ws.mergeCells(1, 1, 1, 9)

  // 부설명
  const sub = ws.getCell(2, 1)
  sub.value =
    '※ 본 매트릭스는 KS I ISO 14067:2018 표준 본문(요구사항 시트, 260 행)을 기반으로 ' +
    'CarbonMate 가 자동 판정한 결과입니다. 자동 판정 불가 항목은 「수동 확인」으로 표시되며, ' +
    '검증심사원 인계 전 수동 보완 권고.'
  sub.font = { name: '맑은 고딕', size: 9, italic: true, color: { argb: 'FF595959' } }
  sub.alignment = LEFT
  ws.mergeCells(2, 1, 2, 9)

  // 헤더 (3행)
  const HEADER_ROW = 4
  const headers: Record<keyof typeof COL, string> = {
    no: 'No.',
    clause: '조항',
    section: 'Section',
    obligation: '의무',
    text: '규격 요구사항',
    finding: '확인사항',
    action: '시정조치',
    status: 'status',
    evidence: '증빙자료 위치',
  }
  for (const [k, label] of Object.entries(headers) as Array<
    [keyof typeof COL, string]
  >) {
    const c = ws.getCell(HEADER_ROW, COL[k])
    c.value = label
    c.fill = HEADER_FILL
    c.font = HEADER_FONT
    c.alignment = CENTER
    c.border = BORDER
  }

  // 데이터 행 — 모든 행에 autoCheck 적용. 단 obligation 비어 있고 자동검사도
  // 'manual' 인 경우(=일반진술/비고) 'info' 로 다운그레이드.
  const checked: CheckedRequirement[] = []
  let row = HEADER_ROW + 1
  let no = 1
  for (const req of KS_REQUIREMENTS) {
    let result = autoCheck(req.clause, state)
    if (!req.obligation && result.status === 'manual') {
      result = { status: 'info', finding: '비고 / 일반 진술' }
    }

    checked.push({ req, result })

    ws.getCell(row, COL.no).value = no
    ws.getCell(row, COL.clause).value = req.clause
    ws.getCell(row, COL.section).value = req.section
    ws.getCell(row, COL.obligation).value = obligationFromText(req.obligation)
    ws.getCell(row, COL.text).value = req.text
    ws.getCell(row, COL.finding).value = result.finding
    ws.getCell(row, COL.action).value = result.correctiveAction ?? ''
    const statusCell = ws.getCell(row, COL.status)
    statusCell.value = STATUS_LABEL[result.status]
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STATUS_COLORS[result.status] },
    }
    ws.getCell(row, COL.evidence).value = result.evidenceLocation ?? ''

    // 셀 스타일
    for (const k of Object.keys(COL) as Array<keyof typeof COL>) {
      const c = ws.getCell(row, COL[k])
      c.font = BODY_FONT
      c.border = BORDER
      const isCenterCol = k === 'no' || k === 'clause' || k === 'obligation' || k === 'status'
      c.alignment = isCenterCol ? CENTER : LEFT
    }
    row += 1
    no += 1
  }

  // 행 헤더 freeze
  ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }]
  // 자동 필터
  ws.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: row - 1, column: 9 },
  }

  // 요약 시트
  const summary = computeSummary(checked)
  const wsSum = wb.addWorksheet('요약')
  wsSum.getColumn('A').width = 32
  wsSum.getColumn('B').width = 18
  const sumTitle = wsSum.getCell(1, 1)
  sumTitle.value = '자가점검 요약'
  sumTitle.font = { name: '맑은 고딕', size: 14, bold: true }
  wsSum.mergeCells(1, 1, 1, 2)

  const sumRows: Array<[string, string | number]> = [
    ['총 요구사항 수', summary.totalRequirements],
    ['shall (필수)', summary.shallCount],
    ['should (권고)', summary.shouldCount],
    ['shall 통과율', `${(summary.shallPassRate * 100).toFixed(1)}%`],
    ['자동 검사 가능 항목', summary.autoCheckedCount],
    ['미충족 (fail)', summary.failCount],
    ['부분 충족 (partial)', summary.partialCount],
  ]
  let sumRow = 3
  for (const [k, v] of sumRows) {
    const kc = wsSum.getCell(sumRow, 1)
    kc.value = k
    kc.fill = HEADER_FILL
    kc.font = HEADER_FONT
    kc.border = BORDER
    kc.alignment = LEFT
    const vc = wsSum.getCell(sumRow, 2)
    vc.value = v as never
    vc.font = BODY_FONT
    vc.border = BORDER
    vc.alignment = CENTER
    sumRow += 1
  }

  // status 색상 범례
  sumRow += 1
  wsSum.getCell(sumRow, 1).value = '범례 (status 색상)'
  wsSum.getCell(sumRow, 1).font = { name: '맑은 고딕', size: 11, bold: true }
  sumRow += 1
  for (const status of ['pass', 'partial', 'manual', 'fail', 'na', 'info'] as ComplianceStatus[]) {
    const kc = wsSum.getCell(sumRow, 1)
    kc.value = STATUS_LABEL[status]
    kc.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STATUS_COLORS[status] },
    }
    kc.font = BODY_FONT
    kc.border = BORDER
    kc.alignment = CENTER
    const vc = wsSum.getCell(sumRow, 2)
    vc.value = status
    vc.font = BODY_FONT
    vc.border = BORDER
    sumRow += 1
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  return { blob, summary, checked }
}

function computeSummary(checked: CheckedRequirement[]): ComplianceMatrixSummary {
  const shall = checked.filter((c) => c.req.obligation === 'shall')
  const should = checked.filter((c) => c.req.obligation === 'should')
  const shallPass = shall.filter((c) => c.result.status === 'pass').length
  return {
    totalRequirements: checked.length,
    shallCount: shall.length,
    shouldCount: should.length,
    shallPassRate: shall.length === 0 ? 0 : shallPass / shall.length,
    autoCheckedCount: checked.filter((c) => c.result.status !== 'manual' && c.result.status !== 'info')
      .length,
    failCount: checked.filter((c) => c.result.status === 'fail').length,
    partialCount: checked.filter((c) => c.result.status === 'partial').length,
  }
}
