import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
    try {
        const sql = neon(process.env.DATABASE_URL!);
        const rows = await sql`SELECT * FROM update_manifest ORDER BY id DESC LIMIT 1`;

        if (rows.length === 0) {
            return NextResponse.json(
                { version: '0.1.0', notes: '', forceUpdate: false, platforms: {} },
                { headers: corsHeaders }
            );
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
        }, { headers: corsHeaders });
    } catch {
        return NextResponse.json(
            { version: '0.1.0', notes: '', forceUpdate: false, platforms: {} },
            { headers: corsHeaders }
        );
    }
}
