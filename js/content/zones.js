// 区域/关卡配置 + 简单模式路线
import { R } from '../core/registry.js';

R.registerAll('zones', {
  plains:  { id: "plains",  name: "迷雾平原", icon: "🌾", bg: "#0a0a14", enemyPool: "plains",  scale: 1.0, desc: "边境之外，迷雾笼罩的荒野",
    relicPool: ["vamp_fang","power_brace","guard_helm","blood_amulet"],
    modifier: null }, // 起点，无环境效果
  forest:  { id: "forest",  name: "幽暗森林", icon: "🌲", bg: "#0a140a", enemyPool: "forest",  scale: 1.15, desc: "巨树遮天，藤蔓缠绕的迷途 · 每3回合中毒",
    relicPool: ["crit_mirror","thorn_armor","dice","berserk_mask"],
    modifier: { id: "forest_poison", desc: "🌲 瘴气弥漫：每3回合中毒一次" } },
  cave:    { id: "cave",    name: "废弃矿洞", icon: "⛏️", bg: "#140a0a", enemyPool: "cave",    scale: 1.3, desc: "深处传来矿石的低语 · 防御-2但金币+50%",
    relicPool: ["guard_helm","iron_will","soul_vial","demon_heart"],
    modifier: { id: "cave_gold", desc: "⛏️ 矿脉丰富：防御-2，但金币掉落+50%" } },
  ruins:   { id: "ruins",   name: "远古废墟", icon: "🏛️", bg: "#14100a", enemyPool: "ruins",   scale: 1.25, desc: "失落文明的断壁残垣 · 怪物额外词条但宝箱+50%",
    relicPool: ["mystic_ring","crit_mirror","soul_vial","berserk_mask"],
    modifier: { id: "ruins_ancient", desc: "🏛️ 远古诅咒：怪物多一个词条，但宝箱出现率翻倍" } },
  frozen:  { id: "frozen",  name: "冰封小径", icon: "❄️", bg: "#0a1414", enemyPool: "frozen",  scale: 1.35, desc: "刺骨寒风中冻结的兽道 · 灵力回复减半",
    relicPool: ["dice","iron_will","infinity_orb","phoenix_feather"],
    modifier: { id: "frozen_mp", desc: "❄️ 极寒刺骨：灵力回复减半，但敌人也受冻迟缓" } },
  voidgate:{ id: "voidgate",name: "虚空裂隙", icon: "🌀", bg: "#0a0a1a", enemyPool: "voidgate",scale: 1.5, desc: "现实在此处撕裂 · 暴击伤害+50%",
    relicPool: ["infinity_orb","chaos_blade","mystic_ring","phoenix_feather","demon_heart"],
    modifier: { id: "void_crit", desc: "🌀 虚空能量：双方暴击伤害+50%" } },
  tower:   { id: "tower",   name: "魔塔门前", icon: "🛕", bg: "#1a0a0a", enemyPool: "tower",   scale: 1.7, desc: "终焉之塔耸立于前 · 每回合恢复3%生命",
    relicPool: ["power_brace","iron_will","dice","chaos_blade","infinity_orb","phoenix_feather"],
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
  cave:     { depth: 1, choices: ["voidgate", "ruins"] },
  ruins:    { depth: 1, choices: ["frozen", "voidgate"] },
  frozen:   { depth: 2, choices: ["tower"] },
  voidgate: { depth: 2, choices: ["tower"] },
  tower:    { depth: 3, choices: [] }
});
