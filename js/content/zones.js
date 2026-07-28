// 区域/关卡配置 + 简单模式路线
import { R } from '../core/registry.js';

R.registerAll('zones', {
  plains:  { id: "plains",  name: "迷雾平原", icon: "🌾", bg: "#0a0a14", enemyPool: "plains",  desc: "一切开始的地方",
    relicPool: ["vamp_fang","power_brace","guard_helm","blood_amulet"] },
  forest:  { id: "forest",  name: "幽暗森林", icon: "🌲", bg: "#0a140a", enemyPool: "forest",  desc: "树木遮蔽了阳光",
    relicPool: ["crit_mirror","thorn_armor","dice","berserk_mask"] },
  cave:    { id: "cave",    name: "废弃矿洞", icon: "⛏️", bg: "#140a0a", enemyPool: "cave",    desc: "深处传来低语",
    relicPool: ["guard_helm","iron_will","soul_vial","demon_heart"] },
  voidgate:{ id: "voidgate",name: "虚空裂隙", icon: "🌀", bg: "#0a0a1a", enemyPool: "plains",  desc: "魔塔的大门",
    relicPool: ["infinity_orb","chaos_blade","mystic_ring","phoenix_feather"] },
  tower:   { id: "tower",   name: "魔塔门前", icon: "🛕", bg: "#1a0a0a", enemyPool: "cave",    desc: "守门人等待着",
    relicPool: ["power_brace","iron_will","dice","chaos_blade","infinity_orb"] }
});

R.registerAll('simpleRoute', [
  { zone: "plains",   choices: ["forest", "cave"] },
  { zone: "forest",   choices: ["cave", "voidgate"] },
  { zone: "cave",     choices: ["voidgate", "forest"] },
  { zone: "voidgate", choices: ["tower"] },
  { zone: "tower",    choices: [] }
]);
