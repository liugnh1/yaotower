// 难度定义
import { R } from '../core/registry.js';

R.registerAll('difficulties', {
  casual:   { id: "casual",   name: "休闲", icon: "🌱", desc: "怪物属性-30%，遗物掉率提升", monsterMul: 0.7,  extraTag: false, legendRate: 0.05, adLimit: 15 },
  standard: { id: "standard", name: "标准", icon: "⚔️", desc: "原版平衡体验",              monsterMul: 1.0,  extraTag: false, legendRate: 0.02, adLimit: 10 },
  hell:     { id: "hell",     name: "炼狱", icon: "🔥", desc: "怪物+30%，多1词条，橙率大增", monsterMul: 1.3,  extraTag: true,  legendRate: 0.08, adLimit: 10 }
});
