import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 팀 투표 현황 실시간 구독 + 투표 저장 + 히스토리 조회
 * @param {string} teamId - teams.id (uuid)
 */
const isValidUUID = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function useVotes(teamId) {
  const [votes, setVotes] = useState([]);           // 현재 라운드 투표 목록
  const [todayHistory, setTodayHistory] = useState([]); // 오늘 먹은 메뉴
  const [weekHistory, setWeekHistory] = useState([]);   // 이번 주 먹은 메뉴 (반복 방지용)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── 오늘 날짜 (YYYY-MM-DD) ───────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);

  // ─── 이번 주 월요일 날짜 ──────────────────────────────────────────────────
  const getMonday = () => {
    const d = new Date();
    const day = d.getDay(); // 0=일, 1=월 ... 6=토
    const diff = day === 0 ? -6 : 1 - day; // 일요일이면 -6, 나머지는 월요일로
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  };

  // ─── 오늘 히스토리 불러오기 ───────────────────────────────────────────────
  const fetchTodayHistory = useCallback(async () => {
    if (!teamId || !isValidUUID(teamId)) return;
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .eq('team_id', teamId)
      .eq('eaten_at', today)
      .order('created_at', { ascending: false });

    if (error) setError(error);
    else setTodayHistory(data);
  }, [teamId, today]);

  // ─── 이번 주 히스토리 불러오기 (반복 방지용) ─────────────────────────────
  const fetchWeekHistory = useCallback(async () => {
    if (!teamId || !isValidUUID(teamId)) return;
    const monday = getMonday();
    const { data, error } = await supabase
      .from('history')
      .select('menu_name')
      .eq('team_id', teamId)
      .gte('eaten_at', monday)
      .lte('eaten_at', today);

    if (error) setError(error);
    else setWeekHistory([...new Set(data.map((h) => h.menu_name))]); // 중복 제거
  }, [teamId, today]);

  // ─── 현재 투표 목록 불러오기 ─────────────────────────────────────────────
  const fetchVotes = useCallback(async () => {
    if (!teamId || !isValidUUID(teamId)) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('team_id', teamId)
      .order('voted_at', { ascending: false });

    if (error) setError(error);
    else setVotes(data);
    setLoading(false);
  }, [teamId]);

  // ─── 초기 데이터 로드 + Realtime 구독 ────────────────────────────────────
  useEffect(() => {
    if (!teamId || !isValidUUID(teamId)) return;

    fetchVotes();
    fetchTodayHistory();
    fetchWeekHistory();

    // votes 테이블 실시간 구독 (REPLICA IDENTITY FULL 필요)
    const channel = supabase
      .channel(`votes:team:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setVotes((prev) => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setVotes((prev) =>
              prev.map((v) => (v.id === payload.new.id ? payload.new : v))
            );
          } else if (payload.eventType === 'DELETE') {
            setVotes((prev) => prev.filter((v) => v.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchVotes, fetchTodayHistory, fetchWeekHistory]);

  // ─── 투표 저장 (ok / pass) ────────────────────────────────────────────────
  /**
   * @param {string} menuName  - 투표 대상 메뉴명
   * @param {'ok'|'pass'} action - 먹을게요 / 패스
   * @param {string} voterName - 투표자 이름
   */
  const castVote = async (menuName, action, voterName) => {
    if (!['ok', 'pass'].includes(action)) {
      throw new Error("action은 'ok' 또는 'pass'여야 합니다.");
    }

    // teamId가 없으면 로컬 상태에만 반영 (개인 모드)
    if (!teamId || !isValidUUID(teamId)) {
      const localVote = {
        id: `local-${Date.now()}`,
        team_id: null,
        menu_name: menuName,
        action,
        voter_name: voterName,
        voted_at: new Date().toISOString(),
      };
      setVotes((prev) => [...prev, localVote]);
      return localVote;
    }

    // 로컬 state 즉시 반영 (낙관적 업데이트)
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      team_id: teamId,
      menu_name: menuName,
      action,
      voter_name: voterName,
      voted_at: new Date().toISOString(),
    };
    setVotes((prev) => [...prev, optimistic]);

    // DB 백그라운드 저장
    const { data, error } = await supabase
      .from('votes')
      .insert({ team_id: teamId, menu_name: menuName, action, voter_name: voterName })
      .select()
      .single();

    if (error) {
      // 실패 시 낙관적 항목 롤백
      setVotes((prev) => prev.filter((v) => v.id !== optimistic.id));
      throw error;
    }

    // 서버 응답으로 낙관적 항목 교체
    setVotes((prev) => prev.map((v) => (v.id === optimistic.id ? data : v)));
    return data;
  };

  // ─── 팀 전원이 ok → history에 기록 ──────────────────────────────────────
  /**
   * @param {string} menuName - 최종 선택된 메뉴명
   */
  const recordToHistory = async (menuName) => {
    const { data, error } = await supabase
      .from('history')
      .insert({ team_id: teamId, menu_name: menuName, eaten_at: today })
      .select()
      .single();

    if (error) throw error;
    await Promise.all([fetchTodayHistory(), fetchWeekHistory()]);
    return data;
  };

  // ─── 현재 라운드 투표 전체 삭제 (다음 라운드 시작 시) ─────────────────────
  const clearVotes = async () => {
    const { error } = await supabase
      .from('votes')
      .delete()
      .eq('team_id', teamId);

    if (error) throw error;
    setVotes([]);
  };

  // ─── 파생 데이터 ──────────────────────────────────────────────────────────
  // 메뉴별 ok 수
  const okCountByMenu = votes
    .filter((v) => v.action === 'ok')
    .reduce((acc, v) => {
      acc[v.menu_name] = (acc[v.menu_name] || 0) + 1;
      return acc;
    }, {});

  // 이번 주에 이미 먹은 메뉴 Set (중복 방지 필터링용)
  const weekMenuSet = new Set(weekHistory);

  return {
    // 상태
    votes,
    todayHistory,
    weekHistory,
    weekMenuSet,
    loading,
    error,
    // 파생
    okCountByMenu,
    // 액션
    castVote,
    recordToHistory,
    clearVotes,
    // 수동 리프레시
    refetch: fetchVotes,
    refetchHistory: fetchTodayHistory,
  };
}
