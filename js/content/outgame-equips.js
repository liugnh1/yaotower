// ===================== v0.81 局外装备数据 =====================
// 品质决定数值范围，效果映射到游戏真实机制
import { R } from '../core/registry.js';

// 品质对应的主属性范围
var Q = {
  worn:      { atk:[1,6],   def:[1,4],   hp:[5,20],  crit:[1,2],  dodge:[1,3] },
  common:    { atk:[3,10],  def:[2,6],   hp:[10,30], crit:[2,4],  dodge:[2,4] },
  fine:      { atk:[5,14],  def:[3,8],   hp:[15,40], crit:[3,5],  dodge:[2,5] },
  rare:      { atk:[8,20],  def:[4,10],  hp:[20,50], crit:[4,6],  dodge:[3,6] },
  epic:      { atk:[12,26], def:[6,14],  hp:[25,65], crit:[5,7],  dodge:[3,7] },
  legendary: { atk:[16,34], def:[8,20],  hp:[30,85], crit:[6,8],  dodge:[4,8] },
  mythic:    { atk:[20,44], def:[10,26], hp:[35,110],crit:[7,10], dodge:[5,9] },
};

// 通用效果池 — 打造时随机 1-3 个附加效果
var FX = {
  // 攻击向
  bonusAtk:      { desc:'攻击+{v}', min:2, max:12, apply:function(v,p){p.atk+=v;} },
  critRate:      { desc:'暴击率+{v}%', min:2, max:8, apply:function(v,p){p.critRate+=v/100;} },
  critDmg:       { desc:'暴击伤害+{v}%', min:10, max:30, apply:function(v,p){p.critMul=(p.critMul||1.5)+v/100;} },
  pen:           { desc:'穿透+{v}%', min:5, max:25, apply:function(v,p){p.pen=(p.pen||0)+v/100;} },
  skillDmg:      { desc:'技能伤害+{v}%', min:5, max:18, apply:function(v,p){p.skillMul=(p.skillMul||1.5)+v/100;} },
  bossDmg:       { desc:'对Boss伤害+{v}%', min:10, max:35, apply:function(v,p){p._bossDmgBonus=(p._bossDmgBonus||0)+v/100;} },
  // 防御向
  bonusDef:      { desc:'防御+{v}', min:2, max:10, apply:function(v,p){p.def+=v;} },
  bonusHp:       { desc:'生命+{v}', min:15, max:100, apply:function(v,p){p.maxHp+=v;p.hp+=v;} },
  dmgReduce:     { desc:'减伤+{v}%', min:3, max:12, apply:function(v,p){p.dmgReduce=(p.dmgReduce||0)+v/100;} },
  dodge:         { desc:'闪避+{v}%', min:3, max:10, apply:function(v,p){p.dodge=Math.min(0.75,(p.dodge||0)+v/100);} },
  blockChance:   { desc:'格挡+{v}%', min:5, max:20, apply:function(v,p){p._blockChance=(p._blockChance||0)+v/100;} },
  // 恢复向
  lifeSteal:     { desc:'吸血+{v}%', min:4, max:12, apply:function(v,p){p.lifeSteal=(p.lifeSteal||0)+v/100;} },
  regen:         { desc:'每回合回复{v}HP', min:3, max:18, apply:function(v,p){p._regen=(p._regen||0)+v;} },
  killHeal:      { desc:'击杀回复{v}%HP', min:5, max:15, apply:function(v,p){p._killHeal=(p._killHeal||0)+v/100;} },
  // 特殊向
  allStats:      { desc:'全属性+{v}%', min:2, max:6, apply:function(v,p){var m=1+v/100;p.atk=Math.floor(p.atk*m);p.def=Math.floor(p.def*m);p.maxHp=Math.floor(p.maxHp*m);p.hp=Math.floor(p.hp*m);} },
  extraGold:     { desc:'金币获取+{v}%', min:10, max:30 },
  stunChance:    { desc:'攻击{v}%概率眩晕', min:3, max:8, apply:function(v,p){p._stunChance=(p._stunChance||0)+v/100;} },
  reflect:       { desc:'受击反弹{v}%', min:10, max:30, apply:function(v,p){p._reflect=(p._reflect||0)+v/100;} },
};

// 每件装备的 1-3 个随机效果从对应的主题池抽取
function pickFx(poolKeys, count) {
  var pool = [];
  poolKeys.forEach(function(k){ if (FX[k]) pool.push(k); });
  // 随机选 count 个
  var picked = [];
  var copy = pool.slice();
  for (var i = 0; i < count && copy.length > 0; i++) {
    var idx = Math.floor(Math.random() * copy.length);
    picked.push(copy.splice(idx, 1)[0]);
  }
  return picked;
}

// 生成随机效果值
function rollFx(key) {
  var fx = FX[key];
  if (!fx) return { desc:'', val:0 };
  var v = fx.min + Math.floor(Math.random() * (fx.max - fx.min + 1));
  return { desc: fx.desc.replace('{v}', v), val: v, key: key, apply: fx.apply };
}

// ========== 装备模板：名称 + 品级 + 效果池 ==========
var EQUIPS = {
  // ===== 武器 (weapon, stat:atk) =====
  weapon: [
    // 传奇
    { id:'og_w_01', name:'裁决之杖', quality:'epic', icon:'⚖️', fx:['critRate','bonusAtk','stunChance'] },
    { id:'og_w_02', name:'屠龙', quality:'legendary', icon:'🐉', fx:['bossDmg','bonusAtk','critDmg'] },
    { id:'og_w_03', name:'血饮', quality:'epic', icon:'🍷', fx:['lifeSteal','bonusAtk','pen'] },
    { id:'og_w_04', name:'无极棍', quality:'fine', icon:'🏏', fx:['bonusAtk','bonusDef'] },
    { id:'og_w_05', name:'井中月', quality:'rare', icon:'🌙', fx:['critRate','bonusAtk'] },
    { id:'og_w_06', name:'怒斩', quality:'legendary', icon:'⚡', fx:['critDmg','bonusAtk','bossDmg'] },
    { id:'og_w_07', name:'龙牙', quality:'rare', icon:'🦷', fx:['pen','bonusAtk'] },
    { id:'og_w_08', name:'骨玉权杖', quality:'epic', icon:'🦴', fx:['skillDmg','bonusAtk','regen'] },
    { id:'og_w_09', name:'命运之刃', quality:'legendary', icon:'🗡️', fx:['critRate','critDmg','allStats'] },
    // DNF
    { id:'og_w_11', name:'极光剑', quality:'epic', icon:'💡', fx:['bonusAtk','critRate','stunChance'] },
    { id:'og_w_12', name:'黑光剑', quality:'rare', icon:'🌑', fx:['pen','bonusAtk'] },
    { id:'og_w_13', name:'无影剑', quality:'legendary', icon:'👻', fx:['pen','critDmg','bonusAtk'] },
    { id:'og_w_14', name:'泰拉石武器', quality:'epic', icon:'💎', fx:['allStats','bonusAtk'] },
    { id:'og_w_15', name:'荒古遗尘武器', quality:'legendary', icon:'🏛️', fx:['skillDmg','bonusAtk','bossDmg'] },
    { id:'og_w_16', name:'圣耀救赎武器', quality:'mythic', icon:'🌟', fx:['critRate','pen','bonusAtk','allStats'] },
    // 魔兽
    { id:'og_w_17', name:'霜之哀伤', quality:'legendary', icon:'❄️', fx:['bonusAtk','critDmg','lifeSteal'] },
    { id:'og_w_18', name:'灰烬使者', quality:'legendary', icon:'🔥', fx:['bonusAtk','bossDmg','critDmg'] },
    { id:'og_w_19', name:'蛋刀', quality:'legendary', icon:'🗡️', fx:['critDmg','bonusAtk','pen'] },
    { id:'og_w_20', name:'风剑', quality:'legendary', icon:'🌪️', fx:['bonusAtk','stunChance','dodge'] },
    { id:'og_w_21', name:'影之哀伤', quality:'mythic', icon:'💀', fx:['allStats','lifeSteal','bonusAtk','critDmg'] },
    // 泰拉瑞亚
    { id:'og_w_22', name:'天顶剑', quality:'mythic', icon:'🌌', fx:['allStats','bonusAtk','critRate','pen'] },
    { id:'og_w_23', name:'泰拉刃', quality:'legendary', icon:'⚔️', fx:['bonusAtk','critRate'] },
    { id:'og_w_24', name:'星怒', quality:'epic', icon:'⭐', fx:['critRate','bonusAtk','stunChance'] },
    { id:'og_w_25', name:'暗黑之剑', quality:'legendary', icon:'🌘', fx:['lifeSteal','pen','bonusAtk'] },
    // 新装备
    { id:'og_w_26', name:'破坏剑', quality:'legendary', icon:'🗡️', fx:['bonusHp','pen','critDmg'] },
    { id:'og_w_27', name:'正宗', quality:'legendary', icon:'⚔️', fx:['critRate','critDmg','bonusAtk'] },
    { id:'og_w_28', name:'月光大剑', quality:'legendary', icon:'🌙', fx:['skillDmg','pen','bonusAtk'] },
    { id:'og_w_29', name:'黑骑士剑', quality:'epic', icon:'⚔️', fx:['bossDmg','bonusAtk','pen'] },
    { id:'og_w_30', name:'破晓者', quality:'legendary', icon:'☀️', fx:['bossDmg','bonusAtk','allStats'] },
    { id:'og_w_31', name:'双狼银剑', quality:'epic', icon:'🐺', fx:['bonusAtk','critRate','lifeSteal'] },
    { id:'og_w_32', name:'灭尽龙大剑', quality:'legendary', icon:'🐉', fx:['pen','bonusAtk','bossDmg'] },
    { id:'og_w_33', name:'永恒之矛', quality:'legendary', icon:'🔱', fx:['lifeSteal','bonusAtk','regen'] },
    { id:'og_w_34', name:'大师之剑', quality:'legendary', icon:'🗡️', fx:['bossDmg','bonusAtk','allStats'] },
    { id:'og_w_35', name:'死亡呼吸', quality:'mythic', icon:'💀', fx:['allStats','lifeSteal','bonusAtk','stunChance'] },
    { id:'og_w_36', name:'纯粹之钉', quality:'epic', icon:'📌', fx:['bonusAtk','pen','critRate'] },
    { id:'og_w_37', name:'油剑', quality:'rare', icon:'🛢️', fx:['bonusAtk','critDmg'] },
  ],

  // ===== 护甲 (armor, stat:def) =====
  armor: [
    { id:'og_a_01', name:'天魔神甲', quality:'epic', icon:'🛡️', fx:['bonusHp','bonusDef','dmgReduce'] },
    { id:'og_a_02', name:'圣战宝甲', quality:'rare', icon:'⚜️', fx:['bonusDef','bonusAtk'] },
    { id:'og_a_03', name:'法神披风', quality:'epic', icon:'🧙', fx:['skillDmg','bonusDef','regen'] },
    { id:'og_a_04', name:'天尊道袍', quality:'rare', icon:'👘', fx:['bonusHp','bonusDef'] },
    { id:'og_a_05', name:'战神盔甲', quality:'fine', icon:'⚔️', fx:['bonusAtk','bonusDef'] },
    { id:'og_a_06', name:'灵魂战甲', quality:'epic', icon:'💜', fx:['lifeSteal','bonusDef','bonusHp'] },
    { id:'og_a_07', name:'板甲·钢鳞', quality:'rare', icon:'🐟', fx:['bonusHp','dmgReduce'] },
    { id:'og_a_08', name:'皮甲·暗影', quality:'epic', icon:'🌑', fx:['dodge','bonusDef'] },
    { id:'og_a_09', name:'布甲·元素', quality:'rare', icon:'🔥', fx:['skillDmg','bonusDef'] },
    { id:'og_a_10', name:'泰拉石护甲', quality:'epic', icon:'💎', fx:['allStats','bonusDef'] },
    { id:'og_a_11', name:'无尽怒火胸甲', quality:'legendary', icon:'💢', fx:['bonusHp','bonusAtk','dmgReduce'] },
    { id:'og_a_12', name:'死亡骑士板甲', quality:'epic', icon:'💀', fx:['bonusDef','lifeSteal','bonusHp'] },
    { id:'og_a_13', name:'龙鳞胸甲', quality:'legendary', icon:'🐉', fx:['bonusHp','dmgReduce','bonusDef'] },
    { id:'og_a_14', name:'甲壳铠甲', quality:'rare', icon:'🐛', fx:['bonusHp','bonusDef'] },
    { id:'og_a_15', name:'大树守卫铠甲', quality:'legendary', icon:'🌳', fx:['bonusHp','dmgReduce','regen'] },
    // 新装备
    { id:'og_a_16', name:'谜团', quality:'mythic', icon:'🌌', fx:['bonusHp','dodge','allStats'] },
    { id:'og_a_17', name:'魔族板甲', quality:'epic', icon:'👹', fx:['bonusDef','reflect','dmgReduce'] },
    { id:'og_a_18', name:'灭尽龙铠甲', quality:'epic', icon:'🐉', fx:['bonusHp','regen','bonusDef'] },
    { id:'og_a_19', name:'黑骑士铠甲', quality:'rare', icon:'⚫', fx:['bonusDef','dmgReduce'] },
    { id:'og_a_20', name:'毒蛇学派铠甲', quality:'rare', icon:'🐍', fx:['bonusDef','lifeSteal'] },
    { id:'og_a_21', name:'猎龙铠甲', quality:'legendary', icon:'⚡', fx:['bonusDef','dmgReduce','reflect'] },
    { id:'og_a_22', name:'冥府战甲', quality:'epic', icon:'💀', fx:['bonusDef','bonusHp','regen'] },
  ],

  // ===== 头盔 (helm, stat:maxHp) =====
  helm: [
    { id:'og_h_01', name:'黑铁头盔', quality:'rare', icon:'🪖', fx:['bonusDef','bonusHp'] },
    { id:'og_h_02', name:'圣战头盔', quality:'epic', icon:'⛑️', fx:['bonusDef','bonusAtk','bonusHp'] },
    { id:'og_h_03', name:'法神头盔', quality:'epic', icon:'🧠', fx:['bonusDef','critRate','bonusHp'] },
    { id:'og_h_04', name:'骷髅头盔', quality:'fine', icon:'💀', fx:['bonusDef'] },
    { id:'og_h_05', name:'泰拉石头盔', quality:'epic', icon:'💎', fx:['bonusDef','allStats','bonusHp'] },
    { id:'og_h_06', name:'龙之头盔', quality:'legendary', icon:'🐉', fx:['bonusDef','dmgReduce','bonusHp'] },
    { id:'og_h_07', name:'无尽怒火面甲', quality:'legendary', icon:'💢', fx:['bonusAtk','critRate','bonusHp'] },
    { id:'og_h_08', name:'巫妖王头盔', quality:'epic', icon:'👑', fx:['bonusDef','lifeSteal','bonusHp'] },
    { id:'og_h_10', name:'远古头盔', quality:'epic', icon:'🏺', fx:['bonusDef','bonusHp'] },
    { id:'og_h_11', name:'卡利亚骑士头盔', quality:'legendary', icon:'⚔️', fx:['bonusDef','bonusHp','dmgReduce'] },
    { id:'og_h_12', name:'熔炉骑士头盔', quality:'epic', icon:'🔥', fx:['bonusDef','dmgReduce','bonusHp'] },
  ],

  // ===== 戒指 (ring, stat:atk/critRate) =====
  ring: [
    { id:'og_r_01', name:'麻痹戒指', quality:'legendary', icon:'💍', fx:['stunChance','critRate','bonusAtk'] },
    { id:'og_r_02', name:'复活戒指', quality:'legendary', icon:'💍', fx:['bonusHp','regen','dmgReduce'] },
    { id:'og_r_03', name:'护身戒指', quality:'epic', icon:'💍', fx:['blockChance','bonusHp','bonusDef'] },
    { id:'og_r_04', name:'传送戒指', quality:'rare', icon:'💍', fx:['dodge','bonusAtk'] },
    { id:'og_r_05', name:'虹魔戒指', quality:'epic', icon:'💍', fx:['lifeSteal','bonusAtk'] },
    { id:'og_r_06', name:'魔血戒指', quality:'rare', icon:'💍', fx:['bonusHp','killHeal'] },
    { id:'og_r_07', name:'骨戒', quality:'legendary', icon:'💍', fx:['critDmg','critRate','pen'] },
    { id:'og_r_08', name:'漩涡戒指', quality:'epic', icon:'💍', fx:['reflect','bonusDef'] },
    { id:'og_r_09', name:'无尽痛苦之戒', quality:'epic', icon:'💍', fx:['critDmg','lifeSteal'] },
    { id:'og_r_10', name:'泰坦戒指', quality:'legendary', icon:'💍', fx:['bonusHp','bonusDef','bonusAtk'] },
    { id:'og_r_11', name:'星辰戒指', quality:'rare', icon:'💍', fx:['bonusHp','regen'] },
    { id:'og_r_12', name:'黄金树恩惠', quality:'legendary', icon:'💍', fx:['allStats','regen','bonusHp'] },
    // 新装备
    { id:'og_r_13', name:'乔丹之石', quality:'legendary', icon:'💍', fx:['allStats','skillDmg','bonusAtk'] },
    { id:'og_r_14', name:'克劳德的耳环', quality:'epic', icon:'💍', fx:['critRate','critDmg','killHeal'] },
    { id:'og_r_15', name:'绿色的护符', quality:'epic', icon:'💍', fx:['bonusHp','regen','dmgReduce'] },
    { id:'og_r_16', name:'黑暗之眼', quality:'epic', icon:'💍', fx:['bonusHp','dmgReduce','bonusAtk'] },
    { id:'og_r_17', name:'欧西里斯之链', quality:'legendary', icon:'💍', fx:['lifeSteal','bonusHp','killHeal'] },
    { id:'og_r_18', name:'雅各布斯的羽毛', quality:'rare', icon:'💍', fx:['dodge','critDmg'] },
    { id:'og_r_19', name:'昆特牌·英雄卡', quality:'fine', icon:'💍', fx:['extraGold','bonusAtk'] },
  ],

  // ===== 护符 (amulet, stat:dodge/atk) =====
  amulet: [
    { id:'og_am_01', name:'幸运项链', quality:'epic', icon:'📿', fx:['critRate','extraGold'] },
    { id:'og_am_02', name:'白色虎齿项链', quality:'rare', icon:'📿', fx:['dodge','bonusAtk'] },
    { id:'og_am_03', name:'灵魂项链', quality:'epic', icon:'📿', fx:['killHeal','bonusHp'] },
    { id:'og_am_04', name:'火焰项链', quality:'rare', icon:'📿', fx:['bonusAtk','critDmg'] },
    { id:'og_am_05', name:'冰霜项链', quality:'rare', icon:'📿', fx:['bonusAtk','dmgReduce'] },
    { id:'og_am_06', name:'暗影项链', quality:'epic', icon:'📿', fx:['pen','bonusAtk','lifeSteal'] },
    { id:'og_am_07', name:'无尽怒气护符', quality:'legendary', icon:'📿', fx:['bonusAtk','critDmg','bossDmg'] },
    { id:'og_am_08', name:'生命护符', quality:'rare', icon:'📿', fx:['bonusHp','regen'] },
    { id:'og_am_09', name:'魔力护符', quality:'epic', icon:'📿', fx:['skillDmg','regen'] },
    { id:'og_am_10', name:'拉达冈的肖像', quality:'legendary', icon:'📿', fx:['allStats','skillDmg'] },
    // 新装备
    { id:'og_am_11', name:'海利亚盾', quality:'legendary', icon:'🛡️', fx:['bonusDef','bonusHp','dmgReduce'] },
    { id:'og_am_12', name:'猎魔人徽章', quality:'epic', icon:'🏅', fx:['critRate','bossDmg','bonusAtk'] },
    { id:'og_am_13', name:'灵魂容器', quality:'rare', icon:'💎', fx:['bonusHp','regen'] },
    { id:'og_am_14', name:'龙鳞护符', quality:'legendary', icon:'🐉', fx:['bonusDef','dmgReduce','bonusHp'] },
    { id:'og_am_15', name:'梅琳娜的戒指', quality:'epic', icon:'💍', fx:['bonusHp','dodge','regen'] },
    { id:'og_am_16', name:'贤者之石(伪)', quality:'legendary', icon:'🪨', fx:['allStats','extraGold','regen'] },
  ],

  // ===== 腰带 (belt, stat:maxHp) =====
  belt: [
    { id:'og_b_01', name:'圣战腰带', quality:'epic', icon:'🎗️', fx:['bonusDef','bonusHp'] },
    { id:'og_b_02', name:'法神腰带', quality:'epic', icon:'🎗️', fx:['skillDmg','bonusHp'] },
    { id:'og_b_03', name:'星云腰带', quality:'rare', icon:'🎗️', fx:['dodge','bonusHp'] },
    { id:'og_b_04', name:'无尽痛苦束带', quality:'legendary', icon:'🎗️', fx:['bonusAtk','lifeSteal','bonusHp'] },
    { id:'og_b_05', name:'勇士腰带', quality:'fine', icon:'🎗️', fx:['bonusDef'] },
    { id:'og_b_06', name:'星辰腰带', quality:'epic', icon:'🎗️', fx:['bonusAtk','bonusHp'] },
    { id:'og_b_07', name:'熔炉骑士腰带', quality:'rare', icon:'🎗️', fx:['bonusDef','bonusHp'] },
    { id:'og_b_08', name:'黄金树腰带', quality:'legendary', icon:'🎗️', fx:['allStats','bonusHp'] },
  ],

  // ===== 勋章 (medal, stat:atk) =====
  medal: [
    { id:'og_m_01', name:'荣誉勋章', quality:'epic', icon:'🏅', fx:['critRate','bonusAtk'] },
    { id:'og_m_02', name:'战神勋章', quality:'legendary', icon:'🏅', fx:['critDmg','bonusAtk'] },
    { id:'og_m_03', name:'泰拉石勋章', quality:'epic', icon:'🏅', fx:['allStats','bonusAtk'] },
    { id:'og_m_04', name:'联盟勋章', quality:'legendary', icon:'🏅', fx:['bonusHp','bonusDef','bonusAtk'] },
    { id:'og_m_05', name:'部落勋章', quality:'legendary', icon:'🏅', fx:['bonusAtk','bonusHp'] },
    { id:'og_m_06', name:'黄金树勋章', quality:'legendary', icon:'🏅', fx:['allStats','bonusAtk'] },
  ],

  // ===== 手镯 (bracelet, stat:atk) =====
  bracelet: [
    { id:'og_br_01', name:'虹魔手镯', quality:'epic', icon:'⛓️', fx:['lifeSteal','bonusAtk'] },
    { id:'og_br_02', name:'魔血手镯', quality:'rare', icon:'⛓️', fx:['bonusHp','regen'] },
    { id:'og_br_03', name:'暗影手镯', quality:'epic', icon:'⛓️', fx:['pen','bonusAtk'] },
    { id:'og_br_04', name:'火焰手镯', quality:'rare', icon:'⛓️', fx:['critDmg','bonusAtk'] },
    { id:'og_br_05', name:'无尽怒火手镯', quality:'legendary', icon:'⛓️', fx:['critRate','bonusAtk'] },
    { id:'og_br_06', name:'龙鳞手镯', quality:'legendary', icon:'⛓️', fx:['bonusDef','dmgReduce','bonusAtk'] },
    { id:'og_br_07', name:'星辰手镯', quality:'epic', icon:'⛓️', fx:['bonusHp','bonusAtk'] },
    { id:'og_br_08', name:'黄金树手镯', quality:'legendary', icon:'⛓️', fx:['allStats','bonusAtk'] },
  ]
};

// 注册到 Registry
R.registerAll('outgameEquips', EQUIPS);

// 导出工具函数
export { Q, FX, pickFx, rollFx, EQUIPS };
