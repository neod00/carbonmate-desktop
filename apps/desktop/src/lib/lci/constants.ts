/**
 * LCI 데이터 관련 상수 정의
 */

// 지역 코드 → 한글 설명 매핑
export const GEOGRAPHY_LABELS: Record<string, string> = {
    // 주요 국가
    'KR': '한국',
    'CN': '중국',
    'JP': '일본',
    'US': '미국',
    'DE': '독일',
    'FR': '프랑스',
    'GB': '영국',
    'IN': '인도',
    'BR': '브라질',
    'AU': '호주',
    'CA': '캐나다',
    'IT': '이탈리아',
    'ES': '스페인',
    'NL': '네덜란드',
    'CH': '스위스',
    'SE': '스웨덴',
    'NO': '노르웨이',
    'FI': '핀란드',
    'DK': '덴마크',
    'PL': '폴란드',
    'TW': '대만',
    'VN': '베트남',
    'TH': '태국',
    'ID': '인도네시아',
    'MY': '말레이시아',
    'SG': '싱가포르',
    'PH': '필리핀',
    'MX': '멕시코',
    'ZA': '남아프리카',
    'RU': '러시아',

    // 지역 그룹
    'GLO': '글로벌 (전 세계 평균)',
    'RoW': '기타 세계 (Rest of World)',
    'RER': '유럽 평균',
    'RAS': '아시아 평균',
    'RNA': '북미 평균',
    'RLA': '라틴아메리카 평균',
    'RAF': '아프리카 평균',
    'EUR': '유럽 (EU 포함)',
    'ENTSO-E': '유럽 전력망',

    // 특수
    'unknown': '미지정',
};

// 지역 코드에서 한글 라벨 가져오기
export function getGeographyLabel(code: string): string {
    if (!code) return '미지정';
    return GEOGRAPHY_LABELS[code] || code;
}

// 지역 코드 포맷: "RoW" → "RoW (기타 세계)"
export function formatGeography(code: string): string {
    if (!code) return '미지정';
    const label = GEOGRAPHY_LABELS[code];
    return label ? `${code} (${label})` : code;
}

// 신뢰도 배지 정보
export const CONFIDENCE_INFO = {
    high: {
        label: '높음',
        color: 'bg-green-500/20 text-green-400 border-green-500/30',
        description: '검색 점수 ≥50 또는 지역 일치 + 점수 ≥30',
    },
    medium: {
        label: '보통',
        color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        description: '검색 점수 ≥30 또는 지역 일치 + 점수 ≥10',
    },
    low: {
        label: '낮음',
        color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        description: '검색 점수 <30 (수동 확인 권장)',
    },
    none: {
        label: '없음',
        color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        description: '매칭된 LCI 데이터 없음',
    },
};

// 신뢰도 툴팁 전체 텍스트
export const CONFIDENCE_TOOLTIP = `📌 신뢰도 기준 (BOM-LCI 매칭 정확도)

🟢 높음: 검색 점수 ≥50 또는 지역일치+점수≥30
🟡 보통: 검색 점수 ≥30 또는 지역일치+점수≥10
🟠 낮음: 그 외 (수동 확인 권장)

* 지역일치: 사용자 설정 지역과 LCI 지역 동일`;

// ISO 14044 DQI 지표 정보
export const ISO_DQI_INDICATORS = [
    { key: 'temporal', label: '시간적 대표성', weight: 0.15 },
    { key: 'geographical', label: '지리적 대표성', weight: 0.25 },
    { key: 'technological', label: '기술적 대표성', weight: 0.25 },
    { key: 'completeness', label: '완전성', weight: 0.15 },
    { key: 'precision', label: '정밀성', weight: 0.10 },
    { key: 'consistency', label: '일관성', weight: 0.10 },
] as const;
