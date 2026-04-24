import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeam } from '../hooks/useTeam';

// team.vote_deadline 이 "YYYY-MM-DDTHH:MM" 또는 레거시 "HH:MM" 형식 모두 지원
function checkVotingClosed(deadline) {
  if (!deadline) return false;
  if (deadline.includes('T')) return new Date() > new Date(deadline);
  const [hh, mm] = deadline.split(':').map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return new Date() > d;
}

export default function Join() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { getTeamByCode, joinTeam, loading, error } = useTeam();

  const [team, setTeam] = useState(null);
  const [memberName, setMemberName] = useState('');
  const [fetchError, setFetchError] = useState('');

  // 초대코드로 팀 정보 미리 조회
  useEffect(() => {
    if (!code) return;
    getTeamByCode(code)
      .then(setTeam)
      .catch((err) => setFetchError(err.message));
  }, [code]); // eslint-disable-line

  const isVotingClosed = team ? checkVotingClosed(team.vote_deadline) : false;

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    try {
      await joinTeam(code, memberName.trim());
      // 투표 마감된 경우 결과 화면으로, 아니면 투표 화면으로
      navigate(isVotingClosed ? '/vote' : '/vote');
    } catch {
      // error는 useTeam에서 관리
    }
  };

  if (fetchError) {
    return (
      <Page>
        <div style={s.logoMark}>🍽️</div>
        <h1 style={s.logoText}>LunchPick</h1>
        <div style={s.card}>
          <p style={s.errorText}>❌ {fetchError}</p>
          <button style={s.btnPrimary} onClick={() => navigate('/')}>
            홈으로 돌아가기
          </button>
        </div>
      </Page>
    );
  }

  if (!team) {
    return (
      <Page>
        <div style={s.logoMark}>🍽️</div>
        <h1 style={s.logoText}>LunchPick</h1>
        <p style={s.loadingText}>팀 정보를 불러오는 중...</p>
      </Page>
    );
  }

  return (
    <Page>
      <div style={s.logoMark}>🍽️</div>
      <h1 style={s.logoText}>LunchPick</h1>

      <div style={s.card}>
        <p style={s.labelText}>초대받은 팀</p>
        <h2 style={s.teamName}>{team.name}</h2>

        {isVotingClosed && (
          <div style={s.closedNotice}>
            🔒 이 팀의 투표가 이미 마감됐어요.<br />
            이름을 입력하고 참여하면 결과를 확인할 수 있어요.
          </div>
        )}

        <form onSubmit={handleJoin} style={s.form}>
          <input
            style={s.input}
            placeholder="내 이름을 입력하세요"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            autoFocus
            required
          />
          {error && <p style={s.errMsg}>{error}</p>}
          <button style={s.btnPrimary} type="submit" disabled={loading}>
            {loading ? '참여 중...' : isVotingClosed ? '결과 확인하기' : `${team.name} 팀 참여하기`}
          </button>
        </form>
      </div>
    </Page>
  );
}

// ─── 공통 배경 wrapper (Home과 동일한 다크 테마) ───
function Page({ children }) {
  return (
    <div style={s.page}>
      <div style={s.glowOrange} aria-hidden="true" />
      <div style={s.glowPurple} aria-hidden="true" />
      <div style={s.scroll}>
        <div style={s.inner}>{children}</div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-gradient)',
    position: 'relative',
    fontFamily: 'var(--font-family)',
  },
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
  scroll: {
    position: 'relative', zIndex: 1,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1.25rem',
    boxSizing: 'border-box',
  },
  inner: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  logoMark: { fontSize: '3.2rem', lineHeight: 1, marginBottom: '0.4rem' },
  logoText: {
    margin: '0 0 1.5rem', fontSize: '2.4rem', fontWeight: '800',
    color: '#ffffff', letterSpacing: '-0.02em',
  },

  card: {
    width: '100%',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.75rem 1.5rem',
    display: 'flex', flexDirection: 'column', gap: '0',
    animation: 'fadeInUp 0.4s ease',
  },

  labelText: {
    color: 'var(--text-muted)', margin: '0 0 0.25rem', fontSize: '0.85rem',
  },
  teamName: {
    margin: '0 0 1rem', fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)',
  },

  closedNotice: {
    fontSize: '0.85rem',
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.1)',
    border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.7rem 0.9rem',
    marginBottom: '0.75rem',
    lineHeight: 1.6,
  },

  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  input: {
    padding: '0.9rem 1rem', fontSize: '1rem',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    borderRadius: '11px', color: 'var(--text-primary)', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  errMsg: { margin: 0, fontSize: '0.84rem', color: '#fca5a5' },
  errorText: {
    color: '#fca5a5', fontSize: '0.95rem', textAlign: 'center',
    marginBottom: '1rem',
  },
  loadingText: {
    color: 'var(--text-muted)', fontSize: '0.95rem',
    animation: 'pulse 1.5s infinite',
  },
  btnPrimary: {
    width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: '700',
    background: 'var(--accent-gradient)',
    color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow-orange)',
    letterSpacing: '0.01em',
  },
};
