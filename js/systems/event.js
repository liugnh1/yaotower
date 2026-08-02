// ===================== 事件系统（神龛/宝箱/祭坛）=====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';
import { genEquip, genRelic } from './loot.js';
import { acquireRelic } from './shop.js';

// ---- 宝箱 ----
export function openChest(onResult) {
  const s = Game.state;
  const roll = s.rng.next();
  // v0.60: 天赋树「丰收」— 宝箱额外奖励
  var chestBonus = (s.player && s.player._talentChestBonus) ? s.player._talentChestBonus : 0;
  if (roll < 0.5) {
    const eq = genEquip();
    if (typeof window._addEquip === 'function') { window._addEquip(eq); }
    else { s.equip.push(eq); }
    Events.emit(E.EQUIP_GAINED, { equip: eq });
    onResult('equip', eq);
  } else if (roll < 0.8) {
    s.gold += 30 + chestBonus * 15;
    Events.emit(E.GOLD_CHANGED, { gold: s.gold, delta: 30 + chestBonus * 15 });
    onResult('gold', 30 + chestBonus * 15);
  } else {
    const rel = genRelic();
    acquireRelic(rel);
    onResult('relic', rel);
  }
  // v0.60: 天赋树「丰收」— 宝箱额外+1件奖励（额外掉落金币）
  if (chestBonus > 0) {
    s.gold += chestBonus * 20;
    Events.emit(E.GOLD_CHANGED, { gold: s.gold, delta: chestBonus * 20 });
  }
}

// ---- 随机事件类型 ----
export function randomEventType(s) {
  const types = ["shrine", "chest", "altar"];
  return s.rng.pick(types);
}

// v0.60: 天赋树「直觉」— 事件好选项概率加成
// 返回增强后的概率：baseChance × (1 + eventGood bonus)
export function goodEventChance(s, baseChance) {
  var bonus = (s.player && s.player._talentEventGood) ? s.player._talentEventGood : 0;
  // 装饰「占星台」加成
  var decoBonus = 0;
  var decs = (Game.meta && Game.meta.decorations) ? Game.meta.decorations : [];
  decs.forEach(function(d) { if (d.effect === 'eventGood') decoBonus += 0.10; });
  return s.rng.chance(Math.min(0.95, baseChance * (1 + bonus + decoBonus)));
}
