// 遗物定义
import { R } from '../core/registry.js';

export const RARITY_COLOR = { common: "#cccccc", rare: "#70a1ff", epic: "#c8a8ff", legendary: "#ffa502" };
export const RARITY_NAME = { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" };

R.registerAll('relics', [
  // ===== 普通 (common) =====
  { id: "vamp_fang",    name: "吸血獠牙", rarity: "common",    desc: "攻击恢复8%伤害生命",               icon: "🦷", onAttack: (p, dmg) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(dmg * 0.08)); } },
  { id: "gold_bag",     name: "钱袋",     rarity: "common",    desc: "金币获取+50%",                       icon: "💰", passive: p => { p.goldMul = (p.goldMul || 1) + 0.5; }, onRemove: p => { p.goldMul = Math.max(1, (p.goldMul || 1) - 0.5); } },
  { id: "mp_stone",     name: "灵石",     rarity: "common",    desc: "每回合恢复4灵力",                    icon: "💎", onTurn: p => { p.mp = Math.min(p.maxMp, p.mp + 4); } },
  { id: "power_brace",  name: "力量护腕", rarity: "common",    desc: "攻击+5",                             icon: "💪", passive: p => { p.atk += 5; }, onRemove: p => { p.atk -= 5; } },
  { id: "guard_helm",   name: "守护头盔", rarity: "common",    desc: "防御+3，生命+15",                    icon: "⛑️", passive: p => { p.def += 3; p.maxHp += 15; p.hp += 15; }, onRemove: p => { p.def -= 3; p.maxHp -= 15; p.hp = Math.max(1, p.hp - 15); } },
  { id: "curse_purge",  name: "净化符",   rarity: "common",    desc: "获得时移除一个随机诅咒，攻击+3",     icon: "📜", onAcquire: function(p) { /* 由 acquireRelic 处理 */ } },
  { id: "merchant_pass",name: "商队令牌", rarity: "common",    desc: "获得时立即+20金币，进入商店再+15",    icon: "🎫", passive: p => { p._merchantPass = true; } },
  { id: "lucky_charm",  name: "幸运符",   rarity: "common",    desc: "宝箱金币+10，遗物出现率微增",       icon: "🍀", passive: p => { p._luckyCharm = true; }, onRemove: p => { p._luckyCharm = false; } },

  // ===== 稀有 (rare) =====
  { id: "crit_mirror",  name: "暴击镜",   rarity: "rare",      desc: "暴击率+12%",                         icon: "🪞", passive: p => { p.critRate += 0.12; }, onRemove: p => { p.critRate -= 0.12; } },
  { id: "thorn_armor",  name: "荆棘护甲", rarity: "rare",      desc: "受击反弹15%伤害",                    icon: "🌵", onHit: (p, e, dmg) => { e.hp -= Math.floor(dmg * 0.15); } },
  { id: "blood_amulet", name: "血精石",   rarity: "rare",      desc: "生命上限+25",                        icon: "🩸", passive: p => { p.maxHp += 25; p.hp += 25; }, onRemove: p => { p.maxHp -= 25; p.hp = Math.max(1, p.hp - 25); } },
  { id: "mystic_ring",  name: "秘法之戒", rarity: "rare",      desc: "灵力上限+20，技能消耗-3",            icon: "💍", passive: p => { p.maxMp += 20; p.mp += 20; p._mysticOrigCost = p.mpCost; if (p.mpCost > 0) p.mpCost = Math.max(5, p.mpCost - 3); }, onRemove: p => { p.maxMp -= 20; if (p._mysticOrigCost !== undefined) { p.mpCost = p._mysticOrigCost; delete p._mysticOrigCost; } } },
  { id: "curse_blade",  name: "咒刃",     rarity: "rare",      desc: "每持有一个诅咒，攻击+5",             icon: "🗡️", onAcquire: function(p) { /* 每次诅咒变化时重算 */ } },
  { id: "blood_money",  name: "血钱",     rarity: "rare",      desc: "战斗胜利额外获得15金，但扣5%生命",   icon: "🪙", onKill: p => { p.goldMul_blood = true; } },
  { id: "ki_focus",     name: "凝气珠",   rarity: "rare",      desc: "技能伤害+30%，灵力消耗-2",           icon: "🔵", passive: p => { p.skillMul += 0.3; p._kiOrigCost = p.mpCost; p.mpCost = Math.max(3, p.mpCost - 2); }, onRemove: p => { p.skillMul -= 0.3; if (p._kiOrigCost !== undefined) { p.mpCost = p._kiOrigCost; delete p._kiOrigCost; } } },
  { id: "rage_totem",   name: "怒火图腾", rarity: "rare",      desc: "击杀敌人后下回合攻击+30%",           icon: "🗿", onKill: p => { p._rageTotem = true; }, onRemove: p => { p._rageTotem = false; } },
  { id: "first_strike", name: "先手之刃", rarity: "rare",      desc: "每场战斗首回合伤害+50%",             icon: "⚡", onAcquire: function(p) { /* 在 combat.js 中读取 */ } },
  { id: "cursed_ring",  name: "咒印之戒", rarity: "rare",      desc: "承受一个诅咒，但攻击+10暴击+10%",    icon: "💀" },

  // ===== 史诗 (epic) =====
  { id: "dice",         name: "幸运骰子", rarity: "epic",      desc: "暴击率+10%，闪避+10%",               icon: "🎲", passive: p => { p.critRate += 0.10; p.dodge = (p.dodge || 0) + 0.10; }, onRemove: p => { p.critRate -= 0.10; p.dodge = Math.max(0, (p.dodge || 0) - 0.10); } },
  { id: "soul_vial",    name: "灵魂瓶",   rarity: "epic",      desc: "击杀敌人恢复15%最大生命",            icon: "🧪", onKill: p => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.15)); } },
  { id: "iron_will",    name: "钢铁意志", rarity: "epic",      desc: "防御+5，受击减伤20%",                icon: "🛡️", passive: p => { p.def += 5; p.dmgReduce = (p.dmgReduce || 0) + 0.2; }, onRemove: p => { p.def -= 5; p.dmgReduce = Math.max(0, (p.dmgReduce || 0) - 0.2); } },
  { id: "gold_shield",  name: "金盾",     rarity: "epic",      desc: "每拥有40金币，防御+3（上限+15）",   icon: "🛡️" },
  { id: "alchemy_stone",name: "炼金石",   rarity: "epic",      desc: "药水效果+40%",                       icon: "🧪", passive: p => { p._alchemyStone = true; }, onRemove: p => { p._alchemyStone = false; } },
  { id: "battle_scar",  name: "战痕",     rarity: "epic",      desc: "每经过2场战斗，攻击永久+2",          icon: "💢" },
  { id: "executioner",  name: "处刑者",   rarity: "epic",      desc: "对生命低于30%的敌人伤害+40%",       icon: "⚰️" },
  { id: "demon_pact",   name: "恶魔契约", rarity: "epic",      desc: "攻击+12，但每回合损失4点生命",       icon: "📜", passive: p => { p.atk += 12; p._demonPact = true; }, onRemove: p => { p.atk -= 12; p._demonPact = false; } },
  { id: "shadow_step",  name: "影步",     rarity: "epic",      desc: "闪避+12%，成功闪避时恢复10%生命",   icon: "👣", passive: p => { p.dodge = (p.dodge || 0) + 0.12; p._shadowStep = true; }, onRemove: p => { p.dodge = Math.max(0, (p.dodge || 0) - 0.12); p._shadowStep = false; } },
  { id: "eternal_vial", name: "不灭之瓶", rarity: "epic",      desc: "使用药水时额外回复20%最大生命",     icon: "🧴" },

  // ===== 传说 (legendary) =====
  { id: "demon_heart",  name: "恶魔之心", rarity: "legendary", desc: "每回合对敌人造成10%最大生命值伤害", icon: "❤️", onTurn: (p, e) => { if (e && e.hp > 0) { const d = Math.max(1, Math.floor(e.maxHp * 0.10)); e.hp -= d; } } },
  { id: "infinity_orb", name: "无限法球", rarity: "legendary", desc: "技能不消耗灵力",                     icon: "🔮", passive: p => { p._orbOrigCost = p.mpCost; p.mpCost = 0; }, onRemove: p => { if (p._orbOrigCost !== undefined) { p.mpCost = p._orbOrigCost; delete p._orbOrigCost; } } },
  { id: "berserk_mask", name: "狂战面具", rarity: "legendary", desc: "血量越低伤害越高(最多+100%)",        icon: "👺", passive: p => { p.berserk = true; }, onRemove: p => { p.berserk = false; } },
  { id: "phoenix_feather",name:"凤凰羽",  rarity: "legendary", desc: "死亡时复活一次(恢复50%生命)",        icon: "🪶", passive: p => { p.rebirth = true; }, onRemove: p => { p.rebirth = false; } },
  { id: "chaos_blade",  name: "混沌之刃", rarity: "legendary", desc: "攻击无视50%防御",                  icon: "⚔️", passive: p => { p._chaosOrigPen = p.pen; p.pen = Math.max(p.pen || 0, 0.5); }, onRemove: p => { if (p._chaosOrigPen !== undefined) { p.pen = p._chaosOrigPen; delete p._chaosOrigPen; } } },
  { id: "glass_heart",  name: "琉璃心",   rarity: "legendary", desc: "暴击率+20%，暴击伤害+100%，但受伤+30%", icon: "💔", passive: p => { p.critRate += 0.20; p.critMul += 1.0; p._glassHeart = true; }, onRemove: p => { p.critRate -= 0.20; p.critMul -= 1.0; p._glassHeart = false; } },
  { id: "double_soul",  name: "双魂玉",   rarity: "legendary", desc: "每回合行动两次（攻击/技能各一次）", icon: "👥", passive: p => { p.doubleFirst = true; p._doubleSoul = true; }, onRemove: p => { p.doubleFirst = false; p._doubleSoul = false; } },
  { id: "void_stone",   name: "虚空石",   rarity: "legendary", desc: "所有伤害+25%，但灵力上限-50%",      icon: "🪨", passive: p => { p.skillMul += 0.25; p._voidAtkGain = Math.floor(p.atk * 0.25); p.atk += p._voidAtkGain; p._voidStone = true; }, onRemove: p => { p.skillMul -= 0.25; if (p._voidAtkGain !== undefined) { p.atk -= p._voidAtkGain; delete p._voidAtkGain; } p._voidStone = false; } }
]);
