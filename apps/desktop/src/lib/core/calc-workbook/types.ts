/**
 * 산정 워크북 타입 정의 — Python PoC (scripts/generate-calc-workbook-poc.py) 1:1 포팅
 *
 * KS I ISO 14067:2018 검증 통과 등급 산정 워크북 출력에 필요한 도메인 모델.
 * Zustand `PCFState` 와는 별도 표현 — store-adapter.ts 가 두 모델 간 변환 담당.
 */

// ============================================================================
// 활동 데이터 (BOM)
// ============================================================================

/** ISO 14067 §6.3.5 데이터 품질 — 1=best ~ 5=worst */
export interface DqrScore {
  ter: number // Time-related (시간)
  ger: number // Geographical (지리)
  tir: number // Technology (기술)
}

/** §6.4.9.4 전력 처리 4유형 분류 */
export type PowerSourceType =
  | '외부그리드'
  | '자체발전'
  | '직접연결'
  | 'REC인증재생'

/** §6.3.8 폐기 시나리오 처리 방법 */
export type TreatmentMethod =
  | '재활용'
  | '매립'
  | '소각'
  | '위탁처리'
  | '폐수처리'
  | string

/** BOM 항목 — 입력 또는 출력 */
export interface BomItem {
  direction: 'input' | 'output'
  /** 분류: 원료물질 / 보조물질 / 유틸리티 / 에너지 / 육상운송 / 포장 / 제품 / 매립 / 지정폐기물 / 폐수 등 */
  category: string
  name: string

  collectedUnit: string
  collectedQty: number
  appliedUnit: string
  appliedQty: number

  /** 농도 환산 — H2SO4(시판 기준)는 false, NaOH/H2O2(순물질 기준)는 true */
  concentrationPct: number // 기본 100
  applyConcentration: boolean

  /** Cut-off 적용 사유 (있으면 S=0). §6.3.4.3 */
  cutOff: string

  /** EF DB seq (1-base, 0이면 cut-off / FU anchor) */
  efSeq: number

  /** §6.3.6 — 12개월 분해 (없으면 monthly-expander 가 가상 분해) */
  collectedMonthly?: number[] | null

  /** 운송 항목 메타 (육상운송 카테고리만) */
  transportMode?: string
  transportDistanceKm?: number

  /** 전력 항목 메타 (§6.4.9.4) */
  powerSourceType?: PowerSourceType
  powerSupplier?: string

  /** 폐기물 항목 메타 (§6.3.8) */
  treatmentMethod?: TreatmentMethod
  treatmentFacility?: string
  treatmentDistanceKm?: number

  note?: string

  dqr: DqrScore
}

// ============================================================================
// 제품 정의
// ============================================================================

export interface StageEmission {
  name: string
  valueKgCo2e: number
}

export interface SubCategoryEmission {
  /** Climate change - Biogenic / Fossil / Land use 등 */
  name: string
  valueKgCo2e: number
}

export interface ProductCFP {
  /** 시트명/cross-ref 키 — Excel 시트명 31자 제한 + 일부 문자 제한 */
  code: string
  displayName: string
  functionalUnit: string
  /** "황산니켈 1 ton" 등 LCIA 제품명 셀 라벨 */
  fuLabel: string

  impactCategory: string // 기본 "Climate change - global warming potential (GWP100)"
  unit: string // 기본 "kg CO2-Eq."

  /** 표기용 정적 합계 — cross-ref 사용 시 미사용. 미정시 0 */
  total: number

  stages: StageEmission[]
  subcategories: SubCategoryEmission[]
}

// ============================================================================
// 메타 (표지)
// ============================================================================

export interface Consultant {
  name: string
  phone: string
  email: string
}

export interface StudyMeta {
  projectTitle: string
  clientCompany: string
  clientAddress: string
  contactName: string
  contactPhone: string
  contactEmail: string
  consultants: Consultant[]
  studyDate: string
  standard: string
  gwpBasis: string
  assessmentPeriod: string
  purpose: string
}

// ============================================================================
// 민감도
// ============================================================================

export interface SensitivityScenario {
  name: string
  /** 변경된 매개변수의 baseline 값 (예: "980 kWh", "0.4173") */
  baseline: string
  /** baseline CFP — 검증심사원이 보는 비교 기준 (kgCO₂e) */
  baselineEmission?: number
  /** 시나리오 적용 후 CFP (kgCO₂e) */
  alternativeEmission?: number
  /** 변화량 (alt - base) */
  deltaKgCo2e: number
  /** 변화율 (delta / base, 0.077 = 7.7%) */
  deltaPct: number
  inRange: boolean
  note?: string
}

// ============================================================================
// EF DB
// ============================================================================

export interface SecondaryDataItem {
  seq: number
  owner: string
  uuid: string
  activityName: string
  geography: string
  referenceProduct: string
  unit: string
  amount: number
  efKgCo2e: number
  note?: string
}

// ============================================================================
// 통합 워크북 입력
// ============================================================================

export interface WorkbookData {
  meta: StudyMeta
  products: ProductCFP[]
  /** product.code → BOM */
  productBoms: Record<string, BomItem[]>
  /** product.code → FU 기준 kg (보통 1000 = 1 ton) */
  fuKgByProduct: Record<string, number>
  sensitivity: SensitivityScenario[]
  secondary: SecondaryDataItem[]
  /** product.code → 12개월 가중치 (없으면 디폴트 패턴) */
  monthlyWeightsByProduct?: Record<string, number[]>
}

// ============================================================================
// 결과
// ============================================================================

export interface WorkbookGenerationResult {
  blob: Blob
  /** 검증된 총 CFP — 살아있는 수식 평가 결과가 아닌 데이터 모델 기반 합계 */
  productTotalsKgCo2eByProduct: Record<string, number>
  /** 시트 수 */
  sheetCount: number
  /** 차트 수 */
  chartCount: number
}
