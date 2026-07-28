// 遗物联动/羁绊定义（12组）
// relics: 需要的遗物ID列表
// 新增方向：诅咒流、金币流、暴击流、药水流、闪避流、毒血流、风险流
import { R } from '../core/registry.js';

R.registerAll('synergies', [
  // ===== 原有5组 =====
  {
    id: "vamp_blood",
    relics: ["vamp_fang", "blood_amulet"],
    name: "血族觉醒", desc: "吸血效率翻倍，溢出治疗转为临时生命上限", icon: "🩸",
    apply: (p) => { p._synVampBlood = true; },
    onRemove: (p) => { p._synVampBlood = false; }
  },
  {
    id: "iron_thorn",
    relics: ["thorn_armor", "iron_will"],
    name: "铁棘堡垒", desc: "反弹伤害+50%，受击减伤额外+10%", icon: "🛡️",
    apply: (p) => { p.thorn = (p.thorn || 0) + 0.25; p.dmgReduce = (p.dmgReduce || 0) + 0.1; },
    onRemove: (p) => { p.thorn = Math.max(0, (p.thorn || 0) - 0.25); p.dmgReduce = Math.max(0, (p.dmgReduce || 0) - 0.1); }
  },
  {
    id: "orb_ring",
    relics: ["infinity_orb", "mystic_ring"],
    name: "魔力共鸣", desc: "技能伤害+80%，但每次释放消耗5%最大生命", icon: "⚡",
    apply: (p) => { p.skillMul += 0.8; p._synOrbRing = true; },
    onRemove: (p) => { p.skillMul = Math.max(0, p.skillMul - 0.8); p._synOrbRing = false; }
  },
  {
    id: "crit_dice",
    relics: ["crit_mirror", "dice"],
    name: "命运之眼", desc: "暴击率额外+15%，暴击时15%概率伤害翻倍", icon: "👁️",
    apply: (p) => { p.critRate += 0.15; p._synCritDice = true; },
    onRemove: (p) => { p.critRate = Math.max(0, p.critRate - 0.15); p._synCritDice = false; }
  },
  {
    id: "power_chaos",
    relics: ["power_brace", "chaos_blade"],
    name: "混沌之力", desc: "攻击+8，穿透+15%", icon: "💪",
    apply: (p) => { p.atk += 8; p.pen = (p.pen || 0) + 0.15; },
    onRemove: (p) => { p.atk = Math.max(1, p.atk - 8); p.pen = Math.max(0, (p.pen || 0) - 0.15); }
  },
  // ===== 新增7组 =====
  {
    id: "curse_master",
    relics: ["curse_blade", "cursed_ring"],
    name: "咒术大师", desc: "每持有一个诅咒，攻击+5，暴击+5%", icon: "💀",
    apply: (p) => { p._synCurseMaster = true; },
    onRemove: (p) => { p._synCurseMaster = false; }
  },
  {
    id: "gold_tycoon",
    relics: ["gold_bag", "gold_shield"],
    name: "金库守卫", desc: "每拥有30金币，攻击+3（上限+15）", icon: "🪙",
    apply: (p) => { p._synGoldTycoon = true; },
    onRemove: (p) => { p._synGoldTycoon = false; }
  },
  {
    id: "fury_born",
    relics: ["rage_totem", "berserk_mask"],
    name: "狂战士之魂", desc: "击杀敌人后下回合伤害+50%", icon: "👺",
    apply: (p) => { p._synFuryBorn = true; },
    onRemove: (p) => { p._synFuryBorn = false; }
  },
  {
    id: "shadow_dance",
    relics: ["shadow_step", "first_strike"],
    name: "暗影之舞", desc: "闪避成功时恢复20%生命，首回合伤害+30%", icon: "👣",
    apply: (p) => { p._synShadowDance = true; },
    onRemove: (p) => { p._synShadowDance = false; }
  },
  {
    id: "alchemy_grand",
    relics: ["alchemy_stone", "eternal_vial"],
    name: "炼金宗师", desc: "使用药水时额外回复30%最大生命+5灵力", icon: "🧪",
    apply: (p) => { p._synAlchemyGrand = true; },
    onRemove: (p) => { p._synAlchemyGrand = false; }
  },
  {
    id: "glass_demon",
    relics: ["glass_heart", "demon_pact"],
    name: "绝望契约", desc: "攻击+20，暴击伤害+50%，但每回合扣6血", icon: "💔",
    apply: (p) => { p.atk += 20; p.critMul += 0.5; p._synGlassDemon = true; },
    onRemove: (p) => { p.atk = Math.max(1, p.atk - 20); p.critMul = Math.max(1.0, p.critMul - 0.5); p._synGlassDemon = false; }
  },
  {
    id: "executioner_soul",
    relics: ["executioner", "soul_vial"],
    name: "收割者", desc: "对生命低于40%的敌人伤害+50%，击杀回复20%生命", icon: "⚰️",
    apply: (p) => { p._synExecutioner = true; },
    onRemove: (p) => { p._synExecutioner = false; }
  }
]);
