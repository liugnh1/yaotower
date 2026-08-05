// ===================== v0.81 局外装备系统 =====================
// 铁匠铺打造 / DNF强化 / 符文镶嵌 / 分解回收
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { Q, pickFx, rollFx } from '../content/outgame-equips.js';

// 辅助：从模板猜测装备类型
function guessType(tpl) {
  var types = ['weapon','armor','helm','ring','amulet','belt','medal','bracelet'];
  for (var i = 0; i < types.length; i++) {
    var pool = (R.get('outgameEquips') || {})[types[i]];
    if (pool && pool.some(function(e){ return e.id === tpl.id; })) return types[i];
  }
  return 'weapon';
}

// 辅助：根据品质和类型获取数值范围
function rollStat(qualityId, statType) {
  var qr = Q[qualityId] || Q.common;
  var statKey = statType === 'maxHp' ? 'hp' : (statType === 'critRate' ? 'crit' : statType);
  var range = qr[statKey] || qr.atk;
  return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
}

// ---- 品质定义 ----
var QUALITIES = [
  { id:'worn', name:'破旧', mul:0.5, runeSlots:0, dismantle:{mats:1, stones:0, souls:0} },
  { id:'common', name:'普通', mul:1.0, runeSlots:0, dismantle:{mats:2, stones:0, souls:0} },
  { id:'fine', name:'精良', mul:1.6, runeSlots:1, dismantle:{mats:3, stones:2, souls:0} },
  { id:'rare', name:'稀有', mul:2.2, runeSlots:1, dismantle:{mats:5, stones:5, souls:0} },
  { id:'epic', name:'史诗', mul:3.0, runeSlots:2, dismantle:{mats:8, stones:10, souls:3} },
  { id:'legendary', name:'传说', mul:4.0, runeSlots:2, dismantle:{mats:12, stones:20, souls:8} },
  { id:'mythic', name:'神话', mul:5.5, runeSlots:3, dismantle:{mats:18, stones:35, souls:15} },
];
var QUALITY_COLORS = { worn:'#999', common:'#ccc', fine:'#70a1ff', rare:'#c8a8ff', epic:'#ffa502', legendary:'#ff6644', mythic:'#ff0000' };

// 装备类型定义
var EQUIP_TYPES = [
  { type:'weapon', name:'武器', icon:'🗡️', stat:'atk', base:4 },
  { type:'helm', name:'头盔', icon:'⛑️', stat:'maxHp', base:15 },
  { type:'armor', name:'护甲', icon:'🛡️', stat:'def', base:2 },
  { type:'ringL', name:'左戒指', icon:'💍', stat:'critRate', base:5 },
  { type:'ringR', name:'右戒指', icon:'💍', stat:'atk', base:3 },
  { type:'braceletL', name:'左手镯', icon:'⛓️', stat:'dodge', base:5 },
  { type:'braceletR', name:'右手镯', icon:'⛓️', stat:'atk', base:3 },
  { type:'amulet', name:'护符', icon:'📿', stat:'maxHp', base:10 },
  { type:'belt', name:'腰带', icon:'🎗️', stat:'def', base:3 },
  { type:'medal', name:'勋章', icon:'🏅', stat:'atk', base:5 },
];
var STAT_LABELS = { atk:'⚔️攻击', def:'🛡️防御', maxHp:'❤️生命', critRate:'💥暴击', dodge:'🍃闪避' };
var STAT_SHORT = { atk:'ATK', def:'DEF', maxHp:'HP', critRate:'CRIT', dodge:'DODGE' };

// ---- 品质权重（用于随机） ----
function getQualityWeights() {
  var clears = Game.meta.dungeon ? (Game.meta.dungeon.totalCleared || 0) : 0;
  var bonus = Math.min(clears * 2, 30); // clears越多越容易出好货，上限30%加成
  return [
    { q:'worn', w:Math.max(5, 30 - bonus) },
    { q:'common', w:30 },
    { q:'fine', w:20 },
    { q:'rare', w:12 },
    { q:'epic', w:6 + Math.floor(bonus/5) },
    { q:'legendary', w:1.5 + Math.floor(bonus/10) },
    { q:'mythic', w:0.5 + Math.floor(bonus/15) },
  ];
}

// ---- 生成一件局外装备 ----
export function genOutgameEquip(typeBias) {
  var meta = Game.meta;
  if (!meta.outgameEquip) meta.outgameEquip = [];

  // 从内容池选装备模板
  // slot type → pool key 映射（铁匠铺传入 ringL 但模板池 key 是 ring）
  var SLOT_TO_POOL = { ringL:'ring', ringR:'ring', braceletL:'bracelet', braceletR:'bracelet' };

  var pool = R.get('outgameEquips');

  var candidates = [];

  if (pool) {

    var lookupKey = SLOT_TO_POOL[typeBias] || typeBias;

    var types = typeBias ? [lookupKey] : ['weapon','armor','helm','ring','amulet','belt','medal','bracelet'];

    types.forEach(function(t) {

      if (pool[t]) candidates = candidates.concat(pool[t]);

    });

  }

  // 选模板（随机）

  var template = null;

  if (candidates.length > 0) {

    template = candidates[Math.floor(Math.random() * candidates.length)];

  }

  // 确定类型：模板猜类型 → 映射到具体 slot；无模板用 typeBias

  var typeStr;

  if (template) {

    typeStr = template.type || guessType(template);

    if (typeStr === 'ring') typeStr = Math.random() < 0.5 ? 'ringL' : 'ringR';

    if (typeStr === 'bracelet') typeStr = Math.random() < 0.5 ? 'braceletL' : 'braceletR';

  } else {

    typeStr = typeBias || 'weapon';

    if (typeStr === 'ring') typeStr = Math.random() < 0.5 ? 'ringL' : 'ringR';

    if (typeStr === 'bracelet') typeStr = Math.random() < 0.5 ? 'braceletL' : 'braceletR';

  }

  var typeInfo = EQUIP_TYPES.find(function(t){ return t.type === typeStr; }) || EQUIP_TYPES[0];

  // 选品质（加权随机）
  var weights = getQualityWeights();
  var totalW = weights.reduce(function(s, w){ return s + w.w; }, 0);
  var roll = Math.random() * totalW;
  var cur = 0, qualityId = 'common';
  for (var i = 0; i < weights.length; i++) {
    cur += weights[i].w;
    if (roll <= cur) { qualityId = weights[i].q; break; }
  }
  var quality = QUALITIES.find(function(q){ return q.id === qualityId; }) || QUALITIES[1];

  // 从品质范围获取基础值
  var statVal = rollStat(quality.id, typeInfo.stat);

  // 极品暴击（5%概率，额外+2~+8）
  var extraVal = 0;
  if (Math.random() < 0.05) { extraVal = 2 + Math.floor(Math.random() * 7); }

  // 装备名称 = 品质前缀 + 模板名
  var name = template ? (quality.name + '·' + template.name) : (quality.name + typeInfo.name);
  // 确定主属性
  var primaryStat = typeInfo.stat; // 默认
  if (template && template.baseHp) primaryStat = 'maxHp';
  if (template && template.baseAtk) primaryStat = 'atk';
  if (template && template.baseDef) primaryStat = 'def';
  if (template && template.baseCrit) primaryStat = 'critRate';
  if (template && template.baseDodge) primaryStat = 'dodge';

  var equip = {
    id: 'ogeq_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
    name: name,
    templateId: template ? template.id : null,
    type: typeInfo.type,
    icon: template ? (template.icon || typeInfo.icon) : typeInfo.icon,
    quality: quality.id,
    qualityName: quality.name,
    color: QUALITY_COLORS[quality.id] || '#ccc',
    stat: primaryStat,
    val: statVal,
    extraVal: extraVal,
    effect: null, // 下面重新生成
    _effects: [], // 内部效果列表 [{key, val, desc, apply}]
    enhanceLv: 0,
    runeSlots: quality.runeSlots,
    runes: [],
    isOutgame: true
  };

  // v0.81: 概率获得 1 个附加效果（品质越高概率越大）
  if (template && template.fx && template.fx.length > 0) {
    var fxChance = { worn:0.10, common:0.20, fine:0.30, rare:0.40, epic:0.55, legendary:0.70, mythic:0.85 };
    var chance = fxChance[quality.id] || 0.25;
    if (Math.random() < chance) {
      var fxKeys = pickFx(template.fx, 1);
      var effects = [];
      fxKeys.forEach(function(k) {
        var rolled = rollFx(k);
        if (rolled.desc) effects.push(rolled);
      });
      equip._effects = effects;
      if (effects.length > 0) {
        equip.effect = { desc: effects[0].desc };
      }
    } else {
      equip._effects = [];
    }
  }

  meta.outgameEquip.push(equip);
  Game.saveMeta();
  return equip;
}

// ---- 装备到身上 ----
export function equipOutgameItem(equipId, slotType) {
  var meta = Game.meta;
  if (!meta.outgameEquipped) meta.outgameEquipped = { weapon:null, helm:null, armor:null, ringL:null, ringR:null, braceletL:null, braceletR:null, amulet:null, belt:null, medal:null };
  // 找到装备
  var idx = -1;
  for (var i = 0; i < (meta.outgameEquip||[]).length; i++) {
    if (meta.outgameEquip[i].id === equipId) { idx = i; break; }
  }
  if (idx < 0) return false;
  var equip = meta.outgameEquip[idx];
  // 类型不匹配
  // 允许左右戒指/手镯互通（兼容旧存档 ring/bracelet 类型）
  var typeOk = equip.type === slotType;
  if (!typeOk) {
    if ((equip.type === "ringL" || equip.type === "ringR" || equip.type === "ring") && (slotType === "ringL" || slotType === "ringR")) typeOk = true;
    if ((equip.type === "braceletL" || equip.type === "braceletR" || equip.type === "bracelet") && (slotType === "braceletL" || slotType === "braceletR")) typeOk = true;
  }
  if (!typeOk) return false;
  // 如果该槽已有装备，先卸下
  if (meta.outgameEquipped[slotType]) {
    meta.outgameEquip.push(meta.outgameEquipped[slotType]);
  }
  // 装备上去，从背包移除
  meta.outgameEquipped[slotType] = equip;
  meta.outgameEquip.splice(idx, 1);
  Game.saveMeta();
  return true;
}

// ---- 卸下装备 ----
export function unequipOutgameItem(slotType) {
  var meta = Game.meta;
  if (!meta.outgameEquipped || !meta.outgameEquipped[slotType]) return false;
  var equip = meta.outgameEquipped[slotType];
  if (!meta.outgameEquip) meta.outgameEquip = [];
  meta.outgameEquip.push(equip);
  meta.outgameEquipped[slotType] = null;
  Game.saveMeta();
  return true;
}

// ---- 强化装备 ----
export function enhanceEquip(equipId) {
  var meta = Game.meta;
  var allEquip = (meta.outgameEquip||[]).concat(Object.values(meta.outgameEquipped||{}).filter(Boolean));
  var equip = allEquip.find(function(e){ return e && e.id === equipId; });
  if (!equip) return { success: false, msg: '装备不存在' };

  var lv = equip.enhanceLv || 0;
  if (lv >= 10) return { success: false, msg: '已达最高强化等级 +10' };

  // 强化消耗表
  var costTable = [
    { mats:1, stones:3, souls:5, rate:1.00, penalty:0 },     // +0→+1
    { mats:2, stones:5, souls:8, rate:0.95, penalty:0 },     // +1→+2
    { mats:3, stones:8, souls:12, rate:0.85, penalty:0 },     // +2→+3
    { mats:4, stones:12, souls:16, rate:0.75, penalty:-1 },    // +3→+4
    { mats:5, stones:16, souls:20, rate:0.65, penalty:-1 },    // +4→+5
    { mats:6, stones:20, souls:25, rate:0.55, penalty:-1 },    // +5→+6
    { mats:8, stones:25, souls:30, rate:0.45, penalty:-2 },    // +6→+7
    { mats:10, stones:32, souls:36, rate:0.35, penalty:-2 },   // +7→+8
    { mats:12, stones:40, souls:42, rate:0.25, penalty:-2 },   // +8→+9
    { mats:15, stones:50, souls:50, rate:0.15, penalty:-99 },  // +9→+10
  ];
  var cost = costTable[lv];
  if (!cost) return { success: false, msg: '强化数据异常' };

  // 检查材料
  if ((meta.materials || 0) < cost.mats) return { success: false, msg: '材料不足(需' + cost.mats + ')' };
  if ((meta.stones || 0) < cost.stones) return { success: false, msg: '灵石不足(需' + cost.stones + ')' };
  if ((meta.souls || 0) < cost.souls) return { success: false, msg: '魂晶不足(需' + cost.souls + ')' };

  // 扣除材料
  meta.materials -= cost.mats;
  meta.stones -= cost.stones;
  meta.souls -= cost.souls;

  // 判定
  if (Math.random() < cost.rate) {
    equip.enhanceLv = lv + 1;
    equip.val += 1 + Math.floor(Math.random() * 3); // 成功：stat +1~3
    Game.saveMeta();
    return { success: true, msg: '强化成功！+' + equip.enhanceLv, lv: equip.enhanceLv };
  } else {
    // v0.81: 保护券 — 失败时自动消耗，不降级
    if ((meta.protectCharm || 0) > 0 && cost.penalty < 0) {
      meta.protectCharm--;
      Game.saveMeta();
      return { success: false, msg: '强化失败…保护券发动！等级保留在+' + lv, lv: lv };
    }
    // 失败惩罚
    if (cost.penalty === -99) {
      equip.enhanceLv = 0; // +10失败归零
      Game.saveMeta();
      return { success: false, msg: '强化失败…归零', lv: 0 };
    } else if (cost.penalty < 0) {
      equip.enhanceLv = Math.max(0, lv + cost.penalty);
      Game.saveMeta();
      return { success: false, msg: '强化失败…降为+' + equip.enhanceLv, lv: equip.enhanceLv };
    }
    Game.saveMeta();
    return { success: false, msg: '强化失败', lv: lv };
  }
}

// ---- 分解装备 ----
export function dismantleEquip(equipId) {
  var meta = Game.meta;
  var idx = -1;
  for (var i = 0; i < (meta.outgameEquip||[]).length; i++) {
    if (meta.outgameEquip[i].id === equipId) { idx = i; break; }
  }
  if (idx < 0) return { success: false, msg: '装备不存在' };
  var equip = meta.outgameEquip[idx];
  var quality = QUALITIES.find(function(q){ return q.id === equip.quality; }) || QUALITIES[0];
  var d = quality.dismantle;

  // 返还符文
  if (equip.runes && equip.runes.length > 0) {
    var dg = Game.meta.dungeon;
    if (dg && dg.forge) {
      equip.runes.forEach(function(r){ if (dg.forge.runes.indexOf(r) < 0) dg.forge.runes.push(r); });
    }
  }

  // 强化返还30%
  var enhanceRefund = 0;
  if (equip.enhanceLv > 0) {
    for (var i = 0; i < equip.enhanceLv; i++) {
      var costTable = [
        { mats:1, stones:3, souls:5 }, { mats:2, stones:5, souls:8 }, { mats:3, stones:8, souls:12 },
        { mats:4, stones:12, souls:16 }, { mats:5, stones:16, souls:20 }, { mats:6, stones:20, souls:25 },
        { mats:8, stones:25, souls:30 }, { mats:10, stones:32, souls:36 }, { mats:12, stones:40, souls:42 }, { mats:15, stones:50, souls:50 }
      ];
      if (i < costTable.length) { enhanceRefund += costTable[i].mats; }
    }
    enhanceRefund = Math.floor(enhanceRefund * 0.3);
  }

  meta.materials = (meta.materials || 0) + d.mats + enhanceRefund;
  meta.stones = (meta.stones || 0) + d.stones;
  meta.souls = (meta.souls || 0) + d.souls;
  meta.outgameEquip.splice(idx, 1);
  Game.saveMeta();
  return { success: true, msg: '分解成功！+' + (d.mats+enhanceRefund) + '材料 +' + d.stones + '灵石 +' + d.souls + '魂晶' };
}

// ---- 符文操作 ----
export function embedRune(equipId, runeId) {
  var meta = Game.meta;
  var allEquip = (meta.outgameEquip||[]).concat(Object.values(meta.outgameEquipped||{}).filter(Boolean));
  var equip = allEquip.find(function(e){ return e && e.id === equipId; });
  if (!equip) return { success: false, msg: '装备不存在' };
  if (!equip.runes) equip.runes = [];
  if (equip.runes.length >= (equip.runeSlots || 0)) return { success: false, msg: '符文孔已满' };
  if (equip.runes.indexOf(runeId) >= 0) return { success: false, msg: '已镶嵌相同符文' };
  // 从仓库移除符文
  var dg = Game.meta.dungeon;
  if (!dg || !dg.forge || !dg.forge.runes) return { success: false, msg: '符文仓库为空' };
  var ri = dg.forge.runes.indexOf(runeId);
  if (ri < 0) return { success: false, msg: '符文不存在' };
  // 消耗
  if ((meta.stones || 0) < 10) return { success: false, msg: '灵石不足(需10)' };
  if ((meta.souls || 0) < 5) return { success: false, msg: '魂晶不足(需5)' };
  meta.stones -= 10; meta.souls -= 5;
  dg.forge.runes.splice(ri, 1);
  equip.runes.push(runeId);
  Game.saveMeta();
  return { success: true, msg: '符文镶嵌成功！' };
}

export function removeRune(equipId, runeId) {
  var meta = Game.meta;
  var allEquip = (meta.outgameEquip||[]).concat(Object.values(meta.outgameEquipped||{}).filter(Boolean));
  var equip = allEquip.find(function(e){ return e && e.id === equipId; });
  if (!equip || !equip.runes) return { success: false, msg: '装备不存在' };
  var ri = equip.runes.indexOf(runeId);
  if (ri < 0) return { success: false, msg: '该符文未镶嵌' };
  if ((meta.stones || 0) < 5) return { success: false, msg: '灵石不足(需5)' };
  meta.stones -= 5;
  equip.runes.splice(ri, 1);
  // 退回符文仓库
  var dg = Game.meta.dungeon;
  if (dg && dg.forge && dg.forge.runes) { dg.forge.runes.push(runeId); }
  Game.saveMeta();
  return { success: true, msg: '符文已取下' };
}

// ---- 品质升阶（广告，每件仅一次） ----
export function upgradeQuality(equipId) {
  var meta = Game.meta;
  var allEquip = (meta.outgameEquip||[]).concat(Object.values(meta.outgameEquipped||{}).filter(Boolean));
  var equip = allEquip.find(function(e){ return e && e.id === equipId; });
  if (!equip) return { success: false, msg: '装备不存在' };
  if (equip._upgraded) return { success: false, msg: '该装备已升阶过一次' };
  var qi = -1;
  for (var i = 0; i < QUALITIES.length; i++) { if (QUALITIES[i].id === equip.quality) { qi = i; break; } }
  if (qi < 0 || qi >= QUALITIES.length - 1) return { success: false, msg: '已达最高品质' };
  var nextQ = QUALITIES[qi + 1];
  equip.quality = nextQ.id;
  equip.qualityName = nextQ.name;
  equip.color = QUALITY_COLORS[nextQ.id] || '#ccc';
  equip.runeSlots = nextQ.runeSlots;
  equip.val = Math.floor(equip.val * (nextQ.mul / QUALITIES[qi].mul));
  equip._upgraded = true;
  Game.saveMeta();
  return { success: true, msg: '升阶成功！' + nextQ.name };
}

// 导出 QUALITIES 和 EQUIP_TYPES 供 UI 使用
export { QUALITIES, EQUIP_TYPES, QUALITY_COLORS, STAT_LABELS, STAT_SHORT };
