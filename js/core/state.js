// ===================== 全局状态管理 =====================
import { RNG } from "./rng.js";
import { R } from "./registry.js";
import { E, Events } from "./event-bus.js";
import { initAntiCheat, trackValue, verifyValue, integrityCheck, checkDebugger, getSessionHash } from "./anti-cheat.js";

const SAVE_KEY = "yaotower_v3.2_save";
const SAVE_VERSION = 2; // 存档版本号，改数据结构时递增
const META_KEY = "yaotower_v3.2_meta";
const CODEX_KEY = "yaotower_v3.2_codex";
const LB_KEY   = "yaotower_v3.2_lb";

// ===== v0.82 防作弊存档系统 =====
const SLOT_COUNT = 3; // 手动存档槽位数
const SLOT_PREFIX = "ytower_slot_";
const CHECKSUM_KEY = "ytower_cs_";
// 校验和密钥（混淆分散存储，增加篡改难度）
function _checksumSalt() {
  var s = "";
  s += String.fromCharCode(0x59, 0x54, 0x6f, 0x77, 0x65, 0x72); // "YTower"
  s += "_" + SAVE_VERSION + "_";
  s += String.fromCharCode(0x78, 0x39, 0x6d, 0x5a, 0x32, 0x70, 0x4c); // "x9mZ2pL"
  return s;
}
function computeChecksum(data) {
  var str = JSON.stringify(data);
  var salted = str + _checksumSalt();
  var hash = 5381;
  for (var i = 0; i < salted.length; i++) {
    hash = ((hash << 5) + hash) + salted.charCodeAt(i);
    hash = hash | 0; // 32位整数
  }
  // 二次混合防止碰撞
  var hash2 = 0x811c9dc5;
  for (var j = salted.length - 1; j >= 0; j--) {
    hash2 = (hash2 ^ salted.charCodeAt(j)) * 0x01000193;
    hash2 = hash2 | 0;
  }
  return (hash >>> 0).toString(36) + "_" + (hash2 >>> 0).toString(36);
}
function verifyChecksum(data, checksum) {
  if (!checksum || typeof checksum !== 'string') return false;
  return computeChecksum(data) === checksum;
}

// 存档槽位数据结构: { version, timestamp, floor, className, metaChecksum, meta, saveChecksum, save }
function _packSlotData(meta, save, floor, className) {
  var metaStr = JSON.stringify(meta);
  var saveStr = save || "";
  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    floor: floor || 0,
    className: className || "",
    meta: metaStr,
    save: saveStr,
    metaCS: computeChecksum(metaStr),
    saveCS: computeChecksum(saveStr || "empty"),
    _globalCS: computeChecksum(metaStr + "|" + (saveStr || "empty") + "|" + (floor || 0))
  };
}
function _unpackSlotData(packed) {
  if (!packed) return null;
  // 版本不匹配：不丢数据，标记旧版本供上层处理
  if (packed.version !== SAVE_VERSION) return { _versionMismatch: true, version: packed.version, raw: packed };
  // 全局校验
  var combined = (packed.meta || "") + "|" + (packed.save || "empty") + "|" + (packed.floor || 0);
  if (!verifyChecksum(combined, packed._globalCS)) {
    console.warn("[妖塔勇者录] 存档校验失败 — 数据可能被篡改");
    return null;
  }
  // 分段校验
  if (!verifyChecksum(packed.meta || "", packed.metaCS)) return null;
  if (!verifyChecksum(packed.save || "empty", packed.saveCS)) return null;
  try {
    return {
      meta: JSON.parse(packed.meta),
      save: packed.save ? JSON.parse(packed.save) : null,
      floor: packed.floor || 0,
      className: packed.className || "",
      timestamp: packed.timestamp || 0
    };
  } catch(e) {
    console.warn("[妖塔勇者录] 存档JSON解析失败");
    return null;
  }
}

let _render = null;
let _renderPending = false;
export function onRender(fn) { _render = fn; }
// v0.82: rAF防抖 — 同一帧内多次sync/set合并为一次渲染
function _scheduleRender(s) {
  if (!_render || _renderPending) return;
  _renderPending = true;
  requestAnimationFrame(function() {
    _renderPending = false;
    _render(s);
  });
}
function _forceRender(s) { if (_render) { _renderPending = false; _render(s); } }

function fix(v, d) { return (typeof v === "number" && !isNaN(v)) ? v : d; }

// 深度合并meta对象：defaults为基础，parsed覆盖，但缺失字段保留默认值
// 重要：parsed 中 defaults 未定义的新字段必须保留（防版本升级/新功能数据丢失）
function deepMergeMeta(defaults, parsed) {
  var out = {};
  Object.keys(defaults).forEach(function(k) {
    if (parsed.hasOwnProperty(k)) {
      var pv = parsed[k], dv = defaults[k];
      // 对象类型递归合并（如upgrades, stars等）
      if (dv && typeof dv === 'object' && !Array.isArray(dv) && pv && typeof pv === 'object' && !Array.isArray(pv)) {
        out[k] = deepMergeMeta(dv, pv);
      } else if (pv === undefined || pv === null || (typeof dv === 'number' && (typeof pv !== 'number' || isNaN(pv)))) {
        out[k] = dv; // 无效值回退默认
      } else if (dv && typeof dv === 'object' && !Array.isArray(dv) && (typeof pv !== 'object' || Array.isArray(pv))) {
        out[k] = dv; // v0.82: falsy/非对象值覆盖对象默认时，保留默认
      } else {
        out[k] = pv;
      }
    } else {
      out[k] = defaults[k]; // 缺失字段用默认
    }
  });
  // 保留 parsed 中 defaults 没有的新字段（如 discoveredRelics 等动态解锁数据）
  Object.keys(parsed).forEach(function(k) {
    if (!out.hasOwnProperty(k) && parsed[k] !== undefined && parsed[k] !== null) {
      out[k] = parsed[k];
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
    '_coreThunder','_coreLight','_thunderChain','_lightChain','_fireChain','_iceChain','_shadowChain','_curseLord','_cursePlague','_cursedDoll',
    '_masteryCDR','_masteryEnergy','_masteryDownside','_advancementId',
    '_fearCurse','_fearLucky','_fragileFlag','_badLuckOrig',
    '_greedCurse','_blindCurse','_blindCritGain','_shadowBorn',
    '_luckyCharm','_shadowCloak','_lightningRod','_echoStone',
    '_bloodShield','_greedBag','_chaosBlade','_deathMark',
    '_infMana','_godHand','_glassCannon','_vampLord',
    '_goldenApple','_mirrorShield','_bloodRuby','_toxicCloud','_ninjaTabi','_warDrum','_medusaHead','_gamblersDice',
    '_mastery_warrior','_mastery_mage','_mastery_shadow','_mastery_archer','_mastery_monk',
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
    endlessFloor: 0, endlessChaosCount: 0,
    // v0.60 构筑系统（无尽/BossRush）
    build: { classId: null, skillIds: [], relicIds: { legendary: null, epic: null, rare: [], common: [] }, curseIds: [], sinCurseId: null, chaosModId: null }
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
    upgrades: {}, highestNormal: 0,
    adWatched: 0, adDate: "", totalRuns: 0, totalWins: 0, totalDeaths: 0,
    totalKills: 0, clearedClasses: [],
    dailyBest: 0, dailyDate: "", achievements: [],

    // === 局外装备 ===
    trainingLevel: 0,   // 训练场等级 v0.50 P2
    lastFreeReset: '',  // 天赋树每周免费重置日期戳 v0.51

    // === 星象 ===
    stars: { daily: null, permanent: [], seasonal: null }, // ⭐NEW

    // === 命运烙印 ===
    unlockedBrands: [], equippedBrands: [], brandLevels: {}, // ⭐NEW

    // === 技能合成 ===
    synthSkills: [], // 合成的技能 ⭐NEW

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
    // v0.85: 移除重复键 outgameEquip（284行已有）+ 死字段 outgameInventory
    outgameEquip: [],
    // v0.81: 灵玉（广告点）
    jadeSpirits: 0,

    // 注意: deepMergeMeta 会将旧 tp 字段保留，需要在 _loadMeta 中做迁移
  };
}

const LB_PURE_KEY = "yaotower_v3.2_lb_pure";
const LB_CULTIVATE_KEY = "yaotower_v3.2_lb_culti";

// ---- Game 对象 ----
export const Game = {
  state: defState(),
  meta: defMeta(),
  _cheatDetected: false,
  _cheatViolations: 0,

  init() {
    this._loadMeta(); this._loadCodex();
    initAntiCheat();
    this._trackAllMeta();
    this._startIntegrityMonitor();
    // v0.82: 存档签名绑定会话，防止跨会话复制存档
    this.meta._sessionHash = getSessionHash();
  },

  set(u) {
    if (u) Object.assign(this.state, u);
    this.save();
    // 跟踪关键值变更
    if (this.state.gold != null) trackValue('gold', this.state.gold);
    if (this.state.player && this.state.player.atk != null) trackValue('player_atk', this.state.player.atk);
    _scheduleRender(this.state);
  },
  sync() {
    this.save();
    // v0.82: 每次同步时追踪关键值（覆盖直接赋值+sync路径）
    if (this.state.gold != null) trackValue('gold', this.state.gold);
    if (this.state.player && this.state.player.atk != null) trackValue('player_atk', this.state.player.atk);
    _scheduleRender(this.state);
  },

  // v0.82: 同步所有meta值到反作弊影子
  _trackAllMeta() {
    var m = this.meta;
    if (!m) return;
    trackValue('essence', m.essence || 0);
    trackValue('souls', m.souls || 0);
    trackValue('stones', m.stones || 0);
    trackValue('forgeStones', m.forgeStones || 0);
    trackValue('materials', m.materials || 0);
    trackValue('jadeSpirits', m.jadeSpirits || 0);
  },

  // v0.82: 启动完整性巡检（每15秒）
  _startIntegrityMonitor() {
    var self = this;
    this._integrityTimer = setInterval(function() {
      var issues = integrityCheck(self.state, self.meta);
      if (issues.length > 0) {
        self._cheatViolations++;
        console.warn('[反作弊] 巡检发现问题:', issues.join(', '));
        // 自动修复：回滚被篡改的值到最近的合法值
        if (issues.some(function(i) { return i.indexOf('shadow_mismatch') >= 0 || i.indexOf('value_mismatch') >= 0; })) {
          self._rollbackTamperedValues();
        }
        // DevTools持续检测
        if (checkDebugger()) {
          self._cheatViolations++;
        }
        // 达到阈值：标记存档
        if (self._cheatViolations >= 5) {
          if (!self._cheatDetected) {
            self._cheatDetected = true;
            self.meta._cheatFlag = true;
            self.saveMeta();
            console.error('[反作弊] 多次违规，存档已标记');
          }
        }
      }
    }, 15000);
  },

  // v0.82: 回滚被篡改的值
  _rollbackTamperedValues() {
    // 简单策略：从localStorage重载meta（上次合法保存的版本）
    try {
      var raw = localStorage.getItem(META_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        var defaults = defMeta();
        this.meta = deepMergeMeta(defaults, saved);
        this._trackAllMeta();
        console.warn('[反作弊] 已回滚meta到上次合法存档');
      }
    } catch(e) {}
    // 游戏状态回滚：从自动存档重载
    try {
      var autoSave = localStorage.getItem(SAVE_KEY);
      if (autoSave && this.state.gameOver === false) {
        // 只在游戏进行中时重载（避免覆盖结算）
        // 实际回滚太复杂，标记+警告为主
        console.warn('[反作弊] 游戏状态异常，请检查');
      }
    } catch(e2) {}
  },

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
      endless: s.endless, turn: s.turn, stats: s.stats, build: s.build,
      dailyMods: s.dailyMods,
      basePlayer: serializePlayer(s.player),
      enemy: s.enemy ? serializeEnemy(s.enemy) : null,
      enemies: (s.enemies || []).filter(function(e){return e&&e.hp>0;}).map(function(e){return serializeEnemy(e);}),
      selectedTarget: s.selectedTarget || 0,
      potionAtk: s.potionAtk || 0, potionDef: s.potionDef || 0,
      adDiscount: s.adDiscount || false, adRefreshCount: s.adRefreshCount || 0,
      turnInFloor: s.turnInFloor || 0,
      huntTargets: s.huntTargets || [], buildDirection: s.buildDirection || '',
      runCrits: s._runCrits || 0, runDodges: s._runDodges || 0,
      runKills: s._runKills || 0, runSynergies: s._runSynergies || [], runRelics: s._runRelics || [],
      fortuneName: s._fortuneName || '', mutationName: s._mutationName || ''
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { console.error("妖塔勇者录: 存档保存失败", e); }
    this._persistCodex();
  },

  load() {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    try {
      const d = JSON.parse(raw), s = this.state;
      // 版本不兼容：先备份旧档再重置（防版本更新丢数据）
      if (d.version !== SAVE_VERSION) {
        console.warn("[妖塔勇者录] 存档版本不兼容 v" + d.version + " → v" + SAVE_VERSION + "，已备份旧档");
        try { localStorage.setItem(SAVE_KEY + "_backup_v" + d.version, raw); } catch(e) {}
        this.deleteSave();
        return false;
      }
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
      s.endless = !!d.endless; s.turn = d.turn || 0; s.stats = d.stats || { totalDmg: 0, critCount: 0, roomsCleared: 0 }; s.build = d.build || { classId: null, skillIds: [], relicIds: { legendary: null, epic: null, rare: [], common: [] }, curseIds: [], sinCurseId: null, chaosModId: null };
      s.dailyMods = d.dailyMods || { globalId: null, playerId: null, enemyId: null };
      s.player = d.basePlayer ? deserializePlayer(d.basePlayer) : null;
      // 注意: 遗物 passive 效果已包含在 basePlayer 数值中，读档不需要重跑 passive
      // 否则会造成属性双重叠加（如力量护腕+5攻被重复加到存档的 atk 值上）
      s.enemy = d.enemy ? deserializeEnemy(d.enemy) : null;
      s.enemies = (d.enemies || []).map(function(ed){return deserializeEnemy(ed);});
      s.selectedTarget = d.selectedTarget || 0;
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
    } catch (e) { console.warn("[妖塔勇者录] 元数据损坏，已重置", e); this.meta = defMeta(); }
    this._checkAdReset();
  },
  saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); } catch (e) { console.error("妖塔勇者录: 元数据保存失败", e); } _scheduleRender(this.state); },

  _checkAdReset() {
    if (!this.meta) return;
    if (typeof this.meta.adWatched !== 'number' || isNaN(this.meta.adWatched) || this.meta.adWatched < 0 || this.meta.adWatched > 50) {
      this.meta.adWatched = 0;
    }
    // 版本迁移表：每个版本号对应的迁移函数（按序执行，保证老存档平滑升级不丢数据）
    // 新增版本时：META_MIGRATIONS[新版本号] = function(m){ ...迁移逻辑...; m._version = 新版本号; }
    var META_MIGRATIONS = {
      2: function(m) { m.adWatched = 0; }
    };
    var curVer = this.meta._version || 1;
    if (curVer < 2) {
      var ver = curVer;
      while (ver < 2) {
        ver++;
        if (META_MIGRATIONS[ver]) META_MIGRATIONS[ver](this.meta);
      }
      this.meta._version = 2;
      this.saveMeta();
    }
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (this.meta.adDate !== today) {
      this.meta.adDate = today; this.meta.adWatched = 0; this.saveMeta();
    }
  },

  // v0.50 存档导出/导入（保留兼容）
  exportMeta() { try { return JSON.stringify(this.meta, null, 2); } catch(e) { return null; } },
  importMeta(json) {
    try { var d = JSON.parse(json); if (!d || typeof d !== 'object') return false; this.meta = deepMergeMeta(defMeta(), d); this.saveMeta(); return true; }
    catch(e) { return false; }
  },
  exportSave() { try { return localStorage.getItem(SAVE_KEY); } catch(e) { return null; } },
  importSave(raw) { try { localStorage.setItem(SAVE_KEY, raw); return true; } catch(e) { return false; } },

  // ===== v0.82 防作弊存档槽位系统 =====
  /** 保存当前游戏到指定槽位 */
  saveToSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= SLOT_COUNT) return false;
    var s = this.state;
    var metaClone = JSON.parse(JSON.stringify(this.meta)); // 深拷贝防引用
    var saveRaw = localStorage.getItem(SAVE_KEY); // 当前自动存档数据
    var floor = s.totalFloor || 0;
    var className = s.playerClass ? s.playerClass.name : "";
    var packed = _packSlotData(metaClone, saveRaw, floor, className);
    try {
      localStorage.setItem(SLOT_PREFIX + slotIndex, JSON.stringify(packed));
      return true;
    } catch(e) { console.error("[妖塔勇者录] 保存槽位失败", e); return false; }
  },
  /** 从指定槽位读取存档 */
  loadFromSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= SLOT_COUNT) return null;
    try {
      var raw = localStorage.getItem(SLOT_PREFIX + slotIndex);
      if (!raw) return null;
      var packed = JSON.parse(raw);
      var data = _unpackSlotData(packed);
      if (!data) {
        console.warn("[妖塔勇者录] 槽位" + slotIndex + "校验失败，存档已损坏或被篡改");
        return { error: "checksum_failed" };
      }
      if (data._versionMismatch) {
        console.warn("[妖塔勇者录] 槽位" + slotIndex + "版本不兼容 v" + data.version + "，数据已保留未删除");
        return { error: "version_mismatch", version: data.version };
      }
      return data;
    } catch(e) { console.error("[妖塔勇者录] 读取槽位失败", e); return null; }
  },
  /** 获取槽位摘要信息（不加载数据，供UI展示） */
  getSlotInfo(slotIndex) {
    if (slotIndex < 0 || slotIndex >= SLOT_COUNT) return null;
    try {
      var raw = localStorage.getItem(SLOT_PREFIX + slotIndex);
      if (!raw) return { empty: true };
      var packed = JSON.parse(raw);
      return {
        empty: false,
        floor: packed.floor || 0,
        className: packed.className || "",
        timestamp: packed.timestamp || 0,
        valid: verifyChecksum((packed.meta || "") + "|" + (packed.save || "empty") + "|" + (packed.floor || 0), packed._globalCS)
      };
    } catch(e) { return { empty: true, error: true }; }
  },
  /** 删除指定槽位 */
  deleteSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= SLOT_COUNT) return;
    localStorage.removeItem(SLOT_PREFIX + slotIndex);
  },
  /** 应用槽位数据到当前游戏 */
  applySlotData(data) {
    if (!data || !data.meta) return false;
    // 恢复元数据
    this.meta = deepMergeMeta(defMeta(), data.meta);
    this.saveMeta();
    // 恢复游戏存档
    if (data.save) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data.save));
    } else {
      localStorage.removeItem(SAVE_KEY);
    }
    return true;
  },

  addEssence(n) { if (!this.meta) return; this.meta.essence = Math.min((this.meta.essence || 0) + n, 999); trackValue('essence', this.meta.essence); this.saveMeta(); },
  getEssence() { return this.meta.essence || 0; },
  addSouls(n) { if (!this.meta) return; this.meta.souls = Math.min((this.meta.souls || 0) + n, 9999); trackValue('souls', this.meta.souls); this.saveMeta(); },
  addStones(n) { if (!this.meta) return; this.meta.stones = Math.min((this.meta.stones || 0) + n, 9999); trackValue('stones', this.meta.stones); this.saveMeta(); },
  addForgeStones(n) { if (!this.meta) return; this.meta.forgeStones = Math.min((this.meta.forgeStones || 0) + n, 999); trackValue('forgeStones', this.meta.forgeStones); this.saveMeta(); },
  addMaterials(n) { if (!this.meta) return; this.meta.materials = Math.min((this.meta.materials || 0) + n, 999); trackValue('materials', this.meta.materials); this.saveMeta(); },
  addJadeSpirits(n) { if (!this.meta) return; this.meta.jadeSpirits = Math.min((this.meta.jadeSpirits || 0) + n, 999); trackValue('jadeSpirits', this.meta.jadeSpirits); this.saveMeta(); },

  // ---- 天赋树 ----
  hasTalentNode(nodeId) { return (this.meta.talentNodes || []).includes(nodeId); },
  unlockTalentNode(nodeId) {
    if (!this.meta.talentNodes) this.meta.talentNodes = [];
    // v0.85: 防御性上限 — 与UI一致（根节点上限3/5层，非根节点唯一），防绕过UI无限叠加
    var tree = R.get('talentTree') || [];
    var node = tree.find(function(n) { return n.id === nodeId; });
    if (!node) return false;
    var owned = 0;
    for (var i = 0; i < this.meta.talentNodes.length; i++) { if (this.meta.talentNodes[i] === nodeId) owned++; }
    if (node.branch === 'root') {
      var oStage = this.meta.onboardingStage || 0;
      var rootMax = oStage >= 2 ? 5 : 3;
      if (owned >= rootMax) return false;
    } else {
      if (owned >= 1) return false;
    }
    this.meta.talentNodes.push(nodeId); // 允许重复购买（根节点叠加层数）
    this.saveMeta();
    return true;
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
    if (!this.meta) { console.warn("[妖塔勇者录] canWatchAd: meta 未初始化"); return false; }
    this._checkAdReset();
    const diff = R.get('difficulties', this.state.difficulty) || R.get('difficulties', 'standard');
    const watched = Number(this.meta.adWatched) || 0;
    const limit = diff ? (Number(diff.adLimit) || 10) : 10;
    console.log("[妖塔勇者录] canWatchAd:", { watched, limit, diffId: this.state.difficulty, canWatch: watched < limit });
    return watched < limit;
  },
  watchAd() {
    if (!this.meta) { console.warn("[妖塔勇者录] watchAd: meta 未初始化"); return false; }
    this._checkAdReset();
    const diff = R.get('difficulties', this.state.difficulty) || R.get('difficulties', 'standard');
    const limit = diff ? (Number(diff.adLimit) || 10) : 10;
    const watched = Number(this.meta.adWatched) || 0;
    if (watched >= limit) { console.log("[妖塔勇者录] watchAd: 已达上限", { watched, limit }); return false; }
    this.meta.adWatched = watched + 1;
    this.saveMeta();
    console.log("[妖塔勇者录] watchAd: 成功, 已观看", this.meta.adWatched, "/", limit);
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
    // v0.85: 不用 Math.floor — 小基数(如atk 15)取整会把衰减后的百分比加成吞成0
    var tb = this.getTalentBonuses();
    if (tb.atkMul) p.atk = p.atk * (1 + tb.atkMul * decay);
    if (tb.hpMul) { p.maxHp = p.maxHp * (1 + tb.hpMul * decay); p.hp = p.hp * (1 + tb.hpMul * decay); }
    if (tb.defMul) p.def = p.def * (1 + tb.defMul * decay);
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

    // v0.50 P2: 训练场永久属性加成
    var tl = this.meta.trainingLevel || 0;
    if (tl > 0) { p.atk += tl; p.maxHp += tl * 5; p.hp += tl * 5; p.def += tl; }

    // v0.60 合成遗物：下局开局自动获得
    var forgedId = this.meta.forgedRelic;
    if (forgedId) {
      var forgedRelic = (R.get('relics') || []).find(function(r) { return r.id === forgedId; });
      if (forgedRelic) {
        if (!s.relics) s.relics = [];
        // 检查是否已有同名遗物
        if (!s.relics.some(function(r) { return r.id === forgedRelic.id; })) {
          s.relics.push({ ...forgedRelic });
        }
        // 一次性消耗，不自动清空（由玩家手动在遗物师面板重新合成）
      }
    }

    // v0.81: 地下城锻造属性（附魔+精炼）— 在硬上限之前应用
    var dg = this.meta.dungeon;
    if (dg && dg.forge) {
      var f = dg.forge;
      if (f.enchantAtk) p.atk += f.enchantAtk * 8;
      if (f.enchantHp) { p.maxHp += f.enchantHp * 25; p.hp += f.enchantHp * 25; }
      if (f.enchantDef) p.def += f.enchantDef * 4;
      if (f.enchantCrit) p.critRate += f.enchantCrit * 0.03;
      if (f.enchantPen) p.pen = (p.pen || 0) + f.enchantPen * 0.05;
      if (f.enchantVamp) p.lifeSteal = (p.lifeSteal || 0) + f.enchantVamp * 0.04;
      if (f.refineAtk) p.atk += f.refineAtk;
      if (f.refineHp) { p.maxHp += f.refineHp * 5; p.hp += f.refineHp * 5; }
      if (f.refineDef) p.def += f.refineDef;
    }

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

  // v0.83: 裂隙专用加成（仅天赋树+精炼+附魔，不含成就/修炼/精通/进阶/觉醒/铭牌/星图）
  applyRiftBonuses(p) {
    var s = this.state;
    // 保存基础值用于硬上限计算
    var baseAtk = p.atk, baseHp = p.maxHp, baseDef = p.def, baseCrit = p.critRate;

    // 1. 天赋树加成（裂隙中100%生效，不衰减）
    // 注意：不用 Math.floor —— 固定模板基数小(18攻/5防)，取整会把百分比加成吞成0
    var tb = this.getTalentBonuses();
    if (tb.atkMul) p.atk = p.atk * (1 + tb.atkMul);
    if (tb.hpMul) { p.maxHp = p.maxHp * (1 + tb.hpMul); p.hp = p.hp * (1 + tb.hpMul); }
    if (tb.defMul) p.def = p.def * (1 + tb.defMul);
    if (tb.critRate) p.critRate += tb.critRate;
    if (tb.critMul) p.critMul = (p.critMul || 1.5) + tb.critMul;
    if (tb.lifeSteal) p.lifeSteal = (p.lifeSteal || 0) + tb.lifeSteal;
    if (tb.pen) p.pen = (p.pen || 0) + tb.pen;
    if (tb.dodge) p.dodge = Math.min(0.75, (p.dodge || 0) + tb.dodge);
    if (tb.dmgReduce) p.dmgReduce = (p.dmgReduce || 0) + tb.dmgReduce;
    if (tb.goldMul) p.goldMul = (p.goldMul || 1) * (1 + tb.goldMul);
    // 非数值型天赋
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
    if (tb.relicRate) p._talentRelicRate = (p._talentRelicRate || 0) + tb.relicRate;
    if (tb.shopDiscount) p._talentShopDiscount = (p._talentShopDiscount || 0) + tb.shopDiscount;
    if (tb.eventGood) p._talentEventGood = (p._talentEventGood || 0) + tb.eventGood;
    if (tb.rareWeight) p._talentRareWeight = (p._talentRareWeight || 0) + tb.rareWeight;
    if (tb.eliteRate) p._talentEliteRate = (p._talentEliteRate || 0) + tb.eliteRate;
    if (tb.curseReduce) p._talentCurseReduce = (p._talentCurseReduce || 0) + tb.curseReduce;

    // 2. 硬上限（只封「基础+天赋」— v0.85: 精炼/附魔/装备不受限，与主世界装备同规则）
    var MAX_ATK_BONUS = 0.40, MAX_HP_BONUS = 0.50, MAX_DEF_BONUS = 0.35, MAX_CRIT_BONUS = 0.30;
    p.atk = Math.min(p.atk, Math.floor(baseAtk * (1 + MAX_ATK_BONUS)));
    p.maxHp = Math.min(p.maxHp, Math.floor(baseHp * (1 + MAX_HP_BONUS)));
    p.hp = Math.min(p.hp, p.maxHp);
    p.def = Math.min(p.def, Math.floor(baseDef * (1 + MAX_DEF_BONUS)));
    p.critRate = Math.min(p.critRate, baseCrit + MAX_CRIT_BONUS);
    p.dodge = Math.min(0.75, p.dodge || 0);
    p.lifeSteal = Math.min(0.40, p.lifeSteal || 0);

    // 3. 裂隙锻造加成（精炼+附魔）— 硬上限之后叠加，作为核心养成不受局外加成上限约束
    var dg = this.meta.dungeon;
    if (dg && dg.forge) {
      var f = dg.forge;
      if (f.enchantAtk) p.atk += f.enchantAtk * 8;
      if (f.enchantHp) { p.maxHp += f.enchantHp * 25; p.hp += f.enchantHp * 25; }
      if (f.enchantDef) p.def += f.enchantDef * 4;
      if (f.enchantCrit) p.critRate += f.enchantCrit * 0.03;
      if (f.enchantPen) p.pen = (p.pen || 0) + f.enchantPen * 0.05;
      if (f.enchantVamp) p.lifeSteal = (p.lifeSteal || 0) + f.enchantVamp * 0.04;
      if (f.refineAtk) p.atk += f.refineAtk;
      if (f.refineHp) { p.maxHp += f.refineHp * 5; p.hp += f.refineHp * 5; }
      if (f.refineDef) p.def += f.refineDef;
    }
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

  // v0.60: 最终硬上限 — 在所有局外/精通/转职/觉醒/烙印应用后调用
  applyFinalCaps(p) {
    var s = this.state;
    var cls = s.playerClass;
    var baseAtk = cls ? cls.atk : 15;
    var baseHp = cls ? cls.maxHp : 100;
    var baseDef = cls ? cls.def : 2;
    var baseCrit = cls ? cls.critRate : 0.2;
    var MAX_ATK_BONUS = 0.40, MAX_HP_BONUS = 0.50, MAX_DEF_BONUS = 0.35, MAX_CRIT_BONUS = 0.30;
    p.atk = Math.min(p.atk, Math.floor(baseAtk * (1 + MAX_ATK_BONUS)));
    p.maxHp = Math.min(p.maxHp, Math.floor(baseHp * (1 + MAX_HP_BONUS)));
    p.hp = Math.min(p.hp, p.maxHp);
    p.def = Math.min(p.def, Math.floor(baseDef * (1 + MAX_DEF_BONUS)));
    p.critRate = Math.min(p.critRate, baseCrit + MAX_CRIT_BONUS);
    p.dodge = Math.min(0.75, p.dodge || 0);
    p.lifeSteal = Math.min(0.40, p.lifeSteal || 0);
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
    } catch (e) { console.error("妖塔勇者录: 图鉴保存失败", e); }
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
    } catch (e) { console.error("妖塔勇者录: 排行榜保存失败", e); }
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
      import('../platform/tapsave.js').then(function(m) { m.TapSave.clearCloud(); }).catch(function() {});
    }
    this.state._appliedMutations = [];
    this.state.huntTargets = [];
  }
};

// ---- 敌人序列化 ----
function serializeEnemy(e) {
  return {
    name: e.name, hp: e.hp, maxHp: e.maxHp, atk: e.atk, def: e.def,
    icon: e.icon || '', exp: e.exp || '',
    weakness: e.weakness || null, weaknessDesc: e.weaknessDesc || null,
    tags: e.tags.map(t => ({ id: t.id, name: t.name })),
    aiTurn: e.aiTurn || 0, aiCharge: e.aiCharge || false, chargeTurns: e.chargeTurns || 0,
    aiCurse: e.aiCurse || false, doubleFirst: e.doubleFirst || false,
    lifeSteal: e.lifeSteal || 0, thorn: e.thorn || 0,
    _shield: !!e._shield, _shieldBroken: e._shieldBroken || 0,
    _healAllies: e._healAllies || 0, _crystalDoubled: !!e._crystalDoubled,
    _counterStacks: e._counterStacks || 0, _charged: !!e._charged, _defendedThisTurn: !!e._defendedThisTurn,
    _intent: e._intent ? { type: e._intent.type, icon: e._intent.icon, name: e._intent.name } : null,
    _buffs: (e._buffs || []).map(b => ({ id: b.id, name: b.name, turns: b.turns, data: b.data || {} }))
  };
}

function deserializeEnemy(d) {
  return {
    name: d.name, hp: d.hp, maxHp: d.maxHp, atk: d.atk, def: d.def,
    icon: d.icon || '', exp: d.exp || '',
    weakness: d.weakness || null, weaknessDesc: d.weaknessDesc || null,
    tags: (d.tags || []).map(t => {
      const tag = R.get('monsterTags').find(mt => mt.id === t.id);
      return tag ? { ...tag } : { ...t };
    }),
    aiTurn: d.aiTurn || 0, aiCharge: d.aiCharge || false, chargeTurns: d.chargeTurns || 0,
    aiCurse: d.aiCurse || false, doubleFirst: d.doubleFirst || false,
    lifeSteal: d.lifeSteal || 0, thorn: d.thorn || 0,
    _shield: !!d._shield, _shieldBroken: d._shieldBroken || 0,
    _healAllies: d._healAllies || 0, _crystalDoubled: !!d._crystalDoubled,
    _counterStacks: d._counterStacks || 0, _charged: !!d._charged, _defendedThisTurn: !!d._defendedThisTurn,
    _intent: d._intent || null,
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
        console.warn("[妖塔勇者录] 未知buff类型，使用默认:", b.id);
        return { ...b, onTick: b.data ? (e, bf) => { e.hp -= bf.data.dmg; if (e.hp <= 0) return 'dead'; } : undefined, onRemove: () => {} };
    }
  });
}
