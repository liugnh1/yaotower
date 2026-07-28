// ===================== 遗物联动/羁绊系统 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';

// 检查玩家当前遗物是否激活了某个联动
export function checkSynergies() {
  const s = Game.state;
  if (!s.player || !s.relics.length) return [];
  if (!s._activeSynergies) s._activeSynergies = [];

  const relicIds = s.relics.map(r => r.id);
  const allSynergies = R.get('synergies') || [];
  const activated = [];

  for (const syn of allSynergies) {
    // 已激活的跳过
    if (s._activeSynergies.includes(syn.id)) continue;
    // 检查是否拥有所有需要的遗物
    if (syn.relics.every(rid => relicIds.includes(rid))) {
      syn.apply(s.player);
      s._activeSynergies.push(syn.id);
      activated.push(syn);
    }
  }
  return activated;
}

// 重新检查：遗物被替换后，清除不再满足条件的联动
export function recheckSynergies() {
  const s = Game.state;
  if (!s._activeSynergies || !s._activeSynergies.length) return;

  const relicIds = s.relics.map(r => r.id);
  const allSynergies = R.get('synergies') || [];
  const toRemove = [];

  for (const synId of s._activeSynergies) {
    const syn = allSynergies.find(s => s.id === synId);
    if (!syn) { toRemove.push(synId); continue; }
    // 遗物不齐 → 移除联动
    if (!syn.relics.every(rid => relicIds.includes(rid))) {
      if (syn.onRemove && s.player) syn.onRemove(s.player);
      toRemove.push(synId);
    }
  }

  s._activeSynergies = s._activeSynergies.filter(id => !toRemove.includes(id));
  if (toRemove.length) { console.log("[妖塔] 联动已移除:", toRemove); }
}

// 获取当前已激活的联动（用于UI展示）
export function getActiveSynergies() {
  const s = Game.state;
  if (!s._activeSynergies || !s._activeSynergies.length) return [];
  return R.get('synergies').filter(syn => s._activeSynergies.includes(syn.id));
}
