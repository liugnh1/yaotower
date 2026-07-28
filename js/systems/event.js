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
  if (roll < 0.5) {
    const eq = genEquip();
    window._addEquip(eq);
    Events.emit(E.EQUIP_GAINED, { equip: eq });
    onResult('equip', eq);
  } else if (roll < 0.8) {
    s.gold += 30;
    Events.emit(E.GOLD_CHANGED, { gold: s.gold, delta: 30 });
    onResult('gold', 30);
  } else {
    const rel = genRelic();
    acquireRelic(rel);
    onResult('relic', rel);
  }
}

// ---- 随机事件类型 ----
export function randomEventType(s) {
  const types = ["shrine", "chest", "altar"];
  return s.rng.pick(types);
}
