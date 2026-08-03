// ===================== v0.80 模式初始化函数 =====================
// 从 main.js 提取：无尽挑战 / Boss Rush / 无尽深渊 / 局外装备加载
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { RNG } from '../core/rng.js';
import * as Combat from './combat.js';
import { showBossNarrative } from '../ui/effects.js';
import { switchScreen } from '../ui/screens.js';
import { applyEquipStats } from './equipment.js';

// 回调注入：这些函数仍在 main.js 中
var _injected = { enterRoom: null, gameClear: null, updateBattleBg: null };

export function injectModeCallbacks(cbs) {
  if (cbs.enterRoom) _injected.enterRoom = cbs.enterRoom;
  if (cbs.gameClear) _injected.gameClear = cbs.gameClear;
  if (cbs.updateBattleBg) _injected.updateBattleBg = cbs.updateBattleBg;
}

// 加载局外装备到当前状态
export function loadOutgameEquipToState(s) {
  var eq = Game.meta.outgameEquipped;
  if (!eq) return;
  var slots = ['weapon','helm','armor','ringL','ringR','braceletL','braceletR','amulet','belt','medal'];
  slots.forEach(function(slotId) {
    if (eq[slotId]) {
      var item = eq[slotId];
      s.equip.push({...item});
      applyEquipStats(s.player, item);
      // v0.81: 局外装备效果应用到玩家
      if (item._effects) {
        item._effects.forEach(function(fx) {
          if (fx.apply) fx.apply(fx.val, s.player);
        });
      }
    }
  });
  Combat.recalcEquipSetBonus();
}

// 无尽挑战 Zone 初始化
export function initEndlessChallengeZone() {
  var s = Game.state;
  var floor = s.totalFloor || 1;
  var pool = floor > 30 ? 'endless' : 'tower_upper'; // v0.81: 30层后换endless池
  s.zone = { id:'endless_challenge', name:'无尽挑战', icon:'🌀', enemyPool: pool, scale:1.0, modifier:{id:'endless_challenge',desc:'🌀 无尽挑战'} };
  s._roomPool = generateEndlessRooms(8); s._bossReady = false; s.floorInZone = 1;
  s.endlessChaosCount = 0; if (!s._nextChaosFloor) s._nextChaosFloor = 10; s._currentRoomType = 'battle';
  _injected.enterRoom();
}

export function generateEndlessRooms(count) {
  var rooms = []; for (var i=0;i<count;i++) rooms.push(i%5===4?'elite':'battle'); return rooms;
}

// Boss Rush 初始化
export function initBossRush() {
  var s = Game.state;
  s.zone = { id:'boss_rush', name:'Boss Rush', icon:'💀', enemyPool:'boss', scale:1.0, modifier:{id:'boss_rush',desc:'💀 Boss Rush'} };
  var easyPool  = R.get('bossRushT1') || [];
  var midPool   = R.get('bossRushT2') || [];
  var hardPool  = R.get('bossRushT3') || [];
  var endPool   = R.get('bossRushT4') || [];
  if (easyPool.length === 0) {
    var allBosses = Object.values(R.get('bosses')||{}).concat(Object.values(R.get('bosses_hell')||{}));
    easyPool = allBosses; midPool = allBosses; hardPool = allBosses; endPool = allBosses;
  }
  var rng = s.rng;
  s._bossRushQueue = [];
  for (var i = 0; i < 50; i++) {
    var pool;
    if (i < 10)       pool = easyPool;
    else if (i < 20)  pool = midPool;
    else if (i < 35)  pool = hardPool;
    else              pool = endPool;
    s._bossRushQueue.push(rng.pick(pool));
  }
  s._bossRushHP = s.player.hp;
  s.zoneIndex = 0;
  showBossNarrative([
    "黑暗之中，一座巨大的竞技场浮现……",
    "五十位来自各界的领主与魔王，",
    "将在此车轮迎战——至死方休。",
    "胜者，将名刻妖塔之巅；",
    "败者，肉身与魂魄俱归尘土。",
    "—— Boss Rush · 五十连战"
  ], function() {
    nextBossRushStage();
  });
}

// Boss Rush 下一阶段
export function nextBossRushStage() {
  var s = Game.state;
  if (s.bossRushIndex >= s._bossRushQueue.length) { _injected.gameClear(); return; }
  var bossData = s._bossRushQueue[s.bossRushIndex];
  var tier = Math.floor(s.bossRushIndex / 10);
  var idxInTier = s.bossRushIndex % 10;
  var scaleHp  = Math.pow(2, tier) * (1 + idxInTier * 0.35);
  var scaleAtk = Math.pow(1.6, tier) * (1 + idxInTier * 0.25);
  var scaleDef = tier * 4 + Math.floor(idxInTier * 1.5);
  var p2Data = bossData.phase2 ? {
    name: bossData.phase2.name, atkMul: bossData.phase2.atkMul, defBonus: bossData.phase2.defBonus,
    skill: bossData.phase2.skill ? {
      name: bossData.phase2.skill.name, desc: bossData.phase2.skill.desc,
      fn: bossData.phase2.skill.fn
    } : null
  } : null;
  var skCopy = bossData.skill ? {
    name: bossData.skill.name, desc: bossData.skill.desc,
    fn: bossData.skill.fn
  } : null;
  s.enemy = {
    name: bossData.name, icon: bossData.icon || '💀', exp: bossData.exp || '',
    hp: Math.floor(bossData.hp * scaleHp), maxHp: Math.floor(bossData.hp * scaleHp),
    atk: Math.floor(bossData.atk * scaleAtk), def: Math.floor((bossData.def || 0) + scaleDef),
    weakness: bossData.weakness || null, weaknessDesc: bossData.weaknessDesc || null,
    tags: [], _buffs: [], aiTurn: 0, skill: skCopy, phase2: p2Data
  };
  s.enemies = [s.enemy]; s.selectedTarget = 0;
  s._currentRoomType = 'boss'; s.totalFloor = s.bossRushIndex + 1;
  s._bossIntro = null; s._bossPhase2Intro = null;
  _injected.updateBattleBg(); Combat.startBattle('boss'); switchScreen('main');
}

// 无尽深渊 Zone 初始化
export function initEndlessZone() {
  var s = Game.state;
  var pool = s.endlessFloor > 50 ? 'endless' : 'tower_upper'; // v0.81: 50层后换endless池
  s.zone = { id: "endless", name: "无尽深渊", icon: "🌀", enemyPool: pool, scale: 1 + s.endlessFloor * 0.03, modifier: { id: "endless", desc: "🌀 无尽深渊第" + s.endlessFloor + "层" } };
  s.floorInZone = 1;
  s._zoneMod = s.zone.modifier;
  var templates = [["battle","battle","elite","battle","battle","battle"]];
  s._roomPool = s.rng.pick(templates).slice();
  s._bossReady = false;
  _injected.enterRoom();
}
