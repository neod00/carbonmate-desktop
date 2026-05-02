/**
 * 산정 워크북 회귀 테스트 — 토리컴 fixture 로 합계 1,065.43 보장.
 *
 * Python PoC 의 pycel 검증과 동일한 역할.
 * 추가로: 시트 수, 차트 수(=0 v1), 헤더 셀 존재 검증.
 */

import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { generateCalcWorkbook } from './index'
import {
  SHEET_BOM_INPUT,
  SHEET_BOM_OUTPUT,
  SHEET_COVER,
  SHEET_EF_DB,
  SHEET_ELECTRICITY,
  SHEET_LCIA,
  SHEET_PRODUCTION,
  SHEET_SENSITIVITY,
  SHEET_WASTE,
} from './constants'
import {
  TORICOMM_NISO4,
  TORICOMM_NISO4_POWDER_HYPO,
  TORICOMM_WORKBOOK_DATA,
} from './toricomm-fixture'

describe('calc-workbook generation', () => {
  it('generates workbook for toricomm fixture with expected total', async () => {
    const result = await generateCalcWorkbook(TORICOMM_WORKBOOK_DATA)

    // v1: 차트 제외
    expect(result.chartCount).toBe(0)

    // 11 시트 — 표지 + 제품 생산량 + BOM in + BOM out + 전기 + 폐기물 + EF DB + 제품 CFP × 2 + LCIA + 민감도
    expect(result.sheetCount).toBe(11)

    // 합계 1,065.43 보장 — Python pycel 검증과 동일
    const granuleTotal = result.productTotalsKgCo2eByProduct[TORICOMM_NISO4.code]
    expect(granuleTotal).toBeCloseTo(1065.43, 1)

    // Powder HYPO 70% 스케일 + 운송 1건 320km 변경
    const powderTotal = result.productTotalsKgCo2eByProduct[TORICOMM_NISO4_POWDER_HYPO.code]
    expect(powderTotal).toBeGreaterThan(700)
    expect(powderTotal).toBeLessThan(800)

    // Blob 정상
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.size).toBeGreaterThan(10_000) // 적어도 10KB
  })

  it('produced workbook contains all expected sheets', async () => {
    const result = await generateCalcWorkbook(TORICOMM_WORKBOOK_DATA)
    const buf = await result.blob.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const names = wb.worksheets.map((w) => w.name)
    expect(names).toContain(SHEET_COVER)
    expect(names).toContain(SHEET_PRODUCTION)
    expect(names).toContain(SHEET_BOM_INPUT)
    expect(names).toContain(SHEET_BOM_OUTPUT)
    expect(names).toContain(SHEET_ELECTRICITY)
    expect(names).toContain(SHEET_WASTE)
    expect(names).toContain(SHEET_EF_DB)
    expect(names).toContain(SHEET_LCIA)
    expect(names).toContain(SHEET_SENSITIVITY)
    expect(names).toContain('NiSO4-99.99-Granule')
    expect(names).toContain('NiSO4-99.9-Powder-HYPO')
  })

  it('produced workbook has live formulas in product CFP sheets', async () => {
    const result = await generateCalcWorkbook(TORICOMM_WORKBOOK_DATA)
    const buf = await result.blob.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('NiSO4-99.99-Granule')!

    // S 열 (배출량) 셀들이 수식이어야 함 (cut-off 행 제외)
    // 황산 row = DATA_START + 2 = 6
    const sCell = ws.getCell('S6')
    expect(sCell.formula).toBeTruthy()
    expect(sCell.formula).toMatch(/L6\*N6/)

    // N 열 (FU 환산) 도 수식 (제품 행 제외)
    const nCell = ws.getCell('N6')
    expect(nCell.formula).toBeTruthy()
    expect(nCell.formula).toMatch(/제품 생산량/)
  })

  it('LCIA sheet references product CFP sheet via formulas', async () => {
    const result = await generateCalcWorkbook(TORICOMM_WORKBOOK_DATA)
    const buf = await result.blob.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const lcia = wb.getWorksheet(SHEET_LCIA)!

    // 첫 번째 제품 블록 D6 (총합) — product CFP S{total}*1000 참조
    const d6 = lcia.getCell('D6')
    expect(d6.formula).toBeTruthy()
    expect(d6.formula).toMatch(/NiSO4-99\.99-Granule/)
    expect(d6.formula).toMatch(/\*1000/)
  })
})
