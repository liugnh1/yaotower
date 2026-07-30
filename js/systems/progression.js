// ===================== 局外成长 v0.50 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';

// ---- 应用局外加成（含天赋树衰减）----
export function applyMetaBonus(p) {
  Game.applyMetaBonus(p);
}

// ---- 结算灵蕴（替代旧calcTP）----
export function calcEssence(floor, isWin) {
  const f = (typeof floor === 'number' && !isNaN(floor)) ? floor : 0;
  if (isWin) return 8 + f;  // 通关: 8 + totalFloor
  return Math.max(0, Math.floor(f / 5));  // 死亡: floor/5
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

// ---- 结算通用素材 ----
export function calcMaterials(floor, isBoss) {
  var base = Math.floor(floor / 5);
  if (isBoss) base += 3;
  return Math.max(0, base);
}

// ---- 结算锻造石 ----
export function calcForgeStones(isWin, difficulty) {
  if (!isWin) return 0;
  if (difficulty === 'hell' || (difficulty && difficulty.startsWith('hell'))) return 15;
  return 5;
}
