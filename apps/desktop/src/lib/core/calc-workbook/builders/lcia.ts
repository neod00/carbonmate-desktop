/**
 * LCIA 시트 — 제품별 단계 합계 cross-sheet 수식.
 * Python PoC `build_lcia_block` / `build_lcia` 1:1 포팅.
 * v1: 차트 제외 (셀 수식만)
 */

import type { Worksheet } from 'exceljs'

import { applyPrintDefaults, styleBody, styleHeader, SUBTITLE_FONT } from '../styles'
import type { ProductCFP } from '../types'

interface BuildLciaOptions {
  products: ProductCFP[]
  productSheetNames: Record<string, string>
  productTotalRows: Record<string, number>
  /** product.code → stage name → row numbers (in product CFP sheet) */
  stageRowMaps: Record<string, Record<string, number[]>>
}

interface BlockResult {
  nextRow: number
  stageFirstRow: number
  stageLastRow: number
}

function buildLciaBlock(
  ws: Worksheet,
  startRow: number,
  product: ProductCFP,
  productSheetName: string,
  productTotalRow: number,
  stageRowMap: Record<string, number[]>,
): BlockResult {
  let r = startRow
  // 제목
  const titleCell = ws.getCell(r, 2)
  titleCell.value = `${product.displayName}의 탄소발자국`
  titleCell.font = SUBTITLE_FONT
  r += 1
  // 영향범주 헤더
  const icHeader = ws.getCell(r, 2)
  icHeader.value = '영향범주'
  styleHeader(icHeader)
  ws.mergeCells(r, 2, r, 4)
  r += 1
  // 영향범주 값
  const icValue = ws.getCell(r, 2)
  icValue.value = product.impactCategory
  styleBody(icValue)
  ws.mergeCells(r, 2, r, 4)
  r += 1

  // 제품명/단위/값 헤더
  for (let i = 0; i < 3; i += 1) {
    const c = ws.getCell(r, 2 + i)
    c.value = ['제품명', '단위', '탄소발자국 값'][i]
    styleHeader(c)
  }
  r += 1
  // 제품명/단위/값 (총합)
  ws.getCell(r, 2).value = product.fuLabel
  styleBody(ws.getCell(r, 2))
  ws.getCell(r, 3).value = product.unit
  styleBody(ws.getCell(r, 3), { numeric: true })
  // D 총합 = product CFP S{total}*1000 (kg → ton)
  ws.getCell(r, 4).value = {
    formula: `'${productSheetName}'!S${productTotalRow}*1000`,
  }
  styleBody(ws.getCell(r, 4), { numeric: true })
  r += 1

  // 전과정 단계 헤더
  for (let i = 0; i < 3; i += 1) {
    const c = ws.getCell(r, 2 + i)
    c.value = ['전과정 단계', '단위', '탄소발자국 값'][i]
    styleHeader(c)
  }
  r += 1
  const stageFirstRow = r
  for (const stage of product.stages) {
    ws.getCell(r, 2).value = stage.name
    styleBody(ws.getCell(r, 2))
    ws.getCell(r, 3).value = product.unit
    styleBody(ws.getCell(r, 3), { numeric: true })
    const rows = stageRowMap[stage.name]
    if (rows && rows.length > 0) {
      const sumTerms = rows.map((rr) => `'${productSheetName}'!S${rr}`).join(',')
      ws.getCell(r, 4).value = { formula: `SUM(${sumTerms})*1000` }
    } else {
      ws.getCell(r, 4).value = stage.valueKgCo2e
    }
    styleBody(ws.getCell(r, 4), { numeric: true })
    r += 1
  }
  const stageLastRow = r - 1

  // 하위범주 헤더
  for (let i = 0; i < 3; i += 1) {
    const c = ws.getCell(r, 2 + i)
    c.value = ['탄소발자국 하위범주', '단위', '탄소발자국 값'][i]
    styleHeader(c)
  }
  r += 1
  for (const sub of product.subcategories) {
    ws.getCell(r, 2).value = sub.name
    styleBody(ws.getCell(r, 2))
    ws.getCell(r, 3).value = product.unit
    styleBody(ws.getCell(r, 3), { numeric: true })
    // Toricomm 무기화학: Fossil = total, Biogenic/LUC = 0
    if (sub.name.includes('Fossil')) {
      ws.getCell(r, 4).value = {
        formula: `'${productSheetName}'!S${productTotalRow}*1000`,
      }
    } else {
      ws.getCell(r, 4).value = 0
    }
    styleBody(ws.getCell(r, 4), { numeric: true })
    r += 1
  }

  return { nextRow: r + 1, stageFirstRow, stageLastRow }
}

export function buildLcia(ws: Worksheet, opts: BuildLciaOptions): void {
  ws.getColumn('A').width = 2
  ws.getColumn('B').width = 48
  ws.getColumn('C').width = 14
  ws.getColumn('D').width = 18

  let nextRow = 2
  for (const p of opts.products) {
    const sheetName = opts.productSheetNames[p.code]
    const totalRow = opts.productTotalRows[p.code]
    const stageMap = opts.stageRowMaps[p.code] ?? {}
    if (!sheetName || !totalRow) continue
    const { nextRow: nr } = buildLciaBlock(ws, nextRow, p, sheetName, totalRow, stageMap)
    nextRow = nr
  }

  applyPrintDefaults(ws, false)
}
