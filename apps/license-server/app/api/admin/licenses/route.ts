import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createHmac, randomBytes } from "crypto";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function checkAuth(req: NextRequest): boolean {
    const auth = req.headers.get("x-admin-password");
    return auth === ADMIN_PASSWORD;
}

function generateLicenseKey(): string {
    // CMATE-XXXX-XXXX-XXXX (영숫자 대문자)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동되는 문자 제외 (I, O, 0, 1)
    const segment = () => Array.from({ length: 4 }, () => chars[randomBytes(1)[0] % chars.length]).join("");
    return `CMATE-${segment()}-${segment()}-${segment()}`;
}

// GET /api/admin/licenses — 전체 라이선스 목록
export async function GET(req: NextRequest) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
        SELECT id, key, customer_name, customer_email, plan, status,
               machine_id, activated_at, expires_at, last_verified_at, created_at, notes
        FROM license_keys
        ORDER BY created_at DESC
    `;

    return NextResponse.json({ licenses: rows });
}

// POST /api/admin/licenses — 새 라이선스 키 발급
export async function POST(req: NextRequest) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
        customerName,
        customerEmail,
        plan = "standard",
        expiresAt = null,  // null = 영구
        notes = null,
    } = body;

    const key = generateLicenseKey();
    const sql = neon(process.env.DATABASE_URL!);

    await sql`
        INSERT INTO license_keys (key, customer_name, customer_email, plan, expires_at, notes)
        VALUES (${key}, ${customerName}, ${customerEmail}, ${plan}, ${expiresAt}, ${notes})
    `;

    return NextResponse.json({ key, customerName, customerEmail, plan }, { status: 201 });
}

// PATCH /api/admin/licenses — 상태 변경 (suspend/activate)
export async function PATCH(req: NextRequest) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key, status } = await req.json().catch(() => ({}));
    if (!key || !status) {
        return NextResponse.json({ error: "key와 status가 필요합니다." }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    await sql`UPDATE license_keys SET status = ${status} WHERE key = ${key}`;

    return NextResponse.json({ ok: true });
}
