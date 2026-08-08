// ===================== 商店系统 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';
import { genEquip, genRelic } from './loot.js';
import { checkSynergies, recheckSynergies } from './synergy.js';
import { addEquip } from './equipment.js';
import { log } from '../ui/effects.js';

function checkAchievement2(s, id) {
  if (Game.meta && Game.meta.achievements && !Game.meta.achievements.includes(id)) {
    Game.meta.achievements.push(id); Game.saveMeta();
    Events.emit(E.BATTLE_START, { type: 'achievement', id });
  }
}

// ---- 获取可购商品列表 ----
export function getShopItems() {
  const s = Game.state;
  const items = [];
  items.push({ name: "生命药水", cost: 30, icon: "🧪", type: 'potion',
    fn: () => { var pct = s.player._masteryPotionBonus ? 0.35 : 0.25; var amt = Math.floor(s.player.maxHp * pct); s.player.hp = Math.min(s.player.maxHp, s.player.hp + amt); Events.emit(E.PLAYER_HEALED, { amount: amt, hp: s.player.hp, maxHp: s.player.maxHp }); } });
  items.push({ name: "能量药剂", cost: 15, icon: "⚡", type: 'potion',
    fn: () => { s.player.energy = Math.min((s.player.maxEnergy||3)+2, (s.player.energy||0)+3); } });
  items.push({ name: "强力药水", cost: 35, icon: "🧴", type: 'potion',
    fn: () => { s.player.hp = s.player.maxHp; Events.emit(E.PLAYER_HEALED, { amount: s.player.maxHp, hp: s.player.hp, maxHp: s.player.maxHp }); } });
  const eq = genEquip(); eq.cost = 25 + Math.floor(eq.val * 3);
  items.push({ name: eq.fullName || eq.name, cost: eq.cost, icon: eq.icon, type: 'equip', data: eq,
    fn: () => { addEquip(eq); Events.emit(E.EQUIP_GAINED, { equip: eq }); } });
  var relicChance = (s.blessingType === '🔮') ? 0.8 : 0.5;
  if (s.rng.chance(relicChance)) {
    const rel = genRelic();
    items.push({ name: rel.name, cost: 80, icon: rel.icon, type: 'relic', data: rel,
      fn: () => { acquireRelic(rel); } });
  }
  // v0.50 P2: 高层商店概率出现传说遗物（500G+）
  if (s.totalFloor >= 30 && s.rng.chance(0.25)) {
    var legendaries = (R.get('relics') || []).filter(function(r) { return r.rarity === 'legendary' && r.category !== 'core'; });
    if (legendaries.length > 0) {
      var premiumRelic = { ...s.rng.pick(legendaries) };
      var premiumCost = 500 + Math.floor(s.totalFloor * 2);
      items.push({ name: '⭐ ' + premiumRelic.name, cost: premiumCost, icon: premiumRelic.icon, type: 'relic', data: premiumRelic,
        fn: function() { acquireRelic(premiumRelic); } });
    }
  }
  return items;
}

// ---- 购买 ----
export function buyItem(item) {
  const s = Game.state;
  var diffCfg = R.get('difficulties', s.difficulty) || {};
  // v0.51: 天赋树商店折扣
  var talentDiscount = (s.player && s.player._talentShopDiscount) ? s.player._talentShopDiscount : 0;
  let mul = (s.adDiscount ? 0.5 : 1) * (diffCfg.shopMul || 1) * (1 - talentDiscount);
  if (s.player?._greedCurse) mul *= 2; // 贪婪诅咒：商店价格翻倍
  if (s._chaosPrice) mul *= 2; // v0.60 混沌_chaosPrice：商店价格翻倍
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
  // 遗物升星：已拥有同ID遗物→升星而非新增
  var existingIdx = s.relics.findIndex(function(r) { return r.id === rel.id; });
  if (existingIdx >= 0) {
    var existing = s.relics[existingIdx];
    if (!existing.stars) existing.stars = 1;
    existing.stars = Math.min(existing.stars, 3); // 防御损坏数据
    if (existing.stars < 3) {
      existing.stars = Math.min(existing.stars + 1, 3);
      // v0.60: 所有遗物升星统一效果 — 每升1星被动效果+20%（已在 passive 中按 stars 倍率处理）
      // 如果某遗物定义了 onStarUp，仍会调用（向后兼容）
      if (typeof existing.onStarUp === 'function') existing.onStarUp(s.player, existing.stars);
      log('<span class="win">⭐ ' + existing.name + ' 升至' + existing.stars + '星！</span>');
      Events.emit(E.RELIC_GAINED, { relic: existing });
      Game.sync();
      return;
    }
    // 已满3星：转为金币奖励
    s.gold += 30;
    log('<span class="gold">💰 ' + existing.name + '已满星，转为30金币！</span>');
    Game.sync();
    return;
  }
  // v0.51: 天赋树遗物槽+1
  var maxRelics = 6 + (s.player && s.player._talentRelicSlots ? s.player._talentRelicSlots : 0);
  if (s.relics.length >= maxRelics) {
    // v0.85: 满槽 → 弹置换面板，由玩家决定丢弃/取消；不自动添加
    // （修复：旧的"emit后检查长度"永远在玩家交互前执行 → 双重添加bug）
    Events.emit(E.RELICS_FULL, { relic: rel });
    return;
  }
  if (rel.onAcquire && !rel._acquired) { rel.onAcquire(s.player, s); rel._acquired = true; }
  if (rel.passive && !rel.applied) { rel.passive(s.player); rel.applied = true; }
  rel.stars = 1;
  s.relics.push(rel);
  // v0.50 遗物许愿保底：获得研究的遗物时重置计数器
  if (Game.meta.studiedRelic === rel.id) {
    Game.meta.studiedPity = 0;
    Game.saveMeta();
    log('<span class="win">🔮 许愿遗物出现！保底计数器已重置</span>');
  }
  // 遗物发现追踪
  if (!Game.meta.discoveredRelics) Game.meta.discoveredRelics = [];
  if (!Game.meta.discoveredRelics.includes(rel.id)) {
    Game.meta.discoveredRelics.push(rel.id);
    Game.saveMeta();
  }
  Events.emit(E.RELIC_GAINED, { relic: rel });
  // 追踪遗物和羁绊
  var s2 = Game.state;
  if (!s2._runRelics) s2._runRelics = [];
  if (!s2._runRelics.includes(rel.id)) { s2._runRelics.push(rel.id); }
  // relic_10: 累计发现10种（使用跨局discoveredRelics）
  var discovered = Game.meta.discoveredRelics || [];
  if (discovered.length >= 10) checkAchievement2(s2, "relic_10");
  recheckSynergies();
  const activated = checkSynergies();
  if (!s2._runSynergies) s2._runSynergies = [];
  activated.forEach(syn => { if (!s2._runSynergies.includes(syn.id)) s2._runSynergies.push(syn.id); if (s2._runSynergies.length >= 4) checkAchievement2(s2, "full_synergy"); });
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
