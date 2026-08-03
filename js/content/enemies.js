// 怪物定义（按主题分组 —— 每Zone独立池）
import { R } from '../core/registry.js';

R.registerAll('enemies', {
  // ===== 迷雾平原 =====
  plains: [
    { name: "野兔精",  hp: 25, atk: 6,  def: 0, exp: "不堪一击", icon: "🐰" },
    { name: "山魈",    hp: 40, atk: 8,  def: 1, exp: "略有身手", icon: "👹" },
    { name: "野狼",    hp: 55, atk: 10, def: 1, exp: "凶性毕露", icon: "🐺" },
    { name: "钢盾卫士",hp: 35, atk: 9,  def: 4, exp: "举盾防御60%减伤，被技能击中后破盾3回合", icon: "🛡️", aiCharge: true, _shield: true },
    { name: "石魔像",  hp: 65, atk: 7,  def: 4, exp: "坚如磐石", icon: "🗿" },
    { name: "流浪剑客",hp: 50, atk: 14, def: 1, exp: "剑术精湛", icon: "⚔️" },
    { name: "毒寡妇",  hp: 38, atk: 11, def: 0, exp: "剧毒蛰刺", icon: "🕷️" }
  ],
  // ===== 幽暗森林 =====
  forest: [
    { name: "毒蜂",    hp: 35, atk: 12, def: 0, exp: "成群结队", icon: "🐝" },
    { name: "树妖",    hp: 70, atk: 10, def: 3, exp: "根深蒂固", icon: "🌳" },
    { name: "幽灵狼",  hp: 60, atk: 14, def: 1, exp: "来去无踪", icon: "👻" },
    { name: "食人花",  hp: 55, atk: 16, def: 1, exp: "血盆大口", icon: "🌸" },
    { name: "暗夜精灵",hp: 48, atk: 13, def: 2, exp: "魅影重重", icon: "🧝" },
    { name: "藤蟒",    hp: 80, atk: 11, def: 2, exp: "绞杀缠绕", icon: "🐍" }
  ],
  // ===== 废弃矿洞 =====
  cave: [
    { name: "矿洞鼠",  hp: 30, atk: 8,  def: 2, exp: "成群出没", icon: "🐀" },
    { name: "岩石怪",  hp: 90, atk: 9,  def: 6, exp: "坚如磐石", icon: "🪨" },
    { name: "蝙蝠群",  hp: 50, atk: 13, def: 0, exp: "遮天蔽日", icon: "🦇" },
    { name: "晶簇怪",  hp: 60, atk: 14, def: 3, exp: "晶刺飞射", icon: "💎" },
    { name: "矿洞僵尸",hp: 75, atk: 12, def: 1, exp: "不死矿工", icon: "🧟" },
    { name: "熔岩蜥蜴",hp: 55, atk: 17, def: 2, exp: "灼热吐息", icon: "🦎" }
  ],
  // ===== 远古废墟 =====
  ruins: [
    { name: "石像守卫",hp: 85, atk: 11, def: 5, exp: "千年不动", icon: "🗿" },
    { name: "远古亡魂",hp: 55, atk: 16, def: 0, exp: "怨念不散", icon: "👻" },
    { name: "诅咒铠甲",hp: 70, atk: 13, def: 4, exp: "内里空空", icon: "🛡️" },
    { name: "遗迹蜘蛛",hp: 50, atk: 15, def: 1, exp: "丝网缠身", icon: "🕸️" },
    { name: "失落祭司",hp: 60, atk: 18, def: 2, exp: "古老咒术", icon: "🧙" },
    { name: "活化雕像",hp: 100,atk: 10, def: 3, exp: "不灭守护", icon: "🗽" }
  ],
  // ===== 冰封小径 =====
  frozen: [
    { name: "冰霜巨狼",hp: 65, atk: 15, def: 2, exp: "寒冰獠牙", icon: "🐺" },
    { name: "雪妖",    hp: 55, atk: 17, def: 1, exp: "摄魂冰吻", icon: "👻" },
    { name: "冰晶元素",hp: 80, atk: 10, def: 4, exp: "冻结万物", icon: "❄️" },
    { name: "冻土巨魔",hp: 110,atk: 12, def: 5, exp: "冰甲护体", icon: "👹" },
    { name: "极地幽魂",hp: 50, atk: 19, def: 0, exp: "刺骨寒意", icon: "💨" },
    { name: "霜翼鸟",  hp: 45, atk: 14, def: 1, exp: "俯冲冰锥", icon: "🦅" }
  ],
  // ===== 虚空裂隙 =====
  voidgate: [
    { name: "虚空行者",hp: 70, atk: 16, def: 1, exp: "裂隙穿梭", icon: "🌀" },
    { name: "裂痕魔",  hp: 90, atk: 18, def: 3, exp: "撕裂现实", icon: "👿" },
    { name: "混沌之眼",hp: 55, atk: 20, def: 0, exp: "凝视深渊", icon: "👁️" },
    { name: "相位蜘蛛",hp: 60, atk: 14, def: 2, exp: "闪现突袭", icon: "🕷️" },
    { name: "虚无之影",hp: 45, atk: 22, def: 0, exp: "无形无相", icon: "🌑" },
    { name: "熵魔",    hp: 85, atk: 15, def: 3, exp: "万物归熵", icon: "💀" }
  ],
  // ===== 魔塔门前 =====
  tower: [
    { name: "塔卫兵",  hp: 90, atk: 16, def: 4, exp: "魔塔卫士", icon: "⚔️" },
    { name: "魔塔石像",hp: 120,atk: 12, def: 6, exp: "不灭守卫", icon: "🗿" },
    { name: "暗影骑士",hp: 80, atk: 20, def: 3, exp: "堕落剑术", icon: "🐴" },
    { name: "塔灵",    hp: 65, atk: 22, def: 1, exp: "魔法具现", icon: "🔮" },
    { name: "深渊法师",hp: 70, atk: 19, def: 2, exp: "禁忌咒文", icon: "🧙" },
    { name: "魔塔守卫",hp: 105,atk: 17, def: 5, exp: "终极防线", icon: "🛡️" }
  ],

  // ===== 荒芜沙漠（Tier 1 · 新增）=====
  desert: [
    { name: "沙蝎",    hp: 45, atk: 14, def: 2, exp: "剧毒尾刺", icon: "🦂" },
    { name: "沙漠强盗",hp: 55, atk: 16, def: 1, exp: "劫掠成性", icon: "🏜️" },
    { name: "石甲龟",  hp: 80, atk: 10, def: 6, exp: "坚不可摧", icon: "🐢" },
    { name: "狂沙元素",hp: 60, atk: 15, def: 3, exp: "沙暴之怒", icon: "🌪️" },
    { name: "烈日祭司",hp: 50, atk: 18, def: 2, exp: "太阳之火", icon: "☀️" },
    { name: "沙虫",    hp: 70, atk: 20, def: 0, exp: "地底突袭", icon: "🐛" }
  ],

  // ===== 幽暗沼泽（Tier 1 · 新增）=====
  swamp: [
    { name: "沼泽巨鳄",hp: 75, atk: 13, def: 3, exp: "死亡翻滚", icon: "🐊" },
    { name: "毒雾花",  hp: 40, atk: 12, def: 1, exp: "每回合为全体敌人回复15%生命（优先击杀！）", icon: "🌺", _healAllies: 0.15 },
    { name: "泥沼怪",  hp: 65, atk: 11, def: 4, exp: "深陷泥潭", icon: "🫧" },
    { name: "暗夜猎手",hp: 55, atk: 18, def: 1, exp: "暗影突袭", icon: "🦇" },
    { name: "腐化树精",hp: 90, atk: 14, def: 5, exp: "万藤缠绕", icon: "🌳" },
    { name: "沼泽巫婆",hp: 50, atk: 17, def: 2, exp: "诅咒之咒", icon: "🧙‍♀️" }
  ],

  // ===== 魔塔下层（Tier 4 · 塔内·普通）=====
  tower_lower: [
    { name: "塔卫骑士",hp: 110,atk: 22, def: 5, exp: "魔塔卫士", icon: "⚔️" },
    { name: "魔导师徒",hp: 80, atk: 24, def: 3, exp: "双人合击", icon: "👥" },
    { name: "封印石像",hp: 140,atk: 14, def: 8, exp: "远古封印", icon: "🗿" },
    { name: "暗影刺客",hp: 70, atk: 28, def: 1, exp: "一击必杀", icon: "🗡️" },
    { name: "魔力漩涡",hp: 90, atk: 20, def: 2, exp: "吞噬能量", icon: "🌀" },
    { name: "下层典狱官",hp:130,atk: 18, def: 6, exp: "牢不可破", icon: "🔗" }
  ],

  // ===== 魔塔上层（Tier 5 · 塔内·炼狱）=====
  tower_upper: [
    { name: "魔王亲卫",hp: 150,atk: 26, def: 6, exp: "魔王禁军", icon: "👿" },
    { name: "深渊祭司",hp: 100,atk: 28, def: 4, exp: "深渊咒术", icon: "🕯️" },
    { name: "混沌魔像",hp: 180,atk: 18, def: 10,exp: "混沌之力", icon: "🗽" },
    { name: "血族公爵",hp: 120,atk: 30, def: 5, exp: "血之盛宴", icon: "🧛" },
    { name: "虚空行者·精英",hp: 90, atk: 32, def: 2, exp: "虚空穿梭", icon: "🌌" },
    { name: "上层守护者",hp:200,atk: 22, def: 8, exp: "终极防线", icon: "🛡️" }
  ],

  // v0.81: 无尽高层怪物池
  endless: [
    { name: "深渊潜行者", icon: "👤", hp: 180, atk: 30, def: 8, gold: 15, exp: 20,
      skill: { name: "暗影步", desc: "每3回合隐身", fn: function(e, p) { e._buffs.push({ id:'stealth', name:'隐身', turns:1, onTick:function(){return'immune';} }); return { dmg: 0, msg: '👤 深渊潜行者消失了！' }; }, ai: function(e, s) { return s.turnInFloor % 3 === 0 ? 'skill' : 'atk'; } } },
    { name: "虚空撕裂者", icon: "🌀", hp: 250, atk: 35, def: 12, gold: 18, exp: 25,
      skill: { name: "虚空撕裂", desc: "攻击+30%吸血", fn: function(e, p) { var dmg = Math.max(1, Math.floor(e.atk * 1.2) - p.def); p.hp -= dmg; e.hp = Math.min(e.maxHp, e.hp + Math.floor(dmg * 0.3)); return { dmg: dmg, msg: '🌀 虚空撕裂！' }; }, ai: function(e, s) { return s.turnInFloor % 3 === 0 ? 'skill' : 'atk'; } } },
    { name: "混沌魔像", icon: "🗿", hp: 350, atk: 28, def: 20, gold: 22, exp: 30,
      tags: ["tough","immune_crit"] },
    { name: "终焉使者", icon: "👻", hp: 400, atk: 42, def: 10, gold: 25, exp: 35,
      skill: { name: "终焉宣告", desc: "每回合ATK+3(叠加)", fn: function(e, p) { e.atk += 3; var dmg = Math.max(1, e.atk - p.def); p.hp -= dmg; return { dmg: dmg, msg: '👻 终焉宣告！ATK永久+3' }; }, ai: function(e, s) { return s.turnInFloor % 4 === 0 ? 'skill' : 'atk'; } } },
    { name: "万古之影", icon: "🌑", hp: 500, atk: 50, def: 15, gold: 30, exp: 40,
      skill: { name: "分裂", desc: "死亡后分裂为2个半血", fn: function(e, p) { var dmg = Math.max(1, e.atk - p.def); p.hp -= dmg; return { dmg: dmg }; }, ai: function(e, s) { return 'atk'; } }, onKill: function(s) { var halfHp = Math.floor(500 / 2); for (var i = 0; i < 2; i++) { s.enemies.push({ name: '万古之影碎片', icon: '🌑', hp: halfHp, maxHp: halfHp, atk: 30, def: 8, tags: [], _buffs: [], aiTurn: 0 }); } } }
  ]
});
