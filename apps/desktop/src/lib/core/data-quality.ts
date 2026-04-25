/**
 * ISO 14067 데이터 품질 관리 시스템
 * 
 * ISO 14067:2018 6.3.5 (데이터 및 데이터 품질)
 * Pedigree Matrix 기반 데이터 품질 평가
 */

// =============================================================================
// 데이터 품질 지표 (DQI) 타입 정의
// =============================================================================

export interface DataQualityIndicators {
    reliability: 1 | 2 | 3 | 4 | 5           // 신뢰성
    completeness: 1 | 2 | 3 | 4 | 5          // 완전성
    temporalCorrelation: 1 | 2 | 3 | 4 | 5   // 시간적 상관성
    geographicalCorrelation: 1 | 2 | 3 | 4 | 5  // 지리적 상관성
    technologicalCorrelation: 1 | 2 | 3 | 4 | 5 // 기술적 상관성
}

export type DataQualityLevel = 'high' | 'medium' | 'low' | 'very_low'
export type DataSourceType = 'primary_measured' | 'primary_calculated' | 'secondary_verified' | 'secondary_database' | 'estimated'

// =============================================================================
// Pedigree Matrix 정의 (ISO 14067 6.3.5 기반)
// =============================================================================

export const PEDIGREE_MATRIX = {
    reliability: {
        name: '신뢰성 (Reliability)',
        nameKo: '신뢰성',
        description: '데이터 수집 방법과 검증 절차의 신뢰도',
        levels: {
            1: {
                label: '매우 높음',
                description: '검증된 직접 측정 데이터',
                descriptionKo: '검증된 측정/계산 데이터, 동일 공정에서 수집'
            },
            2: {
                label: '높음',
                description: '부분 검증된 데이터 또는 계산 기반',
                descriptionKo: '부분 검증 데이터, 유사 공정에서 수집'
            },
            3: {
                label: '보통',
                description: '비검증 데이터 또는 추정치',
                descriptionKo: '비검증 데이터, 업계 평균값'
            },
            4: {
                label: '낮음',
                description: '자격을 갖춘 추정',
                descriptionKo: '자격 있는 추정, 문헌 기반'
            },
            5: {
                label: '매우 낮음',
                description: '비자격 추정',
                descriptionKo: '비자격 추정, 출처 불명'
            }
        }
    },
    completeness: {
        name: '완전성 (Completeness)',
        nameKo: '완전성',
        description: '데이터 샘플의 대표성 및 충분성',
        levels: {
            1: {
                label: '매우 높음',
                description: '대표 데이터, 충분한 샘플 크기',
                descriptionKo: '대표 데이터, 모든 관련 사이트 포함'
            },
            2: {
                label: '높음',
                description: '대표 데이터, 불충분한 샘플 크기',
                descriptionKo: '대표 데이터, 50% 이상 사이트 포함'
            },
            3: {
                label: '보통',
                description: '대표 데이터, 불명확한 샘플 크기',
                descriptionKo: '대표 데이터, 샘플 크기 불명확'
            },
            4: {
                label: '낮음',
                description: '대표성 불명확',
                descriptionKo: '대표성 불명확, 제한된 데이터'
            },
            5: {
                label: '매우 낮음',
                description: '비대표성 또는 불명',
                descriptionKo: '대표성 없음 또는 단일 측정'
            }
        }
    },
    temporalCorrelation: {
        name: '시간적 상관성 (Temporal Correlation)',
        nameKo: '시간적 상관성',
        description: '데이터 수집 시점과 현재와의 차이',
        levels: {
            1: {
                label: '매우 높음',
                description: '3년 이내 데이터',
                descriptionKo: '3년 이내 수집된 데이터'
            },
            2: {
                label: '높음',
                description: '6년 이내 데이터',
                descriptionKo: '3-6년 전 수집된 데이터'
            },
            3: {
                label: '보통',
                description: '10년 이내 데이터',
                descriptionKo: '6-10년 전 수집된 데이터'
            },
            4: {
                label: '낮음',
                description: '15년 이내 데이터',
                descriptionKo: '10-15년 전 수집된 데이터'
            },
            5: {
                label: '매우 낮음',
                description: '15년 초과 또는 불명',
                descriptionKo: '15년 초과 또는 연도 불명'
            }
        }
    },
    geographicalCorrelation: {
        name: '지리적 상관성 (Geographical Correlation)',
        nameKo: '지리적 상관성',
        description: '데이터 수집 지역과 실제 적용 지역의 일치도',
        levels: {
            1: {
                label: '매우 높음',
                description: '동일 지역 데이터',
                descriptionKo: '동일 지역/국가 데이터'
            },
            2: {
                label: '높음',
                description: '유사 생산 조건의 지역',
                descriptionKo: '유사 생산 조건 지역 (예: OECD)'
            },
            3: {
                label: '보통',
                description: '유사 지역의 평균 데이터',
                descriptionKo: '유사 지역 평균 (예: 아시아 평균)'
            },
            4: {
                label: '낮음',
                description: '다소 유사한 지역',
                descriptionKo: '다소 다른 조건의 지역'
            },
            5: {
                label: '매우 낮음',
                description: '불명 또는 매우 다른 지역',
                descriptionKo: '지역 불명 또는 전혀 다른 조건'
            }
        }
    },
    technologicalCorrelation: {
        name: '기술적 상관성 (Technological Correlation)',
        nameKo: '기술적 상관성',
        description: '데이터 기반 기술과 실제 사용 기술의 일치도',
        levels: {
            1: {
                label: '매우 높음',
                description: '동일 기업/공정 데이터',
                descriptionKo: '동일 기업, 동일 공정'
            },
            2: {
                label: '높음',
                description: '동일 기술의 다른 기업',
                descriptionKo: '동일 기술, 다른 기업'
            },
            3: {
                label: '보통',
                description: '유사 기술의 데이터',
                descriptionKo: '유사 기술 (동일 원리)'
            },
            4: {
                label: '낮음',
                description: '관련 기술의 데이터',
                descriptionKo: '관련 기술 (유사 출력물)'
            },
            5: {
                label: '매우 낮음',
                description: '관련 공정의 데이터',
                descriptionKo: '관련 공정 (대략적 유사성)'
            }
        }
    }
}

// =============================================================================
// 데이터 품질 프리셋
// =============================================================================

export interface DataQualityPreset {
    id: string
    name: string
    nameKo: string
    description: string
    sourceType: DataSourceType
    indicators: DataQualityIndicators
    uncertaintyFactor: number // 기본 불확실성 계수 (%)
}

export const DATA_QUALITY_PRESETS: DataQualityPreset[] = [
    {
        id: 'primary_site',
        name: 'Primary Data - Site Specific',
        nameKo: '1차 데이터 - 현장 특정',
        description: '자체 사업장에서 직접 측정/계산한 데이터',
        sourceType: 'primary_measured',
        indicators: {
            reliability: 1,
            completeness: 1,
            temporalCorrelation: 1,
            geographicalCorrelation: 1,
            technologicalCorrelation: 1
        },
        uncertaintyFactor: 5
    },
    {
        id: 'primary_supplier',
        name: 'Primary Data - Supplier',
        nameKo: '1차 데이터 - 공급사 제공',
        description: '공급업체가 제공한 검증된 데이터',
        sourceType: 'primary_calculated',
        indicators: {
            reliability: 2,
            completeness: 2,
            temporalCorrelation: 1,
            geographicalCorrelation: 1,
            technologicalCorrelation: 2
        },
        uncertaintyFactor: 10
    },
    {
        id: 'secondary_national',
        name: 'Secondary Data - National DB',
        nameKo: '2차 데이터 - 국가 DB',
        description: '국가 LCI 데이터베이스 (예: 환경부 DB)',
        sourceType: 'secondary_verified',
        indicators: {
            reliability: 2,
            completeness: 3,
            temporalCorrelation: 2,
            geographicalCorrelation: 1,
            technologicalCorrelation: 3
        },
        uncertaintyFactor: 20
    },
    {
        id: 'secondary_international',
        name: 'Secondary Data - International DB',
        nameKo: '2차 데이터 - 국제 DB',
        description: '국제 LCI 데이터베이스 (예: Ecoinvent, GaBi) - 검증된 산업 표준 DB',
        sourceType: 'secondary_verified',
        indicators: {
            reliability: 2,        // 검증된 DB, peer-reviewed
            completeness: 2,       // 충분한 샘플 크기 (국제 표준)
            temporalCorrelation: 2, // 정기 업데이트 (연 1-2회)
            geographicalCorrelation: 2, // OECD/유럽 평균 (유사 생산 조건)
            technologicalCorrelation: 2  // 표준 기술 (산업 표준)
        },
        uncertaintyFactor: 20  // 검증된 DB로 불확실성 낮춤
    },
    {
        id: 'secondary_literature',
        name: 'Secondary Data - Literature',
        nameKo: '2차 데이터 - 문헌',
        description: '학술 문헌 또는 산업 보고서 기반 (개별 연구)',
        sourceType: 'secondary_database',
        indicators: {
            reliability: 3,        // 개별 연구, 검증 수준 다양
            completeness: 3,       // 제한적 샘플 크기
            temporalCorrelation: 3, // 업데이트 빈도 낮음
            geographicalCorrelation: 4, // 지역 특정성 낮음 (다소 다른 조건)
            technologicalCorrelation: 3  // 유사 기술
        },
        uncertaintyFactor: 40
    },
    {
        id: 'estimated',
        name: 'Estimated Data',
        nameKo: '추정 데이터',
        description: '전문가 추정 또는 프록시 데이터',
        sourceType: 'estimated',
        indicators: {
            reliability: 4,
            completeness: 4,
            temporalCorrelation: 4,
            geographicalCorrelation: 4,
            technologicalCorrelation: 4
        },
        uncertaintyFactor: 50
    }
]

// =============================================================================
// DQI 계산 함수
// =============================================================================

/**
 * 데이터 품질 지표(DQI) 계산
 * 1에 가까울수록 높은 품질, 5에 가까울수록 낮은 품질
 */
export const calculateDQI = (indicators: DataQualityIndicators): number => {
    const values = Object.values(indicators) as number[]
    return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * DQI를 품질 레벨로 변환
 */
export const getDQILevel = (dqi: number): DataQualityLevel => {
    if (dqi <= 1.5) return 'high'
    if (dqi <= 2.5) return 'medium'
    if (dqi <= 3.5) return 'low'
    return 'very_low'
}

/**
 * DQI 레벨 라벨
 */
export const DQI_LEVEL_LABELS: Record<DataQualityLevel, { label: string, labelKo: string, color: string }> = {
    high: { label: 'High', labelKo: '높음', color: 'green' },
    medium: { label: 'Medium', labelKo: '보통', color: 'yellow' },
    low: { label: 'Low', labelKo: '낮음', color: 'orange' },
    very_low: { label: 'Very Low', labelKo: '매우 낮음', color: 'red' }
}

/**
 * DQI를 기반으로 불확실성 범위 추정 (%)
 */
export const estimateUncertaintyFromDQI = (dqi: number): { min: number, max: number, geometric: number } => {
    // Ecoinvent Pedigree Matrix 기반 불확실성 추정
    // GSD² (Geometric Standard Deviation Squared) 접근법 간소화
    
    let baseUncertainty: number
    
    if (dqi <= 1.5) {
        baseUncertainty = 10
    } else if (dqi <= 2.0) {
        baseUncertainty = 15
    } else if (dqi <= 2.5) {
        baseUncertainty = 25
    } else if (dqi <= 3.0) {
        baseUncertainty = 35
    } else if (dqi <= 3.5) {
        baseUncertainty = 50
    } else if (dqi <= 4.0) {
        baseUncertainty = 70
    } else {
        baseUncertainty = 100
    }
    
    return {
        min: -baseUncertainty,
        max: baseUncertainty,
        geometric: baseUncertainty
    }
}

/**
 * 개별 지표에서 불확실성 기여도 계산
 */
export const calculateIndicatorUncertainty = (indicators: DataQualityIndicators): Record<keyof DataQualityIndicators, number> => {
    const uncertaintyFactors: Record<number, number> = {
        1: 1.00,  // 1.00 = 0% 추가 불확실성
        2: 1.05,  // 5% 추가
        3: 1.10,  // 10% 추가
        4: 1.20,  // 20% 추가
        5: 1.50   // 50% 추가
    }
    
    return {
        reliability: uncertaintyFactors[indicators.reliability] || 1.5,
        completeness: uncertaintyFactors[indicators.completeness] || 1.5,
        temporalCorrelation: uncertaintyFactors[indicators.temporalCorrelation] || 1.5,
        geographicalCorrelation: uncertaintyFactors[indicators.geographicalCorrelation] || 1.5,
        technologicalCorrelation: uncertaintyFactors[indicators.technologicalCorrelation] || 1.5
    }
}

/**
 * 총 불확실성 계산 (GSD² 방식 간소화)
 */
export const calculateTotalUncertainty = (
    baseUncertainty: number,
    indicators: DataQualityIndicators
): number => {
    const indicatorUncertainties = calculateIndicatorUncertainty(indicators)
    
    // 모든 불확실성 계수를 곱함
    const combinedFactor = Object.values(indicatorUncertainties).reduce((acc, val) => acc * val, 1)
    
    // 기본 불확실성에 적용
    return Math.min(baseUncertainty * combinedFactor, 200) // 최대 200%로 제한
}

// =============================================================================
// 데이터 품질 요약 생성
// =============================================================================

export interface DataQualitySummary {
    overallDQI: number
    level: DataQualityLevel
    levelLabel: string
    uncertaintyRange: { min: number, max: number }
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
}

export const generateDataQualitySummary = (indicators: DataQualityIndicators): DataQualitySummary => {
    const dqi = calculateDQI(indicators)
    const level = getDQILevel(dqi)
    const uncertainty = estimateUncertaintyFromDQI(dqi)
    
    const strengths: string[] = []
    const weaknesses: string[] = []
    const recommendations: string[] = []
    
    // 강점/약점 분석
    if (indicators.reliability <= 2) {
        strengths.push('검증된 신뢰성 높은 데이터 사용')
    } else if (indicators.reliability >= 4) {
        weaknesses.push('데이터 신뢰성이 낮음')
        recommendations.push('직접 측정 또는 검증된 데이터로 대체 권장')
    }
    
    if (indicators.completeness <= 2) {
        strengths.push('충분한 샘플 크기의 대표 데이터')
    } else if (indicators.completeness >= 4) {
        weaknesses.push('데이터 완전성이 부족함')
        recommendations.push('더 많은 데이터 포인트 수집 권장')
    }
    
    if (indicators.temporalCorrelation <= 2) {
        strengths.push('최신 데이터 사용 (6년 이내)')
    } else if (indicators.temporalCorrelation >= 4) {
        weaknesses.push('오래된 데이터 사용')
        recommendations.push('최신 데이터로 업데이트 권장')
    }
    
    if (indicators.geographicalCorrelation <= 2) {
        strengths.push('지역적 대표성이 높음')
    } else if (indicators.geographicalCorrelation >= 4) {
        weaknesses.push('지역적 대표성이 낮음')
        recommendations.push('한국/동아시아 지역 데이터 사용 권장')
    }
    
    if (indicators.technologicalCorrelation <= 2) {
        strengths.push('기술적 대표성이 높음')
    } else if (indicators.technologicalCorrelation >= 4) {
        weaknesses.push('기술적 대표성이 낮음')
        recommendations.push('실제 사용 기술에 맞는 데이터 확보 권장')
    }
    
    return {
        overallDQI: dqi,
        level,
        levelLabel: DQI_LEVEL_LABELS[level].labelKo,
        uncertaintyRange: { min: uncertainty.min, max: uncertainty.max },
        strengths,
        weaknesses,
        recommendations
    }
}

// =============================================================================
// 프리셋에서 지표 가져오기
// =============================================================================

export const getPresetById = (presetId: string): DataQualityPreset | undefined => {
    return DATA_QUALITY_PRESETS.find(p => p.id === presetId)
}

export const getDefaultPreset = (): DataQualityPreset => {
    return DATA_QUALITY_PRESETS.find(p => p.id === 'secondary_national') || DATA_QUALITY_PRESETS[0]
}

