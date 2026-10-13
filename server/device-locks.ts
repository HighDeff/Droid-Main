// All production device writers share these locks, including paired native sessions.
export const deviceLocks = new Set<string>();
