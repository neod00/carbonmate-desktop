/**
 * Evidence Pack docx 빌더 공통 헬퍼.
 *
 * report-docx.ts 의 패턴을 따르되, 단일 문서 단순 보고서 형태이므로
 * 표지/TOC/Footer 등 대규모 요소는 생략하고 핵심 본문만 빠르게 구성.
 */

import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

const COLORS = {
  primary: '1E40AF',
  primaryLight: 'EFF6FF',
  accent: '059669',
  text: '334155',
  border: 'CBD5E1',
  headerBg: 'F1F5F9',
  warm: 'FEF3C7',
  red: 'DC2626',
}

const FONT = '맑은 고딕'

export function title(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, bold: true, size: 32, font: FONT, color: COLORS.primary }),
    ],
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 200 },
  })
}

export function heading2(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, font: FONT, color: COLORS.text })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  })
}

export function heading3(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 20, font: FONT, color: COLORS.text })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
  })
}

export function paragraph(text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size ?? 20,
        bold: opts.bold,
        italics: opts.italics,
        color: COLORS.text,
      }),
    ],
    spacing: { after: 120 },
  })
}

export function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 20, color: COLORS.text })],
    bullet: { level: 0 },
    spacing: { after: 80 },
  })
}

export function isoNote(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, font: FONT, size: 18, italics: true, color: COLORS.accent }),
    ],
    spacing: { after: 100 },
  })
}

export function metaTable(rows: Array<[string, string]>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([k, v]) =>
      new TableRow({
        children: [
          tableCell(k, { bold: true, shading: COLORS.headerBg, width: 30 }),
          tableCell(v, { width: 70 }),
        ],
      }),
    ),
  })
}

interface TableCellOpts {
  bold?: boolean
  shading?: string
  width?: number
  align?: 'left' | 'center' | 'right'
}

export function tableCell(text: string, opts: TableCellOpts = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shading
      ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.shading }
      : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: FONT,
            size: 18,
            bold: opts.bold,
            color: COLORS.text,
          }),
        ],
        alignment:
          opts.align === 'center'
            ? AlignmentType.CENTER
            : opts.align === 'right'
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT,
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
    },
  })
}

export function dataTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((h) =>
          tableCell(h, { bold: true, shading: COLORS.primaryLight, align: 'center' }),
        ),
        tableHeader: true,
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((cell, idx) =>
              tableCell(cell, { align: idx === 0 ? 'left' : 'center' }),
            ),
          }),
      ),
    ],
  })
}

export function blank(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: '', font: FONT, size: 18 })] })
}
