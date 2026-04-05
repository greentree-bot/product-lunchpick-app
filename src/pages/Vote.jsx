import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotes } from '../hooks/useVotes';
import { useNearbyRestaurants } from '../hooks/useNearbyRestaurants';
import { storage } from '../lib/storage';

export default function Vote() {
  const navigate = useNavigate();
  const { teamId, memberName, teamName } = storage.load();

  const {
    votes,
    weekMenuSet,
    loading: loadingVotes,
    castVote,
    okCountByMenu,
  } = useVotes(teamId);

  const {
    restaurants,
    loading: loadingRestaurants,
    error: locationError,
    fetchNearby,
  } = useNearbyRestaurants(weekMenuSet);

  useEffect(() => {
    if (!teamId || !memberName) navigate('/');
  }, [teamId, memberName, navigate]);

  if (!teamId || !memberName) return null;

  const myVote = votes.find((v) => v.voter_name === memberName);

  const handleLogout = () => {
    storage.clear();
    navigate('/');
  };

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh' }}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🍽️ 런치픽</h1>
          <p style={styles.headerSub}>{teamName} · {memberName}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={styles.btnGhost} onClick={() => navigate('/result')}>
            결과 보기
          </button>
          <button style={styles.btnGhost} onClick={handleLogout}>
            나가기
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <button style={styles.btnPrimary} onClick={fetchNearby} disabled={loadingRestaurants}>
          {loadingRestaurants ? '검색 중...' : '📍 내 주변 식당 찾기'}
        </button>

        {locationError && (
          <p style={{ color: 'red', margin: '0.5rem 0' }}>오류: {locationError}</p>
        )}

        {loadingVotes && <p style={{ color: '#999' }}>투표 현황 불러오는 중...</p>}

        {restaurants.length > 0 && (
          <section style={{ marginTop: '1.5rem' }}>
            <h2 style={styles.sectionTitle}>주변 식당 {restaurants.length}곳</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {restaurants.map((r) => (
                <li key={r.id} style={styles.card}>
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{r.name}</strong>
                    <p style={styles.cardSub}>
                      {r.category} · {r.distance}m
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={styles.okCount}>
                      👍 {okCountByMenu[r.name] ?? 0}
                    </span>
                    {myVote?.menu_name === r.name ? (
                      <span style={{ color: myVote.action === 'ok' ? '#22c55e' : '#9ca3af', fontWeight: 'bold' }}>
                        {myVote.action === 'ok' ? '✓ 괜찮아요' : '✗ 패스'}
                      </span>
                    ) : (
                      <>
                        <button
                          style={styles.btnOk}
                          onClick={() => castVote(r.name, 'ok', memberName)}
                          disabled={!!myVote}
                        >
                          괜찮아요
                        </button>
                        <button
                          style={styles.btnPass}
                          onClick={() => castVote(r.name, 'pass', memberName)}
                          disabled={!!myVote}
                        >
                          패스
                        </button>
                      </>
                    )}
                  </div>
                </li>
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
    zIndex: 10,
  },
  headerTitle: { margin: 0, fontSize: '1.3rem' },
  headerSub: { margin: 0, fontSize: '0.85rem', color: '#666' },
  main: { padding: '1.5rem', maxWidth: '720px', margin: '0 auto' },
  sectionTitle: { fontSize: '1rem', color: '#444', margin: '0 0 0.75rem' },
  card: {
    border: '1px solid #eee',
    borderRadius: '10px',
    padding: '0.9rem 1rem',
    marginBottom: '0.75rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  cardSub: { margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#888' },
  okCount: { fontSize: '0.9rem', color: '#555', minWidth: '40px' },
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
  btnOk: {
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  btnPass: {
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    background: '#e5e7eb',
    color: '#374151',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
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
};
