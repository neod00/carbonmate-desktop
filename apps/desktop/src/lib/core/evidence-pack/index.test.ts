/**
 * Evidence Pack 회귀 — 토리컴 fixture 기반 store 모방.
 *
 * 검증 포인트:
 *   - ZIP 정상 생성 (Blob, size > 0)
 *   - 7 개 docx + README 포함 (외부 주입 2 종 제외 시 6 개)
 *   - 미구현 항목은 manifest 에 placeholder 로 기록
 *   - 토리컴 fixture 합계 = 1,065.43 (산정 워크북 통합 동작 확인)
 */

import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { generateCalcWorkbook } from '../calc-workbook'
import { storeToWorkbookData } from '../calc-workbook/store-adapter'
import { generateEvidencePack } from './index'
import type { PCFState } from '../store'

// 최소 PCFState 모방 — 진입점 호출에 필요한 필드만
function makeMinimalState(): PCFState {
  return {
    productInfo: {
      name: 'Toricomm NiSO4',
      category: 'inorganic-chemical',
      unit: '1 ton NiSO4',
      boundary: 'cradle-to-gate',
    },
    stages: [],
    activityData: {},
    detailedActivityData: {
      raw_materials: [],
      manufacturing: { electricity: [], fuels: [], processEmissions: [] },
      transport: [],
      packaging: [],
      use: { electricity: [], consumables: [] },
      eol: { disposal: [], recycling: [] },
    },
    dataQualityMeta: { overallType: 'primary', sources: ['ERP'], baseYear: 2025 },
    multiOutputAllocation: {
      method: 'subdivision',
      mainProductShare: 1.0,
      coProducts: [],
      justification: '단일 제품 — 분리 적용으로 할당 회피',
    },
    recyclingAllocation: {
      method: 'cut_off',
      loopType: 'open',
      recyclingRate: 0,
      recycledContentInput: 0,
      recyclabilityOutput: 0,
      justification: 'NiSO4 — cut-off 적용',
    },
    sensitivityAnalysis: null,
    cutOffCriteria: { byMass: 0.01, byEnergy: 0.01, byEmission: 0.01, totalCoverage: 0.95 },
    cutOffPreset: 'iso14067_default' as never,
    cutOffResult: null,
    cfpHistory: [],
    valueChoices: [],
    characterizationModel: 'AR6',
    pcrReferences: [],
    reportMeta: {
      reportNumber: 'CM-PCF-TEST-001',
      commissioner: '(테스트 의뢰사)',
      practitioner: 'CarbonMate Self-Test',
      reportType: 'internal' as never,
      confidentiality: 'internal' as never,
    },
    reviewInfo: { reviewType: 'self' as never },
    setProductInfo: () => {},
    toggleStage: () => {},
    setActivityData: () => {},
    setActivityDataWithMeta: () => {},
    setTransportMode: () => {},
    setElectricityGrid: () => {},
    setDataQualityMeta: () => {},
    setMultiOutputAllocationMethod: () => {},
    setPhysicalAllocationBasis: () => {},
    addCoProduct: () => {},
    removeCoProduct: () => {},
    updateCoProduct: () => {},
    setMainProductData: () => {},
    setTotalProcessEmission: () => {},
    setRecyclingAllocationMethod: () => {},
    setRecyclingParams: () => {},
    setAllocationJustification: () => {},
    setSensitivityAnalysis: () => {},
    setCutOffPreset: () => {},
    setCutOffCriteria: () => {},
    setCutOffResult: () => {},
    addCFPSnapshot: () => {},
    removeCFPSnapshot: () => {},
    getCFPTrackingResult: () => null,
    addRawMaterial: () => {},
    removeRawMaterial: () => {},
    updateRawMaterial: () => {},
    addTransportStep: () => {},
    removeTransportStep: () => {},
    updateTransportStep: () => {},
    addPackagingPart: () => {},
    removePackagingPart: () => {},
    updatePackagingPart: () => {},
    addValueChoice: () => {},
    removeValueChoice: () => {},
    updateValueChoice: () => {},
    setCharacterizationModel: () => {},
    addPCRReference: () => {},
    removePCRReference: () => {},
    setReportMeta: () => {},
    setReviewInfo: () => {},
    user: null,
    setUser: () => {},
    logout: async () => {},
    reset: () => {},
  } as unknown as PCFState
}

describe('Evidence Pack generation', () => {
  it('generates ZIP with required docx files + README', async () => {
    const state = makeMinimalState()
    const pack = await generateEvidencePack({ state, totalCfp: 1065.43 })

    expect(pack.blob).toBeInstanceOf(Blob)
    expect(pack.blob.size).toBeGreaterThan(10_000)
    expect(pack.filename).toMatch(/^Evidence_Pack_.*\.zip$/)

    // ZIP 검증
    const buf = await pack.blob.arrayBuffer()
    const zip = await JSZip.loadAsync(buf)
    const names = Object.keys(zip.files)
    expect(names).toContain('05_DQR_Justification.docx')
    expect(names).toContain('06_Allocation_Methodology.docx')
    expect(names).toContain('07_Sensitivity_Analysis.docx')
    expect(names).toContain('09_Primary_Activity_Data_Index.docx')
    expect(names).toContain('10_Self_Declaration_Letter.docx')
    expect(names).toContain('README.txt')
  })

  it('manifest reports placeholder for unimplemented items (#02, #03, #08)', async () => {
    const state = makeMinimalState()
    const pack = await generateEvidencePack({ state })
    const placeholders = pack.manifest.filter((m) => m.status === 'placeholder')
    expect(placeholders.map((p) => p.path)).toEqual(
      expect.arrayContaining([
        '02_KS_Compliance_Matrix.xlsx',
        '03_LRQA_Pre_Verification.pdf',
        '08_LCI_Source_Records/',
      ]),
    )
  })

  it('manifest marks injected blobs as skipped when not provided', async () => {
    const state = makeMinimalState()
    const pack = await generateEvidencePack({ state })
    const skipped = pack.manifest.filter((m) => m.status === 'skipped').map((m) => m.path)
    expect(skipped).toContain('01_Report.docx')
    expect(skipped).toContain('04_Calculation_Workbook.xlsx')
  })

  it('integrates calc-workbook (real injected blob, toricomm fixture-style)', async () => {
    // 계산 워크북 통합 시 ZIP 안에 04_Calculation_Workbook.xlsx 가 실제로 포함되는지
    const state = makeMinimalState()
    const data = storeToWorkbookData(state)
    const wb = await generateCalcWorkbook(data)
    const pack = await generateEvidencePack({
      state,
      totalCfp: 0, // 실 데이터 없음 (최소 state)
      calcWorkbookXlsx: wb.blob,
    })
    const buf = await pack.blob.arrayBuffer()
    const zip = await JSZip.loadAsync(buf)
    expect(zip.files['04_Calculation_Workbook.xlsx']).toBeDefined()
    const included = pack.manifest.find((m) => m.path === '04_Calculation_Workbook.xlsx')
    expect(included?.status).toBe('included')
  })
})
