/**
 * Narrative — AI 자동 생성 보고서 서술형 본문 타입
 *
 * Carbony(12년차 ISO 14067 컨설턴트) 페르소나 + OpenAI gpt-5.4-mini 기반.
 * 6개 슬롯 고정: PCR / 시스템경계 / 할당 / dataset 선정 / 데이터품질 / 결과해석
 */

export type NarrativeSlot =
  | 'pcr'
  | 'systemBoundary'
  | 'allocation'
  | 'datasetRationale'
  | 'dataQuality'
  | 'resultInterpretation';

export const NARRATIVE_SLOTS: ReadonlyArray<NarrativeSlot> = [
  'pcr',
  'systemBoundary',
  'allocation',
  'datasetRationale',
  'dataQuality',
  'resultInterpretation',
] as const;

export interface NarrativeSlotMeta {
  slot: NarrativeSlot;
  /** 보고서 내 섹션 번호 — 표시용 */
  reportSection: string;
  /** 사용자 친화 라벨 */
  label: string;
  /** 권장 분량 (단락 수) */
  recommendedParagraphs: number;
  /** Web search 사용 여부 — N1(PCR), N4(dataset)에만 true */
  useWebSearch: boolean;
}

export const NARRATIVE_SLOT_META: Readonly<Record<NarrativeSlot, NarrativeSlotMeta>> = {
  pcr: {
    slot: 'pcr',
    reportSection: '1.2',
    label: 'PCR(Product Category Rules) 적용 검토',
    recommendedParagraphs: 2,
    useWebSearch: true,
  },
  systemBoundary: {
    slot: 'systemBoundary',
    reportSection: '2.5',
    label: '시스템 경계 채택 사유 (Cradle-to-Gate / Downstream 제외)',
    recommendedParagraphs: 2,
    useWebSearch: false,
  },
  allocation: {
    slot: 'allocation',
    reportSection: '3.6',
    label: '할당 절차 및 정당화 (ISO 14044 5.3.5)',
    recommendedParagraphs: 4,
    useWebSearch: false,
  },
  datasetRationale: {
    slot: 'datasetRationale',
    reportSection: '3.4',
    label: 'LCI Dataset 선정 근거',
    recommendedParagraphs: 4,
    useWebSearch: true,
  },
  dataQuality: {
    slot: 'dataQuality',
    reportSection: '5.4',
    label: '데이터 품질 종합 평가',
    recommendedParagraphs: 4,
    useWebSearch: false,
  },
  resultInterpretation: {
    slot: 'resultInterpretation',
    reportSection: '8.1',
    label: '종합 해석 — Hotspot 구조와 개선 경로',
    recommendedParagraphs: 4,
    useWebSearch: false,
  },
};

/** 인용 정보 (Web search 결과) */
export interface NarrativeCitation {
  url: string;
  title: string;
  /** ISO 8601 검색 timestamp */
  retrievedAt: string;
}

/** 단일 narrative 생성 요청
 *
 * OpenAI API 키, 모델, web search 기본값은 license-server의 DB(`app_settings` 테이블)에 저장됨.
 * 데스크톱은 키를 모름 — 라이선스 + machineId + slot + context만 전송.
 * `useWebSearch`로 보고서 단위 override 가능 (선택).
 */
export interface NarrativeGenerateRequest {
  /** 라이선스 키 (검증용) */
  licenseKey: string;
  /** 머신 ID (라이선스 바인딩 검증용) */
  machineId: string;
  /** 어느 narrative 슬롯을 생성할지 */
  slot: NarrativeSlot;
  /** 산정 컨텍스트 (보고서 데이터) */
  context: NarrativeContext;
  /** Web search 보고서 단위 override (default: 서버 설정 + slot meta 따름) */
  useWebSearch?: boolean;
}

/** 관리자 페이지에서 저장하는 AI 설정 (Neon DB `app_settings` 테이블) */
export interface AdminAISettings {
  /** OpenAI API 키 (sk-로 시작). 빈 문자열이면 narrative 비활성. */
  openaiApiKey: string;
  /** 기본 narrative 생성 모델 */
  narrativeModel: AllowedNarrativeModel;
  /** Web search 기본 동작: 'auto'=슬롯 메타 따름, 'always', 'never' */
  webSearchDefault: 'auto' | 'always' | 'never';
  /** narrative 자동 생성 마스터 스위치 */
  narrativeEnabled: boolean;
}

/** 관리자 페이지가 GET으로 받는 응답 — API 키는 마스킹 */
export interface AdminAISettingsMaskedResponse {
  openaiApiKeyMasked: string;
  /** 키 설정 여부 (UI 표시용) */
  openaiApiKeyConfigured: boolean;
  narrativeModel: AllowedNarrativeModel;
  webSearchDefault: 'auto' | 'always' | 'never';
  narrativeEnabled: boolean;
}

/** 관리자 페이지가 POST로 보내는 요청 — 변경할 필드만 */
export interface AdminAISettingsUpdateRequest {
  /** ADMIN_PASSWORD 검증용 */
  password: string;
  /** undefined면 변경 안 함, 빈 문자열이면 키 삭제 */
  openaiApiKey?: string;
  narrativeModel?: AllowedNarrativeModel;
  webSearchDefault?: 'auto' | 'always' | 'never';
  narrativeEnabled?: boolean;
}

/** narrative 생성에 필요한 산정 컨텍스트 */
export interface NarrativeContext {
  product: {
    name: string;
    purity?: string;
    form?: string;
    application?: string;
  };
  functionalUnit: string;
  systemBoundary: 'cradle-to-gate' | 'cradle-to-grave' | 'gate-to-gate';
  totalCFP: {
    value: number;
    unit: string;
    uncertaintyPercent?: number;
  };
  stageBreakdown: Array<{
    stage: string;
    value: number;
    sharePercent: number;
  }>;
  topContributors?: Array<{
    rank: number;
    item: string;
    value: number;
    sharePercent: number;
    cumulativePercent: number;
  }>;
  allocationDecisions?: Array<{
    material: string;
    method: 'cut-off' | 'mass' | 'economic' | 'system-expansion' | 'subdivision';
    rationale: string;
  }>;
  datasetMappings?: Array<{
    activity: string;
    datasetName: string;
    geography: string;
    year: string;
    source: string;
  }>;
  dqr?: {
    averageTiR: number;
    averageTeR: number;
    averageGeR: number;
    weightedAverage: number;
  };
  /** 사용자가 위저드 step 8에서 입력한 컨텍스트 메모 */
  userContextNotes?: string[];
}

/** 단일 narrative 생성 응답 */
export interface NarrativeGenerateResponse {
  slot: NarrativeSlot;
  /** narrative 본문 (여러 단락) */
  paragraphs: string[];
  /** 옵션 제목 (첫 줄에 굵게 표시) */
  title?: string;
  /** Web search 인용 (있을 경우) */
  citations: NarrativeCitation[];
  /** 토큰 사용량 (비용 추적용) */
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    estimatedCostUSD: number;
  };
  /** 생성 모델 ID (실제 사용된 것) */
  model: string;
  /** 생성 시각 ISO 8601 */
  generatedAt: string;
}

/** 에러 응답 */
export interface NarrativeErrorResponse {
  error: string;
  code:
    | 'invalid-license'
    | 'invalid-api-key'
    | 'openai-api-error'
    | 'invalid-request'
    | 'rate-limited'
    | 'server-error'
    | 'narrative-disabled'
    | 'no-server-key';
  details?: string;
}

/** 프로젝트 파일에 저장되는 narrative 상태 */
export interface NarrativeRecord {
  slot: NarrativeSlot;
  paragraphs: string[];
  title?: string;
  citations: NarrativeCitation[];
  /** 사용자가 검토·수정 완료했는지 */
  approved: boolean;
  /** 사용자가 직접 편집한 경우 true */
  edited: boolean;
  /** 최초 생성 시각 */
  generatedAt: string;
  /** 마지막 수정 시각 */
  updatedAt: string;
  /** 사용된 모델 */
  model: string;
  /**
   * 생성 당시의 컨텍스트 해시 (총 CFP + 단계별 배출량 + BOM 합산 기반).
   * 보고서 export 시 현재 컨텍스트 해시와 비교하여 stale 여부 판단.
   * P0-B 회귀 방어: 한 보고서에 두 결과값(34.50 vs 759.72) 동시 노출 방지.
   */
  contextHash?: string;
}

/** OpenAI 모델 화이트리스트 (admin이 override 가능한 후보) */
export const ALLOWED_NARRATIVE_MODELS = [
  'gpt-5.4-mini', // default
  'gpt-5-mini',
  'gpt-5.4',
  'gpt-5.4-pro',
  'gpt-5',
  'gpt-5.1',
  'gpt-5.2',
] as const;

export type AllowedNarrativeModel = (typeof ALLOWED_NARRATIVE_MODELS)[number];

export const DEFAULT_NARRATIVE_MODEL: AllowedNarrativeModel = 'gpt-5.4-mini';
