import type { VerifyRequest, VerifyResponse } from '@lca/shared';
import { NextResponse } from 'next/server';

/**
 * POST /api/license/verify
 *
 * 데스크탑 앱이 부팅 시 / 주기적으로 호출하는 검증 엔드포인트.
 *
 * Phase 0 stub: 항상 valid=false 반환.
 * Phase 2에서 Neon Postgres 조회 + HMAC 서명 응답 구현 예정.
 */
export async function POST(req: Request): Promise<NextResponse<VerifyResponse>> {
  const body = (await req.json()) as VerifyRequest;

  // TODO(Phase 2): Neon에서 라이선스 조회, 만료/머신 바인딩 검증, HMAC 서명
  void body;

  return NextResponse.json({
    valid: false,
    reason: 'unknown-key',
  });
}
