// 每日挑战修饰器
import { R } from '../core/registry.js';

R.registerAll('dailyGlobalMods', [
  { id: "g1", name: "全员强化", desc: "所有人属性+10%", apply: s => { s.player.atk = Math.floor(s.player.atk * 1.1); s.player.maxHp = Math.floor(s.player.maxHp * 1.1); s.player.hp = s.player.maxHp; } },
  { id: "g2", name: "贫瘠之地", desc: "金币获取-50%",   apply: s => { s.player.goldMul = (s.player.goldMul || 1) * 0.5; } },
  { id: "g3", name: "灵气充沛", desc: "灵力上限+50%",   apply: s => { s.player.maxMp = Math.floor(s.player.maxMp * 1.5); s.player.mp = s.player.maxMp; } },
  { id: "g4", name: "血战到底", desc: "生命上限-30%，攻击+30%", apply: s => { s.player.maxHp = Math.floor(s.player.maxHp * 0.7); s.player.hp = Math.min(s.player.hp, s.player.maxHp); s.player.atk = Math.floor(s.player.atk * 1.3); } },
  { id: "g5", name: "富可敌国", desc: "开局金币+100",   apply: s => { s.gold += 100; } },
  { id: "g6", name: "诅咒缠身", desc: "开局自带1层诅咒", apply: s => { const curse = s.rng.pick(R.get('curses')); s.curses.push(curse); curse.apply(s.player); } },
  { id: "g7", name: "神速",     desc: "所有怪物敏捷+，先手率提升", apply: s => { s.enemySwift = true; } },
  { id: "g8", name: "双倍掉落", desc: "装备/遗物掉率翻倍", apply: s => { s.dropMul = 2; } },
  { id: "g9", name: "独狼",     desc: "无法获得天赋，但攻击+50%", apply: s => { s.player.atk = Math.floor(s.player.atk * 1.5); s.noTalent = true; } }
]);

R.registerAll('dailyPlayerMods', [
  { id: "p1", name: "战士之血", desc: "攻击+10%", apply: s => { s.player.atk = Math.floor(s.player.atk * 1.1); } },
  { id: "p2", name: "法师之智", desc: "灵力+20%", apply: s => { s.player.maxMp = Math.floor(s.player.maxMp * 1.2); s.player.mp = s.player.maxMp; } },
  { id: "p3", name: "铁壁",     desc: "防御+5",   apply: s => { s.player.def += 5; } },
  { id: "p4", name: "暴击狂",   desc: "暴击率+15%", apply: s => { s.player.critRate += 0.15; } },
  { id: "p5", name: "吸血本能", desc: "吸血+10%", apply: s => { s.player.lifeSteal = (s.player.lifeSteal || 0) + 0.1; } },
  { id: "p6", name: "穷鬼",     desc: "金币-50%，攻击+20%", apply: s => { s.player.goldMul = (s.player.goldMul || 1) * 0.5; s.player.atk = Math.floor(s.player.atk * 1.2); } },
  { id: "p7", name: "玻璃大炮", desc: "生命-30%，技能伤害+50%", apply: s => { s.player.maxHp = Math.floor(s.player.maxHp * 0.7); s.player.hp = Math.min(s.player.hp, s.player.maxHp); s.player.skillMul += 0.5; } },
  { id: "p8", name: "幸运儿",   desc: "暴击伤害+50%", apply: s => { s.player.critMul += 0.5; } },
  { id: "p9", name: "苟命王",   desc: "每回合恢复5生命", apply: s => { s.player.regen = 5; } }
]);

R.registerAll('dailyEnemyMods', [
  { id: "e1", name: "血牛",     desc: "怪物血量+20%", apply: s => { s.enemyHpMul = 1.2; } },
  { id: "e2", name: "狂暴",     desc: "怪物攻击+20%", apply: s => { s.enemyAtkMul = 1.2; } },
  { id: "e3", name: "铁壁",     desc: "怪物防御+30%", apply: s => { s.enemyDefMul = 1.3; } },
  { id: "e4", name: "迅捷",     desc: "怪物先手率提升", apply: s => { s.enemySwift = true; } },
  { id: "e5", name: "贪婪",     desc: "怪物金币掉落-30%", apply: s => { s.enemyGoldMul = 0.7; } },
  { id: "e6", name: "诅咒师",   desc: "怪物诅咒几率+20%", apply: s => { s.enemyCurseRate = 0.2; } },
  { id: "e7", name: "复活",     desc: "Boss血量+50%", apply: s => { s.bossHpMul = 1.5; } },
  { id: "e8", name: "精英潮",   desc: "精英房数量+1", apply: s => { s.extraElite = true; } },
  { id: "e9", name: "绝境",     desc: "所有怪物+1词条", apply: s => { s.enemyExtraTag = true; } }
]);
