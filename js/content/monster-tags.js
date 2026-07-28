// 怪物词条
import { R } from '../core/registry.js';

R.registerAll('monsterTags', [
  { id: "vamp",   name: "[吸血]", apply: e => { e.lifeSteal = 0.3; } },
  { id: "rage",   name: "[狂暴]", apply: e => { e.atk = Math.floor(e.atk * 1.4); } },
  { id: "thorn",  name: "[反伤]", apply: e => { e.thorn = 0.15; } },
  { id: "tough",  name: "[坚韧]", apply: e => { e.def += 4; } },
  { id: "swift",  name: "[迅捷]", apply: e => { e.doubleFirst = true; } },
  { id: "charge", name: "[蓄力]", apply: e => { e.aiCharge = true; e.chargeTurns = 0; } },
  { id: "curse",  name: "[诅咒]", apply: e => { e.aiCurse = true; } }
]);
