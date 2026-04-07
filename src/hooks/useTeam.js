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
      // 생성 시각 + 10분을 기본 마감으로 설정 (ISO datetime 형식)
      const deadline = (() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 10);
        // "YYYY-MM-DDTHH:MM" — 날짜 포함으로 다음날 오작동 방지
        return d.toISOString().slice(0, 16);
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

      // 2. 동일 이름 중복 체크
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('team_id', team.id)
        .eq('name', memberName)
        .maybeSingle();
      if (existingMember) {
        throw new Error(`이미 "${memberName}" 이름의 팀원이 있습니다. 다른 이름(예: ${memberName}2)을 사용해 주세요.`);
      }

      // 3. members 테이블에 등록
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

  // ─── 이름 변경 ──────────────────────────────────────────────────────────
  const changeName = async (teamId, oldName, newName) => {
    setLoading(true);
    setError(null);
    try {
      // 중복 체크
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('team_id', teamId)
        .eq('name', newName)
        .maybeSingle();
      if (existing) throw new Error(`이미 "${newName}" 이름의 팀원이 있습니다.`);

      const { error: updateErr } = await supabase
        .from('members')
        .update({ name: newName })
        .eq('team_id', teamId)
        .eq('name', oldName);
      if (updateErr) throw updateErr;

      // localStorage 업데이트
      storage.save({ ...storage.load(), memberName: newName });
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createTeam, joinTeam, getTeamByCode, changeName, loading, error };
}
