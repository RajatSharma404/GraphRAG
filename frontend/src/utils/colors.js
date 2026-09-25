export const COMMUNITY_COLORS = [
  '#38bdf8', // Sky
  '#818cf8', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#ec4899', // Pink
  '#eab308', // Yellow
];

export function getCommunityColor(group) {
  const g = typeof group === 'number' ? group : parseInt(group, 10) || 0;
  return COMMUNITY_COLORS[Math.abs(g) % COMMUNITY_COLORS.length];
}
