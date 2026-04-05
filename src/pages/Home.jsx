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

  // ─── 카카오톡 공유 (Web Share API → clipboard fallback) ───────────────────
  const shareKakao = async () => {
    if (navigator.share) {
      await navigator.share({ title: '런치픽 팀 초대', url: inviteLink });
    } else {
      copyLink();
    }
  };

  // ─── 초대 링크 화면 ──────────────────────────────────────────────────────
  if (inviteLink) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>🍽️ 런치픽</h1>
        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>팀이 만들어졌어요!</h2>
          <p style={{ color: '#666' }}>팀원들에게 아래 링크를 공유하세요</p>
          <div style={styles.linkBox}>{inviteLink}</div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button style={styles.btnSecondary} onClick={copyLink}>
              {copied ? '✓ 복사됨' : '링크 복사'}
            </button>
            <button style={styles.btnKakao} onClick={shareKakao}>
              카카오톡 공유
            </button>
          </div>
          <button
            style={{ ...styles.btnPrimary, marginTop: '1.5rem', width: '100%' }}
            onClick={() => navigate('/vote')}
          >
            투표 시작하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🍽️ 런치픽</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        팀원들과 함께 오늘 점심을 골라보세요
      </p>

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
  },
  title: { fontSize: '2rem', margin: '0 0 0.5rem' },
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
