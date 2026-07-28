// 遗物联动/羁绊定义
// relics: 需要的遗物ID列表
// name/desc/icon: 显示用
// apply: 激活时调用的效果函数
import { R } from '../core/registry.js';

R.registerAll('synergies', [
  {
    id: "vamp_blood",
    relics: ["vamp_fang", "blood_amulet"],
    name: "血族觉醒", desc: "吸血效率翻倍，溢出治疗转为临时生命上限", icon: "🩸",
    apply: (p) => { p._synVampBlood = true; }
  },
  {
    id: "iron_thorn",
    relics: ["thorn_armor", "iron_will"],
    name: "铁棘堡垒", desc: "反弹伤害+50%，受击减伤额外+10%", icon: "🛡️",
    apply: (p) => { p.thorn = (p.thorn || 0) + 0.25; p.dmgReduce = (p.dmgReduce || 0) + 0.1; }
  },
  {
    id: "orb_ring",
    relics: ["infinity_orb", "mystic_ring"],
    name: "魔力共鸣", desc: "技能伤害+80%，但每次释放消耗5%最大生命", icon: "⚡",
    apply: (p) => { p.skillMul += 0.8; p._synOrbRing = true; }
  },
  {
    id: "crit_dice",
    relics: ["crit_mirror", "dice"],
    name: "命运之眼", desc: "暴击率额外+15%，暴击时15%概率伤害翻倍", icon: "👁️",
    apply: (p) => { p.critRate += 0.15; p._synCritDice = true; }
  },
  {
    id: "power_chaos",
    relics: ["power_brace", "chaos_blade"],
    name: "混沌之力", desc: "攻击+8，穿透+15%", icon: "💪",
    apply: (p) => { p.atk += 8; p.pen = (p.pen || 0) + 0.15; }
  }
]);
