// ===================== 装备/遗物生成 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { log } from '../ui/effects.js';

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
    console.warn("[妖塔勇者录] 装备注册表为空，返回保底装备");
    return { icon: "🗡️", name: "破剑", prefix: "", fullName: "破剑", stat: "atk", val: 3, color: "#8899bb", qualityName: "普通", type: "weapon", _combatEffect: null, _zoneSet: null };
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
        if (biasStat === 'dodge' && t.stat === 'dodge') return true;
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
  // v0.60: 收集非主属性的前缀加成（之前只应用匹配装备类型的属性）
  var extraStats = {};
  if (p.statBonus) {
    Object.keys(p.statBonus).forEach(function(k) {
      if (k === t.stat) { val += p.statBonus[k]; }
      else { extraStats[k] = p.statBonus[k]; }
    });
  }
  if (val <= 0) val = 1;
  // 命名：区域独有名 > 前缀+通用名
  const displayName = equipName || t.name;
  const fullName = (p.name ? p.name + '·' : '') + displayName;
  const combatEffect = p.combatEffect ? { ...p.combatEffect } : null;
  return {
    icon: t.icon, name: displayName, prefix: p.name || '', fullName,
    stat: t.stat, val: val, color: q.color, qualityName: q.name, type: t.type,
    _combatEffect: combatEffect, _zoneSet: zone?.equipSet || null,
    _extraStats: extraStats
  };
}

// ---- 遗物生成（使用难度 legendRate + Zone 专属池）----
export function genRelic() {
  const s = Game.state;
  const rng = (s && s.rng) ? s.rng : { next: () => Math.random(), pick: (arr) => arr[Math.floor(Math.random() * arr.length)], chance: (p) => Math.random() < p, range: (min, max) => min + Math.floor(Math.random() * (max - min + 1)), shuffle: (arr) => { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; } };
  // v0.51: 遗物保底 — 连续3场战斗无遗物，强制掉落
  if (s && s._relicPity >= 3) {
    s._relicPity = 0;
    var commons = (R.get('relics') || []).filter(function(r) { return r.rarity === 'common'; });
    if (commons.length > 0) { log('🍀 运势积累！遗物降临！', 'win'); return { ...rng.pick(commons) }; }
  }
  // 正常生成后重置保底计数器
  if (s) s._relicPity = 0;
  const diff = R.get('difficulties', s?.difficulty) || R.get('difficulties', 'standard');
  const legendRate = diff.legendRate || 0.02;
  // 诅咒"恐惧"/"贫困"：遗物掉率翻倍（提高稀有度分布）
  const luckyMul = (s?.player?._fearLucky || s?.player?._poorLucky || s?.player?._luckyCharm) ? 1.8 : 1;
  // v0.51: 天赋树遗物加成
  var relicRateBonus = (s && s.player && s.player._talentRelicRate) ? s.player._talentRelicRate : 0;
  var rareWtBonus = (s && s.player && s.player._talentRareWeight) ? s.player._talentRareWeight : 0;
  var totalMul = luckyMul + relicRateBonus + rareWtBonus;
  const weights = {
    common: Math.floor(40 / totalMul), rare: Math.floor(30 * totalMul),
    epic: Math.floor(20 * totalMul),
    legendary: Math.floor(10 * (legendRate / 0.02) * totalMul)
  };

  // Zone 专属遗物池：50% 概率从当前区域池中抽取
  const allRelics = R.get('relics');
  // v0.50 大学士研究加成 + 保底：出现率基础10% + 每局未遇+1%
  var studiedId = Game.meta ? Game.meta.studiedRelic : '';
  var todayStr = new Date().toDateString();
  if (studiedId && Game.meta.studiedDate === todayStr) {
    var pity = Game.meta.studiedPity || 0;
    var studiedChance = 0.10 + pity * 0.01; // 基础10% + 保底每局+1%
    if (rng.next() < studiedChance) {
      var studiedRelic = allRelics.find(function(r) { return r.id === studiedId; });
      if (studiedRelic) return { ...studiedRelic };
    }
  }
  let pool = allRelics;
  if (s.zone && s.zone.relicPool && rng.next() < 0.5) {
    pool = s.zone.relicPool.map(id => allRelics.find(r => r.id === id)).filter(Boolean);
    if (pool.length === 0) pool = allRelics;
  }

  // v0.51: 核心遗物不会直接掉落（只能通过虚空交易合成获得）
  pool = pool.filter(function(r) { return !r.category || r.category !== 'core'; });
  if (pool.length === 0) pool = allRelics.filter(function(r) { return (!r.category || r.category !== 'core') && r.rarity !== 'legendary'; });

  // 追猎目标加成：选中的遗物出现率×5
  var huntTargets = s && s.huntTargets ? s.huntTargets : [];
  const list = pool.map(r => {
    var w = weights[r.rarity] || 10;
    if (huntTargets.indexOf(r.id) >= 0) w = Math.floor(w * 5); // 追猎加成5倍
    return { r, w };
  });
  if (list.length === 0) {
    console.warn("[妖塔勇者录] 遗物池为空，返回保底遗物");
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
// v0.60 已废弃：被 genRelic() 取代（含权重/难度/追猎等完整逻辑）
// 保留导出以兼容旧代码
export function randomRelic(rng) { return { ...rng.pick(R.get('relics')) }; }
