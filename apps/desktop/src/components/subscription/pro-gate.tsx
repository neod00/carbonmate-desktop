// 데스크탑 앱: 라이선스 구매 = 모든 기능 활성화
// Phase 2에서 라이선스 검증과 연동
import { ReactNode } from 'react';

interface ProGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProGate({ children }: ProGateProps) {
  return <>{children}</>;
}
