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
      navigate(isVotingClosed ? '/result' : '/vote');
    } catch {
      // error는 useTeam에서 관리
    }
  };

  if (fetchError) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>🍽️ 런치픽</h1>
        <p style={{ color: 'red' }}>{fetchError}</p>
        <button style={styles.btnGhost} onClick={() => navigate('/')}>
          홈으로
        </button>
      </div>
    );
  }

  if (!team) {
    return (
      <div style={styles.container}>
        <p>팀 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🍽️ 런치픽</h1>
      <div style={styles.card}>
        <p style={{ color: '#999', margin: '0 0 0.25rem', fontSize: '0.85rem' }}>초대받은 팀</p>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.5rem' }}>{team.name}</h2>

        {isVotingClosed && (
          <div style={styles.closedNotice}>
            🔒 이 팀의 투표가 이미 마감됐어요.<br />
            이름을 입력하고 참여하면 결과를 확인할 수 있어요.
          </div>
        )}

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            style={styles.input}
            placeholder="내 이름을 입력하세요"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            autoFocus
            required
          />
          {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
          <button style={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? '참여 중...' : isVotingClosed ? '결과 확인하기' : `${team.name} 팀 참여하기`}
          </button>
        </form>
      </div>
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
  title: { fontSize: '2rem', margin: '0 0 1.5rem' },
  card: {
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: '12px',
    padding: '1.5rem',
    width: '100%',
    maxWidth: '360px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  input: {
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
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
  btnGhost: {
    marginTop: '1rem',
    padding: '0.5rem',
    fontSize: '0.9rem',
    background: 'transparent',
    color: '#999',
    border: 'none',
    cursor: 'pointer',
  },
  closedNotice: {
    fontSize: '0.85rem',
    color: '#92400e',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    padding: '0.7rem 0.9rem',
    marginBottom: '0.75rem',
    lineHeight: 1.6,
  },
};
