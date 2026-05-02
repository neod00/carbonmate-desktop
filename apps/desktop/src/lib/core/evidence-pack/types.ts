/**
 * Evidence Pack 타입 정의 — 검증심사원 인계용 산출물 묶음.
 *
 * v0.1 (PR-EP1) 구성 (.zip):
 *   01_Report.docx                  (기존 보고서, 외부에서 주입)
 *   04_Calculation_Workbook.xlsx    (산정 워크북, 외부에서 주입)
 *   05_DQR_Justification.docx       (#5)
 *   06_Allocation_Methodology.docx  (#6)
 *   07_Sensitivity_Analysis.docx    (#7)
 *   09_Primary_Activity_Data_Index.docx  (#9 — 텍스트 인덱스만, option a)
 *   10_Self_Declaration_Letter.docx (#10)
 *   README.txt                      (인계 안내)
 *
 * 미구현 (별개 PR):
 *   02_KS_Compliance_Matrix.xlsx    → PR-EP2
 *   03_LRQA_Pre_Verification.pdf    → PR-EP2
 *   08_LCI_Source_Records/          → PR-EP3
 */

export interface EvidencePackInput {
  /** 기존 보고서 docx blob (외부에서 generateFullWordReport 결과 주입) */
  reportDocx?: Blob
  /** 산정 워크북 xlsx blob (외부에서 generateCalcWorkbook 결과 주입) */
  calcWorkbookXlsx?: Blob
  /** PCFState — 자가선언/DQR/할당/민감도/Primary 인덱스 생성에 사용 */
  state: import('../store').PCFState
  /** 총 CFP 결과 (선택) — 자가선언서에 포함 */
  totalCfp?: number
  /** 보고서 ID — 파일명 prefix */
  reportId?: string
}

export interface EvidencePackResult {
  blob: Blob
  filename: string
  /** 포함된 항목 목록 — 사용자에게 안내용 */
  manifest: ManifestEntry[]
}

export interface ManifestEntry {
  /** ZIP 내 경로 */
  path: string
  /** 표시명 */
  name: string
  /** 상태 */
  status: 'included' | 'skipped' | 'placeholder'
  /** skipped/placeholder 사유 */
  reason?: string
}
