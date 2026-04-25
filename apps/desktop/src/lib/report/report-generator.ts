/**
 * ISO 14067 7항 하이브리드 CFP 보고서 자동 생성 엔진
 * 
 * Part A: 경영진용 요약 (Executive Summary) — 직관적, 한 눈에 파악
 * Part B: ISO 14067 기술 보고서 — 검증인/심사원용 상세 정보
 * 부록: 용어 정의, 참조 문서
 * 
 * 모든 데이터는 PCFState(Zustand Store)에서 자동 추출합니다.
 */

import type { PCFState, ValueChoice } from '@/lib/core/store'
import type { TotalEmissionResult } from '@/lib/core/emission-calculator'
import type { SensitivityAnalysisResult, SensitivityScenario } from '@/lib/core/sensitivity-analysis'
import { GHG_LIST, EMISSION_FACTOR_SOURCES, METHODOLOGY_LIMITATIONS } from '@/lib/iso14067-constants'
import {
    MULTI_OUTPUT_ALLOCATION_METHODS,
    RECYCLING_ALLOCATION_METHODS
} from '@/lib/allocation'

// =============================================================================
// 타입 정의
// =============================================================================

export interface ReportDocument {
    title: string
    generatedAt: string
    version: string
    partA: string   // Executive Summary (Markdown)
    partB: string   // Technical Report (Markdown)
    appendix: string // 부록 (Markdown)
    fullReport: string // 전체 통합 본문
}

export interface ReportGenerationOptions {
    includePartA?: boolean
    includePartB?: boolean
    includeAppendix?: boolean
    language?: 'ko' | 'en'
}

// =============================================================================
// 단계별 라벨
// =============================================================================

const STAGE_LABELS: Record<string, string> = {
    raw_materials: '원료 채취 (Raw Materials)',
    manufacturing: '제조 (Manufacturing)',
    transport: '운송 (Transport)',
    packaging: '포장 (Packaging)',
    use: '사용 (Use Phase)',
    eol: '폐기 (End-of-Life)'
}

const BOUNDARY_LABELS: Record<string, string> = {
    'cradle-to-gate': '요람에서 공장 문까지 (Cradle-to-Gate)',
    'cradle-to-grave': '요람에서 무덤까지 (Cradle-to-Grave)',
    'gate-to-gate': '공장 내 (Gate-to-Gate)'
}

// =============================================================================
// 메인 생성 함수
// =============================================================================

/**
 * PCF Store 전체 상태에서 하이브리드 보고서를 자동 생성합니다.
 */
export function generateReport(
    state: PCFState,
    result: TotalEmissionResult,
    options: ReportGenerationOptions = {}
): ReportDocument {
    const {
        includePartA = true,
        includePartB = true,
        includeAppendix = true,
    } = options

    const now = new Date().toISOString()
    const title = `제품 탄소발자국(PCF) 산정 보고서: ${state.productInfo.name || '미지정 제품'}`

    const partA = includePartA ? generatePartA(state, result) : ''
    const partB = includePartB ? generatePartB(state, result) : ''
    const appendix = includeAppendix ? generateAppendix(state) : ''

    const fullReport = [
        `# ${title}`,
        '',
        `> 생성일: ${new Date(now).toLocaleDateString('ko-KR')}`,
        `> ISO 14067:2018 Section 7 준수`,
        `> CarbonMate Platform v2.0 자동 생성`,
        '',
        '---',
        '',
        partA,
        partB,
        appendix
    ].filter(Boolean).join('\n')

    return {
        title,
        generatedAt: now,
        version: '2.0',
        partA,
        partB,
        appendix,
        fullReport
    }
}

// =============================================================================
// Part A: 경영진용 요약 (Executive Summary)
// =============================================================================

function generatePartA(state: PCFState, result: TotalEmissionResult): string {
    const { productInfo, stages } = state
    const { totalEmission, totalFossil, totalBiogenic, totalAircraft, avgUncertainty, stageResults, allocation } = result

    const displayCFP = allocation?.applied ? allocation.allocatedTotal : totalEmission

    const sections: string[] = []

    // --- 제품 개요 ---
    sections.push(`## Part A. 경영진 요약 (Executive Summary)`)
    sections.push('')
    sections.push(`### 1. 제품 개요`)
    sections.push('')
    sections.push(`| 항목 | 내용 |`)
    sections.push(`| :--- | :--- |`)
    sections.push(`| **제품명** | ${productInfo.name || '미지정'} |`)
    sections.push(`| **제품 카테고리** | ${productInfo.category || '미지정'} |`)
    sections.push(`| **기능단위 (Functional Unit)** | ${productInfo.unit || '미지정'} |`)
    sections.push(`| **기준흐름 (Reference Flow)** | ${productInfo.referenceFlow || '기능단위와 동일'} |`)
    sections.push(`| **시스템 경계** | ${BOUNDARY_LABELS[productInfo.boundary] || productInfo.boundary} |`)
    sections.push(`| **포함 단계** | ${stages.map(s => STAGE_LABELS[s] || s).join(', ')} |`)
    if (productInfo.timeBoundary) {
        sections.push(`| **데이터 수집 기간** | ${productInfo.timeBoundary.dataCollectionStart} ~ ${productInfo.timeBoundary.dataCollectionEnd} |`)
        sections.push(`| **CFP 대표 연도** | ${productInfo.timeBoundary.cfpRepresentativeYear} |`)
    }
    sections.push('')

    // --- CFP 핵심 결과 ---
    sections.push(`### 2. CFP 산정 결과`)
    sections.push('')
    sections.push(`| 지표 | 값 | 단위 |`)
    sections.push(`| :--- | ---: | :--- |`)
    sections.push(`| **총 탄소발자국 (CFP)** | **${displayCFP.toFixed(4)}** | **kg CO₂e / ${productInfo.unit}** |`)
    sections.push(`| 화석 기원 GHG 배출 | ${(allocation?.applied ? allocation.allocatedFossil : totalFossil).toFixed(4)} | kg CO₂e |`)
    sections.push(`| 생물 기원 GHG 배출 | ${(allocation?.applied ? allocation.allocatedBiogenic : totalBiogenic).toFixed(4)} | kg CO₂e |`)
    sections.push(`| 항공 운송 GHG 배출 | ${(allocation?.applied ? allocation.allocatedAircraft : totalAircraft).toFixed(4)} | kg CO₂e |`)
    sections.push(`| 불확실성 범위 | ±${avgUncertainty.toFixed(0)}% | — |`)
    sections.push(`| 불확실성 하한 | ${(displayCFP * (1 - avgUncertainty / 100)).toFixed(4)} | kg CO₂e |`)
    sections.push(`| 불확실성 상한 | ${(displayCFP * (1 + avgUncertainty / 100)).toFixed(4)} | kg CO₂e |`)
    sections.push('')

    // 할당 적용 시 추가 정보
    if (allocation?.applied) {
        sections.push(`> ℹ️ **할당 적용**: ${allocation.methodLabel} (주제품 비율: ${(allocation.mainProductShare * 100).toFixed(1)}%)`)
        sections.push(`> 할당 전 총 배출량: ${totalEmission.toFixed(4)} kg CO₂e → 할당 후: ${allocation.allocatedTotal.toFixed(4)} kg CO₂e`)
        sections.push(`> 부산물 배분량: ${allocation.coProductsReduction.toFixed(4)} kg CO₂e`)
        sections.push('')
    }

    // --- P1-3: GHG별 배출량 분해 (ISO 14067 7.2 b,c / 7.3 e) ---
    if (result.ghgBreakdown && Object.keys(result.ghgBreakdown).length > 0) {
        sections.push(`### 2-1. 온실가스별 배출량 분해 (ISO 14067 7.3 e)`)
        sections.push('')
        sections.push(`| 온실가스 | 배출량 (kg CO₂e) | 비율 (%) |`)
        sections.push(`| :--- | ---: | ---: |`)

        const ghgEntries = Object.entries(result.ghgBreakdown)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))

        for (const [ghgKey, value] of ghgEntries) {
            if (Math.abs(value) < 0.000001) continue
            const pct = displayCFP > 0 ? (value / displayCFP) * 100 : 0
            const label = ghgKey.replace('_fossil', ' (화석)').replace('_biogenic', ' (생물기원)')
            sections.push(`| ${label} | ${value.toFixed(6)} | ${pct.toFixed(1)}% |`)
        }
        sections.push('')

        // 주요 GHG 요약
        const dominantGHG = ghgEntries[0]
        if (dominantGHG) {
            sections.push(`> 💡 **주요 온실가스**: ${dominantGHG[0].replace('_fossil', ' (화석)').replace('_biogenic', ' (생물기원)')} — 전체 배출의 ${displayCFP > 0 ? ((dominantGHG[1] / displayCFP) * 100).toFixed(1) : '0'}% 차지`)
            sections.push('')
        }
    }

    // --- 단계별 기여도 ---
    sections.push(`### 3. 단계별 기여도 분석`)
    sections.push('')
    sections.push(`| 단계 | 배출량 (kg CO₂e) | 기여도 (%) |`)
    sections.push(`| :--- | ---: | ---: |`)

    const sortedStages = stages
        .map(stage => ({
            stage,
            label: STAGE_LABELS[stage] || stage,
            emission: allocation?.applied
                ? (allocation.allocatedStageResults[stage]?.total || 0)
                : (stageResults[stage]?.total || 0)
        }))
        .sort((a, b) => b.emission - a.emission)

    for (const { label, emission } of sortedStages) {
        const pct = displayCFP > 0 ? (emission / displayCFP) * 100 : 0
        sections.push(`| ${label} | ${emission.toFixed(4)} | ${pct.toFixed(1)}% |`)
    }
    sections.push('')

    // --- 감축 제언 ---
    sections.push(`### 4. 감축 전략 및 권고사항`)
    sections.push('')

    const topStage = sortedStages[0]
    if (topStage) {
        sections.push(`**최대 기여 단계**: ${topStage.label} (${((topStage.emission / displayCFP) * 100).toFixed(1)}%)`)
        sections.push('')
        sections.push(`이 단계의 배출량을 10% 줄이면 전체 CFP가 약 **${(topStage.emission * 0.1).toFixed(4)} kg CO₂e** 감축됩니다.`)
        sections.push('')
    }

    sections.push(`**일반 권고사항**:`)
    sections.push(`1. 1차 데이터(실측치) 수집을 통한 정확도 향상`)
    sections.push(`2. 저탄소 원료 또는 재생 에너지 전환 검토`)
    sections.push(`3. 운송 수단 최적화 (해상 운송 > 도로 운송 > 항공 운송)`)
    sections.push(`4. 포장재 경량화 및 재활용 소재 적용`)
    sections.push(`5. 폐기 단계 재활용률 개선 검토`)
    sections.push('')

    return sections.join('\n')
}

// =============================================================================
// Part B: ISO 14067 기술 보고서
// =============================================================================

function generatePartB(state: PCFState, result: TotalEmissionResult): string {
    const sections: string[] = []

    sections.push(`## Part B. ISO 14067 기술 보고서 (Technical Report)`)
    sections.push('')

    // --- B.1 목표 및 범위 ---
    sections.push(`### 5. 목표 및 범위 정의 (ISO 14067 7.3 a, b)`)
    sections.push('')
    sections.push(generateGoalAndScope(state))

    // --- B.2 시스템 경계 및 단위공정 ---
    sections.push(`### 6. 시스템 경계 및 단위공정 (ISO 14067 7.3 b, c)`)
    sections.push('')
    sections.push(generateSystemBoundary(state))

    // --- B.3 LCI 상세 및 Cut-off ---
    sections.push(`### 7. 전과정 목록분석(LCI) 상세 (ISO 14067 7.3 d, e, f, g)`)
    sections.push('')
    sections.push(generateLCIDetails(state, result))

    // --- B.4 할당 절차 ---
    sections.push(`### 8. 할당 절차 (ISO 14067 7.3 h)`)
    sections.push('')
    sections.push(generateAllocationDetails(state, result))

    // --- B.5 전력 처리 ---
    sections.push(`### 9. 전력 처리 정보 (ISO 14067 7.3 l)`)
    sections.push('')
    sections.push(generateElectricityInfo(state))

    // --- B.6 데이터 품질 ---
    sections.push(`### 10. 데이터 품질 (ISO 14067 7.3 j)`)
    sections.push('')
    sections.push(generateDataQuality(state))

    // --- B.7 민감도 분석 ---
    sections.push(`### 11. 민감도 분석 (ISO 14067 7.3 k)`)
    sections.push('')
    sections.push(generateSensitivityAnalysis(state))

    // --- B.8 가치 선택 ---
    sections.push(`### 12. 가치 선택 및 정당화 (ISO 14067 7.3 n)`)
    sections.push('')
    sections.push(generateValueChoices(state))

    // --- B.9 제한사항 ---
    sections.push(`### 13. 제한사항 및 주의사항 (ISO 14067 7.3 m)`)
    sections.push('')
    sections.push(generateLimitations(state))

    return sections.join('\n')
}

// =============================================================================
// Part B 세부 함수들
// =============================================================================

function generateGoalAndScope(state: PCFState): string {
    const { productInfo } = state
    const goal = productInfo.studyGoal
    const lines: string[] = []

    lines.push(`**기능단위 (Functional Unit)**: ${productInfo.unit}`)
    lines.push('')
    lines.push(`**기준흐름 (Reference Flow)**: ${productInfo.referenceFlow || '기능단위와 동일 — ' + productInfo.unit}`)
    lines.push('')

    if (goal) {
        lines.push(`**연구 목적**: ${goal.applicationPurpose || '미기재'}`)
        lines.push('')
        lines.push(`**수행 이유**: ${goal.reasonForStudy || '미기재'}`)
        lines.push('')
        lines.push(`**대상 청중**: ${goal.targetAudience || '미기재'}`)
        lines.push('')
        lines.push(`**외부 정보전달 의도**: ${goal.isCommunicationIntended ? '예' : '아니오'}`)
        if (goal.cfpPcrReference) {
            lines.push(``)
            lines.push(`**적용 CFP-PCR**: ${goal.cfpPcrReference}`)
        }
    } else {
        lines.push(`> ⚠️ 연구 목적 정보가 입력되지 않았습니다. ISO 14067 6.3.1에 따라 연구 목적, 대상 청중 등을 명시해야 합니다.`)
    }
    lines.push('')

    return lines.join('\n')
}

function generateSystemBoundary(state: PCFState): string {
    const { productInfo, stages } = state
    const lines: string[] = []

    lines.push(`**시스템 경계 유형**: ${BOUNDARY_LABELS[productInfo.boundary] || productInfo.boundary}`)
    lines.push('')
    lines.push(`**포함된 단계**:`)
    stages.forEach(s => {
        lines.push(`- ✅ ${STAGE_LABELS[s] || s}`)
    })
    lines.push('')

    const allStages = ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol']
    const excluded = allStages.filter(s => !stages.includes(s))
    if (excluded.length > 0) {
        lines.push(`**제외된 단계**:`)
        excluded.forEach(s => {
            lines.push(`- ❌ ${STAGE_LABELS[s] || s}`)
        })
        lines.push('')
    }

    // Cut-off 기준
    if (state.cutOffResult) {
        const cor = state.cutOffResult
        lines.push(`**Cut-off 기준 (ISO 14067 6.3.4.3)**:`)
        lines.push(`- 에너지 기준: ${(state.cutOffCriteria.energyThreshold * 100).toFixed(0)}%`)
        lines.push(`- 질량 기준: ${(state.cutOffCriteria.massThreshold * 100).toFixed(0)}%`)
        if (cor.excludedItems > 0) {
            lines.push(`- 제외된 항목 수: ${cor.excludedItems}개`)
            lines.push(`- 누적 커버리지: ${(100 - cor.excludedEmissionPercent).toFixed(1)}%`)
        }
        lines.push('')
    }

    return lines.join('\n')
}

function generateLCIDetails(state: PCFState, result: TotalEmissionResult): string {
    const lines: string[] = []

    // GHG 목록
    lines.push(`#### 7.1 고려된 온실가스 목록 (ISO 14067 7.3 e)`)
    lines.push('')
    lines.push(`| GHG | 화학식 | GWP₁₀₀ (AR6) |`)
    lines.push(`| :--- | :---: | ---: |`)
    for (const ghg of GHG_LIST) {
        lines.push(`| ${ghg.name} | ${ghg.formula} | ${ghg.gwp100_ar6} |`)
    }
    lines.push('')

    // 특성화 인자
    lines.push(`#### 7.2 특성화 인자 (ISO 14067 7.3 f)`)
    lines.push('')
    lines.push(`- **적용 모델**: IPCC AR6 (2021) GWP₁₀₀`)
    lines.push(`- **시간 범위**: 100년`)
    lines.push(`- **기후 피드백**: 포함`)
    lines.push('')

    // 배출계수 출처
    lines.push(`#### 7.3 배출계수 출처 (ISO 14067 7.3 d)`)
    lines.push('')
    lines.push(`| 데이터베이스 | 기관 | 연도 |`)
    lines.push(`| :--- | :--- | :---: |`)
    for (const [, source] of Object.entries(EMISSION_FACTOR_SOURCES)) {
        const org = (source as any).organization || (source as any).version || '—'
        lines.push(`| ${source.name} | ${org} | ${source.year} |`)
    }
    lines.push('')

    // 활동 데이터 요약
    lines.push(`#### 7.4 활동 데이터 요약`)
    lines.push('')
    const adEntries = Object.entries(state.activityData).filter(([, v]) => v > 0)
    if (adEntries.length > 0) {
        lines.push(`| 항목 ID | 값 |`)
        lines.push(`| :--- | ---: |`)
        for (const [key, value] of adEntries) {
            lines.push(`| ${key} | ${Number(value).toFixed(4)} |`)
        }
    } else {
        lines.push(`> 간소화된 활동 데이터가 없습니다. 상세 활동 데이터(원료, 수송, 포장)를 확인하세요.`)
    }
    lines.push('')

    // P1-3: 단계별 GHG 분해 상세 (ISO 14067 7.3 e)
    lines.push(`#### 7.5 온실가스별 배출량 상세 분해 (ISO 14067 7.2 b,c / 7.3 e)`)
    lines.push('')

    // 전체 GHG 분해
    if (result.ghgBreakdown && Object.keys(result.ghgBreakdown).length > 0) {
        lines.push(`**전체 GHG 분해:**`)
        lines.push('')
        lines.push(`| 온실가스 | 배출량 (kg CO₂e) |`)
        lines.push(`| :--- | ---: |`)
        for (const [ghg, val] of Object.entries(result.ghgBreakdown).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
            if (Math.abs(val) < 0.000001) continue
            const label = ghg.replace('_fossil', ' (화석)').replace('_biogenic', ' (생물기원)')
            lines.push(`| ${label} | ${val.toFixed(6)} |`)
        }
        lines.push('')
    }

    // 단계별 GHG 분해
    const stageResults = result.stageResults
    if (stageResults) {
        const stagesWithGHG = Object.entries(stageResults)
            .filter(([, sr]) => sr.ghgBreakdown && Object.keys(sr.ghgBreakdown).length > 0)

        if (stagesWithGHG.length > 0) {
            lines.push(`**단계별 GHG 분해:**`)
            lines.push('')

            // 헤더 구성: 모든 GHG 키 수집
            const allGHGKeys = new Set<string>()
            for (const [, sr] of stagesWithGHG) {
                Object.keys(sr.ghgBreakdown).forEach(k => allGHGKeys.add(k))
            }
            const ghgKeys = Array.from(allGHGKeys).sort()

            lines.push(`| 단계 | ${ghgKeys.map(k => k.replace('_fossil', '(화석)').replace('_biogenic', '(바이오)')).join(' | ')} | 합계 |`)
            lines.push(`| :--- | ${ghgKeys.map(() => '---:').join(' | ')} | ---: |`)

            for (const [stage, sr] of stagesWithGHG) {
                const stageLabel = STAGE_LABELS[stage] || stage
                const values = ghgKeys.map(k => (sr.ghgBreakdown[k] || 0).toFixed(4))
                const total = sr.total.toFixed(4)
                lines.push(`| ${stageLabel} | ${values.join(' | ')} | ${total} |`)
            }
            lines.push('')
        }
    }

    lines.push(`> 📌 GHG 분해는 배출 기원(화석/생물기원)별 대표 비율을 기반으로 산정되었습니다.`)
    lines.push(`> CO₂: 95%, CH₄: 3%, N₂O: 2% (화석 기원 기본 비율)`)
    lines.push('')

    return lines.join('\n')
}

function generateAllocationDetails(state: PCFState, result: TotalEmissionResult): string {
    const { multiOutputAllocation, recyclingAllocation } = state
    const lines: string[] = []

    // 다중 산출물 할당
    lines.push(`#### 8.1 다중 산출물 할당`)
    lines.push('')

    const methodInfo = MULTI_OUTPUT_ALLOCATION_METHODS[multiOutputAllocation.method]
    lines.push(`- **할당 방법**: ${methodInfo?.nameKo || multiOutputAllocation.method}`)
    lines.push(`- **설명**: ${methodInfo?.descriptionKo || '—'}`)
    lines.push(`- **ISO 우선순위**: ${methodInfo?.priority || '—'}순위`)
    if (multiOutputAllocation.physicalBasis) {
        lines.push(`- **물리적 기준**: ${multiOutputAllocation.physicalBasis}`)
    }
    lines.push('')

    if (multiOutputAllocation.coProducts && multiOutputAllocation.coProducts.length > 0) {
        lines.push(`**공동 산출물(Co-products)**:`)
        lines.push('')
        lines.push(`| 산출물 | 수량 | 단위 | 할당 비율 |`)
        lines.push(`| :--- | ---: | :--- | ---: |`)

        if (multiOutputAllocation.mainProductData) {
            const mp = multiOutputAllocation.mainProductData
            lines.push(`| **${mp.name || '주제품'}** (주제품) | ${mp.quantity || mp.mass} | ${mp.unit || 'kg'} | ${(result.allocation?.mainProductShare ? result.allocation.mainProductShare * 100 : multiOutputAllocation.mainProductShare * 100).toFixed(1)}% |`)
        }

        for (const cp of multiOutputAllocation.coProducts) {
            const share = cp.allocationShare ? (cp.allocationShare * 100).toFixed(1) : '—'
            lines.push(`| ${cp.name} | ${cp.quantity} | ${cp.unit} | ${share}% |`)
        }
        lines.push('')

        if (result.allocation?.applied) {
            lines.push(`> **할당 결과**: 할당 전 ${result.totalEmission.toFixed(4)} → 할당 후 **${result.allocation.allocatedTotal.toFixed(4)} kg CO₂e**`)
            lines.push(`> 부산물 배분량: ${result.allocation.coProductsReduction.toFixed(4)} kg CO₂e`)
            lines.push('')
        }
    } else {
        lines.push(`> 공동 산출물이 등록되지 않았습니다. 단일 산출물 프로세스로 간주합니다.`)
        lines.push('')
    }

    if (multiOutputAllocation.justification) {
        lines.push(`**정당화 근거**: ${multiOutputAllocation.justification}`)
        lines.push('')
    }

    // 재활용 할당
    lines.push(`#### 8.2 재활용/EoL 할당 (ISO 14067 6.4.6.3)`)
    lines.push('')

    const recyclingInfo = RECYCLING_ALLOCATION_METHODS[recyclingAllocation.method]
    lines.push(`- **할당 방법**: ${recyclingInfo?.nameKo || recyclingAllocation.method}`)
    lines.push(`- **루프 유형**: ${recyclingAllocation.loopType === 'open_loop' ? '개방 루프 (Open Loop)' : '폐쇄 루프 (Closed Loop)'}`)
    lines.push(`- **재활용 투입 비율**: ${(recyclingAllocation.recycledContentInput * 100).toFixed(0)}%`)
    lines.push(`- **재활용 산출 비율**: ${(recyclingAllocation.recyclabilityOutput * 100).toFixed(0)}%`)
    if (recyclingInfo?.formula) {
        lines.push(`- **적용 수식**: \`${recyclingInfo.formula}\``)
    }
    lines.push('')

    return lines.join('\n')
}

function generateElectricityInfo(state: PCFState): string {
    const lines: string[] = []
    const grid = state.activityData.electricity_grid || 'korea'

    lines.push(`- **적용 그리드**: ${grid === 'korea' ? '대한민국 국가 전력 그리드' : grid}`)
    lines.push(`- **산정 기준**: 소비 기반 (Consumption-based)`)
    lines.push(`- **출처**: ${EMISSION_FACTOR_SOURCES.korea_lci.name} (${EMISSION_FACTOR_SOURCES.korea_lci.year})`)
    lines.push(`- **포함 GHG**: CO₂, CH₄, N₂O`)
    lines.push('')
    lines.push(`> ⚠️ **제약사항**: 공급자 특정 정보 부재 시 국가 평균 배출계수를 적용합니다. 재생에너지 인증서(REC) 등을 통한 특수 전력 속성 사용 시, ISO 14067 6.4.9.4에 따른 민감도 분석이 필요합니다.`)
    lines.push('')

    return lines.join('\n')
}

function generateDataQuality(state: PCFState): string {
    const lines: string[] = []
    const dqMeta = state.dataQualityMeta

    lines.push(`- **전체 데이터 등급**: ${dqMeta.overallType === 'primary' ? '1차 데이터 (측정)' : dqMeta.overallType === 'secondary' ? '2차 데이터 (문헌/DB)' : '추정 데이터'}`)
    lines.push(`- **참조 데이터베이스**: ${dqMeta.sources.join(', ')}`)
    lines.push(`- **데이터 기준 연도**: ${dqMeta.baseYear}`)
    lines.push('')

    // 상세 원료 데이터의 품질 정보
    const rawMaterials = (state.detailedActivityData as any)?.raw_materials
    if (rawMaterials && Array.isArray(rawMaterials) && rawMaterials.length > 0) {
        lines.push(`**원료별 데이터 품질**:`)
        lines.push('')
        lines.push(`| 원료명 | 데이터 유형 | 출처 | 기준 연도 | 지역 |`)
        lines.push(`| :--- | :--- | :--- | :---: | :--- |`)
        for (const mat of rawMaterials) {
            const dq = mat.dataQuality || {}
            lines.push(`| ${mat.name} | ${dq.type || '—'} | ${dq.source || '—'} | ${dq.year || '—'} | ${dq.geographicScope || '—'} |`)
        }
        lines.push('')
    }

    return lines.join('\n')
}

function generateSensitivityAnalysis(state: PCFState): string {
    const lines: string[] = []
    const sa = state.sensitivityAnalysis

    if (!sa) {
        lines.push(`> ⚠️ 민감도 분석이 수행되지 않았습니다. ISO 14067 6.4.5, 6.6에 따라 중요 투입물, 산출물, 방법론 선택에 대한 민감도 분석이 권장됩니다.`)
        lines.push('')
        return lines.join('\n')
    }

    lines.push(`- **분석일**: ${sa.analysisDate}`)
    lines.push(`- **기준 CFP**: ${sa.baselineCFP.toFixed(4)} kg CO₂e`)
    lines.push(`- **중요 영향 인자**: ${sa.significantFactors.length > 0 ? sa.significantFactors.join(', ') : '없음'}`)
    lines.push('')

    if (sa.scenarios && sa.scenarios.length > 0) {
        lines.push(`**시나리오별 결과**:`)
        lines.push('')
        lines.push(`| 시나리오 | 파라미터 | 기준값 | 대안값 | 변동률 | 유의성 |`)
        lines.push(`| :--- | :--- | :--- | :--- | ---: | :---: |`)
        for (const scenario of sa.scenarios) {
            const sig = scenario.isSignificant ? '⚠️ 유의' : '✅'
            lines.push(`| ${scenario.nameKo || scenario.name} | ${scenario.parameterChanged} | ${scenario.baseValue} | ${scenario.alternativeValue} | ${scenario.percentageChange >= 0 ? '+' : ''}${scenario.percentageChange.toFixed(1)}% | ${sig} |`)
        }
        lines.push('')
    }

    if (sa.recommendations && sa.recommendations.length > 0) {
        lines.push(`**권고사항**:`)
        sa.recommendations.forEach((rec, i) => {
            lines.push(`${i + 1}. ${rec}`)
        })
        lines.push('')
    }

    return lines.join('\n')
}

function generateValueChoices(state: PCFState): string {
    const lines: string[] = []
    const choices = state.valueChoices || []

    if (choices.length === 0) {
        lines.push(`> ℹ️ 별도의 가치 선택이 기록되지 않았습니다. 기본 방법론이 적용되었습니다.`)
        lines.push('')

        // 자동으로 추론 가능한 가치 선택을 생성
        lines.push(`**자동 추론된 주요 선택사항**:`)
        lines.push('')
        lines.push(`| 결정사항 | 선택 | 대안 | ISO 조항 |`)
        lines.push(`| :--- | :--- | :--- | :---: |`)
        lines.push(`| 특성화 모델 | GWP₁₀₀ (IPCC AR6) | GTP₁₀₀ | 7.3 f |`)
        lines.push(`| 시스템 경계 | ${BOUNDARY_LABELS[state.productInfo.boundary] || state.productInfo.boundary} | 기타 경계 옵션 | 7.3 b |`)

        const methodInfo = MULTI_OUTPUT_ALLOCATION_METHODS[state.multiOutputAllocation.method]
        if (methodInfo) {
            lines.push(`| 할당 방법 | ${methodInfo.nameKo} | 기타 할당 방법 | 7.3 h |`)
        }

        const recyclingInfo = RECYCLING_ALLOCATION_METHODS[state.recyclingAllocation.method]
        if (recyclingInfo) {
            lines.push(`| EoL 할당 | ${recyclingInfo.nameKo} | 기타 EoL 할당 | 7.3 h |`)
        }
        lines.push('')
    } else {
        lines.push(`| 결정사항 | 선택 | 대안 | 정당화 근거 | ISO 조항 |`)
        lines.push(`| :--- | :--- | :--- | :--- | :---: |`)
        for (const vc of choices) {
            lines.push(`| ${vc.decision} | ${vc.category} | ${vc.alternative} | ${vc.justification} | ${vc.isoReference} |`)
        }
        lines.push('')
    }

    return lines.join('\n')
}

function generateLimitations(state: PCFState): string {
    const lines: string[] = []

    lines.push(`본 CFP 연구에는 다음과 같은 제한사항이 있습니다:`)
    lines.push('')

    for (const lim of METHODOLOGY_LIMITATIONS) {
        lines.push(`**${lim.title}** (${lim.isoReference})`)
        lines.push(`${lim.description}`)
        lines.push('')
    }

    // dLUC/iLUC
    lines.push(`**토지이용변화 (dLUC/iLUC)**`)
    lines.push(`본 연구에서는 직접 토지이용변화(dLUC) 및 간접 토지이용변화(iLUC) 배출량을 별도로 정량화하지 않았습니다. 농축산물 원료를 사용하는 제품의 경우, dLUC/iLUC 미반영으로 인해 실제 CFP가 과소평가될 가능성이 있습니다.`)
    lines.push('')

    return lines.join('\n')
}

// =============================================================================
// 부록
// =============================================================================

function generateAppendix(state: PCFState): string {
    const lines: string[] = []

    lines.push(`## 부록`)
    lines.push('')

    // 부록 A: 용어 정의
    lines.push(`### 부록 A. 용어 정의 (Glossary)`)
    lines.push('')
    lines.push(`| 용어 | 정의 |`)
    lines.push(`| :--- | :--- |`)
    lines.push(`| **CFP (Carbon Footprint of a Product)** | 제품의 전과정에서 발생하는 온실가스 배출 및 제거의 합계, CO₂ 당량으로 표현 |`)
    lines.push(`| **기능단위 (Functional Unit)** | 분석 대상 제품의 성능을 정량적으로 나타내는 기준 |`)
    lines.push(`| **기준흐름 (Reference Flow)** | 기능단위를 충족하기 위해 필요한 제품의 수량 |`)
    lines.push(`| **시스템 경계 (System Boundary)** | CFP 산정에 포함되는 단위공정의 범위 |`)
    lines.push(`| **할당 (Allocation)** | 다중 산출물 프로세스의 환경 부하를 산출물 간 배분하는 절차 |`)
    lines.push(`| **GWP₁₀₀** | 100년 기준 지구온난화지수 (Global Warming Potential) |`)
    lines.push(`| **LCI (Life Cycle Inventory)** | 전과정 목록분석 — 투입물/산출물의 정량화 |`)
    lines.push(`| **dLUC** | 직접 토지이용변화 (Direct Land Use Change) |`)
    lines.push(`| **iLUC** | 간접 토지이용변화 (Indirect Land Use Change) |`)
    lines.push(`| **PCR (Product Category Rules)** | 제품 범주별 규칙 — 제품군별 CFP 산정 세부 규칙 |`)
    lines.push(`| **Cut-off** | 기여도가 미미한 투입물/산출물을 분석에서 제외하는 기준 |`)
    lines.push('')

    // 부록 B: 참조 문서
    lines.push(`### 부록 B. 참조 문서 (References)`)
    lines.push('')
    lines.push(`1. ISO 14067:2018 — Greenhouse gases — Carbon footprint of products`)
    lines.push(`2. ISO 14044:2006 — Environmental management — Life cycle assessment`)
    lines.push(`3. ISO 14040:2006 — Environmental management — Life cycle assessment — Principles and framework`)
    lines.push(`4. IPCC AR6 (2021) — Climate Change 2021: The Physical Science Basis`)
    lines.push(`5. 환경부/한국환경산업기술원 — 국가 LCI 데이터베이스`)
    lines.push(`6. Ecoinvent v3.12 — Life Cycle Inventory Database`)
    lines.push('')

    return lines.join('\n')
}

// =============================================================================
// 보고서 데이터 변환 및 내보내기 유틸리티
// =============================================================================

import type { CFPReportData, LciDataDetail } from './report-template'
import { generateReportId } from './report-template'
import type { CutOffResult } from '@/lib/core/cut-off-criteria'

/**
 * UI에서 전달하는 계산 결과 타입
 */
export interface CalculatedResults {
    totalCFP: number
    fossilEmissions: number
    biogenicEmissions: number
    aircraftEmissions: number
    dlucEmissions?: number
    stageBreakdown: {
        stage: string
        stageKo?: string
        emission: number
        percentage: number
    }[]
    uncertainty: number
    ghgBreakdown?: Record<string, number>  // P1-3: GHG별 분해 데이터
}

/**
 * PCF Store 상태 + 계산 결과 → CFPReportData 변환
 */
export function generateReportData(
    state: PCFState,
    calculatedResults: CalculatedResults,
    sensitivityData?: any,
    cutOffResult?: CutOffResult
): CFPReportData {
    const reportId = generateReportId()
    const reportDate = new Date().toISOString().split('T')[0]

    // GHG 목록
    const ghgList = GHG_LIST.map(g => ({
        formula: g.formula,
        name: g.name,
        gwp: Number(g.gwp100_ar6)
    }))

    // 배출계수 출처
    const emissionFactorSources = Object.values(EMISSION_FACTOR_SOURCES).map((src: any) => ({
        name: src.name || '',
        year: src.year || 2023,
        region: src.organization || src.version || 'Global'
    }))

    // 불확실도 범위 계산
    const uncertaintyFactor = calculatedResults.uncertainty / 100
    const uncertaintyRange = {
        min: calculatedResults.totalCFP * (1 - uncertaintyFactor),
        max: calculatedResults.totalCFP * (1 + uncertaintyFactor)
    }

    // 할당 방법
    const allocationMethod = state.multiOutputAllocation?.method || '미적용'
    const recyclingMethod = state.recyclingAllocation?.method || 'cut_off'

    // 시스템 경계
    const systemBoundary = state.productInfo.boundary === 'cradle-to-gate'
        ? '요람에서 문까지 (Cradle-to-Gate)'
        : state.productInfo.boundary === 'cradle-to-grave'
            ? '요람에서 무덤까지 (Cradle-to-Grave)'
            : state.productInfo.boundary || '미지정'

    // LCI 상세 데이터
    const materialDetails: LciDataDetail[] = (state.detailedActivityData?.raw_materials || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        category: '원자재',
        quantity: m.quantity || 0,
        unit: m.unit || 'kg',
        lciDb: m.dataSource || 'CarbonMate DB'
    }))

    const transportDetails: LciDataDetail[] = (state.detailedActivityData?.transport || []).map((t: any) => ({
        id: t.id,
        name: t.name || '운송',
        category: '운송',
        quantity: t.distance || 0,
        unit: 'km',
        lciDb: 'CarbonMate DB'
    }))

    const packagingDetails: LciDataDetail[] = (state.detailedActivityData?.packaging || []).map((p: any) => ({
        id: p.id,
        name: p.name || '포장재',
        category: '포장',
        quantity: p.quantity || 0,
        unit: 'kg',
        lciDb: 'CarbonMate DB'
    }))

    // 민감도 분석
    const sensitivityAnalysis = sensitivityData ? {
        performed: sensitivityData.performed || true,
        analysisDate: sensitivityData.analysisDate,
        baselineCFP: sensitivityData.baselineCFP || calculatedResults.totalCFP,
        significantFactors: sensitivityData.significantFactors || [],
        scenarios: (sensitivityData.scenarios || []).map((s: any) => ({
            name: s.name,
            type: s.type,
            baseValue: s.baseValue,
            alternativeValue: s.alternativeValue,
            percentageChange: s.percentageChange,
            isSignificant: s.isSignificant
        })),
        recommendations: sensitivityData.recommendations || [],
        isoCompliance: sensitivityData.isoCompliance || []
    } : undefined

    // Cut-off 결과
    const cutOffData = cutOffResult ? {
        enabled: true,
        totalItems: cutOffResult.totalItems,
        excludedItems: cutOffResult.excludedItems,
        excludedEmissionPercent: cutOffResult.excludedEmissionPercent || 0,
        excludedItemsList: (cutOffResult.items || [])
            .filter((i: any) => i.isExcluded)
            .map((i: any) => ({
                name: i.nameKo || i.name,
                stage: i.stage || '',
                emission: i.emission || 0,
                contribution: i.massContribution || 0,
                reason: i.exclusionReason || ''
            })),
        isoCompliance: (cutOffResult.isoCompliance || []).map((c: any) => ({
            clause: c.clause,
            requirement: c.requirement,
            satisfied: c.satisfied,
            notes: c.notes || ''
        }))
    } : undefined

    return {
        reportId,
        reportDate,
        reportVersion: '2.0',
        product: {
            name: state.productInfo.name || '미지정',
            description: (state.productInfo as any).description,
            category: state.productInfo.category || '미분류',
            manufacturer: (state.productInfo as any).manufacturer,
            functionalUnit: state.productInfo.unit || '1개 제품'
        },
        scope: {
            systemBoundary,
            lifecycleStages: state.stages || [],
            cutOffResult: cutOffData,
            studyGoal: state.productInfo.studyGoal ? {
                applicationPurpose: (state.productInfo as any).studyGoal?.applicationPurpose || '',
                reasonForStudy: (state.productInfo as any).studyGoal?.reasonForStudy || '',
                targetAudience: (state.productInfo as any).studyGoal?.targetAudience || '',
                isCommunicationIntended: false
            } : undefined
        },
        methodology: {
            standard: 'ISO 14067:2018',
            gwpSource: 'IPCC AR6 (2021)',
            gwpTimeHorizon: '100 years',
            ghgList,
            emissionFactorSources,
            allocationMethod,
            recyclingAllocationMethod: recyclingMethod,
            dataQualityAssessment: state.dataQualityMeta?.overallType || '혼합 (1차/2차 데이터)'
        },
        results: {
            totalCFP: calculatedResults.totalCFP,
            unit: 'kg CO2e',
            fossilEmissions: calculatedResults.fossilEmissions,
            biogenicEmissions: calculatedResults.biogenicEmissions,
            dlucEmissions: calculatedResults.dlucEmissions,
            aircraftEmissions: calculatedResults.aircraftEmissions,
            stageBreakdown: calculatedResults.stageBreakdown,
            uncertaintyRange,
            uncertaintyPercentage: calculatedResults.uncertainty,
            ghgBreakdown: calculatedResults.ghgBreakdown
        },
        dataQuality: {
            overallType: state.dataQualityMeta?.overallType || '혼합',
            sources: ['CarbonMate 내장 DB'],
            baseYear: new Date().getFullYear()
        },
        limitations: {
            singleImpact: 'CFP 결과는 기후변화라는 단일 환경 영향만 다루며, 전체 환경 성과를 대표하지 않습니다.',
            methodologyLimitations: METHODOLOGY_LIMITATIONS.map(l => l.description),
            assumptions: ['표준 운송 거리 기반 계산', '평균 전력 배출계수 적용']
        },
        lciDetails: {
            materials: materialDetails,
            transport: transportDetails,
            packaging: packagingDetails
        },
        sensitivityAnalysis,
        complianceChecklist: []
    }
}

/**
 * HTML 포맷 보고서 생성
 */
export function generateHTMLReport(reportData: CFPReportData): string {
    const sections = []

    sections.push(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CFP 보고서 - ${reportData.product.name}</title>
<style>
body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.6; }
h1 { color: #0f172a; border-bottom: 3px solid #2563eb; padding-bottom: 12px; font-size: 1.8em; }
h2 { color: #1e40af; margin-top: 2em; font-size: 1.4em; border-left: 4px solid #2563eb; padding-left: 12px; }
h3 { color: #334155; margin-top: 1.5em; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9em; }
th { background: #f1f5f9; padding: 10px 12px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
td { padding: 8px 12px; border: 1px solid #e2e8f0; }
tr:nth-child(even) { background: #f8fafc; }
.meta { color: #64748b; font-size: 0.85em; margin-bottom: 2em; }
.highlight { background: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 1em 0; }
.result-box { background: #f0fdf4; padding: 20px; border-radius: 12px; text-align: center; margin: 1.5em 0; }
.result-value { font-size: 2.5em; font-weight: 700; color: #16a34a; }
.result-unit { color: #64748b; font-size: 0.9em; }
.footer { border-top: 1px solid #e2e8f0; padding-top: 1em; margin-top: 3em; color: #94a3b8; font-size: 0.8em; }
</style>
</head>
<body>`)

    // 제목
    sections.push(`<h1>제품 탄소발자국(PCF) 산정 보고서 <span style="font-size:0.5em;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:12px;vertical-align:middle;font-weight:500">요약본</span></h1>`)
    sections.push(`<div class="meta">
<p>보고서 ID: ${reportData.reportId} | 작성일: ${reportData.reportDate} | 버전: ${reportData.reportVersion}</p>
<p>기준: ${reportData.methodology.standard} | GWP: ${reportData.methodology.gwpSource}</p>
</div>`)

    // 요약
    sections.push(`<div class="result-box">
<div class="result-value">${reportData.results.totalCFP.toFixed(4)}</div>
<div class="result-unit">${reportData.results.unit} / ${reportData.product.functionalUnit}</div>
</div>`)

    // 제품 정보
    sections.push(`<h2>1. 제품 정보</h2>`)
    sections.push(`<table>
<tr><th>항목</th><th>내용</th></tr>
<tr><td>제품명</td><td>${reportData.product.name}</td></tr>
<tr><td>제품 카테고리</td><td>${reportData.product.category}</td></tr>
<tr><td>기능 단위</td><td>${reportData.product.functionalUnit}</td></tr>
${reportData.product.manufacturer ? `<tr><td>제조사</td><td>${reportData.product.manufacturer}</td></tr>` : ''}
</table>`)

    // 연구 범위
    sections.push(`<h2>2. 연구 범위</h2>`)
    sections.push(`<p><strong>시스템 경계:</strong> ${reportData.scope.systemBoundary}</p>`)
    sections.push(`<p><strong>포함 단계:</strong> ${reportData.scope.lifecycleStages.join(', ')}</p>`)

    // 결과
    sections.push(`<h2>3. CFP 결과</h2>`)
    sections.push(`<table>
<tr><th>구분</th><th>배출량 (kg CO2e)</th></tr>
<tr><td>화석 기원</td><td>${reportData.results.fossilEmissions.toFixed(4)}</td></tr>
<tr><td>생물 기원</td><td>${reportData.results.biogenicEmissions.toFixed(4)}</td></tr>
<tr><td>항공 운송</td><td>${reportData.results.aircraftEmissions.toFixed(4)}</td></tr>
<tr style="font-weight:bold"><td>합계</td><td>${reportData.results.totalCFP.toFixed(4)}</td></tr>
</table>`)

    // 단계별 결과
    sections.push(`<h3>3.1 단계별 배출량</h3>`)
    sections.push(`<table>
<tr><th>단계</th><th>배출량 (kg CO2e)</th><th>비율 (%)</th></tr>
${reportData.results.stageBreakdown.map(s =>
        `<tr><td>${s.stage}</td><td>${s.emission.toFixed(4)}</td><td>${s.percentage.toFixed(1)}</td></tr>`
    ).join('\n')}
</table>`)

    // P1-3: GHG별 분해
    if (reportData.results.ghgBreakdown && Object.keys(reportData.results.ghgBreakdown).length > 0) {
        const ghgRows = Object.entries(reportData.results.ghgBreakdown)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .filter(([, val]) => Math.abs(val) > 0.000001)
            .map(([ghg, val]) => {
                const pct = reportData.results.totalCFP > 0 ? (val / reportData.results.totalCFP) * 100 : 0
                const label = ghg
                    .replace('co2_fossil', 'CO₂ (화석)')
                    .replace('co2_biogenic', 'CO₂ (생물기원)')
                    .replace('ch4', 'CH₄').replace('n2o', 'N₂O')
                    .replace('hfcs', 'HFCs').replace('other', '기타 GHG')
                return `<tr><td>${label}</td><td>${val.toFixed(6)}</td><td>${pct.toFixed(1)}%</td></tr>`
            }).join('\n')

        sections.push(`<h3>3.2 온실가스별 배출량 분해 (ISO 14067 7.3 e)</h3>`)
        sections.push(`<table>
<tr><th>온실가스</th><th>배출량 (kg CO₂e)</th><th>비율</th></tr>
${ghgRows}
</table>`)
    }

    // 방법론
    sections.push(`<h2>4. 방법론</h2>`)
    sections.push(`<div class="highlight">
<p><strong>기준 표준:</strong> ${reportData.methodology.standard}</p>
<p><strong>GWP 출처:</strong> ${reportData.methodology.gwpSource} (${reportData.methodology.gwpTimeHorizon})</p>
<p><strong>할당 방법:</strong> ${reportData.methodology.allocationMethod}</p>
<p><strong>재활용 할당:</strong> ${reportData.methodology.recyclingAllocationMethod}</p>
</div>`)

    // GHG 목록
    sections.push(`<h3>4.1 고려된 온실가스</h3>`)
    sections.push(`<table>
<tr><th>화학식</th><th>명칭</th><th>GWP₁₀₀</th></tr>
${reportData.methodology.ghgList.map(g =>
        `<tr><td>${g.formula}</td><td>${g.name}</td><td>${g.gwp}</td></tr>`
    ).join('\n')}
</table>`)

    // 제한사항
    sections.push(`<h2>5. 제한사항</h2>`)
    sections.push(`<div class="highlight"><p>${reportData.limitations.singleImpact}</p></div>`)

    // 푸터
    sections.push(`<div class="footer">
<p>본 보고서는 CarbonMate Platform v2.0에서 자동 생성되었습니다.</p>
<p>ISO 14067:2018 Section 7 준수 | ${reportData.reportDate}</p>
</div>`)

    sections.push(`</body></html>`)

    return sections.join('\n')
}

/**
 * Markdown 포맷 보고서 생성
 */
export function generateMarkdownReport(reportData: CFPReportData): string {
    const lines: string[] = []

    lines.push(`# 제품 탄소발자국(PCF) 산정 보고서`)
    lines.push('')
    lines.push(`> 보고서 ID: ${reportData.reportId}`)
    lines.push(`> 작성일: ${reportData.reportDate} | 버전: ${reportData.reportVersion}`)
    lines.push(`> 기준: ${reportData.methodology.standard}`)
    lines.push('')
    lines.push('---')
    lines.push('')

    // 목차
    lines.push(`## 📋 목차`)
    lines.push('')
    lines.push(`- [📊 결과 요약](#-결과-요약)`)
    lines.push(`- [1. 제품 정보](#1-제품-정보)`)
    lines.push(`- [2. 단계별 배출량](#2-단계별-배출량)`)
    if (reportData.results.ghgBreakdown && Object.keys(reportData.results.ghgBreakdown).length > 0) {
        lines.push(`  - [2-1. 온실가스별 배출량 분해](#2-1-온실가스별-배출량-분해-iso-14067-73-e)`)
    }
    lines.push(`- [3. 방법론](#3-방법론)`)
    lines.push(`- [4. 제한사항](#4-제한사항)`)
    lines.push('')
    lines.push('---')
    lines.push('')

    // 요약
    lines.push(`## 📊 결과 요약`)
    lines.push('')
    lines.push(`**총 CFP: ${reportData.results.totalCFP.toFixed(4)} ${reportData.results.unit} / ${reportData.product.functionalUnit}**`)
    lines.push('')
    lines.push(`| 구분 | 배출량 (kg CO2e) |`)
    lines.push(`|------|-----------------|`)
    lines.push(`| 화석 기원 | ${reportData.results.fossilEmissions.toFixed(4)} |`)
    lines.push(`| 생물 기원 | ${reportData.results.biogenicEmissions.toFixed(4)} |`)
    lines.push(`| 항공 운송 | ${reportData.results.aircraftEmissions.toFixed(4)} |`)
    lines.push(`| **합계** | **${reportData.results.totalCFP.toFixed(4)}** |`)
    lines.push('')

    // 제품 정보
    lines.push(`## 1. 제품 정보`)
    lines.push('')
    lines.push(`- **제품명:** ${reportData.product.name}`)
    lines.push(`- **카테고리:** ${reportData.product.category}`)
    lines.push(`- **기능 단위:** ${reportData.product.functionalUnit}`)
    if (reportData.product.manufacturer) {
        lines.push(`- **제조사:** ${reportData.product.manufacturer}`)
    }
    lines.push('')

    // 단계별 결과
    lines.push(`## 2. 단계별 배출량`)
    lines.push('')
    lines.push(`| 단계 | 배출량 (kg CO2e) | 비율 (%) |`)
    lines.push(`|------|-----------------|----------|`)
    reportData.results.stageBreakdown.forEach(s => {
        lines.push(`| ${s.stage} | ${s.emission.toFixed(4)} | ${s.percentage.toFixed(1)} |`)
    })
    lines.push('')

    // P1-3: GHG별 분해
    if (reportData.results.ghgBreakdown && Object.keys(reportData.results.ghgBreakdown).length > 0) {
        lines.push(`### 2-1. 온실가스별 배출량 분해 (ISO 14067 7.3 e)`)
        lines.push('')
        lines.push(`| 온실가스 | 배출량 (kg CO₂e) | 비율 (%) |`)
        lines.push(`|----------|-----------------|----------|`)
        Object.entries(reportData.results.ghgBreakdown)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .filter(([, val]) => Math.abs(val) > 0.000001)
            .forEach(([ghg, val]) => {
                const pct = reportData.results.totalCFP > 0 ? (val / reportData.results.totalCFP) * 100 : 0
                const label = ghg
                    .replace('co2_fossil', 'CO₂ (화석)')
                    .replace('co2_biogenic', 'CO₂ (생물기원)')
                    .replace('ch4', 'CH₄').replace('n2o', 'N₂O')
                    .replace('hfcs', 'HFCs').replace('other', '기타 GHG')
                lines.push(`| ${label} | ${val.toFixed(6)} | ${pct.toFixed(1)} |`)
            })
        lines.push('')
    }

    // 방법론
    lines.push(`## 3. 방법론`)
    lines.push('')
    lines.push(`- **기준 표준:** ${reportData.methodology.standard}`)
    lines.push(`- **GWP 출처:** ${reportData.methodology.gwpSource}`)
    lines.push(`- **할당 방법:** ${reportData.methodology.allocationMethod}`)
    lines.push('')

    // 제한사항
    lines.push(`## 4. 제한사항`)
    lines.push('')
    lines.push(`> ${reportData.limitations.singleImpact}`)
    lines.push('')

    lines.push('---')
    lines.push(`*본 보고서는 CarbonMate Platform v2.0에서 자동 생성되었습니다.*`)
    lines.push('')

    return lines.join('\n')
}

/**
 * JSON 포맷 보고서 생성
 */
export function generateJSONReport(reportData: CFPReportData): string {
    return JSON.stringify(reportData, null, 2)
}
