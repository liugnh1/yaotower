// ===================== 房间/关卡系统 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';

// ---- 初始化关卡（只设置数据，不进入房间）----
export function initZone(idx) {
  const s = Game.state;
  s.zoneIndex = idx;
  const route = R.get('simpleRoute');
  const routeEntry = route[idx];
  if (!routeEntry) { console.error("No route for zone index", idx); return false; }
  s.zone = R.get('zones', routeEntry.zone);
  s.floorInZone = 1;
  // 随机选取一个房间结构模板（不包含Boss，Boss固定追加在末尾）
  const templates = R.get('roomTemplates').simple;
  let template = s.rng.pick(templates).slice();
  if (s.extraElite) {
    const bi = template.findIndex(r => r === "battle");
    if (bi >= 0) template[bi] = "elite";
  }
  // Boss 固定在最末尾，其余房间保持模板中的固定顺序（不再全量 shuffle）
  s.roomQueue = template.concat("boss");
  s.roomIndex = 0;
  Events.emit(E.ZONE_CHANGE, { zone: s.zone, zoneIndex: idx });
  // 返回 false 表示需要玩家选路线，true 表示可直接进入
  if (idx > 0) {
    const prevRoute = route[idx - 1];
    if (prevRoute && prevRoute.choices.length > 1) return false;
  }
  return true;
}

// ---- 获取当前房间ID（不改变状态）----
export function getCurrentRoomId() {
  const s = Game.state;
  return s.roomQueue[s.roomIndex] || null;
}

// ---- 进入房间后的状态重置 ----
export function prepareRoomEntry() {
  const s = Game.state;
  s.potionAtk = 0; s.potionDef = 0;
  s.adDiscount = false; s.adRefreshCount = 0;
}

// ---- 检查是否本关结束 ----
export function isZoneEnd() {
  const s = Game.state;
  return s.roomIndex >= s.roomQueue.length;
}

// ---- 下一房间（推进房间索引）----
export function advanceRoom() {
  const s = Game.state;
  s.roomIndex++;
}

// ---- 推进楼层（totalFloor++）----
export function advanceFloor() {
  const s = Game.state;
  s.totalFloor++;
  s.floorInZone++;
}

// ---- 简单模式通关检查 ----
export function isSimpleRouteEnd(zoneIndex) {
  return zoneIndex >= 4;
}
