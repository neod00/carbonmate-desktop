// 데스크탑 앱: 라이선스 구매 = 모든 기능 활성화
import { ReactNode } from 'react';

interface ProGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  feature?: string;
  inline?: boolean;
  featureName?: string;
  [key: string]: unknown;
}

export function ProGate({ children }: ProGateProps) {
  return <>{children}</>;
}
