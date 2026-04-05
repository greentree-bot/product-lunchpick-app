import React, { useState } from 'react';
import { useVotes } from './hooks/useVotes';
import { useNearbyRestaurants } from './hooks/useNearbyRestaurants';
import './App.css';

function App() {
  // teamId: Supabase teams.id (uuid). 실제 팀 생성/참여 후 설정.
  // null이면 useVotes 내부에서 모든 쿼리를 건너뜀 → 400 오류 방지
  const [teamId, setTeamId] = useState(null);
  const [voterName, setVoterName] = useState('');
  const [nameInput, setNameInput] = useState('');

  const { votes, weekMenuSet, loading: loadingVotes, castVote } = useVotes(teamId);
  const { restaurants, loading: loadingRestaurants, error: locationError, fetchNearby } = useNearbyRestaurants(weekMenuSet);

  // 임시 팀 참여 — 실제 UUID 입력
  const handleJoin = (e) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setVoterName(trimmed);
    // 개발용 임시 팀 ID: Supabase teams 테이블에 먼저 row를 만들고 그 uuid를 여기에 넣으세요
    setTeamId('76fc743b-4629-4a92-9662-51469c1da5f9');
  };

  const getOkCount = (menuName) =>
    votes.filter((v) => v.menu_name === menuName && v.action === 'ok').length;

  const myVote = votes.find((v) => v.voter_name === voterName);

  if (!voterName) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>🍽️ LunchPick</h1>
          <p>이름을 입력하고 시작하세요</p>
        </header>
        <main style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="이름 입력"
              style={{ flex: 1, padding: '0.5rem', fontSize: '1rem' }}
            />
            <button type="submit">참여</button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🍽️ LunchPick</h1>
        <p>안녕하세요, {voterName}님!</p>
      </header>

      <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <button onClick={fetchNearby} style={{ marginBottom: '1.5rem' }}>
          📍 내 주변 식당 찾기
        </button>

        {locationError && (
          <p style={{ color: 'red' }}>오류: {locationError}</p>
        )}

        {loadingRestaurants && <p>식당 목록 불러오는 중...</p>}
        {loadingVotes && <p>투표 현황 불러오는 중...</p>}

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
                    <span>👍 {getOkCount(r.name)}</span>
                    {myVote?.menu_name === r.name ? (
                      <span style={{ color: myVote.action === 'ok' ? 'green' : 'gray' }}>
                        {myVote.action === 'ok' ? '✓ 괜찮아요' : '✗ 패스'}
                      </span>
                    ) : (
                      <>
                        <button onClick={() => castVote(r.name, 'ok', voterName)} disabled={!!myVote || !teamId}>
                          괜찮아요
                        </button>
                        <button onClick={() => castVote(r.name, 'pass', voterName)} disabled={!!myVote || !teamId}>
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

export default App;
