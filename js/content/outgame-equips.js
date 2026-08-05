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

// 通用效果池 — 打造时概率获得 1 个附加效果（v0.81 精简版）
var FX = {
  bonusAtk:      { desc:'攻击+{v}', min:2, max:8, apply:function(v,p){p.atk+=v;} },
  bonusDef:      { desc:'防御+{v}', min:2, max:8, apply:function(v,p){p.def+=v;} },
  bonusHp:       { desc:'生命+{v}', min:10, max:30, apply:function(v,p){p.maxHp+=v;p.hp+=v;} },
  critRate:      { desc:'暴击率+{v}%', min:1, max:3, apply:function(v,p){p.critRate+=v/100;} },
  critDmg:       { desc:'暴击伤害+{v}%', min:1, max:5, apply:function(v,p){p.critMul=(p.critMul||1.5)+v/100;} },
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
    { id:'og_w_01', name:'裁决之杖', quality:'epic', icon:'⚖️', fx:['critRate','bonusAtk'] },
    { id:'og_w_02', name:'屠龙', quality:'legendary', icon:'🐉', fx:['bonusAtk','critDmg'] },
    { id:'og_w_03', name:'血饮', quality:'epic', icon:'🍷', fx:['bonusAtk'] },
    { id:'og_w_04', name:'无极棍', quality:'fine', icon:'🏏', fx:['bonusAtk','bonusDef'] },
    { id:'og_w_05', name:'井中月', quality:'rare', icon:'🌙', fx:['critRate','bonusAtk'] },
    { id:'og_w_06', name:'怒斩', quality:'legendary', icon:'⚡', fx:['critDmg','bonusAtk'] },
    { id:'og_w_07', name:'龙牙', quality:'rare', icon:'🦷', fx:['bonusAtk'] },
    { id:'og_w_08', name:'骨玉权杖', quality:'epic', icon:'🦴', fx:['bonusAtk'] },
    { id:'og_w_09', name:'命运之刃', quality:'legendary', icon:'🗡️', fx:['critRate','critDmg'] },
    // DNF
    { id:'og_w_11', name:'极光剑', quality:'epic', icon:'💡', fx:['bonusAtk','critRate'] },
    { id:'og_w_12', name:'黑光剑', quality:'rare', icon:'🌑', fx:['bonusAtk'] },
    { id:'og_w_13', name:'无影剑', quality:'legendary', icon:'👻', fx:['critDmg','bonusAtk'] },
    { id:'og_w_14', name:'泰拉石武器', quality:'epic', icon:'💎', fx:['bonusAtk'] },
    { id:'og_w_15', name:'荒古遗尘武器', quality:'legendary', icon:'🏛️', fx:['bonusAtk'] },
    { id:'og_w_16', name:'圣耀救赎武器', quality:'mythic', icon:'🌟', fx:['critRate','bonusAtk'] },
    // 魔兽
    { id:'og_w_17', name:'霜之哀伤', quality:'legendary', icon:'❄️', fx:['bonusAtk','critDmg'] },
    { id:'og_w_18', name:'灰烬使者', quality:'legendary', icon:'🔥', fx:['bonusAtk','critDmg'] },
    { id:'og_w_19', name:'蛋刀', quality:'legendary', icon:'🗡️', fx:['critDmg','bonusAtk'] },
    { id:'og_w_20', name:'风剑', quality:'legendary', icon:'🌪️', fx:['bonusAtk'] },
    { id:'og_w_21', name:'影之哀伤', quality:'mythic', icon:'💀', fx:['bonusAtk','critDmg'] },
    // 泰拉瑞亚
    { id:'og_w_22', name:'天顶剑', quality:'mythic', icon:'🌌', fx:['bonusAtk','critRate'] },
    { id:'og_w_23', name:'泰拉刃', quality:'legendary', icon:'⚔️', fx:['bonusAtk','critRate'] },
    { id:'og_w_24', name:'星怒', quality:'epic', icon:'⭐', fx:['critRate','bonusAtk'] },
    { id:'og_w_25', name:'暗黑之剑', quality:'legendary', icon:'🌘', fx:['bonusAtk'] },
    // 新装备
    { id:'og_w_26', name:'破坏剑', quality:'legendary', icon:'🗡️', fx:['bonusHp','critDmg'] },
    { id:'og_w_27', name:'正宗', quality:'legendary', icon:'⚔️', fx:['critRate','critDmg','bonusAtk'] },
    { id:'og_w_28', name:'月光大剑', quality:'legendary', icon:'🌙', fx:['bonusAtk'] },
    { id:'og_w_29', name:'黑骑士剑', quality:'epic', icon:'⚔️', fx:['bonusAtk'] },
    { id:'og_w_30', name:'破晓者', quality:'legendary', icon:'☀️', fx:['bonusAtk'] },
    { id:'og_w_31', name:'双狼银剑', quality:'epic', icon:'🐺', fx:['bonusAtk','critRate'] },
    { id:'og_w_32', name:'灭尽龙大剑', quality:'legendary', icon:'🐉', fx:['bonusAtk'] },
    { id:'og_w_33', name:'永恒之矛', quality:'legendary', icon:'🔱', fx:['bonusAtk'] },
    { id:'og_w_34', name:'大师之剑', quality:'legendary', icon:'🗡️', fx:['bonusAtk'] },
    { id:'og_w_35', name:'死亡呼吸', quality:'mythic', icon:'💀', fx:['bonusAtk'] },
    { id:'og_w_36', name:'纯粹之钉', quality:'epic', icon:'📌', fx:['bonusAtk','critRate'] },
    { id:'og_w_37', name:'油剑', quality:'rare', icon:'🛢️', fx:['bonusAtk','critDmg'] },
  ],

  // ===== 护甲 (armor, stat:def) =====
  armor: [
    { id:'og_a_01', name:'天魔神甲', quality:'epic', icon:'🛡️', fx:['bonusHp','bonusDef'] },
    { id:'og_a_02', name:'圣战宝甲', quality:'rare', icon:'⚜️', fx:['bonusDef','bonusAtk'] },
    { id:'og_a_03', name:'法神披风', quality:'epic', icon:'🧙', fx:['bonusDef'] },
    { id:'og_a_04', name:'天尊道袍', quality:'rare', icon:'👘', fx:['bonusHp','bonusDef'] },
    { id:'og_a_05', name:'战神盔甲', quality:'fine', icon:'⚔️', fx:['bonusAtk','bonusDef'] },
    { id:'og_a_06', name:'灵魂战甲', quality:'epic', icon:'💜', fx:['bonusDef','bonusHp'] },
    { id:'og_a_07', name:'板甲·钢鳞', quality:'rare', icon:'🐟', fx:['bonusHp'] },
    { id:'og_a_08', name:'皮甲·暗影', quality:'epic', icon:'🌑', fx:['bonusDef'] },
    { id:'og_a_09', name:'布甲·元素', quality:'rare', icon:'🔥', fx:['bonusDef'] },
    { id:'og_a_10', name:'泰拉石护甲', quality:'epic', icon:'💎', fx:['bonusDef'] },
    { id:'og_a_11', name:'无尽怒火胸甲', quality:'legendary', icon:'💢', fx:['bonusHp','bonusAtk'] },
    { id:'og_a_12', name:'死亡骑士板甲', quality:'epic', icon:'💀', fx:['bonusDef','bonusHp'] },
    { id:'og_a_13', name:'龙鳞胸甲', quality:'legendary', icon:'🐉', fx:['bonusHp','bonusDef'] },
    { id:'og_a_14', name:'甲壳铠甲', quality:'rare', icon:'🐛', fx:['bonusHp','bonusDef'] },
    { id:'og_a_15', name:'大树守卫铠甲', quality:'legendary', icon:'🌳', fx:['bonusHp'] },
    // 新装备
    { id:'og_a_16', name:'谜团', quality:'mythic', icon:'🌌', fx:['bonusHp'] },
    { id:'og_a_17', name:'魔族板甲', quality:'epic', icon:'👹', fx:['bonusDef'] },
    { id:'og_a_18', name:'灭尽龙铠甲', quality:'epic', icon:'🐉', fx:['bonusHp','bonusDef'] },
    { id:'og_a_19', name:'黑骑士铠甲', quality:'rare', icon:'⚫', fx:['bonusDef'] },
    { id:'og_a_20', name:'毒蛇学派铠甲', quality:'rare', icon:'🐍', fx:['bonusDef'] },
    { id:'og_a_21', name:'猎龙铠甲', quality:'legendary', icon:'⚡', fx:['bonusDef'] },
    { id:'og_a_22', name:'冥府战甲', quality:'epic', icon:'💀', fx:['bonusDef','bonusHp'] },
  ],

  // ===== 头盔 (helm, stat:maxHp) =====
  helm: [
    { id:'og_h_01', name:'黑铁头盔', quality:'rare', icon:'🪖', fx:['bonusDef','bonusHp'] },
    { id:'og_h_02', name:'圣战头盔', quality:'epic', icon:'⛑️', fx:['bonusDef','bonusAtk','bonusHp'] },
    { id:'og_h_03', name:'法神头盔', quality:'epic', icon:'🧠', fx:['bonusDef','critRate','bonusHp'] },
    { id:'og_h_04', name:'骷髅头盔', quality:'fine', icon:'💀', fx:['bonusDef'] },
    { id:'og_h_05', name:'泰拉石头盔', quality:'epic', icon:'💎', fx:['bonusDef','bonusHp'] },
    { id:'og_h_06', name:'龙之头盔', quality:'legendary', icon:'🐉', fx:['bonusDef','bonusHp'] },
    { id:'og_h_07', name:'无尽怒火面甲', quality:'legendary', icon:'💢', fx:['bonusAtk','critRate','bonusHp'] },
    { id:'og_h_08', name:'巫妖王头盔', quality:'epic', icon:'👑', fx:['bonusDef','bonusHp'] },
    { id:'og_h_10', name:'远古头盔', quality:'epic', icon:'🏺', fx:['bonusDef','bonusHp'] },
    { id:'og_h_11', name:'卡利亚骑士头盔', quality:'legendary', icon:'⚔️', fx:['bonusDef','bonusHp'] },
    { id:'og_h_12', name:'熔炉骑士头盔', quality:'epic', icon:'🔥', fx:['bonusDef','bonusHp'] },
  ],

  // ===== 戒指 (ring, stat:atk/critRate) =====
  ring: [
    { id:'og_r_01', name:'麻痹戒指', quality:'legendary', icon:'💍', fx:['critRate','bonusAtk'] },
    { id:'og_r_02', name:'复活戒指', quality:'legendary', icon:'💍', fx:['bonusHp'] },
    { id:'og_r_03', name:'护身戒指', quality:'epic', icon:'💍', fx:['bonusHp','bonusDef'] },
    { id:'og_r_04', name:'传送戒指', quality:'rare', icon:'💍', fx:['bonusAtk'] },
    { id:'og_r_05', name:'虹魔戒指', quality:'epic', icon:'💍', fx:['bonusAtk'] },
    { id:'og_r_06', name:'魔血戒指', quality:'rare', icon:'💍', fx:['bonusHp'] },
    { id:'og_r_07', name:'骨戒', quality:'legendary', icon:'💍', fx:['critDmg','critRate'] },
    { id:'og_r_08', name:'漩涡戒指', quality:'epic', icon:'💍', fx:['bonusDef'] },
    { id:'og_r_09', name:'无尽痛苦之戒', quality:'epic', icon:'💍', fx:['critDmg'] },
    { id:'og_r_10', name:'泰坦戒指', quality:'legendary', icon:'💍', fx:['bonusHp','bonusDef','bonusAtk'] },
    { id:'og_r_11', name:'星辰戒指', quality:'rare', icon:'💍', fx:['bonusHp'] },
    { id:'og_r_12', name:'黄金树恩惠', quality:'legendary', icon:'💍', fx:['bonusHp'] },
    // 新装备
    { id:'og_r_13', name:'乔丹之石', quality:'legendary', icon:'💍', fx:['bonusAtk'] },
    { id:'og_r_14', name:'克劳德的耳环', quality:'epic', icon:'💍', fx:['critRate','critDmg'] },
    { id:'og_r_15', name:'绿色的护符', quality:'epic', icon:'💍', fx:['bonusHp'] },
    { id:'og_r_16', name:'黑暗之眼', quality:'epic', icon:'💍', fx:['bonusHp','bonusAtk'] },
    { id:'og_r_17', name:'欧西里斯之链', quality:'legendary', icon:'💍', fx:['bonusHp'] },
    { id:'og_r_18', name:'雅各布斯的羽毛', quality:'rare', icon:'💍', fx:['critDmg'] },
    { id:'og_r_19', name:'昆特牌·英雄卡', quality:'fine', icon:'💍', fx:['bonusAtk'] },
  ],

  // ===== 护符 (amulet, stat:dodge/atk) =====
  amulet: [
    { id:'og_am_01', name:'幸运项链', quality:'epic', icon:'📿', fx:['critRate'] },
    { id:'og_am_02', name:'白色虎齿项链', quality:'rare', icon:'📿', fx:['bonusAtk'] },
    { id:'og_am_03', name:'灵魂项链', quality:'epic', icon:'📿', fx:['bonusHp'] },
    { id:'og_am_04', name:'火焰项链', quality:'rare', icon:'📿', fx:['bonusAtk','critDmg'] },
    { id:'og_am_05', name:'冰霜项链', quality:'rare', icon:'📿', fx:['bonusAtk'] },
    { id:'og_am_06', name:'暗影项链', quality:'epic', icon:'📿', fx:['bonusAtk'] },
    { id:'og_am_07', name:'无尽怒气护符', quality:'legendary', icon:'📿', fx:['bonusAtk','critDmg'] },
    { id:'og_am_08', name:'生命护符', quality:'rare', icon:'📿', fx:['bonusHp'] },
    { id:'og_am_09', name:'魔力护符', quality:'epic', icon:'📿', fx:['bonusAtk','critRate'] },
    { id:'og_am_10', name:'拉达冈的肖像', quality:'legendary', icon:'📿', fx:['bonusAtk','critRate'] },
    // 新装备
    { id:'og_am_11', name:'海利亚盾', quality:'legendary', icon:'🛡️', fx:['bonusDef','bonusHp'] },
    { id:'og_am_12', name:'猎魔人徽章', quality:'epic', icon:'🏅', fx:['critRate','bonusAtk'] },
    { id:'og_am_13', name:'灵魂容器', quality:'rare', icon:'💎', fx:['bonusHp'] },
    { id:'og_am_14', name:'龙鳞护符', quality:'legendary', icon:'🐉', fx:['bonusDef','bonusHp'] },
    { id:'og_am_15', name:'梅琳娜的戒指', quality:'epic', icon:'💍', fx:['bonusHp'] },
    { id:'og_am_16', name:'贤者之石(伪)', quality:'legendary', icon:'🪨', fx:['bonusAtk','critRate'] },
  ],

    // ===== 腰带 (belt, stat:maxHp) =====
  belt: [
    // --- 原有 ---
    { id:"og_b_01", name:"圣战腰带", quality:"epic", icon:"🎗️", fx:["bonusDef","bonusHp"] },
    { id:"og_b_02", name:"法神腰带", quality:"epic", icon:"🎗️", fx:["bonusHp"] },
    { id:"og_b_03", name:"星云腰带", quality:"rare", icon:"🎗️", fx:["bonusHp"] },
    { id:"og_b_04", name:"无尽痛苦束带", quality:"legendary", icon:"🎗️", fx:["bonusAtk","bonusHp"] },
    { id:"og_b_05", name:"勇士腰带", quality:"fine", icon:"🎗️", fx:["bonusDef"] },
    { id:"og_b_06", name:"星辰腰带", quality:"epic", icon:"🎗️", fx:["bonusAtk","bonusHp"] },
    { id:"og_b_07", name:"熔炉骑士腰带", quality:"rare", icon:"🎗️", fx:["bonusDef","bonusHp"] },
    { id:"og_b_08", name:"黄金树腰带", quality:"legendary", icon:"🎗️", fx:["bonusHp"] },
    // --- 新增 ---
    { id:"og_b_09", name:"黑色瘟疫腰带", quality:"epic", icon:"🎗️", source:"DNF", fx:["bonusHp","bonusAtk"] },
    { id:"og_b_10", name:"巨龙腰带", quality:"epic", icon:"🎗️", source:"魔兽", fx:["bonusHp","bonusDef"] },
    { id:"og_b_11", name:"碎龙腰带", quality:"legendary", icon:"🎗️", source:"魔兽", fx:["bonusHp","bonusAtk"] },
    { id:"og_b_12", name:"蜘蛛之网", quality:"legendary", icon:"🎗️", source:"暗黑破坏神2", fx:["bonusHp","critRate"] },
    { id:"og_b_13", name:"雷神之力", quality:"epic", icon:"🎗️", source:"暗黑破坏神2", fx:["bonusAtk","bonusHp"] },
    { id:"og_b_14", name:"神圣护盾腰带", quality:"epic", icon:"🎗️", source:"泰拉瑞亚", fx:["bonusHp","bonusDef"] },
    { id:"og_b_15", name:"熔炉腰带", quality:"epic", icon:"🎗️", source:"艾尔登法环", fx:["bonusHp","bonusDef"] },
  ],

  // ===== 勋章 (medal, stat:atk) =====
  medal: [
    // --- 原有 ---
    { id:"og_m_01", name:"荣誉勋章", quality:"epic", icon:"🏅", fx:["critRate","bonusAtk"] },
    { id:"og_m_02", name:"战神勋章", quality:"legendary", icon:"🏅", fx:["critDmg","bonusAtk"] },
    { id:"og_m_03", name:"泰拉石勋章", quality:"epic", icon:"🏅", fx:["bonusAtk"] },
    { id:"og_m_04", name:"联盟勋章", quality:"legendary", icon:"🏅", fx:["bonusHp","bonusDef","bonusAtk"] },
    { id:"og_m_05", name:"部落勋章", quality:"legendary", icon:"🏅", fx:["bonusAtk","bonusHp"] },
    { id:"og_m_06", name:"黄金树勋章", quality:"legendary", icon:"🏅", fx:["bonusAtk"] },
    // --- 新增 ---
    { id:"og_m_07", name:"国王的令牌", quality:"legendary", icon:"🏅", source:"传奇", fx:["bonusAtk"] },
    { id:"og_m_08", name:"荣耀贵族勋章", quality:"epic", icon:"🏅", source:"DNF", fx:["bonusAtk","bonusHp"] },
    { id:"og_m_09", name:"银色黎明徽章", quality:"epic", icon:"🏅", source:"魔兽", fx:["bonusAtk","bonusDef"] },
    { id:"og_m_10", name:"塞纳里奥议会徽章", quality:"legendary", icon:"🏅", source:"魔兽", fx:["bonusHp","bonusDef"] },
    { id:"og_m_11", name:"暗影议会勋章", quality:"epic", icon:"🏅", source:"魔兽", fx:["bonusAtk","critDmg"] },
    { id:"og_m_12", name:"勇士勋章", quality:"rare", icon:"🏅", source:"泰拉瑞亚", fx:["bonusAtk","critRate"] },
    { id:"og_m_13", name:"皇家勋章", quality:"epic", icon:"🏅", source:"泰拉瑞亚", fx:["bonusHp","bonusDef"] },
    { id:"og_m_14", name:"卡利亚骑士徽章", quality:"legendary", icon:"🏅", source:"艾尔登法环", fx:["bonusAtk","critRate"] },
    { id:"og_m_15", name:"黄金树徽章", quality:"legendary", icon:"🏅", source:"艾尔登法环", fx:["bonusHp"] },
    { id:"og_m_16", name:"国王之魂", quality:"legendary", icon:"🏅", source:"空洞骑士", fx:["bonusHp","bonusAtk"] },
  ],

  // ===== 手镯 (bracelet, stat:atk) =====
  bracelet: [
    // --- 原有 ---
    { id:"og_br_01", name:"虹魔手镯", quality:"epic", icon:"⛓️", fx:["bonusAtk"] },
    { id:"og_br_02", name:"魔血手镯", quality:"rare", icon:"⛓️", fx:["bonusHp"] },
    { id:"og_br_03", name:"暗影手镯", quality:"epic", icon:"⛓️", fx:["bonusAtk"] },
    { id:"og_br_04", name:"火焰手镯", quality:"rare", icon:"⛓️", fx:["critDmg","bonusAtk"] },
    { id:"og_br_05", name:"无尽怒火手镯", quality:"legendary", icon:"⛓️", fx:["critRate","bonusAtk"] },
    { id:"og_br_06", name:"龙鳞手镯", quality:"legendary", icon:"⛓️", fx:["bonusDef","bonusAtk"] },
    { id:"og_br_07", name:"星辰手镯", quality:"epic", icon:"⛓️", fx:["bonusHp","bonusAtk"] },
    { id:"og_br_08", name:"黄金树手镯", quality:"legendary", icon:"⛓️", fx:["bonusAtk"] },
    // --- 新增 ---
    { id:"og_br_09", name:"窒息悲鸣手镯", quality:"epic", icon:"⛓️", source:"DNF", fx:["critRate","bonusAtk"] },
    { id:"og_br_10", name:"哈尼克之牙", quality:"legendary", icon:"⛓️", source:"DNF", fx:["bonusAtk","critDmg"] },
    { id:"og_br_11", name:"罗杰的金表", quality:"epic", icon:"⛓️", source:"DNF", fx:["bonusAtk"] },
    { id:"og_br_12", name:"狂风手镯", quality:"rare", icon:"⛓️", source:"传奇", fx:["bonusAtk","critRate"] },
    { id:"og_br_13", name:"守护者手镯", quality:"epic", icon:"⛓️", source:"魔兽", fx:["bonusDef","bonusHp"] },
    { id:"og_br_14", name:"巨龙之击手镯", quality:"legendary", icon:"⛓️", source:"魔兽", fx:["critRate","critDmg"] },
    { id:"og_br_15", name:"穆拉丁的望远镜", quality:"rare", icon:"⛓️", source:"魔兽", fx:["critRate","bonusAtk"] },
    { id:"og_br_16", name:"蠕虫围巾", quality:"epic", icon:"⛓️", source:"泰拉瑞亚", fx:["bonusDef","bonusHp"] },
    { id:"og_br_17", name:"星辰手环", quality:"fine", icon:"⛓️", source:"泰拉瑞亚", fx:["bonusHp"] },
    { id:"og_br_18", name:"骷髅耳环", quality:"legendary", icon:"⛓️", source:"哈迪斯", fx:["bonusAtk","critDmg"] },
  ]

};

// 注册到 Registry
R.registerAll('outgameEquips', EQUIPS);

// 导出工具函数
export { Q, FX, pickFx, rollFx, EQUIPS };
