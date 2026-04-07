import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotes } from '../hooks/useVotes';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { storage } from '../lib/storage';

export default function Result() {
  const navigate = useNavigate();
  const { teamId, teamName } = storage.load();

  const { votes, todayHistory, okCountByMenu, passCountByMenu, clearVotes, recordToHistory, loading } = useVotes(teamId);
  const { settings, isVotingClosed } = useTeamSettings(teamId);

  useEffect(() => {
    if (!teamId) navigate('/');
  }, [teamId, navigate]);

  if (!teamId) return null;

  const ranked = Object.entries(okCountByMenu).sort(([, a], [, b]) => b - a);
  const topMenu = ranked[0]?.[0];
  const totalVoters = new Set(votes.map((v) => v.voter_name)).size;
  const today = new Date().toISOString().slice(0, 10);
  const todayVotes = votes.filter(v => v.voted_at?.slice(0, 10) === today);
  const minVoters = settings.min_voters ?? 2;
  const canConfirm = isVotingClosed && totalVoters >= minVoters;

  const handlePickTop = async () => {
    if (!topMenu || !canConfirm) return;
    await recordToHistory(topMenu);
    await clearVotes();
    navigate('/vote');
  };

  const voterStatus = () => {
    if (totalVoters === 0) return null;
    if (!isVotingClosed) {
      return (
        <p style={styles.statusInfo}>
          현재 <strong>{totalVoters}명</strong> 투표 중 · 마감({settings.vote_deadline}) 후 {minVoters}명 이상이면 확정 가능
        </p>
      );
    }
    if (totalVoters < minVoters) {
      return (
        <p style={styles.statusWarn}>
          ⚠️ {totalVoters}명 참여 — 최소 {minVoters}명이 필요해요. 확정할 수 없습니다.
        </p>
      );
    }
    return (
      <p style={styles.statusOk}>
        ✅ {totalVoters}명 참여 완료 · 투표 마감됨
      </p>
    );
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

        {voterStatus()}

        {ranked.length > 0 ? (
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={styles.sectionTitle}>메뉴 순위</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ranked.map(([menu, count], i) => {
                const okVoters   = [...new Set(todayVotes.filter(v => v.menu_name === menu && v.action === 'ok').map(v => v.voter_name))];
                const passVoters = [...new Set(todayVotes.filter(v => v.menu_name === menu && v.action === 'pass').map(v => v.voter_name))];
                return (
                  <li key={menu} style={{ ...styles.card, background: i === 0 ? '#fff7ed' : '#fff', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                      <span style={styles.rank}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{menu}</strong>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          <span style={styles.okCount}>👍 {count}</span>
                          {(passCountByMenu[menu] ?? 0) > 0 && (
                            <span style={styles.passCount}>👎 {passCountByMenu[menu]}</span>
                          )}
                        </div>
                      </div>
                      {(okVoters.length > 0 || passVoters.length > 0) && (
                        <div style={styles.voterRow}>
                          {okVoters.map(name => (
                            <span key={`ok-${name}`} style={styles.chipOk}>{name}</span>
                          ))}
                          {passVoters.map(name => (
                            <span key={`pass-${name}`} style={styles.chipPass}>{name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {topMenu && (
              <div style={{ marginTop: '1rem' }}>
                {canConfirm ? (
                  <button style={styles.btnPrimary} onClick={handlePickTop}>
                    "{topMenu}" 오늘 먹기로 확정!
                  </button>
                ) : (
                  <button style={{ ...styles.btnPrimary, ...styles.btnDisabled }} disabled>
                    {!isVotingClosed
                      ? `⏰ 마감 전 (${settings.vote_deadline}까지 투표)`
                      : `참여 인원 부족 (${totalVoters}/${minVoters}명)`}
                  </button>
                )}

                <div style={styles.menuPreviewCard}>
                  <p style={styles.menuPreviewTitle}>🍴 {topMenu} 메뉴</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <a
                      href={`https://map.naver.com/v5/search/${encodeURIComponent(topMenu)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.menuBtn}
                    >
                      네이버 지도에서 메뉴 보기
                    </a>
                    <a
                      href={`https://search.naver.com/search.naver?query=${encodeURIComponent(topMenu + ' 메뉴')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...styles.menuBtn, ...styles.menuBtnGhost }}
                    >
                      네이버 검색
                    </a>
                  </div>
                </div>
              </div>
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
                <li key={h.id} style={styles.historyItem}>
                  <span>🍱 {h.menu_name}</span>
                  <a
                    href={`https://map.naver.com/v5/search/${encodeURIComponent(h.menu_name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.historyLink}
                  >
                    메뉴 보기
                  </a>
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
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 1.5rem', borderBottom: '1px solid #eee',
    background: '#fff', position: 'sticky', top: 0,
  },
  headerTitle: { margin: 0, fontSize: '1.3rem' },
  headerSub: { margin: 0, fontSize: '0.85rem', color: '#666' },
  main: { padding: '1.5rem', maxWidth: '720px', margin: '0 auto' },
  sectionTitle: { fontSize: '1rem', color: '#444', margin: '0 0 0.75rem' },
  statusInfo: {
    fontSize: '0.9rem', color: '#6b7280', background: '#f9fafb',
    border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '0.65rem 1rem', marginBottom: '1rem',
  },
  statusWarn: {
    fontSize: '0.9rem', color: '#b45309', background: '#fffbeb',
    border: '1px solid #fde68a', borderRadius: '8px',
    padding: '0.65rem 1rem', marginBottom: '1rem',
  },
  statusOk: {
    fontSize: '0.9rem', color: '#15803d', background: '#f0fdf4',
    border: '1px solid #bbf7d0', borderRadius: '8px',
    padding: '0.65rem 1rem', marginBottom: '1rem',
  },
  card: {
    border: '1px solid #eee', borderRadius: '10px',
    padding: '0.9rem 1rem', marginBottom: '0.5rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  rank: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: '#ff6b35', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.85rem', fontWeight: 'bold', flexShrink: 0,
  },
  okCount: { fontSize: '0.95rem', color: '#555' },
  passCount: { fontSize: '0.95rem', color: '#ef4444' },
  voterRow: {
    display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.45rem',
  },
  chipOk: {
    fontSize: '0.72rem', fontWeight: '600', color: '#15803d',
    background: '#dcfce7', borderRadius: '999px', padding: '0.15rem 0.55rem',
  },
  chipPass: {
    fontSize: '0.72rem', fontWeight: '600', color: '#b91c1c',
    background: '#fee2e2', borderRadius: '999px', padding: '0.15rem 0.55rem',
  },
  btnPrimary: {
    padding: '0.75rem 1.5rem', fontSize: '1rem', background: '#ff6b35',
    color: '#fff', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontWeight: 'bold', width: '100%',
  },
  btnDisabled: {
    background: '#d1d5db', cursor: 'not-allowed', color: '#6b7280',
  },
  btnGhost: {
    padding: '0.4rem 0.75rem', fontSize: '0.85rem', background: 'transparent',
    color: '#666', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer',
  },
  historyItem: {
    padding: '0.6rem 1rem', borderRadius: '8px', background: '#f9fafb',
    marginBottom: '0.5rem', fontSize: '0.95rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  historyLink: {
    fontSize: '0.8rem', color: '#16a34a', textDecoration: 'none',
    border: '1px solid #86efac', borderRadius: '5px', padding: '0.15rem 0.5rem',
    flexShrink: 0,
  },
  menuPreviewCard: {
    marginTop: '1rem', padding: '1rem', borderRadius: '10px',
    background: '#f0fdf4', border: '1px solid #bbf7d0',
  },
  menuPreviewTitle: {
    margin: '0 0 0.65rem', fontSize: '0.95rem', fontWeight: 'bold', color: '#15803d',
  },
  menuBtn: {
    display: 'inline-block', padding: '0.45rem 0.9rem',
    background: '#16a34a', color: '#fff', borderRadius: '7px',
    fontSize: '0.85rem', fontWeight: '600', textDecoration: 'none',
  },
  menuBtnGhost: {
    background: 'transparent', color: '#16a34a',
    border: '1px solid #16a34a',
  },
};
