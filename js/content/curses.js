// 诅咒定义 —— 全部双刃剑化：每条诅咒都有对等增益
// 设计原则：增益≈减益的痛苦程度，让玩家主动选择祭坛
import { R } from '../core/registry.js';

// v0.60: 获取玩家的诅咒效果修正系数
// downsideReduce: 负面效果减免 (天赋树「净化」+ 命运烙印「咒王」)
// upsideBoost: 正面效果增幅 (命运烙印「咒王」)
export function getCurseModifiers(p) {
  var downsideReduce = (p._talentCurseReduce || 0) + (p._brandCurseDownsideReduce || 0);
  var upsideBoost = (p._brandCurseUpsideBoost || 0);
  return { downsideReduce: Math.min(0.8, downsideReduce), upsideBoost: Math.min(1.0, upsideBoost) };
}

// v0.60: 应用诅咒downside减免（修正HP/属性损失值）
export function applyDownsideReduce(p, lossValue) {
  var mods = getCurseModifiers(p);
  return Math.floor(lossValue * (1 - mods.downsideReduce));
}

// v0.60: 应用诅咒upside增幅（修正增益值）
export function applyUpsideBoost(p, gainValue) {
  var mods = getCurseModifiers(p);
  return Math.floor(gainValue * (1 + mods.upsideBoost));
}

R.registerAll('curses', [
  // ===== v0.70 双刃剑诅咒 — 全面平衡 =====
  { id: "weak",  name: "虚弱", desc: "最大生命-20%，攻击+12",
    apply: p => { var mods = getCurseModifiers(p); var loss = applyDownsideReduce(p, Math.floor(p.maxHp * 0.2)); p._weakHpLoss = loss; p.maxHp -= loss; p.hp = Math.min(p.hp, p.maxHp); var gain = applyUpsideBoost(p, 12); p.atk += gain; p._weakAtkGain = gain; },
    remove: p => { if (p._weakHpLoss) { p.maxHp += p._weakHpLoss; p.hp = Math.min(p.hp + p._weakHpLoss, p.maxHp); delete p._weakHpLoss; } if (p._weakAtkGain) { p.atk -= p._weakAtkGain; delete p._weakAtkGain; } } },
  { id: "slow",  name: "迟缓", desc: "防御-5，生命上限+50",
    apply: p => { var mods = getCurseModifiers(p); var loss = applyDownsideReduce(p, 5); p._slowDefLoss = loss; p.def = Math.max(0, p.def - loss); var gain = applyUpsideBoost(p, 50); p.maxHp += gain; p.hp += gain; p._slowHpGain = gain; },
    remove: p => { if (p._slowDefLoss) { p.def += p._slowDefLoss; delete p._slowDefLoss; } if (p._slowHpGain) { p.maxHp -= p._slowHpGain; delete p._slowHpGain; } } },
  { id: "bleed", name: "流血", desc: "每回合损失2%最大生命，攻击+12",
    apply: p => { var mods = getCurseModifiers(p); var loss = applyDownsideReduce(p, Math.max(3, Math.floor(p.maxHp * 0.02))); p.bleed = (p.bleed || 0) + loss; p._bleedCurseVal = loss; var gain = applyUpsideBoost(p, 12); p.atk += gain; p._bleedAtkGain = gain; },
    remove: p => { if (p._bleedCurseVal) { p.bleed = Math.max(0, (p.bleed || 0) - p._bleedCurseVal); if (p.bleed <= 0) delete p.bleed; delete p._bleedCurseVal; } if (p._bleedAtkGain) { p.atk -= p._bleedAtkGain; delete p._bleedAtkGain; } } },
  { id: "poor",  name: "贫困", desc: "金币获取-50%，遗物掉率×3+宝箱奖励翻倍",
    apply: p => { const cur = p.goldMul || 1; const loss = cur * 0.5; p._poorGoldLoss = loss; p.goldMul = cur - loss; p._poorLucky = true; },
    remove: p => { if (p._poorGoldLoss !== undefined) { p.goldMul = Math.max(0.5, (p.goldMul || 0) + p._poorGoldLoss); delete p._poorGoldLoss; } p._poorLucky = false; } },
  { id: "fear",   name: "恐惧", desc: "每进入新房间扣5%生命，遗物掉率×3+精英额外遗物",
    apply: p => { p._fearCurse = true; p._fearLucky = true; },
    remove: p => { p._fearCurse = false; p._fearLucky = false; } },
  { id: "blind",  name: "失明", desc: "看不到敌人血量和意图，暴击伤害+80%",
    apply: p => { p._blindCurse = true; var gain = 0.8 + applyUpsideBoost(p, 0); p.critMul += gain; p._blindCritGain = gain; },
    remove: p => { p._blindCurse = false; if (p._blindCritGain) { p.critMul -= p._blindCritGain; delete p._blindCritGain; } } },
  { id: "fragile", name: "脆弱", desc: "受到伤害+30%，攻击+16",
    apply: p => { p._fragileFlag = true; var gain = applyUpsideBoost(p, 16); p.atk += gain; p._fragileAtkGain = gain; },
    remove: p => { p._fragileFlag = false; if (p._fragileAtkGain) { p.atk = Math.max(1, p.atk - p._fragileAtkGain); delete p._fragileAtkGain; } } },
  { id: "forgetful",name:"健忘", desc: "技能能量消耗+1，普攻伤害+50%",
    apply: p => { p._forgetfulCurse = true; var gain = applyUpsideBoost(p, Math.floor(p.atk * 0.5)); p._forgetfulAtkGain = gain; p.atk += gain; },
    remove: p => { p._forgetfulCurse = false; if (p._forgetfulAtkGain !== undefined) { p.atk = Math.max(1, p.atk - p._forgetfulAtkGain); delete p._forgetfulAtkGain; } } },
  { id: "badluck",name: "逆运", desc: "暴击率减半，暴击伤害3倍+穿透+15%",
    apply: p => { const orig = p.critRate; p._badLuckOrig = orig; p.critRate = orig / 2; p._badLuckCritMul = p.critMul; p.critMul = Math.max(3.0, p.critMul); p.pen = (p.pen || 0) + 0.15; p._badLuckPen = 0.15; },
    remove: p => { if (p._badLuckOrig !== undefined) { p.critRate = p._badLuckOrig; delete p._badLuckOrig; } if (p._badLuckCritMul !== undefined) { p.critMul = p._badLuckCritMul; delete p._badLuckCritMul; } if (p._badLuckPen) { p.pen = Math.max(0, (p.pen || 0) - p._badLuckPen); delete p._badLuckPen; } } },
  { id: "greed",  name: "贪婪", desc: "金币获取+80%，商店价格翻倍+刷新免费",
    apply: p => { p.goldMul = (p.goldMul || 1) * 1.8; p._greedCurse = true; },
    remove: p => { p.goldMul = (p.goldMul || 1) / 1.8; p._greedCurse = false; } },
  { id: "doom",   name: "厄运", desc: "3+诅咒时每回合损2%HP，每诅咒+20%暴伤",
    apply: p => { p._doomCurse = true; p._doomCritBonus = true; },
    remove: p => { p._doomCurse = false; p._doomCritBonus = false; } }
]);
