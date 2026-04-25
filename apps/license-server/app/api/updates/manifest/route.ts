import type { UpdateManifest } from '@lca/shared';
import { NextResponse } from 'next/server';

/**
 * GET /api/updates/manifest
 *
 * Tauri updater가 폴링하는 엔드포인트.
 * 이 응답 포맷은 Tauri updater 표준을 따라야 한다.
 *
 * Phase 0 stub: 빈 매니페스트.
 * Phase 2에서 GitHub Releases API와 연동하여 자동 생성.
 */
export async function GET(): Promise<NextResponse<UpdateManifest>> {
  return NextResponse.json({
    version: '0.0.0',
    notes: 'Initial scaffold — no release available.',
    pub_date: new Date().toISOString(),
    platforms: {},
  });
}
