// ===================== 局内锻造系统 v0.35 =====================
// Boss掉落材料存入 Game.state.forgeMats（当局有效）
// 锻造石台事件房间提供：合成 / 重铸 / 品质进阶
import { R } from '../core/registry.js';

// Boss掉落材料映射
R.registerAll('bossMaterials', {
  plains:   null,
  forest:   { id: "mat_forest_heart", name: "森林之心", icon: "💚", dropRate: 0.35 },
  cave:     { id: "mat_earth_core",   name: "大地之核", icon: "💎", dropRate: 0.35 },
  ruins:    { id: "mat_ancient_seal", name: "远古咒印", icon: "📜", dropRate: 0.35 },
  frozen:   { id: "mat_ice_soul",     name: "永冻之魂", icon: "❄️", dropRate: 0.35 },
  voidgate: { id: "mat_void_shard",   name: "虚空碎片", icon: "🌀", dropRate: 0.35 },
  tower:    { id: "mat_tower_heart",  name: "魔塔之心", icon: "🖤", dropRate: 0.35 },
  desert:   { id: "mat_desert_core", name: "沙漠之核", icon: "🏜️", dropRate: 0.35 },
  swamp:    { id: "mat_swamp_venom", name: "沼泽毒晶", icon: "🌿", dropRate: 0.35 },
  tower_lower: { id: "mat_general_seal", name: "将军徽记", icon: "🛡️", dropRate: 0.30 },
  tower_upper: { id: "mat_demon_soul", name: "魔王之魂", icon: "👑", dropRate: 0.30 },
});

// 额外稀有材料
R.registerAll('extraMaterials', [
  { id: "mat_fire_core", name: "烈焰核心", icon: "🔥", dropFromZones: ["voidgate", "tower"], dropRate: 0.18 },
]);

// 神话锻造配方（局内：在锻造石台消耗材料+金币锻造）
R.registerAll('forgeRecipes', [
  {
    id: "forge_blade_of_duality", name: "双界之刃", icon: "⚔️", rarity: "mythic", stat: "atk", val: 28,
    desc: "冰火交织的传说之刃 · 攻击+28 · 暴击+15% · 普攻附带燃烧+迟缓",
    cost: 120,
    materials: ["mat_fire_core", "mat_ice_soul"],
    bonus: { critRate: 0.15, atk: 5 },
    combatEffect: { type: "burn", value: 6 }
  },
  {
    id: "forge_verdant_heart", name: "苍翠之心", icon: "💚", rarity: "mythic", stat: "maxMp", val: 45,
    desc: "森林本源凝聚的护符 · 灵力+45 · 每回合恢复8灵力+5%生命",
    cost: 120,
    materials: ["mat_forest_heart", "mat_earth_core"],
    bonus: { regen: 5 },
    combatEffect: null
  },
  {
    id: "forge_void_crown", name: "虚空王冠", icon: "👑", rarity: "mythic", stat: "maxHp", val: 85,
    desc: "统御虚空的冠冕 · 生命+85 · 防御+10 · 穿透+25%",
    cost: 150,
    materials: ["mat_void_shard", "mat_ancient_seal"],
    bonus: { def: 10, pen: 0.25 },
    combatEffect: null
  },
  {
    id: "forge_tower_breaker", name: "破塔之戟", icon: "🔱", rarity: "mythic", stat: "atk", val: 35,
    desc: "克制魔塔守卫的神兵 · 攻击+35 · 对Boss伤害+40%",
    cost: 200,
    materials: ["mat_tower_heart", "mat_fire_core", "mat_void_shard"],
    bonus: { atk: 8 },
    combatEffect: { type: "executioner", value: 0.40 }
  },
]);
