/**
 * #6 Allocation Methodology — 할당 절차 정당화
 *
 * KS I ISO 14067 §6.4.6 (할당) + ISO 14044 §5.3.5 우선순위 준수.
 * 다출력/재활용 할당 방법 선택 사유 + 적용 결과 문서화.
 */

import { Document, Packer } from 'docx'
import {
  blank,
  bullet,
  dataTable,
  heading2,
  heading3,
  isoNote,
  metaTable,
  paragraph,
  title,
} from '../docx-helpers'
import {
  MULTI_OUTPUT_ALLOCATION_METHODS,
  RECYCLING_ALLOCATION_METHODS,
} from '../../allocation'
import type { PCFState } from '../../store'

export async function buildAllocationMethodologyDocx(state: PCFState): Promise<Blob> {
  const mo = state.multiOutputAllocation
  const rec = state.recyclingAllocation

  const moMethodLabel = MULTI_OUTPUT_ALLOCATION_METHODS[mo.method]?.nameKo ?? mo.method
  const recMethodLabel = RECYCLING_ALLOCATION_METHODS[rec.method]?.nameKo ?? rec.method

  const coProducts = mo.coProducts ?? []
  const main = mo.mainProductData

  const doc = new Document({
    styles: { default: { document: { run: { font: '맑은 고딕' } } } },
    sections: [
      {
        children: [
          title('할당 방법 정당화 (Allocation Methodology)'),
          paragraph(
            'KS I ISO 14067:2018 §6.4.6 (할당) 및 ISO 14044 §5.3.5 우선순위 ' +
              '(① 분리 → ② 시스템 확장 → ③ 물리적 → ④ 경제적) 에 따라 본 산정에서 ' +
              '적용한 할당 절차의 선택 근거와 결과를 문서화합니다.',
          ),
          isoNote(
            '※ 대체 할당 절차 적용 시 §6.4.6.1 에 따라 민감도 분석이 의무 — 별첨 「Sensitivity_Analysis」 참조.',
          ),
          blank(),

          heading2('1. 다출력 (Multi-Output) 할당'),
          metaTable([
            ['선택된 방법', moMethodLabel],
            ['물리적 기준', mo.physicalBasis ?? '—'],
            ['주제품명', main?.name ?? '(미정)'],
            ['주제품 수량', main ? `${main.quantity} ${main.unit}` : '—'],
            ['주제품 비율 (Share)', `${(mo.mainProductShare * 100).toFixed(1)}%`],
            ['주제품 질량 (kg)', main?.mass != null ? String(main.mass) : '—'],
            [
              '주제품 에너지 함량',
              main?.energyContent != null ? `${main.energyContent} MJ` : '—',
            ],
            [
              '주제품 경제적 가치',
              main?.economicValue != null ? `${main.economicValue} 원/${main.unit}` : '—',
            ],
            ['총 공정 배출량', `${mo.totalProcessEmission ?? 0} kg CO₂e`],
            ['정당화 근거', mo.justification || '(미입력)'],
          ]),
          blank(),

          coProducts.length > 0
            ? heading3('1.1 부산물 (Co-Products) 목록')
            : paragraph('부산물(Co-product)이 정의되지 않았습니다.', { italics: true }),
          ...(coProducts.length > 0
            ? [
                dataTable(
                  ['명칭', '수량', '할당값(kg)', '에너지(MJ)', '경제(원)', '탄소(kg C)', '할당 비율'],
                  coProducts.map((c) => [
                    c.name,
                    `${c.quantity} ${c.unit}`,
                    String(c.allocationValue),
                    c.energyContent != null ? String(c.energyContent) : '—',
                    c.economicValue != null ? String(c.economicValue) : '—',
                    c.carbonContent != null ? String(c.carbonContent) : '—',
                    c.allocationShare != null ? `${(c.allocationShare * 100).toFixed(1)}%` : '—',
                  ]),
                ),
              ]
            : []),
          blank(),

          heading2('2. 재활용 (Recycling) 할당'),
          metaTable([
            ['선택된 방법', recMethodLabel],
            ['루프 유형', rec.loopType ?? '—'],
            ['재활용률', `${(rec.recyclingRate * 100).toFixed(1)}%`],
            ['재활용 원료 함량 (R1)', `${(rec.recycledContentInput * 100).toFixed(1)}%`],
            ['재활용 가능률 (R2)', `${(rec.recyclabilityOutput * 100).toFixed(1)}%`],
            ['대체 원료', rec.substitutedMaterial?.name ?? '—'],
            [
              '대체 원료 EF',
              rec.substitutedMaterial
                ? `${rec.substitutedMaterial.emissionFactor} kg CO₂e/kg`
                : '—',
            ],
            [
              '품질 계수 (Qs,in)',
              rec.qualityFactorInput != null ? String(rec.qualityFactorInput) : '—',
            ],
            [
              '품질 계수 (Qs,out)',
              rec.qualityFactorOutput != null ? String(rec.qualityFactorOutput) : '—',
            ],
            ['정당화 근거', rec.justification || '(미입력)'],
          ]),
          blank(),

          heading2('3. ISO 14044 §5.3.5 / ISO 14067 §6.4.6 우선순위'),
          bullet('① 할당 회피 (분리/시스템 확장)가 가능한 경우 우선 적용한다.'),
          bullet('② 분리 불가 시 시스템 확장으로 부산물의 회피 영향을 차감한다.'),
          bullet('③ 위 둘 모두 불가 시 물리적 관계(질량/에너지/체적)에 기반한 할당 적용.'),
          bullet('④ 물리적 관계 정의 불가 시 경제적 가치 기반 할당 — 단 가격 변동성 민감도 분석 의무.'),
          isoNote(
            'PCR 또는 CFP-PCR이 KS I ISO/TS 14027에 따라 개발되었고 할당 방법을 지정한 경우, ' +
              '§6.4.6.1 에 따라 추가 민감도 분석은 면제될 수 있다.',
          ),
          blank(),

          heading2('4. 본 산정의 할당 적용 검토 결과'),
          bullet(
            mo.method === 'subdivision'
              ? '다출력 — 하위 분할 적용으로 할당 회피 (1순위 우선).'
              : mo.method === 'system_expansion'
              ? '다출력 — 시스템 확장 적용 (부산물 회피 영향 차감).'
              : mo.method === 'physical'
              ? `다출력 — 물리적 할당 적용 (기준: ${mo.physicalBasis ?? '미정'}). 분리/시스템 확장 적용 불가 사유는 위 정당화 근거 참조.`
              : mo.method === 'economic'
              ? '다출력 — 경제적 할당 적용. 가격 변동성 민감도 분석 별첨 참조 (§6.4.6.1 의무).'
              : `다출력 — ${mo.method} 적용.`,
          ),
          bullet(
            rec.method === 'cut_off'
              ? '재활용 — Cut-off (100:0) 적용. 1차 생산자 부담, 2차 제로. ISO 14067 zero-burden 원칙.'
              : rec.method === 'eol_recycling'
              ? '재활용 — EOL Recycling (0:100) 적용. 사용자 단계 부담.'
              : rec.method === 'fifty_fifty'
              ? '재활용 — 50:50 균등 할당 (생산자/사용자 균등 분담).'
              : rec.method === 'substitution'
              ? '재활용 — Substitution (시스템 확장) 적용. 대체 원료 EF 차감.'
              : rec.method === 'pef_formula'
              ? '재활용 — PEF Circular Footprint Formula 적용 (R1·R2·Qs 가중치 반영).'
              : `재활용 — ${rec.method} 적용.`,
          ),
        ],
      },
    ],
  })

  return Packer.toBlob(doc)
}
