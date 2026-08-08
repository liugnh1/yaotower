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
          { name: "烈火·涅槃", desc: "伤害×2.0+燃烧2回合+回复20%生命 ⚡2", mul: 2.0, effect: "burn", cd: 2, heal: 0.20, energyCost: 2 }
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
          { name: "雷霆·锻体", desc: "伤害×3.0+眩晕+攻击永久+3 ⚡2", mul: 3.0, effect: "stun", cd: 3, permAtk: 3, energyCost: 2 }
        ]
      }
    ]
  },
  mage: {
    id: "mage", name: "法修", icon: "🔮",
    hp: 85, maxHp: 85, mp: 0, maxMp: 0,
    atk: 16, def: 2, critRate: 0.10, critMul: 1.5,
    skillMul: 2.2, mpCost: 0, pen: 0.5,
    desc: "高伤法术·穿透50%·CD较长",
    skills: [
      { id: "fireball",   name: "炎爆术",   icon: "🔥", desc: "伤害×3.0+燃烧3回合(AOE) ⚡2", mul: 3.0, effect: "burn", cooldown: 3, aoe: true, energyCost: 2,
        upgrades: [
          { name: "炎爆·陨石", desc: "伤害×4.0+燃烧4回合 ⚡2", mul: 4.0, effect: "burn", cd: 4, energyCost: 2 },
          { name: "炎爆·火雨", desc: "伤害×3.0+燃烧3回合+穿透+20% ⚡2", mul: 3.0, effect: "burn", cd: 3, pen: 0.2, energyCost: 2 },
          { name: "炎爆·阳炎", desc: "伤害×3.5+燃烧3回合+回复10灵力 ⚡2", mul: 3.5, effect: "burn", cd: 3, energyCost: 2 }
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
          { name: "奥术·镜像", desc: "伤害×2.5+穿透+25%+本回合无敌 ⚡1", mul: 2.5, effect: "pen", cd: 3, extraPen: 0.25, immune: true, energyCost: 1 },
          { name: "奥术·共鸣", desc: "伤害×3.0+穿透+25%+其他技能CD-1 ⚡1", mul: 3.0, effect: "pen", cd: 2, extraPen: 0.25, reduceCD: 1, energyCost: 1 }
        ]
      }
    ]
  },
  shadow: {
    id: "shadow", name: "影卫", icon: "🗡️",
    hp: 75, maxHp: 75, mp: 0, maxMp: 0,
    atk: 19, def: 1, critRate: 0.24, critMul: 2.0,
    skillMul: 1.8, mpCost: 0, pen: 0.3,
    dodge: 0.10, lifesteal: 0,
    desc: "高速刺客·暴击24%·CD极短",
    skills: [
      { id: "assassinate", name: "暗杀",   icon: "💀", desc: "伤害×3.5+扣12%当前生命 ⚡2", mul: 3.5, effect: null, cooldown: 2, selfDmg: 0.12, energyCost: 2,
        upgrades: [
          { name: "暗杀·绝命", desc: "伤害×6.0+扣10%生命 ⚡3", mul: 6.0, effect: null, cd: 3, selfDmg: 0.10, energyCost: 3 },
          { name: "暗杀·血宴", desc: "伤害×3.5+扣10%生命+吸血40% ⚡2", mul: 3.5, effect: null, cd: 2, selfDmg: 0.1, lifeSteal: 0.4, energyCost: 2 },
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
          { name: "箭雨·穿心", desc: "伤害×2.0+燃烧2回合+暴击率+15% ⚡2", mul: 2.0, effect: "burn", cd: 2, critUp: 0.15, energyCost: 2 }
        ]
      },
      { id: "snipe",       name: "狙击",     icon: "🔭", desc: "伤害×3.5+穿透50% ⚡3", mul: 3.5, effect: null, cooldown: 3, extraPen: 0.5, energyCost: 3,
        upgrades: [
          { name: "狙击·死神", desc: "伤害×5.0+穿透50% ⚡3", mul: 5.0, effect: null, cd: 4, extraPen: 0.5, energyCost: 3 },
          { name: "狙击·弱点", desc: "伤害×4.0+穿透50%+下回合必暴 ⚡3", mul: 4.0, effect: null, cd: 3, extraPen: 0.5, nextCrit: true, energyCost: 3 },
          { name: "狙击·速射", desc: "伤害×3.0+穿透40%+CD-1 ⚡2", mul: 3.0, effect: null, cd: 2, extraPen: 0.4, energyCost: 2 }
        ]
      }
    ]
  },
  monk: {
    id: "monk", name: "武僧", icon: "🧘",
    hp: 110, maxHp: 110, mp: 0, maxMp: 0,
    atk: 17, def: 4, critRate: 0.15, critMul: 1.8,
    skillMul: 2.0, mpCost: 0, pen: 0.1,
    dodge: 0.08, lifesteal: 0,
    desc: "攻守兼备·生命回复·韧性极强",
    skills: [
      { id: "palm_strike", name: "金刚掌",   icon: "🖐️", desc: "伤害×2.5+回复25%生命 ⚡2", mul: 2.5, effect: null, cooldown: 3, heal: 0.25, energyCost: 2,
        upgrades: [
          { name: "金刚·大悲", desc: "伤害×3.5+回复30%生命 ⚡2", mul: 3.5, effect: null, cd: 3, heal: 0.30, energyCost: 2 },
          { name: "金刚·伏魔", desc: "伤害×3.0+回复20%+概率眩晕 ⚡2", mul: 3.0, effect: "stun", cd: 3, heal: 0.20, energyCost: 2 },
          { name: "金刚·不坏", desc: "伤害×2.5+回复20%+防御+3永久 ⚡2", mul: 2.5, effect: null, cd: 3, heal: 0.20, permDef: 3, energyCost: 2 }
        ]
      },
      { id: "iron_body",   name: "金钟罩",   icon: "🔔", desc: "伤害×1.5+下回合必暴 ⚡1", mul: 1.5, effect: "smoke", cooldown: 2, energyCost: 1,
        upgrades: [
          { name: "金钟·铁壁", desc: "伤害×2.0+下回合必暴+防御+5 ⚡1", mul: 2.0, effect: "smoke", cd: 2, selfDef: 5, energyCost: 1 },
          { name: "金钟·反震", desc: "伤害×1.8+下回合必暴+反伤30%一回合 ⚡1", mul: 1.8, effect: "smoke", cd: 2, thorns: 0.3, energyCost: 1 },
          { name: "金钟·愈合", desc: "伤害×1.8+下回合必暴+回复25%生命 ⚡1", mul: 1.8, effect: "smoke", cd: 2, heal: 0.25, energyCost: 1 }
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

// ===== v0.50 职业精通技能（Lv3解锁第4技能，Lv10解锁第5技能/大招）=====
R.registerAll('classMasterySkills', {
  warrior: [
    { id: "war_whirlwind", name: "旋风斩", icon: "🌪️", desc: "AOE全体80%×3 ⚡2", mul: 0.8, aoe: true, multiHit: 3, cooldown: 4, energyCost: 2, masteryLv: 3 },
    { id: "war_godforce",  name: "战神降临", icon: "⚡", desc: "本回合ATK×3+免疫 ⚡3", mul: 3.0, cooldown: 8, energyCost: 3, selfImmune: true, masteryLv: 10 }
  ],
  mage: [
    { id: "mage_icenova",  name: "冰霜新星·极", icon: "❄️", desc: "AOE+全体迟缓2回合 ⚡2", mul: 2.0, effect: "slow", aoe: true, cooldown: 5, energyCost: 2, masteryLv: 3 },
    { id: "mage_meteor",   name: "陨石风暴", icon: "☄️", desc: "AOE 250%+燃烧3层 ⚡3", mul: 2.5, effect: "burn", aoe: true, cooldown: 7, energyCost: 3, masteryLv: 10 }
  ],
  shadow: [
    { id: "shd_assault",   name: "暗杀·极", icon: "🗡️", desc: "单体300%，击杀返还1⚡ ⚡2", mul: 3.0, cooldown: 4, energyCost: 2, killRefund: 1, masteryLv: 3 },
    { id: "shd_clone",     name: "影分身", icon: "👥", desc: "本回合行动次数+2 ⚡3", mul: 1.0, cooldown: 8, energyCost: 3, extraActions: 2, masteryLv: 10 }
  ],
  archer: [
    { id: "arc_rain",      name: "箭雨·暴风", icon: "🏹", desc: "AOE 120%+暴击率+30% ⚡2", mul: 1.2, aoe: true, cooldown: 4, energyCost: 2, critUp: 0.30, masteryLv: 3 },
    { id: "arc_snipe",     name: "狙击·穿心", icon: "🎯", desc: "单体500%+必暴+无视防 ⚡3", mul: 5.0, cooldown: 7, energyCost: 3, forceCrit: true, ignoreDef: true, masteryLv: 10 }
  ],
  monk: [
    { id: "monk_palm",     name: "金刚掌·奥义", icon: "✋", desc: "单体150%+回复等量HP ⚡2", mul: 1.5, cooldown: 3, energyCost: 2, lifeSteal: 1.0, masteryLv: 3 },
    { id: "monk_nirvana",  name: "涅槃", icon: "🕉️", desc: "满血复活+全属性+30%(3回合) ⚡3", mul: 1.0, cooldown: 8, energyCost: 3, rebirth: true, allBuff: 0.3, masteryLv: 10 }
  ]
});

// ===== v0.50 职业专属遗物（Lv5解锁，开局自动获得）=====
R.registerAll('classMasteryRelics', {
  warrior: { id: "mastery_warrior", name: "狂战徽章", icon: "🛡️", rarity: "epic", desc: "击杀后ATK+3（最多叠加10层）", _masteryRelic: true },
  mage:    { id: "mastery_mage",    name: "元素结晶", icon: "💎", rarity: "epic", desc: "每使用技能，下次普攻+20%伤害", _masteryRelic: true },
  shadow:  { id: "mastery_shadow",  name: "暗杀者匕首", icon: "🗡️", rarity: "epic", desc: "对满血敌人伤害+30%", _masteryRelic: true },
  archer:  { id: "mastery_archer",  name: "鹰眼透镜", icon: "🔭", rarity: "epic", desc: "暴击时额外造成20%ATK伤害", _masteryRelic: true },
  monk:    { id: "mastery_monk",    name: "金刚念珠", icon: "📿", rarity: "epic", desc: "每回合回复5%最大生命", _masteryRelic: true }
});

// ===== v0.50 转职系统（精通Lv10 + 50魂晶 + 30灵石，二选一不可逆）=====
R.registerAll('classAdvancements', {
  warrior: [
    { id: "war_berserker", name: "狂战士", icon: "🩸", desc: "牺牲防御换取极致输出",
      statChange: { atk: 10, def: -3 }, passive: "击杀后额外+1⚡" },
    { id: "war_paladin",   name: "圣骑士", icon: "🛡️", desc: "坚不可摧的防御者",
      statChange: { def: 8, maxHp: 30 }, passive: "每回合回复3%HP" }
  ],
  mage: [
    { id: "mage_archmage",    name: "大魔导", icon: "🔮", desc: "法术之力达到极致",
      statChange: { skillMul: 0.5, critRate: 0.15 }, passive: "技能⚡消耗-1" },
    { id: "mage_elementalist",name: "元素使", icon: "🌋", desc: "掌握多重元素之力",
      statChange: {}, passive: "可同时持有2个元素核心遗物" }
  ],
  shadow: [
    { id: "shd_assassin", name: "刺客", icon: "💀", desc: "一击必杀的死神",
      statChange: { critMul: 1.0 }, passive: "对Boss伤害+30%" },
    { id: "shd_ninja",    name: "忍者", icon: "🍃", desc: "来去无踪的幻影",
      statChange: { dodge: 0.10 }, passive: "闪避后下次攻击3倍" }
  ],
  archer: [
    { id: "arc_sniper", name: "狙击手", icon: "🎯", desc: "千里之外取敌首级",
      statChange: { pen: 0.20 }, passive: "单体伤害+40%" },
    { id: "arc_ranger", name: "游侠", icon: "🌲", desc: "箭雨覆盖整个战场",
      statChange: {}, passive: "AOE伤害+25%，每回合随机标记1敌人(+30%承伤)" }
  ],
  monk: [
    { id: "monk_enlightened", name: "悟道者", icon: "🌟", desc: "治愈之力超越极限",
      statChange: {}, passive: "治疗+50%，溢出治疗转护盾" },
    { id: "monk_avenger",     name: "复仇者", icon: "🔥", desc: "以伤痛换取力量",
      statChange: { atk: 12 }, passive: "每受击+ATK 3(本回合)" }
  ]
});

// ===== v0.50 觉醒被动（转职完成 + 80魂晶 + 50灵石 + 3神话材料）=====
R.registerAll('awakeningPassives', {
  war_berserker:    { name: "血怒", desc: "血量每降10%，伤害+8%", icon: "🩸" },
  war_paladin:      { name: "圣盾光环", desc: "全场敌人ATK-15%", icon: "🛡️" },
  mage_archmage:    { name: "奥术回响", desc: "技能击杀重置该技能CD（每回合1次）", icon: "🔄" },
  mage_elementalist:{ name: "元素爆发", desc: "切换元素时免费释放一次该元素技能", icon: "💥" },
  shd_assassin:     { name: "孤立无援", desc: "对孤立敌人伤害×2", icon: "💀" },
  shd_ninja:        { name: "影之舞", desc: "每闪避3次，获得1回合无敌", icon: "🍃" },
  arc_sniper:       { name: "穿透射击", desc: "暴击时对后排造成50%溅射", icon: "🎯" },
  arc_ranger:       { name: "标记连锁", desc: "标记敌人死亡时自动标记新敌人", icon: "🎪" },
  monk_enlightened: { name: "永恒之泉", desc: "过量治疗转化为永久HP（每局上限+50）", icon: "💚" },
  monk_avenger:     { name: "怒火不熄", desc: "击杀后保留50%本回合累积的ATK加成", icon: "🔥" }
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
