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

// 获取当前已激活的联动（用于UI展示）
export function getActiveSynergies() {
  const s = Game.state;
  if (!s._activeSynergies || !s._activeSynergies.length) return [];
  return R.get('synergies').filter(syn => s._activeSynergies.includes(syn.id));
}
