// 药水定义
import { R } from '../core/registry.js';

R.registerAll('potions', [
  { id: "heal",    name: "回血药",   icon: "🧪", desc: "恢复50生命",  fn: p => { p.hp = Math.min(p.maxHp, p.hp + 50); } },
  { id: "mp",      name: "回蓝药",   icon: "🔮", desc: "恢复30灵力",  fn: p => { p.mp = Math.min(p.maxMp, p.mp + 30); } },
  { id: "cleanse", name: "净化药水", icon: "🧴", desc: "清除1层诅咒", fn: (p, G) => { /* 由 usePotion 统一处理 */ } },
  { id: "power",   name: "力量药剂", icon: "💪", desc: "本层攻击+20%",fn: (p, G) => { G.potionAtk = 0.2; } },
  { id: "iron",    name: "铁壁药剂", icon: "🛡️", desc: "本层防御+50%",fn: (p, G) => { G.potionDef = 0.5; } }
]);
