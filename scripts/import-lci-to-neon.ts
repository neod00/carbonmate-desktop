/**
 * ecoinvent Database Overview v3.12 Excel → Neon Postgres 임포트 스크립트
 *
 * 사용법:
 *   1. .env.local 에 DATABASE_URL 설정
 *   2. npx tsx scripts/import-lci-to-neon.ts
 *
 * Excel 파일 위치: ../LCA Platform2/meili/data/Database Overview v3.12 (1).xlsx
 */

import * as XLSX from "xlsx";
import { neon } from "@neondatabase/serverless";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../apps/license-server/.env.local") });

const EXCEL_PATH = path.join(
    __dirname,
    "../../LCA Platform2/meili/data/Database Overview v3.12 (1).xlsx"
);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("DATABASE_URL not set in apps/license-server/.env.local");
    process.exit(1);
}

const sql = neon(DATABASE_URL);

async function createTable() {
    await sql`
        CREATE TABLE IF NOT EXISTS lci_datasets (
            id SERIAL PRIMARY KEY,
            activity_name TEXT NOT NULL,
            reference_product_name TEXT NOT NULL,
            canonical_product TEXT,
            geography VARCHAR(10) NOT NULL,
            unit VARCHAR(50),
            activity_uuid UUID,
            product_uuid UUID,
            system_model VARCHAR(20) DEFAULT 'cutoff',
            ecoinvent_version VARCHAR(10) DEFAULT '3.12',
            activity_type VARCHAR(30),
            tech_category VARCHAR(20),
            material_type VARCHAR(30),
            priority_score INTEGER DEFAULT 0,
            data_quality_score REAL,
            eco_query_url TEXT,
            product_information TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    // Full-text search 인덱스
    await sql`
        CREATE INDEX IF NOT EXISTS idx_lci_fts
        ON lci_datasets
        USING gin(to_tsvector('english', activity_name || ' ' || reference_product_name))
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_lci_geography ON lci_datasets(geography)
    `;

    console.log("Table and indexes created.");
}

function detectActivityType(activityName: string): string {
    const n = activityName.toLowerCase();
    if (n.startsWith("market for")) return "market";
    if (n.includes("transport")) return "transport";
    if (n.includes("treatment") || n.includes("waste")) return "treatment";
    if (n.includes("electricity") || n.includes("heat") || n.includes("energy")) return "energy";
    return "production";
}

function detectTechCategory(activityName: string, productName: string): string {
    const text = (activityName + " " + productName).toLowerCase();
    if (text.includes("recycl") || text.includes("secondary") || text.includes("scrap")) return "recycled";
    if (text.includes("primary") || text.includes("virgin") || text.includes("production")) return "virgin";
    if (text.includes("mix")) return "mixed";
    return "conventional";
}

function buildEcoQueryUrl(activityUuid: string | null, productUuid: string | null): string | null {
    if (!activityUuid || !productUuid) return null;
    return `https://ecoquery.ecoinvent.org/3.12/cutoff/dataset/${activityUuid}/information`;
}

function calcPriorityScore(geography: string, activityType: string): number {
    let score = 5;
    if (geography === "KR") score += 50;
    else if (geography === "GLO") score += 30;
    else if (geography === "RoW") score += 20;
    else if (geography.length === 2) score += 25;
    if (activityType === "market") score += 10;
    else if (activityType === "production") score += 8;
    return score;
}

async function importExcel() {
    console.log("Reading Excel file...");
    const wb = XLSX.readFile(EXCEL_PATH);
    // Cut-Off AO 시트 사용 (가장 일반적인 system model)
    const sheetName = wb.SheetNames.includes("Cut-Off AO") ? "Cut-Off AO" : wb.SheetNames[2];
    const ws = wb.Sheets[sheetName];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    console.log(`Sheet: "${sheetName}", Total rows: ${rows.length}`);
    console.log("Headers:", Object.keys(rows[0]).slice(0, 8));

    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const values = batch.map((row) => {
            const activityName = row["Activity Name"] || "";
            const productName = row["Reference Product Name"] || "";
            const geography = row["Geography"] || "GLO";
            const unit = row["Unit"] || "kg";
            const activityUuid = row["Activity UUID"] || null;
            const productUuid = row["Product UUID"] || null;
            const ecoQueryUrlFromExcel = row["ecoQuery URL"] || null;

            if (!activityName || !productName) return null;

            const activityType = detectActivityType(activityName);
            const techCategory = detectTechCategory(activityName, productName);
            const priorityScore = calcPriorityScore(geography, activityType);
            const ecoQueryUrl = ecoQueryUrlFromExcel || buildEcoQueryUrl(activityUuid, productUuid);
            const canonicalProduct = productName.split(",")[0].trim();
            const productInformation = (row["Product Information"] || "").slice(0, 1000) || null;

            return {
                activity_name: activityName.slice(0, 500),
                reference_product_name: productName.slice(0, 300),
                canonical_product: canonicalProduct.slice(0, 200),
                geography: geography.slice(0, 10),
                unit: unit.slice(0, 50),
                activity_uuid: activityUuid,
                product_uuid: productUuid,
                activity_type: activityType,
                tech_category: techCategory,
                priority_score: priorityScore,
                eco_query_url: ecoQueryUrl,
                product_information: productInformation,
            };
        }).filter(Boolean);

        if (values.length === 0) continue;

        // Batch insert
        for (const v of values) {
            if (!v) continue;
            try {
                await sql`
                    INSERT INTO lci_datasets (
                        activity_name, reference_product_name, canonical_product,
                        geography, unit, activity_uuid, product_uuid,
                        activity_type, tech_category, priority_score, eco_query_url,
                        product_information
                    ) VALUES (
                        ${v.activity_name}, ${v.reference_product_name}, ${v.canonical_product},
                        ${v.geography}, ${v.unit}, ${v.activity_uuid}, ${v.product_uuid},
                        ${v.activity_type}, ${v.tech_category}, ${v.priority_score}, ${v.eco_query_url},
                        ${v.product_information}
                    )
                    ON CONFLICT DO NOTHING
                `;
                inserted++;
            } catch (e) {
                // 개별 오류 무시
            }
        }

        console.log(`Progress: ${Math.min(i + batchSize, rows.length)} / ${rows.length} rows processed, ${inserted} inserted`);
    }

    console.log(`\nImport complete: ${inserted} rows inserted.`);
}

async function main() {
    await createTable();
    await importExcel();
}

main().catch(console.error);
