'use client';

import { useState, useEffect, useCallback } from 'react';

interface License {
  id: number;
  key: string;
  customer_name: string;
  customer_email: string;
  plan: string;
  status: string;
  machine_id: string | null;
  activated_at: string | null;
  expires_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  notes: string | null;
}

interface UpdateInfo {
  version: string;
  notes: string;
  forceUpdate: boolean;
  downloadUrl: string;
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px', fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', minHeight: '100vh', color: '#e5e5e5' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, borderBottom: '1px solid #2a2a2a', paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: 700, color: '#22c55e', margin: 0 },
  tabs: { display: 'flex', gap: 8, marginBottom: 24 },
  tab: { padding: '8px 20px', borderRadius: 8, border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#888', cursor: 'pointer', fontSize: 14 },
  tabActive: { padding: '8px 20px', borderRadius: 8, border: '1px solid #22c55e', background: '#052e16', color: '#22c55e', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  card: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 24, marginBottom: 24 },
  label: { display: 'block', marginBottom: 6, fontSize: 13, color: '#888' },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #2a2a2a', background: '#0f0f0f', color: '#e5e5e5', fontSize: 14, boxSizing: 'border-box' as const },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  btn: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  btnRed: { padding: '6px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12 },
  btnGray: { padding: '6px 14px', borderRadius: 6, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer', fontSize: 12 },
  btnGreen: { padding: '6px 14px', borderRadius: 6, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', fontSize: 12 },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 12px', borderBottom: '1px solid #2a2a2a', fontSize: 12, color: '#888', fontWeight: 600 },
  td: { padding: '10px 12px', borderBottom: '1px solid #1a1a1a', fontSize: 13, verticalAlign: 'top' as const },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 },
  loginBox: { maxWidth: 380, margin: '120px auto', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, padding: 40 },
  keyBox: { fontFamily: 'monospace', background: '#052e16', color: '#22c55e', padding: '12px 16px', borderRadius: 8, fontSize: 15, letterSpacing: 2, marginTop: 12 },
  alert: { background: '#1a1a1a', border: '1px solid #22c55e', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#22c55e' },
  error: { background: '#450a0a', border: '1px solid #dc2626', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#f87171' },
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [tab, setTab] = useState<'licenses' | 'update'>('licenses');

  // 라이선스
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [form, setForm] = useState({ customerName: '', customerEmail: '', plan: 'standard', expiresAt: '', notes: '' });
  const [issueError, setIssueError] = useState('');
  const [sendingEmail, setSendingEmail] = useState<string | null>(null); // key
  const [emailSent, setEmailSent] = useState<string | null>(null); // key

  // 업데이트
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ version: '', notes: '', forceUpdate: false, downloadUrl: '' });
  const [updateSaved, setUpdateSaved] = useState(false);

  const headers = { 'Content-Type': 'application/json', 'x-admin-password': pw };

  const loadLicenses = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/licenses', { headers: { 'x-admin-password': pw } });
    if (res.ok) {
      const data = await res.json();
      setLicenses(data.licenses || []);
    }
    setLoading(false);
  }, [pw]);

  useEffect(() => {
    if (authed) loadLicenses();
  }, [authed, loadLicenses]);

  const handleLogin = () => {
    if (!pw) return;
    // 비밀번호 검증은 API 호출로 확인
    fetch('/api/admin/licenses', { headers: { 'x-admin-password': pw } }).then(res => {
      if (res.ok) { setAuthed(true); setPwError(''); }
      else setPwError('비밀번호가 올바르지 않습니다.');
    });
  };

  const handleIssue = async () => {
    if (!form.customerName || !form.customerEmail) {
      setIssueError('고객명과 이메일은 필수입니다.');
      return;
    }
    setIssueError('');
    const res = await fetch('/api/admin/licenses', {
      method: 'POST', headers,
      body: JSON.stringify({ ...form, expiresAt: form.expiresAt || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewKey(data.key);
      setForm({ customerName: '', customerEmail: '', plan: 'standard', expiresAt: '', notes: '' });
      loadLicenses();
    } else {
      setIssueError(data.error || '발급 실패');
    }
  };

  const handleSendEmail = async (l: License) => {
    setSendingEmail(l.key);
    const res = await fetch('/api/admin/send-license', {
      method: 'POST', headers,
      body: JSON.stringify({ customerName: l.customer_name, customerEmail: l.customer_email, licenseKey: l.key, plan: l.plan }),
    });
    setSendingEmail(null);
    if (res.ok) { setEmailSent(l.key); setTimeout(() => setEmailSent(null), 4000); }
  };

  const handleStatus = async (key: string, status: string) => {
    await fetch('/api/admin/licenses', { method: 'PATCH', headers, body: JSON.stringify({ key, status }) });
    loadLicenses();
  };

  const handleSaveUpdate = async () => {
    const res = await fetch('/api/admin/update', {
      method: 'POST', headers,
      body: JSON.stringify(updateInfo),
    });
    if (res.ok) { setUpdateSaved(true); setTimeout(() => setUpdateSaved(false), 3000); }
  };

  const loadUpdateInfo = useCallback(async () => {
    const res = await fetch('/api/updates/manifest');
    if (res.ok) {
      const data = await res.json();
      setUpdateInfo({
        version: data.version || '',
        notes: data.notes || '',
        forceUpdate: data.forceUpdate || false,
        downloadUrl: data.platforms?.['windows-x86_64']?.url || '',
      });
    }
  }, []);

  useEffect(() => {
    if (authed && tab === 'update') loadUpdateInfo();
  }, [authed, tab, loadUpdateInfo]);

  if (!authed) {
    return (
      <div style={{ background: '#0f0f0f', minHeight: '100vh' }}>
        <div style={S.loginBox}>
          <h2 style={{ color: '#22c55e', marginTop: 0, marginBottom: 24 }}>🌿 CarbonMate 관리자</h2>
          <label style={S.label}>관리자 비밀번호</label>
          <input
            style={S.input} type="password" value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="비밀번호 입력"
          />
          {pwError && <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{pwError}</p>}
          <button style={{ ...S.btn, width: '100%', marginTop: 16 }} onClick={handleLogin}>로그인</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>🌿 CarbonMate 관리자</h1>
        <button style={S.btnGray} onClick={() => setAuthed(false)}>로그아웃</button>
      </div>

      <div style={S.tabs}>
        <button style={tab === 'licenses' ? S.tabActive : S.tab} onClick={() => setTab('licenses')}>라이선스 관리</button>
        <button style={tab === 'update' ? S.tabActive : S.tab} onClick={() => setTab('update')}>업데이트 관리</button>
      </div>

      {tab === 'licenses' && (
        <>
          {/* 발급 폼 */}
          <div style={S.card}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>새 라이선스 발급</h3>
            {issueError && <div style={S.error}>{issueError}</div>}
            {newKey && (
              <div style={S.alert}>
                발급 완료! 고객에게 아래 키를 전달하세요.
                <div style={S.keyBox}>{newKey}</div>
              </div>
            )}
            <div style={S.row}>
              <div>
                <label style={S.label}>고객명 *</label>
                <input style={S.input} value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="홍길동" />
              </div>
              <div>
                <label style={S.label}>이메일 *</label>
                <input style={S.input} value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} placeholder="hong@example.com" />
              </div>
            </div>
            <div style={S.row}>
              <div>
                <label style={S.label}>플랜</label>
                <select style={S.input} value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}>
                  <option value="standard">Standard</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div>
                <label style={S.label}>만료일 (비워두면 영구)</label>
                <input style={S.input} type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>메모</label>
              <input style={S.input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="내부 메모" />
            </div>
            <button style={S.btn} onClick={handleIssue}>키 발급</button>
          </div>

          {/* 목록 */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>라이선스 목록 ({licenses.length}개)</h3>
              <button style={S.btnGray} onClick={loadLicenses}>새로고침</button>
            </div>
            {loading ? <p style={{ color: '#888' }}>로딩 중...</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>키</th>
                      <th style={S.th}>고객</th>
                      <th style={S.th}>플랜</th>
                      <th style={S.th}>상태</th>
                      <th style={S.th}>활성화 기기</th>
                      <th style={S.th}>만료일</th>
                      <th style={S.th}>발급일</th>
                      <th style={S.th}>이메일</th>
                      <th style={S.th}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map(l => (
                      <tr key={l.id}>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12, color: '#22c55e' }}>{l.key}</td>
                        <td style={S.td}>
                          <div>{l.customer_name || '-'}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{l.customer_email || '-'}</div>
                        </td>
                        <td style={S.td}>{l.plan}</td>
                        <td style={S.td}><span style={{ ...S.badge, background: l.status === 'active' ? '#052e16' : '#450a0a', color: l.status === 'active' ? '#22c55e' : '#f87171' }}>{l.status}</span></td>
                        <td style={{ ...S.td, fontSize: 11, color: '#888', maxWidth: 140, wordBreak: 'break-all' }}>{l.machine_id ? l.machine_id.slice(0, 20) + '...' : '미활성화'}</td>
                        <td style={S.td}>{l.expires_at ? new Date(l.expires_at).toLocaleDateString('ko-KR') : '영구'}</td>
                        <td style={S.td}>{new Date(l.created_at).toLocaleDateString('ko-KR')}</td>
                        <td style={S.td}>
                          {emailSent === l.key
                            ? <span style={{ fontSize: 12, color: '#22c55e' }}>✓ 발송완료</span>
                            : <button
                                style={S.btnGreen}
                                onClick={() => handleSendEmail(l)}
                                disabled={sendingEmail === l.key || !l.customer_email}
                              >
                                {sendingEmail === l.key ? '발송중...' : '📧 발송'}
                              </button>
                          }
                        </td>
                        <td style={S.td}>
                          {l.status === 'active'
                            ? <button style={S.btnRed} onClick={() => handleStatus(l.key, 'suspended')}>정지</button>
                            : <button style={S.btnGray} onClick={() => handleStatus(l.key, 'active')}>복구</button>
                          }
                        </td>
                      </tr>
                    ))}
                    {licenses.length === 0 && (
                      <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: '#888' }}>발급된 라이선스가 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'update' && (
        <div style={S.card}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>업데이트 관리</h3>
          {updateSaved && <div style={S.alert}>저장 완료!</div>}
          <div style={S.row}>
            <div>
              <label style={S.label}>최신 버전 (예: 0.2.0)</label>
              <input style={S.input} value={updateInfo.version} onChange={e => setUpdateInfo({ ...updateInfo, version: e.target.value })} placeholder="0.1.1" />
            </div>
            <div>
              <label style={S.label}>Windows 다운로드 URL</label>
              <input style={S.input} value={updateInfo.downloadUrl} onChange={e => setUpdateInfo({ ...updateInfo, downloadUrl: e.target.value })} placeholder="https://github.com/.../releases/download/..." />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>업데이트 노트</label>
            <textarea
              style={{ ...S.input, height: 100, resize: 'vertical' }}
              value={updateInfo.notes}
              onChange={e => setUpdateInfo({ ...updateInfo, notes: e.target.value })}
              placeholder="- 버그 수정&#10;- 새 기능"
            />
          </div>
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox" id="force" checked={updateInfo.forceUpdate}
              onChange={e => setUpdateInfo({ ...updateInfo, forceUpdate: e.target.checked })}
              style={{ width: 16, height: 16 }}
            />
            <label htmlFor="force" style={{ fontSize: 14, cursor: 'pointer' }}>
              강제 업데이트 — 이전 버전 사용자는 업데이트 전까지 앱 사용 불가
            </label>
          </div>
          <button style={S.btn} onClick={handleSaveUpdate}>저장</button>
        </div>
      )}
    </div>
  );
}
