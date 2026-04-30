"use client"

import * as React from "react"
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Edit3,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Save,
  X,
} from "lucide-react"
import { NARRATIVE_SLOT_META, type NarrativeSlot } from "@lca/shared"
import { useNarrativeStore } from "@/lib/narrative/narrative-store"
import type { BatchGenerateProgress } from "@/lib/narrative/narrative-client"

interface NarrativeCardProps {
  slot: NarrativeSlot
  /** 생성 진행 상황 (없으면 store 기준으로 표시) */
  progress?: BatchGenerateProgress
  /** 재생성 요청 콜백 */
  onRegenerate?: (slot: NarrativeSlot) => void
}

export function NarrativeCard({ slot, progress, onRegenerate }: NarrativeCardProps) {
  const meta = NARRATIVE_SLOT_META[slot]
  const record = useNarrativeStore((s) => s.records[slot])
  const editRecord = useNarrativeStore((s) => s.editRecord)
  const setApproved = useNarrativeStore((s) => s.setApproved)

  const [expanded, setExpanded] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState<string>("")

  const isInProgress = progress?.status === "in-progress"
  const isError = progress?.status === "error"

  const startEdit = () => {
    setDraft(record?.paragraphs.join("\n\n") ?? "")
    setEditing(true)
  }
  const saveEdit = () => {
    const paragraphs = draft.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    if (paragraphs.length > 0) {
      editRecord(slot, paragraphs, record?.title)
    }
    setEditing(false)
  }
  const cancelEdit = () => {
    setEditing(false)
    setDraft("")
  }

  // 상태 색상
  const statusBadge = (() => {
    if (isInProgress) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded px-2 py-0.5">
          <Loader2 className="h-3 w-3 animate-spin" /> 생성 중
        </span>
      )
    }
    if (isError) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-0.5">
          <AlertCircle className="h-3 w-3" /> 실패
        </span>
      )
    }
    if (record?.approved) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-0.5">
          <CheckCircle2 className="h-3 w-3" /> 승인됨
        </span>
      )
    }
    if (record) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">
          검토 대기
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted border border-border rounded px-2 py-0.5">
        대기
      </span>
    )
  })()

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-colors ${
        record?.approved
          ? "border-emerald-500/40 bg-emerald-500/5"
          : isError
            ? "border-red-500/40 bg-red-500/5"
            : "border-border bg-card"
      }`}
    >
      {/* 헤더 */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">§{meta.reportSection}</span>
              <span className="font-semibold text-foreground truncate">{meta.label}</span>
            </div>
            {record?.title && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{record.title}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">{statusBadge}</div>
      </button>

      {/* 본문 */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-border/50">
          {/* 에러 */}
          {isError && progress?.error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
              <div className="font-medium mb-1">생성 실패</div>
              <div className="text-xs">{progress.error.message}</div>
              {progress.error.details && (
                <div className="text-xs mt-1 font-mono opacity-70">{progress.error.details}</div>
              )}
              {onRegenerate && (
                <button
                  onClick={() => onRegenerate(slot)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-300 rounded-md transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> 재시도
                </button>
              )}
            </div>
          )}

          {/* 생성 중 */}
          {isInProgress && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carbony 페르소나로 narrative 생성 중...
            </div>
          )}

          {/* 본문 (record 있음) */}
          {record && !isInProgress && (
            <>
              {!editing ? (
                <div className="mt-4 space-y-3">
                  {record.paragraphs.map((p, i) => (
                    <p
                      key={i}
                      className="text-sm leading-relaxed text-foreground"
                      style={{ textIndent: "1em" }}
                    >
                      {p}
                    </p>
                  ))}

                  {/* 인용 */}
                  {record.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/50">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        인용 (Web search)
                      </div>
                      <ul className="space-y-1">
                        {record.citations.map((c, i) => (
                          <li key={i} className="text-xs">
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              {c.title}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 메타 + 액션 */}
                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/50 flex-wrap">
                    <div className="text-xs text-muted-foreground">
                      모델: <span className="font-mono">{record.model}</span>
                      {record.edited && <span className="ml-2 text-amber-600">· 수정됨</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {onRegenerate && (
                        <button
                          onClick={() => onRegenerate(slot)}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-muted hover:bg-muted/70 rounded-md transition-colors"
                        >
                          <RefreshCw className="h-3 w-3" /> 재생성
                        </button>
                      )}
                      <button
                        onClick={startEdit}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-muted hover:bg-muted/70 rounded-md transition-colors"
                      >
                        <Edit3 className="h-3 w-3" /> 편집
                      </button>
                      <button
                        onClick={() => setApproved(slot, !record.approved)}
                        className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                          record.approved
                            ? "bg-emerald-600 text-white hover:bg-emerald-500"
                            : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {record.approved ? "승인 취소" : "승인"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full min-h-[200px] bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    단락은 빈 줄(엔터 2회)로 구분하세요.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveEdit}
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                    >
                      <Save className="h-3 w-3" /> 저장
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-muted hover:bg-muted/70 rounded-md transition-colors"
                    >
                      <X className="h-3 w-3" /> 취소
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 빈 상태 */}
          {!record && !isInProgress && !isError && (
            <div className="mt-4 text-sm text-muted-foreground">
              아직 생성되지 않았습니다.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
