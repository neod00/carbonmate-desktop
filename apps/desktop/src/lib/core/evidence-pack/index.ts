/**
 * Evidence Pack 자동 생성 — 진입점.
 *
 * v0.1 (PR-EP1) 구성:
 *   01_Report.docx                       (외부에서 주입 — generateFullWordReport 결과)
 *   04_Calculation_Workbook.xlsx         (외부에서 주입 — generateCalcWorkbook 결과)
 *   05_DQR_Justification.docx            (built)
 *   06_Allocation_Methodology.docx       (built)
 *   07_Sensitivity_Analysis.docx         (built)
 *   09_Primary_Activity_Data_Index.docx  (built — option a, 텍스트 인덱스만)
 *   10_Self_Declaration_Letter.docx      (built)
 *   README.txt                           (인계 안내)
 *
 * 사용 예:
 *   const pack = await generateEvidencePack({
 *     state, totalCfp, reportId,
 *     reportDocx: await generateFullWordReport(state, totalResult, { narratives }),
 *     calcWorkbookXlsx: (await generateCalcWorkbook(storeToWorkbookData(state))).blob,
 *   })
 *   await saveFile(pack.blob, pack.filename, 'Evidence Pack', 'zip')
 */

import JSZip from 'jszip'

import { buildAllocationMethodologyDocx } from './builders/allocation-methodology'
import { buildDqrJustificationDocx } from './builders/dqr-justification'
import { buildPrimaryDataIndexDocx } from './builders/primary-data-index'
import { buildSelfDeclarationDocx } from './builders/self-declaration'
import { buildSensitivityDocx } from './builders/sensitivity-doc'
import { buildKsComplianceMatrix } from '../ks-compliance'
import type {
  EvidencePackInput,
  EvidencePackResult,
  ManifestEntry,
} from './types'

const README_TEXT = `Evidence Pack v0.1 — 검증심사원 인계용 산출물 묶음
=================================================

본 ZIP 은 KS I ISO 14067:2018 검증을 위한 다음 산출물을 포함합니다.

[포함된 산출물]
  01_Report.docx                       메인 CFP 보고서 (.docx)
  02_KS_Compliance_Matrix.xlsx         KS I ISO 14067 적합성 자가점검표 (260 행)
  04_Calculation_Workbook.xlsx         산정 워크북 (11 시트, 살아있는 수식)
  05_DQR_Justification.docx            데이터 품질 정당화
  06_Allocation_Methodology.docx       할당 절차 정당화
  07_Sensitivity_Analysis.docx         민감도 분석
  09_Primary_Activity_Data_Index.docx  1차 데이터 출처 인덱스 (텍스트만)
  10_Self_Declaration_Letter.docx      자가선언서

[현 v0.2 한계]
  03_LRQA_Pre_Verification.pdf         (다음 PR-EP2-b 예정 — LRQA 130문항)
  08_LCI_Source_Records/               (다음 PR-EP3 예정)
  09 의 원본 파일 첨부                   (옵션 c, v1.x 예정)

[검증 시 사용자 보존 권장]
  - 원료물질 ERP 입출고 대장 + 공급사 영수증
  - 한전 전기요금 청구서 12개월
  - 폐기물 위탁 처리 계약서·인계서
  - 운송 화물명세서·영수증
  → 09_Primary_Activity_Data_Index.docx 의 「검증 시 보존 권고 원본 파일」 섹션 참조.

[자가선언]
  본 산정은 ISO 14067:2018 기반의 자체 산정이며, 제3자 검증을 대체하지 않습니다.
  검증 통과는 별도 인증기관(LRQA, KFQ, KMR 등) 절차를 따릅니다.

생성: CarbonMate
`

export async function generateEvidencePack(
  input: EvidencePackInput,
): Promise<EvidencePackResult> {
  const { state, totalCfp, reportDocx, calcWorkbookXlsx } = input
  const reportId =
    input.reportId ||
    `${(state.productInfo.name || 'product').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`

  const zip = new JSZip()
  const manifest: ManifestEntry[] = []

  const addBlob = async (
    path: string,
    name: string,
    blob: Blob | undefined,
    skipReason?: string,
  ) => {
    if (!blob) {
      manifest.push({
        path,
        name,
        status: 'skipped',
        reason: skipReason ?? '주입되지 않음',
      })
      return
    }
    zip.file(path, await blob.arrayBuffer())
    manifest.push({ path, name, status: 'included' })
  }

  // 01 + 04 외부 주입
  await addBlob('01_Report.docx', '메인 CFP 보고서', reportDocx, '보고서 docx 미생성')
  await addBlob('04_Calculation_Workbook.xlsx', '산정 워크북', calcWorkbookXlsx, '산정 워크북 미생성')

  // 02/05/06/07/09/10 동시 생성 (Promise.all 로 병렬화)
  const [ks, dqr, alloc, sens, primary, selfDecl] = await Promise.all([
    buildKsComplianceMatrix(state),
    buildDqrJustificationDocx(state),
    buildAllocationMethodologyDocx(state),
    buildSensitivityDocx(state),
    buildPrimaryDataIndexDocx(state),
    buildSelfDeclarationDocx(state, totalCfp),
  ])
  await addBlob('02_KS_Compliance_Matrix.xlsx', 'KS 적합성 매트릭스 (260행)', ks.blob)
  await addBlob('05_DQR_Justification.docx', '데이터 품질 정당화', dqr)
  await addBlob('06_Allocation_Methodology.docx', '할당 방법 정당화', alloc)
  await addBlob('07_Sensitivity_Analysis.docx', '민감도 분석', sens)
  await addBlob('09_Primary_Activity_Data_Index.docx', '1차 데이터 출처 인덱스', primary)
  await addBlob('10_Self_Declaration_Letter.docx', '자가선언서', selfDecl)

  // 미구현 placeholder 항목들 — manifest 에만 표시
  manifest.push(
    { path: '03_LRQA_Pre_Verification.pdf', name: 'LRQA 사전 검증 130문항', status: 'placeholder', reason: '다음 PR-EP2-b 예정' },
    { path: '08_LCI_Source_Records/', name: 'LCI 출처 기록', status: 'placeholder', reason: '다음 PR-EP3 예정' },
  )

  // README
  zip.file('README.txt', README_TEXT)
  manifest.push({ path: 'README.txt', name: '인계 안내', status: 'included' })

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  return {
    blob: zipBlob,
    filename: `Evidence_Pack_${reportId}.zip`,
    manifest,
  }
}

export type { EvidencePackInput, EvidencePackResult, ManifestEntry } from './types'
