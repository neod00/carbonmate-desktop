/**
 * 국제 운송 배출 모델링 (Transport Emission Modeling)
 * 
 * 목적: 다구간(Multi-leg) 국제 물류 경로의 GHG 배출량 산정
 * 
 * GLEC Framework 2.0 기반:
 * - 배출량 = Σ(거리 × 중량 × 배출계수) for each leg
 * - 단위: kgCO2e/tkm (톤·킬로미터당)
 * 
 * ISO 14067:2018 관련:
 * - 6.3.4: 운송은 모든 생애주기 단계에서 고려
 * - 7.2(e): 항공 운송 배출은 별도 분리 보고 필수
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-14
 */

import { TRANSPORT_EMISSION_FACTORS, TransportEmissionFactor } from './emission-factors'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 운송 모드 (확장)
 */
export type ExtendedTransportMode =
    | 'truck_large' | 'truck_medium' | 'truck_small'
    | 'rail' | 'rail_electric'
    | 'container_ship' | 'bulk_ship' | 'feeder_ship'
    | 'air_cargo' | 'air_belly'

/**
 * 운송 구간 (Leg)
 */
export interface TransportLeg {
    id: string
    legNumber: number               // 구간 번호 (1, 2, 3...)
    mode: ExtendedTransportMode
    origin: string                  // 출발지 (항만명 또는 도시명)
    destination: string             // 도착지
    distanceKm: number              // 거리 (km)
    weightTon: number               // 화물 중량 (ton)
    // 선택 입력
    vehicleType?: string
    loadFactor?: number             // 적재율 (%, 기본 50)
    retrunEmpty?: boolean           // 공차 회송 포함 여부
    notes?: string
}

/**
 * 운송 경로 (Route)
 */
export interface TransportRoute {
    id: string
    name: string                    // 경로명 (예: "원자재 수입 - 중국 상하이 → 한국 부산")
    legs: TransportLeg[]
    productName?: string            // 관련 제품/원자재명
    stage?: string                  // 관련 생애주기 단계
}

/**
 * 구간별 계산 결과
 */
export interface LegEmissionResult {
    legId: string
    legNumber: number
    mode: ExtendedTransportMode
    modeLabel: string
    origin: string
    destination: string
    distanceKm: number
    weightTon: number
    emissionFactor: number          // kgCO2e/tkm
    emission: number                // kgCO2e
    tkmValue: number                // ton-km
    share: number                   // 전체 대비 비중 (%)
}

/**
 * 경로 전체 결과
 */
export interface RouteEmissionResult {
    routeId: string
    routeName: string
    legs: LegEmissionResult[]
    totalEmission: number           // kgCO2e
    totalDistanceKm: number
    totalTkm: number                // ton-km
    isAirIncluded: boolean          // 항공 포함 여부 (ISO 14067 분리 보고)
    airEmission: number             // 항공 배출량 (분리)
    nonAirEmission: number          // 비항공 배출량
    // 원단위
    emissionPerTon: number          // kgCO2e/ton
    emissionPerKm: number           // kgCO2e/km
    // 보고서
    summaryKo: string
    summaryEn: string
}

// =============================================================================
// 운송 모드 매핑
// =============================================================================

const MODE_TO_FACTOR_ID: Record<ExtendedTransportMode, string> = {
    'truck_large': 'transport_truck_large',
    'truck_medium': 'transport_truck_medium',
    'truck_small': 'transport_truck_small',
    'rail': 'transport_rail_freight',
    'rail_electric': 'transport_rail_electric',
    'container_ship': 'transport_ship_container',
    'bulk_ship': 'transport_ship_bulk',
    'feeder_ship': 'transport_ship_container',
    'air_cargo': 'transport_aircraft_cargo',
    'air_belly': 'transport_aircraft_belly'
}

export const MODE_LABELS: Record<ExtendedTransportMode, { ko: string; en: string; icon: string }> = {
    'truck_large': { ko: '대형 트럭 (32t+)', en: 'Large Truck (>32t)', icon: '🚛' },
    'truck_medium': { ko: '중형 트럭 (7.5-16t)', en: 'Medium Truck', icon: '🚚' },
    'truck_small': { ko: '소형 트럭 (<7.5t)', en: 'Small Truck', icon: '🚐' },
    'rail': { ko: '철도 (디젤)', en: 'Rail (Diesel)', icon: '🚂' },
    'rail_electric': { ko: '철도 (전기)', en: 'Rail (Electric)', icon: '🚆' },
    'container_ship': { ko: '컨테이너선', en: 'Container Ship', icon: '🚢' },
    'bulk_ship': { ko: '벌크선', en: 'Bulk Carrier', icon: '🛳️' },
    'feeder_ship': { ko: '피더선 (근해)', en: 'Feeder Ship', icon: '⛴️' },
    'air_cargo': { ko: '항공 (전용기)', en: 'Air Cargo', icon: '✈️' },
    'air_belly': { ko: '항공 (벨리 카고)', en: 'Air Belly Cargo', icon: '🛩️' }
}

// =============================================================================
// 주요 국제 해운 거리 DB (km)
// 항만 코드 기반, 주요 한국 교역 항로
// =============================================================================

const PORT_DISTANCES: { from: string; to: string; distanceKm: number; route?: string }[] = [
    // --- 동아시아 ---
    { from: 'KRPUS', to: 'CNSHA', distanceKm: 870, route: '부산-상하이' },
    { from: 'KRPUS', to: 'CNSZX', distanceKm: 1980, route: '부산-선전' },
    { from: 'KRPUS', to: 'CNNGB', distanceKm: 950, route: '부산-닝보' },
    { from: 'KRPUS', to: 'CNTAO', distanceKm: 550, route: '부산-칭다오' },
    { from: 'KRPUS', to: 'CNDLC', distanceKm: 650, route: '부산-다롄' },
    { from: 'KRPUS', to: 'JPTYO', distanceKm: 1160, route: '부산-도쿄' },
    { from: 'KRPUS', to: 'JPOSA', distanceKm: 660, route: '부산-오사카' },
    { from: 'KRPUS', to: 'JPNGO', distanceKm: 830, route: '부산-나고야' },
    { from: 'KRPUS', to: 'TWKHH', distanceKm: 1600, route: '부산-가오슝' },

    // --- 동남아 ---
    { from: 'KRPUS', to: 'VNHPH', distanceKm: 3150, route: '부산-하이퐁' },
    { from: 'KRPUS', to: 'VNSGN', distanceKm: 3800, route: '부산-호치민' },
    { from: 'KRPUS', to: 'THBKK', distanceKm: 4400, route: '부산-방콕' },
    { from: 'KRPUS', to: 'SGSIN', distanceKm: 4600, route: '부산-싱가포르' },
    { from: 'KRPUS', to: 'IDJKT', distanceKm: 5500, route: '부산-자카르타' },
    { from: 'KRPUS', to: 'INMAA', distanceKm: 6100, route: '부산-첸나이' },

    // --- 유럽 ---
    { from: 'KRPUS', to: 'NLRTM', distanceKm: 20000, route: '부산-로테르담 (수에즈)' },
    { from: 'KRPUS', to: 'DEHAM', distanceKm: 20200, route: '부산-함부르크' },
    { from: 'KRPUS', to: 'GBFXT', distanceKm: 20500, route: '부산-펠릭스토우' },
    { from: 'KRPUS', to: 'ITGOA', distanceKm: 16800, route: '부산-제노아' },

    // --- 북미 ---
    { from: 'KRPUS', to: 'USLGB', distanceKm: 9650, route: '부산-롱비치 (태평양)' },
    { from: 'KRPUS', to: 'USNYC', distanceKm: 18900, route: '부산-뉴욕 (수에즈)' },
    { from: 'KRPUS', to: 'USSEA', distanceKm: 8400, route: '부산-시애틀' },
    { from: 'KRPUS', to: 'CAVNC', distanceKm: 8100, route: '부산-밴쿠버' },

    // --- 중국 주요 항만 간 ---
    { from: 'CNSHA', to: 'CNSZX', distanceKm: 1200, route: '상하이-선전' },
    { from: 'CNSHA', to: 'CNTAO', distanceKm: 710, route: '상하이-칭다오' },
]

// =============================================================================
// 핵심 함수
// =============================================================================

/**
 * 단일 구간 배출량 계산
 */
export const calculateLegEmission = (leg: TransportLeg): LegEmissionResult => {
    const factorId = MODE_TO_FACTOR_ID[leg.mode]
    const factor = TRANSPORT_EMISSION_FACTORS.find(f => f.id === factorId)
    const ef = factor?.value || 0.05 // fallback

    const tkmValue = leg.distanceKm * leg.weightTon
    let emission = tkmValue * ef

    // 공차 회송 보정 (편도 운송 후 빈 차 복귀)
    if (leg.retrunEmpty) {
        emission *= 1.3 // 공차 30% 추가 (GLEC 가이드라인)
    }

    return {
        legId: leg.id,
        legNumber: leg.legNumber,
        mode: leg.mode,
        modeLabel: MODE_LABELS[leg.mode]?.ko || leg.mode,
        origin: leg.origin,
        destination: leg.destination,
        distanceKm: leg.distanceKm,
        weightTon: leg.weightTon,
        emissionFactor: ef,
        emission: Math.round(emission * 1000) / 1000,
        tkmValue,
        share: 0 // 나중에 계산
    }
}

/**
 * 전체 경로 배출량 계산
 */
export const calculateRouteEmission = (route: TransportRoute): RouteEmissionResult => {
    if (!route.legs || route.legs.length === 0) {
        return createEmptyRouteResult(route.id, route.name)
    }

    const legResults = route.legs.map(leg => calculateLegEmission(leg))
    const totalEmission = legResults.reduce((sum, l) => sum + l.emission, 0)

    // 비중 계산
    legResults.forEach(l => {
        l.share = totalEmission > 0 ? (l.emission / totalEmission) * 100 : 0
    })

    const totalDistanceKm = legResults.reduce((sum, l) => sum + l.distanceKm, 0)
    const totalTkm = legResults.reduce((sum, l) => sum + l.tkmValue, 0)

    // 항공 분리 (ISO 14067 7.2(e))
    const airLegs = legResults.filter(l => l.mode === 'air_cargo' || l.mode === 'air_belly')
    const airEmission = airLegs.reduce((sum, l) => sum + l.emission, 0)
    const nonAirEmission = totalEmission - airEmission

    const weightTon = route.legs.length > 0 ? route.legs[0].weightTon : 0

    return {
        routeId: route.id,
        routeName: route.name,
        legs: legResults,
        totalEmission: Math.round(totalEmission * 1000) / 1000,
        totalDistanceKm,
        totalTkm,
        isAirIncluded: airLegs.length > 0,
        airEmission: Math.round(airEmission * 1000) / 1000,
        nonAirEmission: Math.round(nonAirEmission * 1000) / 1000,
        emissionPerTon: weightTon > 0 ? Math.round(totalEmission / weightTon * 1000) / 1000 : 0,
        emissionPerKm: totalDistanceKm > 0 ? Math.round(totalEmission / totalDistanceKm * 10000) / 10000 : 0,
        summaryKo: generateSummaryKo(route, legResults, totalEmission, airEmission),
        summaryEn: generateSummaryEn(route, legResults, totalEmission, airEmission)
    }
}

/**
 * 주요 항만 간 거리 조회
 */
export const getPortDistance = (fromPort: string, toPort: string): number | undefined => {
    const direct = PORT_DISTANCES.find(d =>
        (d.from === fromPort && d.to === toPort) ||
        (d.from === toPort && d.to === fromPort)
    )
    return direct?.distanceKm
}

/**
 * 국가 코드로 주요 항만 코드 조회
 */
export const getMainPort = (countryCode: string): { code: string; name: string } | undefined => {
    const MAIN_PORTS: Record<string, { code: string; name: string }> = {
        'KR': { code: 'KRPUS', name: '부산항' },
        'CN': { code: 'CNSHA', name: '상하이항' },
        'JP': { code: 'JPTYO', name: '도쿄항' },
        'TW': { code: 'TWKHH', name: '가오슝항' },
        'VN': { code: 'VNHPH', name: '하이퐁항' },
        'TH': { code: 'THBKK', name: '람차방항' },
        'ID': { code: 'IDJKT', name: '탄중프리옥항' },
        'IN': { code: 'INMAA', name: '첸나이항' },
        'SG': { code: 'SGSIN', name: '싱가포르항' },
        'US': { code: 'USLGB', name: '롱비치항' },
        'DE': { code: 'DEHAM', name: '함부르크항' },
        'NL': { code: 'NLRTM', name: '로테르담항' },
        'GB': { code: 'GBFXT', name: '펠릭스토우항' }
    }
    return MAIN_PORTS[countryCode]
}

/**
 * 국가 간 표준 물류 경로 자동 생성
 * (공장 → 출발 항만 → 해운 → 도착 항만 → 최종 목적지)
 */
export const createStandardRoute = (
    fromCountry: string,
    toCountry: string,
    weightTon: number,
    options?: {
        inlandDistanceOrigin?: number   // 출발지 내륙 거리 (km)
        inlandDistanceDestination?: number // 도착지 내륙 거리 (km)
        productName?: string
    }
): TransportRoute | null => {
    const fromPort = getMainPort(fromCountry)
    const toPort = getMainPort(toCountry)
    if (!fromPort || !toPort) return null

    const seaDistance = getPortDistance(fromPort.code, toPort.code)
    if (!seaDistance) return null

    const inlandOrigin = options?.inlandDistanceOrigin || 100
    const inlandDest = options?.inlandDistanceDestination || 50

    const now = Date.now()
    const legs: TransportLeg[] = [
        {
            id: `leg_${now}_1`,
            legNumber: 1,
            mode: 'truck_large',
            origin: `${fromCountry} 공장`,
            destination: fromPort.name,
            distanceKm: inlandOrigin,
            weightTon,
            notes: '내륙 운송 (공장→항만)'
        },
        {
            id: `leg_${now}_2`,
            legNumber: 2,
            mode: 'container_ship',
            origin: fromPort.name,
            destination: toPort.name,
            distanceKm: seaDistance,
            weightTon,
            notes: '해상 운송'
        },
        {
            id: `leg_${now}_3`,
            legNumber: 3,
            mode: 'truck_large',
            origin: toPort.name,
            destination: `${toCountry} 목적지`,
            distanceKm: inlandDest,
            weightTon,
            notes: '내륙 운송 (항만→목적지)'
        }
    ]

    return {
        id: `route_${now}`,
        name: `${fromCountry} → ${toCountry} 표준 물류 경로`,
        legs,
        productName: options?.productName,
        stage: 'transport'
    }
}

/**
 * 빈 운송 구간 생성
 */
export const createEmptyLeg = (legNumber: number): TransportLeg => ({
    id: `leg_${Date.now()}_${legNumber}`,
    legNumber,
    mode: 'truck_large',
    origin: '',
    destination: '',
    distanceKm: 0,
    weightTon: 0
})

/**
 * 지원 항만 목록 조회
 */
export const getAvailablePorts = (): { code: string; name: string; country: string }[] => {
    const seen = new Set<string>()
    const ports: { code: string; name: string; country: string }[] = []

    for (const d of PORT_DISTANCES) {
        if (!seen.has(d.from)) {
            seen.add(d.from)
            const country = d.from.substring(0, 2)
            ports.push({
                code: d.from,
                name: d.route?.split('-')[0]?.trim() || d.from,
                country
            })
        }
        if (!seen.has(d.to)) {
            seen.add(d.to)
            const country = d.to.substring(0, 2)
            ports.push({
                code: d.to,
                name: d.route?.split('-')[1]?.trim() || d.to,
                country
            })
        }
    }
    return ports
}

// =============================================================================
// 내부 유틸리티
// =============================================================================

function createEmptyRouteResult(routeId: string, routeName: string): RouteEmissionResult {
    return {
        routeId, routeName,
        legs: [],
        totalEmission: 0, totalDistanceKm: 0, totalTkm: 0,
        isAirIncluded: false, airEmission: 0, nonAirEmission: 0,
        emissionPerTon: 0, emissionPerKm: 0,
        summaryKo: '운송 구간이 없습니다.',
        summaryEn: 'No transport legs defined.'
    }
}

function generateSummaryKo(
    route: TransportRoute, legs: LegEmissionResult[],
    total: number, air: number
): string {
    let s = `운송 경로 "${route.name}": 총 ${legs.length}개 구간\n`
    legs.forEach(l => {
        s += `  ${l.legNumber}. ${l.modeLabel}: ${l.origin} → ${l.destination} (${l.distanceKm.toLocaleString()}km) = ${l.emission.toFixed(2)} kgCO₂e (${l.share.toFixed(1)}%)\n`
    })
    s += `총 배출량: ${total.toFixed(2)} kgCO₂e\n`
    if (air > 0) {
        s += `⚠️ 항공 운송 포함: ${air.toFixed(2)} kgCO₂e (ISO 14067 7.2(e) 분리 보고 필수)\n`
    }
    return s
}

function generateSummaryEn(
    route: TransportRoute, legs: LegEmissionResult[],
    total: number, air: number
): string {
    let s = `Transport route "${route.name}": ${legs.length} leg(s)\n`
    legs.forEach(l => {
        s += `  ${l.legNumber}. ${MODE_LABELS[l.mode]?.en || l.mode}: ${l.origin} → ${l.destination} (${l.distanceKm.toLocaleString()} km) = ${l.emission.toFixed(2)} kgCO₂e (${l.share.toFixed(1)}%)\n`
    })
    s += `Total emission: ${total.toFixed(2)} kgCO₂e\n`
    if (air > 0) {
        s += `⚠️ Air transport included: ${air.toFixed(2)} kgCO₂e (ISO 14067 7.2(e) separate reporting required)\n`
    }
    return s
}
