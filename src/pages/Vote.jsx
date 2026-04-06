import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotes } from '../hooks/useVotes';
import { useNearbyRestaurants } from '../hooks/useNearbyRestaurants';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { storage } from '../lib/storage';

const APP_URL = 'https://lunchpick.pages.dev';

export default function Vote() {
  const navigate = useNavigate();
  const { teamId, memberName, teamName, inviteCode } = storage.load();
  const inviteLink = inviteCode ? `${APP_URL}/join/${inviteCode}` : null;

  const { votes, weekMenuSet, loading: loadingVotes, castVote, okCountByMenu, passCountByMenu } = useVotes(teamId);
  const { restaurants, loading: loadingRestaurants, error: locationError, fetchNearby } = useNearbyRestaurants(weekMenuSet);
  const { settings, updateSettings, saving, isVotingClosed } = useTeamSettings(teamId);

  // ─── 내 투표 로컬 상태 ────────────────────────────────────────────────────
  const [localOkMenu, setLocalOkMenu] = useState(null);
  const [localPassSet, setLocalPassSet] = useState(new Set());
  const [localOkCounts, setLocalOkCounts] = useState({});

  // ─── 모달 상태 ────────────────────────────────────────────────────────────
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editDeadline, setEditDeadline] = useState('');
  const [editMinVoters, setEditMinVoters] = useState(2);

  useEffect(() => {
    if (!teamId || !memberName) navigate('/');
  }, [teamId, memberName, navigate]);

  // 설정 모달 열 때 현재값 복사
  useEffect(() => {
    if (showSettings) {
      setEditDeadline(settings.vote_deadline);
      setEditMinVoters(settings.min_voters);
    }
  }, [showSettings, settings]);

  if (!teamId || !memberName) return null;

  // ─── DB 투표에서 오늘 내 투표 추출 ───────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const myTodayVotes = votes.filter(
    (v) => v.voter_name === memberName && v.voted_at?.slice(0, 10) === today
  );
  const dbOkMenu = myTodayVotes.find((v) => v.action === 'ok')?.menu_name ?? null;
  const dbPassSet = new Set(myTodayVotes.filter((v) => v.action === 'pass').map((v) => v.menu_name));

  const myOkMenu = dbOkMenu ?? localOkMenu;
  const myPassSet = new Set([...dbPassSet, ...localPassSet]);

  // ─── 카운트 계산 ─────────────────────────────────────────────────────────
  const getOkCount = (menuName) => (okCountByMenu[menuName] ?? 0) + (localOkCounts[menuName] ?? 0);
  const getPassCount = (menuName) => passCountByMenu[menuName] ?? 0;

  // ─── 투표 핸들러 ─────────────────────────────────────────────────────────
  const handleOk = async (restaurant) => {
    if (isVotingClosed || myOkMenu) return;
    const menuName = restaurant.name;
    setLocalOkMenu(menuName);
    setLocalOkCounts((prev) => ({ ...prev, [menuName]: (prev[menuName] ?? 0) + 1 }));
    if (teamId) {
      try { await castVote(menuName, 'ok', memberName); }
      catch (err) { console.error('[Vote] ok DB 저장 실패:', err.message); }
    }
  };

  const handlePass = async (restaurant) => {
    if (isVotingClosed || myPassSet.has(restaurant.name)) return;
    const menuName = restaurant.name;
    setLocalPassSet((prev) => new Set([...prev, menuName]));
    if (teamId) {
      try { await castVote(menuName, 'pass', memberName); }
      catch (err) { console.error('[Vote] pass DB 저장 실패:', err.message); }
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings({ vote_deadline: editDeadline, min_voters: Number(editMinVoters) });
      setShowSettings(false);
    } catch (err) {
      alert('설정 저장 실패: ' + err.message);
    }
  };

  const handleLogout = () => { storage.clear(); navigate('/'); };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('아래 링크를 복사하세요:', inviteLink);
    }
  };

  const handleShare = async () => {
    if (!inviteLink) return;
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

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f9fafb' }}>
      {/* 헤더 */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🍽️ 런치픽</h1>
          <p style={styles.headerSub}>{teamName} · {memberName}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {inviteLink && (
            <button style={styles.btnInvite} onClick={() => setShowInvite(true)}>팀원 초대</button>
          )}
          <button style={styles.btnGhost} onClick={() => setShowSettings(true)}>⚙️ 설정</button>
          <button style={styles.btnGhost} onClick={() => navigate('/result')}>결과 보기</button>
          <button style={styles.btnGhost} onClick={handleLogout}>나가기</button>
        </div>
      </header>

      {/* 투표 마감 배너 */}
      {isVotingClosed ? (
        <div style={styles.closedBanner}>
          🔒 투표 마감됨 ({settings.vote_deadline}) — 결과를 확인하세요
        </div>
      ) : (
        <div style={styles.openBanner}>
          ⏰ 투표 마감: {settings.vote_deadline} · 최소 {settings.min_voters}명 참여 필요
        </div>
      )}

      {/* 설정 모달 */}
      {showSettings && (
        <div style={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>⚙️ 투표 설정</h3>

            <label style={styles.label}>투표 마감 시간 (팀 생성 후 기본 10분)</label>
            <input
              type="time"
              style={styles.input}
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
            />

            <label style={{ ...styles.label, marginTop: '0.75rem' }}>최소 참여 인원</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                style={styles.stepBtn}
                onClick={() => setEditMinVoters((n) => Math.max(1, n - 1))}
              >−</button>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', minWidth: '24px', textAlign: 'center' }}>
                {editMinVoters}
              </span>
              <button
                style={styles.stepBtn}
                onClick={() => setEditMinVoters((n) => n + 1)}
              >+</button>
              <span style={{ fontSize: '0.85rem', color: '#888' }}>명 이상 투표해야 확정 가능</span>
            </div>

            <button
              style={{ ...styles.btnPrimary, marginTop: '1.25rem' }}
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button style={styles.btnClose} onClick={() => setShowSettings(false)}>닫기</button>
          </div>
        </div>
      )}

      {/* 초대 모달 */}
      {showInvite && (
        <div style={styles.modalOverlay} onClick={() => setShowInvite(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem' }}>팀원 초대하기</h3>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              아래 링크를 공유하면 팀원이 바로 참여할 수 있어요
            </p>
            <div style={styles.linkBox}>{inviteLink}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button style={styles.btnSecondary} onClick={copyLink}>
                {copied ? '✓ 복사됨' : '링크 복사'}
              </button>
              <button style={styles.btnKakao} onClick={handleShare}>공유하기</button>
            </div>
            <button style={styles.btnClose} onClick={() => setShowInvite(false)}>닫기</button>
          </div>
        </div>
      )}

      <main style={styles.main}>
        {/* 내 투표 현황 요약 */}
        {(myOkMenu || myPassSet.size > 0) && (
          <div style={styles.summaryBox}>
            {myOkMenu && <span style={styles.summaryOk}>✓ 괜찮아요: {myOkMenu}</span>}
            {myPassSet.size > 0 && (
              <span style={styles.summaryPass}>✗ 패스 {myPassSet.size}개</span>
            )}
          </div>
        )}

        <button
          style={{ ...styles.btnPrimary, opacity: isVotingClosed ? 0.5 : 1 }}
          onClick={fetchNearby}
          disabled={loadingRestaurants || isVotingClosed}
        >
          {loadingRestaurants ? '검색 중...' : isVotingClosed ? '🔒 투표 마감됨' : '📍 내 주변 식당 찾기'}
        </button>

        {locationError && <p style={{ color: 'red', margin: '0.5rem 0' }}>오류: {locationError}</p>}
        {loadingVotes && <p style={{ color: '#999' }}>투표 현황 불러오는 중...</p>}

        {restaurants.length > 0 && (() => {
          const CATEGORY_ORDER = ['한식', '중식', '일식', '양식', '분식', '기타'];
          const CATEGORY_EMOJI = { 한식: '🍚', 중식: '🥢', 일식: '🍣', 양식: '🍝', 분식: '🥙', 기타: '🍴' };
          const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
            const items = restaurants.filter((r) => r.mainCategory === cat);
            if (items.length) acc.push({ cat, items });
            return acc;
          }, []);

          return (
          <section style={{ marginTop: '1.5rem' }}>
            <h2 style={styles.sectionTitle}>주변 식당 {restaurants.length}곳</h2>
            {grouped.map(({ cat, items }) => (
              <div key={cat} style={{ marginBottom: '1.25rem' }}>
                <div style={styles.catHeader}>
                  {CATEGORY_EMOJI[cat]} {cat} <span style={styles.catCount}>{items.length}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {items.map((r) => {
                const isOked     = myOkMenu === r.name;
                const isPassed   = myPassSet.has(r.name);
                const okCount    = getOkCount(r.name);
                const passCount  = getPassCount(r.name);

                // 이 식당에 투표한 사람들 (오늘 기준, 중복 제거)
                const todayVotes = votes.filter(v => v.voted_at?.slice(0, 10) === today);
                const okVoters  = [...new Set(todayVotes.filter(v => v.menu_name === r.name && v.action === 'ok').map(v => v.voter_name))];
                const passVoters = [...new Set(todayVotes.filter(v => v.menu_name === r.name && v.action === 'pass').map(v => v.voter_name))];

                return (
                  <li key={r.id} style={{
                    ...styles.card,
                    border: isOked ? '2px solid #22c55e'
                          : isPassed ? '1px solid #e5e7eb'
                          : '1px solid #eee',
                    opacity: isPassed && !isOked ? 0.6 : 1,
                    alignItems: 'flex-start',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '1rem' }}>{r.name}</strong>
                      <p style={styles.cardSub}>{r.category} · {r.distance}m</p>
                      {r.description && (
                        <p style={styles.cardDesc}>{r.description}</p>
                      )}

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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                      {okCount > 0 && (
                        <span style={styles.countBadge}>👍 {okCount}</span>
                      )}
                      {passCount > 0 && (
                        <span style={styles.passBadge}>👎 {passCount}</span>
                      )}

                      {/* 마감 후엔 뱃지만 표시 */}
                      {isVotingClosed ? (
                        <>
                          {isOked && <span style={styles.badgeOk}>✓ 괜찮아요</span>}
                          {isPassed && !isOked && <span style={styles.badgePass}>✗ 패스</span>}
                        </>
                      ) : (
                        <>
                          {isOked ? (
                            <span style={styles.badgeOk}>✓ 괜찮아요</span>
                          ) : (
                            <button
                              style={{ ...styles.btnOk, opacity: myOkMenu ? 0.3 : 1, cursor: myOkMenu ? 'not-allowed' : 'pointer' }}
                              onClick={() => handleOk(r)}
                              disabled={!!myOkMenu}
                            >
                              괜찮아요
                            </button>
                          )}
                          {!isOked && (
                            isPassed ? (
                              <span style={styles.badgePass}>✗ 패스</span>
                            ) : (
                              <button style={styles.btnPass} onClick={() => handlePass(r)}>
                                패스
                              </button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
                  })}
                </ul>
              </div>
            ))}
          </section>
          );
        })()}
      </main>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 1.5rem', borderBottom: '1px solid #eee',
    background: '#fff', position: 'sticky', top: 0, zIndex: 10,
  },
  headerTitle: { margin: 0, fontSize: '1.3rem' },
  headerSub: { margin: 0, fontSize: '0.85rem', color: '#666' },
  openBanner: {
    background: '#fff7ed', borderBottom: '1px solid #fed7aa',
    padding: '0.5rem 1.5rem', fontSize: '0.85rem', color: '#c2410c', textAlign: 'center',
  },
  closedBanner: {
    background: '#fef2f2', borderBottom: '1px solid #fecaca',
    padding: '0.5rem 1.5rem', fontSize: '0.85rem', color: '#dc2626', textAlign: 'center',
    fontWeight: 'bold',
  },
  main: { padding: '1.5rem', maxWidth: '720px', margin: '0 auto' },
  sectionTitle: { fontSize: '1rem', color: '#444', margin: '0 0 0.75rem' },
  catHeader: {
    fontSize: '0.9rem', fontWeight: '700', color: '#374151',
    padding: '0.4rem 0.75rem', marginBottom: '0.5rem',
    background: '#f3f4f6', borderRadius: '8px',
    display: 'flex', alignItems: 'center', gap: '0.4rem',
  },
  catCount: {
    fontSize: '0.78rem', color: '#6b7280', fontWeight: '400',
  },
  summaryBox: {
    display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
    marginBottom: '1rem', padding: '0.6rem 0.9rem',
    background: '#fff', borderRadius: '8px', border: '1px solid #eee',
    fontSize: '0.85rem',
  },
  summaryOk: { color: '#22c55e', fontWeight: 'bold' },
  summaryPass: { color: '#ef4444', fontWeight: 'bold' },
  card: {
    borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '0.75rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  cardSub: { margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#888' },
  cardDesc: { margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.4 },
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
  countBadge: { fontSize: '0.85rem', color: '#16a34a', minWidth: '36px', fontWeight: 'bold' },
  passBadge: { fontSize: '0.85rem', color: '#ef4444', minWidth: '36px', fontWeight: 'bold' },
  badgeOk: {
    fontSize: '0.8rem', color: '#22c55e', fontWeight: 'bold',
    background: '#f0fdf4', padding: '0.25rem 0.5rem', borderRadius: '6px',
  },
  badgePass: {
    fontSize: '0.8rem', color: '#9ca3af',
    background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '6px',
  },
  btnPrimary: {
    padding: '0.75rem 1.5rem', fontSize: '1rem', background: '#ff6b35',
    color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 'bold', width: '100%',
  },
  btnOk: {
    padding: '0.4rem 0.65rem', fontSize: '0.82rem', background: '#22c55e',
    color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
  },
  btnPass: {
    padding: '0.4rem 0.65rem', fontSize: '0.82rem', background: '#e5e7eb',
    color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer',
  },
  btnGhost: {
    padding: '0.4rem 0.75rem', fontSize: '0.85rem', background: 'transparent',
    color: '#666', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer',
  },
  btnInvite: {
    padding: '0.4rem 0.75rem', fontSize: '0.85rem', background: '#FEE500',
    color: '#191919', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
  },
  btnSecondary: {
    padding: '0.6rem 0.75rem', fontSize: '0.9rem', background: '#fff',
    color: '#ff6b35', border: '2px solid #ff6b35', borderRadius: '8px',
    cursor: 'pointer', fontWeight: 'bold', flex: 1,
  },
  btnKakao: {
    padding: '0.6rem 0.75rem', fontSize: '0.9rem', background: '#FEE500',
    color: '#191919', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontWeight: 'bold', flex: 1,
  },
  btnClose: {
    marginTop: '0.75rem', width: '100%', padding: '0.6rem',
    fontSize: '0.9rem', background: 'transparent', color: '#999', border: 'none', cursor: 'pointer',
  },
  stepBtn: {
    width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #ddd',
    background: '#f9fafb', fontSize: '1.1rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
  },
  label: { display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '0.4rem', fontWeight: '600' },
  input: {
    width: '100%', padding: '0.6rem 0.75rem', fontSize: '1rem',
    border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem',
  },
  modal: {
    background: '#fff', borderRadius: '14px', padding: '1.5rem',
    width: '100%', maxWidth: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  linkBox: {
    background: '#f5f5f5', borderRadius: '8px', padding: '0.75rem',
    fontSize: '0.8rem', wordBreak: 'break-all', color: '#333',
  },
};
