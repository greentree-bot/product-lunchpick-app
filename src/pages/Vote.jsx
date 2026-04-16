import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotes } from '../hooks/useVotes';
import { useNearbyRestaurants } from '../hooks/useNearbyRestaurants';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { useTeam } from '../hooks/useTeam';
import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
import VoteCard from '../components/VoteCard';
import WaitingScreen from '../components/WaitingScreen';
import ResultScreen from '../components/ResultScreen';

const APP_URL = 'https://lunchpick.pages.dev';

// ─── 화면 상태 머신 ───────────────────────────────────────────────────────────
// 'vote'    : 식당 로드 + VoteCard 스와이프
// 'waiting' : 팀원 투표 완료 대기
// 'result'  : 결과 화면
// ─────────────────────────────────────────────────────────────────────────────

export default function Vote() {
  const navigate = useNavigate();
  const { teamId, memberName, teamName, inviteCode } = storage.load();
  const inviteLink = inviteCode ? `${APP_URL}/join/${inviteCode}` : null;

  // ── 화면 상태 ──────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState('vote'); // 'vote' | 'done' | 'waiting' | 'result'
  const [cardIndex, setCardIndex] = useState(0);
  const [members, setMembers] = useState([]);
  const [currentMemberName, setCurrentMemberName] = useState(memberName);

  // ── 모달 상태 ──────────────────────────────────────────────────────────────
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editDeadline, setEditDeadline] = useState('');
  const [editMinVoters, setEditMinVoters] = useState(2);
  const [editName, setEditName] = useState('');
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // ── 훅 ────────────────────────────────────────────────────────────────────
  const {
    votes,
    weekMenuSet,
    loading: loadingVotes,
    castVote,
    clearVotes,
    okCountByMenu,
    passCountByMenu,
  } = useVotes(teamId);

  const {
    restaurants,
    loading: loadingRestaurants,
    error: locationError,
    fetchNearby,
  } = useNearbyRestaurants(weekMenuSet);

  const {
    settings,
    updateSettings,
    saving,
    deadlineDisplay,
    memberCount,
  } = useTeamSettings(teamId);

  const { changeName } = useTeam();

  // ── 인증 가드 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamId || !memberName) navigate('/');
  }, [teamId, memberName, navigate]);

  // ── 팀원 목록 조회 (WaitingScreen용) ──────────────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    supabase
      .from('members')
      .select('id, name')
      .eq('team_id', teamId)
      .then(({ data }) => {
        if (data) setMembers(data);
      });
  }, [teamId]);

  // ── 설정 모달 열 때 현재값 복사 ────────────────────────────────────────────
  useEffect(() => {
    if (!showSettings) return;
    const dl = settings.vote_deadline;
    if (dl && !dl.includes('T')) {
      setEditDeadline(`${new Date().toISOString().slice(0, 10)}T${dl}`);
    } else {
      setEditDeadline(dl || '');
    }
    setEditMinVoters(settings.min_voters);
    setEditName(currentMemberName);
  }, [showSettings, settings, currentMemberName]);

  if (!teamId || !memberName) return null;

  // ── 파생 데이터 ────────────────────────────────────────────────────────────
  const menus = restaurants.map((r) => r.name);

  // 각 팀원이 모든 메뉴(= restaurants 수)에 투표했으면 "완료"로 간주
  const completedNames = new Set(
    members
      .map((m) => m.name)
      .filter((name) => {
        const count = votes.filter((v) => v.voter_name === name).length;
        return restaurants.length > 0 && count >= restaurants.length;
      })
  );

  // ResultScreen용 결과 배열
  const allMenuNames = [
    ...new Set([...Object.keys(okCountByMenu), ...Object.keys(passCountByMenu)]),
  ];
  const results = allMenuNames.map((name) => ({
    name,
    ok: okCountByMenu[name] ?? 0,
    pass: passCountByMenu[name] ?? 0,
  }));

  // ── 투표 핸들러 ────────────────────────────────────────────────────────────
  const handleSwipe = async (result) => {
    const menu = menus[cardIndex];
    if (!menu) return;

    try {
      await castVote(menu, result, currentMemberName);
    } catch (err) {
      console.error('[Vote] swipe 저장 실패:', err.message);
    }

    const next = cardIndex + 1;
    setCardIndex(next);

    if (next >= menus.length) {
      setScreen('done');
      setTimeout(() => setScreen('waiting'), 1800);
    }
  };

  const handleRestart = async () => {
    try {
      await clearVotes();
    } catch (err) {
      console.error('[Vote] 초기화 실패:', err.message);
    }
    setCardIndex(0);
    setScreen('vote');
  };

  // ── 설정 저장 ──────────────────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    try {
      const tasks = [
        updateSettings({ vote_deadline: editDeadline, min_voters: Number(editMinVoters) }),
      ];
      const trimmed = editName.trim();
      if (trimmed && trimmed !== currentMemberName) {
        tasks.push(
          changeName(teamId, currentMemberName, trimmed).then(() => {
            setCurrentMemberName(trimmed);
            storage.save({ ...storage.load(), memberName: trimmed });
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

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

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
      text: '오늘 점심 같이 골라요!',
      url: inviteLink,
    };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(inviteLink);
      alert('링크가 복사됐습니다! 카카오톡에 붙여넣기 하세요.');
    }
  };

  // ── 공통 헤더 ─────────────────────────────────────────────────────────────
  const Header = () => (
    <header style={styles.header}>
      <div>
        <h1 style={styles.headerTitle}>🍽️ 런치픽</h1>
        <p style={styles.headerSub}>
          {teamName} · {currentMemberName} · 팀원 {memberCount ?? '?'}명
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {inviteLink && (
          <button style={styles.btnInvite} onClick={() => setShowInvite(true)}>
            팀원 초대
          </button>
        )}
        <button style={styles.btnGhost} onClick={() => setShowSettings(true)}>
          ⚙️ 설정
        </button>
        <button style={styles.btnGhost} onClick={() => setShowHomeConfirm(true)}>
          HOME
        </button>
      </div>
    </header>
  );

  // ── 공통 모달 ─────────────────────────────────────────────────────────────
  const Modals = () => (
    <>
      {/* 설정 */}
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

            <label style={{ ...styles.label, marginTop: '0.75rem' }}>
              투표 마감 일시
            </label>
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
              >
                −
              </button>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', minWidth: '24px', textAlign: 'center' }}>
                {editMinVoters}
              </span>
              <button style={styles.stepBtn} onClick={() => setEditMinVoters((n) => n + 1)}>
                +
              </button>
              <span style={{ fontSize: '0.85rem', color: '#888' }}>명 이상</span>
            </div>

            <button
              style={{ ...styles.btnPrimary, marginTop: '1.25rem' }}
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button style={styles.btnClose} onClick={() => setShowSettings(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 초대 */}
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
              <button style={styles.btnKakao} onClick={handleShare}>
                공유하기
              </button>
            </div>
            <button style={styles.btnClose} onClick={() => setShowInvite(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* HOME 나가기 확인 */}
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
            <button style={styles.btnClose} onClick={() => setShowHomeConfirm(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toastMsg && <div style={styles.toast}>{toastMsg}</div>}
    </>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 투표 완료 확인 화면 (1.8초 후 대기 화면으로 자동 전환)
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'done') {
    return (
      <div style={styles.doneBg}>
        <div style={styles.doneCard}>
          <span style={styles.doneEmoji}>🎉</span>
          <h2 style={styles.doneTitle}>투표 완료!</h2>
          <p style={styles.doneSubtitle}>
            {currentMemberName}님의 투표가 저장됐어요
          </p>
          <p style={styles.doneHint}>팀원들의 투표를 기다리는 중...</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 대기 화면
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'waiting') {
    return (
      <div style={{ fontFamily: 'sans-serif', minHeight: '100dvh' }}>
        <Header />
        <Modals />
        <WaitingScreen
          members={members}
          completedNames={completedNames}
          onAllCompleted={() => setScreen('result')}
        />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 결과 화면
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'result') {
    return (
      <div style={{ fontFamily: 'sans-serif', minHeight: '100dvh' }}>
        <Header />
        <Modals />
        <ResultScreen
          teamId={teamId}
          results={results}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 투표 화면 (기본)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100dvh', background: '#f9fafb' }}>
      <Header />
      <Modals />

      {/* 마감 배너 */}
      {deadlineDisplay && (
        <div style={styles.openBanner}>
          ⏰ {deadlineDisplay} 마감
        </div>
      )}

      <main style={styles.main}>
        {restaurants.length === 0 ? (
          /* ── 식당 미로드: 검색 유도 ── */
          <div style={styles.searchSection}>
            <p style={styles.searchDesc}>
              📍 현재 위치를 기반으로 반경 1km 내 식당을 검색합니다.
            </p>
            <button
              style={styles.btnPrimary}
              onClick={fetchNearby}
              disabled={loadingRestaurants}
            >
              {loadingRestaurants ? '검색 중...' : '📍 내 주변 식당 찾기'}
            </button>
            {locationError && (
              <p style={{ color: 'red', marginTop: '0.5rem' }}>오류: {locationError}</p>
            )}
            {loadingVotes && (
              <p style={{ color: '#999', marginTop: '0.5rem' }}>투표 현황 불러오는 중...</p>
            )}
          </div>
        ) : (
          /* ── 식당 로드 완료: VoteCard ── */
          <div style={styles.voteSection}>
            {cardIndex < menus.length ? (
              <>
                <p style={styles.voteGuide}>
                  스와이프하거나 버튼을 눌러 투표하세요
                </p>
                <VoteCard
                  menus={menus}
                  currentIndex={cardIndex}
                  onSwipe={handleSwipe}
                />
              </>
            ) : (
              /* 모든 카드 소진 후 waiting으로 자동 전환되므로 여기는 fallback */
              <div style={styles.doneSection}>
                <p style={{ color: '#9ca3af', fontSize: '16px' }}>잠시만 기다려 주세요...</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  /* 투표 완료 확인 화면 */
  doneBg: {
    minHeight: '100dvh',
    backgroundColor: '#FFFBEB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'sans-serif',
  },
  doneCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '48px 40px',
    background: '#fff',
    borderRadius: '24px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
    textAlign: 'center',
    maxWidth: '320px',
    width: '90%',
    animation: 'fadeInUp 0.4s ease',
  },
  doneEmoji: {
    fontSize: '64px',
    lineHeight: 1,
    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))',
  },
  doneTitle: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '900',
    color: '#1f2937',
  },
  doneSubtitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600',
    color: '#374151',
  },
  doneHint: {
    margin: 0,
    fontSize: '13px',
    color: '#9ca3af',
  },

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
  openBanner: {
    background: '#fff7ed',
    borderBottom: '1px solid #fed7aa',
    padding: '0.5rem 1.5rem',
    fontSize: '0.85rem',
    color: '#c2410c',
    textAlign: 'center',
  },
  main: {
    padding: '2rem 1rem',
    maxWidth: '520px',
    margin: '0 auto',
  },
  searchSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  searchDesc: {
    fontSize: '0.85rem',
    color: '#6b7280',
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '0.6rem 0.9rem',
    border: '1px solid #e5e7eb',
    margin: 0,
  },
  voteSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  voteGuide: {
    fontSize: '0.85rem',
    color: '#9ca3af',
    margin: 0,
    textAlign: 'center',
  },
  doneSection: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '3rem',
  },
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
  btnInvite: {
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    background: '#FEE500',
    color: '#191919',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  btnSecondary: {
    padding: '0.6rem 0.75rem',
    fontSize: '0.9rem',
    background: '#fff',
    color: '#ff6b35',
    border: '2px solid #ff6b35',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    flex: 1,
  },
  btnKakao: {
    padding: '0.6rem 0.75rem',
    fontSize: '0.9rem',
    background: '#FEE500',
    color: '#191919',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    flex: 1,
  },
  btnClose: {
    marginTop: '0.75rem',
    width: '100%',
    padding: '0.6rem',
    fontSize: '0.9rem',
    background: 'transparent',
    color: '#999',
    border: 'none',
    cursor: 'pointer',
  },
  stepBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid #ddd',
    background: '#f9fafb',
    fontSize: '1.1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    color: '#555',
    marginBottom: '0.4rem',
    fontWeight: '600',
  },
  input: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    boxSizing: 'border-box',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '1rem',
  },
  modal: {
    background: '#fff',
    borderRadius: '14px',
    padding: '1.5rem',
    width: '100%',
    maxWidth: '360px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  linkBox: {
    background: '#f5f5f5',
    borderRadius: '8px',
    padding: '0.75rem',
    fontSize: '0.8rem',
    wordBreak: 'break-all',
    color: '#333',
  },
  toast: {
    position: 'fixed',
    bottom: '1.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1f2937',
    color: '#fff',
    padding: '0.65rem 1.25rem',
    borderRadius: '8px',
    fontSize: '0.9rem',
    zIndex: 500,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
};
