import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { updateAutoSaveMeta } from './draft-manager'
import {
    MultiOutputAllocation,
    RecyclingAllocation,
    DEFAULT_MULTI_OUTPUT_ALLOCATION,
    DEFAULT_RECYCLING_ALLOCATION,
    MultiOutputAllocationMethod,
    RecyclingAllocationMethod,
    PhysicalAllocationBasis,
    LoopType,
    CoProduct,
    MainProductData
} from './allocation'
import { SensitivityAnalysisResult } from './sensitivity-analysis'
import { CutOffCriteria, CutOffResult, CutOffPreset, NO_CUT_OFF, getCutOffPreset } from './cut-off-criteria'
import { CFPSnapshot, CFPTrackingResult, calculateCFPTrend, generateSnapshotId, getCurrentDateISO } from './cfp-tracking'

// =============================================================================
// 타입 정의
// =============================================================================

export type BoundaryType = 'cradle-to-gate' | 'cradle-to-grave' | 'gate-to-gate'
export type EmissionSourceType = 'fossil' | 'biogenic' | 'mixed'
export type DataQualityType = 'primary' | 'secondary' | 'estimated'
export type TransportMode = 'truck' | 'rail' | 'ship' | 'aircraft'

/**
 * CFP 연구 목표 (ISO 14067 6.3.1)
 */
export interface StudyGoal {
    applicationPurpose: string       // 활용 목적 (내부/외부)
    reasonForStudy: string           // 수행 이유
    targetAudience: string           // 대상 청중
    cfpPcrReference?: string         // CFP-PCR 참조 (선택)
    isCommunicationIntended: boolean // 외부 정보전달 의도 여부
}

/**
 * 데이터 시간 경계 (ISO 14067 6.3.6)
 */
/**
 * P1-2: 가치 선택 기록 (ISO 14067 7.3 n)
 * 방법론 선택, 가정, 의사결정의 근거를 투명하게 문서화합니다.
 */
export type ValueChoiceCategory =
    | 'allocation'       // 할당 방법 선택
    | 'eol'              // 폐기 시나리오 선택
    | 'electricity'      // 전력 그리드/배출계수 선택
    | 'cutoff'           // 제외 기준 설정
    | 'boundary'         // 시스템 경계 결정
    | 'data_source'      // 데이터 출처 선택
    | 'characterization' // 특성화 인자 선택
    | 'other'

export interface ValueChoice {
    id: string
    category: ValueChoiceCategory
    decision: string        // 선택한 사항 (예: "물리적 할당 - 질량 기준")
    alternative: string     // 대안 (예: "경제적 할당, 시스템 확장")
    justification: string   // 정당화 근거
    isoReference: string    // ISO 14067 관련 조항 (예: "6.4.6.2")
    impact?: string         // 결과에 미치는 영향 설명
    timestamp: string
}

/**
 * P2-7: PCR 참조 (ISO 14067 7.3 s)
 */
export interface PCRReference {
    id: string
    name: string                // PCR 명칭
    operator: string            // 운영 기관 (예: EPD International, 환경부)
    version?: string            // 버전
    productCategory?: string    // 제품 카테고리
    validUntil?: string         // 유효 기한
    url?: string                // 참조 URL
    /** P1-7: PCR 미존재 표시 (해당 카테고리에 적용 가능 PCR 없음) */
    isAbsent?: boolean
    /** P1-7: PCR 미존재 사유 (보고서 문서화용) */
    absenceReason?: string
}

/**
 * 보고서 메타데이터 (ISO 14067 7항 보고서 일반사항)
 */
export type ReportType = 'study' | 'communication' | 'tracking'
export type ConfidentialityLevel = 'internal' | 'public' | 'restricted'

export interface ReportMeta {
    reportNumber: string            // 보고서 번호 (예: CM-PCF-2026-001)
    commissioner: string            // 의뢰자 (회사명)
    practitioner: string            // 수행 기관/담당자
    reportType: ReportType          // 보고서 유형
    confidentiality: ConfidentialityLevel
    geographicScope?: string        // 지리적 범위 (예: '대한민국 경기도 화성시')
    technologicalScope?: string     // 기술적 범위 (예: '습식 공정, 자동 조립')
}

/**
 * 검토 정보 (ISO 14067 6.7, 7.3 m)
 */
export type ReviewType = 'internal' | 'external' | 'critical_review' | 'none'

export interface ReviewInfo {
    reviewType: ReviewType
    reviewerName?: string
    reviewerOrganization?: string
    reviewDate?: string
    reviewScope?: string
    reviewStatement?: string
}

export const PCR_PRESETS: Omit<PCRReference, 'id'>[] = [
    { name: 'UN CPC 211 - 식육, 식용부산물', operator: 'EPD International', version: '2019:06 v1.2', productCategory: '축산물' },
    { name: 'UN CPC 2141 - 냉동 채소류', operator: 'EPD International', version: '2019:08 v1.1', productCategory: '식품 (채소)' },
    { name: 'UN CPC 23 - 유제품', operator: 'EPD International', version: '2020:01 v1.0', productCategory: '유제품' },
    { name: 'UN CPC 35 - 전기·전자 기기', operator: 'EPD International', version: '2021:03', productCategory: '전기전자' },
    { name: '환경성적표지 PCR - 식료품', operator: '한국환경산업기술원', version: '개정 2022', productCategory: '식료품' },
    { name: '환경성적표지 PCR - 전기전자', operator: '한국환경산업기술원', version: '개정 2023', productCategory: '전기전자' },
    { name: '환경성적표지 PCR - 포장재', operator: '한국환경산업기술원', version: '개정 2023', productCategory: '포장재' },
]

export interface TimeBoundary {
    dataCollectionStart: string      // 데이터 수집 시작 (YYYY-MM)
    dataCollectionEnd: string        // 데이터 수집 종료 (YYYY-MM)
    cfpRepresentativeYear: string    // CFP 대표 연도
    seasonalVariationConsidered: boolean  // 계절 변동 고려 여부
    justification?: string           // 정당화 근거
}

/**
 * 제품 기본 정보
 */
export interface ProductInfo {
    name: string
    category: string
    unit: string // Functional Unit
    boundary: BoundaryType
    referenceFlow?: string // ISO 14067 6.3.3 - 기준 흐름
    studyGoal?: StudyGoal       // ISO 14067 6.3.1
    timeBoundary?: TimeBoundary // ISO 14067 6.3.6
    /** 제품 식별 및 규격 (sample-improved-report-v2 §2.1, §2.2 + 타사 보고서 통상 항목) */
    productSpec?: {
        form?: string                   // "Granule 0.5~1.5mm"
        purity?: string                 // "99.99% UP"
        application?: string            // "EV 배터리 양극재 전구체"
        deliveryState?: string          // "1 ton/bag, FIBC 빅백"
        casNumber?: string              // CAS No.
        manufacturingPlant?: string     // 제조 공장 위치
        annualProduction?: string       // 대상 생산량 / 연간 생산량
        manufacturingProcessOverview?: string // 제조 공정 개요 (자유 텍스트)
        qualityCriteria?: Array<{
            item: string                // 항목 (예: "수분", "Ni 함량")
            value: string               // 값 (예: "≤ 1%", "[작성 필요]")
            note?: string               // 비고
        }>
    }
    /** dLUC (직접 토지이용변화) — IPCC 2006 Vol 4 Ch 2/8 기반 산정 (ISO 14067 7.2 d) */
    dLUC?: {
        applicable: boolean
        areaM2?: number                  // 부지 면적
        previousLandCover?: string       // 예: "온대림", "초지", "농경지"
        biomassCPerHa?: number           // t C/ha — 식 2.16 (default 150 = 온대림)
        domCPerHa?: number               // t C/ha — 식 2.23 (default 10)
        soilCPerHa?: number              // t C/ha — 식 2.25 (default 80 = LAC)
        annualProductionKg?: number      // 연간 생산량 (선언단위 분배용)
        conversionDate?: string          // 토지전환 일자
        rationale?: string               // 산정 근거/비고
    }
}

/**
 * 데이터 품질 정보 (ISO 14067 6.3.5)
 */
export interface DataQuality {
    type: DataQualityType
    source: string
    year: number
    geographicScope: string
    uncertainty?: number // %
}

/**
 * LCI 가이드 정보 (외교관에서 가져온 메타데이터)
 */
export interface LciGuideInfo {
    activityUuid: string      // ecoinvent 고유 ID (증빙용)
    activityName: string      // 표준 영문 명칭
    geography: string         // 지역 코드 (KR, GLO 등)
    unit: string              // 기본 단위 (kg, kWh 등)
    isoComplianceScore: number    // 1~4점
    recommendationReason: string  // AI 추천 사유 (한국어)
    dataQuality: {
        time: number       // 시간적 대표성 (1~5)
        geography: number  // 지리적 대표성 (1~5)
        technology: number // 기술적 대표성 (1~5)
    }
    // ISO 6가지 지표 점수 (0-100)
    isoScores?: {
        temporal: number
        geographical: number
        technological: number
        completeness: number
        precision: number
        consistency: number
        overall: number
    }
    // 메타데이터
    techCategory?: string      // virgin/recycled/mixed
    processType?: string       // production/treatment/transport/energy
    materialType?: string      // paper/plastic/metal/etc
}

/**
 * 데이터 등급 (1차/2차/대리)
 */
export type DataLevel = 'primary' | 'secondary' | 'proxy'

/**
 * 단일 활동 데이터 입력 항목
 */
export interface ActivityInput {
    id: string
    stageId: string
    name: string
    quantity: number
    unit: string
    emissionSourceType: EmissionSourceType
    emissionFactorId?: string // 배출계수 DB 참조 ID
    customEmissionFactor?: number // 사용자 지정 배출계수
    /** P1-run03-01: 용액 농도 (%). 100% 미만 시 quantity × concentration/100 환산 후 EF 곱셈. */
    concentrationPercent?: number
    dataQuality: DataQuality

    // [LCI 연동] 외교관에서 가져온 정보
    lciGuide?: LciGuideInfo
    dataLevel?: DataLevel  // 데이터 등급 (1차/2차/대리)

    // [프록시/분해] ISO 투명성 문서화 지원
    isProxy?: boolean              // 프록시 데이터 사용 여부
    proxyInfo?: {
        originalName: string       // 원본 자재명
        assumption: string         // 분해/프록시 가정
        uncertainty: string        // 불확실성 (예: ±20%)
        source: string             // 프록시 출처
    }
    decomposedFrom?: string        // 분해된 원본 자재 ID (분해된 항목인 경우)

    // [컷오프 분석] 기여도 및 제외 여부
    contributionPercent?: number  // 전체 대비 기여도 (%)
    isCutOff?: boolean            // 컷오프 대상 여부

    // [ISO 14067 5.11 투명성] 출처 및 가정 명시
    transparencyInfo?: {
        dataSource: string         // 데이터 출처 (예: "공급업체 환경보고서 2024")
        assumptions?: string       // 주요 가정 (예: "운송거리 평균값 적용")
        limitations?: string       // 제한사항
    }

    // [ISO 14067 5.12 중복배제] 중복 확인 무시 플래그
    duplicateIgnored?: boolean     // 의도적 중복인 경우 true
}

/**
 * 운송 데이터 (특수 처리 필요)
 */
export interface TransportInput extends ActivityInput {
    transportMode: TransportMode
    distance: number // km
    weight: number // kg
}

/**
 * 전력 데이터 (ISO 14067 6.4.9.4)
 */
export interface ElectricityInput extends ActivityInput {
    gridType: 'national' | 'regional' | 'supplier_specific' | 'onsite'
    gridRegion?: string
    renewableShare?: number // %
}

/**
 * 원자재 데이터
 */
export interface MaterialInput extends ActivityInput {
    materialType: string
    recycledContent?: number // %
}

// =============================================================================
// 단계별 활동 데이터 구조
// =============================================================================

/**
 * 포장재 데이터
 */
export interface PackagingInput extends ActivityInput {
    materialType: string
    recycledContent?: number // %
}

export interface StageActivityData {
    raw_materials: MaterialInput[]
    manufacturing: {
        electricity: ElectricityInput[]
        fuels: ActivityInput[]
        processEmissions: ActivityInput[]
    }
    transport: TransportInput[]
    packaging: PackagingInput[]
    use: {
        electricity: ElectricityInput[]
        consumables: ActivityInput[]
    }
    eol: {
        disposal: ActivityInput[]
        recycling: ActivityInput[]
    }
}

// =============================================================================
// 레거시 호환성을 위한 단순 데이터 구조 유지
// =============================================================================

export interface SimplifiedActivityData {
    // 원자재
    raw_material_weight?: number
    raw_material_type?: string

    // 제조
    electricity?: number
    electricity_grid?: string
    gas?: number
    diesel?: number

    // 운송
    transport_distance?: number
    transport_weight?: number
    transport_mode?: TransportMode

    // 포장
    packaging_weight?: number
    packaging_material?: string

    // 사용
    use_electricity?: number
    use_years?: number

    // 폐기
    waste_weight?: number
    recycling_rate?: number

    // 항공 운송 (ISO 14067 7.2 e 필수 분리)
    aircraft_transport_distance?: number
    aircraft_transport_weight?: number
}

// =============================================================================
// Store 상태 정의
// =============================================================================

export interface PCFState {
    // 기본 정보
    productInfo: ProductInfo
    stages: string[]

    // 활동 데이터 (레거시 호환)
    activityData: SimplifiedActivityData

    // 확장된 활동 데이터 (향후 사용)
    detailedActivityData?: Partial<StageActivityData>

    // 데이터 품질 메타데이터
    dataQualityMeta: {
        overallType: DataQualityType
        sources: string[]
        baseYear: number
    }

    // 할당 설정 (ISO 14067 6.4.6)
    multiOutputAllocation: MultiOutputAllocation
    recyclingAllocation: RecyclingAllocation

    // 민감도 분석 결과 (ISO 14067 6.4.5, 6.4.6.1, 6.6, 7.3 h)
    sensitivityAnalysis: SensitivityAnalysisResult | null

    // 제외 기준 설정 (ISO 14067 6.3.4.3)
    cutOffCriteria: CutOffCriteria
    cutOffPreset: CutOffPreset
    cutOffResult: CutOffResult | null

    // CFP 성과 추적 (ISO 14067 6.4.7)
    cfpHistory: CFPSnapshot[]

    // P1-2: 가치 선택 기록 (ISO 14067 7.3 n)
    valueChoices: ValueChoice[]

    // P2-5: 특성화 인자 모델 선택 (ISO 14067 7.3 f)
    characterizationModel: 'AR5' | 'AR6'

    // P2-7: PCR 참조 관리 (ISO 14067 7.3 s)
    pcrReferences: PCRReference[]

    // 보고서 메타데이터 (ISO 14067 7항)
    reportMeta: ReportMeta

    // 검토 정보 (ISO 14067 6.7)
    reviewInfo: ReviewInfo

    // Actions
    setProductInfo: (info: Partial<ProductInfo>) => void
    toggleStage: (stageId: string) => void
    setActivityData: (id: string, value: number) => void
    setActivityDataWithMeta: (id: string, value: number, meta?: Partial<DataQuality>) => void
    setTransportMode: (mode: TransportMode) => void
    setElectricityGrid: (grid: string) => void
    setDataQualityMeta: (meta: Partial<PCFState['dataQualityMeta']>) => void

    // 할당 관련 Actions
    setMultiOutputAllocationMethod: (method: MultiOutputAllocationMethod) => void
    setPhysicalAllocationBasis: (basis: PhysicalAllocationBasis) => void
    addCoProduct: (coProduct: CoProduct) => void
    removeCoProduct: (id: string) => void
    updateCoProduct: (id: string, updates: Partial<CoProduct>) => void
    setMainProductData: (data: Partial<MainProductData>) => void
    setTotalProcessEmission: (emission: number) => void
    setRecyclingAllocationMethod: (method: RecyclingAllocationMethod) => void
    setRecyclingParams: (params: Partial<RecyclingAllocation>) => void
    setAllocationJustification: (type: 'multiOutput' | 'recycling', justification: string) => void

    // 민감도 분석 관련 Actions
    setSensitivityAnalysis: (result: SensitivityAnalysisResult | null) => void

    // 제외 기준 관련 Actions (ISO 14067 6.3.4.3)
    setCutOffPreset: (preset: CutOffPreset) => void
    setCutOffCriteria: (criteria: Partial<CutOffCriteria>) => void
    setCutOffResult: (result: CutOffResult | null) => void

    // CFP 성과 추적 관련 Actions (ISO 14067 6.4.7)
    addCFPSnapshot: (cfpValue: number, notes?: string) => void
    removeCFPSnapshot: (id: string) => void
    getCFPTrackingResult: () => CFPTrackingResult | null

    // 상세 활동 데이터 관련 Actions
    addRawMaterial: (material: MaterialInput) => void
    removeRawMaterial: (id: string) => void
    updateRawMaterial: (id: string, updates: Partial<MaterialInput>) => void

    // Transport Actions
    addTransportStep: (transport: TransportInput) => void
    removeTransportStep: (id: string) => void
    updateTransportStep: (id: string, updates: Partial<TransportInput>) => void

    // Packaging Actions
    addPackagingPart: (packaging: PackagingInput) => void
    removePackagingPart: (id: string) => void
    updatePackagingPart: (id: string, updates: Partial<PackagingInput>) => void

    // P1-2: 가치 선택 관련 Actions (ISO 14067 7.3 n)
    addValueChoice: (choice: Omit<ValueChoice, 'id' | 'timestamp'>) => void
    removeValueChoice: (id: string) => void
    updateValueChoice: (id: string, updates: Partial<ValueChoice>) => void

    // P2-5: 특성화 모델 선택
    setCharacterizationModel: (model: 'AR5' | 'AR6') => void

    // P2-7: PCR 참조 관리
    addPCRReference: (pcr: Omit<PCRReference, 'id'>) => void
    removePCRReference: (id: string) => void

    // 보고서 메타 / 검토 정보 Actions
    setReportMeta: (meta: Partial<ReportMeta>) => void
    setReviewInfo: (info: Partial<ReviewInfo>) => void

    // Auth Actions
    user: any | null
    setUser: (user: any | null) => void
    logout: () => Promise<void>

    reset: () => void
}

// =============================================================================
// 기본값
// =============================================================================

const DEFAULT_DATA_QUALITY: DataQuality = {
    type: 'secondary',
    source: '국가 LCI DB',
    year: 2023,
    geographicScope: 'Korea',
    uncertainty: 30
}

const DEFAULT_DATA_QUALITY_META: PCFState['dataQualityMeta'] = {
    overallType: 'secondary',
    sources: ['국가 LCI DB', 'IPCC', 'Ecoinvent'],
    baseYear: 2023
}

// =============================================================================
// Store 생성
// =============================================================================

export const usePCFStore = create<PCFState>()(
    persist(
        (set) => ({
            // 기본 정보 초기화
            productInfo: {
                name: 'NMC811 EV Battery Pack 75kWh',
                category: 'automotive',
                unit: '1 set (75kWh)',
                boundary: 'cradle-to-gate',
                referenceFlow: ''
            },
            stages: ['raw_materials', 'manufacturing', 'transport', 'packaging'],

            // 활동 데이터 초기화
            activityData: {},
            detailedActivityData: {
                raw_materials: [
                    { id: 'mat1', stageId: 'raw_materials', name: 'NMC811 Cathode Active Material', quantity: 120, unit: 'kg', emissionSourceType: 'fossil', materialType: 'cathode', customEmissionFactor: 18.5, dataQuality: { type: 'secondary', source: 'Supplier Data', year: 2025, geographicScope: 'China' } },
                    { id: 'mat2', stageId: 'raw_materials', name: 'Natural Graphite Anode', quantity: 75, unit: 'kg', emissionSourceType: 'fossil', materialType: 'anode', customEmissionFactor: 3.2, dataQuality: { type: 'secondary', source: 'LCI DB', year: 2024, geographicScope: 'Global' } },
                    { id: 'mat3', stageId: 'raw_materials', name: 'Steel Enclosure', quantity: 60, unit: 'kg', emissionSourceType: 'fossil', materialType: 'metal', customEmissionFactor: 2.1, dataQuality: { type: 'secondary', source: 'LCI DB', year: 2024, geographicScope: 'Korea' } },
                    { id: 'mat4', stageId: 'raw_materials', name: 'Aluminium Plate', quantity: 35, unit: 'kg', emissionSourceType: 'fossil', materialType: 'metal', customEmissionFactor: 12.8, dataQuality: { type: 'secondary', source: 'LCI DB', year: 2024, geographicScope: 'Korea' } },
                    { id: 'mat5', stageId: 'raw_materials', name: 'Connectors & Wiring', quantity: 10, unit: 'kg', emissionSourceType: 'fossil', materialType: 'other', customEmissionFactor: 6.5, dataQuality: { type: 'secondary', source: 'Estimated', year: 2024, geographicScope: 'Korea' } }
                ],
                manufacturing: {
                    electricity: [{ id: 'elec1', stageId: 'manufacturing', name: '전력', quantity: 180, unit: 'kWh', emissionSourceType: 'fossil', gridType: 'national', dataQuality: { type: 'secondary', source: '국가 LCI DB', year: 2023, geographicScope: 'Korea' } }],
                    fuels: [{ id: 'fuel1', stageId: 'manufacturing', name: '천연가스', quantity: 570, unit: 'MJ', emissionSourceType: 'fossil', dataQuality: { type: 'secondary', source: '국가 LCI DB', year: 2023, geographicScope: 'Korea' } }],
                    processEmissions: []
                },
                transport: [{
                    id: 'tr1', stageId: 'transport', name: 'CN Shanghai -> KR Busan', quantity: 0.434, unit: 'ton', emissionSourceType: 'fossil', transportMode: 'ship', distance: 870, weight: 434.1, dataQuality: { type: 'secondary', source: 'SeaDistance', year: 2024, geographicScope: 'East Asia' }
                }],
                packaging: [{
                    id: 'pkg1', stageId: 'packaging', name: 'Wooden Pallet', quantity: 15, unit: 'kg', emissionSourceType: 'fossil', materialType: 'wood', customEmissionFactor: 0.89, dataQuality: { type: 'secondary', source: 'LCI DB', year: 2024, geographicScope: 'Korea' }
                }],
                use: {
                    electricity: [],
                    consumables: []
                },
                eol: {
                    disposal: [],
                    recycling: []
                }
            },

            // 품질 메타데이터
            dataQualityMeta: DEFAULT_DATA_QUALITY_META,

            // 할당 설정 초기화
            multiOutputAllocation: DEFAULT_MULTI_OUTPUT_ALLOCATION,
            recyclingAllocation: DEFAULT_RECYCLING_ALLOCATION,

            // 기타 초기화
            sensitivityAnalysis: null,
            cutOffCriteria: NO_CUT_OFF,
            cutOffPreset: 'none',
            cutOffResult: null,

            // CFP 성과 추적 초기화 (ISO 14067 6.4.7)
            cfpHistory: [],

            // P1-2: 가치 선택 초기화
            valueChoices: [],

            // P2-5: 특성화 모델 초기화
            characterizationModel: 'AR6' as const,

            // P2-7: PCR 참조 초기화
            pcrReferences: [],

            // 보고서 메타데이터 초기화
            reportMeta: {
                reportNumber: '',
                commissioner: '',
                practitioner: 'CarbonMate Platform',
                reportType: 'study' as ReportType,
                confidentiality: 'internal' as ConfidentialityLevel,
                geographicScope: '',
                technologicalScope: '',
            },

            // 검토 정보 초기화
            reviewInfo: {
                reviewType: 'none' as ReviewType,
            },

            // Actions Helper
            setProductInfo: (info) => set((state) => ({ productInfo: { ...state.productInfo, ...info } })),

            toggleStage: (stageId) => set((state) => {
                const stages = state.stages.includes(stageId)
                    ? state.stages.filter(id => id !== stageId)
                    : [...state.stages, stageId]
                return { stages }
            }),

            setActivityData: (id, value) => set((state) => ({
                activityData: { ...state.activityData, [id]: value }
            })),

            setActivityDataWithMeta: (id, value, meta) => set((state) => {
                // Note: Currently dataQuality is not stored per simple activity field in this simplified version,
                // but keeping signature for compatibility if needed.
                return {
                    activityData: { ...state.activityData, [id]: value }
                }
            }),

            setTransportMode: (mode) => set((state) => ({
                activityData: { ...state.activityData, transport_mode: mode }
            })),

            setElectricityGrid: (grid) => set((state) => ({
                activityData: { ...state.activityData, electricity_grid: grid }
            })),

            setDataQualityMeta: (meta) => set((state) => ({
                dataQualityMeta: { ...state.dataQualityMeta, ...meta }
            })),

            // Allocation Actions
            setMultiOutputAllocationMethod: (method) => set((state) => ({
                multiOutputAllocation: { ...state.multiOutputAllocation, method }
            })),

            setPhysicalAllocationBasis: (basis) => set((state) => ({
                multiOutputAllocation: { ...state.multiOutputAllocation, physicalBasis: basis }
            })),

            addCoProduct: (coProduct) => set((state) => ({
                multiOutputAllocation: {
                    ...state.multiOutputAllocation,
                    coProducts: [...state.multiOutputAllocation.coProducts, coProduct]
                }
            })),

            removeCoProduct: (id) => set((state) => ({
                multiOutputAllocation: {
                    ...state.multiOutputAllocation,
                    coProducts: state.multiOutputAllocation.coProducts.filter(p => p.id !== id)
                }
            })),

            updateCoProduct: (id, updates) => set((state) => ({
                multiOutputAllocation: {
                    ...state.multiOutputAllocation,
                    coProducts: state.multiOutputAllocation.coProducts.map(p =>
                        p.id === id ? { ...p, ...updates } : p
                    )
                }
            })),

            setMainProductData: (data) => set((state) => ({
                multiOutputAllocation: {
                    ...state.multiOutputAllocation,
                    mainProductData: { ...(state.multiOutputAllocation.mainProductData || { name: '', quantity: 0, unit: 'kg', mass: 0 }), ...data }
                }
            })),

            setTotalProcessEmission: (emission) => set((state) => ({
                multiOutputAllocation: {
                    ...state.multiOutputAllocation,
                    totalProcessEmission: emission
                }
            })),

            setRecyclingAllocationMethod: (method) => set((state) => ({
                recyclingAllocation: { ...state.recyclingAllocation, method }
            })),

            setRecyclingParams: (params) => set((state) => ({
                recyclingAllocation: { ...state.recyclingAllocation, ...params }
            })),

            setAllocationJustification: (type, justification) => set((state) => {
                if (type === 'multiOutput') {
                    return { multiOutputAllocation: { ...state.multiOutputAllocation, justification } }
                } else {
                    return { recyclingAllocation: { ...state.recyclingAllocation, justification } }
                }
            }),

            // Sensitivity Analysis
            setSensitivityAnalysis: (result) => set({ sensitivityAnalysis: result }),

            // Cut-off Criteria
            setCutOffPreset: (preset) => set({
                cutOffPreset: preset,
                cutOffCriteria: getCutOffPreset(preset)
            }),

            setCutOffCriteria: (criteria) => set((state) => ({
                cutOffCriteria: { ...state.cutOffCriteria, ...criteria }
            })),

            setCutOffResult: (result) => set({ cutOffResult: result }),

            // CFP 성과 추적 Actions (ISO 14067 6.4.7)
            addCFPSnapshot: (cfpValue, notes) => set((state) => {
                const boundary = state.productInfo.boundary === 'cradle-to-gate' ? 'cradle_to_gate'
                    : state.productInfo.boundary === 'cradle-to-grave' ? 'cradle_to_grave'
                        : 'gate_to_gate'

                const newSnapshot: CFPSnapshot = {
                    id: generateSnapshotId(),
                    date: getCurrentDateISO(),
                    cfpValue,
                    functionalUnit: state.productInfo.unit,
                    boundary,
                    notes
                }
                return {
                    cfpHistory: [...state.cfpHistory, newSnapshot]
                }
            }),

            removeCFPSnapshot: (id) => set((state) => ({
                cfpHistory: state.cfpHistory.filter(s => s.id !== id)
            })),

            getCFPTrackingResult: () => {
                // 이 함수는 get() 접근이 필요하여 store 외부에서 호출
                // 실제 사용은 usePCFStore.getState()로 접근
                return null
            },

            // Extended Activity Data Actions (Raw Materials)
            addRawMaterial: (material) => set((state) => {
                const currentMaterials = state.detailedActivityData?.raw_materials || []
                return {
                    detailedActivityData: {
                        ...state.detailedActivityData,
                        raw_materials: [...currentMaterials, material]
                    } as StageActivityData
                }
            }),

            removeRawMaterial: (id) => set((state) => {
                const currentMaterials = state.detailedActivityData?.raw_materials || []
                return {
                    detailedActivityData: {
                        ...state.detailedActivityData,
                        raw_materials: currentMaterials.filter(m => m.id !== id)
                    } as StageActivityData
                }
            }),

            updateRawMaterial: (id, updates) => set((state) => {
                const currentMaterials = state.detailedActivityData?.raw_materials || []
                return {
                    detailedActivityData: {
                        ...state.detailedActivityData,
                        raw_materials: currentMaterials.map(m =>
                            m.id === id ? { ...m, ...updates } : m
                        )
                    } as StageActivityData
                }
            }),

            // Transport Actions
            addTransportStep: (transport) =>
                set((state) => {
                    const currentTransport = state.detailedActivityData?.transport || []
                    return {
                        detailedActivityData: {
                            ...state.detailedActivityData,
                            transport: [...currentTransport, transport]
                        } as StageActivityData
                    }
                }),

            removeTransportStep: (id) =>
                set((state) => {
                    const currentTransport = state.detailedActivityData?.transport || []
                    return {
                        detailedActivityData: {
                            ...state.detailedActivityData,
                            transport: currentTransport.filter(t => t.id !== id)
                        } as StageActivityData
                    }
                }),

            updateTransportStep: (id, updates) =>
                set((state) => {
                    const currentTransport = state.detailedActivityData?.transport || []
                    return {
                        detailedActivityData: {
                            ...state.detailedActivityData,
                            transport: currentTransport.map(t =>
                                t.id === id ? { ...t, ...updates } : t
                            )
                        } as StageActivityData
                    }
                }),

            // Packaging Actions
            addPackagingPart: (packaging) =>
                set((state) => {
                    const currentPackaging = state.detailedActivityData?.packaging || []
                    return {
                        detailedActivityData: {
                            ...state.detailedActivityData,
                            packaging: [...currentPackaging, packaging]
                        } as StageActivityData
                    }
                }),

            removePackagingPart: (id) =>
                set((state) => {
                    const currentPackaging = state.detailedActivityData?.packaging || []
                    return {
                        detailedActivityData: {
                            ...state.detailedActivityData,
                            packaging: currentPackaging.filter(p => p.id !== id)
                        } as StageActivityData
                    }
                }),

            updatePackagingPart: (id, updates) =>
                set((state) => {
                    const currentPackaging = state.detailedActivityData?.packaging || []
                    return {
                        detailedActivityData: {
                            ...state.detailedActivityData,
                            packaging: currentPackaging.map(p =>
                                p.id === id ? { ...p, ...updates } : p
                            )
                        } as StageActivityData
                    }
                }),

            // P1-2: Value Choice Actions (ISO 14067 7.3 n)
            addValueChoice: (choice) => set((state) => ({
                valueChoices: [
                    ...state.valueChoices,
                    {
                        ...choice,
                        id: `vc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        timestamp: new Date().toISOString()
                    }
                ]
            })),

            removeValueChoice: (id) => set((state) => ({
                valueChoices: state.valueChoices.filter(vc => vc.id !== id)
            })),

            updateValueChoice: (id, updates) => set((state) => ({
                valueChoices: state.valueChoices.map(vc =>
                    vc.id === id ? { ...vc, ...updates } : vc
                )
            })),

            // P2-5: 특성화 모델 선택
            setCharacterizationModel: (model) => set({ characterizationModel: model }),

            // P2-7: PCR 참조 관리
            addPCRReference: (pcr) => set((state) => ({
                pcrReferences: [...state.pcrReferences, { ...pcr, id: `pcr_${Date.now()}` }]
            })),
            removePCRReference: (id) => set((state) => ({
                pcrReferences: state.pcrReferences.filter(p => p.id !== id)
            })),

            // 보고서 메타 / 검토 정보
            setReportMeta: (meta) => set((state) => ({
                reportMeta: { ...state.reportMeta, ...meta }
            })),
            setReviewInfo: (info) => set((state) => ({
                reviewInfo: { ...state.reviewInfo, ...info }
            })),

            // Auth State
            user: null,
            setUser: (user) => set({ user }),
            logout: async () => {
                set({ user: null })
            },

            reset: () => {
                // P0-4: 모든 프로젝트 상태를 깨끗한 빈 상태로 초기화
                set({
                    productInfo: {
                        name: '',
                        category: '',
                        unit: '1 kg',
                        boundary: 'cradle-to-gate',
                        referenceFlow: ''
                    },
                    stages: ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol'],
                    activityData: {},
                    detailedActivityData: {
                        raw_materials: [],
                        manufacturing: { electricity: [], fuels: [], processEmissions: [] },
                        transport: [],
                        packaging: [],
                        use: { electricity: [], consumables: [] },
                        eol: { disposal: [], recycling: [] }
                    },
                    dataQualityMeta: DEFAULT_DATA_QUALITY_META,
                    multiOutputAllocation: DEFAULT_MULTI_OUTPUT_ALLOCATION,
                    recyclingAllocation: DEFAULT_RECYCLING_ALLOCATION,
                    sensitivityAnalysis: null,
                    cutOffCriteria: NO_CUT_OFF,
                    cutOffPreset: 'none',
                    cutOffResult: null,
                    cfpHistory: [],
                    valueChoices: [],
                    characterizationModel: 'AR6' as const,
                    pcrReferences: [],
                    reportMeta: {
                        reportNumber: '',
                        commissioner: '',
                        practitioner: 'CarbonMate Platform',
                        reportType: 'study' as ReportType,
                        confidentiality: 'internal' as ConfidentialityLevel,
                        geographicScope: '',
                        technologicalScope: ''
                    },
                    reviewInfo: {
                        reviewType: 'none' as ReviewType,
                        reviewerName: '',
                        reviewerOrganization: '',
                        reviewDate: '',
                        reviewScope: '',
                        reviewStatement: ''
                    }
                })
            },
        }),
        {
            name: 'carbonmate-autosave',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => {
                // 함수(action)와 user 인증 정보를 제외하고 순수 데이터만 저장
                const {
                    setProductInfo, toggleStage, setActivityData, setActivityDataWithMeta,
                    setTransportMode, setElectricityGrid, setDataQualityMeta,
                    setMultiOutputAllocationMethod, setPhysicalAllocationBasis,
                    addCoProduct, removeCoProduct, updateCoProduct,
                    setMainProductData, setTotalProcessEmission,
                    setRecyclingAllocationMethod, setRecyclingParams,
                    setAllocationJustification, setSensitivityAnalysis,
                    setCutOffPreset, setCutOffCriteria, setCutOffResult,
                    addCFPSnapshot, removeCFPSnapshot, getCFPTrackingResult,
                    addRawMaterial, removeRawMaterial, updateRawMaterial,
                    addTransportStep, removeTransportStep, updateTransportStep,
                    addPackagingPart, removePackagingPart, updatePackagingPart,
                    addValueChoice, removeValueChoice, updateValueChoice,
                    setCharacterizationModel, addPCRReference, removePCRReference,
                    setUser, logout, reset,
                    user,
                    ...data
                } = state
                return data as Partial<PCFState>
            },
            onRehydrateStorage: () => {
                return (state) => {
                    if (state?.productInfo?.name) {
                        updateAutoSaveMeta(state.productInfo.name)
                    }
                }
            }
        }
    )
)

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 시스템 경계에 따른 권장 단계 반환
 */
export const getRecommendedStages = (boundary: BoundaryType): string[] => {
    switch (boundary) {
        case 'cradle-to-gate':
            return ['raw_materials', 'manufacturing', 'transport', 'packaging']
        case 'cradle-to-grave':
            return ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol']
        case 'gate-to-gate':
            return ['manufacturing']
        default:
            return []
    }
}

/**
 * 단계가 시스템 경계에 포함되는지 확인
 */
export const isStageInBoundary = (stageId: string, boundary: BoundaryType): boolean => {
    const recommended = getRecommendedStages(boundary)
    return recommended.includes(stageId)
}

// For testing
if (typeof window !== 'undefined') {
    (window as any).__PCF_STORE__ = usePCFStore;
}
