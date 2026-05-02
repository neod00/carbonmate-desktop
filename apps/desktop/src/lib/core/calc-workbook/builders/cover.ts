/**
 * 표지 시트 빌더 — Python PoC `build_cover` 1:1 포팅.
 */

import type { Worksheet } from 'exceljs'

import {
  applyPrintDefaults,
  LEFT_ALIGN,
  NOTE_FONT,
  styleBody,
  styleHeader,
  SUBTITLE_FONT,
  TITLE_FONT,
} from '../styles'
import type { StudyMeta } from '../types'

interface RowSpec {
  group: string | null
  label: string
  value: string
}

export function buildCover(ws: Worksheet, m: StudyMeta): void {
  ws.getColumn('A').width = 2
  ws.getColumn('B').width = 18
  ws.getColumn('C').width = 14
  ws.getColumn('D').width = 60

  // 제목
  const title = ws.getCell('B2')
  title.value = m.projectTitle
  title.font = TITLE_FONT
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.mergeCells('B2:D2')

  // 메타 그리드
  const rows: RowSpec[] = [
    { group: '연구 정보', label: '산정일', value: m.studyDate },
    { group: null, label: '표준', value: m.standard },
    { group: null, label: 'GWP 기준', value: m.gwpBasis },
    { group: null, label: '산정 대상 기간', value: m.assessmentPeriod },
    { group: null, label: '산정 목적', value: m.purpose },
    { group: '의뢰사 (Client)', label: '회사명', value: m.clientCompany },
    { group: null, label: '소재지', value: m.clientAddress },
    { group: null, label: '담당자 이름', value: m.contactName },
    { group: null, label: '전화번호', value: m.contactPhone },
    { group: null, label: 'E-mail', value: m.contactEmail },
  ]

  let r = 4
  let groupStart = r
  let lastGroup: string | null = null
  for (const spec of rows) {
    if (spec.group !== null && spec.group !== lastGroup) {
      if (lastGroup !== null && groupStart < r) {
        ws.mergeCells(groupStart, 2, r - 1, 2)
      }
      groupStart = r
      lastGroup = spec.group
      const groupCell = ws.getCell(r, 2)
      groupCell.value = spec.group
      styleHeader(groupCell)
    } else if (spec.group === null) {
      const empty = ws.getCell(r, 2)
      styleHeader(empty)
    }
    const labelCell = ws.getCell(r, 3)
    labelCell.value = spec.label
    styleHeader(labelCell)
    const valueCell = ws.getCell(r, 4)
    valueCell.value = spec.value
    styleBody(valueCell)
    r += 1
  }
  if (lastGroup !== null && groupStart < r) {
    ws.mergeCells(groupStart, 2, r - 1, 2)
  }

  // 수행자 블록
  r += 1
  const consultantTitle = ws.getCell(r, 2)
  consultantTitle.value = '수행자 (Consultants)'
  consultantTitle.font = SUBTITLE_FONT
  r += 1
  const consultantHeaders = ['순번', '이름', '연락처']
  consultantHeaders.forEach((label, idx) => {
    const c = ws.getCell(r, 2 + idx)
    c.value = label
    styleHeader(c)
  })
  r += 1
  m.consultants.forEach((c, i) => {
    const seq = ws.getCell(r, 2)
    seq.value = i + 1
    styleBody(seq, { numeric: true, format: '0' })
    const name = ws.getCell(r, 3)
    name.value = c.name
    styleBody(name)
    const contactStr = [c.phone, c.email].filter((s) => s && s !== '—').join(' / ') || '—'
    const contact = ws.getCell(r, 4)
    contact.value = contactStr
    styleBody(contact)
    r += 1
  })

  // 푸터 자가선언 (§5.11 투명성)
  r += 1
  const note = ws.getCell(r, 2)
  note.value =
    '※ 본 산정 결과는 ISO 14067:2018 기반의 자체 산정이며, 제3자 검증 통과를 보장하지 않습니다. ' +
    '검증 통과는 별도의 인증기관 절차를 따릅니다.'
  note.font = NOTE_FONT
  note.alignment = LEFT_ALIGN
  ws.mergeCells(r, 2, r, 4)

  applyPrintDefaults(ws, false)
}
