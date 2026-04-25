import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

interface LciRow {
    id: number;
    activity_name: string;
    reference_product_name: string;
    canonical_product: string | null;
    geography: string;
    unit: string;
    activity_uuid: string;
    product_uuid: string | null;
    priority_score: number | null;
    eco_query_url: string | null;
    tech_category: string | null;
    activity_type: string | null;
    material_type: string | null;
    data_quality_score: number | null;
    ecoinvent_version: string;
    product_information: string | null;
}

function calculateIsoScores(row: LciRow) {
    const temporal = row.ecoinvent_version === '3.12' ? 90 : 70;
    const geo = (row.geography || '').toUpperCase();
    const geographical = geo === 'KR' ? 100 : geo === 'GLO' ? 70 : geo === 'ROW' ? 60 : 65;
    const technological = row.tech_category === 'virgin' ? 90 : row.tech_category === 'recycled' ? 85 : 70;
    const completeness = row.activity_type === 'market' ? 90 : row.activity_type === 'production' ? 85 : 75;
    const precision = Math.min(60 + (row.priority_score || 0) * 4, 100);
    const consistency = 90;
    const overall = Math.round(temporal * 0.15 + geographical * 0.25 + technological * 0.25 + completeness * 0.15 + precision * 0.10 + consistency * 0.10);
    return { temporal, geographical, technological, completeness, precision, consistency, overall };
}

function rowToHit(row: LciRow) {
    return {
        id: row.id.toString(),
        activityName: row.activity_name,
        referenceProductName: row.reference_product_name,
        canonicalProduct: row.canonical_product,
        geography: row.geography,
        unit: row.unit,
        activityUuid: row.activity_uuid,
        productUuid: row.product_uuid,
        priorityScore: row.priority_score,
        ecoQueryUrl: row.eco_query_url,
        techCategory: row.tech_category,
        processType: row.activity_type,
        materialType: row.material_type,
        dataQualityScore: row.data_quality_score,
        isoScores: calculateIsoScores(row),
        productInformation: row.product_information,
    };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const geography = searchParams.get("geography") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    if (!q.trim()) {
        return NextResponse.json({ groups: [], hits: [] }, { headers: corsHeaders });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503, headers: corsHeaders });
    }

    try {
        const sql = neon(databaseUrl);

        // 쉼표 등 특수문자 제거 후 핵심 단어 추출
        const cleanQ = q.replace(/[,;()\[\]]/g, ' ').trim();
        const terms = cleanQ.split(/\s+/).filter(t => t.length >= 2);
        if (terms.length === 0) {
            return NextResponse.json({ groups: [], hits: [] }, { headers: corsHeaders });
        }

        // plainto_tsquery: 자유 텍스트를 안전하게 FTS 쿼리로 변환
        const ftsInput = terms.slice(0, 5).join(' ');
        let rows: LciRow[] = [];

        if (geography) {
            rows = await sql`
                SELECT * FROM lci_datasets
                WHERE to_tsvector('english', activity_name || ' ' || reference_product_name) @@ plainto_tsquery('english', ${ftsInput})
                AND geography = ${geography}
                ORDER BY priority_score DESC NULLS LAST
                LIMIT ${limit}
            ` as LciRow[];
        } else {
            rows = await sql`
                SELECT * FROM lci_datasets
                WHERE to_tsvector('english', activity_name || ' ' || reference_product_name) @@ plainto_tsquery('english', ${ftsInput})
                ORDER BY priority_score DESC NULLS LAST
                LIMIT ${limit}
            ` as LciRow[];
        }

        // FTS 결과 없으면 ILIKE 폴백
        if (rows.length === 0) {
            const likePattern = `%${terms[0]}%`;
            if (geography) {
                rows = await sql`
                    SELECT * FROM lci_datasets
                    WHERE (activity_name ILIKE ${likePattern} OR reference_product_name ILIKE ${likePattern})
                    AND geography = ${geography}
                    ORDER BY priority_score DESC NULLS LAST
                    LIMIT ${limit}
                ` as LciRow[];
            } else {
                rows = await sql`
                    SELECT * FROM lci_datasets
                    WHERE activity_name ILIKE ${likePattern} OR reference_product_name ILIKE ${likePattern}
                    ORDER BY priority_score DESC NULLS LAST
                    LIMIT ${limit}
                ` as LciRow[];
            }
        }

        const hits = rows.map(rowToHit);

        // 동일 canonical_product끼리 그룹핑
        const groupMap = new Map<string, typeof hits>();
        for (const hit of hits) {
            const key = hit.canonicalProduct || hit.activityName;
            if (!groupMap.has(key)) groupMap.set(key, []);
            groupMap.get(key)!.push(hit);
        }

        const groups = Array.from(groupMap.values()).map(variants => ({
            topVariant: variants[0],
            variants,
        }));

        return NextResponse.json({ groups, hits }, { headers: corsHeaders });

    } catch (error) {
        console.error("Search error:", error);
        return NextResponse.json({ error: "Search failed", groups: [], hits: [] }, { status: 500, headers: corsHeaders });
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    if (body.q) url.searchParams.set("q", body.q);
    if (body.geography) url.searchParams.set("geography", body.geography);
    if (body.limit) url.searchParams.set("limit", body.limit.toString());
    return GET(new NextRequest(url, { method: "GET" }));
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}
