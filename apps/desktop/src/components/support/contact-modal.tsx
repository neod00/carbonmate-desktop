"use client"

import * as React from "react"
import { X, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { sendContact } from "@/lib/contact/contact-client"
import { getStoredLicense } from "@/lib/license/license-client"

interface ContactModalProps {
    open: boolean
    onClose: () => void
}

export function ContactModal({ open, onClose }: ContactModalProps) {
    const [subject, setSubject] = React.useState("")
    const [message, setMessage] = React.useState("")
    const [senderName, setSenderName] = React.useState("")
    const [senderEmail, setSenderEmail] = React.useState("")
    const [sending, setSending] = React.useState(false)
    const [result, setResult] = React.useState<"success" | string | null>(null)

    React.useEffect(() => {
        if (open) {
            const license = getStoredLicense()
            if (license?.customerName) setSenderName(license.customerName)
            setResult(null)
        }
    }, [open])

    if (!open) return null

    const handleSend = async () => {
        if (!subject.trim() || !message.trim()) {
            setResult("제목과 내용을 모두 입력해 주세요.")
            return
        }
        setSending(true)
        setResult(null)
        const r = await sendContact({
            subject: subject.trim(),
            message: message.trim(),
            senderName: senderName.trim() || undefined,
            senderEmail: senderEmail.trim() || undefined,
        })
        setSending(false)
        if (r.ok) {
            setResult("success")
            setTimeout(() => {
                onClose()
                setSubject("")
                setMessage("")
            }, 1500)
        } else {
            setResult(r.error || "발송 실패")
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 backdrop-blur-sm"
                style={{ background: "var(--surface-overlay)" }}
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className="relative w-full max-w-lg border-2 border-primary/40 rounded-xl shadow-2xl"
                style={{ background: "var(--surface-elevated)" }}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h2 className="text-base font-semibold text-foreground">관리자에게 문의하기</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        aria-label="닫기"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">이름 (선택)</label>
                            <input
                                type="text"
                                value={senderName}
                                onChange={e => setSenderName(e.target.value)}
                                placeholder="홍길동"
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">회신 이메일 (선택)</label>
                            <input
                                type="email"
                                value={senderEmail}
                                onChange={e => setSenderEmail(e.target.value)}
                                placeholder="hong@example.com"
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">제목 *</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="문의 제목을 입력하세요"
                            maxLength={200}
                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">내용 *</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="문의 내용을 자세히 적어주세요. 라이선스 키, 앱 버전, 머신 ID는 자동으로 함께 전달됩니다."
                            rows={6}
                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                    </div>

                    {result === "success" && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm">
                            <CheckCircle className="h-4 w-4" />
                            발송 완료! 곧 회신드리겠습니다.
                        </div>
                    )}
                    {result && result !== "success" && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            {result}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
                    <button
                        onClick={onClose}
                        disabled={sending}
                        className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || !subject.trim() || !message.trim()}
                        className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                발송 중...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                보내기
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
