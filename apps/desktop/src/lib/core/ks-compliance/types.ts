/**
 * KS I ISO 14067 적합성 매트릭스 타입.
 *
 * 원본 KS I ISO 14067:2018 표준 본문(요구사항 시트, 260 행) + 자동 상태 판정 결과 +
 * 시정조치 권고 + 증빙자료 위치 포인터를 포함한 자가점검표.
 */

/** KS I ISO 14067 표준 단일 요구사항 (불변 — JSON 리소스에서 로드) */
export interface KsRequirement {
  /** 원본 xlsx 행 번호 (디버깅·추적용) */
  row: number
  /** 조항 (예: "5.7", "6.3.5", "7.3") */
  clause: string
  /** 섹션 한글명 (예: "완전성", "데이터 및 데이터 품질") */
  section: string
  /** shall / should / may / "" (비고/일반진술) */
  obligation: string
  /** 표준 요구사항 본문 텍스트 — 줄바꿈 포함 가능 */
  text: string
}

/** 적합성 판정 결과 */
export type ComplianceStatus =
  | 'pass' // 자동 검사 통과
  | 'fail' // 자동 검사 실패 (필수 조건 미충족)
  | 'partial' // 부분 충족 (보강 권고)
  | 'manual' // 자동 검사 불가 — 사용자 수동 확인 필요
  | 'na' // 본 산정에 비적용 (예: agriculture clause for inorganic chem)
  | 'info' // 비고/일반진술 — 판정 대상 아님

/** 단일 요구사항에 대한 평가 결과 */
export interface ComplianceCheckResult {
  /** 자동 판정 상태 */
  status: ComplianceStatus
  /** 사용자에게 보여줄 확인 사항 (간단) */
  finding: string
  /** 미충족 시 권고 시정조치 */
  correctiveAction?: string
  /** 증빙자료가 보관된 위치 (예: "산정 워크북 LCIA 시트", "보고서 §6.3.5", "Evidence Pack 05_DQR") */
  evidenceLocation?: string
}

/** 검사된 요구사항 1행 (요구사항 정보 + 검사 결과) */
export interface CheckedRequirement {
  req: KsRequirement
  result: ComplianceCheckResult
}

/** 자동 검사 함수 — clause 매칭으로 디스패치 */
export type AutoChecker = (
  state: import('../store').PCFState,
) => ComplianceCheckResult

/** 매트릭스 생성 결과 요약 */
export interface ComplianceMatrixSummary {
  totalRequirements: number
  shallCount: number
  shouldCount: number
  /** shall 통과율 */
  shallPassRate: number
  /** 자동 검사 가능 항목 수 */
  autoCheckedCount: number
  /** fail 카운트 */
  failCount: number
  /** partial 카운트 */
  partialCount: number
}
