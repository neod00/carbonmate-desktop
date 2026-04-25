import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

const OFFLINE_GRACE_DAYS = 30;

export async function POST(req: NextRequest) {
    const { key, machineId } = await req.json().catch(() => ({}));

    if (!key || !machineId) {
        return NextResponse.json(
            { valid: false, reason: "key와 machineId가 필요합니다." },
            { status: 400, headers: corsHeaders }
        );
    }

    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
        SELECT * FROM license_keys WHERE key = ${key} LIMIT 1
    `;

    if (rows.length === 0) {
        return NextResponse.json(
            { valid: false, reason: "유효하지 않은 라이선스 키입니다." },
            { headers: corsHeaders }
        );
    }

    const license = rows[0];

    if (license.status !== "active") {
        return NextResponse.json(
            { valid: false, reason: `라이선스가 ${license.status} 상태입니다.` },
            { headers: corsHeaders }
        );
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
        return NextResponse.json(
            { valid: false, reason: "라이선스가 만료되었습니다." },
            { headers: corsHeaders }
        );
    }

    // 다른 기기에서 이미 활성화된 경우
    if (license.machine_id && license.machine_id !== machineId) {
        return NextResponse.json(
            { valid: false, reason: "다른 기기에서 이미 활성화된 라이선스입니다." },
            { headers: corsHeaders }
        );
    }

    // 처음 검증 시 기기 등록
    if (!license.machine_id) {
        await sql`
            UPDATE license_keys
            SET machine_id = ${machineId}, activated_at = NOW(), last_verified_at = NOW()
            WHERE key = ${key}
        `;
    } else {
        await sql`
            UPDATE license_keys SET last_verified_at = NOW() WHERE key = ${key}
        `;
    }

    return NextResponse.json({
        valid: true,
        plan: license.plan,
        customerName: license.customer_name,
        expiresAt: license.expires_at,
        offlineGraceDays: OFFLINE_GRACE_DAYS,
    }, { headers: corsHeaders });
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}
