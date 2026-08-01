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

// 深度合并meta对象：defaults为基础，parsed覆盖，但缺失字段保留默认值
function deepMergeMeta(defaults, parsed) {
  var out = {};
  Object.keys(defaults).forEach(function(k) {
    if (parsed.hasOwnProperty(k)) {
      var pv = parsed[k], dv = defaults[k];
      // 对象类型递归合并（如upgrades, soulUpgrades, buildingLevels等）
      if (dv && typeof dv === 'object' && !Array.isArray(dv) && pv && typeof pv === 'object' && !Array.isArray(pv)) {
        out[k] = deepMergeMeta(dv, pv);
      } else if (pv === undefined || pv === null || (typeof dv === 'number' && (typeof pv !== 'number' || isNaN(pv)))) {
        out[k] = dv; // 无效值回退默认
      } else {
        out[k] = pv;
      }
    } else {
      out[k] = defaults[k]; // 缺失字段用默认
    }
  });
  return out;
}

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
  // 已知字段白名单（用于识别非临时属性）
  const KNOWN = new Set(['hp','maxHp','mp','maxMp','atk','def','critRate','critMul',
    'skillMul','mpCost','pen','lifeSteal','thorn','goldMul','dodge','bleed','rage',
    'doubleFirst','debuffAtk','dmgReduce','berserk','rebirth','regen',
    'energy','maxEnergy','buildDirection',
    '_deathGamble','_coreFlame','_coreIce','_coreShadow','_coreCurse',
    '_coreThunder','_coreLight','_thunderChain','_lightChain',
    '_masteryCDR','_masteryEnergy','_masteryDownside','_advancementId',
    '_fearCurse','_fearLucky','_fragileFlag','_badLuckOrig',
    '_greedCurse','_blindCurse','_blindCritGain','_shadowBorn',
    '_luckyCharm','_shadowCloak','_lightningRod','_echoStone',
    '_bloodShield','_greedBag','_chaosBlade','_deathMark',
    '_infMana','_godHand','_glassCannon','_vampLord',
    '_angelWings','_bossPlains','_bossForest','_bossCave',
    '_bossRuins','_bossFrozen','_bossVoid','_bossTower',
    '_bossDesert','_bossSwamp']);
  // 收集 bp 中的未知字段（新版本新增的字段），保留不丢
  // 注意：_syn* 标记由羁绊系统重新计算，不复原；其他 _ 字段（如链标记、突变标记）需保留
  const extra = {};
  if (bp) Object.keys(bp).forEach(k => {
    if (!KNOWN.has(k) && !k.startsWith('_syn')) extra[k] = bp[k];
  });

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
    energy: fix(bp.energy, 3), maxEnergy: fix(bp.maxEnergy, 3),
    buildDirection: bp.buildDirection || '',
    _deathGamble: !!bp._deathGamble,
    _coreFlame: !!bp._coreFlame, _coreIce: !!bp._coreIce,
    _coreShadow: !!bp._coreShadow, _coreCurse: !!bp._coreCurse,
    _coreThunder: !!bp._coreThunder, _coreLight: !!bp._coreLight, // v0.50
    _thunderChain: bp._thunderChain || 0, _lightChain: bp._lightChain || 0, // v0.50
    _masteryCDR: !!bp._masteryCDR, _masteryEnergy: !!bp._masteryEnergy, // v0.50
    _masteryDownside: bp._masteryDownside || '', _advancementId: bp._advancementId || '', // v0.50
    // 诅咒/遗物临时字段
    _weakHpLoss: bp._weakHpLoss, _weakAtkGain: bp._weakAtkGain,
    _slowDefLoss: bp._slowDefLoss, _slowHpGain: bp._slowHpGain,
    _poorGoldLoss: bp._poorGoldLoss, _poorLucky: !!bp._poorLucky,
    _orbOrigCost: bp._orbOrigCost, _mysticOrigCost: bp._mysticOrigCost,
    _chaosOrigPen: bp._chaosOrigPen, _tempHp: bp._tempHp || 0,
    _bleedAtkGain: bp._bleedAtkGain,
    _fearCurse: !!bp._fearCurse, _fearLucky: !!bp._fearLucky,
    _fragileFlag: !!bp._fragileFlag,
    _forgetfulOrigCost: bp._forgetfulOrigCost,
    _badLuckOrig: bp._badLuckOrig,
    _greedCurse: !!bp._greedCurse,
    _blindCurse: !!bp._blindCurse, _blindCritGain: bp._blindCritGain,
    _shadowBorn: !!bp._shadowBorn,
    _luckyCharm: !!bp._luckyCharm, _shadowCloak: !!bp._shadowCloak,
    _lightningRod: !!bp._lightningRod, _echoStone: !!bp._echoStone,
    _bloodShield: !!bp._bloodShield, _greedBag: !!bp._greedBag,
    _chaosBlade: !!bp._chaosBlade, _deathMark: !!bp._deathMark,
    _infMana: !!bp._infMana, _godHand: !!bp._godHand,
    _glassCannon: !!bp._glassCannon, _vampLord: !!bp._vampLord,
    // 联动标记
    _synVampLord: !!bp._synVampLord, _synThunderGod: !!bp._synThunderGod,
    _synFrostKing: !!bp._synFrostKing, _synReaper: !!bp._synReaper,
    _synTimeMaster: !!bp._synTimeMaster, _synGlassGod: !!bp._synGlassGod,
    _stoneGaze: !!bp._stoneGaze,
    // 保留未来版本新增的字段
    ...extra
  };
}

// ---- 默认状态 ----
function defState() {
  return {
    seed: "", rng: null, mode: "simple", difficulty: "standard",
    zone: null, zoneIndex: 0, floorInZone: 1, totalFloor: 1,
    _roomPool: [], _bossReady: false, _currentRoomType: null,
    player: null, enemy: null, enemies: [], selectedTarget: 0, gold: 0,
    equip: [], relics: [], potions: [],
    talent: null, playerClass: null, activeSkill: null, activeSkills: [],
    skillLevels: {}, skillCooldowns: {}, curses: [],
    codex: {}, highest: 1, auto: false, turn: 0, turnInFloor: 0,
    defending: false, nextBoost: 0, gameOver: false,
    stats: { totalDmg: 0, critCount: 0, roomsCleared: 0 },
    dailyMods: { globalId: null, playerId: null, enemyId: null },
    potionAtk: 0, potionDef: 0,
    adDiscount: false, adRefreshCount: 0,
    endless: false, _activeSynergies: [], forgeMats: {},
    blessingType: '', difficultyCoins: 0,
    huntTargets: [], buildDirection: '',
    _runCrits: 0, _runDodges: 0, _runKills: 0, _runSynergies: [], _runRelics: [],
    _appliedMutations: [], _recentEvents: [],
    _fortuneName: '', _mutationName: '',
    _zoneStats: { battles: 0, eventsPerfect: 0, sacrifices: 0 }, // v0.50 分支结局
    _relicPity: 0, _curseTradeCount: 0, _riskRoom: false, _riskReward: false,
    endlessFloor: 0, endlessChaosCount: 0
  };
}

function defMeta() {
  return {
    // === v0.50 货币体系 ===
    essence: 0,       // 灵蕴（旧tp自动迁移）
    souls: 0,         // 魂晶
    stones: 0,        // 灵石
    forgeStones: 0,   // 锻造石 ⭐NEW
    materials: 0,     // 通用素材（替代遗物碎片+技能残卷）⭐NEW

    // === 天赋树 ===
    talentNodes: [],  // 已点亮的节点ID列表 ⭐NEW
    talentPresets: [], // 保存的天赋方案（最多3套）⭐NEW

    // === 新手引导 ===
    onboardingStage: 0, // 0=初入 1=觉醒 2=精进 3=超越 4=命运 5=传说 ⭐NEW

    // === 职业系统 ===
    unlocks: ["warrior", "mage", "shadow"],
    unlockedDiffs: ["casual"],
    charExp: { warrior: 0, mage: 0, shadow: 0 },
    classMastery: {},   // { warrior: { level:0, exp:0 }, ... } ⭐NEW
    classAdvancement: {}, // { warrior: "berserker", ... } 转职选择 ⭐NEW
    awakenedClasses: {},

    // === 旧系统保留 ===
    upgrades: {}, soulUpgrades: {}, highestSimple: 0, highestNormal: 0,
    adWatched: 0, adDate: "", totalRuns: 0, totalWins: 0, totalDeaths: 0,
    buildingLevels: {},
    dailyBest: 0, dailyDate: "", achievements: [],
    totalKills: 0, clearedClasses: [],

    // === 局外装备 ===
    outgameEquip: [],   // 局外装备 ⭐NEW
    decorations: [],    // 城镇装饰 ⭐NEW
    trainingLevel: 0,   // 训练场等级 v0.50 P2
    lastFreeReset: '',  // 天赋树每周免费重置日期戳 v0.51

    // === 星象 ===
    stars: { daily: null, permanent: [], seasonal: null }, // ⭐NEW

    // === 命运烙印 ===
    unlockedBrands: [], equippedBrands: [], brandLevels: {}, // ⭐NEW

    // === 回忆 ===
    memoryFragments: 0, unlockedLore: [], // ⭐NEW

    // === 技能合成 ===
    synthSkills: [], // 合成的技能 ⭐NEW

    // === 隐藏装备 ===
    hiddenEquipFound: [], // ⭐NEW

    // === Boss专属遗物 ===
    bossRelicsFound: [],

    // === 签到 ===
    loginStreak: 0, lastLogin: "", lastClaimDay: "", _adClaimedDay: "",

    // === 版本迁移标记 ===
    _version: 2,

    // === 深渊裂隙 v0.60 — 地下城/天梯/锻造 ===
    dungeon: {
      keys: 0, keyFragments: 0, totalCleared: 0,
      bossMarks: {},
      clears: {},  // { plains: count, forest: count, ... }
      forge: { enchantAtk:0, enchantHp:0, enchantDef:0, enchantCrit:0, enchantPen:0, enchantVamp:0, refineAtk:0, refineHp:0, refineDef:0, runes:[] },
      tower: { bestScore:0, bestFloor:0, seasonScore:0, seasonFloor:0, combo:0, maxCombo:0 }
    },
    // 局外装备（DNF纸娃娃）
    outgameEquipped: { weapon:null, helm:null, armor:null, ringL:null, ringR:null, braceletL:null, braceletR:null, amulet:null, belt:null, medal:null },
    outgameInventory: [],

    // 注意: deepMergeMeta 会将旧 tp 字段保留，需要在 _loadMeta 中做迁移
  };
}

const LB_PURE_KEY = "yaotower_v3.1_lb_pure";
const LB_CULTIVATE_KEY = "yaotower_v3.1_lb_culti";

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
      roomQueue: s._roomPool, roomIndex: s._bossReady ? 1 : 0,
      currentRoomType: s._currentRoomType || null,
      activeSynergies: s._activeSynergies || [],
      gold: s.gold, equip: s.equip, potions: s.potions,
      relics: s.relics.map(r => ({ id: r.id, applied: !!r.applied })),
      curses: s.curses.map(c => c.id),
      talent: s.talent ? s.talent.id : null,
      playerClass: s.playerClass ? s.playerClass.id : null,
      activeSkill: s.activeSkill ? s.activeSkill.id : null,
      skillCooldowns: s.skillCooldowns || {}, skillLevels: s.skillLevels || {},
      endless: s.endless, turn: s.turn, stats: s.stats,
      dailyMods: s.dailyMods,
      basePlayer: serializePlayer(s.player),
      enemy: s.enemy ? serializeEnemy(s.enemy) : null,
      potionAtk: s.potionAtk || 0, potionDef: s.potionDef || 0,
      adDiscount: s.adDiscount || false, adRefreshCount: s.adRefreshCount || 0,
      turnInFloor: s.turnInFloor || 0,
      huntTargets: s.huntTargets || [], buildDirection: s.buildDirection || '',
      runCrits: s._runCrits || 0, runDodges: s._runDodges || 0,
      runKills: s._runKills || 0, runSynergies: s._runSynergies || [], runRelics: s._runRelics || [],
      fortuneName: s._fortuneName || '', mutationName: s._mutationName || ''
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
      s.totalFloor = d.totalFloor || 1; s._roomPool = d.roomQueue || [];
      s._bossReady = (d.roomIndex || 0) > 0; s.gold = d.gold || 0;
      s._currentRoomType = d.currentRoomType || null;
      s._activeSynergies = d.activeSynergies || [];
      s.zone = d.zone ? R.get('zones', d.zone) : null;
      s.equip = d.equip || []; s.potions = d.potions || [];
      s.curses = (d.curses || []).map(id => (R.get('curses') || []).find(c => c.id === id)).filter(Boolean);
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
      s.skillCooldowns = d.skillCooldowns || {};
      s.skillLevels = d.skillLevels || {};
      s.auto = false; s.defending = false; s.nextBoost = 0;
      s.turnInFloor = d.turnInFloor || 0; s.gameOver = false;
      s.huntTargets = d.huntTargets || []; s.buildDirection = d.buildDirection || '';
      s._runCrits = d.runCrits || 0; s._runDodges = d.runDodges || 0;
      s._runKills = d.runKills || 0; s._runSynergies = d.runSynergies || []; s._runRelics = d.runRelics || [];
      s._fortuneName = d.fortuneName || ''; s._mutationName = d.mutationName || '';
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
      if (raw) {
        var defaults = defMeta();
        var parsed = JSON.parse(raw);
        // v0.50 迁移：旧 tp 字段自动转为 essence
        if (typeof parsed.tp === 'number' && typeof parsed.essence !== 'number') {
          parsed.essence = parsed.tp;
        }
        // 清理已废弃字段
        delete parsed.tp;
        // 深度合并：缺失字段补默认，防御旧版本升级缺失新字段
        this.meta = deepMergeMeta(defaults, parsed);
      } else { this.meta = defMeta(); }
    } catch (e) { console.warn("[妖塔] 元数据损坏，已重置", e); this.meta = defMeta(); }
    this._checkAdReset();
  },
  saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); } catch (e) { console.error("妖塔3.0: 元数据保存失败", e); } if (_render) _render(this.state); },

  _checkAdReset() {
    if (!this.meta) return;
    if (typeof this.meta.adWatched !== 'number' || isNaN(this.meta.adWatched) || this.meta.adWatched < 0 || this.meta.adWatched > 50) {
      this.meta.adWatched = 0;
    }
    // 版本迁移：meta.version 不存在 → 旧版本升级，重置广告计数
    if (!this.meta._version || this.meta._version < 2) {
      this.meta.adWatched = 0;
      this.meta._version = 2;
      this.saveMeta();
    }
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (this.meta.adDate !== today) {
      this.meta.adDate = today; this.meta.adWatched = 0; this.saveMeta();
    }
  },

  // v0.50 存档导出/导入
  exportMeta() { try { return JSON.stringify(this.meta, null, 2); } catch(e) { return null; } },
  importMeta(json) {
    try { var d = JSON.parse(json); if (!d || typeof d !== 'object') return false; this.meta = deepMergeMeta(defMeta(), d); this.saveMeta(); return true; }
    catch(e) { return false; }
  },
  exportSave() { try { return localStorage.getItem(SAVE_KEY); } catch(e) { return null; } },
  importSave(raw) { try { localStorage.setItem(SAVE_KEY, raw); return true; } catch(e) { return false; } },

  addEssence(n) { if (!this.meta) return; this.meta.essence = Math.min((this.meta.essence || 0) + n, 999); this.saveMeta(); },
  getEssence() { return this.meta.essence || 0; },
  addSouls(n) { if (!this.meta) return; this.meta.souls = Math.min((this.meta.souls || 0) + n, 9999); this.saveMeta(); },
  addStones(n) { if (!this.meta) return; this.meta.stones = Math.min((this.meta.stones || 0) + n, 9999); this.saveMeta(); },
  // v0.50 P2: 灵石兑换魂晶 (10:1)
  exchangeStonesForSouls() { if (!this.meta) return false; if ((this.meta.stones || 0) < 10) return false; this.meta.stones -= 10; this.meta.souls = Math.min((this.meta.souls || 0) + 1, 9999); this.saveMeta(); return true; },
  // v0.50 P2: 训练场升级（消耗灵石永久+属性）
  getTrainingLevel() { return this.meta.trainingLevel || 0; },
  upgradeTraining() { if (!this.meta) return false; var lv = this.meta.trainingLevel || 0; if (lv >= 5) return false; var costs = [0, 10, 25, 50, 80, 120]; if ((this.meta.stones || 0) < costs[lv + 1]) return false; this.meta.stones -= costs[lv + 1]; this.meta.trainingLevel = (lv || 0) + 1; this.saveMeta(); return true; },
  addForgeStones(n) { if (!this.meta) return; this.meta.forgeStones = Math.min((this.meta.forgeStones || 0) + n, 999); this.saveMeta(); },
  addMaterials(n) { if (!this.meta) return; this.meta.materials = Math.min((this.meta.materials || 0) + n, 999); this.saveMeta(); },

  // ---- 天赋树 ----
  hasTalentNode(nodeId) { return (this.meta.talentNodes || []).includes(nodeId); },
  unlockTalentNode(nodeId) {
    if (!this.meta.talentNodes) this.meta.talentNodes = [];
    this.meta.talentNodes.push(nodeId); // 允许重复购买（根节点叠加层数）
    this.saveMeta();
  },
  resetAllTalents() { this.meta.talentNodes = []; this.saveMeta(); },
  resetTalentBranch(nodes) {
    if (!this.meta.talentNodes) return;
    this.meta.talentNodes = this.meta.talentNodes.filter(function(n) { return !nodes.includes(n); });
    this.saveMeta();
  },

  // ---- 天赋树加成计算 ----
  getTalentBonuses() {
    var nodes = this.meta.talentNodes || [];
    var tree = R.get('talentTree');
    if (!tree) return {};
    var bonuses = { atkMul: 0, hpMul: 0, defMul: 0, critRate: 0, critMul: 0, lifeSteal: 0, pen: 0,
      dodge: 0, dmgReduce: 0, goldMul: 0, relicRate: 0, shopDiscount: 0, eventGood: 0,
      rareWeight: 0, eliteRate: 0, curseReduce: 0, startRelic: false,
      skillCDR: false, keystone_break: false, keystone_immortal: false,
      keystone_doubleChest: false, keystone_startRareRelic: false,
      startShield: 0, regenPct: 0, relicSlots: 0, chestBonus: 0, relicChoice: 0 };
    nodes.forEach(function(nid) {
      var node = tree.find(function(nd) { return nd.id === nid; });
      if (!node || !node.bonus) return;
      var b = node.bonus;
      if (b.atkMul) bonuses.atkMul += b.atkMul;
      if (b.hpMul) bonuses.hpMul += b.hpMul;
      if (b.defMul) bonuses.defMul += b.defMul;
      if (b.critRate) bonuses.critRate += b.critRate;
      if (b.critMul) bonuses.critMul += b.critMul;
      if (b.lifeSteal) bonuses.lifeSteal += b.lifeSteal;
      if (b.pen) bonuses.pen += b.pen;
      if (b.dodge) bonuses.dodge += b.dodge;
      if (b.dmgReduce) bonuses.dmgReduce += b.dmgReduce;
      if (b.goldMul) bonuses.goldMul += b.goldMul;
      if (b.relicRate) bonuses.relicRate += b.relicRate;
      if (b.shopDiscount) bonuses.shopDiscount += b.shopDiscount;
      if (b.eventGood) bonuses.eventGood += b.eventGood;
      if (b.rareWeight) bonuses.rareWeight += b.rareWeight;
      if (b.eliteRate) bonuses.eliteRate += b.eliteRate;
      if (b.curseReduce) bonuses.curseReduce += b.curseReduce;
      if (b.startRelic) bonuses.startRelic = true;
      // v0.51: 非数值型bonus收集
      if (b.skillCDR) bonuses.skillCDR = true;
      if (b.keystone_break) bonuses.keystone_break = true;
      if (b.keystone_immortal) bonuses.keystone_immortal = true;
      if (b.keystone_doubleChest) bonuses.keystone_doubleChest = true;
      if (b.keystone_startRareRelic) bonuses.keystone_startRareRelic = true;
      if (b.startShield) bonuses.startShield += b.startShield;
      if (b.regenPct) bonuses.regenPct += b.regenPct;
      if (b.relicSlots) bonuses.relicSlots += b.relicSlots;
      if (b.chestBonus) bonuses.chestBonus += b.chestBonus;
      if (b.relicChoice) bonuses.relicChoice += b.relicChoice;
    });
    return bonuses;
  },

  // ---- 新手引导 ----
  checkOnboarding() {
    var m = this.meta, stage = m.onboardingStage || 0;
    var totalWins = m.totalWins || 0;
    var hasHellClear = (m.achievements || []).includes('clear_hell');
    var hasTranscended = Object.keys(m.classAdvancement || {}).length > 0;
    var allTranscended = false;
    var classes = R.get('classes');
    if (classes) {
      var classIds = Object.keys(classes).filter(function(k) { return classes[k].id; });
      var transcended = classIds.filter(function(cid) { return m.classAdvancement && m.classAdvancement[cid]; });
      allTranscended = transcended.length >= classIds.length;
    }

    var newStage = stage;
    if (stage === 0 && totalWins >= 1) newStage = 1;
    if (stage <= 1 && totalWins >= 3) newStage = 2;
    if (stage <= 2 && hasHellClear) newStage = 3;
    if (stage <= 3 && hasTranscended) newStage = 4;
    if (stage <= 4 && allTranscended) newStage = 5;

    if (newStage !== stage) {
      m.onboardingStage = newStage;
      this.saveMeta();
      return newStage;
    }
    return -1; // 无变化
  },
  canWatchAd() {
    if (!this.meta) { console.warn("[妖塔] canWatchAd: meta 未初始化"); return false; }
    this._checkAdReset();
    const diff = R.get('difficulties', this.state.difficulty) || R.get('difficulties', 'standard');
    const watched = Number(this.meta.adWatched) || 0;
    const limit = diff ? (Number(diff.adLimit) || 10) : 10;
    console.log("[妖塔] canWatchAd:", { watched, limit, diffId: this.state.difficulty, canWatch: watched < limit });
    return watched < limit;
  },
  watchAd() {
    if (!this.meta) { console.warn("[妖塔] watchAd: meta 未初始化"); return false; }
    this._checkAdReset();
    const diff = R.get('difficulties', this.state.difficulty) || R.get('difficulties', 'standard');
    const limit = diff ? (Number(diff.adLimit) || 10) : 10;
    const watched = Number(this.meta.adWatched) || 0;
    if (watched >= limit) { console.log("[妖塔] watchAd: 已达上限", { watched, limit }); return false; }
    this.meta.adWatched = watched + 1;
    this.saveMeta();
    console.log("[妖塔] watchAd: 成功, 已观看", this.meta.adWatched, "/", limit);
    return true;
  },

  // ---- 局外成长（含天赋树衰减系统）----
  applyMetaBonus(p) {
    var s = this.state;
    // v0.50 修行模式：关闭所有局外加成
    if (this.meta._pureMode) return;
    // v0.50 天赋树加成衰减：休闲/标准15%，炼狱35%，无尽60%
    // 无尽挑战/BossRush/地下城 使用100%加成（不衰减）
    var decay = 1.0;
    var diff = s.difficulty || 'standard';
    if (s.mode === 'daily') decay = 0.10;
    else if (diff.startsWith('casual')) decay = 0.15;
    else if (diff === 'standard' || diff.startsWith('standard')) decay = 0.15;
    else if (diff === 'hell' || diff.startsWith('hell')) decay = 0.35;
    else if (s.endless) decay = 0.60;
    // 无尽挑战/BossRush/地下城 使用100%加成（不衰减）

    // 成就加成只应用一次
    if (!p._achApplied) {
      var achList = R.get('achievements') || [];
      var unlocked = this.meta.achievements || [];
      var totalAtkBonus = 0, totalHpBonus = 0, totalDefBonus = 0, totalAllBonus = 0;
      unlocked.forEach(function(id) {
        var ach = achList.find(function(a) { return a.id === id; });
        if (ach && ach.bonus) {
          if (ach.bonus.atkBonus) totalAtkBonus += ach.bonus.atkBonus;
          if (ach.bonus.hpBonus) totalHpBonus += ach.bonus.hpBonus;
          if (ach.bonus.defBonus) totalDefBonus += ach.bonus.defBonus;
          if (ach.bonus.critBonus) p.critRate += ach.bonus.critBonus;
          if (ach.bonus.goldBonus) p.goldMul = (p.goldMul || 1) * (1 + ach.bonus.goldBonus);
          if (ach.bonus.dodgeBonus) p.dodge = Math.min(0.75, (p.dodge || 0) + ach.bonus.dodgeBonus);
          if (ach.bonus.luckBonus) p._achLuckBonus = (p._achLuckBonus || 0) + ach.bonus.luckBonus;
          if (ach.bonus.startPotion) p._achStartPotion = (p._achStartPotion || 0) + ach.bonus.startPotion;
          if (ach.bonus.allBonus) totalAllBonus += ach.bonus.allBonus;
        }
      });
      var atkMul = 1 + totalAtkBonus + totalAllBonus;
      var hpMul = 1 + totalHpBonus + totalAllBonus;
      var defMul = 1 + totalDefBonus + totalAllBonus;
      p.atk = Math.floor(p.atk * atkMul);
      p.maxHp = Math.floor(p.maxHp * hpMul); p.hp = Math.floor(p.hp * hpMul);
      p.def = Math.floor(p.def * defMul);
      p._achApplied = true;
    }

    // v0.50 旧TP升级已废弃 → 统一用天赋树
    // v0.50 P0平衡：记录原始基准值用于硬上限计算
    var baseAtk = p.atk, baseHp = p.maxHp, baseDef = p.def, baseCrit = p.critRate;
    // 天赋树加成（应用衰减）
    var tb = this.getTalentBonuses();
    if (tb.atkMul) p.atk = Math.floor(p.atk * (1 + tb.atkMul * decay));
    if (tb.hpMul) { p.maxHp = Math.floor(p.maxHp * (1 + tb.hpMul * decay)); p.hp = Math.floor(p.hp * (1 + tb.hpMul * decay)); }
    if (tb.defMul) p.def = Math.floor(p.def * (1 + tb.defMul * decay));
    if (tb.critRate) p.critRate += tb.critRate * decay;
    if (tb.critMul) p.critMul = (p.critMul || 1.5) + tb.critMul * decay;
    if (tb.lifeSteal) p.lifeSteal = (p.lifeSteal || 0) + tb.lifeSteal * decay;
    if (tb.pen) p.pen = (p.pen || 0) + tb.pen * decay;
    if (tb.dodge) p.dodge = Math.min(0.75, (p.dodge || 0) + tb.dodge * decay);
    if (tb.dmgReduce) p.dmgReduce = (p.dmgReduce || 0) + tb.dmgReduce * decay;
    if (tb.goldMul) p.goldMul = (p.goldMul || 1) * (1 + tb.goldMul * decay);
    // v0.51: 非数值型bonus写入player对象（对应系统读取）
    if (tb.skillCDR) p.skillCDR = true;
    if (tb.keystone_break) p._keystoneBreak = true;
    if (tb.keystone_immortal) p._keystoneImmortal = true;
    if (tb.keystone_doubleChest) p._keystoneDoubleChest = true;
    if (tb.keystone_startRareRelic) p._keystoneStartRareRelic = true;
    if (tb.startShield) p._talentStartShield = (p._talentStartShield || 0) + tb.startShield;
    if (tb.regenPct) p._talentRegenPct = (p._talentRegenPct || 0) + tb.regenPct;
    if (tb.relicSlots) p._talentRelicSlots = (p._talentRelicSlots || 0) + tb.relicSlots;
    if (tb.chestBonus) p._talentChestBonus = (p._talentChestBonus || 0) + tb.chestBonus;
    if (tb.relicChoice) p._talentRelicChoice = (p._talentRelicChoice || 0) + tb.relicChoice;
    // 概率型bonus写入player供各系统读取
    if (tb.relicRate) p._talentRelicRate = (p._talentRelicRate || 0) + tb.relicRate;
    if (tb.shopDiscount) p._talentShopDiscount = (p._talentShopDiscount || 0) + tb.shopDiscount;
    if (tb.eventGood) p._talentEventGood = (p._talentEventGood || 0) + tb.eventGood;
    if (tb.rareWeight) p._talentRareWeight = (p._talentRareWeight || 0) + tb.rareWeight;
    if (tb.eliteRate) p._talentEliteRate = (p._talentEliteRate || 0) + tb.eliteRate;
    if (tb.curseReduce) p._talentCurseReduce = (p._talentCurseReduce || 0) + tb.curseReduce;

    // 城镇装饰加成（应用衰减）
    var decs = this.meta.decorations || [];
    decs.forEach(function(d) {
      if (d.effect === 'atk') p.atk += Math.floor(2 * decay);
      if (d.effect === 'hp') { p.maxHp += Math.floor(15 * decay); p.hp += Math.floor(15 * decay); }
      if (d.effect === 'gold') p.goldMul = (p.goldMul || 1) + 0.2 * decay;
    });

    // v0.50 P2: 训练场永久属性加成
    var tl = this.meta.trainingLevel || 0;
    if (tl > 0) { p.atk += tl; p.maxHp += tl * 5; p.hp += tl * 5; p.def += tl; }

    // v0.50 P0硬上限：所有局外永久加成封顶
    var MAX_ATK_BONUS = 0.35, MAX_HP_BONUS = 0.45, MAX_DEF_BONUS = 0.30, MAX_CRIT_BONUS = 0.25;
    p.atk = Math.min(p.atk, Math.floor(baseAtk * (1 + MAX_ATK_BONUS)));
    p.maxHp = Math.min(p.maxHp, Math.floor(baseHp * (1 + MAX_HP_BONUS)));
    p.hp = Math.min(p.hp, p.maxHp);
    p.def = Math.min(p.def, Math.floor(baseDef * (1 + MAX_DEF_BONUS)));
    p.critRate = Math.min(p.critRate, baseCrit + MAX_CRIT_BONUS);
    p.dodge = Math.min(0.75, p.dodge || 0); // 闪避硬上限75%
    p.lifeSteal = Math.min(0.40, p.lifeSteal || 0); // 吸血硬上限40%
  },

  // 获取开局药水数量（修复 startPotion 陷阱 — v0.50 合并成就加成）
  getStartPotions() {
    var achBonus = this.state.player ? (this.state.player._achStartPotion || 0) : 0;
    var upgradeCount = this.meta.upgrades?.startPotion || 0;
    const count = Math.min(upgradeCount + achBonus, 3); // 上限3瓶
    if (count <= 0) return [];
    const potionPool = (R.get('potions') || []).filter(p => p.id !== 'cleanse');
    const result = [];
    for (let i = 0; i < count; i++) {
      var src = potionPool[i % potionPool.length];
      result.push({ ...src, fn: src.fn });
    }
    return result;
  },

  // 广告收益加成（修复 adRewardBonus 陷阱）
  getAdTPBonus() {
    return 1 + (this.meta.upgrades?.adRewardBonus || 0);
  },

  // ---- 角色经验 & 精通系统 v0.50 ----
  addCharExp(charId, exp) {
    if (!this.meta.charExp[charId]) this.meta.charExp[charId] = 0;
    this.meta.charExp[charId] += exp;
    // 同步更新精通等级
    if (!this.meta.classMastery) this.meta.classMastery = {};
    if (!this.meta.classMastery[charId]) this.meta.classMastery[charId] = { level: 0, exp: 0 };
    this.meta.classMastery[charId].exp = this.meta.charExp[charId];
    var newLevel = this._calcMasteryLevel(this.meta.charExp[charId]);
    if (newLevel > this.meta.classMastery[charId].level) {
      this.meta.classMastery[charId].level = newLevel;
      this.saveMeta();
      return newLevel; // 返回新等级供UI显示
    }
    this.saveMeta();
    return -1;
  },

  // 精通等级计算：[5,10,20,35,55,80,110,145,185,230,280,335,395,460,530]
  _calcMasteryLevel(exp) {
    var thresholds = [5,10,20,35,55,80,110,145,185,230,280,335,395,460,530];
    var lv = 0;
    for (var i = 0; i < thresholds.length; i++) {
      if (exp >= thresholds[i]) lv = i + 1;
      else break;
    }
    return lv;
  },

  getMasteryLevel(charId) {
    if (!this.meta.classMastery || !this.meta.classMastery[charId]) return 0;
    return this.meta.classMastery[charId].level || 0;
  },

  // 应用精通加成到玩家
  applyMasteryBonuses(p, charId) {
    var lv = this.getMasteryLevel(charId);
    if (lv <= 0) return;
    // Lv1: 技能伤害+10%
    if (lv >= 1) p.skillMul = (p.skillMul || 1.5) + 0.10;
    // Lv2: 主属性+3% (读取classes.js中的职业数据)
    if (lv >= 2) {
      var cls = R.get('classes', charId);
      if (cls) {
        if (cls.id === 'warrior') p.atk = Math.floor(p.atk * 1.03);
        if (cls.id === 'mage') { p.maxEnergy = (p.maxEnergy || 3) + 1; p.energy = p.maxEnergy; }
        if (cls.id === 'shadow') p.dodge = Math.min(0.75, (p.dodge || 0) + 0.03);
        if (cls.id === 'archer') p.critMul = (p.critMul || 1.5) + 0.06;
        if (cls.id === 'monk') p.def = Math.floor(p.def * 1.03);
      }
    }
    // Lv4: 技能CD-1
    if (lv >= 4) p._masteryCDR = true;
    // Lv6: 主属性+6%
    if (lv >= 6) {
      var cls2 = R.get('classes', charId);
      if (cls2) {
        if (cls2.id === 'warrior') p.atk = Math.floor(p.atk * 1.06);
        if (cls2.id === 'mage') { p.maxEnergy = (p.maxEnergy || 3) + 1; p.energy = p.maxEnergy; }
        if (cls2.id === 'shadow') p.dodge = Math.min(0.75, (p.dodge || 0) + 0.06);
        if (cls2.id === 'archer') p.critMul = (p.critMul || 1.5) + 0.12;
        if (cls2.id === 'monk') p.def = Math.floor(p.def * 1.06);
      }
    }
    // Lv7: 技能能量-1
    if (lv >= 7) p._masteryEnergy = true;
    // Lv8: 暴击+5%
    if (lv >= 8) p.critRate += 0.05;
    // Lv9: HP+15%
    if (lv >= 9) { p.maxHp = Math.floor(p.maxHp * 1.15); p.hp = Math.floor(p.hp * 1.15); }
    // Lv11: 全属性+3%
    if (lv >= 11) {
      p.atk = Math.floor(p.atk * 1.03);
      p.def = Math.floor(p.def * 1.03);
      p.maxHp = Math.floor(p.maxHp * 1.03); p.hp = Math.floor(p.hp * 1.03);
    }
    // Lv12: 额外药水（在getStartPotions中处理）+ 药水效果+10%
    if (lv >= 12) p._masteryPotionBonus = true;
    // Lv13: 初始金币+30（在startNewGame中处理）
    // Lv14: 主属性+10%
    if (lv >= 14) {
      var cls3 = R.get('classes', charId);
      if (cls3) {
        if (cls3.id === 'warrior') p.atk = Math.floor(p.atk * 1.10);
        if (cls3.id === 'mage') { p.maxEnergy = (p.maxEnergy || 3) + 1; p.energy = p.maxEnergy; }
        if (cls3.id === 'shadow') p.dodge = Math.min(0.75, (p.dodge || 0) + 0.10);
        if (cls3.id === 'archer') p.critMul = (p.critMul || 1.5) + 0.20;
        if (cls3.id === 'monk') p.def = Math.floor(p.def * 1.10);
      }
    }
    // Lv15: 职业负面（v0.50 P1：所有难度生效）
    if (lv >= 15) {
      this._applyMasteryDownside(p, charId);
    }
  },

  // ---- 转职系统 v0.50 ----
  canAdvance(charId) { return this.getMasteryLevel(charId) >= 10; },
  getAdvancement(charId) {
    if (!this.meta.classAdvancement) return null;
    return this.meta.classAdvancement[charId] || null;
  },
  applyAdvancement(charId, advId) {
    if (!this.meta.classAdvancement) this.meta.classAdvancement = {};
    if (this.meta.classAdvancement[charId]) return false; // 已转职
    var advs = R.get('classAdvancements');
    if (!advs || !advs[charId]) return false;
    var adv = advs[charId].find(function(a) { return a.id === advId; });
    if (!adv) return false;
    if ((this.meta.souls || 0) < 50 || (this.meta.stones || 0) < 30) return false;
    this.meta.souls -= 50;
    this.meta.stones -= 30;
    this.meta.classAdvancement[charId] = advId;
    this.saveMeta();
    return adv;
  },

  // 应用转职加成到玩家
  applyAdvancementBonuses(p, charId) {
    var advId = this.getAdvancement(charId);
    if (!advId) return;
    var advs = R.get('classAdvancements');
    if (!advs || !advs[charId]) return;
    var adv = advs[charId].find(function(a) { return a.id === advId; });
    if (!adv || !adv.statChange) return;
    var sc = adv.statChange;
    if (sc.atk) p.atk += sc.atk;
    if (sc.def) p.def += sc.def;
    if (sc.maxHp) { p.maxHp += sc.maxHp; p.hp += sc.maxHp; }
    if (sc.skillMul) p.skillMul = (p.skillMul || 1.5) + sc.skillMul;
    if (sc.critMul) p.critMul = (p.critMul || 1.5) + sc.critMul;
    if (sc.critRate) p.critRate = (p.critRate || 0) + sc.critRate;
    if (sc.pen) p.pen = (p.pen || 0) + sc.pen;
    if (sc.dodge) p.dodge = Math.min(0.75, (p.dodge || 0) + sc.dodge);
    p._advancementId = advId;
  },

  // ---- 觉醒系统 v0.50 ----
  isAwakened(charId) { return !!(this.meta.awakenedClasses && this.meta.awakenedClasses[charId]); },
  canAwaken(charId) {
    return !!this.getAdvancement(charId) && !this.isAwakened(charId);
  },
  applyAwakening(charId) {
    if (!this.canAwaken(charId)) return false;
    if ((this.meta.souls || 0) < 80 || (this.meta.stones || 0) < 50) return false;
    // 检查是否有神话材料（简化：需要锻造石作为材料代理）
    if ((this.meta.forgeStones || 0) < 30) return false;
    this.meta.souls -= 80;
    this.meta.stones -= 50;
    this.meta.forgeStones -= 30;
    if (!this.meta.awakenedClasses) this.meta.awakenedClasses = {};
    this.meta.awakenedClasses[charId] = true;
    this.saveMeta();
    return true;
  },
  getAwakeningPassive(charId) {
    var advId = this.getAdvancement(charId);
    if (!advId) return null;
    var passives = R.get('awakeningPassives');
    return passives ? passives[advId] : null;
  },
  applyAwakeningBonuses(p, charId) {
    if (!this.isAwakened(charId)) return;
    // 全属性+15%
    p.atk = Math.floor(p.atk * 1.15);
    p.def = Math.floor(p.def * 1.15);
    p.maxHp = Math.floor(p.maxHp * 1.15); p.hp = Math.floor(p.hp * 1.15);
    p._awakened = true;
    // 觉醒被动在combat中由advancementId判断
    p._awakeningPassive = this.getAdvancement(charId);
  },

  _applyMasteryDownside(p, charId) {
    // 仅在非炼狱难度触发负面
    if (charId === 'warrior') { /* 技能能量+1 在combat中处理 via flag */ p._masteryDownside = 'energy'; }
    if (charId === 'mage') { p._masteryDownside = 'elemental'; /* 元素受伤+20% */ }
    if (charId === 'shadow') { p._masteryDownside = 'fragile'; /* 承伤+30% */ }
    if (charId === 'archer') { p._masteryDownside = 'close'; /* 近身受罚 */ }
    if (charId === 'monk') { p._masteryDownside = 'noOverheal'; /* 溢出不转盾 */ }
  },

  // ---- 命运烙印 v0.50 ----
  hasBrand(brandId) { return (this.meta.unlockedBrands || []).includes(brandId); },
  unlockBrand(brandId) {
    if (!this.meta.unlockedBrands) this.meta.unlockedBrands = [];
    if (!this.meta.unlockedBrands.includes(brandId)) { this.meta.unlockedBrands.push(brandId); this.saveMeta(); }
  },
  getBrandLevel(brandId) { return (this.meta.brandLevels && this.meta.brandLevels[brandId]) || 0; },
  upgradeBrand(brandId) {
    var brand = R.get('fateBrands').find(function(b){return b.id===brandId;});
    if (!brand) return false;
    var lv = this.getBrandLevel(brandId);
    if (lv >= brand.levels.length) return false;
    var cost = brand.levels[lv].cost;
    if ((this.meta.essence||0) < cost) return false;
    this.meta.essence -= cost;
    if (!this.meta.brandLevels) this.meta.brandLevels = {};
    this.meta.brandLevels[brandId] = lv + 1;
    this.saveMeta();
    return true;
  },
  equipBrand(brandId, slot) {
    if (!this.meta.equippedBrands) this.meta.equippedBrands = [];
    if (!this.hasBrand(brandId)) return false;
    this.meta.equippedBrands[slot] = brandId;
    this.saveMeta();
    return true;
  },
  applyBrandBonuses(p) {
    var equipped = this.meta.equippedBrands || [];
    var self = this;
    equipped.forEach(function(brandId) {
      if (!brandId) return;
      var brand = R.get('fateBrands').find(function(b){return b.id===brandId;});
      if (!brand) return;
      var lv = self.getBrandLevel(brandId);
      for (var i = 0; i < lv; i++) {
        var level = brand.levels[i];
        var et = level.effectType, ev = level.effectValue;
        if (!et) continue;
        switch (et) {
          // === brand_burn ===
          case 'burnDmg': p._brandBurnDmg = (p._brandBurnDmg || 0) + ev; break;
          case 'burnCap': p._brandBurnCap = (p._brandBurnCap || 0) + ev; break;
          case 'burnKillEnergy': p._brandBurnKillEnergy = true; break;
          // === brand_ice ===
          case 'slowChance': p._brandSlowChance = (p._brandSlowChance || 0) + ev; break;
          case 'slowDefPenalty': p._brandSlowDefPenalty = (p._brandSlowDefPenalty || 0) + ev; break;
          case 'freezeKillCDReset': p._brandFreezeKillCDReset = true; break;
          // === brand_shadow ===
          case 'dodge': p.dodge = Math.min(0.75, (p.dodge || 0) + ev); break;
          case 'dodgeAtkBoost': p._brandDodgeAtkBoost = ev; break;
          case 'dodgeKillReset': p._brandDodgeKillReset = true; break;
          // === brand_thunder ===
          case 'critRate': p.critRate += ev; break;
          case 'critChainBounce': p._brandCritChainBounce = (p._brandCritChainBounce || 0) + ev; break;
          case 'critKillEnergy': p._brandCritKillEnergy = true; break;
          // === brand_light ===
          case 'healMul': p._brandHealMul = (p._brandHealMul || 1) * (1 + ev); break;
          case 'healDmgProc': p._brandHealDmgProc = ev; break;
          case 'overhealPermHP': p._brandOverhealPermHP = (p._brandOverhealPermHP || 0) + ev; break;
          // === brand_curse ===
          case 'curseDownsideReduce': p._brandCurseDownsideReduce = (p._brandCurseDownsideReduce || 0) + ev; break;
          case 'curseCapExtra': p._brandCurseCapExtra = (p._brandCurseCapExtra || 0) + ev; break;
          case 'atkPerCurse': p._brandAtkPerCurse = (p._brandAtkPerCurse || 0) + ev; break;
          // === brand_vampire ===
          case 'lifeSteal': p.lifeSteal = (p.lifeSteal || 0) + ev; break;
          case 'vampOverflowShield': p._brandVampOverflowShield = ev; break;
          case 'shieldAtkBoost': p._brandShieldAtkBoost = ev; break;
          // === brand_curse_lord ===
          case 'curseUpsideBoost': p._brandCurseUpsideBoost = (p._brandCurseUpsideBoost || 0) + ev; break;
          case 'enemyHpDrain': p._brandEnemyHpDrain = (p._brandEnemyHpDrain || 0) + ev; break;
          case 'startCurseChoice': p._brandStartCurseChoice = true; break;
        }
      }
    });
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
  addLeaderboard(entry, type) {
    try {
      var key = type === 'cultivate' ? LB_CULTIVATE_KEY : LB_PURE_KEY;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      const d = new Date(); const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      list.push({ ...entry, date: dateStr });
      list.sort((a, b) => b.floor - a.floor);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
    } catch (e) { console.error("妖塔3.0: 排行榜保存失败", e); }
  },
  getLeaderboard(type) {
    try { var key = type === 'cultivate' ? LB_CULTIVATE_KEY : LB_PURE_KEY; return JSON.parse(localStorage.getItem(key) || "[]"); }
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

  hardReset(full) {
    const c = this.state.codex, h = this.state.highest;
    this.state = defState();
    if (!full) { this.state.codex = c; this.state.highest = h; }
    this.deleteSave();
    if (full) {
      this.meta = defMeta();
      this.saveMeta();
      localStorage.removeItem(CODEX_KEY);
      localStorage.removeItem(LB_KEY);
      this.state.codex = {}; // 同步清空内存图鉴
      try { import('../platform/tapsave.js').then(function(m) { m.TapSave.clearCloud(); }); } catch(e) {}
    }
    this.state._appliedMutations = [];
    this.state.huntTargets = [];
  }
};

// ---- 敌人序列化 ----
function serializeEnemy(e) {
  return {
    name: e.name, hp: e.hp, maxHp: e.maxHp, atk: e.atk, def: e.def,
    tags: e.tags.map(t => ({ id: t.id, name: t.name })),
    aiTurn: e.aiTurn || 0, aiCharge: e.aiCharge || false, chargeTurns: e.chargeTurns || 0,
    aiCurse: e.aiCurse || false, doubleFirst: e.doubleFirst || false,
    lifeSteal: e.lifeSteal || 0, thorn: e.thorn || 0,
    _buffs: (e._buffs || []).map(b => ({ id: b.id, name: b.name, turns: b.turns, data: b.data || {} }))
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
    lifeSteal: d.lifeSteal || 0, thorn: d.thorn || 0,
    _buffs: restoreBuffs(d._buffs || [])
  };
}

// 从保存数据重建 buff（恢复 onTick/onRemove 函数）
function restoreBuffs(saved) {
  return saved.map(b => {
    switch (b.id) {
      case 'burn':
        return { ...b, onTick: (e, bf) => { e.hp -= bf.data.dmg; if (e.hp <= 0) return 'dead'; }, onRemove: () => {} };
      case 'poison':
        return { ...b, onTick: (e, bf) => { e.hp -= bf.data.dmg; if (e.hp <= 0) return 'dead'; }, onRemove: () => {} };
      case 'slow':
        return { ...b, onRemove: () => {} };
      case 'stun':
        return { ...b, onTick: () => 'stunned', onRemove: () => {} };
      case 'crystal':
        return { ...b, onRemove: (enemy) => { enemy.def = Math.floor(enemy.def / 2); } };
      default:
        console.warn("[妖塔] 未知buff类型，使用默认:", b.id);
        return { ...b, onTick: b.data ? (e, bf) => { e.hp -= bf.data.dmg; if (e.hp <= 0) return 'dead'; } : undefined, onRemove: () => {} };
    }
  });
}
