// 데스크탑 앱: 라이선스 구매 = Pro 기능 항상 활성화
export function useSubscription() {
  return { isPro: true, isLoading: false };
}

export const FEATURES = {
  ADVANCED_ALLOCATION: 'advanced_allocation',
  REPORT_EXPORT: 'report_export',
  SENSITIVITY_ANALYSIS: 'sensitivity_analysis',
} as const;
