"use client"

import * as React from "react"
import { Sparkles, Loader2, RotateCcw, AlertCircle, CheckCircle2, FileDown } from "lucide-react"
import { NARRATIVE_SLOTS, type NarrativeSlot } from "@lca/shared"
import { useNarrativeStore } from "@/lib/narrative/narrative-store"
import {
  generateAllNarratives,
  generateNarrative,
  estimateTotalCost,
  NarrativeError,
  type BatchGenerateProgress,
} from "@/lib/narrative/narrative-client"
import { buildNarrativeContext } from "@/lib/narrative/build-narrative-context"
import { usePCFStore } from "@/lib/core/store"
import { calculateTotalEmissions } from "@/lib/core/emission-calculator"
import { NarrativeCard } from "./narrative-card"

/**
 * Narrative 검토 패널 — step 8의 두 번째 화면.
 *
 * 1. "전체 생성" 버튼 → generateAllNarratives 호출 → 진행 상황 실시간 표시
 * 2. 6개 카드: 생성된 narrative 본문 + 편집/재생성/승인
 * 3. 모두 승인되면 "보고서로 진행" 버튼 활성화
 */
export function NarrativeReviewPanel() {
  const { records, contextMemos, saveRecord, removeRecord, isAllApproved, approvedCount } =
    useNarrativeStore()

  const [batchProgress, setBatchProgress] = React.useState<BatchGenerateProgress[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [globalError, setGlobalError] = React.useState<string | null>(null)
  const [singleRegenerating, setSingleRegenerating] = React.useState<NarrativeSlot | null>(null)

  const allApproved = isAllApproved()
  const approved = approvedCount()
  const totalRecords = NARRATIVE_SLOTS.filter((s) => records[s]).length

  // 비용 (estimateTotalCost는 progress 기준)
  const cost = React.useMemo(() => estimateTotalCost(batchProgress), [batchProgress])

  const buildContextForRequest = React.useCallback(() => {
    const pcfState = usePCFStore.getState()
    return buildNarrativeContext(pcfState, { contextMemos })
  }, [contextMemos])

  const handleGenerateAll = async () => {
    setIsGenerating(true)
    setGlobalError(null)
    const ctx = buildContextForRequest()

    const result = await generateAllNarratives(ctx, (progress) => {
      setBatchProgress([...progress])
      // 성공한 슬롯은 store에 즉시 저장
      for (const p of progress) {
        if (p.status === "success" && p.result && !records[p.slot]) {
          saveRecord({
            slot: p.slot,
            paragraphs: p.result.paragraphs,
            title: p.result.title,
            citations: p.result.citations,
            model: p.result.model,
          })
        }
      }
    })

    // 최종 결과 한번 더 store 동기화 (콜백 누락 방지)
    for (const p of result) {
      if (p.status === "success" && p.result) {
        // 이미 저장된 경우엔 덮어쓰지 않음 (사용자 편집 보존)
        const existing = useNarrativeStore.getState().records[p.slot]
        if (!existing) {
          saveRecord({
            slot: p.slot,
            paragraphs: p.result.paragraphs,
            title: p.result.title,
            citations: p.result.citations,
            model: p.result.model,
          })
        }
      }
    }

    setBatchProgress(result)
    setIsGenerating(false)

    // 모두 실패 시 글로벌 에러
    const allFailed = result.every((r) => r.status === "error")
    if (allFailed) {
      const first = result[0]?.error
      setGlobalError(
        first?.code === "no-server-key"
          ? "서버에 OpenAI API 키가 설정되지 않았습니다. 관리자에게 문의하세요."
          : first?.code === "narrative-disabled"
            ? "AI narrative 자동 생성이 관리자에 의해 비활성화되어 있습니다."
            : first?.message ?? "narrative 생성에 모두 실패했습니다."
      )
    }
  }

  const handleRegenerateSingle = async (slot: NarrativeSlot) => {
    setSingleRegenerating(slot)
    setGlobalError(null)
    const ctx = buildContextForRequest()

    // 진행 상황 카드 업데이트
    setBatchProgress((prev) => {
      const next = [...prev]
      const idx = next.findIndex((p) => p.slot === slot)
      if (idx >= 0) next[idx] = { slot, status: "in-progress" }
      else next.push({ slot, status: "in-progress" })
      return next
    })
    // store에서 기존 record 삭제 (새로 그릴 자리 마련)
    removeRecord(slot)

    try {
      const result = await generateNarrative(slot, ctx)
      saveRecord({
        slot,
        paragraphs: result.paragraphs,
        title: result.title,
        citations: result.citations,
        model: result.model,
      })
      setBatchProgress((prev) => {
        const next = [...prev]
        const idx = next.findIndex((p) => p.slot === slot)
        const item: BatchGenerateProgress = { slot, status: "success", result }
        if (idx >= 0) next[idx] = item
        else next.push(item)
        return next
      })
    } catch (e) {
      const error = e instanceof NarrativeError
        ? e
        : new NarrativeError(e instanceof Error ? e.message : "재생성 실패", "server-error")
      setBatchProgress((prev) => {
        const next = [...prev]
        const idx = next.findIndex((p) => p.slot === slot)
        const item: BatchGenerateProgress = { slot, status: "error", error }
        if (idx >= 0) next[idx] = item
        else next.push(item)
        return next
      })
    } finally {
      setSingleRegenerating(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          AI 보고서 narrative 검토
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Carbony 페르소나가 산정 결과 + 컨텍스트 메모를 기반으로 6개 슬롯의 서술형 본문을 생성합니다.
          각 본문을 검토하고 필요 시 편집·재생성한 후 승인하세요.
        </p>
      </div>

      {/* 글로벌 에러 */}
      {globalError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-red-700 dark:text-red-300 text-sm">생성 실패</div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">{globalError}</div>
          </div>
        </div>
      )}

      {/* 액션 바 */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-muted/40 border border-border rounded-lg p-4">
        <div className="flex items-center gap-3 text-sm">
          {totalRecords === 0 ? (
            <span className="text-muted-foreground">아직 생성된 narrative가 없습니다.</span>
          ) : (
            <>
              <span className="text-foreground font-medium">
                {approved} / 6
              </span>
              <span className="text-muted-foreground">슬롯 승인 완료</span>
              {cost.totalUSD > 0 && (
                <span className="text-xs text-muted-foreground bg-background border border-border rounded px-2 py-0.5">
                  생성 비용 약 {cost.totalKRW}원
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalRecords > 0 && !isGenerating && (
            <button
              onClick={handleGenerateAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/70 text-foreground rounded-lg transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              전체 재생성
            </button>
          )}
          <button
            onClick={handleGenerateAll}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : totalRecords === 0 ? (
              <>
                <Sparkles className="h-4 w-4" />
                6개 narrative 자동 생성
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                다시 전체 생성
              </>
            )}
          </button>
        </div>
      </div>

      {/* 6개 카드 */}
      <div className="space-y-3">
        {NARRATIVE_SLOTS.map((slot) => {
          const progress =
            singleRegenerating === slot
              ? ({ slot, status: "in-progress" } as BatchGenerateProgress)
              : batchProgress.find((p) => p.slot === slot)
          return (
            <NarrativeCard
              key={slot}
              slot={slot}
              progress={progress}
              onRegenerate={handleRegenerateSingle}
            />
          )
        })}
      </div>

      {/* 푸터 — 보고서 다운로드 (narrative 통합) */}
      <ReportDownloadSection allApproved={allApproved} />
    </div>
  )
}

/**
 * Narrative가 승인된 시점에서 바로 Word 보고서 다운로드.
 * narrative-store의 records를 generateFullWordReport에 전달.
 */
function ReportDownloadSection({ allApproved }: { allApproved: boolean }) {
  const records = useNarrativeStore((s) => s.records)
  const [downloading, setDownloading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const approvedCount = NARRATIVE_SLOTS.filter((slot) => records[slot]?.approved).length

  const handleDownloadWord = async () => {
    setDownloading(true)
    setError(null)
    try {
      const { generateFullWordReport } = await import("@/lib/report/report-docx-full")
      const { saveAs } = await import("file-saver")
      const state = usePCFStore.getState()
      const result = calculateTotalEmissions(state.stages, {
        activityData: state.activityData as Record<string, unknown>,
        detailedActivityData: state.detailedActivityData as never,
        recyclingAllocation: state.recyclingAllocation,
      })
      const blob = await generateFullWordReport(state, result, { narratives: records })
      const productName = (state.productInfo.name || "product").replace(/\s+/g, "_")
      const date = new Date().toISOString().slice(0, 10)
      saveAs(blob, `PCF_Report_ISO14067_${productName}_${date}.docx`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "보고서 생성 실패")
    } finally {
      setDownloading(false)
    }
  }

  if (approvedCount === 0) {
    return null
  }

  return (
    <div className="border-t border-border pt-6 mt-2">
      <h3 className="text-base font-semibold text-foreground mb-1">보고서 다운로드</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        승인된 narrative {approvedCount}개가 보고서의 정확한 위치에 자동 삽입됩니다.
        {!allApproved &&
          ` (총 6개 중 ${approvedCount}개만 승인 — 미승인 슬롯은 보고서에서 제외됩니다)`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleDownloadWord}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg shadow-md shadow-indigo-500/20 transition-all"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              생성 중...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              ISO 14067 보고서 (Word) 다운로드
            </>
          )}
        </button>
        {allApproved ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />6개 narrative 모두 승인됨
          </span>
        ) : (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            ⚠️ {6 - approvedCount}개 슬롯이 미승인 상태입니다
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        Markdown · HTML 등 다른 형식 보고서는 결과(7/8) 화면에서 다운로드 가능합니다.
      </p>
    </div>
  )
}
