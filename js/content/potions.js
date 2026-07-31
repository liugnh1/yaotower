// 药水定义
import { R } from '../core/registry.js';

R.registerAll('potions', [
  { id: "heal",    name: "回血药",   icon: "🧪", desc: "恢复25%最大生命",  fn: (p, s) => { var pct = p._masteryPotionBonus ? 0.35 : 0.25; p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * pct)); } },
  { id: "energy",  name: "能量药剂", icon: "⚡", desc: "恢复3点能量",  fn: (p, s) => { p.energy = Math.min((p.maxEnergy||3)+2, (p.energy||0)+3); } },
  { id: "cleanse", name: "净化药水", icon: "🧴", desc: "清除1层诅咒", fn: (p, G) => { /* 由 usePotion 统一处理 */ } },
  { id: "power",   name: "力量药剂", icon: "💪", desc: "本层攻击+20%",fn: (p, G) => { G.potionAtk = 0.2; } },
  { id: "iron",    name: "铁壁药剂", icon: "🛡️", desc: "本层防御+50%",fn: (p, G) => { G.potionDef = 0.5; } }
]);
