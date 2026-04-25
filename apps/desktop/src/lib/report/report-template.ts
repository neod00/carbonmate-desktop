/**
 * ISO 14067 CFP 보고서 템플릿 및 요구사항
 * 
 * ISO 14067:2018 Clause 7 - Communication
 * - 7.2 CFP 연구 보고서 (CFP study report)
 * - 7.3 CFP 연구 보고서 추가 요구사항
 */

// =============================================================================
// ISO 14067 7.2 - CFP 연구 보고서 필수 항목
// =============================================================================

export interface CFPReportRequirement {
    id: string
    clause: string  // ISO 14067 조항 번호
    title: string
    titleKo: string
    description: string
    descriptionKo: string
    category: 'mandatory' | 'conditional' | 'recommended'
    dataField?: string  // 매핑되는 데이터 필드
}

/**
 * ISO 14067 7.2 CFP 연구 보고서 필수 요소
 */
export const CFP_REPORT_REQUIREMENTS: CFPReportRequirement[] = [
    // 7.2 a) 시스템 경계 설명
    {
        id: 'system_boundary',
        clause: '7.2 a)',
        title: 'Description of the system boundary',
        titleKo: '시스템 경계 설명',
        description: 'Description of the system boundary for the CFP study including life cycle stages',
        descriptionKo: '생애주기 단계를 포함한 CFP 연구의 시스템 경계 설명',
        category: 'mandatory',
        dataField: 'productInfo.boundary'
    },
    // 7.2 b) 화석 GHG 배출
    {
        id: 'fossil_ghg',
        clause: '7.2 b)',
        title: 'Fossil GHG emissions and removals',
        titleKo: '화석 GHG 배출 및 제거',
        description: 'Quantified GHG emissions from fossil sources',
        descriptionKo: '화석 연료 기원 온실가스 배출량 (정량화)',
        category: 'mandatory',
        dataField: 'results.fossilEmissions'
    },
    // 7.2 c) 생물기원 GHG 배출
    {
        id: 'biogenic_ghg',
        clause: '7.2 c)',
        title: 'Biogenic GHG emissions and removals',
        titleKo: '생물기원 GHG 배출 및 제거',
        description: 'Quantified GHG emissions from biogenic sources',
        descriptionKo: '생물 기원 온실가스 배출량 (정량화)',
        category: 'mandatory',
        dataField: 'results.biogenicEmissions'
    },
    // 7.2 d) 직접 토지 이용 변화 (dLUC)
    {
        id: 'dluc_ghg',
        clause: '7.2 d)',
        title: 'GHG emissions from dLUC',
        titleKo: '직접 토지 이용 변화 GHG 배출',
        description: 'GHG emissions from direct land use change, if applicable',
        descriptionKo: '직접 토지 이용 변화로 인한 온실가스 배출 (해당 시)',
        category: 'conditional',
        dataField: 'results.dlucEmissions'
    },
    // 7.2 e) 항공 운송 배출
    {
        id: 'aircraft_ghg',
        clause: '7.2 e)',
        title: 'GHG emissions from aircraft transport',
        titleKo: '항공 운송 GHG 배출',
        description: 'GHG emissions from aircraft transport, reported separately',
        descriptionKo: '항공 운송으로 인한 온실가스 배출 (별도 기록)',
        category: 'mandatory',
        dataField: 'results.aircraftEmissions'
    },
    // 7.2 f) 오프셋 배출
    {
        id: 'offset_ghg',
        clause: '7.2 f)',
        title: 'GHG offsets',
        titleKo: '온실가스 오프셋',
        description: 'Offsetting GHG emissions, if applicable',
        descriptionKo: '온실가스 상쇄 배출량 (해당 시)',
        category: 'conditional',
        dataField: 'results.offsetEmissions'
    },
    // 7.2 g) 기능 단위
    {
        id: 'functional_unit',
        clause: '7.2 g)',
        title: 'Functional unit',
        titleKo: '기능 단위',
        description: 'The functional unit to which the CFP results are related',
        descriptionKo: 'CFP 결과가 관련되는 기능 단위',
        category: 'mandatory',
        dataField: 'productInfo.unit'
    },
    // 7.2 h) 기준 흐름
    {
        id: 'reference_flow',
        clause: '7.2 h)',
        title: 'Reference flow',
        titleKo: '기준 흐름',
        description: 'The reference flow corresponding to the functional unit',
        descriptionKo: '기능 단위에 해당하는 기준 흐름',
        category: 'mandatory',
        dataField: 'productInfo.referenceFlow'
    },
    // 7.2 i) 할당 절차
    {
        id: 'allocation',
        clause: '7.2 i)',
        title: 'Allocation procedures',
        titleKo: '할당 절차',
        description: 'Description of allocation procedures and justification',
        descriptionKo: '할당 절차 및 정당화 사유 설명',
        category: 'mandatory',
        dataField: 'methodology.allocationMethod'
    },
    // 7.2 j) 데이터 품질
    {
        id: 'data_quality',
        clause: '7.2 j)',
        title: 'Data quality',
        titleKo: '데이터 품질',
        description: 'Description of data quality requirements and assessment',
        descriptionKo: '데이터 품질 요구사항 및 평가 설명',
        category: 'mandatory',
        dataField: 'dataQuality'
    },
    // 7.2 k) GWP 값
    {
        id: 'gwp_values',
        clause: '7.2 k)',
        title: 'GWP values used',
        titleKo: '사용된 GWP 값',
        description: 'The GWP values used and their source',
        descriptionKo: '사용된 지구온난화지수(GWP) 값 및 출처',
        category: 'mandatory',
        dataField: 'methodology.gwpSource'
    },
    // 7.2 l) 제한사항
    {
        id: 'limitations',
        clause: '7.2 l)',
        title: 'Limitations',
        titleKo: '제한사항',
        description: 'Description of limitations of the CFP study (Annex A)',
        descriptionKo: 'CFP 연구의 제한사항 설명 (부록 A 참조)',
        category: 'mandatory',
        dataField: 'limitations'
    }
]

/**
 * ISO 14067 7.3 CFP 연구 보고서 추가 요구사항
 */
export const CFP_REPORT_ADDITIONAL_REQUIREMENTS: CFPReportRequirement[] = [
    // 7.3 a) 제품 설명
    {
        id: 'product_description',
        clause: '7.3 a)',
        title: 'Product description',
        titleKo: '제품 설명',
        description: 'Detailed description of the product under study',
        descriptionKo: '연구 대상 제품에 대한 상세 설명',
        category: 'mandatory',
        dataField: 'productInfo.name'
    },
    // 7.3 b) 연구 목적
    {
        id: 'study_goal',
        clause: '7.3 b)',
        title: 'Goal of the study',
        titleKo: '연구 목적',
        description: 'The goal and intended application of the CFP study',
        descriptionKo: 'CFP 연구의 목적 및 의도된 적용',
        category: 'mandatory',
        dataField: 'scope.goal'
    },
    // 7.3 c) 연구 범위
    {
        id: 'study_scope',
        clause: '7.3 c)',
        title: 'Scope of the study',
        titleKo: '연구 범위',
        description: 'The scope of the CFP study',
        descriptionKo: 'CFP 연구의 범위',
        category: 'mandatory',
        dataField: 'scope.systemBoundary'
    },
    // 7.3 d) 단위 공정 목록
    {
        id: 'unit_processes',
        clause: '7.3 d)',
        title: 'List of unit processes',
        titleKo: '단위 공정 목록',
        description: 'List of unit processes included in the product system',
        descriptionKo: '제품 시스템에 포함된 단위 공정 목록',
        category: 'mandatory',
        dataField: 'scope.lifecycleStages'
    },
    // 7.3 e) 고려된 GHG 목록
    {
        id: 'ghg_list',
        clause: '7.3 e)',
        title: 'List of GHGs considered',
        titleKo: '고려된 온실가스 목록',
        description: 'List of GHGs included in the CFP calculation',
        descriptionKo: 'CFP 계산에 포함된 온실가스 목록',
        category: 'mandatory',
        dataField: 'methodology.ghgList'
    },
    // 7.3 f) 배출계수 출처
    {
        id: 'emission_factor_sources',
        clause: '7.3 f)',
        title: 'Sources of emission factors',
        titleKo: '배출계수 출처',
        description: 'Sources of emission factors and their documentation',
        descriptionKo: '배출계수 출처 및 문서화',
        category: 'mandatory',
        dataField: 'methodology.emissionFactorSources'
    },
    // 7.3 g) 가정 및 제한
    {
        id: 'assumptions',
        clause: '7.3 g)',
        title: 'Assumptions and limitations',
        titleKo: '가정 및 제한',
        description: 'Description of assumptions and limitations',
        descriptionKo: '가정 및 제한사항 설명',
        category: 'mandatory',
        dataField: 'limitations.assumptions'
    },
    // 7.3 h) 민감도 분석
    {
        id: 'sensitivity_analysis',
        clause: '7.3 h)',
        title: 'Sensitivity analysis',
        titleKo: '민감도 분석',
        description: 'Results of sensitivity analysis, if conducted',
        descriptionKo: '민감도 분석 결과 (수행한 경우)',
        category: 'conditional',
        dataField: 'sensitivityAnalysis'
    },
    // 7.3 i) 불확실성 분석
    {
        id: 'uncertainty_analysis',
        clause: '7.3 i)',
        title: 'Uncertainty analysis',
        titleKo: '불확실성 분석',
        description: 'Results of uncertainty analysis',
        descriptionKo: '불확실성 분석 결과',
        category: 'mandatory',
        dataField: 'results.uncertaintyPercentage'
    }
]

// =============================================================================
// 보고서 섹션 정의
// =============================================================================

export interface ReportSection {
    id: string
    title: string
    titleKo: string
    order: number
    requirements: string[]  // CFPReportRequirement IDs
}

export const REPORT_SECTIONS: ReportSection[] = [
    {
        id: 'executive_summary',
        title: 'Executive Summary',
        titleKo: '요약',
        order: 1,
        requirements: []
    },
    {
        id: 'product_info',
        title: 'Product Information',
        titleKo: '제품 정보',
        order: 2,
        requirements: ['product_description', 'functional_unit', 'reference_flow']
    },
    {
        id: 'study_scope',
        title: 'Study Goal and Scope',
        titleKo: '연구 목적 및 범위',
        order: 3,
        requirements: ['study_goal', 'study_scope', 'system_boundary', 'unit_processes']
    },
    {
        id: 'methodology',
        title: 'Methodology',
        titleKo: '방법론',
        order: 4,
        requirements: ['gwp_values', 'ghg_list', 'emission_factor_sources', 'allocation', 'data_quality']
    },
    {
        id: 'results',
        title: 'CFP Results',
        titleKo: 'CFP 결과',
        order: 5,
        requirements: ['fossil_ghg', 'biogenic_ghg', 'dluc_ghg', 'aircraft_ghg', 'offset_ghg']
    },
    {
        id: 'analysis',
        title: 'Analysis',
        titleKo: '분석',
        order: 6,
        requirements: ['sensitivity_analysis', 'uncertainty_analysis']
    },
    {
        id: 'limitations',
        title: 'Limitations and Assumptions',
        titleKo: '제한사항 및 가정',
        order: 7,
        requirements: ['limitations', 'assumptions']
    },
    {
        id: 'conclusions',
        title: 'Conclusions',
        titleKo: '결론',
        order: 8,
        requirements: []
    },
    {
        id: 'references',
        title: 'References',
        titleKo: '참고문헌',
        order: 9,
        requirements: []
    }
]

// =============================================================================
// 보고서 데이터 인터페이스
// =============================================================================

export interface CFPReportData {
    // 메타데이터
    reportId: string
    reportDate: string
    reportVersion: string
    preparedBy?: string
    reviewedBy?: string

    // 제품 정보
    product: {
        name: string
        description?: string
        category: string
        manufacturer?: string
        functionalUnit: string
        referenceFlow?: string
    }

    // 연구 범위
    scope: {
        goal?: string
        intendedApplication?: string
        systemBoundary: string
        lifecycleStages: string[]
        exclusions?: string[]
        cutOffCriteria?: string
        cutOffResult?: {
            enabled: boolean
            totalItems: number
            excludedItems: number
            excludedEmissionPercent: number
            excludedItemsList: {
                name: string
                stage: string
                emission: number
                contribution: number
                reason: string
            }[]
            isoCompliance: {
                clause: string
                requirement: string
                satisfied: boolean
                notes: string
            }[]
        }
        // ISO 14067 6.3.1 CFP 연구 목표
        studyGoal?: {
            applicationPurpose: string
            reasonForStudy: string
            targetAudience: string
            cfpPcrReference?: string
            isCommunicationIntended: boolean
        }
        // ISO 14067 6.3.6 데이터 시간 경계
        timeBoundary?: {
            dataCollectionStart: string
            dataCollectionEnd: string
            cfpRepresentativeYear: string
            seasonalVariationConsidered: boolean
            justification?: string
        }
    }

    // 방법론
    methodology: {
        standard: string  // e.g., "ISO 14067:2018"
        gwpSource: string  // e.g., "IPCC AR6"
        gwpTimeHorizon: string  // e.g., "100 years"
        ghgList: { formula: string, name: string, gwp: number }[]
        emissionFactorSources: { name: string, year: number, region: string }[]
        allocationMethod: string
        allocationJustification?: string
        recyclingAllocationMethod: string
        recyclingAllocationJustification?: string
        dataQualityAssessment: string
    }

    // 결과
    results: {
        totalCFP: number
        unit: string  // kg CO2e per functional unit
        fossilEmissions: number
        biogenicEmissions: number
        dlucEmissions?: number
        aircraftEmissions: number
        offsetEmissions?: number
        stageBreakdown: { stage: string, emission: number, percentage: number }[]
        uncertaintyRange: { min: number, max: number }
        uncertaintyPercentage: number
        ghgBreakdown?: Record<string, number>  // P1-3: GHG별 상세 분해
    }

    // 데이터 품질
    dataQuality: {
        overallType: string
        primaryDataShare?: number
        secondaryDataShare?: number
        sources: string[]
        baseYear: number
        dqiScore?: number
        dqiLevel?: string
    }

    // 제한사항
    limitations: {
        singleImpact: string
        methodologyLimitations: string[]
        dataLimitations?: string[]
        scopeLimitations?: string[]
        assumptions: string[]
    }

    // 결론
    conclusions?: {
        keyFindings: string[]
        recommendations?: string[]
        improvementOpportunities?: string[]
    }

    // 민감도 분석 (ISO 14067 7.3 h)
    sensitivityAnalysis?: {
        performed: boolean
        analysisDate?: string
        baselineCFP: number
        significantFactors: string[]
        scenarios: {
            name: string
            type: string
            baseValue: string | number
            alternativeValue: string | number
            percentageChange: number
            isSignificant: boolean
        }[]
        recommendations: string[]
        isoCompliance: {
            clause: string
            requirement: string
            satisfied: boolean
        }[]
    }

    // 상세 LCI 데이터 및 품질 평가 (ISO 14067 7.2 j, k)
    lciDetails?: {
        materials: LciDataDetail[]
        transport: LciDataDetail[]
        packaging: LciDataDetail[]
        energy?: LciDataDetail[]
    }

    // CFP 성과 추적 (ISO 14067 6.4.7)
    cfpTracking?: {
        hasHistory: boolean
        snapshots: {
            date: string
            cfpValue: number
            functionalUnit: string
            notes?: string
        }[]
        trend: 'improving' | 'stable' | 'worsening'
        totalChangePercent: number
        annualChangePercent: number
        baselineYear: number
        latestYear: number
    }

    // ISO 14067 5항 원칙 준수 현황
    section5Compliance?: {
        overallScore: number
        overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
        isCompliant: boolean
        principles: {
            completeness: { score: number, grade: string, issues: number }
            transparency: { score: number, grade: string, documentedItems: number, totalItems: number }
            noDuplicates: { score: number, grade: string, warnings: number }
            scientificBasis: { score: number, grade: string, dominantTier: string }
            relevance: { score: number, grade: string, avgDataQuality: number, lowQualityItems: number }
        }
        summary: {
            strengths: string[]
            improvements: string[]
            criticalIssues: string[]
        }
    }

    // 준수 체크리스트
    complianceChecklist: {
        requirementId: string
        status: 'complete' | 'partial' | 'missing'
        notes?: string
    }[]
}

/**
 * 개별 LCI 데이터의 상세 정보 및 품질 지표
 */
export interface LciDataDetail {
    id: string
    name: string
    category: string
    quantity: number
    unit: string
    lciDb: string            // e.g., "ecoinvent Version 3.12"
    activityName?: string     // ecoinvent 표준 명칭
    geography?: string        // 지역 정보
    recommendationReason?: string // AI 선정 근거
    isoScores?: {
        temporal: number
        geographical: number
        technological: number
        completeness: number
        precision: number
        consistency: number
        overall: number
    }
}

// =============================================================================
// 보고서 생성 유틸리티
// =============================================================================

/**
 * 보고서 요구사항 상태 확인
 */
export const checkRequirementStatus = (
    requirement: CFPReportRequirement,
    reportData: Partial<CFPReportData>
): 'complete' | 'partial' | 'missing' => {
    if (!requirement.dataField) {
        return 'missing'
    }

    // 필드 경로 분석 (예: 'productInfo.unit')
    const fieldPath = requirement.dataField.split('.')
    let value: any = reportData

    for (const key of fieldPath) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key]
        } else {
            return 'missing'
        }
    }

    if (value === undefined || value === null || value === '') {
        return 'missing'
    }

    if (typeof value === 'number' && value === 0) {
        return 'partial'
    }

    return 'complete'
}

/**
 * 전체 보고서 준수율 계산
 */
export const calculateComplianceScore = (
    reportData: Partial<CFPReportData>
): { score: number, total: number, percentage: number, byCategory: Record<string, number> } => {
    const allRequirements = [...CFP_REPORT_REQUIREMENTS, ...CFP_REPORT_ADDITIONAL_REQUIREMENTS]
    const mandatory = allRequirements.filter(r => r.category === 'mandatory')

    let complete = 0
    let partial = 0

    for (const req of mandatory) {
        const status = checkRequirementStatus(req, reportData)
        if (status === 'complete') complete++
        else if (status === 'partial') partial += 0.5
    }

    const score = complete + partial
    const total = mandatory.length
    const percentage = (score / total) * 100

    return {
        score,
        total,
        percentage,
        byCategory: {
            mandatory: percentage,
            conditional: 0,
            recommended: 0
        }
    }
}

/**
 * 보고서 ID 생성
 */
export const generateReportId = (): string => {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `CFP-${dateStr}-${randomStr}`
}

/**
 * 기본 보고서 데이터 생성
 */
export const createDefaultReportData = (): Partial<CFPReportData> => {
    return {
        reportId: generateReportId(),
        reportDate: new Date().toISOString().split('T')[0],
        reportVersion: '1.0',
        methodology: {
            standard: 'ISO 14067:2018',
            gwpSource: 'IPCC AR6',
            gwpTimeHorizon: '100 years',
            ghgList: [],
            emissionFactorSources: [],
            allocationMethod: '',
            recyclingAllocationMethod: '',
            dataQualityAssessment: ''
        },
        limitations: {
            singleImpact: 'CFPs 결과는 기후변화라는 단일 환경 영향만 다루며, 전체 환경 성과를 대표하지 않습니다.',
            methodologyLimitations: [],
            assumptions: []
        },
        complianceChecklist: []
    }
}

// =============================================================================
// 보고서 출력 포맷
// =============================================================================

export type ReportFormat = 'html' | 'pdf' | 'json' | 'markdown'

export interface ReportExportOptions {
    format: ReportFormat
    includeAppendix: boolean
    includeCoverPage: boolean
    language: 'ko' | 'en' | 'both'
    companyLogo?: string
    customFooter?: string
}

export const DEFAULT_EXPORT_OPTIONS: ReportExportOptions = {
    format: 'html',
    includeAppendix: true,
    includeCoverPage: true,
    language: 'ko'
}

