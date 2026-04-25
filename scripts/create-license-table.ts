/**
 * license_keys 테이블 생성
 * npx tsx scripts/create-license-table.ts
 */
import { neon } from "@neondatabase/serverless";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../apps/license-server/.env.local") });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
    await sql`
        CREATE TABLE IF NOT EXISTS license_keys (
            id SERIAL PRIMARY KEY,
            key VARCHAR(24) NOT NULL UNIQUE,          -- CMATE-XXXX-XXXX-XXXX
            customer_name VARCHAR(200),
            customer_email VARCHAR(200),
            plan VARCHAR(20) DEFAULT 'standard',       -- standard | pro
            status VARCHAR(20) DEFAULT 'active',       -- active | suspended | expired
            machine_id VARCHAR(200),                   -- 활성화된 기기 ID
            activated_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,                    -- NULL = 영구
            last_verified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            notes TEXT
        )
    `;
    console.log("✅ license_keys 테이블 생성 완료");

    await sql`
        CREATE INDEX IF NOT EXISTS idx_license_key ON license_keys(key)
    `;
    console.log("✅ 인덱스 생성 완료");
}

main().catch(console.error);
