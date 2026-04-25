'use client'

/**
 * ISO 14067 5.7 완전성 경고 배너
 * 시스템 경계 내 누락된 단계를 경고
 */

import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CompletenessIssue } from '@/lib/core/completeness-checker'

interface CompletenessWarningBannerProps {
    issues: CompletenessIssue[]
    score: number
    isComplete: boolean
    onDismiss?: () => void
}

export function CompletenessWarningBanner({
    issues,
    score,
    isComplete,
    onDismiss
}: CompletenessWarningBannerProps) {
    const [dismissed, setDismissed] = useState(false)

    if (dismissed || (isComplete && issues.length === 0)) {
        return null
    }

    const errorIssues = issues.filter(i => i.severity === 'error')
    const warningIssues = issues.filter(i => i.severity === 'warning')
    const infoIssues = issues.filter(i => i.severity === 'info')

    const handleDismiss = () => {
        setDismissed(true)
        onDismiss?.()
    }

    const hasErrors = errorIssues.length > 0

    return (
        <div className={cn(
            "p-4 rounded-lg border mb-4",
            hasErrors
                ? "bg-orange-500/10 border-orange-500/30"
                : "bg-yellow-500/10 border-yellow-500/30"
        )}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    {hasErrors ? (
                        <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                    ) : (
                        <Info className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <h4 className={cn(
                                "font-medium",
                                hasErrors ? "text-orange-500" : "text-yellow-600"
                            )}>
                                ISO 14067 5.7 완전성 검사
                            </h4>
                            <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full",
                                score >= 80 ? "bg-green-500/20 text-green-600" :
                                    score >= 60 ? "bg-yellow-500/20 text-yellow-600" :
                                        "bg-orange-500/20 text-orange-500"
                            )}>
                                {score}점
                            </span>
                        </div>

                        {/* 오류 */}
                        {errorIssues.length > 0 && (
                            <div className="space-y-1">
                                {errorIssues.map((issue, idx) => (
                                    <div key={idx} className="text-sm">
                                        <span className="text-orange-500">⚠️ {issue.message}</span>
                                        <p className="text-xs text-muted-foreground pl-5">
                                            💡 {issue.recommendation}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 경고 */}
                        {warningIssues.length > 0 && (
                            <div className="space-y-1">
                                {warningIssues.map((issue, idx) => (
                                    <div key={idx} className="text-sm">
                                        <span className="text-yellow-600">📋 {issue.message}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 정보 */}
                        {infoIssues.length > 0 && (
                            <div className="space-y-1 text-xs text-muted-foreground">
                                {infoIssues.map((issue, idx) => (
                                    <div key={idx}>
                                        💡 {issue.message}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {onDismiss && (
                    <button
                        onClick={handleDismiss}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    )
}

/**
 * 중복 감지 경고 배너
 */
interface DuplicateWarningBannerProps {
    warnings: {
        type: string
        severity: 'error' | 'warning'
        itemIds: string[]
        message: string
        recommendation: string
    }[]
    onIgnore?: (itemIds: string[]) => void
}

export function DuplicateWarningBanner({ warnings, onIgnore }: DuplicateWarningBannerProps) {
    if (warnings.length === 0) return null

    const errorWarnings = warnings.filter(w => w.severity === 'error')
    const warningWarnings = warnings.filter(w => w.severity === 'warning')

    return (
        <div className="p-4 rounded-lg border bg-amber-500/10 border-amber-500/30 mb-4">
            <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                    <h4 className="font-medium text-amber-600">
                        ISO 14067 5.12 중복 계산 경고
                    </h4>

                    {errorWarnings.length > 0 && (
                        <div className="space-y-2">
                            {errorWarnings.map((w, idx) => (
                                <div key={idx} className="text-sm flex items-start justify-between gap-2">
                                    <div>
                                        <span className="text-amber-600">⚠️ {w.message}</span>
                                        <p className="text-xs text-muted-foreground pl-5">
                                            💡 {w.recommendation}
                                        </p>
                                    </div>
                                    {onIgnore && (
                                        <button
                                            onClick={() => onIgnore(w.itemIds)}
                                            className="text-xs px-2 py-1 rounded border border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                                        >
                                            무시
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {warningWarnings.length > 0 && (
                        <div className="space-y-1 text-sm">
                            {warningWarnings.map((w, idx) => (
                                <div key={idx} className="text-yellow-600">
                                    🔍 {w.message}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
