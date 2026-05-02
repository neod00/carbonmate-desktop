/**
 * KS I ISO 14067 적합성 매트릭스 회귀 테스트.
 */

import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { buildKsComplianceMatrix } from './builder'
import { KS_REQUIREMENTS } from './requirements'
import type { PCFState } from '../store'

function makeEmptyState(): PCFState {
  return {
    productInfo: { name: '', category: '', unit: '', boundary: 'cradle-to-gate' },
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
    dataQualityMeta: { overallType: 'primary', sources: [], baseYear: 2025 },
    multiOutputAllocation: {
      method: 'subdivision',
      mainProductShare: 1.0,
      coProducts: [],
      justification: '단일 제품',
    },
    recyclingAllocation: {
      method: 'cut_off',
      loopType: 'open',
      recyclingRate: 0,
      recycledContentInput: 0,
      recyclabilityOutput: 0,
      justification: 'cut-off',
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
      reportNumber: '',
      commissioner: '',
      practitioner: '',
      reportType: 'internal' as never,
      confidentiality: 'internal' as never,
    },
    reviewInfo: { reviewType: 'none' as never },
    setProductInfo: () => {}, toggleStage: () => {}, setActivityData: () => {},
    setActivityDataWithMeta: () => {}, setTransportMode: () => {}, setElectricityGrid: () => {},
    setDataQualityMeta: () => {}, setMultiOutputAllocationMethod: () => {},
    setPhysicalAllocationBasis: () => {}, addCoProduct: () => {}, removeCoProduct: () => {},
    updateCoProduct: () => {}, setMainProductData: () => {}, setTotalProcessEmission: () => {},
    setRecyclingAllocationMethod: () => {}, setRecyclingParams: () => {},
    setAllocationJustification: () => {}, setSensitivityAnalysis: () => {},
    setCutOffPreset: () => {}, setCutOffCriteria: () => {}, setCutOffResult: () => {},
    addCFPSnapshot: () => {}, removeCFPSnapshot: () => {}, getCFPTrackingResult: () => null,
    addRawMaterial: () => {}, removeRawMaterial: () => {}, updateRawMaterial: () => {},
    addTransportStep: () => {}, removeTransportStep: () => {}, updateTransportStep: () => {},
    addPackagingPart: () => {}, removePackagingPart: () => {}, updatePackagingPart: () => {},
    addValueChoice: () => {}, removeValueChoice: () => {}, updateValueChoice: () => {},
    setCharacterizationModel: () => {}, addPCRReference: () => {}, removePCRReference: () => {},
    setReportMeta: () => {}, setReviewInfo: () => {},
    user: null, setUser: () => {}, logout: async () => {}, reset: () => {},
  } as unknown as PCFState
}

describe('KS Compliance Matrix', () => {
  it('loads all 260 requirements from JSON resource', () => {
    expect(KS_REQUIREMENTS.length).toBeGreaterThanOrEqual(250)
    // 5/6/7/8 조항 prefix 모두 존재
    const prefixes = new Set(KS_REQUIREMENTS.map((r) => r.clause.split('.')[0]))
    expect(prefixes.has('5')).toBe(true)
    expect(prefixes.has('6')).toBe(true)
    expect(prefixes.has('7')).toBe(true)
    expect(prefixes.has('8')).toBe(true)
    // shall 항목 ≥ 100 확인 (검증 통과 핵심 의무 조항)
    const shall = KS_REQUIREMENTS.filter((r) => r.obligation === 'shall')
    expect(shall.length).toBeGreaterThanOrEqual(100)
  })

  it('generates xlsx with 적합성 매트릭스 + 요약 sheets', async () => {
    const state = makeEmptyState()
    const result = await buildKsComplianceMatrix(state)

    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.size).toBeGreaterThan(10_000)

    const buf = await result.blob.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    expect(wb.worksheets.map((w) => w.name)).toEqual(
      expect.arrayContaining(['적합성 매트릭스', '요약']),
    )

    // 요구사항 행 수 = KS_REQUIREMENTS.length + 헤더(4행)
    const ws = wb.getWorksheet('적합성 매트릭스')!
    const expectedLastRow = 4 + KS_REQUIREMENTS.length
    expect(ws.rowCount).toBe(expectedLastRow)
  })

  it('summary captures shall/should distribution', async () => {
    const state = makeEmptyState()
    const result = await buildKsComplianceMatrix(state)
    expect(result.summary.totalRequirements).toBe(KS_REQUIREMENTS.length)
    expect(result.summary.shallCount).toBeGreaterThan(0)
    expect(result.summary.shouldCount).toBeGreaterThan(0)
    // empty state — 대부분 fail/manual/partial. 통과 가능 항목은 거의 없음
    expect(result.summary.shallPassRate).toBeLessThan(0.5)
  })

  it('auto-checks fire for known clauses', async () => {
    const state = makeEmptyState()
    const result = await buildKsComplianceMatrix(state)
    // 5.3 (FU 미정의) → fail
    const fu = result.checked.find((c) => c.req.clause === '5.3')
    expect(fu?.result.status).toBe('fail')
    // 6.5.1 (AR6 적용) → pass
    const gwp = result.checked.find((c) => c.req.clause === '6.5.1')
    expect(gwp?.result.status).toBe('pass')
  })
})
