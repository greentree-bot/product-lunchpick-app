import React, { useState } from 'react';
import { useVotes } from './hooks/useVotes';
import { useNearbyRestaurants } from './hooks/useNearbyRestaurants';
import './App.css';

const SESSION_ID = 'lunch-session-001';

function App() {
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [userId] = useState(() => `user_${Math.random().toString(36).slice(2, 8)}`);

  const { restaurants, loading: loadingRestaurants, error: locationError, getCurrentLocation } = useNearbyRestaurants(
    location.lat,
    location.lng
  );
  const { votes, loading: loadingVotes, castVote, removeVote } = useVotes(SESSION_ID);

  const handleGetLocation = async () => {
    try {
      const pos = await getCurrentLocation();
      setLocation(pos);
    } catch (err) {
      alert('위치 정보를 가져올 수 없습니다: ' + err.message);
    }
  };

  const getVoteCount = (restaurantId) =>
    votes.filter((v) => v.restaurant_id === restaurantId).length;

  const myVote = votes.find((v) => v.user_id === userId);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🍽️ LunchPick</h1>
        <p>팀원들과 함께 오늘 점심 메뉴를 골라보세요!</p>
      </header>

      <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        {!location.lat && (
          <button onClick={handleGetLocation} style={{ marginBottom: '1.5rem' }}>
            📍 내 주변 식당 찾기
          </button>
        )}

        {locationError && (
          <p style={{ color: 'red' }}>오류: {locationError}</p>
        )}

        {loadingRestaurants && <p>식당 목록 불러오는 중...</p>}

        {restaurants.length > 0 && (
          <section>
            <h2>주변 식당 ({restaurants.length}곳)</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {restaurants.map((r) => (
                <li
                  key={r.id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong>{r.name}</strong>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                      {r.category} · {r.distance}m
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>👍 {getVoteCount(r.id)}</span>
                    {myVote?.restaurant_id === r.id ? (
                      <button onClick={() => removeVote(myVote.id)}>투표 취소</button>
                    ) : (
                      <button onClick={() => castVote(r.id, userId)} disabled={!!myVote}>
                        투표
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {loadingVotes && <p>투표 현황 불러오는 중...</p>}
      </main>
    </div>
  );
}

export default App;
