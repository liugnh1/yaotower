// 遗物联动/羁绊定义 v0.40
import { R } from '../core/registry.js';

R.registerAll('synergies', [
  { id: "vamp_lord", relics: ["vamp_fang","vampire_lord"], name: "血族觉醒", desc: "吸血效率×3，溢出转为临时护盾", icon: "🩸",
    apply: (p) => { p._vampLordOrigLS = p.lifeSteal||0; p.lifeSteal = Math.min(0.50, (p.lifeSteal||0) * 3); p._synVampLord = true; },
    onRemove: (p) => { p.lifeSteal = p._vampLordOrigLS || 0; delete p._vampLordOrigLS; p._synVampLord = false; } },
  { id: "thunder_god", relics: ["lightning_rod","thunder_clap"], name: "雷神之怒", desc: "闪电链弹射+2次，眩晕概率翻倍", icon: "⚡",
    apply: (p) => { p._synThunderGod = true; },
    onRemove: (p) => { p._synThunderGod = false; } },
  { id: "frost_king", relics: ["frost_armor","blood_shield"], name: "冰霜之王", desc: "受击必定迟缓敌人，减伤+20%", icon: "❄️",
    apply: (p) => { p.dmgReduce = (p.dmgReduce||0)+0.20; p._synFrostKing = true; },
    onRemove: (p) => { p.dmgReduce = Math.max(0,(p.dmgReduce||0)-0.20); p._synFrostKing = false; } },
  { id: "reaper", relics: ["death_mark","soul_link"], name: "死神契约", desc: "对低血敌人伤害+60%，击杀回复30%生命", icon: "💀",
    apply: (p) => { p._synReaper = true; },
    onRemove: (p) => { p._synReaper = false; } },
  { id: "time_master", relics: ["double_turn","infinite_mana"], name: "时间主宰", desc: "击杀额外行动+技能CD再-1", icon: "⏳",
    apply: (p) => { p._synTimeMaster = true; },
    onRemove: (p) => { p._synTimeMaster = false; } },
  { id: "glass_god", relics: ["glass_cannon","berserk_mask"], name: "玻璃战神", desc: "满血时伤害+50%，低血时伤害+120%", icon: "💔",
    apply: (p) => { p._synGlassGod = true; },
    onRemove: (p) => { p._synGlassGod = false; } },

  // ===== 遗物触发链（3条连锁） =====
  // 火焰链：烈焰光环→连锁反应→焚天
  { id: "fire_chain_1", relics: ["fire_aura"], name: "火焰共鸣·初燃", desc: "烈焰光环灼烧伤害+50%", icon: "🔥",
    apply: (p) => { p._fireChain = 1; },
    onRemove: (p) => { p._fireChain = 0; } },
  { id: "fire_chain_2", relics: ["fire_aura","thunder_clap"], name: "火焰共鸣·连锁", desc: "灼烧敌人死亡时爆炸(50%ATK伤害)", icon: "💥",
    apply: (p) => { p._fireChain = 2; p.atk += 5; },
    onRemove: (p) => { p._fireChain = 1; p.atk -= 5; } },
  { id: "fire_chain_3", relics: ["fire_aura","thunder_clap","phoenix_feather"], name: "火焰共鸣·焚天", desc: "爆炸传染灼烧给全场·免疫燃烧伤害", icon: "🌟",
    apply: (p) => { p._fireChain = 3; p.atk += 12; },
    onRemove: (p) => { p._fireChain = 2; p.atk -= 12; } },

  // 冰霜链：冰霜护甲→极寒蔓延→绝对零度
  { id: "ice_chain_1", relics: ["frost_armor"], name: "冰霜共鸣·初寒", desc: "冰霜护甲冻结概率+50%", icon: "❄️",
    apply: (p) => { p._iceChain = 1; },
    onRemove: (p) => { p._iceChain = 0; } },
  { id: "ice_chain_2", relics: ["frost_armor","blood_shield"], name: "冰霜共鸣·蔓延", desc: "冻结敌人时相邻敌人也被冻结", icon: "🧊",
    apply: (p) => { p._iceChain = 2; p.def += 4; },
    onRemove: (p) => { p._iceChain = 1; p.def -= 4; } },
  { id: "ice_chain_3", relics: ["frost_armor","blood_shield","phoenix_feather"], name: "冰霜共鸣·零度", desc: "冻结的敌人受到伤害翻倍", icon: "🌟",
    apply: (p) => { p._iceChain = 3; p.skillMul += 0.5; },
    onRemove: (p) => { p._iceChain = 2; p.skillMul -= 0.5; } },

  // 暗影链：暗影斗篷→暗影反击→暗杀者
  { id: "shadow_chain_1", relics: ["shadow_cloak"], name: "暗影共鸣·潜行", desc: "暗影斗篷闪避率+10%", icon: "🌑",
    apply: (p) => { p._shadowChain = 1; p.dodge = (p.dodge||0)+0.1; },
    onRemove: (p) => { p._shadowChain = 0; p.dodge = Math.max(0,(p.dodge||0)-0.1); } },
  { id: "shadow_chain_2", relics: ["shadow_cloak","spike_shell"], name: "暗影共鸣·反击", desc: "闪避后自动反击150%伤害", icon: "🗡️",
    apply: (p) => { p._shadowChain = 2; p.thorn = (p.thorn||0)+0.3; },
    onRemove: (p) => { p._shadowChain = 1; p.thorn = Math.max(0,(p.thorn||0)-0.3); } },
  { id: "shadow_chain_3", relics: ["shadow_cloak","spike_shell","death_mark"], name: "暗影共鸣·暗杀", desc: "反击击杀重置闪避·可无限连闪", icon: "🌟",
    apply: (p) => { p._shadowChain = 3; p.critRate += 0.15; },
    onRemove: (p) => { p._shadowChain = 2; p.critRate -= 0.15; } },

  // ===== v0.50 雷霆共鸣 =====
  { id: "thunder_chain_1", relics: ["lightning_rod"], name: "雷霆共鸣·初雷", desc: "闪电链弹射+1", icon: "⚡",
    apply: (p) => { p._thunderChain = 1; },
    onRemove: (p) => { p._thunderChain = 0; } },
  { id: "thunder_chain_2", relics: ["lightning_rod","thunder_clap"], name: "雷霆共鸣·连锁", desc: "暴击时额外释放闪电链", icon: "🌩️",
    apply: (p) => { p._thunderChain = 2; p.atk += 4; },
    onRemove: (p) => { p._thunderChain = 1; p.atk -= 4; } },
  { id: "thunder_chain_3", relics: ["lightning_rod","thunder_clap","core_thunder"], name: "雷霆共鸣·雷神", desc: "闪电链可弹射回同一目标，每次+20%伤害", icon: "⚡",
    apply: (p) => { p._thunderChain = 3; p.atk += 8; p.critRate += 0.05; },
    onRemove: (p) => { p._thunderChain = 2; p.atk -= 8; p.critRate -= 0.05; } },

  // ===== v0.50 圣光共鸣 =====
  { id: "light_chain_1", relics: ["healing_tears"], name: "圣光共鸣·初愈", desc: "治疗+25%", icon: "💚",
    apply: (p) => { p._lightChain = 1; },
    onRemove: (p) => { p._lightChain = 0; } },
  { id: "light_chain_2", relics: ["healing_tears","golden_apple"], name: "圣光共鸣·涌泉", desc: "溢出治疗50%转为永久HP（每局上限+30）", icon: "🌟",
    apply: (p) => { p._lightChain = 2; p.maxHp += 15; p.hp += 15; },
    onRemove: (p) => { p._lightChain = 1; p.maxHp -= 15; p.hp = Math.min(p.hp, p.maxHp); } },
  { id: "light_chain_3", relics: ["healing_tears","golden_apple","core_light"], name: "圣光共鸣·救赎", desc: "治疗可净化诅咒+解除debuff", icon: "✨",
    apply: (p) => { p._lightChain = 3; p.regen = (p.regen||0) + 3; },
    onRemove: (p) => { p._lightChain = 2; p.regen = Math.max(0, (p.regen||0) - 3); } },

  // ===== v0.50 诅咒正向构筑 =====
  { id: "curse_lord", relics: [], name: "咒缚之王", desc: "持有3+诅咒时每个诅咒+20%全伤害", icon: "💀",
    apply: (p) => { p._curseLord = true; },
    onRemove: (p) => { p._curseLord = false; } },
  { id: "curse_plague", relics: [], name: "行走的天灾", desc: "持有5诅咒时敌人每回合-3%HP", icon: "☠️",
    apply: (p) => { p._cursePlague = true; },
    onRemove: (p) => { p._cursePlague = false; } },
]);
