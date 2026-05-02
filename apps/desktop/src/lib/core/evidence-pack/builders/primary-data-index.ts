/**
 * #9 Primary Activity Data Index — 1차 활동 데이터 출처 인덱스 (option a, 텍스트만)
 *
 * KS I ISO 14067 §6.3.5 / §6.4.2 — 1차 데이터 수집 절차 + 출처 문서화.
 * 본 v0.1 (option a) 은 텍스트 인덱스만 출력 — 실제 원본 파일 첨부는 v1.x 의
 * Primary Activity Data 보존 메커니즘 (option c) 에서 보강 예정.
 */

import { Document, Packer, Paragraph, Table } from 'docx'
import {
  blank,
  bullet,
  dataTable,
  heading2,
  isoNote,
  paragraph,
  title,
} from '../docx-helpers'
import type {
  ActivityInput,
  PCFState,
  StageActivityData,
  TransportInput,
} from '../../store'

interface IndexRow {
  no: string
  category: string
  name: string
  qty: string
  source: string
  assumption: string
  limitation: string
}

/** PR-V05: 운송 행은 ActivityInput.quantity 가 0 이어도 distance/weight 로 의미있는
 * 수량을 표기 — DQR 빌더와 동일 single-source-of-truth 패턴. */
function formatQty(it: ActivityInput, category: string): string {
  if (category === '운송') {
    const tr = it as Partial<TransportInput>
    const distance = tr.distance ?? 0
    const weightKg = tr.weight ?? 0
    if (distance > 0 && weightKg > 0) {
      const tonKm = (weightKg / 1000) * distance
      return `${distance} km × ${weightKg} kg = ${tonKm.toFixed(2)} ton·km`
    }
    if (distance > 0) return `${distance} km`
  }
  return `${it.quantity ?? 0} ${it.unit ?? ''}`.trim()
}

function activityToRow(it: ActivityInput, category: string, no: number): IndexRow {
  const t = it.transparencyInfo
  return {
    no: String(no),
    category,
    name: it.name,
    qty: formatQty(it, category),
    source: t?.dataSource || it.dataQuality?.source || '(출처 미입력)',
    assumption: t?.assumptions || '—',
    limitation: t?.limitations || '—',
  }
}

function collect(state: PCFState): IndexRow[] {
  const rows: IndexRow[] = []
  const d: Partial<StageActivityData> | undefined = state.detailedActivityData
  if (!d) return rows
  let no = 1
  const push = (it: ActivityInput, cat: string) => {
    rows.push(activityToRow(it, cat, no))
    no += 1
  }
  for (const m of d.raw_materials ?? []) push(m, '원료물질')
  for (const e of d.manufacturing?.electricity ?? []) push(e, '전력')
  for (const f of d.manufacturing?.fuels ?? []) push(f, '연료/스팀')
  for (const t of d.transport ?? []) push(t, '운송')
  for (const p of d.packaging ?? []) push(p, '포장')
  for (const w of d.eol?.disposal ?? []) push(w, '폐기')
  for (const r of d.eol?.recycling ?? []) push(r, '재활용')
  return rows
}

export async function buildPrimaryDataIndexDocx(state: PCFState): Promise<Blob> {
  const rows = collect(state)
  const missingSourceCount = rows.filter((r) => r.source.includes('미입력')).length

  const children: Array<Paragraph | Table> = [
    title('1차 활동 데이터 출처 인덱스 (Primary Activity Data Index)'),
    paragraph(
      'KS I ISO 14067:2018 §6.3.5 (데이터 품질) 및 §6.4.2 (데이터 수집) 에 따라, ' +
        '본 산정에 사용된 활동 데이터의 출처(Source) 인덱스를 문서화합니다.',
    ),
    isoNote(
      '※ 본 v0.1 인덱스는 텍스트 출처만 포함합니다. 검증 시 원본 ERP 캡처/영수증/청구서 등은 ' +
        '별도 폴더에 보존하여 심사원에게 인계하여야 합니다.',
    ),
    blank(),

    heading2('1. 인덱스 표'),
    rows.length === 0
      ? paragraph('활동 데이터가 입력되지 않았습니다.', { italics: true })
      : dataTable(
          ['No.', '분류', '명칭', '수량', '출처 (Source)', '주요 가정', '한계'],
          rows.map((r) => [r.no, r.category, r.name, r.qty, r.source, r.assumption, r.limitation]),
        ),
    blank(),

    heading2('2. 검증 시 보존 권고 원본 파일'),
    bullet(
      '원료물질: ERP 입출고 대장 (.xlsx) + 공급사 영수증·납품서 (.pdf) — ' +
        '각 원료마다 보관 권장.',
    ),
    bullet('전력: 한전 전기요금 청구서 12개월 (.pdf) — 월별 사용량 검증 가능.'),
    bullet('연료/스팀: 가스 청구서 또는 자체 계량기 로그 (.xlsx).'),
    bullet('운송: 화물명세서·물류 영수증 (.pdf).'),
    bullet(
      '폐기물: 폐기물 위탁 처리 계약서 + 인계서 (.pdf) — 처리방법(매립/소각/재활용/위탁) 확인 가능.',
    ),
    bullet('포장: 포장재 공급사 사양서 + 입고 영수증 (.pdf).'),
    isoNote(
      '권고 보존 폴더 구조:\n' +
        '  09_Primary_Activity_Data/\n' +
        '    raw_materials/    {원료별 폴더}\n' +
        '    electricity/\n' +
        '    fuels/\n' +
        '    transport/\n' +
        '    waste/\n' +
        '    packaging/',
    ),
    blank(),

    heading2('3. 데이터 품질 요약'),
    dataTable(
      ['항목', '값'],
      [
        ['총 활동 항목 수', String(rows.length)],
        ['출처 미입력 항목 수', String(missingSourceCount)],
        [
          '출처 입력 비율',
          rows.length === 0
            ? '0%'
            : `${(((rows.length - missingSourceCount) / rows.length) * 100).toFixed(0)}%`,
        ],
      ],
    ),
    blank(),

    heading2('4. 한계 (Limitations)'),
    bullet(
      '본 인덱스는 텍스트 출처 정보만 담고 있습니다. 검증 시 원본 파일은 별도 보존이 필요합니다.',
    ),
    bullet(
      '출처 미입력 항목이 있는 경우, ISO 14067 §6.3.5 의 「2차 데이터 정당화 의무」 위반으로 ' +
        '검증 부적합 가능성 — 위저드 「출처 정보」 필드를 모두 채워야 합니다.',
    ),
    bullet(
      '원본 파일 자동 보존 기능은 다음 버전(v1.x — option c) 에서 추가 예정입니다.',
    ),
  ]

  const doc = new Document({
    styles: { default: { document: { run: { font: '맑은 고딕' } } } },
    sections: [{ children }],
  })

  return Packer.toBlob(doc)
}
