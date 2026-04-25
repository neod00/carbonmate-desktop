import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const GMAIL_USER = process.env.GMAIL_USER || 'openbrain.main@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const DOWNLOAD_URL = 'https://github.com/neod00/carbonmate-desktop/releases/latest/download/CarbonMate_0.1.0_x64_en-US.msi';
const GUIDE_URL = 'https://carbonmate-desktop-license-server.vercel.app/guide';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
    },
});

export async function POST(req: NextRequest) {
    const auth = req.headers.get('x-admin-password');
    if (auth !== ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerName, customerEmail, licenseKey, plan } = await req.json();
    if (!customerEmail || !licenseKey) {
        return NextResponse.json({ error: 'customerEmail과 licenseKey가 필요합니다.' }, { status: 400 });
    }

    try {
        await transporter.sendMail({
            from: `CarbonMate <${GMAIL_USER}>`,
            to: customerEmail,
            subject: '[CarbonMate] 라이선스 키 및 설치 안내',
            html: buildEmailHtml({ customerName, licenseKey, plan, downloadUrl: DOWNLOAD_URL, guideUrl: GUIDE_URL }),
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Gmail 발송 실패:', error);
        return NextResponse.json({ error: '이메일 발송 실패', details: String(error) }, { status: 500 });
    }
}

function buildEmailHtml({ customerName, licenseKey, plan, downloadUrl, guideUrl }: {
    customerName: string;
    licenseKey: string;
    plan: string;
    downloadUrl: string;
    guideUrl: string;
}) {
    return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- 헤더 -->
    <div style="background:#052e16;padding:32px 40px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">🌿</span>
        <span style="font-size:22px;font-weight:700;color:#22c55e;">CarbonMate</span>
      </div>
      <p style="color:#86efac;margin:8px 0 0;font-size:14px;">제품 탄소발자국(PCF) 계산기</p>
    </div>

    <!-- 본문 -->
    <div style="padding:40px;">
      <p style="font-size:16px;color:#111;margin:0 0 8px;">안녕하세요, <strong>${customerName || '고객님'}</strong></p>
      <p style="font-size:15px;color:#444;margin:0 0 32px;line-height:1.6;">
        CarbonMate Desktop <strong>${plan === 'pro' ? 'Pro' : 'Standard'}</strong> 라이선스 구매를 감사드립니다.<br>
        아래 라이선스 키와 설치 가이드를 확인해 주세요.
      </p>

      <!-- 라이선스 키 -->
      <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:12px;padding:24px;margin-bottom:32px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:#666;">라이선스 키</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:#15803d;letter-spacing:3px;font-family:monospace;">${licenseKey}</p>
      </div>

      <!-- 설치 단계 -->
      <h3 style="font-size:15px;color:#111;margin:0 0 16px;">📦 설치 방법</h3>
      <ol style="padding-left:20px;color:#444;font-size:14px;line-height:2;">
        <li>아래 버튼을 클릭하여 <strong>.msi</strong> 설치 파일을 다운로드합니다.</li>
        <li>다운로드된 <code>.msi</code> 파일을 더블클릭하여 실행합니다.</li>
        <li>설치 마법사 안내에 따라 <strong>Next → Install → Finish</strong>를 클릭합니다.</li>
        <li>앱 실행 후 라이선스 키 입력창에 위 키를 붙여넣고 <strong>"활성화"</strong>를 클릭합니다.</li>
      </ol>

      <!-- 버튼 -->
      <div style="text-align:center;margin:32px 0;display:flex;flex-direction:column;gap:12px;align-items:center;">
        <a href="${downloadUrl}" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;min-width:220px;">
          ⬇ 설치 파일 다운로드 (.msi)
        </a>
        <a href="${guideUrl}" style="display:inline-block;background:#f0fdf4;color:#15803d;font-weight:600;font-size:14px;padding:12px 36px;border-radius:10px;text-decoration:none;border:1px solid #22c55e;min-width:220px;">
          📖 사용자 가이드 보기
        </a>
      </div>

      <!-- 주의사항 -->
      <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:16px;font-size:13px;color:#854d0e;">
        <strong>⚠ 참고사항</strong><br>
        • 라이선스 키는 1대의 PC에서만 사용 가능합니다.<br>
        • PC 교체 시 openbrain.main@gmail.com로 문의해 주세요.<br>
        • 인터넷 미연결 환경에서도 30일간 사용 가능합니다.
      </div>
    </div>

    <!-- 푸터 -->
    <div style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#999;">
        문의: <a href="mailto:openbrain.main@gmail.com" style="color:#22c55e;">openbrain.main@gmail.com</a><br>
        © 2025 CarbonMate. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
    `;
}
