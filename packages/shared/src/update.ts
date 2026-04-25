/**
 * 업데이트 매니페스트 타입.
 *
 * - UpdateManifest: 앱 자체 업데이트 (Tauri updater 표준 포맷).
 * - DataManifest: LCI 카탈로그 / 배출계수 / PCR 데이터 업데이트.
 *
 * 두 채널을 분리한 이유: 데이터는 앱 재시작 없이 갱신 가능해야 하고,
 * 정부/규제 발표 시 즉시 반영해야 하는데 앱 릴리스 주기에 묶이면 안 됨.
 */

export type Platform =
  | 'windows-x86_64'
  | 'darwin-aarch64'
  | 'darwin-x86_64'
  | 'linux-x86_64';

export interface PlatformAsset {
  /** ed25519 서명 (Tauri updater가 검증) */
  signature: string;
  /** 설치파일 다운로드 URL */
  url: string;
}

export interface UpdateManifest {
  version: string;
  notes: string;
  /** ISO datetime */
  pub_date: string;
  platforms: Partial<Record<Platform, PlatformAsset>>;
}

export interface DataAsset {
  version: string;
  url: string;
  sha256: string;
  sizeBytes: number;
}

export interface DataManifest {
  /** ecoinvent Database Overview 등 LCI 카탈로그 (SQLite FTS5) */
  lciCatalog: DataAsset;
  /** 환경부/IEA/EPA 등 배출계수 (JSON) */
  emissionFactors: DataAsset;
  /** PCR 레지스트리 (JSON) */
  pcrRegistry: DataAsset;
}
