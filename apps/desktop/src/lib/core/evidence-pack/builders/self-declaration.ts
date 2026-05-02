/**
 * #10 Self-Declaration Letter — 자가선언서
 *
 * KS I ISO 14067 §7.3 n) 가치 선택 공개 + LRQA Q1.h 자가선언 양식 기반.
 * 의뢰사·수행자·표준·산정기간·합계 CFP·자가선언 문구·서명란을 포함한 1~2 페이지 문서.
 */

import { Document, Packer } from 'docx'
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

export async function buildSelfDeclarationDocx(
  state: PCFState,
  totalCfp: number | undefined,
): Promise<Blob> {
  const meta = state.reportMeta
  const pi = state.productInfo
  const today = new Date().toISOString().slice(0, 10)
  const cfpStr =
    typeof totalCfp === 'number'
      ? `${totalCfp.toLocaleString('en', { maximumFractionDigits: 2 })} kg CO₂e / ${pi.unit ?? 'FU'}`
      : '(별첨 산정 워크북 LCIA 시트 참조)'

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: '맑은 고딕' } },
      },
    },
    sections: [
      {
        children: [
          title('자가선언서 (Self-Declaration Letter)'),
          paragraph(
            '본 문서는 KS I ISO 14067:2018 (제품 탄소발자국 정량화 및 통신) 에 따라 ' +
              '아래 명시된 제품의 탄소발자국 산정 결과의 데이터 정확성·접근성·완전성을 자가 선언하기 위한 양식입니다.',
          ),
          paragraph(
            '본 자가선언은 검증기관(LRQA, KFQ, KMR 등)의 제3자 검증 절차를 대체하지 않으며, ' +
              '검증 의뢰 시 별도 인증 절차를 따릅니다.',
            { italics: true },
          ),
          blank(),

          heading2('1. 의뢰 및 산정 정보'),
          metaTable([
            ['보고서 번호', meta?.reportNumber || '(미정)'],
            ['의뢰사 (Commissioner)', meta?.commissioner || '(미정)'],
            ['수행 기관 (Practitioner)', meta?.practitioner || 'CarbonMate 자가 산정'],
            ['제품명', pi.name || '(미정)'],
            ['기능단위 (FU)', pi.unit || '(미정)'],
            ['시스템 경계', pi.boundary || 'cradle-to-gate'],
            [
              '산정 대상 기간',
              pi.timeBoundary
                ? `${pi.timeBoundary.dataCollectionStart ?? ''} ~ ${pi.timeBoundary.dataCollectionEnd ?? ''}`
                : '(미정)',
            ],
            ['표준', 'ISO 14067:2018 / KS I ISO 14067'],
            [
              'GWP 기준',
              state.characterizationModel === 'AR6'
                ? 'IPCC AR6, 100년 (GWP100)'
                : 'IPCC AR5, 100년 (GWP100)',
            ],
            ['산정일', today],
          ]),
          blank(),

          heading2('2. 산정 결과 요약'),
          dataTable(
            ['항목', '값'],
            [['총 CFP (Functional Unit 당)', cfpStr]],
          ),
          blank(),

          heading2('3. 자가선언 문구'),
          paragraph('수행 기관은 다음을 자가 선언합니다:'),
          bullet(
            '본 산정에 사용된 활동 데이터(원료/유틸리티/에너지/운송/포장/폐기물)는 의뢰사 ' +
              '또는 공급사의 검증 가능한 1차 출처(ERP, 영수증, 청구서, 계량기 등)에 기반하여 수집되었습니다.',
          ),
          bullet(
            '2차 데이터(배출계수, LCI DB)는 출처(Owner, 연도, 지리적 범위)를 명시하였으며 ' +
              '별첨 "산정 워크북"의 「사용한 2차 데이터 목록」 시트에 기록되어 있습니다.',
          ),
          bullet(
            '데이터 품질(DQR)은 시간/지리/기술 5축으로 평가되었으며 별첨 「DQR_Justification」 문서에 정당화 근거를 기록하였습니다.',
          ),
          bullet(
            '할당 절차는 ISO 14044 §5.3.5 / ISO 14067 §6.4.6 의 우선순위(분리→시스템 확장→경제적)에 따라 적용되었으며 ' +
              '별첨 「Allocation_Methodology」 문서에 정당화하였습니다.',
          ),
          bullet(
            '민감도 분석은 ISO 14067 §6.4.6.1 및 §6.6 에 따라 수행되었으며 ' +
              '별첨 「Sensitivity_Analysis」 문서 및 산정 워크북 「민감도 분석」 시트에 결과를 기록하였습니다.',
          ),
          bullet(
            'Cut-off 적용 항목은 ISO 14067 §6.3.4.3 의 1%/95% 임계 기준을 ' +
              '준수하였으며 산정 워크북 「Cut-off 누적 질량 기여도 표」에 명시하였습니다.',
          ),
          isoNote('※ KS I ISO 14067 §5.11 (투명성) — 모든 가정·방법·데이터 출처를 공개적으로 기록함.'),
          blank(),

          heading2('4. 한계 및 면책 사항'),
          bullet('본 산정 결과는 스크리닝 목적의 추정치이며, 공식 CFP 인증을 대체하지 않습니다.'),
          bullet(
            '월별 raw 데이터가 부재한 경우, 가상 분해(연 합계 보존, 산업 평균 계절성 패턴)를 적용하였으며 ' +
              '실제 검증 시 의뢰사 ERP 데이터로 교체가 필요합니다.',
          ),
          bullet('Primary Activity Data 의 원본 파일은 별도 보존되며 본 패키지에는 텍스트 인덱스만 포함되어 있습니다.'),
          blank(),

          heading2('5. 서명'),
          dataTable(
            ['구분', '이름', '서명/날인', '날짜'],
            [
              ['수행 기관 책임자', meta?.practitioner || '', '', today],
              ['의뢰사 확인자', meta?.commissioner || '', '', ''],
            ],
          ),
        ],
      },
    ],
  })

  const buf = await Packer.toBlob(doc)
  return buf
}
