/**
 * Narrative 슬롯별 사용자 메시지 빌더.
 * 산정 컨텍스트를 받아 슬롯에 맞는 user prompt를 생성합니다.
 */
import type { NarrativeContext, NarrativeSlot } from '@lca/shared';

function fmtCFP(ctx: NarrativeContext): string {
  const u = ctx.totalCFP.uncertaintyPercent;
  const range = u
    ? ` (±${u}%, ${(ctx.totalCFP.value * (1 - u / 100)).toFixed(2)} ~ ${(
        ctx.totalCFP.value *
        (1 + u / 100)
      ).toFixed(2)})`
    : '';
  return `${ctx.totalCFP.value.toFixed(2)} ${ctx.totalCFP.unit}${range}`;
}

function fmtStages(ctx: NarrativeContext): string {
  return ctx.stageBreakdown
    .map((s) => `- ${s.stage}: ${s.value.toFixed(2)} kgCO₂e (${s.sharePercent.toFixed(1)}%)`)
    .join('\n');
}

function fmtTopContributors(ctx: NarrativeContext): string {
  if (!ctx.topContributors?.length) return '(상위 기여자 데이터 없음)';
  return ctx.topContributors
    .slice(0, 10)
    .map(
      (t) =>
        `${t.rank}. ${t.item}: ${t.value.toFixed(2)} kgCO₂e (${t.sharePercent.toFixed(
          1
        )}%, 누적 ${t.cumulativePercent.toFixed(1)}%)`
    )
    .join('\n');
}

function fmtAllocation(ctx: NarrativeContext): string {
  if (!ctx.allocationDecisions?.length) return '(할당 결정 데이터 없음)';
  return ctx.allocationDecisions
    .map((a) => `- ${a.material} → ${a.method.toUpperCase()}: ${a.rationale}`)
    .join('\n');
}

function fmtDatasets(ctx: NarrativeContext): string {
  if (!ctx.datasetMappings?.length) return '(dataset 매핑 데이터 없음)';
  return ctx.datasetMappings
    .map(
      (d) =>
        `- ${d.activity}: ${d.datasetName} [${d.geography}, ${d.year}, ${d.source}]`
    )
    .join('\n');
}

function fmtUserNotes(ctx: NarrativeContext): string {
  if (!ctx.userContextNotes?.length) return '(추가 사용자 컨텍스트 없음)';
  return ctx.userContextNotes.map((n, i) => `${i + 1}. ${n}`).join('\n');
}

function commonContextBlock(ctx: NarrativeContext): string {
  return `## 산정 컨텍스트

### 제품
- 제품명: ${ctx.product.name}
${ctx.product.purity ? `- 순도: ${ctx.product.purity}` : ''}
${ctx.product.form ? `- 형태: ${ctx.product.form}` : ''}
${ctx.product.application ? `- 용도: ${ctx.product.application}` : ''}

### 기능단위 / 시스템 경계
- 기능단위: ${ctx.functionalUnit}
- 시스템 경계: ${ctx.systemBoundary}

### 산정 결과
- 총 CFP: ${fmtCFP(ctx)}
- 단계별 기여도:
${fmtStages(ctx)}

### 사용자가 추가한 컨텍스트 메모 (중요 — narrative에 반영)
${fmtUserNotes(ctx)}
`;
}

export function buildSlotPrompt(slot: NarrativeSlot, ctx: NarrativeContext): string {
  const common = commonContextBlock(ctx);

  switch (slot) {
    case 'pcr':
      return `${common}

## 작성 요청 — §1.2 PCR(Product Category Rules) 적용 검토

ISO 14067 Clause 6.2 요구에 따라 본 제품에 적용 가능한 CFP-PCR 존재 여부를 검토한 narrative를 작성하세요.

요구사항:
1. EPD International, IBU, 한국 PCR registry(환경부) 등 주요 출처를 검색하여 PCR 가용성 확인
2. PCR 발견 시 — 제품 카테고리 일치도, 적용 가능성 평가, 채택 결정 근거
3. PCR 미발견 시 — ISO 14067:2018 본 표준 일반 방법론 적용 사유 명시 + 향후 PCR 발간 시 재검토 권고
4. 검색 결과는 web search 도구로 실시간 조회한 결과만 인용 (출처 URL + 검색일 명시)

권장 분량: 2단락. 각 단락 5~7줄.`;

    case 'systemBoundary':
      return `${common}

## 작성 요청 — §2.5 시스템 경계 채택 사유

본 산정의 시스템 경계 채택 사유와 downstream 단계 제외 사유를 narrative로 작성하세요.

요구사항:
1. 본 제품의 가치사슬 위치 (B2B 중간재인지 최종 소비재인지)
2. 채택한 경계의 ISO 14067 조항 근거 (Clause 6.3.x)
3. Downstream 제외 사유 — 이중계산(double counting) 위험 또는 고객 시스템 귀속 등
4. 출하 운송 포함/제외 결정과 그 사유

권장 분량: 2단락. 각 단락 5~7줄.`;

    case 'allocation':
      return `${common}

### 할당 결정 (산정자 입력)
${fmtAllocation(ctx)}

## 작성 요청 — §3.6 할당 절차 및 정당화 (ISO 14044 5.3.5)

ISO 14044 5.3.5의 우선순위(① 배분 회피 → ② 시스템 확장 → ③ 물리적 관계 → ④ 기타)에 따라 단계별 검토 결과를 narrative로 작성하세요.

요구사항:
1. 할당이 필요한 각 원료/공정에 대해 4단계 우선순위 검토 결과를 명시
2. 각 결정의 근거 — 결정 제품(determining product), zero-burden, 매입 단가 부재 등
3. 채택하지 않은 방법의 부적절 사유
4. 향후 데이터 확보 시 재검토 권고 (예: 매입 단가 확보 시 경제적 배분 시나리오)
5. 공용공정(전력·스팀)에 대한 할당/하위분할 결정 별도 명시

권장 분량: 4단락. 각 단락 5~8줄.`;

    case 'datasetRationale':
      return `${common}

### LCI Dataset 매핑 (산정자 입력)
${fmtDatasets(ctx)}

## 작성 요청 — §3.4 LCI Dataset 선정 근거

상위 기여 활동자료의 dataset 선정 근거를 dataset별로 narrative로 작성하세요.

요구사항:
1. 각 주요 dataset(전력·NaOH·H₂O₂·운송 등)에 대해:
   - 채택한 dataset의 지리·기술·연도 대표성
   - 대안 dataset(KR/RoW/GLO) 검토 결과와 배제 사유
   - 보수성/낙관성 평가 (실제 공정 대비)
   - CFP 영향 범위 추정 (가능한 경우)
2. Web search 도구로 최신 dataset 가용성 확인 (예: 한국 신규 dataset 추가 여부)
3. 검색 결과는 출처 URL + 검색일 명시

권장 분량: 4단락 (주요 dataset당 1단락). 각 단락 4~6줄.`;

    case 'dataQuality':
      return `${common}

${
  ctx.dqr
    ? `### DQR (산정자 산출)
- TiR(시간) 평균: ${ctx.dqr.averageTiR.toFixed(1)}
- TeR(기술) 평균: ${ctx.dqr.averageTeR.toFixed(1)}
- GeR(지리) 평균: ${ctx.dqr.averageGeR.toFixed(1)}
- 가중평균 DQR: ${ctx.dqr.weightedAverage.toFixed(1)}`
    : '### DQR 데이터 없음 — 일반 평가만 작성'
}

## 작성 요청 — §5.4 데이터 품질 종합 평가

본 산정의 데이터 품질을 종합 평가하는 narrative를 작성하세요.

요구사항:
1. 종합 DQR 등급 (ILCD 척도 1~5: 1=최우수, 5=매우 미흡)
2. 1차 데이터 / 2차 데이터 비율 (활동량 기준 추정)
3. 가장 취약한 데이터 항목과 그 사유 (어느 dataset의 어느 차원이 약한지)
4. 취약점이 CFP 결과에 미치는 영향 범위 (민감도 분석 결과 인용)
5. PEFCR v6.3 활동자료 등급 (Very good/Good/Fair) 평가
6. 9항목 자체평가 결과의 핵심 시사점
7. 외부 공개·EPD 등록·EU CBAM 보고용으로 사용하기 전 보완 권고사항

권장 분량: 4단락. 각 단락 5~8줄.`;

    case 'resultInterpretation':
      return `${common}

### 상위 기여자 (Pareto)
${fmtTopContributors(ctx)}

## 작성 요청 — §8.1 종합 해석 (Hotspot 구조와 개선 경로)

산정 결과의 hotspot 구조를 해석하고 개선 경로 우선순위를 narrative로 작성하세요.

요구사항:
1. 단계별 기여도 해석 — 가장 큰 단계가 차지하는 비율 + 그 단계가 큰 사유 (산업 특성)
2. 동종 산업 평균 또는 산업 통계와의 비교 (있는 경우만, 없으면 일반 경향성 언급)
3. Top 3 hotspot 항목 분석 — 화학량론 결정 항목 vs 공정 변경 가능 항목 구분
4. 단기(1~3년) / 중기(3~5년) / 장기 개선 경로 우선순위
5. 각 개선 경로의 정량 효과 추정 (kgCO₂e 감축량)
6. 결과의 한계 (검증 전 잠정값) 및 외부 사용 전 검증 권고

권장 분량: 4단락. 각 단락 6~9줄.`;

    default: {
      const _exhaustive: never = slot;
      throw new Error(`Unknown narrative slot: ${_exhaustive}`);
    }
  }
}
