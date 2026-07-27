// ===================== 游戏数据配置表（地基版）=====================

// -------------------- 职业（含技能池） --------------------
export const CLASSES = {
  warrior: {
    id: "warrior", name: "剑修", icon: "⚔️",
    hp: 120, maxHp: 120, mp: 20, maxMp: 20,
    atk: 18, def: 4, critRate: 0.25, critMul: 1.5,
    skillMul: 1.5, mpCost: 10, pen: 0,
    desc: "高攻高防·暴击25%·重斩1.5倍",
    skills: [
      { id: "fire_slash", name: "烈火剑法", icon: "🔥", desc: "技能伤害×1.8，附加燃烧", mul: 1.8, effect: "burn" },
      { id: "ice_slash",  name: "冰霜剑诀", icon: "❄️", desc: "技能伤害×1.5，附加迟缓", mul: 1.5, effect: "slow" },
      { id: "thunder",    name: "雷霆一击", icon: "⚡", desc: "技能伤害×2.2，消耗+5",   mul: 2.2, effect: "stun", extraCost: 5 }
    ]
  },
  mage: {
    id: "mage", name: "法修", icon: "🔮",
    hp: 90, maxHp: 90, mp: 50, maxMp: 50,
    atk: 14, def: 2, critRate: 0.10, critMul: 1.5,
    skillMul: 2.2, mpCost: 15, pen: 0.5,
    desc: "高灵力·技能穿透·炎爆2.2倍",
    skills: [
      { id: "fireball",   name: "炎爆术",   icon: "🔥", desc: "技能伤害×2.4，消耗+5",   mul: 2.4, effect: "burn", extraCost: 5 },
      { id: "frost_nova", name: "冰霜新星", icon: "❄️", desc: "技能伤害×1.8，附加迟缓", mul: 1.8, effect: "slow" },
      { id: "arcane",     name: "奥术飞弹", icon: "✨", desc: "技能伤害×2.0，穿透+20%",  mul: 2.0, effect: "pen", extraPen: 0.2 }
    ]
  }
};

// -------------------- 怪物（按主题分组） --------------------
export const ENEMIES = {
  plains: [
    { name: "野兔精",  hp: 25, atk: 6,  def: 0, exp: "不堪一击", icon: "🐰" },
    { name: "山魈",    hp: 40, atk: 8,  def: 1, exp: "略有身手", icon: "👹" },
    { name: "野狼",    hp: 55, atk: 10, def: 1, exp: "凶性毕露", icon: "🐺" }
  ],
  forest: [
    { name: "毒蜂",    hp: 35, atk: 12, def: 0, exp: "成群结队", icon: "🐝" },
    { name: "树妖",    hp: 70, atk: 10, def: 3, exp: "根深蒂固", icon: "🌳" },
    { name: "幽灵狼",  hp: 60, atk: 14, def: 1, exp: "来去无踪", icon: "👻" }
  ],
  cave: [
    { name: "矿洞鼠",  hp: 30, atk: 8,  def: 2, exp: "成群出没", icon: "🐀" },
    { name: "岩石怪",  hp: 90, atk: 9,  def: 6, exp: "坚如磐石", icon: "🪨" },
    { name: "蝙蝠群",  hp: 50, atk: 13, def: 0, exp: "遮天蔽日", icon: "🦇" }
  ]
};

// Boss 配置（按关卡）
export const ZONE_BOSSES = {
  1: { name: "平原领主·裂地者",  hp: 150, atk: 18, def: 5,  exp: "大地颤抖", icon: "🦏" },
  2: { name: "森林之王·苍古树精", hp: 220, atk: 22, def: 7,  exp: "万木臣服", icon: "🌲" },
  3: { name: "矿洞主宰·晶石巨像", hp: 300, atk: 26, def: 10, exp: "坚不可摧", icon: "💎" },
  4: { name: "虚空守门人",         hp: 400, atk: 32, def: 12, exp: "魔塔在前", icon: "🌀" },
  5: { name: "魔塔守门人",         hp: 550, atk: 38, def: 15, exp: "简单模式·终极之战", icon: "🛡️" }
};

export const ENDLESS_BOSSES = [
  { name: "深渊领主",      hp: 700, atk: 45, def: 18, exp: "深渊凝视" },
  { name: "虚空吞噬者",    hp: 1000,atk: 55, def: 22, exp: "万物归虚" },
  { name: "混沌魔神·终焉", hp: 1500,atk: 70, def: 28, exp: "万物终结" }
];

// -------------------- 房间类型 --------------------
export const ROOM_TYPES = {
  battle:  { id: "battle",  icon: "👹", name: "战斗", desc: "遭遇怪物",        color: "#ff7b7b" },
  elite:   { id: "elite",   icon: "👺", name: "精英", desc: "强敌，高级奖励",   color: "#ff4444" },
  shop:    { id: "shop",    icon: "🏪", name: "商店", desc: "购买道具与装备",   color: "#70a1ff" },
  chest:   { id: "chest",   icon: "📦", name: "宝箱", desc: "免费奖励",         color: "#ffa502" },
  event:   { id: "event",   icon: "❓", name: "事件", desc: "随机遭遇",         color: "#89e894" },
  boss:    { id: "boss",    icon: "💀", name: "Boss", desc: "关底首领",         color: "#ffa502" },
  shrine:  { id: "shrine",  icon: "⛩️", name: "神龛", desc: "献祭换祝福",       color: "#c8a8ff" },
  altar:   { id: "altar",   icon: "☠️", name: "祭坛", desc: "诅咒换遗物",       color: "#ff4444" }
};

// 每关房间模板（10层）—— 类型固定，顺序随机
export const ROOM_TEMPLATES = {
  simple: [
    ["battle","battle","battle","elite","shop","chest","battle","event","battle","boss"],
    ["battle","elite","battle","battle","shop","shrine","battle","chest","battle","boss"],
    ["battle","battle","elite","battle","altar","shop","battle","battle","event","boss"],
    ["elite","battle","battle","battle","shop","chest","elite","battle","shrine","boss"],
    ["battle","elite","battle","elite","shop","altar","battle","chest","battle","boss"]
  ],
  normal: []
};

// -------------------- 主题/区域配置 --------------------
export const ZONES = {
  plains:  { id: "plains",  name: "迷雾平原", icon: "🌾", bg: "#0a0a14", enemyPool: "plains",  desc: "一切开始的地方" },
  forest:  { id: "forest",  name: "幽暗森林", icon: "🌲", bg: "#0a140a", enemyPool: "forest",  desc: "树木遮蔽了阳光" },
  cave:    { id: "cave",    name: "废弃矿洞", icon: "⛏️", bg: "#140a0a", enemyPool: "cave",    desc: "深处传来低语" },
  voidgate:{ id: "voidgate",name: "虚空裂隙", icon: "🌀", bg: "#0a0a1a", enemyPool: "plains",  desc: "魔塔的大门" },
  tower:   { id: "tower",   name: "魔塔门前", icon: "🛕", bg: "#1a0a0a", enemyPool: "cave",    desc: "守门人等待着" }
};

// 简单模式路线（5关，每关结束选下一关主题）
export const SIMPLE_ROUTE = [
  { zone: "plains",   choices: ["forest", "cave"] },
  { zone: "forest",   choices: ["cave", "voidgate"] },
  { zone: "cave",     choices: ["voidgate", "forest"] },
  { zone: "voidgate", choices: ["tower"] },
  { zone: "tower",    choices: [] }
];

// -------------------- 天赋 --------------------
export const TALENTS = [
  { id: "vamp",  name: "血族之裔", icon: "🧛", desc: "攻击恢复15%伤害的生命", apply: p => { p.lifeSteal = 0.15; } },
  { id: "crit",  name: "鹰眼",     icon: "🦅", desc: "暴击率+20%，暴伤+50%",  apply: p => { p.critRate += 0.20; p.critMul += 0.5; } },
  { id: "tank",  name: "磐石",     icon: "🗿", desc: "生命+40，防御+4",       apply: p => { p.maxHp += 40; p.hp += 40; p.def += 4; } },
  { id: "mage",  name: "元素亲和", icon: "🔮", desc: "灵力+30，技能消耗-5",   apply: p => { p.maxMp += 30; p.mp += 30; p.mpCost = Math.max(5, p.mpCost - 5); } },
  { id: "greed", name: "贪婪之手", icon: "💰", desc: "金币获取+100%",         apply: p => { p.goldMul = 2; } },
  { id: "thorn", name: "荆棘之躯", icon: "🌵", desc: "受击反弹25%伤害",       apply: p => { p.thorn = 0.25; } },
  { id: "rage",  name: "狂战士",   icon: "🩸", desc: "生命低于30%时攻击+50%", apply: p => { p.rage = true; } },
  { id: "swift", name: "疾风",     icon: "💨", desc: "先手：首回合攻击两次",  apply: p => { p.doubleFirst = true; } }
];

// -------------------- 怪物词条 --------------------
export const MONSTER_TAGS = [
  { id: "vamp",   name: "[吸血]", apply: e => { e.lifeSteal = 0.3; } },
  { id: "rage",   name: "[狂暴]", apply: e => { e.atk = Math.floor(e.atk * 1.4); } },
  { id: "thorn",  name: "[反伤]", apply: e => { e.thorn = 0.15; } },
  { id: "tough",  name: "[坚韧]", apply: e => { e.def += 4; } },
  { id: "swift",  name: "[迅捷]", apply: e => { e.doubleFirst = true; } },
  { id: "charge", name: "[蓄力]", apply: e => { e.aiCharge = true; e.chargeTurns = 0; } },
  { id: "curse",  name: "[诅咒]", apply: e => { e.aiCurse = true; } }
];

// -------------------- 遗物 --------------------
export const RELICS = [
  { id: "vamp_fang",    name: "吸血獠牙", rarity: "common",    desc: "攻击恢复8%伤害生命",               icon: "🦷", onAttack: (p, dmg) => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(dmg * 0.08)); } },
  { id: "gold_bag",     name: "钱袋",     rarity: "common",    desc: "金币获取+50%",                       icon: "💰", passive: p => { p.goldMul = (p.goldMul || 1) + 0.5; } },
  { id: "mp_stone",     name: "灵石",     rarity: "common",    desc: "每回合恢复4灵力",                    icon: "💎", onTurn: p => { p.mp = Math.min(p.maxMp, p.mp + 4); } },
  { id: "power_brace",  name: "力量护腕", rarity: "common",    desc: "攻击+5",                             icon: "💪", passive: p => { p.atk += 5; } },
  { id: "guard_helm",   name: "守护头盔", rarity: "common",    desc: "防御+3，生命+15",                    icon: "⛑️", passive: p => { p.def += 3; p.maxHp += 15; p.hp += 15; } },
  { id: "crit_mirror",  name: "暴击镜",   rarity: "rare",      desc: "暴击率+12%",                         icon: "🪞", passive: p => { p.critRate += 0.12; } },
  { id: "thorn_armor",  name: "荆棘护甲", rarity: "rare",      desc: "受击反弹15%伤害",                    icon: "🌵", onHit: (p, e, dmg) => { e.hp -= Math.floor(dmg * 0.15); } },
  { id: "blood_amulet", name: "血精石",   rarity: "rare",      desc: "生命上限+25",                        icon: "🩸", passive: p => { p.maxHp += 25; p.hp += 25; } },
  { id: "mystic_ring",  name: "秘法之戒", rarity: "rare",      desc: "灵力上限+20，技能消耗-3",            icon: "💍", passive: p => { p.maxMp += 20; p.mp += 20; p.mpCost = Math.max(5, p.mpCost - 3); } },
  { id: "dice",         name: "幸运骰子", rarity: "epic",      desc: "暴击率+10%，闪避10%伤害",            icon: "🎲", passive: p => { p.critRate += 0.10; p.dodge = 0.1; } },
  { id: "soul_vial",    name: "灵魂瓶",   rarity: "epic",      desc: "击杀敌人恢复15%最大生命",            icon: "🧪", onKill: p => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.15)); } },
  { id: "iron_will",    name: "钢铁意志", rarity: "epic",      desc: "防御+5，受击减伤20%",                icon: "🛡️", passive: p => { p.def += 5; p.dmgReduce = (p.dmgReduce || 0) + 0.2; } },
  { id: "demon_heart",  name: "恶魔之心", rarity: "legendary", desc: "每回合对敌人造成10%最大生命值伤害", icon: "❤️", onTurn: (p, e) => { if (e && e.hp > 0) { const d = Math.max(1, Math.floor(e.maxHp * 0.10)); e.hp -= d; } } },
  { id: "infinity_orb", name: "无限法球", rarity: "legendary", desc: "技能不消耗灵力",                     icon: "🔮", passive: p => { p.mpCost = 0; } },
  { id: "berserk_mask", name: "狂战面具", rarity: "legendary", desc: "血量越低伤害越高(最多+100%)",        icon: "👺", passive: p => { p.berserk = true; } },
  { id: "phoenix_feather",name:"凤凰羽",  rarity: "legendary", desc: "死亡时复活一次(恢复50%生命)",        icon: "🪶", passive: p => { p.rebirth = true; } },
  { id: "chaos_blade",  name: "混沌之刃", rarity: "legendary", desc: "攻击无视50%防御",                  icon: "⚔️", passive: p => { p.pen = Math.max(p.pen || 0, 0.5); } }
];

export const RARITY_COLOR = { common: "#cccccc", rare: "#70a1ff", epic: "#c8a8ff", legendary: "#ffa502" };
export const RARITY_NAME = { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" };

// -------------------- 诅咒 --------------------
export const CURSES = [
  { id: "weak",  name: "虚弱", desc: "最大生命-20%", apply: p => { p.maxHp = Math.floor(p.maxHp * 0.8); p.hp = Math.min(p.hp, p.maxHp); } },
  { id: "slow",  name: "迟缓", desc: "防御-3",       apply: p => { p.def = Math.max(0, p.def - 3); } },
  { id: "bleed", name: "流血", desc: "每回合损失3生命", apply: p => { p.bleed = 3; } },
  { id: "poor",  name: "贫困", desc: "金币获取-50%", apply: p => { p.goldMul = (p.goldMul || 1) * 0.5; } }
];

// -------------------- 装备系统 --------------------
export const EQUIP_QUALITIES = [
  { name: "破旧", color: "#888888", mul: 0.5, weight: 30 },
  { name: "普通", color: "#cccccc", mul: 1.0, weight: 25 },
  { name: "精良", color: "#89e894", mul: 1.6, weight: 20 },
  { name: "稀有", color: "#70a1ff", mul: 2.2, weight: 15 },
  { name: "史诗", color: "#c8a8ff", mul: 3.0, weight: 8  },
  { name: "传说", color: "#ffa502", mul: 4.0, weight: 2  }
];

export const EQUIP_TYPES = [
  { type: "weapon", name: "长剑", stat: "atk",      icon: "⚔️", base: 4 },
  { type: "armor",  name: "铠甲", stat: "def",      icon: "🛡️", base: 2 },
  { type: "helm",   name: "头盔", stat: "maxHp",    icon: "⛑️", base: 15 },
  { type: "ring",   name: "戒指", stat: "critRate", icon: "💍", base: 5 },
  { type: "amulet", name: "护符", stat: "maxMp",    icon: "📿", base: 10 }
];

export const EQUIP_PREFIXES = [
  { name: "",       statBonus: {}, desc: "" },
  { name: "锋利",   statBonus: { atk: 2 }, desc: "攻击+2" },
  { name: "坚固",   statBonus: { def: 2 }, desc: "防御+2" },
  { name: "生命",   statBonus: { maxHp: 10 }, desc: "生命+10" },
  { name: "魔力",   statBonus: { maxMp: 8 }, desc: "灵力+8" },
  { name: "精准",   statBonus: { critRate: 3 }, desc: "暴击+3%" },
  { name: "烈焰",   statBonus: { atk: 4 }, desc: "攻击+4" },
  { name: "冰霜",   statBonus: { def: 3, maxHp: 5 }, desc: "防御+3 生命+5" },
  { name: "雷霆",   statBonus: { atk: 3, critRate: 2 }, desc: "攻击+3 暴击+2%" },
  { name: "暗影",   statBonus: { atk: 5, def: -1 }, desc: "攻击+5 防御-1" },
  { name: "混沌",   statBonus: { atk: 6, critRate: 5, maxHp: 10 }, desc: "攻击+6 暴击+5% 生命+10" },
  { name: "神圣",   statBonus: { def: 4, maxHp: 20, maxMp: 10 }, desc: "防御+4 生命+20 灵力+10" },
  { name: "毁灭",   statBonus: { atk: 8, critRate: 8 }, desc: "攻击+8 暴击+8%" }
];

// -------------------- 药水 --------------------
export const POTIONS = [
  { id: "heal",    name: "回血药",   icon: "🧪", desc: "恢复50生命",  fn: p => { p.hp = Math.min(p.maxHp, p.hp + 50); } },
  { id: "mp",      name: "回蓝药",   icon: "🔮", desc: "恢复30灵力",  fn: p => { p.mp = Math.min(p.maxMp, p.mp + 30); } },
  { id: "cleanse", name: "净化药水", icon: "🧴", desc: "清除1层诅咒", fn: (p, G) => { if (G.curses.length > 0) G.curses.pop(); } },
  { id: "power",   name: "力量药剂", icon: "💪", desc: "本层攻击+20%",fn: (p, G) => { G.potionAtk = 0.2; } },
  { id: "iron",    name: "铁壁药剂", icon: "🛡️", desc: "本层防御+50%",fn: (p, G) => { G.potionDef = 0.5; } }
];

// -------------------- 难度 --------------------
export const DIFFICULTIES = {
  casual:   { id: "casual",   name: "休闲", icon: "🌱", desc: "怪物属性-30%，遗物掉率提升", monsterMul: 0.7,  extraTag: false, legendRate: 0.05, adLimit: 15 },
  standard: { id: "standard", name: "标准", icon: "⚔️", desc: "原版平衡体验",              monsterMul: 1.0,  extraTag: false, legendRate: 0.02, adLimit: 10 },
  hell:     { id: "hell",     name: "炼狱", icon: "🔥", desc: "怪物+30%，多1词条，橙率大增", monsterMul: 1.3,  extraTag: true,  legendRate: 0.08, adLimit: 10 }
};

// -------------------- 每日挑战修饰器 --------------------
export const DAILY_GLOBAL_MODS = [
  { id: "g1", name: "全员强化", desc: "所有人属性+10%", apply: s => { s.player.atk = Math.floor(s.player.atk * 1.1); s.player.maxHp = Math.floor(s.player.maxHp * 1.1); s.player.hp = s.player.maxHp; } },
  { id: "g2", name: "贫瘠之地", desc: "金币获取-50%",   apply: s => { s.player.goldMul = (s.player.goldMul || 1) * 0.5; } },
  { id: "g3", name: "灵气充沛", desc: "灵力上限+50%",   apply: s => { s.player.maxMp = Math.floor(s.player.maxMp * 1.5); s.player.mp = s.player.maxMp; } },
  { id: "g4", name: "血战到底", desc: "生命上限-30%，攻击+30%", apply: s => { s.player.maxHp = Math.floor(s.player.maxHp * 0.7); s.player.hp = Math.min(s.player.hp, s.player.maxHp); s.player.atk = Math.floor(s.player.atk * 1.3); } },
  { id: "g5", name: "富可敌国", desc: "开局金币+100",   apply: s => { s.gold += 100; } },
  { id: "g6", name: "诅咒缠身", desc: "开局自带1层诅咒", apply: s => { /* 由系统随机加 */ } },
  { id: "g7", name: "神速",     desc: "所有怪物敏捷+，先手率提升", apply: s => { /* 战斗系统识别 */ } },
  { id: "g8", name: "双倍掉落", desc: "装备/遗物掉率翻倍", apply: s => { s.dropMul = 2; } },
  { id: "g9", name: "独狼",     desc: "无法获得天赋，但攻击+50%", apply: s => { s.player.atk = Math.floor(s.player.atk * 1.5); s.noTalent = true; } }
];

export const DAILY_PLAYER_MODS = [
  { id: "p1", name: "战士之血", desc: "攻击+10%", apply: s => { s.player.atk = Math.floor(s.player.atk * 1.1); } },
  { id: "p2", name: "法师之智", desc: "灵力+20%", apply: s => { s.player.maxMp = Math.floor(s.player.maxMp * 1.2); s.player.mp = s.player.maxMp; } },
  { id: "p3", name: "铁壁",     desc: "防御+5",   apply: s => { s.player.def += 5; } },
  { id: "p4", name: "暴击狂",   desc: "暴击率+15%", apply: s => { s.player.critRate += 0.15; } },
  { id: "p5", name: "吸血本能", desc: "吸血+10%", apply: s => { s.player.lifeSteal = (s.player.lifeSteal || 0) + 0.1; } },
  { id: "p6", name: "穷鬼",     desc: "金币-50%，攻击+20%", apply: s => { s.player.goldMul = (s.player.goldMul || 1) * 0.5; s.player.atk = Math.floor(s.player.atk * 1.2); } },
  { id: "p7", name: "玻璃大炮", desc: "生命-30%，技能伤害+50%", apply: s => { s.player.maxHp = Math.floor(s.player.maxHp * 0.7); s.player.hp = Math.min(s.player.hp, s.player.maxHp); s.player.skillMul += 0.5; } },
  { id: "p8", name: "幸运儿",   desc: "暴击伤害+50%", apply: s => { s.player.critMul += 0.5; } },
  { id: "p9", name: "苟命王",   desc: "每回合恢复5生命", apply: s => { s.player.regen = 5; } }
];

export const DAILY_ENEMY_MODS = [
  { id: "e1", name: "血牛",     desc: "怪物血量+20%", apply: s => { s.enemyHpMul = 1.2; } },
  { id: "e2", name: "狂暴",     desc: "怪物攻击+20%", apply: s => { s.enemyAtkMul = 1.2; } },
  { id: "e3", name: "铁壁",     desc: "怪物防御+30%", apply: s => { s.enemyDefMul = 1.3; } },
  { id: "e4", name: "迅捷",     desc: "怪物先手率提升", apply: s => { s.enemySwift = true; } },
  { id: "e5", name: "贪婪",     desc: "怪物金币掉落-30%", apply: s => { s.enemyGoldMul = 0.7; } },
  { id: "e6", name: "诅咒师",   desc: "怪物诅咒几率+20%", apply: s => { s.enemyCurseRate = 0.2; } },
  { id: "e7", name: "复活",     desc: "Boss血量+50%", apply: s => { s.bossHpMul = 1.5; } },
  { id: "e8", name: "精英潮",   desc: "精英房数量+1", apply: s => { s.extraElite = true; } },
  { id: "e9", name: "绝境",     desc: "所有怪物+1词条", apply: s => { s.enemyExtraTag = true; } }
];

// -------------------- 局外成长（Meta）上限配置 --------------------
export const META_LIMITS = {
  atkBonus:      { max: 0.20, step: 0.02, cost: 1, name: "神力·攻" },
  hpBonus:       { max: 0.20, step: 0.02, cost: 1, name: "神力·血" },
  defBonus:      { max: 0.20, step: 0.02, cost: 1, name: "神力·防" },
  critBonus:     { max: 0.10, step: 0.01, cost: 2, name: "神力·暴" },
  goldBonus:     { max: 0.30, step: 0.03, cost: 1, name: "神力·财" },
  startPotion:   { max: 3,    step: 1,    cost: 3, name: "初始药水" },
  adRewardBonus: { max: 0.50, step: 0.05, cost: 2, name: "广告收益" }
};