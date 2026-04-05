import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeam } from '../hooks/useTeam';

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

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    try {
      await joinTeam(code, memberName.trim());
      navigate('/vote');
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
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem' }}>{team.name}</h2>
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
            {loading ? '참여 중...' : `${team.name} 팀 참여하기`}
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
};
