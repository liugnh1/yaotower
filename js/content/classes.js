// 职业定义 v0.36 — CD制+技能升级树
import { R } from '../core/registry.js';

// 技能升级：每击败Boss可选择一个技能升级
// Lv1 → Lv2 → Lv3，每级增强mul+效果
R.registerAll('classes', {
  warrior: {
    id: "warrior", name: "剑修", icon: "⚔️",
    hp: 120, maxHp: 120, mp: 0, maxMp: 0,
    atk: 18, def: 5, critRate: 0.25, critMul: 1.5,
    skillMul: 1.5, mpCost: 0, pen: 0,
    desc: "均衡战士·技能CD短·稳定输出",
    skills: [
      { id: "fire_slash", name: "烈火剑法", icon: "🔥", desc: "伤害×2.2+燃烧2回合(AOE) ⚡2", mul: 2.2, effect: "burn", cooldown: 2, aoe: true, energyCost: 2,
        upgrades: [
          { name: "烈火·炎舞", desc: "伤害×2.8+燃烧3回合 ⚡2", mul: 2.8, effect: "burn", cd: 2, energyCost: 2 },
          { name: "烈火·焚天", desc: "伤害×2.5+燃烧3回合+AOE溅射 ⚡2", mul: 2.5, effect: "burn", cd: 3, energyCost: 2 },
          { name: "烈火·涅槃", desc: "伤害×2.0+燃烧2回合+回复15%生命 ⚡2", mul: 2.0, effect: "burn", cd: 2, heal: 0.15, energyCost: 2 }
        ]
      },
      { id: "ice_slash",  name: "冰霜剑诀", icon: "❄️", desc: "伤害×1.8+迟缓2回合 ⚡1", mul: 1.8, effect: "slow", cooldown: 2, energyCost: 1,
        upgrades: [
          { name: "冰霜·永冻", desc: "伤害×2.2+迟缓2回合+概率眩晕 ⚡1", mul: 2.2, effect: "slow", cd: 3, energyCost: 1 },
          { name: "冰霜·暴雪", desc: "伤害×2.5+迟缓2回合+防御-3 ⚡1", mul: 2.5, effect: "slow", cd: 2, defBreak: 3, energyCost: 1 },
          { name: "冰霜·寒甲", desc: "伤害×1.8+迟缓2回合+自身防御+4 ⚡1", mul: 1.8, effect: "slow", cd: 2, selfDef: 4, energyCost: 1 }
        ]
      },
      { id: "thunder",    name: "雷霆一击", icon: "⚡", desc: "伤害×2.8+概率眩晕 ⚡2", mul: 2.8, effect: "stun", cooldown: 3, energyCost: 2,
        upgrades: [
          { name: "雷霆·天罚", desc: "伤害×3.5+必定眩晕 ⚡2", mul: 3.5, effect: "stun", cd: 4, energyCost: 2 },
          { name: "雷霆·连锁", desc: "伤害×2.8+眩晕+额外攻击一次 ⚡2", mul: 2.8, effect: "stun", cd: 3, doubleHit: true, energyCost: 2 },
          { name: "雷霆·锻体", desc: "伤害×3.0+眩晕+攻击永久+2 ⚡2", mul: 3.0, effect: "stun", cd: 3, permAtk: 2, energyCost: 2 }
        ]
      }
    ]
  },
  mage: {
    id: "mage", name: "法修", icon: "🔮",
    hp: 85, maxHp: 85, mp: 0, maxMp: 0,
    atk: 14, def: 2, critRate: 0.10, critMul: 1.5,
    skillMul: 2.2, mpCost: 0, pen: 0.5,
    desc: "高伤法术·穿透50%·CD较长",
    skills: [
      { id: "fireball",   name: "炎爆术",   icon: "🔥", desc: "伤害×3.0+燃烧3回合(AOE) ⚡3", mul: 3.0, effect: "burn", cooldown: 3, aoe: true, energyCost: 3,
        upgrades: [
          { name: "炎爆·陨石", desc: "伤害×4.0+燃烧4回合 ⚡3", mul: 4.0, effect: "burn", cd: 4, energyCost: 3 },
          { name: "炎爆·火雨", desc: "伤害×3.0+燃烧3回合+穿透+20% ⚡3", mul: 3.0, effect: "burn", cd: 3, pen: 0.2, energyCost: 3 },
          { name: "炎爆·阳炎", desc: "伤害×3.5+燃烧3回合+回复10灵力 ⚡3", mul: 3.5, effect: "burn", cd: 3, energyCost: 3 }
        ]
      },
      { id: "frost_nova", name: "冰霜新星", icon: "❄️", desc: "伤害×2.2+迟缓2回合(AOE) ⚡2", mul: 2.2, effect: "slow", cooldown: 2, aoe: true, energyCost: 2,
        upgrades: [
          { name: "冰霜·暴风雪", desc: "伤害×2.8+迟缓3回合 ⚡2", mul: 2.8, effect: "slow", cd: 2, energyCost: 2 },
          { name: "冰霜·极寒",   desc: "伤害×2.5+迟缓2回合+冻结1回合 ⚡2", mul: 2.5, effect: "slow", cd: 3, freeze: true, energyCost: 2 },
          { name: "冰霜·冰甲",   desc: "伤害×2.0+迟缓2回合+减伤20%2回合 ⚡2", mul: 2.0, effect: "slow", cd: 2, dmgRed: 0.2, energyCost: 2 }
        ]
      },
      { id: "arcane",     name: "奥术飞弹", icon: "✨", desc: "伤害×2.5+穿透+25% ⚡1", mul: 2.5, effect: "pen", cooldown: 2, extraPen: 0.25, energyCost: 1,
        upgrades: [
          { name: "奥术·毁灭", desc: "伤害×3.5+穿透+35% ⚡1", mul: 3.5, effect: "pen", cd: 3, extraPen: 0.35, energyCost: 1 },
          { name: "奥术·镜像", desc: "伤害×2.5+穿透+25%+本回合无敌 ⚡1", mul: 2.5, effect: "pen", cd: 2, extraPen: 0.25, immune: true, energyCost: 1 },
          { name: "奥术·共鸣", desc: "伤害×3.0+穿透+25%+其他技能CD-1 ⚡1", mul: 3.0, effect: "pen", cd: 2, extraPen: 0.25, reduceCD: 1, energyCost: 1 }
        ]
      }
    ]
  },
  shadow: {
    id: "shadow", name: "影卫", icon: "🗡️",
    hp: 75, maxHp: 75, mp: 0, maxMp: 0,
    atk: 22, def: 1, critRate: 0.35, critMul: 2.0,
    skillMul: 1.8, mpCost: 0, pen: 0.3,
    dodge: 0.15, lifesteal: 0,
    desc: "高速刺客·暴击35%·CD极短",
    skills: [
      { id: "assassinate", name: "暗杀",   icon: "💀", desc: "伤害×3.5+扣10%当前生命 ⚡2", mul: 3.5, effect: null, cooldown: 2, selfDmg: 0.1, energyCost: 2,
        upgrades: [
          { name: "暗杀·绝命", desc: "伤害×5.0+扣15%生命 ⚡3", mul: 5.0, effect: null, cd: 3, selfDmg: 0.15, energyCost: 3 },
          { name: "暗杀·血宴", desc: "伤害×3.5+扣10%生命+吸血30% ⚡2", mul: 3.5, effect: null, cd: 2, selfDmg: 0.1, lifeSteal: 0.3, energyCost: 2 },
          { name: "暗杀·无形", desc: "伤害×4.0+扣8%生命+本回合无敌 ⚡2", mul: 4.0, effect: null, cd: 2, selfDmg: 0.08, immune: true, energyCost: 2 }
        ]
      },
      { id: "smoke_bomb",  name: "烟幕",   icon: "🌫️", desc: "伤害×1.3+下回合必暴 ⚡1", mul: 1.3, effect: "smoke", cooldown: 2, energyCost: 1,
        upgrades: [
          { name: "烟幕·暗袭", desc: "伤害×1.8+下回合必暴+暴伤+50% ⚡1", mul: 1.8, effect: "smoke", cd: 2, critMulUp: 0.5, energyCost: 1 },
          { name: "烟幕·迷踪", desc: "伤害×1.3+下回合必暴+闪避+15% ⚡1", mul: 1.3, effect: "smoke", cd: 2, dodgeUp: 0.15, energyCost: 1 },
          { name: "烟幕·毒雾", desc: "伤害×1.5+下回合必暴+中毒3回合 ⚡1", mul: 1.5, effect: "smoke", cd: 2, poison: true, energyCost: 1 }
        ]
      },
      { id: "poison_blade",name: "毒刃",   icon: "☠️", desc: "伤害×2.0+中毒3回合(AOE) ⚡2", mul: 2.0, effect: "poison", cooldown: 2, aoe: true, energyCost: 2,
        upgrades: [
          { name: "毒刃·猛毒", desc: "伤害×2.5+中毒5回合 ⚡2", mul: 2.5, effect: "poison", cd: 2, energyCost: 2 },
          { name: "毒刃·蔓延", desc: "伤害×2.0+中毒3回合+减攻3点3回合 ⚡2", mul: 2.0, effect: "poison", cd: 2, debuff: 3, energyCost: 2 },
          { name: "毒刃·噬心", desc: "伤害×2.2+中毒3回合+吸血15% ⚡2", mul: 2.2, effect: "poison", cd: 2, lifeStealUp: 0.15, energyCost: 2 }
        ]
      }
    ]
  },
  archer: {
    id: "archer", name: "弓手", icon: "🏹",
    hp: 90, maxHp: 90, mp: 0, maxMp: 0,
    atk: 20, def: 2, critRate: 0.20, critMul: 2.5,
    skillMul: 1.6, mpCost: 0, pen: 0.3,
    dodge: 0.10, lifesteal: 0,
    desc: "远程狙击·超高暴伤·先手优势",
    skills: [
      { id: "power_shot",  name: "强力射击", icon: "🎯", desc: "伤害×2.5+概率眩晕 ⚡1", mul: 2.5, effect: "stun", cooldown: 2, energyCost: 1,
        upgrades: [
          { name: "强力·爆头", desc: "伤害×3.5+必定眩晕 ⚡2", mul: 3.5, effect: "stun", cd: 3, energyCost: 2 },
          { name: "强力·连射", desc: "伤害×2.5+眩晕+额外一箭 ⚡1", mul: 2.5, effect: "stun", cd: 2, doubleHit: true, energyCost: 1 },
          { name: "强力·破甲", desc: "伤害×3.0+眩晕+穿透+20% ⚡1", mul: 3.0, effect: "stun", cd: 2, pen: 0.2, energyCost: 1 }
        ]
      },
      { id: "rain_arrow",  name: "箭雨",     icon: "🌧️", desc: "伤害×2.0+燃烧2回合(AOE) ⚡2", mul: 2.0, effect: "burn", cooldown: 2, aoe: true, energyCost: 2,
        upgrades: [
          { name: "箭雨·天罗", desc: "伤害×2.5+燃烧3回合 ⚡2", mul: 2.5, effect: "burn", cd: 2, energyCost: 2 },
          { name: "箭雨·火箭", desc: "伤害×2.8+燃烧3回合+穿透15% ⚡2", mul: 2.8, effect: "burn", cd: 3, pen: 0.15, energyCost: 2 },
          { name: "箭雨·穿心", desc: "伤害×2.0+燃烧2回合+暴击率+10% ⚡2", mul: 2.0, effect: "burn", cd: 2, critUp: 0.10, energyCost: 2 }
        ]
      },
      { id: "snipe",       name: "狙击",     icon: "🔭", desc: "伤害×4.0+穿透50% ⚡3", mul: 4.0, effect: null, cooldown: 4, extraPen: 0.5, energyCost: 3,
        upgrades: [
          { name: "狙击·死神", desc: "伤害×6.0+穿透60% ⚡3", mul: 6.0, effect: null, cd: 5, extraPen: 0.6, energyCost: 3 },
          { name: "狙击·弱点", desc: "伤害×4.5+穿透50%+下回合必暴 ⚡3", mul: 4.5, effect: null, cd: 4, extraPen: 0.5, nextCrit: true, energyCost: 3 },
          { name: "狙击·速射", desc: "伤害×3.5+穿透40%+CD-1 ⚡2", mul: 3.5, effect: null, cd: 3, extraPen: 0.4, energyCost: 2 }
        ]
      }
    ]
  },
  monk: {
    id: "monk", name: "武僧", icon: "🧘",
    hp: 110, maxHp: 110, mp: 0, maxMp: 0,
    atk: 15, def: 4, critRate: 0.15, critMul: 1.8,
    skillMul: 2.0, mpCost: 0, pen: 0.1,
    dodge: 0.08, lifesteal: 0,
    desc: "攻守兼备·生命回复·韧性极强",
    skills: [
      { id: "palm_strike", name: "金刚掌",   icon: "🖐️", desc: "伤害×2.5+回复20%生命 ⚡2", mul: 2.5, effect: null, cooldown: 3, energyCost: 2,
        upgrades: [
          { name: "金刚·大悲", desc: "伤害×3.5+回复30%生命 ⚡2", mul: 3.5, effect: null, cd: 3, heal: 0.30, energyCost: 2 },
          { name: "金刚·伏魔", desc: "伤害×3.0+回复20%+概率眩晕 ⚡2", mul: 3.0, effect: "stun", cd: 3, heal: 0.20, energyCost: 2 },
          { name: "金刚·不坏", desc: "伤害×2.5+回复20%+防御+3永久 ⚡2", mul: 2.5, effect: null, cd: 3, heal: 0.20, permDef: 3, energyCost: 2 }
        ]
      },
      { id: "iron_body",   name: "金钟罩",   icon: "🔔", desc: "伤害×1.5+本回合无敌 ⚡1", mul: 1.5, effect: "smoke", cooldown: 2, energyCost: 1,
        upgrades: [
          { name: "金钟·铁壁", desc: "伤害×2.0+本回合无敌+防御+5 ⚡1", mul: 2.0, effect: "smoke", cd: 2, selfDef: 5, energyCost: 1 },
          { name: "金钟·反震", desc: "伤害×1.5+本回合无敌+反伤30%一回合 ⚡1", mul: 1.5, effect: "smoke", cd: 2, thorns: 0.3, energyCost: 1 },
          { name: "金钟·愈合", desc: "伤害×1.8+本回合无敌+回复25%生命 ⚡1", mul: 1.8, effect: "smoke", cd: 2, heal: 0.25, energyCost: 1 }
        ]
      },
      { id: "mantra",      name: "真言咒",   icon: "📿", desc: "伤害×3.0+迟缓2回合 ⚡2", mul: 3.0, effect: "slow", cooldown: 3, energyCost: 2,
        upgrades: [
          { name: "真言·降魔", desc: "伤害×4.0+迟缓3回合 ⚡2", mul: 4.0, effect: "slow", cd: 3, energyCost: 2 },
          { name: "真言·净化", desc: "伤害×3.0+迟缓2回合+清除一个诅咒 ⚡2", mul: 3.0, effect: "slow", cd: 3, cleanse: true, energyCost: 2 },
          { name: "真言·超度", desc: "伤害×3.5+迟缓2回合+对低血+50% ⚡2", mul: 3.5, effect: "slow", cd: 3, execute: 0.50, energyCost: 2 }
        ]
      }
    ]
  }
});

// 技能合成配方（两满级技能 → 终极技）
R.registerAll('skillRecipes', [
  { id: "synth_fire_ice", name: "冰火两重天", icon: "🌊🔥", desc: "伤害×5.0+燃烧3回合+迟缓3回合 ⚡3", mul: 5.0, cooldown: 3, energyCost: 3,
    effects: ["burn","slow"],
    requires: ["fire_slash", "ice_slash"], bonus: { atk: 5 } },
  { id: "synth_shadow_poison", name: "死兆", icon: "💀☠️", desc: "伤害×6.0+中毒5回合+扣15%生命 ⚡3", mul: 6.0, cooldown: 3, energyCost: 3,
    effects: ["poison"], selfDmg: 0.15,
    requires: ["assassinate", "poison_blade"], bonus: { critRate: 0.10 } },
  { id: "synth_arcane_fire", name: "星辰坠落", icon: "🌟", desc: "伤害×5.5+燃烧3回合+穿透40% ⚡3", mul: 5.5, cooldown: 3, energyCost: 3,
    effects: ["burn"], extraPen: 0.4,
    requires: ["fireball", "arcane"], bonus: { pen: 0.15 } },
  { id: "synth_snipe_power", name: "猎神之箭", icon: "🏹💫", desc: "伤害×7.0+必定眩晕+穿透60% ⚡3", mul: 7.0, cooldown: 4, energyCost: 3,
    effects: ["stun"], extraPen: 0.6,
    requires: ["snipe", "power_shot"], bonus: { critMul: 0.5 } },
  { id: "synth_palm_mantra", name: "如来神掌", icon: "🖐️✨", desc: "伤害×5.0+回复30%+迟缓3回合 ⚡3", mul: 5.0, cooldown: 3, energyCost: 3,
    effects: ["slow"], heal: 0.30,
    requires: ["palm_strike", "mantra"], bonus: { maxHp: 30 } },
]);
