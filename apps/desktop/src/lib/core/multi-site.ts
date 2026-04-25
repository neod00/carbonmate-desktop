/**
 * 다중 사업장 가중 평균 (Multi-Site Weighted Average)
 * 
 * 목적: 여러 공장/사업장의 CFP를 생산량 가중 평균으로 산출
 * 
 * ISO 14067:2018 6.3.6 요구사항:
 * - 여러 사업장에서 동일 제품을 생산하는 경우, 가중 평균 접근 가능
 * - 각 사업장의 데이터 대표성 및 시간 경계를 명시해야 함
 * - 가중 평균 시 사용된 가중 기준(생산량)을 문서화
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-14
 */

import { ELECTRICITY_EMISSION_FACTORS, ElectricityEmissionFactor } from './emission-factors'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 개별 사업장 데이터
 */
export interface SiteData {
    id: string
    name: string                    // 공장/사업장명
    country: string                 // 국가 (표시용)
    countryCode: string             // ISO 3166-1 alpha-2 (KR, CN, VN 등)
    productionVolume: number        // 생산량 (기능단위 기준)
    productionUnit: string          // 생산량 단위 (기본: 개, kg, ton 등)
    cfpPerUnit: number              // 단위당 CFP (kgCO2e/기능단위)
    // 전력 관련
    electricityGridId?: string      // 해당 국가 전력 배출계수 ID
    electricityConsumption?: number // 전력 소비량 (kWh/기능단위)
    // 메타데이터
    dataQuality?: 'primary' | 'secondary' | 'estimated'
    dataPeriod?: string             // 데이터 수집 기간 (예: '2024-01 ~ 2024-12')
    notes?: string
}

/**
 * 다중 사업장 가중 평균 결과
 */
export interface MultiSiteResult {
    weightedCFP: number             // 가중 평균 CFP (kgCO2e/기능단위)
    totalProduction: number         // 총 생산량
    productionUnit: string
    sites: SiteContribution[]       // 사이트별 기여 분석
    sensitivityRange: {
        min: number                 // 최소 CFP 사이트
        max: number                 // 최대 CFP 사이트
        rangePercent: number        // (max-min)/avg × 100
    }
    insights: string[]              // 인사이트 목록
    isoCompliance: {
        clause: string
        satisfied: boolean
        notes: string
    }[]
    reportTextKo: string            // 보고서용 한국어 텍스트
    reportTextEn: string            // 보고서용 영문 텍스트
}

/**
 * 사이트별 기여 분석
 */
export interface SiteContribution {
    siteId: string
    siteName: string
    country: string
    productionVolume: number
    productionShare: number         // 생산 비중 (%)
    cfpPerUnit: number
    totalEmission: number           // 해당 공장 총배출 = CFP × 생산량
    emissionShare: number           // 배출 기여도 (%)
    electricityFactor?: number      // 적용된 전력 배출계수
    deviation: number               // 가중 평균 대비 편차 (%)
}

// =============================================================================
// 국가 코드 → 국가명 매핑
// =============================================================================

const COUNTRY_NAMES: Record<string, { ko: string; en: string }> = {
    'KR': { ko: '한국', en: 'South Korea' },
    'CN': { ko: '중국', en: 'China' },
    'JP': { ko: '일본', en: 'Japan' },
    'TW': { ko: '대만', en: 'Taiwan' },
    'VN': { ko: '베트남', en: 'Vietnam' },
    'ID': { ko: '인도네시아', en: 'Indonesia' },
    'TH': { ko: '태국', en: 'Thailand' },
    'IN': { ko: '인도', en: 'India' },
    'US': { ko: '미국', en: 'United States' },
    'DE': { ko: '독일', en: 'Germany' },
    'GB': { ko: '영국', en: 'United Kingdom' },
    'EU': { ko: 'EU', en: 'EU' }
}

// =============================================================================
// 핵심 함수
// =============================================================================

/**
 * 다중 사업장 가중 평균 CFP 계산
 * 
 * 공식: CFP_weighted = Σ(CFPi × Pi) / ΣPi
 * 
 * @param sites 사업장 데이터 배열
 * @returns 다중 사업장 결과
 */
export const calculateWeightedCFP = (sites: SiteData[]): MultiSiteResult => {
    if (sites.length === 0) {
        return createEmptyMultiSiteResult()
    }

    const totalProduction = sites.reduce((sum, site) => sum + site.productionVolume, 0)
    const productionUnit = sites[0]?.productionUnit || '개'

    if (totalProduction === 0) {
        return createEmptyMultiSiteResult()
    }

    // 가중 평균 계산
    const weightedSum = sites.reduce((sum, site) =>
        sum + (site.cfpPerUnit * site.productionVolume), 0
    )
    const weightedCFP = weightedSum / totalProduction

    // 사이트별 기여 분석
    const siteContributions: SiteContribution[] = sites.map(site => {
        const totalEmission = site.cfpPerUnit * site.productionVolume
        const productionShare = (site.productionVolume / totalProduction) * 100
        const emissionShare = totalProduction > 0 ? (totalEmission / weightedSum) * 100 : 0
        const deviation = weightedCFP > 0 ? ((site.cfpPerUnit - weightedCFP) / weightedCFP) * 100 : 0

        // 해당 국가 전력 배출계수 찾기
        const gridFactor = getGridFactorForCountry(site.countryCode)

        return {
            siteId: site.id,
            siteName: site.name,
            country: COUNTRY_NAMES[site.countryCode]?.ko || site.country,
            productionVolume: site.productionVolume,
            productionShare,
            cfpPerUnit: site.cfpPerUnit,
            totalEmission,
            emissionShare,
            electricityFactor: gridFactor?.value,
            deviation
        }
    })

    // 민감도 범위
    const cfpValues = sites.map(s => s.cfpPerUnit)
    const min = Math.min(...cfpValues)
    const max = Math.max(...cfpValues)
    const rangePercent = weightedCFP > 0 ? ((max - min) / weightedCFP) * 100 : 0

    // 인사이트 생성
    const insights = generateInsights(siteContributions, weightedCFP, rangePercent)

    // ISO 준수
    const isoCompliance = [
        {
            clause: 'ISO 14067:2018 6.3.6',
            satisfied: sites.every(s => s.dataPeriod !== undefined),
            notes: '각 사업장의 데이터 수집 기간이 명시되어야 합니다'
        },
        {
            clause: 'ISO 14067:2018 6.3.5',
            satisfied: sites.every(s => s.dataQuality !== undefined),
            notes: '각 사업장의 데이터 품질(1차/2차/추정)이 명시되어야 합니다'
        },
        {
            clause: 'ISO 14044:2006 4.2.3.6',
            satisfied: true,
            notes: `가중 기준: 생산량(${productionUnit}), 총 ${totalProduction.toLocaleString()}${productionUnit}`
        }
    ]

    // 보고서 텍스트
    const reportTextKo = generateReportKo(sites, siteContributions, weightedCFP, totalProduction, productionUnit)
    const reportTextEn = generateReportEn(sites, siteContributions, weightedCFP, totalProduction, productionUnit)

    return {
        weightedCFP,
        totalProduction,
        productionUnit,
        sites: siteContributions,
        sensitivityRange: { min, max, rangePercent },
        insights,
        isoCompliance,
        reportTextKo,
        reportTextEn
    }
}

/**
 * 국가 코드로 전력 배출계수 조회
 */
export const getGridFactorForCountry = (countryCode: string): ElectricityEmissionFactor | undefined => {
    return ELECTRICITY_EMISSION_FACTORS.find(f =>
        f.countryCode === countryCode && f.tier === 'consumption' && !f.averagePeriod
    )
}

/**
 * 지원하는 국가 목록 조회
 */
export const getSupportedCountries = (): { code: string; nameKo: string; nameEn: string; gridFactor?: number }[] => {
    return Object.entries(COUNTRY_NAMES).map(([code, names]) => {
        const factor = getGridFactorForCountry(code)
        return {
            code,
            nameKo: names.ko,
            nameEn: names.en,
            gridFactor: factor?.value
        }
    })
}

/**
 * 빈 사이트 데이터 생성
 */
export const createEmptySiteData = (index: number): SiteData => ({
    id: `site_${Date.now()}_${index}`,
    name: '',
    country: '한국',
    countryCode: 'KR',
    productionVolume: 0,
    productionUnit: '개',
    cfpPerUnit: 0,
    electricityGridId: 'electricity_korea_2023_consumption',
    dataQuality: 'primary'
})

// =============================================================================
// 내부 유틸리티
// =============================================================================

function generateInsights(contributions: SiteContribution[], weightedCFP: number, rangePercent: number): string[] {
    const insights: string[] = []

    // 최대 기여 사이트
    const maxSite = contributions.reduce((a, b) => a.emissionShare > b.emissionShare ? a : b)
    insights.push(`${maxSite.siteName}(${maxSite.country})이 전체 배출량의 ${maxSite.emissionShare.toFixed(1)}%를 차지합니다.`)

    // 사이트 간 편차
    if (rangePercent > 30) {
        insights.push(`⚠️ 사이트 간 CFP 편차가 ${rangePercent.toFixed(0)}%로 큽니다. 고배출 사이트의 개선 기회를 검토하세요.`)
    } else if (rangePercent > 10) {
        insights.push(`사이트 간 CFP 편차: ${rangePercent.toFixed(0)}%. 적정 수준입니다.`)
    } else {
        insights.push(`사이트 간 CFP 편차: ${rangePercent.toFixed(0)}%. 매우 균일합니다.`)
    }

    // 최고/최저 CFP 비교
    const minSite = contributions.reduce((a, b) => a.cfpPerUnit < b.cfpPerUnit ? a : b)
    if (maxSite.siteId !== minSite.siteId) {
        const diff = ((maxSite.cfpPerUnit - minSite.cfpPerUnit) / minSite.cfpPerUnit * 100).toFixed(0)
        insights.push(`${maxSite.siteName}의 CFP가 ${minSite.siteName} 대비 ${diff}% 높습니다.`)
    }

    return insights
}

function generateReportKo(
    sites: SiteData[], contributions: SiteContribution[],
    weightedCFP: number, totalProd: number, unit: string
): string {
    let report = `본 제품은 ${sites.length}개 사업장에서 생산되며, ISO 14067:2018 6.3.6에 따라 `
    report += `생산량 기준 가중 평균으로 CFP를 산출하였습니다.\n\n`
    report += `가중 평균 CFP: ${weightedCFP.toFixed(4)} kgCO₂e/기능단위\n`
    report += `총 생산량: ${totalProd.toLocaleString()} ${unit}\n\n`

    report += `사업장별 상세:\n`
    contributions.forEach(c => {
        report += `- ${c.siteName} (${c.country}): CFP ${c.cfpPerUnit.toFixed(4)} kgCO₂e, `
        report += `생산비중 ${c.productionShare.toFixed(1)}%, 배출기여 ${c.emissionShare.toFixed(1)}%\n`
    })

    return report
}

function generateReportEn(
    sites: SiteData[], contributions: SiteContribution[],
    weightedCFP: number, totalProd: number, unit: string
): string {
    let report = `This product is manufactured across ${sites.length} sites. `
    report += `A production-weighted average CFP was calculated per ISO 14067:2018 6.3.6.\n\n`
    report += `Weighted average CFP: ${weightedCFP.toFixed(4)} kgCO₂e/FU\n`
    report += `Total production: ${totalProd.toLocaleString()} ${unit}\n\n`

    contributions.forEach(c => {
        report += `- ${c.siteName} (${c.country}): CFP ${c.cfpPerUnit.toFixed(4)} kgCO₂e/FU, `
        report += `production share ${c.productionShare.toFixed(1)}%, emission share ${c.emissionShare.toFixed(1)}%\n`
    })

    return report
}

function createEmptyMultiSiteResult(): MultiSiteResult {
    return {
        weightedCFP: 0,
        totalProduction: 0,
        productionUnit: '개',
        sites: [],
        sensitivityRange: { min: 0, max: 0, rangePercent: 0 },
        insights: ['사업장 데이터를 입력해 주세요.'],
        isoCompliance: [],
        reportTextKo: '',
        reportTextEn: ''
    }
}
