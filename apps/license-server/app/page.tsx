export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '64px auto', padding: '0 24px' }}>
      <h1>CarbonMate License Server</h1>
      <p>This is the backend for CarbonMate Desktop. There is nothing to see here.</p>
      <ul>
        <li>
          <code>POST /api/license/verify</code> — 라이선스 검증
        </li>
        <li>
          <code>GET /api/updates/manifest</code> — 앱 업데이트 매니페스트
        </li>
        <li>
          <code>GET /api/data/manifest</code> — 데이터(LCI/계수) 매니페스트
        </li>
      </ul>
    </main>
  );
}
