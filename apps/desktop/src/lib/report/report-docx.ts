'use client'

import {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    WidthType,
    ShadingType,
    PageBreak,
    TableOfContents,
    StyleLevel,
    Header,
    Footer,
    PageNumber,
    NumberFormat,
    Tab,
    TabStopPosition,
    TabStopType,
    ExternalHyperlink
} from 'docx'
import type { CFPReportData } from './report-template'

// ── 색상 정의 ──
const COLORS = {
    primary: '1E40AF',      // 딥 블루
    primaryLight: 'EFF6FF',  // 라이트 블루
    accent: '059669',        // 에메랄드
    accentLight: 'ECFDF5',
    dark: '0F172A',
    text: '334155',
    textLight: '64748B',
    border: 'CBD5E1',
    headerBg: 'F1F5F9',
    white: 'FFFFFF',
    warm: 'FEF3C7',
    warmDark: '92400E',
    red: 'DC2626',
    green: '16A34A',
    orange: 'EA580C',
    purple: '7C3AED',
}

// ── 유틸리티 함수 ──
function createBorderedCell(content: string | Paragraph[], options?: {
    bold?: boolean
    width?: number
    shading?: string
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]
    fontSize?: number
    color?: string
    columnSpan?: number
}): TableCell {
    const paragraphs = typeof content === 'string'
        ? [new Paragraph({
            children: [new TextRun({
                text: content,
                bold: options?.bold,
                size: options?.fontSize || 18,
                color: options?.color || COLORS.text,
                font: 'Pretendard',
            })],
            alignment: options?.alignment || AlignmentType.LEFT,
            spacing: { before: 40, after: 40 },
        })]
        : content

    return new TableCell({
        children: paragraphs,
        width: options?.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
        shading: options?.shading ? { type: ShadingType.CLEAR, fill: options.shading } : undefined,
        columnSpan: options?.columnSpan,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
            left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
            right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
        },
    })
}

function sectionTitle(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
    return new Paragraph({
        text,
        heading: level,
        spacing: { before: 300, after: 150 },
    })
}

function bodyText(text: string, options?: { bold?: boolean; italic?: boolean; color?: string; spacing?: { before?: number; after?: number } }): Paragraph {
    return new Paragraph({
        children: [new TextRun({
            text,
            bold: options?.bold,
            italics: options?.italic,
            size: 20,
            color: options?.color || COLORS.text,
            font: 'Pretendard',
        })],
        spacing: options?.spacing || { before: 60, after: 60 },
    })
}

function bulletText(text: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({
            text,
            size: 20,
            color: COLORS.text,
            font: 'Pretendard',
        })],
        bullet: { level: 0 },
        spacing: { before: 40, after: 40 },
    })
}

function emptyLine(): Paragraph {
    return new Paragraph({ text: '', spacing: { before: 100, after: 100 } })
}

// ── 표지 생성 ──
function createCoverPage(reportData: CFPReportData): Paragraph[] {
    return [
        new Paragraph({ spacing: { before: 2000 } }),
        new Paragraph({
            children: [new TextRun({
                text: '제품 탄소발자국(PCF)',
                size: 52,
                bold: true,
                color: COLORS.primary,
                font: 'Pretendard',
            })],
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
            children: [new TextRun({
                text: '산정 보고서',
                size: 52,
                bold: true,
                color: COLORS.primary,
                font: 'Pretendard',
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
        }),
        new Paragraph({
            children: [new TextRun({
                text: 'Product Carbon Footprint Assessment Report',
                size: 24,
                italics: true,
                color: COLORS.textLight,
                font: 'Pretendard',
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
        }),
        // 구분선
        new Paragraph({
            children: [new TextRun({
                text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                size: 20,
                color: COLORS.primary,
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),
        // CFP 결과 하이라이트
        new Paragraph({
            children: [new TextRun({
                text: `${reportData.results.totalCFP.toFixed(4)} ${reportData.results.unit}`,
                size: 64,
                bold: true,
                color: COLORS.accent,
                font: 'Pretendard',
            })],
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
            children: [new TextRun({
                text: `per ${reportData.product.functionalUnit}`,
                size: 22,
                color: COLORS.textLight,
                font: 'Pretendard',
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
        }),
        // 메타데이터 표
        new Table({
            rows: [
                new TableRow({
                    children: [
                        createBorderedCell('제품명', { bold: true, width: 30, shading: COLORS.headerBg }),
                        createBorderedCell(reportData.product.name, { width: 70 }),
                    ],
                }),
                new TableRow({
                    children: [
                        createBorderedCell('보고서 ID', { bold: true, width: 30, shading: COLORS.headerBg }),
                        createBorderedCell(reportData.reportId, { width: 70 }),
                    ],
                }),
                new TableRow({
                    children: [
                        createBorderedCell('작성일', { bold: true, width: 30, shading: COLORS.headerBg }),
                        createBorderedCell(reportData.reportDate, { width: 70 }),
                    ],
                }),
                new TableRow({
                    children: [
                        createBorderedCell('기준 표준', { bold: true, width: 30, shading: COLORS.headerBg }),
                        createBorderedCell(`${reportData.methodology.standard} | GWP: ${reportData.methodology.gwpSource}`, { width: 70 }),
                    ],
                }),
                new TableRow({
                    children: [
                        createBorderedCell('버전', { bold: true, width: 30, shading: COLORS.headerBg }),
                        createBorderedCell(reportData.reportVersion, { width: 70 }),
                    ],
                }),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
        }) as unknown as Paragraph,
        new Paragraph({ spacing: { before: 800 } }),
        new Paragraph({
            children: [new TextRun({
                text: 'CarbonMate Platform v2.0',
                size: 18,
                color: COLORS.textLight,
                font: 'Pretendard',
                italics: true,
            })],
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
            children: [new PageBreak()],
        }),
    ]
}

// ── 목차 페이지 ──
function createTableOfContents(): Paragraph[] {
    return [
        sectionTitle('목 차', HeadingLevel.HEADING_1),
        emptyLine(),
        new TableOfContents('목차', {
            hyperlink: true,
            headingStyleRange: '1-3',
            stylesWithLevels: [
                new StyleLevel('Heading1', 1),
                new StyleLevel('Heading2', 2),
                new StyleLevel('Heading3', 3),
            ],
        }) as unknown as Paragraph,
        new Paragraph({ children: [new PageBreak()] }),
    ]
}

// ── 결과 요약 섹션 ──
function createResultsSummary(reportData: CFPReportData): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = []

    elements.push(sectionTitle('1. 결과 요약', HeadingLevel.HEADING_1))
    elements.push(bodyText(`제품 "${reportData.product.name}"의 총 탄소발자국(CFP)은 다음과 같습니다.`))
    elements.push(emptyLine())

    // 기원별 분류 표
    elements.push(new Table({
        rows: [
            new TableRow({
                children: [
                    createBorderedCell('구분', { bold: true, shading: COLORS.primary, color: COLORS.white, width: 40 }),
                    createBorderedCell('배출량 (kg CO₂e)', { bold: true, shading: COLORS.primary, color: COLORS.white, width: 35, alignment: AlignmentType.RIGHT }),
                    createBorderedCell('비율', { bold: true, shading: COLORS.primary, color: COLORS.white, width: 25, alignment: AlignmentType.RIGHT }),
                ],
            }),
            new TableRow({
                children: [
                    createBorderedCell('화석 기원 배출', { width: 40 }),
                    createBorderedCell(reportData.results.fossilEmissions.toFixed(4), { width: 35, alignment: AlignmentType.RIGHT }),
                    createBorderedCell(
                        reportData.results.totalCFP > 0
                            ? `${((reportData.results.fossilEmissions / reportData.results.totalCFP) * 100).toFixed(1)}%`
                            : '0%',
                        { width: 25, alignment: AlignmentType.RIGHT }
                    ),
                ],
            }),
            new TableRow({
                children: [
                    createBorderedCell('생물기원 배출', { width: 40 }),
                    createBorderedCell(reportData.results.biogenicEmissions.toFixed(4), { width: 35, alignment: AlignmentType.RIGHT }),
                    createBorderedCell(
                        reportData.results.totalCFP > 0
                            ? `${((reportData.results.biogenicEmissions / reportData.results.totalCFP) * 100).toFixed(1)}%`
                            : '0%',
                        { width: 25, alignment: AlignmentType.RIGHT }
                    ),
                ],
            }),
            new TableRow({
                children: [
                    createBorderedCell('항공 운송 배출', { width: 40 }),
                    createBorderedCell(reportData.results.aircraftEmissions.toFixed(4), { width: 35, alignment: AlignmentType.RIGHT }),
                    createBorderedCell(
                        reportData.results.totalCFP > 0
                            ? `${((reportData.results.aircraftEmissions / reportData.results.totalCFP) * 100).toFixed(1)}%`
                            : '0%',
                        { width: 25, alignment: AlignmentType.RIGHT }
                    ),
                ],
            }),
            new TableRow({
                children: [
                    createBorderedCell('합계 (CFP)', { bold: true, shading: COLORS.accentLight, width: 40 }),
                    createBorderedCell(reportData.results.totalCFP.toFixed(4), { bold: true, shading: COLORS.accentLight, width: 35, alignment: AlignmentType.RIGHT }),
                    createBorderedCell('100%', { bold: true, shading: COLORS.accentLight, width: 25, alignment: AlignmentType.RIGHT }),
                ],
            }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
    }))

    elements.push(emptyLine())
    elements.push(bodyText(
        `※ 불확실성 범위: ±${reportData.results.uncertaintyPercentage.toFixed(0)}% ` +
        `(${reportData.results.uncertaintyRange.min.toFixed(4)} ~ ${reportData.results.uncertaintyRange.max.toFixed(4)} kg CO₂e)`,
        { italic: true, color: COLORS.textLight }
    ))

    // 단계별 배출량
    elements.push(sectionTitle('1.1 단계별 배출량', HeadingLevel.HEADING_2))

    const stageRows = reportData.results.stageBreakdown.map(s =>
        new TableRow({
            children: [
                createBorderedCell(s.stage, { width: 40 }),
                createBorderedCell(s.emission.toFixed(4), { width: 35, alignment: AlignmentType.RIGHT }),
                createBorderedCell(`${s.percentage.toFixed(1)}%`, { width: 25, alignment: AlignmentType.RIGHT }),
            ],
        })
    )

    elements.push(new Table({
        rows: [
            new TableRow({
                children: [
                    createBorderedCell('단계', { bold: true, shading: COLORS.primary, color: COLORS.white, width: 40 }),
                    createBorderedCell('배출량 (kg CO₂e)', { bold: true, shading: COLORS.primary, color: COLORS.white, width: 35, alignment: AlignmentType.RIGHT }),
                    createBorderedCell('비율', { bold: true, shading: COLORS.primary, color: COLORS.white, width: 25, alignment: AlignmentType.RIGHT }),
                ],
            }),
            ...stageRows,
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
    }))

    // GHG별 분해
    if (reportData.results.ghgBreakdown && Object.keys(reportData.results.ghgBreakdown).length > 0) {
        elements.push(sectionTitle('1.2 온실가스별 배출량 분해 (ISO 14067 7.3 e)', HeadingLevel.HEADING_2))

        const ghgEntries = Object.entries(reportData.results.ghgBreakdown)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .filter(([, val]) => Math.abs(val) > 0.000001)

        const ghgRows = ghgEntries.map(([ghg, val]) => {
            const pct = reportData.results.totalCFP > 0 ? (val / reportData.results.totalCFP) * 100 : 0
            const label = ghg
                .replace('co2_fossil', 'CO₂ (화석)')
                .replace('co2_biogenic', 'CO₂ (생물기원)')
                .replace('ch4', 'CH₄').replace('n2o', 'N₂O')
                .replace('hfcs', 'HFCs').replace('other', '기타 GHG')
            return new TableRow({
                children: [
                    createBorderedCell(label, { width: 40 }),
                    createBorderedCell(val.toFixed(6), { width: 35, alignment: AlignmentType.RIGHT }),
                    createBorderedCell(`${pct.toFixed(1)}%`, { width: 25, alignment: AlignmentType.RIGHT }),
                ],
            })
        })

        elements.push(new Table({
            rows: [
                new TableRow({
                    children: [
                        createBorderedCell('온실가스', { bold: true, shading: COLORS.purple, color: COLORS.white, width: 40 }),
                        createBorderedCell('배출량 (kg CO₂e)', { bold: true, shading: COLORS.purple, color: COLORS.white, width: 35, alignment: AlignmentType.RIGHT }),
                        createBorderedCell('비율', { bold: true, shading: COLORS.purple, color: COLORS.white, width: 25, alignment: AlignmentType.RIGHT }),
                    ],
                }),
                ...ghgRows,
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
        }))
    }

    return elements
}

// ── 제품 정보 섹션 ──
function createProductSection(reportData: CFPReportData): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = []

    elements.push(sectionTitle('2. 제품 정보', HeadingLevel.HEADING_1))

    const rows = [
        ['제품명', reportData.product.name],
        ['제품 카테고리', reportData.product.category],
        ['기능 단위', reportData.product.functionalUnit],
    ]
    if (reportData.product.manufacturer) rows.push(['제조사', reportData.product.manufacturer])
    if (reportData.product.description) rows.push(['제품 설명', reportData.product.description])

    elements.push(new Table({
        rows: rows.map(([label, value]) =>
            new TableRow({
                children: [
                    createBorderedCell(label, { bold: true, width: 30, shading: COLORS.headerBg }),
                    createBorderedCell(value, { width: 70 }),
                ],
            })
        ),
        width: { size: 100, type: WidthType.PERCENTAGE },
    }))

    return elements
}

// ── 연구 범위 섹션 ──
function createScopeSection(reportData: CFPReportData): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = []

    elements.push(sectionTitle('3. 연구 범위', HeadingLevel.HEADING_1))

    elements.push(new Table({
        rows: [
            new TableRow({
                children: [
                    createBorderedCell('시스템 경계', { bold: true, width: 30, shading: COLORS.headerBg }),
                    createBorderedCell(reportData.scope.systemBoundary, { width: 70 }),
                ],
            }),
            new TableRow({
                children: [
                    createBorderedCell('포함 단계', { bold: true, width: 30, shading: COLORS.headerBg }),
                    createBorderedCell(reportData.scope.lifecycleStages.join(', '), { width: 70 }),
                ],
            }),
            ...(reportData.scope.cutOffCriteria ? [new TableRow({
                children: [
                    createBorderedCell('Cut-off 기준', { bold: true, width: 30, shading: COLORS.headerBg }),
                    createBorderedCell(reportData.scope.cutOffCriteria, { width: 70 }),
                ],
            })] : []),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
    }))

    // 연구 목표 (있는 경우)
    if (reportData.scope.studyGoal) {
        elements.push(sectionTitle('3.1 CFP 연구 목표 (ISO 14067 6.3.1)', HeadingLevel.HEADING_2))
        elements.push(bulletText(`적용 목적: ${reportData.scope.studyGoal.applicationPurpose}`))
        elements.push(bulletText(`연구 이유: ${reportData.scope.studyGoal.reasonForStudy}`))
        elements.push(bulletText(`대상 독자: ${reportData.scope.studyGoal.targetAudience}`))
    }

    return elements
}

// ── 방법론 섹션 ──
function createMethodologySection(reportData: CFPReportData): (Paragraph | Table)[] {
    const elements: (Paragraph | Table)[] = []

    elements.push(sectionTitle('4. 방법론', HeadingLevel.HEADING_1))

    elements.push(new Table({
        rows: [
            new TableRow({
                children: [
                    createBorderedCell('기준 표준', { bold: true, width: 30, shading: COLORS.headerBg }),
                    createBorderedCell(reportData.methodology.standard, { width: 70 }),
                ],
            }),
            new TableRow({
                children: [
                    createBorderedCell('GWP 출처', { bold: true, width: 30, shading: COLORS.headerBg }),
                    createBorderedCell(`${reportData.methodology.gwpSource} (${reportData.methodology.gwpTimeHorizon})`, { width: 70 }),
                ],
            }),
            new TableRow({
                children: [
                    createBorderedCell('할당 방법', { bold: true, width: 30, shading: COLORS.headerBg }),
                    createBorderedCell(reportData.methodology.allocationMethod, { width: 70 }),
                ],
            }),
            new TableRow({
                children: [
                    createBorderedCell('재활용 할당', { bold: true, width: 30, shading: COLORS.headerBg }),
                    createBorderedCell(reportData.methodology.recyclingAllocationMethod, { width: 70 }),
                ],
            }),
            new TableRow({
                children: [
                    createBorderedCell('데이터 품질', { bold: true, width: 30, shading: COLORS.headerBg }),
                    createBorderedCell(reportData.methodology.dataQualityAssessment, { width: 70 }),
                ],
            }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
    }))

    // GHG 목록
    elements.push(sectionTitle('4.1 고려된 온실가스', HeadingLevel.HEADING_2))

    elements.push(new Table({
        rows: [
            new TableRow({
                children: [
                    createBorderedCell('화학식', { bold: true, shading: COLORS.primary, color: COLORS.white, width: 25 }),
                    createBorderedCell('명칭', { bold: true, shading: COLORS.primary, color: COLORS.white, width: 50 }),
                    createBorderedCell('GWP₁₀₀', { bold: true, shading: COLORS.primary, color: COLORS.white, width: 25, alignment: AlignmentType.RIGHT }),
                ],
            }),
            ...reportData.methodology.ghgList.map(g =>
                new TableRow({
                    children: [
                        createBorderedCell(g.formula, { width: 25 }),
                        createBorderedCell(g.name, { width: 50 }),
                        createBorderedCell(g.gwp.toString(), { width: 25, alignment: AlignmentType.RIGHT }),
                    ],
                })
            ),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
    }))

    // 배출계수 출처
    if (reportData.methodology.emissionFactorSources.length > 0) {
        elements.push(sectionTitle('4.2 배출계수 출처', HeadingLevel.HEADING_2))
        reportData.methodology.emissionFactorSources.forEach(src => {
            elements.push(bulletText(`${src.name} (${src.year}) — ${src.region}`))
        })
    }

    return elements
}

// ── 제한사항 섹션 ──
function createLimitationsSection(reportData: CFPReportData): Paragraph[] {
    const elements: Paragraph[] = []

    elements.push(sectionTitle('5. 제한사항 및 가정', HeadingLevel.HEADING_1))

    elements.push(bodyText(reportData.limitations.singleImpact, { italic: true, color: COLORS.textLight }))
    elements.push(emptyLine())

    if (reportData.limitations.methodologyLimitations.length > 0) {
        elements.push(sectionTitle('5.1 방법론적 제한사항', HeadingLevel.HEADING_2))
        reportData.limitations.methodologyLimitations.forEach(l => {
            elements.push(bulletText(l))
        })
    }

    if (reportData.limitations.assumptions.length > 0) {
        elements.push(sectionTitle('5.2 가정사항', HeadingLevel.HEADING_2))
        reportData.limitations.assumptions.forEach(a => {
            elements.push(bulletText(a))
        })
    }

    return elements
}

// ── 결론 섹션 ──
function createConclusionsSection(reportData: CFPReportData): Paragraph[] {
    const elements: Paragraph[] = []

    if (reportData.conclusions) {
        elements.push(sectionTitle('6. 결론 및 권고사항', HeadingLevel.HEADING_1))

        if (reportData.conclusions.keyFindings?.length) {
            elements.push(sectionTitle('6.1 주요 발견사항', HeadingLevel.HEADING_2))
            reportData.conclusions.keyFindings.forEach(f => {
                elements.push(bulletText(f))
            })
        }

        if (reportData.conclusions.recommendations?.length) {
            elements.push(sectionTitle('6.2 권고사항', HeadingLevel.HEADING_2))
            reportData.conclusions.recommendations.forEach(r => {
                elements.push(bulletText(r))
            })
        }

        if (reportData.conclusions.improvementOpportunities?.length) {
            elements.push(sectionTitle('6.3 개선 기회', HeadingLevel.HEADING_2))
            reportData.conclusions.improvementOpportunities.forEach(o => {
                elements.push(bulletText(o))
            })
        }
    }

    return elements
}

// ── 메인 생성 함수 ──
export async function generateWordReport(reportData: CFPReportData): Promise<Blob> {
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: 'Pretendard',
                        size: 20,
                        color: COLORS.text,
                    },
                    paragraph: {
                        spacing: { line: 300 },
                    },
                },
                heading1: {
                    run: {
                        font: 'Pretendard',
                        size: 32,
                        bold: true,
                        color: COLORS.primary,
                    },
                    paragraph: {
                        spacing: { before: 400, after: 200, line: 360 },
                    },
                },
                heading2: {
                    run: {
                        font: 'Pretendard',
                        size: 26,
                        bold: true,
                        color: COLORS.dark,
                    },
                    paragraph: {
                        spacing: { before: 300, after: 150, line: 340 },
                    },
                },
                heading3: {
                    run: {
                        font: 'Pretendard',
                        size: 22,
                        bold: true,
                        color: COLORS.text,
                    },
                    paragraph: {
                        spacing: { before: 200, after: 100, line: 320 },
                    },
                },
            },
        },
        features: {
            updateFields: true,
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1440,    // 1 inch
                            bottom: 1440,
                            left: 1440,
                            right: 1440,
                        },
                        pageNumbers: {
                            start: 1,
                            formatType: NumberFormat.DECIMAL,
                        },
                    },
                },
                headers: {
                    default: new Header({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: `CFP 보고서 — ${reportData.product.name}`,
                                        size: 16,
                                        color: COLORS.textLight,
                                        font: 'Pretendard',
                                        italics: true,
                                    }),
                                ],
                                alignment: AlignmentType.RIGHT,
                            }),
                        ],
                    }),
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: `${reportData.methodology.standard} | CarbonMate Platform v2.0    `,
                                        size: 14,
                                        color: COLORS.textLight,
                                        font: 'Pretendard',
                                    }),
                                    new TextRun({
                                        children: ['— ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES, ' —'],
                                        size: 14,
                                        color: COLORS.textLight,
                                        font: 'Pretendard',
                                    }),
                                ],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                    }),
                },
                children: [
                    // 표지
                    ...createCoverPage(reportData),
                    // 목차
                    ...createTableOfContents(),
                    // 본문
                    ...(createResultsSummary(reportData) as Paragraph[]),
                    new Paragraph({ children: [new PageBreak()] }),
                    ...(createProductSection(reportData) as Paragraph[]),
                    ...(createScopeSection(reportData) as Paragraph[]),
                    new Paragraph({ children: [new PageBreak()] }),
                    ...(createMethodologySection(reportData) as Paragraph[]),
                    new Paragraph({ children: [new PageBreak()] }),
                    ...createLimitationsSection(reportData),
                    ...createConclusionsSection(reportData),
                    // 끝
                    new Paragraph({ spacing: { before: 600 } }),
                    new Paragraph({
                        children: [new TextRun({
                            text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                            size: 20,
                            color: COLORS.border,
                        })],
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        children: [new TextRun({
                            text: '본 보고서는 CarbonMate Platform v2.0에서 자동 생성되었습니다.',
                            size: 16,
                            color: COLORS.textLight,
                            font: 'Pretendard',
                            italics: true,
                        })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 100 },
                    }),
                    new Paragraph({
                        children: [new TextRun({
                            text: `보고서 ID: ${reportData.reportId} | 버전: ${reportData.reportVersion}`,
                            size: 16,
                            color: COLORS.textLight,
                            font: 'Pretendard',
                        })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 40 },
                    }),
                ],
            },
        ],
    })

    return await Packer.toBlob(doc)
}
