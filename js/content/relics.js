// 遗物定义 v0.40 — 全部机制型，无纯数值
import { R } from '../core/registry.js';

export const RARITY_COLOR = { common: "#cccccc", rare: "#70a1ff", epic: "#c8a8ff", legendary: "#ffa502" };
export const RARITY_NAME = { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" };

R.registerAll('relics', [
  // ===== 普通 =====
  { id: "vamp_fang",  name: "吸血獠牙", rarity: "common", desc: "攻击恢复12%伤害的生命", icon: "🦷",
    onAttack: (p, dmg) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(dmg * 0.12)); } },
  { id: "lightning_rod", name: "避雷针", rarity: "common", desc: "暴击时释放闪电链弹射2次", icon: "⚡",
    passive: p => { p._lightningRod = true; }, onRemove: p => { p._lightningRod = false; } },
  { id: "healing_tears",name: "治愈之泪", rarity: "common", desc: "击杀敌人恢复20%最大生命", icon: "💧",
    onKill: p => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.20)); } },
  { id: "spike_shell", name: "尖刺外壳", rarity: "common", desc: "受击反弹25%伤害给敌人", icon: "🐚",
    onHit: (p, e, dmg) => { e.hp -= Math.floor(dmg * 0.25); } },
  { id: "lucky_charm", name: "幸运符",   rarity: "common", desc: "宝箱额外+15金币，遗物掉率提升", icon: "🍀",
    passive: p => { p._luckyCharm = true; }, onRemove: p => { p._luckyCharm = false; } },

  // ===== 稀有 =====
  { id: "thunder_clap", name: "雷霆掌", rarity: "rare", desc: "普攻15%概率眩晕敌人1回合", icon: "⚡",
    onAttack: (p, dmg, s) => { if (s && s.enemy && s.rng && s.rng.chance(0.15)) s.enemy._buffs.push({ id:'stun', name:'眩晕', turns:1, onTick:()=>'stunned' }); } },
  { id: "fire_aura",   name: "烈焰光环", rarity: "rare", desc: "每回合对敌人造成3+层数/5的燃烧伤害", icon: "🔥",
    onTurn: (p, e, s) => { if (e && e.hp > 0) { const d = 3 + Math.floor((s? s.totalFloor : 1) / 5); e.hp -= d; } } },
  { id: "frost_armor", name: "冰霜护甲", rarity: "rare", desc: "受击时50%概率使敌人迟缓2回合", icon: "❄️",
    onHit: (p, e, dmg, s) => { if (s && s.rng && s.rng.chance(0.5)) { e._buffs.push({ id:'slow', name:'迟缓', turns:2, onRemove:()=>{} }); } } },
  { id: "blood_shield",name: "血盾",     rarity: "rare", desc: "受到致命伤害时以1血存活（每局1次）", icon: "🛡️",
    passive: p => { p._bloodShield = true; }, onRemove: p => { p._bloodShield = false; } },
  { id: "greed_bag",   name: "贪婪之袋", rarity: "rare", desc: "每持有30金币，攻击+3（上限+18）", icon: "💰",
    passive: p => { p._greedBag = true; }, onRemove: p => { p._greedBag = false; } },
  { id: "shadow_cloak",name: "暗影斗篷", rarity: "rare", desc: "每场战斗首次受击完全闪避", icon: "🌑",
    passive: p => { p._shadowCloak = true; }, onRemove: p => { p._shadowCloak = false; } },
  { id: "echo_stone",  name: "回音石",   rarity: "rare", desc: "释放技能时20%概率不进入冷却", icon: "🪨",
    passive: p => { p._echoStone = true; }, onRemove: p => { p._echoStone = false; } },

  // ===== 史诗 =====
  { id: "phoenix_feather",name:"凤凰羽", rarity: "epic", desc: "死亡时复活并恢复50%生命（每局1次）", icon: "🪶",
    passive: p => { p.rebirth = true; }, onRemove: p => { p.rebirth = false; } },
  { id: "berserk_mask", name: "狂战面具", rarity: "epic", desc: "血量越低伤害越高（最多+100%）", icon: "👺",
    passive: p => { p.berserk = true; }, onRemove: p => { p.berserk = false; } },
  { id: "chaos_blade",  name: "混沌之刃", rarity: "epic", desc: "攻击无视50%防御", icon: "⚔️",
    passive: p => { p._chaosBlade = true; p.pen = Math.max(p.pen || 0, 0.5); }, onRemove: p => { p._chaosBlade = false; } },
  { id: "double_turn",  name: "时间沙漏", rarity: "epic", desc: "击杀敌人后获得一次额外行动", icon: "⏳",
    onKill: p => { p._extraTurn = true; } },
  { id: "soul_link",    name: "灵魂链接", rarity: "epic", desc: "你对敌人造成伤害时回复等量生命3%", icon: "🔗",
    onAttack: (p, dmg) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(dmg * 0.03)); } },
  { id: "death_mark",   name: "死亡标记", rarity: "epic", desc: "对生命低于35%的敌人伤害+50%", icon: "💀",
    passive: p => { p._deathMark = true; }, onRemove: p => { p._deathMark = false; } },

  // ===== 传说 =====
  { id: "infinite_mana",name: "无限法力", rarity: "legendary", desc: "所有技能冷却-1回合（最低1回合）", icon: "🔮",
    passive: p => { p._infMana = true; }, onRemove: p => { p._infMana = false; } },
  { id: "god_hand",     name: "神之手",   rarity: "legendary", desc: "每3回合自动释放一次免费技能", icon: "✋",
    passive: p => { p._godHand = true; }, onRemove: p => { p._godHand = false; } },
  { id: "doom_clock",   name: "末日时钟", rarity: "legendary", desc: "第10回合起每回合对敌人造成20%最大生命伤害", icon: "🕐",
    onTurn: (p, e, s) => { if (e && e.hp > 0 && (s? s.turnInFloor : 0) >= 10) { e.hp -= Math.floor(e.maxHp * 0.2); } } },
  { id: "glass_cannon", name: "玻璃大炮", rarity: "legendary", desc: "伤害翻倍，但受伤也翻倍", icon: "💔",
    passive: p => { p.skillMul += 1.0; p._glassCannon = true; }, onRemove: p => { p.skillMul -= 1.0; p._glassCannon = false; } },
  { id: "vampire_lord", name: "吸血伯爵", rarity: "legendary", desc: "吸血效率翻倍，溢出转为临时生命", icon: "🧛",
    passive: p => { p.lifeSteal = (p.lifeSteal||0) + 0.15; p._vampLord = true; }, onRemove: p => { p.lifeSteal = Math.max(0,(p.lifeSteal||0)-0.15); p._vampLord = false; } },
]);
