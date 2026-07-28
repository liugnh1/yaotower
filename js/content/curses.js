// 诅咒定义
import { R } from '../core/registry.js';

R.registerAll('curses', [
  { id: "weak",  name: "虚弱", desc: "最大生命-20%",
    apply: p => { const loss = Math.floor(p.maxHp * 0.2); p._weakHpLoss = loss; p.maxHp -= loss; p.hp = Math.min(p.hp, p.maxHp); },
    remove: p => { if (p._weakHpLoss) { p.maxHp += p._weakHpLoss; p.hp = Math.min(p.hp + p._weakHpLoss, p.maxHp); delete p._weakHpLoss; } } },
  { id: "slow",  name: "迟缓", desc: "防御-3",
    apply: p => { p._slowDefLoss = 3; p.def = Math.max(0, p.def - 3); },
    remove: p => { if (p._slowDefLoss) { p.def += p._slowDefLoss; delete p._slowDefLoss; } } },
  { id: "bleed", name: "流血", desc: "每回合损失3生命",
    apply: p => { p.bleed = 3; },
    remove: p => { delete p.bleed; } },
  { id: "poor",  name: "贫困", desc: "金币获取-50%",
    apply: p => { const cur = p.goldMul || 1; const loss = cur * 0.5; p._poorGoldLoss = loss; p.goldMul = cur - loss; },
    remove: p => { if (p._poorGoldLoss !== undefined) { p.goldMul = (p.goldMul || 0) + p._poorGoldLoss; delete p._poorGoldLoss; } } }
]);
