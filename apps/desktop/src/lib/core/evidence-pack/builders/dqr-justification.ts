/**
 * #5 Data Quality Rating Justification — DQR 5축 평가 + 근거
 *
 * KS I ISO 14067 §6.3.5 (데이터 품질) 준수.
 * 모든 활동 데이터의 DQI(Measured/Calculated/Estimated) + 출처 + 가정·한계를 표 형태로 문서화.
 */

import { Document, Packer } from 'docx'
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

interface DqrRow {
  category: string
  name: string
  qty: string
  type: string
  source: string
  year: string
  geo: string
  uncertainty: string
}

/** PR-V05: 운송 항목은 ActivityInput.quantity 가 0 이거나 비어있는 경우가 많음.
 * BOM 입력물 시트와 동일한 single-source-of-truth — TransportInput.distance/weight 를
 * 직접 읽어 표시한다. 검증인이 산출물 4종 (Report/Workbook/DQR/PDI) 간 운송거리 모순
 * (F-A03) 을 더 이상 발견하지 못하도록 통일. */
function formatTransportQty(it: ActivityInput): string {
  const tr = it as Partial<TransportInput>
  const distance = tr.distance ?? 0
  const weightKg = tr.weight ?? 0
  if (distance > 0 && weightKg > 0) {
    const tonKm = (weightKg / 1000) * distance
    return `${distance} km × ${weightKg} kg = ${tonKm.toFixed(2)} ton·km`
  }
  if (distance > 0) return `${distance} km`
  // 거리 정보가 없으면 ActivityInput.quantity 로 fallback (이미 ton·km 로 입력된 경우)
  return `${it.quantity ?? 0} ${it.unit ?? 'ton·km'}`
}

function activityToRow(it: ActivityInput, category: string): DqrRow {
  const dq = it.dataQuality
  const isTransport = category === '운송'
  return {
    category,
    name: it.name,
    qty: isTransport ? formatTransportQty(it) : `${it.quantity} ${it.unit}`,
    type: dq.type === 'primary' ? '1차 (M)' : dq.type === 'secondary' ? '2차 (C)' : '추정 (E)',
    source: dq.source || it.transparencyInfo?.dataSource || '(미입력)',
    year: String(dq.year ?? ''),
    geo: dq.geographicScope || '(미입력)',
    uncertainty: dq.uncertainty != null ? `±${dq.uncertainty}%` : '—',
  }
}

function collectAllActivities(state: PCFState): DqrRow[] {
  const rows: DqrRow[] = []
  const d: Partial<StageActivityData> | undefined = state.detailedActivityData
  if (!d) return rows
  for (const m of d.raw_materials ?? []) rows.push(activityToRow(m, '원료물질'))
  for (const e of d.manufacturing?.electricity ?? []) rows.push(activityToRow(e, '전력'))
  for (const f of d.manufacturing?.fuels ?? []) rows.push(activityToRow(f, '연료/스팀'))
  for (const t of d.transport ?? []) rows.push(activityToRow(t, '운송'))
  for (const p of d.packaging ?? []) rows.push(activityToRow(p, '포장'))
  for (const w of d.eol?.disposal ?? []) rows.push(activityToRow(w, '폐기'))
  for (const r of d.eol?.recycling ?? []) rows.push(activityToRow(r, '재활용'))
  return rows
}

export async function buildDqrJustificationDocx(state: PCFState): Promise<Blob> {
  const rows = collectAllActivities(state)
  const meta = state.dataQualityMeta

  const doc = new Document({
    styles: { default: { document: { run: { font: '맑은 고딕' } } } },
    sections: [
      {
        children: [
          title('데이터 품질 정당화 (DQR Justification)'),
          paragraph(
            'KS I ISO 14067:2018 §6.3.5 (데이터 품질) — 모든 활동 데이터의 시간/지리/기술 5축 ' +
              '품질 점수와 정당화 근거를 문서화합니다.',
          ),
          isoNote(
            '※ DQI 등급: M = Measured (1차, 직접 측정/ERP), C = Calculated (2차, 계산), E = Estimated (추정/대리)',
          ),
          blank(),

          heading2('1. 전체 데이터 품질 메타'),
          dataTable(
            ['항목', '값'],
            [
              ['전체 품질 등급', meta.overallType],
              ['기준 연도', String(meta.baseYear)],
              ['주 출처', meta.sources.join(', ') || '(미입력)'],
              ['총 활동 데이터 항목 수', String(rows.length)],
              ['1차 데이터 비율', `${pct(rows, (r) => r.type.includes('1차'))}%`],
              ['2차 데이터 비율', `${pct(rows, (r) => r.type.includes('2차'))}%`],
              ['추정 데이터 비율', `${pct(rows, (r) => r.type.includes('추정'))}%`],
            ],
          ),
          blank(),

          heading2('2. 활동 데이터별 품질 평가'),
          rows.length === 0
            ? paragraph('활동 데이터가 입력되지 않았습니다.', { italics: true })
            : dataTable(
                ['분류', '명칭', '수량', 'DQI', '출처', '연도', '지역', '불확도'],
                rows.map((r) => [r.category, r.name, r.qty, r.type, r.source, r.year, r.geo, r.uncertainty]),
              ),
          blank(),

          heading2('3. ISO 14067 §6.3.5 데이터 품질 5축'),
          bullet('a) 시간 관련 범위 (TeR): 데이터의 연한 — 1=최신 / 5=>15년'),
          bullet('b) 지리적 범위 (GeR): KR=현장/국가 / GLO=글로벌 평균'),
          bullet('c) 기술 범위 (TiR): 1=동일 기술 / 5=매우 상이한 기술'),
          bullet('d) 정확성: 데이터 값의 정밀성 (분산/측정 오차)'),
          bullet('e) 완전성: 측정/추정 흐름의 비율'),
          isoNote('상세 가중평균 DQR 점수는 별첨 산정 워크북의 제품별 CFP 시트 X/Y/Z 컬럼 참조.'),
          blank(),

          heading2('4. 한계 및 권고'),
          bullet(
            '추정(E) 비율이 30% 초과인 경우, ISO 14067 §6.6 (해석) 의 한계 사항으로 보고서 본문에 명시 권고.',
          ),
          bullet('1차 데이터 수집 가능한 항목임에도 2차 사용 시, §6.3.5 의 정당화 근거 추가 기록 필요.'),
          bullet(
            '데이터 연도가 산정 대상 기간과 5년 이상 차이나는 경우, ' +
              '시간 경계 (§6.3.6) 정합성 재검토 후 민감도 분석에 포함 권고.',
          ),
        ],
      },
    ],
  })
  return Packer.toBlob(doc)
}

function pct(rows: DqrRow[], pred: (r: DqrRow) => boolean): string {
  if (rows.length === 0) return '0'
  return ((rows.filter(pred).length / rows.length) * 100).toFixed(0)
}
