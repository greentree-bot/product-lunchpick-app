const KEYS = {
  teamId: 'lunchpick_teamId',
  memberName: 'lunchpick_memberName',
  teamName: 'lunchpick_teamName',
};

export const storage = {
  save({ teamId, memberName, teamName }) {
    localStorage.setItem(KEYS.teamId, teamId);
    localStorage.setItem(KEYS.memberName, memberName);
    localStorage.setItem(KEYS.teamName, teamName);
  },
  load() {
    return {
      teamId: localStorage.getItem(KEYS.teamId),
      memberName: localStorage.getItem(KEYS.memberName),
      teamName: localStorage.getItem(KEYS.teamName),
    };
  },
  clear() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
