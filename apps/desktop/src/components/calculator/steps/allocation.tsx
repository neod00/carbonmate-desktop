'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePCFStore } from '@/lib/store'
import { ProGate } from '@/components/subscription/pro-gate'
import { FEATURES } from '@/lib/subscription'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    MULTI_OUTPUT_ALLOCATION_METHODS,
    PHYSICAL_ALLOCATION_BASIS_OPTIONS,
    RECYCLING_ALLOCATION_METHODS,
    MultiOutputAllocationMethod,
    RecyclingAllocationMethod,
    PhysicalAllocationBasis,
    calculatePhysicalAllocation,
    CoProduct,
    matchAllocationRule,
    getRecommendation,
    generateShortJustification,
    generateJustificationForMethod,
    AllocationRule,
    AllocationRecommendation,
    resolveMultiOutputAllocation,
    IntegratedAllocationResult,
    AllocationCalculationResult,
    UnitProcess,
    ProcessFlow,
    // 새로운 산업군 기본값/가이드 모듈
    MULTI_OUTPUT_DECISION_TREE,
    DecisionNode,
    DecisionResult,
    FIELD_GUIDES,
    INDUSTRY_PROXIES,
    IndustryProxy,
    EASY_METHOD_DESCRIPTIONS,
    EASY_RECYCLING_DESCRIPTIONS,
    REQUIRED_FIELDS_BY_METHOD,
    OPTIONAL_FIELDS_BY_METHOD,
    getMethodKey
} from '@/lib/allocation'
import {
    Scale,
    Recycle,
    Plus,
    Trash2,
    Info,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    CheckCircle,
    HelpCircle,
    Scissors,
    RefreshCw,
    ArrowLeftRight,
    Sparkles,
    TrendingDown,
    Leaf,
    Factory,
    Search,
    Wand2,
    FileText,
    Shield,
    BarChart3,
    Calculator,
    Zap,
    MessageCircleQuestion,
    Lightbulb,
    ChevronRight,
    RotateCcw,
    Eye,
    EyeOff,
    BookOpen
} from 'lucide-react'

// =============================================================================
// 인라인 도움말 툴팁 컴포넌트
// =============================================================================
const FieldHelpTooltip = ({ fieldKey }: { fieldKey: string }) => {
    const [open, setOpen] = useState(false)
    const guide = FIELD_GUIDES[fieldKey]
    if (!guide) return null

    return (
        <div className="relative inline-block">
            <button
                type="button"
                onClick={(e) => { e.preventDefault(); setOpen(!open) }}
                className="ml-1.5 text-muted-foreground hover:text-violet-400 transition-colors"
                aria-label="도움말"
            >
                <HelpCircle className="w-3.5 h-3.5" />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        className="absolute z-50 left-0 top-6 w-72 p-3 bg-popover border border-border rounded-xl shadow-2xl text-xs space-y-1.5"
                    >
                        <p className="text-slate-200 font-medium">{guide.icon} {guide.label}</p>
                        <p className="text-slate-400">{guide.helpText}</p>
                        <p className="text-violet-400/80 italic">{guide.example}</p>
                        <p className="text-muted-foreground/70 border-t border-border pt-1.5 mt-1.5">📂 {guide.dataSource}</p>
                        <button onClick={() => setOpen(false)} className="absolute top-1.5 right-2 text-slate-500 hover:text-slate-300">✕</button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// =============================================================================
// 산업군 프록시 참조 패널
// =============================================================================
const IndustryProxyPanel = ({ onSelectProxy }: { onSelectProxy?: (proxy: IndustryProxy) => void }) => {
    const [selectedSector, setSelectedSector] = useState<string | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const selected = INDUSTRY_PROXIES.find(p => p.sectorId === selectedSector)

    return (
        <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between"
            >
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-medium text-violet-400">산업군별 참고 데이터</span>
                    <span className="text-xs text-muted-foreground">— 값을 모를 때 참고하세요</span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-wrap gap-2 mt-4 mb-3">
                            {INDUSTRY_PROXIES.map(p => (
                                <button
                                    key={p.sectorId}
                                    onClick={() => { setSelectedSector(p.sectorId); onSelectProxy?.(p) }}
                                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${selectedSector === p.sectorId
                                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                                        : 'bg-muted/50 border-border text-muted-foreground hover:border-violet-500/30'
                                        }`}
                                >
                                    {p.sectorIcon} {p.sectorName}
                                </button>
                            ))}
                        </div>

                        {selected && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-3"
                            >
                                <p className="text-xs text-slate-400">{selected.description}</p>

                                {/* 대표 공동 제품 */}
                                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                                    <p className="text-xs font-medium text-slate-300 mb-2">📦 대표적 공동 제품 / 부산물</p>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-border">
                                                    <th className="text-left py-1.5 px-2 text-slate-500 font-medium">제품</th>
                                                    <th className="text-right py-1.5 px-2 text-slate-500 font-medium">질량 비율</th>
                                                    <th className="text-right py-1.5 px-2 text-slate-500 font-medium">에너지 비율</th>
                                                    <th className="text-right py-1.5 px-2 text-slate-500 font-medium">경제적 비율</th>
                                                    <th className="text-left py-1.5 px-2 text-slate-500 font-medium">비고</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selected.typicalCoProducts.map((cp, i) => (
                                                    <tr key={i} className="border-b border-border/60">
                                                        <td className="py-1.5 px-2 text-slate-300">{cp.name}</td>
                                                        <td className="py-1.5 px-2 text-right text-slate-400">{cp.massRatioRange}</td>
                                                        <td className="py-1.5 px-2 text-right text-slate-400">{cp.energyRatioRange || '-'}</td>
                                                        <td className="py-1.5 px-2 text-right text-slate-400">{cp.economicRatioRange || '-'}</td>
                                                        <td className="py-1.5 px-2 text-slate-500">{cp.note}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 재활용 참고값 */}
                                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                                    <p className="text-xs font-medium text-slate-300 mb-2">♻️ 재활용 파라미터 참고 범위</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-[10px] text-slate-500">재활용 투입율</p>
                                            <p className="text-sm font-mono text-green-400">{selected.typicalRecyclingParams.recycledContentRange}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500">재활용 산출율</p>
                                            <p className="text-sm font-mono text-green-400">{selected.typicalRecyclingParams.recyclabilityRange}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500">품질 유지율</p>
                                            <p className="text-sm font-mono text-green-400">{selected.typicalRecyclingParams.qualityFactorRange}</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2">{selected.typicalRecyclingParams.note}</p>
                                </div>

                                {/* 추천 방법 */}
                                <div className="flex items-center gap-2 p-2 bg-violet-500/10 rounded-lg border border-violet-500/20">
                                    <CheckCircle className="w-3.5 h-3.5 text-violet-400" />
                                    <span className="text-xs text-violet-300">{selected.methodReason}</span>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// 재활용 방법 아이콘 매핑
const RECYCLING_METHOD_ICONS: Record<RecyclingAllocationMethod, React.ElementType> = {
    cut_off: Scissors,
    eol_recycling: RefreshCw,
    fifty_fifty: ArrowLeftRight,
    substitution: Sparkles,
    pef_formula: Leaf
}

// 추천 방법 (상위 3개)
const RECOMMENDED_METHODS: RecyclingAllocationMethod[] = ['cut_off', 'fifty_fifty', 'substitution']
const ADVANCED_METHODS: RecyclingAllocationMethod[] = ['eol_recycling', 'pef_formula']

export const AllocationStep = () => {
    const {
        multiOutputAllocation,
        recyclingAllocation,
        activityData,
        setMultiOutputAllocationMethod,
        setPhysicalAllocationBasis,
        addCoProduct,
        removeCoProduct,
        updateCoProduct,
        setMainProductData,
        setTotalProcessEmission,
        setRecyclingAllocationMethod,
        setRecyclingParams,
        setAllocationJustification
    } = usePCFStore()

    const [expandedSection, setExpandedSection] = useState<'multiOutput' | 'recycling' | null>('recycling')
    const [showGuidance, setShowGuidance] = useState(false)
    const [showAdvancedMethods, setShowAdvancedMethods] = useState(false)
    const [showTechnicalLabels, setShowTechnicalLabels] = useState(false)

    // 사전 질문 상태 (null = 아직 답변 안 함)
    const [needsMultiOutput, setNeedsMultiOutput] = useState<boolean | null>(null)
    const [needsRecycling, setNeedsRecycling] = useState<boolean | null>(null)

    // 의사결정 위자드 상태
    const [wizardActive, setWizardActive] = useState(false)
    const [wizardNodeId, setWizardNodeId] = useState('start')
    const [wizardResult, setWizardResult] = useState<DecisionResult | null>(null)
    const [wizardHistory, setWizardHistory] = useState<string[]>([])

    // 자동 추천 관련 상태
    const [productCategory, setProductCategory] = useState('')
    const [recommendation, setRecommendation] = useState<AllocationRecommendation | null>(null)
    const [matchedRule, setMatchedRule] = useState<AllocationRule | null>(null)
    const [showRecommendation, setShowRecommendation] = useState(false)

    // 통합 할당 시나리오 결과
    const [scenarioResults, setScenarioResults] = useState<AllocationCalculationResult[]>([])
    const [showScenarios, setShowScenarios] = useState(false)
    const [scenarioLoading, setScenarioLoading] = useState(false)

    // 의사결정 위자드 현재 노드
    const currentWizardNode = MULTI_OUTPUT_DECISION_TREE.find(n => n.id === wizardNodeId)

    // 위자드에서 옵션 선택 시
    const handleWizardSelect = (option: typeof MULTI_OUTPUT_DECISION_TREE[0]['options'][0]) => {
        setWizardHistory([...wizardHistory, wizardNodeId])
        if (option.result) {
            setWizardResult(option.result)
            if (option.result.recommendedMethod) {
                setMultiOutputAllocationMethod(option.result.recommendedMethod as MultiOutputAllocationMethod)
                if (option.result.recommendedBasis) {
                    setPhysicalAllocationBasis(option.result.recommendedBasis as PhysicalAllocationBasis)
                }
            }
        } else if (option.nextNodeId) {
            setWizardNodeId(option.nextNodeId)
        }
    }

    // 위자드 뒤로 가기
    const handleWizardBack = () => {
        if (wizardHistory.length > 0) {
            const prev = wizardHistory[wizardHistory.length - 1]
            setWizardHistory(wizardHistory.slice(0, -1))
            setWizardNodeId(prev)
            setWizardResult(null)
        }
    }

    // 위자드 초기화
    const handleWizardReset = () => {
        setWizardNodeId('start')
        setWizardHistory([])
        setWizardResult(null)
    }

    // 스마트 필드: 현재 방법에 필요한 필드만 표시
    const methodKey = getMethodKey(multiOutputAllocation.method, multiOutputAllocation.physicalBasis)
    const requiredFields = REQUIRED_FIELDS_BY_METHOD[methodKey] || REQUIRED_FIELDS_BY_METHOD['physical_mass'] || []
    const optionalFields = OPTIONAL_FIELDS_BY_METHOD[methodKey] || []

    // 제품 카테고리로 할당 추천 받기
    const handleGetRecommendation = () => {
        if (!productCategory.trim()) return

        const match = matchAllocationRule(productCategory)
        if (match.rule) {
            setMatchedRule(match.rule)
            setRecommendation(getRecommendation(match.rule))
            setShowRecommendation(true)
        } else {
            setMatchedRule(null)
            setRecommendation(null)
            setShowRecommendation(false)
        }
    }

    // 추천 적용하기
    const applyRecommendation = () => {
        if (!matchedRule) return

        // P1-9 회귀 수정: multiOutput과 recycling은 서로 다른 방법일 수 있으므로
        // 각 방법에 맞는 정당화 문구를 별도 생성한다.
        // 사용자의 현재 선택(스토어)을 우선하고, 없으면 룰의 추천 방법을 사용.
        const moMethod = multiOutputAllocation.method || matchedRule.allocation.multiOutput.preferred
        const recMethod = recyclingAllocation.method || matchedRule.allocation.recycling.preferred

        const moJustification = generateJustificationForMethod('multiOutput', moMethod, 'ko')
        const recJustification = generateJustificationForMethod('recycling', recMethod, 'ko')

        setAllocationJustification('multiOutput', moJustification)
        setAllocationJustification('recycling', recJustification)
    }

    // 공동 제품 추가 폼 상태
    const [newCoProduct, setNewCoProduct] = useState<Partial<CoProduct>>({
        name: '',
        quantity: 0,
        unit: 'kg',
        allocationValue: 0,
        allocationUnit: 'kg',
        energyContent: undefined,
        economicValue: undefined,
        carbonContent: undefined
    })

    // 공동 제품이 있는지 여부
    const hasCoProducts = multiOutputAllocation.coProducts.length > 0

    // 주제품 데이터
    const mainProductData = multiOutputAllocation.mainProductData
    const totalProcessEmission = multiOutputAllocation.totalProcessEmission || 0

    // 공동 제품 추가
    const handleAddCoProduct = () => {
        if (newCoProduct.name && (newCoProduct.quantity ?? 0) > 0) {
            addCoProduct({
                id: `coproduct_${Date.now()}`,
                name: newCoProduct.name || '',
                quantity: newCoProduct.quantity || 0,
                unit: newCoProduct.unit || 'kg',
                allocationValue: newCoProduct.allocationValue || 0,
                allocationUnit: newCoProduct.allocationUnit || 'kg',
                energyContent: newCoProduct.energyContent,
                economicValue: newCoProduct.economicValue,
                carbonContent: newCoProduct.carbonContent
            })
            setNewCoProduct({
                name: '',
                quantity: 0,
                unit: 'kg',
                allocationValue: 0,
                allocationUnit: 'kg',
                energyContent: undefined,
                economicValue: undefined,
                carbonContent: undefined
            })
        }
    }

    // 할당 비율 계산 (실제 주제품 데이터 사용)
    const allocationShares = useMemo(() => {
        if (!hasCoProducts) return null

        const mainValue = mainProductData?.mass || 100
        const coProductValues = multiOutputAllocation.coProducts.map(p => ({
            value: p.allocationValue
        }))

        return calculatePhysicalAllocation(
            { value: mainValue },
            coProductValues
        )
    }, [hasCoProducts, multiOutputAllocation.coProducts, mainProductData])

    // 예상 효과 계산
    const estimatedEffect = useMemo(() => {
        const recycledIn = recyclingAllocation.recycledContentInput
        const recycledOut = recyclingAllocation.recyclabilityOutput
        const method = recyclingAllocation.method

        // 가상의 기준 배출량 (버진 원료 1kg 기준)
        const baseEmission = 2.0 // kg CO2e/kg

        let virginBurden = 1 - recycledIn
        let disposalBurden = 1 - recycledOut
        let creditEffect = 0

        switch (method) {
            case 'cut_off':
                // 재활용 투입의 부담 없음
                creditEffect = 0
                break
            case 'substitution':
                // 재활용 산출에 대한 크레딧
                creditEffect = recycledOut * baseEmission * (recyclingAllocation.qualityFactorOutput || 1)
                break
            case 'fifty_fifty':
                virginBurden = 0.5 * (1 - recycledIn)
                disposalBurden = 0.5 * (1 - recycledOut)
                break
            case 'pef_formula':
                // PEF는 복잡한 계산, 간소화
                creditEffect = 0.5 * recycledOut * baseEmission
                break
            default:
                break
        }

        return {
            virginBurden: virginBurden * 100,
            disposalBurden: disposalBurden * 100,
            creditEffect: creditEffect,
            netEffect: creditEffect > 0 ? -creditEffect : 0
        }
    }, [recyclingAllocation])

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <Scale className="w-6 h-6 text-primary" />
                        배출량 배분 설정
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        제품별 환경 부담을 공정하게 나누는 방법을 설정합니다
                        {showTechnicalLabels && <span className="text-xs ml-2 text-primary/60">(ISO 14067 6.4.6)</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* 기술 용어 표시 토글 */}
                    <button
                        onClick={() => setShowTechnicalLabels(!showTechnicalLabels)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${showTechnicalLabels
                            ? 'bg-muted/60 border-border text-foreground/90'
                            : 'bg-transparent border-border/50 text-muted-foreground hover:border-border'
                            }`}
                        title="기술 용어 표시/숨기기"
                    >
                        {showTechnicalLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {showTechnicalLabels ? '기술 용어 ON' : '기술 용어 OFF'}
                    </button>
                    <button
                        onClick={() => setShowGuidance(!showGuidance)}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
                    >
                        <BookOpen className="w-4 h-4" />
                        가이드
                    </button>
                </div>
            </div>

            {/* 의사결정 위자드 */}
            <ProGate feature={FEATURES.ALLOCATION_WIZARD} inline featureName="할당 의사결정 위저드">
                {!wizardActive && !wizardResult && (
                    <Card className="border-violet-500/30 bg-gradient-to-r from-violet-500/5 to-indigo-500/5">
                        <CardContent className="pt-5 pb-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-violet-500/20">
                                        <MessageCircleQuestion className="w-5 h-5 text-violet-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground text-sm">어떤 할당 방법을 써야 할지 모르겠다면?</h3>
                                        <p className="text-xs text-muted-foreground">간단한 질문 3~4개에 답하면 적합한 방법을 추천해 드립니다</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setWizardActive(true)}
                                    className="px-4 py-2 text-sm bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium flex items-center gap-2"
                                >
                                    <Wand2 className="w-4 h-4" />
                                    추천 받기
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </ProGate>

            {/* 위자드 진행 중 */}
            <AnimatePresence>
                {wizardActive && !wizardResult && currentWizardNode && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Card className="border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 ring-2 ring-violet-500/20">
                            <CardContent className="pt-6 space-y-5">
                                {/* 위자드 진행 상태 */}
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="flex items-center gap-1">
                                        {wizardHistory.map((_, i) => (
                                            <div key={i} className="w-2 h-2 rounded-full bg-violet-400" />
                                        ))}
                                        <div className="w-2.5 h-2.5 rounded-full bg-violet-500 ring-2 ring-violet-500/30" />
                                    </div>
                                    <span className="text-xs text-violet-400/80 ml-1">질문 {wizardHistory.length + 1}</span>
                                    <button
                                        onClick={() => { setWizardActive(false); handleWizardReset() }}
                                        className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        닫기 ✕
                                    </button>
                                </div>

                                {/* 질문 */}
                                <div className="text-center space-y-2">
                                    <span className="text-3xl">{currentWizardNode.icon}</span>
                                    <h3 className="text-lg font-bold text-foreground">{currentWizardNode.question}</h3>
                                    <p className="text-sm text-muted-foreground max-w-lg mx-auto">{currentWizardNode.helpText}</p>
                                </div>

                                {/* 응답 옵션 */}
                                <div className="space-y-2">
                                    {currentWizardNode.options.map((option, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleWizardSelect(option)}
                                            className="w-full p-4 text-left rounded-xl border border-border/50 bg-background/30 hover:bg-violet-500/10 hover:border-violet-500/40 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                                                <div>
                                                    <p className="font-medium text-sm text-foreground group-hover:text-violet-300 transition-colors">{option.label}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* 뒤로 가기 */}
                                {wizardHistory.length > 0 && (
                                    <button onClick={handleWizardBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        이전 질문으로
                                    </button>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 위자드 결과 */}
            <AnimatePresence>
                {wizardResult && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >
                        <Card className={`border-2 ${wizardResult.multiOutputNeeded ? 'border-violet-500/50 bg-violet-500/5' : 'border-green-500/50 bg-green-500/5'}`}>
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg ${wizardResult.multiOutputNeeded ? 'bg-violet-500/20' : 'bg-green-500/20'}`}>
                                        <CheckCircle className={`w-5 h-5 ${wizardResult.multiOutputNeeded ? 'text-violet-400' : 'text-green-400'}`} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-foreground mb-1">
                                            {wizardResult.multiOutputNeeded ? '✅ 다중 출력 할당이 필요합니다' : '✅ 할당이 필요하지 않습니다'}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">{wizardResult.explanation}</p>
                                        {wizardResult.recommendedMethod && (
                                            <div className="mt-3 flex items-center gap-2 p-2.5 bg-violet-500/10 rounded-lg border border-violet-500/20">
                                                <Wand2 className="w-4 h-4 text-violet-400" />
                                                <span className="text-sm text-violet-300 font-medium">
                                                    추천: {EASY_METHOD_DESCRIPTIONS[wizardResult.recommendedMethod]?.easyName || wizardResult.recommendedMethod}
                                                    {wizardResult.recommendedBasis && ` (${wizardResult.recommendedBasis})`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => { setWizardResult(null); setWizardActive(false); handleWizardReset() }}
                                        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors"
                                    >
                                        다시하기
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI 자동 추천 패널 */}
            <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                            <Wand2 className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">AI 할당 방법 추천</h3>
                            <p className="text-xs text-muted-foreground">제품 유형을 입력하면 ISO/PCR 기반 할당 방법을 추천해드립니다</p>
                        </div>
                    </div>

                    <div className="flex gap-3 mb-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="제품 유형 입력 (예: 철강, 배터리, 플라스틱, 시멘트...)"
                                value={productCategory}
                                onChange={(e) => setProductCategory(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGetRecommendation()}
                                className="w-full pl-10 pr-4 py-3 border border-border/50 rounded-xl bg-background/50 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                            />
                        </div>
                        <button
                            onClick={handleGetRecommendation}
                            className="px-5 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
                        >
                            <Wand2 className="w-4 h-4" />
                            추천받기
                        </button>
                    </div>

                    {/* 추천 결과 */}
                    <AnimatePresence>
                        {showRecommendation && matchedRule && recommendation && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                            >
                                <div className="p-4 bg-background/50 rounded-xl border border-purple-500/30">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                        <span className="font-semibold text-green-400">매칭된 산업군: {matchedRule.industrySector.replace('_', ' ').toUpperCase()}</span>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        {/* 다중 출력 추천 */}
                                        <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Factory className="w-4 h-4 text-indigo-400" />
                                                <span className="text-sm font-medium text-indigo-400">다중 출력 할당</span>
                                            </div>
                                            <p className="text-sm text-foreground font-semibold mb-1">
                                                {recommendation.multiOutput.method.replace('_', ' ').toUpperCase()}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                기준: {recommendation.multiOutput.basis}
                                            </p>
                                        </div>

                                        {/* 재활용 추천 */}
                                        <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Recycle className="w-4 h-4 text-green-400" />
                                                <span className="text-sm font-medium text-green-400">재활용 할당</span>
                                            </div>
                                            <p className="text-sm text-foreground font-semibold mb-1">
                                                {recommendation.recycling.method.replace('_', ' ').toUpperCase()}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                PEF 필수: {recommendation.recycling.pefRequired ? '예' : '아니오'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* EU 규제 정보 */}
                                    {recommendation.euCompliance && recommendation.euCompliance.length > 0 && (
                                        <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Shield className="w-4 h-4 text-amber-400" />
                                                <span className="text-sm font-medium text-amber-400">EU 규제 준수 정보</span>
                                            </div>
                                            <div className="space-y-1">
                                                {recommendation.euCompliance.map((reg, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-xs">
                                                        <span className={`px-2 py-0.5 rounded ${reg.mandatory ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                            {reg.mandatory ? '필수' : '권장'}
                                                        </span>
                                                        <span className="text-foreground">{reg.regulation}</span>
                                                        <span className="text-muted-foreground">({reg.effectiveDate})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 적용 버튼 */}
                                    <div className="mt-4 flex items-center gap-3">
                                        <button
                                            onClick={applyRecommendation}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
                                        >
                                            <FileText className="w-4 h-4" />
                                            정당화 문구 적용
                                        </button>
                                        <span className="text-xs text-muted-foreground">
                                            추천된 할당 방법의 정당화 문구가 자동 생성됩니다
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>

            <AnimatePresence>
                {showGuidance && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Card className="border-primary/30 bg-primary/5">
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-primary/10">
                                        <Info className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <h4 className="font-semibold text-foreground mb-2">ISO 14067 할당 우선순위</h4>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="p-3 bg-background/50 rounded-lg border border-border/50">
                                                    <p className="font-medium text-sm text-green-600 mb-2">1단계: 할당 회피 (가장 권장)</p>
                                                    <ul className="text-sm text-muted-foreground space-y-1">
                                                        <li>• 하위 분할: 공정을 각 제품별로 분리</li>
                                                        <li>• 시스템 확장: 대체 생산 고려</li>
                                                    </ul>
                                                </div>
                                                <div className="p-3 bg-background/50 rounded-lg border border-border/50">
                                                    <p className="font-medium text-sm text-amber-600 mb-2">2단계: 할당 필요시</p>
                                                    <ul className="text-sm text-muted-foreground space-y-1">
                                                        <li>• 물리적 관계 기반 (질량, 에너지)</li>
                                                        <li>• 경제적 관계 기반 (가격)</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
                                            ※ 선택한 할당 방법과 정당화 사유는 CFP 보고서에 포함되어야 합니다.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== 사전 질문 카드: 다중 산출물 ===== */}
            {needsMultiOutput === null ? (
                <Card className="border-indigo-500/20 bg-indigo-500/5">
                    <CardContent className="pt-5 pb-5">
                        <div className="flex items-start gap-4">
                            <div className="p-2.5 rounded-xl bg-indigo-500/15">
                                <Factory className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div className="flex-1 space-y-3">
                                <div>
                                    <h3 className="font-semibold text-sm">공정에서 부산물이나 공동 제품이 발생합니까?</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        하나의 공정에서 주제품 외에 다른 제품이 함께 생산되면 배출량을 나눠야 합니다.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setNeedsMultiOutput(true)}
                                        className="px-4 py-1.5 text-sm font-medium rounded-lg bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors"
                                    >
                                        예, 있습니다
                                    </button>
                                    <button
                                        onClick={() => setNeedsMultiOutput(false)}
                                        className="px-4 py-1.5 text-sm font-medium rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                                    >
                                        아니오
                                    </button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : needsMultiOutput === false ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Factory className="w-4 h-4" />
                        <span>다중 산출물 할당 — <span className="text-foreground font-medium">해당 없음</span></span>
                    </div>
                    <button
                        onClick={() => setNeedsMultiOutput(null)}
                        className="text-xs text-primary hover:underline"
                    >
                        변경
                    </button>
                </div>
            ) : null}

            {/* 다중 출력 프로세스 할당 */}
            {needsMultiOutput === true && (
                <Card className={`transition-all ${expandedSection === 'multiOutput' ? 'ring-2 ring-indigo-500/30' : ''}`}>
                    <button
                        onClick={() => setExpandedSection(expandedSection === 'multiOutput' ? null : 'multiOutput')}
                        className="w-full"
                    >
                        <CardHeader className="flex flex-row items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-indigo-500/10">
                                    <Factory className="w-6 h-6 text-indigo-500" />
                                </div>
                                <div className="text-left">
                                    <CardTitle className="text-lg">
                                        {showTechnicalLabels ? '다중 출력 프로세스 할당 (Multi-Output Allocation)' : '🏭 여러 제품이 나오는 공정의 배출량 배분'}
                                    </CardTitle>
                                    <CardDescription>
                                        {showTechnicalLabels ? '공동 제품이 있는 경우 환경 부하 배분' : '하나의 공정에서 제품이 2개 이상 나올 때, 배출량을 어떻게 나눌지 설정합니다'}
                                    </CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setNeedsMultiOutput(null); }}
                                    className="px-2.5 py-1 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-md transition-colors"
                                >
                                    변경
                                </button>
                                {hasCoProducts ? (
                                    <span className="px-3 py-1.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium">
                                        {multiOutputAllocation.coProducts.length}개 공동제품
                                    </span>
                                ) : (
                                    <span className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-full">
                                        해당없음
                                    </span>
                                )}
                                {expandedSection === 'multiOutput' ? (
                                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                            </div>
                        </CardHeader>
                    </button>

                    <AnimatePresence>
                        {expandedSection === 'multiOutput' && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <CardContent className="border-t space-y-6 pt-6">
                                    {/* 할당 방법 선택 */}
                                    <div>
                                        <label className="block text-sm font-medium mb-3">
                                            {showTechnicalLabels ? '할당 방법 (Allocation Method)' : '배분 방법 선택'}
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            {(Object.entries(MULTI_OUTPUT_ALLOCATION_METHODS) as [MultiOutputAllocationMethod, typeof MULTI_OUTPUT_ALLOCATION_METHODS[MultiOutputAllocationMethod]][]).map(([key, method]) => {
                                                const easy = EASY_METHOD_DESCRIPTIONS[key]
                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => setMultiOutputAllocationMethod(key)}
                                                        className={`p-4 rounded-xl border-2 text-left transition-all ${multiOutputAllocation.method === key
                                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                                                            : 'border-border hover:border-indigo-300 hover:bg-muted/50'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-2">
                                                            {easy && <span className="text-lg">{easy.icon}</span>}
                                                            <span className={`font-semibold ${multiOutputAllocation.method === key ? 'text-indigo-700 dark:text-indigo-400' : 'text-foreground'
                                                                }`}>
                                                                {showTechnicalLabels ? method.nameKo : (easy?.easyName || method.nameKo)}
                                                            </span>
                                                            {method.isAvoidance && (
                                                                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-medium">
                                                                    ISO 권장
                                                                </span>
                                                            )}
                                                            {easy && (
                                                                <span className={`ml-auto px-1.5 py-0.5 text-[10px] rounded font-medium ${easy.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                                                                    easy.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                                        'bg-red-500/20 text-red-400'
                                                                    }`}>
                                                                    {easy.difficulty === 'easy' ? '쉬움' : easy.difficulty === 'medium' ? '보통' : '고급'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {showTechnicalLabels ? method.descriptionKo : (easy?.oneLiner || method.descriptionKo)}
                                                        </p>
                                                        {multiOutputAllocation.method === key && easy && (
                                                            <p className="text-xs text-indigo-400/80 mt-2 pt-2 border-t border-indigo-500/20 italic">
                                                                💡 {easy.whatHappens}
                                                            </p>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* 산업군별 참고 데이터 */}
                                    <ProGate feature={FEATURES.INDUSTRY_PROXY} inline featureName="산업군 프록시 데이터">
                                        <IndustryProxyPanel />
                                    </ProGate>

                                    {/* 물리적 할당 기준 */}
                                    {multiOutputAllocation.method === 'physical' && (
                                        <div>
                                            <label className="block text-sm font-medium mb-2">물리적 할당 기준</label>
                                            <select
                                                value={multiOutputAllocation.physicalBasis}
                                                onChange={(e) => setPhysicalAllocationBasis(e.target.value as PhysicalAllocationBasis)}
                                                className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            >
                                                {(Object.entries(PHYSICAL_ALLOCATION_BASIS_OPTIONS) as [PhysicalAllocationBasis, typeof PHYSICAL_ALLOCATION_BASIS_OPTIONS[PhysicalAllocationBasis]][]).map(([key, option]) => (
                                                    <option key={key} value={key}>
                                                        {option.nameKo} ({option.unit}) - {option.description}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* 공동 제품 관리 */}
                                    {(multiOutputAllocation.method === 'physical' || multiOutputAllocation.method === 'economic') && (
                                        <div className="space-y-6">
                                            {/* === 주 제품 정보 입력 === */}
                                            <div className="p-5 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-xl border border-blue-500/20">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Factory className="w-5 h-5 text-blue-500" />
                                                    <h4 className="font-semibold text-foreground">
                                                        {showTechnicalLabels ? '주 제품 정보 (Main Product Data)' : '📦 주 제품 정보'}
                                                    </h4>
                                                    <span className="text-xs text-muted-foreground ml-auto">
                                                        {showTechnicalLabels ? '할당 기준값 입력' : '선택한 방법에 필요한 값만 입력하세요'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                    {/* 제품명 — 항상 표시 */}
                                                    {requiredFields.includes('mainProductName') && (
                                                        <div>
                                                            <label className="flex items-center text-xs text-muted-foreground mb-1">
                                                                {showTechnicalLabels ? '제품명' : FIELD_GUIDES.mainProductName?.label || '제품명'}
                                                                <FieldHelpTooltip fieldKey="mainProductName" />
                                                                <span className="ml-1 text-red-400">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder={FIELD_GUIDES.mainProductName?.example?.substring(0, 30) || '주 제품명'}
                                                                value={mainProductData?.name || ''}
                                                                onChange={(e) => setMainProductData({ name: e.target.value })}
                                                                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                            />
                                                        </div>
                                                    )}
                                                    {/* 질량 — 물리적/경제적 할당 시 필수 */}
                                                    {requiredFields.includes('mainProductMass') && (
                                                        <div>
                                                            <label className="flex items-center text-xs text-muted-foreground mb-1">
                                                                {showTechnicalLabels ? '질량 (kg)' : FIELD_GUIDES.mainProductMass?.label || '질량'}
                                                                <FieldHelpTooltip fieldKey="mainProductMass" />
                                                                <span className="ml-1 text-red-400">*</span>
                                                            </label>
                                                            <input
                                                                type="number"
                                                                placeholder="0"
                                                                value={mainProductData?.mass || ''}
                                                                onChange={(e) => setMainProductData({ mass: parseFloat(e.target.value) || 0 })}
                                                                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                            />
                                                        </div>
                                                    )}
                                                    {/* 에너지 함량 — 에너지 할당 시 필수, 그 외 선택 */}
                                                    {(requiredFields.includes('mainProductEnergy') || optionalFields.includes('mainProductEnergy')) && (
                                                        <div>
                                                            <label className="flex items-center text-xs text-muted-foreground mb-1">
                                                                {showTechnicalLabels ? '에너지 함량 (MJ)' : FIELD_GUIDES.mainProductEnergy?.label || '에너지 함량'}
                                                                <FieldHelpTooltip fieldKey="mainProductEnergy" />
                                                                {requiredFields.includes('mainProductEnergy') && <span className="ml-1 text-red-400">*</span>}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                placeholder="선택"
                                                                value={mainProductData?.energyContent || ''}
                                                                onChange={(e) => setMainProductData({ energyContent: parseFloat(e.target.value) || undefined })}
                                                                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                            />
                                                        </div>
                                                    )}
                                                    {/* 단가 — 경제적 할당 시 필수, 그 외 선택 */}
                                                    {(requiredFields.includes('mainProductEconomic') || optionalFields.includes('mainProductEconomic')) && (
                                                        <div>
                                                            <label className="flex items-center text-xs text-muted-foreground mb-1">
                                                                {showTechnicalLabels ? '단가 (원/단위)' : FIELD_GUIDES.mainProductEconomic?.label || '단가'}
                                                                <FieldHelpTooltip fieldKey="mainProductEconomic" />
                                                                {requiredFields.includes('mainProductEconomic') && <span className="ml-1 text-red-400">*</span>}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                placeholder="선택"
                                                                value={mainProductData?.economicValue || ''}
                                                                onChange={(e) => setMainProductData({ economicValue: parseFloat(e.target.value) || undefined })}
                                                                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                            />
                                                        </div>
                                                    )}
                                                    {/* 탄소 함량 — 탄소 할당 시 필수, 그 외 선택 */}
                                                    {(requiredFields.includes('mainProductCarbon') || optionalFields.includes('mainProductCarbon')) && (
                                                        <div>
                                                            <label className="flex items-center text-xs text-muted-foreground mb-1">
                                                                {showTechnicalLabels ? '탄소 함량 (kg C)' : FIELD_GUIDES.mainProductCarbon?.label || '탄소 함량'}
                                                                <FieldHelpTooltip fieldKey="mainProductCarbon" />
                                                                {requiredFields.includes('mainProductCarbon') && <span className="ml-1 text-red-400">*</span>}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                placeholder="선택"
                                                                value={mainProductData?.carbonContent || ''}
                                                                onChange={(e) => setMainProductData({ carbonContent: parseFloat(e.target.value) || undefined })}
                                                                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                            />
                                                        </div>
                                                    )}
                                                    {/* 총 공정 배출량 — 항상 필수 */}
                                                    {requiredFields.includes('totalProcessEmission') && (
                                                        <div>
                                                            <label className="flex items-center text-xs text-muted-foreground mb-1">
                                                                {showTechnicalLabels ? '총 공정 배출량 (kg CO₂e)' : FIELD_GUIDES.totalProcessEmission?.label || '총 공정 배출량'}
                                                                <FieldHelpTooltip fieldKey="totalProcessEmission" />
                                                                <span className="ml-1 text-red-400">*</span>
                                                            </label>
                                                            <input
                                                                type="number"
                                                                placeholder="할당 전 총 배출량"
                                                                value={totalProcessEmission || ''}
                                                                onChange={(e) => setTotalProcessEmission(parseFloat(e.target.value) || 0)}
                                                                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background font-mono"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* === 공동 제품 목록 === */}
                                            <label className="block text-sm font-medium">공동 제품 (Co-products)</label>

                                            {multiOutputAllocation.coProducts.length > 0 && (
                                                <div className="space-y-3">
                                                    {multiOutputAllocation.coProducts.map((product, index) => (
                                                        <div key={product.id} className="p-4 bg-muted/50 rounded-xl border border-border/50">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <span className="font-medium text-sm">{product.name}</span>
                                                                <div className="flex items-center gap-3">
                                                                    {allocationShares && (
                                                                        <span className="text-indigo-600 font-semibold text-sm">
                                                                            {(allocationShares.coProductShares[index] * 100).toFixed(1)}%
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        onClick={() => removeCoProduct(product.id)}
                                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                                <div>
                                                                    <label className="text-[10px] text-muted-foreground">수량</label>
                                                                    <div className="text-sm">{product.quantity} {product.unit}</div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] text-muted-foreground">질량 (kg)</label>
                                                                    <input
                                                                        type="number"
                                                                        value={product.allocationValue || ''}
                                                                        onChange={(e) => updateCoProduct(product.id, { allocationValue: parseFloat(e.target.value) || 0 })}
                                                                        className="w-full px-2 py-1 border border-border/50 rounded text-sm bg-background"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] text-muted-foreground">에너지 (MJ)</label>
                                                                    <input
                                                                        type="number"
                                                                        value={product.energyContent || ''}
                                                                        onChange={(e) => updateCoProduct(product.id, { energyContent: parseFloat(e.target.value) || undefined })}
                                                                        className="w-full px-2 py-1 border border-border/50 rounded text-sm bg-background"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] text-muted-foreground">단가 (원)</label>
                                                                    <input
                                                                        type="number"
                                                                        value={product.economicValue || ''}
                                                                        onChange={(e) => updateCoProduct(product.id, { economicValue: parseFloat(e.target.value) || undefined })}
                                                                        className="w-full px-2 py-1 border border-border/50 rounded text-sm bg-background"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] text-muted-foreground">탄소 (kg C)</label>
                                                                    <input
                                                                        type="number"
                                                                        value={product.carbonContent || ''}
                                                                        onChange={(e) => updateCoProduct(product.id, { carbonContent: parseFloat(e.target.value) || undefined })}
                                                                        className="w-full px-2 py-1 border border-border/50 rounded text-sm bg-background"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* 새 공동 제품 추가 폼 */}
                                            <div className="p-4 border border-dashed border-indigo-300/50 rounded-xl">
                                                <p className="text-xs text-muted-foreground mb-3">새 공동 제품 추가</p>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                                    <input
                                                        type="text"
                                                        placeholder="제품명"
                                                        value={newCoProduct.name}
                                                        onChange={(e) => setNewCoProduct({ ...newCoProduct, name: e.target.value })}
                                                        className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="수량"
                                                        value={newCoProduct.quantity || ''}
                                                        onChange={(e) => setNewCoProduct({ ...newCoProduct, quantity: parseFloat(e.target.value) || 0 })}
                                                        className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="질량 (kg)"
                                                        value={newCoProduct.allocationValue || ''}
                                                        onChange={(e) => setNewCoProduct({ ...newCoProduct, allocationValue: parseFloat(e.target.value) || 0 })}
                                                        className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="에너지 (MJ)"
                                                        value={newCoProduct.energyContent || ''}
                                                        onChange={(e) => setNewCoProduct({ ...newCoProduct, energyContent: parseFloat(e.target.value) || undefined })}
                                                        className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    <input
                                                        type="number"
                                                        placeholder="단가 (원/단위)"
                                                        value={newCoProduct.economicValue || ''}
                                                        onChange={(e) => setNewCoProduct({ ...newCoProduct, economicValue: parseFloat(e.target.value) || undefined })}
                                                        className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="탄소 함량 (kg C)"
                                                        value={newCoProduct.carbonContent || ''}
                                                        onChange={(e) => setNewCoProduct({ ...newCoProduct, carbonContent: parseFloat(e.target.value) || undefined })}
                                                        className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
                                                    />
                                                    <div />
                                                    <button
                                                        onClick={handleAddCoProduct}
                                                        disabled={!newCoProduct.name || !(newCoProduct.quantity && newCoProduct.quantity > 0)}
                                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        추가
                                                    </button>
                                                </div>
                                            </div>


                                            {allocationShares && hasCoProducts && (
                                                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className="w-5 h-5 text-indigo-600" />
                                                        <span className="text-indigo-700 dark:text-indigo-400 font-medium">
                                                            주 제품 할당 비율: {(allocationShares.mainShare * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 통합 할당 시나리오 비교 */}
                                            {hasCoProducts && (
                                                <div className="space-y-4 mt-4">
                                                    {/* 입력 상태 검증 메시지 */}
                                                    {(!mainProductData?.mass || !totalProcessEmission) && (
                                                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-sm">
                                                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                                            <span className="text-amber-700 dark:text-amber-400">
                                                                시나리오 비교를 위해 <strong>주 제품 질량</strong>과 <strong>총 공정 배출량</strong>을 입력해주세요.
                                                            </span>
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() => {
                                                            setScenarioLoading(true)
                                                            try {
                                                                // 실제 사용자 입력 데이터로 UnitProcess 구성
                                                                const mainProduct: ProcessFlow = {
                                                                    id: 'main_product',
                                                                    name: mainProductData?.name || '주 제품',
                                                                    quantity: mainProductData?.mass || 100,
                                                                    unit: 'kg',
                                                                    type: 'product',
                                                                    mass: mainProductData?.mass || 100,
                                                                    energyContent: mainProductData?.energyContent,
                                                                    carbonContent: mainProductData?.carbonContent,
                                                                    economicValue: mainProductData?.economicValue
                                                                }
                                                                const coProductFlows: ProcessFlow[] = multiOutputAllocation.coProducts.map(cp => ({
                                                                    id: cp.id,
                                                                    name: cp.name,
                                                                    quantity: cp.quantity,
                                                                    unit: cp.unit,
                                                                    type: 'co_product' as const,
                                                                    mass: cp.allocationValue,
                                                                    energyContent: cp.energyContent,
                                                                    carbonContent: cp.carbonContent,
                                                                    economicValue: cp.economicValue
                                                                }))

                                                                const process: UnitProcess = {
                                                                    id: 'process_1',
                                                                    name: mainProductData?.name || 'Production Process',
                                                                    nameKo: mainProductData?.name || '생산 공정',
                                                                    inputs: [],
                                                                    outputs: [mainProduct, ...coProductFlows],
                                                                    emissions: [{ substance: 'CO2', compartment: 'air', quantity: totalProcessEmission || 100, gwp: 1 }]
                                                                }

                                                                const emission = totalProcessEmission || 100
                                                                const methods = ['physical_mass', 'physical_energy', 'physical_carbon', 'economic'] as const
                                                                const results = methods.map(m => resolveMultiOutputAllocation(process, m, emission))
                                                                setScenarioResults(results)
                                                                setShowScenarios(true)
                                                            } catch (err) {
                                                                console.error('시나리오 계산 오류:', err)
                                                            } finally {
                                                                setScenarioLoading(false)
                                                            }
                                                        }}
                                                        disabled={scenarioLoading || (!mainProductData?.mass || !totalProcessEmission)}
                                                        className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        {scenarioLoading ? (
                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <BarChart3 className="w-4 h-4" />
                                                        )}
                                                        할당 방법별 시나리오 비교 분석
                                                    </button>

                                                    <AnimatePresence>
                                                        {showScenarios && scenarioResults.length > 0 && (
                                                            <motion.div
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                                className="space-y-4"
                                                            >
                                                                {/* 시나리오 비교 카드 */}
                                                                <div className="p-5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-xl border border-indigo-500/20">
                                                                    <div className="flex items-center gap-2 mb-4">
                                                                        <Calculator className="w-5 h-5 text-indigo-500" />
                                                                        <h4 className="font-semibold text-foreground">시나리오 비교 결과</h4>
                                                                        <span className="text-xs text-muted-foreground ml-auto">ISO 14044 4.3.4 할당 위계 기반</span>
                                                                    </div>

                                                                    {/* 할당 비율 비교 테이블 */}
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-sm">
                                                                            <thead>
                                                                                <tr className="border-b border-border/50">
                                                                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">할당 방법</th>
                                                                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">ISO 위계</th>
                                                                                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">주제품 배출량</th>
                                                                                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">주제품 비율</th>
                                                                                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">시각화</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {scenarioResults.map((result, idx) => {
                                                                                    const mainShare = result.allocationShares.find(s => s.productName === '주 제품')?.share ?? 0
                                                                                    const isRecommended = idx === 0 // 질량 할당이 가장 일반적
                                                                                    return (
                                                                                        <tr key={idx} className={`border-b border-border/30 ${isRecommended ? 'bg-indigo-500/5' : ''}`}>
                                                                                            <td className="py-3 px-3">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="font-medium">{result.methodKo}</span>
                                                                                                    {isRecommended && (
                                                                                                        <span className="px-1.5 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-400 rounded font-medium">추천</span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="py-3 px-3">
                                                                                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${result.isoHierarchyLevel === 1 ? 'bg-green-500/20 text-green-500' :
                                                                                                    result.isoHierarchyLevel === 2 ? 'bg-amber-500/20 text-amber-500' :
                                                                                                        'bg-red-500/20 text-red-500'
                                                                                                    }`}>
                                                                                                    {result.isoHierarchyLevel}단계
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-3 px-3 text-right font-mono font-semibold">
                                                                                                {result.mainProductEmission.toFixed(2)} <span className="text-xs text-muted-foreground">kg CO₂e</span>
                                                                                            </td>
                                                                                            <td className="py-3 px-3 text-right font-mono">
                                                                                                {(mainShare * 100).toFixed(1)}%
                                                                                            </td>
                                                                                            <td className="py-3 px-3 w-40">
                                                                                                <div className="h-4 bg-muted/50 rounded-full overflow-hidden">
                                                                                                    <div
                                                                                                        className={`h-full rounded-full transition-all duration-500 ${isRecommended
                                                                                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                                                                                            : 'bg-gradient-to-r from-slate-400 to-slate-500'
                                                                                                            }`}
                                                                                                        style={{ width: `${mainShare * 100}%` }}
                                                                                                    />
                                                                                                </div>
                                                                                            </td>
                                                                                        </tr>
                                                                                    )
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>

                                                                    {/* 민감도 범위 */}
                                                                    {scenarioResults.length > 1 && (() => {
                                                                        const emissions = scenarioResults.map(r => r.mainProductEmission)
                                                                        const min = Math.min(...emissions)
                                                                        const max = Math.max(...emissions)
                                                                        const avg = emissions.reduce((s, v) => s + v, 0) / emissions.length
                                                                        const rangePercent = avg > 0 ? ((max - min) / avg * 100) : 0
                                                                        return (
                                                                            <div className="mt-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                                                                <div className="flex items-center gap-2 mb-2">
                                                                                    <Zap className="w-4 h-4 text-amber-500" />
                                                                                    <span className="text-sm font-medium text-amber-500">민감도 분석 결과</span>
                                                                                </div>
                                                                                <div className="grid grid-cols-3 gap-4 text-center">
                                                                                    <div>
                                                                                        <div className="text-lg font-bold text-foreground">{min.toFixed(2)}</div>
                                                                                        <div className="text-xs text-muted-foreground">최소 (kg CO₂e)</div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <div className="text-lg font-bold text-foreground">{max.toFixed(2)}</div>
                                                                                        <div className="text-xs text-muted-foreground">최대 (kg CO₂e)</div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <div className={`text-lg font-bold ${rangePercent > 20 ? 'text-red-500' : rangePercent > 10 ? 'text-amber-500' : 'text-green-500'}`}>
                                                                                            ±{(rangePercent / 2).toFixed(1)}%
                                                                                        </div>
                                                                                        <div className="text-xs text-muted-foreground">변동 범위</div>
                                                                                    </div>
                                                                                </div>
                                                                                {rangePercent > 20 && (
                                                                                    <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                                                                                        <AlertCircle className="w-3 h-3" />
                                                                                        할당 방법에 따른 결과 차이가 크므로, 선택한 방법에 대한 상세 정당화가 필요합니다.
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    })()}

                                                                    {/* 자동 정당화 적용 */}
                                                                    {scenarioResults[0] && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setAllocationJustification('multiOutput', scenarioResults[0].justification)
                                                                            }}
                                                                            className="mt-3 w-full px-4 py-2.5 border border-indigo-500/30 text-indigo-500 rounded-xl hover:bg-indigo-500/10 transition-colors font-medium flex items-center justify-center gap-2 text-sm"
                                                                        >
                                                                            <FileText className="w-4 h-4" />
                                                                            추천 방법 정당화 문구 자동 적용
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 정당화 사유 */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">할당 방법 선택 정당화 사유</label>
                                        <textarea
                                            value={multiOutputAllocation.justification}
                                            onChange={(e) => setAllocationJustification('multiOutput', e.target.value)}
                                            placeholder="선택한 할당 방법의 정당화 사유를 입력하세요..."
                                            rows={2}
                                            className="w-full px-4 py-3 border border-border rounded-xl text-sm bg-background focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>
            )}

            {/* ===== 사전 질문 카드: 재활용 ===== */}
            {needsRecycling === null ? (
                <Card className="border-green-500/20 bg-green-500/5">
                    <CardContent className="pt-5 pb-5">
                        <div className="flex items-start gap-4">
                            <div className="p-2.5 rounded-xl bg-green-500/15">
                                <Recycle className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="flex-1 space-y-3">
                                <div>
                                    <h3 className="font-semibold text-sm">재활용 원료를 사용하거나, 제품이 재활용 가능합니까?</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        재활용 소재 사용 또는 폐기 후 재활용 가능성이 있으면 배출량 배분 방법을 설정해야 합니다.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setNeedsRecycling(true)}
                                        className="px-4 py-1.5 text-sm font-medium rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
                                    >
                                        예, 있습니다
                                    </button>
                                    <button
                                        onClick={() => setNeedsRecycling(false)}
                                        className="px-4 py-1.5 text-sm font-medium rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                                    >
                                        아니오
                                    </button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : needsRecycling === false ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Recycle className="w-4 h-4" />
                        <span>재활용 할당 — <span className="text-foreground font-medium">해당 없음</span></span>
                    </div>
                    <button
                        onClick={() => setNeedsRecycling(null)}
                        className="text-xs text-primary hover:underline"
                    >
                        변경
                    </button>
                </div>
            ) : null}

            {/* 재사용/재활용 할당 */}
            {needsRecycling === true && (
                <Card className={`transition-all ${expandedSection === 'recycling' ? 'ring-2 ring-green-500/30' : ''}`}>
                    <button
                        onClick={() => setExpandedSection(expandedSection === 'recycling' ? null : 'recycling')}
                        className="w-full"
                    >
                        <CardHeader className="flex flex-row items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-green-500/10">
                                    <Recycle className="w-6 h-6 text-green-500" />
                                </div>
                                <div className="text-left">
                                    <CardTitle className="text-lg">
                                        {showTechnicalLabels ? '재사용/재활용 할당 (Recycling Allocation)' : '♻️ 재활용 원료 및 폐기물 처리 방법'}
                                    </CardTitle>
                                    <CardDescription>
                                        {showTechnicalLabels ? '재활용 원료 및 EOL 재활용 처리 방법' : '재활용 원료를 사용하거나 제품이 재활용될 때, 환경 부담을 어떻게 배분할지 설정합니다'}
                                    </CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setNeedsRecycling(null); }}
                                    className="px-2.5 py-1 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-md transition-colors"
                                >
                                    변경
                                </button>
                                <span className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                                    {RECYCLING_ALLOCATION_METHODS[recyclingAllocation.method].nameKo}
                                </span>
                                {expandedSection === 'recycling' ? (
                                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                            </div>
                        </CardHeader>
                    </button>

                    <AnimatePresence>
                        {expandedSection === 'recycling' && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <CardContent className="border-t space-y-6 pt-6">
                                    {/* 재활용 방법 선택 - 추천 3개 */}
                                    <div>
                                        <label className="block text-sm font-medium mb-3">재활용 할당 방법</label>
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            {RECOMMENDED_METHODS.map((key) => {
                                                const method = RECYCLING_ALLOCATION_METHODS[key]
                                                const Icon = RECYCLING_METHOD_ICONS[key]
                                                const isSelected = recyclingAllocation.method === key
                                                const easy = EASY_RECYCLING_DESCRIPTIONS[key]

                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => setRecyclingAllocationMethod(key)}
                                                        className={`relative p-5 rounded-2xl border-2 text-left transition-all ${isSelected
                                                            ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20'
                                                            : 'border-border/50 bg-card/50 hover:border-green-500/50 hover:bg-green-500/5'
                                                            }`}
                                                    >
                                                        {key === 'cut_off' && (
                                                            <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs bg-green-500 text-white rounded-full font-medium">
                                                                추천
                                                            </span>
                                                        )}
                                                        <div className={`p-3 rounded-xl inline-block mb-3 ${isSelected ? 'bg-green-500/20' : 'bg-muted/50'
                                                            }`}>
                                                            {easy ? <span className="text-xl">{easy.icon}</span> : <Icon className={`w-6 h-6 ${isSelected ? 'text-green-400' : 'text-muted-foreground'}`} />}
                                                        </div>
                                                        <h4 className={`font-semibold mb-1 ${isSelected ? 'text-green-400' : 'text-foreground'
                                                            }`}>
                                                            {showTechnicalLabels ? method.nameKo : (easy?.easyName || method.nameKo)}
                                                        </h4>
                                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                                            {showTechnicalLabels ? method.descriptionKo : (easy?.oneLiner || method.descriptionKo)}
                                                        </p>
                                                        {isSelected && easy && (
                                                            <p className="text-xs text-green-400/70 mt-2 pt-2 border-t border-green-500/20 italic">
                                                                {easy.analogy}
                                                            </p>
                                                        )}
                                                        {isSelected && (
                                                            <div className="absolute bottom-3 right-3">
                                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                                            </div>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {/* 고급 옵션 */}
                                        <button
                                            onClick={() => setShowAdvancedMethods(!showAdvancedMethods)}
                                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
                                        >
                                            {showAdvancedMethods ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            고급 옵션 ({ADVANCED_METHODS.length}개)
                                        </button>

                                        <AnimatePresence>
                                            {showAdvancedMethods && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="grid grid-cols-2 gap-3"
                                                >
                                                    {ADVANCED_METHODS.map((key) => {
                                                        const method = RECYCLING_ALLOCATION_METHODS[key]
                                                        const Icon = RECYCLING_METHOD_ICONS[key]
                                                        const isSelected = recyclingAllocation.method === key

                                                        return (
                                                            <button
                                                                key={key}
                                                                onClick={() => setRecyclingAllocationMethod(key)}
                                                                className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${isSelected
                                                                    ? 'border-green-500 bg-green-500/10'
                                                                    : 'border-border/50 bg-card/50 hover:border-green-500/50 hover:bg-green-500/5'
                                                                    }`}
                                                            >
                                                                <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? 'text-green-400' : 'text-muted-foreground'}`} />
                                                                <div>
                                                                    <h4 className={`font-medium text-sm ${isSelected ? 'text-green-400' : 'text-foreground'}`}>
                                                                        {method.nameKo}
                                                                    </h4>
                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                        {method.descriptionKo}
                                                                    </p>
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* 수식 표시 */}
                                    <div className="p-4 bg-card/50 rounded-xl border border-border/50">
                                        <p className="text-xs text-green-400 mb-1">적용 수식</p>
                                        <p className="text-sm font-mono text-foreground/80">
                                            {RECYCLING_ALLOCATION_METHODS[recyclingAllocation.method].formula}
                                        </p>
                                    </div>

                                    {/* 파라미터 입력 - 슬라이더 */}
                                    <div className="grid md:grid-cols-2 gap-6">
                                        {/* 재활용 투입 비율 */}
                                        <div className="p-4 bg-card/50 border border-border/50 rounded-xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium flex items-center">
                                                    {showTechnicalLabels ? <>재활용 투입 비율 (R<sub>in</sub>)</> : (FIELD_GUIDES.recycledContentInput?.label || '재활용 원료 사용 비율')}
                                                    <FieldHelpTooltip fieldKey="recycledContentInput" />
                                                </label>
                                                <span className="text-xl font-bold text-green-400">
                                                    {(recyclingAllocation.recycledContentInput * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={recyclingAllocation.recycledContentInput * 100}
                                                onChange={(e) => setRecyclingParams({
                                                    recycledContentInput: parseFloat(e.target.value) / 100
                                                })}
                                                className="w-full h-3 bg-green-950/50 rounded-full appearance-none cursor-pointer accent-green-500"
                                            />
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>0% (모두 버진)</span>
                                                <span>100% (모두 재활용)</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {showTechnicalLabels ? '제품에 투입되는 재활용 원료 비율' : '원료 중 재활용 소재가 차지하는 비율입니다'}
                                            </p>
                                        </div>

                                        {/* 재활용 산출 비율 */}
                                        <div className="p-4 bg-card/50 border border-border/50 rounded-xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium flex items-center">
                                                    {showTechnicalLabels ? <>재활용 산출 비율 (R<sub>out</sub>)</> : (FIELD_GUIDES.recyclabilityOutput?.label || '폐기 후 재활용 가능 비율')}
                                                    <FieldHelpTooltip fieldKey="recyclabilityOutput" />
                                                </label>
                                                <span className="text-xl font-bold text-green-400">
                                                    {(recyclingAllocation.recyclabilityOutput * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={recyclingAllocation.recyclabilityOutput * 100}
                                                onChange={(e) => setRecyclingParams({
                                                    recyclabilityOutput: parseFloat(e.target.value) / 100
                                                })}
                                                className="w-full h-3 bg-green-950/50 rounded-full appearance-none cursor-pointer accent-green-500"
                                            />
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>0% (모두 폐기)</span>
                                                <span>100% (모두 재활용)</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                EOL 단계에서 재활용되는 비율
                                            </p>
                                        </div>
                                    </div>

                                    {/* 품질 계수 */}
                                    {(recyclingAllocation.method === 'pef_formula' || recyclingAllocation.method === 'substitution') && (
                                        <div className="grid md:grid-cols-2 gap-6 p-4 bg-card/50 border border-border/50 rounded-xl">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium flex items-center">
                                                    {showTechnicalLabels ? <>투입 품질 계수 (Q<sub>s,in</sub>)</> : (FIELD_GUIDES.qualityFactorInput?.label || '투입 품질 계수')}
                                                    <FieldHelpTooltip fieldKey="qualityFactorInput" />
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="1"
                                                    step="0.1"
                                                    value={recyclingAllocation.qualityFactorInput}
                                                    onChange={(e) => setRecyclingParams({
                                                        qualityFactorInput: parseFloat(e.target.value) || 1
                                                    })}
                                                    className="w-full px-4 py-2.5 border border-border/50 rounded-xl text-sm bg-background/50 focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    {showTechnicalLabels ? '다운사이클링 시 1 미만' : '재활용 시 품질이 떨어지면 1보다 작게 설정합니다'}
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium flex items-center">
                                                    {showTechnicalLabels ? <>산출 품질 계수 (Q<sub>s,out</sub>)</> : (FIELD_GUIDES.qualityFactorOutput?.label || '산출 품질 계수')}
                                                    <FieldHelpTooltip fieldKey="qualityFactorOutput" />
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="1"
                                                    step="0.1"
                                                    value={recyclingAllocation.qualityFactorOutput}
                                                    onChange={(e) => setRecyclingParams({
                                                        qualityFactorOutput: parseFloat(e.target.value) || 1
                                                    })}
                                                    className="w-full px-4 py-2.5 border border-border/50 rounded-xl text-sm bg-background/50 focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    {showTechnicalLabels ? '재활용 원료 품질 계수' : '재활용된 원료의 품질 수준을 나타냅니다 (1.0 = 동일 품질)'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* 루프 타입 */}
                                    <div>
                                        <label className="block text-sm font-medium mb-3">
                                            {showTechnicalLabels ? '재활용 루프 타입 (Recycling Loop Type)' : '♻️ 재활용 방식 선택'}
                                        </label>
                                        <div className="flex gap-4">
                                            {[
                                                { id: 'closed_loop', label: showTechnicalLabels ? '폐쇄 루프 (Closed-loop)' : '폐쇄 루프 🔄', desc: showTechnicalLabels ? '동일 제품으로 재활용' : '같은 종류의 제품으로 다시 태어남' },
                                                { id: 'open_loop', label: showTechnicalLabels ? '개방 루프 (Open-loop)' : '개방 루프 ➡️', desc: showTechnicalLabels ? '다른 제품으로 재활용' : '다른 종류의 제품으로 재활용됨' }
                                            ].map((option) => (
                                                <button
                                                    key={option.id}
                                                    onClick={() => setRecyclingParams({ loopType: option.id as 'closed_loop' | 'open_loop' })}
                                                    className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${recyclingAllocation.loopType === option.id
                                                        ? 'border-green-500 bg-green-500/10'
                                                        : 'border-border/50 bg-card/50 hover:border-green-500/50 hover:bg-green-500/5'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {recyclingAllocation.loopType === option.id ? (
                                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                                        ) : (
                                                            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/50" />
                                                        )}
                                                        <span className={`font-medium text-sm ${recyclingAllocation.loopType === option.id ? 'text-green-400' : 'text-foreground'}`}>{option.label}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground ml-6">{option.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 선택 요약 & 예상 효과 */}
                                    <div className="p-5 bg-green-500/10 rounded-2xl border border-green-500/30">
                                        <div className="flex items-center gap-2 mb-4">
                                            <TrendingDown className="w-5 h-5 text-green-400" />
                                            <h4 className="font-semibold text-green-400">할당 설정 요약 및 예상 효과</h4>
                                        </div>

                                        <div className="grid md:grid-cols-3 gap-4 mb-4">
                                            <div className="p-3 bg-background/50 rounded-xl border border-border/30">
                                                <p className="text-xs text-muted-foreground mb-1">방법</p>
                                                <p className="font-semibold text-green-400">
                                                    {RECYCLING_ALLOCATION_METHODS[recyclingAllocation.method].nameKo}
                                                </p>
                                            </div>
                                            <div className="p-3 bg-background/50 rounded-xl border border-border/30">
                                                <p className="text-xs text-muted-foreground mb-1">버진 원료 부담</p>
                                                <p className="font-semibold text-foreground">
                                                    {estimatedEffect.virginBurden.toFixed(0)}%
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        (투입 {(recyclingAllocation.recycledContentInput * 100).toFixed(0)}% 재활용)
                                                    </span>
                                                </p>
                                            </div>
                                            <div className="p-3 bg-background/50 rounded-xl border border-border/30">
                                                <p className="text-xs text-muted-foreground mb-1">폐기 부담</p>
                                                <p className="font-semibold text-foreground">
                                                    {estimatedEffect.disposalBurden.toFixed(0)}%
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        (산출 {(recyclingAllocation.recyclabilityOutput * 100).toFixed(0)}% 재활용)
                                                    </span>
                                                </p>
                                            </div>
                                        </div>

                                        {estimatedEffect.creditEffect > 0 && (
                                            <div className="flex items-center gap-2 p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                                                <Sparkles className="w-4 h-4 text-green-400" />
                                                <span className="text-sm text-green-300">
                                                    예상 재활용 크레딧: <strong>-{estimatedEffect.creditEffect.toFixed(2)} kg CO₂e</strong> (버진 원료 대체)
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 적합한 시나리오 */}
                                    <div className="flex items-start gap-3 p-4 bg-green-500/5 rounded-xl border border-green-500/20">
                                        <Info className="w-5 h-5 text-green-400 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-green-400 mb-2">적합한 시나리오</p>
                                            <ul className="text-sm text-green-300/80 space-y-1">
                                                {RECYCLING_ALLOCATION_METHODS[recyclingAllocation.method].suitableFor.map((scenario, i) => (
                                                    <li key={i} className="flex items-center gap-2">
                                                        <CheckCircle className="w-3 h-3 text-green-400" />
                                                        {scenario}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* 정당화 사유 */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">할당 방법 선택 정당화 사유</label>
                                        <textarea
                                            value={recyclingAllocation.justification}
                                            onChange={(e) => setAllocationJustification('recycling', e.target.value)}
                                            placeholder="선택한 할당 방법의 정당화 사유를 입력하세요..."
                                            rows={2}
                                            className="w-full px-4 py-3 border border-border rounded-xl text-sm bg-background focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>
            )}

            {/* 할당 참고사항 */}
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-amber-900 dark:text-amber-400 mb-2">할당 절차 참고사항</h3>
                            <ul className="text-sm text-amber-800 dark:text-amber-500 space-y-1.5">
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-700 dark:text-amber-400">•</span>
                                    <span><strong>ISO 14044</strong>에 따라 가능한 경우 항상 할당을 회피하세요</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-700 dark:text-amber-400">•</span>
                                    <span>할당 방법과 정당화 사유는 <strong>CFP 보고서</strong>에 명시해야 합니다</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-700 dark:text-amber-400">•</span>
                                    <span><strong>민감도 분석</strong>을 통해 다른 할당 방법의 영향을 확인하세요</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-700 dark:text-amber-400">•</span>
                                    <span><strong>Cut-off</strong> 방법은 보수적 접근으로 널리 수용됩니다</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
