import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotes } from '../hooks/useVotes';
import { useNearbyRestaurants, CATEGORIES } from '../hooks/useNearbyRestaurants';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { useTeam } from '../hooks/useTeam';
import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
import VoteCard from '../components/VoteCard';
import WaitingScreen from '../components/WaitingScreen';
import ResultScreen from '../components/ResultScreen';
import HistoryScreen from '../components/HistoryScreen';

const APP_URL = 'https://lunchpick.pages.dev';

export default function Vote() {
  const navigate = useNavigate();
  const { teamId, memberName, teamName, inviteCode, soloMode } = storage.load();
  const inviteLink = inviteCode ? `${APP_URL}/join/${inviteCode}` : null;
  const isSolo = soloMode && !teamId;

  const [screen, setScreen] = useState('vote');
  const [cardIndex, setCardIndex] = useState(0);
  const [members, setMembers] = useState([]);
  const [currentMemberName, setCurrentMemberName] = useState(memberName);
  const [voteHistory, setVoteHistory] = useState([]); // 되돌리기용

  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editDeadline, setEditDeadline] = useState('');
  const [editMinVoters, setEditMinVoters] = useState(2);
  const [editName, setEditName] = useState('');
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const { votes, weekMenuSet, loading: loadingVotes, castVote, clearVotes, cancelVote, cancelPass, okCountByMenu, passCountByMenu } = useVotes(teamId);
  const { restaurants, allRestaurants, loading: loadingRestaurants, error: locationError, fetchNearby, selectedCategory, filterByCategory } = useNearbyRestaurants(weekMenuSet);
  const { settings, updateSettings, saving, deadlineDisplay, memberCount } = useTeamSettings(teamId);
  const { changeName } = useTeam();

  useEffect(() => {
    if (!isSolo && !teamId && !memberName) navigate('/');
  }, [teamId, memberName, navigate, isSolo]);

  useEffect(() => {
    if (!teamId || isSolo) return;
    supabase.from('members').select('id, name').eq('team_id', teamId)
      .then(({ data }) => { if (data) setMembers(data); });
  }, [teamId, isSolo]);

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

  if (!isSolo && !teamId && !memberName) return null;

  const menus = restaurants.map((r) => r.name);
  const completedNames = new Set(
    members.map((m) => m.name).filter((name) => {
      const count = votes.filter((v) => v.voter_name === name).length;
      return allRestaurants.length > 0 && count >= allRestaurants.length;
    })
  );

  const allMenuNames = [...new Set([...Object.keys(okCountByMenu), ...Object.keys(passCountByMenu)])];
  const results = allMenuNames.map((name) => ({ name, ok: okCountByMenu[name] ?? 0, pass: passCountByMenu[name] ?? 0 }));

  const handleSwipe = async (result) => {
    const menu = menus[cardIndex];
    if (!menu) return;
    setVoteHistory((prev) => [...prev, { menu, action: result, index: cardIndex }]);
    try {
      await castVote(menu, result, currentMemberName);
    } catch (err) {
      showToast('⚠️ 투표 저장 실패: ' + (err.message || '네트워크 오류'));
    }
    const next = cardIndex + 1;
    setCardIndex(next);
    if (next >= menus.length) {
      if (isSolo) {
        setScreen('result');
      } else {
        setScreen('done');
        setTimeout(() => setScreen('waiting'), 1800);
      }
    }
  };

  const handleUndo = async () => {
    if (voteHistory.length === 0 || cardIndex <= 0) return;
    const last = voteHistory[voteHistory.length - 1];
    setVoteHistory((prev) => prev.slice(0, -1));
    setCardIndex((prev) => prev - 1);
    try {
      if (last.action === 'ok') await cancelVote(last.menu, currentMemberName);
      else await cancelPass(last.menu, currentMemberName);
    } catch (err) {
      showToast('⚠️ 되돌리기 실패');
    }
    if (screen === 'done' || screen === 'waiting') setScreen('vote');
  };

  const handleRestart = async () => {
    try { await clearVotes(); } catch (err) { showToast('⚠️ 초기화 실패'); }
    setCardIndex(0);
    setVoteHistory([]);
    setScreen('vote');
  };

  const handleSaveSettings = async () => {
    try {
      const tasks = [updateSettings({ vote_deadline: editDeadline, min_voters: Number(editMinVoters) })];
      const trimmed = editName.trim();
      if (trimmed && trimmed !== currentMemberName) {
        tasks.push(changeName(teamId, currentMemberName, trimmed).then(() => {
          setCurrentMemberName(trimmed);
          storage.save({ ...storage.load(), memberName: trimmed });
        }));
      }
      await Promise.all(tasks);
      setShowSettings(false);
      showToast('✅ 설정이 저장됐습니다.');
    } catch (err) { showToast('❌ 저장 실패: ' + err.message); }
  };

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500); };
  const copyLink = async () => {
    if (!inviteLink) return;
    try { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt('아래 링크를 복사하세요:', inviteLink); }
  };
  const handleShare = async () => {
    if (!inviteLink) return;
    if (navigator.share) await navigator.share({ title: '런치픽 팀 초대', text: '오늘 점심 같이 골라요!', url: inviteLink });
    else { navigator.clipboard.writeText(inviteLink); showToast('📋 링크가 복사됐습니다!'); }
  };

  // ── 공통 헤더 ──
  const Header = () => (
    <header style={st.header}>
      <div>
        <h1 style={st.headerTitle}>🍽️ 런치픽</h1>
        <p style={st.headerSub}>
          {isSolo ? '솔로 모드' : `${teamName} · ${currentMemberName} · 팀원 ${memberCount ?? '?'}명`}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {!isSolo && inviteLink && (
          <button style={st.btnChip} onClick={() => setShowInvite(true)}>👥 초대</button>
        )}
        <button style={st.btnChip} onClick={() => setShowHistory(true)}>📋</button>
        {!isSolo && <button style={st.btnChip} onClick={() => setShowSettings(true)}>⚙️</button>}
        <button style={st.btnChipDanger} onClick={() => setShowHomeConfirm(true)}>나가기</button>
      </div>
    </header>
  );

  // ── 공통 모달 ──
  const Modals = () => (
    <>
      {showSettings && (
        <div style={st.modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={st.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={st.modalTitle}>⚙️ 투표 설정</h3>
            <label style={st.label}>내 이름 변경</label>
            <input style={st.input} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="이름 입력" />
            <label style={{ ...st.label, marginTop: '0.75rem' }}>투표 마감 일시</label>
            <input type="datetime-local" style={st.input} value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
            <label style={{ ...st.label, marginTop: '0.75rem' }}>최소 참여 인원</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button style={st.stepBtn} onClick={() => setEditMinVoters((n) => Math.max(1, n - 1))}>−</button>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', minWidth: '24px', textAlign: 'center' }}>{editMinVoters}</span>
              <button style={st.stepBtn} onClick={() => setEditMinVoters((n) => n + 1)}>+</button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>명 이상</span>
            </div>
            <button style={{ ...st.btnPrimary, marginTop: '1.25rem' }} onClick={handleSaveSettings} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            <button style={st.btnClose} onClick={() => setShowSettings(false)}>닫기</button>
          </div>
        </div>
      )}
      {showInvite && (
        <div style={st.modalOverlay} onClick={() => setShowInvite(false)}>
          <div style={st.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={st.modalTitle}>팀원 초대하기</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>아래 링크를 공유하면 팀원이 바로 참여할 수 있어요</p>
            <div style={st.linkBox}>{inviteLink}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button style={st.btnSecondary} onClick={copyLink}>{copied ? '✓ 복사됨' : '링크 복사'}</button>
              <button style={st.btnKakao} onClick={handleShare}>공유하기</button>
            </div>
            <button style={st.btnClose} onClick={() => setShowInvite(false)}>닫기</button>
          </div>
        </div>
      )}
      {showHomeConfirm && (
        <div style={st.modalOverlay} onClick={() => setShowHomeConfirm(false)}>
          <div style={st.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={st.modalTitle}>{isSolo ? '솔로 모드 종료' : '팀에서 나가기'}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              {isSolo ? '솔로 모드를 종료하고 홈으로 돌아갑니다.' : '나가면 로컬 정보가 삭제됩니다.\n재참여하려면 초대 링크가 필요합니다.'}
            </p>
            <button style={{ ...st.btnPrimary, background: '#ef4444', boxShadow: 'var(--shadow-glow-red)', marginBottom: '0.5rem' }} onClick={() => { storage.clear(); navigate('/'); }}>나가기</button>
            <button style={st.btnClose} onClick={() => setShowHomeConfirm(false)}>취소</button>
          </div>
        </div>
      )}
      {showHistory && <HistoryScreen teamId={teamId} onClose={() => setShowHistory(false)} />}
      {toastMsg && <div style={st.toast}>{toastMsg}</div>}
    </>
  );

  // ── 투표 완료 확인 화면 ──
  if (screen === 'done') {
    return (
      <div style={st.doneBg}>
        <div style={st.doneCard}>
          <span style={{ fontSize: '64px', lineHeight: 1 }}>🎉</span>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)' }}>투표 완료!</h2>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-secondary)' }}>{currentMemberName}님의 투표가 저장됐어요</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>팀원들의 투표를 기다리는 중...</p>
        </div>
      </div>
    );
  }

  // ── 대기 화면 ──
  if (screen === 'waiting') {
    return (
      <div style={{ fontFamily: 'var(--font-family)', minHeight: '100dvh' }}>
        <Header /><Modals />
        <WaitingScreen members={members} completedNames={completedNames} onAllCompleted={() => setScreen('result')} />
      </div>
    );
  }

  // ── 결과 화면 ──
  if (screen === 'result') {
    return (
      <div style={{ fontFamily: 'var(--font-family)', minHeight: '100dvh' }}>
        <Header /><Modals />
        <ResultScreen teamId={teamId} results={results} onRestart={handleRestart} isSolo={isSolo} />
      </div>
    );
  }

  // ── 투표 화면 (기본) ──
  return (
    <div style={{ fontFamily: 'var(--font-family)', minHeight: '100dvh', background: 'var(--bg-base)' }}>
      <Header /><Modals />

      {!isSolo && deadlineDisplay && (
        <div style={st.openBanner}>⏰ {deadlineDisplay} 마감</div>
      )}

      <main style={st.main}>
        {restaurants.length === 0 ? (
          <div style={st.searchSection}>
            <p style={st.searchDesc}>📍 현재 위치를 기반으로 반경 1km 내 식당을 검색합니다.</p>
            <button style={st.btnPrimary} onClick={fetchNearby} disabled={loadingRestaurants}>
              {loadingRestaurants ? '검색 중...' : '📍 내 주변 식당 찾기'}
            </button>
            {locationError && <p style={{ color: 'var(--accent-red)', marginTop: '0.5rem', fontSize: '0.85rem' }}>⚠️ {locationError}</p>}
            {loadingVotes && <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.85rem' }}>투표 현황 불러오는 중...</p>}
          </div>
        ) : (
          <div style={st.voteSection}>
            {/* 카테고리 필터 칩 */}
            <div style={st.categoryBar}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  style={selectedCategory === cat ? st.catChipActive : st.catChip}
                  onClick={() => filterByCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {menus.length === 0 ? (
              <div style={st.emptyFilter}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>해당 카테고리에 식당이 없어요</p>
                <button style={{ ...st.catChipActive, marginTop: '0.5rem' }} onClick={() => filterByCategory('전체')}>전체 보기</button>
              </div>
            ) : cardIndex < menus.length ? (
              <>
                <p style={st.voteGuide}>스와이프하거나 버튼을 눌러 투표하세요</p>
                <VoteCard
                  menus={menus}
                  currentIndex={cardIndex}
                  onSwipe={handleSwipe}
                  onUndo={handleUndo}
                  canUndo={voteHistory.length > 0 && cardIndex > 0}
                  restaurantInfo={restaurants}
                />
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>잠시만 기다려 주세요...</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const st = {
  doneBg: { minHeight: '100dvh', background: 'var(--bg-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-family)' },
  doneCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 40px', background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-card)', textAlign: 'center', maxWidth: '320px', width: '90%', animation: 'bounceIn 0.5s ease' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.2rem', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 },
  headerTitle: { margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' },
  headerSub: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' },
  openBanner: { background: 'rgba(255,107,53,0.1)', borderBottom: '1px solid rgba(255,107,53,0.2)', padding: '0.5rem 1.5rem', fontSize: '0.85rem', color: 'var(--accent-orange)', textAlign: 'center' },
  main: { padding: '1.5rem 1rem', maxWidth: '520px', margin: '0 auto' },
  searchSection: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  searchDesc: { fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.9rem', border: '1px solid var(--border-subtle)', margin: 0 },
  voteSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' },
  voteGuide: { fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center' },
  categoryBar: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '0.5rem' },
  catChip: { padding: '6px 14px', fontSize: '13px', fontWeight: '600', background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-full)', cursor: 'pointer', transition: 'all 0.15s' },
  catChipActive: { padding: '6px 14px', fontSize: '13px', fontWeight: '700', background: 'var(--accent-gradient)', color: '#fff', border: '1px solid transparent', borderRadius: 'var(--radius-full)', cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,107,53,0.3)' },
  emptyFilter: { textAlign: 'center', padding: '2rem 0' },
  btnPrimary: { padding: '0.75rem 1.5rem', fontSize: '1rem', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 'bold', width: '100%', boxShadow: 'var(--shadow-glow-orange)' },
  btnChip: { padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' },
  btnChipDanger: { padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' },
  btnSecondary: { padding: '0.6rem 0.75rem', fontSize: '0.9rem', background: 'var(--bg-card)', color: 'var(--accent-orange)', border: '2px solid var(--accent-orange)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 'bold', flex: 1 },
  btnKakao: { padding: '0.6rem 0.75rem', fontSize: '0.9rem', background: '#FEE500', color: '#191919', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 'bold', flex: 1 },
  btnClose: { marginTop: '0.75rem', width: '100%', padding: '0.6rem', fontSize: '0.9rem', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' },
  stepBtn: { width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--text-primary)' },
  label: { display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: '600' },
  input: { width: '100%', padding: '0.6rem 0.75rem', fontSize: '1rem', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', color: 'var(--text-primary)', outline: 'none' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' },
  modal: { background: 'var(--bg-modal)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', width: '100%', maxWidth: '360px', boxShadow: 'var(--shadow-card)' },
  modalTitle: { margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '700' },
  linkBox: { background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontSize: '0.8rem', wordBreak: 'break-all', color: 'var(--text-muted)' },
  toast: { position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.95)', border: '1px solid var(--border-card)', color: '#fff', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', zIndex: 500, boxShadow: 'var(--shadow-card)', animation: 'slideUp 0.3s ease' },
};
