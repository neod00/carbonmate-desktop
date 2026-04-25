'use client'

import { useMemo, useState } from 'react'
import { usePCFStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    CFPSnapshot,
    calculateCFPTrend,
    compareCFPSnapshots,
    getTrendIcon,
    getTrendLabel,
    formatChangePercent,
    validateSnapshotsConsistency,
    calculateProgressToTarget
} from '@/lib/core/cfp-tracking'
import {
    TrendingDown,
    TrendingUp,
    Minus,
    Plus,
    Trash2,
    Calendar,
    Target,
    AlertCircle,
    CheckCircle,
    History,
    BarChart3,
    Info
} from 'lucide-react'

/**
 * CFP 성과 추적 시각화 컴포넌트
 * ISO 14067 6.4.7 준수
 */
export const CFPTrackingPanel = () => {
    const {
        cfpHistory,
        productInfo,
        addCFPSnapshot,
        removeCFPSnapshot
    } = usePCFStore()

    const [newCFPValue, setNewCFPValue] = useState<string>('')
    const [newNotes, setNewNotes] = useState<string>('')
    const [targetReduction, setTargetReduction] = useState<number>(30)
    const [showAddForm, setShowAddForm] = useState(false)

    // 추적 결과 계산
    const trackingResult = useMemo(() => {
        if (cfpHistory.length === 0) return null
        return calculateCFPTrend(
            productInfo.name || 'product',
            productInfo.name || '제품',
            cfpHistory
        )
    }, [cfpHistory, productInfo.name])

    // 일관성 검증
    const consistency = useMemo(() => {
        return validateSnapshotsConsistency(cfpHistory)
    }, [cfpHistory])

    // 감축 목표 진척도
    const progress = useMemo(() => {
        if (cfpHistory.length < 2) return null
        const sorted = [...cfpHistory].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        )
        return calculateProgressToTarget(
            sorted[0].cfpValue,
            sorted[sorted.length - 1].cfpValue,
            targetReduction
        )
    }, [cfpHistory, targetReduction])

    // 스냅샷 추가
    const handleAddSnapshot = () => {
        const value = parseFloat(newCFPValue)
        if (!isNaN(value) && value > 0) {
            addCFPSnapshot(value, newNotes || undefined)
            setNewCFPValue('')
            setNewNotes('')
            setShowAddForm(false)
        }
    }

    // 추세 아이콘 컴포넌트
    const TrendIcon = ({ trend }: { trend: 'improving' | 'stable' | 'worsening' }) => {
        switch (trend) {
            case 'improving':
                return <TrendingDown className="w-5 h-5 text-green-500" />
            case 'worsening':
                return <TrendingUp className="w-5 h-5 text-red-500" />
            default:
                return <Minus className="w-5 h-5 text-yellow-500" />
        }
    }

    // 추세 색상
    const getTrendColor = (trend: 'improving' | 'stable' | 'worsening') => {
        switch (trend) {
            case 'improving': return 'text-green-500'
            case 'worsening': return 'text-red-500'
            default: return 'text-yellow-500'
        }
    }

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-primary" />
                        CFP 성과 추적
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        ISO 14067 6.4.7에 따른 시간 경과별 CFP 변화 추적
                    </p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                    <Plus className="w-4 h-4" />
                    스냅샷 추가
                </button>
            </div>

            {/* 스냅샷 추가 폼 */}
            {showAddForm && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="pt-6">
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    CFP 값 (kg CO₂e/{productInfo.unit || '단위'})
                                </label>
                                <input
                                    type="number"
                                    value={newCFPValue}
                                    onChange={(e) => setNewCFPValue(e.target.value)}
                                    placeholder="예: 12.5"
                                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">메모 (선택)</label>
                                <input
                                    type="text"
                                    value={newNotes}
                                    onChange={(e) => setNewNotes(e.target.value)}
                                    placeholder="예: 재활용 원료 도입"
                                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleAddSnapshot}
                                    disabled={!newCFPValue || parseFloat(newCFPValue) <= 0}
                                    className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    저장
                                </button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 데이터 없음 */}
            {cfpHistory.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-medium text-lg mb-2">CFP 이력이 없습니다</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                            CFP 스냅샷을 추가하여 시간 경과에 따른 변화를 추적하세요.
                        </p>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                        >
                            첫 스냅샷 추가
                        </button>
                    </CardContent>
                </Card>
            )}

            {/* 추적 결과 요약 */}
            {trackingResult && (
                <div className="grid md:grid-cols-4 gap-4">
                    {/* 총 변화율 */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-xl ${trackingResult.isImproving ? 'bg-green-500/10' : 'bg-red-500/10'
                                    }`}>
                                    <TrendIcon trend={trackingResult.trend} />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">총 변화율</p>
                                    <p className={`text-2xl font-bold ${getTrendColor(trackingResult.trend)}`}>
                                        {formatChangePercent(trackingResult.totalChangePercent)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 연평균 변화율 */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-blue-500/10">
                                    <Calendar className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">연평균 변화율</p>
                                    <p className="text-2xl font-bold text-foreground">
                                        {formatChangePercent(trackingResult.annualChangePercent)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 기준 연도 */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-purple-500/10">
                                    <History className="w-5 h-5 text-purple-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">추적 기간</p>
                                    <p className="text-lg font-bold text-foreground">
                                        {trackingResult.baselineYear} - {trackingResult.latestYear}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 추세 */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-xl ${trackingResult.trend === 'improving' ? 'bg-green-500/10' :
                                        trackingResult.trend === 'worsening' ? 'bg-red-500/10' : 'bg-yellow-500/10'
                                    }`}>
                                    <TrendIcon trend={trackingResult.trend} />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">추세</p>
                                    <p className={`text-lg font-bold ${getTrendColor(trackingResult.trend)}`}>
                                        {getTrendIcon(trackingResult.trend)} {getTrendLabel(trackingResult.trend)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 감축 목표 진척도 */}
            {progress && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Target className="w-5 h-5 text-primary" />
                            감축 목표 진척도
                        </CardTitle>
                        <CardDescription>기준 연도 대비 {targetReduction}% 감축 목표</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* 진척 바 */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>현재 감축율: {progress.currentReduction.toFixed(1)}%</span>
                                    <span>목표: {targetReduction}%</span>
                                </div>
                                <div className="h-4 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${progress.isAchieved ? 'bg-green-500' : 'bg-primary'
                                            }`}
                                        style={{ width: `${Math.min(progress.progressPercent, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* 상태 메시지 */}
                            <div className={`flex items-center gap-2 p-3 rounded-lg ${progress.isAchieved ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                                    progress.progressPercent >= 50 ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                                        'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                }`}>
                                {progress.isAchieved ? (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="font-medium">목표 달성! 🎉</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="w-5 h-5" />
                                        <span>목표까지 {progress.remainingReduction.toFixed(1)}% 추가 감축 필요</span>
                                    </>
                                )}
                            </div>

                            {/* 목표 설정 */}
                            <div className="flex items-center gap-4 pt-2">
                                <label className="text-sm text-muted-foreground">목표 감축율:</label>
                                <input
                                    type="range"
                                    min="10"
                                    max="80"
                                    step="5"
                                    value={targetReduction}
                                    onChange={(e) => setTargetReduction(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                                />
                                <span className="text-sm font-medium w-12">{targetReduction}%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 일관성 경고 */}
            {!consistency.valid && (
                <Card className="border-amber-500/50 bg-amber-500/10">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
                                    ISO 14067 6.4.7 일관성 경고
                                </h4>
                                <ul className="text-sm text-amber-600 dark:text-amber-500 space-y-1">
                                    {consistency.errors.map((error, i) => (
                                        <li key={i}>• {error}</li>
                                    ))}
                                </ul>
                                <p className="text-xs text-amber-600/80 mt-2">
                                    CFP 성과 추적은 동일한 기능단위, 시스템 경계, PCR을 사용해야 합니다.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 스냅샷 시간선 */}
            {cfpHistory.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <History className="w-5 h-5 text-primary" />
                            CFP 이력 ({cfpHistory.length}개)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[...cfpHistory]
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((snapshot, index, arr) => {
                                    const prevSnapshot = index < arr.length - 1 ? arr[index + 1] : null
                                    const comparison = prevSnapshot
                                        ? compareCFPSnapshots(prevSnapshot, snapshot)
                                        : null

                                    return (
                                        <div
                                            key={snapshot.id}
                                            className="flex items-start gap-4 p-4 bg-muted/50 rounded-xl"
                                        >
                                            {/* 시간선 점 */}
                                            <div className="flex flex-col items-center">
                                                <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted-foreground/50'
                                                    }`} />
                                                {index < arr.length - 1 && (
                                                    <div className="w-0.5 h-16 bg-border mt-1" />
                                                )}
                                            </div>

                                            {/* 내용 */}
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl font-bold text-foreground">
                                                            {snapshot.cfpValue.toFixed(2)}
                                                        </span>
                                                        <span className="text-sm text-muted-foreground">
                                                            kg CO₂e / {snapshot.functionalUnit}
                                                        </span>
                                                        {comparison && (
                                                            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${comparison.isImprovement
                                                                    ? 'bg-green-500/10 text-green-600'
                                                                    : 'bg-red-500/10 text-red-600'
                                                                }`}>
                                                                {formatChangePercent(comparison.percentChange)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => removeCFPSnapshot(snapshot.id)}
                                                        className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {new Date(snapshot.date).toLocaleDateString('ko-KR')}
                                                    </span>
                                                    {snapshot.notes && (
                                                        <span className="flex items-center gap-1">
                                                            <Info className="w-3.5 h-3.5" />
                                                            {snapshot.notes}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ISO 참조 */}
            <div className="text-xs text-muted-foreground text-center">
                ISO 14067:2018 6.4.7 - CFP 성과 추적은 동일한 기능단위와 PCR을 사용하여 수행되어야 합니다.
            </div>
        </div>
    )
}

export default CFPTrackingPanel
