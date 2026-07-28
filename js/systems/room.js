// ===================== 房间/关卡系统（肉鸽分岔路版）=====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';

// ---- 初始化关卡（按 Zone ID 路由）----
export function initZone(zoneId) {
  const s = Game.state;
  const route = R.get('simpleRoute');
  const entry = route[zoneId];
  if (!entry) { console.error("No route for zone:", zoneId); return false; }

  s.zone = R.get('zones', zoneId);
  s.zoneIndex = entry.depth;
  s.floorInZone = 1;

  // 应用Zone环境效果
  s._zoneMod = s.zone.modifier || null;
  if (s._zoneMod) {
    // 矿洞：防御-2
    if (s._zoneMod.id === "cave_gold" && s.player) s.player.def = Math.max(0, s.player.def - 2);
    if (s._zoneMod.id === "tower_regen" && s.player) s.player.regen = (s.player.regen || 0) + Math.floor(s.player.maxHp * 0.03);
    console.log("[妖塔] Zone环境效果:", s._zoneMod.desc);
  }

  // 生成房间池：模板洗牌 + Boss 单独标记
  const templates = R.get('roomTemplates').simple;
  let template = s.rng.pick(templates).slice();
  if (s.extraElite) {
    const bi = template.findIndex(r => r === "battle");
    if (bi >= 0) template[bi] = "elite";
  }
  // Fisher-Yates 洗牌（除了前3间保持战斗暖场）
  const warmup = template.splice(0, 3);       // 前3间固定战斗
  const rest = s.rng.shuffle(template);        // 其余打乱
  s._roomPool = warmup.concat(rest);           // 暖场在前，其余洗乱
  s._bossReady = false;
  s._roomForkUsed = false;

  Events.emit(E.ZONE_CHANGE, { zone: s.zone, zoneIndex: entry.depth });

  // 返回：是否有分支选择
  return entry.choices && entry.choices.length > 1 ? entry.choices : null;
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
  return entry && (!entry.choices || entry.choices.length === 0);
}

// ---- 获取 Zone 分支 ----
export function getZoneChoices(zoneId) {
  const route = R.get('simpleRoute');
  const entry = route[zoneId];
  return entry ? (entry.choices || []) : [];
}

// ---- 进入房间前状态重置 ----
export function prepareRoomEntry() {
  const s = Game.state;
  s.potionAtk = 0; s.potionDef = 0;
  s.adDiscount = false; s.adRefreshCount = 0;
  // 诅咒：恐惧（每进入新房间扣5%当前生命）
  if (s.player && s.player._fearCurse) {
    const loss = Math.max(1, Math.floor(s.player.hp * 0.05));
    s.player.hp -= loss;
    console.log("[妖塔] 恐惧诅咒触发，损失", loss, "生命");
  }
}
