// ===================== 房间/关卡系统（肉鸽分岔路版）=====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';
import { showBossNarrative } from '../ui/effects.js';

// 根据难度获取路由choices
// v0.85: 修复难度递进变体路由断裂 — 用 startsWith 匹配（casual_1..3 / standard_1..3 曾误入炼狱分支）
function getChoices(entry, diff) {
  if (!entry) return [];
  if (diff === 'casual' || diff === 'simple' || (diff && diff.startsWith('casual'))) return entry.choices_simple || entry.choices || [];
  if (diff === 'standard' || (diff && diff.startsWith('standard'))) return entry.choices_standard || entry.choices || [];
  return entry.choices_hell || entry.choices || [];
}

// ---- 初始化关卡（按 Zone ID 路由）----
export function initZone(zoneId) {
  const s = Game.state;
  const route = R.get('simpleRoute');
  const entry = route[zoneId];
  if (!entry) { console.error("No route for zone:", zoneId); return false; }

  s.zone = R.get('zones', zoneId);
  s.zoneIndex = entry.depth;
  s.floorInZone = 1;

  // 清除旧Zone环境效果
  if (s._zoneMod && s.player) {
    switch (s._zoneMod.id) {
      case "cave_gold": s.player.def += 2; break; // 还原DEF
      case "tower_regen": s.player.regen = Math.max(0, (s.player.regen || 0) - Math.floor(s.player.maxHp * 0.03)); break;
      case "tower_lower_drain": break; // v0.85: 还原已移至 startBattle（防双重还原）
      case "frozen_mp": /* MP系统已移除，无实际效果 */ break;
      case "void_crit": /* 每场战斗重新计算，无需还原 */ break;
      case "desert_storm": /* 每场战斗重新计算 */ break;
      case "swamp_poison": /* 每回合计算 */ break;
      case "forest_poison": /* 每回合计算 */ break;
      case "tower_upper_seal": /* 每场战斗重新计算 */ break;
      case "ruins_ancient": /* 怪物词条，不持久 */ break;
    }
  }
  s._zoneMod = null;
  // 应用新Zone环境效果
  s._zoneMod = s.zone.modifier || null;
  if (s._zoneMod) {
    if (s._zoneMod.id === "cave_gold" && s.player) s.player.def = Math.max(0, s.player.def - 2);
    if (s._zoneMod.id === "tower_regen" && s.player) s.player.regen = (s.player.regen || 0) + Math.floor(s.player.maxHp * 0.03);
    if (s._zoneMod.id === "tower_upper_seal") {
      setTimeout(function() {
        showBossNarrative(["魔王的威压笼罩了整个空间……","你的每一个动作都在他的注视之下。","此路极度危险——","但也是唯一的荣光之路。"], function(){});
      }, 600);
    }
    console.log("[妖塔勇者录] Zone环境效果:", s._zoneMod.desc);
  }

  // 生成房间池：按难度前缀选模板（兼容Ascension）
  var diff = s.difficulty || 'casual';
  var templateKey = diff.startsWith('hell') ? 'hell' : (diff.startsWith('standard') ? 'normal' : 'simple');
  var allTemplates = R.get('roomTemplates');
  var templates = allTemplates[templateKey] || allTemplates.simple;
  let template = s.rng.pick(templates).slice();
  // v0.51: 天赋树精英房率加成
  if (s.extraElite || (s.player && s.player._talentEliteRate && s.rng.chance(s.player._talentEliteRate))) {
    const bi = template.findIndex(r => r === "battle");
    if (bi >= 0) template[bi] = "elite";
  }
  const warmup = template.splice(0, 3);
  const rest = s.rng.shuffle(template);
  s._roomPool = warmup.concat(rest);
  s._bossReady = false;
  s._roomForkUsed = false;

  // v0.50 重置Zone结局统计
  resetZoneStats();
  Events.emit(E.ZONE_CHANGE, { zone: s.zone, zoneIndex: entry.depth });

  var choices = getChoices(entry, s.difficulty);
  return choices.length > 1 ? choices : null;
}

// ---- 从房间池顺序出牌（暖场在前，已洗牌在后）----
export function drawOne() {
  const s = Game.state;
  const pool = s._roomPool;

  // 池子空了 → Boss 或 Zone 结束
  if (pool.length === 0) {
    if (!s._bossReady) { s._bossReady = true; return "boss"; }
    return null;
  }

  return pool.shift(); // 顺序出牌：前3暖场战斗 → 洗乱的特殊房间+战斗
}

// ---- 从池子抽一张不同类型（岔路用），无不同类型返回 null ----
export function tryDrawDifferent(excludeType) {
  const s = Game.state;
  const pool = s._roomPool;

  const candidates = [];
  for (let i = 0; i < pool.length; i++) {
    if (pool[i] !== excludeType) candidates.push(i);
  }
  if (candidates.length === 0) return null;

  const idx = s.rng.pick(candidates);
  return pool.splice(idx, 1)[0];
}

// ---- 把未选择的房间放回池子 ----
export function returnRoom(type) {
  if (!type || type === "boss") return;
  Game.state._roomPool.push(type);
}

// ---- 检查是否 Zone 结束 ----
// v0.50 分支结局：Zone结束时根据行为判定结局类型
export function checkZoneEnding() {
  var s = Game.state;
  if (!s._zoneStats) return null;
  var stats = s._zoneStats;
  if (stats.battles >= 4 && stats.eventsPerfect === 0) return 'war';       // 战狂
  if (stats.sacrifices >= 2) return 'sacrifice';                          // 献祭
  if (stats.eventsPerfect >= 3 && stats.battles <= 2) return 'perfect';   // 完美
  return null;
}

export function getZoneEndingReward(endingType) {
  switch (endingType) {
    case 'war': return { essence: 2, text: '⚔️ 战狂结局：血路杀出，灵蕴+2' };
    case 'sacrifice': return { essence: 1, materials: 5, text: '💀 献祭结局：以代价换取力量，灵蕴+1 素材+5' };
    case 'perfect': return { essence: 15, text: '✨ 完美结局：智慧与勇气的结晶，灵蕴+15' };
    default: return null;
  }
}

// Zone结束时重置统计
export function resetZoneStats() {
  var s = Game.state;
  s._zoneStats = { battles: 0, eventsPerfect: 0, sacrifices: 0 };
}

export function isZoneEnd() {
  const s = Game.state;
  return s._roomPool.length === 0 && s._bossReady;
}

// ---- 推进楼层 ----
export function advanceFloor() {
  const s = Game.state;
  s.totalFloor++;
  s.floorInZone++;
}

// ---- 检查是否最终 Zone ----
export function isFinalZone(zoneId) {
  const route = R.get('simpleRoute');
  const entry = route[zoneId];
  if (!entry) return true;
  var choices = getChoices(entry, Game.state.difficulty);
  return choices.length === 0;
}

// ---- 获取 Zone 分支 ----
export function getZoneChoices(zoneId) {
  const route = R.get('simpleRoute');
  const entry = route[zoneId];
  return entry ? getChoices(entry, Game.state.difficulty) : [];
}

// ---- 进入房间前状态重置 ----
export function prepareRoomEntry() {
  const s = Game.state;
  s.potionAtk = 0; s.potionDef = 0;
  s.adDiscount = false; s.adRefreshCount = 0;
  // v0.50 清理战斗临时标记
  if (s.player) {
    s.player._keystoneFiredThisBattle = false;
    s.player._ninjaCounter = false;
    s.player._avengerAtk = 0;
    s.player._overload = false;
    s.player._superconduct = false;
  }
  s._smokeNext = false; s._curseTradeCount = 0;
  // 诅咒：恐惧（每进入新房间扣5%当前生命）
  if (s.player && s.player._fearCurse) {
    const loss = Math.max(1, Math.floor(s.player.hp * 0.05));
    s.player.hp -= loss;
    console.log("[妖塔勇者录] 恐惧诅咒触发，损失", loss, "生命");
  }
}
