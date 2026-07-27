// ===================== 全局状态 + 双轨存档系统 =====================
import { RNG } from "./rng.js";
import { CLASSES, TALENTS, RELICS, CURSES, META_LIMITS, DIFFICULTIES, ZONES, SIMPLE_ROUTE } from "./config.js";

const SAVE_KEY = "yaotower_v3_save";
const META_KEY = "yaotower_v3_meta";
const CODEX_KEY = "yaotower_v3_codex";
const LB_KEY   = "yaotower_v3_lb";

let _render = null;
export function onRender(fn) { _render = fn; }

function fix(v, d) { return (typeof v === "number" && !isNaN(v)) ? v : d; }

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
    dailyMods: { global: null, player: null, enemy: null },
    potionAtk: 0, potionDef: 0,
    adDiscount: false, adRefreshCount: 0,
    endless: false
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

export const Game = {
  state: defState(),
  meta: defMeta(),

  init() { this._loadMeta(); this._loadCodex(); },

  set(u) { if (u) Object.assign(this.state, u); this.save(); if (_render) _render(this.state); },
  sync() { this.save(); if (_render) _render(this.state); },

  save() {
    const s = this.state;
    const data = {
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
      basePlayer: s.player ? {
        hp: s.player.hp, maxHp: s.player.maxHp, mp: s.player.mp, maxMp: s.player.maxMp,
        atk: s.player.atk, def: s.player.def,
        critRate: s.player.critRate, critMul: s.player.critMul,
        skillMul: s.player.skillMul, mpCost: s.player.mpCost, pen: s.player.pen,
        lifeSteal: s.player.lifeSteal || 0, thorn: s.player.thorn || 0,
        goldMul: s.player.goldMul || 1, dodge: s.player.dodge || 0,
        bleed: s.player.bleed || 0, rage: !!s.player.rage,
        doubleFirst: !!s.player.doubleFirst, debuffAtk: s.player.debuffAtk || null,
        dmgReduce: s.player.dmgReduce || 0, berserk: !!s.player.berserk,
        rebirth: !!s.player.rebirth, regen: s.player.regen || 0
      } : null,
      // 修复：保存战斗中的敌人状态
      enemy: s.enemy ? {
        name: s.enemy.name, hp: s.enemy.hp, maxHp: s.enemy.maxHp,
        atk: s.enemy.atk, def: s.enemy.def,
        tags: s.enemy.tags.map(t => ({ id: t.id, name: t.name })),
        aiTurn: s.enemy.aiTurn || 0,
        aiCharge: s.enemy.aiCharge || false,
        chargeTurns: s.enemy.chargeTurns || 0,
        aiCurse: s.enemy.aiCurse || false,
        doubleFirst: s.enemy.doubleFirst || false,
        lifeSteal: s.enemy.lifeSteal || 0,
        thorn: s.enemy.thorn || 0
      } : null,
      potionAtk: s.potionAtk || 0,
      potionDef: s.potionDef || 0,
      turnInFloor: s.turnInFloor || 0
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
    this._persistCodex();
  },

  load() {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    try {
      const d = JSON.parse(raw), s = this.state;
      s.seed = d.seed || ("" + Date.now()); s.rng = new RNG(s.seed);
      s.mode = d.mode || "simple"; s.difficulty = d.difficulty || "standard";
      s.zoneIndex = d.zoneIndex || 0; s.floorInZone = d.floorInZone || 1;
      s.totalFloor = d.totalFloor || 1; s.roomQueue = d.roomQueue || [];
      s.roomIndex = d.roomIndex || 0; s.gold = d.gold || 0;
      s.zone = d.zone ? ZONES[d.zone] : (d.zoneIndex !== undefined ? ZONES[SIMPLE_ROUTE[d.zoneIndex].zone] : null);
      s.equip = d.equip || []; s.potions = d.potions || [];
      s.curses = (d.curses || []).map(id => CURSES.find(c => c.id === id)).filter(Boolean);
      s.relics = (d.relics || []).map(r => {
        const rel = RELICS.find(x => x.id === r.id);
        if (rel) { const c = { ...rel }; c.applied = !!r.applied; return c; }
        return null;
      }).filter(Boolean);
      s.talent = d.talent ? TALENTS.find(t => t.id === d.talent) : null;
      s.playerClass = d.playerClass ? CLASSES[d.playerClass] : null;
      s.activeSkill = d.activeSkill && s.playerClass ? s.playerClass.skills.find(sk => sk.id === d.activeSkill) : null;
      s.endless = !!d.endless; s.turn = d.turn || 0; s.stats = d.stats || { totalDmg: 0, critCount: 0, roomsCleared: 0 };
      s.dailyMods = d.dailyMods || { global: null, player: null, enemy: null };
      // 修复：读取敌人状态
      if (d.enemy) {
        s.enemy = {
          name: d.enemy.name,
          hp: d.enemy.hp,
          maxHp: d.enemy.maxHp,
          atk: d.enemy.atk,
          def: d.enemy.def,
          tags: (d.enemy.tags || []).map(t => ({ ...t })),
          aiTurn: d.enemy.aiTurn || 0,
          aiCharge: d.enemy.aiCharge || false,
          chargeTurns: d.enemy.chargeTurns || 0,
          aiCurse: d.enemy.aiCurse || false,
          doubleFirst: d.enemy.doubleFirst || false,
          lifeSteal: d.enemy.lifeSteal || 0,
          thorn: d.enemy.thorn || 0
        };
      } else {
        s.enemy = null;
      }
      const bp = d.basePlayer || {};
      s.player = {
        hp: fix(bp.hp, 100), maxHp: fix(bp.maxHp, 100), mp: fix(bp.mp, 20), maxMp: fix(bp.maxMp, 20),
        atk: fix(bp.atk, 15), def: fix(bp.def, 2),
        critRate: fix(bp.critRate, 0.2), critMul: fix(bp.critMul, 1.5),
        skillMul: fix(bp.skillMul, 1.5), mpCost: fix(bp.mpCost, 10), pen: fix(bp.pen, 0),
        lifeSteal: bp.lifeSteal || 0, thorn: bp.thorn || 0, goldMul: bp.goldMul || 1,
        dodge: bp.dodge || 0, bleed: bp.bleed || 0, rage: !!bp.rage,
        doubleFirst: !!bp.doubleFirst, debuffAtk: bp.debuffAtk || null,
        dmgReduce: bp.dmgReduce || 0, berserk: !!bp.berserk,
        rebirth: !!bp.rebirth, regen: bp.regen || 0
      };
      s.potionAtk = d.potionAtk || 0;
      s.potionDef = d.potionDef || 0;
      s.auto = false; s.defending = false; s.nextBoost = 0;
      s.turnInFloor = d.turnInFloor || 0; s.gameOver = false;
      this._loadCodex();
      return true;
    } catch (e) { console.error("load fail", e); return false; }
  },

  hasSave() { return !!localStorage.getItem(SAVE_KEY); },
  deleteSave() { localStorage.removeItem(SAVE_KEY); },

  _loadMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) this.meta = { ...defMeta(), ...JSON.parse(raw) };
    } catch (e) { this.meta = defMeta(); }
    this._checkAdReset();
  },
  saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); } catch (e) {} },

  _checkAdReset() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.meta.adDate !== today) { this.meta.adDate = today; this.meta.adWatched = 0; this.saveMeta(); }
  },

  addTP(n) { this.meta.tp += n; this.saveMeta(); },
  canWatchAd() {
    this._checkAdReset();
    const diff = DIFFICULTIES[this.state.difficulty] || DIFFICULTIES.standard;
    return this.meta.adWatched < diff.adLimit;
  },
  watchAd() {
    this._checkAdReset();
    const diff = DIFFICULTIES[this.state.difficulty] || DIFFICULTIES.standard;
    if (this.meta.adWatched >= diff.adLimit) return false;
    this.meta.adWatched++; this.saveMeta(); return true;
  },

  applyMetaBonus(p) {
    const up = this.meta.upgrades;
    if (up.atkBonus)  p.atk  = Math.floor(p.atk  * (1 + up.atkBonus));
    if (up.hpBonus)   { p.maxHp = Math.floor(p.maxHp * (1 + up.hpBonus)); p.hp = Math.floor(p.hp * (1 + up.hpBonus)); }
    if (up.defBonus)  p.def  += Math.floor(p.def * up.defBonus);
    if (up.critBonus) p.critRate += up.critBonus;
    if (up.goldBonus) p.goldMul = (p.goldMul || 1) * (1 + up.goldBonus);
  },

  addCharExp(charId, exp) {
    if (!this.meta.charExp[charId]) this.meta.charExp[charId] = 0;
    this.meta.charExp[charId] += exp;
    this.saveMeta();
  },

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
    } catch (e) {}
  },
  _loadCodex() {
    try { const raw = localStorage.getItem(CODEX_KEY); if (raw) this.state.codex = JSON.parse(raw); }
    catch (e) { this.state.codex = {}; }
  },
  getAllCodex() {
    try { return JSON.parse(localStorage.getItem(CODEX_KEY) || "{}"); }
    catch (e) { return {}; }
  },

  addLeaderboard(entry) {
    try {
      const list = JSON.parse(localStorage.getItem(LB_KEY) || "[]");
      list.push({ ...entry, date: new Date().toISOString().slice(0, 10) });
      list.sort((a, b) => b.floor - a.floor);
      localStorage.setItem(LB_KEY, JSON.stringify(list.slice(0, 20)));
    } catch (e) {}
  },
  getLeaderboard() {
    try { return JSON.parse(localStorage.getItem(LB_KEY) || "[]"); }
    catch (e) { return []; }
  },

  hardReset() {
    const c = this.state.codex, h = this.state.highest;
    this.state = defState(); this.state.codex = c; this.state.highest = h;
    this.deleteSave();
  }
};