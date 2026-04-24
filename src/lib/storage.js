const KEYS = {
  teamId: 'lunchpick_teamId',
  memberName: 'lunchpick_memberName',
  teamName: 'lunchpick_teamName',
  inviteCode: 'lunchpick_inviteCode',
  soloMode: 'lunchpick_soloMode',
};

export const storage = {
  save({ teamId, memberName, teamName, inviteCode, soloMode }) {
    if (teamId) localStorage.setItem(KEYS.teamId, teamId);
    if (memberName) localStorage.setItem(KEYS.memberName, memberName);
    if (teamName) localStorage.setItem(KEYS.teamName, teamName);
    if (inviteCode) localStorage.setItem(KEYS.inviteCode, inviteCode);
    if (soloMode !== undefined) localStorage.setItem(KEYS.soloMode, soloMode ? 'true' : 'false');
  },
  load() {
    return {
      teamId: localStorage.getItem(KEYS.teamId),
      memberName: localStorage.getItem(KEYS.memberName),
      teamName: localStorage.getItem(KEYS.teamName),
      inviteCode: localStorage.getItem(KEYS.inviteCode),
      soloMode: localStorage.getItem(KEYS.soloMode) === 'true',
    };
  },
  clear() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
