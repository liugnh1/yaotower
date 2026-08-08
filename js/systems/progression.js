// ===================== 局外成长 v0.50 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';

// ---- 应用局外加成（含天赋树衰减）----
// v0.60: 此包装器已废弃，所有调用者直接使用 Game.applyMetaBonus(p)
// 保留导出以兼容旧代码
export function applyMetaBonus(p) { Game.applyMetaBonus(p); }

// ---- 结算灵蕴（替代旧calcTP）----
// v0.85: 产出×难度系数（简单0.5 / 普通0.8 / 炼狱1.3）— 鼓励高难度，防简单模式刷收益
export function diffMul() {
  var s = Game.state;
  var d = s ? (s.difficulty || 'standard') : 'standard';
  if (d === 'casual' || (d && d.startsWith('casual'))) return 0.5;
  if (d === 'hell' || (d && d.startsWith('hell'))) return 1.3;
  return 0.8;
}
export function calcEssence(floor, isWin) {
  const f = (typeof floor === 'number' && !isNaN(floor)) ? floor : 0;
  var base = isWin ? (8 + f) : Math.max(0, Math.floor(f / 5));
  return Math.max(1, Math.floor(base * diffMul()));
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
// v0.85: 产出×难度系数
export function calcMaterials(floor, isBoss) {
  var base = Math.floor(floor / 5);
  if (isBoss) base += 3;
  return Math.max(0, Math.floor(base * diffMul()));
}

// ---- 结算锻造石 ----
// v0.85: 产出×难度系数（锻造石全经济最紧，系数保证高难度收益）
export function calcForgeStones(isWin, difficulty, floor) {
  var mul = diffMul();
  if (difficulty === 'hell' || (difficulty && difficulty.startsWith('hell'))) return isWin ? Math.floor(20 * mul) : Math.max(0, Math.floor((floor||0) / 10 * mul));
  if (isWin) return Math.max(2, Math.floor(8 * mul));
  // v0.60: 死亡≥10层才给少量锻造石，防无限死亡刷收益
  var f = floor || 0;
  if (f < 10) return 0;
  // v0.85: 修复 floor 吞加成 — 至少给1（10层+简单难度曾因 floor(0.8)=0 白打）
  return Math.min(5, Math.max(1, Math.floor(f / 10 * mul)));
}
