// ===================== Buff/Effect 统一管理 =====================
// 所有持续效果（燃烧、迟缓、眩晕、诅咒等）通过此模块管理
// 替代散落在 combat.js 各处的 _burn/_slow/_stun/debuffAtk 字段

import { E, Events } from '../core/event-bus.js';

// ---- 给目标添加 buff ----
// target: player 或 enemy 对象
// buff: { id, name, turns, onTick, onRemove, data? }
export function addBuff(target, buff) {
  if (!target._buffs) target._buffs = [];
  // 天梯/副本精英&Boss免疫硬控（眩晕/冻结/石化）
  if (target._towerImmune && (buff.id === 'stun' || buff.id === 'freeze' || buff.id === 'stone')) return;
  // 同 id 覆盖（刷新持续时间）
  const existing = target._buffs.find(b => b.id === buff.id);
  if (existing) {
    existing.turns = buff.turns;
    if (buff.data) Object.assign(existing.data || (existing.data = {}), buff.data);
    return;
  }
  target._buffs.push({ ...buff, data: buff.data ? { ...buff.data } : {} });
}

// ---- 每回合 tick 所有 buff ----
// 返回 'dead' 表示目标已死亡，'stunned' 表示跳过行动
export function tickBuffs(target, isEnemy) {
  if (!target._buffs || target._buffs.length === 0) return 'ok';
  let stunned = false;
  const toRemove = [];

  for (const b of target._buffs) {
    if (b.onTick) {
      const result = b.onTick(target, b);
      if (result === 'dead') { target.hp = 0; target._buffs = []; return 'dead'; }
      if (result === 'stunned') stunned = true;
    }
    b.turns--;
    if (b.turns <= 0) {
      if (b.onRemove) b.onRemove(target, b);
      toRemove.push(b);
    }
  }

  target._buffs = target._buffs.filter(b => !toRemove.includes(b));
  return stunned ? 'stunned' : 'ok';
}

// ---- 移除指定 buff ----
export function removeBuff(target, id) {
  if (!target._buffs) return;
  const b = target._buffs.find(x => x.id === id);
  if (b && b.onRemove) b.onRemove(target, b);
  target._buffs = target._buffs.filter(x => x.id !== id);
}

// ---- 检查是否有某个 buff ----
export function hasBuff(target, id) {
  return target._buffs ? target._buffs.some(b => b.id === id) : false;
}
