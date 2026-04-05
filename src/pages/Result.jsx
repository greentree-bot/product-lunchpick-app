import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotes } from '../hooks/useVotes';
import { storage } from '../lib/storage';

export default function Result() {
  const navigate = useNavigate();
  const { teamId, memberName, teamName } = storage.load();

  const { votes, todayHistory, okCountByMenu, clearVotes, recordToHistory, loading } = useVotes(teamId);

  useEffect(() => {
    if (!teamId) navigate('/');
  }, [teamId, navigate]);

  if (!teamId) return null;

  const ranked = Object.entries(okCountByMenu).sort(([, a], [, b]) => b - a);
  const topMenu = ranked[0]?.[0];
  const totalVoters = new Set(votes.map((v) => v.voter_name)).size;

  const handlePickTop = async () => {
    if (!topMenu) return;
    await recordToHistory(topMenu);
    await clearVotes();
    navigate('/vote');
  };

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh' }}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🍽️ 투표 결과</h1>
          <p style={styles.headerSub}>{teamName} · 총 {totalVoters}명 투표</p>
        </div>
        <button style={styles.btnGhost} onClick={() => navigate('/vote')}>
          돌아가기
        </button>
      </header>

      <main style={styles.main}>
        {loading && <p style={{ color: '#999' }}>로딩 중...</p>}

        {ranked.length > 0 ? (
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={styles.sectionTitle}>메뉴 순위</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ranked.map(([menu, count], i) => (
                <li key={menu} style={{ ...styles.card, background: i === 0 ? '#fff7ed' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={styles.rank}>{i + 1}</span>
                    <strong>{menu}</strong>
                  </div>
                  <span style={styles.okCount}>👍 {count}</span>
                </li>
              ))}
            </ul>
            {topMenu && (
              <button style={{ ...styles.btnPrimary, marginTop: '1rem' }} onClick={handlePickTop}>
                "{topMenu}" 오늘 먹기로 확정!
              </button>
            )}
          </section>
        ) : (
          <p style={{ color: '#999' }}>아직 투표 결과가 없습니다.</p>
        )}

        {todayHistory.length > 0 && (
          <section>
            <h2 style={styles.sectionTitle}>오늘 먹은 메뉴</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {todayHistory.map((h) => (
                <li key={h.id} style={styles.historyItem}>🍱 {h.menu_name}</li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid #eee',
    background: '#fff',
    position: 'sticky',
    top: 0,
  },
  headerTitle: { margin: 0, fontSize: '1.3rem' },
  headerSub: { margin: 0, fontSize: '0.85rem', color: '#666' },
  main: { padding: '1.5rem', maxWidth: '720px', margin: '0 auto' },
  sectionTitle: { fontSize: '1rem', color: '#444', margin: '0 0 0.75rem' },
  card: {
    border: '1px solid #eee',
    borderRadius: '10px',
    padding: '0.9rem 1rem',
    marginBottom: '0.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  rank: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#ff6b35',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  okCount: { fontSize: '0.95rem', color: '#555' },
  btnPrimary: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    background: '#ff6b35',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    width: '100%',
  },
  btnGhost: {
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    background: 'transparent',
    color: '#666',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  historyItem: {
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    background: '#f9fafb',
    marginBottom: '0.5rem',
    fontSize: '0.95rem',
  },
};
