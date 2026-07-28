// Boss 配置
import { R } from '../core/registry.js';

R.registerAll('bosses', {
  1: { name: "平原领主·裂地者",  hp: 150, atk: 18, def: 5,  exp: "大地颤抖", icon: "🦏",
    skill: { name: "地震", desc: "对玩家造成2倍攻击力伤害", fn: (e, p) => { const d = Math.max(1, e.atk * 2 - p.def); p.hp -= d; return { dmg: d, msg: '🌍 裂地者释放地震！' }; } } },
  2: { name: "森林之王·苍古树精", hp: 220, atk: 22, def: 7,  exp: "万木臣服", icon: "🌲",
    skill: { name: "缠绕", desc: "造成1.5倍伤害并降低玩家攻击2回合", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; p.debuffAtk = { turns: 3, value: 3 }; return { dmg: d, msg: '🌿 苍古树精释放缠绕！攻击力降低' }; } } },
  3: { name: "矿洞主宰·晶石巨像", hp: 300, atk: 26, def: 10, exp: "坚不可摧", icon: "💎",
    skill: { name: "晶化", desc: "本回合防御翻倍并反弹伤害", fn: (e, p) => { e.def *= 2; e._thorns = true; return { msg: '💎 晶石巨像晶化了！防御翻倍', crystal: true }; } } },
  4: { name: "虚空守门人",         hp: 400, atk: 32, def: 12, exp: "魔塔在前", icon: "🌀",
    skill: { name: "虚空裂隙", desc: "造成伤害并回复自身10%最大生命", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 5); p.hp -= d; const heal = Math.floor(e.maxHp * 0.1); e.hp = Math.min(e.maxHp, e.hp + heal); return { dmg: d, heal: heal, msg: '🌀 虚空守门人撕裂空间！回复了生命' }; } } },
  5: { name: "魔塔守门人",         hp: 550, atk: 38, def: 15, exp: "简单模式·终极之战", icon: "🛡️",
    skill: { name: "魔塔之怒", desc: "全屏AOE，无视防御造成30点伤害", fn: (e, p) => { p.hp -= 30; return { dmg: 30, msg: '🏰 魔塔守门人释放魔塔之怒！无视防御造成伤害' }; } } }
});

R.registerAll('endlessBosses', [
  { name: "深渊领主",      hp: 700, atk: 45, def: 18, exp: "深渊凝视", icon: "👁️" },
  { name: "虚空吞噬者",    hp: 1000,atk: 55, def: 22, exp: "万物归虚", icon: "🌑" },
  { name: "混沌魔神·终焉", hp: 1500,atk: 70, def: 28, exp: "万物终结", icon: "☠️" }
]);
