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
    id: "forge_blade_of_duality", name: "双界之刃", icon: "⚔️", rarity: "mythic", stat: "atk", val: 28, type: "weapon",
    desc: "冰火交织的传说之刃 · 攻击+28 · 暴击+15% · 普攻附带燃烧+迟缓",
    cost: 120,
    materials: ["mat_fire_core", "mat_ice_soul"],
    bonus: { critRate: 0.15, atk: 5 },
    combatEffect: { type: "burn", value: 6 }
  },
  {
    id: "forge_verdant_heart", name: "苍翠之心", icon: "💚", rarity: "mythic", stat: "dodge", val: 12, type: "amulet",
    desc: "森林本源凝聚的护符 · 闪避+12% · 每回合恢复5%生命",
    cost: 120,
    materials: ["mat_forest_heart", "mat_earth_core"],
    bonus: { regen: 5 },
    combatEffect: null
  },
  {
    id: "forge_void_crown", name: "虚空王冠", icon: "👑", rarity: "mythic", stat: "maxHp", val: 85, type: "helm",
    desc: "统御虚空的冠冕 · 生命+85 · 防御+10 · 穿透+25%",
    cost: 150,
    materials: ["mat_void_shard", "mat_ancient_seal"],
    bonus: { def: 10, pen: 0.25 },
    combatEffect: null
  },
  {
    id: "forge_tower_breaker", name: "破塔之戟", icon: "🔱", rarity: "mythic", stat: "atk", val: 35, type: "weapon",
    desc: "克制魔塔守卫的神兵 · 攻击+35 · 对Boss伤害+40%",
    cost: 200,
    materials: ["mat_tower_heart", "mat_fire_core", "mat_void_shard"],
    bonus: { atk: 8 },
    combatEffect: { type: "executioner", value: 0.40 }
  },
]);

// ===== v0.50 隐藏传说装备合成表（局外锻造工坊）=====
R.registerAll('hiddenLegendaries', [
  { id: "hidden_shield_achilles", name: "阿喀琉斯之盾", icon: "🛡️", rarity: "legendary", type: "armor", stat: "def", val: 25,
    cost: { forgeStones: 120, materials: 30, bossMats: ["mat_ancient_seal", "mat_ice_soul"] },
    condition: "synergy_frost_king", conditionDesc: "持有「冰霜之王」协同", bonus: { maxHp: 80 }, effect: "免疫冻结+迟缓，受击反弹50%伤害", _hidden: true },
  { id: "hidden_boots_hermes", name: "赫尔墨斯之靴", icon: "👢", rarity: "legendary", type: "helm", stat: "dodge", val: 18,
    cost: { forgeStones: 100, materials: 25, bossMats: ["mat_void_shard", "mat_desert_core"] },
    condition: "dodge_30", conditionDesc: "闪避率>30%时解锁", bonus: { atk: 12 }, effect: "闪避后下回合行动次数+1", _hidden: true },
  { id: "hidden_eye_odin", name: "奥丁之眼", icon: "👁️", rarity: "legendary", type: "ring", stat: "critRate", val: 20,
    cost: { forgeStones: 150, materials: 35, bossMats: ["mat_demon_soul", "mat_fire_core"] },
    condition: "crit_kill_boss", conditionDesc: "暴击击杀过Boss", bonus: { pen: 30 }, effect: "暴击时显示敌人详细弱点", _hidden: true },
  { id: "hidden_staff_sage", name: "贤者之杖", icon: "🪄", rarity: "legendary", type: "weapon", stat: "atk", val: 20,
    cost: { forgeStones: 130, materials: 30, bossMats: ["mat_tower_heart", "mat_forest_heart"] },
    condition: "skills_3", conditionDesc: "拥有3个以上技能", bonus: { skillMul: 1.0, maxEnergy: 1 }, effect: "技能击杀返还全部能量", _hidden: true },
  { id: "hidden_armor_dragon", name: "龙鳞铠", icon: "🦾", rarity: "legendary", type: "armor", stat: "def", val: 30,
    cost: { forgeStones: 140, materials: 30, bossMats: ["mat_general_seal", "mat_swamp_venom"] },
    condition: "hit_by_dragon", conditionDesc: "被龙类Boss攻击过", bonus: { maxHp: 100 }, effect: "每受击永久+2 DEF（每局上限+20）", _hidden: true },
  { id: "hidden_ring_fate", name: "命运之戒", icon: "💍", rarity: "legendary", type: "ring", stat: "atk", val: 8,
    cost: { forgeStones: 200, materials: 50, bossMats: [] },
    condition: "all_relics", conditionDesc: "收集全部基础遗物", bonus: { def: 8, maxHp: 50 }, effect: "遗物上限+2，协同效果×1.5", _hidden: true }
]);
