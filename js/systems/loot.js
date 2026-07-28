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
  const qualities = R.get('equipQualities');
  const types = R.get('equipTypes');
  const prefixes = R.get('equipPrefixes');
  // 空池守卫
  if (!qualities.length || !types.length) {
    console.warn("[妖塔] 装备注册表为空，返回保底装备");
    return { icon: "🗡️", name: "破剑", prefix: "", fullName: "破剑", stat: "atk", val: 3, color: "#8899bb", qualityName: "普通", type: "weapon" };
  }
  const q = weightedPick(qualities, rng);
  const t = types[Math.floor(rng.next() * types.length)];
  const p = prefixes.length ? prefixes[Math.floor(rng.next() * prefixes.length)] : { name: '', statBonus: {} };
  let val = Math.floor(t.base * q.mul);
  if (p.statBonus && p.statBonus[t.stat]) {
    val += p.statBonus[t.stat];
  }
  if (val <= 0) val = 1; // 防止暗影前缀导致 val=0 的废装备
  const fullName = p.name ? `${p.name}的${t.name}` : t.name;
  const combatEffect = p.combatEffect ? { ...p.combatEffect } : null;
  return {
    icon: t.icon, name: t.name, prefix: p.name || '', fullName,
    stat: t.stat, val: val, color: q.color, qualityName: q.name, type: t.type,
    _combatEffect: combatEffect
  };
}

// ---- 遗物生成（使用难度 legendRate + Zone 专属池）----
export function genRelic() {
  const s = Game.state;
  const rng = (s && s.rng) ? s.rng : { next: () => Math.random() };
  const diff = R.get('difficulties', s?.difficulty) || R.get('difficulties', 'standard');
  const legendRate = diff.legendRate || 0.02;
  // 诅咒"恐惧"/"贫困"：遗物掉率翻倍（提高稀有度分布）
  const luckyMul = (s?.player?._fearLucky || s?.player?._poorLucky) ? 1.8 : 1;
  const weights = {
    common: Math.floor(40 / luckyMul), rare: Math.floor(30 * luckyMul),
    epic: Math.floor(20 * luckyMul),
    legendary: Math.floor(10 * (legendRate / 0.02) * luckyMul)
  };

  // Zone 专属遗物池：50% 概率从当前区域池中抽取
  const allRelics = R.get('relics');
  let pool = allRelics;
  if (s.zone && s.zone.relicPool && rng.next() < 0.5) {
    pool = s.zone.relicPool.map(id => allRelics.find(r => r.id === id)).filter(Boolean);
    if (pool.length === 0) pool = allRelics; // 兜底
  }

  const list = pool.map(r => ({ r, w: weights[r.rarity] || 10 }));
  if (list.length === 0) {
    console.warn("[妖塔] 遗物池为空，返回保底遗物");
    return { id: "power_brace", name: "力量护腕", icon: "💪", rarity: "common", desc: "攻击力+5", passive: (p) => { p.atk += 5; }, onRemove: (p) => { p.atk = Math.max(1, p.atk - 5); } };
  }
  const total = list.reduce((sum, x) => sum + x.w, 0);
  let roll = rng.next() * total;
  for (const item of list) {
    roll -= item.w;
    if (roll <= 0) return { ...item.r };
  }
  return { ...list[0].r };
}

// ---- 从 Registry 随机获取一件遗物 ----
export function randomRelic(rng) {
  return { ...rng.pick(R.get('relics')) };
}
