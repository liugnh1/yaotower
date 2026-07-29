// ===================== 商店系统 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';
import { genEquip, genRelic } from './loot.js';
import { checkSynergies, recheckSynergies } from './synergy.js';

// ---- 获取可购商品列表 ----
export function getShopItems() {
  const s = Game.state;
  const items = [];
  items.push({ name: "生命药水", cost: 20, icon: "🧪", type: 'potion',
    fn: () => { s.player.hp = Math.min(s.player.maxHp, s.player.hp + 50); Events.emit(E.PLAYER_HEALED, { amount: 50, hp: s.player.hp, maxHp: s.player.maxHp }); } });
  items.push({ name: "灵力药水", cost: 15, icon: "🔮", type: 'potion',
    fn: () => { s.player.mp = Math.min(s.player.maxMp, s.player.mp + 30); } });
  items.push({ name: "强力药水", cost: 35, icon: "🧴", type: 'potion',
    fn: () => { s.player.hp = s.player.maxHp; s.player.mp = s.player.maxMp; Events.emit(E.PLAYER_HEALED, { amount: s.player.maxHp, hp: s.player.hp, maxHp: s.player.maxHp }); } });
  const eq = genEquip(); eq.cost = 25 + Math.floor(eq.val * 3);
  items.push({ name: eq.fullName || eq.name, cost: eq.cost, icon: eq.icon, type: 'equip', data: eq,
    fn: () => { window._addEquip(eq); Events.emit(E.EQUIP_GAINED, { equip: eq }); } });
  if (s.rng.chance(0.5)) {
    const rel = genRelic();
    items.push({ name: rel.name, cost: 80, icon: rel.icon, type: 'relic', data: rel,
      fn: () => { acquireRelic(rel); } });
  }
  return items;
}

// ---- 购买 ----
export function buyItem(item) {
  const s = Game.state;
  let mul = s.adDiscount ? 0.5 : 1;
  if (s.player?._greedCurse) mul *= 2; // 贪婪诅咒：商店价格翻倍
  const cost = Math.floor(item.cost * mul);
  if ((s.gold || 0) < cost) return false;
  s.gold -= cost;
  Events.emit(E.GOLD_CHANGED, { gold: s.gold, delta: -cost });
  item.fn();
  return true;
}

// ---- 获取遗物 ----
export function acquireRelic(rel) {
  const s = Game.state;
  if (s.relics.length >= 6) {
    const old = s.relics[0];
    if (old && old.onRemove) old.onRemove(s.player);
    Events.emit(E.RELIC_REMOVED, { relic: old });
    s.relics.shift();
  }
  // 替换旧遗物时，先清理联动再重算
  if (rel.onAcquire && !rel.applied) { rel.onAcquire(s.player, s); rel.applied = true; }
  if (rel.passive && !rel.applied) { rel.passive(s.player); rel.applied = true; }
  s.relics.push(rel);
  Events.emit(E.RELIC_GAINED, { relic: rel });
  recheckSynergies(); // 旧遗物移除后，取消不再满足的联动
  const activated = checkSynergies();
  activated.forEach(syn => Events.emit(E.BATTLE_START, { type: 'synergy', name: syn.name, desc: syn.desc }));
}

// ---- 广告 ----
export function canAd() { return Game.canWatchAd(); }
export function watchAd() { return Game.watchAd(); }
export function applyDiscount() { Game.state.adDiscount = true; }
export function isDiscounted() { return Game.state.adDiscount; }

// ---- 神龛 ----
export function shrineOffer(type) {
  const s = Game.state;
  if (type === 'atk') {
    if (s.gold < 30) return false;
    s.gold -= 30; s.player.atk += 3;
    Events.emit(E.GOLD_CHANGED, { gold: s.gold, delta: -30 });
  } else if (type === 'heal') {
    if (s.gold < 30) return false;
    s.gold -= 30; s.player.hp = s.player.maxHp;
    Events.emit(E.GOLD_CHANGED, { gold: s.gold, delta: -30 });
    Events.emit(E.PLAYER_HEALED, { amount: s.player.maxHp, hp: s.player.hp, maxHp: s.player.maxHp });
  }
  return true;
}
