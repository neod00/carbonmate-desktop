"use client"

import * as React from "react"
import { Download, X, AlertTriangle, Loader2 } from "lucide-react"
import { openUrl } from "@tauri-apps/plugin-opener"
import { checkForUpdate, UpdateCheckResult } from "@/lib/update/update-client"

interface UpdateGateProps {
    children: React.ReactNode
}

const DISMISSED_KEY = "carbonmate-update-dismissed"

export function UpdateGate({ children }: UpdateGateProps) {
    const [result, setResult] = React.useState<UpdateCheckResult | null>(null)
    const [dismissed, setDismissed] = React.useState(false)

    React.useEffect(() => {
        checkForUpdate().then(r => {
            setResult(r)
            if (r.manifest?.version) {
                const dismissedVersion = localStorage.getItem(DISMISSED_KEY)
                if (dismissedVersion === r.manifest.version) {
                    setDismissed(true)
                }
            }
        })
    }, [])

    const handleDownload = async () => {
        const url = result?.manifest?.platforms?.["windows-x86_64"]?.url
        if (!url) return
        try {
            await openUrl(url)
        } catch {
            window.open(url, "_blank")
        }
    }

    const handleDismiss = () => {
        if (result?.manifest?.version) {
            localStorage.setItem(DISMISSED_KEY, result.manifest.version)
        }
        setDismissed(true)
    }

    if (!result || !result.hasUpdate) {
        return <>{children}</>
    }

    // 강제 업데이트 → 전체 화면 차단 모달
    if (result.forceUpdate && result.manifest) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-4 flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0" />
                        <div>
                            <h2 className="text-base font-semibold text-foreground">필수 업데이트</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">계속 사용하려면 업데이트가 필요합니다</p>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex items-baseline gap-2 mb-4">
                            <span className="text-sm text-muted-foreground">현재</span>
                            <span className="font-mono text-sm text-muted-foreground">v{result.currentVersion}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-sm text-emerald-500">최신</span>
                            <span className="font-mono text-sm font-semibold text-emerald-500">v{result.manifest.version}</span>
                        </div>

                        {result.manifest.notes && (
                            <div className="bg-background border border-border rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
                                <p className="text-xs text-muted-foreground mb-2 font-semibold">업데이트 내용</p>
                                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">{result.manifest.notes}</pre>
                            </div>
                        )}

                        <button
                            onClick={handleDownload}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="h-4 w-4" />
                            업데이트 다운로드
                        </button>

                        <p className="text-xs text-muted-foreground mt-4 text-center">
                            다운로드 후 .msi 파일을 실행하여 설치한 다음 앱을 다시 시작해 주세요.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // 일반 업데이트 → 닫기 가능한 배너 + 콘텐츠
    return (
        <>
            {!dismissed && result.manifest && (
                <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-xs">
                    <Download className="h-3 w-3 shrink-0" />
                    <span className="flex-1">
                        새 버전 <span className="font-semibold font-mono">v{result.manifest.version}</span>이 출시되었습니다
                        {result.manifest.notes && (
                            <span className="text-muted-foreground ml-2">— {result.manifest.notes.split("\n")[0]}</span>
                        )}
                    </span>
                    <button
                        onClick={handleDownload}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                    >
                        다운로드
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="p-1 rounded hover:bg-emerald-500/20 transition-colors"
                        aria-label="닫기"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}
            {children}
        </>
    )
}

export function UpdateCheckPlaceholder() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">업데이트 확인 중...</p>
            </div>
        </div>
    )
}
