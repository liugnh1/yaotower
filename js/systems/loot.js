// ===================== 装备/遗物生成 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';

// ---- 加权选择（基于 RNG）----
function weightedPick(arr, rng) {
  const total = arr.reduce((s, x) => s + (x.weight || 1), 0);
  let roll = rng.next() * total;
  for (const item of arr) {
    roll -= (item.weight || 1);
    if (roll <= 0) return item;
  }
  return arr[arr.length - 1];
}

// ---- 装备生成 ----
export function genEquip() {
  const s = Game.state;
  const rng = (s && s.rng) ? s.rng : { next: () => Math.random() };
  const q = weightedPick(R.get('equipQualities'), rng);
  const types = R.get('equipTypes');
  const t = types[Math.floor(rng.next() * types.length)];
  const prefixes = R.get('equipPrefixes');
  const p = prefixes[Math.floor(rng.next() * prefixes.length)];
  let val = Math.floor(t.base * q.mul);
  if (p.statBonus && p.statBonus[t.stat]) {
    val += p.statBonus[t.stat];
  }
  const fullName = p.name ? `${p.name}的${t.name}` : t.name;
  return {
    icon: t.icon, name: t.name, prefix: p.name || '', fullName,
    stat: t.stat, val: val, color: q.color, qualityName: q.name, type: t.type
  };
}

// ---- 遗物生成（使用难度 legendRate + Zone 专属池）----
export function genRelic() {
  const s = Game.state;
  const rng = (s && s.rng) ? s.rng : { next: () => Math.random() };
  const diff = R.get('difficulties', s?.difficulty) || R.get('difficulties', 'standard');
  const legendRate = diff.legendRate || 0.02;
  const weights = {
    common: 40, rare: 30, epic: 20,
    legendary: Math.floor(10 * (legendRate / 0.02))
  };

  // Zone 专属遗物池：50% 概率从当前区域池中抽取
  const allRelics = R.get('relics');
  let pool = allRelics;
  if (s.zone && s.zone.relicPool && rng.next() < 0.5) {
    pool = s.zone.relicPool.map(id => allRelics.find(r => r.id === id)).filter(Boolean);
    if (pool.length === 0) pool = allRelics; // 兜底
  }

  const list = pool.map(r => ({ r, w: weights[r.rarity] || 10 }));
  const total = list.reduce((sum, x) => sum + x.w, 0);
  let roll = rng.next() * total;
  for (const item of list) {
    roll -= item.w;
    if (roll <= 0) return { ...item.r };
  }
  return { ...pool[0] };
}

// ---- 从 Registry 随机获取一件遗物 ----
export function randomRelic(rng) {
  return { ...rng.pick(R.get('relics')) };
}
