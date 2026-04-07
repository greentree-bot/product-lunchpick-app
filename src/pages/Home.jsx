import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeam } from '../hooks/useTeam';
import { storage } from '../lib/storage';

const APP_URL = 'https://lunchpick.pages.dev';

export default function Home() {
  const navigate = useNavigate();
  const { createTeam, joinTeam, loading, error } = useTeam();

  const [tab, setTab] = useState('select');
  const [teamName, setTeamName] = useState('');
  const [createName, setCreateName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const { teamId, memberName } = storage.load();
    if (teamId && memberName) navigate('/vote');
  }, [navigate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!teamName.trim() || !createName.trim()) return;
    try {
      const team = await createTeam(teamName.trim(), createName.trim());
      setInviteLink(`${APP_URL}/join/${team.invite_code}`);
    } catch {}
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim() || !joinName.trim()) return;
    try {
      await joinTeam(inviteCode.trim(), joinName.trim());
      navigate('/vote');
    } catch {}
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('아래 링크를 복사하세요:', inviteLink);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: '런치픽 팀 초대', text: '오늘 점심 같이 골라요!', url: inviteLink });
    } else {
      copyLink();
    }
  };

  // ─── 공통 배경 wrapper ──────────────────────────────────────────────────
  const Page = ({ children }) => (
    <div style={s.page}>
      {/* 장식 글로우 — pointer-events 없음, 레이아웃에 영향 없음 */}
      <div style={s.glowOrange} aria-hidden="true" />
      <div style={s.glowPurple} aria-hidden="true" />
      <div style={s.scroll}>
        <div style={s.inner}>{children}</div>
      </div>
    </div>
  );

  // ─── 팀 생성 완료 ────────────────────────────────────────────────────────
  if (inviteLink) {
    return (
      <Page>
        <div style={s.logoMark}>🍽️</div>
        <h1 style={s.logoText}>LunchPick</h1>

        <div style={s.card}>
          <span style={s.badge}>🎉 팀 생성 완료</span>
          <h2 style={s.cardTitle}>팀원들을 초대하세요</h2>
          <p style={s.cardDesc}>아래 링크를 공유하면 팀원이 바로 참여할 수 있어요</p>

          <div style={s.linkBox}>
            <p style={s.linkText}>{inviteLink}</p>
          </div>

          <button style={s.btnPrimary} onClick={handleShare}>
            📤 팀원에게 공유하기
          </button>
          <button style={s.btnOutline} onClick={copyLink}>
            {copied ? '✓ 링크 복사됨!' : '🔗 링크 복사'}
          </button>

          <div style={s.divider} />

          <button style={s.btnWhite} onClick={() => navigate('/vote')}>
            공유 완료 — 투표 화면으로 이동 →
          </button>
        </div>
      </Page>
    );
  }

  // ─── 메인 화면 ───────────────────────────────────────────────────────────
  return (
    <Page>
      <div style={s.logoMark}>🍽️</div>
      <h1 style={s.logoText}>LunchPick</h1>
      <p style={s.logoSub}>팀원들과 함께, 오늘 점심을 결정해요</p>

      {/* STEP 안내 */}
      {tab === 'select' && (
        <div style={s.steps}>
          {[
            { num: '1', icon: '👥', title: '팀 만들기',  desc: '팀 이름과 내 이름으로 시작' },
            { num: '2', icon: '🔗', title: '팀원 초대',  desc: '링크 공유 한 번으로 합류' },
            { num: '3', icon: '🗳️', title: '함께 투표', desc: '괜찮아요·패스로 점심 결정' },
          ].map((st) => (
            <div key={st.num} style={s.stepRow}>
              <div style={s.stepNum}>{st.num}</div>
              <span style={s.stepIcon}>{st.icon}</span>
              <div>
                <div style={s.stepTitle}>{st.title}</div>
                <div style={s.stepDesc}>{st.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 탭 선택 버튼 */}
      {tab === 'select' && (
        <div style={s.btnStack}>
          <button style={s.btnPrimary} onClick={() => setTab('create')}>
            팀 만들기
          </button>
          <button style={s.btnOutline} onClick={() => setTab('join')}>
            팀 참여하기
          </button>
        </div>
      )}

      {/* 팀 만들기 폼 */}
      {tab === 'create' && (
        <div style={s.card}>
          <h2 style={s.cardTitle}>팀 만들기</h2>
          <form onSubmit={handleCreate} style={s.form}>
            <input
              style={s.input}
              placeholder="팀 이름 (예: 개발팀)"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
            <input
              style={s.input}
              placeholder="내 이름"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
            />
            {error && <p style={s.errMsg}>{error}</p>}
            <button style={s.btnPrimary} type="submit" disabled={loading}>
              {loading ? '생성 중…' : '팀 만들기'}
            </button>
            <button style={s.btnBack} type="button" onClick={() => setTab('select')}>
              ← 뒤로
            </button>
          </form>
        </div>
      )}

      {/* 팀 참여 폼 */}
      {tab === 'join' && (
        <div style={s.card}>
          <h2 style={s.cardTitle}>팀 참여하기</h2>
          <form onSubmit={handleJoin} style={s.form}>
            <input
              style={s.input}
              placeholder="초대 코드 8자리"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              maxLength={8}
              required
            />
            <input
              style={s.input}
              placeholder="내 이름"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              required
            />
            {error && <p style={s.errMsg}>{error}</p>}
            <button style={s.btnPrimary} type="submit" disabled={loading}>
              {loading ? '참여 중…' : '참여하기'}
            </button>
            <button style={s.btnBack} type="button" onClick={() => setTab('select')}>
              ← 뒤로
            </button>
          </form>
        </div>
      )}

      {/* CSS hack: placeholder 색상 */}
      <style>{`
        input::placeholder { color: rgba(255,255,255,0.35); }
        input { caret-color: #ff6b35; }
      `}</style>
    </Page>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────
const s = {
  /* 최외곽 — 다크 그라디언트, 높이 100vh 고정 */
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(155deg, #0f172a 0%, #1e293b 55%, #1e1b4b 100%)',
    position: 'relative',
    fontFamily: "'Segoe UI', 'Apple SD Gothic Neo', sans-serif",
  },

  /* 글로우 — position:fixed 로 레이아웃에 무관 */
  glowOrange: {
    position: 'fixed', top: '-8%', right: '-8%',
    width: '45vw', height: '45vw', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,107,53,0.18) 0%, transparent 65%)',
    pointerEvents: 'none', zIndex: 0,
  },
  glowPurple: {
    position: 'fixed', bottom: '-8%', left: '-8%',
    width: '40vw', height: '40vw', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 65%)',
    pointerEvents: 'none', zIndex: 0,
  },

  /* 스크롤 영역 */
  scroll: {
    position: 'relative', zIndex: 1,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1.25rem',
    boxSizing: 'border-box',
  },

  /* 콘텐츠 최대 너비 */
  inner: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  /* 로고 */
  logoMark: { fontSize: '3.2rem', lineHeight: 1, marginBottom: '0.4rem' },
  logoText: {
    margin: '0 0 0.4rem', fontSize: '2.4rem', fontWeight: '800',
    color: '#ffffff', letterSpacing: '-0.02em',
  },
  logoSub: {
    margin: '0 0 2.5rem', fontSize: '0.95rem',
    color: 'rgba(255,255,255,0.5)', textAlign: 'center',
  },

  /* STEP 리스트 */
  steps: {
    width: '100%', display: 'flex', flexDirection: 'column',
    gap: '0.55rem', marginBottom: '2rem',
  },
  stepRow: {
    display: 'flex', alignItems: 'center', gap: '0.85rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '14px', padding: '0.85rem 1rem',
  },
  stepNum: {
    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg,#ff6b35,#f59e0b)',
    color: '#fff', fontSize: '0.8rem', fontWeight: '800',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  stepIcon: { fontSize: '1.35rem', flexShrink: 0 },
  stepTitle: { fontSize: '0.9rem', fontWeight: '700', color: '#f1f5f9', marginBottom: '0.1rem' },
  stepDesc:  { fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)' },

  /* 버튼 묶음 */
  btnStack: {
    width: '100%', display: 'flex', flexDirection: 'column', gap: '0.7rem',
  },

  /* 카드 (폼 + 공유 화면) */
  card: {
    width: '100%',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '20px',
    padding: '1.75rem 1.5rem',
    display: 'flex', flexDirection: 'column', gap: '0',
  },
  badge: {
    display: 'inline-block', alignSelf: 'flex-start',
    background: 'linear-gradient(135deg,#ff6b35,#f59e0b)',
    color: '#fff', fontSize: '0.75rem', fontWeight: '700',
    padding: '0.22rem 0.7rem', borderRadius: '999px',
    marginBottom: '0.85rem', letterSpacing: '0.04em',
  },
  cardTitle: {
    margin: '0 0 0.35rem', fontSize: '1.35rem',
    fontWeight: '800', color: '#f1f5f9',
  },
  cardDesc: {
    margin: '0 0 1.25rem', fontSize: '0.87rem',
    color: 'rgba(255,255,255,0.48)', lineHeight: 1.55,
  },

  /* 초대 링크 박스 */
  linkBox: {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', padding: '0.7rem 1rem',
    marginBottom: '1rem',
  },
  linkText: {
    margin: 0, fontSize: '0.76rem',
    color: 'rgba(255,255,255,0.45)', wordBreak: 'break-all', lineHeight: 1.55,
  },

  /* 구분선 */
  divider: {
    height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1.1rem 0',
  },

  /* ─ 버튼들 ─ */
  btnPrimary: {
    width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: '700',
    background: 'linear-gradient(135deg,#ff6b35 0%,#f59e0b 100%)',
    color: '#fff', border: 'none', borderRadius: '14px',
    cursor: 'pointer', marginBottom: '0.6rem',
    boxShadow: '0 4px 18px rgba(255,107,53,0.38)',
    letterSpacing: '0.01em',
  },
  btnOutline: {
    width: '100%', padding: '0.9rem', fontSize: '0.97rem', fontWeight: '600',
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.85)',
    border: '1.5px solid rgba(255,255,255,0.22)',
    borderRadius: '14px', cursor: 'pointer', marginBottom: '0',
  },
  btnWhite: {
    width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: '700',
    background: '#ffffff', color: '#1e293b',
    border: 'none', borderRadius: '14px', cursor: 'pointer',
    letterSpacing: '0.01em',
  },
  btnBack: {
    background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.38)', fontSize: '0.9rem',
    cursor: 'pointer', padding: '0.5rem', marginTop: '0.1rem', alignSelf: 'center',
  },

  /* 폼 */
  form: { display: 'flex', flexDirection: 'column', gap: '0.7rem', marginTop: '1.1rem' },
  input: {
    padding: '0.9rem 1rem', fontSize: '1rem',
    background: 'rgba(255,255,255,0.09)',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: '11px', color: '#f1f5f9', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  errMsg: { margin: 0, fontSize: '0.84rem', color: '#fca5a5' },
};
