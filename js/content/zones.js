// 区域/关卡配置 + 简单模式路线
import { R } from '../core/registry.js';

R.registerAll('zones', {
  plains:  { id: "plains",  name: "迷雾平原", icon: "🌾", bg: "#0a0a14", enemyPool: "plains",  scale: 1.0, desc: "边境之外，迷雾笼罩的荒野",
    relicPool: ["vamp_fang","lightning_rod","spike_shell","lucky_charm","golden_apple","gamblers_dice"],
    equipSet: "疾风", equipBonus: { atk: 3, dodge: 0.05 }, equipBonus4: { atk: 6, dodge: 0.10 },
    equipNames: { weapon:"疾风之刃", armor:"疾风轻甲", helm:"疾风兜鍪", ring:"疾风指环", amulet:"疾风护符" },
    modifier: null },
  forest:  { id: "forest",  name: "幽暗森林", icon: "🌲", bg: "#0a140a", enemyPool: "forest",  scale: 1.15, desc: "巨树遮天，藤蔓缠绕的迷途 · 每3回合中毒",
    relicPool: ["thunder_clap","frost_armor","berserk_mask","blood_shield","chain_lightning","mirror_shield"],
    equipSet: "藤棘", equipBonus: { lifeSteal: 0.08 }, equipBonus4: { lifeSteal: 0.15, maxHp: 20 },
    equipNames: { weapon:"藤棘刺剑", armor:"藤棘皮甲", helm:"藤棘冠冕", ring:"藤棘缠绕", amulet:"藤棘之息" },
    modifier: { id: "forest_poison", desc: "🌲 瘴气弥漫：每3回合中毒一次" } },
  cave:    { id: "cave",    name: "废弃矿洞", icon: "⛏️", bg: "#140a0a", enemyPool: "cave",    scale: 1.3, desc: "深处传来矿石的低语 · 防御-2但金币+50%",
    relicPool: ["healing_tears","fire_aura","soul_link","berserk_mask","toxic_cloud","ninja_tabi"],
    equipSet: "晶岩", equipBonus: { def: 4, maxHp: 15 }, equipBonus4: { def: 8, maxHp: 35 },
    equipNames: { weapon:"晶岩重锤", armor:"晶岩板甲", helm:"晶岩坚盔", ring:"晶岩铭戒", amulet:"晶岩护符" },
    modifier: { id: "cave_gold", desc: "⛏️ 矿脉丰富：防御-2，但金币掉落+50%" } },
  ruins:   { id: "ruins",   name: "远古废墟", icon: "🏛️", bg: "#14100a", enemyPool: "ruins",   scale: 1.25, desc: "失落文明的断壁残垣 · 怪物额外词条但宝箱+50%",
    relicPool: ["shadow_cloak","echo_stone","death_mark","phoenix_feather","blood_ruby","cursed_doll"],
    equipSet: "咒术", equipBonus: { critRate: 0.08 }, equipBonus4: { critRate: 0.15, critMul: 0.3 },
    equipNames: { weapon:"咒术权杖", armor:"咒术长袍", helm:"咒术冠冕", ring:"咒术之眼", amulet:"咒术符文" },
    modifier: { id: "ruins_ancient", desc: "🏛️ 远古诅咒：怪物多一个词条，但宝箱出现率翻倍" } },
  frozen:  { id: "frozen",  name: "冰封小径", icon: "❄️", bg: "#0a1414", enemyPool: "frozen",  scale: 1.35, desc: "刺骨寒风中冻结的兽道 · 灵力回复减半",
    relicPool: ["frost_armor","blood_shield","phoenix_feather","chaos_blade","angel_wings","war_drum"],
    equipSet: "霜痕", equipBonus: { def: 3, maxMp: 10 }, equipBonus4: { def: 6, maxMp: 20, dmgReduce: 0.08 },
    equipNames: { weapon:"霜痕利刃", armor:"霜痕铠", helm:"霜痕头冠", ring:"霜痕指环", amulet:"霜痕结晶" },
    modifier: { id: "frozen_mp", desc: "❄️ 极寒刺骨：灵力回复减半，但敌人也受冻迟缓" } },
  voidgate:{ id: "voidgate",name: "虚空裂隙", icon: "🌀", bg: "#0a0a1a", enemyPool: "voidgate",scale: 1.5, desc: "现实在此处撕裂 · 暴击伤害+50%",
    relicPool: ["chaos_blade","double_turn","soul_link","phoenix_feather","doom_clock","medusa_head","gamblers_dice"],
    equipSet: "虚空", equipBonus: { pen: 0.15, atk: 4 }, equipBonus4: { pen: 0.30, atk: 10 },
    equipNames: { weapon:"虚空裂剑", armor:"虚空法袍", helm:"虚空面具", ring:"虚空之瞳", amulet:"虚空碎片" },
    modifier: { id: "void_crit", desc: "🌀 虚空能量：双方暴击伤害+50%" } },
  tower:   { id: "tower",   name: "魔塔门前", icon: "🛕", bg: "#1a0a0a", enemyPool: "tower",   scale: 1.7, desc: "终焉之塔耸立于前 · 每回合恢复3%生命",
    relicPool: ["infinite_mana","god_hand","vampire_lord","glass_cannon","phoenix_feather","doom_clock","philosopher_stone","angel_wings"],
    equipSet: "镇魔", equipBonus: { atk: 5, def: 3, maxHp: 15 }, equipBonus4: { atk: 12, def: 6, maxHp: 40 },
    equipNames: { weapon:"镇魔重剑", armor:"镇魔战甲", helm:"镇魔头盔", ring:"镇魔之戒", amulet:"镇魔令" },
    modifier: { id: "tower_regen", desc: "🛕 魔塔威压：每回合恢复3%生命，但Boss全属性+30%" } },

  // ===== v0.41 新增Zone =====
  desert:  { id: "desert",  name: "荒芜沙漠", icon: "🏜️", bg: "#1a1408", enemyPool: "desert",  scale: 1.25, desc: "无尽的黄沙之下埋藏着古老的秘密", relicPool: ["shadow_cloak","dice","phoenix_feather","echo_stone"], equipSet: "流沙", equipBonus: { dodge: 0.08, atk: 3 }, equipBonus4: { dodge: 0.15, atk: 8 }, equipNames: { weapon:"流沙之刃", armor:"流沙轻甲", helm:"流沙头巾", ring:"流沙指环", amulet:"流沙护符" }, modifier: { id: "desert_storm", desc: "🏜️ 沙暴：每3回合随机降低命中" } },
  swamp:   { id: "swamp",   name: "幽暗沼泽", icon: "🌿", bg: "#0a1408", enemyPool: "swamp",   scale: 1.30, desc: "腐沼中潜伏着致命的猎手", relicPool: ["healing_tears","spike_shell","vamp_fang","soul_link"], equipSet: "腐沼", equipBonus: { lifeSteal: 0.06, maxHp: 10 }, equipBonus4: { lifeSteal: 0.12, maxHp: 30 }, equipNames: { weapon:"腐沼之触", armor:"腐沼皮甲", helm:"腐沼面具", ring:"腐沼缠绕", amulet:"腐沼精华" }, modifier: { id: "swamp_poison", desc: "🌿 瘴气：每回合双方轻微中毒" } },
  tower_lower: { id: "tower_lower", name: "魔塔下层", icon: "🏰", bg: "#0a0a1a", enemyPool: "tower_lower", scale: 2.0, desc: "魔塔内部·普通模式终局", relicPool: ["infinite_mana","god_hand","vampire_lord","glass_cannon","phoenix_feather","doom_clock","philosopher_stone","angel_wings"], equipSet: "破魔", equipBonus: { atk: 6, pen: 0.1 }, equipBonus4: { atk: 15, pen: 0.25 }, equipNames: { weapon:"破魔之剑", armor:"破魔铠甲", helm:"破魔头盔", ring:"破魔之戒", amulet:"破魔令" }, modifier: { id: "tower_lower_drain", desc: "🏰 魔塔压制：每回合扣2%HP但+20%攻击" } },
  tower_upper: { id: "tower_upper", name: "魔塔上层", icon: "👑", bg: "#1a0a0a", enemyPool: "tower_upper", scale: 2.5, desc: "魔王座前·炼狱模式终局", relicPool: ["infinite_mana","god_hand","vampire_lord","glass_cannon","phoenix_feather","doom_clock","chaos_blade","double_turn"], equipSet: "弑神", equipBonus: { atk: 8, critRate: 0.1 }, equipBonus4: { atk: 20, critRate: 0.2, critMul: 0.5 }, equipNames: { weapon:"弑神之刃", armor:"弑神战甲", helm:"弑神冠冕", ring:"弑神指环", amulet:"弑神之魂" }, modifier: { id: "tower_upper_seal", desc: "👑 魔王威压：每3回合封印1技能但暴击+25%" } }
});

// 地图路由：按当前Zone ID查询下一层可选的Zone列表
// depth 用于Boss选取和难度递进
// 添加新地图只需在 zones 注册 + 在此加一行路由
// 地图路由树：按Zone ID查询下一层可选Zone
//   plains → forest/cave/ruins → voidgate/frozen → tower（终局）
// 加新地图：在zones注册 + 在下面加一行路由即可
R.registerAll('simpleRoute', {
  plains:   { depth: 0, choices: ["forest", "cave", "ruins", "desert", "swamp"] },
  forest:   { depth: 1, choices: ["voidgate", "frozen"] },
  cave:     { depth: 1, choices: ["voidgate", "ruins", "frozen"] },
  ruins:    { depth: 1, choices: ["frozen", "voidgate"] },
  desert:   { depth: 1, choices: ["voidgate", "frozen"] },
  swamp:    { depth: 1, choices: ["frozen", "voidgate"] },
  frozen:   { depth: 2, choices: ["tower"] },
  voidgate: { depth: 2, choices: ["tower"] },
  // 简单模式：塔外止步
  tower:    { depth: 3, choices_simple: [], choices_standard: ["tower_lower"], choices_hell: ["tower_lower"] },
  // 普通模式：塔下层止步
  tower_lower: { depth: 4, choices_simple: [], choices_standard: [], choices_hell: ["tower_upper"] },
  // 炼狱模式：通到塔上层
  tower_upper: { depth: 5, choices_simple: [], choices_standard: [], choices_hell: [] }
});
