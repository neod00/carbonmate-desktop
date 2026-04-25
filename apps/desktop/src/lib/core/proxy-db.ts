/**
 * Proxy 배출계수 DB (Proxy Emission Factor Database)
 * 
 * 목적: 공급사 1차 데이터가 없는 원재료에 대해 
 *       대체(Proxy) 배출계수를 제공하고 국가별 보정
 * 
 * 데이터 출처:
 * - Ecoinvent 3.9.1 (기본 참조)
 * - KEITI 국가 LCI DB (한국 기본값)
 * - IPCC 2006 Guidelines
 * - World Steel Association (철강)
 * - International Aluminium Institute (알루미늄)
 * 
 * ISO 14067:2018 6.3.3 요구사항:
 * - 1차 데이터 수집 불가 시 2차 데이터(Proxy) 사용 가능
 * - Proxy 선정 근거와 대표성을 문서화해야 함
 * - 사용된 데이터의 품질을 평가해야 함
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-14
 */

import { ELECTRICITY_EMISSION_FACTORS } from './emission-factors'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * Proxy 배출계수 항목
 */
export interface ProxyEmissionFactor {
    id: string
    name: string                    // 영문명
    nameKo: string                  // 한국어명
    category: ProxyCategory
    subcategory?: string
    // 배출계수 값
    value: number                   // kgCO2e/kg (기본 단위)
    unit: string
    // 전력 의존도 (국가별 보정에 사용)
    electricityIntensity: number    // kWh/kg (해당 물질 생산 시 전력 소비량)
    baseCountry: string             // 기준 국가 코드 (이 값이 측정된 국가)
    baseGridFactor: number          // 기준 국가의 전력 배출계수 (kgCO2e/kWh)
    // 메타데이터
    source: string                  // 데이터 출처
    sourceDB?: string               // 원본 DB (ecoinvent, KEITI 등)
    year: number
    geographicScope: string
    quality: ProxyQuality
    // 추가 정보
    recycledAlternativeId?: string  // 재활용 대체재 ID
    keywords: string[]              // 검색 키워드
    notes?: string
}

/**
 * Proxy 카테고리
 */
export type ProxyCategory =
    | 'metals'          // 금속
    | 'plastics'        // 플라스틱/고분자
    | 'wood_paper'      // 목재/종이
    | 'glass_ceramic'   // 유리/세라믹
    | 'construction'    // 건설자재
    | 'chemicals'       // 화학물질
    | 'textiles'        // 섬유
    | 'electronics'     // 전자부품
    | 'rubber'          // 고무
    | 'other'           // 기타

/**
 * Proxy 데이터 품질 등급
 */
export type ProxyQuality = 'high' | 'medium' | 'low' | 'estimated'

/**
 * 국가 보정 결과
 */
export interface CountryAdjustedProxy {
    original: ProxyEmissionFactor
    adjustedValue: number           // 보정된 배출계수
    adjustmentFactor: number        // 보정 계수 (1.0 = 보정 없음)
    targetCountry: string
    targetGridFactor: number
    explanation: string
    explanationKo: string
}

/**
 * Proxy 검색 결과
 */
export interface ProxySearchResult {
    proxy: ProxyEmissionFactor
    matchScore: number              // 0-100
    matchReason: string
}

/**
 * Proxy 대표성 평가
 */
export interface ProxyAssessment {
    proxyId: string
    proxyName: string
    overallScore: number            // 1-5 (1=최고)
    technologicalMatch: number      // 1-5
    geographicalMatch: number       // 1-5
    temporalMatch: number           // 1-5
    recommendation: string
    recommendationKo: string
    suggestedAlternatives: string[]
}

// =============================================================================
// Proxy 배출계수 DB
// =============================================================================

export const PROXY_EMISSION_FACTORS: ProxyEmissionFactor[] = [
    // =========================================================================
    // 금속 (Metals)
    // =========================================================================

    // --- 철강 ---
    {
        id: 'proxy_steel_bof',
        name: 'Steel, BOF route (primary)',
        nameKo: '강철 (고로, 1차)',
        category: 'metals',
        subcategory: 'steel',
        value: 2.33,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.42,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'World Steel Association 2022',
        sourceDB: 'worldsteel',
        year: 2022,
        geographicScope: 'Global average',
        quality: 'high',
        recycledAlternativeId: 'proxy_steel_eaf',
        keywords: ['강철', 'steel', '철강', '강판', '철근', 'SS400', 'SM', 'hot rolled', '열연', '냉연', 'BOF', '고로'],
        notes: 'BOF(고로) 경로 기준. 코크스+철광석 원료.'
    },
    {
        id: 'proxy_steel_eaf',
        name: 'Steel, EAF route (recycled)',
        nameKo: '강철 (전기로, 재활용)',
        category: 'metals',
        subcategory: 'steel',
        value: 0.67,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.58,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'World Steel Association 2022',
        sourceDB: 'worldsteel',
        year: 2022,
        geographicScope: 'Global average',
        quality: 'high',
        keywords: ['전기로', 'EAF', '재활용 강', 'recycled steel', '스크랩', 'scrap'],
        notes: 'EAF(전기로) 경로. 스크랩 기반. 전력 의존도 높음.'
    },
    {
        id: 'proxy_steel_stainless',
        name: 'Stainless Steel',
        nameKo: '스테인리스강',
        category: 'metals',
        subcategory: 'steel',
        value: 6.15,
        unit: 'kgCO2e/kg',
        electricityIntensity: 1.2,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'high',
        keywords: ['스테인리스', 'stainless', 'SUS', 'STS', '304', '316', '크롬', 'chromium'],
        notes: '크롬·니켈 함유로 일반강 대비 높은 배출.'
    },
    {
        id: 'proxy_steel_galvanized',
        name: 'Galvanized Steel',
        nameKo: '아연도금강판',
        category: 'metals',
        subcategory: 'steel',
        value: 2.75,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.55,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'medium',
        keywords: ['아연도금', 'galvanized', 'GI', 'GL', 'zinc coated'],
    },

    // --- 알루미늄 ---
    {
        id: 'proxy_aluminum_primary',
        name: 'Aluminium, primary (ingot)',
        nameKo: '알루미늄 (1차, 잉곳)',
        category: 'metals',
        subcategory: 'aluminum',
        value: 16.5,
        unit: 'kgCO2e/kg',
        electricityIntensity: 15.0,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'International Aluminium Institute 2022',
        sourceDB: 'IAI',
        year: 2022,
        geographicScope: 'Global',
        quality: 'high',
        recycledAlternativeId: 'proxy_aluminum_recycled',
        keywords: ['알루미늄', 'aluminum', 'aluminium', 'AL', 'A6061', 'A5052', '잉곳', 'ingot', '1차'],
        notes: '전력 의존도 매우 높음. 국가별 보정 효과가 큼.'
    },
    {
        id: 'proxy_aluminum_recycled',
        name: 'Aluminium, recycled',
        nameKo: '알루미늄 (재활용)',
        category: 'metals',
        subcategory: 'aluminum',
        value: 0.52,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.7,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'International Aluminium Institute 2022',
        sourceDB: 'IAI',
        year: 2022,
        geographicScope: 'Global',
        quality: 'high',
        keywords: ['재활용 알루미늄', 'recycled aluminum', '2차 알루미늄', 'secondary aluminum'],
        notes: '1차 대비 약 97% 배출 저감.'
    },
    {
        id: 'proxy_aluminum_sheet',
        name: 'Aluminium Sheet',
        nameKo: '알루미늄 판재',
        category: 'metals',
        subcategory: 'aluminum',
        value: 18.2,
        unit: 'kgCO2e/kg',
        electricityIntensity: 15.8,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'medium',
        keywords: ['알루미늄 판', 'aluminum sheet', '알루미늄 박', 'foil'],
    },

    // --- 구리 ---
    {
        id: 'proxy_copper_primary',
        name: 'Copper, primary',
        nameKo: '구리 (1차)',
        category: 'metals',
        subcategory: 'copper',
        value: 4.0,
        unit: 'kgCO2e/kg',
        electricityIntensity: 3.5,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'high',
        keywords: ['구리', 'copper', 'Cu', '동', '동판', '동선', '전선'],
    },
    {
        id: 'proxy_copper_recycled',
        name: 'Copper, recycled',
        nameKo: '구리 (재활용)',
        category: 'metals',
        subcategory: 'copper',
        value: 0.84,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.8,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'medium',
        keywords: ['재활용 구리', 'recycled copper', '2차 구리'],
    },

    // --- 기타 금속 ---
    {
        id: 'proxy_zinc',
        name: 'Zinc, primary',
        nameKo: '아연 (1차)',
        category: 'metals',
        subcategory: 'zinc',
        value: 3.86,
        unit: 'kgCO2e/kg',
        electricityIntensity: 3.9,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'medium',
        keywords: ['아연', 'zinc', 'Zn'],
    },
    {
        id: 'proxy_nickel',
        name: 'Nickel, primary',
        nameKo: '니켈 (1차)',
        category: 'metals',
        subcategory: 'nickel',
        value: 12.0,
        unit: 'kgCO2e/kg',
        electricityIntensity: 4.5,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'medium',
        keywords: ['니켈', 'nickel', 'Ni'],
    },
    {
        id: 'proxy_tin',
        name: 'Tin, primary',
        nameKo: '주석 (1차)',
        category: 'metals',
        subcategory: 'tin',
        value: 16.7,
        unit: 'kgCO2e/kg',
        electricityIntensity: 3.0,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'medium',
        keywords: ['주석', 'tin', 'Sn', '솔더', 'solder'],
    },
    {
        id: 'proxy_lead',
        name: 'Lead, primary',
        nameKo: '납 (1차)',
        category: 'metals',
        subcategory: 'lead',
        value: 2.6,
        unit: 'kgCO2e/kg',
        electricityIntensity: 1.2,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'medium',
        keywords: ['납', 'lead', 'Pb', '배터리'],
    },

    // =========================================================================
    // 플라스틱/고분자 (Plastics & Polymers)
    // =========================================================================
    {
        id: 'proxy_pe_hdpe',
        name: 'HDPE (High Density Polyethylene)',
        nameKo: 'HDPE (고밀도 폴리에틸렌)',
        category: 'plastics',
        subcategory: 'polyethylene',
        value: 1.93,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.8,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'PlasticsEurope 2022',
        sourceDB: 'plasticseurope',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'high',
        keywords: ['HDPE', '고밀도', '폴리에틸렌', 'polyethylene', 'PE'],
    },
    {
        id: 'proxy_pe_ldpe',
        name: 'LDPE (Low Density Polyethylene)',
        nameKo: 'LDPE (저밀도 폴리에틸렌)',
        category: 'plastics',
        subcategory: 'polyethylene',
        value: 2.08,
        unit: 'kgCO2e/kg',
        electricityIntensity: 1.0,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'PlasticsEurope 2022',
        sourceDB: 'plasticseurope',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'high',
        keywords: ['LDPE', '저밀도', 'PE', 'LLDPE', '폴리에틸렌'],
    },
    {
        id: 'proxy_pp',
        name: 'PP (Polypropylene)',
        nameKo: 'PP (폴리프로필렌)',
        category: 'plastics',
        subcategory: 'polypropylene',
        value: 1.86,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.7,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'PlasticsEurope 2022',
        sourceDB: 'plasticseurope',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'high',
        keywords: ['PP', '폴리프로필렌', 'polypropylene'],
    },
    {
        id: 'proxy_pet',
        name: 'PET (Polyethylene Terephthalate)',
        nameKo: 'PET (폴리에틸렌테레프탈레이트)',
        category: 'plastics',
        subcategory: 'polyester',
        value: 3.14,
        unit: 'kgCO2e/kg',
        electricityIntensity: 1.2,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'PlasticsEurope 2022',
        sourceDB: 'plasticseurope',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'high',
        keywords: ['PET', '페트', '폴리에스터', 'polyester', '병', 'bottle'],
    },
    {
        id: 'proxy_pvc',
        name: 'PVC (Polyvinyl Chloride)',
        nameKo: 'PVC (폴리염화비닐)',
        category: 'plastics',
        subcategory: 'vinyl',
        value: 2.41,
        unit: 'kgCO2e/kg',
        electricityIntensity: 1.5,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'PlasticsEurope 2022',
        sourceDB: 'plasticseurope',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'high',
        keywords: ['PVC', '폴리염화비닐', 'vinyl', '비닐', '파이프', 'pipe'],
    },
    {
        id: 'proxy_abs',
        name: 'ABS (Acrylonitrile Butadiene Styrene)',
        nameKo: 'ABS',
        category: 'plastics',
        subcategory: 'styrene',
        value: 3.55,
        unit: 'kgCO2e/kg',
        electricityIntensity: 1.1,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'PlasticsEurope 2022',
        sourceDB: 'plasticseurope',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['ABS', '아크릴로니트릴', '스티렌', '사출', 'injection'],
    },
    {
        id: 'proxy_ps',
        name: 'PS (Polystyrene)',
        nameKo: 'PS (폴리스티렌)',
        category: 'plastics',
        subcategory: 'styrene',
        value: 3.43,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.9,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'PlasticsEurope 2022',
        sourceDB: 'plasticseurope',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['PS', '폴리스티렌', '스티로폼', 'polystyrene', 'EPS', 'styrofoam'],
    },
    {
        id: 'proxy_pa6',
        name: 'PA6 (Nylon 6)',
        nameKo: 'PA6 (나일론 6)',
        category: 'plastics',
        subcategory: 'polyamide',
        value: 7.64,
        unit: 'kgCO2e/kg',
        electricityIntensity: 1.8,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'PlasticsEurope 2022',
        sourceDB: 'plasticseurope',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['PA6', '나일론', 'nylon', '폴리아미드', 'polyamide', 'PA66'],
    },
    {
        id: 'proxy_pc',
        name: 'PC (Polycarbonate)',
        nameKo: 'PC (폴리카보네이트)',
        category: 'plastics',
        subcategory: 'engineering',
        value: 7.62,
        unit: 'kgCO2e/kg',
        electricityIntensity: 2.0,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'PlasticsEurope 2022',
        sourceDB: 'plasticseurope',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['PC', '폴리카보네이트', 'polycarbonate', 'Lexan', 'Makrolon'],
    },
    {
        id: 'proxy_pu_rigid',
        name: 'PU Rigid Foam',
        nameKo: '경질 폴리우레탄 폼',
        category: 'plastics',
        subcategory: 'polyurethane',
        value: 4.26,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.8,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'PlasticsEurope 2022',
        sourceDB: 'plasticseurope',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['PU', '폴리우레탄', 'polyurethane', '우레탄', '폼', 'foam', '단열'],
    },

    // =========================================================================
    // 목재/종이 (Wood & Paper)
    // =========================================================================
    {
        id: 'proxy_wood_softwood',
        name: 'Sawn Timber, Softwood',
        nameKo: '침엽수 제재목',
        category: 'wood_paper',
        subcategory: 'wood',
        value: 0.31,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.2,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'high',
        keywords: ['침엽수', 'softwood', '소나무', 'pine', '전나무', '삼나무', '제재목', 'timber', '원목', '합판'],
        notes: '탄소 격리(저장) 미포함. 포함 시 음(-)의 값 가능.'
    },
    {
        id: 'proxy_wood_hardwood',
        name: 'Sawn Timber, Hardwood',
        nameKo: '활엽수 제재목',
        category: 'wood_paper',
        subcategory: 'wood',
        value: 0.45,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.25,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['활엽수', 'hardwood', '참나무', 'oak', '너도밤나무', 'beech'],
    },
    {
        id: 'proxy_plywood',
        name: 'Plywood',
        nameKo: '합판',
        category: 'wood_paper',
        subcategory: 'wood',
        value: 0.68,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.35,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['합판', 'plywood', 'MDF', 'particle board', '파티클보드'],
    },
    {
        id: 'proxy_paper_kraft',
        name: 'Kraft Paper',
        nameKo: '크라프트지',
        category: 'wood_paper',
        subcategory: 'paper',
        value: 1.29,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.7,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'CEPI 2022',
        sourceDB: 'cepi',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'high',
        keywords: ['크라프트', 'kraft', '포장지', '종이', 'paper'],
    },
    {
        id: 'proxy_cardboard',
        name: 'Corrugated Cardboard',
        nameKo: '골판지',
        category: 'wood_paper',
        subcategory: 'paper',
        value: 0.97,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.55,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'FEFCO 2022',
        sourceDB: 'fefco',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'high',
        keywords: ['골판지', 'cardboard', 'corrugated', '박스', 'box', '상자'],
    },

    // =========================================================================
    // 유리/세라믹 (Glass & Ceramic)
    // =========================================================================
    {
        id: 'proxy_glass_flat',
        name: 'Flat Glass',
        nameKo: '판유리',
        category: 'glass_ceramic',
        subcategory: 'glass',
        value: 1.25,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.6,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'Glass for Europe 2022',
        sourceDB: 'glass_for_europe',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'high',
        keywords: ['유리', 'glass', '판유리', 'flat glass', '창유리', 'window'],
    },
    {
        id: 'proxy_glass_container',
        name: 'Container Glass (bottle)',
        nameKo: '용기 유리 (병)',
        category: 'glass_ceramic',
        subcategory: 'glass',
        value: 0.86,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.45,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'FEVE 2022',
        sourceDB: 'feve',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'high',
        keywords: ['유리병', 'bottle', 'container glass', '병', '용기'],
    },
    {
        id: 'proxy_ceramic_tile',
        name: 'Ceramic Tile',
        nameKo: '세라믹 타일',
        category: 'glass_ceramic',
        subcategory: 'ceramic',
        value: 0.78,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.3,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['세라믹', 'ceramic', '타일', 'tile', '도기', '자기'],
    },

    // =========================================================================
    // 건설자재 (Construction)
    // =========================================================================
    {
        id: 'proxy_cement',
        name: 'Portland Cement',
        nameKo: '포틀랜드 시멘트',
        category: 'construction',
        subcategory: 'cement',
        value: 0.93,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.11,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'GCCA 2022',
        sourceDB: 'GCCA',
        year: 2022,
        geographicScope: 'Global',
        quality: 'high',
        keywords: ['시멘트', 'cement', 'portland'],
        notes: '공정 배출(석회석 탈탄산)이 전체의 ~60%. 전력 의존도 낮음.'
    },
    {
        id: 'proxy_concrete',
        name: 'Ready-mix Concrete',
        nameKo: '레미콘',
        category: 'construction',
        subcategory: 'concrete',
        value: 0.13,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.02,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'high',
        keywords: ['콘크리트', 'concrete', '레미콘', 'ready-mix'],
    },
    {
        id: 'proxy_brick',
        name: 'Clay Brick',
        nameKo: '점토 벽돌',
        category: 'construction',
        subcategory: 'brick',
        value: 0.24,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.05,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['벽돌', 'brick', '점토', 'clay'],
    },

    // =========================================================================
    // 화학물질 (Chemicals)
    // =========================================================================
    {
        id: 'proxy_epoxy',
        name: 'Epoxy Resin',
        nameKo: '에폭시 수지',
        category: 'chemicals',
        subcategory: 'resin',
        value: 5.7,
        unit: 'kgCO2e/kg',
        electricityIntensity: 1.5,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['에폭시', 'epoxy', '수지', 'resin', '접착제'],
    },
    {
        id: 'proxy_paint',
        name: 'Paint, solvent-based',
        nameKo: '도료 (용제형)',
        category: 'chemicals',
        subcategory: 'coating',
        value: 3.8,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.4,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['도료', 'paint', '페인트', '도장', 'coating', '코팅'],
    },
    {
        id: 'proxy_silicone',
        name: 'Silicone Sealant',
        nameKo: '실리콘 실란트',
        category: 'chemicals',
        subcategory: 'sealant',
        value: 4.8,
        unit: 'kgCO2e/kg',
        electricityIntensity: 1.0,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'low',
        keywords: ['실리콘', 'silicone', '실란트', 'sealant', '씰링'],
    },

    // =========================================================================
    // 섬유 (Textiles)
    // =========================================================================
    {
        id: 'proxy_cotton',
        name: 'Cotton Fibre',
        nameKo: '면 섬유',
        category: 'textiles',
        subcategory: 'natural',
        value: 5.9,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.6,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Cotton Inc. 2022',
        sourceDB: 'cotton_inc',
        year: 2022,
        geographicScope: 'Global',
        quality: 'high',
        keywords: ['면', 'cotton', '코튼', '원면', '직물', 'fabric'],
        notes: '농업 단계(비료, 관개) 포함.'
    },
    {
        id: 'proxy_polyester_fiber',
        name: 'Polyester Fibre',
        nameKo: '폴리에스터 섬유',
        category: 'textiles',
        subcategory: 'synthetic',
        value: 5.55,
        unit: 'kgCO2e/kg',
        electricityIntensity: 1.4,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'medium',
        keywords: ['폴리에스터', 'polyester', 'PET 섬유', '합성섬유'],
    },

    // =========================================================================
    // 고무 (Rubber)
    // =========================================================================
    {
        id: 'proxy_natural_rubber',
        name: 'Natural Rubber',
        nameKo: '천연 고무',
        category: 'rubber',
        subcategory: 'natural',
        value: 2.6,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.3,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'medium',
        keywords: ['천연고무', 'natural rubber', '고무', 'rubber'],
    },
    {
        id: 'proxy_synthetic_rubber',
        name: 'Synthetic Rubber (SBR)',
        nameKo: '합성 고무 (SBR)',
        category: 'rubber',
        subcategory: 'synthetic',
        value: 3.1,
        unit: 'kgCO2e/kg',
        electricityIntensity: 0.8,
        baseCountry: 'EU',
        baseGridFactor: 0.276,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Europe',
        quality: 'medium',
        keywords: ['합성고무', 'synthetic rubber', 'SBR', 'EPDM', '타이어', 'tire'],
    },

    // =========================================================================
    // 전자부품 (Electronics)
    // =========================================================================
    {
        id: 'proxy_pcb',
        name: 'Printed Circuit Board (multi-layer)',
        nameKo: 'PCB (다층 인쇄회로기판)',
        category: 'electronics',
        subcategory: 'pcb',
        value: 26.0,
        unit: 'kgCO2e/kg',
        electricityIntensity: 8.0,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'low',
        keywords: ['PCB', '인쇄회로기판', 'printed circuit board', '기판', '회로'],
    },
    {
        id: 'proxy_ic_chip',
        name: 'Integrated Circuit (logic)',
        nameKo: 'IC 칩 (로직)',
        category: 'electronics',
        subcategory: 'semiconductor',
        value: 50.0,
        unit: 'kgCO2e/kg',
        electricityIntensity: 20.0,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'Ecoinvent 3.9.1 (estimated)',
        sourceDB: 'ecoinvent',
        year: 2022,
        geographicScope: 'Global',
        quality: 'low',
        keywords: ['IC', '칩', 'chip', '반도체', 'semiconductor', 'wafer', '웨이퍼', 'CPU', 'MCU'],
        notes: '반도체 공정 복잡성으로 불확실성 높음. 질량당 배출이 매우 높음.'
    },
    {
        id: 'proxy_battery_liion',
        name: 'Li-ion Battery Cell',
        nameKo: '리튬이온 배터리 셀',
        category: 'electronics',
        subcategory: 'battery',
        value: 73.0,
        unit: 'kgCO2e/kWh',
        electricityIntensity: 50.0,
        baseCountry: 'GLOBAL',
        baseGridFactor: 0.475,
        source: 'IVL Swedish Environmental Research Institute 2022',
        sourceDB: 'IVL',
        year: 2022,
        geographicScope: 'Global',
        quality: 'medium',
        keywords: ['리튬', 'lithium', '배터리', 'battery', 'Li-ion', 'LFP', 'NMC', 'NCA'],
        notes: '단위: kgCO2e/kWh (질량 아닌 용량 기준). 생산 국가 전력에 매우 민감.'
    }
]

// =============================================================================
// 카테고리 라벨
// =============================================================================

export const PROXY_CATEGORY_LABELS: Record<ProxyCategory, { ko: string; en: string; icon: string }> = {
    metals: { ko: '금속', en: 'Metals', icon: '🔩' },
    plastics: { ko: '플라스틱', en: 'Plastics', icon: '🧪' },
    wood_paper: { ko: '목재/종이', en: 'Wood & Paper', icon: '🪵' },
    glass_ceramic: { ko: '유리/세라믹', en: 'Glass & Ceramic', icon: '🪟' },
    construction: { ko: '건설자재', en: 'Construction', icon: '🏗️' },
    chemicals: { ko: '화학물질', en: 'Chemicals', icon: '⚗️' },
    textiles: { ko: '섬유', en: 'Textiles', icon: '🧵' },
    electronics: { ko: '전자부품', en: 'Electronics', icon: '💻' },
    rubber: { ko: '고무', en: 'Rubber', icon: '🛞' },
    other: { ko: '기타', en: 'Other', icon: '📦' }
}

// =============================================================================
// 핵심 함수
// =============================================================================

/**
 * 키워드 기반 Proxy 검색
 */
export const searchProxy = (keyword: string, category?: ProxyCategory): ProxySearchResult[] => {
    const searchTerms = keyword.toLowerCase().split(/\s+/)
    const results: ProxySearchResult[] = []

    for (const proxy of PROXY_EMISSION_FACTORS) {
        if (category && proxy.category !== category) continue

        let maxScore = 0
        let matchReason = ''

        // ID 정확 매치
        if (proxy.id === keyword) {
            maxScore = 100
            matchReason = 'ID 정확 일치'
        }

        // 이름 매치
        const nameLower = `${proxy.name} ${proxy.nameKo}`.toLowerCase()
        for (const term of searchTerms) {
            if (nameLower.includes(term)) {
                const score = Math.min(95, 70 + (term.length * 3))
                if (score > maxScore) {
                    maxScore = score
                    matchReason = `이름 매칭: "${term}"`
                }
            }
        }

        // 키워드 매치
        for (const kw of proxy.keywords) {
            for (const term of searchTerms) {
                if (kw.toLowerCase().includes(term) || term.includes(kw.toLowerCase())) {
                    const score = Math.min(90, 60 + (term.length * 2))
                    if (score > maxScore) {
                        maxScore = score
                        matchReason = `키워드 매칭: "${kw}"`
                    }
                }
            }
        }

        // 서브카테고리 매치
        if (proxy.subcategory) {
            for (const term of searchTerms) {
                if (proxy.subcategory.includes(term)) {
                    const score = 50
                    if (score > maxScore) {
                        maxScore = score
                        matchReason = `카테고리 매칭: "${proxy.subcategory}"`
                    }
                }
            }
        }

        if (maxScore > 30) {
            results.push({ proxy, matchScore: maxScore, matchReason })
        }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 10)
}

/**
 * 국가별 전력 믹스 보정
 * 
 * 보정 공식:
 * V_adjusted = V_base - (EI × EF_base) + (EI × EF_target)
 * 
 * 여기서:
 * - V_base: 원래 배출계수
 * - EI: 전력 집약도 (kWh/kg)
 * - EF_base: 원래 DB의 전력 배출계수
 * - EF_target: 대상 국가의 전력 배출계수
 */
export const adjustForCountry = (
    proxy: ProxyEmissionFactor,
    targetCountryCode: string
): CountryAdjustedProxy => {
    const targetGrid = ELECTRICITY_EMISSION_FACTORS.find(
        f => f.countryCode === targetCountryCode && f.tier === 'consumption' && !f.averagePeriod
    )

    if (!targetGrid) {
        return {
            original: proxy,
            adjustedValue: proxy.value,
            adjustmentFactor: 1.0,
            targetCountry: targetCountryCode,
            targetGridFactor: proxy.baseGridFactor,
            explanation: `No grid factor found for ${targetCountryCode}. Using original value.`,
            explanationKo: `${targetCountryCode}의 전력 배출계수를 찾을 수 없어 원래 값을 사용합니다.`
        }
    }

    const ei = proxy.electricityIntensity
    const efBase = proxy.baseGridFactor
    const efTarget = targetGrid.value

    // 전력 기여분 차이만 보정
    const electricityDiff = ei * (efTarget - efBase)
    const adjustedValue = Math.max(0, proxy.value + electricityDiff)
    const adjustmentFactor = proxy.value > 0 ? adjustedValue / proxy.value : 1.0

    const diffPercent = ((adjustmentFactor - 1) * 100).toFixed(1)
    const direction = adjustmentFactor >= 1 ? '증가' : '감소'

    return {
        original: proxy,
        adjustedValue: Math.round(adjustedValue * 1000) / 1000,
        adjustmentFactor: Math.round(adjustmentFactor * 1000) / 1000,
        targetCountry: targetCountryCode,
        targetGridFactor: efTarget,
        explanation: `Adjusted from ${proxy.baseCountry} (${efBase} kgCO2e/kWh) to ${targetCountryCode} (${efTarget} kgCO2e/kWh). Electricity intensity: ${ei} kWh/kg. Change: ${diffPercent}%.`,
        explanationKo: `${proxy.baseCountry} (${efBase}) → ${targetCountryCode} (${efTarget}) 보정. 전력 집약도: ${ei} kWh/kg. 변화: ${diffPercent}% ${direction}.`
    }
}

/**
 * Proxy 대표성 자동 평가
 */
export const assessProxyQuality = (
    proxy: ProxyEmissionFactor,
    actualProduct: string,
    actualCountry?: string,
    actualYear?: number
): ProxyAssessment => {
    // 기술적 매칭 (이름/키워드 유사도)
    const searchResults = searchProxy(actualProduct)
    const bestMatch = searchResults.find(r => r.proxy.id === proxy.id)
    const techScore = bestMatch
        ? Math.max(1, Math.ceil(5 - (bestMatch.matchScore / 25)))
        : 4

    // 지리적 매칭
    let geoScore = 3 // 기본: 보통
    if (actualCountry) {
        if (proxy.baseCountry === actualCountry) geoScore = 1
        else if (proxy.geographicScope === 'Global') geoScore = 2
        else if (proxy.baseCountry === 'EU' && ['DE', 'GB', 'FR', 'IT'].includes(actualCountry)) geoScore = 2
        else geoScore = 4
    }

    // 시간적 매칭
    let tempScore = 1
    if (actualYear) {
        const diff = Math.abs(actualYear - proxy.year)
        if (diff <= 2) tempScore = 1
        else if (diff <= 5) tempScore = 2
        else if (diff <= 10) tempScore = 3
        else tempScore = 4
    }

    const overallScore = Math.round((techScore + geoScore + tempScore) / 3 * 10) / 10

    // 추천
    let recommendation = ''
    let recommendationKo = ''
    if (overallScore <= 2) {
        recommendation = 'Good proxy match. Suitable for use with documentation.'
        recommendationKo = '양호한 Proxy. 출처 문서화 후 사용 가능.'
    } else if (overallScore <= 3) {
        recommendation = 'Moderate proxy match. Consider seeking more specific data.'
        recommendationKo = '보통 수준의 Proxy. 더 구체적인 데이터 확보를 고려하세요.'
    } else {
        recommendation = 'Poor proxy match. Primary data collection is strongly recommended.'
        recommendationKo = '대표성 낮음. 1차 데이터 수집을 강력히 권장합니다.'
    }

    // 대안 제안
    const alternativeSearch = searchProxy(actualProduct)
    const suggestedAlternatives = alternativeSearch
        .filter(r => r.proxy.id !== proxy.id && r.matchScore > 50)
        .slice(0, 3)
        .map(r => r.proxy.id)

    return {
        proxyId: proxy.id,
        proxyName: proxy.nameKo,
        overallScore,
        technologicalMatch: techScore,
        geographicalMatch: geoScore,
        temporalMatch: tempScore,
        recommendation,
        recommendationKo,
        suggestedAlternatives
    }
}

/**
 * 카테고리별 Proxy 목록 조회
 */
export const getProxiesByCategory = (category: ProxyCategory): ProxyEmissionFactor[] => {
    return PROXY_EMISSION_FACTORS.filter(p => p.category === category)
}

/**
 * Proxy 통계
 */
export const getProxyStats = (): Record<ProxyCategory, number> => {
    const stats: Record<string, number> = {}
    for (const proxy of PROXY_EMISSION_FACTORS) {
        stats[proxy.category] = (stats[proxy.category] || 0) + 1
    }
    return stats as Record<ProxyCategory, number>
}
