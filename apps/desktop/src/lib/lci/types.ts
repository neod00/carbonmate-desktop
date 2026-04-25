/**
 * LCI 모듈 타입 정의
 * 외교관(lci-client)과 BOM 파서에서 사용하는 공통 타입
 */

// ============================================================================
// LCI 가이드 정보 (선택된 데이터의 메타데이터)
// ============================================================================

export interface LciGuideInfo {
    // 기본 식별자
    activityUuid: string;      // ecoinvent 고유 ID (증빙용)
    activityName: string;      // 표준 영문 명칭
    geography: string;         // 지역 코드 (KR, GLO 등)
    unit: string;              // 기본 단위 (kg, kWh 등)

    // ISO 적합성 정보
    isoComplianceScore: number;    // 1~4점
    recommendationReason: string;  // AI 추천 사유 (한국어)

    // 데이터 품질 상세 (DQI)
    dataQuality: {
        time: number;       // 시간적 대표성 (1~5)
        geography: number;  // 지리적 대표성 (1~5)
        technology: number; // 기술적 대표성 (1~5)
    };

    // [신규] ISO 6가지 지표 점수 (0-100)
    isoScores?: {
        temporal: number;
        geographical: number;
        technological: number;
        completeness: number;
        precision: number;
        consistency: number;
        overall: number;
    };

    // [신규] 메타데이터
    techCategory?: string;         // virgin/recycled/mixed
    processType?: string;          // production/treatment/transport/energy
    materialType?: string;         // paper/plastic/metal/etc
    matchConfidence?: string;      // high/medium/low
    ecoQueryUrl?: string;          // ecoQuery 상세 링크
}

// ============================================================================
// LCI 검색 결과
// ============================================================================

export interface LciSearchItem {
    id: string;
    activityName: string;
    referenceProductName: string;
    canonicalProduct?: string;
    geography: string;
    unit: string;
    systemModel?: string;
    activityUuid: string;
    productUuid?: string;
    priorityScore?: number;
    ecoQueryUrl?: string;
    productInformation?: string; // 제품 상세 설명
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

// ============================================================================
// Intent Understanding 결과
// ============================================================================

export interface IntentResult {
    originalQuery: string;
    intent: {
        coreMaterial: string;
        applicationContext: string;
        userGoal: string;
        specificType: string;
    };
    optimizedSearchTerms: string[];
    suggestedCategory: string | null;
    contextFilters: {
        preferredSectors: string[];
        relevantKeywords: string[];
        irrelevantKeywords: string[];
    };
    explanation: string;
    source: 'ai' | 'rule-based';
}

export interface LciSearchResult {
    query: string;
    translatedQuery?: string;  // 한글→영문 번역 결과 (있을 경우)
    intent?: IntentResult;     // Phase 3: AI 의도 분석 결과
    groups: Array<{
        title: string;
        productUuid: string;
        topVariant: LciSearchItem | null;
        variants: LciSearchItem[];
        geographies: string[];
        units: string[];
    }>;
    hits: LciSearchItem[];
}

// ============================================================================
// BOM 관련 타입
// ============================================================================

export interface BomItem {
    // 필수 필드 (파일에서 읽어옴)
    name: string;           // 자재명 (한글 가능)
    quantity: number;       // 수량
    unit: string;           // 단위

    // 선택 필드 (있으면 더 정확한 매칭)
    origin?: string;        // 원산지/조달지역
    supplier?: string;      // 공급업체
    customEF?: number;      // 자체 배출계수 (있을 경우)
}

export interface BomMatchResult {
    original: BomItem;                    // 원본 BOM 항목
    translatedName?: string;              // 번역된 영문명
    matchedLci?: LciSearchItem;           // 매칭된 LCI 데이터
    matchConfidence: 'high' | 'medium' | 'low' | 'none';  // 매칭 신뢰도
    alternatives?: LciSearchItem[];       // 대안 후보들

    // 컷오프 분석 결과
    estimatedContribution?: number;       // 예상 기여도 (%)
    isCutOff?: boolean;                   // 컷오프 대상 여부
}

export interface BomParseResult {
    success: boolean;
    items: BomItem[];
    errors: Array<{
        row: number;
        message: string;
    }>;
    warnings: string[];
}

// ============================================================================
// 데이터 등급
// ============================================================================

export type DataLevel = 'primary' | 'secondary' | 'proxy';

export const DATA_LEVEL_LABELS: Record<DataLevel, string> = {
    primary: '1차 데이터 (실측)',
    secondary: '2차 데이터 (LCI DB)',
    proxy: '대리 데이터 (추정)'
};
