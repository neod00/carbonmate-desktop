/**
 * exceljs 스타일 헬퍼 — Python PoC 의 GRAY_FILL/HEADER_FONT/BORDER 등 1:1 포팅.
 */

import type { Cell, Worksheet } from 'exceljs'

const FONT_NAME = '맑은 고딕'

export const COLOR_GRAY = 'FFBFBFBF'
export const COLOR_LIGHT_GRAY = 'FFE7E6E6'
export const COLOR_WHITE = 'FFFFFFFF'
export const COLOR_WARN = 'FFFFF2CC'
export const COLOR_BORDER = 'FF808080'

const HEADER_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: COLOR_GRAY },
}

const WHITE_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: COLOR_WHITE },
}

export const WARN_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: COLOR_WARN },
}

export const LIGHT_GRAY_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: COLOR_LIGHT_GRAY },
}

const HEADER_FONT = {
  name: FONT_NAME,
  size: 10,
  bold: true,
  color: { argb: 'FF000000' },
}

const BODY_FONT = {
  name: FONT_NAME,
  size: 10,
}

export const TITLE_FONT = {
  name: FONT_NAME,
  size: 14,
  bold: true,
}

export const SUBTITLE_FONT = {
  name: FONT_NAME,
  size: 11,
  bold: true,
}

export const NOTE_FONT = {
  name: FONT_NAME,
  size: 9,
  color: { argb: 'FF595959' },
}

const THIN_BORDER = { style: 'thin' as const, color: { argb: COLOR_BORDER } }

export const FULL_BORDER = {
  top: THIN_BORDER,
  left: THIN_BORDER,
  bottom: THIN_BORDER,
  right: THIN_BORDER,
}

export const CENTER_ALIGN = {
  horizontal: 'center' as const,
  vertical: 'middle' as const,
  wrapText: true,
}

export const LEFT_ALIGN = {
  horizontal: 'left' as const,
  vertical: 'middle' as const,
  indent: 1,
  wrapText: true,
}

/** 헤더 셀 스타일 적용 */
export function styleHeader(cell: Cell): void {
  cell.fill = HEADER_FILL
  cell.font = HEADER_FONT
  cell.alignment = CENTER_ALIGN
  cell.border = FULL_BORDER
}

/** 본문 셀 스타일 — numeric 시 가운데 정렬 + 숫자 포맷 */
export function styleBody(
  cell: Cell,
  options: { numeric?: boolean; format?: string } = {},
): void {
  cell.fill = WHITE_FILL
  cell.font = BODY_FONT
  cell.alignment = options.numeric ? CENTER_ALIGN : LEFT_ALIGN
  cell.border = FULL_BORDER
  if (options.numeric) {
    cell.numFmt = options.format ?? '#,##0.00###'
  }
}

/** 셀에 fill 만 추가 (스타일 보존) */
export function applyFill(cell: Cell, fill: typeof WARN_FILL): void {
  cell.fill = fill
}

/** 시트 인쇄 옵션 — 가로 중앙 + 너비 fit */
export function applyPrintDefaults(ws: Worksheet, landscape = false): void {
  ws.pageSetup = {
    ...(ws.pageSetup ?? {}),
    horizontalCentered: true,
    margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    orientation: landscape ? 'landscape' : 'portrait',
  }
}
