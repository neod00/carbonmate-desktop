/**
 * 할당 규칙 DB (Allocation Rules Database)
 * 
 * 목적: 제품 카테고리 선택 시 제3자 검증에 통과할 수 있는 할당 방법 자동 추천
 * 
 * 근거 자료:
 * - ISO 14044:2006, ISO 14067:2018
 * - 탄소발자국 할당 방법론 보고서.txt
 * - 글로벌 PCR 할당 방법론 조사.txt
 * 
 * @version 1.0.0
 * @lastUpdated 2026-02-07
 */

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 할당 방법 유형
 */
export type AllocationMethod =
    | 'subdivision'           // 할당 회피 - 공정 세분화
    | 'system_expansion'      // 할당 회피 - 시스템 확장 (대체법)
    | 'physical_mass'         // 물리적 - 질량 기준
    | 'physical_energy'       // 물리적 - 에너지 함량 기준
    | 'physical_volume'       // 물리적 - 부피 기준
    | 'physical_carbon'       // 물리적 - 탄소 함량 기준
    | 'physical_stoichiometry'// 물리적 - 화학량론 기준
    | 'physical_cwt'          // 물리적 - 복잡도 가중 (정유)
    | 'physical_capacity'     // 물리적 - 용량 기준 (배터리)
    | 'physical_area'         // 물리적 - 면적 기준 (반도체)
    | 'economic'              // 경제적 - 가격 기준
    | 'cut_off'               // 재활용 - Cut-off (100:0)
    | 'eol_recycling'         // 재활용 - EOL (0:100)
    | 'fifty_fifty'           // 재활용 - 50:50
    | 'substitution'          // 재활용 - 대체법
    | 'pef_cff'               // 재활용 - PEF Circular Footprint Formula

/**
 * 산업군 분류
 */
export type IndustrySector =
    | 'steel_metal'           // 철강·금속
    | 'battery_ev'            // 배터리·전기차
    | 'chemical'              // 화학·석유화학
    | 'general_manufacturing' // 일반 제조업
    | 'construction'          // 건설자재
    | 'refinery'              // 정유·연료
    | 'power_energy'          // 전력·에너지
    | 'food_agriculture'      // 농축산·식품
    | 'electronics'           // 전자·반도체
    | 'textile'               // 섬유·의류

/**
 * 규제 컨텍스트
 */
export type RegulatoryContext =
    | 'EU_CBAM'               // EU 탄소국경조정
    | 'EU_BATTERY_REG'        // EU 배터리 규정
    | 'EU_ESPR'               // EU 지속가능제품 규정
    | 'EU_CSRD'               // EU 지속가능성 공시
    | 'EU_PEF'                // EU 제품환경발자국
    | 'CDP'                   // 탄소정보공개프로젝트
    | 'SBTi'                  // 과학기반감축목표
    | 'GHG_PROTOCOL'          // GHG Protocol Product Standard
    | 'APPLE_SUPPLIER'        // Apple 공급망 요구사항
    | 'MS_SUPPLIER'           // Microsoft 공급망 요구사항
    | 'CATENA_X'              // 자동차 OEM (VW, BMW 등)

/**
 * 대상 시장
 */
export type TargetMarket = 'EU' | 'US' | 'Global' | 'Korea'

// =============================================================================
// 할당 규칙 인터페이스
// =============================================================================

export interface AllocationRule {
    id: string
    version: string
    lastUpdated: string

    // === 분류 ===
    industrySector: IndustrySector
    productCategories: string[]
    productCategoriesEn: string[]
    applicableMarkets: TargetMarket[]

    // === 할당 방법 규칙 ===
    allocation: {
        multiOutput: {
            preferred: AllocationMethod
            allowed: AllocationMethod[]
            prohibited: AllocationMethod[]
            defaultBasis: string
            rationale: string
        }
        recycling: {
            preferred: AllocationMethod
            allowed: AllocationMethod[]
            pefRequired: boolean
        }
        sensitivityAnalysis: {
            required: boolean
            alternativeMethods: AllocationMethod[]
            thresholdPercent: number
        }
    }

    // === 근거 표준 ===
    references: {
        isoStandards: {
            primary: string[]
            sections?: string[]
        }
        primaryPCR: {
            name: string
            nameEn: string
            organization: string
            version?: string
            url?: string
        }
        supplementaryGuides?: {
            name: string
            organization: string
            purpose: string
        }[]
        euRegulations?: {
            type: RegulatoryContext
            name: string
            fullName: string
            relevantArticles?: string[]
            effectiveDate: string
            mandatory: boolean
            complianceNotes?: string
        }[]
        oemRequirements?: {
            type: RegulatoryContext
            company: string
            programName: string
            requirement: string
            url?: string
        }[]
        lciDatabases?: {
            name: string
            version?: string
            relevantActivities?: string[]
        }[]
    }

    // === 비교 가능성 ===
    comparability: {
        samePCRRequired: boolean
        functionalUnitMustMatch: boolean
        geographyMustMatch: boolean
        notes: string
    }

    // === 자동 생성 문구 ===
    justificationTemplates: {
        ko: {
            short: string
            detailed: string
        }
        en: {
            short: string
            detailed: string
        }
    }

    // === 검증 체크리스트 ===
    verificationChecklist: {
        item: string
        itemEn: string
        required: boolean
        reference: string
    }[]
}

// =============================================================================
// Phase 1 산업군 데이터
// =============================================================================

export const ALLOCATION_RULES_DB: AllocationRule[] = [
    // =========================================================================
    // 1. 철강·금속
    // =========================================================================
    {
        id: 'steel-metal-01',
        version: '1.0.0',
        lastUpdated: '2026-02-07',
        industrySector: 'steel_metal',
        productCategories: [
            '철강 제품', '강재', '철근', '형강', '강판', '강관',
            '알루미늄 제품', '알루미늄 합금', '알루미늄 압출품',
            '동 제품', '아연 제품', '금속 가공품'
        ],
        productCategoriesEn: [
            'Steel products', 'Steel materials', 'Rebar', 'Sections', 'Steel plates', 'Steel pipes',
            'Aluminum products', 'Aluminum alloys', 'Aluminum extrusions',
            'Copper products', 'Zinc products', 'Metal fabrications'
        ],
        applicableMarkets: ['EU', 'Global'],

        allocation: {
            multiOutput: {
                preferred: 'system_expansion',
                allowed: ['system_expansion', 'physical_mass', 'subdivision'],
                prohibited: ['economic'],
                defaultBasis: 'mass',
                rationale: 'Worldsteel LCI Methodology 및 ISO 20915에 따라 부산물(슬래그 등)에 시스템 확장 적용. 직접 할당 시 질량 기준 우선.'
            },
            recycling: {
                preferred: 'cut_off',
                allowed: ['cut_off', 'substitution', 'pef_cff'],
                pefRequired: false
            },
            sensitivityAnalysis: {
                required: true,
                alternativeMethods: ['physical_mass', 'system_expansion'],
                thresholdPercent: 10
            }
        },

        references: {
            isoStandards: {
                primary: ['ISO 14044:2006', 'ISO 14067:2018', 'ISO 20915:2018'],
                sections: ['4.3.4.2', '6.4.6']
            },
            primaryPCR: {
                name: 'Worldsteel LCI Methodology',
                nameEn: 'Worldsteel LCI Methodology',
                organization: 'World Steel Association',
                version: '2023',
                url: 'https://worldsteel.org/steel-topics/sustainability/lci/'
            },
            supplementaryGuides: [
                { name: 'EN 19694 (산업배출 측정)', organization: 'CEN', purpose: '직접 배출 측정 방법' },
                { name: 'EUROFER Physical Partitioning', organization: 'EUROFER', purpose: '물리적 분할 대안' }
            ],
            euRegulations: [
                {
                    type: 'EU_CBAM',
                    name: 'EU CBAM',
                    fullName: 'Carbon Border Adjustment Mechanism (EU) 2023/956',
                    relevantArticles: ['Article 7 - Embedded Emissions'],
                    effectiveDate: '2026-01-01',
                    mandatory: true,
                    complianceNotes: 'EU 수출 철강 제품은 CBAM 신고 필수. 시스템 확장 크레딧은 CBAM에서 제한적 인정.'
                }
            ],
            oemRequirements: [
                {
                    type: 'CATENA_X',
                    company: 'Volkswagen, BMW 등',
                    programName: 'Catena-X PCF Rulebook',
                    requirement: '자동차 공급망 철강 부품 PCF 제출 요구'
                },
                {
                    type: 'APPLE_SUPPLIER',
                    company: 'Apple',
                    programName: 'Supplier Clean Energy Program',
                    requirement: '금속 부품 공급사 탄소발자국 투명성 요구'
                }
            ],
            lciDatabases: [
                { name: 'Ecoinvent', version: '3.9.1', relevantActivities: ['steel production, converter', 'steel production, electric'] },
                { name: 'Worldsteel', version: '2023', relevantActivities: ['Hot rolled coil', 'Steel sections'] }
            ]
        },

        comparability: {
            samePCRRequired: true,
            functionalUnitMustMatch: true,
            geographyMustMatch: false,
            notes: '동일 PCR(Worldsteel) 내에서만 결과 비교 유효. CBAM 신고 시 EU 방법론 준수 확인 필요.'
        },

        justificationTemplates: {
            ko: {
                short: 'ISO 20915 및 Worldsteel LCI Methodology에 따라 물리적 할당(질량 기준) 적용.',
                detailed: `ISO 14044:2006 4.3.4.2 및 ISO 20915:2018에 따라 다중 출력 공정의 환경 부하를 배분하였습니다. 
철강 생산 과정에서 발생하는 부산물(슬래그, 부생가스 등)에 대해서는 Worldsteel LCI Methodology에서 권장하는 시스템 확장 방식을 우선 적용하였습니다. 
슬래그의 시멘트 대체 효과 등 회피된 배출량을 크레딧으로 반영하였으며, 이는 국제 철강협회의 오랜 논의를 거쳐 확립된 산업 표준 방법론입니다.
직접 할당이 필요한 공정에는 질량 기준 물리적 할당을 적용하였으며, 경제적 할당은 가격 변동성으로 인해 적용하지 않았습니다(EN 15804 권고사항).`
            },
            en: {
                short: 'Physical allocation (mass basis) applied per ISO 20915 and Worldsteel LCI Methodology.',
                detailed: `Environmental burdens from multi-output processes were allocated in accordance with ISO 14044:2006 Section 4.3.4.2 and ISO 20915:2018.
For by-products from steel production (slag, off-gases, etc.), the system expansion approach recommended by the Worldsteel LCI Methodology was applied as the preferred method.
Avoided emissions from slag substitution in cement production were credited to the steel product. This methodology represents an industry-standard approach established through extensive stakeholder consultation.
Where direct allocation was necessary, mass-based physical allocation was applied. Economic allocation was excluded due to price volatility concerns (per EN 15804 recommendations).`
            }
        },

        verificationChecklist: [
            { item: '할당 방법 선택 근거 문서화', itemEn: 'Allocation method selection documented', required: true, reference: 'ISO 14044 4.3.4' },
            { item: '부산물 처리 방식 명시', itemEn: 'By-product treatment specified', required: true, reference: 'Worldsteel Methodology' },
            { item: 'CBAM 대상 여부 확인', itemEn: 'CBAM applicability confirmed', required: true, reference: 'EU CBAM Article 7' },
            { item: '민감도 분석 수행', itemEn: 'Sensitivity analysis performed', required: true, reference: 'ISO 14044 4.3.4.3' }
        ]
    },

    // =========================================================================
    // 2. 배터리·전기차
    // =========================================================================
    {
        id: 'battery-ev-01',
        version: '1.0.0',
        lastUpdated: '2026-02-07',
        industrySector: 'battery_ev',
        productCategories: [
            '리튬이온 배터리', '배터리 셀', '배터리 모듈', '배터리 팩',
            'EV 배터리', 'ESS 배터리', '전기차 부품'
        ],
        productCategoriesEn: [
            'Lithium-ion battery', 'Battery cell', 'Battery module', 'Battery pack',
            'EV battery', 'ESS battery', 'Electric vehicle components'
        ],
        applicableMarkets: ['EU', 'Global'],

        allocation: {
            multiOutput: {
                preferred: 'physical_capacity',
                allowed: ['physical_capacity', 'physical_mass', 'subdivision'],
                prohibited: ['economic'],
                defaultBasis: 'capacity (kWh)',
                rationale: 'EU Battery Regulation Annex II에 따라 배터리 용량(kWh) 기준 할당 우선. 동일 형태 셀은 개수 기준.'
            },
            recycling: {
                preferred: 'pef_cff',
                allowed: ['pef_cff', 'cut_off'],
                pefRequired: true
            },
            sensitivityAnalysis: {
                required: true,
                alternativeMethods: ['physical_mass', 'physical_capacity'],
                thresholdPercent: 10
            }
        },

        references: {
            isoStandards: {
                primary: ['ISO 14044:2006', 'ISO 14067:2018'],
                sections: ['4.3.4.2', '6.4.6']
            },
            primaryPCR: {
                name: 'EU PEFCR Rechargeable Batteries',
                nameEn: 'EU PEFCR Rechargeable Batteries',
                organization: 'European Commission',
                version: '2024',
                url: 'https://ec.europa.eu/environment/eussd/smgp/PEFCR_OEFSR_en.htm'
            },
            supplementaryGuides: [
                { name: 'EU Battery Regulation Annex II', organization: 'European Commission', purpose: '탄소발자국 산정 규칙' },
                { name: 'GBA Battery Passport', organization: 'Global Battery Alliance', purpose: '배터리 여권 데이터 요구사항' }
            ],
            euRegulations: [
                {
                    type: 'EU_BATTERY_REG',
                    name: 'EU Battery Regulation',
                    fullName: 'Regulation (EU) 2023/1542',
                    relevantArticles: ['Article 7 - Carbon Footprint', 'Annex II - CFP Rules'],
                    effectiveDate: '2025-02-18',
                    mandatory: true,
                    complianceNotes: 'EV/산업용 배터리 탄소발자국 신고 의무. PEF CFF 방법론 적용 필수.'
                }
            ],
            oemRequirements: [
                {
                    type: 'CATENA_X',
                    company: 'Volkswagen, BMW, Mercedes-Benz',
                    programName: 'Catena-X PCF Rulebook',
                    requirement: '배터리 공급망 PCF 데이터 교환'
                },
                {
                    type: 'APPLE_SUPPLIER',
                    company: 'Apple',
                    programName: 'Clean Energy Charging',
                    requirement: '소비자 전자제품 배터리 탄소발자국 공개'
                }
            ],
            lciDatabases: [
                { name: 'Ecoinvent', version: '3.9.1', relevantActivities: ['battery cell production, Li-ion'] },
                { name: 'GREET', version: '2023', relevantActivities: ['Li-ion battery manufacturing'] }
            ]
        },

        comparability: {
            samePCRRequired: true,
            functionalUnitMustMatch: true,
            geographyMustMatch: false,
            notes: 'EU 배터리 규정에 따라 동일 PEFCR 적용 제품만 비교 가능. 기능단위: 1kWh 배터리 용량.'
        },

        justificationTemplates: {
            ko: {
                short: 'EU Battery Regulation Annex II에 따라 배터리 용량(kWh) 기준 물리적 할당 적용.',
                detailed: `EU Battery Regulation (EU) 2023/1542 Annex II에서 규정하는 탄소발자국 산정 방법론에 따라 할당을 수행하였습니다.
다중 배터리 제품을 생산하는 공정에서는 각 제품의 정격 에너지 용량(kWh)을 기준으로 제조 에너지 및 배출량을 배분하였습니다.
동일 규격 셀의 경우 생산 개수 기준 균등 배분을 적용하였습니다.
재활용 원료 및 폐기 단계에는 EU PEF의 Circular Footprint Formula(CFF)를 적용하였으며, 이는 EU 배터리 규정 준수를 위한 필수 요구사항입니다.`
            },
            en: {
                short: 'Physical allocation based on battery capacity (kWh) per EU Battery Regulation Annex II.',
                detailed: `Allocation was performed in accordance with the carbon footprint calculation rules specified in EU Battery Regulation (EU) 2023/1542 Annex II.
For multi-product battery manufacturing processes, manufacturing energy and emissions were allocated based on the rated energy capacity (kWh) of each product.
For identical cell specifications, equal allocation by production quantity was applied.
The EU PEF Circular Footprint Formula (CFF) was applied for recycled content and end-of-life stages, as required for EU Battery Regulation compliance.`
            }
        },

        verificationChecklist: [
            { item: '기능단위: 1kWh 배터리 용량', itemEn: 'Functional unit: 1kWh battery capacity', required: true, reference: 'PEFCR Batteries' },
            { item: 'PEF CFF 적용 여부', itemEn: 'PEF CFF application', required: true, reference: 'EU Battery Reg Annex II' },
            { item: '재활용 함량 비율 문서화', itemEn: 'Recycled content documented', required: true, reference: 'EU Battery Reg Article 8' },
            { item: '공급망 추적성', itemEn: 'Supply chain traceability', required: true, reference: 'Battery Passport' }
        ]
    },

    // =========================================================================
    // 3. 화학·석유화학
    // =========================================================================
    {
        id: 'chemical-01',
        version: '1.0.0',
        lastUpdated: '2026-02-07',
        industrySector: 'chemical',
        productCategories: [
            '플라스틱 원료', '폴리에틸렌(PE)', '폴리프로필렌(PP)', 'PVC', 'PET',
            '화학 중간체', '에틸렌', '프로필렌', '벤젠', '톨루엔',
            '접착제', '도료', '코팅제', '계면활성제'
        ],
        productCategoriesEn: [
            'Plastic resins', 'Polyethylene (PE)', 'Polypropylene (PP)', 'PVC', 'PET',
            'Chemical intermediates', 'Ethylene', 'Propylene', 'Benzene', 'Toluene',
            'Adhesives', 'Paints', 'Coatings', 'Surfactants'
        ],
        applicableMarkets: ['EU', 'US', 'Global'],

        allocation: {
            multiOutput: {
                preferred: 'physical_mass',
                allowed: ['physical_mass', 'physical_stoichiometry', 'physical_carbon', 'subdivision'],
                prohibited: ['economic'],
                defaultBasis: 'mass',
                rationale: 'TfS PCF Guideline 3.0 및 PlasticsEurope에 따라 질량 기준 물리적 할당. 화학량론 또는 탄소 함량도 허용.'
            },
            recycling: {
                preferred: 'cut_off',
                allowed: ['cut_off', 'pef_cff'],
                pefRequired: false
            },
            sensitivityAnalysis: {
                required: true,
                alternativeMethods: ['physical_mass', 'physical_energy'],
                thresholdPercent: 15
            }
        },

        references: {
            isoStandards: {
                primary: ['ISO 14044:2006', 'ISO 14067:2018'],
                sections: ['4.3.4.2', '6.4.6']
            },
            primaryPCR: {
                name: 'TfS PCF Guideline',
                nameEn: 'Together for Sustainability PCF Guideline',
                organization: 'Together for Sustainability (TfS)',
                version: '3.0 (2024)',
                url: 'https://tfs-initiative.com/pcf-guideline/'
            },
            supplementaryGuides: [
                { name: 'PlasticsEurope Eco-profiles', organization: 'PlasticsEurope', purpose: '플라스틱 원료 LCI 데이터' },
                { name: 'CEFIC Sector Guide', organization: 'CEFIC', purpose: '화학 산업 LCA 가이드' }
            ],
            euRegulations: [
                {
                    type: 'EU_PEF',
                    name: 'EU PEFCR Chemicals',
                    fullName: 'Product Environmental Footprint Category Rules for Basic Chemicals',
                    effectiveDate: '2023-01-01',
                    mandatory: false,
                    complianceNotes: 'EU 환경 클레임 시 PEF 방법론 권장'
                }
            ],
            oemRequirements: [
                {
                    type: 'APPLE_SUPPLIER',
                    company: 'Apple',
                    programName: 'Material Chemistry',
                    requirement: '화학 원료 공급사 환경 영향 데이터 요구'
                },
                {
                    type: 'MS_SUPPLIER',
                    company: 'Microsoft',
                    programName: 'Supplier Code of Conduct',
                    requirement: '화학물질 및 탄소발자국 투명성'
                }
            ],
            lciDatabases: [
                { name: 'Ecoinvent', version: '3.9.1', relevantActivities: ['polyethylene production', 'polypropylene production'] },
                { name: 'PlasticsEurope', version: '2022', relevantActivities: ['Steam cracker products'] }
            ]
        },

        comparability: {
            samePCRRequired: true,
            functionalUnitMustMatch: true,
            geographyMustMatch: false,
            notes: 'TfS Guideline 준수 제품 간 비교 가능. 경제적 할당 결과는 비교 불가.'
        },

        justificationTemplates: {
            ko: {
                short: 'TfS PCF Guideline 3.0에 따라 질량 기준 물리적 할당 적용.',
                detailed: `Together for Sustainability (TfS) PCF Guideline Version 3.0에 따라 화학 공정의 다중 출력물에 대한 할당을 수행하였습니다.
증기 분해(Steam Cracking) 등 다수의 제품이 동시에 생산되는 공정에서는 에틸렌, 프로필렌 등을 주요 제품(Main Products)으로 정의하고, 
해당 제품들의 질량 비율에 따라 공정 에너지와 배출량을 배분하였습니다.
이는 PlasticsEurope의 Eco-profile 방법론과도 일치하며, 시장 가격 변동의 영향을 받지 않는 일관된 결과를 보장합니다.
경제적 할당은 화학 제품의 가격 변동성이 크므로 적용하지 않았습니다(TfS Guideline 권고사항).`
            },
            en: {
                short: 'Mass-based physical allocation per TfS PCF Guideline 3.0.',
                detailed: `Allocation for multi-output chemical processes was performed in accordance with the Together for Sustainability (TfS) PCF Guideline Version 3.0.
For steam cracking and similar multi-product processes, ethylene, propylene, and other major outputs are defined as Main Products.
Process energy and emissions were allocated based on the mass ratio of these products.
This approach is consistent with the PlasticsEurope Eco-profile methodology and ensures consistent results unaffected by market price fluctuations.
Economic allocation was excluded due to the high price volatility of chemical products (per TfS Guideline recommendations).`
            }
        },

        verificationChecklist: [
            { item: 'TfS Guideline 준수 확인', itemEn: 'TfS Guideline compliance verified', required: true, reference: 'TfS 3.0' },
            { item: '주요 제품/부산물 구분', itemEn: 'Main products vs by-products defined', required: true, reference: 'PlasticsEurope' },
            { item: '할당 기준값 문서화', itemEn: 'Allocation basis values documented', required: true, reference: 'ISO 14044 4.3.4' },
            { item: '민감도 분석 포함', itemEn: 'Sensitivity analysis included', required: true, reference: 'ISO 14044 4.3.4.3' }
        ]
    },

    // =========================================================================
    // 4. 일반 제조업
    // =========================================================================
    {
        id: 'general-manufacturing-01',
        version: '1.0.0',
        lastUpdated: '2026-02-07',
        industrySector: 'general_manufacturing',
        productCategories: [
            '기계 부품', '자동차 부품', '전자 부품', '가전제품',
            '조립 제품', '금속 가공품', '플라스틱 사출품', '고무 제품'
        ],
        productCategoriesEn: [
            'Machine parts', 'Automotive parts', 'Electronic components', 'Home appliances',
            'Assembled products', 'Metal fabrications', 'Plastic injection moldings', 'Rubber products'
        ],
        applicableMarkets: ['EU', 'US', 'Global', 'Korea'],

        allocation: {
            multiOutput: {
                preferred: 'physical_mass',
                allowed: ['physical_mass', 'physical_energy', 'subdivision'],
                prohibited: [],
                defaultBasis: 'mass',
                rationale: 'ISO 14044 기본 원칙에 따라 물리적 할당(질량) 우선. 에너지 집약 공정은 에너지 기준 허용.'
            },
            recycling: {
                preferred: 'cut_off',
                allowed: ['cut_off', 'fifty_fifty', 'substitution'],
                pefRequired: false
            },
            sensitivityAnalysis: {
                required: false,
                alternativeMethods: ['physical_mass', 'physical_energy', 'economic'],
                thresholdPercent: 20
            }
        },

        references: {
            isoStandards: {
                primary: ['ISO 14044:2006', 'ISO 14067:2018'],
                sections: ['4.3.4.2', '6.4.6']
            },
            primaryPCR: {
                name: 'ISO 14044 일반 원칙',
                nameEn: 'ISO 14044 General Principles',
                organization: 'ISO',
                version: '2006',
                url: 'https://www.iso.org/standard/38498.html'
            },
            supplementaryGuides: [
                { name: 'GHG Protocol Product Standard', organization: 'WRI/WBCSD', purpose: 'Scope 3 제품 탄소발자국' },
                { name: 'ISO 14067 Guidance', organization: 'ISO', purpose: 'CFP 특화 요구사항' }
            ],
            oemRequirements: [
                {
                    type: 'APPLE_SUPPLIER',
                    company: 'Apple',
                    programName: 'Supplier Responsibility',
                    requirement: '공급망 제품 탄소발자국 투명성'
                },
                {
                    type: 'MS_SUPPLIER',
                    company: 'Microsoft',
                    programName: 'Carbon Negative Initiative',
                    requirement: '공급사 Scope 3 배출량 보고'
                },
                {
                    type: 'CATENA_X',
                    company: 'Automotive OEMs',
                    programName: 'Supply Chain PCF',
                    requirement: '자동차 부품 PCF 데이터 교환'
                }
            ],
            lciDatabases: [
                { name: 'Ecoinvent', version: '3.9.1' },
                { name: '국가 LCI DB', version: '2023' }
            ]
        },

        comparability: {
            samePCRRequired: false,
            functionalUnitMustMatch: true,
            geographyMustMatch: false,
            notes: '동일 기능단위, 동일 할당 방법 적용 시 비교 가능. 경제적 할당 결과는 비교에 주의 필요.'
        },

        justificationTemplates: {
            ko: {
                short: 'ISO 14044:2006에 따라 질량 기준 물리적 할당 적용.',
                detailed: `ISO 14044:2006 Section 4.3.4.2에 규정된 할당 위계에 따라 다중 출력 공정의 환경 부하를 배분하였습니다.
먼저 공정 세분화를 통한 할당 회피를 검토하였으나, 공용 설비로 인해 완전한 분리가 불가능하여 물리적 할당을 적용하였습니다.
투입 원료와 제품 간 명확한 물질적 관계가 존재하므로 질량 기준 물리적 할당을 우선 적용하였습니다.
재활용 원료에 대해서는 데이터 확보 용이성과 보수적 접근을 위해 Cut-off 방법을 적용하였습니다.`
            },
            en: {
                short: 'Mass-based physical allocation per ISO 14044:2006.',
                detailed: `Environmental burdens from multi-output processes were allocated following the allocation hierarchy specified in ISO 14044:2006 Section 4.3.4.2.
Process subdivision for allocation avoidance was first considered, but complete separation was not possible due to shared facilities.
Mass-based physical allocation was applied as the preferred method, given the clear physical relationship between input materials and products.
For recycled content, the cut-off method was applied for data availability and conservative approach.`
            }
        },

        verificationChecklist: [
            { item: 'ISO 14044 할당 위계 준수', itemEn: 'ISO 14044 allocation hierarchy followed', required: true, reference: 'ISO 14044 4.3.4' },
            { item: '공정 세분화 검토 여부', itemEn: 'Process subdivision considered', required: true, reference: 'ISO 14044 4.3.4.1' },
            { item: '할당 방법 선택 정당화', itemEn: 'Allocation method justified', required: true, reference: 'ISO 14044 4.3.4' }
        ]
    },

    // =========================================================================
    // 5. 건설자재
    // =========================================================================
    {
        id: 'construction-01',
        version: '1.0.0',
        lastUpdated: '2026-02-07',
        industrySector: 'construction',
        productCategories: [
            '시멘트', '콘크리트', '레미콘', '골재', '석재',
            '단열재', '유리', '창호', '철근', '구조용 강재'
        ],
        productCategoriesEn: [
            'Cement', 'Concrete', 'Ready-mixed concrete', 'Aggregates', 'Stone',
            'Insulation materials', 'Glass', 'Windows', 'Rebar', 'Structural steel'
        ],
        applicableMarkets: ['EU', 'Global', 'Korea'],

        allocation: {
            multiOutput: {
                preferred: 'physical_mass',
                allowed: ['physical_mass', 'subdivision'],
                prohibited: ['economic'],
                defaultBasis: 'mass',
                rationale: 'EN 15804에 따라 질량 기준 물리적 할당. 경제적 할당은 최후의 수단으로만 고려.'
            },
            recycling: {
                preferred: 'cut_off',
                allowed: ['cut_off'],
                pefRequired: false
            },
            sensitivityAnalysis: {
                required: false,
                alternativeMethods: ['physical_mass'],
                thresholdPercent: 10
            }
        },

        references: {
            isoStandards: {
                primary: ['ISO 14044:2006', 'ISO 14067:2018', 'ISO 21930:2017'],
                sections: ['4.3.4.2', '6.4.6']
            },
            primaryPCR: {
                name: 'EN 15804+A2',
                nameEn: 'EN 15804+A2 Sustainability of construction works',
                organization: 'CEN',
                version: '2019+A2:2019',
                url: 'https://www.cen.eu/'
            },
            supplementaryGuides: [
                { name: 'CEN/TR 16970', organization: 'CEN', purpose: 'Module D 계산 방법' },
                { name: 'EPD International PCR', organization: 'EPD International', purpose: '국제 EPD 요구사항' }
            ],
            euRegulations: [
                {
                    type: 'EU_ESPR',
                    name: 'ESPR (Construction Products)',
                    fullName: 'Ecodesign for Sustainable Products Regulation',
                    effectiveDate: '2025-01-01',
                    mandatory: false,
                    complianceNotes: '향후 건설자재 디지털 제품 여권에 환경 정보 포함 예정'
                }
            ],
            lciDatabases: [
                { name: 'Ecoinvent', version: '3.9.1', relevantActivities: ['cement production', 'concrete production'] },
                { name: 'ÖKOBAUDAT', version: '2023', relevantActivities: ['German construction materials'] }
            ]
        },

        comparability: {
            samePCRRequired: true,
            functionalUnitMustMatch: true,
            geographyMustMatch: false,
            notes: 'EN 15804 준수 EPD 간에만 비교 가능. Module D 결과는 별도 표시.'
        },

        justificationTemplates: {
            ko: {
                short: 'EN 15804+A2에 따라 질량 기준 물리적 할당 및 Module D 별도 보고.',
                detailed: `EN 15804+A2:2019 (건설제품 환경성적표지 규격)에 따라 할당을 수행하였습니다.
생산 단계(A1-A3)에서 발생하는 공동 제품의 환경 부하는 질량 비율로 배분하였습니다.
재활용 부산물(스크랩 등)에 대해서는 Cut-off 접근법을 적용하여 시스템 경계에서 제외하였으며,
해당 부산물의 재활용으로 인한 회피 효과는 Module D에 별도로 보고하였습니다.
이는 EN 15804에서 규정하는 "시스템 경계 밖 편익 및 부담" 처리 방법을 따른 것입니다.`
            },
            en: {
                short: 'Mass-based physical allocation with Module D reporting per EN 15804+A2.',
                detailed: `Allocation was performed in accordance with EN 15804+A2:2019 (Sustainability of construction works - EPD core rules).
Environmental loads from co-products in the production stage (A1-A3) were allocated by mass ratio.
The cut-off approach was applied to recyclable by-products (scrap, etc.), excluding them from the system boundary.
Avoided burdens from recycling these by-products are reported separately in Module D.
This follows the EN 15804 methodology for "Benefits and loads beyond the system boundary".`
            }
        },

        verificationChecklist: [
            { item: 'EN 15804 준수 확인', itemEn: 'EN 15804 compliance verified', required: true, reference: 'EN 15804+A2' },
            { item: 'Module A1-A3 범위 정의', itemEn: 'Module A1-A3 scope defined', required: true, reference: 'EN 15804' },
            { item: 'Module D 별도 보고', itemEn: 'Module D reported separately', required: true, reference: 'EN 15804 6.4.3' },
            { item: '재활용 부산물 처리 방식', itemEn: 'Recyclable by-product treatment', required: true, reference: 'EN 15804 6.4.3' }
        ]
    }
]

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 산업군별 규칙 조회
 */
export const getRulesBySector = (sector: IndustrySector): AllocationRule[] => {
    return ALLOCATION_RULES_DB.filter(rule => rule.industrySector === sector)
}

/**
 * 규제 컨텍스트별 규칙 조회
 */
export const getRulesByRegulation = (regulation: RegulatoryContext): AllocationRule[] => {
    return ALLOCATION_RULES_DB.filter(rule =>
        rule.references.euRegulations?.some(r => r.type === regulation) ||
        rule.references.oemRequirements?.some(r => r.type === regulation)
    )
}

/**
 * 제품 카테고리로 규칙 검색
 */
export const findRuleByProductCategory = (category: string): AllocationRule | undefined => {
    const normalizedCategory = category.toLowerCase().trim()
    return ALLOCATION_RULES_DB.find(rule =>
        rule.productCategories.some(c => c.toLowerCase().includes(normalizedCategory)) ||
        rule.productCategoriesEn.some(c => c.toLowerCase().includes(normalizedCategory))
    )
}

/**
 * 모든 산업군 목록 조회
 */
export const getAllSectors = (): IndustrySector[] => {
    return Array.from(new Set(ALLOCATION_RULES_DB.map(rule => rule.industrySector)))
}

/**
 * 모든 제품 카테고리 목록 조회
 */
export const getAllProductCategories = (): { sector: IndustrySector, categories: string[] }[] => {
    return ALLOCATION_RULES_DB.map(rule => ({
        sector: rule.industrySector,
        categories: rule.productCategories
    }))
}
