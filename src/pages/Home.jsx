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

  // ─── 팀 생성 완료 화면 ───────────────────────────────────────────────────
  if (inviteLink) {
    return (
      <div style={s.bg}>
        <div style={s.glow1} />
        <div style={s.glow2} />
        <div style={{ ...s.wrap, position: 'relative' }}>
          <div style={s.logoMark}>🍽️</div>
          <h1 style={s.logoText}>LunchPick</h1>

          <div style={s.shareCard}>
            <div style={s.celebBadge}>🎉 팀 생성 완료!</div>
            <h2 style={s.shareTitle}>팀원들을 초대하세요</h2>
            <p style={s.shareDesc}>아래 링크를 공유하면 팀원이 바로 참여할 수 있어요</p>

            <div style={s.linkBox}>
              <span style={s.linkText}>{inviteLink}</span>
            </div>

            <button style={s.btnShare} onClick={handleShare}>
              📤 팀원에게 공유하기
            </button>
            <button style={s.btnCopy} onClick={copyLink}>
              {copied ? '✓ 복사됐어요!' : '🔗 링크 복사'}
            </button>

            <div style={s.divider} />

            <button style={s.btnVote} onClick={() => navigate('/vote')}>
              공유 완료 — 투표 화면으로 이동 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 메인 화면 ───────────────────────────────────────────────────────────
  return (
    <div style={s.bg}>
      <div style={s.glow1} />
      <div style={s.glow2} />

      <div style={{ ...s.wrap, position: 'relative' }}>
        {/* 로고 */}
        <div style={s.logoMark}>🍽️</div>
        <h1 style={s.logoText}>LunchPick</h1>
        <p style={s.logoSub}>팀원들과 함께, 오늘 점심을 결정해요</p>

        {/* STEP 가이드 */}
        {tab === 'select' && (
          <div style={s.steps}>
            {[
              { num: '1', icon: '👥', title: '팀 만들기', desc: '팀 이름과 내 이름으로 시작' },
              { num: '2', icon: '🔗', title: '팀원 초대', desc: '링크 공유 한 번으로 합류' },
              { num: '3', icon: '🗳️', title: '함께 투표', desc: '괜찮아요·패스로 점심 결정' },
            ].map((st) => (
              <div key={st.num} style={s.stepItem}>
                <div style={s.stepNum}>{st.num}</div>
                <div style={s.stepIcon}>{st.icon}</div>
                <div style={s.stepBody}>
                  <div style={s.stepTitle}>{st.title}</div>
                  <div style={s.stepDesc}>{st.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 버튼 선택 */}
        {tab === 'select' && (
          <div style={s.btnGroup}>
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
          <div style={s.formCard}>
            <h2 style={s.formTitle}>팀 만들기</h2>
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
              {error && <p style={s.errorMsg}>{error}</p>}
              <button style={s.btnPrimary} type="submit" disabled={loading}>
                {loading ? '생성 중...' : '팀 만들기'}
              </button>
              <button style={s.btnBack} type="button" onClick={() => setTab('select')}>
                ← 뒤로
              </button>
            </form>
          </div>
        )}

        {/* 팀 참여 폼 */}
        {tab === 'join' && (
          <div style={s.formCard}>
            <h2 style={s.formTitle}>팀 참여하기</h2>
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
              {error && <p style={s.errorMsg}>{error}</p>}
              <button style={s.btnPrimary} type="submit" disabled={loading}>
                {loading ? '참여 중...' : '참여하기'}
              </button>
              <button style={s.btnBack} type="button" onClick={() => setTab('select')}>
                ← 뒤로
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────
const s = {
  // 배경
  bg: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 55%, #1e1b4b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1.25rem',
    fontFamily: "'Segoe UI', 'Apple SD Gothic Neo', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  // 배경 발광 효과
  glow1: {
    position: 'absolute', top: '-10%', right: '-10%',
    width: '40vw', height: '40vw', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,107,53,0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  glow2: {
    position: 'absolute', bottom: '-5%', left: '-5%',
    width: '35vw', height: '35vw', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  wrap: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  // 로고
  logoMark: { fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 },
  logoText: {
    margin: '0 0 0.4rem',
    fontSize: '2.4rem',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  logoSub: {
    margin: '0 0 2.5rem',
    fontSize: '0.95rem',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },

  // STEP 가이드
  steps: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    marginBottom: '2rem',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.9rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '14px',
    padding: '0.85rem 1rem',
    backdropFilter: 'blur(10px)',
  },
  stepNum: {
    width: '26px', height: '26px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
    color: '#fff', fontSize: '0.8rem', fontWeight: '800',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepIcon: { fontSize: '1.4rem', flexShrink: 0 },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: '0.9rem', fontWeight: '700', color: '#f1f5f9', marginBottom: '0.1rem' },
  stepDesc: { fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' },

  // 버튼 그룹
  btnGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },

  // Primary 버튼 (그라디언트 오렌지)
  btnPrimary: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #ff6b35 0%, #f59e0b 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    letterSpacing: '0.01em',
    boxShadow: '0 4px 20px rgba(255,107,53,0.35)',
  },

  // Outline 버튼 (흰 테두리)
  btnOutline: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontWeight: '600',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.85)',
    border: '1.5px solid rgba(255,255,255,0.2)',
    borderRadius: '14px',
    cursor: 'pointer',
  },

  // 뒤로 버튼
  btnBack: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    padding: '0.4rem',
    alignSelf: 'center',
  },

  // 폼 카드
  formCard: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    padding: '1.75rem 1.5rem',
    backdropFilter: 'blur(12px)',
  },
  formTitle: {
    margin: '0 0 1.25rem',
    fontSize: '1.3rem',
    fontWeight: '700',
    color: '#f1f5f9',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    padding: '0.85rem 1rem',
    fontSize: '1rem',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    color: '#f1f5f9',
    outline: 'none',
  },
  errorMsg: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#fca5a5',
  },

  // ─── 초대 링크 화면 스타일 ─────────────────────────────────────────────
  shareCard: {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '22px',
    padding: '2rem 1.5rem',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  celebBadge: {
    display: 'inline-block',
    alignSelf: 'flex-start',
    background: 'linear-gradient(135deg, #ff6b35, #f59e0b)',
    color: '#fff',
    fontSize: '0.78rem',
    fontWeight: '700',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    marginBottom: '0.9rem',
    letterSpacing: '0.03em',
  },
  shareTitle: {
    margin: '0 0 0.35rem',
    fontSize: '1.4rem',
    fontWeight: '800',
    color: '#f1f5f9',
  },
  shareDesc: {
    margin: '0 0 1.25rem',
    fontSize: '0.88rem',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.5,
  },
  linkBox: {
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
  },
  linkText: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.5)',
    wordBreak: 'break-all',
    lineHeight: 1.5,
  },
  btnShare: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #ff6b35 0%, #f59e0b 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(255,107,53,0.35)',
    marginBottom: '0.6rem',
  },
  btnCopy: {
    width: '100%',
    padding: '0.85rem',
    fontSize: '0.95rem',
    fontWeight: '600',
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.8)',
    border: '1.5px solid rgba(255,255,255,0.18)',
    borderRadius: '14px',
    cursor: 'pointer',
    marginBottom: '0',
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.08)',
    margin: '1.25rem 0',
  },
  btnVote: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontWeight: '700',
    background: '#ffffff',
    color: '#1e293b',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    letterSpacing: '0.01em',
  },
};
