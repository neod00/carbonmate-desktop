/**
 * #7 Sensitivity Analysis — 민감도 분석 별도 문서
 *
 * 산정 워크북의 「민감도 분석」 시트와 동일한 정보를 standalone .docx 로 출력.
 * 검증심사원이 PDF/Word 단독으로 검토 가능하도록 별첨.
 *
 * KS I ISO 14067 §6.4.6.1 (대체 할당 절차) + §6.6 (해석 단계) — 민감도 분석 의무.
 */

import { Document, Packer, Paragraph, Table } from 'docx'
import {
  blank,
  bullet,
  dataTable,
  heading2,
  isoNote,
  metaTable,
  paragraph,
  title,
} from '../docx-helpers'
import type { PCFState } from '../../store'

export async function buildSensitivityDocx(state: PCFState): Promise<Blob> {
  const sa = state.sensitivityAnalysis

  const children: Array<Paragraph | Table> = [
    title('민감도 분석 (Sensitivity Analysis)'),
    paragraph(
      'KS I ISO 14067:2018 §6.4.6.1 (대체 할당 절차 적용 시 의무) 및 §6.6 (전과정 해석 단계 의무) 에 ' +
        '따라 수행한 민감도 분석 결과를 문서화합니다.',
    ),
    isoNote(
      '※ 변화율 ±10% 이내를 「범위 내」로 판단하며, 그 외는 추가 분석 또는 개선 권고 대상입니다.',
    ),
    blank(),
  ]

  if (!sa) {
    children.push(
      paragraph('아직 민감도 분석이 수행되지 않았습니다. 위저드의 「민감도 분석」 단계에서 시나리오를 추가하세요.', {
        italics: true,
      }),
    )
  } else {
    children.push(
      heading2('1. 분석 메타'),
      metaTable([
        ['분석일', sa.analysisDate || '(미입력)'],
        ['기준 CFP (Baseline)', `${sa.baselineCFP.toFixed(4)} kg CO₂e`],
        ['시나리오 수', String(sa.scenarios.length)],
        ['유의미 시나리오 수 (5% 초과)', String(sa.scenarios.filter((s) => s.isSignificant).length)],
      ]),
      blank(),
      heading2('2. 시나리오 표'),
    )

    if (sa.scenarios.length === 0) {
      children.push(paragraph('시나리오가 정의되지 않았습니다.', { italics: true }))
    } else {
      children.push(
        dataTable(
          ['시나리오', '변경 매개변수', '기준값', '대안값', '기준 CFP', '대안 CFP', '변화율', '유의미'],
          sa.scenarios.map((s) => [
            s.nameKo || s.name,
            s.parameterChanged,
            String(s.baseValue),
            String(s.alternativeValue),
            s.baseEmission.toFixed(4),
            s.alternativeEmission.toFixed(4),
            `${s.percentageChange >= 0 ? '+' : ''}${s.percentageChange.toFixed(1)}%`,
            s.isSignificant ? '⚠ 유의' : '범위 내',
          ]),
        ),
        blank(),
      )
    }

    if (sa.significantFactors && sa.significantFactors.length > 0) {
      children.push(
        heading2('3. 유의미 인자 (Significant Factors)'),
        ...sa.significantFactors.map((f) => bullet(f)),
        blank(),
      )
    }

    if (sa.recommendations && sa.recommendations.length > 0) {
      children.push(
        heading2('4. 개선 권고 (Recommendations)'),
        ...sa.recommendations.map((r) => bullet(r)),
        blank(),
      )
    }
  }

  children.push(
    heading2('A. ISO 14067 의 민감도 분석 의무 조항'),
    bullet('§6.4.6.1 — 여러 대체 할당 절차가 적용 가능할 때마다 민감도 분석을 수행하여야 한다.'),
    bullet('§6.6 — 해석 단계에서 결과의 민감도와 불확도를 이해하기 위한 분석을 수행하여야 한다.'),
    bullet('§6.6 — 사용 프로파일/폐기 시나리오의 대안이 있는 경우, 그 영향을 평가하여야 한다.'),
    isoNote(
      'PCR 또는 CFP-PCR이 KS I ISO/TS 14027에 따라 개발된 경우, §6.4.6.1 의 추가 민감도 분석은 ' +
        '면제될 수 있으나 해석 단계 (§6.6) 의 의무는 잔존한다.',
    ),
  )

  const doc = new Document({
    styles: { default: { document: { run: { font: '맑은 고딕' } } } },
    sections: [{ children }],
  })

  return Packer.toBlob(doc)
}
