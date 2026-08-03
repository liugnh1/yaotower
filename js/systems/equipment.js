// ===================== 装备工具函数 v0.80 =====================
// 从 main.js 提取，替代 window._addEquip 全局变量
import { Game } from '../core/state.js';
import * as Combat from './combat.js';
import { playSound } from '../core/audio.js';
import { log, toast } from '../ui/effects.js';

// 应用装备属性到玩家
export function applyEquipStats(p, eq) {
  switch (eq.stat) {
    case "maxHp": p.maxHp += eq.val; p.hp = Math.min(p.hp + eq.val, p.maxHp); break;
    case "atk": p.atk += eq.val; break;
    case "def": p.def += eq.val; break;
    case "critRate": p.critRate += eq.val / 100; break;
    case "dodge": p.dodge = (p.dodge||0) + eq.val / 100; break;
    default: break;
  }
  if (eq._extraStats) {
    if (eq._extraStats.atk) p.atk += eq._extraStats.atk;
    if (eq._extraStats.def) p.def += eq._extraStats.def;
    if (eq._extraStats.maxHp) { p.maxHp += eq._extraStats.maxHp; p.hp = Math.min(p.hp + eq._extraStats.maxHp, p.maxHp); }
    if (eq._extraStats.critRate) p.critRate += eq._extraStats.critRate / 100;
    if (eq._extraStats.dodge) p.dodge = (p.dodge||0) + eq._extraStats.dodge / 100;
  }
  // v0.80 fix: _bonusStats 应该加法（之前从 removeEquipStats 复制粘贴时遗留了减法）
  if (eq._bonusStats) {
    if (eq._bonusStats.atk) p.atk += eq._bonusStats.atk;
    if (eq._bonusStats.def) p.def += eq._bonusStats.def;
    if (eq._bonusStats.maxHp) { p.maxHp += eq._bonusStats.maxHp; p.hp = Math.min(p.hp + eq._bonusStats.maxHp, p.maxHp); }
    if (eq._bonusStats.dodge) p.dodge = (p.dodge||0) + eq._bonusStats.dodge;
    if (eq._bonusStats.critRate) p.critRate += eq._bonusStats.critRate;
    if (eq._bonusStats.pen) p.pen = (p.pen||0) + eq._bonusStats.pen;
    if (eq._bonusStats.regen) p.regen = (p.regen||0) + eq._bonusStats.regen;
  }
}

// 移除装备属性
export function removeEquipStats(p, eq) {
  switch (eq.stat) {
    case "maxHp": p.maxHp = Math.max(1, p.maxHp - eq.val); p.hp = Math.min(p.hp, p.maxHp); break;
    case "atk": p.atk = Math.max(1, p.atk - eq.val); break;
    case "def": p.def = Math.max(0, p.def - eq.val); break;
    case "critRate": p.critRate = Math.max(0, p.critRate - eq.val / 100); break;
    case "dodge": p.dodge = Math.max(0, (p.dodge||0) - eq.val / 100); break;
    default: break;
  }
  if (eq._extraStats) {
    if (eq._extraStats.atk) p.atk = Math.max(1, p.atk - eq._extraStats.atk);
    if (eq._extraStats.def) p.def = Math.max(0, p.def - eq._extraStats.def);
    if (eq._extraStats.maxHp) { p.maxHp = Math.max(1, p.maxHp - eq._extraStats.maxHp); p.hp = Math.min(p.hp, p.maxHp); }
    if (eq._extraStats.critRate) p.critRate = Math.max(0, p.critRate - eq._extraStats.critRate / 100);
    if (eq._extraStats.dodge) p.dodge = Math.max(0, (p.dodge||0) - eq._extraStats.dodge / 100);
  }
  if (eq._bonusStats) {
    if (eq._bonusStats.atk) p.atk = Math.max(1, p.atk - eq._bonusStats.atk);
    if (eq._bonusStats.def) p.def = Math.max(0, p.def - eq._bonusStats.def);
    if (eq._bonusStats.maxHp) { p.maxHp = Math.max(1, p.maxHp - eq._bonusStats.maxHp); p.hp = Math.min(p.hp, p.maxHp); }
    if (eq._bonusStats.dodge) p.dodge = Math.max(0, (p.dodge||0) - eq._bonusStats.dodge);
    if (eq._bonusStats.critRate) p.critRate = Math.max(0, p.critRate - eq._bonusStats.critRate);
    if (eq._bonusStats.pen) p.pen = Math.max(0, (p.pen||0) - eq._bonusStats.pen);
    if (eq._bonusStats.regen) p.regen = Math.max(0, (p.regen||0) - eq._bonusStats.regen);
  }
}

// v0.81: 根据模式决定装备槽上限 — 普通爬塔6件, 无尽/BR/地下城10件
export function getEquipLimit(s) {
  return (s.endless || s.mode === 'endless_challenge' || s.mode === 'boss_rush' || s.mode === 'dungeon') ? 10 : 6;
}

// 添加装备（满时调用 onFull 回调；无回调时直接push，兼容shop/event调用方）
export function addEquip(eq, trackQuestFn, onFull) {
  var s = Game.state;
  if (s.equip.length >= getEquipLimit(s)) {
    if (onFull) { onFull(eq); }
    else { s.equip.push(eq); applyEquipStats(s.player, eq); Combat.recalcEquipSetBonus(); Game.sync(); }
  } else {
    s.equip.push(eq);
    applyEquipStats(s.player, eq);
    playSound("equip");
    log(eq.icon + ' <span style="color:' + eq.color + '"><b>' + (eq.fullName||eq.name) + '</b></span> 已装备！' + eq.stat.toUpperCase() + '+' + eq.val, "win");
    if (trackQuestFn) trackQuestFn('equip', 1);
    Combat.recalcEquipSetBonus(); Game.sync();
  }
}
