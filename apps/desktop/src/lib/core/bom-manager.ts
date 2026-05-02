/**
 * BOM 관리자 (Bill of Materials Manager)
 * 
 * 목적: 원재료 투입 목록(BOM)을 관리하고, 
 *   - 질량 기여도 자동 계산
 *   - 배출계수 DB 자동 매핑
 *   - ISO 14044 컷오프 기준(누적 95%) 자동 적용
 *   - 환경적 중요성 예외 처리
 * 
 * ISO 14044:2006 4.2.3.3 / ISO 14067:2018 6.3.4.3 준수
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-14
 */

import {
    MATERIAL_EMISSION_FACTORS,
    MaterialEmissionFactor
} from './emission-factors'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * BOM 항목 (자재명세서의 한 행)
 */
export interface BOMItem {
    id: string
    name: string                    // 원재료명
    nameEn?: string                 // 영문명 (선택)
    mass: number                    // 투입 질량 (kg / 기능단위)
    unit: string                    // 단위 (기본: kg)
    // 배출계수 매핑
    emissionFactorId?: string       // emission-factors DB 참조 ID
    customEmissionFactor?: number   // 사용자 지정 배출계수 (kgCO2e/kg)
    emissionFactorSource?: string   // 배출계수 출처
    // 메타데이터
    category?: string               // 원료 카테고리 (금속, 플라스틱 등)
    supplier?: string               // 공급업체명
    origin?: string                 // 원산지 (국가 코드)
    recycledContent?: number        // 재활용 함유율 (%)
    // 분석 결과 (자동 계산)
    massContribution?: number       // 질량 기여도 (%)
    cumulativeContribution?: number // 누적 기여도 (%)
    emission?: number               // 배출량 (kgCO2e)
    emissionContribution?: number   // 배출량 기여도 (%)
    isCutOff?: boolean              // 컷오프 대상 여부
    isHighImpact?: boolean          // 환경적 중요성 예외 (소량이나 고배출)
    cutOffReason?: string           // 컷오프/포함 사유
}

/**
 * BOM 분석 결과
 */
export interface BOMAnalysisResult {
    totalMass: number               // 총 투입 질량 (kg)
    totalEmission: number           // 총 배출량 (kgCO2e)
    items: BOMItem[]                // 분석된 항목 (기여도 내림차순)
    includedItems: BOMItem[]        // 포함 항목
    excludedItems: BOMItem[]        // 컷오프 제외 항목
    cumulativeCutOffPercent: number // 누적 컷오프 기준 (%)
    includedMassPercent: number     // 포함된 질량 비율 (%)
    excludedMassPercent: number     // 제외된 질량 비율 (%)
    excludedEmissionPercent: number // 제외된 배출량 비율 (%)
    highImpactExceptions: BOMItem[] // 환경적 중요성 예외 항목
    unmappedItems: BOMItem[]        // 배출계수 미매핑 항목
    isoCompliance: {
        clause: string
        satisfied: boolean
        notes: string
    }[]
    summary: string                 // 한국어 요약
    summaryEn: string               // 영문 요약
}

/**
 * 배출계수 매핑 추천 결과
 */
export interface EmissionFactorSuggestion {
    bomItemId: string
    bomItemName: string
    suggestions: {
        factorId: string
        factorName: string
        factorNameKo: string
        value: number
        unit: string
        matchScore: number          // 0-100 매칭 점수
        matchReason: string
    }[]
}

// =============================================================================
// 환경적 중요성 예외 목록
// =============================================================================

/**
 * 소량이지만 환경 영향이 큰 물질 (컷오프에서 제외하면 안 됨)
 */
const HIGH_IMPACT_MATERIALS: { keywords: string[]; reason: string; emissionFactor: number }[] = [
    {
        keywords: ['촉매', 'catalyst', '백금', 'platinum', 'palladium', '팔라듐', 'rhodium', '로듐'],
        reason: '희귀금속 촉매: 소량이나 채굴·정련 과정 배출량이 매우 높음',
        emissionFactor: 40.0     // kgCO2e/kg 대략값
    },
    {
        keywords: ['희토류', 'rare earth', 'neodymium', '네오디뮴', 'lithium', '리튬'],
        reason: '희토류/리튬: 채굴 시 높은 환경 부하',
        emissionFactor: 15.0
    },
    {
        keywords: ['냉매', 'refrigerant', 'HFC', 'R-134a', 'R-410A', 'SF6'],
        reason: '냉매/고GWP 가스: 질량 대비 GWP가 수천~수만 배',
        emissionFactor: 1500.0   // GWP 기준
    },
    {
        keywords: ['용제', 'solvent', '톨루엔', 'toluene', '아세톤', 'acetone', 'MEK'],
        reason: '유기용제: VOC 배출 및 독성 물질',
        emissionFactor: 3.0
    },
    {
        keywords: ['에폭시', 'epoxy', '이소시아네이트', 'isocyanate', 'MDI', 'TDI'],
        reason: '특수 화학물질: 생산 과정 에너지 집약적',
        emissionFactor: 6.0
    }
]

// =============================================================================
// 키워드 → 배출계수 DB 매핑 사전
// =============================================================================

const MATERIAL_KEYWORD_MAP: { keywords: string[]; factorId: string; score: number }[] = [
    // 금속
    { keywords: ['steel', '강철', '철강', '강판', '철근', '강', 'SS400', 'SM'], factorId: 'material_steel_primary', score: 90 },
    { keywords: ['EAF', '전기로', '재활용 강', 'recycled steel', '스크랩'], factorId: 'material_steel_recycled', score: 85 },
    { keywords: ['aluminum', '알루미늄', 'AL', 'A6061', 'A5052'], factorId: 'material_aluminum_primary', score: 90 },
    { keywords: ['recycled aluminum', '재활용 알루미늄'], factorId: 'material_aluminum_recycled', score: 85 },
    { keywords: ['copper', '구리', 'Cu', '동'], factorId: 'material_copper', score: 90 },
    // 플라스틱
    { keywords: ['PE', '폴리에틸렌', 'HDPE', 'LDPE', 'LLDPE'], factorId: 'material_plastic_pe', score: 85 },
    { keywords: ['PP', '폴리프로필렌'], factorId: 'material_plastic_pp', score: 85 },
    { keywords: ['PET', '폴리에틸렌테레프탈레이트'], factorId: 'material_plastic_pet', score: 85 },
    { keywords: ['PVC', '폴리염화비닐'], factorId: 'material_plastic_pvc', score: 85 },
    { keywords: ['ABS'], factorId: 'material_plastic_abs', score: 85 },
    // 목재/종이
    { keywords: ['softwood', '침엽수', '소나무', '전나무', '삼나무'], factorId: 'material_wood_softwood', score: 80 },
    { keywords: ['hardwood', '활엽수', '참나무', '너도밤나무'], factorId: 'material_wood_hardwood', score: 80 },
    { keywords: ['cardboard', '골판지', '박스'], factorId: 'material_paper_cardboard', score: 85 },
    { keywords: ['kraft', '크라프트'], factorId: 'material_paper_kraft', score: 85 },
    // 유리/세라믹
    { keywords: ['glass', '유리', '병'], factorId: 'material_glass', score: 80 },
    { keywords: ['ceramic', '세라믹', '도기'], factorId: 'material_ceramic', score: 80 },
    // 건설
    { keywords: ['cement', '시멘트'], factorId: 'material_cement', score: 90 },
    { keywords: ['concrete', '콘크리트', '레미콘'], factorId: 'material_concrete', score: 90 },
    // PR-V03: 산업 화학물질 추론 — 강철 일괄 라벨링 결함 차단
    { keywords: ['수산화나트륨', 'NaOH', '가성소다', 'sodium hydroxide', 'caustic'], factorId: 'material_chem_naoh', score: 92 },
    { keywords: ['황산', 'H2SO4', 'H₂SO₄', 'sulfuric acid', 'sulphuric'], factorId: 'material_chem_h2so4', score: 92 },
    { keywords: ['과산화수소', 'H2O2', 'H₂O₂', 'hydrogen peroxide'], factorId: 'material_chem_h2o2', score: 92 },
    { keywords: ['암모니아', 'NH3', 'NH₃', 'ammonia'], factorId: 'material_chem_nh3', score: 92 },
    { keywords: ['응집제', 'PAC', 'polyaluminium', '폴리머응집제', 'flocculant'], factorId: 'material_chem_pac', score: 88 },
    { keywords: ['정제수', '공정용수', '탈이온수', 'deionized', 'purified water'], factorId: 'material_chem_purified_water', score: 90 },
    { keywords: ['공업용수', 'industrial water', '용수'], factorId: 'material_chem_industrial_water', score: 85 },
    // 황산니켈은 황산 키워드와 substring 충돌이 있으므로 score 95로 우선권 부여
    { keywords: ['황산니켈', '조황산니켈', 'nickel sulfate', 'NiSO4', 'NiSO₄'], factorId: 'material_chem_nickel_sulfate_crude', score: 95 }
]

// =============================================================================
// 핵심 함수
// =============================================================================

/**
 * BOM 분석: 질량 기여도 계산, 컷오프 적용, 배출계수 매핑
 * 
 * @param items BOM 항목 목록
 * @param cumulativeCutOff 누적 질량 컷오프 기준 (%, 기본 95)
 * @returns 분석 결과
 */
export const analyzeBOM = (
    items: BOMItem[],
    cumulativeCutOff: number = 95
): BOMAnalysisResult => {
    if (items.length === 0) {
        return createEmptyResult(cumulativeCutOff)
    }

    // 1. 배출계수 매핑 (아직 매핑 안 된 항목)
    const mappedItems = items.map(item => ({
        ...item,
        ...resolveEmissionFactor(item)
    }))

    // 2. 총 질량 계산
    const totalMass = mappedItems.reduce((sum, item) => sum + item.mass, 0)

    // 3. 배출량 계산
    mappedItems.forEach(item => {
        const ef = getEffectiveEmissionFactor(item)
        item.emission = item.mass * ef
    })
    const totalEmission = mappedItems.reduce((sum, item) => sum + (item.emission || 0), 0)

    // 4. 질량 기여도 계산 + 내림차순 정렬
    mappedItems.forEach(item => {
        item.massContribution = totalMass > 0 ? (item.mass / totalMass) * 100 : 0
        item.emissionContribution = totalEmission > 0 ? ((item.emission || 0) / totalEmission) * 100 : 0
    })
    mappedItems.sort((a, b) => (b.massContribution || 0) - (a.massContribution || 0))

    // 5. 누적 기여도 + 컷오프 결정
    let cumulative = 0
    mappedItems.forEach(item => {
        cumulative += item.massContribution || 0
        item.cumulativeContribution = cumulative

        // 환경적 중요성 체크
        const highImpact = checkHighImpact(item)
        if (highImpact) {
            item.isHighImpact = true
            item.isCutOff = false
            item.cutOffReason = highImpact.reason
        } else if (cumulative > cumulativeCutOff && (item.massContribution || 0) < 1) {
            // 누적 기준 초과 + 개별 기여도 1% 미만 → 컷오프 대상
            item.isCutOff = true
            item.cutOffReason = `누적 ${cumulative.toFixed(1)}% > ${cumulativeCutOff}% (개별 ${item.massContribution?.toFixed(2)}%)`
        } else {
            item.isCutOff = false
            item.cutOffReason = item.cumulativeContribution <= cumulativeCutOff
                ? `누적 ${cumulative.toFixed(1)}% ≤ ${cumulativeCutOff}%`
                : `개별 기여도 ${item.massContribution?.toFixed(1)}% ≥ 1%`
        }
    })

    // 6. 분류
    const includedItems = mappedItems.filter(i => !i.isCutOff)
    const excludedItems = mappedItems.filter(i => i.isCutOff)
    const highImpactExceptions = mappedItems.filter(i => i.isHighImpact)
    const unmappedItems = mappedItems.filter(i => !i.emissionFactorId && !i.customEmissionFactor)

    const excludedMass = excludedItems.reduce((sum, i) => sum + i.mass, 0)
    const excludedEmission = excludedItems.reduce((sum, i) => sum + (i.emission || 0), 0)

    // 7. ISO 준수 확인
    const excludedMassPercent = totalMass > 0 ? (excludedMass / totalMass) * 100 : 0
    const excludedEmissionPercent = totalEmission > 0 ? (excludedEmission / totalEmission) * 100 : 0

    const isoCompliance = [
        {
            clause: 'ISO 14044:2006 4.2.3.3.3',
            satisfied: excludedMassPercent < 5,
            notes: `제외 질량: ${excludedMassPercent.toFixed(1)}% ${excludedMassPercent >= 5 ? '(⚠️ 5% 초과)' : '(적합)'}`
        },
        {
            clause: 'ISO 14067:2018 6.3.4.3',
            satisfied: excludedEmissionPercent < 5,
            notes: `제외 배출량: ${excludedEmissionPercent.toFixed(1)}% ${excludedEmissionPercent >= 5 ? '(⚠️ 5% 초과)' : '(적합)'}`
        },
        {
            clause: 'ISO 14044:2006 4.2.3.3.3',
            satisfied: highImpactExceptions.every(i => !i.isCutOff),
            notes: highImpactExceptions.length > 0
                ? `환경적 중요성 예외 ${highImpactExceptions.length}건 적용: ${highImpactExceptions.map(i => i.name).join(', ')}`
                : '환경적 중요성 예외 해당 없음'
        }
    ]

    // 8. 요약 생성
    const summary = generateSummary(mappedItems, includedItems, excludedItems, highImpactExceptions, cumulativeCutOff, totalMass, excludedMassPercent)
    const summaryEn = generateSummaryEn(mappedItems, includedItems, excludedItems, cumulativeCutOff, totalMass, excludedMassPercent)

    return {
        totalMass,
        totalEmission,
        items: mappedItems,
        includedItems,
        excludedItems,
        cumulativeCutOffPercent: cumulativeCutOff,
        includedMassPercent: 100 - excludedMassPercent,
        excludedMassPercent,
        excludedEmissionPercent,
        highImpactExceptions,
        unmappedItems,
        isoCompliance,
        summary,
        summaryEn
    }
}

/**
 * BOM 항목명으로 배출계수 DB에서 자동 매핑 추천
 */
export const suggestEmissionFactors = (items: BOMItem[]): EmissionFactorSuggestion[] => {
    return items.map(item => {
        const suggestions = findMatchingFactors(item.name, item.nameEn)
        return {
            bomItemId: item.id,
            bomItemName: item.name,
            suggestions
        }
    })
}

/**
 * 빈 BOM 항목 생성 (UI용)
 */
export const createEmptyBOMItem = (index: number): BOMItem => ({
    id: `bom_${Date.now()}_${index}`,
    name: '',
    mass: 0,
    unit: 'kg'
})

// =============================================================================
// 내부 유틸리티
// =============================================================================

function resolveEmissionFactor(item: BOMItem): Partial<BOMItem> {
    // 이미 매핑됨
    if (item.emissionFactorId || item.customEmissionFactor) {
        return {}
    }

    // 이름 기반 자동 매핑 시도
    const matches = findMatchingFactors(item.name, item.nameEn)
    if (matches.length > 0 && matches[0].matchScore >= 80) {
        return {
            emissionFactorId: matches[0].factorId,
            emissionFactorSource: `자동 매핑 (${matches[0].matchReason})`
        }
    }

    return {}
}

function findMatchingFactors(name: string, nameEn?: string): EmissionFactorSuggestion['suggestions'] {
    const searchTerms = [name.toLowerCase(), ...(nameEn ? [nameEn.toLowerCase()] : [])]
    const results: EmissionFactorSuggestion['suggestions'] = []

    for (const mapping of MATERIAL_KEYWORD_MAP) {
        // PR-V03: 단방향 매칭으로 변경 — term이 keyword를 포함할 때만 매치.
        // 이전 양방향 로직은 "황산" 입력 시 "황산니켈" 키워드와도 매치되어 분류 충돌 야기.
        const matched = mapping.keywords.some(kw =>
            searchTerms.some(term => term.includes(kw.toLowerCase()))
        )
        if (matched) {
            const factor = MATERIAL_EMISSION_FACTORS.find(f => f.id === mapping.factorId)
            if (factor) {
                results.push({
                    factorId: factor.id,
                    factorName: factor.name,
                    factorNameKo: factor.nameKo,
                    value: factor.value,
                    unit: factor.unit,
                    matchScore: mapping.score,
                    matchReason: `키워드 "${mapping.keywords[0]}" 매칭`
                })
            }
        }
    }

    // 점수 내림차순 정렬
    results.sort((a, b) => b.matchScore - a.matchScore)
    return results.slice(0, 3) // 최대 3개 추천
}

function getEffectiveEmissionFactor(item: BOMItem): number {
    if (item.customEmissionFactor) return item.customEmissionFactor

    if (item.emissionFactorId) {
        const factor = MATERIAL_EMISSION_FACTORS.find(f => f.id === item.emissionFactorId)
        if (factor) {
            // 재활용 함유율 적용
            if (item.recycledContent && item.recycledContent > 0 && factor.recycledContentFactor) {
                const virgin = factor.value
                const recycled = factor.recycledContentFactor
                return virgin * (1 - item.recycledContent / 100) + recycled * (item.recycledContent / 100)
            }
            return factor.value
        }
    }

    // 고영향 물질 체크
    const highImpact = checkHighImpact(item)
    if (highImpact) return highImpact.emissionFactor

    // 기본값 (일반 원료)
    return 2.0 // kgCO2e/kg
}

function checkHighImpact(item: BOMItem): typeof HIGH_IMPACT_MATERIALS[number] | null {
    const searchTerms = [item.name.toLowerCase(), ...(item.nameEn ? [item.nameEn.toLowerCase()] : [])]

    for (const material of HIGH_IMPACT_MATERIALS) {
        const matched = material.keywords.some(kw =>
            searchTerms.some(term => term.includes(kw.toLowerCase()))
        )
        if (matched) return material
    }
    return null
}

function createEmptyResult(cutOff: number): BOMAnalysisResult {
    return {
        totalMass: 0,
        totalEmission: 0,
        items: [],
        includedItems: [],
        excludedItems: [],
        cumulativeCutOffPercent: cutOff,
        includedMassPercent: 100,
        excludedMassPercent: 0,
        excludedEmissionPercent: 0,
        highImpactExceptions: [],
        unmappedItems: [],
        isoCompliance: [],
        summary: 'BOM 항목이 없습니다.',
        summaryEn: 'No BOM items provided.'
    }
}

function generateSummary(
    all: BOMItem[], included: BOMItem[], excluded: BOMItem[],
    highImpact: BOMItem[], cutOff: number, totalMass: number, excludedPercent: number
): string {
    let s = `총 ${all.length}개 원재료 (총 질량 ${totalMass.toFixed(1)}kg) 분석 결과, `
    s += `${included.length}개 항목이 포함되고 ${excluded.length}개 항목이 컷오프(누적 ${cutOff}%) 대상입니다. `
    s += `제외 질량 비율: ${excludedPercent.toFixed(1)}%. `

    if (highImpact.length > 0) {
        s += `환경적 중요성 예외 ${highImpact.length}건(${highImpact.map(i => i.name).join(', ')})은 소량이나 포함되었습니다.`
    }

    return s
}

function generateSummaryEn(
    all: BOMItem[], included: BOMItem[], excluded: BOMItem[],
    cutOff: number, totalMass: number, excludedPercent: number
): string {
    let s = `Analysis of ${all.length} raw materials (total ${totalMass.toFixed(1)}kg): `
    s += `${included.length} items included, ${excluded.length} items cut-off (cumulative ${cutOff}% threshold). `
    s += `Excluded mass: ${excludedPercent.toFixed(1)}%.`
    return s
}
