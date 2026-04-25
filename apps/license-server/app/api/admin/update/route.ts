import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export async function POST(req: NextRequest) {
    const auth = req.headers.get('x-admin-password');
    if (auth !== ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { version, notes, forceUpdate, downloadUrl } = await req.json();

    const sql = neon(process.env.DATABASE_URL!);

    await sql`
        CREATE TABLE IF NOT EXISTS update_manifest (
            id SERIAL PRIMARY KEY,
            version VARCHAR(20) NOT NULL,
            notes TEXT,
            force_update BOOLEAN DEFAULT false,
            download_url TEXT,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;

    await sql`
        INSERT INTO update_manifest (version, notes, force_update, download_url)
        VALUES (${version}, ${notes}, ${forceUpdate}, ${downloadUrl})
    `;

    return NextResponse.json({ ok: true });
}
