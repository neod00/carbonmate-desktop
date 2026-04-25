import { useEffect, useState } from "react"
import { usePCFStore, TransportMode } from "@/lib/store"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { searchProxy, assessProxyQuality } from "@/lib/core/proxy-db"
import { Info, Zap, Truck, Package, Recycle, Factory, Leaf, Plus, Trash2, Search, Sparkles, ExternalLink, ArrowRightLeft, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText, Check } from "lucide-react"
import {
    ELECTRICITY_EMISSION_FACTORS,
    TRANSPORT_EMISSION_FACTORS,
    MATERIAL_EMISSION_FACTORS,
    getMaterialFactorsByCategory,
    getTransportFactorsByMode
} from "@/lib/emission-factors"
import { LciSearchModal } from "@/components/calculator/lci-search-modal"
import { BomUploadSection } from "@/components/calculator/bom-upload-section"
import { LciSearchItem, LciGuideInfo } from "@/lib/lci/types"
import { formatGeography, CONFIDENCE_TOOLTIP, ISO_DQI_INDICATORS, CONFIDENCE_INFO } from "@/lib/lci/constants"
import { TransportPanel } from "@/components/calculator/panels/transport-panel"

// =============================================================================
// 유틸리티
// =============================================================================

const generateId = () => Math.random().toString(36).substr(2, 9)

// =============================================================================
// 단계별 아이콘 및 라벨
// =============================================================================

const STAGE_CONFIG = {
    raw_materials: {
        icon: Package,
        label: '원료 채취 (Raw Materials)',
        description: '원자재 생산 및 전처리 과정의 배출'
    },
    manufacturing: {
        icon: Factory,
        label: '제조 (Manufacturing)',
        description: '공장 내 에너지 사용 및 공정 배출'
    },
    transport: {
        icon: Truck,
        label: '운송 (Transport)',
        description: '원료 운송 및 제품 배송'
    },
    packaging: {
        icon: Package,
        label: '포장 (Packaging)',
        description: '포장재 생산 및 폐기'
    },
    use: {
        icon: Zap,
        label: '사용 (Use Phase)',
        description: '제품 사용 중 에너지 소비'
    },
    eol: {
        icon: Recycle,
        label: '폐기 (End-of-Life)',
        description: '제품 폐기 및 재활용'
    }
}

// =============================================================================
// 메인 컴포넌트
// =============================================================================

export function ActivityDataStep() {
    const {
        stages,
        activityData,
        setActivityData,
        setTransportMode,
        setElectricityGrid,
        productInfo
    } = usePCFStore()

    // 원자재 카테고리별 그룹
    const materialCategories = getMaterialFactorsByCategory()

    // 활성 탭 상태 (첫 번째 단계로 초기화)
    const [activeStage, setActiveStage] = useState<string>(stages[0] || '')

    // stages가 변경되면 activeStage 보정
    useEffect(() => {
        if (stages.length > 0 && !stages.includes(activeStage)) {
            setActiveStage(stages[0])
        }
    }, [stages, activeStage])

    // 단계별 데이터 완성도 확인
    const getStageCompleteness = (stageId: string): 'empty' | 'partial' | 'complete' => {
        const stageFields: Record<string, string[]> = {
            raw_materials: ['raw_material_weight'],
            manufacturing: ['electricity', 'gas'],
            transport: ['transport_weight', 'transport_distance'],
            packaging: ['packaging_weight'],
            use: ['use_electricity', 'use_years'],
            eol: ['waste_weight']
        }
        const fields = stageFields[stageId] || []
        if (fields.length === 0) return 'empty'

        const filledCount = fields.filter(f => {
            const val = (activityData as Record<string, any>)[f]
            return val !== undefined && val !== null && val !== 0 && val !== ''
        }).length

        if (filledCount === 0) return 'empty'
        if (filledCount >= fields.length) return 'complete'
        return 'partial'
    }

    const activeStageIndex = stages.indexOf(activeStage)
    const activeConfig = STAGE_CONFIG[activeStage as keyof typeof STAGE_CONFIG]

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="space-y-2">
                <h3 className="text-lg font-medium">활동 데이터 입력</h3>
                <p className="text-sm text-muted-foreground">
                    선택한 단계별 활동 데이터를 입력해주세요.
                    배출계수는 자동으로 적용되며, 필요 시 변경할 수 있습니다.
                </p>
            </div>

            {stages.length === 0 && (
                <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10">
                    <p className="text-muted-foreground">
                        선택된 단계가 없습니다. 이전 단계로 돌아가 단계를 선택해주세요.
                    </p>
                </div>
            )}

            {stages.length > 0 && (
                <>
                    {/* 서브탭 네비게이션 */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border/50 overflow-x-auto">
                        {stages.map((stageId) => {
                            const config = STAGE_CONFIG[stageId as keyof typeof STAGE_CONFIG]
                            if (!config) return null
                            const Icon = config.icon
                            const completeness = getStageCompleteness(stageId)
                            const isActive = stageId === activeStage

                            return (
                                <button
                                    key={stageId}
                                    onClick={() => setActiveStage(stageId)}
                                    className={`
                                        flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium 
                                        whitespace-nowrap transition-all duration-200 flex-1 min-w-0 justify-center
                                        ${isActive
                                            ? 'bg-background text-foreground shadow-sm border border-border/80'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                        }
                                    `}
                                >
                                    <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
                                    <span className="hidden sm:inline truncate">{config.label.split(' (')[0]}</span>
                                    {/* 완성도 인디케이터 */}
                                    <span className={`
                                        w-2 h-2 rounded-full flex-shrink-0
                                        ${completeness === 'complete' ? 'bg-emerald-500' : ''}
                                        ${completeness === 'partial' ? 'bg-yellow-500' : ''}
                                        ${completeness === 'empty' ? 'bg-muted-foreground/30' : ''}
                                    `} />
                                </button>
                            )
                        })}
                    </div>

                    {/* 활성 단계 컨텐츠 */}
                    {activeConfig && (
                        <Card className="border-border/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-3 text-lg">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        {(() => { const Icon = activeConfig.icon; return <Icon className="h-5 w-5 text-primary" /> })()}
                                    </div>
                                    {activeConfig.label}
                                    {getStageCompleteness(activeStage) === 'complete' && (
                                        <span className="ml-auto flex items-center gap-1 text-xs font-normal text-emerald-500">
                                            <Check className="h-3.5 w-3.5" />
                                            입력 완료
                                        </span>
                                    )}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    {activeConfig.description}
                                </p>
                            </CardHeader>
                            <CardContent>
                                {renderStageInputs(activeStage, activityData, setActivityData, setTransportMode, setElectricityGrid)}
                            </CardContent>
                        </Card>
                    )}

                    {/* 이전/다음 단계 네비게이션 */}
                    <div className="flex items-center justify-between">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveStage(stages[activeStageIndex - 1])}
                            disabled={activeStageIndex <= 0}
                            className="gap-1.5"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            이전 단계
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {activeStageIndex + 1} / {stages.length} 단계
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveStage(stages[activeStageIndex + 1])}
                            disabled={activeStageIndex >= stages.length - 1}
                            className="gap-1.5"
                        >
                            다음 단계
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </>
            )}

            {/* 데이터 품질 안내 */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-blue-400 mb-1">데이터 품질 안내</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>기본 배출계수는 2차 데이터(Secondary Data)입니다.</li>
                        <li>더 정확한 결과를 위해 실제 공급망 데이터를 사용하세요.</li>
                        <li>불확실성 범위는 결과 페이지에서 확인할 수 있습니다.</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

// =============================================================================
// 단계별 입력 폼 렌더링
// =============================================================================

function renderStageInputs(
    stageId: string,
    activityData: Record<string, any>,
    setActivityData: (id: string, value: number) => void,
    setTransportMode: (mode: TransportMode) => void,
    setElectricityGrid: (grid: string) => void
) {
    switch (stageId) {
        case 'raw_materials':
            return <RawMaterialsInputs activityData={activityData} setActivityData={setActivityData} />
        case 'manufacturing':
            return <ManufacturingInputs
                activityData={activityData}
                setActivityData={setActivityData}
                setElectricityGrid={setElectricityGrid}
            />
        case 'transport':
            return <TransportPanel />
        case 'packaging':
            return <PackagingInputs activityData={activityData} setActivityData={setActivityData} />
        case 'use':
            return <UsePhaseInputs
                activityData={activityData}
                setActivityData={setActivityData}
                setElectricityGrid={setElectricityGrid}
            />
        case 'eol':
            return <EndOfLifeInputs activityData={activityData} setActivityData={setActivityData} />
        default:
            return null
    }
}

// =============================================================================
// 원자재 입력
// =============================================================================

function RawMaterialsInputs({
    activityData,
    setActivityData
}: {
    activityData: Record<string, any>
    setActivityData: (id: string, value: number) => void
}) {
    const {
        detailedActivityData,
        addRawMaterial,
        removeRawMaterial,
        updateRawMaterial,
        productInfo  // 제품 정보 추가
    } = usePCFStore()

    const [lciModalOpen, setLciModalOpen] = useState(false)
    const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null)
    const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null)
    const [decomposing, setDecomposing] = useState<string | null>(null) // 분해 중인 항목 ID
    const [suggestingProxy, setSuggestingProxy] = useState<string | null>(null) // 프록시 추천 중인 항목 ID
    const [proxyData, setProxyData] = useState<Record<string, any>>({}) // 항목별 프록시 추천 결과
    const materialCategories = getMaterialFactorsByCategory()
    const rawMaterials = detailedActivityData?.raw_materials || []

    // AI 유사 데이터(프록시) 추천 함수
    const handleSuggestProxy = async (item: any) => {
        if (!item.name || suggestingProxy) return;

        setSuggestingProxy(item.id);

        try {
            // Local Proxy DB 검색
            await new Promise(resolve => setTimeout(resolve, 500)); // 심비안(UX)을 위한 짧은 지연

            const results = searchProxy(item.name);

            if (results.length > 0) {
                const bestMatch = results[0];
                const quality = assessProxyQuality(bestMatch.proxy, item.name);

                setProxyData(prev => ({
                    ...prev,
                    [item.id]: {
                        proxyName: bestMatch.proxy.name,
                        proxyNameKo: bestMatch.proxy.nameKo,
                        reason: bestMatch.matchReason,
                        accuracy: bestMatch.matchScore >= 80 ? 'high' : bestMatch.matchScore >= 50 ? 'medium' : 'low',
                        source: bestMatch.proxy.source,
                        searchKeyword: bestMatch.proxy.nameKo || bestMatch.proxy.name
                    }
                }));
            } else {
                // 매칭된 결과가 없을 경우
                // 필요시 기본값이나 알림 처리
                console.log("No proxy match found for:", item.name);
            }

        } catch (error) {
            console.error('프록시 추천 오류:', error);
        } finally {
            setSuggestingProxy(null);
        }
    };

    // 프록시 데이터 선택 (LCI 검색 트리거)
    const handleSelectProxy = async (item: any, proxy: any) => {
        if (!proxy?.searchKeyword) return;

        // 프록시 키워드로 LCI 모달 열기
        setActiveMaterialId(item.id);
        setLciModalOpen(true);

        // 프록시 정보를 아이템에 저장 (나중에 보고서에 사용)
        updateRawMaterial(item.id, {
            isProxy: true,
            proxyInfo: {
                originalName: item.name,
                assumption: proxy.reason || `${item.name}의 유사 데이터로 "${proxy.proxyNameKo || proxy.proxyName}" 사용`,
                uncertainty: proxy.accuracy === 'high' ? '±10%' : proxy.accuracy === 'medium' ? '±20%' : '±30%',
                source: proxy.source || 'AI-suggested proxy'
            }
        });
    };

    // AI 스마트 분해 함수
    const handleDecompose = async (item: any) => {
        if (!item.name || decomposing) return;

        setDecomposing(item.id);

        try {
            const response = await fetch('/api/catalog/decompose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    materialName: item.name,
                    quantity: item.quantity,
                    unit: item.unit,
                    // 제품 맥락 전달
                    productContext: {
                        productName: productInfo?.name || '',
                        category: productInfo?.category || 'other',
                        functionalUnit: productInfo?.unit || '1 kg'
                    }
                }),
            });

            if (!response.ok) {
                throw new Error('분해 API 실패');
            }

            const data = await response.json();

            if (data.decomposition && data.decomposition.length > 0) {
                // 원본 항목의 수량을 기준으로 분해된 항목들 생성
                const baseQuantity = item.quantity || 1;

                data.decomposition.forEach((comp: any, idx: number) => {
                    const newId = generateId();
                    const componentQuantity = (baseQuantity * comp.percentage) / 100;

                    addRawMaterial({
                        id: newId,
                        stageId: 'raw_materials',
                        name: comp.nameKo || comp.name,
                        quantity: Math.round(componentQuantity * 1000) / 1000, // 소수점 3자리
                        unit: item.unit || 'g',
                        emissionSourceType: 'fossil',
                        materialType: 'material_custom',
                        dataQuality: {
                            type: 'secondary',
                            source: 'AI 분해 추천',
                            year: 2024,
                            geographicScope: 'Global',
                            uncertainty: 25
                        },
                        isProxy: true,
                        proxyInfo: {
                            originalName: item.name,
                            assumption: data.assumption || `${item.name}의 구성 성분으로 분해`,
                            uncertainty: data.uncertainty || '±20%',
                            source: 'AI-generated decomposition (ecoinvent compatible)'
                        },
                        decomposedFrom: item.id
                    } as any);
                });

                // 원본 항목 삭제
                removeRawMaterial(item.id);
            }
        } catch (error) {
            console.error('분해 오류:', error);
            alert('AI 분해에 실패했습니다. 직접 EF를 입력하거나 AI 검색을 사용해 주세요.');
        } finally {
            setDecomposing(null);
        }
    };

    const handleAddMaterial = () => {
        addRawMaterial({
            id: generateId(),
            stageId: 'raw_materials',
            name: 'New Material',
            quantity: 0,
            unit: 'kg',
            emissionSourceType: 'fossil', // 기본값
            materialType: 'material_steel_primary', // 기본값
            dataQuality: {
                type: 'secondary',
                source: '국가 LCI DB',
                year: 2023,
                geographicScope: 'Korea',
                uncertainty: 30
            }
        })
    }

    // 레거시 데이터 마이그레이션 (최초 1회, 목록이 비어있고 레거시 데이터가 있는 경우)
    useEffect(() => {
        if (rawMaterials.length === 0 && (activityData['raw_material_weight'] || 0) > 0) {
            addRawMaterial({
                id: generateId(),
                stageId: 'raw_materials',
                name: 'Legacy Material',
                quantity: activityData['raw_material_weight'],
                unit: 'kg',
                emissionSourceType: 'fossil',
                materialType: activityData['raw_material_type'] || 'material_steel_primary',
                dataQuality: {
                    type: 'secondary',
                    source: '국가 LCI DB',
                    year: 2023,
                    geographicScope: 'Korea',
                    uncertainty: 30
                }
            })
            // 레거시 데이터 초기화 (중복 방지)
            setActivityData('raw_material_weight', 0)
        }
    }, [])

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>원자재 목록</Label>
                    <Button onClick={handleAddMaterial} size="sm" variant="outline" className="h-8 gap-2">
                        <Plus className="h-4 w-4" /> 원자재 추가
                    </Button>
                </div>

                {rawMaterials.length === 0 ? (
                    <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground bg-muted/20">
                        <p>등록된 원자재가 없습니다.</p>
                        <p className="text-xs mt-1">수동으로 추가하거나, BOM 파일을 업로드하세요.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* 사용 팁 안내 */}
                        <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-md flex items-start gap-2">
                            <span className="shrink-0">💡</span>
                            <div className="space-y-0.5">
                                <p><strong>✨</strong> AI 추천: LCI DB에서 ISO 적합성이 높은 데이터를 자동 검색</p>
                                <p><strong>EF</strong> 배출계수: 국가 LCI DB, ecoinvent 등 보유 자료의 값을 직접 입력</p>
                                <p><strong>▼</strong> 상세: LCI 정보와 AI 선정 근거 확인</p>
                            </div>
                        </div>

                        {/* 컷-오프 분석 (ISO 14067) */}
                        {(() => {
                            // 총 중량 계산 (단위 변환 포함)
                            const totalWeight = rawMaterials.reduce((acc, curr) => {
                                const qty = curr.quantity || 0
                                const unit = (curr.unit || 'kg').toLowerCase()
                                if (unit === 'g') return acc + (qty / 1000)
                                if (unit === 't' || unit === 'ton' || unit === 'tonne') return acc + (qty * 1000)
                                if (unit === 'kg') return acc + qty
                                return acc
                            }, 0)

                            if (totalWeight === 0) return null

                            // 기여도 계산 및 정렬
                            const itemsWithStats = rawMaterials.map(item => {
                                const qty = item.quantity || 0
                                const unit = (item.unit || 'kg').toLowerCase()
                                let weightInKg = 0
                                if (unit === 'g') weightInKg = qty / 1000
                                else if (unit === 't' || unit === 'ton' || unit === 'tonne') weightInKg = qty * 1000
                                else if (unit === 'kg') weightInKg = qty

                                const contribution = totalWeight > 0 ? (weightInKg / totalWeight) * 100 : 0
                                return { ...item, contribution, weightInKg }
                            }).sort((a, b) => b.contribution - a.contribution)

                            // 컷오프 시뮬레이션 (1% 미만 제외 시)
                            const CUTOFF_THRESHOLD = 1.0
                            const included = itemsWithStats.filter(i => i.contribution >= CUTOFF_THRESHOLD)
                            const excluded = itemsWithStats.filter(i => i.contribution < CUTOFF_THRESHOLD)
                            const coverage = included.reduce((sum, i) => sum + i.contribution, 0)

                            return (
                                <div className="space-y-3 p-3 border border-border/50 rounded-md bg-muted/20">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">📊 컷-오프 분석 (Cut-off Criteria)</span>
                                            <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">ISO 14067 6.3.4.3</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            총 중량: <span className="font-medium text-foreground">{totalWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="p-2 rounded bg-muted/30 border border-border/50 text-center">
                                            <div className="text-[10px] text-muted-foreground">포함 (1% 이상)</div>
                                            <div className="font-semibold text-foreground">{included.length}개 항목</div>
                                        </div>
                                        <div className="p-2 rounded bg-muted/30 border border-border/50 text-center">
                                            <div className="text-[10px] text-muted-foreground">제외 (1% 미만)</div>
                                            <div className="font-semibold text-foreground">{excluded.length}개 항목</div>
                                            <div className="text-[9px] text-muted-foreground/70">총 {excluded.reduce((sum, i) => sum + i.contribution, 0).toFixed(1)}% 비중</div>
                                        </div>
                                        <div className={`p-2 rounded border text-center ${coverage >= 95 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                                            <div className={`text-[10px] ${coverage >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>데이터 커버리지</div>
                                            <div className={`font-semibold ${coverage >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>{coverage.toFixed(1)}%</div>
                                        </div>
                                    </div>

                                    {coverage < 95 && (
                                        <div className="text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20 flex items-start gap-1.5">
                                            <span>⚠️</span>
                                            <span>ISO 14067은 질량 기준 95% 이상의 투입물을 포함할 것을 권장합니다. 누락된 원자재가 없는지 확인하세요.</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                        {/* 테이블 헤더 */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-t-md text-[10px] text-muted-foreground font-medium border-b">
                            <div className="w-[90px]"># / 상태</div>
                            <div className="flex-1">원자재명</div>
                            <div className="w-[100px] text-center">수량</div>
                            <div className="w-[24px]"></div>
                            <div className="w-[120px] text-center">배출계수 (EF)</div>
                            <div className="w-[90px] text-center">예상 배출</div>
                            <div className="w-[50px] text-center">상세</div>
                        </div>
                        {rawMaterials.map((item, index) => {
                            const lciGuide = (item as any).lciGuide
                            const getConfidenceBadge = (confidence: string | undefined) => {
                                const info = confidence ? CONFIDENCE_INFO[confidence as keyof typeof CONFIDENCE_INFO] : null;
                                return info || null;
                            }
                            const badge = getConfidenceBadge(lciGuide?.matchConfidence)

                            return (
                                <div key={item.id} className="border rounded-lg bg-card overflow-hidden">
                                    {/* 컴팩트 가로형 레이아웃: 한 줄에 핵심 정보 */}
                                    <div className="flex items-center gap-2 px-3 py-2">
                                        {/* # 번호 및 매칭 신뢰도/프록시 배지 */}
                                        <div className="flex items-center gap-1.5 w-[90px] shrink-0">
                                            <span className="text-xs text-muted-foreground">#{index + 1}</span>
                                            {(item as any).isProxy ? (
                                                <span
                                                    className="text-[9px] px-1 py-0.5 rounded border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-help"
                                                    title={`🧬 프록시 데이터\n원본: ${(item as any).proxyInfo?.originalName || '알 수 없음'}\n가정: ${(item as any).proxyInfo?.assumption || ''}\n불확실성: ${(item as any).proxyInfo?.uncertainty || '±20%'}`}
                                                >
                                                    🧬 분해
                                                </span>
                                            ) : badge ? (
                                                <span
                                                    className={`text-[9px] px-1 py-0.5 rounded border ${badge.color} cursor-help`}
                                                    title={CONFIDENCE_TOOLTIP}
                                                >
                                                    🔍 {badge.label}
                                                </span>
                                            ) : null}
                                            {item.dataQuality?.type && (
                                                <span className={`text-[9px] px-1 py-0.5 rounded border cursor-help ${item.dataQuality.type === 'primary'
                                                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                                        : item.dataQuality.type === 'secondary'
                                                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                                            : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                                    }`} title={`데이터 품질: ${item.dataQuality.type === 'primary' ? '1차 데이터' : item.dataQuality.type === 'secondary' ? '2차 데이터' : '추정 데이터'}${item.dataQuality.source ? `\n출처: ${item.dataQuality.source}` : ''}`}>
                                                    {item.dataQuality.type === 'primary' ? '1차' : item.dataQuality.type === 'secondary' ? '2차' : '추정'}
                                                </span>
                                            )}
                                        </div>

                                        {/* 원자재명 + AI 추천 버튼 */}
                                        <div className="flex-1 min-w-0 flex items-center gap-1">
                                            <span className="text-sm font-medium truncate" title={lciGuide?.activityName || item.name}>
                                                📦 {item.name || '원자재명 입력'}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0 text-primary shrink-0"
                                                onClick={() => {
                                                    setActiveMaterialId(item.id)
                                                    setLciModalOpen(true)
                                                }}
                                            >
                                                <Sparkles className="h-3 w-3" />
                                            </Button>
                                        </div>

                                        {/* 수량 입력 */}
                                        <div className="flex items-center gap-1 w-[100px] shrink-0">
                                            <Input
                                                type="number"
                                                placeholder="수량"
                                                value={item.quantity || ''}
                                                onChange={(e) => updateRawMaterial(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                                className="h-7 text-sm w-full text-center"
                                            />
                                            <span className="text-[10px] text-muted-foreground shrink-0 w-4">{item.unit || 'kg'}</span>
                                        </div>

                                        {/* 단위 변환 버튼 */}
                                        <div className="w-[24px] shrink-0 flex justify-center">
                                            {(item.unit === 'g' || item.unit === 'kg') && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-muted-foreground"
                                                    onClick={() => {
                                                        if (item.unit === 'g') {
                                                            updateRawMaterial(item.id, { quantity: (item.quantity || 0) / 1000, unit: 'kg' })
                                                        } else {
                                                            updateRawMaterial(item.id, { quantity: (item.quantity || 0) * 1000, unit: 'g' })
                                                        }
                                                    }}
                                                >
                                                    <ArrowRightLeft className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>

                                        {/* 배출계수 입력 */}
                                        <div className="flex items-center gap-1 w-[120px] shrink-0">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="EF"
                                                value={item.customEmissionFactor || ''}
                                                onChange={(e) => updateRawMaterial(item.id, { customEmissionFactor: parseFloat(e.target.value) || 0 })}
                                                className={`h-7 text-sm w-full text-center ${!item.customEmissionFactor ? 'border-orange-500/50' : ''}`}
                                            />
                                            <span className="text-[9px] text-muted-foreground shrink-0 leading-tight w-[40px]">kgCO2e<br />/kg</span>
                                        </div>

                                        {/* 예상 배출량 (수량 × EF) */}
                                        <div className="w-[90px] shrink-0 text-center">
                                            {item.customEmissionFactor && item.quantity ? (
                                                <span className="text-xs font-medium text-emerald-400" title={`${item.quantity} × ${item.customEmissionFactor} = ${(item.quantity * item.customEmissionFactor).toFixed(2)} kgCO₂e`}>
                                                    {((item.quantity * item.customEmissionFactor) >= 1000)
                                                        ? `${((item.quantity * item.customEmissionFactor) / 1000).toFixed(2)}t`
                                                        : `${(item.quantity * item.customEmissionFactor).toFixed(1)}`
                                                    }
                                                    <span className="text-[9px] text-muted-foreground ml-0.5">kgCO₂e</span>
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground">—</span>
                                            )}
                                        </div>

                                        {/* 상세 토글 + 삭제 */}
                                        <div className="flex items-center gap-1 w-[50px] shrink-0 justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => setExpandedMaterialId(expandedMaterialId === item.id ? null : item.id)}
                                            >
                                                {expandedMaterialId === item.id ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                                onClick={() => removeRawMaterial(item.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* 확장된 상세 정보 패널 (접이식) */}
                                    {expandedMaterialId === item.id && (
                                        <div className="px-3 py-2 border-t bg-muted/10 space-y-2">
                                            {/* LCI 매칭 정보 */}
                                            {lciGuide ? (
                                                <div className="p-2 rounded bg-primary/5 border border-primary/20 space-y-3">
                                                    {/* LCI 매칭 데이터 요약 */}
                                                    <p className="text-xs font-medium truncate">
                                                        → {lciGuide.referenceProductName || lciGuide.activityName}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                                        <span title={lciGuide.geography}>🌍 {formatGeography(lciGuide.geography)}</span>
                                                        <span>•</span>
                                                        {lciGuide.isoScores?.overall && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${lciGuide.isoScores.overall >= 80 ? 'bg-green-500/20 text-green-600' :
                                                                lciGuide.isoScores.overall >= 60 ? 'bg-yellow-500/20 text-yellow-600' :
                                                                    'bg-red-500/20 text-red-600'
                                                                }`}>
                                                                ISO {lciGuide.isoScores.overall}점 {lciGuide.isoScores.overall < 70 && '⚠️'}
                                                            </span>
                                                        )}
                                                        {lciGuide.techCategory && lciGuide.techCategory !== 'unknown' && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${lciGuide.techCategory === 'virgin' ? 'bg-blue-500/20 text-blue-600' :
                                                                lciGuide.techCategory === 'recycled' ? 'bg-emerald-500/20 text-emerald-600' :
                                                                    'bg-gray-500/20 text-gray-600'
                                                                }`}>
                                                                {lciGuide.techCategory === 'virgin' ? '신재' : lciGuide.techCategory === 'recycled' ? '재생' : '혼합'}
                                                            </span>
                                                        )}
                                                        {lciGuide.ecoQueryUrl && (
                                                            <a href={lciGuide.ecoQueryUrl} target="_blank" rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-primary hover:underline ml-auto">
                                                                <ExternalLink className="h-3 w-3" /> 상세
                                                            </a>
                                                        )}
                                                    </div>

                                                    {/* AI 선정 근거 */}
                                                    {lciGuide.recommendationReason && (
                                                        <p className="text-[10px] text-muted-foreground bg-muted/50 p-1.5 rounded">
                                                            💡 {lciGuide.recommendationReason}
                                                        </p>
                                                    )}

                                                    {/* ISO 14044 DQI 세부 점수 */}
                                                    {lciGuide.isoScores && (
                                                        <div className="mt-2 p-2 rounded bg-muted/30 border border-muted space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-medium text-primary">📊 ISO 14044 DQI 세부 점수</p>
                                                                {lciGuide.isoScores.overall < 70 && (
                                                                    <span className="text-[9px] text-orange-500 font-medium">⚠️ 저품질 주의</span>
                                                                )}
                                                            </div>
                                                            <div className="space-y-1">
                                                                {ISO_DQI_INDICATORS.map(({ key, label, weight }) => {
                                                                    const score = (lciGuide.isoScores as any)[key] || 0;
                                                                    const isLow = score < 70;
                                                                    return (
                                                                        <div key={key} className="flex items-center gap-2">
                                                                            <span className="text-[9px] w-16 text-muted-foreground truncate" title={`${label} (가중치 ${weight * 100}%)`}>
                                                                                {label}
                                                                            </span>
                                                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                                <div
                                                                                    className={`h-full rounded-full ${score >= 80 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                                                                                    style={{ width: `${score}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className={`text-[9px] w-6 text-right font-medium ${isLow ? 'text-orange-500' : 'text-muted-foreground'}`}>
                                                                                {score}
                                                                            </span>
                                                                            {isLow && <span className="text-[8px]">⚠️</span>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            <p className="text-[9px] text-muted-foreground pt-1 border-t">
                                                                * 가중치: 지역 25%, 기술 25%, 시간 15%, 완전 15%, 정밀 10%, 일관 10%
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {/* LCI 미발견 안내 헤더 */}
                                                    <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-orange-500 text-lg">⚠️</span>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium text-orange-400">
                                                                    LCI 데이터를 찾지 못했습니다
                                                                </p>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    "{item.name}"에 대한 정확한 매칭이 없습니다. 아래 세 가지 방법 중 하나를 선택하세요.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 3가지 선택지 카드 레이아웃 */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                                                        {/* 선택지 A: 유사 데이터 사용 */}
                                                        <div className="p-3 rounded-lg border bg-blue-500/5 border-blue-500/30 flex flex-col">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-blue-400 text-lg">🔄</span>
                                                                <p className="text-xs font-bold text-blue-400">유사 데이터 사용</p>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground mb-3 flex-1">
                                                                비슷한 특성의 ecoinvent 데이터를 AI가 추천합니다. 비중이 낮은 자재에 적합합니다.
                                                            </p>

                                                            {/* 프록시 추천 결과 표시 */}
                                                            {proxyData[item.id] ? (
                                                                <div className="space-y-2">
                                                                    <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                                                                        <p className="text-[10px] font-medium text-blue-300">
                                                                            추천: {proxyData[item.id].proxyNameKo || proxyData[item.id].proxyName}
                                                                        </p>
                                                                        <p className="text-[9px] text-muted-foreground mt-1">
                                                                            {proxyData[item.id].reason}
                                                                        </p>
                                                                        <div className="flex items-center gap-1 mt-1">
                                                                            <span className={`text-[9px] px-1 py-0.5 rounded ${proxyData[item.id].accuracy === 'high' ? 'bg-green-500/20 text-green-400' :
                                                                                proxyData[item.id].accuracy === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                                    'bg-orange-500/20 text-orange-400'
                                                                                }`}>
                                                                                정확도: {proxyData[item.id].accuracy === 'high' ? '높음' : proxyData[item.id].accuracy === 'medium' ? '보통' : '낮음'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 text-xs w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                                                        onClick={() => handleSelectProxy(item, proxyData[item.id])}
                                                                    >
                                                                        ✅ 이 데이터로 선택
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-xs w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                                                    onClick={() => handleSuggestProxy(item)}
                                                                    disabled={suggestingProxy === item.id}
                                                                >
                                                                    {suggestingProxy === item.id ? (
                                                                        <>
                                                                            <span className="animate-spin mr-1">⏳</span>
                                                                            추천 중...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            🔍 유사 데이터 찾기
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* 선택지 B: 구성 원료 분해 */}
                                                        <div className="p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/30 flex flex-col">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-emerald-400 text-lg">🧬</span>
                                                                <p className="text-xs font-bold text-emerald-400">구성 원료 분해</p>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground mb-3 flex-1">
                                                                가공품을 기본 원료(소금, 설탕, 유지 등)로 분해합니다. 정밀도가 높아 비중이 큰 자재에 권장됩니다.
                                                            </p>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 text-xs w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                                                onClick={() => handleDecompose(item)}
                                                                disabled={decomposing === item.id}
                                                            >
                                                                {decomposing === item.id ? (
                                                                    <>
                                                                        <span className="animate-spin mr-1">⏳</span>
                                                                        분해 중...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        🧬 원료로 분해
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </div>

                                                        {/* 선택지 C: 직접 입력 */}
                                                        <div className="p-3 rounded-lg border bg-muted/30 flex flex-col">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-muted-foreground text-lg">✏️</span>
                                                                <p className="text-xs font-bold text-muted-foreground">직접 EF 입력</p>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground mb-3 flex-1">
                                                                국가 LCI DB, ecoinvent 등에서 직접 찾은 배출계수 값을 입력합니다.
                                                            </p>
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                                                                    <span>💡</span>
                                                                    <a href="https://ecosq.or.kr/websquare.do#w2xPath=/ui/cer/ic/oh/ICOH110M01.xml&valVl=tabs3&menuSn=20018500" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                                        국가 LCI DB
                                                                    </a>
                                                                    <span>|</span>
                                                                    <a href="https://ecoquery.ecoinvent.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                                        ecoQuery
                                                                    </a>
                                                                </div>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-xs w-full"
                                                                    onClick={() => {
                                                                        // EF 입력 필드로 스크롤/포커스
                                                                        const efInput = document.querySelector(`input[placeholder="EF"]`) as HTMLInputElement;
                                                                        efInput?.focus();
                                                                    }}
                                                                >
                                                                    ✏️ EF 직접 입력
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 경고 메시지 */}
                                                    <p className="text-[10px] text-orange-400 bg-orange-500/5 p-2 rounded border border-orange-500/20">
                                                        ⚠️ 위 방법 중 하나를 선택하지 않으면 이 항목의 배출량은 0으로 계산되며, 결과 보고서에 "데이터 부재" 경고가 표시됩니다.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* 총계 표시 */}
            {rawMaterials.length > 0 && (
                <div className="flex justify-between items-center pt-2 border-t text-sm font-medium">
                    <div className="text-muted-foreground">
                        총 중량: {(() => {
                            const totalKg = rawMaterials.reduce((acc, curr) => {
                                const qty = curr.quantity || 0
                                const unit = (curr.unit || 'kg').toLowerCase()

                                if (unit === 'g') return acc + (qty / 1000)
                                if (unit === 't' || unit === 'ton' || unit === 'tonne') return acc + (qty * 1000)
                                if (unit === 'kg') return acc + qty

                                const nonMassUnits = ['ea', 'kwh', 'm2', 'm3', 'l', 'ml']
                                if (nonMassUnits.includes(unit)) return acc

                                return acc + qty
                            }, 0)

                            if (totalKg === 0) return '0 kg'
                            if (totalKg < 1) return `${(totalKg * 1000).toFixed(2)} g`
                            return `${totalKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} kg`
                        })()}
                    </div>
                    {(() => {
                        const totalEmission = rawMaterials.reduce((acc, curr) => {
                            if (curr.customEmissionFactor && curr.quantity) {
                                return acc + (curr.quantity * curr.customEmissionFactor)
                            }
                            return acc
                        }, 0)
                        const countWithEF = rawMaterials.filter(m => m.customEmissionFactor && m.quantity).length
                        if (totalEmission <= 0) return null
                        return (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">
                                    ({countWithEF}/{rawMaterials.length} 항목)
                                </span>
                                <span className="text-emerald-400">
                                    예상 배출: {totalEmission >= 1000
                                        ? `${(totalEmission / 1000).toFixed(2)} tCO₂e`
                                        : `${totalEmission.toFixed(1)} kgCO₂e`}
                                </span>
                            </div>
                        )
                    })()}
                </div>
            )}

            {/* BOM 업로드 섹션 */}
            <div className="mt-6">
                <BomUploadSection
                    onApplySelected={(selectedResults) => {
                        // 사용자가 선택한 BOM 항목들을 원자재로 추가
                        selectedResults.forEach(result => {
                            addRawMaterial({
                                id: generateId(),
                                stageId: 'raw_materials',
                                name: result.original.name,
                                quantity: result.original.quantity,
                                unit: result.original.unit || 'kg',
                                emissionSourceType: 'fossil',
                                materialType: 'material_custom', // LCI에서 가져온 데이터는 커스텀
                                dataQuality: {
                                    type: 'secondary',
                                    source: 'ecoinvent',
                                    year: 2023,
                                    geographicScope: result.matchedLci?.geography || 'Global',
                                    uncertainty: result.matchConfidence === 'high' ? 15 : result.matchConfidence === 'medium' ? 25 : 35
                                },
                                // LCI 가이드 정보 저장 (확장 필드)
                                lciGuide: result.matchedLci ? {
                                    activityUuid: result.matchedLci.activityUuid,
                                    activityName: result.matchedLci.activityName,
                                    referenceProductName: result.matchedLci.referenceProductName,
                                    geography: result.matchedLci.geography,
                                    unit: result.matchedLci.unit,
                                    priorityScore: result.matchedLci.priorityScore || 0,
                                    matchConfidence: result.matchConfidence,
                                    ecoQueryUrl: result.matchedLci.ecoQueryUrl,
                                    // ISO 점수 및 메타데이터
                                    isoScores: result.matchedLci.isoScores,
                                    techCategory: result.matchedLci.techCategory,
                                    materialType: result.matchedLci.materialType,
                                    recommendationReason: `ISO 14067 요구사항에 따라 지리적·기술적 대표성이 가장 높은 ecoinvent 3.12 DB의 ${result.matchedLci.geography} 지역 ${result.matchedLci.techCategory === 'recycled' ? '재생' : '신규'} 생산 데이터를 선정하였습니다. (ISO 14044 DQI 평가 결과 종합 점수: ${result.matchedLci.isoScores?.overall || 'N/A'}점)`
                                } : undefined
                            } as any)
                        })
                    }}
                />
            </div>

            {/* LCI 검색 모달 */}
            <LciSearchModal
                open={lciModalOpen}
                onOpenChange={setLciModalOpen}
                initialQuery={activeMaterialId ? rawMaterials.find(m => m.id === activeMaterialId)?.name : ''}
                onSelect={(item, guide) => {
                    if (activeMaterialId) {
                        updateRawMaterial(activeMaterialId, {
                            name: guide.activityName,
                            // LCI 가이드 정보 저장
                            lciGuide: {
                                activityUuid: guide.activityUuid,
                                activityName: guide.activityName,
                                geography: guide.geography,
                                unit: guide.unit,
                                isoComplianceScore: guide.isoComplianceScore,
                                recommendationReason: guide.recommendationReason,
                                dataQuality: guide.dataQuality,
                                // 신규 추가된 ISO 점수 및 메타데이터
                                isoScores: guide.isoScores,
                                techCategory: guide.techCategory,
                                processType: guide.processType,
                                materialType: guide.materialType,
                                // 검색 결과에서 직접 가져온 matchConfidence (있을 경우)
                                matchConfidence: (item as any).matchConfidence || 'high',
                                ecoQueryUrl: item.ecoQueryUrl
                            }
                        } as any)
                    }
                    setActiveMaterialId(null)
                    setLciModalOpen(false)
                }}
            />
        </div>
    )
}


// =============================================================================
// 제조 입력
// =============================================================================

function ManufacturingInputs({
    activityData,
    setActivityData,
    setElectricityGrid
}: {
    activityData: Record<string, any>
    setActivityData: (id: string, value: number) => void
    setElectricityGrid: (grid: string) => void
}) {
    return (
        <div className="space-y-6">
            {/* 전력 */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">전력 소비</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="electricity">전력 사용량 (kWh)</Label>
                        <Input
                            id="electricity"
                            type="number"
                            placeholder="예: 50"
                            value={activityData['electricity'] || ''}
                            onChange={(e) => setActivityData('electricity', parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="electricity_grid">전력 그리드</Label>
                        <Select
                            value={activityData['electricity_grid'] || 'electricity_korea_2023_consumption'}
                            onValueChange={(value) => setElectricityGrid(value)}
                        >
                            <SelectTrigger id="electricity_grid">
                                <SelectValue placeholder="그리드 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                {ELECTRICITY_EMISSION_FACTORS.map((ef) => (
                                    <SelectItem key={ef.id} value={ef.id}>
                                        {ef.nameKo} ({ef.value} {ef.unit})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* 연료 */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Factory className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">연료 소비</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="gas">천연가스 (MJ)</Label>
                        <Input
                            id="gas"
                            type="number"
                            placeholder="예: 10"
                            value={activityData['gas'] || ''}
                            onChange={(e) => setActivityData('gas', parseFloat(e.target.value) || 0)}
                        />
                        <p className="text-xs text-muted-foreground">
                            배출계수: 0.0561 kgCO₂e/MJ (IPCC)
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="diesel">경유 (L)</Label>
                        <Input
                            id="diesel"
                            type="number"
                            placeholder="예: 0"
                            value={activityData['diesel'] || ''}
                            onChange={(e) => setActivityData('diesel', parseFloat(e.target.value) || 0)}
                        />
                        <p className="text-xs text-muted-foreground">
                            배출계수: 2.68 kgCO₂e/L (IPCC)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// =============================================================================
// 운송 입력
// =============================================================================



// =============================================================================
// 포장 입력
// =============================================================================

function PackagingInputs({
    activityData,
    setActivityData
}: {
    activityData: Record<string, any>
    setActivityData: (id: string, value: number) => void
}) {
    const {
        detailedActivityData,
        addPackagingPart,
        removePackagingPart,
        updatePackagingPart
    } = usePCFStore()

    const packagingList = detailedActivityData?.packaging || []

    // 레거시 데이터 마이그레이션
    useEffect(() => {
        if (packagingList.length === 0 && (activityData['packaging_weight'] || 0) > 0) {
            addPackagingPart({
                id: generateId(),
                stageId: 'packaging',
                name: 'Legacy Packaging',
                quantity: activityData['packaging_weight'],
                unit: 'kg',
                emissionSourceType: 'fossil',
                materialType: activityData['packaging_material'] || 'material_paper_cardboard',
                dataQuality: {
                    type: 'secondary',
                    source: '국가 LCI DB',
                    year: 2023,
                    geographicScope: 'Korea',
                    uncertainty: 30
                }
            })
            // Reset legacy
            setActivityData('packaging_weight', 0)
        }
    }, [])

    const handleAddPackaging = () => {
        addPackagingPart({
            id: generateId(),
            stageId: 'packaging',
            name: 'New Packaging',
            quantity: 0,
            unit: 'kg',
            emissionSourceType: 'fossil',
            materialType: 'material_paper_cardboard',
            dataQuality: {
                type: 'secondary',
                source: '국가 LCI DB',
                year: 2023,
                geographicScope: 'Korea',
                uncertainty: 30
            }
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">포장재 목록</span>
                </div>
                <Button onClick={handleAddPackaging} size="sm" variant="outline" className="h-8 gap-2">
                    <Plus className="h-4 w-4" /> 포장재 추가
                </Button>
            </div>

            {packagingList.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground bg-muted/20">
                    등록된 포장재가 없습니다. '포장재 추가' 버튼을 눌러 추가해주세요.
                </div>
            ) : (
                <div className="space-y-3">
                    {packagingList.map((item, index) => (
                        <div key={item.id} className="grid gap-3 p-3 border rounded-lg bg-card relative group">
                            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => removePackagingPart(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 pr-8">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">포장재 종류 #{index + 1}</Label>
                                    <Select
                                        value={item.materialType}
                                        onValueChange={(value) => updatePackagingPart(item.id, { materialType: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="포장재 선택" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="material_paper_cardboard">골판지 (0.89 kgCO₂e/kg)</SelectItem>
                                            <SelectItem value="material_paper_kraft">크라프트지 (0.78 kgCO₂e/kg)</SelectItem>
                                            <SelectItem value="material_plastic_pe">PE 필름 (1.89 kgCO₂e/kg)</SelectItem>
                                            <SelectItem value="material_plastic_pp">PP (1.86 kgCO₂e/kg)</SelectItem>
                                            <SelectItem value="material_wood_softwood">목재 팔레트 (0.31 kgCO₂e/kg)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">포장재 중량 (kg)</Label>
                                    <Input
                                        type="number"
                                        placeholder="예: 5"
                                        value={item.quantity || ''}
                                        onChange={(e) => updatePackagingPart(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// =============================================================================
// 사용 단계 입력
// =============================================================================

function UsePhaseInputs({
    activityData,
    setActivityData,
    setElectricityGrid
}: {
    activityData: Record<string, any>
    setActivityData: (id: string, value: number) => void
    setElectricityGrid: (grid: string) => void
}) {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="use_electricity">수명 기간 전력 사용량 (kWh)</Label>
                    <Input
                        id="use_electricity"
                        type="number"
                        placeholder="예: 200"
                        value={activityData['use_electricity'] || ''}
                        onChange={(e) => setActivityData('use_electricity', parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">
                        제품의 전체 수명 동안 예상되는 전력 소비량
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="use_years">예상 사용 기간 (년)</Label>
                    <Input
                        id="use_years"
                        type="number"
                        placeholder="예: 5"
                        value={activityData['use_years'] || ''}
                        onChange={(e) => setActivityData('use_years', parseFloat(e.target.value) || 0)}
                    />
                </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">
                    <span className="font-medium">ISO 14067 6.3.7:</span> 사용 단계의 시나리오는
                    실제 사용 패턴을 반영해야 하며, 제조사 권장 사용 조건과 다를 수 있습니다.
                </p>
            </div>
        </div>
    )
}

// =============================================================================
// 폐기 단계 입력
// =============================================================================

function EndOfLifeInputs({
    activityData,
    setActivityData
}: {
    activityData: Record<string, any>
    setActivityData: (id: string, value: number) => void
}) {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="waste_weight">폐기물 중량 (kg)</Label>
                    <Input
                        id="waste_weight"
                        type="number"
                        placeholder="예: 100"
                        value={activityData['waste_weight'] || ''}
                        onChange={(e) => setActivityData('waste_weight', parseFloat(e.target.value) || 0)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="recycling_rate">재활용률 (%)</Label>
                    <Input
                        id="recycling_rate"
                        type="number"
                        placeholder="예: 30"
                        min="0"
                        max="100"
                        value={activityData['recycling_rate'] || ''}
                        onChange={(e) => setActivityData('recycling_rate', parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">
                        재활용되는 비율 (나머지는 소각/매립 처리)
                    </p>
                </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <Leaf className="h-4 w-4 text-green-500 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                    재활용은 1차 원자재 생산을 대체하여 배출량 크레딧을 제공합니다.
                    ISO 14067 6.4.6.3에 따라 할당됩니다.
                </p>
            </div>
        </div>
    )
}
