// 装备品质 + 类型 + 前缀（前缀新增战斗效果字段）
import { R } from '../core/registry.js';

R.registerAll('equipQualities', [
  { name: "破旧", color: "#888888", mul: 0.5, weight: 30 },
  { name: "普通", color: "#cccccc", mul: 1.0, weight: 25 },
  { name: "精良", color: "#89e894", mul: 1.6, weight: 20 },
  { name: "稀有", color: "#70a1ff", mul: 2.2, weight: 15 },
  { name: "史诗", color: "#c8a8ff", mul: 3.0, weight: 8  },
  { name: "传说", color: "#ffa502", mul: 4.0, weight: 2  },
  { name: "神话", color: "#ff6644", mul: 5.5, weight: 0.5 }
]);

R.registerAll('equipTypes', [
  { type: "weapon", name: "长剑", stat: "atk",      icon: "⚔️", base: 4 },
  { type: "armor",  name: "铠甲", stat: "def",      icon: "🛡️", base: 2 },
  { type: "helm",   name: "头盔", stat: "maxHp",    icon: "⛑️", base: 15 },
  { type: "ring",   name: "戒指", stat: "critRate", icon: "💍", base: 5 },
  { type: "amulet", name: "护符", stat: "dodge",   icon: "📿", base: 0.05 }
]);

// 前缀现在支持 combatEffect: { type, value } 用于战斗中的特效触发
R.registerAll('equipPrefixes', [
  { name: "",       statBonus: {}, combatEffect: null, desc: "" },
  { name: "锋利",   statBonus: { atk: 2 }, combatEffect: null, desc: "攻击+2" },
  { name: "坚固",   statBonus: { def: 2 }, combatEffect: null, desc: "防御+2" },
  { name: "生命",   statBonus: { maxHp: 10 }, combatEffect: null, desc: "生命+10" },
  { name: "魔力",   statBonus: { atk: 3 }, combatEffect: null, desc: "攻击+3" },
  { name: "精准",   statBonus: { critRate: 3 }, combatEffect: null, desc: "暴击+3%" },
  { name: "烈焰",   statBonus: { atk: 4 }, combatEffect: { type: "burn", value: 4 }, desc: "攻击+4 · 普攻附带灼烧" },
  { name: "冰霜",   statBonus: { def: 3, maxHp: 5 }, combatEffect: { type: "slow", value: 1 }, desc: "防+3命+5 · 普攻附带迟缓" },
  { name: "雷霆",   statBonus: { atk: 3, critRate: 2 }, combatEffect: { type: "stun", value: 0.3 }, desc: "攻+3暴+2% · 普攻概率眩晕" },
  { name: "暗影",   statBonus: { atk: 5, def: -1 }, combatEffect: { type: "lifesteal", value: 0.08 }, desc: "攻+5防-1 · 普攻吸血8%" },
  { name: "混沌",   statBonus: { atk: 6, critRate: 5, maxHp: 10 }, combatEffect: { type: "chaos", value: 0.3 }, desc: "全属性 · 30%概率伤害+50%" },
  { name: "神圣",   statBonus: { def: 4, maxHp: 20, dodge: 0.03 }, combatEffect: { type: "heal_on_kill", value: 0.1 }, desc: "防+4命+20闪+3% · 击杀回血10%" },
  { name: "毁灭",   statBonus: { atk: 8, critRate: 8 }, combatEffect: { type: "executioner", value: 0.25 }, desc: "攻+8暴+8% · 对低血敌人+25%伤害" }
]);
