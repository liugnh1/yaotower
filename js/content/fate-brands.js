// ===================== 命运烙印系统 v0.50 =====================
// 天赋树是通用加成，命运烙印是流派专属局外被动
// 集齐对应构筑通关 → 解锁烙印 → 消耗灵蕴升级 → 装配（最多2个）
import { R } from '../core/registry.js';

R.registerAll('fateBrands', [
  { id: "brand_burn", name: "灼烧烙印", icon: "🔥", category: "element",
    desc: "燃烧流专属",
    unlockDesc: "持有 core_flame + 火链3阶通关",
    levels: [
      { cost: 5, effect: "燃烧伤害 +8%" },
      { cost: 10, effect: "燃烧层数上限 +1" },
      { cost: 20, effect: "燃烧击杀回1⚡" }
    ]
  },
  { id: "brand_ice", name: "冰霜烙印", icon: "❄️", category: "element",
    desc: "冰冻流专属",
    unlockDesc: "持有 core_ice + 冰链3阶通关",
    levels: [
      { cost: 5, effect: "迟缓概率 +15%" },
      { cost: 10, effect: "迟缓敌人DEF额外-3" },
      { cost: 20, effect: "冻结击杀重置冰系技能CD" }
    ]
  },
  { id: "brand_shadow", name: "暗影烙印", icon: "🌑", category: "element",
    desc: "闪避流专属",
    unlockDesc: "持有 core_shadow + 暗链3阶通关",
    levels: [
      { cost: 5, effect: "闪避率 +5%" },
      { cost: 10, effect: "闪避后下次攻击ATK+30%" },
      { cost: 20, effect: "闪避击杀重置闪避" }
    ]
  },
  { id: "brand_thunder", name: "雷霆烙印", icon: "⚡", category: "element",
    desc: "暴击流专属",
    unlockDesc: "持有 core_thunder + 雷链3阶通关",
    levels: [
      { cost: 5, effect: "暴击率 +5%" },
      { cost: 10, effect: "暴击时闪电链弹射+2" },
      { cost: 20, effect: "暴击击杀返还1⚡" }
    ]
  },
  { id: "brand_light", name: "圣光烙印", icon: "🌟", category: "element",
    desc: "治疗流专属",
    unlockDesc: "持有 core_light + 光链3阶通关",
    levels: [
      { cost: 5, effect: "治疗 +20%" },
      { cost: 10, effect: "治疗时对随机敌人造成30%ATK伤害" },
      { cost: 20, effect: "过量治疗转为永久HP（每局+30）" }
    ]
  },
  { id: "brand_curse", name: "诅咒烙印", icon: "💀", category: "special",
    desc: "诅咒流专属",
    unlockDesc: "同时持有3+诅咒通关",
    levels: [
      { cost: 5, effect: "诅咒负面效果 -20%" },
      { cost: 10, effect: "诅咒数量上限 +2" },
      { cost: 20, effect: "每持有1个诅咒，ATK+8" }
    ]
  },
  { id: "brand_vampire", name: "吸血烙印", icon: "🩸", category: "special",
    desc: "吸血盾流专属",
    unlockDesc: "持有 血族觉醒 协同通关",
    levels: [
      { cost: 5, effect: "吸血 +10%" },
      { cost: 10, effect: "吸血溢出50%转护盾" },
      { cost: 20, effect: "护盾存在时ATK+20%" }
    ]
  },
  { id: "brand_curse_lord", name: "咒缚烙印", icon: "☠️", category: "special",
    desc: "诅咒大师专属",
    unlockDesc: "持有 行走的天灾 协同通关（5诅咒）",
    levels: [
      { cost: 5, effect: "诅咒正面效果 +20%" },
      { cost: 10, effect: "敌人每回合额外-2%HP" },
      { cost: 20, effect: "开局自选1个诅咒（可构筑）" }
    ]
  }
]);
