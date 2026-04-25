'use client'

/**
 * ISO 14067 5항 원칙 준수 현황 카드
 * 완전성, 투명성, 중복배제, 과학적 접근, 관련성 점수를 시각화
 */

import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Section5ComplianceProps {
    data: {
        overallScore: number
        overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
        isCompliant: boolean
        principles: {
            completeness: { score: number, grade: string, issues: number }
            transparency: { score: number, grade: string, documentedItems: number, totalItems: number }
            noDuplicates: { score: number, grade: string, warnings: number }
            scientificBasis: { score: number, grade: string, dominantTier: string }
            relevance: { score: number, grade: string, avgDataQuality: number, lowQualityItems: number }
        }
        summary: {
            strengths: string[]
            improvements: string[]
            criticalIssues: string[]
        }
    }
}

const GRADE_COLORS: Record<string, string> = {
    'A': 'bg-green-500',
    'B': 'bg-blue-500',
    'C': 'bg-yellow-500',
    'D': 'bg-orange-500',
    'F': 'bg-red-500'
}

const PRINCIPLE_LABELS = {
    completeness: { label: '완전성', clause: '5.7', icon: '📋' },
    transparency: { label: '투명성', clause: '5.11', icon: '🔍' },
    noDuplicates: { label: '중복배제', clause: '5.12', icon: '🔄' },
    scientificBasis: { label: '과학적 접근', clause: '5.5', icon: '🔬' },
    relevance: { label: '관련성', clause: '5.6', icon: '🎯' }
}

export function Section5ComplianceCard({ data }: Section5ComplianceProps) {
    const [expanded, setExpanded] = useState(false)

    return (
        <Card className={cn(
            "border-2",
            data.isCompliant
                ? "border-green-500/30 bg-green-500/5"
                : "border-orange-500/30 bg-orange-500/5"
        )}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        {data.isCompliant ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                        )}
                        ISO 14067 5항 원칙 준수 현황
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "px-3 py-1 rounded-full text-white font-bold text-sm",
                            GRADE_COLORS[data.overallGrade]
                        )}>
                            {data.overallGrade}등급
                        </div>
                        <span className="text-lg font-bold">{data.overallScore}점</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 원칙별 점수 바 */}
                <div className="grid grid-cols-5 gap-2">
                    {(Object.entries(PRINCIPLE_LABELS) as [keyof typeof PRINCIPLE_LABELS, { label: string, clause: string, icon: string }][]).map(([key, info]) => {
                        const principle = data.principles[key]
                        return (
                            <div key={key} className="text-center">
                                <div className="text-lg">{info.icon}</div>
                                <div className="text-[10px] text-muted-foreground">{info.clause}</div>
                                <div className="text-xs font-medium">{info.label}</div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all",
                                            principle.score >= 80 ? "bg-green-500" :
                                                principle.score >= 60 ? "bg-yellow-500" : "bg-orange-500"
                                        )}
                                        style={{ width: `${principle.score}%` }}
                                    />
                                </div>
                                <div className="text-xs mt-0.5">{principle.score}점</div>
                            </div>
                        )
                    })}
                </div>

                {/* 요약 */}
                <div className="flex flex-wrap gap-2">
                    {data.summary.criticalIssues.length > 0 && (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                            ⚠️ {data.summary.criticalIssues.length}개 주요 이슈
                        </span>
                    )}
                    {data.summary.improvements.length > 0 && (
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
                            💡 {data.summary.improvements.length}개 개선 권장
                        </span>
                    )}
                    {data.summary.strengths.length > 0 && (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                            ✅ {data.summary.strengths.length}개 강점
                        </span>
                    )}
                </div>

                {/* 상세 토글 */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1"
                >
                    {expanded ? '간략히 보기' : '상세 보기'}
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {expanded && (
                    <div className="space-y-3 pt-2 border-t">
                        {/* 상세 점수 */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground">원칙별 상세</h4>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                                <div className="flex justify-between p-2 bg-muted/30 rounded">
                                    <span>📋 완전성 (5.7)</span>
                                    <span>{data.principles.completeness.issues > 0 ? `${data.principles.completeness.issues}개 이슈` : '이슈 없음'}</span>
                                </div>
                                <div className="flex justify-between p-2 bg-muted/30 rounded">
                                    <span>🔍 투명성 (5.11)</span>
                                    <span>{data.principles.transparency.documentedItems}/{data.principles.transparency.totalItems} 문서화됨</span>
                                </div>
                                <div className="flex justify-between p-2 bg-muted/30 rounded">
                                    <span>🔄 중복배제 (5.12)</span>
                                    <span>{data.principles.noDuplicates.warnings > 0 ? `${data.principles.noDuplicates.warnings}개 경고` : '중복 없음'}</span>
                                </div>
                                <div className="flex justify-between p-2 bg-muted/30 rounded">
                                    <span>🔬 과학적 접근 (5.5)</span>
                                    <span>주요 등급: {data.principles.scientificBasis.dominantTier}</span>
                                </div>
                                <div className="flex justify-between p-2 bg-muted/30 rounded">
                                    <span>🎯 관련성 (5.6)</span>
                                    <span>평균 DQI {data.principles.relevance.avgDataQuality}점{data.principles.relevance.lowQualityItems > 0 && `, 저품질 ${data.principles.relevance.lowQualityItems}개`}</span>
                                </div>
                            </div>
                        </div>

                        {/* 강점 */}
                        {data.summary.strengths.length > 0 && (
                            <div className="space-y-1">
                                <h4 className="text-xs font-medium text-green-600">✅ 강점</h4>
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                    {data.summary.strengths.map((s, i) => (
                                        <li key={i}>• {s}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* 개선 권장 */}
                        {data.summary.improvements.length > 0 && (
                            <div className="space-y-1">
                                <h4 className="text-xs font-medium text-yellow-600">💡 개선 권장</h4>
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                    {data.summary.improvements.map((s, i) => (
                                        <li key={i}>• {s}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* 주요 이슈 */}
                        {data.summary.criticalIssues.length > 0 && (
                            <div className="space-y-1">
                                <h4 className="text-xs font-medium text-red-500">⚠️ 주요 이슈</h4>
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                    {data.summary.criticalIssues.map((s, i) => (
                                        <li key={i}>• {s}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
