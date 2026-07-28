// 职业定义
import { R } from '../core/registry.js';

R.registerAll('classes', {
  warrior: {
    id: "warrior", name: "剑修", icon: "⚔️",
    hp: 120, maxHp: 120, mp: 20, maxMp: 20,
    atk: 18, def: 4, critRate: 0.25, critMul: 1.5,
    skillMul: 1.5, mpCost: 10, pen: 0,
    desc: "高攻高防·暴击25%·重斩1.5倍",
    skills: [
      { id: "fire_slash", name: "烈火剑法", icon: "🔥", desc: "技能伤害×1.8，附加燃烧", mul: 1.8, effect: "burn" },
      { id: "ice_slash",  name: "冰霜剑诀", icon: "❄️", desc: "技能伤害×1.5，附加迟缓", mul: 1.5, effect: "slow" },
      { id: "thunder",    name: "雷霆一击", icon: "⚡", desc: "技能伤害×2.2，消耗+5",   mul: 2.2, effect: "stun", extraCost: 5 }
    ]
  },
  mage: {
    id: "mage", name: "法修", icon: "🔮",
    hp: 90, maxHp: 90, mp: 50, maxMp: 50,
    atk: 14, def: 2, critRate: 0.10, critMul: 1.5,
    skillMul: 2.2, mpCost: 15, pen: 0.5,
    desc: "高灵力·技能穿透·炎爆2.2倍",
    skills: [
      { id: "fireball",   name: "炎爆术",   icon: "🔥", desc: "技能伤害×2.4，消耗+5",   mul: 2.4, effect: "burn", extraCost: 5 },
      { id: "frost_nova", name: "冰霜新星", icon: "❄️", desc: "技能伤害×1.8，附加迟缓", mul: 1.8, effect: "slow" },
      { id: "arcane",     name: "奥术飞弹", icon: "✨", desc: "技能伤害×2.0，穿透+20%",  mul: 2.0, effect: "pen", extraPen: 0.2 }
    ]
  }
});
