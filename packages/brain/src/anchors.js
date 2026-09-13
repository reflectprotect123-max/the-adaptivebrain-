export function confirmAnchor({ unit, observations }) {
  const obs = (observations || []).filter((n) => typeof n === 'number');
  if (obs.length < 2) return { confidence: 'provisional', anchor: obs[0] ?? null };
  const a = obs[0];
  const b = obs[1];
  const mid = (a + b) / 2;
  const ok = unit === 'rpm' ? Math.abs(b - a) <= 1 : Math.abs(b - a) / Math.abs(mid) <= 0.03;
  if (!ok) return { confidence: 'provisional', anchor: null };
  return { confidence: 'confirmed', anchor: mid };
}
