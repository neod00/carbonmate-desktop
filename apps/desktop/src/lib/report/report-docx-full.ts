'use client'

import {
    Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
    HeadingLevel, AlignmentType, TableOfContents, StyleLevel,
    Header, Footer, PageNumber, NumberFormat,
    BorderStyle, WidthType,
} from 'docx'
import type { PCFState } from '@/lib/core/store'
import type { TotalEmissionResult } from '@/lib/core/emission-calculator'
import { GHG_LIST, EMISSION_FACTOR_SOURCES, METHODOLOGY_LIMITATIONS, CHARACTERIZATION_MODEL_LABELS } from '@/lib/iso14067-constants'
import { MULTI_OUTPUT_ALLOCATION_METHODS, RECYCLING_ALLOCATION_METHODS } from '@/lib/allocation'
import { analyzeUnitProcesses } from '@/lib/report/unit-process-mapper'
import { computeMaterialBalance } from '@/lib/report/material-balance'
import type { NarrativeRecord, NarrativeSlot } from '@lca/shared'
import {
    C, STAGE_LABELS, BOUNDARY_LABELS, REPORT_TYPE_LABELS, REVIEW_TYPE_LABELS,
    cell, h, p, bullet, note, todo, empty, pb, makeTable, kvTable, narrativeBlock,
    kpiGrid, moduleGrid, pillLine, attachmentGrid, partyBoxes, flowDiagram, imagePlaceholder,
} from './report-docx-helpers'

type El = Paragraph | Table

/** 보고서 표지·헤더에 표시되는 앱 버전 (Vite env 또는 fallback) */
const APP_VERSION =
    (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION) ||
    '0.3.0'

/**
 * 6개 슬롯의 narrative record. 각 슬롯에 record가 있고 approved=true인 경우에만 본문에 삽입.
 * undefined slot은 무시됨.
 */
export type NarrativeBundle = Partial<Record<NarrativeSlot, NarrativeRecord>>

/** 보고서 생성 옵션 */
export interface FullReportOptions {
    /** narrative-store에서 가져온 6개 슬롯 record. 미승인 record는 호출 측에서 필터링 권장. */
    narratives?: NarrativeBundle
}

/** 승인된 record만 반환하는 helper */
function approvedNarrative(
    narratives: NarrativeBundle | undefined,
    slot: NarrativeSlot
): NarrativeRecord | null {
    const r = narratives?.[slot]
    return r && r.approved ? r : null
}

/** 단계별 일반 설명 (단계 4컬럼 표용) */
const STAGE_DESCRIPTIONS: Record<string, { description: string; inputs: string; outputs: string }> = {
    raw_materials: { description: '제품 생산에 사용되는 원료 채취 · 가공', inputs: 'BOM 원료, 보조 화학물질', outputs: '중간 원료 · 보조 폐기물' },
    manufacturing: { description: '자사 제조 공정 (가공 · 정제 · 결정화 등)', inputs: '전력 · 스팀 · 연료 · 용수', outputs: '제품 · 폐수 · 폐기물' },
    transport: { description: '원료 입고 및 제품 출하 운송', inputs: '디젤 · 운송 거리', outputs: '운송 GHG · 입출고 화물' },
    packaging: { description: '제품 포장재 생산 · 사용', inputs: '포장재(PE/PP/판지 등)', outputs: '포장 완료 제품' },
    use: { description: '소비자 사용 단계 (가능 시)', inputs: '사용 에너지', outputs: '사용 GHG' },
    eol: { description: '폐기 단계 (재활용/매립/소각)', inputs: '폐제품 · 처리 에너지', outputs: 'EoL GHG · 회수 자원' },
}

function buildStageRow(stageId: string, _state: PCFState): string[] {
    const label = STAGE_LABELS[stageId] || stageId
    const meta = STAGE_DESCRIPTIONS[stageId]
    if (!meta) return [label, '—', '—', '—']
    return [label, meta.description, meta.inputs, meta.outputs]
}

/** 형식 개선 #4 — 데이터 대표성 행 빌더 */
function buildRepresentativenessRows(state: PCFState): string[][] {
    const tb = state.productInfo.timeBoundary
    const timeRange = tb && tb.dataCollectionStart && tb.dataCollectionEnd
        ? `${tb.dataCollectionStart} ~ ${tb.dataCollectionEnd}`
        : '[작성 필요]'
    const geo = state.reportMeta?.geographicScope || '한국 (KR)'
    const tech = state.reportMeta?.technologicalScope || '[작성 필요]'
    const dqType = state.dataQualityMeta?.overallType
    const dqLabel = dqType === 'primary' ? '1차 데이터' : dqType === 'secondary' ? '2차 데이터' : '추정 데이터'

    const rows: string[][] = [
        ['제조 (Core)', timeRange, geo, tech, '1차 (사업장 계량값)'],
        ['원료 Upstream', `${EMISSION_FACTOR_SOURCES.ecoinvent?.year ?? '2023'} (Ecoinvent)`, 'GLO / RoW', '산업 평균', '2차 (Ecoinvent v3.12)'],
        ['전력', `${EMISSION_FACTOR_SOURCES.korea_lci.year} (한국환경공단)`, '한국 (KR)', '국가 grid 평균', '2차 (배출계수)'],
        ['운송', timeRange, '실제 구간', '디젤 EURO 6 (RoW)', '1차 (거리) + 2차 (EF)'],
        ['포장', timeRange, '국내', '제품 사양', '1차 (사양) + 2차 (EF)'],
        ['종합', '—', '—', '—', dqLabel],
    ]
    return rows
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  표지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCover(state: PCFState, result: TotalEmissionResult): El[] {
    const cfp = result.allocation?.applied ? result.allocation.allocatedTotal : result.totalEmission
    const charLabel = CHARACTERIZATION_MODEL_LABELS[state.characterizationModel || 'AR6']
    const meta = state.reportMeta
    const isIntermediate = state.productInfo.boundary === 'cradle-to-gate'
    const unitLabel = isIntermediate ? '선언단위' : '기능단위'
    const uncertainty = result.avgUncertainty || 0
    const reviewStatus = state.reviewInfo?.reviewType && state.reviewInfo.reviewType !== 'none' ? '검토 완료' : '미검증'
    const today = new Date().toISOString().slice(0, 10)
    const reportNumber = meta?.reportNumber || `CM-PCF-${new Date().getFullYear()}-001`

    return [
        new Paragraph({ spacing: { before: 800 } }),

        // Pill 라인 — 표준·범위·일자·버전
        pillLine([
            'ISO 14067:2018',
            BOUNDARY_LABELS[state.productInfo.boundary]?.split(' (')[0] || state.productInfo.boundary,
            today,
            'v1.0',
        ]),

        // 제목 (sample-v2 표준 28pt → docx 56)
        new Paragraph({
            children: [new TextRun({ text: '제품 탄소발자국(CFP) 산정 보고서', size: 56, bold: true, color: C.primary, font: '맑은 고딕' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
        }),
        // 부제 — 제품명 (16pt → 32)
        new Paragraph({
            children: [new TextRun({ text: state.productInfo.name || '제품명 미지정', size: 32, italics: true, color: C.textLight, font: '맑은 고딕' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),

        // 제품 이미지 placeholder
        imagePlaceholder() as unknown as Paragraph,

        new Paragraph({ spacing: { before: 400 } }),

        // KPI 4-그리드
        kpiGrid([
            { label: '총 CFP', value: cfp.toFixed(2), sub: `kg CO₂e / ${unitLabel}${uncertainty > 0 ? ` (±${uncertainty.toFixed(0)}%)` : ''}` },
            { label: unitLabel, value: state.productInfo.unit || '—', sub: state.productInfo.name?.slice(0, 20) || '제품' },
            { label: '시스템 경계', value: isIntermediate ? 'C-to-Gate' : (state.productInfo.boundary === 'cradle-to-grave' ? 'C-to-Grave' : 'G-to-Gate'), sub: BOUNDARY_LABELS[state.productInfo.boundary]?.split(' (')[0] || '—' },
            { label: '검증 상태', value: reviewStatus, sub: reviewStatus === '미검증' ? 'ISO 14067 7.4 권장' : '검증 보고서 첨부' },
        ]) as unknown as Paragraph,

        new Paragraph({ spacing: { before: 400 } }),

        // SW/DB 박스 강조 헤딩
        new Paragraph({
            children: [new TextRun({ text: '⚙ 소프트웨어 · LCI Database · LCIA 방법', size: 22, bold: true, color: C.primary, font: '맑은 고딕' })],
            spacing: { before: 200, after: 100 },
            shading: { type: 'clear' as const, color: 'auto', fill: C.primaryLight },
        }),
        kvTable([
            ['소프트웨어', `CarbonMate Platform v${APP_VERSION}`],
            ['LCI 데이터베이스', `${EMISSION_FACTOR_SOURCES.korea_lci.name} (${EMISSION_FACTOR_SOURCES.korea_lci.year}) · Ecoinvent v3.12`],
            ['LCIA 방법', `IPCC ${charLabel} (GWP100, 100-year)`],
            ['전력 EF 출처', `${EMISSION_FACTOR_SOURCES.korea_lci.name} (${EMISSION_FACTOR_SOURCES.korea_lci.year})`],
            ['보고서 번호', reportNumber],
            ['적용 표준', 'ISO 14067:2018 / ISO 14044:2006 / ISO 14040:2006'],
        ]) as unknown as Paragraph,

        new Paragraph({ spacing: { before: 400 } }),

        // 작성·의뢰·검토 정보 3-셀 박스 (Practitioner / Commissioner / Reviewer)
        new Paragraph({
            children: [new TextRun({ text: '작성 · 의뢰 · 검토 정보', size: 22, bold: true, color: C.primary, font: '맑은 고딕' })],
            spacing: { before: 100, after: 80 },
        }),
        partyBoxes([
            {
                role: 'Commissioner · 의뢰자',
                name: meta?.commissioner || '[작성 필요]',
                meta: '대상 청중: B2B 고객 / 내부 의사결정',
            },
            {
                role: 'Practitioner · 수행자',
                name: meta?.practitioner || 'CarbonMate Platform',
                meta: `자동산정 v${APP_VERSION}\n작성일 ${today}`,
            },
            {
                role: 'Reviewer · 검토자',
                name: state.reviewInfo?.reviewerName || '[제3자 검증 예정]',
                meta: state.reviewInfo?.reviewDate
                    ? `검증 일자: ${state.reviewInfo.reviewDate}`
                    : '검증 방식: ISO 14067 Clause 7.4',
            },
        ]) as unknown as Paragraph,

        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({
            children: [new TextRun({ text: `Auto-generated by CarbonMate Platform v${APP_VERSION}`, size: 16, color: C.textLight, font: '맑은 고딕', italics: true })],
            alignment: AlignmentType.CENTER,
        }),
        pb(),
    ]
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  1장: 서론 및 일반사항
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh1(state: PCFState, narratives?: NarrativeBundle): El[] {
    const els: El[] = [pb()]
    const goal = state.productInfo.studyGoal
    const meta = state.reportMeta

    els.push(h('1. 서론 및 일반사항 (Introduction) — ISO 14067 7.1'))
    els.push(kvTable([
        ['보고서 제목', `${state.productInfo.name || '제품'} 탄소발자국(CFP) 연구 보고서`],
        ['보고서 번호', meta?.reportNumber || '[작성 필요]'],
        ['작성일', new Date().toLocaleDateString('ko-KR')],
        ['작성 기관', meta?.practitioner || 'CarbonMate Platform v2.0'],
        ['의뢰자', meta?.commissioner || '[작성 필요]'],
        ['준거 표준', 'ISO 14067:2018, ISO 14044:2006, ISO 14040:2006'],
        ['보고서 유형', REPORT_TYPE_LABELS[meta?.reportType || 'study']],
        ['기밀 등급', meta?.confidentiality === 'public' ? '공개' : meta?.confidentiality === 'restricted' ? '제한' : '내부'],
    ]))
    els.push(empty())

    els.push(h('1.1 연구 목적 및 의도된 용도', HeadingLevel.HEADING_2))
    if (goal) {
        els.push(bullet(`목적: ${goal.applicationPurpose || '[작성 필요]'}`))
        els.push(bullet(`수행 이유: ${goal.reasonForStudy || '[작성 필요]'}`))
        els.push(bullet(`대상 청중: ${goal.targetAudience || '[작성 필요]'}`))
        els.push(bullet(`외부 정보전달 의도: ${goal.isCommunicationIntended ? '예 — ISO 14067 6.7 비판적 검토 필요' : '아니오 (내부 용도)'}`))
    } else {
        els.push(todo('연구 목적, 수행 이유, 대상 청중 정보를 입력하세요.'))
    }

    els.push(h('1.2 적용 PCR 및 보충 요구사항 — 7.3 s)', HeadingLevel.HEADING_2))
    const pcrs = state.pcrReferences || []
    if (pcrs.length > 0) {
        els.push(makeTable(['PCR 명칭', '운영 기관', '버전', '제품 카테고리'],
            pcrs.map(pcr => [pcr.name, pcr.operator, pcr.version || '—', pcr.productCategory || '—'])))
    } else {
        els.push(note('적용된 PCR이 없습니다. 내부 평가 목적이므로 특정 PCR을 미적용하였습니다.'))
    }

    // ─── Narrative #1: PCR 적용 검토 (§1.2) ───
    const narPcr = approvedNarrative(narratives, 'pcr')
    if (narPcr) {
        els.push(...narrativeBlock(narPcr))
    }

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  2장: 목표 및 범위 정의
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh2(state: PCFState, narratives?: NarrativeBundle): El[] {
    const els: El[] = [pb()]
    const meta = state.reportMeta
    const isIntermediate = state.productInfo.boundary === 'cradle-to-gate'
    const spec = state.productInfo.productSpec

    els.push(h('2. 제품 정보 및 제품 시스템 — ISO 14067 6.3'))

    // ─────────── 2.1 제품 식별 ───────────
    els.push(h('2.1 제품 식별 (Product Identification)', HeadingLevel.HEADING_2))
    els.push(makeTable(
        ['항목', '내용'],
        [
            ['제품명', state.productInfo.name || '[작성 필요]'],
            ['제품 카테고리', state.productInfo.category || '[작성 필요]'],
            ['제품 형태', spec?.form || '[작성 필요]'],
            ['순도', spec?.purity || '[작성 필요]'],
            ['주요 용도', spec?.application || '[작성 필요]'],
            ['인도 상태', spec?.deliveryState || '[작성 필요]'],
            ['CAS No.', spec?.casNumber || '[작성 필요]'],
            ['제조 공장', spec?.manufacturingPlant || '[작성 필요]'],
            ['대상 생산량', spec?.annualProduction || '[작성 필요]'],
        ],
    ))

    // ─────────── 2.2 제품 규격 및 인도 기준 ───────────
    els.push(h('2.2 제품 규격 및 인도 기준 (Product Specification)', HeadingLevel.HEADING_2))
    if (spec?.qualityCriteria && spec.qualityCriteria.length > 0) {
        els.push(makeTable(
            ['항목', '기준값', '비고'],
            spec.qualityCriteria.map(q => [q.item, q.value, q.note || '—']),
        ))
    } else {
        els.push(note('제품 규격(순도·입도·수분·불순물 등)을 productSpec.qualityCriteria에 입력하면 표 형태로 자동 생성됩니다. 본 산정에서는 기능단위·선언단위에 영향을 주는 핵심 규격만 §2.4에 명시합니다.'))
    }

    // ─────────── 2.3 제품 제조공정 개요 ───────────
    els.push(h('2.3 제품 제조공정 개요 (Manufacturing Process)', HeadingLevel.HEADING_2))
    if (spec?.manufacturingProcessOverview) {
        els.push(p(spec.manufacturingProcessOverview))
    } else {
        els.push(p('본 제품은 다음 공정을 거쳐 생산됩니다 (단계별 상세는 §2.6 시스템 경계 참조).'))
    }

    // 공정 흐름도 박스+화살표 (sample-v2 §2.3 스타일) — 본문 전진 배치
    els.push(empty())
    els.push(p('그림 1. 시스템 경계 흐름도 (Cradle-to-Gate):', { bold: true }))
    const flowSteps: Array<{ label: string; sub?: string; kind?: 'input' | 'process' | 'output' }> = []
    state.stages.forEach((s, i) => {
        const label = STAGE_LABELS[s] || s
        const isFirst = i === 0
        const isLast = i === state.stages.length - 1
        flowSteps.push({
            label,
            kind: isFirst ? 'input' : isLast ? 'output' : 'process',
        })
    })
    els.push(flowDiagram(flowSteps))

    // ─────────── 2.4 기능단위/선언단위 ───────────
    if (isIntermediate) {
        els.push(h('2.4 선언단위 (Declared Unit) — 7.3 a)', HeadingLevel.HEADING_2))
        els.push(kvTable([
            ['선언단위 (DU)', state.productInfo.unit || '[작성 필요]'],
            ['기준흐름 (Reference Flow)', state.productInfo.referenceFlow || state.productInfo.unit || '[작성 필요]'],
        ]))
        els.push(note('본 제품은 B2B 중간재(반제품)로서 단독 기능 정의가 어려우므로, ISO 14067:2018 Clause 6.3.2에 따라 기능단위(Functional Unit) 대신 선언단위(Declared Unit)를 적용합니다. 최종 제품 시스템에서 기능단위 정의가 필요할 경우 별도 산정이 요구됩니다.'))
    } else {
        els.push(h('2.4 기능단위 (Functional Unit) — 7.3 a)', HeadingLevel.HEADING_2))
        els.push(kvTable([
            ['기능단위 (FU)', state.productInfo.unit || '[작성 필요]'],
            ['기준흐름 (Reference Flow)', state.productInfo.referenceFlow || state.productInfo.unit || '[작성 필요]'],
        ]))
        els.push(note('본 제품은 최종 제품(소비자 제품)으로서 ISO 14067:2018 Clause 6.3.2에 따라 기능단위(Functional Unit)를 적용합니다.'))
    }

    // ─────────── 2.5 투입물 목록 ───────────
    const mats = state.detailedActivityData?.raw_materials
    if (mats && mats.length > 0) {
        els.push(h('2.5 투입물 목록 개요 (Inventory Summary)', HeadingLevel.HEADING_2))
        els.push(p('상세 BOM 및 LCI 매핑은 §3.4를 참조하세요.'))
        els.push(makeTable(['투입물', '수량', '단위', '비고'],
            mats.map(m => [m.name, m.quantity.toFixed(4), m.unit, m.materialType || '—'])))
    }

    // ─────────── 2.6 시스템 경계 ───────────
    els.push(h('2.6 시스템 경계 — 7.3 b)', HeadingLevel.HEADING_2))
    els.push(p(`경계 유형: ${BOUNDARY_LABELS[state.productInfo.boundary] || state.productInfo.boundary}`, { bold: true }))
    els.push(p('포함된 단계:', { bold: true }))
    state.stages.forEach(s => els.push(bullet(`✅ ${STAGE_LABELS[s] || s}`)))
    const excluded = ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol'].filter(s => !state.stages.includes(s))
    if (excluded.length > 0) {
        els.push(p('제외된 단계:', { bold: true }))
        excluded.forEach(s => els.push(bullet(`❌ ${STAGE_LABELS[s] || s}`)))
    }
    els.push(note('시스템 경계 흐름도는 §2.3 (그림 1)을 참조하세요.'))

    // 형식 개선 #11 — 단계별 4컬럼 표 (단계/설명/투입물/산출물)
    els.push(empty())
    els.push(p('포함 단계 상세:', { bold: true }))
    els.push(makeTable(
        ['단계', '설명', '주요 투입물', '주요 산출물'],
        state.stages.map(s => buildStageRow(s, state)),
    ))

    // PR-6: Upstream/Core/Downstream 3-컬럼 모듈 그리드
    els.push(empty())
    els.push(p('시스템 경계 모듈 (Upstream / Core / Downstream):', { bold: true }))
    const ALL_STAGES = ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol']
    const upstream = state.stages.filter(s => ['raw_materials'].includes(s)).map(s => STAGE_LABELS[s] || s)
    const core = state.stages.filter(s => ['manufacturing', 'transport', 'packaging'].includes(s)).map(s => STAGE_LABELS[s] || s)
    const downstreamIncluded = state.stages.filter(s => ['use', 'eol'].includes(s)).map(s => STAGE_LABELS[s] || s)
    const downstreamExcluded = ALL_STAGES.filter(s => ['use', 'eol'].includes(s) && !state.stages.includes(s)).map(s => STAGE_LABELS[s] || s)
    els.push(moduleGrid([
        {
            title: '🟢 Upstream (포함)',
            included: upstream.length > 0,
            items: upstream.length > 0 ? upstream : ['—'],
        },
        {
            title: '🟢 Core (포함)',
            included: core.length > 0,
            items: core.length > 0 ? core : ['—'],
        },
        {
            title: downstreamIncluded.length > 0 ? '🟢 Downstream (포함)' : '⚪ Downstream (제외)',
            included: downstreamIncluded.length > 0,
            items: downstreamIncluded.length > 0
                ? downstreamIncluded
                : (downstreamExcluded.length > 0 ? downstreamExcluded.map(d => `${d} (제외)`) : ['—']),
        },
    ]) as unknown as Paragraph)

    // ─── Narrative #2: 시스템 경계 채택 사유 (§2.3 본문) ───
    const narSysBoundary = approvedNarrative(narratives, 'systemBoundary')
    if (narSysBoundary) {
        els.push(...narrativeBlock(narSysBoundary))
    }

    // 2.7 중요 단위공정
    els.push(h('2.7 중요 단위공정 목록 — 7.3 c)', HeadingLevel.HEADING_2))
    els.push(note('단위공정 분석 결과는 §3.6 및 §5.1에서 상세히 기술합니다.'))

    // 2.8 Cut-off
    els.push(h('2.8 제외(Cut-off) 기준 — 7.3 g)', HeadingLevel.HEADING_2))
    if (state.cutOffResult) {
        els.push(bullet(`에너지 기준: ${(state.cutOffCriteria.energyThreshold * 100).toFixed(0)}%`))
        els.push(bullet(`질량 기준: ${(state.cutOffCriteria.massThreshold * 100).toFixed(0)}%`))
        if (state.cutOffResult.excludedItems > 0) {
            els.push(bullet(`제외 항목 수: ${state.cutOffResult.excludedItems}개`))
            els.push(bullet(`커버리지: ${(100 - state.cutOffResult.excludedEmissionPercent).toFixed(1)}%`))
        }
    } else {
        els.push(note('Cut-off 기준이 설정되지 않았습니다. ISO 14067 6.3.4.3에 따라 설정을 권장합니다.'))
    }

    // 2.9 시간/지리/기술 범위
    els.push(h('2.9 시간적·지리적·기술적 범위 — 7.3 r)', HeadingLevel.HEADING_2))
    const tb = state.productInfo.timeBoundary
    els.push(kvTable([
        ['데이터 수집 기간', tb ? `${tb.dataCollectionStart} ~ ${tb.dataCollectionEnd}` : '[작성 필요]'],
        ['CFP 대표 연도', tb?.cfpRepresentativeYear || '[작성 필요]'],
        ['지리적 범위', meta?.geographicScope || '[작성 필요]'],
        ['기술적 범위', meta?.technologicalScope || '[작성 필요]'],
    ]))

    // 2.10 가정 및 제한
    els.push(h('2.10 가정 및 제한사항', HeadingLevel.HEADING_2))
    for (const lim of METHODOLOGY_LIMITATIONS) {
        els.push(bullet(`${lim.title} (${lim.isoReference}): ${lim.description}`))
    }

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  3장: LCI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh3(state: PCFState, result: TotalEmissionResult, narratives?: NarrativeBundle): El[] {
    const els: El[] = [pb()]
    const charModel = state.characterizationModel || 'AR6'

    els.push(h('3. 전과정 목록분석 (LCI) — ISO 14044 4.3'))

    // 3.1 데이터 수집
    els.push(h('3.1 데이터 수집 절차 및 데이터원 — 7.3 d)', HeadingLevel.HEADING_2))
    els.push(p('활동 데이터는 의뢰자로부터 제공받은 BOM(Bill of Materials)과 에너지 사용 기록을 기반으로 수집하였으며, 배출계수는 아래 2차 데이터원을 활용하였다.'))
    const efRows = Object.entries(EMISSION_FACTOR_SOURCES).map(([, src]) => {
        const org = (src as Record<string, unknown>).organization as string || (src as Record<string, unknown>).version as string || '—'
        return [src.name, org, src.year.toString()]
    })
    els.push(makeTable(['데이터베이스', '기관', '연도'], efRows))

    // 형식 개선 #4 — 데이터 대표성 4컬럼 표 (시간/지리/기술/유형)
    els.push(empty())
    els.push(p('단계별 데이터 대표성:', { bold: true }))
    els.push(makeTable(
        ['구분', '시간적 범위', '지리적 범위', '기술적 범위', '데이터 유형'],
        buildRepresentativenessRows(state),
    ))

    // (Narrative #3: LCI Dataset 선정 근거는 §3.4 dataset 매핑 표 다음에 표시 — 위치 일관성)

    // 3.2 온실가스 목록
    els.push(h('3.2 고려된 온실가스 목록 — 7.3 e)', HeadingLevel.HEADING_2))
    els.push(makeTable(['GHG', '화학식', `GWP₁₀₀ (${charModel})`, '포함 여부'], GHG_LIST.map(g => {
        const val = charModel === 'AR5' ? g.gwp100_ar5 : g.gwp100_ar6
        return [g.name, g.formula, val.toString(), '✅']
    })))

    // 3.3 특성화 인자
    els.push(h('3.3 특성화 인자 — 7.3 f)', HeadingLevel.HEADING_2))
    const ch3UnitLabel = state.productInfo.boundary === 'cradle-to-gate' ? '선언단위' : '기능단위'
    els.push(kvTable([
        ['특성화 모델', CHARACTERIZATION_MODEL_LABELS[charModel]],
        ['시간 범위', '100년 (GWP₁₀₀)'],
        ['기후-탄소 피드백', '포함'],
        ['결과 단위', `kg CO₂e / ${ch3UnitLabel}`],
    ]))

    // 3.4 활동 데이터 요약 + LCI 매핑 + 물질수지 (형식 개선 #5, #12, #6)
    els.push(h('3.4 활동 데이터 · LCI 매핑 · 물질수지', HeadingLevel.HEADING_2))

    const ch3Mats = state.detailedActivityData?.raw_materials || []

    // (1) BOM 표 — 형식 개선 #5: 출처 컬럼 포함
    if (ch3Mats.length > 0) {
        els.push(p('원료 BOM:', { bold: true }))
        els.push(makeTable(
            ['투입물', '수량', '단위', '농도', '순물질 (kg)', '출처'],
            ch3Mats.map(m => {
                const conc = m.concentrationPercent ? `${m.concentrationPercent}%` : '—'
                const pure = m.concentrationPercent
                    ? (m.quantity * (m.concentrationPercent / 100)).toFixed(2)
                    : '—'
                const sourceLabel = m.dataQuality?.type === 'primary'
                    ? 'BOM · 측정'
                    : m.dataQuality?.type === 'secondary'
                        ? '2차 DB'
                        : '추정'
                const sourceDetail = m.dataQuality?.source
                    ? `${sourceLabel} (${m.dataQuality.source})`
                    : sourceLabel
                return [m.name, m.quantity.toFixed(4), m.unit, conc, pure, sourceDetail]
            })
        ))
    } else {
        const adEntries = Object.entries(state.activityData).filter(([, v]) => (v as number) > 0)
        if (adEntries.length > 0) {
            els.push(makeTable(['항목 ID', '값'], adEntries.map(([k, v]) => [k, Number(v).toFixed(4)])))
        } else {
            els.push(note('간소화된 활동 데이터가 없습니다. 상세 활동 데이터를 참조하세요.'))
        }
    }

    // (2) LCI Dataset 매핑 — 형식 개선 #12
    const matsWithLci = ch3Mats.filter(m => m.lciGuide)
    if (matsWithLci.length > 0) {
        els.push(empty())
        els.push(p('LCI Dataset 매핑 (Ecoinvent 정확 명칭):', { bold: true }))
        els.push(makeTable(
            ['활동자료', 'Dataset 정확 명칭', '지리', '단위', 'UUID(앞 8자)'],
            matsWithLci.map(m => [
                m.name,
                m.lciGuide!.activityName,
                m.lciGuide!.geography,
                m.lciGuide!.unit,
                m.lciGuide!.activityUuid?.slice(0, 8) || '—',
            ])
        ))
    }

    // (3) 물질수지 — 무수 기준 + 수분 흐름 분리 (P0-D)
    //   r1 보고서에서 물 항목이 BOM 합산에 포함되어 차이율 72.7% 워닝이 노출되었음.
    //   ISO 14044 4.2.3 권장: 물질수지는 무수 기준으로 검증하고, 용수 흐름은 별도 표시.
    if (ch3Mats.length > 0) {
        // 산출 폐기물 합산 — simplified activity data에서 가져옴
        const wasteKg = (() => {
            const ad = state.activityData as Record<string, number | undefined> | undefined
            if (!ad) return 0
            return (ad.general_waste_kg ?? 0) + (ad.designated_waste_kg ?? 0)
        })()
        // 산출 폐수 — 외부 위탁 처리 (시스템 경계 외이지만 수분 흐름 추적용)
        const effluentM3 = (() => {
            const ad = state.activityData as Record<string, number | undefined> | undefined
            return ad?.industrial_wastewater_m3 ?? 0
        })()

        const balance = computeMaterialBalance(
            ch3Mats.map((m) => ({
                name: m.name,
                quantity: m.quantity || 0,
                unit: (m as { unit?: string }).unit,
            })),
            {
                productKg: 1000,
                outputWasteKg: wasteKg,
                effluentVolumeM3: effluentM3,
                // crystalWaterFraction 은 화학식이 BOM에 포함되지 않은 일반 케이스에서는 0.
                // 추후 product spec에 화학식 입력 UI 추가 시 자동 계산 가능.
                crystalWaterFraction: 0,
            }
        )

        els.push(empty())
        els.push(p('물질수지 검증 (1 ton 산출 기준 — 무수 기준):', { bold: true }))
        els.push(makeTable(
            ['구분', '입력 (kg)', '산출 (kg)', '차이 (kg)', '차이율', '검토 의견'],
            [[
                '무수 물질',
                balance.dryBasis.inputKg.toFixed(2),
                balance.dryBasis.outputKg.toFixed(2),
                balance.dryBasis.diffKg.toFixed(2),
                `${balance.dryBasis.diffPct.toFixed(1)}%`,
                balance.dryBasis.verdictText,
            ]]
        ))

        if (balance.hasWaterItems) {
            els.push(p('수분 흐름 (참고용 — 폐수/증발/결정수로 분배, ISO 14044 4.2.3 권장 분리):', { bold: true }))
            els.push(makeTable(
                ['입력 용수 (kg)', '결정수 추정 (kg)', '폐수/증발 추정 (kg)', '비고'],
                [[
                    balance.waterFlow.inputKg.toFixed(2),
                    balance.waterFlow.crystalWaterKg.toFixed(2),
                    balance.waterFlow.effluentEstimateKg.toFixed(2),
                    balance.waterFlow.note,
                ]]
            ))
        }
    }

    // ─── Narrative #3: LCI Dataset 선정 근거 (§3.4 본문) ───
    const narDataset_inline = approvedNarrative(narratives, 'datasetRationale')
    if (narDataset_inline) {
        els.push(...narrativeBlock(narDataset_inline))
    }

    // 형식 개선 #14 — 3.5 공급사·구간별 운송 상세
    const transports = state.detailedActivityData?.transport || []
    if (transports.length > 0) {
        els.push(h('3.5 공급사·구간별 운송 상세', HeadingLevel.HEADING_2))
        els.push(p('운송 활동 단위로 분리한 ton·km 산출 — 향후 공급사 풀 재편/거리 단축 시나리오의 입력값.'))
        els.push(makeTable(
            ['코드', '구간/품목', 'Mode', '거리 (km)', '화물량 (kg)', 'ton·km'],
            transports.map((t, i) => {
                const code = `T-${String.fromCharCode(65 + i)}`
                const tonKm = (t.distance * t.weight) / 1000
                return [
                    code,
                    t.name || '—',
                    t.transportMode,
                    t.distance.toFixed(0),
                    t.weight.toFixed(0),
                    tonKm.toFixed(2),
                ]
            })
        ))
    }

    // 3.6 단위공정
    els.push(h('3.6 중요 단위공정 식별 — 7.3 c)', HeadingLevel.HEADING_2))
    try {
        const upAnalysis = analyzeUnitProcesses(state, result)
        els.push(p(`전체 ${upAnalysis.totalProcessCount}개 단위공정 중 ${upAnalysis.significantProcesses.length}개가 중요 (기여도 ≥ ${upAnalysis.significantThreshold}%)`))
        if (upAnalysis.significantProcesses.length > 0) {
            els.push(makeTable(['단위공정', '단계', '배출량', '기여도', '품질'],
                upAnalysis.significantProcesses.map(up => [
                    up.nameKo, STAGE_LABELS[up.stageId] || up.stageId,
                    up.emission.toFixed(4), `${up.contribution.toFixed(1)}%`,
                    up.dataQuality === 'primary' ? '1차' : up.dataQuality === 'secondary' ? '2차' : '추정'
                ])))
        }
    } catch {
        els.push(note('단위공정 분석 데이터가 부족합니다.'))
    }

    // 3.7 전력 처리
    els.push(h('3.7 전력 처리 정보 — 7.3 l)', HeadingLevel.HEADING_2))
    els.push(kvTable([
        ['적용 그리드', '대한민국 국가 전력 그리드'],
        ['산정 방법', '소비 기반 (Consumption-based) — 송배전 손실 포함'],
        ['출처', `${EMISSION_FACTOR_SOURCES.korea_lci.name} (${EMISSION_FACTOR_SOURCES.korea_lci.year})`],
        ['포함 GHG', 'CO₂, CH₄, N₂O'],
    ]))

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  4장: 할당
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh4(state: PCFState, result: TotalEmissionResult, narratives?: NarrativeBundle): El[] {
    const els: El[] = [pb()]
    els.push(h('4. 할당 (Allocation) — ISO 14067 6.4.6'))

    // 4.1 다중 산출물
    els.push(h('4.1 다중 산출물 할당 절차 — 7.3 h)', HeadingLevel.HEADING_2))
    const moMethod = MULTI_OUTPUT_ALLOCATION_METHODS[state.multiOutputAllocation.method]

    // 할당 4단계 우선순위 검토 표 (성현 §4-4 + ISO 14044 5.3.5)
    els.push(p('할당 4단계 우선순위 검토 (ISO 14044 5.3.5):', { bold: true }))
    const selectedMethod = state.multiOutputAllocation.method
    const isSubdivision = selectedMethod === 'subdivision'
    const isSysExp = selectedMethod === 'system_expansion'
    const isPhysical = selectedMethod === 'physical'
    const isEconomic = selectedMethod === 'economic'
    els.push(makeTable(
        ['우선순위', '방법', '검토 결과', '채택 여부'],
        [
            ['1', '하위분할 (Subdivision)', isSubdivision ? '단위공정 분리 가능 — 채택' : '단위공정 분리 어려움 또는 미적용', isSubdivision ? '✅ 채택' : '미채택'],
            ['2', '시스템 확장 (System Expansion)', isSysExp ? '대체효과 정량화 가능 — 채택' : '대체효과 정량화 어려움 또는 미적용', isSysExp ? '✅ 채택' : '미채택'],
            ['3', '물리적 관계 (Physical)', isPhysical ? `물리적 기준(질량/에너지) 적용 — 채택` : '물리적 관계 부적절 또는 미적용', isPhysical ? '✅ 채택' : '미채택'],
            ['4', '경제적 가치 (Economic)', isEconomic ? '경제적 가치 기준 채택' : '최후 수단 미적용', isEconomic ? '✅ 채택' : '미채택'],
        ],
        C.primary,
        { hlRows: [isSubdivision ? 0 : isSysExp ? 1 : isPhysical ? 2 : 3] }
    ))
    els.push(empty())

    els.push(bullet(`최종 채택: ${moMethod?.nameKo || state.multiOutputAllocation.method}`))
    els.push(bullet(`우선순위: ISO 14067 할당 계층 ${moMethod?.priority || '—'}순위`))
    if (state.multiOutputAllocation.coProducts?.length > 0) {
        els.push(p('공동 산출물:', { bold: true }))
        els.push(makeTable(['산출물', '수량', '단위'],
            state.multiOutputAllocation.coProducts.map(cp => [cp.name, String(cp.quantity), cp.unit])))
    }
    if (result.allocation?.applied) {
        els.push(p('할당 결과:', { bold: true }))
        els.push(kvTable([
            ['할당 전 CFP', `${result.totalEmission.toFixed(4)} kg CO₂e`],
            ['주제품 할당률', `${(result.allocation.mainProductShare * 100).toFixed(1)}%`],
            ['할당 후 CFP', `${result.allocation.allocatedTotal.toFixed(4)} kg CO₂e`],
            ['할당 방법', result.allocation.methodLabel],
        ]))
    }

    // ─── Narrative #4: 할당 절차 정당화 (§4.1 본문) ───
    const narAlloc = approvedNarrative(narratives, 'allocation')
    if (narAlloc) {
        els.push(...narrativeBlock(narAlloc))
    }

    // 4.2 재활용/EoL
    els.push(h('4.2 재활용/EoL 할당 — 6.4.6.3', HeadingLevel.HEADING_2))
    const recMethod = RECYCLING_ALLOCATION_METHODS[state.recyclingAllocation.method]
    els.push(kvTable([
        ['방법', recMethod?.nameKo || state.recyclingAllocation.method],
        ['루프 유형', state.recyclingAllocation.loopType === 'open_loop' ? '개방 루프' : '폐쇄 루프'],
        ['재활용 투입', `${(state.recyclingAllocation.recycledContentInput * 100).toFixed(0)}%`],
        ['재활용 산출', `${(state.recyclingAllocation.recyclabilityOutput * 100).toFixed(0)}%`],
    ]))

    // 4.3 사용/폐기 시나리오
    els.push(h('4.3 사용 프로파일 및 폐기 시나리오 — 7.3 p)', HeadingLevel.HEADING_2))
    if (!state.stages.includes('use')) {
        els.push(note('사용 단계가 시스템 경계에서 제외되었습니다. 사유: 소비자 사용 패턴의 다양성으로 대표성 확보 어려움.'))
    } else {
        els.push(todo('사용 프로파일 시나리오를 기술하세요.'))
    }

    // 형식 개선 #15 — 4.4 EOL 처리경로 표
    const recIn = state.recyclingAllocation?.recycledContentInput ?? 0
    const recOut = state.recyclingAllocation?.recyclabilityOutput ?? 0
    const recMethodLabel = RECYCLING_ALLOCATION_METHODS[state.recyclingAllocation?.method]?.nameKo
        ?? state.recyclingAllocation?.method
        ?? '—'
    const eolIncluded = state.stages.includes('eol')
    els.push(h('4.4 EOL 처리경로', HeadingLevel.HEADING_2))
    if (eolIncluded || recOut > 0) {
        els.push(makeTable(
            ['대상', '재활용 %', '소각/매립 %', '할당 방법', 'Dataset/방법'],
            [
                ['포장재', `${(recOut * 100).toFixed(0)}%`, `${((1 - recOut) * 100).toFixed(0)}%`, recMethodLabel, 'PEFCR v6.3 Annex C / Ecoinvent'],
                ['일반/지정 폐기물', '— (사업장 폐기물 별도)', '—', recMethodLabel, 'Ecoinvent treatment of waste'],
            ]
        ))
        els.push(p(`재활용 투입(recycled content input): ${(recIn * 100).toFixed(0)}%`))
    } else {
        els.push(note('EOL 단계가 시스템 경계에서 제외되었습니다 (B2B 중간재 — 고객사 시스템 귀속).'))
    }

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  5장: 온실가스 결과
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh5(state: PCFState, result: TotalEmissionResult): El[] {
    const els: El[] = [pb()]
    const { totalEmission, totalFossil, totalBiogenic, totalAircraft, avgUncertainty, stageResults, allocation } = result
    const cfp = allocation?.applied ? allocation.allocatedTotal : totalEmission

    els.push(h('5. 온실가스 결과 (GHG Results) — ISO 14067 7.2'))

    // 5.1 총 CFP
    els.push(h('5.1 총 CFP 및 단계별 기여도 — 7.2 a)', HeadingLevel.HEADING_2))
    const sorted = state.stages.map(s => ({
        label: STAGE_LABELS[s] || s,
        em: allocation?.applied ? (allocation.allocatedStageResults[s]?.total || 0) : (stageResults[s]?.total || 0),
    })).sort((a, b) => b.em - a.em)
    els.push(makeTable(['단계', '배출량 (kg CO₂e)', '기여도'],
        sorted.map(s => [s.label, s.em.toFixed(4), `${cfp > 0 ? ((s.em / cfp) * 100).toFixed(1) : '0'}%`])))
    els.push(p(`총 CFP: ${cfp.toFixed(4)} kg CO₂e / ${state.productInfo.unit}`, { bold: true }))

    // 5.2 화석 GHG
    els.push(h('5.2 화석 GHG 배출량 및 제거량 — 7.2 b)', HeadingLevel.HEADING_2))
    const fossil = allocation?.applied ? allocation.allocatedFossil : totalFossil
    els.push(kvTable([['화석 GHG 배출량', `${fossil.toFixed(4)} kg CO₂e`], ['화석 GHG 제거량', '0.0000 kg CO₂e'], ['순 화석 GHG', `${fossil.toFixed(4)} kg CO₂e`]]))

    // 5.3 생물기원
    els.push(h('5.3 생물기원 GHG 배출량 및 제거량 — 7.2 c)', HeadingLevel.HEADING_2))
    const bio = allocation?.applied ? allocation.allocatedBiogenic : totalBiogenic
    els.push(kvTable([['생물기원 GHG 배출량', `${bio.toFixed(4)} kg CO₂e`], ['생물기원 GHG 제거량', '0.0000 kg CO₂e'], ['순 생물기원 GHG', `${bio.toFixed(4)} kg CO₂e`]]))

    // 5.4 dLUC/iLUC — IPCC Volume 4 Chapter 2/8 기반 상세 산정
    els.push(h('5.4 dLUC / iLUC 배출량 — 7.2 d)', HeadingLevel.HEADING_2))

    const dluc = state.productInfo.dLUC
    if (dluc && dluc.applicable && dluc.areaM2 && dluc.areaM2 > 0) {
        // 토지 면적 + 이전 토지피복 정보가 있으면 IPCC 식 자동 산정
        const areaHa = dluc.areaM2 / 10000
        // IPCC 2006 Vol 4 Ch 2 기본값 (사용자가 override 가능)
        const biomassC_per_ha = dluc.biomassCPerHa ?? 150 // 온대림 기본
        const domC_per_ha = dluc.domCPerHa ?? 10
        const soilC_per_ha = dluc.soilCPerHa ?? 80 // LAC 토양 기본
        const conversionToCO2 = 44 / 12 // C → CO2

        const biomassCO2 = areaHa * biomassC_per_ha * conversionToCO2
        const domCO2 = areaHa * domC_per_ha * conversionToCO2
        const soilCO2 = areaHa * soilC_per_ha * conversionToCO2 * 0.2 // Ch 8.3.3.2 20% 적용
        const totalDluc = biomassCO2 + domCO2 + soilCO2

        // 20년 분배 + 선언단위 할당
        const annualDluc = totalDluc / 20
        const annualProductionKg = dluc.annualProductionKg ?? 1000 // 기본 1 ton
        const dlucPerKg = (annualDluc * 1000) / annualProductionKg

        els.push(p('IPCC 2006 Volume 4 Chapter 2/8 기반 dLUC 산정:', { bold: true }))
        els.push(makeTable(
            ['항목', '계산식 (IPCC Vol 4)', '값'],
            [
                ['부지 면적', '입력값', `${dluc.areaM2.toLocaleString()} m² (${areaHa.toFixed(4)} ha)`],
                ['이전 토지 피복', '입력값', dluc.previousLandCover || '온대림 (기본)'],
                ['Biomass 탄소', `식 2.16: ${biomassC_per_ha} t C/ha × ${areaHa.toFixed(4)} ha`, `${(areaHa * biomassC_per_ha).toFixed(3)} t C → ${biomassCO2.toFixed(3)} t CO₂`],
                ['DOM (고사유기물)', `식 2.23: ${domC_per_ha} t C/ha × ${areaHa.toFixed(4)} ha`, `${(areaHa * domC_per_ha).toFixed(3)} t C → ${domCO2.toFixed(3)} t CO₂`],
                ['Soil 유기탄소', `식 2.25 + Ch 8.3.3.2 (20%): ${soilC_per_ha} t C/ha × ${areaHa.toFixed(4)} ha × 0.2`, `${(areaHa * soilC_per_ha * 0.2).toFixed(3)} t C → ${soilCO2.toFixed(3)} t CO₂`],
                ['총 dLUC', '합계', `${totalDluc.toFixed(3)} t CO₂`],
                ['연간 분배 (20년)', `${totalDluc.toFixed(3)} / 20`, `${annualDluc.toFixed(3)} t CO₂/년`],
                ['선언단위당 (kg/단위)', `${(annualDluc * 1000).toFixed(2)} kg / ${annualProductionKg.toLocaleString()} kg 생산`, `${dlucPerKg.toFixed(4)} kg CO₂e/kg 제품`],
            ]
        ))
        els.push(p(`dLUC 본 산정 결과: ${dlucPerKg.toFixed(4)} kg CO₂e / ${state.productInfo.unit || 'kg'}`, { bold: true, color: C.primary }))
        els.push(kvTable([
            ['iLUC (간접 토지이용변화)', '정량화 미실시 — 국제 합의 방법론 부재'],
        ]))
    } else {
        // dLUC 미적용 (기존 부지/입력 정보 없음)
        els.push(kvTable([
            ['dLUC (직접 토지이용변화)', '정량화 미실시 (해당 토지전환 없음 또는 입력값 부재)'],
            ['iLUC (간접 토지이용변화)', '정량화 미실시'],
        ]))
        els.push(note('토지전환이 있는 사업장의 경우 productInfo.dLUC에 부지 면적·이전 토지피복·이전 탄소저장량을 입력하면 IPCC 2006 Vol 4 Ch 2/8 기반으로 자동 산정됩니다 (식 2.16/2.23/2.25 + 20년 분배).'))
    }

    // 5.5 항공
    els.push(h('5.5 항공 운송 GHG — 7.2 e)', HeadingLevel.HEADING_2))
    const air = allocation?.applied ? allocation.allocatedAircraft : totalAircraft
    els.push(p(`항공 운송 GHG 배출량: ${air.toFixed(4)} kg CO₂e`))

    // 5.6 GHG별 분해
    if (result.ghgBreakdown && Object.keys(result.ghgBreakdown).length > 0) {
        els.push(h('5.6 온실가스별 상세 분해', HeadingLevel.HEADING_2))
        const entries = Object.entries(result.ghgBreakdown).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).filter(([, v]) => Math.abs(v) > 0.000001)
        els.push(makeTable(['온실가스', '배출량 (kg CO₂e)', '비율'], entries.map(([k, v]) => {
            const label = k.replace('_fossil', ' (화석)').replace('_biogenic', ' (생물기원)')
            return [label, v.toFixed(6), `${cfp > 0 ? ((v / cfp) * 100).toFixed(1) : '0'}%`]
        }), C.purple))
    }

    // 5.7 불확도 범위
    els.push(h('5.7 불확도 범위', HeadingLevel.HEADING_2))
    els.push(kvTable([
        ['종합 불확도', `±${avgUncertainty.toFixed(0)}%`],
        ['하한', `${(cfp * (1 - avgUncertainty / 100)).toFixed(4)} kg CO₂e`],
        ['상한', `${(cfp * (1 + avgUncertainty / 100)).toFixed(4)} kg CO₂e`],
    ]))

    // 형식 개선 #13 — 5.8 원료 기여도 Pareto (개별 활동 단위)
    const allDetails: Array<{ source: string; value: number; stage: string }> = []
    for (const stageId of state.stages) {
        const sr = result.stageResults[stageId]
        if (!sr?.details) continue
        for (const d of sr.details) {
            if (d.value > 0) {
                allDetails.push({ source: d.source, value: d.value, stage: STAGE_LABELS[stageId] || stageId })
            }
        }
    }
    if (allDetails.length > 0 && cfp > 0) {
        const sorted = [...allDetails].sort((a, b) => b.value - a.value).slice(0, 14)
        let cum = 0
        const rows = sorted.map((d, i) => {
            const pct = (d.value / cfp) * 100
            cum += pct
            return [
                String(i + 1),
                d.source,
                d.stage,
                d.value.toFixed(4),
                `${pct.toFixed(1)}%`,
                `${cum.toFixed(1)}%`,
            ]
        })
        els.push(h('5.8 원료/활동 단위 기여도 Pareto', HeadingLevel.HEADING_2))
        els.push(p('상위 14개 활동의 정렬 + 누적% (Pareto 분석). 80% 누적까지의 항목이 우선 개선 대상.'))
        els.push(makeTable(
            ['순위', '원료/활동', '단계', '배출량 (kg CO₂e)', '비율', '누적 %'],
            rows,
            C.primary,
            { hlRows: [0, 1, 2], hlBg: C.warm } // 상위 3행 강조 (sample-v2 패턴)
        ))
    }

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  6장: 데이터 품질
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh6(state: PCFState, result: TotalEmissionResult, narratives?: NarrativeBundle): El[] {
    const els: El[] = [pb()]
    els.push(h('6. 데이터 품질 평가 — ISO 14067 7.3 j)'))

    els.push(h('6.1 데이터 품질 평가 방법', HeadingLevel.HEADING_2))
    els.push(p('데이터 품질은 ISO 14044 및 PEF Guide의 DQR(Data Quality Rating) 방법론에 따라 5개 지표로 평가하였다.'))
    els.push(kvTable([
        ['전체 데이터 유형', state.dataQualityMeta.overallType === 'primary' ? '1차 데이터' : state.dataQualityMeta.overallType === 'secondary' ? '2차 데이터' : '추정 데이터'],
        ['참조 DB', state.dataQualityMeta.sources.join(', ')],
        ['기준 연도', state.dataQualityMeta.baseYear.toString()],
    ]))

    els.push(h('6.2 DQR Pedigree Matrix — TiR / TeR / GeR (3차원)', HeadingLevel.HEADING_2))
    els.push(p('ILCD 척도 (1=최우수 ~ 5=매우 미흡). EU 배터리 규정 Ares(2024)/3131389 기준 가중평균 ≤ 3.0 권장.'))

    // 형식 개선 #16 — DQR 3차원 표
    const mats = state.detailedActivityData?.raw_materials || []
    if (mats.length > 0) {
        const rows = mats.map(m => {
            const dq = m.lciGuide?.dataQuality
            const tir = dq?.time || 3
            const ter = dq?.technology || 3
            const ger = dq?.geography || 3
            const avg = (tir + ter + ger) / 3
            const interp = avg <= 1.6 ? '최우수' : avg <= 2.5 ? '우수' : avg <= 3.5 ? '보통' : '미흡'
            return [m.name, String(tir), String(ter), String(ger), avg.toFixed(1), interp]
        })

        // 가중평균 행 추가
        const sumTir = mats.reduce((a, m) => a + (m.lciGuide?.dataQuality?.time || 3), 0)
        const sumTer = mats.reduce((a, m) => a + (m.lciGuide?.dataQuality?.technology || 3), 0)
        const sumGer = mats.reduce((a, m) => a + (m.lciGuide?.dataQuality?.geography || 3), 0)
        const avgTir = sumTir / mats.length
        const avgTer = sumTer / mats.length
        const avgGer = sumGer / mats.length
        const avgOverall = (avgTir + avgTer + avgGer) / 3
        const overallInterp = avgOverall <= 1.6 ? '최우수' : avgOverall <= 2.5 ? '우수' : avgOverall <= 3.5 ? '보통' : '미흡'
        rows.push([
            '가중평균',
            avgTir.toFixed(1),
            avgTer.toFixed(1),
            avgGer.toFixed(1),
            avgOverall.toFixed(1),
            overallInterp,
        ])

        els.push(makeTable(
            ['데이터 항목', 'TiR\n(시간)', 'TeR\n(기술)', 'GeR\n(지리)', '평균 DQR', '해석'],
            rows,
        ))
    } else {
        els.push(todo('상세 활동 데이터를 입력하면 DQR 3차원 매트릭스가 자동 생성됩니다.'))
    }

    // 형식 개선 #17 — PEFCR v6.3 활동자료 등급
    els.push(h('6.3 PEFCR 활동자료 등급 (Activity Data Grade)', HeadingLevel.HEADING_2))
    els.push(p('PEFCR Guidance v6.3 기준 — 검증 상태에 따른 활동자료 신뢰성 등급.'))
    if (mats.length > 0) {
        els.push(makeTable(
            ['활동자료', '수집 방법', '검증 상태', '등급'],
            mats.map(m => {
                const isPrimary = m.dataQuality?.type === 'primary'
                const isVerified = isPrimary && m.dataQuality?.source !== 'estimated'
                const grade = isVerified
                    ? '매우 우수 (Very good)'
                    : isPrimary
                        ? '우수 (Good)'
                        : m.dataQuality?.type === 'secondary'
                            ? '보통 (Fair)'
                            : '개선 필요 (Poor)'
                return [
                    m.name,
                    isPrimary ? '사업장 계량/측정' : '2차 DB / 추정',
                    isVerified ? '내부 검증 완료' : '검증 미실시',
                    grade,
                ]
            })
        ))
    } else {
        els.push(note('활동자료 등급은 상세 BOM 입력 후 자동 평가됩니다.'))
    }

    // 6.4 데이터 품질 9항목 자체평가 (지엠에프 §2.3 스타일)
    els.push(h('6.4 데이터 품질 9항목 자체평가', HeadingLevel.HEADING_2))
    els.push(p('ISO 14044 4.2.3.6.2 + PEF 가이드 권장 9개 항목 자체평가.'))
    const dqMats = state.detailedActivityData?.raw_materials || []
    const hasPrimary = dqMats.some(m => m.dataQuality?.type === 'primary')
    const has1st = dqMats.length > 0 && dqMats.filter(m => m.dataQuality?.type === 'primary').length / dqMats.length > 0.5
    const hasCutOff = state.cutOffResult && state.cutOffResult.excludedEmissionPercent < 5
    const hasReview = state.reviewInfo?.reviewType && state.reviewInfo.reviewType !== 'none'
    const dq9 = [
        ['1. 적합성 (Relevance)', hasPrimary ? '✅ 충족' : '🟡 부분', '제품 시스템과 활동자료 1:1 대응'],
        ['2. 대표성 (Representativeness)', dqMats.length > 0 ? '✅ 충족' : '🟡 부분', '시간·지리·기술 대표성 — §3.1 표 4 참조'],
        ['3. 일관성 (Consistency)', '✅ 충족', '동일 LCI DB 일관 적용'],
        ['4. 신뢰성 (Reliability)', has1st ? '✅ 충족' : '🟡 대체로', '1차 데이터 비율 검증'],
        ['5. 완전성 (Completeness)', hasCutOff ? '✅ 충족' : '🟡 부분', `Cut-off 누적 영향 ${state.cutOffResult ? state.cutOffResult.excludedEmissionPercent.toFixed(1) : '—'}%`],
        ['6. 정밀도/정확도 (Precision)', '🟡 대체로', `±${result.avgUncertainty.toFixed(0)}% 불확도`],
        ['7. 재현성 (Reproducibility)', '✅ 충족', 'CarbonMate 자동 산정 — 입력 동일 시 결과 동일'],
        ['8. 데이터 검증 (Validation)', hasReview ? '✅ 충족' : '🟡 부분 (제3자 검증 미실시)', 'ISO 14067 7.4 권장'],
        ['9. 전과정 모델 (Life Cycle Model)', '✅ 충족', 'ISO 14067 4단계 모두 수행'],
    ]
    els.push(makeTable(['항목', '평가', '근거'], dq9))

    // ─── Narrative #5: 데이터 품질 종합 평가 (§6.5) ───
    const narDQ = approvedNarrative(narratives, 'dataQuality')
    if (narDQ) {
        els.push(h('6.5 데이터 품질 종합 평가 (Narrative)', HeadingLevel.HEADING_2))
        els.push(...narrativeBlock(narDQ))
    }

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  7장: 전과정 해석
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh7(state: PCFState, result: TotalEmissionResult, narratives?: NarrativeBundle): El[] {
    const els: El[] = [pb()]
    const cfp = result.allocation?.applied ? result.allocation.allocatedTotal : result.totalEmission
    const hasReview = state.reviewInfo?.reviewType && state.reviewInfo.reviewType !== 'none'

    els.push(h('7. 전과정 해석 (Interpretation) — ISO 14044 4.5'))

    // 7.1 기여도 분석
    els.push(h('7.1 기여도 분석 (핫스팟 식별)', HeadingLevel.HEADING_2))
    const sorted = state.stages.map(s => ({
        label: STAGE_LABELS[s] || s,
        em: result.allocation?.applied ? (result.allocation.allocatedStageResults[s]?.total || 0) : (result.stageResults[s]?.total || 0),
    })).sort((a, b) => b.em - a.em)
    if (sorted[0]) {
        els.push(p(`최대 기여 단계: ${sorted[0].label} (${((sorted[0].em / cfp) * 100).toFixed(1)}%)`, { bold: true }))
        els.push(p(`10% 감축 시 약 ${(sorted[0].em * 0.1).toFixed(4)} kg CO₂e 절감 가능`))
    }

    // ─── Narrative #6: 종합 해석 — Hotspot 구조와 개선 경로 (§7.1 본문) ───
    const narInterp = approvedNarrative(narratives, 'resultInterpretation')
    if (narInterp) {
        els.push(...narrativeBlock(narInterp))
    }

    // 7.2 민감도 분석
    els.push(h('7.2 민감도 분석 — 7.3 k)', HeadingLevel.HEADING_2))
    const sa = state.sensitivityAnalysis
    if (sa) {
        // 사전 계획표 (시나리오 의도)
        if (sa.scenarios?.length > 0) {
            els.push(p('민감도 분석 계획 (시나리오 의도 + 분석 목적):', { bold: true }))
            els.push(makeTable(
                ['시나리오', '변동 대상', '분석 목적', '유의성 기준'],
                sa.scenarios.map(s => [
                    s.nameKo || s.name,
                    s.parameterChanged,
                    s.isSignificant ? '핵심 hotspot 검증' : '안정성 확인',
                    '|±5%| 초과 시 유의',
                ])
            ))
            els.push(empty())
        }
        els.push(bullet(`기준 CFP: ${sa.baselineCFP.toFixed(4)} kg CO₂e`))
        if (sa.scenarios?.length > 0) {
            els.push(p('민감도 분석 결과:', { bold: true }))
            els.push(makeTable(['시나리오', '파라미터', '변동률', '유의성'],
                sa.scenarios.map(s => [s.nameKo || s.name, s.parameterChanged, `${s.percentageChange >= 0 ? '+' : ''}${s.percentageChange.toFixed(1)}%`, s.isSignificant ? '⚠️' : '✅'])))
        }

        // 형식 개선 #18 — 7.3 비교 시나리오 표
        if (sa.scenarios?.length > 0) {
            els.push(h('7.3 시나리오 비교 (현재 vs 대안)', HeadingLevel.HEADING_2))
            const baseRow: string[] = ['현재값 (Baseline)', sa.baselineCFP.toFixed(4), '0.0%', '기준 산정']
            const altRows: string[][] = sa.scenarios.slice(0, 5).map(s => [
                s.nameKo || s.name,
                (s.alternativeEmission ?? sa.baselineCFP).toFixed(4),
                `${s.percentageChange >= 0 ? '+' : ''}${s.percentageChange.toFixed(1)}%`,
                s.isSignificant ? '⚠️ 유의' : '✅ 안정',
            ])
            els.push(makeTable(['시나리오', 'CFP (kg CO₂e)', '변동률', '의미'], [baseRow, ...altRows]))
        }
    } else {
        els.push(note('민감도 분석이 수행되지 않았습니다.'))
    }

    // 7.4 불확도
    els.push(h('7.4 불확도 평가', HeadingLevel.HEADING_2))
    els.push(p(`종합 불확도: ±${result.avgUncertainty.toFixed(0)}%`))
    els.push(p(`CFP 범위: ${(cfp * (1 - result.avgUncertainty / 100)).toFixed(4)} ~ ${(cfp * (1 + result.avgUncertainty / 100)).toFixed(4)} kg CO₂e`))

    // 7.5 완전성 점검
    els.push(h('7.5 완전성 점검', HeadingLevel.HEADING_2))
    const checks: [string, boolean][] = [
        ['모든 활성 단계에 대해 활동 데이터 입력됨', state.stages.length > 0],
        ['배출계수가 모든 투입물에 적용됨', true],
        ['Cut-off 제외 항목의 누적 기여도 5% 미만', !state.cutOffResult || state.cutOffResult.excludedEmissionPercent < 5],
        ['에너지 및 물질 투입 모두 고려됨', state.stages.includes('raw_materials') && state.stages.includes('manufacturing')],
    ]
    checks.forEach(([desc, ok]) => els.push(bullet(`${ok ? '☑' : '☐'} ${desc}`)))

    // 7.6 일관성 검토
    els.push(h('7.6 일관성 검토', HeadingLevel.HEADING_2))
    els.push(bullet(`☑ 동일한 특성화 모델(${state.characterizationModel || 'AR6'}) 전 단계 적용`))
    els.push(bullet('☑ 할당 방법이 시스템 경계 전체에 일관적'))
    els.push(bullet('☑ 데이터 수집 기간이 모든 단계에서 동일'))

    // 7.7 결론 (4섹션 표준화 — 성현 §4-5 + ISO 14040 4.5)
    els.push(h('7.7 결론', HeadingLevel.HEADING_2))

    // 7.7.1 결과 요약
    els.push(h('7.7.1 결과 요약', HeadingLevel.HEADING_3))
    els.push(p(`본 산정의 총 CFP는 ${cfp.toFixed(2)} kg CO₂e (±${result.avgUncertainty.toFixed(0)}%)이며, 최대 기여 단계는 ${sorted[0]?.label || '—'} (${sorted[0] ? ((sorted[0].em / cfp) * 100).toFixed(1) : '—'}%)이다.`))
    els.push(p(`상위 3개 단계가 전체의 ${sorted.slice(0, 3).reduce((a, s) => a + (s.em / cfp) * 100, 0).toFixed(1)}%를 차지하여 명확한 hotspot 구조를 보인다.`))

    // 7.7.2 분석의 한계
    els.push(h('7.7.2 분석의 한계', HeadingLevel.HEADING_3))
    els.push(bullet('1차 데이터 부재 항목 — 향후 사업장 측정값 확보 필요'))
    els.push(bullet(`데이터 품질 — DQR 기반 ±${result.avgUncertainty.toFixed(0)}% 불확도 (DB 대표성 한계 포함)`))
    if (state.cutOffResult && state.cutOffResult.excludedItems > 0) {
        els.push(bullet(`Cut-off 처리 항목 ${state.cutOffResult.excludedItems}개 (누적 영향 ${state.cutOffResult.excludedEmissionPercent.toFixed(1)}%)`))
    }
    if (!hasReview) {
        els.push(bullet('제3자 검증 미실시 — 외부 공개 전 ISO 14067 Clause 7.4 검증 필수'))
    }

    // 7.7.3 감축 권고
    els.push(h('7.7.3 감축 권고사항', HeadingLevel.HEADING_3))
    els.push(bullet('단기(1~3년): 1차 데이터(실측치) 수집을 통한 정확도 향상 + 재생전력(PPA) 도입 검토'))
    els.push(bullet('중기(3~5년): 공정 효율 개선 (폐열 회수, 보조화학물질 사용량 최적화)'))
    els.push(bullet('운송 수단 최적화 (해상 > 도로 > 항공) + 공급사 풀 재편으로 거리 단축'))
    els.push(bullet('포장재 경량화 + 재활용 소재 적용 + EOL 회수 시스템 구축'))

    // 7.7.4 향후 연구 방향
    els.push(h('7.7.4 향후 연구 방향', HeadingLevel.HEADING_3))
    els.push(bullet('PCR(Product Category Rules) 발간 시 재산정 + EPD 등록'))
    els.push(bullet('EU CBAM / 배터리 규정 (Ares 2024/3131389) 대응 시 EF v3.1 16개 영향범주 확장'))
    els.push(bullet('공급사 EPD 확보 시 BOM 매핑 갱신 → upstream 불확도 축소'))
    els.push(bullet('ISO 14067 Clause 7.4 제3자 검증으로 외부 신뢰도 확보'))

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  8~11장 + 부록
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh8to11(state: PCFState): El[] {
    const els: El[] = [pb()]

    // 8장: 가치 선택
    els.push(h('8. 가치 선택 및 정당화 — ISO 14067 7.3 n)'))
    const vc = state.valueChoices || []
    if (vc.length > 0) {
        els.push(makeTable(['결정사항', '선택', '대안', '정당화'],
            vc.map(v => [v.decision, v.category, v.alternative, v.justification])))
    } else {
        const charLabel = CHARACTERIZATION_MODEL_LABELS[state.characterizationModel || 'AR6']
        const moMethod = MULTI_OUTPUT_ALLOCATION_METHODS[state.multiOutputAllocation.method]
        const recMethod = RECYCLING_ALLOCATION_METHODS[state.recyclingAllocation.method]
        const autoRows: string[][] = [
            ['특성화 모델', `GWP₁₀₀ (${charLabel})`, 'GTP₁₀₀, GWP₂₀', 'ISO 14067 기본 요구사항'],
            ['시스템 경계', BOUNDARY_LABELS[state.productInfo.boundary] || state.productInfo.boundary, '기타', '제품 특성에 적합'],
        ]
        if (moMethod) autoRows.push(['할당 방법', moMethod.nameKo, '경제적 할당', 'ISO 계층 구조 적용'])
        if (recMethod) autoRows.push(['EoL 할당', recMethod.nameKo, 'CFF', '보수적 접근'])
        els.push(makeTable(['결정사항', '선택', '대안', '정당화'], autoRows))
    }

    // 9장: 대체 시나리오
    els.push(pb())
    els.push(h('9. 대체 시나리오 — ISO 14067 7.3 q)'))
    els.push(todo('대체 사용 프로파일 및 폐기 시나리오를 기술하세요. 민감도 분석의 시나리오 결과를 참조할 수 있습니다.'))

    // 10장: 보고 및 검토
    els.push(pb())
    els.push(h('10. 보고 및 검토 — ISO 14067 제7조'))
    const rv = state.reviewInfo
    els.push(h('10.1 검토 정보', HeadingLevel.HEADING_2))
    els.push(kvTable([
        ['검토 유형', REVIEW_TYPE_LABELS[rv?.reviewType || 'none']],
        ['검토자', rv?.reviewerName || '[해당 없음]'],
        ['검토 기관', rv?.reviewerOrganization || '[해당 없음]'],
        ['검토 일자', rv?.reviewDate || '[해당 없음]'],
    ]))
    els.push(h('10.2 비교 가능성 제한 — 7.3 m)', HeadingLevel.HEADING_2))
    els.push(p('본 보고서의 결과는 동일한 기능단위(또는 선언단위) · 시스템 경계 · PCR · 데이터 품질 · 할당 기준 · 특성화 인자를 적용한 CFP 연구와만 비교할 수 있습니다 (ISO 14067 6.6). 다른 조건에서 산정된 CFP 값과의 직접 비교는 ISO 14067 의도에 부합하지 않으며, 비교 주장 시 비판적 검토 보고서가 함께 제시되어야 합니다.'))

    els.push(h('10.3 면책 조항 (Disclaimer)', HeadingLevel.HEADING_2))
    // 형식 개선 #9 — 표준 면책 문안 (검증 전 잠정값 + 외부 사용 경고 + 책임 한계)
    els.push(p('본 보고서의 산정 결과는 사용자(Practitioner)가 입력한 활동 데이터의 정확성에 직접 의존하며, 입력값 변경 시 결과가 변동됩니다.', { italic: true }))
    els.push(p('외부 공개 · 환경성 주장(Environmental Claim) · EPD(Environmental Product Declaration) 등록 · EU CBAM 보고 · 경쟁 제품 비교 등 본 보고서의 결과를 외부에 사용하기 전, ISO 14067 Clause 6.7 또는 7.4에 따른 제3자 비판적 검토(Critical Review)를 완료해야 합니다. 검증 전 본 보고서의 모든 수치는 잠정값(provisional)으로 간주됩니다.', { italic: true }))
    els.push(p('본 보고서의 서술형 본문은 산정자(Practitioner)의 검토 · 승인을 거쳐 보고서에 포함되었으며, 본 보고서의 모든 산정 결과 · 해석 · 결론에 대한 최종 책임은 ISO 14067 Clause 7.5에 따라 산정 수행자에게 있습니다.', { italic: true }))

    // 11장: 성과 추적
    els.push(pb())
    els.push(h('11. 성과 추적 — ISO 14067 7.3 t)'))
    const history = state.cfpHistory || []
    if (history.length > 0) {
        els.push(makeTable(['일자', 'CFP (kg CO₂e)', '비고'],
            history.map(h => [h.date, h.cfpValue.toFixed(4), h.notes || '—'])))
    } else {
        els.push(note('최초 산정으로 성과 추적 이력이 없습니다.'))
    }

    return els
}

function buildAppendix(state: PCFState): El[] {
    const els: El[] = [pb()]
    els.push(h('부록'))

    els.push(h('부록 A. 용어 정의 (Glossary)', HeadingLevel.HEADING_2))
    els.push(makeTable(['용어', '정의'], [
        ['CFP', '제품의 전과정에서 발생하는 온실가스 배출 및 제거의 합계 (CO₂ 당량)'],
        ['FU / 기능단위 (Functional Unit)', '최종 제품의 성능을 정량적으로 나타내는 기준 (ISO 14067 6.3.2)'],
        ['DU / 선언단위 (Declared Unit)', 'B2B 중간재(반제품)의 단위 — 기능 정의가 어려운 경우 FU 대체 (ISO 14067 6.3.2)'],
        ['시스템 경계', 'CFP 산정에 포함되는 단위공정의 범위'],
        ['할당', '다중 산출물 프로세스의 환경 부하를 배분하는 절차'],
        ['GWP₁₀₀', '100년 기준 지구온난화지수'],
        ['LCI', '전과정 목록분석 — 투입물/산출물의 정량화'],
        ['DQR', 'Data Quality Rating — 데이터 품질 등급'],
        ['dLUC', '직접 토지이용변화 — 특정 토지의 용도 변경에 따른 배출'],
        ['iLUC', '간접 토지이용변화 — 토지 전용의 간접적 영향'],
        ['PCR', '제품군별 규칙 — 특정 제품군의 CFP 산정 세부 규칙'],
    ]))

    els.push(h('부록 B. 참고문헌 (References)', HeadingLevel.HEADING_2))
    // 형식 개선 #7 — 표준 인용 형식 (저자/연도/제목/발행처/URL)
    const refs: string[] = [
        '[1] ISO 14067:2018, Greenhouse gases — Carbon footprint of products — Requirements and guidelines for quantification. International Organization for Standardization, Geneva.',
        '[2] ISO 14044:2006, Environmental management — Life cycle assessment — Requirements and guidelines. ISO, Geneva.',
        '[3] ISO 14040:2006, Environmental management — Life cycle assessment — Principles and framework. ISO, Geneva.',
        '[4] IPCC (2021). Climate Change 2021: The Physical Science Basis. AR6 Working Group I. Cambridge University Press.',
        '[5] 한국환경공단 (2023). 국가 전력 배출계수. https://www.keco.or.kr',
        '[6] 환경부 · 한국환경산업기술원 (2023). 국가 LCI 데이터베이스 v2023.',
        '[7] Wernet, G. et al. (2016). The ecoinvent database version 3 (part I): overview and methodology. International Journal of Life Cycle Assessment 21, 1218–1230.',
        '[8] JRC (2023). Andreasi Bassi, S. et al. Updated characterisation and normalisation factors for the Environmental Footprint 3.1 method. JRC130796. doi:10.2760/798894',
        '[9] PEFCR Guidance v6.3 (2018). Product Environmental Footprint Category Rules Guidance, European Commission.',
        '[10] European Commission (2024). Annex — Ares(2024)3131389: Methodology for calculation and verification of the carbon footprint of EV batteries. https://eur-lex.europa.eu',
    ]
    for (const ref of refs) {
        els.push(new Paragraph({
            children: [new TextRun({ text: ref, size: 18, color: C.text, font: '맑은 고딕' })],
            spacing: { before: 40, after: 40, line: 320 },
            indent: { left: 480, hanging: 480 },
        }))
    }

    // 부록 C. 별첨 자료 안내 (3-cell 시각 그리드)
    els.push(h('부록 C. 별첨 자료 안내', HeadingLevel.HEADING_2))
    els.push(p('본 보고서와 함께 다음 자료가 제공됩니다 (요청 시 별도 송부).'))
    els.push(empty())
    els.push(attachmentGrid([
        { icon: '📊', title: '산정툴 Excel', description: 'CarbonMate 위저드 입력 데이터 + 단계별 계산식 raw 자료. 검증자 검토용.' },
        { icon: '🔍', title: 'Findings Log', description: '자동 산출 검증 체크리스트 (P0/P1 항목 + 수정 이력).' },
        { icon: '📋', title: 'PACT 데이터', description: 'WBCSD Pathfinder v2.2 호환 JSON. 고객사 시스템 연동용 (Pro 라이선스).' },
    ]) as unknown as Paragraph)
    els.push(note('AI 생성 narrative 원문(Carbony 페르소나 + 산정자 검토 이력)도 별도 요청 시 제공됩니다.'))

    // 부록 D. 검토 정보 + 수정 이력 (Revision History)
    els.push(h('부록 D. 검토 정보 및 수정 이력', HeadingLevel.HEADING_2))
    const rv = state.reviewInfo
    els.push(p('검토 정보:', { bold: true }))
    els.push(kvTable([
        ['검토 유형', REVIEW_TYPE_LABELS[rv?.reviewType || 'none']],
        ['검토자', rv?.reviewerName || '[해당 없음]'],
        ['검토 기관', rv?.reviewerOrganization || '[해당 없음]'],
        ['검토 일자', rv?.reviewDate || '[해당 없음]'],
    ]))
    els.push(empty())

    // 수정 이력 (Revision History) — cfpHistory에서 자동
    els.push(p('수정 이력 (Revision History):', { bold: true }))
    const history = state.cfpHistory || []
    if (history.length > 0) {
        els.push(makeTable(
            ['Rev', '일자', 'CFP (kg CO₂e)', '변경 사유'],
            history.map((s, i) => [
                `${(i / 10 + 0.1).toFixed(1)}`,
                s.date,
                s.cfpValue.toFixed(2),
                s.notes || '—',
            ])
        ))
    } else {
        els.push(makeTable(
            ['Rev', '일자', '작성자', '변경 사유'],
            [['1.0', new Date().toLocaleDateString('ko-KR'), state.reportMeta?.practitioner || 'CarbonMate', '최초 산정']]
        ))
    }

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  표 목차 + 그림 목차 (List of Tables / Figures)
//  sample-improved-report-v2 표준 — 정적 리스트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildListOfTablesAndFigures(): El[] {
    const els: El[] = []
    els.push(empty())
    els.push(h('표 목차 (List of Tables)', HeadingLevel.HEADING_2))
    const tables = [
        '표 1.  보고서 일반사항 — §1',
        '표 2.  제품 식별 — §2.1',
        '표 3.  제품 규격 및 인도 기준 — §2.2',
        '표 4.  단계별 4컬럼 요약 (단계/설명/투입물/산출물) — §2.6',
        '표 5.  데이터 대표성 (시간/지리/기술/유형) — §3.1',
        '표 6.  원료 BOM (출처 컬럼 포함) — §3.4',
        '표 7.  LCI Dataset 매핑 (Ecoinvent 정확명) — §3.4',
        '표 8.  물질수지 검증 — §3.4',
        '표 9.  공급사·구간별 운송 상세 — §3.5',
        '표 10. 할당 4단계 우선순위 검토 — §4.1',
        '표 11. EOL 처리경로 — §4.4',
        '표 12. 단계별 CFP 기여도 — §5.1',
        '표 13. 원료/활동 단위 기여도 Pareto — §5.8',
        '표 14. DQR Pedigree Matrix (TiR/TeR/GeR) — §6.2',
        '표 15. PEFCR 활동자료 등급 — §6.3',
        '표 16. 데이터 품질 9항목 자체평가 — §6.4',
        '표 17. 민감도 시나리오 사전 계획 — §7.2',
        '표 18. 시나리오 비교 (Baseline vs 대안) — §7.3',
        '표 19. ISO 14067 7.3 대응표 — §8',
        '표 20. 수정 이력 (Revision History) — 부록 D',
    ]
    for (const t of tables) {
        els.push(new Paragraph({
            children: [new TextRun({ text: t, size: 18, color: C.text, font: '맑은 고딕' })],
            spacing: { before: 30, after: 30 },
            indent: { left: 360 },
        }))
    }

    // 그림 목차 (List of Figures)
    els.push(empty())
    els.push(h('그림 목차 (List of Figures)', HeadingLevel.HEADING_2))
    const figures = [
        '그림 1. 시스템 경계 흐름도 (Cradle-to-Gate) — §2.3',
        '그림 2. Upstream / Core / Downstream 모듈 — §2.6',
        '그림 3. 단계별 기여도 차트 — §5.1',
        '그림 4. 원료 기여도 Pareto 차트 — §5.8',
        '그림 5. 시나리오 비교 차트 — §7.3',
    ]
    for (const f of figures) {
        els.push(new Paragraph({
            children: [new TextRun({ text: f, size: 18, color: C.text, font: '맑은 고딕' })],
            spacing: { before: 30, after: 30 },
            indent: { left: 360 },
        }))
    }
    els.push(pb())
    return els
}

/**
 * 면책 조항 페이지 (표지 직후 강조 — sample-v2 스타일).
 * 본문 §10.3과 별개로 표지 다음 페이지에 전체 면책을 box로 표시.
 */
function buildDisclaimerPage(): El[] {
    return [
        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({
            children: [new TextRun({ text: '⚠ 비교 가능성 제한 및 면책 조항', size: 32, bold: true, color: C.warnText, font: '맑은 고딕' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
        }),
        // 박스형 면책 (warm 배경)
        new Table({
            rows: [new TableRow({
                children: [new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({
                                text: '본 보고서의 결과는 동일한 기능단위(또는 선언단위) · 시스템 경계 · PCR · 데이터 품질 · 할당 기준 · 특성화 인자를 적용한 CFP 연구와만 비교 가능합니다 (ISO 14067 Clause 6.6).',
                                size: 20, color: C.warnText, font: '맑은 고딕',
                            })],
                            spacing: { before: 100, after: 100, line: 340 },
                        }),
                        new Paragraph({
                            children: [new TextRun({
                                text: '외부 공개 · 환경성 주장 · EPD 등록 · EU CBAM 보고 · 경쟁 제품 비교 등 본 보고서의 결과를 외부에 사용하기 전, ISO 14067 Clause 6.7 또는 7.4에 따른 제3자 비판적 검토(Critical Review)를 완료해야 합니다. 검증 전 본 보고서의 모든 수치는 잠정값(provisional)으로 간주됩니다.',
                                size: 20, color: C.warnText, font: '맑은 고딕',
                            })],
                            spacing: { before: 100, after: 100, line: 340 },
                        }),
                        new Paragraph({
                            children: [new TextRun({
                                text: '본 보고서의 모든 산정 결과 · 해석 · 결론에 대한 최종 책임은 ISO 14067 Clause 7.5에 따라 산정 수행자(Practitioner)에게 있습니다. AI 보조에 의해 생성된 서술형 본문은 산정자가 검토 · 승인하여 보고서에 포함됩니다.',
                                size: 20, color: C.warnText, font: '맑은 고딕',
                            })],
                            spacing: { before: 100, after: 100, line: 340 },
                        }),
                    ],
                    shading: { type: 'clear', color: 'auto', fill: C.warnBg } as { type: 'clear'; color: string; fill: string },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 8, color: C.warnBorder },
                        bottom: { style: BorderStyle.SINGLE, size: 8, color: C.warnBorder },
                        left: { style: BorderStyle.SINGLE, size: 32, color: C.warnBorder },
                        right: { style: BorderStyle.SINGLE, size: 8, color: C.warnBorder },
                    },
                    width: { size: 100, type: WidthType.PERCENTAGE },
                })],
            })],
            width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        pb(),
    ]
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인: ISO 14067 전체본 Word 보고서
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function generateFullWordReport(
    state: PCFState,
    result: TotalEmissionResult,
    options: FullReportOptions = {}
): Promise<Blob> {
    const { narratives } = options
    const doc = new Document({
        styles: {
            // Sample-v2 표준 폰트 크기 (Pt 단위 docx size = ×2):
            //  h1: 18pt(36) / h2: 13pt(26) / h3: 11pt(22) / body: 10pt(20)
            default: {
                document: { run: { font: '맑은 고딕', size: 20, color: C.text }, paragraph: { spacing: { line: 300 } } },
                heading1: { run: { font: '맑은 고딕', size: 36, bold: true, color: C.primary }, paragraph: { spacing: { before: 360, after: 160, line: 360 } } },
                heading2: { run: { font: '맑은 고딕', size: 26, bold: true, color: C.dark }, paragraph: { spacing: { before: 280, after: 120, line: 340 } } },
                heading3: { run: { font: '맑은 고딕', size: 22, bold: true, color: C.text }, paragraph: { spacing: { before: 160, after: 80, line: 320 } } },
            },
        },
        features: { updateFields: true },
        sections: [{
            properties: {
                page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
            },
            headers: {
                default: new Header({
                    children: [new Paragraph({
                        children: [
                            new TextRun({ text: 'ISO 14067:2018', size: 16, bold: true, color: C.primary, font: '맑은 고딕' }),
                            new TextRun({ text: '   |   Product Carbon Footprint Report', size: 16, color: C.textLight, font: '맑은 고딕' }),
                            new TextRun({ text: `\t\t${state.reportMeta?.reportNumber || `CM-PCF-${new Date().getFullYear()}-001`}`, size: 16, color: C.textLight, font: '맑은 고딕' }),
                        ],
                        alignment: AlignmentType.LEFT,
                    })],
                }),
            },
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        children: [
                            new TextRun({ text: `CarbonMate v${APP_VERSION}  ·  ISO 14067 CFP Report  ·  Page `, size: 14, color: C.textLight, font: '맑은 고딕' }),
                            new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 14, color: C.textLight, font: '맑은 고딕' }),
                        ],
                        alignment: AlignmentType.CENTER,
                    })],
                }),
            },
            children: [
                ...buildCover(state, result),
                ...buildDisclaimerPage(),
                h('목 차'), empty(),
                new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-3', stylesWithLevels: [new StyleLevel('Heading1', 1), new StyleLevel('Heading2', 2), new StyleLevel('Heading3', 3)] }) as unknown as Paragraph,
                ...buildListOfTablesAndFigures(),
                ...(buildCh1(state, narratives) as Paragraph[]),
                ...(buildCh2(state, narratives) as Paragraph[]),
                ...(buildCh3(state, result, narratives) as Paragraph[]),
                ...(buildCh4(state, result, narratives) as Paragraph[]),
                ...(buildCh5(state, result) as Paragraph[]),
                ...(buildCh6(state, result, narratives) as Paragraph[]),
                ...(buildCh7(state, result, narratives) as Paragraph[]),
                ...(buildCh8to11(state) as Paragraph[]),
                ...(buildAppendix(state) as Paragraph[]),
                empty(),
                new Paragraph({ children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', size: 20, color: C.border })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: `본 보고서는 CarbonMate Platform v${APP_VERSION}에서 자동 생성되었습니다.`, size: 16, color: C.textLight, font: '맑은 고딕', italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
            ],
        }],
    })
    return await Packer.toBlob(doc)
}
