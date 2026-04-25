// LCA Context Types
export type LcaPurpose =
    | "pcf"           // 제품 탄소발자국
    | "epd"           // 환경성적표지
    | "supply_chain"  // 공급망 실사
    | "internal"      // 내부 의사결정
    | "regulation";   // 규제 대응 (CBAM 등)

export type LcaScope =
    | "cradle-to-gate"   // 원료~제조
    | "cradle-to-grave"  // 원료~폐기
    | "gate-to-gate";    // 제조만

export type AIProvider = "gemini" | "openai";

export interface LcaContext {
    productName?: string;       // 대상 제품
    functionalUnit?: string;    // 기능단위
    lcaPurpose: LcaPurpose;     // LCA 목적
    lcaScope: LcaScope;         // LCA 범위
    materialRole?: string;      // 원료 용도/역할
    preferredGeo?: string;      // 선호 지역
    preferredUnit?: string;     // 선호 단위
}

export interface Variant {
    id: string;
    activityName?: string;
    referenceProductName?: string;
    canonicalProduct?: string;
    geography?: string;
    unit?: string;
    systemModel?: string;
    ecoinventVersion?: string;
    activityUuid?: string;
    productUuid?: string;
    priorityScore?: number;
    ecoQueryUrl?: string;
    // ISO 14044 메타데이터
    techCategory?: string;         // virgin/recycled/mixed
    processType?: string;          // production/treatment/transport/energy
    materialType?: string;         // paper/plastic/metal/etc
    dataQualityScore?: number;     // 0-100
    // ISO 6가지 지표 점수
    isoScores?: {
        temporal: number;
        geographical: number;
        technological: number;
        completeness: number;
        precision: number;
        consistency: number;
        overall: number;
    };
}

export interface ScoredVariant extends Variant {
    recommendationScore: number;
    scoreBreakdown: {
        geography: number;
        unit: number;
        dataType: number;
        purpose: number;
        scope: number;
    };
}

// ISO 적합성 평가 항목
export interface ISOComplianceItem {
    isoRef: string;           // ISO 조항 참조 (예: "ISO 14044 §4.2.3.3")
    score: 1 | 2 | 3 | 4;     // 1=낮음 ~ 4=높음
    status: "pass" | "warn" | "fail";
    explanation: string;
}

export interface ISOCompliance {
    geographic: ISOComplianceItem;      // 지리적 대표성
    temporal: ISOComplianceItem;        // 시간적 대표성
    technological: ISOComplianceItem;   // 기술적 대표성
    systemBoundary: ISOComplianceItem;  // 시스템 경계
    cutoffCriteria: ISOComplianceItem;  // 컷오프 기준
}

// 데이터 품질 지표 (DQI)
export interface DataQualityIndicators {
    time: 1 | 2 | 3 | 4;
    geography: 1 | 2 | 3 | 4;
    technology: 1 | 2 | 3 | 4;
    completeness: 1 | 2 | 3 | 4;
    consistency: 1 | 2 | 3 | 4;
    overallScore: number;  // 100점 만점
}

export interface DetailedRecommendation {
    summary: string;                    // 1줄 요약
    isoCompliance: ISOCompliance;       // ISO 적합성
    dataQuality: DataQualityIndicators; // DQI
    auditTrail: string;                 // 검증 참고 정보
}

export interface RecommendationResult {
    top1: {
        variant: Variant;
        reason: string;
        confidence: "high" | "medium" | "low";
        score: number;
        detailed?: DetailedRecommendation;  // ISO 기반 상세 분석
    };
    alternatives: Array<{
        variant: Variant;
        reason: string;
        useCase: string;
        score: number;
    }>;
    warnings: string[];
    analysisContext?: string;
}

export interface RecommendRequest {
    // 검색 파라미터
    q: string;
    model?: string;
    version?: string;
    geography?: string;
    unit?: string;
    matchMode?: "and" | "or";

    // LCA 컨텍스트
    productName?: string;
    functionalUnit?: string;
    lcaPurpose?: LcaPurpose;
    lcaScope?: LcaScope;
    materialRole?: string;

    // 분석할 특정 타겟 (이미 선택된 항목이 있는 경우)
    targetVariant?: any;

    // AI 설정
    aiProvider?: AIProvider;
}

// LCA 목적 라벨
export const LCA_PURPOSE_LABELS: Record<LcaPurpose, string> = {
    pcf: "제품 탄소발자국 (PCF)",
    epd: "환경성적표지 (EPD)",
    supply_chain: "공급망 실사",
    internal: "내부 의사결정",
    regulation: "규제 대응 (CBAM 등)",
};

// LCA 범위 라벨
export const LCA_SCOPE_LABELS: Record<LcaScope, string> = {
    "cradle-to-gate": "Cradle-to-Gate (원료~제조)",
    "cradle-to-grave": "Cradle-to-Grave (원료~폐기)",
    "gate-to-gate": "Gate-to-Gate (제조만)",
};
