"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { usePCFStore } from "@/lib/core/store"
import {
    saveDraft, loadDraft, deleteDraft, getDraftList, getAutoSaveMeta,
    formatDraftDate, getLocalStorageUsage,
    type DraftMeta
} from "@/lib/core/draft-manager"
import {
    Save,
    FolderOpen,
    Trash2,
    Clock,
    CheckCircle2,
    AlertCircle,
    Package,
    HardDrive,
    ChevronDown,
    ChevronUp,
    X,
    FileText,
    Download,
    Upload,
    FilePlus2
} from "lucide-react"

/**
 * 자동 저장 상태 표시 배지
 */
export function AutoSaveIndicator() {
    const [meta, setMeta] = React.useState<{ savedAt: string; productName: string } | null>(null)
    const [showSaved, setShowSaved] = React.useState(false)
    const productName = usePCFStore(s => s.productInfo.name)

    // 상태 변경 감지하여 저장 표시
    const storeState = usePCFStore()
    const stateRef = React.useRef<string>('')

    React.useEffect(() => {
        // 상태 변경 감지 (간단히 productInfo + stages 기반)
        const sig = JSON.stringify({
            p: storeState.productInfo,
            s: storeState.stages,
            m: storeState.detailedActivityData?.raw_materials?.length,
            t: storeState.detailedActivityData?.transport?.length
        })

        if (stateRef.current && stateRef.current !== sig) {
            setShowSaved(true)
            setMeta({ savedAt: new Date().toISOString(), productName })
            const timer = setTimeout(() => setShowSaved(false), 3000)
            return () => clearTimeout(timer)
        }
        stateRef.current = sig
    }, [storeState.productInfo, storeState.stages, storeState.detailedActivityData, productName])

    // 초기 로드 시 autosave meta 확인
    React.useEffect(() => {
        const m = getAutoSaveMeta()
        if (m) setMeta(m)
    }, [])

    if (!meta) return null

    return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground transition-all duration-300">
            {showSaved ? (
                <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 animate-pulse" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">자동 저장됨</span>
                </>
            ) : (
                <>
                    <Clock className="h-3 w-3" />
                    <span>{formatDraftDate(meta.savedAt)}</span>
                </>
            )}
        </div>
    )
}

/**
 * 초안 관리 패널 (저장/불러오기/삭제)
 */
export function DraftManagerPanel() {
    const [isOpen, setIsOpen] = React.useState(false)
    const [drafts, setDrafts] = React.useState<DraftMeta[]>([])
    const [draftName, setDraftName] = React.useState('')
    const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saved' | 'error'>('idle')
    const [loadConfirm, setLoadConfirm] = React.useState<string | null>(null)
    const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null)
    const [resetConfirm, setResetConfirm] = React.useState(false)
    const store = usePCFStore()

    // P0-4: 신규 프로젝트 시작 (모든 활동 데이터 초기화)
    const handleResetProject = () => {
        usePCFStore.getState().reset()
        // localStorage의 자동저장 키도 함께 정리하여 새로고침 시에도 빈 상태 유지
        try { localStorage.removeItem('carbonmate-autosave') } catch { /* ignore */ }
        setResetConfirm(false)
        setIsOpen(false)
    }

    // 초안 목록 갱신
    const refreshDrafts = React.useCallback(() => {
        setDrafts(getDraftList())
    }, [])

    React.useEffect(() => {
        refreshDrafts()
    }, [refreshDrafts])

    // 저장量 정보
    const usage = React.useMemo(() => getLocalStorageUsage(), [drafts])

    // 현재 상태를 초안으로 저장
    const handleSave = () => {
        const name = draftName.trim() || `${store.productInfo.name} — ${new Date().toLocaleDateString('ko-KR')}`
        try {
            saveDraft(name, usePCFStore.getState())
            setSaveStatus('saved')
            setDraftName('')
            refreshDrafts()
            setTimeout(() => setSaveStatus('idle'), 2500)
        } catch {
            setSaveStatus('error')
            setTimeout(() => setSaveStatus('idle'), 3000)
        }
    }

    // 초안 불러오기
    const handleLoad = (id: string) => {
        const data = loadDraft(id)
        if (!data) return

        // 리스토어: Zustand setState를 통해 복원
        usePCFStore.setState(data)
        setLoadConfirm(null)
        setIsOpen(false)
    }

    // 초안 삭제
    const handleDelete = (id: string) => {
        deleteDraft(id)
        setDeleteConfirm(null)
        refreshDrafts()
    }

    // 현재 상태를 JSON으로 다운로드
    const handleExportJSON = () => {
        const state = usePCFStore.getState()
        const stateRecord = state as unknown as Record<string, unknown>
        const dataOnly: Record<string, unknown> = {}
        for (const key of Object.keys(stateRecord)) {
            if (typeof stateRecord[key] !== 'function' && key !== 'user') {
                dataOnly[key] = stateRecord[key]
            }
        }
        const blob = new Blob([JSON.stringify(dataOnly, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `carbonmate-draft-${store.productInfo.name.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    // JSON 파일에서 가져오기
    const handleImportJSON = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.style.display = 'none'
        document.body.appendChild(input)
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            try {
                const text = await file.text()
                const data = JSON.parse(text)
                usePCFStore.setState(data)
            } catch {
                alert('JSON 파일을 읽을 수 없습니다.')
            } finally {
                document.body.removeChild(input)
            }
        }
        input.click()
    }

    return (
        <div className="relative">
            {/* 토글 버튼 */}
            <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary gap-1.5"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Save className="h-4 w-4" />
                임시저장
                {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>

            {/* 패널 */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[380px] z-50 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-xl shadow-black/10 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/10">
                                <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold">임시저장 관리</h3>
                                <p className="text-[10px] text-muted-foreground">브라우저 저장소 (localStorage)</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* P0-4: 신규 프로젝트 시작 */}
                    <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
                        {resetConfirm ? (
                            <div className="flex flex-col gap-2">
                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                    ⚠️ 현재 프로젝트의 모든 활동 데이터·DQR·할당 설정이 초기화됩니다. 저장하지 않은 변경사항은 사라집니다. 계속하시겠습니까?
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 text-xs gap-1"
                                        onClick={handleResetProject}
                                    >
                                        <FilePlus2 className="h-3 w-3" />
                                        초기화하고 신규 시작
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => setResetConfirm(false)}
                                    >
                                        취소
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-8 text-xs gap-1.5"
                                onClick={() => setResetConfirm(true)}
                            >
                                <FilePlus2 className="h-3.5 w-3.5" />
                                신규 프로젝트 시작 (모든 활동 데이터 초기화)
                            </Button>
                        )}
                    </div>

                    {/* 저장 폼 */}
                    <div className="px-4 py-3 border-b border-border/40">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={draftName}
                                onChange={(e) => setDraftName(e.target.value)}
                                placeholder="초안 이름을 입력하세요 (예: 1차 검토용)"
                                className="flex-1 px-3 py-2 text-sm rounded-lg bg-muted/50 border border-border/40 
                                           placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30
                                           focus:border-primary/50 transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            />
                            <Button size="sm" onClick={handleSave} className="gap-1.5 shrink-0">
                                <Save className="h-3.5 w-3.5" />
                                저장
                            </Button>
                        </div>

                        {/* 상태 메시지 */}
                        {saveStatus === 'saved' && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                저장 완료!
                            </div>
                        )}
                        {saveStatus === 'error' && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
                                <AlertCircle className="h-3 w-3" />
                                저장 실패 (저장소 공간 부족)
                            </div>
                        )}
                    </div>

                    {/* 초안 목록 */}
                    <div className="max-h-[280px] overflow-y-auto">
                        {drafts.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                저장된 초안이 없습니다
                            </div>
                        ) : (
                            <div className="divide-y divide-border/30">
                                {drafts.map((draft) => (
                                    <div
                                        key={draft.id}
                                        className="px-4 py-3 hover:bg-muted/30 transition-colors group"
                                    >
                                        {/* 불러오기 확인 */}
                                        {loadConfirm === draft.id ? (
                                            <div className="flex flex-col gap-2">
                                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                                    현재 데이터가 덮어쓰여집니다. 계속하시겠습니까?
                                                </p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="h-7 text-xs gap-1"
                                                        onClick={() => handleLoad(draft.id)}
                                                    >
                                                        <Upload className="h-3 w-3" />
                                                        불러오기
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs"
                                                        onClick={() => setLoadConfirm(null)}
                                                    >
                                                        취소
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : deleteConfirm === draft.id ? (
                                            <div className="flex flex-col gap-2">
                                                <p className="text-xs text-red-500 font-medium">
                                                    이 초안을 삭제하시겠습니까?
                                                </p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-7 text-xs gap-1"
                                                        onClick={() => handleDelete(draft.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        삭제
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs"
                                                        onClick={() => setDeleteConfirm(null)}
                                                    >
                                                        취소
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-start justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium truncate">{draft.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                <Package className="h-2.5 w-2.5" />
                                                                {draft.productName}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                원자재 {draft.materialCount}개
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            {formatDraftDate(draft.savedAt)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-primary hover:text-primary"
                                                            onClick={() => setLoadConfirm(draft.id)}
                                                            title="불러오기"
                                                        >
                                                            <FolderOpen className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-red-500 hover:text-red-600"
                                                            onClick={() => setDeleteConfirm(draft.id)}
                                                            title="삭제"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 푸터: 가져오기/내보내기 + 용량 */}
                    <div className="px-4 py-2.5 border-t border-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={handleExportJSON}>
                                <Download className="h-3 w-3" />
                                JSON 내보내기
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={handleImportJSON}>
                                <Upload className="h-3 w-3" />
                                가져오기
                            </Button>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <HardDrive className="h-2.5 w-2.5" />
                            {usage.usedKB} / {usage.estimatedMaxKB} KB
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
