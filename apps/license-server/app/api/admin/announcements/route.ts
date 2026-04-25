import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function ensureTable() {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
        CREATE TABLE IF NOT EXISTS announcements (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            body TEXT NOT NULL,
            priority VARCHAR(20) DEFAULT 'info',
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;
    return sql;
}

function checkAuth(req: NextRequest) {
    return req.headers.get('x-admin-password') === ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
    if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sql = await ensureTable();
    const rows = await sql`SELECT * FROM announcements ORDER BY created_at DESC`;
    return NextResponse.json({ announcements: rows });
}

export async function POST(req: NextRequest) {
    if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { title, body, priority } = await req.json();
    if (!title || !body) {
        return NextResponse.json({ error: 'title과 body는 필수입니다.' }, { status: 400 });
    }
    const sql = await ensureTable();
    const rows = await sql`
        INSERT INTO announcements (title, body, priority)
        VALUES (${title}, ${body}, ${priority || 'info'})
        RETURNING *
    `;
    return NextResponse.json({ announcement: rows[0] });
}

export async function PATCH(req: NextRequest) {
    if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, title, body, priority, active } = await req.json();
    if (!id) return NextResponse.json({ error: 'id는 필수입니다.' }, { status: 400 });
    const sql = await ensureTable();
    const rows = await sql`
        UPDATE announcements SET
            title = COALESCE(${title ?? null}, title),
            body = COALESCE(${body ?? null}, body),
            priority = COALESCE(${priority ?? null}, priority),
            active = COALESCE(${active ?? null}, active),
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
    `;
    return NextResponse.json({ announcement: rows[0] });
}

export async function DELETE(req: NextRequest) {
    if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id는 필수입니다.' }, { status: 400 });
    const sql = await ensureTable();
    await sql`DELETE FROM announcements WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
}
