'use client'

import {
    Paragraph, Table, TableRow, TableCell, TextRun,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak,
} from 'docx'

export const C = {
    primary: '0F766E', primaryLight: 'F0FDFA', accent: '059669', accentLight: 'ECFDF5',
    dark: '0F172A', text: '334155', textLight: '64748B', border: 'CBD5E1',
    headerBg: 'F1F5F9', white: 'FFFFFF', purple: '7C3AED', purpleLight: 'F5F3FF', warm: 'FEF3C7',
    // KPI 그리드 색상 (sample-improved-report-v2 톤)
    kpiBg: '0F766E', kpiText: 'FFFFFF', kpiSubtle: 'D1FAE5',
    // narrative 좌측 보더 색
    narrativeBorder: '7C3AED', narrativeBg: 'FAF5FF',
    // 모듈 그리드 색
    moduleIncluded: 'ECFDF5', moduleIncludedBorder: '059669',
    moduleExcluded: 'F8FAFC', moduleExcludedBorder: '94A3B8',
    // 별첨 안내 (amber tone)
    attachmentBg: 'CA8A04', attachmentBgLight: 'FEFCE8',
    // 면책/경고 박스 (sample-v2 warn 톤)
    warnBg: 'FEF3C7', warnBorder: 'F59E0B', warnText: '78350F',
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
            children: [new TextRun({ text: content, bold: opts?.bold, size: opts?.fontSize || 18, color: opts?.color || C.text, font: '맑은 고딕' })],
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
    return new Paragraph({ heading: level, children: [new TextRun({ text, font: '맑은 고딕' })], spacing: { before: 300, after: 150 } })
}

export function p(text: string, opts?: { bold?: boolean; italic?: boolean; color?: string }): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text, bold: opts?.bold, italics: opts?.italic, color: opts?.color || C.text, size: 20, font: '맑은 고딕' })],
        spacing: { before: 60, after: 60 },
    })
}

export function bullet(text: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text: `• ${text}`, size: 18, color: C.text, font: '맑은 고딕' })],
        spacing: { before: 30, after: 30 }, indent: { left: 360 },
    })
}

export function note(text: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text: `ℹ️ ${text}`, size: 18, color: C.textLight, font: '맑은 고딕', italics: true })],
        spacing: { before: 60, after: 60 }, indent: { left: 200 },
    })
}

export function todo(text: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text: `[작성 필요] ${text}`, size: 18, color: 'B91C1C', font: '맑은 고딕', bold: true })],
        spacing: { before: 60, after: 60 },
    })
}

export const empty = (): Paragraph => new Paragraph({ spacing: { before: 0, after: 0 } })
export const pb = (): Paragraph => new Paragraph({ children: [new PageBreak()] })

export function makeTable(
    headers: string[],
    rows: string[][],
    headerColor = C.primary,
    options: { hlRows?: number[]; hlBg?: string } = {},
): Table {
    const colW = Math.floor(100 / headers.length)
    const hlRows = options.hlRows ?? []
    const hlBg = options.hlBg ?? C.warm
    return new Table({
        rows: [
            new TableRow({
                children: headers.map(hdr => cell(hdr, { bold: true, shading: headerColor, color: C.white, width: colW, align: AlignmentType.CENTER })),
            }),
            ...rows.map((r, ri) => new TableRow({
                children: r.map((v, i) => cell(v, {
                    width: colW,
                    align: i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT,
                    ...(hlRows.includes(ri) ? { shading: hlBg } : {}),
                })),
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
 * AI 자동 생성 narrative 본문을 DOCX 1-cell 표로 wrapping.
 *
 * 시각 디자인:
 *   - 좌측에 보라색 굵은 보더 (sample-improved-report-v2 스타일)
 *   - 연한 보라색 배경
 *   - 옵션 제목 (bold) + 본문 단락 + 인용 (있을 경우)
 *
 * 사용자가 narrative-store의 검토·승인을 거친 record만 전달되도록 호출 측에서 필터링.
 */
export function narrativeBlock(record: {
    title?: string
    paragraphs: string[]
    citations: Array<{ url: string; title: string; retrievedAt: string }>
}): (Paragraph | Table)[] {
    const innerParagraphs: Paragraph[] = []

    if (record.title) {
        innerParagraphs.push(new Paragraph({
            children: [new TextRun({ text: record.title, bold: true, size: 22, color: C.dark, font: '맑은 고딕' })],
            spacing: { before: 80, after: 80 },
        }))
    }

    for (const para of record.paragraphs) {
        innerParagraphs.push(new Paragraph({
            children: [new TextRun({ text: para, size: 20, color: C.text, font: '맑은 고딕' })],
            spacing: { before: 60, after: 60, line: 340 },
            indent: { firstLine: 240 },
        }))
    }

    if (record.citations.length > 0) {
        innerParagraphs.push(new Paragraph({
            children: [new TextRun({
                text: '인용 (Web search):',
                bold: true,
                size: 16,
                color: C.textLight,
                font: '맑은 고딕',
            })],
            spacing: { before: 100, after: 40 },
        }))
        for (const c of record.citations) {
            innerParagraphs.push(new Paragraph({
                children: [new TextRun({
                    text: `• ${c.title} — ${c.url} (검색일 ${c.retrievedAt.slice(0, 10)})`,
                    size: 16,
                    color: C.textLight,
                    font: '맑은 고딕',
                    italics: true,
                })],
                spacing: { before: 20, after: 20 },
                indent: { left: 200 },
            }))
        }
    }

    // 좌측 보라색 보더 + 연한 보라색 배경
    const wrappedCell = new TableCell({
        children: innerParagraphs,
        shading: { type: ShadingType.CLEAR, fill: C.narrativeBg },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: C.narrativeBg },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: C.narrativeBg },
            right: { style: BorderStyle.SINGLE, size: 1, color: C.narrativeBg },
            left: { style: BorderStyle.SINGLE, size: 24, color: C.narrativeBorder }, // 굵은 보라 좌측 보더
        },
        width: { size: 100, type: WidthType.PERCENTAGE },
    })

    const wrapTable = new Table({
        rows: [new TableRow({ children: [wrappedCell] })],
        width: { size: 100, type: WidthType.PERCENTAGE },
    })

    return [
        new Paragraph({ spacing: { before: 120 } }),
        wrapTable,
        new Paragraph({ spacing: { after: 120 } }),
    ]
}

/**
 * 표지 KPI 4-그리드 — 2-row 구조 (sample-improved-report-v2 + 사용자 스크린샷 스타일).
 *
 * Row 1 (헤더): emerald 배경 + 흰 작은 라벨
 * Row 2 (본문): 흰 배경 + 큰 검은 값 + 작은 회색 보조설명
 */
export function kpiGrid(boxes: Array<{ label: string; value: string; sub?: string }>): Table {
    const colW = Math.floor(100 / boxes.length)
    const transparentBorder = (color: string) => ({ style: BorderStyle.SINGLE, size: 4, color })

    return new Table({
        rows: [
            // Row 1: 헤더 (emerald)
            new TableRow({
                children: boxes.map(b => new TableCell({
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 100, after: 100 },
                        children: [new TextRun({
                            text: b.label,
                            bold: true, size: 18, color: C.white, font: '맑은 고딕',
                        })],
                    })],
                    shading: { type: ShadingType.CLEAR, fill: C.kpiBg },
                    width: { size: colW, type: WidthType.PERCENTAGE },
                    borders: {
                        top: transparentBorder(C.kpiBg),
                        bottom: transparentBorder(C.kpiBg),
                        left: { style: BorderStyle.SINGLE, size: 8, color: C.white },
                        right: { style: BorderStyle.SINGLE, size: 8, color: C.white },
                    },
                })),
            }),
            // Row 2: 본문 (흰 배경 + 큰 값 + 작은 회색 보조)
            new TableRow({
                children: boxes.map(b => new TableCell({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 200, after: 100 },
                            children: [new TextRun({
                                text: b.value,
                                bold: true, size: 36, color: C.dark, font: '맑은 고딕',
                            })],
                        }),
                        ...(b.sub ? [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 100, after: 200 },
                            children: [new TextRun({
                                text: b.sub,
                                size: 16, color: C.textLight, font: '맑은 고딕',
                            })],
                        })] : []),
                    ],
                    shading: { type: ShadingType.CLEAR, fill: C.white },
                    width: { size: colW, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: C.border },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: C.border },
                        left: { style: BorderStyle.SINGLE, size: 1, color: C.border },
                        right: { style: BorderStyle.SINGLE, size: 1, color: C.border },
                    },
                })),
            }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
    })
}

/**
 * 표지 Pill 라인 — 표준·범위·일자·버전 등 메타 정보를 가로 구분자로 표시.
 * sample-improved-report-v2 표지 상단 스타일.
 */
export function pillLine(items: string[]): Paragraph {
    const children: TextRun[] = []
    items.forEach((it, i) => {
        if (i > 0) children.push(new TextRun({ text: '   ·   ', size: 20, color: C.textLight, font: '맑은 고딕' }))
        children.push(new TextRun({ text: it, size: 20, bold: true, color: C.primary, font: '맑은 고딕' }))
    })
    return new Paragraph({
        children,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
    })
}

/**
 * 부록의 별첨 자료 안내 3-cell 그리드 (헤더 amber + 본문 cream).
 * sample-improved-report-v2 부속 A 스타일.
 */
export function attachmentGrid(items: Array<{ icon?: string; title: string; description: string }>): Table {
    const colW = Math.floor(100 / items.length)
    return new Table({
        rows: [
            // 헤더 행 (amber)
            new TableRow({
                children: items.map(it => new TableCell({
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({
                            text: `${it.icon ?? ''} ${it.title}`,
                            bold: true, size: 20, color: C.white, font: '맑은 고딕',
                        })],
                        spacing: { before: 80, after: 80 },
                    })],
                    shading: { type: ShadingType.CLEAR, fill: C.attachmentBg },
                    width: { size: colW, type: WidthType.PERCENTAGE },
                })),
            }),
            // 본문 행 (cream)
            new TableRow({
                children: items.map(it => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({
                            text: it.description,
                            size: 18, color: C.text, font: '맑은 고딕',
                        })],
                        spacing: { before: 100, after: 100, line: 320 },
                    })],
                    shading: { type: ShadingType.CLEAR, fill: C.attachmentBgLight },
                    width: { size: colW, type: WidthType.PERCENTAGE },
                })),
            }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
    })
}

/**
 * 표지 Practitioner / Commissioner / Reviewer 3-셀 박스.
 * sample-improved-report-v2 표지 하단 (작성·의뢰·검토 정보).
 */
export function partyBoxes(parties: Array<{ role: string; name: string; meta?: string }>): Table {
    const colW = Math.floor(100 / parties.length)
    return new Table({
        rows: [
            // 헤더 (다크 teal)
            new TableRow({
                children: parties.map(p => new TableCell({
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({
                            text: p.role.toUpperCase(),
                            bold: true, size: 16, color: C.white, font: '맑은 고딕',
                        })],
                        spacing: { before: 60, after: 60 },
                    })],
                    shading: { type: ShadingType.CLEAR, fill: '134E4A' },
                    width: { size: colW, type: WidthType.PERCENTAGE },
                })),
            }),
            // 본문
            new TableRow({
                children: parties.map(p => new TableCell({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({
                                text: p.name, bold: true, size: 22, color: C.dark, font: '맑은 고딕',
                            })],
                            spacing: { before: 80, after: 40 },
                        }),
                        ...(p.meta ? [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({
                                text: p.meta, size: 16, color: C.textLight, font: '맑은 고딕',
                            })],
                            spacing: { before: 20, after: 80, line: 280 },
                        })] : []),
                    ],
                    shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
                    width: { size: colW, type: WidthType.PERCENTAGE },
                })),
            }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
    })
}

/**
 * 공정 흐름도 — 박스 + 화살표 시각화 (sample-improved-report-v2 §2.3 스타일).
 * 단계 박스(input/process/output) 1행 표.
 */
export function flowDiagram(steps: Array<{
    label: string
    sub?: string
    kind?: 'input' | 'process' | 'output'
}>): Table {
    // steps 사이에 화살표 cell 끼워넣기
    const allCells: TableCell[] = []
    steps.forEach((step, i) => {
        if (i > 0) {
            // 화살표 cell
            allCells.push(new TableCell({
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: '→', size: 28, bold: true, color: C.primary, font: '맑은 고딕' })],
                })],
                width: { size: 4, type: WidthType.PERCENTAGE },
                borders: noBorders(),
            }))
        }
        const palette: Record<NonNullable<typeof step.kind>, { bg: string; fg: string; border: string }> = {
            input: { bg: 'FFFBEB', fg: '78350F', border: 'F59E0B' },
            output: { bg: 'DBEAFE', fg: '1E3A8A', border: '3B82F6' },
            process: { bg: 'F0FDFA', fg: '134E4A', border: '14B8A6' },
        }
        const kind = step.kind ?? 'process'
        const pal = palette[kind]
        allCells.push(new TableCell({
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: step.label, bold: true, size: 16, color: pal.fg, font: '맑은 고딕' })],
                    spacing: { before: 80, after: 20 },
                }),
                ...(step.sub ? [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: step.sub, size: 14, color: pal.fg, font: '맑은 고딕' })],
                    spacing: { before: 0, after: 80 },
                })] : []),
            ],
            shading: { type: ShadingType.CLEAR, fill: pal.bg },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: pal.border },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: pal.border },
                left: { style: BorderStyle.SINGLE, size: 8, color: pal.border },
                right: { style: BorderStyle.SINGLE, size: 8, color: pal.border },
            },
        }))
    })
    return new Table({
        rows: [new TableRow({ children: allCells })],
        width: { size: 100, type: WidthType.PERCENTAGE },
    })
}

function noBorders() {
    return {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    }
}

/**
 * 제품 이미지 placeholder — 회색 빈 박스 (자동 삽입 슬롯).
 * sample-improved-report-v2 표지 스타일.
 */
export function imagePlaceholder(label = '[ 제품 이미지 placeholder · 자동 삽입 슬롯 ]'): Table {
    return new Table({
        rows: [new TableRow({
            children: [new TableCell({
                children: [
                    new Paragraph({ spacing: { before: 600 } }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({
                            text: label,
                            size: 18, italics: true, color: C.textLight, font: '맑은 고딕',
                        })],
                        spacing: { before: 0, after: 0 },
                    }),
                    new Paragraph({ spacing: { after: 600 } }),
                ],
                shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                borders: {
                    top: { style: BorderStyle.DASHED, size: 8, color: '94A3B8' },
                    bottom: { style: BorderStyle.DASHED, size: 8, color: '94A3B8' },
                    left: { style: BorderStyle.DASHED, size: 8, color: '94A3B8' },
                    right: { style: BorderStyle.DASHED, size: 8, color: '94A3B8' },
                },
                width: { size: 100, type: WidthType.PERCENTAGE },
            })],
        })],
        width: { size: 100, type: WidthType.PERCENTAGE },
    })
}

/**
 * Upstream / Core / Downstream 3-컬럼 모듈 그리드.
 * sample-improved-report-v2의 시스템경계 §2.4 모듈과 동일 구조.
 */
export function moduleGrid(modules: Array<{
    title: string
    items: string[]
    included: boolean
}>): Table {
    const colW = Math.floor(100 / modules.length)
    return new Table({
        rows: [new TableRow({
            children: modules.map(m => {
                const bgColor = m.included ? C.moduleIncluded : C.moduleExcluded
                const borderColor = m.included ? C.moduleIncludedBorder : C.moduleExcludedBorder
                const titleColor = m.included ? C.moduleIncludedBorder : C.textLight
                return new TableCell({
                    children: [
                        new Paragraph({
                            spacing: { before: 100, after: 80 },
                            children: [new TextRun({
                                text: m.title,
                                bold: true, size: 20, color: titleColor, font: '맑은 고딕',
                            })],
                        }),
                        ...m.items.map(item => new Paragraph({
                            spacing: { before: 30, after: 30 },
                            indent: { left: 200 },
                            children: [new TextRun({
                                text: `• ${item}`,
                                size: 16, color: C.text, font: '맑은 고딕',
                            })],
                        })),
                        new Paragraph({ spacing: { after: 80 } }),
                    ],
                    shading: { type: ShadingType.CLEAR, fill: bgColor },
                    width: { size: colW, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
                        left: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
                        right: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
                    },
                })
            }),
        })],
        width: { size: 100, type: WidthType.PERCENTAGE },
    })
}
