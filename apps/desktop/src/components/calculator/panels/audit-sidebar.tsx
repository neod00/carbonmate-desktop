"use client"

import { useState, useEffect } from "react"
import { X, Clock, User, FileText, ChevronDown, ChevronUp } from "lucide-react"

interface AuditEntry {
    id: string
    timestamp: string
    action: string
    field: string
    oldValue?: string
    newValue?: string
    user: string
    reason?: string
}

interface AuditSidebarProps {
    isOpen: boolean
    onClose: () => void
}

export function AuditSidebar({ isOpen, onClose }: AuditSidebarProps) {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // 데모 데이터 초기화
    useEffect(() => {
        if (isOpen && entries.length === 0) {
            setEntries([
                {
                    id: 'audit-1',
                    timestamp: new Date().toISOString(),
                    action: '프로젝트 생성',
                    field: 'productInfo',
                    newValue: '새 CFP 프로젝트',
                    user: '현재 사용자',
                },
                {
                    id: 'audit-2',
                    timestamp: new Date(Date.now() - 60000).toISOString(),
                    action: '시스템 경계 설정',
                    field: 'boundary',
                    oldValue: '-',
                    newValue: 'cradle-to-gate',
                    user: '현재 사용자',
                },
            ])
        }
    }, [isOpen])

    // 변경 사유 추가
    const addReason = (id: string, reason: string) => {
        setEntries(prev => prev.map(entry =>
            entry.id === id ? { ...entry, reason } : entry
        ))
    }

    if (!isOpen) return null

    return (
        <>
            {/* 오버레이 */}
            <div
                className="fixed inset-0 bg-black/20 z-40"
                onClick={onClose}
            />

            {/* 사이드바 */}
            <div className="fixed right-0 top-0 h-full w-96 max-w-[90vw] bg-background border-l shadow-xl z-50 flex flex-col">
                {/* 헤더 */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-lg">변경 이력</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* 통계 */}
                <div className="grid grid-cols-2 gap-3 p-4 border-b">
                    <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-xs text-muted-foreground">총 변경</div>
                        <div className="text-xl font-bold">{entries.length}건</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-xs text-muted-foreground">변경 사유 기록</div>
                        <div className="text-xl font-bold">
                            {entries.filter(e => e.reason).length}건
                        </div>
                    </div>
                </div>

                {/* 타임라인 */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="relative">
                        {/* 타임라인 라인 */}
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                        <div className="space-y-4">
                            {entries.map((entry) => {
                                const isExpanded = expandedId === entry.id
                                const date = new Date(entry.timestamp)

                                return (
                                    <div key={entry.id} className="relative pl-10">
                                        {/* 타임라인 도트 */}
                                        <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                                        <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{entry.action}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <User className="h-3 w-3" /> {entry.user}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                                    className="p-1 rounded hover:bg-muted transition-colors"
                                                >
                                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </button>
                                            </div>

                                            {/* 확장 상세 */}
                                            {isExpanded && (
                                                <div className="mt-3 pt-3 border-t space-y-2">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <FileText className="h-3 w-3 text-muted-foreground" />
                                                        <span className="text-muted-foreground">필드:</span>
                                                        <span className="font-mono">{entry.field}</span>
                                                    </div>

                                                    {entry.oldValue && (
                                                        <div className="text-xs">
                                                            <span className="text-red-400 line-through">{entry.oldValue}</span>
                                                            <span className="mx-2">→</span>
                                                            <span className="text-green-500">{entry.newValue}</span>
                                                        </div>
                                                    )}

                                                    {/* 변경 사유 입력 */}
                                                    <div className="mt-2">
                                                        <label className="text-xs text-muted-foreground mb-1 block">변경 사유</label>
                                                        <textarea
                                                            value={entry.reason || ''}
                                                            onChange={e => addReason(entry.id, e.target.value)}
                                                            placeholder="변경 사유를 입력하세요 (검증 시 필요)"
                                                            className="w-full px-2 py-1.5 text-xs rounded border border-border bg-background resize-none"
                                                            rows={2}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* 푸터 */}
                <div className="p-4 border-t bg-muted/30">
                    <p className="text-xs text-muted-foreground text-center">
                        ISO 14067 검증을 위해 모든 데이터 변경 이력이 기록됩니다.
                    </p>
                </div>
            </div>
        </>
    )
}
