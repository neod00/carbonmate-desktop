/**
 * .carbonmate 프로젝트 파일 스키마.
 *
 * 핵심 설계 원칙: ISO 14067 감사 재현성을 위해
 * 사용한 엔진 버전과 데이터 버전을 프로젝트 파일에 박제한다.
 * 1년 후 같은 파일을 열어도 동일한 결과를 재현할 수 있어야 한다.
 */

export interface ProjectFile {
  schemaVersion: 1;

  project: {
    id: string;
    name: string;
    /** 사용자 회사명 (옵션) */
    organization?: string;
    createdAt: string;
    updatedAt: string;
    /**
     * 위자드 단계별 입력 데이터.
     * 실제 스키마는 src/lib/core/store.ts 의 타입을 따름.
     * Phase 1에서 정확히 정의.
     */
    data: unknown;
  };

  /** 마지막으로 계산을 실행한 시점 (없으면 미계산) */
  computedAt?: string;

  /** 결과 캐시 (재계산 안 해도 보고서 즉시 표시 가능) */
  results?: unknown;

  /** 사용된 엔진 버전 — 감사 시 추적 */
  engine: {
    appVersion: string;
    calcEngineVersion: string;
  };

  /** 사용된 데이터 버전 — 감사 시 추적 */
  data: {
    lciCatalogVersion: string;
    emissionFactorsVersion: string;
    pcrRegistryVersion: string;
  };
}
