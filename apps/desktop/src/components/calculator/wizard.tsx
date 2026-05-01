"use client"

import * as React from "react"
// next/navigation removed for desktop
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ProductInfoStep } from "./steps/product-info"
import { LifecycleStagesStep } from "./steps/lifecycle-stages"
import { ActivityDataStep } from "./steps/activity-data"
import { DataQualityStep } from "./steps/data-quality"
import { AllocationStep } from "./steps/allocation"
import { SensitivityAnalysisStep } from "./steps/sensitivity-analysis"
import { ResultsStep } from "./steps/results"
import { AINarrativeStep } from "./steps/ai-narrative"
import { cn } from "@/lib/utils"
import { ProGate } from "@/components/subscription/pro-gate"
import { FEATURES } from "@/lib/subscription"
import { validateStep, type ValidationResult } from "@/lib/core/step-validation"
import { getStepCompleteness } from "@/lib/core/step-completeness"
import {
    Package,
    Layers,
    ClipboardList,
    Shield,
    Scale,
    Activity,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    History,
    Lock,
    LogIn,
    UserPlus,
    X,
    Save,
    FolderOpen,
    Megaphone,
    MessageCircle,
    Sun,
    Moon,
    Sparkles
} from "lucide-react"
import { AuditSidebar } from "@/components/calculator/panels/audit-sidebar"
import { AutoSaveIndicator, DraftManagerPanel } from "@/components/calculator/draft-manager-ui"
import { usePCFStore } from "@/lib/core/store"
import { saveProjectFile, loadProjectFile } from "@/lib/file/project-file"
import { AnnouncementsPanel } from "@/components/support/announcements-panel"
import { ContactModal } from "@/components/support/contact-modal"
import { fetchAnnouncements, countUnread } from "@/lib/announcements/announcements-client"
import { useTheme } from "@/lib/theme/use-theme"

// 로그인이 필요한 최소 단계 (3단계부터)
const LOGIN_REQUIRED_STEP = 3

const steps = [
    {
        id: 1,
        title: "제품 정보",
        titleEn: "Product Info",
        description: "제품 기본 정보 및 시스템 경계 설정",
        icon: Package,
        component: ProductInfoStep,
        phase: 'SCOPE' as const
    },
    {
        id: 2,
        title: "생애주기 단계",
        titleEn: "Lifecycle Stages",
        description: "포함할 생애주기 단계 선택",
        icon: Layers,
        component: LifecycleStagesStep,
        phase: 'SCOPE' as const
    },
    {
        id: 3,
        title: "활동 데이터",
        titleEn: "Activity Data",
        description: "단계별 활동 데이터 입력",
        icon: ClipboardList,
        component: ActivityDataStep,
        phase: 'LCI' as const
    },
    {
        id: 4,
        title: "데이터 품질",
        titleEn: "Data Quality",
        description: "데이터 품질 평가 및 불확실성 산정",
        icon: Shield,
        component: DataQualityStep,
        phase: 'LCI' as const
    },
    {
        id: 5,
        title: "할당",
        titleEn: "Allocation",
        description: "다중 출력 및 재활용 할당 설정",
        icon: Scale,
        component: AllocationStep,
        phase: 'LCI' as const
    },
    {
        id: 6,
        title: "민감도 분석",
        titleEn: "Sensitivity Analysis",
        description: "방법론 및 데이터 변동 영향 분석",
        icon: Activity,
        component: SensitivityAnalysisStep,
        phase: 'LCIA' as const
    },
    {
        id: 7,
        title: "결과",
        titleEn: "Results",
        description: "CFP 계산 결과 및 분석",
        icon: BarChart3,
        component: ResultsStep,
        phase: 'LCIA' as const
    },
    {
        id: 8,
        title: "AI Narrative",
        titleEn: "AI Narrative",
        description: "AI 자동 보고서 서술 (컨텍스트 메모 + 6개 슬롯 검토)",
        icon: Sparkles,
        component: AINarrativeStep,
        phase: 'LCIA' as const
    },
]

// ISO 14067 단계 그룹 정의
const phaseGroups = {
    SCOPE: {
        title: '목표 및 범위 정의',
        titleEn: 'Goal and Scope Definition',
        clause: 'ISO 14067 6.3',
        steps: [1, 2],
        color: 'violet'
    },
    LCI: {
        title: 'LCI 전과정목록분석',
        titleEn: 'Life Cycle Inventory',
        clause: 'ISO 14067 6.4',
        steps: [3, 4, 5],
        color: 'emerald'
    },
    LCIA: {
        title: 'LCIA 전과정영향평가',
        titleEn: 'Life Cycle Impact Assessment',
        clause: 'ISO 14067 6.5',
        steps: [6, 7, 8],
        color: 'blue'
    }
}


export function CalculatorWizard() {
    const [currentStep, setCurrentStep] = React.useState(1)
    const [isClient, setIsClient] = React.useState(false)
    const [isAuditOpen, setIsAuditOpen] = React.useState(false)
    const [isAnnouncementsOpen, setIsAnnouncementsOpen] = React.useState(false)
    const [isContactOpen, setIsContactOpen] = React.useState(false)
    const [unreadAnnouncementCount, setUnreadAnnouncementCount] = React.useState(0)
    const [showLoginModal, setShowLoginModal] = React.useState(false)
    const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null)
    const { theme, toggleTheme } = useTheme()

    React.useEffect(() => {
        fetchAnnouncements().then(list => setUnreadAnnouncementCount(countUnread(list)))
    }, [])
    const user = usePCFStore((state) => state.user)
    const productInfo = usePCFStore((state) => state.productInfo)
    const stages = usePCFStore((state) => state.stages)
    const activityData = usePCFStore((state) => state.activityData)
    const detailedActivityData = usePCFStore((state) => state.detailedActivityData)
    const dataQualityMeta = usePCFStore((state) => state.dataQualityMeta)
    const multiOutputAllocation = usePCFStore((state) => state.multiOutputAllocation)
    // router removed for desktop

    const isLoggedIn = true // 데스크탑: 로그인 불필요
    const requiresLogin = (_stepId: number) => false

    React.useEffect(() => {
        setIsClient(true)
    }, [])

    if (!isClient) return null

    const handleNext = () => {
        if (currentStep < steps.length) {
            const nextStep = currentStep + 1
            if (requiresLogin(nextStep)) {
                setShowLoginModal(true)
                return
            }

            // 현재 단계 검증
            const state = usePCFStore.getState()
            const result = validateStep(currentStep, state)

            if (!result.isValid) {
                setValidationResult(result)
                return
            }

            // 경고만 있으면 표시하되 진행 허용
            if (result.warnings.length > 0) {
                setValidationResult(result)
            } else {
                setValidationResult(null)
            }

            setCurrentStep(nextStep)
        }
    }

    const handleBack = () => {
        if (currentStep > 1) {
            setValidationResult(null)
            setCurrentStep(currentStep - 1)
        }
    }

    const handleStepClick = (stepId: number) => {
        if (requiresLogin(stepId)) {
            setShowLoginModal(true)
            return
        }
        // 이전 단계로만 이동 가능 (또는 현재 단계)
        if (stepId <= currentStep) {
            setCurrentStep(stepId)
        }
    }

    const currentStepData = steps[currentStep - 1]
    const CurrentComponent = currentStepData.component
    const CurrentIcon = currentStepData.icon

    const handleSaveFile = async () => {
        const state = usePCFStore.getState()
        const { user: _user, ...projectState } = state as unknown as Record<string, unknown>
        const name = state.productInfo?.name
        await saveProjectFile(projectState, name)
    }

    const handleLoadFile = async () => {
        const projectState = await loadProjectFile()
        if (!projectState) return
        const store = usePCFStore.getState() as unknown as Record<string, unknown>
        const restoreFns = Object.fromEntries(
            Object.entries(projectState).filter(([k]) => typeof store[k] !== 'function')
        )
        usePCFStore.setState(restoreFns)
        setCurrentStep(1)
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 relative">
            <AuditSidebar isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} />
            <AnnouncementsPanel
                open={isAnnouncementsOpen}
                onClose={() => setIsAnnouncementsOpen(false)}
                onAllRead={() => setUnreadAnnouncementCount(0)}
            />
            <ContactModal open={isContactOpen} onClose={() => setIsContactOpen(false)} />

            {/* 헤더 & 유틸리티 */}
            <div className="flex items-center justify-between mb-4">
                <AutoSaveIndicator />
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-primary gap-1"
                        onClick={handleLoadFile}
                        title="프로젝트 파일 열기 (.carbonmate)"
                    >
                        <FolderOpen className="h-4 w-4" />
                        열기
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-primary gap-1"
                        onClick={handleSaveFile}
                        title="프로젝트를 .carbonmate 파일로 저장"
                    >
                        <Save className="h-4 w-4" />
                        저장
                    </Button>
                    <DraftManagerPanel />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-primary gap-1"
                        onClick={() => setIsAuditOpen(true)}
                    >
                        <History className="h-4 w-4" />
                        변경 이력
                    </Button>
                    <div className="w-px h-5 bg-border mx-2 opacity-60" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-primary gap-1 relative"
                        onClick={() => setIsAnnouncementsOpen(true)}
                        title="공지사항"
                    >
                        <Megaphone className="h-4 w-4" />
                        공지
                        {unreadAnnouncementCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {unreadAnnouncementCount > 9 ? "9+" : unreadAnnouncementCount}
                            </span>
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-primary gap-1"
                        onClick={() => setIsContactOpen(true)}
                        title="관리자에게 문의하기"
                    >
                        <MessageCircle className="h-4 w-4" />
                        문의
                    </Button>
                    <button
                        onClick={toggleTheme}
                        title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
                        className="ml-1 inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-muted/60 hover:bg-muted hover:text-primary text-foreground transition-colors"
                        aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
                    >
                        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>
                </div>
            </div>
            {/* Progress Steps */}
            <div className="mb-6 sm:mb-8">
                {/* 데스크톱 뷰 - ISO 14067 3단계 그룹 */}
                <div className="hidden md:block mb-4">
                    {/* Phase Labels */}
                    <div className="flex mb-2">
                        <div className="flex-[2] flex items-center justify-center">
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                                목표 및 범위 정의
                            </span>
                        </div>
                        <div className="flex-[3] flex items-center justify-center">
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                LCI 전과정목록분석
                            </span>
                        </div>
                        <div className="flex-[3] flex items-center justify-center">
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                LCIA 전과정영향평가
                            </span>
                        </div>
                    </div>

                    {/* Steps with Phase Grouping */}
                    <div className="flex items-center">
                        {/* SCOPE 그룹 (Steps 1-2) */}
                        <div className="flex-[2] flex justify-between px-2 py-3 bg-violet-500/5 rounded-l-xl border border-violet-500/10">
                            {steps.filter(s => s.phase === 'SCOPE').map((step, index, arr) => {
                                const StepIcon = step.icon
                                const isCompleted = currentStep > step.id
                                const isCurrent = currentStep === step.id
                                const isClickable = step.id <= currentStep

                                return (
                                    <div key={step.id} className="flex items-center flex-1 min-w-[78px]">
                                        <button
                                            onClick={() => handleStepClick(step.id)}
                                            disabled={!isClickable}
                                            className={cn(
                                                "flex flex-col items-center transition-all w-full",
                                                isClickable ? "cursor-pointer" : "cursor-not-allowed"
                                            )}
                                        >
                                            <div className={cn(
                                                "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                                                isCompleted
                                                    ? "bg-violet-500 text-white"
                                                    : isCurrent
                                                        ? "bg-violet-500/20 text-violet-600 dark:text-violet-400 border-2 border-violet-500"
                                                        : "bg-muted text-muted-foreground"
                                            )}>
                                                <StepIcon className="h-5 w-5" />
                                            </div>
                                            <span className={cn(
                                                "mt-2 text-xs font-medium transition-colors text-center",
                                                isCurrent || isCompleted
                                                    ? "text-violet-600 dark:text-violet-400"
                                                    : "text-muted-foreground"
                                            )}>
                                                {step.title}
                                            </span>
                                            {/* 완성도 배지 */}
                                            {(() => {
                                                const pct = getStepCompleteness(step.id, { productInfo, stages, activityData, detailedActivityData, dataQualityMeta, multiOutputAllocation } as any)
                                                if (pct === 0) return null
                                                return (
                                                    <span className={cn(
                                                        "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                                                        pct >= 100
                                                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                                    )}>
                                                        {pct >= 100 ? '✓' : `${pct}%`}
                                                    </span>
                                                )
                                            })()}
                                        </button>

                                        {/* 연결선 */}
                                        {index < arr.length - 1 && (
                                            <div className={cn(
                                                "flex-1 h-0.5 mx-1 mt-[-20px] rounded-full",
                                                isCompleted ? "bg-violet-500" : "bg-violet-500/40"
                                            )} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* 구분선 1 */}
                        <div className="w-px h-16 bg-gradient-to-b from-violet-500/50 via-border to-emerald-500/50 mx-1" />

                        {/* LCI 그룹 (Steps 3-5) */}
                        <div className="flex-[3] flex justify-between px-2 py-3 bg-emerald-500/5 border-y border-emerald-500/10">
                            {steps.filter(s => s.phase === 'LCI').map((step, index, arr) => {
                                const StepIcon = step.icon
                                const isCompleted = currentStep > step.id
                                const isCurrent = currentStep === step.id
                                const isClickable = step.id <= currentStep
                                const isLocked = requiresLogin(step.id)

                                return (
                                    <div key={step.id} className="flex items-center flex-1 min-w-[78px]">
                                        <button
                                            onClick={() => handleStepClick(step.id)}
                                            disabled={!isClickable && !isLocked}
                                            className={cn(
                                                "flex flex-col items-center transition-all w-full",
                                                isLocked ? "cursor-pointer opacity-60" : isClickable ? "cursor-pointer" : "cursor-not-allowed"
                                            )}
                                        >
                                            <div className={cn(
                                                "relative flex items-center justify-center w-10 h-10 rounded-full transition-all",
                                                isCompleted
                                                    ? "bg-emerald-500 text-white"
                                                    : isCurrent
                                                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500"
                                                        : "bg-muted text-muted-foreground"
                                            )}>
                                                <StepIcon className="h-5 w-5" />
                                                {isLocked && (
                                                    <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-background border border-border shadow-sm">
                                                        <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className={cn(
                                                "mt-2 text-xs font-medium transition-colors text-center",
                                                isCurrent || isCompleted
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-muted-foreground"
                                            )}>
                                                {step.title}
                                            </span>
                                            {/* 완성도 배지 */}
                                            {(() => {
                                                const pct = getStepCompleteness(step.id, { productInfo, stages, activityData, detailedActivityData, dataQualityMeta, multiOutputAllocation } as any)
                                                if (pct === 0) return null
                                                return (
                                                    <span className={cn(
                                                        "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                                                        pct >= 100
                                                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                                    )}>
                                                        {pct >= 100 ? '✓' : `${pct}%`}
                                                    </span>
                                                )
                                            })()}
                                        </button>

                                        {/* 연결선 */}
                                        {index < arr.length - 1 && (
                                            <div className={cn(
                                                "flex-1 h-0.5 mx-1 mt-[-20px]",
                                                isCompleted ? "bg-emerald-500" : "bg-emerald-500/40"
                                            )} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* 구분선 2 */}
                        <div className="w-px h-16 bg-gradient-to-b from-emerald-500/50 via-border to-blue-500/50 mx-1" />

                        {/* LCIA 그룹 (Steps 6-7) */}
                        <div className="flex-[3] flex justify-between px-2 py-3 bg-blue-500/5 rounded-r-xl border border-blue-500/10">
                            {steps.filter(s => s.phase === 'LCIA').map((step, index, arr) => {
                                const StepIcon = step.icon
                                const isCompleted = currentStep > step.id
                                const isCurrent = currentStep === step.id
                                const isClickable = step.id <= currentStep
                                const isLocked = requiresLogin(step.id)

                                return (
                                    <div key={step.id} className="flex items-center flex-1 min-w-[78px]">
                                        <button
                                            onClick={() => handleStepClick(step.id)}
                                            disabled={!isClickable && !isLocked}
                                            className={cn(
                                                "flex flex-col items-center transition-all w-full",
                                                isLocked ? "cursor-pointer opacity-60" : isClickable ? "cursor-pointer" : "cursor-not-allowed"
                                            )}
                                        >
                                            <div className={cn(
                                                "relative flex items-center justify-center w-10 h-10 rounded-full transition-all",
                                                isCompleted
                                                    ? "bg-blue-500 text-white"
                                                    : isCurrent
                                                        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-2 border-blue-500"
                                                        : "bg-muted text-muted-foreground"
                                            )}>
                                                <StepIcon className="h-5 w-5" />
                                                {isLocked && (
                                                    <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-background border border-border shadow-sm">
                                                        <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className={cn(
                                                "mt-2 text-xs font-medium transition-colors text-center",
                                                isCurrent || isCompleted
                                                    ? "text-blue-600 dark:text-blue-400"
                                                    : "text-muted-foreground"
                                            )}>
                                                {step.title}
                                            </span>
                                            {/* 완성도 배지 */}
                                            {(() => {
                                                const pct = getStepCompleteness(step.id, { productInfo, stages, activityData, detailedActivityData, dataQualityMeta, multiOutputAllocation } as any)
                                                if (pct === 0) return null
                                                return (
                                                    <span className={cn(
                                                        "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                                                        pct >= 100
                                                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                                    )}>
                                                        {pct >= 100 ? '✓' : `${pct}%`}
                                                    </span>
                                                )
                                            })()}
                                        </button>

                                        {/* 연결선 */}
                                        {index < arr.length - 1 && (
                                            <div className={cn(
                                                "flex-1 h-0.5 mx-1 mt-[-20px]",
                                                isCompleted ? "bg-blue-500" : "bg-blue-500/40"
                                            )} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* 모바일 뷰 */}
                <div className="md:hidden space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "px-2 py-0.5 text-[10px] font-semibold rounded-full",
                                currentStepData.phase === 'SCOPE'
                                    ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                                    : currentStepData.phase === 'LCI'
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            )}>
                                {currentStepData.phase === 'SCOPE' ? '범위 정의' : currentStepData.phase}
                            </span>
                            <span className={cn(
                                "text-sm font-medium",
                                currentStepData.phase === 'SCOPE'
                                    ? "text-violet-600 dark:text-violet-400"
                                    : currentStepData.phase === 'LCI'
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-blue-600 dark:text-blue-400"
                            )}>
                                {currentStep}. {currentStepData.title}
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {currentStep} / {steps.length}
                        </span>
                    </div>
                </div>

                {/* 프로그레스 바 - 3단계 구분 표시 */}
                <div className="relative h-2 w-full bg-secondary/20 rounded-full overflow-hidden">
                    {/* SCOPE/LCI 구분 마커 (2/7 위치) */}
                    <div
                        className="absolute top-0 h-full w-0.5 bg-border z-10"
                        style={{ left: `${(2 / 7) * 100}%` }}
                    />
                    {/* LCI/LCIA 구분 마커 (5/7 위치) */}
                    <div
                        className="absolute top-0 h-full w-0.5 bg-border z-10"
                        style={{ left: `${(5 / 7) * 100}%` }}
                    />
                    {/* 진행 바 */}
                    <div
                        className={cn(
                            "h-full transition-all duration-300 ease-in-out",
                            currentStep <= 2 ? "bg-violet-500" : currentStep <= 5 ? "bg-emerald-500" : "bg-blue-500"
                        )}
                        style={{ width: `${(currentStep / steps.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* 메인 카드 */}
            <Card className="border-border bg-card/50 backdrop-blur shadow-lg shadow-black/5 dark:shadow-black/40">
                <CardHeader className="px-4 sm:px-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                            <CurrentIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg sm:text-xl">
                                {currentStepData.title}
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                {currentStepData.description}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="min-h-[300px] sm:min-h-[400px] px-4 sm:px-6">
                    {currentStep === 6 ? (
                        <ProGate feature={FEATURES.SENSITIVITY}>
                            <CurrentComponent />
                        </ProGate>
                    ) : (
                        <CurrentComponent />
                    )}
                </CardContent>

                {/* 검증 메시지 */}
                {validationResult && (validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                    <div className="px-4 sm:px-6 pb-2 space-y-2">
                        {validationResult.errors.map((err, i) => (
                            <div key={`err-${i}`} className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm">
                                <span className="text-red-500 mt-0.5">⚠</span>
                                <span className="text-red-400">{err}</span>
                            </div>
                        ))}
                        {validationResult.warnings.map((warn, i) => (
                            <div key={`warn-${i}`} className="flex items-start gap-2 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
                                <span className="mt-0.5">💡</span>
                                <span className="text-yellow-800 dark:text-yellow-300">{warn}</span>
                            </div>
                        ))}
                        {validationResult.errors.length === 0 && (
                            <button
                                onClick={() => setValidationResult(null)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                닫기
                            </button>
                        )}
                    </div>
                )}

                <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 border-t border-border/50 pt-4 sm:pt-6 px-4 sm:px-6">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={currentStep === 1}
                        className="gap-2 w-full sm:w-auto h-11 sm:h-auto order-2 sm:order-1"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        이전
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground order-1 sm:order-2">
                        {currentStep} / {steps.length}
                    </div>

                    {currentStep < steps.length ? (
                        <Button onClick={handleNext} className="gap-2 w-full sm:w-auto h-11 sm:h-auto order-3">
                            다음
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 px-3 py-2 order-3">
                            ✅ 모든 단계 완료 — 위에서 보고서 다운로드 가능
                        </div>
                    )}
                </CardFooter>
            </Card>

            {/* 단계 설명 (하단) */}
            <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                    {currentStepData.titleEn} • ISO 14067:2018 준수
                </p>
            </div>

            {/* 로그인 필요 모달 */}
            {showLoginModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* 오버레이 */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowLoginModal(false)}
                    />
                    {/* 모달 */}
                    <div className="relative w-full max-w-md mx-4 bg-background border border-border rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-200">
                        {/* 닫기 */}
                        <button
                            onClick={() => setShowLoginModal(false)}
                            className="absolute top-4 right-4 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {/* 아이콘 */}
                        <div className="flex justify-center mb-6">
                            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                                <Lock className="h-8 w-8 text-primary" />
                            </div>
                        </div>

                        {/* 제목 */}
                        <h3 className="text-xl font-bold text-center mb-2">
                            로그인이 필요합니다
                        </h3>
                        <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
                            활동 데이터 입력부터는<br />
                            로그인 후 이용하실 수 있습니다.
                        </p>

                        {/* 안내 메시지 */}
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-6">
                            <span className="text-lg mt-0.5">💡</span>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed">
                                입력하신 데이터는 자동 저장되며,<br />
                                로그인 후 이어서 진행할 수 있습니다.
                            </p>
                        </div>

                        {/* 버튼 */}
                        <div className="space-y-3">
                            <Button
                                className="w-full h-11 gap-2"
                                onClick={() => {
                                    setShowLoginModal(false)
                                    setShowLoginModal(false)
                                }}
                            >
                                <LogIn className="h-4 w-4" />
                                로그인
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full h-11 gap-2"
                                onClick={() => {
                                    setShowLoginModal(false)
                                    setShowLoginModal(false)
                                }}
                            >
                                <UserPlus className="h-4 w-4" />
                                회원가입 (30초)
                            </Button>
                            <button
                                onClick={() => setShowLoginModal(false)}
                                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                            >
                                나중에 하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
