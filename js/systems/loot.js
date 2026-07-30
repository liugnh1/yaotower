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

// ---- 装备生成（v0.35：区域套装+深度缩放）----
export function genEquip(zoneId) {
  const s = Game.state;
  const rng = (s && s.rng) ? s.rng : { next: () => Math.random(), pick: (arr) => arr[Math.floor(Math.random() * arr.length)], chance: (p) => Math.random() < p, range: (min, max) => min + Math.floor(Math.random() * (max - min + 1)), shuffle: (arr) => { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; } };
  const qualities = R.get('equipQualities');
  const types = R.get('equipTypes');
  const prefixes = R.get('equipPrefixes');
  if (!qualities.length || !types.length) {
    console.warn("[妖塔] 装备注册表为空，返回保底装备");
    return { icon: "🗡️", name: "破剑", prefix: "", fullName: "破剑", stat: "atk", val: 3, color: "#8899bb", qualityName: "普通", type: "weapon" };
  }

  // 深度缩放：随总层数提高品质权重
  const depth = s ? (s.totalFloor || 1) : 1;
  const depthMul = Math.min(3, 1 + depth * 0.03); // 1.0 ~ 3.0
  const scaledQualities = qualities.map(q => {
    let w = q.weight;
    if (q.mul >= 4.0) w = Math.floor(w * depthMul);        // 传说/神话在高层的权重提高
    else if (q.mul <= 0.5) w = Math.max(2, w - depth);      // 破旧在高层的权重降低
    return { ...q, weight: Math.max(0.5, w) };
  });

  // 区域偏向：30%概率从区域对应装备类型中选，使用区域独有名字
  const zone = zoneId ? R.get('zones', zoneId) : (s?.zone || null);
  let typePick = types[Math.floor(rng.next() * types.length)];
  let equipName = null;
  if (zone && zone.equipSet && rng.next() < 0.30) {
    // 区域装备偏向该Zone主题属性
    const zoneBias = zone.equipBonus ? Object.keys(zone.equipBonus) : [];
    if (zoneBias.length > 0) {
      const biasStat = zoneBias[Math.floor(rng.next() * zoneBias.length)];
      const matched = types.filter(t => {
        const s = t.stat;
        if (s === biasStat) return true;
        if (biasStat === 'atk' && s === 'atk') return true;
        if (biasStat === 'def' && s === 'def') return true;
        if (biasStat === 'maxHp' && s === 'maxHp') return true;
        if (biasStat === 'maxMp' && s === 'maxMp') return true;
        if (biasStat === 'critRate' && s === 'critRate') return true;
        if (biasStat === 'lifeSteal' && s === 'atk') return true;
        if (biasStat === 'dmgReduce' && s === 'def') return true;
        if (biasStat === 'pen' && s === 'atk') return true;
        if (biasStat === 'critMul' && s === 'critRate') return true;
        return false;
      });
      if (matched.length > 0) typePick = rng.pick(matched);
    }
    // 使用Zone独有装备名
    if (zone.equipNames && zone.equipNames[typePick.type]) {
      equipName = zone.equipNames[typePick.type];
    }
  }

  const q = weightedPick(scaledQualities, rng);
  const t = typePick;
  const p = prefixes.length ? prefixes[Math.floor(rng.next() * prefixes.length)] : { name: '', statBonus: {} };
  let val = Math.floor(t.base * q.mul);
  if (p.statBonus && p.statBonus[t.stat]) {
    val += p.statBonus[t.stat];
  }
  if (val <= 0) val = 1;
  // 命名：区域独有名 > 前缀+通用名
  const displayName = equipName || t.name;
  const fullName = (p.name ? p.name + '·' : '') + displayName;
  const combatEffect = p.combatEffect ? { ...p.combatEffect } : null;
  return {
    icon: t.icon, name: displayName, prefix: p.name || '', fullName,
    stat: t.stat, val: val, color: q.color, qualityName: q.name, type: t.type,
    _combatEffect: combatEffect, _zoneSet: zone?.equipSet || null
  };
}

// ---- 遗物生成（使用难度 legendRate + Zone 专属池）----
export function genRelic() {
  const s = Game.state;
  const rng = (s && s.rng) ? s.rng : { next: () => Math.random(), pick: (arr) => arr[Math.floor(Math.random() * arr.length)], chance: (p) => Math.random() < p, range: (min, max) => min + Math.floor(Math.random() * (max - min + 1)), shuffle: (arr) => { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; } };
  const diff = R.get('difficulties', s?.difficulty) || R.get('difficulties', 'standard');
  const legendRate = diff.legendRate || 0.02;
  // 诅咒"恐惧"/"贫困"：遗物掉率翻倍（提高稀有度分布）
  const luckyMul = (s?.player?._fearLucky || s?.player?._poorLucky || s?.player?._luckyCharm) ? 1.8 : 1;
  const weights = {
    common: Math.floor(40 / luckyMul), rare: Math.floor(30 * luckyMul),
    epic: Math.floor(20 * luckyMul),
    legendary: Math.floor(10 * (legendRate / 0.02) * luckyMul)
  };

  // Zone 专属遗物池：50% 概率从当前区域池中抽取
  const allRelics = R.get('relics');
  // 大学士研究加成：今天研究过的遗物出现率提升
  var studiedId = Game.meta ? Game.meta.studiedRelic : '';
  var todayStr = new Date().toDateString();
  if (studiedId && Game.meta.studiedDate === todayStr && rng.next() < 0.12) {
    var studiedRelic = allRelics.find(function(r) { return r.id === studiedId; });
    if (studiedRelic) return { ...studiedRelic };
  }
  let pool = allRelics;
  if (s.zone && s.zone.relicPool && rng.next() < 0.5) {
    pool = s.zone.relicPool.map(id => allRelics.find(r => r.id === id)).filter(Boolean);
    if (pool.length === 0) pool = allRelics;
  }

  // 追猎目标加成：选中的遗物出现率×5
  var huntTargets = s && s.huntTargets ? s.huntTargets : [];
  const list = pool.map(r => {
    var w = weights[r.rarity] || 10;
    if (huntTargets.indexOf(r.id) >= 0) w = Math.floor(w * 5); // 追猎加成5倍
    return { r, w };
  });
  if (list.length === 0) {
    console.warn("[妖塔] 遗物池为空，返回保底遗物");
    return { id: "vamp_fang", name: "吸血獠牙", icon: "🦷", rarity: "common", desc: "攻击恢复12%伤害的生命", onAttack: (p, dmg) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(dmg * 0.12)); } };
  }
  const total = list.reduce((sum, x) => sum + x.w, 0);
  let roll = rng.next() * total;
  for (const item of list) {
    roll -= item.w;
    if (roll <= 0) {
      return { ...item.r };
    }
  }
  return { ...list[0].r };
}

// ---- 从 Registry 随机获取一件遗物 ----
export function randomRelic(rng) {
  return { ...rng.pick(R.get('relics')) };
}
