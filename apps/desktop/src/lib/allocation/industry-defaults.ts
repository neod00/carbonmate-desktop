/**
 * 산업군별 기본값/프록시 데이터 및 사용자 가이드
 * 
 * 비전문가 사용자가 할당 방법을 쉽게 이해하고 적용할 수 있도록:
 * 1. 산업군별 대표적인 공동 제품과 기본값 제공
 * 2. 의사결정 트리 (질문-응답 기반)
 * 3. 필드별 도움말 텍스트
 * 4. 재활용 파라미터 산업군별 참고값
 */

// =============================================================================
// 의사결정 트리 (Decision Tree)
// =============================================================================

export interface DecisionNode {
    id: string
    question: string
    helpText: string
    icon: string // emoji
    options: DecisionOption[]
}

export interface DecisionOption {
    label: string
    description: string
    nextNodeId?: string  // 다음 질문으로 이동
    result?: DecisionResult  // 최종 결과
}

export interface DecisionResult {
    multiOutputNeeded: boolean
    recommendedMethod?: string
    recommendedBasis?: string
    explanation: string
}

export const MULTI_OUTPUT_DECISION_TREE: DecisionNode[] = [
    {
        id: 'start',
        question: '생산 공정에서 제품이 2개 이상 나오나요?',
        helpText: '예: 정유 공정(휘발유, 경유, 나프타), 제철(철강, 슬래그), 화학 반응(주 제품, 부산물) 등',
        icon: '🏭',
        options: [
            {
                label: '예, 여러 제품이 나옵니다',
                description: '주 제품 외에 부산물이나 공동 제품이 있습니다',
                nextNodeId: 'can_subdivide'
            },
            {
                label: '아니오, 제품은 하나입니다',
                description: '단일 제품만 생산됩니다',
                result: {
                    multiOutputNeeded: false,
                    explanation: '단일 제품 공정이므로 다중 출력 할당이 필요하지 않습니다. 이 섹션을 건너뛰셔도 됩니다.'
                }
            },
            {
                label: '잘 모르겠습니다',
                description: '공정에서 나오는 제품이 뭔지 불확실합니다',
                result: {
                    multiOutputNeeded: false,
                    explanation: '공정에서 단일 제품만 나온다면 할당이 필요 없습니다. 부산물(예: 폐열, 스크랩 등)이 있다면 "예"를 선택해주세요.'
                }
            }
        ]
    },
    {
        id: 'can_subdivide',
        question: '각 제품별로 공정을 분리할 수 있나요?',
        helpText: 'ISO 표준에서는 할당을 "회피"하는 것을 가장 권장합니다. 공정을 분리할 수 있다면 할당 자체가 불필요합니다.',
        icon: '✂️',
        options: [
            {
                label: '예, 분리 가능합니다',
                description: '각 제품의 생산 공정을 독립적으로 파악할 수 있습니다',
                result: {
                    multiOutputNeeded: true,
                    recommendedMethod: 'subdivision',
                    explanation: '공정 세분화(하위 분할)를 통해 할당을 회피할 수 있습니다. ISO에서 가장 권장하는 방법입니다.'
                }
            },
            {
                label: '아니오, 물리적으로 분리 불가합니다',
                description: '하나의 공정에서 동시에 여러 제품이 생산됩니다',
                nextNodeId: 'know_mass'
            }
        ]
    },
    {
        id: 'know_mass',
        question: '각 제품의 질량(무게)을 알고 있나요?',
        helpText: '질량 기반 할당은 가장 일반적이고 단순한 방법입니다. 대부분의 제조업에서 사용됩니다.',
        icon: '⚖️',
        options: [
            {
                label: '예, 질량 데이터가 있습니다',
                description: '각 제품의 kg 단위 산출량을 파악하고 있습니다',
                result: {
                    multiOutputNeeded: true,
                    recommendedMethod: 'physical',
                    recommendedBasis: 'mass',
                    explanation: '질량 기반 물리적 할당을 추천합니다. 가장 널리 사용되며, 대부분의 PCR에서 허용하는 방법입니다.'
                }
            },
            {
                label: '아니오, 질량은 모릅니다',
                description: '질량 데이터를 확보하기 어렵습니다',
                nextNodeId: 'know_energy'
            }
        ]
    },
    {
        id: 'know_energy',
        question: '각 제품의 에너지 함량(열량)을 알고 있나요?',
        helpText: '연료, 바이오매스, 에너지 관련 제품의 경우 에너지 함량(MJ) 기준 할당이 적합합니다.',
        icon: '⚡',
        options: [
            {
                label: '예, 에너지 데이터가 있습니다',
                description: '각 제품의 MJ 단위 에너지 함량을 알고 있습니다',
                result: {
                    multiOutputNeeded: true,
                    recommendedMethod: 'physical',
                    recommendedBasis: 'energy',
                    explanation: '에너지 함량 기반 물리적 할당을 추천합니다. 에너지 제품이나 연료에 적합합니다.'
                }
            },
            {
                label: '아니오',
                description: '에너지 데이터도 확보하기 어렵습니다',
                nextNodeId: 'know_price'
            }
        ]
    },
    {
        id: 'know_price',
        question: '각 제품의 시장 가격을 알고 있나요?',
        helpText: '물리적 데이터가 없을 때 경제적 할당(가격 기반)을 사용할 수 있습니다. 다만, 일부 PCR에서는 경제적 할당을 금지합니다.',
        icon: '💰',
        options: [
            {
                label: '예, 가격 정보가 있습니다',
                description: '각 제품의 시장 가격이나 판매 가격을 알고 있습니다',
                result: {
                    multiOutputNeeded: true,
                    recommendedMethod: 'economic',
                    explanation: '경제적 할당(가격 기반)을 적용합니다. 물리적 데이터를 확보할 수 없을 때 사용하는 방법입니다.'
                }
            },
            {
                label: '아니오, 가격도 모릅니다',
                description: '어떤 데이터도 확보하기 어렵습니다',
                result: {
                    multiOutputNeeded: true,
                    recommendedMethod: 'physical',
                    recommendedBasis: 'mass',
                    explanation: '질량 기반 할당을 기본으로 적용합니다. 아래 "산업군별 참고 데이터"를 활용해보세요.'
                }
            }
        ]
    }
]

// =============================================================================
// 쉬운 한국어 라벨 및 도움말
// =============================================================================

export interface FieldGuide {
    label: string           // 쉬운 한국어 라벨
    technicalLabel: string  // 기술적 라벨 (접기/펼치기 가능)
    helpText: string        // 도움말
    example: string         // 예시
    unit: string
    icon: string            // emoji
    dataSource: string      // 데이터를 어디서 구하는지
}

export const FIELD_GUIDES: Record<string, FieldGuide> = {
    // 다중 출력 - 주 제품 필드
    mainProductName: {
        label: '주 제품 이름',
        technicalLabel: 'Main Product Name',
        helpText: '배출량을 산정하려는 대상 제품의 이름입니다.',
        example: '예: 열연강판, 리튬이온 배터리 셀, 폴리에틸렌',
        unit: '',
        icon: '📦',
        dataSource: '제품 사양서 또는 생산 계획서'
    },
    mainProductMass: {
        label: '주 제품 질량',
        technicalLabel: 'Mass (kg)',
        helpText: '주 제품 1단위(기능단위)의 질량입니다. 할당 비율 계산에 사용됩니다.',
        example: '예: 배터리 셀 1kWh = 약 6~8 kg, 강판 1톤 = 1,000 kg',
        unit: 'kg',
        icon: '⚖️',
        dataSource: '생산 실적 데이터, BOM(자재명세서), 또는 제품 사양서'
    },
    mainProductEnergy: {
        label: '에너지 함량 (선택)',
        technicalLabel: 'Energy Content (MJ)',
        helpText: '에너지 기반 할당 시 필요합니다. 연료나 에너지 제품이 아니면 비워두셔도 됩니다.',
        example: '예: 경유 1kg = 42.6 MJ, 천연가스 1kg = 50.0 MJ',
        unit: 'MJ',
        icon: '⚡',
        dataSource: 'IPCC 가이드라인, 제품 시험 성적서, 또는 MSDS'
    },
    mainProductEconomic: {
        label: '단가 (선택)',
        technicalLabel: 'Economic Value (원/단위)',
        helpText: '경제적 할당 시 필요합니다. 최근 시장 가격이나 판매 가격을 입력하세요.',
        example: '예: 열연강판 약 80만원/톤, 배터리 셀 약 15만원/kWh',
        unit: '원/단위',
        icon: '💰',
        dataSource: '구매/판매 계약서, 시장 시세, 또는 원가 계산서'
    },
    mainProductCarbon: {
        label: '탄소 함량 (선택)',
        technicalLabel: 'Carbon Content (kg C)',
        helpText: '탄소 함량 기반 할당 시 필요합니다. 화학/석유화학 제품에 주로 사용됩니다.',
        example: '예: 폴리에틸렌 1kg = 약 0.86 kg C, 에탄올 1kg = 약 0.52 kg C',
        unit: 'kg C',
        icon: '🧪',
        dataSource: '화학 분석 결과, MSDS, 또는 분자식에서 계산'
    },
    totalProcessEmission: {
        label: '총 공정 배출량 (할당 전)',
        technicalLabel: 'Total Process Emission (kg CO₂e)',
        helpText: '전체 공정에서 발생한 총 온실가스 배출량입니다. 이 값을 제품별로 나누는 것이 "할당"입니다.',
        example: '이전 단계에서 계산된 값을 입력하세요',
        unit: 'kg CO₂e',
        icon: '🏭',
        dataSource: '활동데이터 단계에서 계산된 총 배출량'
    },

    // 재활용 할당 필드
    recycledContentInput: {
        label: '재활용 원료 사용 비율',
        technicalLabel: 'Recycled Content Input (R_in)',
        helpText: '제품 제조에 사용한 원료 중 재활용 원료의 비율입니다. 예를 들어 재활용 플라스틱을 30% 사용하면 30%입니다.',
        example: '예: 재활용 철 스크랩 70% 사용 → 70%, 100% 버진 원료 → 0%',
        unit: '%',
        icon: '♻️',
        dataSource: '원료 구매 기록, BOM'
    },
    recyclabilityOutput: {
        label: '제품 폐기 시 재활용 가능 비율',
        technicalLabel: 'Recyclability Output (R_out)',
        helpText: '제품이 수명을 다 한 후(EOL) 재활용될 수 있는 비율입니다.',
        example: '예: 알루미늄 캔 → 약 75%, PET 병 → 약 30%, 전자제품 → 약 20%',
        unit: '%',
        icon: '🔄',
        dataSource: '산업 재활용률 통계, 폐기물 관리 데이터'
    },
    qualityFactorInput: {
        label: '투입 재활용 원료 품질 유지율',
        technicalLabel: 'Quality Factor Input (Qs,in)',
        helpText: '재활용 원료가 버진 원료 대비 품질을 얼마나 유지하는지 나타냅니다. 1.0 = 동일 품질, 0.5 = 절반 품질.',
        example: '예: 클로즈드루프 재활용 (알루미늄 → 알루미늄) = 0.9~1.0, 다운사이클링 = 0.3~0.7',
        unit: '0~1',
        icon: '🔧',
        dataSource: '재활용 원료 시험 성적서, 산업 평균 데이터'
    },
    qualityFactorOutput: {
        label: '산출 재활용 원료 품질 유지율',
        technicalLabel: 'Quality Factor Output (Qs,out)',
        helpText: '제품 폐기 후 재활용된 원료의 품질 수준입니다. EOL 재활용 후 얻어지는 원료의 품질 비율.',
        example: '예: 철 스크랩 → 철강 재활용 = 0.8~1.0, 플라스틱 다운사이클링 = 0.4~0.6',
        unit: '0~1',
        icon: '🔧',
        dataSource: '재활용 공정 데이터, 산업 평균'
    }
}

// =============================================================================
// 산업군별 프록시/기본값 데이터
// =============================================================================

export interface IndustryProxy {
    sectorId: string
    sectorName: string
    sectorIcon: string
    description: string
    // 다중 출력 관련 기본값
    typicalCoProducts: TypicalCoProduct[]
    // 재활용 관련 기본값
    typicalRecyclingParams: TypicalRecyclingParams
    // 추천 할당 방법
    recommendedMethod: string
    recommendedBasis?: string
    methodReason: string
}

export interface TypicalCoProduct {
    name: string
    massRatioRange: string      // "5~10%"
    energyRatioRange?: string
    economicRatioRange?: string
    note: string
}

export interface TypicalRecyclingParams {
    recycledContentRange: string    // "0~70%"
    recyclabilityRange: string      // "20~90%"
    qualityFactorRange: string      // "0.5~1.0"
    note: string
}

export const INDUSTRY_PROXIES: IndustryProxy[] = [
    {
        sectorId: 'steel_metals',
        sectorName: '철강·금속',
        sectorIcon: '🔩',
        description: '제철, 주조, 압연 등 금속 가공 공정',
        typicalCoProducts: [
            { name: '슬래그 (Slag)', massRatioRange: '25~35%', economicRatioRange: '2~5%', note: '시멘트 대체재로 활용 가능' },
            { name: '더스트 (Dust)', massRatioRange: '1~3%', economicRatioRange: '<1%', note: '아연 회수용으로 재활용' },
            { name: '부생가스 (Off-gas)', massRatioRange: 'N/A', energyRatioRange: '10~20%', note: 'COG, BFG, LDG 등 에너지 회수' },
        ],
        typicalRecyclingParams: {
            recycledContentRange: '20~70%',
            recyclabilityRange: '85~95%',
            qualityFactorRange: '0.8~1.0',
            note: '철 스크랩은 높은 재활용률과 품질 유지율을 보임'
        },
        recommendedMethod: 'system_expansion',
        methodReason: 'Worldsteel LCI 방법론에 따라 시스템 확장이 가장 권장됩니다'
    },
    {
        sectorId: 'battery_ev',
        sectorName: '배터리·EV',
        sectorIcon: '🔋',
        description: '리튬이온 배터리, 전기차 부품 등',
        typicalCoProducts: [
            { name: '양극재 스크랩', massRatioRange: '3~8%', economicRatioRange: '10~20%', note: '코발트, 니켈 등 고가 금속 포함' },
            { name: '전해액 부산물', massRatioRange: '1~3%', economicRatioRange: '2~5%', note: 'LiPF6 회수 가능' },
            { name: 'Black Mass', massRatioRange: '5~15%', economicRatioRange: '15~30%', note: '배터리 재활용의 핵심 중간재' },
        ],
        typicalRecyclingParams: {
            recycledContentRange: '5~30%',
            recyclabilityRange: '50~70%',
            qualityFactorRange: '0.6~0.9',
            note: 'EU Battery Regulation에 따라 재활용 원료 최소 사용 비율 의무화 예정'
        },
        recommendedMethod: 'physical',
        recommendedBasis: 'mass',
        methodReason: 'EU PEFCR Batteries에 따라 용량(kWh) 또는 질량 기준 할당'
    },
    {
        sectorId: 'chemical_petrochemical',
        sectorName: '화학·석유화학',
        sectorIcon: '🧪',
        description: '석유 정제, 스팀 크래킹, 화학 반응 등',
        typicalCoProducts: [
            { name: '부산물 가스 (off-gas)', massRatioRange: '5~15%', energyRatioRange: '10~25%', note: '연료용 또는 화학 원료용' },
            { name: '부산물 (by-product)', massRatioRange: '10~30%', economicRatioRange: '5~20%', note: '타르, 피치, 황 등' },
            { name: '폐열 (waste heat)', massRatioRange: 'N/A', energyRatioRange: '5~15%', note: '스팀 생산 또는 지역난방에 활용' },
        ],
        typicalRecyclingParams: {
            recycledContentRange: '0~20%',
            recyclabilityRange: '10~50%',
            qualityFactorRange: '0.3~0.7',
            note: '화학 제품은 다운사이클링이 일반적이며 재활용률이 상대적으로 낮음'
        },
        recommendedMethod: 'physical',
        recommendedBasis: 'mass',
        methodReason: 'TfS PCF Guideline에 따라 질량 기반 할당 (경제적 할당 금지)'
    },
    {
        sectorId: 'general_manufacturing',
        sectorName: '일반 제조업',
        sectorIcon: '🏭',
        description: '기계, 전자, 식품, 섬유 등 일반 제조업',
        typicalCoProducts: [
            { name: '스크랩/절삭칩', massRatioRange: '5~20%', economicRatioRange: '3~10%', note: '금속 가공 스크랩' },
            { name: '불량품/리워크', massRatioRange: '1~5%', economicRatioRange: '1~3%', note: '품질 검사 후 부적합품' },
            { name: '포장재 부산물', massRatioRange: '2~8%', economicRatioRange: '<1%', note: '포장 공정 잔여물' },
        ],
        typicalRecyclingParams: {
            recycledContentRange: '0~30%',
            recyclabilityRange: '20~60%',
            qualityFactorRange: '0.5~0.8',
            note: '제품 유형에 따라 크게 다름. 금속은 높고 복합재는 낮음.'
        },
        recommendedMethod: 'physical',
        recommendedBasis: 'mass',
        methodReason: 'ISO 14044 일반 원칙에 따라 질량 기반 물리적 할당'
    },
    {
        sectorId: 'construction',
        sectorName: '건설자재',
        sectorIcon: '🏗️',
        description: '시멘트, 콘크리트, 세라믹, 유리 등',
        typicalCoProducts: [
            { name: '분진/더스트', massRatioRange: '1~5%', economicRatioRange: '<1%', note: '시멘트 공정 부산물' },
            { name: '열 (폐열)', massRatioRange: 'N/A', energyRatioRange: '5~10%', note: '소성 공정 폐열 회수' },
            { name: '재활용 골재', massRatioRange: '10~30%', economicRatioRange: '5~15%', note: '콘크리트 파쇄 후 재활용' },
        ],
        typicalRecyclingParams: {
            recycledContentRange: '5~40%',
            recyclabilityRange: '60~90%',
            qualityFactorRange: '0.6~0.9',
            note: 'EN 15804에 따라 Module D에서 별도 보고'
        },
        recommendedMethod: 'physical',
        recommendedBasis: 'mass',
        methodReason: 'EN 15804+A2에 따라 질량 기반 할당'
    }
]

// =============================================================================
// 할당 방법별 쉬운 설명
// =============================================================================

export const EASY_METHOD_DESCRIPTIONS: Record<string, {
    easyName: string
    icon: string
    oneLiner: string
    whatHappens: string
    whenToUse: string
    difficulty: 'easy' | 'medium' | 'hard'
}> = {
    subdivision: {
        easyName: '공정 분리',
        icon: '✂️',
        oneLiner: '각 제품별로 공정을 따로 분리하여 배출량을 직접 산정',
        whatHappens: '공정을 각 제품별 하위 공정으로 분리합니다. 할당 자체가 필요 없어지는 가장 이상적인 방법입니다.',
        whenToUse: '공정이 물리적으로 분리 가능한 경우 (드물지만 가장 정확)',
        difficulty: 'hard'
    },
    system_expansion: {
        easyName: '대체 효과 반영',
        icon: '🔄',
        oneLiner: '부산물이 대체하는 제품의 배출량을 차감(크레딧)',
        whatHappens: '부산물이 다른 제품을 대체한다고 보고, 대체된 제품의 배출량만큼 크레딧을 받습니다.',
        whenToUse: '부산물의 용도가 명확하고, 대체 제품의 배출계수를 알고 있을 때',
        difficulty: 'hard'
    },
    physical: {
        easyName: '물리량 비례 배분',
        icon: '⚖️',
        oneLiner: '질량·에너지 등 물리적 속성 비율로 배출량을 배분',
        whatHappens: '전체 배출량을 각 제품의 물리적 속성(질량, 에너지 등) 비율에 따라 나눕니다.',
        whenToUse: '가장 일반적인 방법. 대부분의 제조업에 적합',
        difficulty: 'easy'
    },
    economic: {
        easyName: '가격 비례 배분',
        icon: '💰',
        oneLiner: '시장 가격 비율에 따라 배출량을 배분',
        whatHappens: '전체 배출량을 각 제품의 경제적 가치(가격) 비율에 따라 나눕니다.',
        whenToUse: '물리적 데이터가 없고 가격 정보만 있을 때 (일부 PCR에서 금지)',
        difficulty: 'easy'
    }
}

export const EASY_RECYCLING_DESCRIPTIONS: Record<string, {
    easyName: string
    icon: string
    oneLiner: string
    whatHappens: string
    analogy: string // 비유를 통한 쉬운 설명
}> = {
    cut_off: {
        easyName: '각자 책임 (컷오프)',
        icon: '✋',
        oneLiner: '생산자는 생산만, 재활용은 다음 사용자 책임',
        whatHappens: '재활용에 대한 크레딧이나 부담이 없습니다. 가장 보수적이고 간단한 방법입니다.',
        analogy: '🍎 사과를 생산하면 사과 생산의 배출만 책임집니다. 남은 씨앗으로 누군가 나무를 심어도, 그건 그 사람의 시스템입니다.'
    },
    eol_recycling: {
        easyName: '재활용 장려 (EOL)',
        icon: '🌱',
        oneLiner: '제품 폐기 시 재활용을 장려하는 크레딧 부여',
        whatHappens: '폐기 시 재활용되면 크레딧을 받아 배출량이 줄어듭니다. 재활용을 장려하는 효과.',
        analogy: '🥤 페트병을 만들어 꼼꼼히 분리수거하면, 새 페트병 원료를 만들지 않아도 되므로 그만큼 이득을 인정합니다.'
    },
    fifty_fifty: {
        easyName: '반반 분담 (50:50)',
        icon: '🤝',
        oneLiner: '생산자와 다음 사용자가 부담을 절반씩 나눔',
        whatHappens: '버진 원료 부담과 재활용 크레딧을 생산자와 다음 사용자가 50%씩 나눕니다.',
        analogy: '🏠 집세를 룸메이트와 반반 나누는 것처럼, 환경 부담도 생산자와 재활용자가 반반 부담합니다.'
    },
    substitution: {
        easyName: '대체 효과 반영',
        icon: '♻️',
        oneLiner: '재활용이 버진 원료 생산을 대체한 효과를 반영',
        whatHappens: '재활용 원료가 버진 원료 생산을 대체한 만큼, 품질 감소를 고려하여 크레딧을 부여합니다.',
        analogy: '🧊 재활용 플라스틱이 새 플라스틱을 대신하면, 새 플라스틱을 만들지 않아도 되는 환경 이익을 인정합니다.'
    },
    pef_formula: {
        easyName: 'EU 공식 방법 (PEF CFF)',
        icon: '🇪🇺',
        oneLiner: 'EU 공식 순환 발자국 산식으로 정밀 계산',
        whatHappens: 'EU PEF에서 정한 공식(Circular Footprint Formula)으로 재활용, 에너지 회수, 폐기를 종합적으로 계산합니다.',
        analogy: '📊 EU가 정한 표준 수식에 모든 파라미터를 넣어 정밀하게 계산합니다. EU 시장 수출 시 필요할 수 있습니다.'
    }
}

// =============================================================================
// 할당 방법별 필요 필드 매핑
// =============================================================================

export const REQUIRED_FIELDS_BY_METHOD: Record<string, string[]> = {
    subdivision: [], // 공정 분리는 별도 데이터 입력 불필요
    system_expansion: ['mainProductName', 'mainProductMass', 'totalProcessEmission'],
    physical_mass: ['mainProductName', 'mainProductMass', 'totalProcessEmission'],
    physical_energy: ['mainProductName', 'mainProductMass', 'mainProductEnergy', 'totalProcessEmission'],
    physical_carbon: ['mainProductName', 'mainProductMass', 'mainProductCarbon', 'totalProcessEmission'],
    economic: ['mainProductName', 'mainProductMass', 'mainProductEconomic', 'totalProcessEmission'],
}

export const OPTIONAL_FIELDS_BY_METHOD: Record<string, string[]> = {
    subdivision: [],
    system_expansion: ['mainProductEnergy', 'mainProductEconomic', 'mainProductCarbon'],
    physical_mass: ['mainProductEnergy', 'mainProductEconomic', 'mainProductCarbon'],
    physical_energy: ['mainProductEconomic', 'mainProductCarbon'],
    physical_carbon: ['mainProductEnergy', 'mainProductEconomic'],
    economic: ['mainProductEnergy', 'mainProductCarbon'],
}

// 현재 할당 방법에 맞는 method key를 반환
export function getMethodKey(method: string, basis?: string): string {
    if (method === 'physical' && basis) return `physical_${basis}`
    return method
}
