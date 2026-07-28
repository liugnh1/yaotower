// 职业定义
import { R } from '../core/registry.js';

R.registerAll('classes', {
  warrior: {
    id: "warrior", name: "剑修", icon: "⚔️",
    hp: 120, maxHp: 120, mp: 30, maxMp: 30,
    atk: 18, def: 5, critRate: 0.25, critMul: 1.5,
    skillMul: 1.5, mpCost: 6, pen: 0,
    desc: "高攻高防·每2回合可放技能",
    skills: [
      { id: "fire_slash", name: "烈火剑法", icon: "🔥", desc: "伤害×2.2+燃烧3回合", mul: 2.2, effect: "burn" },
      { id: "ice_slash",  name: "冰霜剑诀", icon: "❄️", desc: "伤害×1.8+迟缓2回合", mul: 1.8, effect: "slow" },
      { id: "thunder",    name: "雷霆一击", icon: "⚡", desc: "伤害×2.8+概率眩晕",   mul: 2.8, effect: "stun", extraCost: 3 }
    ]
  },
  mage: {
    id: "mage", name: "法修", icon: "🔮",
    hp: 85, maxHp: 85, mp: 60, maxMp: 60,
    atk: 14, def: 2, critRate: 0.10, critMul: 1.5,
    skillMul: 2.2, mpCost: 9, pen: 0.5,
    desc: "灵力充沛·技能穿透50%·法术连发",
    skills: [
      { id: "fireball",   name: "炎爆术",   icon: "🔥", desc: "伤害×3.0+燃烧3回合",   mul: 3.0, effect: "burn", extraCost: 3 },
      { id: "frost_nova", name: "冰霜新星", icon: "❄️", desc: "伤害×2.2+迟缓2回合", mul: 2.2, effect: "slow" },
      { id: "arcane",     name: "奥术飞弹", icon: "✨", desc: "伤害×2.5+穿透+25%",  mul: 2.5, effect: "pen", extraPen: 0.25 }
    ]
  },
  shadow: {
    id: "shadow", name: "影卫", icon: "🗡️",
    hp: 75, maxHp: 75, mp: 35, maxMp: 35,
    atk: 22, def: 1, critRate: 0.35, critMul: 2.0,
    skillMul: 1.8, mpCost: 5, pen: 0.3,
    dodge: 0.15, lifesteal: 0,
    desc: "高频技能·暴击35%·击杀回血",
    skills: [
      { id: "assassinate", name: "暗杀",   icon: "💀", desc: "伤害×3.5+扣10%当前生命", mul: 3.5, effect: null, selfDmg: 0.1 },
      { id: "smoke_bomb",  name: "烟幕",   icon: "🌫️", desc: "本回合无敌+下回合必暴", mul: 1.3, effect: "smoke" },
      { id: "poison_blade",name: "毒刃",   icon: "☠️", desc: "伤害×2.0+中毒3回合", mul: 2.0, effect: "poison" }
    ]
  }
});
