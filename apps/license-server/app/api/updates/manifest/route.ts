import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET() {
    try {
        const sql = neon(process.env.DATABASE_URL!);
        const rows = await sql`SELECT * FROM update_manifest ORDER BY id DESC LIMIT 1`;

        if (rows.length === 0) {
            return NextResponse.json({ version: '0.1.0', notes: '', forceUpdate: false, platforms: {} });
        }

        const row = rows[0];
        return NextResponse.json({
            version: row.version,
            notes: row.notes,
            forceUpdate: row.force_update,
            pub_date: row.updated_at,
            platforms: {
                'windows-x86_64': row.download_url ? { url: row.download_url, signature: '' } : undefined,
            },
        });
    } catch {
        return NextResponse.json({ version: '0.1.0', notes: '', forceUpdate: false, platforms: {} });
    }
}
