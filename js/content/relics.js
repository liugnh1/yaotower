// 遗物定义 v0.40 — 全部机制型，无纯数值
import { R } from '../core/registry.js';

export const RARITY_COLOR = { common: "#cccccc", rare: "#70a1ff", epic: "#c8a8ff", legendary: "#ffa502" };
export const RARITY_NAME = { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" };

R.registerAll('relics', [
  // ===== 普通遗物（直接获得）=====
  { id: "vamp_fang",  name: "吸血獠牙", rarity: "common", category: "normal", desc: "攻击恢复12%伤害的生命", icon: "🦷",
    onAttack: (p, dmg) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(dmg * 0.12)); } },
  { category: "normal", id: "lightning_rod", name: "避雷针", rarity: "common", desc: "暴击时释放闪电链弹射2次", icon: "⚡",
    passive: p => { p._lightningRod = true; }, onRemove: p => { p._lightningRod = false; } },
  { category: "normal", id: "healing_tears",name: "治愈之泪", rarity: "common", desc: "击杀敌人恢复20%最大生命", icon: "💧",
    onKill: p => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.20)); } },
  { category: "normal", id: "spike_shell", name: "尖刺外壳", rarity: "common", desc: "受击反弹25%伤害给敌人", icon: "🐚",
    onHit: (p, e, dmg) => { e.hp -= Math.floor(dmg * 0.25); } },
  { category: "normal", id: "lucky_charm", name: "幸运符",   rarity: "common", desc: "宝箱额外+15金币，遗物掉率提升", icon: "🍀",
    passive: p => { p._luckyCharm = true; }, onRemove: p => { p._luckyCharm = false; } },

  // ===== 稀有 =====
  { category: "normal", id: "thunder_clap", name: "雷霆掌", rarity: "rare", desc: "普攻15%概率眩晕敌人1回合", icon: "🤚",
    onAttack: (p, dmg, s, target) => {
      var chance = p._synThunderGod ? 0.30 : 0.15; // 雷神之怒: 眩晕概率翻倍
      var t = target || (s && s.enemy); // v0.60: 使用实际攻击目标
      if (t && s && s.rng && s.rng.chance(chance)) t._buffs.push({ id:'stun', name:'眩晕', turns:1, onTick:()=>'stunned' });
    } },
  { category: "normal", id: "fire_aura",   name: "烈焰光环", rarity: "rare", desc: "每回合对所有敌人造成ATK×10%+层数/3的燃烧伤害", icon: "🔥",
    onTurn: (p, e, s, allEnemies) => {
      var targets = allEnemies || (e ? [e] : []);
      targets.forEach(function(en) { if (en && en.hp > 0) {
        var d = Math.max(3, Math.floor((p.atk || 10) * 0.10) + Math.floor((s ? s.totalFloor : 1) / 3));
        if (p._fireChain >= 1) d = Math.floor(d * 1.5); // 火焰共鸣·初燃: +50%
        if (p._brandBurnDmg) d = Math.floor(d * (1 + p._brandBurnDmg)); // 灼烧烙印: +8%
        en.hp -= d;
      }});
    } },
  { category: "normal", id: "frost_armor", name: "冰霜护甲", rarity: "rare", desc: "受击时50%概率使敌人迟缓2回合", icon: "❄️",
    onHit: (p, e, dmg, s) => {
      var chance = 0.5;
      if (p._iceChain >= 1) chance = 0.75; // 冰霜共鸣·初寒: +50%概率
      if (p._brandSlowChance) chance += p._brandSlowChance; // 冰霜烙印: +15%
      chance = Math.min(chance, 1.0);
      if (s && s.rng && s.rng.chance(chance)) { e._buffs.push({ id:'slow', name:'迟缓', turns:2, onRemove:()=>{} }); }
    } },
  { category: "normal", id: "blood_shield",name: "血盾",     rarity: "rare", desc: "受到致命伤害时以1血存活（每局1次）", icon: "🛡️",
    passive: p => { p._bloodShield = true; }, onRemove: p => { p._bloodShield = false; } },
  { category: "normal", id: "greed_bag",   name: "贪婪之袋", rarity: "rare", desc: "每持有30金币，攻击+3（上限+18）", icon: "💰",
    passive: p => { p._greedBag = true; }, onRemove: p => { p._greedBag = false; } },
  { category: "normal", id: "shadow_cloak",name: "暗影斗篷", rarity: "rare", desc: "每场战斗首次受击完全闪避", icon: "🌑",
    passive: p => { p._shadowCloak = true; }, onRemove: p => { p._shadowCloak = false; } },
  { category: "normal", id: "echo_stone",  name: "回音石",   rarity: "rare", desc: "释放技能时20%概率不进入冷却", icon: "🪨",
    passive: p => { p._echoStone = true; }, onRemove: p => { p._echoStone = false; } },

  // ===== 史诗 =====
  { category: "normal", id: "phoenix_feather",name:"凤凰羽", rarity: "epic", desc: "死亡时复活并恢复50%生命（每局1次）", icon: "🪶",
    passive: p => { p.rebirth = true; }, onRemove: p => { p.rebirth = false; } },
  { category: "normal", id: "berserk_mask", name: "狂战面具", rarity: "epic", desc: "血量越低伤害越高（最多+100%）", icon: "👺",
    passive: p => { p.berserk = true; }, onRemove: p => { p.berserk = false; } },
  { category: "normal", id: "chaos_blade",  name: "混沌之刃", rarity: "epic", desc: "攻击无视50%防御", icon: "⚔️",
    passive: p => { if (!p._chaosBlade) { p._chaosPenOrig = p.pen; p.pen = Math.max(p.pen || 0, 0.5); p._chaosBlade = true; } },
    onRemove: p => { if (p._chaosBlade) { p.pen = p._chaosPenOrig; delete p._chaosPenOrig; p._chaosBlade = false; } } },
  { category: "normal", id: "double_turn",  name: "时间沙漏", rarity: "epic", desc: "击杀敌人后获得一次额外行动", icon: "⏳",
    onKill: p => { p._extraTurn = true; } },
  { category: "normal", id: "soul_link",    name: "灵魂链接", rarity: "epic", desc: "你对敌人造成伤害时回复18%生命", icon: "🔗",
    onAttack: (p, dmg) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(dmg * 0.18)); } },
  { category: "normal", id: "death_mark",   name: "死亡标记", rarity: "epic", desc: "对生命低于35%的敌人伤害+50%", icon: "💀",
    passive: p => { p._deathMark = true; }, onRemove: p => { p._deathMark = false; } },

  // ===== 传说 =====
  { category: "normal", id: "infinite_mana",name: "无限法力", rarity: "legendary", desc: "所有技能冷却-1回合（最低1回合）", icon: "🔮",
    passive: p => { p._infMana = true; }, onRemove: p => { p._infMana = false; } },
  { category: "normal", id: "god_hand",     name: "神之手",   rarity: "legendary", desc: "每3回合自动释放一次免费技能", icon: "✋",
    passive: p => { p._godHand = true; }, onRemove: p => { p._godHand = false; } },
  { category: "normal", id: "doom_clock",   name: "末日时钟", rarity: "legendary", desc: "第5回合起对所有敌人造成%HP伤害", icon: "🕐",
    onTurn: (p, e, s, allEnemies) => {
      if (!s) return; var t = s.turnInFloor || 0; if (t < 5) return;
      var pct = t >= 10 ? 0.20 : 0.08;
      var targets = allEnemies || (e ? [e] : []);
      targets.forEach(function(en) { if (en && en.hp > 0) en.hp -= Math.floor(en.maxHp * pct); });
    } },
  { category: "normal", id: "glass_cannon", name: "玻璃大炮", rarity: "legendary", desc: "伤害翻倍，但受伤也翻倍", icon: "💔",
    passive: p => { if (!p._glassCannon) { p._dmgMulBeforeGC = p.skillMul; p.skillMul *= 2; p._glassCannon = true; } },
    onRemove: p => { if (p._glassCannon) { p.skillMul = p._dmgMulBeforeGC; delete p._dmgMulBeforeGC; p._glassCannon = false; } } },
  { category: "normal", id: "vampire_lord", name: "吸血伯爵", rarity: "legendary", desc: "吸血效率翻倍，溢出转为临时生命", icon: "🧛",
    passive: p => { if (!p._vampLord) { p.lifeSteal = (p.lifeSteal||0) + 0.15; p._vampLord = true; } }, onRemove: p => { if (p._vampLord) { p.lifeSteal = Math.max(0,(p.lifeSteal||0)-0.15); p._vampLord = false; } } },

  // ===== v0.42 新增 =====
  { category: "normal", id: "chain_lightning",name:"连锁闪电", rarity: "rare", desc: "击杀敌人时对随机另一个敌人造成50%伤害", icon: "🔗",
    onKill: (p, s) => { if (s && s.enemies) { var others = s.enemies.filter(function(e){return e.hp>0;}); if (others.length>0) { var t = others[Math.floor((s.rng?s.rng.next():Math.random())*others.length)]; var dmg = Math.floor((p.atk||10)*0.5); t.hp -= dmg; } } } },
  { category: "normal", id: "golden_apple",  name: "金苹果",   rarity: "common", desc: "每拥有50金币，每回合回复1%生命", icon: "🍎",
    passive: p => { p._goldenApple = true; }, onRemove: p => { p._goldenApple = false; },
    onTurn: (p, e, s) => { if (s && s.gold > 0) { var appHeal = Math.max(1, Math.floor(p.maxHp * 0.01 * Math.floor(s.gold / 50))); p.hp = Math.min(p.maxHp, p.hp + appHeal); } } },
  { category: "normal", id: "mirror_shield", name: "镜盾",     rarity: "rare", desc: "受击时20%概率完全格挡该次伤害", icon: "🪞",
    passive: p => { p._mirrorShield = true; }, onRemove: p => { p._mirrorShield = false; },
    onHit: (p, e, dmg, s) => { return true; /* 实际判定在combat.js strike()中，此处仅返回true表示该遗物有onHit */ } },
  { category: "normal", id: "blood_ruby",   name: "血晶石",   rarity: "epic", desc: "每损失10%生命，攻击+4", icon: "💎",
    passive: p => { p._bloodRuby = true; }, onRemove: p => { p._bloodRuby = false; } },
  { category: "normal", id: "toxic_cloud",  name: "毒雾",     rarity: "rare", desc: "战斗开始时对所有敌人施加中毒3回合", icon: "☠️",
    // 在战斗中获取→立即生效；非战斗获取→标记，下次战斗开始时生效
    passive: p => { p._toxicCloud = true; },
    onRemove: p => { p._toxicCloud = false; },
    onAcquire: (p, s) => { if (s && s.enemies && s.enemies.some(function(e){return e.hp>0;})) { s.enemies.forEach(function(e){ if(e.hp>0) e._buffs.push({id:'poison',name:'中毒',turns:3,data:{dmg:5},onTick:function(em,b){em.hp-=b.data.dmg;if(em.hp<=0)return'dead';}}); }); } } },
  { category: "normal", id: "ninja_tabi",   name: "忍者足袋", rarity: "rare", desc: "闪避成功后下回合必定暴击", icon: "👣",
    passive: p => { if (!p._ninjaTabi) { p.dodge = Math.min(0.75, (p.dodge||0)+0.05); p._ninjaTabi = true; } }, onRemove: p => { if (p._ninjaTabi) { p.dodge = Math.max(0,(p.dodge||0)-0.05); p._ninjaTabi = false; } } },
  { category: "normal", id: "war_drum",     name: "战鼓",     rarity: "epic", desc: "每经过5回合，本场战斗攻击+10（可叠加）", icon: "🥁",
    passive: p => { p._warDrum = true; }, onRemove: p => { p._warDrum = false; } },
  { category: "normal", id: "cursed_doll",  name: "咒怨人偶", rarity: "epic", desc: "每持有一个诅咒，暴击伤害+30%", icon: "🪆",
    passive: p => { p._cursedDoll = true; }, onRemove: p => { p._cursedDoll = false; } },
  { category: "normal", id: "philosopher_stone",name:"贤者之石",rarity:"legendary",desc:"每回合结束时，金币+5", icon: "🪨",
    onTurn: (p, e, s) => { if (s) s.gold += 5; } },
  { category: "normal", id: "angel_wings",  name: "天使之翼", rarity: "legendary", desc: "每场战斗首次死亡时复活并恢复30%生命", icon: "👼",
    passive: p => { p._angelWings = true; }, onRemove: p => { p._angelWings = false; } },
  { category: "normal", id: "medusa_head",  name: "美杜莎之首",rarity:"epic",desc:"普攻10%概率直接石化敌人（即死）", icon: "🐍",
    passive: p => { p._medusaHead = true; }, onRemove: p => { p._medusaHead = false; } },
  { category: "normal", id: "gamblers_dice",name: "赌徒骰子", rarity: "rare", desc: "暴击率提升20%，但未暴击时伤害减半", icon: "🎲",
    passive: p => { if (!p._gamblersDice) { p.critRate += 0.20; p._gamblersDice = true; } }, onRemove: p => { if (p._gamblersDice) { p.critRate -= 0.20; p._gamblersDice = false; } } },

  // ===== v0.45 核心遗物（需合成/虚空交易获得）=====
  { category: "core", id: "core_flame", name: "焚天之魂", rarity: "legendary", icon: "🔥",
    desc: "普攻附加1层燃烧。燃烧伤害受ATK×15%加成。燃烧层数无上限。",
    passive: p => { p._coreFlame = true; },
    onRemove: p => { p._coreFlame = false; } },
  { category: "core", id: "core_ice", name: "极寒之心", rarity: "legendary", icon: "❄️",
    desc: "对迟缓敌人的普攻伤害+80%。防御后下次普攻施加迟缓2回合。",
    passive: p => { p._coreIce = true; },
    onRemove: p => { p._coreIce = false; } },
  { category: "core", id: "core_shadow", name: "暗影之魂", rarity: "legendary", icon: "🌑",
    desc: "闪避成功后下次攻击3倍伤害。闪避率翻倍。",
    passive: p => { if (!p._coreShadow) { p._dodgeBeforeShadow = p.dodge || 0; p.dodge = Math.min(0.75, (p.dodge || 0) * 2); p._coreShadow = true; } },
    onRemove: p => { if (p._coreShadow) { p.dodge = p._dodgeBeforeShadow || 0; delete p._dodgeBeforeShadow; p._coreShadow = false; } } },
  { category: "core", id: "core_curse", name: "咒缚之源", rarity: "legendary", icon: "💀",
    desc: "每个诅咒使所有伤害+12%。",
    passive: p => { p._coreCurse = true; },
    onRemove: p => { p._coreCurse = false; } },
  { category: "core", id: "core_thunder", name: "雷霆之怒", rarity: "legendary", icon: "🌩️",
    desc: "暴击时释放闪电链（弹射2次每次衰减30%）。闪电伤害+30%。",
    passive: p => { p._coreThunder = true; },
    onRemove: p => { p._coreThunder = false; } },
  { category: "core", id: "core_light", name: "圣光之佑", rarity: "legendary", icon: "🌟",
    desc: "每回合回复6%HP。治疗时对敌人造成50%等量伤害。无法触发吸血。",
    passive: p => { p._coreLight = true; },
    onRemove: p => { p._coreLight = false; } },
]);
