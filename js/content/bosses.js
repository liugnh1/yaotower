// Boss 配置 —— 全部含二阶段（HP<50%切换） + 无尽Boss扩充
import { R } from '../core/registry.js';

R.registerAll('bosses', {
  plains: {
    name: "平原领主·裂地者", hp: 150, atk: 18, def: 5, exp: "大地颤抖", icon: "🦏",
    skill: { name: "地震", desc: "对玩家造成2倍攻击力伤害", fn: (e, p) => { const d = Math.max(1, e.atk * 2 - p.def); p.hp -= d; return { dmg: d, msg: '🌍 裂地者释放地震！' }; } },
    phase2: {
      name: "平原领主·崩山者", atkMul: 1.3, defBonus: 3,
      skill: { name: "大地崩裂", desc: "造成2.5倍伤害并降低玩家防御2回合", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2.5) - p.def); p.hp -= d; p.def = Math.max(0, p.def - 3); return { dmg: d, msg: '🌍💢 裂地者暴怒！大地崩裂！防御降低' }; } }
    }
  },
  forest: {
    name: "森林之王·苍古树精", hp: 220, atk: 22, def: 7, exp: "万木臣服", icon: "🌲",
    skill: { name: "缠绕", desc: "造成1.5倍伤害并降低玩家攻击2回合", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; p.debuffAtk = { turns: 3, value: 3 }; return { dmg: d, msg: '🌿 苍古树精释放缠绕！攻击力降低' }; } },
    phase2: {
      name: "森林之王·万木之怒", atkMul: 1.2, defBonus: 4,
      skill: { name: "荆棘风暴", desc: "造成2倍伤害并附加2回合流血", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p.bleed = (p.bleed || 0) + 4; return { dmg: d, msg: '🌿💢 苍古树精召唤荆棘风暴！你开始流血' }; } }
    }
  },
  cave: {
    name: "矿洞主宰·晶石巨像", hp: 300, atk: 26, def: 10, exp: "坚不可摧", icon: "💎",
    skill: { name: "晶化", desc: "本回合防御翻倍并反弹伤害", fn: (e, p) => { if (!e._crystalDoubled) { e._crystalDoubled = true; e.def *= 2; } e._thorns = true; return { msg: '💎 晶石巨像晶化了！防御翻倍', crystal: true }; } },
    phase2: {
      name: "矿洞主宰·晶核暴走", atkMul: 1.5, defBonus: -3,
      skill: { name: "晶刺爆发", desc: "造成伤害并永久提升攻击3点", fn: (e, p) => { e.atk += 3; const d = Math.max(1, e.atk - p.def + 10); p.hp -= d; return { dmg: d, msg: '💎💢 晶核暴走！晶刺爆发！攻击力永久提升' }; } }
    }
  },
  ruins: {
    name: "废墟守护者·石像鬼", hp: 350, atk: 28, def: 8, exp: "千年沉睡", icon: "🗿",
    skill: { name: "石化凝视", desc: "造成伤害并有概率跳过玩家下回合", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 8); p.hp -= d; if (Math.random() < 0.4) p._stoneGaze = true; return { dmg: d, msg: '🗿 石像鬼释放石化凝视！' }; } },
    phase2: {
      name: "废墟守护者·觉醒", atkMul: 1.4, defBonus: 5,
      skill: { name: "远古诅咒", desc: "造成伤害+必定跳过玩家下回合+附加诅咒", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 12); p.hp -= d; p._stoneGaze = true; p.debuffAtk = { turns: 3, value: 4 }; return { dmg: d, msg: '🗿💢 石像鬼完全觉醒！远古诅咒降临！' }; } }
    }
  },
  frozen: {
    name: "冰原之主·霜翼巨鹰", hp: 380, atk: 30, def: 9, exp: "极寒风暴", icon: "🦅",
    skill: { name: "暴风雪", desc: "AOE伤害并降低玩家攻击1回合", fn: (e, p) => { const d = 15; p.hp -= d; p.debuffAtk = { turns: 2, value: 2 }; return { dmg: d, msg: '🦅 霜翼巨鹰召唤暴风雪！攻击力降低' }; } },
    phase2: {
      name: "冰原之主·永冻之翼", atkMul: 1.3, defBonus: 3,
      skill: { name: "绝对零度", desc: "造成25点固定伤害+冻结(眩晕)1回合", fn: (e, p) => { p.hp -= 25; p._stoneGaze = true; return { dmg: 25, msg: '🦅💢 绝对零度！冰封万物！下回合无法行动' }; } }
    }
  },
  voidgate: {
    name: "虚空守门人", hp: 450, atk: 34, def: 12, exp: "魔塔在前", icon: "🌀",
    skill: { name: "虚空裂隙", desc: "造成伤害并回复自身10%最大生命", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 5); p.hp -= d; const heal = Math.floor(e.maxHp * 0.1); e.hp = Math.min(e.maxHp, e.hp + heal); return { dmg: d, heal: heal, msg: '🌀 虚空守门人撕裂空间！回复了生命' }; } },
    phase2: {
      name: "虚空守门人·终焉", atkMul: 1.5, defBonus: 5,
      skill: { name: "虚空吞噬", desc: "造成1.5倍伤害+回复20%最大生命+减玩家灵力5", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; const heal = Math.floor(e.maxHp * 0.2); e.hp = Math.min(e.maxHp, e.hp + heal); p.mp = Math.max(0, p.mp - 5); return { dmg: d, heal: heal, msg: '🌀💢 虚空吞噬！生命力被吸走，灵力流失' }; } }
    }
  },
  tower: {
    name: "魔塔守门人", hp: 550, atk: 38, def: 15, exp: "简单模式·终极之战", icon: "🛡️",
    skill: { name: "魔塔之怒", desc: "全屏AOE，无视防御造成30点伤害", fn: (e, p) => { p.hp -= 30; return { dmg: 30, msg: '🏰 魔塔守门人释放魔塔之怒！无视防御造成伤害' }; } },
    phase2: {
      name: "魔塔守门人·灭世", atkMul: 1.6, defBonus: 8,
      skill: { name: "终焉审判", desc: "无视防御造成45点伤害+降低攻击5点", fn: (e, p) => { p.hp -= 45; p.debuffAtk = { turns: 4, value: 5 }; return { dmg: 45, msg: '🏰💢 终焉审判！魔塔的意志降临！' }; } }
    }
  }
});

// 无尽Boss —— 6个循环（每通关一次循环解锁下一组）
R.registerAll('endlessBosses', [
  { name: "深渊领主",      hp: 700, atk: 45, def: 18, exp: "深渊凝视", icon: "👁️",
    skill: { name: "深渊凝视", desc: "造成伤害+攻击降低", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 8); p.hp -= d; p.debuffAtk = { turns: 3, value: 4 }; return { dmg: d, msg: '👁️ 深渊凝视……你的灵魂在颤抖' }; } } },
  { name: "虚空吞噬者",    hp: 1000, atk: 55, def: 22, exp: "万物归虚", icon: "🌑",
    skill: { name: "归虚", desc: "大伤害+回复", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.8) - p.def); p.hp -= d; const heal = Math.floor(e.maxHp * 0.15); e.hp = Math.min(e.maxHp, e.hp + heal); return { dmg: d, heal: heal, msg: '🌑 万物归虚……' }; } } },
  { name: "混沌魔神·终焉", hp: 1500, atk: 70, def: 28, exp: "万物终结", icon: "☠️",
    skill: { name: "终焉", desc: "毁灭性伤害", fn: (e, p) => { p.hp -= 40; return { dmg: 40, msg: '☠️ 混沌魔神释放终焉之力！' }; } } },
  { name: "时空裂痕之主",  hp: 2000, atk: 85, def: 32, exp: "时间尽头", icon: "⏳",
    skill: { name: "时间回溯", desc: "造成伤害+回复自身30%生命+跳过玩家回合", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 5); p.hp -= d; const heal = Math.floor(e.maxHp * 0.3); e.hp = Math.min(e.maxHp, e.hp + heal); p._stoneGaze = true; return { dmg: d, heal: heal, msg: '⏳ 时间回溯！时空裂痕之主恢复了生命' }; } } },
  { name: "万魔之祖",      hp: 2800, atk: 100, def: 38, exp: "万魔朝拜", icon: "😈",
    skill: { name: "万魔噬心", desc: "造成50点固定伤害+降低全属性", fn: (e, p) => { p.hp -= 50; p.debuffAtk = { turns: 5, value: 8 }; p.def = Math.max(0, p.def - 5); return { dmg: 50, msg: '😈 万魔噬心！你的灵魂被撕裂' }; } } },
  { name: "妖塔之主·终极", hp: 4000, atk: 120, def: 45, exp: "超越一切", icon: "👑",
    skill: { name: "万物归无", desc: "造成80点固定伤害+回复满血", fn: (e, p) => { p.hp -= 80; e.hp = e.maxHp; return { dmg: 80, heal: e.maxHp, msg: '👑 万物归无……妖塔之主展现了真正的力量' }; } } }
]);
