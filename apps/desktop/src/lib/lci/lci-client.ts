/**
 * LCI Client (외교관)
 * CarbonMate와 catalog-api 사이의 통역 및 데이터 중개 서비스
 * 
 * 역할:
 * 1. 통역: 한글 → 영문 변환
 * 2. 검색: LCI DB에서 후보 데이터 조회
 * 3. 추천 보고: AI의 ISO 적합성 분석 결과 전달
 * 4. BOM 일괄 매칭: 다수 자재를 한 번에 LCI DB와 연결
 * 5. BOM 예측: 제품명으로 일반적인 BOM 구성 추론 (고급)
 */

import {
    LciSearchResult,
    LciSearchItem,
    LciGuideInfo,
    BomItem,
    BomMatchResult,
    IntentResult
} from './types';

// ============================================================================
// 설정
// ============================================================================

// 데스크탑 앱: Vite 환경변수로 license-server URL 지정
// 개발 시: http://localhost:3000, 배포 시: https://your-license-server.vercel.app
const CATALOG_API_BASE = import.meta.env.VITE_LICENSE_SERVER_URL || 'http://localhost:3000';

// ============================================================================
// 1. 통역 기능: 한글 → 영문 변환 (하이브리드: 테이블 + AI + 캐싱)
// ============================================================================

// 번역 캐시 (세션 동안 유지)
const translationCache = new Map<string, string>();

// 한글-영문 매핑 테이블 (Phase 1: 1:N 매핑으로 확장)
// 첫 번째 항목이 primary 키워드, 나머지는 보조 검색어
const LCI_MAPPINGS: Record<string, string[]> = {
    // ===== 금속류 =====
    '알루미늄': ['aluminium', 'aluminium alloy'],
    '알루미늄 압출재': ['aluminium, wrought alloy'],
    '알루미늄 주물': ['aluminium, cast alloy'],
    '알루미늄 합금': ['aluminium alloy', 'AlMg3'],
    '알루미늄 잉곳': ['aluminium, primary, ingot'],
    '재생 알루미늄': ['aluminium scrap, post-consumer', 'aluminium, secondary'],
    '철강': ['steel', 'steel, low-alloyed'],
    '스틸': ['steel', 'steel, low-alloyed'],
    '탄소강': ['steel, low-alloyed'],
    '합금강': ['steel, low-alloyed'],
    '열연강판': ['steel, low-alloyed, hot rolled'],
    '냉연강판': ['steel, low-alloyed, cold rolled'],
    '스테인리스': ['steel, chromium steel 18/8', 'stainless steel'],
    'SUS304': ['steel, chromium steel 18/8'],
    'SUS316': ['steel, chromium steel 18/8'],
    '구리': ['copper'],
    '동': ['copper'],
    '동합금': ['copper', 'brass'],
    '황동': ['brass'],
    '아연': ['zinc'],
    '아연도금': ['zinc coat', 'galvanized'],
    '니켈': ['nickel'],
    '리튬': ['lithium'],
    '코발트': ['cobalt'],
    '납': ['lead'],
    '주석': ['tin'],
    '티타늄': ['titanium'],
    '마그네슘': ['magnesium'],
    '금': ['gold'],
    '은': ['silver'],
    '백금': ['platinum'],
    '텅스텐': ['tungsten'],

    // ===== 플라스틱류 =====
    '플라스틱': ['plastic', 'polyethylene'],
    'PE': ['polyethylene'],
    'LDPE': ['polyethylene, low density, granulate'],
    'HDPE': ['polyethylene, high density, granulate'],
    'LLDPE': ['polyethylene, linear low density, granulate'],
    'PP': ['polypropylene, granulate'],
    'PET': ['polyethylene terephthalate, granulate'],
    'PS': ['polystyrene, general purpose, granulate'],
    'HIPS': ['polystyrene, high impact, granulate'],
    'EPS': ['polystyrene, expandable, granulate'],
    'PVC': ['polyvinylchloride'],
    'ABS': ['acrylonitrile-butadiene-styrene copolymer'],
    'PC': ['polycarbonate'],
    'PA': ['nylon 6', 'polyamide'],
    'PA6': ['nylon 6'],
    'PA66': ['nylon 6-6'],
    '나일론': ['nylon 6', 'nylon 6-6'],
    'PU': ['polyurethane'],
    '폴리우레탄': ['polyurethane'],
    '에폭시': ['epoxy resin'],
    '실리콘': ['silicone product'],
    '아크릴': ['polymethyl methacrylate, beads'],
    'PMMA': ['polymethyl methacrylate, beads'],
    '폴리에스터': ['polyester resin, unsaturated'],
    '비닐': ['polyvinylchloride'],
    '합성고무': ['synthetic rubber'],
    '천연고무': ['natural rubber'],
    '고무': ['synthetic rubber', 'natural rubber'],

    // ===== 종이/목재류 =====
    '종이': ['paper', 'kraft paper'],
    '원지': ['paper', 'base paper'],
    '판지': ['solid bleached board', 'paperboard'],
    '골판지': ['corrugated board box'],
    '백판지': ['solid bleached board'],
    '크라프트지': ['kraft paper'],
    '화장지': ['tissue paper'],
    '골심지': ['fluting medium'],
    '목재': ['sawnwood', 'wood'],
    '합판': ['plywood'],
    '파티클보드': ['particle board'],
    'MDF': ['medium density fibreboard'],
    '펄프': ['sulfate pulp', 'pulp'],
    '재생지': ['paper, recycled'],

    // ===== 에너지 =====
    '전기': ['electricity'],
    '전력': ['electricity'],
    '한국 전력': ['electricity, medium voltage, KR'],
    '가스': ['natural gas'],
    '천연가스': ['natural gas'],
    'LNG': ['natural gas, liquefied'],
    'LPG': ['liquefied petroleum gas'],
    '디젤': ['diesel'],
    '경유': ['diesel'],
    '가솔린': ['petrol'],
    '휘발유': ['petrol, unleaded'],
    '등유': ['kerosene'],
    '중유': ['heavy fuel oil'],
    '석탄': ['hard coal'],
    '수소': ['hydrogen'],
    '바이오디젤': ['biodiesel'],
    '태양광': ['photovoltaic', 'solar'],
    '풍력': ['wind power'],

    // ===== 화학제품 =====
    '잉크': ['printing ink'],
    '인쇄잉크': ['printing ink'],
    '수성잉크': ['water-based ink'],
    '접착제': ['adhesive'],
    '핫멜트': ['hot melt adhesive'],
    '도료': ['alkyd paint', 'paint'],
    '페인트': ['alkyd paint', 'paint'],
    '용제': ['solvent, organic'],
    '시너': ['solvent, organic'],
    '계면활성제': ['fatty alcohol', 'surfactant'],
    '염산': ['hydrochloric acid'],
    '황산': ['sulfuric acid'],
    '질산': ['nitric acid'],
    '수산화나트륨': ['sodium hydroxide'],
    '가성소다': ['sodium hydroxide'],
    '탄산나트륨': ['soda ash', 'sodium carbonate'],
    '암모니아': ['ammonia'],
    '메탄올': ['methanol'],
    '에탄올': ['ethanol'],
    '아세톤': ['acetone'],
    '포름알데히드': ['formaldehyde'],
    '과산화수소': ['hydrogen peroxide'],
    '염소': ['chlorine'],
    '산소': ['oxygen'],
    '질소': ['nitrogen, liquid'],

    // ===== 건설/광물 =====
    '시멘트': ['cement, Portland'],
    '콘크리트': ['concrete'],
    '레미콘': ['concrete, ready-mix'],
    '유리': ['flat glass', 'glass'],
    '강화유리': ['flat glass, coated'],
    '세라믹': ['ceramic tile'],
    '타일': ['ceramic tile'],
    '벽돌': ['brick'],
    '석고보드': ['gypsum plasterboard'],
    '석회석': ['limestone'],
    '모래': ['sand'],
    '자갈': ['gravel'],
    '아스팔트': ['mastic asphalt'],
    '단열재': ['insulation', 'glass wool'],
    '유리면': ['glass wool mat'],
    '스티로폼': ['polystyrene, expandable'],
    '석면': ['chrysotile'],

    // ===== 식품류 =====
    '밀가루': ['wheat flour'],
    '밀': ['wheat grain'],
    '쌀': ['rice'],
    '설탕': ['sugar, from sugar cane', 'sugar, from sugar beet'],
    '소금': ['sodium chloride', 'salt'],
    '물': ['tap water', 'water'],
    '수돗물': ['tap water'],
    '정수': ['water, deionised'],
    '식용유': ['vegetable oil'],
    '팜유': ['palm oil'],
    '대두유': ['soybean oil'],
    '카놀라유': ['rapeseed oil'],
    '올리브유': ['olive oil'],
    '코코넛유': ['coconut oil'],
    '전분': ['starch', 'maize starch'],
    '옥수수': ['maize grain'],
    '감자': ['potato'],
    '토마토': ['tomato'],
    '양파': ['onion'],
    '마늘': ['garlic'],
    '우유': ['raw milk', 'milk'],
    '버터': ['butter'],
    '치즈': ['cheese'],
    '크림': ['cream'],
    '요거트': ['yogurt'],
    '계란': ['chicken egg'],
    '닭고기': ['chicken meat'],
    '돼지고기': ['pork'],
    '소고기': ['beef'],
    '생선': ['fish'],
    '새우': ['shrimp'],
    '카카오': ['cocoa butter', 'cocoa'],
    '초콜릿': ['chocolate'],
    '커피': ['green coffee'],
    '차': ['tea'],
    '효모': ['yeast'],
    '젤라틴': ['gelatin'],
    '후추': ['pepper'],

    // ===== 섬유 =====
    '면': ['cotton fibre'],
    '면직물': ['cotton fibre', 'weaving cotton'],
    '폴리에스터 원단': ['polyester fibre', 'weaving polyester'],
    '울': ['wool'],
    '양모': ['wool'],
    '실크': ['silk'],
    '리넨': ['flax fibre'],
    '비스코스': ['viscose fibre'],
    '레이온': ['viscose fibre'],
    '아크릴 섬유': ['acrylic fibre'],
    '스판덱스': ['spandex'],
    '염색': ['textile dyeing'],

    // ===== 운송 =====
    '트럭 운송': ['transport, freight, lorry'],
    '해상 운송': ['transport, freight, sea, container ship'],
    '항공 운송': ['transport, freight, aircraft'],
    '철도 운송': ['transport, freight, train'],
    '택배': ['transport, freight, lorry, small'],

    // ===== 포장재 =====
    '박스': ['corrugated board box'],
    '포장': ['packaging'],
    '필름': ['polyethylene film', 'packaging film'],
    '포장 필름': ['packaging film, low density polyethylene'],
    '수축 필름': ['shrink wrap'],
    '버블랩': ['air cushion packaging'],
    '파렛트': ['EUR-flat pallet'],
    '스트레치 필름': ['stretch wrap'],
};

// 역호환: 기존 BASIC_MAPPINGS 형태도 지원 (첫 번째 매핑만 반환)
const BASIC_MAPPINGS: Record<string, string> = {};
for (const [ko, enArr] of Object.entries(LCI_MAPPINGS)) {
    BASIC_MAPPINGS[ko] = enArr[0];
}

/**
 * Gemini API를 사용한 LCA 전문 번역
 */
async function translateWithGemini(koreanQuery: string): Promise<string | null> {
    try {
        const response = await fetch(`${CATALOG_API_BASE}/api/catalog/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: koreanQuery }),
        });

        if (!response.ok) {
            console.warn(`Gemini 번역 API 실패: ${response.status}`);
            return null;
        }

        const data = await response.json();
        if (data.translation) {
            console.log(`Gemini 번역 성공: "${koreanQuery}" → "${data.translation}"`);
            return data.translation;
        }
        return null;
    } catch (error) {
        console.warn('Gemini 번역 오류:', error);
        return null;
    }
}

/**
 * 한글 검색어를 ecoinvent 최적 영문 키워드로 변환 (Phase 1: 1:N 매핑)
 * 하이브리드 방식: 괄호영문 → 1:N 매핑 → 캐시 → Gemini AI
 */
export async function translateToEnglish(koreanQuery: string): Promise<string> {
    // 한글이 없으면 그대로 반환
    if (!/[가-힣]/.test(koreanQuery)) {
        return koreanQuery;
    }

    // 1. 괄호 안의 영문 추출 시도 (예: "컵용 원지 (Food-grade Paperboard)" → "Food-grade Paperboard")
    const englishInParentheses = koreanQuery.match(/\(([A-Za-z][A-Za-z0-9\s\-\/,]+)\)/);
    if (englishInParentheses && englishInParentheses[1]) {
        const extracted = englishInParentheses[1].trim();
        console.log(`괄호 내 영문 추출: "${koreanQuery}" → "${extracted}"`);
        return extracted;
    }

    // 2. 1:N 매핑 - 정확히 일치
    if (LCI_MAPPINGS[koreanQuery]) {
        const keywords = LCI_MAPPINGS[koreanQuery];
        const result = keywords.join(', '); // 복수 키워드를 쉼표로 병합
        console.log(`1:N 매핑 (정확): "${koreanQuery}" → "${result}"`);
        return result;
    }

    // 3. 부분 일치 검색 (긴 키워드 우선) — 1:N 매핑
    const sortedKeys = Object.keys(LCI_MAPPINGS).sort((a, b) => b.length - a.length);
    for (const korean of sortedKeys) {
        if (koreanQuery.includes(korean)) {
            const keywords = LCI_MAPPINGS[korean];
            const result = keywords.join(', ');
            console.log(`1:N 매핑 (부분): "${koreanQuery}" → "${result}"`);
            return result;
        }
    }

    // 3.5 Phase 3: 학습 매핑 DB 조회 (사용자 피드백에서 자동 생성된 매핑)
    try {
        const normalizedQuery = koreanQuery.trim().toLowerCase();
        const res = await fetch(`${CATALOG_API_BASE}/api/catalog/learned-mappings?q=${encodeURIComponent(normalizedQuery)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.englishTerms && data.englishTerms.length > 0) {
                const result = data.englishTerms.join(', ');
                console.log(`학습 매핑 (DB): "${koreanQuery}" → "${result}" (신뢰도: ${data.confidence})`);
                translationCache.set(koreanQuery, result);
                return result;
            }
        }
    } catch (e) {
        // 학습 매핑 조회 실패 시 무시하고 다음 단계로
        console.warn('학습 매핑 조회 실패:', e);
    }

    // 4. 캐시 확인
    const cached = translationCache.get(koreanQuery);
    if (cached) {
        console.log(`캐시에서 번역 조회: "${koreanQuery}" → "${cached}"`);
        return cached;
    }

    // 5. Gemini AI 번역 시도
    const aiTranslation = await translateWithGemini(koreanQuery);
    if (aiTranslation) {
        translationCache.set(koreanQuery, aiTranslation);
        return aiTranslation;
    }

    // 6. 모든 방법 실패 시 원본 반환
    console.warn(`번역 실패 (모든 방법): ${koreanQuery}`);
    return koreanQuery;
}


// ============================================================================
// 2. 검색 기능: LCI DB에서 후보 데이터 조회 (Phase 3: 의도 인식 지능형 검색)
// ============================================================================

export interface SearchOptions {
    geography?: string;
    unit?: string;
    limit?: number;
    productCategory?: string;  // 카테고리 필터용 (food/electronics/textile 등)
    enableIntelligence?: boolean; // Phase 2: Material Intelligence 활성화 (기본: true)
    enableIntentUnderstanding?: boolean; // Phase 3: 의도 이해 활성화 (기본: true)
    productContext?: {
        productName?: string;
        category?: string;
        geography?: string;        // 제조국 코드 (KR, CN, GLO 등)
        applicationNote?: string;  // 용도 메모 (자유 텍스트)
    };
}

/**
 * Phase 3: Intent Understanding — 검색 전 사용자 의도 파악
 * "자동차용 반도체" → 용도(automotive) + 핵심소재(semiconductor) 분리
 */
export async function understandIntent(
    query: string,
    productContext?: { productName?: string; category?: string }
): Promise<IntentResult | null> {
    try {
        const res = await fetch(`${CATALOG_API_BASE}/api/catalog/understand-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, productContext }),
        });

        if (!res.ok) return null;
        const data = await res.json();
        return data as IntentResult;
    } catch (error) {
        console.warn('Intent Understanding 실패:', error);
        return null;
    }
}

/**
 * Phase 2: Material Intelligence — AI 원료 사전분석
 * 검색 전에 원료의 본질을 분석하여 최적 검색어 생성
 */
export async function analyzeMaterial(
    materialName: string,
    productContext?: { productName?: string; category?: string }
): Promise<{
    primarySearchTerms: string[];
    secondarySearchTerms: string[];
    materialCategory: string;
    isDirectlyAvailable: boolean;
    decomposition?: Array<{ name: string; nameKo: string; percentage: number }>;
    suggestedProxy?: string;
    analysisNote: string;
} | null> {
    try {
        const res = await fetch(`${CATALOG_API_BASE}/api/catalog/analyze-material`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                materialName,
                productContext,
            }),
        });

        if (!res.ok) return null;
        const data = await res.json();
        return data;
    } catch (error) {
        console.warn('Material Intelligence 분석 실패:', error);
        return null;
    }
}

/**
 * Phase 2: 피드백 캐시 조회 — 이전에 선택된 매핑이 있는지 확인
 */
async function checkFeedbackCache(query: string): Promise<LciSearchItem[] | null> {
    try {
        const res = await fetch(`${CATALOG_API_BASE}/api/catalog/feedback?q=${encodeURIComponent(query.toLowerCase())}`);
        if (!res.ok) return null;
        const data = await res.json();

        if (data.cached && data.suggestions?.length > 0) {
            console.log(`[피드백 캐시 히트] "${query}" → ${data.suggestions.length}건 (${data.hitCount}회 사용됨)`);
            return data.suggestions.map((s: any) => ({
                id: s.id?.toString() || '',
                activityName: s.activity_name || s.activityName || '',
                referenceProductName: s.reference_product_name || s.referenceProductName || '',
                geography: s.geography || '',
                unit: s.unit || '',
                activityUuid: s.activity_uuid || s.activityUuid || '',
                techCategory: s.tech_category || s.techCategory,
                materialType: s.material_type || s.materialType,
                isoScores: s.isoScores,
            }));
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Phase 2: 피드백 기록 — 사용자가 LCI 데이터를 선택했을 때 호출
 */
export async function recordFeedback(
    inputQuery: string,
    translatedQuery: string | undefined,
    selectedItem: LciSearchItem,
    productContext?: any,
    searchMethod?: string
): Promise<void> {
    try {
        await fetch(`${CATALOG_API_BASE}/api/catalog/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputQuery,
                translatedQuery,
                selectedDatasetId: parseInt(selectedItem.id) || null,
                selectedActivityName: selectedItem.activityName,
                selectedProductName: selectedItem.referenceProductName,
                selectedGeography: selectedItem.geography,
                productContext,
                matchConfidence: 'high', // 사용자가 직접 선택 = high
                searchMethod,
                sessionId: typeof window !== 'undefined' ? window.sessionStorage?.getItem('session_id') : null,
            }),
        });
        console.log(`[피드백 기록] "${inputQuery}" → "${selectedItem.activityName}"`);
    } catch (error) {
        console.warn('피드백 기록 실패:', error);
    }
}

/**
 * LCI 데이터베이스 검색 (Phase 3: 의도 인식 지능형 다단계 검색)
 * 
 * 검색 흐름:
 * 0. 🆕 Intent Understanding → AI가 사용자 의도 파악 ("자동차용 반도체" → automotive + semiconductor)
 * 1. 피드백 캐시 확인 → 이전에 선택된 매핑이 있으면 우선 반환
 * 2. 번역 (1:N 매핑 + Gemini AI) 또는 Intent 분석 결과의 최적 검색어 사용
 * 3. FTS 하이브리드 검색
 * 4. 결과 부족 시 → Material Intelligence로 AI 분석 → 최적 키워드로 재검색
 * 5. 여전히 없으면 → 자동 분해/프록시 시도
 */
export async function searchLci(
    query: string,
    options?: SearchOptions
): Promise<LciSearchResult> {
    const enableIntel = options?.enableIntelligence !== false; // 기본 true
    const enableIntent = options?.enableIntentUnderstanding !== false; // 기본 true

    // Phase 3-Step 0: Intent Understanding (의도 파악)
    let intent: IntentResult | null = null;
    if (enableIntent && /[가-힣]/.test(query) && query.length >= 4) {
        console.log(`[Intent] 의도 분석 시작: "${query}"`);
        intent = await understandIntent(query, options?.productContext);

        if (intent && intent.source === 'ai') {
            console.log(`[Intent] 분석 완료: core=${intent.intent.coreMaterial}, context=${intent.intent.applicationContext}`);
            console.log(`[Intent] 최적 검색어: [${intent.optimizedSearchTerms.join(', ')}]`);
        }
    }

    // Phase 2-Step 1: 피드백 캐시 확인
    const cachedResults = await checkFeedbackCache(query);
    if (cachedResults && cachedResults.length > 0) {
        return {
            query,
            translatedQuery: undefined,
            intent: intent || undefined,
            groups: [],
            hits: cachedResults,
        };
    }

    // Phase 3: Intent 기반 검색어 사용  OR  Phase 1: 기존 번역
    let searchTerms: string[];
    let translatedQuery: string;
    const enhancedOptions = { ...options };

    if (intent && intent.optimizedSearchTerms.length > 0 && intent.source === 'ai') {
        // Intent 분석 결과의 최적 검색어 사용
        searchTerms = intent.optimizedSearchTerms;
        translatedQuery = searchTerms[0];

        // Intent가 카테고리를 제안하면 자동 적용
        if (intent.suggestedCategory && !options?.productCategory) {
            enhancedOptions.productCategory = intent.suggestedCategory;
            console.log(`[Intent] 카테고리 자동 설정: ${intent.suggestedCategory}`);
        }
    } else {
        // 기존 번역 경로
        translatedQuery = await translateToEnglish(query);
        searchTerms = [translatedQuery];
    }

    // 첫 번째 검색어로 FTS 하이브리드 검색
    let result = await doSearchRequest(searchTerms[0], enhancedOptions);

    // Intent의 추가 검색어로 결과 보강 (결과가 부족할 때)
    if (result.hits.length < 5 && searchTerms.length > 1) {
        const existingIds = new Set(result.hits.map(h => h.id));
        for (const term of searchTerms.slice(1, 3)) {
            const extraResult = await doSearchRequest(term, enhancedOptions);
            for (const hit of extraResult.hits) {
                if (!existingIds.has(hit.id)) {
                    result.hits.push(hit);
                    existingIds.add(hit.id);
                }
            }
        }
    }

    // Phase 3: Intent 기반 노이즈 필터링
    if (intent && intent.contextFilters.irrelevantKeywords.length > 0) {
        const beforeCount = result.hits.length;
        result.hits = result.hits.filter(hit => {
            const text = [
                hit.activityName || '',
                hit.referenceProductName || ''
            ].join(' ').toLowerCase();

            // 관련 없는 키워드가 포함되어 있으면 필터링
            for (const noise of intent!.contextFilters.irrelevantKeywords) {
                if (text.includes(noise.toLowerCase())) {
                    return false;
                }
            }
            return true;
        });
        if (beforeCount !== result.hits.length) {
            console.log(`[Intent] 노이즈 필터링: ${beforeCount} → ${result.hits.length}건`);
        }
    }

    // Phase 2-Step 4: 결과 부족 시 Material Intelligence 활용
    if (result.hits.length < 3 && enableIntel) {
        console.log(`[검색 결과 부족] ${result.hits.length}건 → Material Intelligence 분석 시작`);

        const analysis = await analyzeMaterial(query, options?.productContext);

        if (analysis) {
            // AI가 제안한 primary 검색어로 재검색
            for (const term of analysis.primarySearchTerms || []) {
                if (term.toLowerCase() !== translatedQuery.toLowerCase()) {
                    const retryResult = await doSearchRequest(term, enhancedOptions);
                    if (retryResult.hits.length > result.hits.length) {
                        console.log(`[MI 재검색 성공] "${term}" → ${retryResult.hits.length}건`);
                        result = {
                            ...retryResult,
                            query,
                            translatedQuery: term,
                        };
                        break;
                    }
                }
            }

            // Phase 2-Step 5: 여전히 결과 부족 → 자동 분해
            if (result.hits.length < 2 && analysis.decomposition && analysis.decomposition.length > 0) {
                console.log(`[자동 분해] "${query}" → ${analysis.decomposition.length}개 구성원료`);

                const decomposedHits: LciSearchItem[] = [];
                for (const comp of analysis.decomposition.slice(0, 4)) {
                    const compResult = await doSearchRequest(comp.name, { ...enhancedOptions, limit: 3 });
                    if (compResult.hits.length > 0) {
                        decomposedHits.push({
                            ...compResult.hits[0],
                            referenceProductName: `${comp.nameKo} (${comp.percentage}%) — ${compResult.hits[0].referenceProductName}`,
                        });
                    }
                }

                if (decomposedHits.length > 0) {
                    result = {
                        query,
                        translatedQuery: `[분해] ${analysis.decomposition.map(d => d.name).join(', ')}`,
                        groups: [],
                        hits: [...result.hits, ...decomposedHits],
                    };
                }
            }

            // Phase 2-Step 5b: 프록시 시도
            if (result.hits.length < 2 && analysis.suggestedProxy) {
                console.log(`[프록시 검색] "${query}" → proxy: "${analysis.suggestedProxy}"`);
                const proxyResult = await doSearchRequest(analysis.suggestedProxy, enhancedOptions);
                if (proxyResult.hits.length > 0) {
                    result = {
                        query,
                        translatedQuery: `[프록시] ${analysis.suggestedProxy}`,
                        groups: proxyResult.groups,
                        hits: [...result.hits, ...proxyResult.hits],
                    };
                }
            }
        }
    }

    // Intent 정보를 결과에 포함
    result.intent = intent || undefined;
    result.translatedQuery = translatedQuery;

    return result;
}

/**
 * 내부: 실제 검색 API 호출
 */
async function doSearchRequest(
    searchQuery: string,
    options?: SearchOptions
): Promise<LciSearchResult> {
    const params = new URLSearchParams();
    params.set('q', searchQuery);
    if (options?.geography) params.set('geography', options.geography);
    if (options?.unit) params.set('unit', options.unit);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.productCategory) params.set('productCategory', options.productCategory);

    try {
        const res = await fetch(`${CATALOG_API_BASE}/api/catalog/search?${params.toString()}`);
        if (!res.ok) {
            console.error('LCI Search failed:', res.status, await res.text());
            throw new Error('LCI Search failed');
        }
        const data = await res.json();

        // groups에서 hits 추출
        const hits: LciSearchItem[] = [];
        if (data.groups && Array.isArray(data.groups)) {
            for (const group of data.groups) {
                if (group.variants && Array.isArray(group.variants)) {
                    for (const variant of group.variants) {
                        hits.push({
                            id: variant.id,
                            activityName: variant.activityName,
                            referenceProductName: variant.referenceProductName,
                            canonicalProduct: variant.canonicalProduct,
                            geography: variant.geography,
                            unit: variant.unit,
                            activityUuid: variant.activityUuid,
                            productUuid: variant.productUuid,
                            priorityScore: variant.priorityScore,
                            ecoQueryUrl: variant.ecoQueryUrl,
                            techCategory: variant.techCategory,
                            processType: variant.processType,
                            materialType: variant.materialType,
                            dataQualityScore: variant.dataQualityScore,
                            isoScores: variant.isoScores,
                            productInformation: variant.productInformation
                        });
                    }
                }
            }
        }

        // data.hits도 있으면 추가 (호환성)
        if (data.hits && Array.isArray(data.hits)) {
            for (const hit of data.hits) {
                hits.push({
                    id: hit.id,
                    activityName: hit.activityName,
                    referenceProductName: hit.referenceProductName,
                    canonicalProduct: hit.canonicalProduct,
                    geography: hit.geography,
                    unit: hit.unit,
                    activityUuid: hit.activityUuid,
                    productUuid: hit.productUuid,
                    priorityScore: hit.priorityScore,
                    ecoQueryUrl: hit.ecoQueryUrl,
                    techCategory: hit.techCategory,
                    processType: hit.processType,
                    materialType: hit.materialType,
                    dataQualityScore: hit.dataQualityScore,
                    isoScores: hit.isoScores,
                    productInformation: hit.productInformation
                });
            }
        }

        return {
            query: searchQuery,
            translatedQuery: undefined,
            groups: data.groups || [],
            hits
        };
    } catch (error) {
        console.error('Error searching LCI:', error);
        return { query: searchQuery, groups: [], hits: [] };
    }
}


// ============================================================================
// 3. 추천 보고: AI의 ISO 적합성 분석 결과 전달
// ============================================================================

export interface LcaContext {
    productName?: string;
    functionalUnit?: string;
    lcaPurpose: 'pcf' | 'epd' | 'supply_chain' | 'internal' | 'regulation';
    lcaScope: 'cradle-to-gate' | 'cradle-to-grave' | 'gate-to-gate';
    preferredGeo?: string;
    preferredUnit?: string;
    materialRole?: string;
}

/**
 * 선택된 LCI 항목에 대한 상세 추천 정보 가져오기
 */
export async function fetchRecommendation(
    selectedItem: LciSearchItem,
    context: LcaContext
): Promise<LciGuideInfo> {
    try {
        const res = await fetch(`${CATALOG_API_BASE}/api/catalog/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: selectedItem.activityName,
                // Context 정보를 평탄화하여 전달
                productName: context.productName,
                functionalUnit: context.functionalUnit,
                lcaPurpose: context.lcaPurpose,
                lcaScope: context.lcaScope,
                materialRole: context.materialRole,
                geography: context.preferredGeo,
                unit: context.preferredUnit,
                targetVariant: selectedItem,
                aiProvider: 'gemini'
            })
        });

        if (!res.ok) {
            throw new Error('Recommendation fetch failed');
        }

        const data = await res.json();
        const top = data.recommendation?.top1;

        return {
            activityUuid: selectedItem.activityUuid,
            activityName: selectedItem.activityName,
            geography: selectedItem.geography,
            unit: selectedItem.unit,
            isoComplianceScore: top?.score || 3,
            recommendationReason: top?.reason || '추천 정보를 가져올 수 없습니다.',
            dataQuality: top?.detailed?.dataQuality || {
                time: 3,
                geography: 3,
                technology: 3
            },
            // [신규] ISO 점수 및 메타데이터 추가
            isoScores: selectedItem.isoScores,
            techCategory: selectedItem.techCategory,
            processType: selectedItem.processType,
            materialType: selectedItem.materialType,
            ecoQueryUrl: selectedItem.ecoQueryUrl
        };
    } catch (error) {
        console.error('Error fetching recommendation:', error);
        // 기본값 반환
        return {
            activityUuid: selectedItem.activityUuid,
            activityName: selectedItem.activityName,
            geography: selectedItem.geography,
            unit: selectedItem.unit,
            isoComplianceScore: 3,
            recommendationReason: 'AI 추천 정보를 가져올 수 없습니다.',
            dataQuality: { time: 3, geography: 3, technology: 3 },
            // fallback 시에도 기본 메타데이터는 유지
            isoScores: selectedItem.isoScores,
            techCategory: selectedItem.techCategory,
            processType: selectedItem.processType,
            materialType: selectedItem.materialType,
            ecoQueryUrl: selectedItem.ecoQueryUrl
        };
    }
}

// ============================================================================
// 4. BOM 일괄 매칭
// ============================================================================

/**
 * 한글/영문 국가명을 ecoinvent 지역 코드로 변환
 */
const GEOGRAPHY_MAPPINGS: Record<string, string> = {
    // 아시아
    '대한민국': 'KR', '한국': 'KR', 'Korea': 'KR', 'KR': 'KR',
    '중국': 'CN', 'China': 'CN', 'CN': 'CN',
    '일본': 'JP', 'Japan': 'JP', 'JP': 'JP',
    '베트남': 'VN', 'Vietnam': 'VN', 'VN': 'VN',
    '태국': 'TH', 'Thailand': 'TH', 'TH': 'TH',
    '대만': 'TW', 'Taiwan': 'TW', 'TW': 'TW',
    '인도': 'IN', 'India': 'IN', 'IN': 'IN',
    '인도네시아': 'ID', 'Indonesia': 'ID', 'ID': 'ID',
    '말레이시아': 'MY', 'Malaysia': 'MY', 'MY': 'MY',
    '싱가포르': 'SG', 'Singapore': 'SG', 'SG': 'SG',
    '필리핀': 'PH', 'Philippines': 'PH', 'PH': 'PH',

    // 북미
    '미국': 'US', 'USA': 'US', 'United States': 'US', 'US': 'US',
    '캐나다': 'CA', 'Canada': 'CA', 'CA': 'CA',
    '멕시코': 'MX', 'Mexico': 'MX', 'MX': 'MX',

    // 유럽
    '독일': 'DE', 'Germany': 'DE', 'DE': 'DE',
    '프랑스': 'FR', 'France': 'FR', 'FR': 'FR',
    '영국': 'GB', 'UK': 'GB', 'United Kingdom': 'GB', 'GB': 'GB',
    '네덜란드': 'NL', 'Netherlands': 'NL', 'NL': 'NL',
    '이탈리아': 'IT', 'Italy': 'IT', 'IT': 'IT',
    '스페인': 'ES', 'Spain': 'ES', 'ES': 'ES',
    '폴란드': 'PL', 'Poland': 'PL', 'PL': 'PL',
    '스웨덴': 'SE', 'Sweden': 'SE', 'SE': 'SE',

    // 오세아니아
    '호주': 'AU', 'Australia': 'AU', 'AU': 'AU',
    '뉴질랜드': 'NZ', 'New Zealand': 'NZ', 'NZ': 'NZ',

    // 특수 지역
    '글로벌': 'GLO', '전세계': 'GLO', 'Global': 'GLO', 'GLO': 'GLO',
    '아시아': 'RAS', 'Asia': 'RAS', 'RAS': 'RAS',
    '유럽': 'RER', 'Europe': 'RER', 'RER': 'RER',
};

/**
 * 원산지 문자열을 ecoinvent 지역코드로 변환
 */
export function mapGeographyToCode(origin: string | undefined): string | undefined {
    if (!origin) return undefined;

    const normalized = origin.trim();

    // 직접 매핑
    if (GEOGRAPHY_MAPPINGS[normalized]) {
        return GEOGRAPHY_MAPPINGS[normalized];
    }

    // 부분 일치 (예: "대한민국 서울" → "대한민국" → "KR")
    for (const [key, code] of Object.entries(GEOGRAPHY_MAPPINGS)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return code;
        }
    }

    console.warn(`지역 매핑 없음: ${origin}`);
    return undefined;
}

/**
 * 지역 폴백 순서 정의
 * 예: KR → RAS → RoW → GLO
 */
function getGeographyFallbacks(code: string): string[] {
    const asiaCountries = ['KR', 'CN', 'JP', 'VN', 'TH', 'TW', 'IN', 'ID', 'MY', 'SG', 'PH'];
    const europeCountries = ['DE', 'FR', 'GB', 'NL', 'IT', 'ES', 'PL', 'SE'];

    if (asiaCountries.includes(code)) {
        return [code, 'RAS', 'RoW', 'GLO'];
    } else if (europeCountries.includes(code)) {
        return [code, 'RER', 'RoW', 'GLO'];
    } else if (['US', 'CA', 'MX'].includes(code)) {
        return [code, 'RNA', 'RoW', 'GLO'];
    } else {
        return [code, 'RoW', 'GLO'];
    }
}

/**
 * BOM 항목들을 일괄로 LCI DB와 매칭
 * 스마트 폴백: BOM 원산지 → 프로젝트 기본 지역 → GLO
 */
export async function matchBomToLci(
    bomItems: BomItem[],
    context?: LcaContext
): Promise<BomMatchResult[]> {
    const results: BomMatchResult[] = [];
    const defaultGeo = context?.preferredGeo || 'GLO';

    for (const item of bomItems) {
        // 1. 번역
        const translatedName = await translateToEnglish(item.name);

        // 2. 원산지에서 지역 코드 추출
        const itemGeoCode = mapGeographyToCode(item.origin) || defaultGeo;
        const fallbacks = getGeographyFallbacks(itemGeoCode);

        console.log(`[${item.name}] 원산지: ${item.origin || '없음'} → 지역코드: ${itemGeoCode}, 폴백: ${fallbacks.join(' → ')}`);

        // 3. 폴백 순서대로 검색
        let topMatch: LciSearchItem | undefined;
        let searchResult: LciSearchResult | null = null;

        for (const geo of fallbacks) {
            searchResult = await searchLci(translatedName, {
                geography: geo,
                limit: 10
            });

            if (searchResult.hits.length > 0) {
                topMatch = searchResult.hits[0];
                console.log(`[${item.name}] ${geo}에서 매칭 성공: ${topMatch.activityName}`);
                break;
            }
        }

        // 4. 모든 폴백에서 실패하면 필터 없이 검색
        if (!topMatch) {
            searchResult = await searchLci(translatedName, { limit: 10 });
            topMatch = searchResult?.hits[0] || searchResult?.groups?.[0]?.topVariant;
            if (topMatch) {
                console.log(`[${item.name}] 필터 없이 매칭: ${topMatch.activityName} (${topMatch.geography})`);
            }
        }

        const alternatives = searchResult?.hits?.slice(1, 4) || [];

        // 5. 매칭 신뢰도 판정 (지역 일치 여부도 고려)
        let matchConfidence: BomMatchResult['matchConfidence'] = 'none';
        if (topMatch) {
            const score = topMatch.priorityScore || 0;
            const geoMatch = topMatch.geography === itemGeoCode;

            // 지역 일치시 신뢰도 상향
            if (score >= 50 || (score >= 30 && geoMatch)) {
                matchConfidence = 'high';
            } else if (score >= 30 || (score >= 10 && geoMatch)) {
                matchConfidence = 'medium';
            } else {
                matchConfidence = 'low';
            }
        }

        results.push({
            original: item,
            translatedName: translatedName !== item.name ? translatedName : undefined,
            matchedLci: topMatch || undefined,
            matchConfidence,
            alternatives: alternatives.length > 0 ? alternatives : undefined
        });
    }

    return results;
}

// ============================================================================
// 5. BOM 예측 (고급 기능)
// ============================================================================

/**
 * 제품명으로 일반적인 BOM 구성 추론
 * 주의: 이 결과는 참고용이며, 실제 BOM으로 보완 필수
 */
export async function predictBom(productName: string): Promise<BomItem[]> {
    // 기본 제품 카테고리별 일반적인 BOM 패턴
    const bomPatterns: Record<string, BomItem[]> = {
        '리튬이온 배터리': [
            { name: '양극재 (NMC)', quantity: 0.3, unit: 'kg' },
            { name: '음극재 (흑연)', quantity: 0.2, unit: 'kg' },
            { name: '전해질', quantity: 0.15, unit: 'kg' },
            { name: '분리막', quantity: 0.05, unit: 'kg' },
            { name: '알루미늄 포일', quantity: 0.1, unit: 'kg' },
            { name: '구리 포일', quantity: 0.1, unit: 'kg' },
            { name: '케이스 (알루미늄)', quantity: 0.1, unit: 'kg' }
        ],
        '종이컵': [
            { name: '종이', quantity: 0.01, unit: 'kg' },
            { name: 'PE 코팅', quantity: 0.002, unit: 'kg' }
        ]
    };

    // 정확히 일치하는 패턴이 있으면 반환
    if (bomPatterns[productName]) {
        return bomPatterns[productName];
    }

    // 부분 일치 검색
    for (const [pattern, bom] of Object.entries(bomPatterns)) {
        if (productName.includes(pattern) || pattern.includes(productName)) {
            return bom;
        }
    }

    // 없으면 빈 배열 반환
    console.warn(`BOM 예측 패턴 없음: ${productName}`);
    return [];
}

// ============================================================================
// Export all functions as lciClient object (optional usage)
// ============================================================================

export const lciClient = {
    translateToEnglish,
    search: searchLci,
    fetchRecommendation,
    matchBomToLci,
    predictBom
};
