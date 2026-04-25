import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const GMAIL_USER = process.env.GMAIL_USER || 'openbrain.main@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const DOWNLOAD_URL = 'https://github.com/neod00/carbonmate-desktop/releases/latest/download/CarbonMate_0.1.0_x64_en-US.msi';

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
            html: buildEmailHtml({ customerName, licenseKey, plan, downloadUrl: DOWNLOAD_URL }),
            attachments: [
                {
                    filename: 'CarbonMate_사용자가이드.html',
                    content: buildGuideHtml(),
                    contentType: 'text/html; charset=utf-8',
                },
            ],
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Gmail 발송 실패:', error);
        return NextResponse.json({ error: '이메일 발송 실패', details: String(error) }, { status: 500 });
    }
}

function buildEmailHtml({ customerName, licenseKey, plan, downloadUrl }: {
    customerName: string;
    licenseKey: string;
    plan: string;
    downloadUrl: string;
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
        아래 라이선스 키와 첨부된 사용자 가이드를 확인해 주세요.
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
      <div style="text-align:center;margin:32px 0;">
        <a href="${downloadUrl}" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">
          ⬇ 설치 파일 다운로드 (.msi)
        </a>
      </div>

      <!-- 가이드 안내 -->
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;font-size:13px;color:#166534;margin-bottom:16px;">
        <strong>📎 첨부파일 안내</strong><br>
        이 이메일에 <strong>CarbonMate_사용자가이드.html</strong> 파일이 첨부되어 있습니다.<br>
        다운로드 후 브라우저로 열면 설치 방법 및 앱 사용법을 확인할 수 있습니다.
      </div>

      <!-- 주의사항 -->
      <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:16px;font-size:13px;color:#854d0e;">
        <strong>⚠ 참고사항</strong><br>
        • 라이선스 키는 1대의 PC에서만 사용 가능합니다.<br>
        • PC 교체 시 openbrain.main@gmail.com으로 문의해 주세요.<br>
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

function buildGuideHtml(): string {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CarbonMate 사용자 가이드</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; color: #333; }
  .wrap { max-width: 720px; margin: 0 auto; background: #fff; min-height: 100vh; }
  header { background: #052e16; padding: 32px 40px; }
  header .logo { display: flex; align-items: center; gap: 12px; }
  header .logo span { font-size: 22px; font-weight: 700; color: #22c55e; }
  header p { color: #86efac; margin-top: 6px; font-size: 14px; }
  nav { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 20px 40px; }
  nav p { font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  nav ol { padding-left: 18px; line-height: 2.2; font-size: 15px; }
  nav a { color: #15803d; text-decoration: none; }
  nav a:hover { text-decoration: underline; }
  .content { padding: 20px 40px 60px; }
  section { margin-top: 40px; }
  h2 { font-size: 18px; font-weight: 700; color: #052e16; border-bottom: 2px solid #22c55e; padding-bottom: 8px; margin-bottom: 20px; }
  h3 { font-size: 15px; font-weight: 600; color: #15803d; margin: 20px 0 8px; }
  ol, ul { padding-left: 20px; color: #444; font-size: 14px; line-height: 2; margin-bottom: 16px; }
  .note { background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #854d0e; margin-bottom: 16px; }
  .faq-item { margin-bottom: 20px; }
  .faq-item .q { font-weight: 600; color: #111; font-size: 15px; margin-bottom: 4px; }
  .faq-item .a { color: #555; font-size: 14px; line-height: 1.7; padding-left: 16px; }
  footer { background: #f9f9f9; border-top: 1px solid #eee; padding: 24px 40px; text-align: center; }
  footer p { font-size: 12px; color: #999; }
  code { background: #f3f4f6; padding: 1px 6px; border-radius: 4px; font-size: 13px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo"><span>🌿 CarbonMate</span></div>
    <p>사용자 가이드 v0.1</p>
  </header>

  <nav>
    <p>목차</p>
    <ol>
      <li><a href="#s1">설치 방법</a></li>
      <li><a href="#s2">라이선스 활성화</a></li>
      <li><a href="#s3">PCF 계산 사용 방법</a></li>
      <li><a href="#s4">프로젝트 저장 / 불러오기</a></li>
      <li><a href="#s5">FAQ</a></li>
      <li><a href="#s6">문의 및 지원</a></li>
    </ol>
  </nav>

  <div class="content">

    <section id="s1">
      <h2>1. 설치 방법</h2>
      <ol>
        <li>이메일의 <strong>설치 파일 다운로드</strong> 버튼 클릭 → <code>CarbonMate_x64_en-US.msi</code> 다운로드</li>
        <li>다운로드된 <code>.msi</code> 파일 더블클릭</li>
        <li>설치 마법사 안내에 따라 <strong>Next → Install → Finish</strong></li>
        <li>바탕화면 또는 시작 메뉴에서 <strong>CarbonMate</strong> 실행</li>
      </ol>
      <div class="note">⚠ Windows SmartScreen 경고가 뜨면 <strong>추가 정보</strong> → <strong>실행</strong>을 클릭하세요.</div>
    </section>

    <section id="s2">
      <h2>2. 라이선스 활성화</h2>
      <ol>
        <li>앱 첫 실행 시 라이선스 키 입력 화면이 표시됩니다</li>
        <li>이메일로 받은 라이선스 키(<code>CMATE-XXXX-XXXX-XXXX</code>)를 붙여넣기</li>
        <li><strong>활성화</strong> 버튼 클릭</li>
        <li>활성화는 인터넷 연결이 필요합니다 (최초 1회)</li>
      </ol>
      <div class="note">⚠ 활성화 후 <strong>30일간 오프라인 사용</strong>이 가능합니다.</div>
    </section>

    <section id="s3">
      <h2>3. PCF 계산 사용 방법</h2>

      <h3>3-1. 제품 기본 정보 입력</h3>
      <ul>
        <li>제품명, 기능 단위(Functional Unit), 시스템 경계 설정</li>
        <li>시스템 경계: 요람에서 문까지(Cradle-to-Gate) / 요람에서 무덤까지(Cradle-to-Grave) 선택</li>
      </ul>

      <h3>3-2. 공정 단계 추가</h3>
      <ul>
        <li><strong>단계 추가</strong> 버튼으로 원자재 조달 / 제조 / 운송 등 단계 구성</li>
        <li>각 단계에 활동 데이터(Activity Data) 입력</li>
      </ul>

      <h3>3-3. LCI 데이터베이스 검색</h3>
      <ul>
        <li>각 활동에 소재명 또는 공정명을 한국어/영어로 검색</li>
        <li>Ecoinvent 기반 26,000+ 항목 제공</li>
        <li>검색 결과에서 적합한 항목 선택 → 배출계수 자동 적용</li>
      </ul>

      <h3>3-4. AI 추천</h3>
      <ul>
        <li>검색어 입력 시 <strong>AI 추천</strong> 버튼으로 ISO 14040/14044/14067 기준 최적 항목 추천</li>
        <li>추천 이유(Justification) 확인 후 적용 여부 결정</li>
      </ul>

      <h3>3-5. 결과 확인</h3>
      <ul>
        <li>전체 PCF 결과(kgCO₂eq) 및 단계별 기여도 확인</li>
        <li>결과 리포트 내보내기(PDF/Excel) — Pro 플랜</li>
      </ul>
    </section>

    <section id="s4">
      <h2>4. 프로젝트 저장 / 불러오기</h2>
      <ul>
        <li><strong>저장</strong>: 상단 저장 버튼 → <code>.carbonmate</code> 파일로 로컬 저장</li>
        <li><strong>불러오기</strong>: 상단 열기 버튼 → 저장된 <code>.carbonmate</code> 파일 선택</li>
        <li>앱 종료 시 자동저장되어 재실행 시 마지막 상태 복원</li>
      </ul>
    </section>

    <section id="s5">
      <h2>5. FAQ</h2>
      <div class="faq-item">
        <p class="q">Q. 라이선스 키를 분실했습니다.</p>
        <p class="a">A. 구매 시 받은 이메일을 확인해 주세요. 이메일도 없는 경우 openbrain.main@gmail.com으로 문의해 주세요.</p>
      </div>
      <div class="faq-item">
        <p class="q">Q. PC를 교체했는데 활성화가 안 됩니다.</p>
        <p class="a">A. 라이선스는 1대의 PC에만 등록됩니다. PC 교체 시 openbrain.main@gmail.com으로 문의해 주시면 재등록해 드립니다.</p>
      </div>
      <div class="faq-item">
        <p class="q">Q. 인터넷이 없는 환경에서도 쓸 수 있나요?</p>
        <p class="a">A. 네, 마지막 온라인 인증으로부터 30일간 오프라인 사용이 가능합니다.</p>
      </div>
      <div class="faq-item">
        <p class="q">Q. Windows SmartScreen 경고가 뜹니다.</p>
        <p class="a">A. <strong>추가 정보</strong> 클릭 → <strong>실행</strong> 클릭하시면 정상 설치됩니다. CarbonMate는 안전한 소프트웨어입니다.</p>
      </div>
      <div class="faq-item">
        <p class="q">Q. 지원하는 OS는?</p>
        <p class="a">A. 현재 Windows 10/11 (64bit)만 지원합니다. Mac 버전은 추후 출시 예정입니다.</p>
      </div>
    </section>

    <section id="s6">
      <h2>6. 문의 및 지원</h2>
      <ul>
        <li>이메일: openbrain.main@gmail.com</li>
        <li>업무시간: 평일 09:00 ~ 18:00 (KST)</li>
      </ul>
    </section>

  </div>

  <footer>
    <p>© 2025 CarbonMate. All rights reserved.</p>
  </footer>
</div>
</body>
</html>`;
}
