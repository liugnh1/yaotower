// 难度定义
import { R } from '../core/registry.js';

R.registerAll('difficulties', {
  casual:   { id: "casual",   name: "简单", icon: "🌱", desc: "怪物属性-30%，遗物掉率提升", monsterMul: 0.7,  extraTag: false, legendRate: 0.05, adLimit: 15, next: "casual_1", asc: 0 },
  casual_1: { id: "casual_1", name: "简单+1", icon: "🌿", desc: "怪物属性-20% · 敌人+1只", monsterMul: 0.8, extraTag: false, legendRate: 0.06, adLimit: 15, next: "casual_2", asc: 1, extraEnemy: 1 },
  casual_2: { id: "casual_2", name: "简单+2", icon: "🪴", desc: "怪物属性-10% · 敌人+1 · 商店涨价20%", monsterMul: 0.9, extraTag: false, legendRate: 0.07, adLimit: 15, next: "casual_3", asc: 2, extraEnemy: 1, shopMul: 1.2 },
  casual_3: { id: "casual_3", name: "简单+3", icon: "🌳", desc: "怪物正常 · 敌人+2 · 涨价20% · Boss+1小怪", monsterMul: 1.0, extraTag: false, legendRate: 0.08, adLimit: 15, next: "standard", asc: 3, extraEnemy: 2, shopMul: 1.2, bossExtra: true },
  standard: { id: "standard", name: "普通", icon: "⚔️", desc: "原版平衡体验", monsterMul: 1.0, extraTag: false, legendRate: 0.02, adLimit: 10, next: "standard_1", asc: 0 },
  standard_1:{ id: "standard_1",name: "普通+1",icon: "🗡️",desc: "怪物+10% · 敌人+1 · 涨价10%", monsterMul: 1.1, extraTag: false, legendRate: 0.03, adLimit: 10, next: "standard_2", asc: 1, extraEnemy: 1, shopMul: 1.1 },
  standard_2:{ id: "standard_2",name: "普通+2",icon: "🏹", desc: "怪物+20% · 敌人+2 · 涨价20% · Boss+1小怪", monsterMul: 1.2, extraTag: true, legendRate: 0.04, adLimit: 10, next: "standard_3", asc: 2, extraEnemy: 2, shopMul: 1.2, bossExtra: true },
  standard_3:{ id: "standard_3",name: "普通+3",icon: "💀", desc: "怪物+30% · 敌人+2 · 涨价30% · Boss+2小怪 · 怪物多词条", monsterMul: 1.3, extraTag: true, legendRate: 0.06, adLimit: 10, next: "hell", asc: 3, extraEnemy: 2, shopMul: 1.3, bossExtra: true },
  hell:     { id: "hell",     name: "炼狱", icon: "🔥", desc: "怪物+30%，多1词条，橙率大增", monsterMul: 1.3, extraTag: true, legendRate: 0.08, adLimit: 10, next: "hell_1", asc: 0 },
  hell_1:   { id: "hell_1",   name: "炼狱+1", icon: "💥", desc: "怪物+40% · 敌人+2 · 涨价20% · Boss+2小怪", monsterMul: 1.4, extraTag: true, legendRate: 0.10, adLimit: 10, next: "hell_2", asc: 1, extraEnemy: 2, shopMul: 1.2, bossExtra: true },
  hell_2:   { id: "hell_2",   name: "炼狱+2", icon: "☠️", desc: "怪物+50% · 敌人+3 · 涨价30% · 双词条", monsterMul: 1.5, extraTag: true, legendRate: 0.12, adLimit: 10, next: "hell_3", asc: 2, extraEnemy: 3, shopMul: 1.3, bossExtra: true, doubleTag: true },
  hell_3:   { id: "hell_3",   name: "炼狱+3", icon: "👑", desc: "怪物+60% · 敌人+3 · 涨价40% · 双词条 · Boss+3小怪", monsterMul: 1.6, extraTag: true, legendRate: 0.15, adLimit: 10, next: null, asc: 3, extraEnemy: 3, shopMul: 1.4, bossExtra: true, doubleTag: true },
});
