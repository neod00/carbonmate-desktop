import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

const GMAIL_USER = process.env.GMAIL_USER || 'openbrain.main@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

interface ContactBody {
    subject: string;
    message: string;
    senderName?: string;
    senderEmail?: string;
    licenseKey?: string;
    appVersion?: string;
    machineId?: string;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
    try {
        const data = (await req.json()) as ContactBody;
        const { subject, message, senderName, senderEmail, licenseKey, appVersion, machineId } = data;

        if (!subject?.trim() || !message?.trim()) {
            return NextResponse.json({ error: '제목과 내용은 필수입니다.' }, { status: 400, headers: corsHeaders });
        }

        const safeSubject = subject.slice(0, 200);
        const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;">
  <h2 style="margin:0 0 16px;color:#15803d;">📬 CarbonMate 사용자 문의</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
    <tr><td style="padding:6px 12px;background:#f0fdf4;width:120px;">발송자</td><td style="padding:6px 12px;border-left:1px solid #d1fae5;">${escapeHtml(senderName || '(이름 없음)')} ${senderEmail ? `&lt;${escapeHtml(senderEmail)}&gt;` : ''}</td></tr>
    <tr><td style="padding:6px 12px;background:#f0fdf4;">라이선스 키</td><td style="padding:6px 12px;border-left:1px solid #d1fae5;font-family:monospace;">${escapeHtml(licenseKey || '-')}</td></tr>
    <tr><td style="padding:6px 12px;background:#f0fdf4;">앱 버전</td><td style="padding:6px 12px;border-left:1px solid #d1fae5;">${escapeHtml(appVersion || '-')}</td></tr>
    <tr><td style="padding:6px 12px;background:#f0fdf4;">머신 ID</td><td style="padding:6px 12px;border-left:1px solid #d1fae5;font-family:monospace;font-size:11px;color:#888;">${escapeHtml(machineId || '-')}</td></tr>
  </table>
  <h3 style="margin:0 0 8px;font-size:14px;color:#666;">내용</h3>
  <div style="padding:16px;background:#f9fafb;border-left:3px solid #22c55e;border-radius:4px;white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(message)}</div>
</div>
        `;

        await transporter.sendMail({
            from: `CarbonMate Contact <${GMAIL_USER}>`,
            to: GMAIL_USER,
            replyTo: senderEmail || GMAIL_USER,
            subject: `[CarbonMate 문의] ${safeSubject}`,
            html,
        });

        return NextResponse.json({ ok: true }, { headers: corsHeaders });
    } catch (error) {
        console.error('문의 발송 실패:', error);
        return NextResponse.json(
            { error: '발송 실패', details: String(error) },
            { status: 500, headers: corsHeaders }
        );
    }
}
