import React, { useEffect, useState } from 'react';
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

  // 로컬 카운트 상태: { [restaurantName]: { okCount, passCount } }
  const [localCounts, setLocalCounts] = useState({});
  // 내 투표 로컬 상태
  const [localVote, setLocalVote] = useState(null);

  useEffect(() => {
    if (!teamId || !memberName) navigate('/');
  }, [teamId, memberName, navigate]);

  if (!teamId || !memberName) return null;

  const today = new Date().toISOString().slice(0, 10);
  const dbVote = votes.find(
    (v) => v.voter_name === memberName && v.voted_at?.slice(0, 10) === today
  );
  const myVote = dbVote || localVote;

  // 카운트 계산: DB 카운트 + 로컬 카운트 합산
  const getCount = (menuName, action) => {
    const dbCount = action === 'ok' ? (okCountByMenu[menuName] ?? 0) : 0;
    const local = localCounts[menuName];
    if (!local) return dbCount;
    return action === 'ok'
      ? dbCount + (local.okCount || 0)
      : (local.passCount || 0);
  };

  const handleVote = async (restaurant, action) => {
    if (myVote) return;

    const menuName = restaurant.name;

    // 1. 로컬 state 즉시 반영
    setLocalVote({
      id: `local-${Date.now()}`,
      menu_name: menuName,
      action,
      voter_name: memberName,
      voted_at: new Date().toISOString(),
    });

    setLocalCounts((prev) => {
      const cur = prev[menuName] || { okCount: 0, passCount: 0 };
      const updated = {
        ...cur,
        okCount: action === 'ok' ? cur.okCount + 1 : cur.okCount,
        passCount: action === 'pass' ? cur.passCount + 1 : cur.passCount,
      };
      console.log('투표:', {
        restaurant: menuName,
        action,
        okCount: updated.okCount,
        passCount: updated.passCount,
      });
      return { ...prev, [menuName]: updated };
    });

    // 2. teamId 있으면 Supabase에도 저장
    if (teamId) {
      try {
        await castVote(menuName, action, memberName);
        console.log('[Vote] DB 저장 성공:', menuName, action);
      } catch (err) {
        console.error('[Vote] DB 저장 실패 (로컬 유지):', err.message);
      }
    }
  };

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
              {restaurants.map((r) => {
                const okCount = getCount(r.name, 'ok');
                const passCount = getCount(r.name, 'pass');
                const isMyChoice = myVote?.menu_name === r.name;

                return (
                  <li key={r.id} style={{
                    ...styles.card,
                    border: isMyChoice ? '2px solid #ff6b35' : '1px solid #eee',
                  }}>
                    <div>
                      <strong style={{ fontSize: '1rem' }}>{r.name}</strong>
                      <p style={styles.cardSub}>{r.category} · {r.distance}m</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* 카운트 표시 */}
                      <span style={styles.countBadge}>
                        👍 {okCount}
                      </span>
                      {passCount > 0 && (
                        <span style={{ ...styles.countBadge, color: '#9ca3af' }}>
                          👎 {passCount}
                        </span>
                      )}

                      {/* 내가 이미 이 식당에 투표한 경우 */}
                      {isMyChoice ? (
                        <span style={{ color: myVote.action === 'ok' ? '#22c55e' : '#9ca3af', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          {myVote.action === 'ok' ? '✓ 괜찮아요' : '✗ 패스'}
                        </span>
                      ) : (
                        <>
                          <button
                            style={{ ...styles.btnOk, opacity: myVote ? 0.35 : 1, cursor: myVote ? 'not-allowed' : 'pointer' }}
                            onClick={() => handleVote(r, 'ok')}
                            disabled={!!myVote}
                          >
                            괜찮아요
                          </button>
                          <button
                            style={{ ...styles.btnPass, opacity: myVote ? 0.35 : 1, cursor: myVote ? 'not-allowed' : 'pointer' }}
                            onClick={() => handleVote(r, 'pass')}
                            disabled={!!myVote}
                          >
                            패스
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
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
  countBadge: { fontSize: '0.9rem', color: '#555', minWidth: '36px' },
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
