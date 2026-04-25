"use client"

import { useEffect, useState, useCallback } from "react"
import { usePCFStore, BoundaryType, StudyGoal, TimeBoundary, PCR_PRESETS, PCRReference } from "@/lib/store"
import { CHARACTERIZATION_MODEL_LABELS } from "@/lib/core/iso14067-constants"
import type { CharacterizationModel } from "@/lib/core/iso14067-constants"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Info, ArrowRight, Package, Factory, Recycle, Target, Calendar, Calculator, ChevronDown, ChevronUp, FlaskConical, BookOpen, Plus, X, Sparkles, Shield, AlertTriangle, ExternalLink, Zap } from "lucide-react"
import { MultiSitePanel } from "@/components/calculator/panels/multi-site-panel"
import { PCRAdvisorWizard } from "@/components/calculator/panels/pcr-advisor-wizard"
import { PCRDatabaseEntry, REGULATORY_INFO, PCR_PROGRAM_INFO } from "@/lib/core/pcr-database"
import {
    SYSTEM_BOUNDARIES,
    PRODUCT_CATEGORIES,
    FUNCTIONAL_UNIT_TEMPLATES,
    getSystemBoundaryConfig,
    applyProductCategoryDefaults,
    adjustStagesForBoundaryChange
} from "@/lib/system-boundary"

// 활용 목적 옵션
const APPLICATION_PURPOSES = [
    { id: 'internal_decision', label: '내부 의사결정' },
    { id: 'product_improvement', label: '제품 개선' },
    { id: 'supplier_engagement', label: '공급망 관리' },
    { id: 'external_communication', label: '외부 정보공개' },
    { id: 'epd_development', label: 'EPD 개발' },
    { id: 'regulatory_compliance', label: '규제 대응' },
    { id: 'other', label: '기타' },
]

// 대상 청중 옵션
const TARGET_AUDIENCES = [
    { id: 'internal_management', label: '내부 경영진' },
    { id: 'internal_technical', label: '내부 기술팀' },
    { id: 'customers_b2b', label: 'B2B 고객' },
    { id: 'customers_b2c', label: '일반 소비자' },
    { id: 'investors', label: '투자자' },
    { id: 'regulators', label: '규제기관' },
    { id: 'general_public', label: '일반 대중' },
]

export function ProductInfoStep() {
    const {
        productInfo, setProductInfo, stages, toggleStage,
        characterizationModel, setCharacterizationModel,
        pcrReferences, addPCRReference, removePCRReference,
    } = usePCFStore()
    const [showPCRForm, setShowPCRForm] = useState(false)
    const [pcrForm, setPcrForm] = useState<Omit<PCRReference, 'id'>>({ name: '', operator: '' })
    const [showPCRAdvisor, setShowPCRAdvisor] = useState(false)
    const [appliedPCR, setAppliedPCR] = useState<PCRDatabaseEntry | null>(null)
    const [pcrAutoApplyMessage, setPcrAutoApplyMessage] = useState<string[]>([])
    const [pcrDetailExpanded, setPcrDetailExpanded] = useState(true)
    const [pcrMessageExpanded, setPcrMessageExpanded] = useState(true)

    // PCR 적용 시 시스템 경계 및 설정 자동 반영 (아이디어 2)
    const handleApplyPCR = useCallback((pcr: PCRDatabaseEntry) => {
        setAppliedPCR(pcr)
        const messages: string[] = []

        // 1. PCR을 pcrReferences에 자동 등록
        const pcrRef: Omit<PCRReference, 'id'> = {
            name: pcr.name,
            operator: pcr.operator,
            version: pcr.version,
            productCategory: pcr.categories.join(', '),
            validUntil: pcr.validUntil,
            url: pcr.downloadUrl || pcr.infoUrl,
        }
        // 중복 방지
        if (!pcrReferences.some(r => r.name === pcr.name)) {
            addPCRReference(pcrRef)
            messages.push(`✅ PCR "${pcr.nameKo}" 참조 등록 완료`)
        }

        // 2. CFP-PCR 참조 텍스트도 자동 채움
        updateStudyGoal({ cfpPcrReference: `${pcr.name} (${pcr.operator})` })

        // 3. 시스템 경계 자동 반영
        if (pcr.boundaryRequirement) {
            handleBoundaryChange(pcr.boundaryRequirement)
            const boundaryLabels: Record<BoundaryType, string> = {
                'cradle-to-gate': '요람~문 (Cradle-to-Gate)',
                'cradle-to-grave': '요람~무덤 (Cradle-to-Grave)',
                'gate-to-gate': '문~문 (Gate-to-Gate)',
            }
            messages.push(`🔲 시스템 경계 → ${boundaryLabels[pcr.boundaryRequirement]}`)
        }

        // 4. 특수 규칙에 따른 단계 조정
        if (pcr.specialRules.usePhaseExcluded) {
            // 사용단계가 활성화되어 있으면 비활성화
            if (stages.includes('use')) {
                toggleStage('use')
            }
            messages.push('⛔ 사용단계(Use-phase) 비활성화됨')
        }

        if (pcr.specialRules.moduleCRequired || pcr.specialRules.moduleDRequired) {
            // 폐기(eol) 단계가 비활성화되어 있으면 활성화
            if (!stages.includes('eol')) {
                toggleStage('eol')
            }
            messages.push('♻️ 폐기/재활용 단계(모듈 C, D) 활성화됨')
        }

        // 5. 기타 특수 규칙 경고
        if (pcr.specialRules.primaryDataRequired) {
            messages.push('📊 1차 데이터(Primary data) 사용이 필수입니다')
        }
        if (pcr.specialRules.scrapZeroAllocation) {
            messages.push('0️⃣ 미가공 스크랩 투입: 배출량 0 간주 (ISO 20915)')
        }
        if (pcr.specialRules.indirectEmissionsRequired) {
            messages.push('⚡ 간접 배출량(전력 소비) 포함 필수')
        }
        if (pcr.specialRules.recyclingRatioRequired) {
            messages.push('📐 재활용 비율 산정이 필수입니다')
        }

        setPcrAutoApplyMessage(messages)
    }, [stages, pcrReferences])

    // 제품 카테고리 변경 시 기본값 적용
    const handleCategoryChange = (categoryId: string) => {
        setProductInfo({ category: categoryId })

        // 카테고리에 따른 기본값 적용 (사용자가 원하면)
        const defaults = applyProductCategoryDefaults(categoryId)

        // 시스템 경계와 기능단위 자동 설정
        setProductInfo({
            boundary: defaults.boundary,
            unit: defaults.functionalUnit
        })

        // 단계 자동 조정은 lifecycle-stages에서 처리
    }

    // 시스템 경계 변경 시 단계 자동 조정
    const handleBoundaryChange = (boundary: BoundaryType) => {
        setProductInfo({ boundary })

        // 현재 단계를 새 경계에 맞게 조정
        const adjustedStages = adjustStagesForBoundaryChange(stages, boundary)

        // 현재 단계와 조정된 단계 비교하여 토글
        const currentSet = new Set(stages)
        const adjustedSet = new Set(adjustedStages)

        // 제거해야 할 단계
        stages.forEach(stage => {
            if (!adjustedSet.has(stage)) {
                toggleStage(stage)
            }
        })

        // 추가해야 할 단계
        adjustedStages.forEach(stage => {
            if (!currentSet.has(stage)) {
                toggleStage(stage)
            }
        })
    }

    // StudyGoal 업데이트 핸들러
    const updateStudyGoal = (updates: Partial<StudyGoal>) => {
        const current = productInfo.studyGoal || {
            applicationPurpose: '',
            reasonForStudy: '',
            targetAudience: '',
            isCommunicationIntended: false
        }
        setProductInfo({ studyGoal: { ...current, ...updates } })
    }

    // TimeBoundary 업데이트 핸들러
    const updateTimeBoundary = (updates: Partial<TimeBoundary>) => {
        const current = productInfo.timeBoundary || {
            dataCollectionStart: '',
            dataCollectionEnd: '',
            cfpRepresentativeYear: new Date().getFullYear().toString(),
            seasonalVariationConsidered: false
        }
        setProductInfo({ timeBoundary: { ...current, ...updates } })
    }

    const currentBoundary = getSystemBoundaryConfig(productInfo.boundary)
    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString())

    return (
        <div className="space-y-8">
            {/* CFP 연구 목표 (ISO 14067 6.3.1) */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium">CFP 연구 목표</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        ISO 14067 6.3.1
                    </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="applicationPurpose">활용 목적 *</Label>
                        <Select
                            value={productInfo.studyGoal?.applicationPurpose || ''}
                            onValueChange={(value) => updateStudyGoal({ applicationPurpose: value })}
                        >
                            <SelectTrigger id="applicationPurpose">
                                <SelectValue placeholder="목적 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {APPLICATION_PURPOSES.map((purpose) => (
                                    <SelectItem key={purpose.id} value={purpose.label}>
                                        {purpose.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="targetAudience">대상 청중 *</Label>
                        <Select
                            value={productInfo.studyGoal?.targetAudience || ''}
                            onValueChange={(value) => updateStudyGoal({ targetAudience: value })}
                        >
                            <SelectTrigger id="targetAudience">
                                <SelectValue placeholder="청중 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {TARGET_AUDIENCES.map((audience) => (
                                    <SelectItem key={audience.id} value={audience.label}>
                                        {audience.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reasonForStudy">수행 이유 *</Label>
                    <Textarea
                        id="reasonForStudy"
                        placeholder="예: 제품 탄소발자국 산정 및 감축 기회 파악을 위한 기초 데이터 확보"
                        value={productInfo.studyGoal?.reasonForStudy || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateStudyGoal({ reasonForStudy: e.target.value })}
                        className="min-h-[60px]"
                    />
                </div>
                <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                        <Checkbox
                            id="isCommunicationIntended"
                            checked={productInfo.studyGoal?.isCommunicationIntended || false}
                            onCheckedChange={(checked) =>
                                updateStudyGoal({ isCommunicationIntended: checked as boolean })
                            }
                            className="mt-0.5"
                        />
                        <div className="space-y-1">
                            <Label htmlFor="isCommunicationIntended" className="text-sm cursor-pointer">
                                외부 정보공개/커뮤니케이션 의도
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                체크 시: EPD 인증, 마케팅 커뮤니케이션 등 외부 공개용으로 활용됩니다.
                                ISO 14067 6.7항 (CFP 정보공개)의 추가 요구사항이 적용됩니다.
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cfpPcrReference" className="text-sm">
                            CFP-PCR 참조 (선택)
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="cfpPcrReference"
                                placeholder="예: PCR 2019:14 Furniture, EPD International"
                                value={productInfo.studyGoal?.cfpPcrReference || ''}
                                onChange={(e) => updateStudyGoal({ cfpPcrReference: e.target.value })}
                                className="flex-1"
                            />
                            <button
                                onClick={() => setShowPCRAdvisor(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-500/60 font-medium text-xs transition-all whitespace-nowrap"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                PCR 어드바이저
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            ISO 14067: 관련 PCR이 존재하면 반드시 채택해야 합니다.
                            <span className="text-amber-700 dark:text-amber-400 ml-1 cursor-pointer hover:underline font-medium" onClick={() => setShowPCRAdvisor(true)}>
                                PCR 어드바이저를 사용하여 적합한 PCR을 찾아보세요 →
                            </span>
                        </p>

                        {/* 적용된 PCR 표시 (아이디어 2: 자동 반영 결과) */}
                        {appliedPCR && (
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                                <button
                                    onClick={() => setPcrDetailExpanded(!pcrDetailExpanded)}
                                    className="flex items-center gap-2 w-full text-left"
                                >
                                    <Shield className="h-4 w-4 text-emerald-400" />
                                    <span className="text-xs font-bold text-emerald-300">PCR 적용됨</span>
                                    <span className="ml-auto text-slate-500 hover:text-slate-300 transition-colors">
                                        {pcrDetailExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </span>
                                </button>
                                {pcrDetailExpanded && (
                                    <>
                                        <div className="text-sm font-medium text-emerald-200">{appliedPCR.nameKo}</div>
                                        <div className="text-xs text-emerald-300/70">{appliedPCR.name} — {appliedPCR.operator}</div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {appliedPCR.regulatoryContext.map(reg => {
                                                const info = REGULATORY_INFO[reg]
                                                return (
                                                    <span key={reg} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                                                        {info.icon} {info.nameKo}
                                                    </span>
                                                )
                                            })}
                                        </div>
                                        {appliedPCR.downloadUrl && (
                                            <a
                                                href={appliedPCR.downloadUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-[10px] text-emerald-400/70 hover:text-emerald-300 transition-colors"
                                            >
                                                <ExternalLink className="h-2.5 w-2.5" />
                                                PCR 문서 열람
                                            </a>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* PCR 자동 반영 메시지 (아이디어 2: 시스템 경계 변경 알림) */}
                        {pcrAutoApplyMessage.length > 0 && (
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 animate-in slide-in-from-top-2 fade-in-0 duration-300">
                                <button
                                    onClick={() => setPcrMessageExpanded(!pcrMessageExpanded)}
                                    className="flex items-center gap-2 w-full text-left"
                                >
                                    <Zap className="h-4 w-4 text-blue-400" />
                                    <span className="text-xs font-bold text-blue-300">PCR 요구사항 자동 반영 완료</span>
                                    <span className="ml-auto text-slate-500 hover:text-slate-300 transition-colors">
                                        {pcrMessageExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </span>
                                </button>
                                {pcrMessageExpanded && (
                                    <ul className="space-y-1 mt-2">
                                        {pcrAutoApplyMessage.map((msg, i) => (
                                            <li key={i} className="text-xs text-blue-200/80">{msg}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* 제품 기본 정보 */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">제품 기본 정보</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">제품명 *</Label>
                        <Input
                            id="name"
                            placeholder="예: Eco-Chair 2000"
                            value={productInfo.name}
                            onChange={(e) => setProductInfo({ name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="category">제품 카테고리</Label>
                        <Select
                            value={productInfo.category || 'other'}
                            onValueChange={handleCategoryChange}
                        >
                            <SelectTrigger id="category">
                                <SelectValue placeholder="카테고리 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {PRODUCT_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.nameKo}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            카테고리 선택 시 권장 설정이 자동 적용됩니다.
                        </p>
                    </div>
                </div>
            </div>

            {/* 기능단위 (ISO 14067 6.3.3) */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">기능단위</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        ISO 14067 6.3.3
                    </span>
                </div>

                {/* 구조화된 빌더 */}
                <div className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-4">
                    {/* 빠른 프리셋 칩 */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">빠른 선택</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { label: '1 kg', desc: '질량 기준' },
                                { label: '1 piece', desc: '개별 제품' },
                                { label: '1 set', desc: '세트 제품' },
                                { label: '1 kWh', desc: '에너지' },
                                { label: '1 m²', desc: '면적 기준' },
                                { label: '1 L', desc: '부피 기준' },
                                { label: '1 ton', desc: '대량 생산' },
                            ].map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => setProductInfo({ unit: preset.label })}
                                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${productInfo.unit === preset.label
                                        ? 'bg-primary/20 border-primary text-primary font-medium'
                                        : 'bg-muted border-border text-foreground/80 hover:bg-muted/80 hover:text-foreground hover:border-primary/50'
                                        }`}
                                    title={preset.desc}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 수량 + 단위 + 설명 조합 입력 */}
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">수량</Label>
                            <Input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="1"
                                value={(() => {
                                    const match = productInfo.unit.match(/^(\d+\.?\d*)/)
                                    return match ? match[1] : ''
                                })()}
                                onChange={(e) => {
                                    const qty = e.target.value
                                    const unitPart = productInfo.unit.replace(/^[\d.]+\s*/, '') || 'kg'
                                    setProductInfo({ unit: qty ? `${qty} ${unitPart}` : unitPart })
                                }}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">단위</Label>
                            <Select
                                value={(() => {
                                    const unitPart = productInfo.unit.replace(/^[\d.]+\s*/, '').split(/\s*\(/)[0].trim()
                                    const knownUnits = ['kg', 'g', 'ton', 'piece', 'set', 'kWh', 'MJ', 'm²', 'L', 'mL', 'm', 'pair']
                                    return knownUnits.find(u => unitPart.toLowerCase() === u.toLowerCase()) || '__custom'
                                })()}
                                onValueChange={(value) => {
                                    if (value === '__custom') return
                                    const match = productInfo.unit.match(/^(\d+\.?\d*)/)
                                    const qty = match ? match[1] : '1'
                                    const descMatch = productInfo.unit.match(/\(([^)]+)\)/)
                                    const desc = descMatch ? ` (${descMatch[1]})` : ''
                                    setProductInfo({ unit: `${qty} ${value}${desc}` })
                                }}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="단위 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold">질량</div>
                                    <SelectItem value="kg">kg (킬로그램)</SelectItem>
                                    <SelectItem value="g">g (그램)</SelectItem>
                                    <SelectItem value="ton">ton (톤)</SelectItem>
                                    <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold">제품</div>
                                    <SelectItem value="piece">piece (개)</SelectItem>
                                    <SelectItem value="set">set (세트)</SelectItem>
                                    <SelectItem value="pair">pair (켤레)</SelectItem>
                                    <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold">에너지</div>
                                    <SelectItem value="kWh">kWh (킬로와트시)</SelectItem>
                                    <SelectItem value="MJ">MJ (메가줄)</SelectItem>
                                    <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold">기타</div>
                                    <SelectItem value="m²">m² (제곱미터)</SelectItem>
                                    <SelectItem value="L">L (리터)</SelectItem>
                                    <SelectItem value="m">m (미터)</SelectItem>
                                    <SelectItem value="__custom">직접 입력...</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">설명 (선택)</Label>
                            <Input
                                placeholder="예: 75kWh 배터리 팩"
                                value={(() => {
                                    const descMatch = productInfo.unit.match(/\(([^)]+)\)/)
                                    return descMatch ? descMatch[1] : ''
                                })()}
                                onChange={(e) => {
                                    const base = productInfo.unit.replace(/\s*\([^)]*\)/, '')
                                    setProductInfo({ unit: e.target.value ? `${base} (${e.target.value})` : base })
                                }}
                                className="h-9"
                            />
                        </div>
                    </div>

                    {/* 현재 값 미리보기 */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/40">
                        <span className="text-xs text-foreground/70">결과:</span>
                        <span className="text-sm font-medium text-primary">{productInfo.unit || '—'}</span>
                    </div>
                </div>

                {/* 템플릿에서 선택 */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">또는 산업별 템플릿에서 선택</Label>
                    <Select
                        value=""
                        onValueChange={(value) => setProductInfo({ unit: value })}
                    >
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="산업별 기능단위 템플릿" />
                        </SelectTrigger>
                        <SelectContent>
                            {FUNCTIONAL_UNIT_TEMPLATES.map((category) => (
                                <div key={category.id}>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                        {category.categoryKo}
                                    </div>
                                    {category.templates.map((template) => (
                                        <SelectItem key={template.unit} value={template.unit}>
                                            {template.nameKo} ({template.unit})
                                        </SelectItem>
                                    ))}
                                </div>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">
                        <span className="font-medium">기능단위란?</span> CFP 결과를 표현하는 기준입니다.
                        동일한 기능을 수행하는 제품 간 비교를 가능하게 합니다.
                        <br />예: &quot;1 kg의 강철&quot;, &quot;1 set (75kWh 배터리 팩)&quot;, &quot;100 kWh&quot;
                    </p>
                </div>
            </div>

            {/* 시스템 경계 (ISO 14067 6.3.4) */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">시스템 경계</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        ISO 14067 6.3.4
                    </span>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {SYSTEM_BOUNDARIES.map((boundary) => {
                        const isSelected = productInfo.boundary === boundary.id
                        return (
                            <Card
                                key={boundary.id}
                                className={`cursor-pointer transition-all hover:border-primary/50 ${isSelected
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border/50'
                                    }`}
                                onClick={() => handleBoundaryChange(boundary.id)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-muted'
                                            }`}>
                                            <BoundaryIcon type={boundary.id} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium text-sm">
                                                {boundary.nameKo}
                                            </h4>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {boundary.name}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-3">
                                        {boundary.descriptionKo}
                                    </p>
                                    <p className="text-xs text-muted-foreground/60 mt-2">
                                        용도: {boundary.typicalUseCase}
                                    </p>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* 선택된 경계 상세 정보 */}
            <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-3 flex-1">
                        <div>
                            <h4 className="font-medium text-sm">
                                선택된 경계: {currentBoundary.nameKo} ({currentBoundary.name})
                            </h4>
                        </div>

                        {/* 단계 흐름 시각화 */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            {currentBoundary.requiredStages.map((stage, idx) => (
                                <div key={stage} className="flex items-center gap-1">
                                    <span className="px-2 py-1 rounded bg-primary/20 text-primary font-medium">
                                        {getStageLabel(stage)}
                                    </span>
                                    {idx < currentBoundary.requiredStages.length - 1 && (
                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    )}
                                </div>
                            ))}
                            {currentBoundary.optionalStages.length > 0 && (
                                <>
                                    <span className="text-muted-foreground">+</span>
                                    {currentBoundary.optionalStages.map((stage) => (
                                        <span
                                            key={stage}
                                            className="px-2 py-1 rounded bg-muted text-muted-foreground"
                                        >
                                            {getStageLabel(stage)} (선택)
                                        </span>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* 제외 단계 */}
                        {currentBoundary.excludedStages.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                제외 단계: {currentBoundary.excludedStages.map(s => getStageLabel(s)).join(', ')}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* 데이터 시간 경계 (ISO 14067 6.3.6) */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-medium">데이터 시간 경계</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        ISO 14067 6.3.6
                    </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                        <Label>데이터 수집 기간 *</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="month"
                                value={productInfo.timeBoundary?.dataCollectionStart || ''}
                                onChange={(e) => updateTimeBoundary({ dataCollectionStart: e.target.value })}
                                className="flex-1"
                            />
                            <span className="text-muted-foreground">~</span>
                            <Input
                                type="month"
                                value={productInfo.timeBoundary?.dataCollectionEnd || ''}
                                onChange={(e) => updateTimeBoundary({ dataCollectionEnd: e.target.value })}
                                className="flex-1"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cfpRepresentativeYear">CFP 대표 연도 *</Label>
                        <Select
                            value={productInfo.timeBoundary?.cfpRepresentativeYear || currentYear.toString()}
                            onValueChange={(value) => updateTimeBoundary({ cfpRepresentativeYear: value })}
                        >
                            <SelectTrigger id="cfpRepresentativeYear">
                                <SelectValue placeholder="연도 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map((year) => (
                                    <SelectItem key={year} value={year}>{year}년</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 flex items-end">
                        <div className="flex items-center space-x-2 pb-2">
                            <Checkbox
                                id="seasonalVariation"
                                checked={productInfo.timeBoundary?.seasonalVariationConsidered || false}
                                onCheckedChange={(checked) =>
                                    updateTimeBoundary({ seasonalVariationConsidered: checked as boolean })
                                }
                            />
                            <Label htmlFor="seasonalVariation" className="text-sm cursor-pointer">
                                계절 변동성 고려됨
                            </Label>
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="timeBoundaryJustification">정당화 근거 (선택)</Label>
                    <Textarea
                        id="timeBoundaryJustification"
                        placeholder="예: 연간 평균 생산량 기준으로 12개월간 데이터 수집, 계절별 변동성 반영"
                        value={productInfo.timeBoundary?.justification || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateTimeBoundary({ justification: e.target.value })}
                        className="min-h-[60px]"
                    />
                </div>
            </div>


            {/* 다중 사업장 유틸리티 (Optional) */}
            <div className="border border-slate-700/50 rounded-lg bg-slate-900/50 overflow-hidden">
                <details className="group">
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-violet-400" />
                            <h3 className="text-lg font-medium text-slate-200">다중 사업장 데이터 합산 도구</h3>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span>(선택 사항)</span>
                            <ChevronDown className="h-4 w-4 group-open:rotate-180 transition-transform" />
                        </div>
                    </summary>
                    <div className="p-4 pt-0 border-t border-slate-700/50 bg-zinc-950/50">
                        <div className="mb-4 text-sm text-slate-300 bg-violet-500/10 p-3 rounded-md border border-violet-500/20">
                            <Info className="h-4 w-4 inline mr-1.5 mb-0.5 text-violet-400" />
                            동일 제품을 여러 사업장에서 생산하는 경우, 각 사업장의 CFP를 가중 평균하여 단일 값으로 산출할 수 있습니다.
                            이 도구는 계산 편의를 위해 제공되며, 산출된 가중 평균값을 '기능단위' 또는 보고서에 활용하세요.
                        </div>
                        <MultiSitePanel />
                    </div>
                </details>
            </div>

            {/* P2-5: 특성화 인자 모델 선택 (ISO 14067 7.3 f) */}
            <div className="border border-slate-700/50 rounded-lg bg-slate-900/50 overflow-hidden">
                <details className="group">
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-2">
                            <FlaskConical className="h-5 w-5 text-teal-400" />
                            <h3 className="text-lg font-medium text-slate-200">특성화 인자 모델 선택</h3>
                            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/20">
                                {CHARACTERIZATION_MODEL_LABELS[characterizationModel]}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span>ISO 14067 7.3 f</span>
                            <ChevronDown className="h-4 w-4 group-open:rotate-180 transition-transform" />
                        </div>
                    </summary>
                    <div className="p-4 pt-0 border-t border-slate-700/50 bg-zinc-950/50">
                        <div className="mb-4 text-sm text-slate-300 bg-teal-500/10 p-3 rounded-md border border-teal-500/20">
                            <Info className="h-4 w-4 inline mr-1.5 mb-0.5 text-teal-400" />
                            GWP (지구온난화지수) 값은 IPCC 평가보고서 버전에 따라 달라집니다.
                            PCR이 특정 버전을 요구하지 않는 경우 최신 AR6를 권장합니다.
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {(['AR5', 'AR6'] as CharacterizationModel[]).map(model => (
                                <button
                                    key={model}
                                    onClick={() => setCharacterizationModel(model)}
                                    className={`p-4 rounded-lg border-2 transition-all text-left ${characterizationModel === model
                                        ? 'border-teal-500 bg-teal-500/10'
                                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-slate-200">{CHARACTERIZATION_MODEL_LABELS[model]}</span>
                                        {characterizationModel === model && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300">선택됨</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-400 space-y-1">
                                        <div>CO₂: GWP = 1</div>
                                        <div>CH₄: GWP = {model === 'AR5' ? '28' : '29.8'}</div>
                                        <div>N₂O: GWP = {model === 'AR5' ? '265' : '273'}</div>
                                        <div>SF₆: GWP = {model === 'AR5' ? '23,500' : '25,200'}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </details>
            </div>

            {/* P2-7: PCR 참조 관리 (ISO 14067 7.3 s) */}
            <div className="border border-slate-700/50 rounded-lg bg-slate-900/50 overflow-hidden">
                <details className="group" open={pcrReferences.length > 0 || !!appliedPCR}>
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-amber-400" />
                            <h3 className="text-lg font-medium text-slate-200">PCR 참조</h3>
                            {pcrReferences.length > 0 && (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
                                    {pcrReferences.length}건
                                </span>
                            )}
                            {appliedPCR && (
                                <span className="ml-1 text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                                    ✅ 어드바이저 적용
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span>ISO 14067 7.3 s</span>
                            <ChevronDown className="h-4 w-4 group-open:rotate-180 transition-transform" />
                        </div>
                    </summary>
                    <div className="p-4 pt-0 border-t border-slate-700/50 bg-zinc-950/50 space-y-4">
                        <div className="text-sm text-slate-300 bg-amber-500/10 p-3 rounded-md border border-amber-500/20">
                            <Info className="h-4 w-4 inline mr-1.5 mb-0.5 text-amber-400" />
                            <span className="font-medium">ISO 14067:</span> 관련 PCR이 존재하면 <span className="text-amber-300 font-medium">반드시 채택</span>해야 하며,
                            여러 PCR 존재 시 비교 후 <span className="text-amber-300 font-medium">선택 이유를 정당화</span>해야 합니다.
                        </div>

                        {/* PCR 어드바이저 바로가기 */}
                        <button
                            onClick={() => setShowPCRAdvisor(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 hover:from-amber-500/15 hover:to-orange-500/15 transition-all text-sm font-medium text-amber-300"
                        >
                            <Sparkles className="h-4 w-4" />
                            PCR 스마트 어드바이저로 적합한 PCR 찾기
                            <ArrowRight className="h-4 w-4 ml-1" />
                        </button>

                        {/* 등록된 PCR 목록 */}
                        {pcrReferences.length > 0 && (
                            <div className="space-y-2">
                                {pcrReferences.map(pcr => (
                                    <div key={pcr.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-slate-200 truncate">{pcr.name}</div>
                                            <div className="text-xs text-slate-400 mt-1">
                                                {pcr.operator}
                                                {pcr.version && <span className="ml-2">v{pcr.version}</span>}
                                                {pcr.productCategory && <span className="ml-2 text-amber-400">• {pcr.productCategory}</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removePCRReference(pcr.id)}
                                            className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 프리셋 선택 */}
                        <div>
                            <Label className="text-xs text-slate-400 mb-1.5 block">빠른 추가 (프리셋)</Label>
                            <div className="grid grid-cols-1 gap-1.5">
                                {PCR_PRESETS.filter(p => !pcrReferences.some(r => r.name === p.name)).slice(0, 5).map((preset, i) => (
                                    <button
                                        key={i}
                                        onClick={() => addPCRReference(preset)}
                                        className="flex items-center gap-2 px-3 py-2 text-left text-xs rounded-md bg-slate-800/40 border border-slate-700/40 hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors text-slate-300"
                                    >
                                        <Plus className="h-3 w-3 text-amber-400 flex-shrink-0" />
                                        <span className="truncate">{preset.name}</span>
                                        <span className="text-slate-500 ml-auto flex-shrink-0">{preset.operator}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 직접 입력 */}
                        <div>
                            {!showPCRForm ? (
                                <button
                                    onClick={() => setShowPCRForm(true)}
                                    className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    직접 입력
                                </button>
                            ) : (
                                <div className="space-y-3 p-3 rounded-lg border border-amber-500/20 bg-slate-800/30">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs text-slate-400">PCR 명칭 *</Label>
                                            <Input
                                                value={pcrForm.name}
                                                onChange={e => setPcrForm(p => ({ ...p, name: e.target.value }))}
                                                placeholder="예: UN CPC 211"
                                                className="mt-1 bg-slate-900/50 border-slate-700"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-slate-400">운영 기관 *</Label>
                                            <Input
                                                value={pcrForm.operator}
                                                onChange={e => setPcrForm(p => ({ ...p, operator: e.target.value }))}
                                                placeholder="예: EPD International"
                                                className="mt-1 bg-slate-900/50 border-slate-700"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-slate-400">버전</Label>
                                            <Input
                                                value={pcrForm.version || ''}
                                                onChange={e => setPcrForm(p => ({ ...p, version: e.target.value }))}
                                                placeholder="예: 2019:06 v1.2"
                                                className="mt-1 bg-slate-900/50 border-slate-700"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-slate-400">제품 카테고리</Label>
                                            <Input
                                                value={pcrForm.productCategory || ''}
                                                onChange={e => setPcrForm(p => ({ ...p, productCategory: e.target.value }))}
                                                placeholder="예: 축산물"
                                                className="mt-1 bg-slate-900/50 border-slate-700"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => { setShowPCRForm(false); setPcrForm({ name: '', operator: '' }) }}
                                            className="px-3 py-1.5 text-xs rounded-md text-slate-400 hover:text-slate-200 transition-colors"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (pcrForm.name && pcrForm.operator) {
                                                    addPCRReference(pcrForm)
                                                    setPcrForm({ name: '', operator: '' })
                                                    setShowPCRForm(false)
                                                }
                                            }}
                                            disabled={!pcrForm.name || !pcrForm.operator}
                                            className="px-3 py-1.5 text-xs rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            추가
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </details>
            </div>

            {/* PCR 어드바이저 위자드 모달 — 최상위 레벨에 배치하여 스크롤 컨텍스트 밖에서 렌더링 */}
            <PCRAdvisorWizard
                open={showPCRAdvisor}
                onOpenChange={setShowPCRAdvisor}
                currentCategory={productInfo.category || 'other'}
                onApplyPCR={handleApplyPCR}
            />
        </div >
    )
}

// =============================================================================
// 헬퍼 컴포넌트
// =============================================================================

function BoundaryIcon({ type }: { type: BoundaryType }) {
    switch (type) {
        case 'cradle-to-gate':
            return (
                <div className="flex items-center gap-0.5 text-primary">
                    <Package className="h-4 w-4" />
                    <ArrowRight className="h-3 w-3" />
                    <Factory className="h-4 w-4" />
                </div>
            )
        case 'cradle-to-grave':
            return (
                <div className="flex items-center gap-0.5 text-primary">
                    <Package className="h-4 w-4" />
                    <ArrowRight className="h-3 w-3" />
                    <Recycle className="h-4 w-4" />
                </div>
            )
        case 'gate-to-gate':
            return (
                <div className="flex items-center gap-0.5 text-primary">
                    <Factory className="h-4 w-4" />
                </div>
            )
        default:
            return <Package className="h-4 w-4" />
    }
}

function getStageLabel(stageId: string): string {
    const labels: Record<string, string> = {
        raw_materials: '원료',
        manufacturing: '제조',
        transport: '운송',
        packaging: '포장',
        use: '사용',
        eol: '폐기'
    }
    return labels[stageId] || stageId
}
