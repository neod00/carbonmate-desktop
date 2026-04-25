/**
 * ISO 14067 시스템 경계 및 기능단위 관련 로직
 * 
 * ISO 14067:2018 6.3.3 (기능단위/선언단위)
 * ISO 14067:2018 6.3.4 (시스템 경계)
 */

import { BoundaryType } from './store'

// =============================================================================
// 시스템 경계 정의 (ISO 14067 6.3.4)
// =============================================================================

export interface SystemBoundaryConfig {
    id: BoundaryType
    name: string
    nameKo: string
    description: string
    descriptionKo: string
    requiredStages: string[]
    optionalStages: string[]
    excludedStages: string[]
    typicalUseCase: string
    isoReference: string
}

export const SYSTEM_BOUNDARIES: SystemBoundaryConfig[] = [
    {
        id: 'cradle-to-gate',
        name: 'Cradle-to-Gate',
        nameKo: '요람에서 공장문까지',
        description: 'From raw material extraction to factory gate (excludes use and end-of-life)',
        descriptionKo: '원료 채취부터 공장 출하까지의 배출량. 사용 및 폐기 단계 제외.',
        requiredStages: ['raw_materials', 'manufacturing'],
        optionalStages: ['transport', 'packaging'],
        excludedStages: ['use', 'eol'],
        typicalUseCase: 'B2B 거래, 중간재, EPD (환경성적표지)',
        isoReference: 'ISO 14067:2018 3.1.1.2'
    },
    {
        id: 'cradle-to-grave',
        name: 'Cradle-to-Grave',
        nameKo: '요람에서 무덤까지',
        description: 'Full life cycle from raw material extraction to end-of-life',
        descriptionKo: '원료 채취부터 폐기까지 전체 생애주기의 배출량.',
        requiredStages: ['raw_materials', 'manufacturing', 'transport', 'use', 'eol'],
        optionalStages: ['packaging'],
        excludedStages: [],
        typicalUseCase: 'B2C 제품, 소비재, 전체 탄소발자국 평가',
        isoReference: 'ISO 14067:2018 3.1.1.1'
    },
    {
        id: 'gate-to-gate',
        name: 'Gate-to-Gate',
        nameKo: '공장문에서 공장문까지',
        description: 'Only manufacturing/processing stage within facility',
        descriptionKo: '공장 내 제조/가공 단계만 포함.',
        requiredStages: ['manufacturing'],
        optionalStages: [],
        excludedStages: ['raw_materials', 'transport', 'packaging', 'use', 'eol'],
        typicalUseCase: '공정 개선 평가, 내부 벤치마킹',
        isoReference: 'ISO 14067:2018 6.3.4'
    }
]

/**
 * 시스템 경계 설정 가져오기
 */
export const getSystemBoundaryConfig = (boundaryType: BoundaryType): SystemBoundaryConfig => {
    return SYSTEM_BOUNDARIES.find(b => b.id === boundaryType) || SYSTEM_BOUNDARIES[0]
}

// =============================================================================
// 생애주기 단계 정의
// =============================================================================

export interface LifecycleStage {
    id: string
    name: string
    nameKo: string
    description: string
    descriptionKo: string
    icon: string
    color: string
    subStages?: string[]
}

export const LIFECYCLE_STAGES: LifecycleStage[] = [
    {
        id: 'raw_materials',
        name: 'Raw Material Acquisition',
        nameKo: '원료 채취',
        description: 'Extraction and processing of raw materials',
        descriptionKo: '원자재 채굴, 추출, 전처리 과정',
        icon: '⛏️',
        color: 'amber',
        subStages: ['extraction', 'processing', 'upstream_transport']
    },
    {
        id: 'manufacturing',
        name: 'Manufacturing',
        nameKo: '제조',
        description: 'Product manufacturing and assembly',
        descriptionKo: '제품 생산, 조립, 공장 내 에너지 사용',
        icon: '🏭',
        color: 'orange',
        subStages: ['energy_use', 'process_emissions', 'auxiliary_materials']
    },
    {
        id: 'transport',
        name: 'Distribution & Transport',
        nameKo: '유통 및 운송',
        description: 'Transportation of materials and products',
        descriptionKo: '원료 운송, 제품 배송, 창고 보관',
        icon: '🚚',
        color: 'blue',
        subStages: ['inbound_transport', 'outbound_transport', 'warehousing']
    },
    {
        id: 'packaging',
        name: 'Packaging',
        nameKo: '포장',
        description: 'Product packaging materials',
        descriptionKo: '포장재 생산 및 폐기',
        icon: '📦',
        color: 'brown',
        subStages: ['primary_packaging', 'secondary_packaging', 'tertiary_packaging']
    },
    {
        id: 'use',
        name: 'Use Phase',
        nameKo: '사용',
        description: 'Energy and resource consumption during product use',
        descriptionKo: '제품 사용 중 에너지/자원 소비',
        icon: '⚡',
        color: 'yellow',
        subStages: ['energy_consumption', 'maintenance', 'consumables']
    },
    {
        id: 'eol',
        name: 'End-of-Life',
        nameKo: '폐기',
        description: 'Product disposal, recycling, and recovery',
        descriptionKo: '제품 수거, 재활용, 처리',
        icon: '♻️',
        color: 'green',
        subStages: ['collection', 'sorting', 'recycling', 'disposal']
    }
]

/**
 * 단계 정보 가져오기
 */
export const getStageInfo = (stageId: string): LifecycleStage | undefined => {
    return LIFECYCLE_STAGES.find(s => s.id === stageId)
}

// =============================================================================
// 기능단위 템플릿 (ISO 14067 6.3.3)
// =============================================================================

export interface FunctionalUnitTemplate {
    id: string
    category: string
    categoryKo: string
    templates: {
        name: string
        nameKo: string
        example: string
        unit: string
    }[]
}

export const FUNCTIONAL_UNIT_TEMPLATES: FunctionalUnitTemplate[] = [
    {
        id: 'mass_based',
        category: 'Mass-based',
        categoryKo: '질량 기반',
        templates: [
            { name: 'Per kilogram', nameKo: '1 kg당', example: '1 kg of product', unit: '1 kg' },
            { name: 'Per tonne', nameKo: '1 톤당', example: '1 tonne of steel', unit: '1 t' },
            { name: 'Per gram', nameKo: '1 g당', example: '1 g of semiconductor', unit: '1 g' }
        ]
    },
    {
        id: 'volume_based',
        category: 'Volume-based',
        categoryKo: '부피 기반',
        templates: [
            { name: 'Per liter', nameKo: '1 리터당', example: '1 L of beverage', unit: '1 L' },
            { name: 'Per cubic meter', nameKo: '1 m³당', example: '1 m³ of concrete', unit: '1 m³' }
        ]
    },
    {
        id: 'piece_based',
        category: 'Piece-based',
        categoryKo: '개수 기반',
        templates: [
            { name: 'Per piece', nameKo: '1 개당', example: '1 unit of product', unit: '1 piece' },
            { name: 'Per pair', nameKo: '1 켤레당', example: '1 pair of shoes', unit: '1 pair' },
            { name: 'Per set', nameKo: '1 세트당', example: '1 set of furniture', unit: '1 set' }
        ]
    },
    {
        id: 'area_based',
        category: 'Area-based',
        categoryKo: '면적 기반',
        templates: [
            { name: 'Per square meter', nameKo: '1 m²당', example: '1 m² of flooring', unit: '1 m²' },
            { name: 'Per square centimeter', nameKo: '1 cm²당', example: '1 cm² of PCB', unit: '1 cm²' }
        ]
    },
    {
        id: 'function_based',
        category: 'Function-based',
        categoryKo: '기능 기반',
        templates: [
            { name: 'Per use', nameKo: '1 회 사용당', example: '1 wash cycle', unit: '1 use' },
            { name: 'Per year of service', nameKo: '1 년 서비스당', example: '1 year of operation', unit: '1 year' },
            { name: 'Per km traveled', nameKo: '1 km 주행당', example: '1 km of transportation', unit: '1 km' }
        ]
    }
]

// =============================================================================
// 제품 카테고리 및 기본 설정
// =============================================================================

export interface ProductCategory {
    id: string
    name: string
    nameKo: string
    defaultBoundary: BoundaryType
    defaultFunctionalUnit: string
    recommendedStages: string[]
    pcrReference?: string
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
    {
        id: 'electronics',
        name: 'Electronics',
        nameKo: '전자제품',
        defaultBoundary: 'cradle-to-grave',
        defaultFunctionalUnit: '1 piece',
        recommendedStages: ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol']
    },
    {
        id: 'machinery',
        name: 'Machinery & Equipment',
        nameKo: '기계/장비',
        defaultBoundary: 'cradle-to-gate',
        defaultFunctionalUnit: '1 piece',
        recommendedStages: ['raw_materials', 'manufacturing', 'transport', 'packaging']
    },
    {
        id: 'materials',
        name: 'Raw Materials & Chemicals',
        nameKo: '원자재/화학제품',
        defaultBoundary: 'cradle-to-gate',
        defaultFunctionalUnit: '1 kg',
        recommendedStages: ['raw_materials', 'manufacturing', 'transport']
    },
    {
        id: 'packaging',
        name: 'Packaging Materials',
        nameKo: '포장재',
        defaultBoundary: 'cradle-to-gate',
        defaultFunctionalUnit: '1 kg',
        recommendedStages: ['raw_materials', 'manufacturing', 'transport']
    },
    {
        id: 'food',
        name: 'Food & Beverages',
        nameKo: '식품/음료',
        defaultBoundary: 'cradle-to-grave',
        defaultFunctionalUnit: '1 kg',
        recommendedStages: ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol']
    },
    {
        id: 'textiles',
        name: 'Textiles & Apparel',
        nameKo: '섬유/의류',
        defaultBoundary: 'cradle-to-grave',
        defaultFunctionalUnit: '1 piece',
        recommendedStages: ['raw_materials', 'manufacturing', 'transport', 'packaging', 'use', 'eol']
    },
    {
        id: 'construction',
        name: 'Construction Materials',
        nameKo: '건설자재',
        defaultBoundary: 'cradle-to-gate',
        defaultFunctionalUnit: '1 kg',
        recommendedStages: ['raw_materials', 'manufacturing', 'transport']
    },
    {
        id: 'automotive',
        name: 'Automotive Parts',
        nameKo: '자동차 부품',
        defaultBoundary: 'cradle-to-gate',
        defaultFunctionalUnit: '1 piece',
        recommendedStages: ['raw_materials', 'manufacturing', 'transport', 'packaging']
    },
    {
        id: 'other',
        name: 'Other',
        nameKo: '기타',
        defaultBoundary: 'cradle-to-gate',
        defaultFunctionalUnit: '1 kg',
        recommendedStages: ['raw_materials', 'manufacturing', 'transport', 'packaging']
    }
]

/**
 * 제품 카테고리 가져오기
 */
export const getProductCategory = (categoryId: string): ProductCategory | undefined => {
    return PRODUCT_CATEGORIES.find(c => c.id === categoryId)
}

// =============================================================================
// Cut-off 기준 (ISO 14067 6.3.4.3)
// =============================================================================

export interface CutOffCriteria {
    massThreshold: number      // % - 질량 기준
    energyThreshold: number    // % - 에너지 기준
    environmentalThreshold: number  // % - 환경 영향 기준
    description: string
}

export const DEFAULT_CUT_OFF_CRITERIA: CutOffCriteria = {
    massThreshold: 1,
    energyThreshold: 1,
    environmentalThreshold: 1,
    description: '전체 투입물의 1% 미만인 항목은 제외 가능 (ISO 14067 6.3.4.3)'
}

export const STRICT_CUT_OFF_CRITERIA: CutOffCriteria = {
    massThreshold: 0.1,
    energyThreshold: 0.1,
    environmentalThreshold: 0.1,
    description: '엄격한 기준: 전체의 0.1% 미만인 항목만 제외'
}

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 시스템 경계에 따른 단계 상태 반환
 */
export const getStageStatus = (
    stageId: string, 
    boundaryType: BoundaryType
): 'required' | 'optional' | 'excluded' => {
    const config = getSystemBoundaryConfig(boundaryType)
    
    if (config.requiredStages.includes(stageId)) return 'required'
    if (config.optionalStages.includes(stageId)) return 'optional'
    return 'excluded'
}

/**
 * 시스템 경계에 따른 기본 선택 단계 반환
 */
export const getDefaultStagesForBoundary = (boundaryType: BoundaryType): string[] => {
    const config = getSystemBoundaryConfig(boundaryType)
    return [...config.requiredStages, ...config.optionalStages]
}

/**
 * 단계가 시스템 경계에서 선택 가능한지 확인
 */
export const isStageSelectableForBoundary = (
    stageId: string, 
    boundaryType: BoundaryType
): boolean => {
    const status = getStageStatus(stageId, boundaryType)
    return status !== 'excluded'
}

/**
 * 제품 카테고리에 따른 기본 설정 적용
 */
export const applyProductCategoryDefaults = (categoryId: string): {
    boundary: BoundaryType
    functionalUnit: string
    stages: string[]
} => {
    const category = getProductCategory(categoryId)
    if (!category) {
        return {
            boundary: 'cradle-to-gate',
            functionalUnit: '1 kg',
            stages: ['raw_materials', 'manufacturing', 'transport', 'packaging']
        }
    }
    
    return {
        boundary: category.defaultBoundary,
        functionalUnit: category.defaultFunctionalUnit,
        stages: category.recommendedStages
    }
}

/**
 * 시스템 경계 변경 시 단계 자동 조정
 */
export const adjustStagesForBoundaryChange = (
    currentStages: string[],
    newBoundary: BoundaryType
): string[] => {
    const config = getSystemBoundaryConfig(newBoundary)
    
    // 필수 단계는 항상 포함
    const newStages = [...config.requiredStages]
    
    // 현재 선택된 선택적 단계 유지 (제외되지 않는 것만)
    currentStages.forEach(stage => {
        if (config.optionalStages.includes(stage) && !newStages.includes(stage)) {
            newStages.push(stage)
        }
    })
    
    return newStages
}

