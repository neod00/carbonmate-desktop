'use client'

import {
    Document, Packer, Paragraph, Table, TextRun,
    HeadingLevel, AlignmentType, TableOfContents, StyleLevel,
    Header, Footer, PageNumber, NumberFormat
} from 'docx'
import type { PCFState } from '@/lib/core/store'
import type { TotalEmissionResult } from '@/lib/core/emission-calculator'
import { GHG_LIST, EMISSION_FACTOR_SOURCES, METHODOLOGY_LIMITATIONS, CHARACTERIZATION_MODEL_LABELS } from '@/lib/iso14067-constants'
import { MULTI_OUTPUT_ALLOCATION_METHODS, RECYCLING_ALLOCATION_METHODS } from '@/lib/allocation'
import { analyzeUnitProcesses } from '@/lib/report/unit-process-mapper'
import {
    C, STAGE_LABELS, BOUNDARY_LABELS, REPORT_TYPE_LABELS, REVIEW_TYPE_LABELS,
    cell, h, p, bullet, note, todo, empty, pb, makeTable, kvTable
} from './report-docx-helpers'

type El = Paragraph | Table

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  표지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCover(state: PCFState, result: TotalEmissionResult): El[] {
    const cfp = result.allocation?.applied ? result.allocation.allocatedTotal : result.totalEmission
    const charLabel = CHARACTERIZATION_MODEL_LABELS[state.characterizationModel || 'AR6']
    const meta = state.reportMeta
    return [
        new Paragraph({ spacing: { before: 2000 } }),
        new Paragraph({ children: [new TextRun({ text: '제품 탄소발자국(CFP)', size: 52, bold: true, color: C.primary, font: 'Pretendard' })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new TextRun({ text: 'ISO 14067 산정 보고서', size: 48, bold: true, color: C.primary, font: 'Pretendard' })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: 'ISO 14067:2018 · ISO 14044:2006 준수', size: 24, italics: true, color: C.textLight, font: 'Pretendard' })], alignment: AlignmentType.CENTER, spacing: { after: 600 } }),
        new Paragraph({ children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', size: 20, color: C.primary })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
        new Paragraph({ children: [new TextRun({ text: `${cfp.toFixed(4)} kg CO₂e`, size: 64, bold: true, color: C.accent, font: 'Pretendard' })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new TextRun({ text: `per ${state.productInfo.unit || '기능단위'}`, size: 22, color: C.textLight, font: 'Pretendard' })], alignment: AlignmentType.CENTER, spacing: { after: 600 } }),
        kvTable([
            ['제품명', state.productInfo.name || '미지정'],
            ['의뢰자', meta?.commissioner || '[작성 필요]'],
            ['수행 기관', meta?.practitioner || 'CarbonMate Platform v2.0'],
            ['보고서 번호', meta?.reportNumber || `CM-PCF-${new Date().getFullYear()}-001`],
            ['시스템 경계', BOUNDARY_LABELS[state.productInfo.boundary] || state.productInfo.boundary],
            ['기준', `ISO 14067:2018 | GWP: ${charLabel}`],
            ['작성일', new Date().toLocaleDateString('ko-KR')],
        ]) as unknown as Paragraph,
        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({ children: [new TextRun({ text: 'CarbonMate Platform v2.0', size: 18, color: C.textLight, font: 'Pretendard', italics: true })], alignment: AlignmentType.CENTER }),
        pb(),
    ]
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  1장: 서론 및 일반사항
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh1(state: PCFState): El[] {
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

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  2장: 목표 및 범위 정의
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh2(state: PCFState): El[] {
    const els: El[] = [pb()]
    const meta = state.reportMeta

    els.push(h('2. 목표 및 범위 정의 (Goal & Scope) — ISO 14067 6.3'))

    // 2.1 기능단위
    els.push(h('2.1 기능단위 및 선언단위 — 7.3 a)', HeadingLevel.HEADING_2))
    els.push(kvTable([
        ['제품명', state.productInfo.name || '미지정'],
        ['제품 카테고리', state.productInfo.category || '미지정'],
        ['기능단위 (FU)', state.productInfo.unit || '[작성 필요]'],
        ['선언단위', state.productInfo.unit || '[작성 필요]'],
    ]))

    // 2.2 기준흐름
    els.push(h('2.2 기준흐름 (Reference Flow)', HeadingLevel.HEADING_2))
    if (state.productInfo.referenceFlow) {
        els.push(p(state.productInfo.referenceFlow))
    } else {
        els.push(note('기준흐름이 기능단위와 동일하게 설정되었습니다.'))
    }
    // 상세 활동 데이터에서 기준흐름 테이블 자동 생성
    const mats = state.detailedActivityData?.raw_materials
    if (mats && mats.length > 0) {
        els.push(p('투입물 목록:', { bold: true }))
        els.push(makeTable(['투입물', '수량', '단위', '비고'],
            mats.map(m => [m.name, m.quantity.toFixed(4), m.unit, m.materialType || '—'])))
    }

    // 2.3 시스템 경계
    els.push(h('2.3 시스템 경계 — 7.3 b)', HeadingLevel.HEADING_2))
    els.push(p(`경계 유형: ${BOUNDARY_LABELS[state.productInfo.boundary] || state.productInfo.boundary}`, { bold: true }))
    els.push(p('포함된 단계:', { bold: true }))
    state.stages.forEach(s => els.push(bullet(`✅ ${STAGE_LABELS[s] || s}`)))
    const excluded = ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol'].filter(s => !state.stages.includes(s))
    if (excluded.length > 0) {
        els.push(p('제외된 단계:', { bold: true }))
        excluded.forEach(s => els.push(bullet(`❌ ${STAGE_LABELS[s] || s}`)))
    }
    els.push(empty())
    els.push(p('시스템 경계 흐름도:', { bold: true }))
    // 텍스트 기반 흐름도
    const flow = state.stages.map(s => `[${STAGE_LABELS[s] || s}]`).join(' → ')
    els.push(p(flow, { bold: true, color: C.primary }))
    els.push(note('상세 공정 흐름도는 부록 C를 참조하세요.'))

    // 2.4 중요 단위공정
    els.push(h('2.4 중요 단위공정 목록 — 7.3 c)', HeadingLevel.HEADING_2))
    els.push(note('단위공정 분석 결과는 3.5절 및 5.1절에서 상세히 기술합니다.'))

    // 2.5 Cut-off
    els.push(h('2.5 제외(Cut-off) 기준 — 7.3 g)', HeadingLevel.HEADING_2))
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

    // 2.6 시간/지리/기술 범위
    els.push(h('2.6 시간적·지리적·기술적 범위 — 7.3 r)', HeadingLevel.HEADING_2))
    const tb = state.productInfo.timeBoundary
    els.push(kvTable([
        ['데이터 수집 기간', tb ? `${tb.dataCollectionStart} ~ ${tb.dataCollectionEnd}` : '[작성 필요]'],
        ['CFP 대표 연도', tb?.cfpRepresentativeYear || '[작성 필요]'],
        ['지리적 범위', meta?.geographicScope || '[작성 필요]'],
        ['기술적 범위', meta?.technologicalScope || '[작성 필요]'],
    ]))

    // 2.7 가정 및 제한
    els.push(h('2.7 가정 및 제한사항', HeadingLevel.HEADING_2))
    for (const lim of METHODOLOGY_LIMITATIONS) {
        els.push(bullet(`${lim.title} (${lim.isoReference}): ${lim.description}`))
    }

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  3장: LCI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh3(state: PCFState, result: TotalEmissionResult): El[] {
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

    // 3.2 온실가스 목록
    els.push(h('3.2 고려된 온실가스 목록 — 7.3 e)', HeadingLevel.HEADING_2))
    els.push(makeTable(['GHG', '화학식', `GWP₁₀₀ (${charModel})`, '포함 여부'], GHG_LIST.map(g => {
        const val = charModel === 'AR5' ? g.gwp100_ar5 : g.gwp100_ar6
        return [g.name, g.formula, val.toString(), '✅']
    })))

    // 3.3 특성화 인자
    els.push(h('3.3 특성화 인자 — 7.3 f)', HeadingLevel.HEADING_2))
    els.push(kvTable([
        ['특성화 모델', CHARACTERIZATION_MODEL_LABELS[charModel]],
        ['시간 범위', '100년 (GWP₁₀₀)'],
        ['기후-탄소 피드백', '포함'],
        ['결과 단위', 'kg CO₂e / 기능단위'],
    ]))

    // 3.4 활동 데이터 요약
    els.push(h('3.4 활동 데이터 요약', HeadingLevel.HEADING_2))
    const adEntries = Object.entries(state.activityData).filter(([, v]) => (v as number) > 0)
    if (adEntries.length > 0) {
        els.push(makeTable(['항목 ID', '값'], adEntries.map(([k, v]) => [k, Number(v).toFixed(4)])))
    } else {
        els.push(note('간소화된 활동 데이터가 없습니다. 상세 활동 데이터를 참조하세요.'))
    }

    // 3.5 단위공정
    els.push(h('3.5 중요 단위공정 식별 — 7.3 c)', HeadingLevel.HEADING_2))
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

    // 3.6 전력 처리
    els.push(h('3.6 전력 처리 정보 — 7.3 l)', HeadingLevel.HEADING_2))
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

function buildCh4(state: PCFState, result: TotalEmissionResult): El[] {
    const els: El[] = [pb()]
    els.push(h('4. 할당 (Allocation) — ISO 14067 6.4.6'))

    // 4.1 다중 산출물
    els.push(h('4.1 다중 산출물 할당 절차 — 7.3 h)', HeadingLevel.HEADING_2))
    const moMethod = MULTI_OUTPUT_ALLOCATION_METHODS[state.multiOutputAllocation.method]
    els.push(bullet(`방법: ${moMethod?.nameKo || state.multiOutputAllocation.method}`))
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
    if (state.stages.includes('eol')) {
        els.push(todo('폐기 처리 경로별 비율(소각/매립/재활용)을 기술하세요.'))
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

    // 5.4 dLUC/iLUC
    els.push(h('5.4 dLUC / iLUC 배출량 — 7.2 d)', HeadingLevel.HEADING_2))
    els.push(kvTable([
        ['dLUC (직접 토지이용변화)', '정량화 미실시'],
        ['iLUC (간접 토지이용변화)', '정량화 미실시'],
    ]))
    els.push(note('ISO 14067에 따라 별도 보고 대상이나, 현재 국제적으로 합의된 정량화 방법론이 부재하여 정량화하지 않았습니다.'))

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

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  6장: 데이터 품질
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh6(state: PCFState): El[] {
    const els: El[] = [pb()]
    els.push(h('6. 데이터 품질 평가 — ISO 14067 7.3 j)'))

    els.push(h('6.1 데이터 품질 평가 방법', HeadingLevel.HEADING_2))
    els.push(p('데이터 품질은 ISO 14044 및 PEF Guide의 DQR(Data Quality Rating) 방법론에 따라 5개 지표로 평가하였다.'))
    els.push(kvTable([
        ['전체 데이터 유형', state.dataQualityMeta.overallType === 'primary' ? '1차 데이터' : state.dataQualityMeta.overallType === 'secondary' ? '2차 데이터' : '추정 데이터'],
        ['참조 DB', state.dataQualityMeta.sources.join(', ')],
        ['기준 연도', state.dataQualityMeta.baseYear.toString()],
    ]))

    els.push(h('6.2 데이터 품질 매트릭스 (DQR)', HeadingLevel.HEADING_2))
    // 상세 활동 데이터에서 DQR 생성
    const mats = state.detailedActivityData?.raw_materials || []
    if (mats.length > 0) {
        els.push(makeTable(
            ['데이터 항목', 'TiR (시간)', 'TeR (기술)', 'GeR (지리)', '완전성', '신뢰성', 'DQR 평균', '등급'],
            mats.map(m => {
                const dq = m.lciGuide?.dataQuality
                const tir = dq?.time || 3
                const ter = dq?.technology || 3
                const ger = dq?.geography || 3
                const comp = 2
                const rel = m.dataQuality.type === 'primary' ? 1 : m.dataQuality.type === 'secondary' ? 2 : 4
                const avg = ((tir + ter + ger + comp + rel) / 5)
                const grade = avg <= 1.6 ? '우수' : avg <= 3.0 ? '양호' : '개선필요'
                return [m.name, String(tir), String(ter), String(ger), String(comp), String(rel), avg.toFixed(1), grade]
            })
        ))
    } else {
        els.push(todo('상세 활동 데이터를 입력하면 DQR 매트릭스가 자동 생성됩니다.'))
    }

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  7장: 전과정 해석
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCh7(state: PCFState, result: TotalEmissionResult): El[] {
    const els: El[] = [pb()]
    const cfp = result.allocation?.applied ? result.allocation.allocatedTotal : result.totalEmission

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

    // 7.2 민감도 분석
    els.push(h('7.2 민감도 분석 — 7.3 k)', HeadingLevel.HEADING_2))
    const sa = state.sensitivityAnalysis
    if (sa) {
        els.push(bullet(`기준 CFP: ${sa.baselineCFP.toFixed(4)} kg CO₂e`))
        if (sa.scenarios?.length > 0) {
            els.push(makeTable(['시나리오', '파라미터', '변동률', '유의성'],
                sa.scenarios.map(s => [s.nameKo || s.name, s.parameterChanged, `${s.percentageChange >= 0 ? '+' : ''}${s.percentageChange.toFixed(1)}%`, s.isSignificant ? '⚠️' : '✅'])))
        }
    } else {
        els.push(note('민감도 분석이 수행되지 않았습니다.'))
    }

    // 7.3 불확도
    els.push(h('7.3 불확도 평가', HeadingLevel.HEADING_2))
    els.push(p(`종합 불확도: ±${result.avgUncertainty.toFixed(0)}%`))
    els.push(p(`CFP 범위: ${(cfp * (1 - result.avgUncertainty / 100)).toFixed(4)} ~ ${(cfp * (1 + result.avgUncertainty / 100)).toFixed(4)} kg CO₂e`))

    // 7.4 완전성 점검
    els.push(h('7.4 완전성 점검', HeadingLevel.HEADING_2))
    const checks: [string, boolean][] = [
        ['모든 활성 단계에 대해 활동 데이터 입력됨', state.stages.length > 0],
        ['배출계수가 모든 투입물에 적용됨', true],
        ['Cut-off 제외 항목의 누적 기여도 5% 미만', !state.cutOffResult || state.cutOffResult.excludedEmissionPercent < 5],
        ['에너지 및 물질 투입 모두 고려됨', state.stages.includes('raw_materials') && state.stages.includes('manufacturing')],
    ]
    checks.forEach(([desc, ok]) => els.push(bullet(`${ok ? '☑' : '☐'} ${desc}`)))

    // 7.5 일관성 검토
    els.push(h('7.5 일관성 검토', HeadingLevel.HEADING_2))
    els.push(bullet(`☑ 동일한 특성화 모델(${state.characterizationModel || 'AR6'}) 전 단계 적용`))
    els.push(bullet('☑ 할당 방법이 시스템 경계 전체에 일관적'))
    els.push(bullet('☑ 데이터 수집 기간이 모든 단계에서 동일'))

    // 7.6 감축 권고
    els.push(h('7.6 감축 권고사항', HeadingLevel.HEADING_2))
    els.push(bullet('1차 데이터(실측치) 수집을 통한 정확도 향상'))
    els.push(bullet('저탄소 원료 또는 재생 에너지 전환 검토'))
    els.push(bullet('운송 수단 최적화 (해상 > 도로 > 항공)'))
    els.push(bullet('포장재 경량화 및 재활용 소재 적용'))

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
    els.push(p('본 보고서의 결과는 동일한 PCR, 시스템 경계, 데이터 품질을 기반으로 산정된 다른 CFP 연구와만 비교할 수 있습니다.'))
    els.push(h('10.3 면책 조항', HeadingLevel.HEADING_2))
    els.push(p('본 보고서는 CarbonMate 플랫폼의 자동 산정 기능을 통해 생성되었으며, 입력 데이터의 정확성에 따라 결과가 변동될 수 있습니다. 외부 비교 주장 시 ISO 14067 6.7에 따른 비판적 검토가 필수적입니다.', { italic: true }))

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
        ['FU / 기능단위', '분석 대상 제품의 성능을 정량적으로 나타내는 기준'],
        ['시스템 경계', 'CFP 산정에 포함되는 단위공정의 범위'],
        ['할당', '다중 산출물 프로세스의 환경 부하를 배분하는 절차'],
        ['GWP₁₀₀', '100년 기준 지구온난화지수'],
        ['LCI', '전과정 목록분석 — 투입물/산출물의 정량화'],
        ['DQR', 'Data Quality Rating — 데이터 품질 등급'],
        ['dLUC', '직접 토지이용변화 — 특정 토지의 용도 변경에 따른 배출'],
        ['iLUC', '간접 토지이용변화 — 토지 전용의 간접적 영향'],
        ['PCR', '제품군별 규칙 — 특정 제품군의 CFP 산정 세부 규칙'],
    ]))

    els.push(h('부록 B. 참조 문서 (References)', HeadingLevel.HEADING_2))
    els.push(bullet('ISO 14067:2018 — Greenhouse gases — Carbon footprint of products'))
    els.push(bullet('ISO 14044:2006 — Environmental management — Life cycle assessment'))
    els.push(bullet('ISO 14040:2006 — Life cycle assessment — Principles and framework'))
    els.push(bullet('IPCC AR6 (2021) — Climate Change 2021: The Physical Science Basis'))
    els.push(bullet('환경부/한국환경산업기술원 — 국가 LCI 데이터베이스'))
    els.push(bullet('Ecoinvent v3.12 — Life Cycle Inventory Database'))

    els.push(h('부록 C. 시스템 경계 상세 흐름도', HeadingLevel.HEADING_2))
    const flow = state.stages.map(s => `[${STAGE_LABELS[s] || s}]`).join(' → ')
    els.push(p(flow, { bold: true, color: C.primary }))
    els.push(note('상세 공정 흐름도는 의뢰자와 협의하여 보완하시기 바랍니다.'))

    return els
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인: ISO 14067 전체본 Word 보고서
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function generateFullWordReport(state: PCFState, result: TotalEmissionResult): Promise<Blob> {
    const doc = new Document({
        styles: {
            default: {
                document: { run: { font: 'Pretendard', size: 20, color: C.text }, paragraph: { spacing: { line: 300 } } },
                heading1: { run: { font: 'Pretendard', size: 32, bold: true, color: C.primary }, paragraph: { spacing: { before: 400, after: 200, line: 360 } } },
                heading2: { run: { font: 'Pretendard', size: 26, bold: true, color: C.dark }, paragraph: { spacing: { before: 300, after: 150, line: 340 } } },
                heading3: { run: { font: 'Pretendard', size: 22, bold: true, color: C.text }, paragraph: { spacing: { before: 200, after: 100, line: 320 } } },
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
                        children: [new TextRun({ text: `ISO 14067 CFP 보고서 — ${state.productInfo.name || '제품'}`, size: 16, color: C.textLight, font: 'Pretendard', italics: true })],
                        alignment: AlignmentType.RIGHT,
                    })],
                }),
            },
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        children: [
                            new TextRun({ text: 'ISO 14067:2018 | CarbonMate v2.0    ', size: 14, color: C.textLight, font: 'Pretendard' }),
                            new TextRun({ children: ['— ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES, ' —'], size: 14, color: C.textLight, font: 'Pretendard' }),
                        ],
                        alignment: AlignmentType.CENTER,
                    })],
                }),
            },
            children: [
                ...buildCover(state, result),
                h('목 차'), empty(),
                new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-3', stylesWithLevels: [new StyleLevel('Heading1', 1), new StyleLevel('Heading2', 2), new StyleLevel('Heading3', 3)] }) as unknown as Paragraph,
                ...(buildCh1(state) as Paragraph[]),
                ...(buildCh2(state) as Paragraph[]),
                ...(buildCh3(state, result) as Paragraph[]),
                ...(buildCh4(state, result) as Paragraph[]),
                ...(buildCh5(state, result) as Paragraph[]),
                ...(buildCh6(state) as Paragraph[]),
                ...(buildCh7(state, result) as Paragraph[]),
                ...(buildCh8to11(state) as Paragraph[]),
                ...(buildAppendix(state) as Paragraph[]),
                empty(),
                new Paragraph({ children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', size: 20, color: C.border })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: '본 보고서는 CarbonMate Platform v2.0에서 자동 생성되었습니다.', size: 16, color: C.textLight, font: 'Pretendard', italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
            ],
        }],
    })
    return await Packer.toBlob(doc)
}
