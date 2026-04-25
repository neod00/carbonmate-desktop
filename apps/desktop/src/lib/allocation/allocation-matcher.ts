/**
 * 할당 규칙 매칭 (Allocation Matcher)
 * 
 * 목적: 제품 카테고리 입력 시 최적의 할당 규칙을 자동으로 찾아 반환
 * 
 * @version 1.0.0
 */

import {
    AllocationRule,
    IndustrySector,
    RegulatoryContext,
    AllocationMethod,
    ALLOCATION_RULES_DB,
    getRulesBySector,
    getRulesByRegulation,
    findRuleByProductCategory
} from './allocation-rules-db'

// =============================================================================
// 타입 정의
// =============================================================================

export interface MatchResult {
    rule: AllocationRule
    confidence: 'high' | 'medium' | 'low'
    matchedBy: 'exact_category' | 'partial_category' | 'sector' | 'default'
    matchedTerm?: string
    alternatives?: AllocationRule[]
}

export interface AllocationRecommendation {
    multiOutput: {
        method: AllocationMethod
        basis: string
        rationale: string
        reference: string
    }
    recycling: {
        method: AllocationMethod
        pefRequired: boolean
        reference: string
    }
    sensitivityRequired: boolean
    euCompliance?: {
        regulation: string
        mandatory: boolean
        effectiveDate: string
        notes: string
    }[]
    oemCompliance?: {
        company: string
        program: string
        requirement: string
    }[]
}

// =============================================================================
// 제품 카테고리 키워드 매핑
// =============================================================================

const SECTOR_KEYWORDS: Record<IndustrySector, string[]> = {
    steel_metal: [
        'steel', 'iron', 'metal', 'aluminum', 'aluminium', 'copper', 'zinc',
        '철강', '강재', '철근', '형강', '강판', '알루미늄', '금속', '동', '아연'
    ],
    battery_ev: [
        'battery', 'cell', 'lithium', 'li-ion', 'ev', 'electric vehicle', 'ess',
        '배터리', '전지', '리튬', '전기차', '이차전지', 'bms'
    ],
    chemical: [
        'plastic', 'polymer', 'resin', 'pe', 'pp', 'pvc', 'pet', 'chemical', 'ethylene', 'propylene',
        '플라스틱', '폴리머', '수지', '화학', '에틸렌', '프로필렌', '접착제', '도료'
    ],
    construction: [
        'cement', 'concrete', 'aggregate', 'glass', 'insulation', 'building',
        '시멘트', '콘크리트', '골재', '유리', '단열재', '건설', '건축'
    ],
    refinery: [
        'fuel', 'gasoline', 'diesel', 'jet', 'petroleum', 'refinery', 'oil',
        '연료', '휘발유', '경유', '항공유', '석유', '정유'
    ],
    power_energy: [
        'electricity', 'power', 'energy', 'grid', 'generation',
        '전력', '전기', '에너지', '발전'
    ],
    food_agriculture: [
        'food', 'agriculture', 'dairy', 'meat', 'crop', 'farming',
        '식품', '농업', '낙농', '육류', '농산물'
    ],
    electronics: [
        'semiconductor', 'chip', 'ic', 'pcb', 'display', 'electronics',
        '반도체', '칩', '디스플레이', '전자'
    ],
    textile: [
        'textile', 'fabric', 'apparel', 'clothing', 'fiber',
        '섬유', '의류', '직물', '원단'
    ],
    general_manufacturing: [
        'part', 'component', 'assembly', 'machine', 'equipment',
        '부품', '조립', '기계', '장비', '제품'
    ]
}

// =============================================================================
// 매칭 함수
// =============================================================================

/**
 * 제품 카테고리로 최적의 할당 규칙 찾기
 */
export const matchAllocationRule = (
    productCategory: string,
    options?: {
        targetMarket?: 'EU' | 'US' | 'Global' | 'Korea'
        regulatoryContext?: RegulatoryContext
    }
): MatchResult => {
    const normalizedInput = productCategory.toLowerCase().trim()

    // 1. 정확한 카테고리 매칭 시도
    const exactMatch = findRuleByProductCategory(productCategory)
    if (exactMatch) {
        return {
            rule: exactMatch,
            confidence: 'high',
            matchedBy: 'exact_category',
            matchedTerm: productCategory
        }
    }

    // 2. 키워드 기반 산업군 추론
    const sectorScores: Record<IndustrySector, number> = {} as Record<IndustrySector, number>

    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
        sectorScores[sector as IndustrySector] = 0
        for (const keyword of keywords) {
            if (normalizedInput.includes(keyword.toLowerCase())) {
                sectorScores[sector as IndustrySector] += 1
            }
        }
    }

    // 최고 점수 산업군 찾기
    const sortedSectors = Object.entries(sectorScores)
        .filter(([, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])

    if (sortedSectors.length > 0) {
        const bestSector = sortedSectors[0][0] as IndustrySector
        const sectorRules = getRulesBySector(bestSector)

        if (sectorRules.length > 0) {
            // 규제 컨텍스트가 있으면 해당 규제 적용 규칙 우선
            if (options?.regulatoryContext) {
                const regRules = sectorRules.filter(r =>
                    r.references.euRegulations?.some(reg => reg.type === options.regulatoryContext) ||
                    r.references.oemRequirements?.some(oem => oem.type === options.regulatoryContext)
                )
                if (regRules.length > 0) {
                    return {
                        rule: regRules[0],
                        confidence: 'high',
                        matchedBy: 'partial_category',
                        matchedTerm: bestSector,
                        alternatives: sectorRules.filter(r => r.id !== regRules[0].id)
                    }
                }
            }

            return {
                rule: sectorRules[0],
                confidence: sortedSectors[0][1] >= 2 ? 'medium' : 'low',
                matchedBy: 'sector',
                matchedTerm: bestSector,
                alternatives: sectorRules.slice(1)
            }
        }
    }

    // 3. 기본 규칙 반환 (일반 제조업)
    const defaultRule = getRulesBySector('general_manufacturing')[0]
    return {
        rule: defaultRule,
        confidence: 'low',
        matchedBy: 'default',
        alternatives: []
    }
}

/**
 * 할당 추천 생성
 */
export const getRecommendation = (rule: AllocationRule): AllocationRecommendation => {
    return {
        multiOutput: {
            method: rule.allocation.multiOutput.preferred,
            basis: rule.allocation.multiOutput.defaultBasis,
            rationale: rule.allocation.multiOutput.rationale,
            reference: rule.references.primaryPCR.name
        },
        recycling: {
            method: rule.allocation.recycling.preferred,
            pefRequired: rule.allocation.recycling.pefRequired,
            reference: rule.references.primaryPCR.name
        },
        sensitivityRequired: rule.allocation.sensitivityAnalysis.required,
        euCompliance: rule.references.euRegulations?.map(reg => ({
            regulation: reg.name,
            mandatory: reg.mandatory,
            effectiveDate: reg.effectiveDate,
            notes: reg.complianceNotes || ''
        })),
        oemCompliance: rule.references.oemRequirements?.map(oem => ({
            company: oem.company,
            program: oem.programName,
            requirement: oem.requirement
        }))
    }
}

/**
 * 제품 입력으로 전체 추천 플로우 실행
 */
export const recommendAllocation = (
    productCategory: string,
    options?: {
        targetMarket?: 'EU' | 'US' | 'Global' | 'Korea'
        regulatoryContext?: RegulatoryContext
    }
): {
    match: MatchResult
    recommendation: AllocationRecommendation
    justification: { ko: string; en: string }
} => {
    const match = matchAllocationRule(productCategory, options)
    const recommendation = getRecommendation(match.rule)

    return {
        match,
        recommendation,
        justification: {
            ko: match.rule.justificationTemplates.ko.detailed,
            en: match.rule.justificationTemplates.en.detailed
        }
    }
}

/**
 * 특정 규제 대응 필요 여부 확인
 */
export const checkRegulatoryCompliance = (
    rule: AllocationRule,
    regulation: RegulatoryContext
): { applicable: boolean; mandatory: boolean; notes?: string } => {
    const euReg = rule.references.euRegulations?.find(r => r.type === regulation)
    if (euReg) {
        return {
            applicable: true,
            mandatory: euReg.mandatory,
            notes: euReg.complianceNotes
        }
    }

    const oemReq = rule.references.oemRequirements?.find(r => r.type === regulation)
    if (oemReq) {
        return {
            applicable: true,
            mandatory: true,
            notes: oemReq.requirement
        }
    }

    return { applicable: false, mandatory: false }
}
