"use client"

import { useState, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { parseFile, generateBomTemplate } from "@/lib/lci/bom-parser"
import { matchBomToLci } from "@/lib/lci/lci-client"
import { BomParseResult, BomMatchResult } from "@/lib/lci/types"
import {
    Upload,
    Download,
    FileSpreadsheet,
    Loader2,
    CheckCircle2,
    AlertCircle,
    XCircle,
    RefreshCw,
    Check,
    Square,
    CheckSquare,
    Info,
    AlertTriangle
} from "lucide-react"

interface BomUploadSectionProps {
    onApplySelected?: (results: BomMatchResult[]) => void
}

// Cut-off 기준 설정 (1%)
const CUT_OFF_THRESHOLD = 1 // %

export function BomUploadSection({ onApplySelected }: BomUploadSectionProps) {
    const [parseResult, setParseResult] = useState<BomParseResult | null>(null)
    const [matchResults, setMatchResults] = useState<BomMatchResult[]>([])
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(false)
    const [matchingStatus, setMatchingStatus] = useState<'idle' | 'parsing' | 'matching' | 'done'>('idle')
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Cut-off 분석: 각 항목의 예상 기여도 계산
    const cutOffAnalysis = useMemo(() => {
        if (matchResults.length === 0) return null

        // 총 수량 계산 (같은 단위 가정, 실제로는 단위 변환 필요)
        const totalQuantity = matchResults.reduce((sum, r) => sum + (r.original.quantity || 0), 0)
        if (totalQuantity === 0) return null

        // 각 항목의 기여도 계산
        const itemsWithContribution = matchResults.map((result, index) => {
            const contribution = totalQuantity > 0
                ? (result.original.quantity / totalQuantity) * 100
                : 0
            return {
                index,
                result,
                contribution,
                isBelowCutOff: contribution < CUT_OFF_THRESHOLD
            }
        })

        const belowCutOffItems = itemsWithContribution.filter(i => i.isBelowCutOff)
        const belowCutOffPercent = belowCutOffItems.reduce((sum, i) => sum + i.contribution, 0)

        return {
            items: itemsWithContribution,
            belowCutOffCount: belowCutOffItems.length,
            belowCutOffPercent,
            isWarning: belowCutOffPercent >= 5 // 5% 이상 제외 시 경고
        }
    }, [matchResults])

    const processFile = async (file: File) => {
        setLoading(true)
        setMatchingStatus('parsing')

        try {
            // 1. 파일 파싱
            const result = await parseFile(file)
            setParseResult(result)

            if (result.success && result.items.length > 0) {
                // 2. LCI 매칭
                setMatchingStatus('matching')
                const matches = await matchBomToLci(result.items)
                setMatchResults(matches)
                setMatchingStatus('done')

                // 기본 선택: 높음/보통 신뢰도 + Cut-off 기준 이상인 항목
                const defaultSelected = new Set<number>()
                const totalQty = matches.reduce((sum, r) => sum + (r.original.quantity || 0), 0)

                matches.forEach((result, index) => {
                    const contribution = totalQty > 0 ? (result.original.quantity / totalQty) * 100 : 0
                    const isAboveCutOff = contribution >= CUT_OFF_THRESHOLD
                    const hasGoodConfidence = result.matchConfidence === 'high' || result.matchConfidence === 'medium'

                    // 신뢰도가 좋고 Cut-off 기준 이상인 항목만 기본 선택
                    if (hasGoodConfidence && isAboveCutOff) {
                        defaultSelected.add(index)
                    }
                })
                setSelectedItems(defaultSelected)
            } else {
                setMatchingStatus('idle')
            }
        } catch (err) {
            console.error('File processing error:', err)
            setMatchingStatus('idle')
        } finally {
            setLoading(false)
        }
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        await processFile(file)
    }

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const file = e.dataTransfer.files?.[0]
        if (!file) return

        // 파일 타입 검증
        const fileName = file.name.toLowerCase()
        if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
            alert('CSV 또는 Excel 파일만 업로드 가능합니다.')
            return
        }

        await processFile(file)
    }

    const handleDownloadTemplate = () => {
        const csv = generateBomTemplate()
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'BOM_Template.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleReset = () => {
        setParseResult(null)
        setMatchResults([])
        setSelectedItems(new Set())
        setMatchingStatus('idle')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleToggleItem = (index: number) => {
        const newSelected = new Set(selectedItems)
        if (newSelected.has(index)) {
            newSelected.delete(index)
        } else {
            newSelected.add(index)
        }
        setSelectedItems(newSelected)
    }

    const handleSelectAll = () => {
        if (selectedItems.size === matchResults.length) {
            // 모두 선택됨 -> 모두 해제
            setSelectedItems(new Set())
        } else {
            // 모두 선택
            setSelectedItems(new Set(matchResults.map((_, i) => i)))
        }
    }

    const handleApplySelected = () => {
        const selectedResults = matchResults.filter((_, index) => selectedItems.has(index))
        onApplySelected?.(selectedResults)
        handleReset()
    }

    const getConfidenceColor = (confidence: BomMatchResult['matchConfidence']) => {
        switch (confidence) {
            case 'high': return 'text-green-500'
            case 'medium': return 'text-yellow-500'
            case 'low': return 'text-orange-500'
            case 'none': return 'text-red-500'
        }
    }

    const getConfidenceIcon = (confidence: BomMatchResult['matchConfidence']) => {
        switch (confidence) {
            case 'high': return <CheckCircle2 className="h-4 w-4" />
            case 'medium': return <AlertCircle className="h-4 w-4" />
            case 'low': return <AlertCircle className="h-4 w-4" />
            case 'none': return <XCircle className="h-4 w-4" />
        }
    }

    const getConfidenceLabel = (confidence: BomMatchResult['matchConfidence']) => {
        switch (confidence) {
            case 'high': return '높음'
            case 'medium': return '보통'
            case 'low': return '낮음'
            case 'none': return '없음'
        }
    }

    return (
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    BOM 일괄 업로드
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 업로드 영역 */}
                {matchingStatus === 'idle' && (
                    <div className="space-y-3">
                        <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${isDragging
                                ? 'border-primary bg-primary/10'
                                : 'border-muted-foreground/25 hover:border-primary/50'
                                }`}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                            <p className="text-sm font-medium">
                                {isDragging ? '여기에 파일을 놓으세요' : 'CSV 또는 Excel 파일을 드래그하거나 클릭'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                BOM 파일에서 자재 정보를 일괄 입력합니다
                            </p>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadTemplate}
                            className="gap-2 w-full"
                        >
                            <Download className="h-4 w-4" />
                            템플릿 다운로드
                        </Button>

                        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
                            <p className="font-medium mb-1">필수 컬럼:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                <li>자재명 (material, name, 품명)</li>
                                <li>수량 (quantity, qty, 사용량)</li>
                                <li>단위 (unit, 단위)</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* 로딩 상태 */}
                {loading && (
                    <div className="text-center py-6">
                        <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
                        <p className="text-sm font-medium">
                            {matchingStatus === 'parsing' ? '파일 분석 중...' : 'LCI 데이터 매칭 중...'}
                        </p>
                        {parseResult && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {parseResult.items.length}개 항목 처리 중
                            </p>
                        )}
                    </div>
                )}

                {/* 파싱 에러 */}
                {parseResult && !parseResult.success && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                        <p className="text-sm font-medium text-destructive mb-2">파일 처리 오류</p>
                        {parseResult.errors.map((err, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                                행 {err.row}: {err.message}
                            </p>
                        ))}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                            className="mt-3 gap-2"
                        >
                            <RefreshCw className="h-3 w-3" />
                            다시 시도
                        </Button>
                    </div>
                )}

                {/* 매칭 결과 */}
                {matchingStatus === 'done' && matchResults.length > 0 && (
                    <div className="space-y-3">
                        {/* 요약 및 전체선택 */}
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSelectAll}
                                    className="h-7 px-2 gap-1"
                                >
                                    {selectedItems.size === matchResults.length ? (
                                        <>
                                            <CheckSquare className="h-4 w-4" />
                                            전체 선택 해제
                                        </>
                                    ) : (
                                        <>
                                            <Square className="h-4 w-4" />
                                            전체 선택
                                        </>
                                    )}
                                </Button>
                                <span className="text-muted-foreground">
                                    {selectedItems.size}/{matchResults.length}개 선택
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-green-500">
                                    ✓ 높음: {matchResults.filter(r => r.matchConfidence === 'high').length}
                                </span>
                                <span className="text-yellow-500">
                                    ⚠ 보통: {matchResults.filter(r => r.matchConfidence === 'medium').length}
                                </span>
                                <span className="text-red-500">
                                    ✗ 없음: {matchResults.filter(r => r.matchConfidence === 'none').length}
                                </span>
                            </div>
                        </div>

                        {/* Cut-off 기준 안내 */}
                        {cutOffAnalysis && (
                            <div className={`rounded-lg p-3 text-xs border ${cutOffAnalysis.isWarning
                                ? 'bg-orange-500/10 border-orange-500/20'
                                : 'bg-blue-500/10 border-blue-500/20'
                                }`}>
                                <div className="flex items-start gap-2">
                                    {cutOffAnalysis.isWarning ? (
                                        <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        <p className={cutOffAnalysis.isWarning ? 'text-orange-400' : 'text-blue-400'}>
                                            <strong>ISO 14067 Cut-off 기준 적용됨</strong> (전체의 {CUT_OFF_THRESHOLD}% 미만 항목 자동 해제)
                                        </p>
                                        <div className="text-muted-foreground mt-1 space-y-0.5">
                                            <p>• {CUT_OFF_THRESHOLD}% 미만 항목: {cutOffAnalysis.belowCutOffCount}개 (회색 표시, 기본 해제)</p>
                                            <p>• 제외 비율: {cutOffAnalysis.belowCutOffPercent.toFixed(1)}% (총 수량 기준)</p>
                                            {cutOffAnalysis.isWarning && (
                                                <p className="text-orange-400">⚠️ 제외 비율이 5%를 초과합니다. 일부 항목을 포함해야 할 수 있습니다.</p>
                                            )}
                                            <p className="italic">회색 항목도 체크하면 포함됩니다.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 결과 테이블 */}
                        <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="text-center p-2 w-10">선택</th>
                                        <th className="text-left p-2 font-medium">원본 자재</th>
                                        <th className="text-left p-2 font-medium">매칭된 LCI</th>
                                        <th className="text-center p-2 font-medium">ISO</th>
                                        <th className="text-center p-2 font-medium">신뢰도</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matchResults.map((result, i) => {
                                        const itemAnalysis = cutOffAnalysis?.items.find(item => item.index === i)
                                        const isBelowCutOff = itemAnalysis?.isBelowCutOff || false
                                        const contribution = itemAnalysis?.contribution || 0

                                        return (
                                            <tr
                                                key={i}
                                                className={`border-t cursor-pointer transition-colors ${isBelowCutOff
                                                    ? 'opacity-50 bg-muted/30'
                                                    : selectedItems.has(i)
                                                        ? 'bg-primary/5 hover:bg-primary/10'
                                                        : 'hover:bg-accent/50'
                                                    }`}
                                                onClick={() => handleToggleItem(i)}
                                            >
                                                <td className="p-2 text-center">
                                                    <div className="flex justify-center">
                                                        {selectedItems.has(i) ? (
                                                            <CheckSquare className="h-5 w-5 text-primary" />
                                                        ) : (
                                                            <Square className={`h-5 w-5 ${isBelowCutOff ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-2">
                                                    <div className={`font-medium ${isBelowCutOff ? 'text-muted-foreground' : ''}`}>
                                                        {result.original.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        <span>{result.original.quantity} {result.original.unit}</span>
                                                        <span className={`px-1 rounded text-[10px] ${isBelowCutOff
                                                            ? 'bg-muted text-muted-foreground'
                                                            : 'bg-primary/10 text-primary'
                                                            }`}>
                                                            {contribution.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-2">
                                                    {result.matchedLci ? (
                                                        <div className={isBelowCutOff ? 'text-muted-foreground' : ''}>
                                                            <div className="truncate max-w-[200px]">
                                                                {result.matchedLci.referenceProductName || result.matchedLci.activityName}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {result.matchedLci.geography} • {result.matchedLci.unit}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">매칭 없음</span>
                                                    )}
                                                </td>
                                                {/* ISO 점수 셀 */}
                                                <td className="p-2 text-center">
                                                    {result.matchedLci?.isoScores?.overall ? (
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-help ${result.matchedLci.isoScores.overall >= 80 ? 'bg-green-500/20 text-green-600' :
                                                            result.matchedLci.isoScores.overall >= 60 ? 'bg-yellow-500/20 text-yellow-600' :
                                                                'bg-red-500/20 text-red-600'
                                                            }`}
                                                            title={`시간: ${result.matchedLci.isoScores.temporal}, 지역: ${result.matchedLci.isoScores.geographical}, 기술: ${result.matchedLci.isoScores.technological}`}
                                                        >
                                                            {result.matchedLci.isoScores.overall}점
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-center">
                                                    <span className={`inline-flex items-center gap-1 ${isBelowCutOff ? 'text-muted-foreground' : getConfidenceColor(result.matchConfidence)}`}>
                                                        {getConfidenceIcon(result.matchConfidence)}
                                                        {getConfidenceLabel(result.matchConfidence)}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* 버튼 그룹 */}
                        <div className="flex gap-2">
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleApplySelected}
                                disabled={selectedItems.size === 0}
                                className="gap-2 flex-1"
                            >
                                <Check className="h-4 w-4" />
                                선택 항목 적용 ({selectedItems.size}개)
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleReset}
                                className="gap-2"
                            >
                                <RefreshCw className="h-3 w-3" />
                                새 파일
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
