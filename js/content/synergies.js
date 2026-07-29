// 遗物联动/羁绊定义 v0.40
import { R } from '../core/registry.js';

R.registerAll('synergies', [
  { id: "vamp_lord", relics: ["vamp_fang","vampire_lord"], name: "血族觉醒", desc: "吸血效率×3，溢出转为临时生命", icon: "🩸",
    apply: (p) => { p.lifeSteal = (p.lifeSteal||0)+0.10; p._synVampLord = true; },
    onRemove: (p) => { p.lifeSteal = Math.max(0,(p.lifeSteal||0)-0.10); p._synVampLord = false; } },
  { id: "thunder_god", relics: ["lightning_rod","thunder_clap"], name: "雷神之怒", desc: "闪电链弹射+2次，眩晕概率翻倍", icon: "⚡",
    apply: (p) => { p._synThunderGod = true; },
    onRemove: (p) => { p._synThunderGod = false; } },
  { id: "frost_king", relics: ["frost_armor","blood_shield"], name: "冰霜之王", desc: "受击必定迟缓敌人，免疫首次致命伤害", icon: "❄️",
    apply: (p) => { p.dmgReduce = (p.dmgReduce||0)+0.10; p._synFrostKing = true; },
    onRemove: (p) => { p.dmgReduce = Math.max(0,(p.dmgReduce||0)-0.10); p._synFrostKing = false; } },
  { id: "reaper", relics: ["death_mark","soul_link"], name: "死神契约", desc: "对低血敌人伤害+80%，击杀回复30%生命", icon: "💀",
    apply: (p) => { p._synReaper = true; },
    onRemove: (p) => { p._synReaper = false; } },
  { id: "time_master", relics: ["double_turn","infinite_mana"], name: "时间主宰", desc: "击杀额外行动+技能CD再-1", icon: "⏳",
    apply: (p) => { p._synTimeMaster = true; },
    onRemove: (p) => { p._synTimeMaster = false; } },
  { id: "glass_god", relics: ["glass_cannon","berserk_mask"], name: "玻璃战神", desc: "满血时伤害+50%，低血时伤害+150%", icon: "💔",
    apply: (p) => { p.skillMul += 0.5; p._synGlassGod = true; },
    onRemove: (p) => { p.skillMul -= 0.5; p._synGlassGod = false; } },
]);
