"use client"

import { useState, useMemo } from "react"
import { usePCFStore, TransportMode } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Info,
    AlertTriangle,
    CheckCircle2,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Zap,
    Truck,
    Recycle,
    Settings,
    Play,
    FileText
} from "lucide-react"
import {
    performComprehensiveSensitivityAnalysis,
    analyzeElectricityGridSensitivity,
    analyzeTransportModeSensitivity,
    analyzeRawMaterialSensitivity,
    analyzeRecyclingAllocationSensitivity,
    analyzeUsePhaseScenarios,
    analyzeEOLScenarios,
    generateTornadoChartData,
    generateSensitivitySummary,
    SensitivityScenario,
    SensitivityAnalysisResult,
    SensitivityAnalysisType,
    SENSITIVITY_REQUIREMENTS,
    SIGNIFICANCE_THRESHOLD
} from "@/lib/sensitivity-analysis"
import { calculateSimplifiedEmission } from "@/lib/core/emission-calculator"
import { RecyclingAllocationMethod } from "@/lib/allocation"

// =============================================================================
// 메인 컴포넌트
// =============================================================================

export function SensitivityAnalysisStep() {
    const {
        activityData,
        detailedActivityData,
        productInfo,
        recyclingAllocation,
        stages,
        setSensitivityAnalysis
    } = usePCFStore()

    // 분석 결과 상태
    const [analysisResult, setAnalysisResult] = useState<SensitivityAnalysisResult | null>(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    // 분석 옵션
    const [analysisOptions, setAnalysisOptions] = useState({
        electricityGrid: true,
        transportMode: true,
        recyclingAllocation: true,
        activityData: true,
        usePhase: stages.includes('use'),
        eolScenario: stages.includes('eol'),
        variationPercent: 20
    })

    // 기준 CFP 계산 — 공유 모듈 사용
    const baselineCFP = useMemo(() => {
        return calculateSimplifiedEmission(activityData, undefined, recyclingAllocation)
    }, [activityData, recyclingAllocation])

    // 간단한 배출량 계산 함수 (민감도 분석 콜백용)
    const calculateEmission = (data: typeof activityData): number => {
        return calculateSimplifiedEmission(data, undefined, recyclingAllocation)
    }

    // 민감도 분석 실행
    const runAnalysis = () => {
        setIsAnalyzing(true)

        // 약간의 지연을 주어 UI 업데이트
        setTimeout(() => {
            const result = performComprehensiveSensitivityAnalysis({
                baselineCFP,
                activityData,
                electricityGridId: activityData.electricity_grid || 'electricity_korea_2023_consumption',
                transportMode: (activityData.transport_mode as TransportMode) || 'truck',
                recyclingMethod: recyclingAllocation.method,
                recycledContentInput: recyclingAllocation.recycledContentInput,
                recyclingRateOutput: recyclingAllocation.recyclabilityOutput,
                productMass: activityData.raw_material_weight || 1,
                calculateEmission
            })

            // P1-8: 개별 원자재(시약) 기여도 상위 N개 자동 민감도 시나리오 추가
            const rawMaterials = detailedActivityData?.raw_materials || []
            if (rawMaterials.length > 0 && baselineCFP > 0) {
                const rawMatScenarios = analyzeRawMaterialSensitivity(
                    rawMaterials as any,
                    baselineCFP,
                    { variationPercent: 20, topN: 5 }
                )
                result.scenarios.push(...rawMatScenarios)
            }

            // 선택된 옵션에 따라 시나리오 필터링
            const filteredScenarios = result.scenarios.filter(s => {
                if (s.type === 'electricity_grid' && !analysisOptions.electricityGrid) return false
                if (s.type === 'transport_mode' && !analysisOptions.transportMode) return false
                if (s.type === 'recycling_allocation' && !analysisOptions.recyclingAllocation) return false
                if (s.type === 'activity_data' && !analysisOptions.activityData) return false
                if (s.type === 'use_phase' && !analysisOptions.usePhase) return false
                if (s.type === 'eol_scenario' && !analysisOptions.eolScenario) return false
                return true
            })

            const finalResult = {
                ...result,
                scenarios: filteredScenarios,
                significantFactors: filteredScenarios
                    .filter(s => s.isSignificant)
                    .map(s => s.nameKo)
            }

            setAnalysisResult(finalResult)
            // 스토어에 민감도 분석 결과 저장
            setSensitivityAnalysis(finalResult)
            setIsAnalyzing(false)
        }, 500)
    }

    // 토네이도 차트 데이터
    const tornadoData = useMemo(() => {
        if (!analysisResult) return []
        return generateTornadoChartData(analysisResult.scenarios)
    }, [analysisResult])

    return (
        <div className="space-y-8">
            {/* 헤더 */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">민감도 분석</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        ISO 14067 6.4.5, 6.4.6.1, 6.6
                    </span>
                </div>
                <p className="text-sm text-muted-foreground">
                    방법론 선택과 데이터 변동이 CFP 결과에 미치는 영향을 분석합니다.
                </p>
            </div>

            {/* 기준 CFP */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">기준 CFP (Baseline)</p>
                            <p className="text-3xl font-bold">{baselineCFP.toFixed(2)} <span className="text-base font-normal text-muted-foreground">kg CO₂e</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">기능 단위</p>
                            <p className="font-medium">{productInfo.unit}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ISO 14067 요구사항 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        ISO 14067 민감도 분석 요구사항
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {SENSITIVITY_REQUIREMENTS.map((req) => (
                            <div
                                key={req.clause}
                                className={`p-3 rounded-lg border ${req.mandatory
                                    ? 'border-yellow-500/30 bg-yellow-500/5'
                                    : 'border-border/50 bg-muted/30'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 ${req.mandatory ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                                        {req.mandatory ? (
                                            <AlertTriangle className="h-4 w-4" />
                                        ) : (
                                            <Info className="h-4 w-4" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                                {req.clause}
                                            </span>
                                            <span className="font-medium text-sm">{req.titleKo}</span>
                                            {req.mandatory && (
                                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                                                    필수
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {req.requirementKo}
                                        </p>
                                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                                            조건: {req.condition}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* 분석 옵션 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        분석 옵션
                    </CardTitle>
                    <CardDescription>
                        수행할 민감도 분석 유형을 선택하세요.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <AnalysisOptionCard
                            icon={<Zap className="h-5 w-5" />}
                            title="전력 그리드"
                            description="다양한 전력 그리드 믹스 비교"
                            checked={analysisOptions.electricityGrid}
                            onChange={(checked) => setAnalysisOptions(prev => ({ ...prev, electricityGrid: checked }))}
                            isoClause="6.4.9.4"
                        />
                        <AnalysisOptionCard
                            icon={<Truck className="h-5 w-5" />}
                            title="운송 모드"
                            description="트럭/철도/선박/항공 비교"
                            checked={analysisOptions.transportMode}
                            onChange={(checked) => setAnalysisOptions(prev => ({ ...prev, transportMode: checked }))}
                        />
                        <AnalysisOptionCard
                            icon={<Recycle className="h-5 w-5" />}
                            title="재활용 할당"
                            description="다양한 할당 방법 비교"
                            checked={analysisOptions.recyclingAllocation}
                            onChange={(checked) => setAnalysisOptions(prev => ({ ...prev, recyclingAllocation: checked }))}
                            isoClause="6.4.6.1"
                        />
                        <AnalysisOptionCard
                            icon={<BarChart3 className="h-5 w-5" />}
                            title="활동 데이터"
                            description="입력 데이터 ±변동 분석"
                            checked={analysisOptions.activityData}
                            onChange={(checked) => setAnalysisOptions(prev => ({ ...prev, activityData: checked }))}
                            isoClause="6.4.5"
                        />
                        {stages.includes('use') && (
                            <AnalysisOptionCard
                                icon={<TrendingUp className="h-5 w-5" />}
                                title="사용 단계"
                                description="사용 기간/강도 시나리오"
                                checked={analysisOptions.usePhase}
                                onChange={(checked) => setAnalysisOptions(prev => ({ ...prev, usePhase: checked }))}
                            />
                        )}
                        {stages.includes('eol') && (
                            <AnalysisOptionCard
                                icon={<TrendingDown className="h-5 w-5" />}
                                title="폐기 시나리오"
                                description="매립/소각/재활용 비교"
                                checked={analysisOptions.eolScenario}
                                onChange={(checked) => setAnalysisOptions(prev => ({ ...prev, eolScenario: checked }))}
                            />
                        )}
                    </div>

                    {/* 변동 범위 설정 */}
                    <div className="mt-6 pt-6 border-t">
                        <div className="flex items-center gap-4">
                            <Label className="text-sm">활동 데이터 변동 범위:</Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">±</span>
                                <Input
                                    type="number"
                                    value={analysisOptions.variationPercent}
                                    onChange={(e) => setAnalysisOptions(prev => ({
                                        ...prev,
                                        variationPercent: parseInt(e.target.value) || 20
                                    }))}
                                    className="w-20"
                                    min={5}
                                    max={50}
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                            </div>
                        </div>
                    </div>

                    {/* 분석 실행 버튼 */}
                    <div className="mt-6">
                        <Button
                            onClick={runAnalysis}
                            disabled={isAnalyzing || baselineCFP <= 0}
                            className="w-full"
                        >
                            {isAnalyzing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                    분석 중...
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4 mr-2" />
                                    민감도 분석 실행
                                </>
                            )}
                        </Button>
                        {baselineCFP <= 0 && (
                            <p className="text-xs text-yellow-500 mt-2 text-center">
                                활동 데이터를 먼저 입력해주세요.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 분석 결과 */}
            {analysisResult && (
                <>
                    {/* 요약 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">분석 결과 요약</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="p-4 rounded-lg bg-muted/50">
                                    <p className="text-sm text-muted-foreground">분석 시나리오</p>
                                    <p className="text-2xl font-bold">{analysisResult.scenarios.length}개</p>
                                </div>
                                <div className="p-4 rounded-lg bg-yellow-500/10">
                                    <p className="text-sm text-muted-foreground">유의미한 영향 요인</p>
                                    <p className="text-2xl font-bold text-yellow-500">
                                        {analysisResult.significantFactors.length}개
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        ({'>'}{SIGNIFICANCE_THRESHOLD}% 변화)
                                    </p>
                                </div>
                                <div className="p-4 rounded-lg bg-muted/50">
                                    <p className="text-sm text-muted-foreground">ISO 14067 준수</p>
                                    <p className="text-2xl font-bold">
                                        {analysisResult.isoCompliance.filter(c => c.satisfied).length}/
                                        {analysisResult.isoCompliance.length}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 토네이도 차트 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">토네이도 차트 (민감도 순위)</CardTitle>
                            <CardDescription>
                                각 파라미터 변동이 CFP에 미치는 영향 (기준 대비 %)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TornadoChart data={tornadoData} />
                        </CardContent>
                    </Card>

                    {/* 상세 시나리오 결과 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">상세 시나리오 결과</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScenarioTable scenarios={analysisResult.scenarios} />
                        </CardContent>
                    </Card>

                    {/* 권장사항 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Info className="h-4 w-4 text-blue-500" />
                                권장사항
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {analysisResult.recommendations.map((rec, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                                        {rec}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* ISO 준수 현황 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">ISO 14067 준수 현황</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {analysisResult.isoCompliance.map((item, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center gap-3 p-3 rounded-lg ${item.satisfied
                                            ? 'bg-green-500/10'
                                            : 'bg-red-500/10'
                                            }`}
                                    >
                                        {item.satisfied ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <AlertTriangle className="h-5 w-5 text-red-500" />
                                        )}
                                        <div>
                                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded mr-2">
                                                {item.clause}
                                            </span>
                                            <span className="text-sm">{item.requirement}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* ISO 14067 참고사항 */}
            <div className="p-4 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-2">
                <p className="font-medium">ISO 14067 민감도 분석 참고사항:</p>
                <ul className="list-disc list-inside space-y-1">
                    <li>
                        <span className="font-medium">6.4.5</span>: CFP-PCR 미사용 시, 시스템 경계 정제 결정은
                        민감도 분석에 기반해야 합니다.
                    </li>
                    <li>
                        <span className="font-medium">6.4.6.1</span>: 여러 할당 방법이 적용 가능한 경우,
                        선택한 방법과의 차이를 보여주는 민감도 분석이 필수입니다.
                    </li>
                    <li>
                        <span className="font-medium">6.4.9.4</span>: 재생에너지 인증서 등 특수 전력 속성 사용 시,
                        소비 그리드 믹스를 적용한 민감도 분석 결과를 보고해야 합니다.
                    </li>
                    <li>
                        <span className="font-medium">6.6</span>: 해석 단계에서 중요 투입물, 산출물,
                        방법론 선택에 대한 민감도 분석을 권장합니다.
                    </li>
                </ul>
            </div>
        </div>
    )
}

// =============================================================================
// 헬퍼 컴포넌트
// =============================================================================

interface AnalysisOptionCardProps {
    icon: React.ReactNode
    title: string
    description: string
    checked: boolean
    onChange: (checked: boolean) => void
    isoClause?: string
}

function AnalysisOptionCard({
    icon,
    title,
    description,
    checked,
    onChange,
    isoClause
}: AnalysisOptionCardProps) {
    return (
        <div
            className={`p-4 rounded-lg border cursor-pointer transition-all ${checked
                ? 'border-primary bg-primary/5'
                : 'border-border/50 hover:border-primary/50'
                }`}
            onClick={() => onChange(!checked)}
        >
            <div className="flex items-start gap-3">
                <Checkbox
                    checked={checked}
                    onCheckedChange={onChange}
                    className="mt-0.5"
                />
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <div className={checked ? 'text-primary' : 'text-muted-foreground'}>
                            {icon}
                        </div>
                        <span className="font-medium text-sm">{title}</span>
                        {isoClause && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                {isoClause}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </div>
            </div>
        </div>
    )
}

interface TornadoChartProps {
    data: { parameter: string; low: number; high: number; base: number }[]
}

function TornadoChart({ data }: TornadoChartProps) {
    if (data.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                분석 결과가 없습니다.
            </div>
        )
    }

    const maxAbsValue = Math.max(
        ...data.map(d => Math.max(Math.abs(d.low), Math.abs(d.high)))
    )
    const scale = maxAbsValue > 0 ? 100 / maxAbsValue : 1

    return (
        <div className="space-y-3">
            {data.slice(0, 10).map((item, index) => {
                const lowWidth = Math.abs(item.low) * scale
                const highWidth = Math.abs(item.high) * scale
                const isSignificant = Math.abs(item.low) >= SIGNIFICANCE_THRESHOLD ||
                    Math.abs(item.high) >= SIGNIFICANCE_THRESHOLD

                return (
                    <div key={index} className="flex items-center gap-2">
                        <div className="w-32 text-xs text-right truncate" title={item.parameter}>
                            {item.parameter}
                        </div>
                        <div className="flex-1 flex items-center">
                            {/* 왼쪽 (감소) */}
                            <div className="w-1/2 flex justify-end">
                                <div
                                    className={`h-6 rounded-l ${isSignificant ? 'bg-red-500' : 'bg-red-500/50'
                                        }`}
                                    style={{ width: `${lowWidth}%` }}
                                />
                            </div>
                            {/* 중앙선 */}
                            <div className="w-px h-8 bg-border" />
                            {/* 오른쪽 (증가) */}
                            <div className="w-1/2 flex justify-start">
                                <div
                                    className={`h-6 rounded-r ${isSignificant ? 'bg-green-500' : 'bg-green-500/50'
                                        }`}
                                    style={{ width: `${highWidth}%` }}
                                />
                            </div>
                        </div>
                        <div className="w-24 text-xs">
                            <span className="text-red-500">{item.low.toFixed(1)}%</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className="text-green-500">+{item.high.toFixed(1)}%</span>
                        </div>
                    </div>
                )
            })}

            {/* 범례 */}
            <div className="flex justify-center gap-6 pt-4 border-t mt-4">
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    <span>CFP 감소</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded bg-green-500" />
                    <span>CFP 증가</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-px h-4 bg-border" />
                    <span>유의성 임계값 ({SIGNIFICANCE_THRESHOLD}%)</span>
                </div>
            </div>
        </div>
    )
}

interface ScenarioTableProps {
    scenarios: SensitivityScenario[]
}

function ScenarioTable({ scenarios }: ScenarioTableProps) {
    const [filter, setFilter] = useState<'all' | 'significant'>('all')

    const filteredScenarios = filter === 'significant'
        ? scenarios.filter(s => s.isSignificant)
        : scenarios

    const groupedScenarios = filteredScenarios.reduce((acc, s) => {
        if (!acc[s.type]) acc[s.type] = []
        acc[s.type].push(s)
        return acc
    }, {} as Record<SensitivityAnalysisType, SensitivityScenario[]>)

    const typeLabels: Record<SensitivityAnalysisType, string> = {
        electricity_grid: '전력 그리드',
        allocation_method: '할당 방법',
        recycling_allocation: '재활용 할당',
        emission_factor: '배출계수',
        activity_data: '활동 데이터',
        use_phase: '사용 단계',
        eol_scenario: '폐기 시나리오',
        transport_mode: '운송 모드',
        system_boundary: '시스템 경계'
    }

    return (
        <div className="space-y-4">
            {/* 필터 */}
            <div className="flex gap-2">
                <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                >
                    전체 ({scenarios.length})
                </Button>
                <Button
                    variant={filter === 'significant' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('significant')}
                >
                    유의미한 요인 ({scenarios.filter(s => s.isSignificant).length})
                </Button>
            </div>

            {/* 그룹별 테이블 */}
            {Object.entries(groupedScenarios).map(([type, typeScenarios]) => (
                <div key={type} className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                        {typeLabels[type as SensitivityAnalysisType]}
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {typeScenarios.length}
                        </span>
                    </h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 px-3">시나리오</th>
                                    <th className="text-left py-2 px-3">기준값</th>
                                    <th className="text-left py-2 px-3">대안값</th>
                                    <th className="text-right py-2 px-3">변화량</th>
                                    <th className="text-right py-2 px-3">변화율</th>
                                </tr>
                            </thead>
                            <tbody>
                                {typeScenarios.slice(0, 5).map((scenario) => (
                                    <tr
                                        key={scenario.id}
                                        className={`border-b ${scenario.isSignificant ? 'bg-yellow-500/5' : ''
                                            }`}
                                    >
                                        <td className="py-2 px-3">
                                            <div className="flex items-center gap-2">
                                                {scenario.isSignificant && (
                                                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                                )}
                                                <span className="truncate max-w-[200px]" title={scenario.nameKo}>
                                                    {scenario.nameKo}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3 text-muted-foreground">
                                            {scenario.baseValue}
                                        </td>
                                        <td className="py-2 px-3">
                                            {scenario.alternativeValue}
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            <span className={scenario.absoluteChange >= 0 ? 'text-red-500' : 'text-green-500'}>
                                                {scenario.absoluteChange >= 0 ? '+' : ''}{scenario.absoluteChange.toFixed(2)} kg
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            <span className={`font-medium ${scenario.percentageChange >= 0 ? 'text-red-500' : 'text-green-500'
                                                }`}>
                                                {scenario.percentageChange >= 0 ? '+' : ''}{scenario.percentageChange.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            {filteredScenarios.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    {filter === 'significant'
                        ? '유의미한 영향 요인이 없습니다.'
                        : '분석 결과가 없습니다.'}
                </div>
            )}
        </div>
    )
}

