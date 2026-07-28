// 遗物定义
import { R } from '../core/registry.js';

export const RARITY_COLOR = { common: "#cccccc", rare: "#70a1ff", epic: "#c8a8ff", legendary: "#ffa502" };
export const RARITY_NAME = { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" };

R.registerAll('relics', [
  { id: "vamp_fang",    name: "吸血獠牙", rarity: "common",    desc: "攻击恢复8%伤害生命",               icon: "🦷", onAttack: (p, dmg) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(dmg * 0.08)); } },
  { id: "gold_bag",     name: "钱袋",     rarity: "common",    desc: "金币获取+50%",                       icon: "💰", passive: p => { p.goldMul = (p.goldMul || 1) + 0.5; }, onRemove: p => { p.goldMul = Math.max(1, (p.goldMul || 1) - 0.5); } },
  { id: "mp_stone",     name: "灵石",     rarity: "common",    desc: "每回合恢复4灵力",                    icon: "💎", onTurn: p => { p.mp = Math.min(p.maxMp, p.mp + 4); } },
  { id: "power_brace",  name: "力量护腕", rarity: "common",    desc: "攻击+5",                             icon: "💪", passive: p => { p.atk += 5; }, onRemove: p => { p.atk -= 5; } },
  { id: "guard_helm",   name: "守护头盔", rarity: "common",    desc: "防御+3，生命+15",                    icon: "⛑️", passive: p => { p.def += 3; p.maxHp += 15; p.hp += 15; }, onRemove: p => { p.def -= 3; p.maxHp -= 15; } },
  { id: "crit_mirror",  name: "暴击镜",   rarity: "rare",      desc: "暴击率+12%",                         icon: "🪞", passive: p => { p.critRate += 0.12; }, onRemove: p => { p.critRate -= 0.12; } },
  { id: "thorn_armor",  name: "荆棘护甲", rarity: "rare",      desc: "受击反弹15%伤害",                    icon: "🌵", onHit: (p, e, dmg) => { e.hp -= Math.floor(dmg * 0.15); } },
  { id: "blood_amulet", name: "血精石",   rarity: "rare",      desc: "生命上限+25",                        icon: "🩸", passive: p => { p.maxHp += 25; p.hp += 25; }, onRemove: p => { p.maxHp -= 25; } },
  { id: "mystic_ring",  name: "秘法之戒", rarity: "rare",      desc: "灵力上限+20，技能消耗-3",            icon: "💍", passive: p => { p.maxMp += 20; p.mp += 20; p._mysticOrigCost = p.mpCost; if (p.mpCost > 0) p.mpCost = Math.max(5, p.mpCost - 3); }, onRemove: p => { p.maxMp -= 20; if (p._mysticOrigCost !== undefined) { p.mpCost = p._mysticOrigCost; delete p._mysticOrigCost; } } },
  { id: "dice",         name: "幸运骰子", rarity: "epic",      desc: "暴击率+10%，闪避10%伤害",            icon: "🎲", passive: p => { p.critRate += 0.10; p.dodge = 0.1; }, onRemove: p => { p.critRate -= 0.10; p.dodge = 0; } },
  { id: "soul_vial",    name: "灵魂瓶",   rarity: "epic",      desc: "击杀敌人恢复15%最大生命",            icon: "🧪", onKill: p => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.15)); } },
  { id: "iron_will",    name: "钢铁意志", rarity: "epic",      desc: "防御+5，受击减伤20%",                icon: "🛡️", passive: p => { p.def += 5; p.dmgReduce = (p.dmgReduce || 0) + 0.2; }, onRemove: p => { p.def -= 5; p.dmgReduce = Math.max(0, (p.dmgReduce || 0) - 0.2); } },
  { id: "demon_heart",  name: "恶魔之心", rarity: "legendary", desc: "每回合对敌人造成10%最大生命值伤害", icon: "❤️", onTurn: (p, e) => { if (e && e.hp > 0) { const d = Math.max(1, Math.floor(e.maxHp * 0.10)); e.hp -= d; } } },
  { id: "infinity_orb", name: "无限法球", rarity: "legendary", desc: "技能不消耗灵力",                     icon: "🔮", passive: p => { p._orbOrigCost = p.mpCost; p.mpCost = 0; }, onRemove: p => { if (p._orbOrigCost !== undefined) { p.mpCost = p._orbOrigCost; delete p._orbOrigCost; } } },
  { id: "berserk_mask", name: "狂战面具", rarity: "legendary", desc: "血量越低伤害越高(最多+100%)",        icon: "👺", passive: p => { p.berserk = true; }, onRemove: p => { p.berserk = false; } },
  { id: "phoenix_feather",name:"凤凰羽",  rarity: "legendary", desc: "死亡时复活一次(恢复50%生命)",        icon: "🪶", passive: p => { p.rebirth = true; }, onRemove: p => { p.rebirth = false; } },
  { id: "chaos_blade",  name: "混沌之刃", rarity: "legendary", desc: "攻击无视50%防御",                  icon: "⚔️", passive: p => { p._chaosOrigPen = p.pen; p.pen = Math.max(p.pen || 0, 0.5); }, onRemove: p => { if (p._chaosOrigPen !== undefined) { p.pen = p._chaosOrigPen; delete p._chaosOrigPen; } } }
]);
