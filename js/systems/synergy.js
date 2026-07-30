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

// v0.50 诅咒正向构筑检测（基于诅咒数量）
export function checkCurseSynergies() {
  const s = Game.state;
  if (!s.player) return;
  if (!s._activeSynergies) s._activeSynergies = [];
  var curseCount = (s.curses || []).length;

  // 咒缚之王：3+诅咒
  if (curseCount >= 3 && !s._activeSynergies.includes('curse_lord')) {
    var cl = R.get('synergies').find(function(syn){return syn.id==='curse_lord';});
    if (cl) { cl.apply(s.player); s._activeSynergies.push('curse_lord'); bigFloat('💀咒缚之王！每个诅咒+20%伤害', 'float-gold', 800); }
  }
  if (curseCount < 3 && s._activeSynergies.includes('curse_lord')) {
    var cl2 = R.get('synergies').find(function(syn){return syn.id==='curse_lord';});
    if (cl2 && cl2.onRemove) cl2.onRemove(s.player);
    s._activeSynergies = s._activeSynergies.filter(function(id){return id!=='curse_lord';});
  }
  // 行走的天灾：5+诅咒
  if (curseCount >= 5 && !s._activeSynergies.includes('curse_plague')) {
    var cp = R.get('synergies').find(function(syn){return syn.id==='curse_plague';});
    if (cp) { cp.apply(s.player); s._activeSynergies.push('curse_plague'); bigFloat('☠️行走的天灾！敌人每回合-3%HP', 'float-gold', 800); }
  }
  if (curseCount < 5 && s._activeSynergies.includes('curse_plague')) {
    var cp2 = R.get('synergies').find(function(syn){return syn.id==='curse_plague';});
    if (cp2 && cp2.onRemove) cp2.onRemove(s.player);
    s._activeSynergies = s._activeSynergies.filter(function(id){return id!=='curse_plague';});
  }
}
