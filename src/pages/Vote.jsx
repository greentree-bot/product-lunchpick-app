import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotes } from '../hooks/useVotes';
import { useNearbyRestaurants } from '../hooks/useNearbyRestaurants';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { useTeam } from '../hooks/useTeam';
import { storage } from '../lib/storage';

const APP_URL = 'https://lunchpick.pages.dev';

export default function Vote() {
  const navigate = useNavigate();
  const { teamId, memberName, teamName, inviteCode } = storage.load();
  const inviteLink = inviteCode ? `${APP_URL}/join/${inviteCode}` : null;

  const { votes, weekMenuSet, weekHistory, loading: loadingVotes, castVote, cancelVote, cancelPass, okCountByMenu, passCountByMenu } = useVotes(teamId);
  const { restaurants, loading: loadingRestaurants, error: locationError, fetchNearby } = useNearbyRestaurants(weekMenuSet);
  const { settings, updateSettings, saving, isVotingClosed, deadlineDisplay, memberCount } = useTeamSettings(teamId);
  const { changeName } = useTeam();

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
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [hidePassedItems, setHidePassedItems] = useState(false);
  const [sortBy, setSortBy] = useState('review'); // 'review' | 'distance'
  const [showWeekHistory, setShowWeekHistory] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [editName, setEditName] = useState('');
  const [currentMemberName, setCurrentMemberName] = useState(memberName);

  useEffect(() => {
    if (!teamId || !memberName) navigate('/');
  }, [teamId, memberName, navigate]);

  // 설정 모달 열 때 현재값 복사 (레거시 HH:MM → 오늘날짜T시간 변환)
  useEffect(() => {
    if (showSettings) {
      const dl = settings.vote_deadline;
      if (dl && !dl.includes('T')) {
        const today = new Date().toISOString().slice(0, 10);
        setEditDeadline(`${today}T${dl}`);
      } else {
        setEditDeadline(dl || '');
      }
      setEditMinVoters(settings.min_voters);
      setEditName(currentMemberName);
    }
  }, [showSettings, settings, currentMemberName]);

  if (!teamId || !memberName) return null;

  // ─── 토스트 헬퍼 ─────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // ─── DB 투표에서 오늘 내 투표 추출 ───────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const myTodayVotes = votes.filter(
    (v) => v.voter_name === currentMemberName && v.voted_at?.slice(0, 10) === today
  );
  const dbOkMenu = myTodayVotes.find((v) => v.action === 'ok')?.menu_name ?? null;
  const dbPassSet = new Set(myTodayVotes.filter((v) => v.action === 'pass').map((v) => v.menu_name));

  // ─── 오늘 투표 참여 인원 (실시간) ────────────────────────────────────────
  const todayVoterCount = new Set(
    votes.filter((v) => v.voted_at?.slice(0, 10) === today).map((v) => v.voter_name)
  ).size;

  const myOkMenu = dbOkMenu ?? localOkMenu;
  const myPassSet = new Set([...dbPassSet, ...localPassSet]);

  // ─── 카운트 계산 ─────────────────────────────────────────────────────────
  const getOkCount = (menuName) => (okCountByMenu[menuName] ?? 0) + (localOkCounts[menuName] ?? 0);
  const getPassCount = (menuName) => passCountByMenu[menuName] ?? 0;

  // ─── 투표 핸들러 ─────────────────────────────────────────────────────────
  const handleOk = async (restaurant) => {
    if (isVotingClosed) return;
    const menuName = restaurant.name;

    // 같은 식당 재클릭 → 취소
    if (myOkMenu === menuName) {
      setLocalOkMenu(null);
      setLocalOkCounts((prev) => { const n = { ...prev }; delete n[menuName]; return n; });
      if (teamId) {
        try { await cancelVote(menuName, currentMemberName); }
        catch (err) { console.error('[Vote] ok 취소 실패:', err.message); }
      }
      return;
    }

    // 다른 식당에 이미 ok → 불가
    if (myOkMenu) return;

    setLocalOkMenu(menuName);
    setLocalOkCounts((prev) => ({ ...prev, [menuName]: (prev[menuName] ?? 0) + 1 }));
    if (teamId) {
      try { await castVote(menuName, 'ok', currentMemberName); }
      catch (err) { console.error('[Vote] ok DB 저장 실패:', err.message); }
    }
  };

  const handlePass = async (restaurant) => {
    if (isVotingClosed) return;
    const menuName = restaurant.name;

    // 이미 패스한 식당 → 취소
    if (myPassSet.has(menuName)) {
      setLocalPassSet((prev) => { const s = new Set(prev); s.delete(menuName); return s; });
      if (teamId) {
        try { await cancelPass(menuName, currentMemberName); }
        catch (err) { console.error('[Vote] pass 취소 실패:', err.message); }
      }
      return;
    }

    setLocalPassSet((prev) => new Set([...prev, menuName]));
    if (teamId) {
      try { await castVote(menuName, 'pass', currentMemberName); }
      catch (err) { console.error('[Vote] pass DB 저장 실패:', err.message); }
    }
  };

  const handleSaveSettings = async () => {
    try {
      const tasks = [updateSettings({ vote_deadline: editDeadline, min_voters: Number(editMinVoters) })];
      const trimmedName = editName.trim();
      if (trimmedName && trimmedName !== currentMemberName) {
        tasks.push(
          changeName(teamId, currentMemberName, trimmedName).then(() => {
            setCurrentMemberName(trimmedName);
          })
        );
      }
      await Promise.all(tasks);
      setShowSettings(false);
      showToast('✅ 설정이 저장됐습니다.');
    } catch (err) {
      alert('저장 실패: ' + err.message);
    }
  };

  const handleLogout = () => { setShowHomeConfirm(true); };

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
          <p style={styles.headerSub}>{teamName} · {memberName} · 팀원 {memberCount ?? '?'}명</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {inviteLink && (
            <button style={styles.btnInvite} onClick={() => setShowInvite(true)}>팀원 초대</button>
          )}
          <button style={styles.btnGhost} onClick={() => setShowSettings(true)}>⚙️ 설정</button>
          <button style={styles.btnGhost} onClick={() => navigate('/result')}>결과 보기</button>
          <button style={styles.btnGhost} onClick={handleLogout}>HOME</button>
        </div>
      </header>

      {/* 투표 마감 배너 */}
      {isVotingClosed ? (
        <div style={styles.closedBanner}>
          <span>🔒 투표 마감됨 ({deadlineDisplay})</span>
          <button style={styles.bannerResultBtn} onClick={() => navigate('/result')}>
            결과 보기 →
          </button>
        </div>
      ) : (
        <div style={styles.openBanner}>
          ⏰ {deadlineDisplay} 마감 ·{' '}
          {todayVoterCount > 0
            ? `${todayVoterCount}/${memberCount ?? '?'}명 참여 중`
            : `최소 ${settings.min_voters}명 필요`}
        </div>
      )}

      {/* 설정 모달 */}
      {showSettings && (
        <div style={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>⚙️ 투표 설정</h3>

            <label style={styles.label}>내 이름 변경</label>
            <input
              style={styles.input}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="이름 입력"
            />

            <label style={{ ...styles.label, marginTop: '0.75rem' }}>투표 마감 일시 (팀 생성 후 기본 10분)</label>
            <input
              type="datetime-local"
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

      {/* HOME 나가기 확인 모달 */}
      {showHomeConfirm && (
        <div style={styles.modalOverlay} onClick={() => setShowHomeConfirm(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.75rem' }}>팀에서 나가기</h3>
            <p style={{ color: '#555', fontSize: '0.9rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              나가면 로컬 정보가 삭제됩니다.<br />
              재참여하려면 초대 링크가 필요합니다.
            </p>
            <button
              style={{ ...styles.btnPrimary, background: '#ef4444', marginBottom: '0.5rem' }}
              onClick={() => { storage.clear(); navigate('/'); }}
            >
              나가기
            </button>
            <button style={styles.btnClose} onClick={() => setShowHomeConfirm(false)}>취소</button>
          </div>
        </div>
      )}

      {/* 식당 상세 Bottom Sheet */}
      {selectedRestaurant && (() => {
        const r = selectedRestaurant;
        const isOked  = myOkMenu === r.name;
        const isPassed = myPassSet.has(r.name);
        const okCount  = getOkCount(r.name);
        const passCount = getPassCount(r.name);
        return (
          <div style={styles.sheetOverlay} onClick={() => setSelectedRestaurant(null)}>
            <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
              {/* 핸들 */}
              <div style={styles.sheetHandle} />

              {/* 식당 이름 + 카테고리 */}
              <h2 style={styles.sheetTitle}>{r.name}</h2>
              <p style={styles.sheetCategory}>{r.category}</p>

              {/* 기본 정보 */}
              <div style={styles.sheetInfoBox}>
                <div style={styles.sheetRow}>
                  <span style={styles.sheetIcon}>📍</span>
                  <span>{r.address || '주소 정보 없음'}</span>
                </div>
                {r.phone && (
                  <div style={styles.sheetRow}>
                    <span style={styles.sheetIcon}>📞</span>
                    <a href={`tel:${r.phone}`} style={styles.sheetLink}>{r.phone}</a>
                  </div>
                )}
                <div style={styles.sheetRow}>
                  <span style={styles.sheetIcon}>📏</span>
                  <span>{r.distance}m 거리</span>
                </div>
              </div>

              {/* 한줄 소개 */}
              {r.description && (
                <p style={styles.sheetDesc}>💬 {r.description}</p>
              )}

              {/* 투표 현황 */}
              {(okCount > 0 || passCount > 0) && (
                <div style={styles.sheetVoteStatus}>
                  {okCount > 0 && <span style={styles.sheetOkBadge}>👍 {okCount}명 괜찮아요</span>}
                  {passCount > 0 && <span style={styles.sheetPassBadge}>👎 {passCount}명 패스</span>}
                </div>
              )}

              {/* 네이버 리뷰 보기 */}
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.sheetNaverBtn}
                >
                  🔍 네이버에서 리뷰 보기
                </a>
              )}

              {/* 투표 버튼 */}
              {!isVotingClosed && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                  {isOked ? (
                    <button
                      style={{ ...styles.btnOk, flex: 1, background: '#15803d', padding: '0.65rem' }}
                      onClick={() => { handleOk(r); setSelectedRestaurant(null); }}
                      title="다시 누르면 취소"
                    >
                      ✓ 괜찮아요 (취소)
                    </button>
                  ) : (
                    <button
                      style={{ ...styles.btnOk, flex: 1, opacity: myOkMenu ? 0.3 : 1, cursor: myOkMenu ? 'not-allowed' : 'pointer', padding: '0.65rem' }}
                      onClick={() => { handleOk(r); setSelectedRestaurant(null); }}
                      disabled={!!myOkMenu}
                    >
                      👍 괜찮아요
                    </button>
                  )}
                  {!isOked && (
                    isPassed ? (
                      <button
                        style={{ ...styles.btnPass, flex: 1, padding: '0.65rem', background: '#fecaca', color: '#b91c1c' }}
                        onClick={() => { handlePass(r); setSelectedRestaurant(null); }}
                        title="다시 누르면 취소"
                      >
                        ✗ 패스 (취소)
                      </button>
                    ) : (
                      <button
                        style={{ ...styles.btnPass, flex: 1, padding: '0.65rem' }}
                        onClick={() => { handlePass(r); setSelectedRestaurant(null); }}
                      >
                        👎 패스
                      </button>
                    )
                  )}
                </div>
              )}

              <button style={styles.btnClose} onClick={() => setSelectedRestaurant(null)}>닫기</button>
            </div>
          </div>
        );
      })()}

      {/* 토스트 알림 */}
      {toastMsg && (
        <div style={styles.toast}>{toastMsg}</div>
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

        {restaurants.length === 0 && !loadingRestaurants && (
          <p style={styles.locationHint}>
            📍 현재 위치를 기반으로 반경 1km 내 식당을 검색합니다. 위치 권한 허용이 필요합니다.
          </p>
        )}
        <button
          style={styles.btnPrimary}
          onClick={fetchNearby}
          disabled={loadingRestaurants}
        >
          {loadingRestaurants ? '검색 중...' : '📍 내 주변 식당 찾기'}
        </button>

        {locationError && <p style={{ color: 'red', margin: '0.5rem 0' }}>오류: {locationError}</p>}
        {loadingVotes && <p style={{ color: '#999' }}>투표 현황 불러오는 중...</p>}

        {restaurants.length > 0 && (() => {
          const CATEGORY_ORDER = ['한식', '중식', '일식', '양식', '분식', '기타'];
          const CATEGORY_EMOJI = { 한식: '🍚', 중식: '🥢', 일식: '🍣', 양식: '🍝', 분식: '🥙', 기타: '🍴' };

          // 정렬
          const sortedList = sortBy === 'distance'
            ? [...restaurants].sort((a, b) => a.distance - b.distance)
            : restaurants; // 기본: 리뷰 많은 순

          // 패스 숨기기 필터
          const displayList = hidePassedItems
            ? sortedList.filter((r) => !myPassSet.has(r.name))
            : sortedList;

          const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
            const items = displayList.filter((r) => r.mainCategory === cat);
            if (items.length) acc.push({ cat, items });
            return acc;
          }, []);

          return (
          <section style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ ...styles.sectionTitle, margin: 0 }}>
                주변 식당 {displayList.length}곳
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 'normal', marginLeft: '0.4rem' }}>
                  ({sortBy === 'review' ? '리뷰 많은 순' : '거리 가까운 순'})
                </span>
              </h2>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  style={{ ...styles.sortBtn, background: sortBy === 'review' ? '#ff6b35' : '#f3f4f6', color: sortBy === 'review' ? '#fff' : '#374151' }}
                  onClick={() => setSortBy('review')}
                >리뷰순</button>
                <button
                  style={{ ...styles.sortBtn, background: sortBy === 'distance' ? '#ff6b35' : '#f3f4f6', color: sortBy === 'distance' ? '#fff' : '#374151' }}
                  onClick={() => setSortBy('distance')}
                >거리순</button>
                {myPassSet.size > 0 && (
                  <button
                    style={{ ...styles.sortBtn, background: hidePassedItems ? '#6b7280' : '#f3f4f6', color: hidePassedItems ? '#fff' : '#374151' }}
                    onClick={() => setHidePassedItems((v) => !v)}
                  >{hidePassedItems ? '패스 보기' : '패스 숨김'}</button>
                )}
              </div>
            </div>
            {!isVotingClosed && !myOkMenu && (
              <p style={styles.voteHint}>💡 식당 1곳에만 '괜찮아요'를 누를 수 있어요. 선택 후 다시 누르면 취소됩니다.</p>
            )}
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
                      <strong
                        style={{ fontSize: '1rem', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}
                        onClick={() => setSelectedRestaurant(r)}
                      >{r.name}</strong>
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
                            <button
                              style={{ ...styles.btnOk, background: '#15803d' }}
                              onClick={() => handleOk(r)}
                              title="다시 누르면 취소"
                            >
                              ✓ 취소
                            </button>
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
                              <button
                                style={{ ...styles.btnPass, background: '#fecaca', color: '#b91c1c' }}
                                onClick={() => handlePass(r)}
                                title="다시 누르면 취소"
                              >
                                ✗ 취소
                              </button>
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
        {/* 이번 주 먹은 메뉴 */}
        {weekHistory.length > 0 && (
          <section style={{ marginTop: '1.5rem' }}>
            <button
              style={styles.weekToggleBtn}
              onClick={() => setShowWeekHistory((v) => !v)}
            >
              📅 이번 주 먹은 메뉴 ({weekHistory.length}개) {showWeekHistory ? '▲' : '▼'}
            </button>
            {showWeekHistory && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
                {weekHistory.map((menu, i) => (
                  <li key={i} style={{ padding: '0.45rem 0.75rem', fontSize: '0.9rem', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                    🍱 {menu}
                  </li>
                ))}
              </ul>
            )}
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
    padding: '0.5rem 1.5rem', fontSize: '0.85rem', color: '#dc2626',
    fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem',
  },
  bannerResultBtn: {
    padding: '0.25rem 0.75rem', fontSize: '0.82rem', background: '#dc2626',
    color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
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
  voteHint: {
    fontSize: '0.8rem', color: '#6b7280', margin: '0.5rem 0 0.75rem',
    background: '#f3f4f6', borderRadius: '6px', padding: '0.4rem 0.75rem',
  },
  locationHint: {
    fontSize: '0.82rem', color: '#6b7280', margin: '0 0 0.5rem',
    background: '#f9fafb', borderRadius: '6px', padding: '0.5rem 0.75rem',
    border: '1px solid #e5e7eb',
  },
  sortBtn: {
    padding: '0.25rem 0.6rem', fontSize: '0.75rem', border: 'none',
    borderRadius: '5px', cursor: 'pointer', fontWeight: '600',
  },
  toast: {
    position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
    background: '#1f2937', color: '#fff', padding: '0.65rem 1.25rem',
    borderRadius: '8px', fontSize: '0.9rem', zIndex: 500,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  weekToggleBtn: {
    width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.85rem',
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px',
    cursor: 'pointer', textAlign: 'left', fontWeight: '600', color: '#374151',
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
  sheetOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200,
  },
  sheet: {
    background: '#fff', borderRadius: '20px 20px 0 0',
    padding: '1rem 1.5rem 2rem', width: '100%', maxWidth: '600px',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
    maxHeight: '85vh', overflowY: 'auto',
  },
  sheetHandle: {
    width: '40px', height: '4px', borderRadius: '2px',
    background: '#d1d5db', margin: '0 auto 1rem',
  },
  sheetTitle: { margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: '700' },
  sheetCategory: { margin: '0 0 1rem', fontSize: '0.85rem', color: '#ff6b35', fontWeight: '600' },
  sheetInfoBox: {
    background: '#f9fafb', borderRadius: '10px', padding: '0.75rem 1rem',
    marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  sheetRow: { display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem', color: '#374151' },
  sheetIcon: { flexShrink: 0 },
  sheetLink: { color: '#2563eb', textDecoration: 'none' },
  sheetDesc: {
    fontSize: '0.85rem', color: '#6b7280', background: '#f3f4f6',
    borderRadius: '8px', padding: '0.6rem 0.75rem', margin: '0 0 0.75rem',
    lineHeight: 1.5,
  },
  sheetVoteStatus: {
    display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap',
  },
  sheetOkBadge: {
    fontSize: '0.85rem', color: '#15803d', background: '#dcfce7',
    borderRadius: '999px', padding: '0.25rem 0.75rem', fontWeight: '600',
  },
  sheetPassBadge: {
    fontSize: '0.85rem', color: '#b91c1c', background: '#fee2e2',
    borderRadius: '999px', padding: '0.25rem 0.75rem', fontWeight: '600',
  },
  sheetNaverBtn: {
    display: 'block', textAlign: 'center', width: '100%',
    padding: '0.7rem', background: '#03c75a', color: '#fff',
    border: 'none', borderRadius: '10px', fontSize: '0.95rem',
    fontWeight: '700', textDecoration: 'none', marginBottom: '0.75rem',
    boxSizing: 'border-box',
  },
  linkBox: {
    background: '#f5f5f5', borderRadius: '8px', padding: '0.75rem',
    fontSize: '0.8rem', wordBreak: 'break-all', color: '#333',
  },
};
