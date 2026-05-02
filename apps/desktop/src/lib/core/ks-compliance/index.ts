/**
 * KS I ISO 14067:2018 적합성 매트릭스 — 진입점.
 *
 * 사용 예:
 *   const { blob, summary } = await buildKsComplianceMatrix(state)
 *   await saveFile(blob, 'KS_Compliance_Matrix.xlsx', '...', 'xlsx')
 */

export { buildKsComplianceMatrix } from './builder'
export { autoCheck } from './auto-checks'
export { KS_REQUIREMENTS, findByClause, groupByClausePrefix } from './requirements'
export type {
  CheckedRequirement,
  ComplianceCheckResult,
  ComplianceMatrixSummary,
  ComplianceStatus,
  KsRequirement,
} from './types'
