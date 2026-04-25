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
        const rows = await sql`
            SELECT id, title, body, priority, created_at
            FROM announcements
            WHERE active = true
            ORDER BY created_at DESC
            LIMIT 50
        `;
        return NextResponse.json({ announcements: rows }, { headers: corsHeaders });
    } catch {
        return NextResponse.json({ announcements: [] }, { headers: corsHeaders });
    }
}
