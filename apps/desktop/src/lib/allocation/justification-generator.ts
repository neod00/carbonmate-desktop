/**
 * 정당화 문구 생성기 (Justification Generator)
 * 
 * 목적: 할당 방법 선택에 대한 ISO/PCR 근거 기반 정당화 문구 자동 생성
 * 
 * @version 1.0.0
 */

import { AllocationRule, AllocationMethod } from './allocation-rules-db'

// =============================================================================
// 타입 정의
// =============================================================================

export interface JustificationSection {
    title: string
    content: string
}

export interface FullJustification {
    summary: string
    sections: JustificationSection[]
    references: string[]
    checklistItems: string[]
}

export interface JustificationOutput {
    ko: FullJustification
    en: FullJustification
    markdown: {
        ko: string
        en: string
    }
}

// =============================================================================
// 정당화 문구 생성
// =============================================================================

/**
 * 할당 규칙에 대한 전체 정당화 문구 생성
 */
export const generateJustification = (
    rule: AllocationRule,
    language: 'ko' | 'en' = 'ko'
): FullJustification => {
    const template = rule.justificationTemplates[language]

    const sections: JustificationSection[] = [
        {
            title: language === 'ko' ? '할당 방법 선택 근거' : 'Allocation Method Selection Rationale',
            content: template.detailed
        },
        {
            title: language === 'ko' ? '적용 표준' : 'Applied Standards',
            content: generateStandardsSection(rule, language)
        }
    ]

    // EU 규제 섹션 추가
    if (rule.references.euRegulations && rule.references.euRegulations.length > 0) {
        sections.push({
            title: language === 'ko' ? 'EU 규제 준수' : 'EU Regulatory Compliance',
            content: generateEuComplianceSection(rule, language)
        })
    }

    // OEM 요구사항 섹션 추가
    if (rule.references.oemRequirements && rule.references.oemRequirements.length > 0) {
        sections.push({
            title: language === 'ko' ? '글로벌 OEM 요구사항' : 'Global OEM Requirements',
            content: generateOemSection(rule, language)
        })
    }

    // 참고문헌 목록
    const references = generateReferenceList(rule)

    // 검증 체크리스트
    const checklistItems = rule.verificationChecklist.map(item =>
        language === 'ko' ? item.item : item.itemEn
    )

    return {
        summary: template.short,
        sections,
        references,
        checklistItems
    }
}

/**
 * 마크다운 형식 정당화 문구 생성
 */
export const generateJustificationMarkdown = (
    rule: AllocationRule,
    productName: string
): JustificationOutput => {
    const justKo = generateJustification(rule, 'ko')
    const justEn = generateJustification(rule, 'en')

    return {
        ko: justKo,
        en: justEn,
        markdown: {
            ko: formatAsMarkdown(justKo, productName, 'ko'),
            en: formatAsMarkdown(justEn, productName, 'en')
        }
    }
}

// =============================================================================
// 헬퍼 함수
// =============================================================================

function generateStandardsSection(rule: AllocationRule, language: 'ko' | 'en'): string {
    const lines: string[] = []

    // ISO 표준
    const isoLabel = language === 'ko' ? 'ISO 표준' : 'ISO Standards'
    lines.push(`**${isoLabel}:** ${rule.references.isoStandards.primary.join(', ')}`)

    if (rule.references.isoStandards.sections) {
        const sectionLabel = language === 'ko' ? '관련 조항' : 'Relevant Sections'
        lines.push(`${sectionLabel}: ${rule.references.isoStandards.sections.join(', ')}`)
    }

    // 주요 PCR
    const pcrLabel = language === 'ko' ? '주요 PCR' : 'Primary PCR'
    const pcrName = language === 'ko' ? rule.references.primaryPCR.name : rule.references.primaryPCR.nameEn
    lines.push(`\n**${pcrLabel}:** ${pcrName}`)
    lines.push(`- ${language === 'ko' ? '발행 기관' : 'Organization'}: ${rule.references.primaryPCR.organization}`)
    if (rule.references.primaryPCR.version) {
        lines.push(`- ${language === 'ko' ? '버전' : 'Version'}: ${rule.references.primaryPCR.version}`)
    }

    // 보조 가이드
    if (rule.references.supplementaryGuides && rule.references.supplementaryGuides.length > 0) {
        const suppLabel = language === 'ko' ? '보조 가이드' : 'Supplementary Guides'
        lines.push(`\n**${suppLabel}:**`)
        rule.references.supplementaryGuides.forEach(guide => {
            lines.push(`- ${guide.name} (${guide.organization})`)
        })
    }

    return lines.join('\n')
}

function generateEuComplianceSection(rule: AllocationRule, language: 'ko' | 'en'): string {
    const lines: string[] = []

    rule.references.euRegulations?.forEach(reg => {
        lines.push(`**${reg.name}**`)
        lines.push(`- ${language === 'ko' ? '정식 명칭' : 'Full Name'}: ${reg.fullName}`)
        lines.push(`- ${language === 'ko' ? '시행일' : 'Effective Date'}: ${reg.effectiveDate}`)
        lines.push(`- ${language === 'ko' ? '필수 여부' : 'Mandatory'}: ${reg.mandatory ? (language === 'ko' ? '필수' : 'Yes') : (language === 'ko' ? '권장' : 'Recommended')}`)
        if (reg.complianceNotes) {
            lines.push(`- ${language === 'ko' ? '준수 사항' : 'Compliance Notes'}: ${reg.complianceNotes}`)
        }
        lines.push('')
    })

    return lines.join('\n')
}

function generateOemSection(rule: AllocationRule, language: 'ko' | 'en'): string {
    const lines: string[] = []

    rule.references.oemRequirements?.forEach(oem => {
        lines.push(`**${oem.company}** - ${oem.programName}`)
        lines.push(`- ${language === 'ko' ? '요구사항' : 'Requirement'}: ${oem.requirement}`)
        lines.push('')
    })

    return lines.join('\n')
}

function generateReferenceList(rule: AllocationRule): string[] {
    const refs: string[] = []

    // ISO 표준
    rule.references.isoStandards.primary.forEach(std => refs.push(std))

    // 주요 PCR
    refs.push(`${rule.references.primaryPCR.name} (${rule.references.primaryPCR.organization})`)

    // 보조 가이드
    rule.references.supplementaryGuides?.forEach(guide => {
        refs.push(`${guide.name} (${guide.organization})`)
    })

    // EU 규제
    rule.references.euRegulations?.forEach(reg => {
        refs.push(reg.fullName)
    })

    return refs
}

function formatAsMarkdown(
    justification: FullJustification,
    productName: string,
    language: 'ko' | 'en'
): string {
    const title = language === 'ko'
        ? `## 할당 방법 정당화: ${productName}`
        : `## Allocation Method Justification: ${productName}`

    const summaryLabel = language === 'ko' ? '### 요약' : '### Summary'

    let md = `${title}\n\n${summaryLabel}\n${justification.summary}\n\n`

    // 섹션들
    justification.sections.forEach(section => {
        md += `### ${section.title}\n${section.content}\n\n`
    })

    // 참고문헌
    const refLabel = language === 'ko' ? '### 참고문헌' : '### References'
    md += `${refLabel}\n`
    justification.references.forEach((ref, i) => {
        md += `${i + 1}. ${ref}\n`
    })
    md += '\n'

    // 검증 체크리스트
    const checkLabel = language === 'ko' ? '### 검증 체크리스트' : '### Verification Checklist'
    md += `${checkLabel}\n`
    justification.checklistItems.forEach(item => {
        md += `- [ ] ${item}\n`
    })

    return md
}

/**
 * 보고서용 간단 정당화 문구 생성
 */
export const generateShortJustification = (
    rule: AllocationRule,
    language: 'ko' | 'en' = 'ko'
): string => {
    return rule.justificationTemplates[language].short
}

/**
 * P1-9 회귀 수정: 실제 선택된 할당 방법(multiOutput / recycling)에 맞는 정당화 문구 생성.
 * 룰의 기본 템플릿(multiOutput 기준)이 아닌, 사용자의 실제 선택에 따른 문구를 반환.
 */
export const generateJustificationForMethod = (
    methodKind: 'multiOutput' | 'recycling',
    method: string,
    language: 'ko' | 'en' = 'ko'
): string => {
    if (language === 'ko') {
        if (methodKind === 'multiOutput') {
            switch (method) {
                case 'subdivision':
                    return 'ISO 14044:2006 4.3.4.2에 따라 공정 세분화로 할당을 회피.'
                case 'physical_mass':
                    return 'ISO 14044:2006에 따라 질량 기준 물리적 할당 적용.'
                case 'physical_energy':
                    return 'ISO 14044:2006에 따라 에너지 함량 기준 물리적 할당 적용.'
                case 'physical_volume':
                    return 'ISO 14044:2006에 따라 부피 기준 물리적 할당 적용.'
                case 'economic':
                    return 'ISO 14044:2006에 따라 경제적 가치 기준 할당 적용.'
                case 'system_expansion':
                    return 'ISO 14044:2006에 따라 시스템 확장(System Expansion)으로 할당을 회피.'
                default:
                    return `ISO 14044:2006에 따라 ${method} 방법 적용.`
            }
        } else {
            // recycling
            switch (method) {
                case 'cut_off':
                    return 'Cut-off (100:0) 방법 적용 - 재활용 원료의 부담을 입고 시점 0으로 처리. ISO 14044 5.3.5 배분 우선순위 ① 회피 원칙에 부합.'
                case 'substitution':
                    return '대체(Substitution) 방법 적용 - 재활용 출력의 잠재 가치를 시스템 확장으로 반영.'
                case 'fifty_fifty':
                    return '50:50 방법 적용 - 재활용 부담을 발생자와 수용자 간 균등 배분.'
                case 'pef_cff':
                    return 'PEF Circular Footprint Formula 적용 - EU PEF 가이드 기반 재활용 할당.'
                case 'closed_loop':
                    return 'Closed-loop 방법 적용 - 동일 품질 재활용 가정 하에 1차 자원 배출과 등가 처리.'
                default:
                    return `재활용 할당: ${method} 방법 적용.`
            }
        }
    } else {
        // English
        if (methodKind === 'multiOutput') {
            switch (method) {
                case 'subdivision': return 'Allocation avoided via process subdivision per ISO 14044:2006 4.3.4.2.'
                case 'physical_mass': return 'Mass-based physical allocation per ISO 14044:2006.'
                case 'physical_energy': return 'Energy-content-based physical allocation per ISO 14044:2006.'
                case 'physical_volume': return 'Volume-based physical allocation per ISO 14044:2006.'
                case 'economic': return 'Economic value-based allocation per ISO 14044:2006.'
                case 'system_expansion': return 'Allocation avoided via system expansion per ISO 14044:2006.'
                default: return `Allocation method ${method} applied per ISO 14044:2006.`
            }
        } else {
            switch (method) {
                case 'cut_off': return 'Cut-off (100:0) approach applied - recycled-content burden treated as zero at gate. Aligned with ISO 14044 5.3.5 hierarchy ① avoidance.'
                case 'substitution': return 'Substitution approach applied - recycled output potential reflected via system expansion.'
                case 'fifty_fifty': return '50:50 approach applied - recycling burden split equally between generator and user.'
                case 'pef_cff': return 'PEF Circular Footprint Formula applied per EU PEF guidance.'
                case 'closed_loop': return 'Closed-loop approach applied - equivalent quality assumption.'
                default: return `Recycling allocation method ${method} applied.`
            }
        }
    }
}

/**
 * 보고서용 상세 정당화 문구 생성
 */
export const generateDetailedJustification = (
    rule: AllocationRule,
    language: 'ko' | 'en' = 'ko'
): string => {
    return rule.justificationTemplates[language].detailed
}
