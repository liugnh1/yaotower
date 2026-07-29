// 区域/关卡配置 + 简单模式路线
import { R } from '../core/registry.js';

R.registerAll('zones', {
  plains:  { id: "plains",  name: "迷雾平原", icon: "🌾", bg: "#0a0a14", enemyPool: "plains",  scale: 1.0, desc: "边境之外，迷雾笼罩的荒野",
    relicPool: ["vamp_fang","lightning_rod","spike_shell","lucky_charm"],
    equipSet: "疾风", equipBonus: { atk: 3, dodge: 0.05 }, equipBonus4: { atk: 6, dodge: 0.10 },
    equipNames: { weapon:"疾风之刃", armor:"疾风轻甲", helm:"疾风兜鍪", ring:"疾风指环", amulet:"疾风护符" },
    modifier: null },
  forest:  { id: "forest",  name: "幽暗森林", icon: "🌲", bg: "#0a140a", enemyPool: "forest",  scale: 1.15, desc: "巨树遮天，藤蔓缠绕的迷途 · 每3回合中毒",
    relicPool: ["thunder_clap","frost_armor","berserk_mask","blood_shield"],
    equipSet: "藤棘", equipBonus: { lifeSteal: 0.08 }, equipBonus4: { lifeSteal: 0.15, maxHp: 20 },
    equipNames: { weapon:"藤棘刺剑", armor:"藤棘皮甲", helm:"藤棘冠冕", ring:"藤棘缠绕", amulet:"藤棘之息" },
    modifier: { id: "forest_poison", desc: "🌲 瘴气弥漫：每3回合中毒一次" } },
  cave:    { id: "cave",    name: "废弃矿洞", icon: "⛏️", bg: "#140a0a", enemyPool: "cave",    scale: 1.3, desc: "深处传来矿石的低语 · 防御-2但金币+50%",
    relicPool: ["healing_tears","fire_aura","soul_link","berserk_mask"],
    equipSet: "晶岩", equipBonus: { def: 4, maxHp: 15 }, equipBonus4: { def: 8, maxHp: 35 },
    equipNames: { weapon:"晶岩重锤", armor:"晶岩板甲", helm:"晶岩坚盔", ring:"晶岩铭戒", amulet:"晶岩护符" },
    modifier: { id: "cave_gold", desc: "⛏️ 矿脉丰富：防御-2，但金币掉落+50%" } },
  ruins:   { id: "ruins",   name: "远古废墟", icon: "🏛️", bg: "#14100a", enemyPool: "ruins",   scale: 1.25, desc: "失落文明的断壁残垣 · 怪物额外词条但宝箱+50%",
    relicPool: ["shadow_cloak","echo_stone","death_mark","phoenix_feather"],
    equipSet: "咒术", equipBonus: { critRate: 0.08 }, equipBonus4: { critRate: 0.15, critMul: 0.3 },
    equipNames: { weapon:"咒术权杖", armor:"咒术长袍", helm:"咒术冠冕", ring:"咒术之眼", amulet:"咒术符文" },
    modifier: { id: "ruins_ancient", desc: "🏛️ 远古诅咒：怪物多一个词条，但宝箱出现率翻倍" } },
  frozen:  { id: "frozen",  name: "冰封小径", icon: "❄️", bg: "#0a1414", enemyPool: "frozen",  scale: 1.35, desc: "刺骨寒风中冻结的兽道 · 灵力回复减半",
    relicPool: ["frost_armor","blood_shield","phoenix_feather","chaos_blade"],
    equipSet: "霜痕", equipBonus: { def: 3, maxMp: 10 }, equipBonus4: { def: 6, maxMp: 20, dmgReduce: 0.08 },
    equipNames: { weapon:"霜痕利刃", armor:"霜痕铠", helm:"霜痕头冠", ring:"霜痕指环", amulet:"霜痕结晶" },
    modifier: { id: "frozen_mp", desc: "❄️ 极寒刺骨：灵力回复减半，但敌人也受冻迟缓" } },
  voidgate:{ id: "voidgate",name: "虚空裂隙", icon: "🌀", bg: "#0a0a1a", enemyPool: "voidgate",scale: 1.5, desc: "现实在此处撕裂 · 暴击伤害+50%",
    relicPool: ["chaos_blade","double_turn","soul_link","phoenix_feather","doom_clock"],
    equipSet: "虚空", equipBonus: { pen: 0.15, atk: 4 }, equipBonus4: { pen: 0.30, atk: 10 },
    equipNames: { weapon:"虚空裂剑", armor:"虚空法袍", helm:"虚空面具", ring:"虚空之瞳", amulet:"虚空碎片" },
    modifier: { id: "void_crit", desc: "🌀 虚空能量：双方暴击伤害+50%" } },
  tower:   { id: "tower",   name: "魔塔门前", icon: "🛕", bg: "#1a0a0a", enemyPool: "tower",   scale: 1.7, desc: "终焉之塔耸立于前 · 每回合恢复3%生命",
    relicPool: ["infinite_mana","god_hand","vampire_lord","glass_cannon","phoenix_feather","doom_clock"],
    equipSet: "镇魔", equipBonus: { atk: 5, def: 3, maxHp: 15 }, equipBonus4: { atk: 12, def: 6, maxHp: 40 },
    equipNames: { weapon:"镇魔重剑", armor:"镇魔战甲", helm:"镇魔头盔", ring:"镇魔之戒", amulet:"镇魔令" },
    modifier: { id: "tower_regen", desc: "🛕 魔塔威压：每回合恢复3%生命，但Boss全属性+30%" } }
});

// 地图路由：按当前Zone ID查询下一层可选的Zone列表
// depth 用于Boss选取和难度递进
// 添加新地图只需在 zones 注册 + 在此加一行路由
// 地图路由树：按Zone ID查询下一层可选Zone
//   plains → forest/cave/ruins → voidgate/frozen → tower（终局）
// 加新地图：在zones注册 + 在下面加一行路由即可
R.registerAll('simpleRoute', {
  plains:   { depth: 0, choices: ["forest", "cave", "ruins"] },
  forest:   { depth: 1, choices: ["voidgate", "frozen"] },
  cave:     { depth: 1, choices: ["voidgate", "ruins", "frozen"] },
  ruins:    { depth: 1, choices: ["frozen", "voidgate"] },
  frozen:   { depth: 2, choices: ["tower"] },
  voidgate: { depth: 2, choices: ["tower"] },
  tower:    { depth: 3, choices: [] }
});
