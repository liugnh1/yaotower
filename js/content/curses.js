// 诅咒定义 —— 全部双刃剑化：每条诅咒都有对等增益
// 设计原则：增益≈减益的痛苦程度，让玩家主动选择祭坛
import { R } from '../core/registry.js';

R.registerAll('curses', [
  // ===== 纯负面→已重构为双刃剑 =====
  { id: "weak",  name: "虚弱", desc: "最大生命-20%，攻击+8",
    apply: p => { const loss = Math.floor(p.maxHp * 0.2); p._weakHpLoss = loss; p.maxHp -= loss; p.hp = Math.min(p.hp, p.maxHp); p.atk += 8; p._weakAtkGain = 8; },
    remove: p => { if (p._weakHpLoss) { p.maxHp += p._weakHpLoss; p.hp = Math.min(p.hp + p._weakHpLoss, p.maxHp); delete p._weakHpLoss; } if (p._weakAtkGain) { p.atk -= p._weakAtkGain; delete p._weakAtkGain; } } },
  { id: "slow",  name: "迟缓", desc: "防御-3，生命上限+25",
    apply: p => { p._slowDefLoss = 3; p.def = Math.max(0, p.def - 3); p.maxHp += 25; p.hp += 25; p._slowHpGain = 25; },
    remove: p => { if (p._slowDefLoss) { p.def += p._slowDefLoss; delete p._slowDefLoss; } if (p._slowHpGain) { p.maxHp -= p._slowHpGain; delete p._slowHpGain; } } },
  { id: "bleed", name: "流血", desc: "每回合损失3生命，攻击+6",
    apply: p => { p.bleed = (p.bleed || 0) + 3; p._bleedCurseVal = 3; p.atk += 6; p._bleedAtkGain = 6; },
    remove: p => { if (p._bleedCurseVal) { p.bleed = Math.max(0, (p.bleed || 0) - p._bleedCurseVal); if (p.bleed <= 0) delete p.bleed; delete p._bleedCurseVal; } if (p._bleedAtkGain) { p.atk -= p._bleedAtkGain; delete p._bleedAtkGain; } } },
  { id: "poor",  name: "贫困", desc: "金币获取-50%，遗物掉率翻倍",
    apply: p => { const cur = p.goldMul || 1; const loss = cur * 0.5; p._poorGoldLoss = loss; p.goldMul = cur - loss; p._poorLucky = true; },
    remove: p => { if (p._poorGoldLoss !== undefined) { p.goldMul = Math.max(0.5, (p.goldMul || 0) + p._poorGoldLoss); delete p._poorGoldLoss; } p._poorLucky = false; } },
  // ===== 新增纯双刃剑 =====
  { id: "fear",   name: "恐惧", desc: "每进入新房间扣5%生命，遗物掉落率翻倍",
    apply: p => { p._fearCurse = true; p._fearLucky = true; },
    remove: p => { p._fearCurse = false; p._fearLucky = false; } },
  { id: "blind",  name: "失明", desc: "看不到敌人血量和意图，暴击伤害+100%",
    apply: p => { p._blindCurse = true; p.critMul += 1.0; p._blindCritGain = 1.0; },
    remove: p => { p._blindCurse = false; if (p._blindCritGain) { p.critMul -= p._blindCritGain; delete p._blindCritGain; } } },
  // ===== 已有双刃剑（增益强化）=====
  { id: "fragile", name: "脆弱", desc: "受到伤害+30%，攻击+8",
    apply: p => { p._fragileFlag = true; p.atk += 8; p._fragileAtkGain = 8; },
    remove: p => { p._fragileFlag = false; if (p._fragileAtkGain) { p.atk = Math.max(1, p.atk - p._fragileAtkGain); delete p._fragileAtkGain; } } },
  { id: "forgetful",name:"健忘", desc: "技能能量消耗+1，普攻伤害+40%",
    apply: p => { p._forgetfulCurse = true; p._forgetfulAtkGain = Math.floor(p.atk * 0.4); p.atk += p._forgetfulAtkGain; },
    remove: p => { p._forgetfulCurse = false; if (p._forgetfulAtkGain !== undefined) { p.atk = Math.max(1, p.atk - p._forgetfulAtkGain); delete p._forgetfulAtkGain; } } },
  { id: "badluck",name: "逆运", desc: "暴击率减半，暴击伤害3倍",
    apply: p => { const orig = p.critRate; p._badLuckOrig = orig; p.critRate = orig / 2; p._badLuckCritMul = p.critMul; p.critMul = 3.0; },
    remove: p => { if (p._badLuckOrig !== undefined) { p.critRate = p._badLuckOrig; delete p._badLuckOrig; } if (p._badLuckCritMul !== undefined) { p.critMul = p._badLuckCritMul; delete p._badLuckCritMul; } } },
  { id: "greed",  name: "贪婪", desc: "金币获取+50%，商店价格翻倍",
    apply: p => { p.goldMul = (p.goldMul || 1) * 1.5; p._greedCurse = true; },
    remove: p => { p.goldMul = (p.goldMul || 1) / 1.5; p._greedCurse = false; } }
]);
