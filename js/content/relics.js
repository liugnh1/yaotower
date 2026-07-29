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

  // ===== v0.42 新增 =====
  { id: "chain_lightning",name:"连锁闪电", rarity: "rare", desc: "击杀敌人时对随机另一个敌人造成50%伤害", icon: "⚡",
    onKill: (p, s) => { if (s && s.enemies) { var others = s.enemies.filter(function(e){return e.hp>0;}); if (others.length>0) { var t = others[Math.floor(Math.random()*others.length)]; var dmg = Math.floor((p.atk||10)*0.5); t.hp -= dmg; } } } },
  { id: "golden_apple",  name: "金苹果",   rarity: "common", desc: "每拥有50金币，每回合回复1%生命", icon: "🍎",
    passive: p => { p._goldenApple = true; }, onRemove: p => { p._goldenApple = false; },
    onTurn: (p, e, s) => { if (s && s.gold > 0) { var appHeal = Math.floor(p.maxHp * 0.01) * Math.floor(s.gold / 50); if (appHeal > 0) p.hp = Math.min(p.maxHp, p.hp + appHeal); } } },
  { id: "mirror_shield", name: "镜盾",     rarity: "rare", desc: "受击时20%概率完全格挡该次伤害", icon: "🪞",
    onHit: (p, e, dmg, s) => { if (s && s.rng && s.rng.chance(0.2)) { p.hp += dmg; return true; } } },
  { id: "blood_ruby",   name: "血晶石",   rarity: "epic", desc: "每损失10%生命，攻击+4", icon: "💎",
    passive: p => { p._bloodRuby = true; }, onRemove: p => { p._bloodRuby = false; } },
  { id: "toxic_cloud",  name: "毒雾",     rarity: "rare", desc: "战斗开始时对所有敌人施加中毒3回合", icon: "☠️",
    onAcquire: (p, s) => { if (s && s.enemies) s.enemies.forEach(function(e){ if(e.hp>0) e._buffs.push({id:'poison',name:'中毒',turns:3,data:{dmg:5},onTick:function(em,b){em.hp-=b.data.dmg;if(em.hp<=0)return'dead';}}); }); } },
  { id: "ninja_tabi",   name: "忍者足袋", rarity: "rare", desc: "闪避成功后下回合必定暴击", icon: "👣",
    passive: p => { p._ninjaTabi = true; p.dodge = (p.dodge||0)+0.05; }, onRemove: p => { p.dodge = Math.max(0,(p.dodge||0)-0.05); p._ninjaTabi = false; } },
  { id: "war_drum",     name: "战鼓",     rarity: "epic", desc: "每经过5回合，本场战斗攻击+10（可叠加）", icon: "🥁",
    passive: p => { p._warDrum = true; }, onRemove: p => { p._warDrum = false; } },
  { id: "cursed_doll",  name: "咒怨人偶", rarity: "epic", desc: "每持有一个诅咒，暴击伤害+30%", icon: "🪆",
    passive: p => { p._cursedDoll = true; }, onRemove: p => { p._cursedDoll = false; } },
  { id: "philosopher_stone",name:"贤者之石",rarity:"legendary",desc:"每回合结束时，金币+5", icon: "🪨",
    onTurn: (p, e, s) => { if (s) s.gold += 5; } },
  { id: "angel_wings",  name: "天使之翼", rarity: "legendary", desc: "每场战斗首次死亡时复活并恢复30%生命", icon: "👼",
    passive: p => { p._angelWings = true; }, onRemove: p => { p._angelWings = false; } },
  { id: "medusa_head",  name: "美杜莎之首",rarity:"epic",desc:"普攻10%概率直接石化敌人（即死）", icon: "🐍",
    passive: p => { p._medusaHead = true; }, onRemove: p => { p._medusaHead = false; } },
  { id: "gamblers_dice",name: "赌徒骰子", rarity: "rare", desc: "暴击率提升20%，但未暴击时伤害减半", icon: "🎲",
    passive: p => { p.critRate += 0.20; p._gamblersDice = true; }, onRemove: p => { p.critRate -= 0.20; p._gamblersDice = false; } },
]);
