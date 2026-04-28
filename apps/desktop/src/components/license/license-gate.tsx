"use client"

import * as React from "react"
import { activateLicense, checkLicenseOnStartup, LicenseState } from "@/lib/license/license-client"
import { Loader2, CheckCircle, XCircle, WifiOff } from "lucide-react"

interface LicenseGateProps {
    children: React.ReactNode
}

type CheckStatus = "checking" | "valid" | "offline_grace" | "invalid" | "unactivated"

export function LicenseGate({ children }: LicenseGateProps) {
    // DEV 모드에서는 라이선스 검증 우회 (Production 빌드에 영향 없음)
    if (import.meta.env.DEV) {
        return <>{children}</>
    }

    const [status, setStatus] = React.useState<CheckStatus>("checking")
    const [license, setLicense] = React.useState<LicenseState | null>(null)
    const [offlineReason, setOfflineReason] = React.useState("")
    const [keyInput, setKeyInput] = React.useState("")
    const [activating, setActivating] = React.useState(false)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        checkLicenseOnStartup().then((result) => {
            setStatus(result.status)
            if (result.license) setLicense(result.license)
            if (result.reason) setOfflineReason(result.reason)
        })
    }, [])

    const handleActivate = async () => {
        const trimmed = keyInput.trim().toUpperCase()
        if (!trimmed) return

        setActivating(true)
        setError("")

        const result = await activateLicense(trimmed)

        if (result.success && result.license) {
            setLicense(result.license)
            setStatus("valid")
        } else {
            setError(result.reason || "활성화 실패")
        }

        setActivating(false)
    }

    // 검증 중
    if (status === "checking") {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">라이선스 확인 중...</p>
                </div>
            </div>
        )
    }

    // 유효 또는 오프라인 유예 → 앱 실행
    if (status === "valid" || status === "offline_grace") {
        return (
            <>
                {status === "offline_grace" && (
                    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-xs">
                        <WifiOff className="h-3 w-3 shrink-0" />
                        {offlineReason} — 인터넷 연결 후 자동으로 갱신됩니다.
                    </div>
                )}
                {children}
            </>
        )
    }

    // 미인증 또는 무효 → 라이선스 입력 화면
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* 로고 */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <img src="/carbonmate-logo.png" alt="CarbonMate" className="h-12 w-12" />
                    <span className="text-2xl font-bold text-foreground">CarbonMate</span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
                    <h2 className="text-xl font-semibold text-foreground mb-1">라이선스 활성화</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        구매 후 이메일로 받은 라이선스 키를 입력하세요.
                    </p>

                    {status === "invalid" && (
                        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-600 dark:text-red-400 text-sm">
                            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            {offlineReason || "유효하지 않은 라이선스입니다."}
                        </div>
                    )}

                    <div className="space-y-3">
                        <input
                            type="text"
                            value={keyInput}
                            onChange={(e) => {
                                setKeyInput(e.target.value)
                                setError("")
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                            placeholder="CMATE-XXXX-XXXX-XXXX"
                            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground font-mono text-sm tracking-widest placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            spellCheck={false}
                            autoComplete="off"
                        />

                        {error && (
                            <p className="text-sm text-red-500">{error}</p>
                        )}

                        <button
                            onClick={handleActivate}
                            disabled={activating || !keyInput.trim()}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {activating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    확인 중...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4" />
                                    활성화
                                </>
                            )}
                        </button>
                    </div>

                    <p className="text-xs text-muted-foreground mt-6 text-center">
                        라이선스 구매 및 문의:{" "}
                        <a
                            href="mailto:openbrain.main@gmail.com"
                            className="text-emerald-500 hover:underline"
                        >
                            openbrain.main@gmail.com
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
