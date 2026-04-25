export const metadata = {
  title: 'CarbonMate 사용자 가이드',
  description: 'CarbonMate Desktop 설치 및 사용 방법 안내',
};

export default function GuidePage() {
  return (
    <div style={{ margin: 0, padding: 0, background: '#f5f5f5', fontFamily: 'system-ui,-apple-system,sans-serif', minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 0 60px' }}>

        {/* 헤더 */}
        <div style={{ background: '#052e16', padding: '32px 40px', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/carbonmate-logo.png" alt="CarbonMate" style={{ height: 36, width: 36 }} />
            <span style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>CarbonMate</span>
          </div>
          <p style={{ color: '#86efac', margin: '6px 0 0', fontSize: 14 }}>사용자 가이드 v0.1</p>
        </div>

        {/* 목차 */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '24px 40px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>목차</p>
          <ol style={{ margin: 0, padding: '0 0 0 18px', lineHeight: 2.2, fontSize: 15 }}>
            {['설치 방법', '라이선스 활성화', 'PCF 계산 사용 방법', '프로젝트 저장 / 불러오기', 'FAQ', '문의 및 지원'].map((t, i) => (
              <li key={i}><a href={`#section-${i + 1}`} style={{ color: '#15803d', textDecoration: 'none' }}>{t}</a></li>
            ))}
          </ol>
        </div>

        <div style={{ padding: '0 40px' }}>

          {/* Section 1 */}
          <Section id="section-1" title="1. 설치 방법">
            <Steps items={[
              '이메일의 설치 파일 다운로드 버튼 클릭 → CarbonMate_x64_en-US.msi 다운로드',
              '다운로드된 .msi 파일 더블클릭',
              '설치 마법사 안내에 따라 Next → Install → Finish',
              '바탕화면 또는 시작 메뉴에서 CarbonMate 실행',
            ]} />
            <Note>Windows SmartScreen 경고가 뜨면 <b>추가 정보</b> → <b>실행</b>을 클릭하세요.</Note>
          </Section>

          {/* Section 2 */}
          <Section id="section-2" title="2. 라이선스 활성화">
            <Steps items={[
              '앱 첫 실행 시 라이선스 키 입력 화면이 표시됩니다',
              '이메일로 받은 라이선스 키(CMATE-XXXX-XXXX-XXXX)를 붙여넣기',
              '활성화 버튼 클릭',
              '활성화는 인터넷 연결이 필요합니다 (최초 1회)',
            ]} />
            <Note>활성화 후 <b>30일간 오프라인 사용</b>이 가능합니다.</Note>
          </Section>

          {/* Section 3 */}
          <Section id="section-3" title="3. PCF 계산 사용 방법">
            <SubSection title="3-1. 제품 기본 정보 입력">
              <Bullets items={[
                '제품명, 기능 단위(Functional Unit), 시스템 경계 설정',
                '시스템 경계: 요람에서 문까지(Cradle-to-Gate) / 요람에서 무덤까지(Cradle-to-Grave) 선택',
              ]} />
            </SubSection>
            <SubSection title="3-2. 공정 단계 추가">
              <Bullets items={[
                '단계 추가 버튼으로 원자재 조달 / 제조 / 운송 등 단계 구성',
                '각 단계에 활동 데이터(Activity Data) 입력',
              ]} />
            </SubSection>
            <SubSection title="3-3. LCI 데이터베이스 검색">
              <Bullets items={[
                '각 활동에 소재명 또는 공정명을 한국어/영어로 검색',
                'Ecoinvent 기반 26,000+ 항목 제공',
                '검색 결과에서 적합한 항목 선택 → 배출계수 자동 적용',
              ]} />
            </SubSection>
            <SubSection title="3-4. AI 추천">
              <Bullets items={[
                '검색어 입력 시 AI 추천 버튼으로 ISO 14040/14044/14067 기준 최적 항목 추천',
                '추천 이유(Justification) 확인 후 적용 여부 결정',
              ]} />
            </SubSection>
            <SubSection title="3-5. 결과 확인">
              <Bullets items={[
                '전체 PCF 결과(kgCO₂eq) 및 단계별 기여도 확인',
                '결과 리포트 내보내기(PDF/Excel) — Pro 플랜',
              ]} />
            </SubSection>
          </Section>

          {/* Section 4 */}
          <Section id="section-4" title="4. 프로젝트 저장 / 불러오기">
            <Bullets items={[
              '저장: 상단 저장 버튼 → .carbonmate 파일로 로컬 저장',
              '불러오기: 상단 열기 버튼 → 저장된 .carbonmate 파일 선택',
              '앱 종료 시 자동저장되어 재실행 시 마지막 상태 복원',
            ]} />
          </Section>

          {/* Section 5 */}
          <Section id="section-5" title="5. FAQ">
            {[
              ['라이선스 키를 분실했습니다.', '구매 시 받은 이메일을 확인해 주세요. 이메일도 없는 경우 openbrain.main@gmail.com으로 문의해 주세요.'],
              ['PC를 교체했는데 활성화가 안 됩니다.', '라이선스는 1대의 PC에만 등록됩니다. PC 교체 시 openbrain.main@gmail.com으로 문의해 주시면 재등록해 드립니다.'],
              ['인터넷이 없는 환경에서도 쓸 수 있나요?', '네, 마지막 온라인 인증으로부터 30일간 오프라인 사용이 가능합니다.'],
              ['Windows SmartScreen 경고가 뜹니다.', '추가 정보 클릭 → 실행 클릭하시면 정상 설치됩니다. CarbonMate는 안전한 소프트웨어입니다.'],
              ['지원하는 OS는?', '현재 Windows 10/11 (64bit)만 지원합니다. Mac 버전은 추후 출시 예정입니다.'],
            ].map(([q, a], i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#111', fontSize: 15 }}>Q. {q}</p>
                <p style={{ margin: 0, color: '#555', fontSize: 14, lineHeight: 1.7, paddingLeft: 16 }}>A. {a}</p>
              </div>
            ))}
          </Section>

          {/* Section 6 */}
          <Section id="section-6" title="6. 문의 및 지원">
            <Bullets items={[
              '이메일: openbrain.main@gmail.com',
              '업무시간: 평일 09:00 ~ 18:00 (KST)',
            ]} />
          </Section>

        </div>

        {/* 푸터 */}
        <div style={{ background: '#f9f9f9', borderTop: '1px solid #eee', padding: '24px 40px', textAlign: 'center', marginTop: 40 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#999' }}>© 2025 CarbonMate. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#052e16', borderBottom: '2px solid #22c55e', paddingBottom: 8, marginBottom: 20 }}>{title}</h2>
      {children}
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#15803d', margin: '0 0 8px' }}>{title}</h3>
      {children}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol style={{ paddingLeft: 20, margin: '0 0 16px', color: '#444', fontSize: 14, lineHeight: 2 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ol>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 20, margin: '0 0 16px', color: '#444', fontSize: 14, lineHeight: 2 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#854d0e', marginBottom: 16 }}>
      ⚠ {children}
    </div>
  );
}
