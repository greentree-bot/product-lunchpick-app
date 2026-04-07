import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const isValidUUID = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * 팀 투표 설정 (마감 시간, 최소 참여 인원, 팀원 수)
 * vote_deadline: "HH:MM" (레거시) 또는 "YYYY-MM-DDTHH:MM" (신규)
 */
export function useTeamSettings(teamId) {
  const [settings, setSettings] = useState({ vote_deadline: '', min_voters: 2 });
  const [saving, setSaving] = useState(false);
  const [memberCount, setMemberCount] = useState(null);

  useEffect(() => {
    if (!teamId || !isValidUUID(teamId)) return;

    supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        setSettings({
          vote_deadline: data.vote_deadline ?? '',
          min_voters: data.min_voters ?? 2,
        });
      });

    // 팀원 수 조회
    supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .then(({ count }) => setMemberCount(count ?? 0));
  }, [teamId]);

  const updateSettings = async (newSettings) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update(newSettings)
        .eq('id', teamId);
      if (error) throw error;
      setSettings((prev) => ({ ...prev, ...newSettings }));
    } finally {
      setSaving(false);
    }
  };

  // 마감 여부: "YYYY-MM-DDTHH:MM" 또는 레거시 "HH:MM" 모두 지원
  const isVotingClosed = (() => {
    const dl = settings.vote_deadline;
    if (!dl) return false;
    if (dl.includes('T')) {
      // 신규 형식: 날짜 포함 — 정확한 비교
      return new Date() > new Date(dl);
    }
    // 레거시 HH:MM — 오늘 날짜 기준으로만 비교
    const [hh, mm] = dl.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return false;
    const deadline = new Date();
    deadline.setHours(hh, mm, 0, 0);
    return new Date() > deadline;
  })();

  // 배너/UI 표시용 시간 (HH:MM 만)
  const deadlineDisplay = (() => {
    const dl = settings.vote_deadline;
    if (!dl) return '';
    return dl.includes('T') ? dl.slice(11, 16) : dl;
  })();

  return { settings, updateSettings, saving, isVotingClosed, deadlineDisplay, memberCount };
}
