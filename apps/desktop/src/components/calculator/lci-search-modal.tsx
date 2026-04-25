"use client"

import { useState, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { searchLci, fetchRecommendation, LcaContext } from "@/lib/lci/lci-client"
import { LciSearchItem, LciGuideInfo, IntentResult } from "@/lib/lci/types"
import { Search, Loader2, Check, Sparkles, MapPin, Scale, Star, Brain, Info, ExternalLink } from "lucide-react"

interface LciSearchModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (item: LciSearchItem, guide: LciGuideInfo) => void
    context?: Partial<LcaContext>
    initialQuery?: string
}

export function LciSearchModal({
    open,
    onOpenChange,
    onSelect,
    context,
    initialQuery = ""
}: LciSearchModalProps) {
    const [query, setQuery] = useState(initialQuery)
    const [results, setResults] = useState<LciSearchItem[]>([])
    const [translatedQuery, setTranslatedQuery] = useState<string | undefined>()
    const [intentResult, setIntentResult] = useState<IntentResult | undefined>()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedItem, setSelectedItem] = useState<LciSearchItem | null>(null)
    const [loadingRecommendation, setLoadingRecommendation] = useState(false)
    // Phase 3: 선택 이유 표시 관련 상태
    const [selectionReason, setSelectionReason] = useState<{
        item: LciSearchItem;
        guide: LciGuideInfo;
    } | null>(null)

    // 모달이 열릴 때 initialQuery로 자동 검색
    useEffect(() => {
        if (open && initialQuery && initialQuery.trim()) {
            setQuery(initialQuery)
            // 자동 검색 실행
            const autoSearch = async () => {
                setLoading(true)
                setError(null)
                setResults([])
                setTranslatedQuery(undefined)
                setIntentResult(undefined)
                setSelectionReason(null)

                try {
                    const result = await searchLci(initialQuery, {
                        limit: 20,
                        productContext: {
                            productName: context?.productName,
                            category: context?.lcaPurpose,
                        }
                    })
                    setResults(result.hits || [])
                    setTranslatedQuery(result.translatedQuery)
                    setIntentResult(result.intent)

                    if (result.hits.length === 0) {
                        setError("검색 결과가 없습니다. 다른 키워드로 시도해보세요.")
                    }
                } catch (err) {
                    setError("검색 중 오류가 발생했습니다.")
                    console.error(err)
                } finally {
                    setLoading(false)
                }
            }
            autoSearch()
        }
    }, [open, initialQuery])

    // 모달이 닫힐 때 상태 초기화
    useEffect(() => {
        if (!open) {
            setResults([])
            setError(null)
            setTranslatedQuery(undefined)
            setIntentResult(undefined)
            setSelectionReason(null)
        }
    }, [open])

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return

        setLoading(true)
        setError(null)
        setResults([])
        setTranslatedQuery(undefined)
        setIntentResult(undefined)
        setSelectionReason(null)

        try {
            const result = await searchLci(query, {
                limit: 20,
                productContext: {
                    productName: context?.productName,
                    category: context?.lcaPurpose,
                }
            })
            setResults(result.hits || [])
            setTranslatedQuery(result.translatedQuery)
            setIntentResult(result.intent)

            if (result.hits.length === 0) {
                setError("검색 결과가 없습니다. 다른 키워드로 시도해보세요.")
            }
        } catch (err) {
            setError("검색 중 오류가 발생했습니다.")
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [query, context])

    const handleSelect = useCallback(async (item: LciSearchItem) => {
        setSelectedItem(item)
        setLoadingRecommendation(true)

        try {
            const fullContext: LcaContext = {
                lcaPurpose: context?.lcaPurpose || 'pcf',
                lcaScope: context?.lcaScope || 'cradle-to-gate',
                preferredGeo: context?.preferredGeo || 'KR',
                ...context
            }

            const guide = await fetchRecommendation(item, fullContext)

            // Phase 3: 선택 이유를 먼저 보여주고, 확인 후 최종 선택
            setSelectionReason({ item, guide })
        } catch (err) {
            console.error("Failed to fetch recommendation:", err)
            // 실패 시에도 기본값으로 진행
            const defaultGuide: LciGuideInfo = {
                activityUuid: item.activityUuid,
                activityName: item.activityName,
                geography: item.geography,
                unit: item.unit,
                isoComplianceScore: 3,
                recommendationReason: '추천 정보를 가져올 수 없습니다.',
                dataQuality: { time: 3, geography: 3, technology: 3 },
                isoScores: item.isoScores,
                techCategory: item.techCategory,
                processType: item.processType,
                materialType: item.materialType,
                ecoQueryUrl: item.ecoQueryUrl
            }
            setSelectionReason({ item, guide: defaultGuide })
        } finally {
            setLoadingRecommendation(false)
            setSelectedItem(null)
        }
    }, [context])

    // 최종 확인 후 선택 완료
    const handleConfirmSelection = useCallback(() => {
        if (selectionReason) {
            onSelect(selectionReason.item, selectionReason.guide)
            onOpenChange(false)
        }
    }, [selectionReason, onSelect, onOpenChange])

    // 선택 취소 → 검색 결과로 돌아가기
    const handleCancelSelection = useCallback(() => {
        setSelectionReason(null)
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogClose onClick={() => onOpenChange(false)} />
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        LCI 데이터베이스 검색
                    </DialogTitle>
                    <DialogDescription>
                        ecoinvent 데이터베이스에서 최적의 배출계수를 찾아드립니다.
                        한글로 검색해도 자동으로 번역됩니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 p-6 pt-0">
                    {/* 선택 이유 표시 모드 (Phase 3) */}
                    {selectionReason ? (
                        <div className="space-y-4">
                            {/* 선택된 데이터 요약 */}
                            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                                    <Check className="h-4 w-4 text-primary" />
                                    선택된 LCI 데이터
                                </h4>
                                <p className="text-sm font-medium">
                                    {selectionReason.item.referenceProductName || selectionReason.item.activityName}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {selectionReason.item.activityName}
                                </p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> {selectionReason.item.geography}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Scale className="h-3 w-3" /> {selectionReason.item.unit}
                                    </span>
                                    {selectionReason.item.isoScores?.overall && (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${selectionReason.item.isoScores.overall >= 80 ? 'bg-green-500/20 text-green-600' :
                                            selectionReason.item.isoScores.overall >= 60 ? 'bg-yellow-500/20 text-yellow-600' :
                                                'bg-red-500/20 text-red-600'
                                            }`}>
                                            ISO {selectionReason.item.isoScores.overall}점
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 선택 이유 안내 */}
                            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-400">
                                    <Brain className="h-4 w-4" />
                                    이 데이터를 추천하는 이유
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {selectionReason.guide.recommendationReason}
                                </p>

                                {/* 데이터 품질 정보 */}
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    <div className="text-center p-2 rounded bg-background/60">
                                        <div className="text-[10px] text-muted-foreground">시간 대표성</div>
                                        <div className="text-sm font-semibold">{selectionReason.guide.dataQuality.time}/5</div>
                                    </div>
                                    <div className="text-center p-2 rounded bg-background/60">
                                        <div className="text-[10px] text-muted-foreground">지역 대표성</div>
                                        <div className="text-sm font-semibold">{selectionReason.guide.dataQuality.geography}/5</div>
                                    </div>
                                    <div className="text-center p-2 rounded bg-background/60">
                                        <div className="text-[10px] text-muted-foreground">기술 대표성</div>
                                        <div className="text-sm font-semibold">{selectionReason.guide.dataQuality.technology}/5</div>
                                    </div>
                                </div>

                                {/* Intent 분석 보조 정보 (사용자 인터페이스 간소화를 위해 제거) */}
                            </div>

                            {/* 확인/취소 버튼 */}
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={handleCancelSelection}>
                                    다른 데이터 선택
                                </Button>
                                <Button onClick={handleConfirmSelection}>
                                    <Check className="h-4 w-4 mr-1" />
                                    이 데이터로 확정
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* 검색창 */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="예: 알루미늄, steel, electricity..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="pl-9"
                                        autoFocus
                                    />
                                </div>
                                <Button onClick={handleSearch} disabled={loading || !query.trim()}>
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "검색"
                                    )}
                                </Button>
                            </div>

                            {/* Phase 3: AI 의도 분석 결과 표시 (제거) */}

                            {/* 번역 결과 표시 (Intent가 없을 때만) */}
                            {!intentResult && translatedQuery && (
                                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                                    🌐 번역됨: <span className="font-medium">{translatedQuery}</span>
                                </div>
                            )}

                            {/* 에러 메시지 */}
                            {error && (
                                <div className="text-sm text-orange-500 bg-orange-500/10 px-3 py-2 rounded">
                                    {error}
                                </div>
                            )}

                            {/* 검색 결과 */}
                            {results.length > 0 && (
                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                                    {results.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSelect(item)}
                                            disabled={loadingRecommendation}
                                            className={`group relative w-full text-left p-3 rounded-lg border transition-all hover:bg-accent hover:border-primary/50 hover:shadow-md hover:z-10 ${selectedItem?.id === item.id ? 'border-primary bg-primary/5' : 'border-border'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-sm truncate">
                                                            {item.referenceProductName || item.activityName}
                                                        </p>
                                                        {item.ecoQueryUrl && (
                                                            <a
                                                                href={item.ecoQueryUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                }}
                                                                className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center p-1 rounded hover:bg-muted"
                                                                title="ecoQuery 웹사이트에서 상세 데이터 보기"
                                                            >
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {item.activityName}
                                                    </p>

                                                    {/* 설명서 (Product Information) - 툴팁 대신 인라인 표시 및 Hover 시 확장 */}
                                                    {item.productInformation && (
                                                        <div className="mt-1.5 p-2 bg-muted/40 rounded-md text-xs text-muted-foreground leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all duration-200 break-words whitespace-pre-wrap">
                                                            <span className="font-semibold text-primary/80 mr-1.5">📄 설명서:</span>
                                                            {item.productInformation}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" />
                                                            {item.geography}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Scale className="h-3 w-3" />
                                                            {item.unit}
                                                        </span>
                                                        {/* ISO 종합 점수 배지 */}
                                                        {item.isoScores?.overall && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${item.isoScores.overall >= 80 ? 'bg-green-500/20 text-green-600' :
                                                                item.isoScores.overall >= 60 ? 'bg-yellow-500/20 text-yellow-600' :
                                                                    'bg-red-500/20 text-red-600'
                                                                }`}>
                                                                ISO {item.isoScores.overall}점
                                                            </span>
                                                        )}
                                                        {/* 기술 분류 태그 */}
                                                        {item.techCategory && item.techCategory !== 'unknown' && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.techCategory === 'virgin' ? 'bg-blue-500/20 text-blue-600' :
                                                                item.techCategory === 'recycled' ? 'bg-emerald-500/20 text-emerald-600' :
                                                                    'bg-gray-500/20 text-gray-600'
                                                                }`}>
                                                                {item.techCategory === 'virgin' ? '신재' :
                                                                    item.techCategory === 'recycled' ? '재생' : '혼합'}
                                                            </span>
                                                        )}
                                                        {/* 소재 유형 태그 */}
                                                        {item.materialType && item.materialType !== 'unknown' && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-600">
                                                                {item.materialType}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* AI 선정 사유 */}
                                                    {(item as any).aiReason && (
                                                        <p className="text-[11px] text-cyan-400/80 mt-1 flex items-center gap-1">
                                                            <span>🤖</span> {(item as any).aiReason}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex-shrink-0">
                                                    {selectedItem?.id === item.id && loadingRecommendation ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                    ) : (
                                                        <Check className="h-4 w-4 text-muted-foreground/30" />
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* 빈 상태 — 추천 검색어 표시 (Phase 3: 검색 UX 개선) */}
                            {!loading && results.length === 0 && !error && (
                                <div className="py-4">
                                    <div className="text-center mb-4">
                                        <Search className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
                                        <p className="text-sm text-muted-foreground">검색어를 입력하거나, 아래 추천 키워드를 클릭하세요</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[11px] font-medium text-muted-foreground/60 px-1">💡 자주 사용되는 검색어</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[
                                                { label: '알루미늄', icon: '🔩' },
                                                { label: 'HDPE', icon: '🧴' },
                                                { label: '전기', icon: '⚡' },
                                                { label: '천연가스', icon: '🔥' },
                                                { label: '골판지', icon: '📦' },
                                                { label: 'PET', icon: '♻️' },
                                                { label: '강판', icon: '🏗️' },
                                                { label: '구리', icon: '🔌' },
                                                { label: '시멘트', icon: '🧱' },
                                                { label: '디젤', icon: '⛽' },
                                                { label: '유리', icon: '🪟' },
                                                { label: '면직물', icon: '🧵' },
                                            ].map(({ label, icon }) => (
                                                <button
                                                    key={label}
                                                    onClick={() => { setQuery(label); }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border border-border/60 bg-muted/30 hover:bg-accent hover:border-primary/40 transition-colors cursor-pointer"
                                                >
                                                    <span>{icon}</span>
                                                    <span>{label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
