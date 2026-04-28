/**
 * ISO 14067 준수 배출계수 데이터베이스
 * 
 * 이 파일은 PCF 계산에 사용되는 배출계수를 정의합니다.
 * 모든 배출계수는 출처, 연도, 불확실성 정보를 포함합니다.
 * 
 * 전력 배출계수 출처:
 * - 한국: 2025년 승인 국가 온실가스 배출·흡수계수 (환경부)
 * - 해외: IEA Emission Factors 2023, EPA eGRID, EEA 등
 * 
 * @lastUpdated 2026-02-14
 */

import { EmissionSourceType, TransportMode } from './store'

// =============================================================================
// 타입 정의
// =============================================================================

export interface EmissionFactor {
    id: string
    name: string
    nameKo: string
    value: number
    unit: string
    sourceType: EmissionSourceType
    source: string
    year: number
    geographicScope: string
    uncertainty: number // %
    notes?: string
}

export interface ElectricityEmissionFactor extends EmissionFactor {
    gridType: 'national' | 'regional'
    region?: string
    includesUpstream: boolean // 발전소 건설, 연료 채굴 등 포함 여부
    /** 발전단(generation) = 발전소 출구 기준 / 소비단(consumption) = 송배전 손실 포함 */
    tier: 'generation' | 'consumption'
    /** 다년 평균 기간 (예: '2021-2023') */
    averagePeriod?: string
    /** ISO 3166-1 alpha-2 국가 코드 */
    countryCode?: string

    // ── P2-6: ISO 14067 7.3 l 메타데이터 ──
    /** 산정 방법론 (소비 기반 / 생산 기반) */
    method?: 'consumption-based' | 'generation-based' | 'market-based' | 'location-based'
    /** 포함된 온실가스 목록 */
    ghgIncluded?: string[]
    /** 재생 에너지 비율 (%) */
    renewableShare?: number
    /** 적용 제약사항/주의사항 */
    constraints?: string
    /** 규제/승인 기관 */
    regulatoryBody?: string
}

export interface TransportEmissionFactor extends EmissionFactor {
    mode: TransportMode
    vehicleType?: string
    loadFactor?: number // %
}

export interface MaterialEmissionFactor extends EmissionFactor {
    category: string
    subcategory?: string
    recycledContentFactor?: number // 재활용 시 적용되는 계수
}

// =============================================================================
// 전력 배출계수 (ISO 14067 6.4.9.4)
// =============================================================================

export const ELECTRICITY_EMISSION_FACTORS: ElectricityEmissionFactor[] = [
    // =========================================================================
    // 한국 전력 그리드 (2025년 승인 국가 온실가스 배출·흡수계수)
    // =========================================================================

    // --- 2023년 단년도 ---
    {
        id: 'electricity_korea_2023_consumption',
        name: 'Korea National Grid 2023 (Consumption)',
        nameKo: '한국 전력 그리드 2023 (소비단)',
        value: 0.4173,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: '2025년 승인 국가 온실가스 배출·흡수계수',
        year: 2023,
        geographicScope: 'Korea',
        uncertainty: 5,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'KR',
        notes: '소비단: 송배전 손실 포함. CFP 산정 시 권장.',
        method: 'consumption-based',
        ghgIncluded: ['CO2', 'CH4', 'N2O'],
        renewableShare: 9.2,
        constraints: '공급자 특정 정보 부재 시 국가 평균 적용. 자가 발전·PPA 사용 시 별도 계수 필요.',
        regulatoryBody: '환경부',
    },
    {
        id: 'electricity_korea_2023_generation',
        name: 'Korea National Grid 2023 (Generation)',
        nameKo: '한국 전력 그리드 2023 (발전단)',
        value: 0.3844,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: '2025년 승인 국가 온실가스 배출·흡수계수',
        year: 2023,
        geographicScope: 'Korea',
        uncertainty: 5,
        gridType: 'national',
        includesUpstream: false,
        tier: 'generation',
        countryCode: 'KR',
        notes: '발전단: 발전소 출구 기준. 송배전 손실 미포함.'
    },

    // --- 2021-2023 3년 평균 ---
    {
        id: 'electricity_korea_2021_2023_avg_consumption',
        name: 'Korea National Grid 2021-2023 Avg (Consumption)',
        nameKo: '한국 전력 그리드 21-23 평균 (소비단)',
        value: 0.4330,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: '2025년 승인 국가 온실가스 배출·흡수계수',
        year: 2023,
        geographicScope: 'Korea',
        uncertainty: 5,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        averagePeriod: '2021-2023',
        countryCode: 'KR',
        notes: '3년 평균 소비단. 연간 변동을 완화한 안정적 값.'
    },
    {
        id: 'electricity_korea_2021_2023_avg_generation',
        name: 'Korea National Grid 2021-2023 Avg (Generation)',
        nameKo: '한국 전력 그리드 21-23 평균 (발전단)',
        value: 0.3986,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: '2025년 승인 국가 온실가스 배출·흡수계수',
        year: 2023,
        geographicScope: 'Korea',
        uncertainty: 5,
        gridType: 'national',
        includesUpstream: false,
        tier: 'generation',
        averagePeriod: '2021-2023',
        countryCode: 'KR',
        notes: '3년 평균 발전단.'
    },

    // --- 2023년 (페이지 2 추가 데이터: T&D 손실률 다른 계수) ---
    {
        id: 'electricity_korea_2023_consumption_v2',
        name: 'Korea National Grid 2023 (Consumption, v2)',
        nameKo: '한국 전력 그리드 2023 (소비단, 별도 계수)',
        value: 0.3996,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: '2025년 승인 국가 온실가스 배출·흡수계수 (p.2)',
        year: 2023,
        geographicScope: 'Korea',
        uncertainty: 5,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'KR',
        notes: 'PDF 2페이지 별도 표기 소비단 계수'
    },
    {
        id: 'electricity_korea_2021_2023_avg_consumption_v2',
        name: 'Korea National Grid 21-23 Avg (Consumption, v2)',
        nameKo: '한국 전력 그리드 21-23 평균 (소비단, 별도 계수)',
        value: 0.4164,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: '2025년 승인 국가 온실가스 배출·흡수계수 (p.2)',
        year: 2023,
        geographicScope: 'Korea',
        uncertainty: 5,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        averagePeriod: '2021-2023',
        countryCode: 'KR',
        notes: 'PDF 2페이지 별도 표기 3년 평균 소비단 계수'
    },

    // =========================================================================
    // 글로벌 평균
    // =========================================================================
    {
        id: 'electricity_world_avg',
        name: 'World Average Grid',
        nameKo: '세계 평균 전력 그리드',
        value: 0.475,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'IEA Emission Factors 2023',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 15,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'GLOBAL'
    },

    // =========================================================================
    // 주요 교역국 전력 그리드
    // =========================================================================

    // --- 동아시아 ---
    {
        id: 'electricity_china_grid',
        name: 'China National Grid',
        nameKo: '중국 전력 그리드',
        value: 0.5810,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'IEA Emission Factors 2023',
        year: 2022,
        geographicScope: 'China',
        uncertainty: 10,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'CN'
    },
    {
        id: 'electricity_japan_grid',
        name: 'Japan National Grid',
        nameKo: '일본 전력 그리드',
        value: 0.457,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'IEA Emission Factors 2023',
        year: 2022,
        geographicScope: 'Japan',
        uncertainty: 8,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'JP'
    },
    {
        id: 'electricity_taiwan_grid',
        name: 'Taiwan National Grid',
        nameKo: '대만 전력 그리드',
        value: 0.502,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'IEA Emission Factors 2023',
        year: 2022,
        geographicScope: 'Taiwan',
        uncertainty: 10,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'TW'
    },

    // --- 동남아시아 ---
    {
        id: 'electricity_vietnam_grid',
        name: 'Vietnam National Grid',
        nameKo: '베트남 전력 그리드',
        value: 0.560,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'IEA Emission Factors 2023',
        year: 2022,
        geographicScope: 'Vietnam',
        uncertainty: 15,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'VN'
    },
    {
        id: 'electricity_indonesia_grid',
        name: 'Indonesia National Grid',
        nameKo: '인도네시아 전력 그리드',
        value: 0.701,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'IEA Emission Factors 2023',
        year: 2022,
        geographicScope: 'Indonesia',
        uncertainty: 15,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'ID'
    },
    {
        id: 'electricity_thailand_grid',
        name: 'Thailand National Grid',
        nameKo: '태국 전력 그리드',
        value: 0.431,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'IEA Emission Factors 2023',
        year: 2022,
        geographicScope: 'Thailand',
        uncertainty: 12,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'TH'
    },

    // --- 남아시아 ---
    {
        id: 'electricity_india_grid',
        name: 'India National Grid',
        nameKo: '인도 전력 그리드',
        value: 0.708,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'IEA Emission Factors 2023',
        year: 2022,
        geographicScope: 'India',
        uncertainty: 12,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'IN'
    },

    // --- 유럽 ---
    {
        id: 'electricity_eu_avg',
        name: 'EU Average Grid',
        nameKo: 'EU 평균 전력 그리드',
        value: 0.276,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'EEA 2023',
        year: 2022,
        geographicScope: 'EU27',
        uncertainty: 10,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'EU'
    },
    {
        id: 'electricity_germany_grid',
        name: 'Germany National Grid',
        nameKo: '독일 전력 그리드',
        value: 0.380,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'UBA (Umweltbundesamt) 2023',
        year: 2022,
        geographicScope: 'Germany',
        uncertainty: 8,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'DE'
    },
    {
        id: 'electricity_uk_grid',
        name: 'UK National Grid',
        nameKo: '영국 전력 그리드',
        value: 0.207,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'DEFRA 2023',
        year: 2022,
        geographicScope: 'UK',
        uncertainty: 8,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'GB'
    },

    // --- 북미 ---
    {
        id: 'electricity_usa_grid',
        name: 'USA National Grid',
        nameKo: '미국 전력 그리드',
        value: 0.388,
        unit: 'kgCO2e/kWh',
        sourceType: 'fossil',
        source: 'EPA eGRID 2023',
        year: 2022,
        geographicScope: 'USA',
        uncertainty: 8,
        gridType: 'national',
        includesUpstream: true,
        tier: 'consumption',
        countryCode: 'US'
    }
]

// =============================================================================
// 연료 배출계수
// =============================================================================

export const FUEL_EMISSION_FACTORS: EmissionFactor[] = [
    // 천연가스
    {
        id: 'fuel_natural_gas',
        name: 'Natural Gas (Combustion)',
        nameKo: '천연가스 (연소)',
        value: 0.0561,
        unit: 'kgCO2e/MJ',
        sourceType: 'fossil',
        source: 'IPCC 2006',
        year: 2006,
        geographicScope: 'Global',
        uncertainty: 5
    },
    {
        id: 'fuel_natural_gas_m3',
        name: 'Natural Gas (per m³)',
        nameKo: '천연가스 (m³당)',
        value: 2.23,
        unit: 'kgCO2e/m³',
        sourceType: 'fossil',
        source: 'IPCC 2006',
        year: 2006,
        geographicScope: 'Global',
        uncertainty: 5
    },
    // LPG
    {
        id: 'fuel_lpg',
        name: 'LPG (Combustion)',
        nameKo: 'LPG (연소)',
        value: 0.0631,
        unit: 'kgCO2e/MJ',
        sourceType: 'fossil',
        source: 'IPCC 2006',
        year: 2006,
        geographicScope: 'Global',
        uncertainty: 5
    },
    // 경유
    {
        id: 'fuel_diesel',
        name: 'Diesel (Combustion)',
        nameKo: '경유 (연소)',
        value: 2.68,
        unit: 'kgCO2e/L',
        sourceType: 'fossil',
        source: 'IPCC 2006',
        year: 2006,
        geographicScope: 'Global',
        uncertainty: 5
    },
    // 휘발유
    {
        id: 'fuel_gasoline',
        name: 'Gasoline (Combustion)',
        nameKo: '휘발유 (연소)',
        value: 2.31,
        unit: 'kgCO2e/L',
        sourceType: 'fossil',
        source: 'IPCC 2006',
        year: 2006,
        geographicScope: 'Global',
        uncertainty: 5
    },
    // 중유
    {
        id: 'fuel_heavy_oil',
        name: 'Heavy Fuel Oil',
        nameKo: '중유',
        value: 3.17,
        unit: 'kgCO2e/L',
        sourceType: 'fossil',
        source: 'IPCC 2006',
        year: 2006,
        geographicScope: 'Global',
        uncertainty: 5
    },
    // 석탄
    {
        id: 'fuel_coal',
        name: 'Coal (Combustion)',
        nameKo: '석탄 (연소)',
        value: 2.42,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'IPCC 2006',
        year: 2006,
        geographicScope: 'Global',
        uncertainty: 5
    }
]

// =============================================================================
// 운송 배출계수 (GLEC Framework 기반)
// =============================================================================

export const TRANSPORT_EMISSION_FACTORS: TransportEmissionFactor[] = [
    // 도로 운송
    {
        id: 'transport_truck_large',
        name: 'Road Freight - Large Truck (>32t)',
        nameKo: '도로 화물 - 대형 트럭 (32톤 초과)',
        value: 0.0621,
        unit: 'kgCO2e/tkm',
        sourceType: 'fossil',
        source: 'GLEC Framework 2.0',
        year: 2019,
        geographicScope: 'Global',
        uncertainty: 20,
        mode: 'truck',
        vehicleType: 'Large (>32t)',
        loadFactor: 50
    },
    {
        id: 'transport_truck_medium',
        name: 'Road Freight - Medium Truck (7.5-16t)',
        nameKo: '도로 화물 - 중형 트럭 (7.5-16톤)',
        value: 0.0896,
        unit: 'kgCO2e/tkm',
        sourceType: 'fossil',
        source: 'GLEC Framework 2.0',
        year: 2019,
        geographicScope: 'Global',
        uncertainty: 20,
        mode: 'truck',
        vehicleType: 'Medium (7.5-16t)',
        loadFactor: 50
    },
    {
        id: 'transport_truck_medium_large',
        name: 'Road Freight - Medium-Large Truck (16-32t)',
        nameKo: '도로 화물 - 중대형 트럭 (16-32톤)',
        value: 0.10,
        unit: 'kgCO2e/tkm',
        sourceType: 'fossil',
        source: 'GLEC Framework 2.0 (interpolated)',
        year: 2019,
        geographicScope: 'Global',
        uncertainty: 20,
        mode: 'truck',
        vehicleType: 'Medium-Large (16-32t)',
        loadFactor: 50
    },
    {
        id: 'transport_truck_small',
        name: 'Road Freight - Small Truck (<7.5t)',
        nameKo: '도로 화물 - 소형 트럭 (7.5톤 미만)',
        value: 0.193,
        unit: 'kgCO2e/tkm',
        sourceType: 'fossil',
        source: 'GLEC Framework 2.0',
        year: 2019,
        geographicScope: 'Global',
        uncertainty: 25,
        mode: 'truck',
        vehicleType: 'Small (<7.5t)',
        loadFactor: 50
    },
    // 철도 운송
    {
        id: 'transport_rail_freight',
        name: 'Rail Freight',
        nameKo: '철도 화물',
        value: 0.0225,
        unit: 'kgCO2e/tkm',
        sourceType: 'fossil',
        source: 'GLEC Framework 2.0',
        year: 2019,
        geographicScope: 'Global',
        uncertainty: 15,
        mode: 'rail'
    },
    {
        id: 'transport_rail_electric',
        name: 'Rail Freight - Electric',
        nameKo: '철도 화물 - 전기',
        value: 0.0156,
        unit: 'kgCO2e/tkm',
        sourceType: 'fossil',
        source: 'GLEC Framework 2.0',
        year: 2019,
        geographicScope: 'EU',
        uncertainty: 15,
        mode: 'rail',
        vehicleType: 'Electric'
    },
    // 해상 운송
    {
        id: 'transport_ship_container',
        name: 'Sea Freight - Container Ship',
        nameKo: '해상 화물 - 컨테이너선',
        value: 0.0082,
        unit: 'kgCO2e/tkm',
        sourceType: 'fossil',
        source: 'GLEC Framework 2.0',
        year: 2019,
        geographicScope: 'Global',
        uncertainty: 20,
        mode: 'ship',
        vehicleType: 'Container'
    },
    {
        id: 'transport_ship_bulk',
        name: 'Sea Freight - Bulk Carrier',
        nameKo: '해상 화물 - 벌크선',
        value: 0.0048,
        unit: 'kgCO2e/tkm',
        sourceType: 'fossil',
        source: 'GLEC Framework 2.0',
        year: 2019,
        geographicScope: 'Global',
        uncertainty: 20,
        mode: 'ship',
        vehicleType: 'Bulk'
    },
    // 항공 운송 (ISO 14067 7.2 e - 필수 분리 보고)
    {
        id: 'transport_aircraft_cargo',
        name: 'Air Freight - Cargo',
        nameKo: '항공 화물 - 전용기',
        value: 0.602,
        unit: 'kgCO2e/tkm',
        sourceType: 'fossil',
        source: 'GLEC Framework 2.0',
        year: 2019,
        geographicScope: 'Global',
        uncertainty: 25,
        mode: 'aircraft',
        vehicleType: 'Cargo',
        notes: 'ISO 14067 7.2(e) - 항공 운송은 별도 보고 필수'
    },
    {
        id: 'transport_aircraft_belly',
        name: 'Air Freight - Belly Cargo',
        nameKo: '항공 화물 - 벨리 카고 (여객기)',
        value: 0.430,
        unit: 'kgCO2e/tkm',
        sourceType: 'fossil',
        source: 'GLEC Framework 2.0',
        year: 2019,
        geographicScope: 'Global',
        uncertainty: 25,
        mode: 'aircraft',
        vehicleType: 'Belly',
        notes: 'ISO 14067 7.2(e) - 항공 운송은 별도 보고 필수'
    }
]

// =============================================================================
// 원자재 배출계수
// =============================================================================

export const MATERIAL_EMISSION_FACTORS: MaterialEmissionFactor[] = [
    // 금속
    {
        id: 'material_steel_primary',
        name: 'Steel (Primary/Virgin)',
        nameKo: '강철 (1차/신규)',
        value: 1.85,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'ecoinvent Version 3.12',
        year: 2024,
        geographicScope: 'Global',
        uncertainty: 15,
        category: 'Metals',
        subcategory: 'Steel',
        recycledContentFactor: 0.45
    },
    {
        id: 'material_steel_recycled',
        name: 'Steel (Recycled/EAF)',
        nameKo: '강철 (재활용/전기로)',
        value: 0.45,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 20,
        category: 'Metals',
        subcategory: 'Steel'
    },
    {
        id: 'material_aluminum_primary',
        name: 'Aluminum (Primary)',
        nameKo: '알루미늄 (1차)',
        value: 8.24,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 15,
        category: 'Metals',
        subcategory: 'Aluminum',
        recycledContentFactor: 0.52
    },
    {
        id: 'material_aluminum_recycled',
        name: 'Aluminum (Recycled)',
        nameKo: '알루미늄 (재활용)',
        value: 0.52,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 20,
        category: 'Metals',
        subcategory: 'Aluminum'
    },
    {
        id: 'material_copper',
        name: 'Copper (Primary)',
        nameKo: '구리 (1차)',
        value: 3.81,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 20,
        category: 'Metals',
        subcategory: 'Copper'
    },

    // 플라스틱
    {
        id: 'material_plastic_pe',
        name: 'Polyethylene (PE)',
        nameKo: '폴리에틸렌 (PE)',
        value: 1.89,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 15,
        category: 'Plastics',
        subcategory: 'PE'
    },
    {
        id: 'material_plastic_pp',
        name: 'Polypropylene (PP)',
        nameKo: '폴리프로필렌 (PP)',
        value: 1.86,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 15,
        category: 'Plastics',
        subcategory: 'PP'
    },
    {
        id: 'material_plastic_pet',
        name: 'PET (Polyethylene Terephthalate)',
        nameKo: 'PET',
        value: 2.73,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 15,
        category: 'Plastics',
        subcategory: 'PET'
    },
    {
        id: 'material_plastic_pvc',
        name: 'PVC (Polyvinyl Chloride)',
        nameKo: 'PVC',
        value: 2.41,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 15,
        category: 'Plastics',
        subcategory: 'PVC'
    },
    {
        id: 'material_plastic_abs',
        name: 'ABS (Acrylonitrile Butadiene Styrene)',
        nameKo: 'ABS',
        value: 3.27,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 15,
        category: 'Plastics',
        subcategory: 'ABS'
    },

    // 목재/종이 (생물기원)
    {
        id: 'material_wood_softwood',
        name: 'Softwood (Timber)',
        nameKo: '침엽수 목재',
        value: 0.31,
        unit: 'kgCO2e/kg',
        sourceType: 'biogenic',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 25,
        category: 'Wood',
        subcategory: 'Softwood',
        notes: '가공 에너지만 포함, 탄소 저장 별도 계산'
    },
    {
        id: 'material_wood_hardwood',
        name: 'Hardwood (Timber)',
        nameKo: '활엽수 목재',
        value: 0.42,
        unit: 'kgCO2e/kg',
        sourceType: 'biogenic',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 25,
        category: 'Wood',
        subcategory: 'Hardwood'
    },
    {
        id: 'material_paper_cardboard',
        name: 'Cardboard (Corrugated)',
        nameKo: '골판지',
        value: 0.89,
        unit: 'kgCO2e/kg',
        sourceType: 'mixed',
        source: '국가 LCI DB',
        year: 2023,
        geographicScope: 'Korea',
        uncertainty: 20,
        category: 'Paper',
        subcategory: 'Cardboard'
    },
    {
        id: 'material_paper_kraft',
        name: 'Kraft Paper',
        nameKo: '크라프트지',
        value: 0.78,
        unit: 'kgCO2e/kg',
        sourceType: 'mixed',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 20,
        category: 'Paper',
        subcategory: 'Kraft'
    },

    // 유리/세라믹
    {
        id: 'material_glass',
        name: 'Glass (Container)',
        nameKo: '유리 (용기)',
        value: 0.86,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 15,
        category: 'Glass'
    },
    {
        id: 'material_ceramic',
        name: 'Ceramic (General)',
        nameKo: '세라믹 (일반)',
        value: 1.21,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 25,
        category: 'Ceramics'
    },

    // 콘크리트/시멘트
    {
        id: 'material_cement',
        name: 'Cement (Portland)',
        nameKo: '시멘트 (포틀랜드)',
        value: 0.93,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: '국가 LCI DB',
        year: 2023,
        geographicScope: 'Korea',
        uncertainty: 10,
        category: 'Construction',
        subcategory: 'Cement'
    },
    {
        id: 'material_concrete',
        name: 'Concrete (Ready-mix)',
        nameKo: '레미콘',
        value: 0.13,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: '국가 LCI DB',
        year: 2023,
        geographicScope: 'Korea',
        uncertainty: 15,
        category: 'Construction',
        subcategory: 'Concrete'
    }
]

// =============================================================================
// 폐기 처리 배출계수
// =============================================================================

export const EOL_EMISSION_FACTORS: EmissionFactor[] = [
    {
        id: 'eol_landfill_mixed',
        name: 'Landfill (Mixed Waste)',
        nameKo: '매립 (혼합 폐기물)',
        value: 0.58,
        unit: 'kgCO2e/kg',
        sourceType: 'mixed',
        source: 'IPCC 2006',
        year: 2006,
        geographicScope: 'Global',
        uncertainty: 50,
        notes: '메탄 발생 포함'
    },
    {
        id: 'eol_incineration',
        name: 'Incineration (with energy recovery)',
        nameKo: '소각 (에너지 회수)',
        value: 0.42,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'IPCC 2006',
        year: 2006,
        geographicScope: 'Global',
        uncertainty: 30,
        notes: '에너지 회수 크레딧 적용'
    },
    {
        id: 'eol_recycling_metal',
        name: 'Recycling (Metal)',
        nameKo: '재활용 (금속)',
        value: -1.2,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 40,
        notes: '1차 생산 대체 크레딧'
    },
    {
        id: 'eol_recycling_plastic',
        name: 'Recycling (Plastic)',
        nameKo: '재활용 (플라스틱)',
        value: -0.8,
        unit: 'kgCO2e/kg',
        sourceType: 'fossil',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 40,
        notes: '1차 생산 대체 크레딧'
    },
    {
        id: 'eol_recycling_paper',
        name: 'Recycling (Paper)',
        nameKo: '재활용 (종이)',
        value: -0.5,
        unit: 'kgCO2e/kg',
        sourceType: 'mixed',
        source: 'Ecoinvent 3.9',
        year: 2022,
        geographicScope: 'Global',
        uncertainty: 40
    },
    {
        id: 'eol_composting',
        name: 'Composting (Organic)',
        nameKo: '퇴비화 (유기물)',
        value: 0.08,
        unit: 'kgCO2e/kg',
        sourceType: 'biogenic',
        source: 'IPCC 2006',
        year: 2006,
        geographicScope: 'Global',
        uncertainty: 50
    }
]

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * ID로 배출계수 찾기
 */
export const getEmissionFactorById = (id: string): EmissionFactor | undefined => {
    const allFactors = [
        ...ELECTRICITY_EMISSION_FACTORS,
        ...FUEL_EMISSION_FACTORS,
        ...TRANSPORT_EMISSION_FACTORS,
        ...MATERIAL_EMISSION_FACTORS,
        ...EOL_EMISSION_FACTORS
    ]
    return allFactors.find(f => f.id === id)
}

/**
 * 카테고리별 원자재 배출계수 그룹화
 */
export const getMaterialFactorsByCategory = (): Record<string, MaterialEmissionFactor[]> => {
    return MATERIAL_EMISSION_FACTORS.reduce((acc, factor) => {
        if (!acc[factor.category]) {
            acc[factor.category] = []
        }
        acc[factor.category].push(factor)
        return acc
    }, {} as Record<string, MaterialEmissionFactor[]>)
}

/**
 * 운송 모드별 배출계수
 */
export const getTransportFactorsByMode = (mode: TransportMode): TransportEmissionFactor[] => {
    return TRANSPORT_EMISSION_FACTORS.filter(f => f.mode === mode)
}

/**
 * 지역별 전력 배출계수
 */
export const getElectricityFactorByRegion = (region: string): ElectricityEmissionFactor | undefined => {
    const regionLower = region.toLowerCase()
    return ELECTRICITY_EMISSION_FACTORS.find(f =>
        f.geographicScope.toLowerCase().includes(regionLower) ||
        f.id.toLowerCase().includes(regionLower)
    )
}

/**
 * 기본 전력 배출계수 (한국)
 */
export const getDefaultElectricityFactor = (): ElectricityEmissionFactor => {
    return ELECTRICITY_EMISSION_FACTORS.find(f => f.id === 'electricity_korea_2023_consumption')
        || ELECTRICITY_EMISSION_FACTORS[0]
}

/**
 * 기본 운송 배출계수 (트럭)
 */
export const getDefaultTransportFactor = (): TransportEmissionFactor => {
    return TRANSPORT_EMISSION_FACTORS.find(f => f.id === 'transport_truck_large')
        || TRANSPORT_EMISSION_FACTORS[0]
}

