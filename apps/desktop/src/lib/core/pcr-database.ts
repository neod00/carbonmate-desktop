/**
 * PCR (Product Category Rules) 종합 데이터베이스
 *
 * ISO 14067 원칙: "관련 PCR이 존재하면 반드시 채택해야 하며,
 * 여러 개 존재 시 비교·검토 후 선택한 이유를 정당화해야 함"
 *
 * 출처:
 * - PCR_Database_Comprehensive_Guide.md
 * - 국내외 PCR 조사 및 다운로드 링크.md
 * - 국내외 PCR 조사 및 다운로드 링크 (1).md
 */

import { BoundaryType } from './store'

// =============================================================================
// PCR 프로그램 운영자 정의
// =============================================================================

export type PCRProgram =
    | 'IES'          // International EPD System (Environdec, 스웨덴)
    | 'KEITI'        // 한국환경산업기술원
    | 'IBU'          // Institut Bauen und Umwelt (독일)
    | 'EPD_Norge'    // EPD Norway (노르웨이)
    | 'UL'           // UL Solutions (북미)
    | 'ASTM'         // ASTM International (미국)
    | 'Smart_EPD'    // Smart EPD (디지털 EPD)
    | 'SuMPO'        // SuMPO EPD Japan (일본)
    | 'PEP'          // PEP ecopassport (전기·전자)
    | 'EU_PEFCR'     // EU Product Environmental Footprint
    | 'BRE'          // BRE Global (영국)
    | 'EPD_Italy'    // EPD Italy
    | 'EPD_Australasia' // EPD Australasia
    | 'BIFMA'        // BIFMA (사무용 가구)
    | 'GBA'          // Global Battery Alliance

export type PCRRegion = 'global' | 'korea' | 'europe' | 'north_america' | 'japan' | 'australasia'

export type RegulatoryContext =
    | 'CBAM'                // EU 탄소국경조정제도
    | 'Battery_Regulation'  // EU 배터리법
    | 'DPP'                 // 디지털 제품 여권
    | 'LEED'                // LEED 친환경 건축 인증
    | 'EPD_Certification'   // EPD 인증
    | 'KEITI_EPD'           // 한국 환경성적표지
    | 'KEITI_MRA'           // KEITI-EPD Norge MRA

// =============================================================================
// PCR 엔트리 타입
// =============================================================================

export interface PCRDatabaseEntry {
    id: string
    name: string
    nameKo: string
    operator: string
    program: PCRProgram
    region: PCRRegion
    version?: string
    validUntil?: string
    // 매칭 가능한 PRODUCT_CATEGORIES id 배열
    categories: string[]
    // 다운로드 및 참조 URL
    downloadUrl?: string
    infoUrl?: string
    // 규제 맥락
    regulatoryContext: RegulatoryContext[]
    // PCR이 요구하는 시스템 경계
    boundaryRequirement?: BoundaryType
    // 특수 규칙
    specialRules: {
        usePhaseExcluded?: boolean       // 사용단계 배제 여부
        primaryDataRequired?: boolean     // 1차 데이터 필수 여부
        moduleDRequired?: boolean         // 모듈 D(재활용 편익) 필수 여부
        moduleCRequired?: boolean         // 모듈 C(폐기) 필수 여부
        recyclingRatioRequired?: boolean  // 재활용 비율 산정 필수
        cffFormulaRequired?: boolean      // CFF(순환 발자국 공식) 적용 필수
        scrapZeroAllocation?: boolean     // 스크랩 투입 배출량 0 간주
        indirectEmissionsRequired?: boolean // 간접 배출량(전력) 포함 필수
    }
    // 추가 경고/안내 메시지
    warnings?: string[]
    // 관련 EN 표준
    enStandard?: string
    // 검색용 키워드
    keywords: string[]
}

// =============================================================================
// PCR 데이터베이스
// =============================================================================

export const PCR_DATABASE: PCRDatabaseEntry[] = [

    // =========================================================================
    // 1. EU PEFCR (규제 최상위)
    // =========================================================================
    {
        id: 'pefcr-battery-ev',
        name: 'PEFCR for EV Batteries (JRC)',
        nameKo: 'EU 배터리법 PEFCR — EV 배터리',
        operator: 'EU JRC (Joint Research Centre)',
        program: 'EU_PEFCR',
        region: 'europe',
        categories: ['automotive'],
        downloadUrl: 'https://eplca.jrc.ec.europa.eu/GRB-CBF_CarbonFootprintRules-EV.pdf',
        infoUrl: 'https://eplca.jrc.ec.europa.eu/EnvironmentalFootprint.html',
        regulatoryContext: ['Battery_Regulation', 'DPP'],
        boundaryRequirement: 'cradle-to-gate',
        specialRules: {
            usePhaseExcluded: true,
            primaryDataRequired: true,
            recyclingRatioRequired: true,
            cffFormulaRequired: true,
        },
        warnings: [
            'EU 배터리법에 따라 사용단계(Use-phase)는 배제됩니다.',
            '공장별·모델별 1차 데이터(Primary data) 사용이 강제됩니다.',
            'CFP 10% 이상 변동 시 전면 재산정 및 새 선언서 발행 필요.',
            '2031년 리튬 6%, 납 85% 등 최소 재활용 투입 비율 준수 필요.',
        ],
        keywords: ['battery', 'EV', '배터리', '전기자동차', 'PEFCR', 'JRC', 'NMC', 'LFP', '이차전지'],
    },
    {
        id: 'pefcr-dairy',
        name: 'PEFCR for Dairy Products',
        nameKo: 'EU PEFCR — 유제품',
        operator: 'EU JRC / EDA',
        program: 'EU_PEFCR',
        region: 'europe',
        categories: ['food'],
        downloadUrl: 'https://eda.euromilk.org/wp-content/uploads/2025/02/PEFCR-DairyProducts_update_final.pdf',
        infoUrl: 'https://eplca.jrc.ec.europa.eu/EnvironmentalFootprint.html',
        regulatoryContext: ['DPP'],
        boundaryRequirement: 'cradle-to-grave',
        specialRules: {},
        keywords: ['dairy', '유제품', '우유', '치즈', '요거트'],
    },
    {
        id: 'pefcr-apparel',
        name: 'PEFCR for Apparel & Footwear',
        nameKo: 'EU PEFCR — 의류 및 신발',
        operator: 'EU JRC',
        program: 'EU_PEFCR',
        region: 'europe',
        categories: ['textiles'],
        downloadUrl: 'https://www.carbonfact.com/hubfs/A%26FW_PEFCR_v3.1.pdf',
        regulatoryContext: ['DPP'],
        boundaryRequirement: 'cradle-to-grave',
        specialRules: {},
        keywords: ['apparel', 'footwear', '의류', '신발', '섬유', 'fashion'],
    },
    {
        id: 'pefcr-guidance',
        name: 'PEFCR Guidance v6.3',
        nameKo: 'EU PEFCR 가이던스 (공통 규칙)',
        operator: 'EU JRC',
        program: 'EU_PEFCR',
        region: 'europe',
        categories: [],
        downloadUrl: 'https://eplca.jrc.ec.europa.eu/permalink/PEFCR_guidance_v6.3-2.pdf',
        regulatoryContext: [],
        specialRules: {},
        keywords: ['PEFCR', 'guidance', '공통', '가이던스'],
    },

    // =========================================================================
    // 2. International EPD System (IES) — 255+ PCR
    // =========================================================================
    {
        id: 'ies-construction-en15804',
        name: 'PCR 2019:14 Construction Products v2.0.0',
        nameKo: '건설 제품 (EN 15804+A2)',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        version: '2.0.0',
        validUntil: '2030-12-31',
        categories: ['construction'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        infoUrl: 'https://www.environdec.com/news/pcr-construction-products-v200',
        regulatoryContext: ['EPD_Certification', 'CBAM'],
        enStandard: 'EN 15804+A2',
        specialRules: {
            moduleCRequired: true,
            moduleDRequired: true,
        },
        warnings: [
            'EN 15804+A2: 모듈 C1-C4(폐기) 및 모듈 D(재활용 편익) 의무.',
            'PCR v1.3.4는 2025.06.20 폐지 → 반드시 v2.0.0 사용.',
        ],
        keywords: ['construction', '건설', '건축', '시멘트', '콘크리트', 'EN 15804', 'EPD'],
    },
    {
        id: 'ies-cement-en16908',
        name: 'Cement and building lime (EN 16908)',
        nameKo: '시멘트 및 건축용 석회',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['construction'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification', 'CBAM'],
        enStandard: 'EN 16908',
        specialRules: {
            scrapZeroAllocation: true,
            indirectEmissionsRequired: true,
        },
        warnings: [
            '플라이 애시, 고로 슬래그 등은 회수된 재료로 취급 → 할당 제한.',
            'CBAM 대응 시 간접 배출량(전력) 포함 필수.',
        ],
        keywords: ['cement', '시멘트', '석회', 'lime', 'CBAM'],
    },
    {
        id: 'ies-concrete-en16757',
        name: 'Concrete and concrete elements (EN 16757)',
        nameKo: '콘크리트 및 콘크리트 요소',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['construction'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        enStandard: 'EN 16757',
        specialRules: {},
        keywords: ['concrete', '콘크리트', '레미콘'],
    },
    {
        id: 'ies-windows-en17213',
        name: 'Windows and doors (EN 17213)',
        nameKo: '창호 (windows & doors)',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['construction'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        enStandard: 'EN 17213',
        specialRules: {},
        keywords: ['windows', 'doors', '창호', '창문', '문'],
    },
    {
        id: 'ies-flat-glass-en17074',
        name: 'Flat glass products (EN 17074)',
        nameKo: '평면 유리 제품',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['construction'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        enStandard: 'EN 17074',
        specialRules: {},
        keywords: ['glass', '유리', '평면유리'],
    },
    {
        id: 'ies-steel',
        name: 'Basic iron or steel products & special steels',
        nameKo: '철강 제품 및 특수강',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['materials', 'construction'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification', 'CBAM'],
        specialRules: {
            scrapZeroAllocation: true,
            indirectEmissionsRequired: true,
        },
        warnings: [
            '미가공 스크랩 투입 시 내재 배출량 0 간주 (ISO 20915).',
            'CBAM 대응 시 간접 배출량(전력) 및 전구체 배출량 포함 필수.',
        ],
        keywords: ['steel', '철강', '강철', '스크랩', 'CBAM', 'iron'],
    },
    {
        id: 'ies-aluminium',
        name: 'Basic aluminium products and special alloys',
        nameKo: '알루미늄 제품 및 특수합금',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['materials'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification', 'CBAM'],
        specialRules: { indirectEmissionsRequired: true },
        keywords: ['aluminium', 'aluminum', '알루미늄'],
    },
    {
        id: 'ies-basic-chemicals',
        name: 'Basic chemicals',
        nameKo: '기본 화학물질',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['materials'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['chemicals', '화학', '화학물질'],
    },
    {
        id: 'ies-plastics',
        name: 'Plastics in primary forms',
        nameKo: '일차 형태의 플라스틱',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['materials', 'packaging'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['plastics', '플라스틱', 'polymer', '수지'],
    },
    {
        id: 'ies-fertilisers',
        name: 'Fertilisers',
        nameKo: '비료',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['materials'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification', 'CBAM'],
        specialRules: {},
        keywords: ['fertiliser', 'fertilizer', '비료'],
    },
    {
        id: 'ies-food-beverage',
        name: 'Food and beverage products (Main PCR)',
        nameKo: '식품 및 음료 (메인 PCR)',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['food'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        boundaryRequirement: 'cradle-to-grave',
        specialRules: {},
        keywords: ['food', 'beverage', '식품', '음료', '음식'],
    },
    {
        id: 'ies-meat',
        name: 'Meat of mammals',
        nameKo: '포유류 육류',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['food'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['meat', '육류', '소고기', '돼지고기'],
    },
    {
        id: 'ies-electronics',
        name: 'Electronic and electric equipment (non-construction)',
        nameKo: '전자·전기 기기 (비건설용)',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['electronics'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        boundaryRequirement: 'cradle-to-grave',
        specialRules: {},
        keywords: ['electronics', '전자', '전기', 'electronic', 'electric'],
    },
    {
        id: 'ies-ev-charging',
        name: 'Electric vehicle charging infrastructures (c-PCR)',
        nameKo: 'EV 충전 인프라',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['automotive', 'electronics'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['EV charging', '충전', '전기차충전', 'charger'],
    },
    {
        id: 'ies-passenger-cars',
        name: 'Passenger cars',
        nameKo: '승용차',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['automotive'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        boundaryRequirement: 'cradle-to-grave',
        specialRules: {},
        keywords: ['car', '자동차', '승용차', 'vehicle'],
    },
    {
        id: 'ies-apparel',
        name: 'Apparel, except fur and leather apparel',
        nameKo: '의류 (모피/가죽 제외)',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['textiles'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['apparel', '의류', '옷', 'clothing'],
    },
    {
        id: 'ies-footwear',
        name: 'Footwear',
        nameKo: '신발',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['textiles'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['footwear', '신발', 'shoes'],
    },
    {
        id: 'ies-electricity',
        name: 'Electricity, steam and hot/cold water generation',
        nameKo: '전기, 증기, 온냉수 생산 및 배급',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['other'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['electricity', '전기', 'steam', '증기', 'energy', '에너지'],
    },
    {
        id: 'ies-luminaires',
        name: 'Luminaires',
        nameKo: '조명기구',
        operator: 'EPD International',
        program: 'IES',
        region: 'global',
        categories: ['electronics', 'construction'],
        downloadUrl: 'https://www.environdec.com/pcr-library',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['luminaires', '조명', 'lighting', 'LED'],
    },

    // =========================================================================
    // 3. KEITI (한국환경산업기술원)
    // =========================================================================
    {
        id: 'keiti-common',
        name: '환경성적표지 작성지침 (공통지침)',
        nameKo: '환경성적표지 작성지침 (공통지침)',
        operator: '한국환경산업기술원 (KEITI)',
        program: 'KEITI',
        region: 'korea',
        categories: [],
        downloadUrl: 'https://www.data.go.kr/data/15089170/fileData.do',
        infoUrl: 'https://law.go.kr/admRulLsInfoP.do?admRulId=26196&efYd=0',
        regulatoryContext: ['KEITI_EPD', 'KEITI_MRA'],
        specialRules: {},
        warnings: [
            'KEITI-EPD Norge MRA 체결(2024.11): 한국 환경성적표지 = 유럽 통용.',
        ],
        keywords: ['KEITI', '환경성적표지', '공통지침', '한국'],
    },
    {
        id: 'keiti-food',
        name: '환경성적표지 PCR — 식료품',
        nameKo: '환경성적표지 PCR — 식료품',
        operator: '한국환경산업기술원 (KEITI)',
        program: 'KEITI',
        region: 'korea',
        version: '개정 2022',
        categories: ['food'],
        downloadUrl: 'https://www.data.go.kr/data/15089170/fileData.do',
        regulatoryContext: ['KEITI_EPD', 'KEITI_MRA'],
        boundaryRequirement: 'cradle-to-grave',
        specialRules: {},
        keywords: ['식료품', '식품', 'food', 'KEITI'],
    },
    {
        id: 'keiti-electronics',
        name: '환경성적표지 PCR — 전기전자',
        nameKo: '환경성적표지 PCR — 전기전자',
        operator: '한국환경산업기술원 (KEITI)',
        program: 'KEITI',
        region: 'korea',
        version: '개정 2023',
        categories: ['electronics'],
        downloadUrl: 'https://www.data.go.kr/data/15089170/fileData.do',
        regulatoryContext: ['KEITI_EPD', 'KEITI_MRA'],
        boundaryRequirement: 'cradle-to-grave',
        specialRules: {},
        keywords: ['전기전자', '전자제품', 'electronics', 'KEITI'],
    },
    {
        id: 'keiti-packaging',
        name: '환경성적표지 PCR — 포장재',
        nameKo: '환경성적표지 PCR — 포장재',
        operator: '한국환경산업기술원 (KEITI)',
        program: 'KEITI',
        region: 'korea',
        version: '개정 2023',
        categories: ['packaging'],
        downloadUrl: 'https://www.data.go.kr/data/15089170/fileData.do',
        regulatoryContext: ['KEITI_EPD', 'KEITI_MRA'],
        specialRules: {},
        keywords: ['포장재', 'packaging', 'KEITI'],
    },
    {
        id: 'keiti-construction',
        name: '환경성적표지 PCR — 건설자재',
        nameKo: '환경성적표지 PCR — 건설자재',
        operator: '한국환경산업기술원 (KEITI)',
        program: 'KEITI',
        region: 'korea',
        categories: ['construction'],
        downloadUrl: 'https://www.data.go.kr/data/15089170/fileData.do',
        regulatoryContext: ['KEITI_EPD', 'KEITI_MRA'],
        specialRules: {},
        keywords: ['건설', '건설자재', 'construction', 'KEITI'],
    },
    {
        id: 'keiti-battery',
        name: '환경성적표지 개별지침 — 전기자동차용 이차전지',
        nameKo: '환경성적표지 개별지침 — EV 이차전지',
        operator: '한국환경산업기술원 (KEITI)',
        program: 'KEITI',
        region: 'korea',
        version: '2025-127호 (2025.07.30 시행)',
        categories: ['automotive'],
        downloadUrl: 'https://law.go.kr/admRulLsInfoP.do?admRulId=26196&efYd=0',
        regulatoryContext: ['KEITI_EPD', 'KEITI_MRA', 'Battery_Regulation'],
        boundaryRequirement: 'cradle-to-gate',
        specialRules: {
            primaryDataRequired: true,
        },
        warnings: [
            '2025년 신설된 21개 핵심 품목 중 하나 (환경부고시 제2025-127호).',
            'EU 배터리법 대응을 위한 국내 산정 기반 재설계.',
        ],
        keywords: ['이차전지', '배터리', 'battery', 'EV', 'KEITI', '전기자동차'],
    },
    {
        id: 'keiti-tire',
        name: '환경성적표지 개별지침 — 자동차용 타이어',
        nameKo: '환경성적표지 개별지침 — 자동차용 타이어',
        operator: '한국환경산업기술원 (KEITI)',
        program: 'KEITI',
        region: 'korea',
        version: '2025-127호 (2025.07.30 시행)',
        categories: ['automotive'],
        downloadUrl: 'https://law.go.kr/admRulLsInfoP.do?admRulId=26196&efYd=0',
        regulatoryContext: ['KEITI_EPD'],
        specialRules: {},
        warnings: ['2025년 신설된 21개 핵심 품목 중 하나.'],
        keywords: ['타이어', 'tire', 'KEITI', '자동차'],
    },
    {
        id: 'keiti-textile',
        name: '환경성적표지 PCR — 섬유/의류',
        nameKo: '환경성적표지 PCR — 섬유/의류',
        operator: '한국환경산업기술원 (KEITI)',
        program: 'KEITI',
        region: 'korea',
        categories: ['textiles'],
        downloadUrl: 'https://www.data.go.kr/data/15089170/fileData.do',
        regulatoryContext: ['KEITI_EPD', 'KEITI_MRA'],
        specialRules: {},
        keywords: ['섬유', '의류', 'textile', 'apparel', 'KEITI'],
    },

    // =========================================================================
    // 4. IBU (독일, 건설 자재 중심)
    // =========================================================================
    {
        id: 'ibu-part-a',
        name: 'IBU PCR Part A (EN 15804 기반 공통 규칙)',
        nameKo: 'IBU PCR Part A — 건설 제품 공통규칙',
        operator: 'Institut Bauen und Umwelt (IBU)',
        program: 'IBU',
        region: 'europe',
        categories: ['construction'],
        downloadUrl: 'https://epd-online.com',
        infoUrl: 'https://ibu-epd.com/en/faq-items/where-can-i-find-the-product-category-rules-or-pcr-parts-a-and-b/',
        regulatoryContext: ['EPD_Certification', 'CBAM'],
        enStandard: 'EN 15804+A2',
        specialRules: {
            moduleCRequired: true,
            moduleDRequired: true,
        },
        keywords: ['IBU', '독일', 'Germany', 'Part A', '건설'],
    },

    // =========================================================================
    // 5. EPD Norge (노르웨이)
    // =========================================================================
    {
        id: 'npcr-steel',
        name: 'NPCR 013 Steel as construction material',
        nameKo: 'NPCR 013 건설용 철강',
        operator: 'EPD Norge',
        program: 'EPD_Norge',
        region: 'europe',
        categories: ['construction', 'materials'],
        downloadUrl: 'https://epdnorway.lca-data.com/resource/sources/904ae691-ef63-4175-b016-525ed16be513/NPCR013+2013+Steel+as+construction+matierial+rev1.pdf?version=00.00.005',
        regulatoryContext: ['EPD_Certification', 'KEITI_MRA', 'CBAM'],
        specialRules: { scrapZeroAllocation: true },
        warnings: ['KEITI-EPD Norge MRA 체결 → 한국 환경성적표지와 상호 인정.'],
        keywords: ['steel', '철강', 'NPCR', 'Norway', '노르웨이'],
    },
    {
        id: 'npcr-concrete',
        name: 'NPCR 020 Concrete and concrete elements',
        nameKo: 'NPCR 020 콘크리트 및 콘크리트 요소',
        operator: 'EPD Norge',
        program: 'EPD_Norge',
        region: 'europe',
        categories: ['construction'],
        downloadUrl: 'https://epdnorway.lca-data.com/resource/sources/80178835-adba-4f34-8ed5-1427fc86fa21/NPCR_020_Part_B_for_Concrete_and_concrete_elements%2B181018%2B%282%29.pdf?version=00.00.004',
        regulatoryContext: ['EPD_Certification', 'KEITI_MRA'],
        specialRules: {},
        keywords: ['concrete', '콘크리트', 'NPCR', 'Norway'],
    },
    {
        id: 'npcr-furniture',
        name: 'NPCR 026 Furniture and components (c-PCR under PCR 2019:14)',
        nameKo: 'NPCR 026 가구 및 부품',
        operator: 'EPD Norge / EPD International',
        program: 'EPD_Norge',
        region: 'europe',
        categories: ['other'],
        infoUrl: 'https://www.environdec.com/pcr-library/pcr_a4e3500e-9346-4598-9bd1-08dab6704842',
        regulatoryContext: ['EPD_Certification', 'KEITI_MRA'],
        specialRules: {},
        keywords: ['furniture', '가구', 'NPCR'],
    },

    // =========================================================================
    // 6. UL Solutions (북미)
    // =========================================================================
    {
        id: 'ul-insulation',
        name: 'Building Envelope Thermal Insulation PCR',
        nameKo: '건축 외피 단열재 PCR',
        operator: 'UL Solutions',
        program: 'UL',
        region: 'north_america',
        categories: ['construction'],
        downloadUrl: 'https://www.ul.com/resources/product-category-rules-pcrs',
        regulatoryContext: ['LEED', 'EPD_Certification'],
        specialRules: {},
        keywords: ['insulation', '단열', 'UL', '북미', 'LEED'],
    },
    {
        id: 'ul-metal-panels',
        name: 'Metal Composite Panels and Metal Cladding PCR',
        nameKo: '금속 패널 및 클래딩 PCR',
        operator: 'UL Solutions',
        program: 'UL',
        region: 'north_america',
        validUntil: '2026-04-30',
        categories: ['construction'],
        downloadUrl: 'https://www.ul.com/resources/product-category-rules-pcrs',
        regulatoryContext: ['LEED', 'EPD_Certification'],
        specialRules: {},
        keywords: ['metal panel', '금속 패널', 'cladding', 'UL'],
    },

    // =========================================================================
    // 7. Smart EPD & ASTM
    // =========================================================================
    {
        id: 'smart-epd-steel',
        name: 'Designated Steel Construction Product (Part B, v3.0)',
        nameKo: '지정 철강 건축 제품 v3.0',
        operator: 'Smart EPD',
        program: 'Smart_EPD',
        region: 'north_america',
        version: '3.0',
        categories: ['construction', 'materials'],
        downloadUrl: 'https://smartepd.com/pcr-library/',
        regulatoryContext: ['EPD_Certification', 'CBAM'],
        specialRules: { scrapZeroAllocation: true },
        keywords: ['steel', '철강', 'Smart EPD'],
    },
    {
        id: 'smart-epd-cement',
        name: 'Cement (Part B, v1.0, EN 16908 compatible)',
        nameKo: '시멘트 v1.0 (EN 16908 호환)',
        operator: 'Smart EPD',
        program: 'Smart_EPD',
        region: 'north_america',
        version: '1.0',
        categories: ['construction'],
        downloadUrl: 'https://smartepd.com/pcr-library/',
        regulatoryContext: ['EPD_Certification', 'CBAM'],
        specialRules: {},
        keywords: ['cement', '시멘트', 'Smart EPD'],
    },
    {
        id: 'astm-aggregates',
        name: 'PCR for Construction Aggregates (NSF/ASTM 1126-23)',
        nameKo: 'ASTM 건설 골재 PCR',
        operator: 'ASTM International',
        program: 'ASTM',
        region: 'north_america',
        categories: ['construction'],
        downloadUrl: 'https://www.astm.org/standards-and-solutions/certification/environmental-product-declarations/epd-pcr',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['aggregates', '골재', 'ASTM'],
    },

    // =========================================================================
    // 8. SuMPO EPD Japan (일본)
    // =========================================================================
    {
        id: 'sumpo-electronics',
        name: 'PA-SuMPO-PCR-02000 Electrical and Electronic Products',
        nameKo: 'SuMPO 전기전자 제품 PCR',
        operator: 'SuMPO EPD Japan',
        program: 'SuMPO',
        region: 'japan',
        categories: ['electronics'],
        downloadUrl: 'https://www.ecoleaf-jemai.jp/eng/pcr.html',
        infoUrl: 'https://www.cfp-japan.jp/english/overview/pdf/pcrlist.pdf',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['SuMPO', 'EcoLeaf', '일본', 'Japan', '전자', 'electronic'],
    },
    {
        id: 'sumpo-construction',
        name: 'PA-SuMPO-PCR-01000 Construction products (Core-PCR)',
        nameKo: 'SuMPO 건설 제품(코어 PCR)',
        operator: 'SuMPO EPD Japan',
        program: 'SuMPO',
        region: 'japan',
        categories: ['construction'],
        downloadUrl: 'https://www.ecoleaf-jemai.jp/eng/pcr.html',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['SuMPO', '건설', 'construction', 'Japan'],
    },
    {
        id: 'sumpo-food',
        name: 'PA-SuMPO-PCR-00002 Processed food and Beverage',
        nameKo: 'SuMPO 가공식품 및 음료 PCR',
        operator: 'SuMPO EPD Japan',
        program: 'SuMPO',
        region: 'japan',
        categories: ['food'],
        downloadUrl: 'https://www.ecoleaf-jemai.jp/eng/pcr.html',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['food', '식품', '음료', 'SuMPO', 'Japan'],
    },

    // =========================================================================
    // 9. PEP ecopassport (전기·전자 특화)
    // =========================================================================
    {
        id: 'pep-electrical',
        name: 'PEP ecopassport PCR Edition 4 (Electrical/Electronic/HVAC)',
        nameKo: 'PEP ecopassport — 전기·전자·HVAC 장비',
        operator: 'PEP ecopassport',
        program: 'PEP',
        region: 'europe',
        categories: ['electronics', 'machinery'],
        downloadUrl: 'https://www.pep-ecopassport.org/fileadmin/user_upload/PEP-PCR-ed4-EN-2021_09_14.pdf',
        infoUrl: 'https://register.pep-ecopassport.org/documents',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['PEP', 'HVAC', '전기', '전자', 'ecopassport'],
    },

    // =========================================================================
    // 10. 기타
    // =========================================================================
    {
        id: 'bre-construction',
        name: 'BRE PN514 PCR for Construction Products (EN 15804)',
        nameKo: 'BRE 건설 제품 PCR (영국)',
        operator: 'BRE Global',
        program: 'BRE',
        region: 'europe',
        categories: ['construction'],
        downloadUrl: 'https://www.greenbooklive.com/filelibrary/EN_15804/BRE-PN514-EN15804-A2-PCR-V3.1.pdf',
        regulatoryContext: ['EPD_Certification'],
        enStandard: 'EN 15804+A2',
        specialRules: { moduleCRequired: true, moduleDRequired: true },
        keywords: ['BRE', '영국', 'UK', 'construction'],
    },
    {
        id: 'bifma-seating',
        name: 'BIFMA PCR for Seating',
        nameKo: 'BIFMA 사무용 의자 PCR',
        operator: 'BIFMA',
        program: 'BIFMA',
        region: 'north_america',
        categories: ['other'],
        downloadUrl: 'https://d2evkimvhatqav.cloudfront.net/documents/seating_pcr-new.pdf',
        regulatoryContext: ['EPD_Certification'],
        specialRules: {},
        keywords: ['furniture', '가구', '의자', 'seating', 'BIFMA'],
    },
    {
        id: 'gba-battery-passport',
        name: 'GBA Battery Passport Greenhouse Gas Rulebook',
        nameKo: 'GBA 배터리 여권 온실가스 규칙',
        operator: 'Global Battery Alliance',
        program: 'GBA',
        region: 'global',
        categories: ['automotive'],
        downloadUrl: 'https://www.globalbattery.org/media/publications/op-trials-overview-deck.pdf',
        infoUrl: 'https://www.globalbattery.org/battery-passport/',
        regulatoryContext: ['Battery_Regulation', 'DPP'],
        specialRules: { primaryDataRequired: true },
        keywords: ['GBA', 'battery passport', '배터리 여권', 'ESG'],
    },
]

// =============================================================================
// 검색 / 필터링 유틸리티
// =============================================================================

/**
 * 프로그램별 정보
 */
export const PCR_PROGRAM_INFO: Record<PCRProgram, {
    name: string
    nameKo: string
    region: PCRRegion
    website: string
    color: string
}> = {
    IES: { name: 'International EPD System', nameKo: 'International EPD System', region: 'global', website: 'https://www.environdec.com/pcr-library', color: 'emerald' },
    KEITI: { name: 'KEITI', nameKo: '한국환경산업기술원', region: 'korea', website: 'https://ecosq.or.kr/', color: 'blue' },
    IBU: { name: 'IBU', nameKo: 'IBU (독일)', region: 'europe', website: 'https://epd-online.com', color: 'indigo' },
    EPD_Norge: { name: 'EPD Norge', nameKo: 'EPD 노르웨이', region: 'europe', website: 'https://epd-norge.no/', color: 'sky' },
    UL: { name: 'UL Solutions', nameKo: 'UL Solutions', region: 'north_america', website: 'https://www.ul.com', color: 'red' },
    ASTM: { name: 'ASTM International', nameKo: 'ASTM International', region: 'north_america', website: 'https://www.astm.org', color: 'orange' },
    Smart_EPD: { name: 'Smart EPD', nameKo: 'Smart EPD', region: 'north_america', website: 'https://smartepd.com/pcr-library/', color: 'violet' },
    SuMPO: { name: 'SuMPO EPD Japan', nameKo: 'SuMPO EPD (일본)', region: 'japan', website: 'https://www.ecoleaf-jemai.jp/eng/', color: 'rose' },
    PEP: { name: 'PEP ecopassport', nameKo: 'PEP ecopassport', region: 'europe', website: 'https://register.pep-ecopassport.org/documents', color: 'cyan' },
    EU_PEFCR: { name: 'EU PEFCR', nameKo: 'EU 제품환경발자국', region: 'europe', website: 'https://eplca.jrc.ec.europa.eu/EnvironmentalFootprint.html', color: 'amber' },
    BRE: { name: 'BRE Global', nameKo: 'BRE (영국)', region: 'europe', website: 'https://www.greenbooklive.com', color: 'teal' },
    EPD_Italy: { name: 'EPD Italy', nameKo: 'EPD Italy', region: 'europe', website: 'https://www.epditaly.it/en/', color: 'green' },
    EPD_Australasia: { name: 'EPD Australasia', nameKo: 'EPD Australasia', region: 'australasia', website: 'https://epd-australasia.com', color: 'yellow' },
    BIFMA: { name: 'BIFMA', nameKo: 'BIFMA (가구)', region: 'north_america', website: 'https://www.bifma.org', color: 'pink' },
    GBA: { name: 'GBA', nameKo: '글로벌 배터리 얼라이언스', region: 'global', website: 'https://www.globalbattery.org', color: 'lime' },
}

/**
 * 규제별 정보
 */
export const REGULATORY_INFO: Record<RegulatoryContext, {
    name: string
    nameKo: string
    icon: string
    description: string
}> = {
    CBAM: { name: 'EU CBAM', nameKo: 'EU 탄소국경조정제도', icon: '🏭', description: '철강/시멘트/알루미늄/비료/수소/전기 수출 시 필수' },
    Battery_Regulation: { name: 'EU Battery Regulation', nameKo: 'EU 배터리법', icon: '🔋', description: 'EV 배터리 탄소발자국 선언 의무' },
    DPP: { name: 'Digital Product Passport', nameKo: '디지털 제품 여권', icon: '📱', description: 'EU 에코디자인 규정에 따른 제품 환경 데이터' },
    LEED: { name: 'LEED Certification', nameKo: 'LEED 인증', icon: '🏢', description: '북미 친환경 건축물 인증 포인트 획득' },
    EPD_Certification: { name: 'EPD Certification', nameKo: 'EPD 인증', icon: '📋', description: '환경성적표지(EPD) 발행용' },
    KEITI_EPD: { name: 'KEITI EPD', nameKo: '한국 환경성적표지', icon: '🇰🇷', description: '한국 환경성적표지 인증' },
    KEITI_MRA: { name: 'KEITI-EPD Norge MRA', nameKo: 'KEITI-노르웨이 MRA', icon: '🤝', description: '한국↔유럽 상호인정협정 (2024.11 체결)' },
}

/**
 * 제품 카테고리별 PCR 추천
 */
export function getPCRsByCategory(categoryId: string): PCRDatabaseEntry[] {
    return PCR_DATABASE.filter(pcr => pcr.categories.includes(categoryId))
}

/**
 * 지역별 PCR 추천
 */
export function getPCRsByRegion(region: PCRRegion): PCRDatabaseEntry[] {
    return PCR_DATABASE.filter(pcr => pcr.region === region || pcr.region === 'global')
}

/**
 * 규제 맥락별 PCR 추천
 */
export function getPCRsByRegulation(regulation: RegulatoryContext): PCRDatabaseEntry[] {
    return PCR_DATABASE.filter(pcr => pcr.regulatoryContext.includes(regulation))
}

/**
 * 카테고리 + 지역 + 규제를 종합하여 추천
 */
export function recommendPCRs(params: {
    categoryId?: string
    region?: PCRRegion
    regulation?: RegulatoryContext
    keyword?: string
}): PCRDatabaseEntry[] {
    let results = [...PCR_DATABASE]

    if (params.categoryId) {
        results = results.filter(pcr =>
            pcr.categories.includes(params.categoryId!) || pcr.categories.length === 0
        )
    }

    if (params.region) {
        results = results.filter(pcr =>
            pcr.region === params.region || pcr.region === 'global'
        )
    }

    if (params.regulation) {
        results = results.filter(pcr =>
            pcr.regulatoryContext.includes(params.regulation!)
        )
    }

    if (params.keyword) {
        const kw = params.keyword.toLowerCase()
        results = results.filter(pcr =>
            pcr.keywords.some(k => k.toLowerCase().includes(kw)) ||
            pcr.name.toLowerCase().includes(kw) ||
            pcr.nameKo.includes(kw)
        )
    }

    // 규제 연관 PCR을 상위로 정렬
    results.sort((a, b) => b.regulatoryContext.length - a.regulatoryContext.length)

    return results
}

/**
 * PCR 통합 검색 포털 목록
 */
export const PCR_SEARCH_PORTALS = [
    { name: 'ACLCA PCR Repository', nameKo: 'ACLCA 통합 검색 (1차 관문)', url: 'https://pcrrepository.org/pcr-repository/', description: '글로벌 통합 검색 — 모든 프로그램 포괄' },
    { name: 'International EPD System', nameKo: 'EPD International PCR Library', url: 'https://www.environdec.com/pcr-library', description: '255+개 PCR 보유, 글로벌 최대' },
    { name: 'KEITI 법령정보', nameKo: '국가법령정보센터 — 작성지침', url: 'https://law.go.kr/admRulLsInfoP.do?admRulId=26196&efYd=0', description: '환경성적표지 작성지침(개별지침) 직접 다운로드' },
    { name: 'Smart EPD', nameKo: 'Smart EPD PCR Library', url: 'https://smartepd.com/pcr-library/', description: 'ISO 14025/21930 호환 디지털 PCR' },
    { name: 'SuMPO EPD Japan', nameKo: 'EcoLeaf PCR 목록', url: 'https://www.ecoleaf-jemai.jp/eng/pcr.html', description: 'IT·광학·전자기기 정밀 PCR' },
]
