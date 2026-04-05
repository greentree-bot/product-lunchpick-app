import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const isValidUUID = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * 팀 투표 설정 (마감 시간, 최소 참여 인원)
 * 팀 테이블에 vote_deadline TEXT, min_voters INTEGER 컬럼 필요
 */
export function useTeamSettings(teamId) {
  const [settings, setSettings] = useState({ vote_deadline: '11:30', min_voters: 2 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamId || !isValidUUID(teamId)) return;
    supabase
      .from('teams')
      .select('vote_deadline, min_voters')
      .eq('id', teamId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSettings({
            vote_deadline: data.vote_deadline ?? '11:30',
            min_voters: data.min_voters ?? 2,
          });
        }
      });
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

  // 현재 투표가 마감됐는지
  const isVotingClosed = (() => {
    if (!settings.vote_deadline) return false;
    const [hh, mm] = settings.vote_deadline.split(':').map(Number);
    const deadline = new Date();
    deadline.setHours(hh, mm, 0, 0);
    return new Date() > deadline;
  })();

  return { settings, updateSettings, saving, isVotingClosed };
}
