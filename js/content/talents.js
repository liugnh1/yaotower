// 天赋定义
import { R } from '../core/registry.js';

R.registerAll('talents', [
  { id: "vamp",  name: "血族之裔", icon: "🧛", desc: "攻击恢复15%伤害的生命", apply: p => { p.lifeSteal = (p.lifeSteal||0) + 0.15; } },
  { id: "crit",  name: "鹰眼",     icon: "🦅", desc: "暴击率+20%，暴伤+50%",  apply: p => { p.critRate += 0.20; p.critMul += 0.5; } },
  { id: "tank",  name: "磐石",     icon: "🗿", desc: "生命+40，防御+4",       apply: p => { p.maxHp += 40; p.hp += 40; p.def += 4; } },
  { id: "mage",  name: "元素亲和", icon: "🔮", desc: "最大能量+1，技能CD-1（最低1）", apply: p => { p.maxEnergy = (p.maxEnergy||3)+1; p.energy = p.maxEnergy; p._talentMage = true; } },
  { id: "greed", name: "贪婪之手", icon: "💰", desc: "金币获取+100%",         apply: p => { p.goldMul = (p.goldMul||1) * 2; } },
  { id: "thorn", name: "荆棘之躯", icon: "🌵", desc: "受击反弹25%伤害",       apply: p => { p.thorn = (p.thorn||0) + 0.25; } },
  { id: "rage",  name: "狂战士",   icon: "🩸", desc: "生命低于30%时攻击+50%", apply: p => { p.rage = true; } },
  { id: "swift", name: "疾风",     icon: "💨", desc: "先手：首回合攻击两次",  apply: p => { p.doubleFirst = true; } }
]);
