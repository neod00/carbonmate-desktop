"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Search, ChevronRight, ChevronLeft, ExternalLink, Shield, AlertTriangle,
    CheckCircle2, Globe, MapPin, BookOpen, Zap, Download, ArrowRight, Sparkles, X
} from "lucide-react"
import {
    PCR_DATABASE,
    PCRDatabaseEntry,
    PCRProgram,
    PCR_PROGRAM_INFO,
    REGULATORY_INFO,
    RegulatoryContext,
    PCRRegion,
    recommendPCRs,
    PCR_SEARCH_PORTALS,
} from "@/lib/core/pcr-database"
import { PRODUCT_CATEGORIES } from "@/lib/system-boundary"

// =============================================================================
// 타입
// =============================================================================

interface PCRAdvisorWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** 현재 선택된 제품 카테고리 */
    currentCategory?: string
    /** PCR 적용 콜백 */
    onApplyPCR: (pcr: PCRDatabaseEntry) => void
}

type WizardStep = 'purpose' | 'region' | 'results' | 'detail'

type PurposeOption = {
    id: string
    label: string
    labelEn: string
    icon: string
    regulation?: RegulatoryContext
    description: string
}

const PURPOSE_OPTIONS: PurposeOption[] = [
    { id: 'internal', label: '내부 평가 / 제품 개선', labelEn: 'Internal Assessment', icon: '📊', description: 'PCR 적용 없이 내부 의사결정용으로 사용' },
    { id: 'epd_korea', label: '🇰🇷 한국 환경성적표지 (KEITI)', labelEn: 'KEITI EPD Certification', icon: '🇰🇷', regulation: 'KEITI_EPD', description: 'KEITI 환경성적표지 인증 취득 목적' },
    { id: 'epd_global', label: '🌍 글로벌 EPD 인증', labelEn: 'Global EPD Certification', icon: '🌍', regulation: 'EPD_Certification', description: 'International EPD, IBU, EPD Norge 등 글로벌 EPD' },
    { id: 'cbam', label: '🏭 EU 수출 (CBAM 대응)', labelEn: 'EU CBAM Compliance', icon: '🏭', regulation: 'CBAM', description: 'EU 탄소국경조정제도 대응용 (철강, 시멘트, 알루미늄 등)' },
    { id: 'battery', label: '🔋 EU 배터리법 대응', labelEn: 'EU Battery Regulation', icon: '🔋', regulation: 'Battery_Regulation', description: 'EU 배터리법 탄소발자국 선언 의무 대응' },
    { id: 'leed', label: '🏢 LEED 인증 (북미)', labelEn: 'LEED Certification', icon: '🏢', regulation: 'LEED', description: '북미 친환경 건축물 인증 포인트 목적' },
    { id: 'dpp', label: '📱 디지털 제품 여권 (DPP)', labelEn: 'Digital Product Passport', icon: '📱', regulation: 'DPP', description: 'EU 에코디자인 규정에 따른 제품 환경 정보' },
]

const REGION_OPTIONS: { id: PCRRegion; label: string; icon: string; description: string }[] = [
    { id: 'korea', label: '🇰🇷 한국', icon: '🇰🇷', description: 'KEITI 환경성적표지 작성지침' },
    { id: 'europe', label: '🇪🇺 유럽', icon: '🇪🇺', description: 'IES, IBU, EPD Norge, EU PEFCR' },
    { id: 'north_america', label: '🇺🇸 북미', icon: '🇺🇸', description: 'UL, ASTM, Smart EPD' },
    { id: 'japan', label: '🇯🇵 일본', icon: '🇯🇵', description: 'SuMPO EPD, EcoLeaf' },
    { id: 'global', label: '🌐 글로벌 (전체)', icon: '🌐', description: '지역 무관, 모든 PCR 표시' },
]

// =============================================================================
// 컴포넌트
// =============================================================================

export function PCRAdvisorWizard({ open, onOpenChange, currentCategory, onApplyPCR }: PCRAdvisorWizardProps) {
    const [step, setStep] = useState<WizardStep>('purpose')
    const [selectedPurpose, setSelectedPurpose] = useState<string>('')
    const [selectedRegion, setSelectedRegion] = useState<PCRRegion | ''>('')
    const [selectedPCR, setSelectedPCR] = useState<PCRDatabaseEntry | null>(null)
    const [searchKeyword, setSearchKeyword] = useState('')

    // 현재 카테고리 한글명
    const categoryLabel = PRODUCT_CATEGORIES.find(c => c.id === currentCategory)?.nameKo || '기타'

    // 필터된 결과
    const filteredPCRs = useMemo(() => {
        const purposeOption = PURPOSE_OPTIONS.find(p => p.id === selectedPurpose)
        return recommendPCRs({
            categoryId: currentCategory,
            region: (selectedRegion || undefined) as PCRRegion | undefined,
            regulation: purposeOption?.regulation,
            keyword: searchKeyword || undefined,
        })
    }, [currentCategory, selectedPurpose, selectedRegion, searchKeyword])

    const handleReset = () => {
        setStep('purpose')
        setSelectedPurpose('')
        setSelectedRegion('')
        setSelectedPCR(null)
        setSearchKeyword('')
    }

    const handleClose = () => {
        onOpenChange(false)
        // 딜레이 후 리셋
        setTimeout(handleReset, 300)
    }

    const handleApply = (pcr: PCRDatabaseEntry) => {
        onApplyPCR(pcr)
        handleClose()
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] !overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
                <DialogClose onClick={handleClose} />
                <DialogHeader style={{ flexShrink: 0 }}>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="h-5 w-5 text-amber-400" />
                        PCR 스마트 어드바이저
                    </DialogTitle>
                    <DialogDescription>
                        제품 카테고리: <span className="font-medium text-foreground">{categoryLabel}</span>
                        {' '} — 적합한 PCR을 추천합니다
                    </DialogDescription>
                </DialogHeader>

                {/* 스텝 인디케이터 */}
                <div className="flex items-center gap-2 px-6 pb-2" style={{ flexShrink: 0 }}>
                    {(['purpose', 'region', 'results'] as WizardStep[]).map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold transition-colors ${step === s || (step === 'detail' && s === 'results')
                                ? 'bg-amber-500 text-white'
                                : ((['purpose', 'region', 'results'].indexOf(step) > i) || step === 'detail')
                                    ? 'bg-amber-500/30 text-amber-300'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                {i + 1}
                            </div>
                            <span className={`text-xs hidden sm:inline ${step === s ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                {s === 'purpose' ? '목적' : s === 'region' ? '지역' : '추천 결과'}
                            </span>
                            {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        </div>
                    ))}
                </div>

                {/* 스텝 콘텐츠 — inline style로 overflow 확실히 보장 */}
                <div className="px-6 pb-6" style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto' }}>

                    {/* Step 1: 목적 선택 */}
                    {step === 'purpose' && (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                CFP 산정의 <span className="font-medium text-amber-400">목적</span>을 선택하세요.
                                적합한 PCR 프로그램과 규제 요구사항을 안내합니다.
                            </p>
                            <div className="grid gap-2">
                                {PURPOSE_OPTIONS.map(option => (
                                    <button
                                        key={option.id}
                                        onClick={() => {
                                            setSelectedPurpose(option.id)
                                            if (option.id === 'internal') {
                                                // 내부 평가는 지역 스킵하고 바로 결과로
                                                setStep('results')
                                            } else {
                                                setStep('region')
                                            }
                                        }}
                                        className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all text-left group
                                            ${selectedPurpose === option.id
                                                ? 'border-amber-500/50 bg-amber-500/10'
                                                : 'border-border/50 hover:border-amber-500/30 hover:bg-muted/30'
                                            }`}
                                    >
                                        <span className="text-xl flex-shrink-0 mt-0.5">{option.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">{option.label}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground mt-1 flex-shrink-0 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: 지역 선택 */}
                    {step === 'region' && (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                대상 <span className="font-medium text-amber-400">시장/지역</span>을 선택하세요.
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {REGION_OPTIONS.map(option => (
                                    <button
                                        key={option.id}
                                        onClick={() => {
                                            setSelectedRegion(option.id)
                                            setStep('results')
                                        }}
                                        className="flex items-start gap-3 p-3.5 rounded-lg border border-border/50 hover:border-amber-500/30 hover:bg-muted/30 transition-all text-left group"
                                    >
                                        <span className="text-xl flex-shrink-0">{option.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm">{option.label}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground mt-1 flex-shrink-0" />
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setStep('purpose')}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                            >
                                <ChevronLeft className="h-3 w-3" /> 이전 단계
                            </button>
                        </div>
                    )}

                    {/* Step 3: 추천 결과 */}
                    {step === 'results' && (
                        <div className="space-y-3">
                            {/* 맥락 요약 배지 */}
                            <div className="flex flex-wrap gap-1.5">
                                {selectedPurpose && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20">
                                        {PURPOSE_OPTIONS.find(p => p.id === selectedPurpose)?.label}
                                    </span>
                                )}
                                {selectedRegion && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/20">
                                        {REGION_OPTIONS.find(r => r.id === selectedRegion)?.label}
                                    </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                                    {categoryLabel}
                                </span>
                            </div>

                            {/* 검색 */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="키워드 검색 (예: battery, 철강, cement...)"
                                    value={searchKeyword}
                                    onChange={e => setSearchKeyword(e.target.value)}
                                    className="pl-9 h-9 bg-muted/30"
                                />
                            </div>

                            {/* 결과 목록 */}
                            <div className="space-y-2">
                                {filteredPCRs.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">조건에 맞는 PCR이 없습니다.</p>
                                        <p className="text-xs mt-1">검색 포털에서 직접 검색해 보세요.</p>
                                    </div>
                                ) : (
                                    filteredPCRs.map(pcr => (
                                        <PCRResultCard
                                            key={pcr.id}
                                            pcr={pcr}
                                            onViewDetail={() => {
                                                setSelectedPCR(pcr)
                                                setStep('detail')
                                            }}
                                            onApply={() => handleApply(pcr)}
                                        />
                                    ))
                                )}
                            </div>

                            {/* 통합 검색 포털 안내 */}
                            <div className="mt-4 pt-4 border-t border-border/30">
                                <p className="text-xs text-muted-foreground mb-2 font-medium">📌 PCR 통합 검색 포털 (직접 검색)</p>
                                <div className="grid gap-1.5">
                                    {PCR_SEARCH_PORTALS.slice(0, 3).map(portal => (
                                        <a
                                            key={portal.url}
                                            href={portal.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs bg-muted/20 border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                                        >
                                            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                            <span className="font-medium">{portal.nameKo}</span>
                                            <span className="text-muted-foreground ml-auto truncate max-w-[150px]">{portal.description}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => setStep(selectedPurpose === 'internal' ? 'purpose' : 'region')}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                            >
                                <ChevronLeft className="h-3 w-3" /> 이전 단계
                            </button>
                        </div>
                    )}

                    {/* Step 4: PCR 상세 */}
                    {step === 'detail' && selectedPCR && (
                        <PCRDetailView
                            pcr={selectedPCR}
                            onBack={() => setStep('results')}
                            onApply={() => handleApply(selectedPCR)}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

// =============================================================================
// 서브 컴포넌트: PCR 결과 카드
// =============================================================================

function PCRResultCard({
    pcr,
    onViewDetail,
    onApply,
}: {
    pcr: PCRDatabaseEntry
    onViewDetail: () => void
    onApply: () => void
}) {
    const programInfo = PCR_PROGRAM_INFO[pcr.program]
    const hasWarnings = pcr.warnings && pcr.warnings.length > 0
    const hasSpecialRules = Object.values(pcr.specialRules).some(Boolean)

    return (
        <div className="p-3 rounded-lg border border-border/50 hover:border-amber-500/30 bg-muted/10 hover:bg-muted/20 transition-all group">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    {/* 헤더 */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold bg-${programInfo.color}-500/15 text-${programInfo.color}-400 border border-${programInfo.color}-500/20`}
                            style={{
                                backgroundColor: `color-mix(in srgb, var(--color-amber-500) 15%, transparent)`,
                                borderColor: `color-mix(in srgb, var(--color-amber-500) 20%, transparent)`,
                            }}
                        >
                            {programInfo.nameKo}
                        </span>
                        {hasSpecialRules && (
                            <Shield className="h-3 w-3 text-amber-400 flex-shrink-0" />
                        )}
                        {hasWarnings && (
                            <AlertTriangle className="h-3 w-3 text-orange-400 flex-shrink-0" />
                        )}
                    </div>

                    {/* 이름 */}
                    <div className="font-medium text-sm text-foreground truncate">{pcr.nameKo}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{pcr.name}</div>

                    {/* 규제 배지 */}
                    {pcr.regulatoryContext.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {pcr.regulatoryContext.slice(0, 3).map(reg => {
                                const info = REGULATORY_INFO[reg]
                                return (
                                    <span key={reg} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/50 text-slate-300" title={info.description}>
                                        {info.icon} {info.nameKo}
                                    </span>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* 액션 버튼 */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                        onClick={onApply}
                        className="px-3 py-1.5 text-xs rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-medium transition-colors whitespace-nowrap"
                    >
                        ✅ 적용
                    </button>
                    <button
                        onClick={onViewDetail}
                        className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors whitespace-nowrap"
                    >
                        상세보기
                    </button>
                </div>
            </div>
        </div>
    )
}

// =============================================================================
// 서브 컴포넌트: PCR 상세 보기
// =============================================================================

function PCRDetailView({
    pcr,
    onBack,
    onApply,
}: {
    pcr: PCRDatabaseEntry
    onBack: () => void
    onApply: () => void
}) {
    const programInfo = PCR_PROGRAM_INFO[pcr.program]
    const specialRules = pcr.specialRules

    return (
        <div className="space-y-4">
            {/* 헤더 */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/20">
                        {programInfo.nameKo}
                    </span>
                    {pcr.version && (
                        <span className="text-xs text-muted-foreground">v{pcr.version}</span>
                    )}
                </div>
                <h3 className="text-base font-semibold">{pcr.nameKo}</h3>
                <p className="text-sm text-muted-foreground">{pcr.name}</p>
                <p className="text-xs text-muted-foreground mt-1">운영: {pcr.operator}</p>
            </div>

            {/* 경고사항 */}
            {pcr.warnings && pcr.warnings.length > 0 && (
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-orange-400" />
                        <span className="text-xs font-bold text-orange-300">⚠ 주의 사항</span>
                    </div>
                    <ul className="space-y-1">
                        {pcr.warnings.map((w, i) => (
                            <li key={i} className="text-xs text-orange-200/80 flex items-start gap-1.5">
                                <span className="text-orange-400 mt-0.5">•</span>
                                <span>{w}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 특수 규칙 */}
            {Object.values(specialRules).some(Boolean) && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-blue-400" />
                        <span className="text-xs font-bold text-blue-300">적용 시 자동 반영 사항</span>
                    </div>
                    <div className="grid gap-1.5">
                        {specialRules.usePhaseExcluded && (
                            <RuleBadge icon="⛔" text="사용단계(Use-phase) 자동 비활성화" />
                        )}
                        {specialRules.primaryDataRequired && (
                            <RuleBadge icon="📊" text="1차 데이터(Primary data) 필수 — 경고 표시" />
                        )}
                        {specialRules.moduleCRequired && (
                            <RuleBadge icon="♻️" text="모듈 C(폐기 단계) 자동 활성화" />
                        )}
                        {specialRules.moduleDRequired && (
                            <RuleBadge icon="🔄" text="모듈 D(재활용 편익) 자동 활성화" />
                        )}
                        {specialRules.recyclingRatioRequired && (
                            <RuleBadge icon="📐" text="재활용 비율 산정 필수" />
                        )}
                        {specialRules.cffFormulaRequired && (
                            <RuleBadge icon="🧮" text="순환 발자국 공식(CFF) 적용 필수" />
                        )}
                        {specialRules.scrapZeroAllocation && (
                            <RuleBadge icon="0️⃣" text="미가공 스크랩 투입 배출량 0 간주" />
                        )}
                        {specialRules.indirectEmissionsRequired && (
                            <RuleBadge icon="⚡" text="간접 배출량(전력) 포함 필수" />
                        )}
                        {pcr.boundaryRequirement && (
                            <RuleBadge
                                icon="🔲"
                                text={`시스템 경계 → ${pcr.boundaryRequirement === 'cradle-to-gate' ? '요람~문 (Cradle-to-Gate)'
                                    : pcr.boundaryRequirement === 'cradle-to-grave' ? '요람~무덤 (Cradle-to-Grave)'
                                        : '문~문 (Gate-to-Gate)'}`}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* 규제 연계 */}
            {pcr.regulatoryContext.length > 0 && (
                <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground">관련 규제</span>
                    <div className="grid gap-1.5">
                        {pcr.regulatoryContext.map(reg => {
                            const info = REGULATORY_INFO[reg]
                            return (
                                <div key={reg} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/30">
                                    <span className="text-base">{info.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium">{info.nameKo}</div>
                                        <div className="text-[10px] text-muted-foreground">{info.description}</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* 다운로드 링크 */}
            <div className="space-y-1.5">
                {pcr.downloadUrl && (
                    <a
                        href={pcr.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-sm"
                    >
                        <Download className="h-4 w-4 text-emerald-400" />
                        <span className="font-medium text-emerald-300">PCR 문서 다운로드 / 열람</span>
                        <ExternalLink className="h-3 w-3 text-emerald-500/60 ml-auto" />
                    </a>
                )}
                {pcr.infoUrl && (
                    <a
                        href={pcr.infoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/20 border border-border/30 hover:border-primary/30 transition-colors text-xs"
                    >
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span>프로그램 공식 페이지</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground/50 ml-auto" />
                    </a>
                )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-3 pt-2">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ChevronLeft className="h-3 w-3" /> 목록으로
                </button>
                <button
                    onClick={onApply}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-medium text-sm transition-colors border border-amber-500/20"
                >
                    <CheckCircle2 className="h-4 w-4" />
                    이 PCR 적용하기
                    <ArrowRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

// =============================================================================
// 유틸 컴포넌트
// =============================================================================

function RuleBadge({ icon, text }: { icon: string; text: string }) {
    return (
        <div className="flex items-center gap-2 text-xs text-blue-200/80">
            <span>{icon}</span>
            <span>{text}</span>
        </div>
    )
}
