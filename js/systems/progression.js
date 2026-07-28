// ===================== 局外成长 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';

// ---- 应用局外加成 ----
export function applyMetaBonus(p) {
  Game.applyMetaBonus(p);
}

// ---- 结算天赋点 ----
export function calcTP(floor, isWin) {
  const f = (typeof floor === 'number' && !isNaN(floor)) ? floor : 0;
  if (isWin) return 5 + Math.floor(f / 10);
  return Math.max(0, Math.floor(f / 10));
}

// ---- 角色经验结算 ----
export function awardCharExp(s) {
  if (s.playerClass) {
    const exp = s.totalFloor + (s.stats.roomsCleared || 0);
    Game.addCharExp(s.playerClass.id, exp);
  }
}

// ---- 获取开局药水 ----
export function getStartPotions() {
  return Game.getStartPotions();
}

// ---- 广告天赋点加成 ----
export function getAdTPBonus() {
  return Game.getAdTPBonus();
}
