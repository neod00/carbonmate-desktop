/**
 * 산정 워크북 자동 생성 — 진입점.
 *
 * Python PoC `build_workbook` 1:1 포팅 (v1, 차트 제외).
 *
 * 사용 예:
 *   const data = storeToWorkbookData(usePCFStore.getState())
 *   const result = await generateCalcWorkbook(data)
 *   await saveFile(result.blob, '산정워크북.xlsx', '산정 워크북', 'xlsx')
 */

import ExcelJS from 'exceljs'

import { buildBomInput } from './builders/bom-input'
import { buildBomOutput } from './builders/bom-output'
import { buildCover } from './builders/cover'
import { buildEfDb } from './builders/ef-db'
import { buildElectricity } from './builders/electricity'
import { buildLcia } from './builders/lcia'
import { buildProductCfp } from './builders/product-cfp'
import { buildProduction } from './builders/production'
import { buildSensitivity } from './builders/sensitivity'
import { buildWaste } from './builders/waste'
import {
  PRODUCT_CFP_DATA_START_ROW,
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
import { attachMonthlyToBom, DEFAULT_MONTHLY_WEIGHTS_NISO4 } from './monthly-expander'
import { buildStageRowMap } from './sheet-router'
import type { BomItem, WorkbookData, WorkbookGenerationResult } from './types'

/** EF 추출 — efSeq=0 인 cut-off 행은 0 반환 */
function efOf(it: BomItem, efBySeq: Record<number, number>): number {
  if (it.efSeq === 0) return 0
  return efBySeq[it.efSeq] ?? 0
}

/** 시트 이름 안전화 — Excel 31자 제한 + [ ] / \ ? * : 금지 */
function safeSheetName(code: string): string {
  return code.replace(/[\[\]\/\\?*:]/g, '_').slice(0, 31)
}

export async function generateCalcWorkbook(
  data: WorkbookData,
): Promise<WorkbookGenerationResult> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CarbonMate'
  wb.created = new Date()
  wb.lastModifiedBy = 'CarbonMate'
  wb.modified = new Date()

  // BOM 모든 항목에 monthly 분해 부착 (이미 있으면 skip)
  for (const code of Object.keys(data.productBoms)) {
    const weights =
      data.monthlyWeightsByProduct?.[code] ?? Array.from(DEFAULT_MONTHLY_WEIGHTS_NISO4)
    attachMonthlyToBom(data.productBoms[code], weights)
  }

  // 시트 1: 표지
  const wsCover = wb.addWorksheet(SHEET_COVER)
  buildCover(wsCover, data.meta)

  // 시트 2: 제품 생산량
  const wsProd = wb.addWorksheet(SHEET_PRODUCTION)
  const fuAnchorRows = buildProduction(wsProd, data.products, {
    fuKgByProduct: data.fuKgByProduct,
    monthlyWeightsByProduct: data.monthlyWeightsByProduct,
  })

  // 시트 3-4: BOM 입력물/출력물
  const wsBomIn = wb.addWorksheet(SHEET_BOM_INPUT)
  const bomInputRows = buildBomInput(wsBomIn, data.productBoms, data.products)
  const wsBomOut = wb.addWorksheet(SHEET_BOM_OUTPUT)
  const bomOutputRows = buildBomOutput(wsBomOut, data.productBoms, data.products)

  // 시트 5-6: 전기 사용량 + 폐기물 처리 실적
  const wsElec = wb.addWorksheet(SHEET_ELECTRICITY)
  const electricityRows = buildElectricity(wsElec, data.productBoms, data.products)
  const wsWaste = wb.addWorksheet(SHEET_WASTE)
  const wasteRows = buildWaste(wsWaste, data.productBoms, data.products)

  // 시트 7: EF DB
  const wsEf = wb.addWorksheet(SHEET_EF_DB)
  buildEfDb(wsEf, data.secondary)

  // 시트 8+: 제품별 CFP
  const productSheetNames: Record<string, string> = {}
  const productTotalRows: Record<string, number> = {}
  const stageRowMaps: Record<string, Record<string, number[]>> = {}
  const efBySeq = Object.fromEntries(data.secondary.map((s) => [s.seq, s.efKgCo2e]))
  const productTotalsKgCo2e: Record<string, number> = {}
  for (const p of data.products) {
    const bom = data.productBoms[p.code]
    if (!bom) continue
    const sheetName = safeSheetName(p.code)
    const wsP = wb.addWorksheet(sheetName)
    const totalRow = buildProductCfp(wsP, {
      product: p,
      bom,
      bomInputRows: bomInputRows[p.code] ?? {},
      bomOutputRows: bomOutputRows[p.code] ?? {},
      electricityRows: electricityRows[p.code] ?? {},
      wasteRows: wasteRows[p.code] ?? {},
      fuAnchorRow: fuAnchorRows[p.code],
    })
    productSheetNames[p.code] = sheetName
    productTotalRows[p.code] = totalRow
    stageRowMaps[p.code] = buildStageRowMap(bom, PRODUCT_CFP_DATA_START_ROW)

    // 자체 검증 합계
    const fuKg = data.fuKgByProduct[p.code] ?? 1000
    let perKg = 0
    for (const it of bom) {
      if (it.cutOff) continue
      if (it.direction === 'output' && it.category === '제품') continue
      const n = it.appliedQty / fuKg
      perKg += efOf(it, efBySeq) * n
    }
    productTotalsKgCo2e[p.code] = perKg * 1000
  }

  // 시트 N: LCIA
  const wsLcia = wb.addWorksheet(SHEET_LCIA)
  buildLcia(wsLcia, {
    products: data.products,
    productSheetNames,
    productTotalRows,
    stageRowMaps,
  })

  // 시트 N+1: 민감도
  const wsSens = wb.addWorksheet(SHEET_SENSITIVITY)
  buildSensitivity(wsSens, data.products[0], data.sensitivity)

  // ArrayBuffer → Blob
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  return {
    blob,
    productTotalsKgCo2eByProduct: productTotalsKgCo2e,
    sheetCount: wb.worksheets.length,
    chartCount: 0, // v1 차트 제외
  }
}

export type { WorkbookData, WorkbookGenerationResult } from './types'
export * from './types'
