"use client"

import * as React from "react"
import { X, Megaphone, Info, AlertTriangle, AlertCircle, Loader2 } from "lucide-react"
import {
    Announcement,
    fetchAnnouncements,
    getReadIds,
    markAsRead,
} from "@/lib/announcements/announcements-client"

interface AnnouncementsPanelProps {
    open: boolean
    onClose: () => void
    onAllRead?: () => void
}

const PRIORITY_STYLES: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
    info: { color: "text-emerald-400", bg: "bg-emerald-950/60", border: "border-emerald-500/50", icon: Info },
    warning: { color: "text-yellow-400", bg: "bg-yellow-950/60", border: "border-yellow-500/50", icon: AlertTriangle },
    urgent: { color: "text-red-400", bg: "bg-red-950/60", border: "border-red-500/50", icon: AlertCircle },
}

function formatDate(s: string): string {
    try {
        return new Date(s).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    } catch {
        return s
    }
}

export function AnnouncementsPanel({ open, onClose, onAllRead }: AnnouncementsPanelProps) {
    const [items, setItems] = React.useState<Announcement[] | null>(null)
    const [readSet, setReadSet] = React.useState<Set<number>>(new Set(getReadIds()))

    React.useEffect(() => {
        if (!open) return
        setItems(null)
        fetchAnnouncements().then(list => {
            setItems(list)
            const ids = list.map(a => a.id)
            if (ids.length > 0) {
                markAsRead(ids)
                setReadSet(new Set([...getReadIds()]))
                onAllRead?.()
            }
        })
    }, [open, onAllRead])

    if (!open) return null

    return (
        <>
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className="fixed top-0 right-0 h-screen w-full max-w-md bg-zinc-900 border-l-2 border-emerald-500/40 shadow-[0_0_40px_rgba(0,0,0,0.8)] z-50 flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700 bg-zinc-950">
                    <div className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-emerald-400" />
                        <h2 className="text-base font-semibold text-white">공지사항</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-zinc-800 transition-colors"
                        aria-label="닫기"
                    >
                        <X className="h-4 w-4 text-zinc-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 bg-zinc-900">
                    {items === null && (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <p className="text-xs">불러오는 중...</p>
                        </div>
                    )}
                    {items && items.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
                            <Megaphone className="h-8 w-8 opacity-40" />
                            <p className="text-xs">등록된 공지사항이 없습니다.</p>
                        </div>
                    )}
                    {items && items.length > 0 && (
                        <ul className="space-y-3">
                            {items.map(a => {
                                const style = PRIORITY_STYLES[a.priority] || PRIORITY_STYLES.info
                                const Icon = style.icon
                                const wasUnread = !readSet.has(a.id)
                                return (
                                    <li
                                        key={a.id}
                                        className={`rounded-lg border-2 ${style.border} ${style.bg} p-4 shadow-md`}
                                    >
                                        <div className="flex items-start gap-2 mb-2">
                                            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${style.color}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-semibold text-white truncate">{a.title}</h3>
                                                    {wasUnread && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white shadow">NEW</span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-zinc-400 mt-0.5">{formatDate(a.created_at)}</p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">{a.body}</p>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </>
    )
}
