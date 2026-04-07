import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeam } from '../hooks/useTeam';
import { storage } from '../lib/storage';

const APP_URL = 'https://lunchpick.pages.dev';

export default function Home() {
  const navigate = useNavigate();
  const { createTeam, joinTeam, loading, error } = useTeam();

  // 탭: 'select' | 'create' | 'join'
  const [tab, setTab] = useState('select');

  // 팀 만들기 폼
  const [teamName, setTeamName] = useState('');
  const [createName, setCreateName] = useState('');

  // 팀 참여 폼
  const [inviteCode, setInviteCode] = useState('');
  const [joinName, setJoinName] = useState('');

  // 생성 완료 후 초대 링크 표시
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  // localStorage에 이미 팀이 있으면 /vote로 이동
  useEffect(() => {
    const { teamId, memberName } = storage.load();
    if (teamId && memberName) navigate('/vote');
  }, [navigate]);


  // ─── 팀 만들기 ────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!teamName.trim() || !createName.trim()) return;
    try {
      const team = await createTeam(teamName.trim(), createName.trim());
      const link = `${APP_URL}/join/${team.invite_code}`;
      setInviteLink(link);
    } catch {
      // error는 useTeam에서 관리
    }
  };

  // ─── 팀 참여 ────────────────────────────────────────────────────────────
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim() || !joinName.trim()) return;
    try {
      await joinTeam(inviteCode.trim(), joinName.trim());
      navigate('/vote');
    } catch {
      // error는 useTeam에서 관리
    }
  };

  // ─── 링크 복사 ────────────────────────────────────────────────────────────
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('아래 링크를 복사하세요:', inviteLink);
    }
  };

  // ─── 공유하기 ────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const shareData = {
      title: '런치픽 팀 초대',
      text: '오늘 점심 같이 골라요! 아래 링크로 참여해주세요.',
      url: inviteLink,
    };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(inviteLink);
      alert('링크가 복사됐습니다! 카카오톡에 붙여넣기 하세요.');
    }
  };

  // ─── 초대 링크 화면 ──────────────────────────────────────────────────────
  if (inviteLink) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>🍽️ 런치픽</h1>
        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>팀이 만들어졌어요! 🎉</h2>
          <p style={{ color: '#e67e22', fontWeight: '600', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
            먼저 팀원들에게 공유하세요. 참여 후 함께 투표할 수 있어요.
          </p>
          <div style={styles.linkBox}>{inviteLink}</div>
          <button
            style={{ ...styles.btnPrimary, marginTop: '0.75rem', width: '100%' }}
            onClick={handleShare}
          >
            📤 팀원에게 공유하기
          </button>
          <button
            style={{ ...styles.btnSecondary, marginTop: '0.5rem', width: '100%' }}
            onClick={copyLink}
          >
            {copied ? '✓ 링크 복사됨' : '🔗 링크 복사'}
          </button>
          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '1rem 0' }} />
          <button
            style={{ ...styles.btnGhost, width: '100%', fontSize: '0.9rem', padding: '0.6rem' }}
            onClick={() => navigate('/vote')}
          >
            공유 완료 · 투표 화면으로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🍽️ 런치픽</h1>
      <p style={{ color: '#888', marginBottom: '2rem', fontSize: '0.95rem' }}>
        팀원들과 함께 오늘 점심을 골라보세요
      </p>

      {/* 이용방법 — tab === 'select' 일 때만 표시 */}
      {tab === 'select' && (
        <div style={styles.stepsWrap}>
          {[
            { icon: '👥', step: 'STEP 1', title: '팀 만들기', desc: '팀 이름을 정하고 초대 링크를 생성하세요' },
            { icon: '🔗', step: 'STEP 2', title: '팀원 초대', desc: '링크를 공유하면 팀원이 바로 참여할 수 있어요' },
            { icon: '🍽', step: 'STEP 3', title: '함께 투표', desc: '주변 맛집 후보에 괜찮아요/패스를 누르면 자동으로 점심이 결정돼요' },
          ].map((s, i) => (
            <div key={i} style={styles.stepCard}>
              <div style={styles.stepIcon}>{s.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={styles.stepLabel}>{s.step}</div>
                <div style={styles.stepTitle}>{s.title}</div>
                <div style={styles.stepDesc}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 탭 선택 */}
      {tab === 'select' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '360px' }}>
          <button style={styles.btnPrimary} onClick={() => setTab('create')}>
            팀 만들기
          </button>
          <button style={styles.btnSecondary} onClick={() => setTab('join')}>
            팀 참여하기
          </button>
        </div>
      )}

      {/* 팀 만들기 폼 */}
      {tab === 'create' && (
        <form onSubmit={handleCreate} style={styles.form}>
          <h2 style={{ marginTop: 0 }}>팀 만들기</h2>
          <input
            style={styles.input}
            placeholder="팀 이름 (예: 개발팀)"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
          />
          <input
            style={styles.input}
            placeholder="내 이름"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            required
          />
          {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
          <button style={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? '생성 중...' : '팀 만들기'}
          </button>
          <button style={styles.btnGhost} type="button" onClick={() => setTab('select')}>
            뒤로
          </button>
        </form>
      )}

      {/* 팀 참여 폼 */}
      {tab === 'join' && (
        <form onSubmit={handleJoin} style={styles.form}>
          <h2 style={{ marginTop: 0 }}>팀 참여하기</h2>
          <input
            style={styles.input}
            placeholder="초대 코드 8자리"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            maxLength={8}
            required
          />
          <input
            style={styles.input}
            placeholder="내 이름"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            required
          />
          {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
          <button style={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? '참여 중...' : '참여하기'}
          </button>
          <button style={styles.btnGhost} type="button" onClick={() => setTab('select')}>
            뒤로
          </button>
        </form>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    fontFamily: 'sans-serif',
    background: '#f9fafb',
  },
  title: { fontSize: '2rem', margin: '0 0 0.5rem' },
  stepsWrap: {
    width: '100%',
    maxWidth: '360px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    marginBottom: '1.75rem',
  },
  stepCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.9rem',
    background: '#fff',
    border: '1px solid #f0f0f0',
    borderRadius: '12px',
    padding: '0.9rem 1rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  stepIcon: {
    fontSize: '1.6rem',
    lineHeight: 1,
    marginTop: '0.1rem',
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#ff6b35',
    letterSpacing: '0.08em',
    marginBottom: '0.15rem',
  },
  stepTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '0.2rem',
  },
  stepDesc: {
    fontSize: '0.8rem',
    color: '#6b7280',
    lineHeight: 1.45,
  },
  card: {
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: '12px',
    padding: '1.5rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: '100%',
    maxWidth: '360px',
  },
  input: {
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
  },
  linkBox: {
    background: '#f5f5f5',
    borderRadius: '8px',
    padding: '0.75rem',
    fontSize: '0.85rem',
    wordBreak: 'break-all',
    color: '#333',
  },
  btnPrimary: {
    padding: '0.75rem',
    fontSize: '1rem',
    background: '#ff6b35',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  btnSecondary: {
    padding: '0.75rem',
    fontSize: '1rem',
    background: '#fff',
    color: '#ff6b35',
    border: '2px solid #ff6b35',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  btnKakao: {
    padding: '0.75rem',
    fontSize: '1rem',
    background: '#FEE500',
    color: '#191919',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    flex: 1,
  },
  btnGhost: {
    padding: '0.5rem',
    fontSize: '0.9rem',
    background: 'transparent',
    color: '#999',
    border: 'none',
    cursor: 'pointer',
  },
};
