const KEYS = {
  teamId: 'lunchpick_teamId',
  memberName: 'lunchpick_memberName',
  teamName: 'lunchpick_teamName',
  inviteCode: 'lunchpick_inviteCode',
};

export const storage = {
  save({ teamId, memberName, teamName, inviteCode }) {
    localStorage.setItem(KEYS.teamId, teamId);
    localStorage.setItem(KEYS.memberName, memberName);
    localStorage.setItem(KEYS.teamName, teamName);
    if (inviteCode) localStorage.setItem(KEYS.inviteCode, inviteCode);
  },
  load() {
    return {
      teamId: localStorage.getItem(KEYS.teamId),
      memberName: localStorage.getItem(KEYS.memberName),
      teamName: localStorage.getItem(KEYS.teamName),
      inviteCode: localStorage.getItem(KEYS.inviteCode),
    };
  },
  clear() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
