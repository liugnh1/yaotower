// ===================== 全局状态管理 =====================
import { RNG } from "./rng.js";
import { R } from "./registry.js";
import { E, Events } from "./event-bus.js";

const SAVE_KEY = "yaotower_v3.1_save";
const SAVE_VERSION = 1; // 存档版本号，改数据结构时递增
const META_KEY = "yaotower_v3.1_meta";
const CODEX_KEY = "yaotower_v3.1_codex";
const LB_KEY   = "yaotower_v3.1_lb";

let _render = null;
export function onRender(fn) { _render = fn; }

function fix(v, d) { return (typeof v === "number" && !isNaN(v)) ? v : d; }

// ---- 玩家属性序列化：自动保存所有自有属性 ----
function serializePlayer(p) {
  if (!p) return null;
  const out = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (typeof v === 'function') continue;
    if (v !== undefined && v !== null && typeof v !== 'object') out[k] = v;
    else if (k === 'debuffAtk' && v) out[k] = { ...v };
  }
  return out;
}

function deserializePlayer(bp) {
  return {
    hp: fix(bp.hp, 100), maxHp: fix(bp.maxHp, 100), mp: fix(bp.mp, 20), maxMp: fix(bp.maxMp, 20),
    atk: fix(bp.atk, 15), def: fix(bp.def, 2),
    critRate: fix(bp.critRate, 0.2), critMul: fix(bp.critMul, 1.5),
    skillMul: fix(bp.skillMul, 1.5), mpCost: fix(bp.mpCost, 10), pen: fix(bp.pen, 0),
    lifeSteal: bp.lifeSteal || 0, thorn: bp.thorn || 0, goldMul: bp.goldMul || 1,
    dodge: bp.dodge || 0, bleed: bp.bleed || 0, rage: !!bp.rage,
    doubleFirst: !!bp.doubleFirst, debuffAtk: bp.debuffAtk || null,
    dmgReduce: bp.dmgReduce || 0, berserk: !!bp.berserk,
    rebirth: !!bp.rebirth, regen: bp.regen || 0,
    // 诅咒/遗物临时字段
    _weakHpLoss: bp._weakHpLoss, _slowDefLoss: bp._slowDefLoss,
    _poorGoldLoss: bp._poorGoldLoss, _orbOrigCost: bp._orbOrigCost,
    _mysticOrigCost: bp._mysticOrigCost, _chaosOrigPen: bp._chaosOrigPen,
    _tempHp: bp._tempHp || 0
  };
}

// ---- 默认状态 ----
function defState() {
  return {
    seed: "", rng: null, mode: "simple", difficulty: "standard",
    zone: null, zoneIndex: 0, floorInZone: 1, totalFloor: 1,
    roomQueue: [], roomIndex: 0,
    player: null, enemy: null, gold: 0,
    equip: [], relics: [], potions: [],
    talent: null, playerClass: null, activeSkill: null, curses: [],
    codex: {}, highest: 1, auto: false, turn: 0, turnInFloor: 0,
    defending: false, nextBoost: 0, gameOver: false,
    stats: { totalDmg: 0, critCount: 0, roomsCleared: 0 },
    dailyMods: { globalId: null, playerId: null, enemyId: null },
    potionAtk: 0, potionDef: 0,
    adDiscount: false, adRefreshCount: 0,
    endless: false, _activeSynergies: []
  };
}

function defMeta() {
  return {
    tp: 0, unlocks: ["warrior", "mage"], charExp: { warrior: 0, mage: 0 },
    upgrades: {}, highestSimple: 0, highestNormal: 0,
    adWatched: 0, adDate: "", totalRuns: 0, totalWins: 0, totalDeaths: 0,
    dailyBest: 0, dailyDate: "", achievements: []
  };
}

// ---- Game 对象 ----
export const Game = {
  state: defState(),
  meta: defMeta(),

  init() { this._loadMeta(); this._loadCodex(); },

  set(u) { if (u) Object.assign(this.state, u); this.save(); if (_render) _render(this.state); },
  sync() { this.save(); if (_render) _render(this.state); },

  // ---- 存档 ----
  save() {
    const s = this.state;
    const data = {
      version: SAVE_VERSION,
      seed: s.seed, mode: s.mode, difficulty: s.difficulty,
      zone: s.zone ? s.zone.id : null, zoneIndex: s.zoneIndex,
      floorInZone: s.floorInZone, totalFloor: s.totalFloor,
      roomQueue: s.roomQueue, roomIndex: s.roomIndex,
      gold: s.gold, equip: s.equip, potions: s.potions,
      relics: s.relics.map(r => ({ id: r.id, applied: !!r.applied })),
      curses: s.curses.map(c => c.id),
      talent: s.talent ? s.talent.id : null,
      playerClass: s.playerClass ? s.playerClass.id : null,
      activeSkill: s.activeSkill ? s.activeSkill.id : null,
      endless: s.endless, turn: s.turn, stats: s.stats,
      dailyMods: s.dailyMods,
      basePlayer: serializePlayer(s.player),
      enemy: s.enemy ? serializeEnemy(s.enemy) : null,
      potionAtk: s.potionAtk || 0, potionDef: s.potionDef || 0,
      adDiscount: s.adDiscount || false, adRefreshCount: s.adRefreshCount || 0,
      turnInFloor: s.turnInFloor || 0
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { console.error("妖塔3.0: 存档保存失败", e); }
    this._persistCodex();
  },

  load() {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    try {
      const d = JSON.parse(raw), s = this.state;
      // 版本不兼容：自动重置存档
      if (d.version !== SAVE_VERSION) { console.warn("存档版本不兼容，已重置"); this.deleteSave(); return false; }
      s.seed = d.seed || ("" + Date.now()); s.rng = new RNG(s.seed);
      s.mode = d.mode || "simple"; s.difficulty = d.difficulty || "standard";
      s.zoneIndex = d.zoneIndex || 0; s.floorInZone = d.floorInZone || 1;
      s.totalFloor = d.totalFloor || 1; s.roomQueue = d.roomQueue || [];
      s.roomIndex = d.roomIndex || 0; s.gold = d.gold || 0;
      s.zone = d.zone ? R.get('zones', d.zone) : null;
      s.equip = d.equip || []; s.potions = d.potions || [];
      s.curses = (d.curses || []).map(id => R.get('curses').find(c => c.id === id)).filter(Boolean);
      s.relics = (d.relics || []).map(r => {
        const rel = R.get('relics').find(x => x.id === r.id);
        if (rel) { const c = { ...rel }; c.applied = !!r.applied; return c; }
        return null;
      }).filter(Boolean);
      s.talent = d.talent ? R.get('talents').find(t => t.id === d.talent) : null;
      s.playerClass = d.playerClass ? R.get('classes', d.playerClass) : null;
      s.activeSkill = d.activeSkill && s.playerClass ? s.playerClass.skills.find(sk => sk.id === d.activeSkill) : null;
      s.endless = !!d.endless; s.turn = d.turn || 0; s.stats = d.stats || { totalDmg: 0, critCount: 0, roomsCleared: 0 };
      s.dailyMods = d.dailyMods || { globalId: null, playerId: null, enemyId: null };
      s.player = d.basePlayer ? deserializePlayer(d.basePlayer) : null;
      // 注意: 遗物 passive 效果已包含在 basePlayer 数值中，读档不需要重跑 passive
      // 否则会造成属性双重叠加（如力量护腕+5攻被重复加到存档的 atk 值上）
      s.enemy = d.enemy ? deserializeEnemy(d.enemy) : null;
      s.potionAtk = d.potionAtk || 0; s.potionDef = d.potionDef || 0;
      s.adDiscount = d.adDiscount || false; s.adRefreshCount = d.adRefreshCount || 0;
      s.auto = false; s.defending = false; s.nextBoost = 0;
      s.turnInFloor = d.turnInFloor || 0; s.gameOver = false;
      this._loadCodex();
      return true;
    } catch (e) { console.error("load fail", e); return false; }
  },

  hasSave() { return !!localStorage.getItem(SAVE_KEY); },
  deleteSave() { localStorage.removeItem(SAVE_KEY); },

  // ---- 元数据 ----
  _loadMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) this.meta = { ...defMeta(), ...JSON.parse(raw) };
    } catch (e) { this.meta = defMeta(); }
    this._checkAdReset();
  },
  saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); } catch (e) { console.error("妖塔3.0: 元数据保存失败", e); } },

  _checkAdReset() {
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (this.meta.adDate !== today) { this.meta.adDate = today; this.meta.adWatched = 0; this.saveMeta(); }
  },

  addTP(n) { this.meta.tp += n; this.saveMeta(); },
  canWatchAd() {
    this._checkAdReset();
    const diff = R.get('difficulties', this.state.difficulty) || R.get('difficulties', 'standard');
    return this.meta.adWatched < diff.adLimit;
  },
  watchAd() {
    this._checkAdReset();
    const diff = R.get('difficulties', this.state.difficulty) || R.get('difficulties', 'standard');
    if (this.meta.adWatched >= diff.adLimit) return false;
    this.meta.adWatched++; this.saveMeta(); return true;
  },

  // ---- 局外成长（修复隐形陷阱）----
  applyMetaBonus(p) {
    const up = this.meta.upgrades;
    if (up.atkBonus)  p.atk  = Math.floor(p.atk  * (1 + up.atkBonus));
    if (up.hpBonus)   { p.maxHp = Math.floor(p.maxHp * (1 + up.hpBonus)); p.hp = Math.floor(p.hp * (1 + up.hpBonus)); }
    if (up.defBonus)  p.def  = Math.floor(p.def * (1 + up.defBonus));
    if (up.critBonus) p.critRate += up.critBonus;
    if (up.goldBonus) p.goldMul = (p.goldMul || 1) * (1 + up.goldBonus);
  },

  // 获取开局药水数量（修复 startPotion 陷阱）
  getStartPotions() {
    const count = this.meta.upgrades?.startPotion || 0;
    if (count <= 0) return [];
    const potionPool = R.get('potions').filter(p => p.id !== 'cleanse');
    const result = [];
    for (let i = 0; i < count; i++) result.push({ ...potionPool[i % potionPool.length] });
    return result;
  },

  // 广告收益加成（修复 adRewardBonus 陷阱）
  getAdTPBonus() {
    return 1 + (this.meta.upgrades?.adRewardBonus || 0);
  },

  // ---- 角色经验 ----
  addCharExp(charId, exp) {
    if (!this.meta.charExp[charId]) this.meta.charExp[charId] = 0;
    this.meta.charExp[charId] += exp;
    this.saveMeta();
  },

  // ---- 图鉴 ----
  recordKill(name, floor, data) {
    const c = this.state.codex;
    if (!c[name]) c[name] = { name, floor, kills: 0, hp: data.maxHp || 0, atk: data.atk || 0, def: data.def || 0 };
    c[name].kills++; c[name].lastFloor = floor;
    this._persistCodex();
  },
  _persistCodex() {
    try {
      const ex = JSON.parse(localStorage.getItem(CODEX_KEY) || "{}");
      localStorage.setItem(CODEX_KEY, JSON.stringify({ ...ex, ...this.state.codex }));
    } catch (e) { console.error("妖塔3.0: 图鉴保存失败", e); }
  },
  _loadCodex() {
    try { const raw = localStorage.getItem(CODEX_KEY); if (raw) this.state.codex = JSON.parse(raw); }
    catch (e) { this.state.codex = {}; }
  },
  getAllCodex() {
    try { return JSON.parse(localStorage.getItem(CODEX_KEY) || "{}"); }
    catch (e) { return {}; }
  },

  // ---- 排行榜 ----
  addLeaderboard(entry) {
    try {
      const list = JSON.parse(localStorage.getItem(LB_KEY) || "[]");
      const d = new Date(); const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      list.push({ ...entry, date: dateStr });
      list.sort((a, b) => b.floor - a.floor);
      localStorage.setItem(LB_KEY, JSON.stringify(list.slice(0, 20)));
    } catch (e) { console.error("妖塔3.0: 排行榜保存失败", e); }
  },
  getLeaderboard() {
    try { return JSON.parse(localStorage.getItem(LB_KEY) || "[]"); }
    catch (e) { return []; }
  },

  // ---- 成就 ----
  unlockAchievement(id) {
    if (!this.meta.achievements.includes(id)) {
      this.meta.achievements.push(id);
      this.saveMeta();
      Events.emit(E.META_UPGRADED, { type: 'achievement', id });
    }
  },

  hardReset() {
    const c = this.state.codex, h = this.state.highest;
    this.state = defState(); this.state.codex = c; this.state.highest = h;
    this.deleteSave();
  }
};

// ---- 敌人序列化 ----
function serializeEnemy(e) {
  return {
    name: e.name, hp: e.hp, maxHp: e.maxHp, atk: e.atk, def: e.def,
    tags: e.tags.map(t => ({ id: t.id, name: t.name })),
    aiTurn: e.aiTurn || 0, aiCharge: e.aiCharge || false, chargeTurns: e.chargeTurns || 0,
    aiCurse: e.aiCurse || false, doubleFirst: e.doubleFirst || false,
    lifeSteal: e.lifeSteal || 0, thorn: e.thorn || 0
  };
}

function deserializeEnemy(d) {
  return {
    name: d.name, hp: d.hp, maxHp: d.maxHp, atk: d.atk, def: d.def,
    tags: (d.tags || []).map(t => {
      const tag = R.get('monsterTags').find(mt => mt.id === t.id);
      return tag ? { ...tag } : { ...t };
    }),
    aiTurn: d.aiTurn || 0, aiCharge: d.aiCharge || false, chargeTurns: d.chargeTurns || 0,
    aiCurse: d.aiCurse || false, doubleFirst: d.doubleFirst || false,
    lifeSteal: d.lifeSteal || 0, thorn: d.thorn || 0
  };
}
