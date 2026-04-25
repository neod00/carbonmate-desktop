/**
 * ISO 14067:2018 표준 관련 상수 및 타입 정의
 * 
 * 이 파일은 ISO 14067 표준의 요구사항을 코드로 구현한 것입니다.
 */

// =============================================================================
// Annex A: CFP의 제한사항 (규정 - Normative)
// =============================================================================

/**
 * A.2 단일 환경 문제에 집중
 * CFP는 기후변화만을 다루며, 다른 환경 영향 범주는 포함하지 않음
 */
export const LIMITATION_SINGLE_IMPACT = {
    id: 'single_impact',
    title: '단일 환경 영향 범주',
    description: '본 CFP 연구는 기후변화(Climate Change)만을 다룹니다. ' +
        '산성화, 부영양화, 오존층 파괴, 자원 고갈, 생태독성 등 ' +
        '다른 환경 영향 범주는 평가 범위에 포함되지 않습니다.',
    isoReference: 'ISO 14067:2018 Annex A.2'
}

/**
 * A.3 방법론 관련 제한사항
 */
export const METHODOLOGY_LIMITATIONS = [
    {
        id: 'data_quality',
        title: '데이터 품질 제한',
        description: '사용된 배출계수는 2차 데이터(Secondary Data)로, ' +
            '실제 공급망의 1차 데이터(Primary Data)와 차이가 있을 수 있습니다.',
        isoReference: 'ISO 14067:2018 6.3.5'
    },
    {
        id: 'allocation_sensitivity',
        title: '할당 방법 민감도',
        description: '다중 출력 공정의 경우 선택된 할당 방법(질량, 경제적 가치 등)에 따라 ' +
            '결과가 달라질 수 있습니다.',
        isoReference: 'ISO 14067:2018 6.4.6'
    },
    {
        id: 'system_boundary',
        title: '시스템 경계 제한',
        description: '시스템 경계 외부의 간접 효과(예: 간접 토지이용변화, 리바운드 효과)는 ' +
            '별도로 명시되지 않는 한 포함되지 않습니다.',
        isoReference: 'ISO 14067:2018 6.3.4'
    },
    {
        id: 'temporal_representativeness',
        title: '시간적 대표성',
        description: '배출계수 및 활동 데이터는 특정 기준 연도를 반영하며, ' +
            '미래의 기술 변화나 전력 그리드 탈탄소화는 고려되지 않았습니다.',
        isoReference: 'ISO 14067:2018 6.3.6'
    },
    {
        id: 'geographic_representativeness',
        title: '지역적 대표성',
        description: '사용된 배출계수가 실제 생산/소비 지역의 특성을 완전히 반영하지 못할 수 있습니다.',
        isoReference: 'ISO 14067:2018 6.3.5'
    },
    {
        id: 'cut_off',
        title: 'Cut-off 기준 적용',
        description: '중요도가 낮은 것으로 판단된 일부 투입물/산출물은 ' +
            'Cut-off 기준에 따라 제외되었을 수 있습니다.',
        isoReference: 'ISO 14067:2018 6.3.4.3'
    },
    {
        id: 'use_stage_assumptions',
        title: '사용 단계 가정',
        description: '사용 단계의 시나리오(사용 패턴, 수명 등)는 가정에 기반하며, ' +
            '실제 사용 조건과 다를 수 있습니다.',
        isoReference: 'ISO 14067:2018 6.3.7'
    },
    {
        id: 'eol_assumptions',
        title: '폐기 단계 가정',
        description: '폐기 단계의 시나리오(재활용률, 매립/소각 비율 등)는 ' +
            '현재 시장 상황을 기반으로 하며, 미래 변화를 반영하지 않습니다.',
        isoReference: 'ISO 14067:2018 6.3.8'
    }
]

/**
 * dLUC/iLUC 범위 제한 (ISO 14067 6.4.9.5, 6.4.9.6)
 * 
 * 참고: 직접 토지이용변화(dLUC) 및 간접 토지이용변화(iLUC) 배출량 계산은
 * 주로 농산물, 바이오 연료, 산림 기반 제품에 해당됩니다.
 * 범용 제조업(전자, 기계, 화학 등)에서는 일반적으로 적용되지 않습니다.
 * 
 * @see ISO 14067:2018 6.4.9.5 토지 이용 변화 (dLUC)
 * @see ISO 14067:2018 6.4.9.6 토지 이용 (iLUC)
 */
export const DLUC_ILUC_SCOPE_NOTE = {
    applicable: ['농산물', '바이오연료', '바이오기반 소재', '목재/펄프', '식품/음료'],
    notApplicable: ['전자제품', '기계류', '화학제품', '금속제품', '플라스틱 제품'],
    isoReference: 'ISO 14067:2018 6.4.9.5, 6.4.9.6',
    note: '본 플랫폼은 범용 제조업을 주요 대상으로 하므로 dLUC/iLUC 계산은 현재 지원하지 않습니다. ' +
        '농산물/바이오 기반 제품의 경우 IPCC 가이드라인에 따른 별도 dLUC/iLUC 평가가 필요합니다.'
}

/**
 * 사용자 선택에 따라 적용 가능한 제한사항 필터링
 */
export const getApplicableLimitations = (
    boundary: string,
    stages: string[],
    dataQualityLevel: 'primary' | 'secondary' | 'mixed' | 'estimated' = 'secondary'
) => {
    const limitations = [...METHODOLOGY_LIMITATIONS]

    // 1차 데이터 사용 시 데이터 품질 제한 완화
    if (dataQualityLevel === 'primary') {
        const idx = limitations.findIndex(l => l.id === 'data_quality')
        if (idx >= 0) {
            limitations[idx] = {
                ...limitations[idx],
                description: '일부 1차 데이터(Primary Data)가 사용되었으나, ' +
                    '모든 공정에 대해 1차 데이터가 수집되지 않았을 수 있습니다.'
            }
        }
    }

    // 사용 단계 미포함 시 해당 제한사항 제외
    if (!stages.includes('use')) {
        return limitations.filter(l => l.id !== 'use_stage_assumptions')
    }

    // 폐기 단계 미포함 시 해당 제한사항 제외
    if (!stages.includes('eol')) {
        return limitations.filter(l => l.id !== 'eol_assumptions')
    }

    return limitations
}

// =============================================================================
// 7.2 CFP 연구 보고서 내 온실가스 값 - 필수 분리 기록 항목
// =============================================================================

export interface GHGBreakdown {
    // 필수 분리 기록 (7.2 a-e)
    stageEmissions: {
        stageId: string
        stageName: string
        absoluteValue: number       // kg CO2e
        relativeContribution: number // %
    }[]
    netFossilEmissions: number      // b) 순 화석 GHG
    biogenicEmissions: number       // c) 생물기원 GHG 배출
    biogenicRemovals: number        // c) 생물기원 GHG 흡수
    dLUCEmissions: number           // d) 직접 토지이용변화
    aircraftEmissions: number       // e) 항공 운송

    // 선택적 분리 기록 (계산된 경우)
    iLUCEmissions?: number          // 간접 토지이용변화
    landUseEmissions?: number       // 토지 사용
    biogenicCarbonContent?: number  // 제품 내 생물기원 탄소
    gtp100Result?: number           // GTP 100 결과
}

// =============================================================================
// 7.3 CFP 연구 보고서 필수 정보
// =============================================================================

export interface CFPStudyReportRequiredInfo {
    // a) 기능단위 또는 선언단위 및 기준 흐름
    functionalUnit: string
    referenceFlow: string

    // b) 시스템 경계
    systemBoundary: {
        type: 'cradle-to-gate' | 'cradle-to-grave' | 'gate-to-gate'
        includedStages: string[]
        excludedStages: string[]
        elementaryFlows: string[]
    }

    // c) 중요 단위공정 목록
    importantUnitProcesses: string[]

    // d) 데이터 수집 정보
    dataCollectionInfo: {
        sources: string[]
        collectionPeriod: string
    }

    // e) 고려된 GHG 목록
    ghgList: string[]

    // f) 선택된 특성화 계수
    characterizationFactors: {
        source: string          // e.g., "IPCC AR6 (2021)"
        timeHorizon: number     // e.g., 100 (years)
    }

    // g) Cut-off 기준
    cutOffCriteria: {
        massThreshold?: number      // %
        energyThreshold?: number    // %
        environmentalThreshold?: number // %
        description: string
    }

    // h) 할당 절차
    allocationProcedures: string

    // i) GHG 배출 및 제거 시점 (해당 시)
    timingOfEmissions?: string

    // j) 데이터 설명
    dataDescription: {
        decisions: string[]
        qualityAssessment: string
    }

    // k) 민감도 분석 및 불확실성 평가 결과
    sensitivityAndUncertainty: {
        sensitivityAnalysis: string[]
        uncertaintyRange: {
            min: number
            max: number
            unit: string
        }
    }

    // l) 전력 처리
    electricityTreatment: {
        gridEmissionFactor: number
        gridEmissionFactorUnit: string
        source: string
        year: number
    }

    // m) 해석 결과
    interpretation: {
        conclusions: string[]
        limitations: string[]  // Annex A 참조
    }

    // n) 가치 선택 공개
    valueChoicesDisclosure: string[]

    // o) 범위 및 수정된 범위
    scope: {
        original: string
        modified?: string
        justification?: string
    }

    // p) 생애주기 단계 설명
    lifeCycleStagesDescription: {
        useProfile?: string
        endOfLifeScenario?: string
    }

    // r) CFP 대표 기간
    timePeriod: {
        startDate: string
        endDate: string
        justification: string
    }

    // s) 적용된 PCR 참조 (해당 시)
    pcrReference?: string
}

// =============================================================================
// P2-5: 특성화 인자 선택 옵션 (ISO 14067 7.3 f)
// =============================================================================

export type CharacterizationModel = 'AR5' | 'AR6'

export const CHARACTERIZATION_MODEL_LABELS: Record<CharacterizationModel, string> = {
    AR5: 'IPCC AR5 (2014)',
    AR6: 'IPCC AR6 (2021)',
}

// =============================================================================
// GHG 목록 (IPCC 기준) — AR5/AR6 GWP₁₀₀ 병렬 관리
// =============================================================================

export const GHG_LIST = [
    { formula: 'CO2', name: '이산화탄소', gwp100_ar5: 1, gwp100_ar6: 1 },
    { formula: 'CH4', name: '메탄', gwp100_ar5: 28, gwp100_ar6: 29.8 },   // fossil 기준
    { formula: 'N2O', name: '아산화질소', gwp100_ar5: 265, gwp100_ar6: 273 },
    { formula: 'HFCs', name: '수소불화탄소', gwp100_ar5: 'varies' as const, gwp100_ar6: 'varies' as const },
    { formula: 'PFCs', name: '과불화탄소', gwp100_ar5: 'varies' as const, gwp100_ar6: 'varies' as const },
    { formula: 'SF6', name: '육불화황', gwp100_ar5: 23500, gwp100_ar6: 25200 },
    { formula: 'NF3', name: '삼불화질소', gwp100_ar5: 16100, gwp100_ar6: 17400 },
]

/**
 * 선택된 특성화 모델에 따라 GHG의 GWP₁₀₀ 값을 반환합니다.
 * 'varies'인 경우 0을 반환합니다.
 */
export function getGWP100(formula: string, model: CharacterizationModel = 'AR6'): number {
    const ghg = GHG_LIST.find(g => g.formula === formula)
    if (!ghg) return 0
    const val = model === 'AR5' ? ghg.gwp100_ar5 : ghg.gwp100_ar6
    return typeof val === 'number' ? val : 0
}

// =============================================================================
// 배출계수 출처 정보
// =============================================================================

export const EMISSION_FACTOR_SOURCES = {
    korea_lci: {
        name: '국가 LCI 데이터베이스',
        organization: '환경부/한국환경산업기술원',
        url: 'https://www.epd.or.kr',
        year: 2023
    },
    ecoinvent: {
        name: 'ecoinvent Version 3.12',
        version: '3.12',
        url: 'https://ecoinvent.org',
        year: 2024
    },
    ipcc: {
        name: 'IPCC Guidelines',
        version: '2006 (2019 Refinement)',
        url: 'https://www.ipcc-nggip.iges.or.jp',
        year: 2019
    },
    glec: {
        name: 'GLEC Framework',
        version: '2.0',
        organization: 'Smart Freight Centre',
        year: 2019
    }
}

// =============================================================================
// 데이터 품질 매트릭스 (Pedigree Matrix 기반)
// =============================================================================

export interface DataQualityIndicator {
    reliability: 1 | 2 | 3 | 4 | 5           // 신뢰성
    completeness: 1 | 2 | 3 | 4 | 5          // 완전성
    temporalCorrelation: 1 | 2 | 3 | 4 | 5   // 시간적 상관성
    geographicalCorrelation: 1 | 2 | 3 | 4 | 5  // 지리적 상관성
    technologicalCorrelation: 1 | 2 | 3 | 4 | 5 // 기술적 상관성
}

export const DATA_QUALITY_DESCRIPTIONS = {
    reliability: {
        1: '검증된 측정 데이터',
        2: '부분 검증된 데이터 또는 계산 기반',
        3: '비검증 데이터 또는 추정치',
        4: '자격을 갖춘 추정',
        5: '비자격 추정'
    },
    completeness: {
        1: '대표 데이터, 충분한 샘플 크기',
        2: '대표 데이터, 불충분한 샘플 크기',
        3: '대표 데이터, 불명확한 샘플 크기',
        4: '대표성 불명확',
        5: '비대표성 또는 불명'
    },
    temporalCorrelation: {
        1: '3년 이내 데이터',
        2: '6년 이내 데이터',
        3: '10년 이내 데이터',
        4: '15년 이내 데이터',
        5: '15년 초과 또는 불명'
    },
    geographicalCorrelation: {
        1: '동일 지역 데이터',
        2: '유사 생산 조건의 지역',
        3: '유사 지역의 평균 데이터',
        4: '다소 유사한 지역',
        5: '불명 또는 매우 다른 지역'
    },
    technologicalCorrelation: {
        1: '동일 기업/공정 데이터',
        2: '동일 기술의 다른 기업',
        3: '유사 기술의 데이터',
        4: '관련 기술의 데이터',
        5: '관련 공정의 데이터'
    }
}

/**
 * 데이터 품질 지표(DQI) 계산
 * 1에 가까울수록 높은 품질, 5에 가까울수록 낮은 품질
 */
export const calculateDQI = (indicators: DataQualityIndicator): number => {
    const values = Object.values(indicators)
    return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * DQI를 기반으로 불확실성 범위 추정 (%)
 */
export const estimateUncertaintyFromDQI = (dqi: number): { min: number, max: number } => {
    if (dqi <= 1.5) return { min: -5, max: 5 }
    if (dqi <= 2.5) return { min: -15, max: 15 }
    if (dqi <= 3.5) return { min: -30, max: 30 }
    if (dqi <= 4.5) return { min: -50, max: 50 }
    return { min: -100, max: 100 }
}

