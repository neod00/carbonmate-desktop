import type { DataManifest } from '@lca/shared';
import { NextResponse } from 'next/server';

/**
 * GET /api/data/manifest
 *
 * 데스크탑 앱이 부팅 시 / 일 1회 폴링하여
 * 새 LCI 카탈로그 / 배출계수 / PCR 데이터가 있으면 다운로드한다.
 *
 * Phase 0 stub: 더미 버전.
 * Phase 1에서 실제 Excel→SQLite 빌드 산출물로 채움.
 */
export async function GET(): Promise<NextResponse<DataManifest>> {
  const base = process.env.DATA_BASE_URL ?? '';
  return NextResponse.json({
    lciCatalog: {
      version: 'ecoinvent-overview-v3.12',
      url: `${base}/lci-catalog-v3.12.db`,
      sha256: '',
      sizeBytes: 0,
    },
    emissionFactors: {
      version: 'kr-moe-2025',
      url: `${base}/emission-factors-2025.json`,
      sha256: '',
      sizeBytes: 0,
    },
    pcrRegistry: {
      version: 'pcr-2026-02',
      url: `${base}/pcr-registry-2026-02.json`,
      sha256: '',
      sizeBytes: 0,
    },
  });
}
