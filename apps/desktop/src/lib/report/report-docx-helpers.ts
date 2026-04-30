'use client'

import {
    Paragraph, Table, TableRow, TableCell, TextRun,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak,
} from 'docx'

export const C = {
    primary: '1E40AF', primaryLight: 'EFF6FF', accent: '059669', accentLight: 'ECFDF5',
    dark: '0F172A', text: '334155', textLight: '64748B', border: 'CBD5E1',
    headerBg: 'F1F5F9', white: 'FFFFFF', purple: '7C3AED', warm: 'FEF3C7',
}

export const STAGE_LABELS: Record<string, string> = {
    raw_materials: '원료 채취', manufacturing: '제조', transport: '운송',
    packaging: '포장', use: '사용', eol: '폐기',
}
export const BOUNDARY_LABELS: Record<string, string> = {
    'cradle-to-gate': '요람에서 공장 문까지 (Cradle-to-Gate)',
    'cradle-to-grave': '요람에서 무덤까지 (Cradle-to-Grave)',
    'gate-to-gate': '공장 내 (Gate-to-Gate)',
}
export const REPORT_TYPE_LABELS: Record<string, string> = {
    study: 'CFP 연구 보고서 (내부 의사결정용)',
    communication: 'CFP 외부 커뮤니케이션 보고서',
    tracking: 'CFP 성과 추적 보고서',
}
export const REVIEW_TYPE_LABELS: Record<string, string> = {
    none: '미실시', internal: '내부 검토', external: '외부 검토', critical_review: '비판적 검토 (ISO 14067 6.7)',
}

export function cell(content: string, opts?: {
    bold?: boolean; width?: number; shading?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    fontSize?: number; color?: string; columnSpan?: number
}): TableCell {
    return new TableCell({
        children: [new Paragraph({
            children: [new TextRun({ text: content, bold: opts?.bold, size: opts?.fontSize || 18, color: opts?.color || C.text, font: 'Pretendard' })],
            alignment: opts?.align || AlignmentType.LEFT, spacing: { before: 40, after: 40 },
        })],
        width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
        shading: opts?.shading ? { type: ShadingType.CLEAR, fill: opts.shading } : undefined,
        columnSpan: opts?.columnSpan,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: C.border },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: C.border },
            left: { style: BorderStyle.SINGLE, size: 1, color: C.border },
            right: { style: BorderStyle.SINGLE, size: 1, color: C.border },
        },
    })
}

export function h(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
    return new Paragraph({ heading: level, children: [new TextRun({ text, font: 'Pretendard' })], spacing: { before: 300, after: 150 } })
}

export function p(text: string, opts?: { bold?: boolean; italic?: boolean; color?: string }): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text, bold: opts?.bold, italics: opts?.italic, color: opts?.color || C.text, size: 20, font: 'Pretendard' })],
        spacing: { before: 60, after: 60 },
    })
}

export function bullet(text: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text: `• ${text}`, size: 18, color: C.text, font: 'Pretendard' })],
        spacing: { before: 30, after: 30 }, indent: { left: 360 },
    })
}

export function note(text: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text: `ℹ️ ${text}`, size: 18, color: C.textLight, font: 'Pretendard', italics: true })],
        spacing: { before: 60, after: 60 }, indent: { left: 200 },
    })
}

export function todo(text: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text: `[작성 필요] ${text}`, size: 18, color: 'B91C1C', font: 'Pretendard', bold: true })],
        spacing: { before: 60, after: 60 },
    })
}

export const empty = (): Paragraph => new Paragraph({ spacing: { before: 0, after: 0 } })
export const pb = (): Paragraph => new Paragraph({ children: [new PageBreak()] })

export function makeTable(headers: string[], rows: string[][], headerColor = C.primary): Table {
    const colW = Math.floor(100 / headers.length)
    return new Table({
        rows: [
            new TableRow({
                children: headers.map(hdr => cell(hdr, { bold: true, shading: headerColor, color: C.white, width: colW, align: AlignmentType.CENTER })),
            }),
            ...rows.map(r => new TableRow({
                children: r.map((v, i) => cell(v, { width: colW, align: i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT })),
            })),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
    })
}

export function kvTable(rows: [string, string][]): Table {
    return new Table({
        rows: rows.map(([k, v]) => new TableRow({
            children: [cell(k, { bold: true, width: 30, shading: C.headerBg }), cell(v, { width: 70 })],
        })),
        width: { size: 100, type: WidthType.PERCENTAGE },
    })
}

/**
 * AI 자동 생성 narrative 본문을 DOCX paragraph 배열로 변환.
 *
 * - 옵션 제목(bold)
 * - 본문 단락 (들여쓰기, 행간 1.45)
 * - 인용 (있을 경우, footnote 스타일)
 *
 * 별도 시각 라벨 없음 — 일반 본문처럼 자연스럽게 표시.
 * 사용자가 narrative-store의 검토·승인을 거친 record만 전달되도록 호출 측에서 필터링.
 */
export function narrativeBlock(record: {
    title?: string
    paragraphs: string[]
    citations: Array<{ url: string; title: string; retrievedAt: string }>
}): Paragraph[] {
    const out: Paragraph[] = []

    if (record.title) {
        out.push(new Paragraph({
            children: [new TextRun({ text: record.title, bold: true, size: 22, color: C.dark, font: 'Pretendard' })],
            spacing: { before: 200, after: 100 },
        }))
    }

    for (const para of record.paragraphs) {
        out.push(new Paragraph({
            children: [new TextRun({ text: para, size: 20, color: C.text, font: 'Pretendard' })],
            spacing: { before: 80, after: 80, line: 340 },
            indent: { firstLine: 280 },
        }))
    }

    if (record.citations.length > 0) {
        out.push(new Paragraph({
            children: [new TextRun({
                text: '인용 (Web search):',
                bold: true,
                size: 16,
                color: C.textLight,
                font: 'Pretendard',
            })],
            spacing: { before: 100, after: 40 },
        }))
        for (const c of record.citations) {
            out.push(new Paragraph({
                children: [new TextRun({
                    text: `• ${c.title} — ${c.url} (검색일 ${c.retrievedAt.slice(0, 10)})`,
                    size: 16,
                    color: C.textLight,
                    font: 'Pretendard',
                    italics: true,
                })],
                spacing: { before: 20, after: 20 },
                indent: { left: 200 },
            }))
        }
    }

    return out
}
