/**
 * 토리컴 NiSO4 PoC 픽스처 — Python `TORICOMM_*` 1:1 포팅.
 *
 * 회귀 검증용 + 통합 테스트용. 결과 합계 = 1,065.43 kgCO₂e/ton 보장.
 * 가상의 2번째 제품(Powder HYPO) 포함하여 다제품 아키텍처 검증.
 */

import {
  DEFAULT_MONTHLY_WEIGHTS_NISO4,
  DEFAULT_MONTHLY_WEIGHTS_POWDER,
} from './monthly-expander'
import type {
  BomItem,
  ProductCFP,
  SecondaryDataItem,
  SensitivityScenario,
  StudyMeta,
  WorkbookData,
} from './types'

export const TORICOMM_META: StudyMeta = {
  projectTitle: '(주)토리컴 황산니켈 제품 탄소발자국 산정',
  clientCompany: '(주)토리컴',
  clientAddress: '충남 아산시 (본사·생산공장)',
  contactName: '(미정 — 클라이언트 입력)',
  contactPhone: '(미정 — 클라이언트 입력)',
  contactEmail: '(미정 — 클라이언트 입력)',
  consultants: [{ name: '카보니 (Carbony) AI 컨설턴트', phone: '—', email: '—' }],
  studyDate: '2026-04-27 (run05)',
  standard: 'ISO 14067:2018 / KS I ISO 14067',
  gwpBasis: 'IPCC AR6, 100년 (GWP100)',
  assessmentPeriod: '2025년 1월~12월 (12개월 평균)',
  purpose: '양극재 고객사 공급망 CFP 보고 대응 (1차 자체 산정)',
}

export const TORICOMM_NISO4: ProductCFP = {
  code: 'NiSO4-99.99-Granule',
  displayName: '황산니켈 (NiSO4 99.99% Granule 0.5~1.5mm)',
  functionalUnit: '1 ton NiSO4 (FIBC 1Ton/Bag 출하 기준)',
  fuLabel: '황산니켈 1 ton',
  impactCategory: 'Climate change - global warming potential (GWP100)',
  unit: 'kg CO2-Eq.',
  total: 1065.43,
  stages: [
    { name: '원료 채취', valueKgCo2e: 309.03 },
    { name: '제조', valueKgCo2e: 696.95 },
    { name: '운송', valueKgCo2e: 55.73 },
    { name: '포장', valueKgCo2e: 3.72 },
  ],
  subcategories: [
    { name: 'Climate change - Biogenic', valueKgCo2e: 0.0 },
    { name: 'Climate change - Fossil', valueKgCo2e: 1065.43 },
    { name: 'Climate change - Land use and land use change', valueKgCo2e: 0.0 },
  ],
}

export const TORICOMM_NISO4_POWDER_HYPO: ProductCFP = {
  code: 'NiSO4-99.9-Powder-HYPO',
  displayName: '[가상] 황산니켈 (NiSO4 99.9% Powder)',
  functionalUnit: '1 ton NiSO4 Powder (가상 시나리오)',
  fuLabel: '황산니켈 Powder 1 ton',
  impactCategory: 'Climate change - global warming potential (GWP100)',
  unit: 'kg CO2-Eq.',
  total: 0,
  stages: [
    { name: '원료 채취', valueKgCo2e: 0 },
    { name: '제조', valueKgCo2e: 0 },
    { name: '운송', valueKgCo2e: 0 },
    { name: '포장', valueKgCo2e: 0 },
  ],
  subcategories: [
    { name: 'Climate change - Biogenic', valueKgCo2e: 0 },
    { name: 'Climate change - Fossil', valueKgCo2e: 0 },
    { name: 'Climate change - Land use and land use change', valueKgCo2e: 0 },
  ],
}

export const TORICOMM_SECONDARY: SecondaryDataItem[] = [
  { seq: 1, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: '황산 (98%) 생산', geography: 'GLO', referenceProduct: 'Sulphuric acid', unit: 'kg', amount: 1.0, efKgCo2e: 0.14, note: '원료물질' },
  { seq: 2, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: '수산화나트륨 50% 용액 생산', geography: 'GLO', referenceProduct: 'Sodium hydroxide (50% sol.)', unit: 'kg', amount: 1.0, efKgCo2e: 1.20, note: '원료물질 (NaOH 농도 환산 적용)' },
  { seq: 3, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: '과산화수소 35% 용액 생산', geography: 'GLO', referenceProduct: 'Hydrogen peroxide (35% sol.)', unit: 'kg', amount: 1.0, efKgCo2e: 1.50, note: '원료물질 (H2O2 농도 환산 적용)' },
  { seq: 4, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: '공업용수 공급', geography: 'KR', referenceProduct: 'Industrial water', unit: 'm3', amount: 1.0, efKgCo2e: 0.35, note: '유틸리티' },
  { seq: 5, owner: '한국환경공단 (KECO)', uuid: '', activityName: '한국 전력 그리드 평균', geography: 'KR', referenceProduct: '전력 (저압)', unit: 'kWh', amount: 1.0, efKgCo2e: 0.4173, note: '전기 (앱 내장 / 2023년 기준)' },
  { seq: 6, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: 'LNG 직접연소 (산업용)', geography: 'KR', referenceProduct: 'Natural gas combustion', unit: 'Nm3', amount: 1.0, efKgCo2e: 2.75, note: '연료' },
  { seq: 7, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: '산업용 외부 구매 스팀', geography: 'KR', referenceProduct: 'Industrial steam, purchased', unit: 'kg', amount: 1.0, efKgCo2e: 0.22, note: '에너지 (외부 구매 가정)' },
  { seq: 8, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: '16-32t 디젤 화물차량, ton-km 평균', geography: 'KR', referenceProduct: 'Articulated lorry transport, 16-32t', unit: 'ton-km', amount: 1.0, efKgCo2e: 0.10, note: '육상운송 (입고/출하 공통)' },
  { seq: 9, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: 'PP (폴리프로필렌) 생산', geography: 'GLO', referenceProduct: 'Polypropylene (PP) granulate', unit: 'kg', amount: 1.0, efKgCo2e: 1.86, note: '포장 (FIBC 빅백)' },
  { seq: 10, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: '무기성 슬러지 매립', geography: 'KR', referenceProduct: 'Landfill, inert waste', unit: 'kg', amount: 1.0, efKgCo2e: 0.03, note: '폐기물 (중화 슬러지)' },
  { seq: 11, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: '지정폐기물 처리', geography: 'KR', referenceProduct: 'Hazardous waste treatment', unit: 'kg', amount: 1.0, efKgCo2e: 1.20, note: '폐기물 (지정폐기물)' },
  { seq: 12, owner: 'CarbonMate 내장 LCI DB', uuid: '', activityName: '산업폐수 처리', geography: 'KR', referenceProduct: 'Industrial wastewater treatment', unit: 'm3', amount: 1.0, efKgCo2e: 0.40, note: '폐기물' },
]

const dqr = (ter: number, ger: number, tir: number) => ({ ter, ger, tir })

export const TORICOMM_BOM: BomItem[] = [
  // 원료물질 (cut-off 2 + EF 적용 3)
  { direction: 'input', category: '원료물질', name: '조황산니켈 (구리 정련 부산물)', collectedUnit: 'kg', collectedQty: 1450.0, appliedUnit: 'kg', appliedQty: 1450.0, concentrationPct: 100, applyConcentration: false, cutOff: 'Cut-off — 구리 정련의 결정 제품 외 부산물 (ISO 14044 §5.3.5 ①)', efSeq: 0, dqr: dqr(1, 1, 1) },
  { direction: 'input', category: '원료물질', name: '배터리 슬러지 (폐기물 유래)', collectedUnit: 'kg', collectedQty: 620.0, appliedUnit: 'kg', appliedQty: 620.0, concentrationPct: 100, applyConcentration: false, cutOff: 'Cut-off — 발생자가 폐기물로 인계 (ISO 14067 zero-burden)', efSeq: 0, dqr: dqr(1, 1, 1) },
  { direction: 'input', category: '원료물질', name: '황산 (H2SO4 98%, 시판품)', collectedUnit: 'kg', collectedQty: 60.0, appliedUnit: 'kg', appliedQty: 60.0, concentrationPct: 98.0, applyConcentration: false, cutOff: '', efSeq: 1, dqr: dqr(3, 4, 2), note: 'EF은 시판 농도 98% 기준 — 농도 환산 미적용' },
  { direction: 'input', category: '원료물질', name: '수산화나트륨 (NaOH 50% 용액)', collectedUnit: 'kg', collectedQty: 380.0, appliedUnit: 'kg', appliedQty: 190.0, concentrationPct: 50.0, applyConcentration: true, cutOff: '', efSeq: 2, dqr: dqr(3, 4, 2), note: '원액 380 kg × 농도 50% = 순물질 190 kg' },
  { direction: 'input', category: '원료물질', name: '과산화수소 (H2O2 35% 용액)', collectedUnit: 'kg', collectedQty: 130.0, appliedUnit: 'kg', appliedQty: 45.5, concentrationPct: 35.0, applyConcentration: true, cutOff: '', efSeq: 3, dqr: dqr(3, 4, 2), note: '원액 130 kg × 농도 35% = 순물질 45.5 kg' },
  // 유틸리티
  { direction: 'input', category: '유틸리티', name: '공업용수 (용해 8.5 + 정제 4.0 m³)', collectedUnit: 'm3', collectedQty: 12.5, appliedUnit: 'm3', appliedQty: 12.5, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 4, dqr: dqr(2, 1, 2) },
  // 에너지
  { direction: 'input', category: '에너지', name: '한국 전력 (용해220+중화95+정제180+결정화410+제품화75)', collectedUnit: 'kWh', collectedQty: 980.0, appliedUnit: 'kWh', appliedQty: 980.0, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 5, dqr: dqr(2, 1, 1), note: '단계별 합산 — 용해+중화+정제+결정화+제품화 = 980 kWh', powerSourceType: '외부그리드', powerSupplier: '한국전력공사 — 한국 평균 (KECO 2023)' },
  { direction: 'input', category: '에너지', name: 'LNG 직접연소 (보일러)', collectedUnit: 'Nm3', collectedQty: 12.0, appliedUnit: 'Nm3', appliedQty: 12.0, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 6, dqr: dqr(2, 1, 2) },
  { direction: 'input', category: '에너지', name: '산업용 외부 구매 스팀', collectedUnit: 'kg', collectedQty: 850.0, appliedUnit: 'kg', appliedQty: 850.0, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 7, dqr: dqr(3, 1, 3), note: '외부 구매 가정 — 자체 보일러 시 LNG 별도 적용 필요' },
  // 운송 (모두 efSeq=8)
  { direction: 'input', category: '육상운송', name: '조황산니켈 입고 (울산→아산)', collectedUnit: 'ton-km', collectedQty: 391.5, appliedUnit: 'ton-km', appliedQty: 391.5, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 8, dqr: dqr(2, 1, 2), transportMode: '국내육상운송', transportDistanceKm: 270.0, note: '1.45 t × 270 km' },
  { direction: 'input', category: '육상운송', name: '배터리 슬러지 입고 (충북→아산)', collectedUnit: 'ton-km', collectedQty: 55.8, appliedUnit: 'ton-km', appliedQty: 55.8, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 8, dqr: dqr(2, 1, 2), transportMode: '국내육상운송', transportDistanceKm: 90.0, note: '0.62 t × 90 km' },
  { direction: 'input', category: '육상운송', name: '황산니켈 출하 (아산→충북 고객사)', collectedUnit: 'ton-km', collectedQty: 110.0, appliedUnit: 'ton-km', appliedQty: 110.0, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 8, dqr: dqr(2, 1, 2), transportMode: '국내육상운송', transportDistanceKm: 110.0, note: '1.0 t × 110 km' },
  // 포장
  { direction: 'input', category: '포장', name: 'FIBC 빅백 (PP) 1 EA', collectedUnit: 'kg', collectedQty: 2.0, appliedUnit: 'kg', appliedQty: 2.0, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 9, dqr: dqr(3, 4, 2), note: '앱 내장 1.86 vs 데이터셋 2.00 — 차이 5% 이내' },
  // 출력: 제품 (FU anchor)
  { direction: 'output', category: '제품', name: '황산니켈 (NiSO4 99.99% Granule)', collectedUnit: 'kg', collectedQty: 1000.0, appliedUnit: 'kg', appliedQty: 1000.0, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 0, dqr: dqr(1, 1, 1), note: '기능단위 anchor — 모든 N열 환산의 분모' },
  // 출력: 폐기물
  { direction: 'output', category: '매립', name: '중화 슬러지 (무기성)', collectedUnit: 'kg', collectedQty: 320.0, appliedUnit: 'kg', appliedQty: 320.0, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 10, dqr: dqr(2, 1, 3), treatmentMethod: '매립 (안정화)', treatmentFacility: '(미정 — 클라이언트 입력)', treatmentDistanceKm: 45.0 },
  { direction: 'output', category: '지정폐기물', name: '지정폐기물 처리', collectedUnit: 'kg', collectedQty: 45.0, appliedUnit: 'kg', appliedQty: 45.0, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 11, dqr: dqr(2, 1, 3), treatmentMethod: '위탁처리', treatmentFacility: '(미정 — 클라이언트 입력)', treatmentDistanceKm: 80.0 },
  { direction: 'output', category: '폐수', name: '산업폐수 처리', collectedUnit: 'm3', collectedQty: 11.0, appliedUnit: 'm3', appliedQty: 11.0, concentrationPct: 100, applyConcentration: false, cutOff: '', efSeq: 12, dqr: dqr(2, 1, 3), treatmentMethod: '폐수처리 (자체+위탁)', treatmentFacility: '(미정 — 클라이언트 입력)', treatmentDistanceKm: 0.0 },
]

const BASE_CFP = 1065.43

export const TORICOMM_SENSITIVITY: SensitivityScenario[] = [
  { name: '전력 사용량 +20%', baseline: '980 kWh', baselineEmission: BASE_CFP, alternativeEmission: BASE_CFP + 81.79, deltaKgCo2e: 81.79, deltaPct: 0.077, inRange: true },
  { name: '전력 사용량 -20%', baseline: '980 kWh', baselineEmission: BASE_CFP, alternativeEmission: BASE_CFP - 81.79, deltaKgCo2e: -81.79, deltaPct: -0.077, inRange: true },
  { name: 'NaOH 사용량 +20%', baseline: '380 kg (50% 용액)', baselineEmission: BASE_CFP, alternativeEmission: BASE_CFP + 22.80, deltaKgCo2e: 22.80, deltaPct: 0.021, inRange: true },
  { name: 'H2O2 사용량 +20%', baseline: '130 kg (35% 용액)', baselineEmission: BASE_CFP, alternativeEmission: BASE_CFP + 13.65, deltaKgCo2e: 13.65, deltaPct: 0.013, inRange: true },
  { name: '운송 EF 상한 (0.13)', baseline: '0.10', baselineEmission: BASE_CFP, alternativeEmission: BASE_CFP + 16.72, deltaKgCo2e: 16.72, deltaPct: 0.016, inRange: true },
  { name: '경제적 배분 (조황산니켈)', baseline: '데이터 부족', baselineEmission: BASE_CFP, alternativeEmission: BASE_CFP, deltaKgCo2e: 0, deltaPct: 0, inRange: false, note: '확인 필요 — 매입 단가 확보 후 별도 분석' },
  { name: '전력 EF 데이터셋 (0.4594)', baseline: '0.4173 (한국환경공단 2023)', baselineEmission: BASE_CFP, alternativeEmission: BASE_CFP + 41.25, deltaKgCo2e: 41.25, deltaPct: 0.039, inRange: true },
]

/** Granule BOM 기반으로 Powder HYPO 70% 스케일 생성 */
function scaleBom(bom: BomItem[], factor: number): BomItem[] {
  return bom.map((it) => ({
    ...it,
    collectedQty: round(it.collectedQty * factor, 4),
    appliedQty: round(it.appliedQty * factor, 4),
    collectedMonthly: it.collectedMonthly
      ? it.collectedMonthly.map((v) => round(v * factor, 4))
      : null,
  }))
}

function round(n: number, digits: number): number {
  const m = 10 ** digits
  return Math.round(n * m) / m
}

export const TORICOMM_BOM_POWDER_HYPO: BomItem[] = (() => {
  const scaled = scaleBom(TORICOMM_BOM, 0.7)
  // 운송 1개만 거리 변경 — 320 km
  for (const it of scaled) {
    if (it.category === '육상운송' && it.name.includes('조황산니켈')) {
      it.transportDistanceKm = 320.0
      const newQty = round(1.45 * 0.7 * 320.0, 2)
      it.collectedQty = newQty
      it.appliedQty = newQty
      it.collectedMonthly = null
      it.note = '[가상] 다른 공급사 — 1.015 t × 320 km = 324.8 ton-km'
      break
    }
  }
  return scaled
})()

/** 토리컴 통합 워크북 데이터 */
export const TORICOMM_WORKBOOK_DATA: WorkbookData = {
  meta: TORICOMM_META,
  products: [TORICOMM_NISO4, TORICOMM_NISO4_POWDER_HYPO],
  productBoms: {
    [TORICOMM_NISO4.code]: TORICOMM_BOM,
    [TORICOMM_NISO4_POWDER_HYPO.code]: TORICOMM_BOM_POWDER_HYPO,
  },
  fuKgByProduct: {
    [TORICOMM_NISO4.code]: 1000,
    [TORICOMM_NISO4_POWDER_HYPO.code]: 1000,
  },
  sensitivity: TORICOMM_SENSITIVITY,
  secondary: TORICOMM_SECONDARY,
  monthlyWeightsByProduct: {
    [TORICOMM_NISO4.code]: Array.from(DEFAULT_MONTHLY_WEIGHTS_NISO4),
    [TORICOMM_NISO4_POWDER_HYPO.code]: Array.from(DEFAULT_MONTHLY_WEIGHTS_POWDER),
  },
}
