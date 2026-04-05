import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';

/**
 * 팀 생성 / 초대코드로 팀 참여
 */
export function useTeam() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── 팀 생성 + 팀장을 members에 등록 ────────────────────────────────────
  const createTeam = async (teamName, memberName) => {
    setLoading(true);
    setError(null);
    try {
      // 생성 시각 + 10분을 기본 마감 시간으로 설정
      const deadline = (() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 10);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      })();

      // 1. teams 테이블에 팀 생성
      const { data: team, error: teamErr } = await supabase
        .from('teams')
        .insert({ name: teamName, vote_deadline: deadline, min_voters: 2 })
        .select()
        .single();
      if (teamErr) throw teamErr;

      // 2. members 테이블에 팀장 등록
      const { error: memberErr } = await supabase
        .from('members')
        .insert({ team_id: team.id, name: memberName });
      if (memberErr) throw memberErr;

      // 3. localStorage 저장 (invite_code 포함)
      storage.save({ teamId: team.id, memberName, teamName: team.name, inviteCode: team.invite_code });

      return team; // { id, name, invite_code, created_at }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─── 초대코드로 팀 조회 ──────────────────────────────────────────────────
  const getTeamByCode = async (inviteCode) => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();
    if (error) throw new Error('유효하지 않은 초대 코드입니다.');
    return data;
  };

  // ─── 초대코드로 팀 참여 ──────────────────────────────────────────────────
  const joinTeam = async (inviteCode, memberName) => {
    setLoading(true);
    setError(null);
    try {
      // 1. 초대코드로 팀 조회
      const team = await getTeamByCode(inviteCode);

      // 2. members 테이블에 등록
      const { error: memberErr } = await supabase
        .from('members')
        .insert({ team_id: team.id, name: memberName });
      if (memberErr) throw memberErr;

      // 3. localStorage 저장 (invite_code 포함)
      storage.save({ teamId: team.id, memberName, teamName: team.name, inviteCode: team.invite_code });

      return team;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createTeam, joinTeam, getTeamByCode, loading, error };
}
