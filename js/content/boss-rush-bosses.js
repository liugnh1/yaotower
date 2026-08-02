// ===================== Boss Rush 专属Boss池 v0.70 =====================
// 融合《传奇》与《地下城与勇士》经典Boss，按强度分4个梯队
// 属性为tier-0基础值，Boss Rush系统中会根据层级放大
import { R } from '../core/registry.js';

// ===== Tier 1: 新手过渡 (Boss Rush 第1-10战) =====
R.registerAll('bossRushT1', [
  { // 1
    id: 'br_skull_elf', name: '骷髅精灵', hp: 130, atk: 16, def: 4, icon: '💀',
    desc: '比奇矿区深处的亡灵', weakness: '圣光', weaknessDesc: '圣光击中后无法回血',
    skill: { name: '骨刺', desc: '造成1.5倍伤害', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; return { dmg: d, msg: '💀 骷髅精灵射出骨刺！' }; } },
    phase2: { name: '骷髅精灵·亡灵怒', atkMul: 1.3, defBonus: 2, skill: { name: '亡灵风暴', desc: '造成2倍伤害+吸血', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; const h = Math.floor(d * 0.25); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: d, heal: h, msg: '💀💢 亡灵风暴！骷髅精灵吸取了你的生命' }; } } }
  },
  { // 2
    id: 'br_corpse_king', name: '尸王', hp: 160, atk: 18, def: 5, icon: '🧟',
    desc: '僵尸矿洞的统治者', weakness: '火焰', weaknessDesc: '点燃时攻击减半',
    skill: { name: '尸毒', desc: '造成伤害+附加流血', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 4); p.hp -= d; p.bleed = (p.bleed || 0) + 3; return { dmg: d, msg: '🧟 尸王释放尸毒！你开始流血' }; } },
    phase2: { name: '尸王·尸变', atkMul: 1.4, defBonus: 2, skill: { name: '万尸噬心', desc: '全屏毒雾+流血', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 8); p.hp -= d; p.bleed = (p.bleed || 0) + 5; return { dmg: d, msg: '🧟💢 尸王尸变！万尸噬心！' }; } } }
  },
  { // 3
    id: 'br_goblin_king', name: '投掷哥布林', hp: 110, atk: 14, def: 2, icon: '👺',
    desc: '洛兰深处的哥布林头目', weakness: '冰霜', weaknessDesc: '冻结时无法投掷',
    skill: { name: '爆弹投掷', desc: 'AOE 12点伤害', fn: (e, p) => { p.hp -= 12; return { dmg: 12, msg: '👺 投掷哥布林扔出了爆弹！' }; } },
    phase2: { name: '哥布林·狂怒投手', atkMul: 1.5, defBonus: 1, skill: { name: '连环爆弹', desc: '20点AOE+眩晕概率', fn: (e, p) => { p.hp -= 20; if (Math.random() < 0.3) p._stoneGaze = true; return { dmg: 20, msg: '👺💢 连环爆弹！震耳欲聋！' }; } } }
  },
  { // 4
    id: 'br_tauren_chieftain', name: '半兽人统领', hp: 150, atk: 17, def: 4, icon: '🐗',
    desc: '比奇城外的兽人首领', weakness: '火焰', weaknessDesc: '点燃时防御减半',
    skill: { name: '狂暴冲锋', desc: '造成1.8倍伤害', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.8) - p.def); p.hp -= d; return { dmg: d, msg: '🐗 半兽统领发起狂暴冲锋！' }; } },
    phase2: { name: '半兽统领·兽化', atkMul: 1.5, defBonus: 2, skill: { name: '兽王咆哮', desc: '造成伤害+降防2回合', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p.def = Math.max(0, p.def - 2); return { dmg: d, msg: '🐗💢 兽王咆哮！防御被削弱' }; } } }
  },
  { // 5
    id: 'br_wooma_guard', name: '沃玛卫士', hp: 140, atk: 15, def: 6, icon: '🗿',
    desc: '沃玛寺庙的守护者', weakness: '暗影', weaknessDesc: '暗影步可穿甲',
    skill: { name: '重锤', desc: '造成伤害+眩晕概率', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 6); p.hp -= d; if (Math.random() < 0.3) p._stoneGaze = true; return { dmg: d, msg: '🗿 沃玛卫士挥动重锤！' }; } },
    phase2: { name: '沃玛卫士·觉醒', atkMul: 1.4, defBonus: 3, skill: { name: '地裂锤', desc: '2倍伤害+降防', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p.def = Math.max(0, p.def - 3); return { dmg: d, msg: '🗿💢 地裂锤！大地崩裂！' }; } } }
  },
  { // 6
    id: 'br_giant_beetle', name: '巨型多角虫', hp: 120, atk: 13, def: 8, icon: '🪲',
    desc: '沙层深处的巨型甲虫', weakness: '冰霜', weaknessDesc: '冻结时甲壳碎裂',
    skill: { name: '冲撞', desc: '造成伤害+自身防御+3', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 3); p.hp -= d; e.def += 3; return { dmg: d, msg: '🪲 巨型多角虫缩壳冲撞！防御提升' }; } },
    phase2: { name: '巨型多角虫·狂化', atkMul: 1.3, defBonus: 4, skill: { name: '角突猛击', desc: '2倍伤害+眩晕', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p._stoneGaze = true; return { dmg: d, msg: '🪲💢 角突猛击！你被顶晕了' }; } } }
  },
  { // 7
    id: 'br_thunder_keno', name: '落雷凯诺', hp: 135, atk: 16, def: 3, icon: '⚡',
    desc: '雷鸣废墟的哥布林法师', weakness: '暗影', weaknessDesc: '暗影步可打断施法',
    skill: { name: '落雷', desc: '无视防御15点伤害', fn: (e, p) => { p.hp -= 15; return { dmg: 15, msg: '⚡ 落雷凯诺召唤天雷！' }; } },
    phase2: { name: '落雷凯诺·雷神', atkMul: 1.4, defBonus: 2, skill: { name: '雷暴', desc: '25点固定伤害+降攻', fn: (e, p) => { p.hp -= 25; p.debuffAtk = { turns: 2, value: 3 }; return { dmg: 25, msg: '⚡💢 雷暴降临！攻击力被削弱' }; } } }
  },
  { // 8
    id: 'br_tauren_beast', name: '牛头巨兽', hp: 170, atk: 19, def: 5, icon: '🐂',
    desc: '格兰之森的巨兽', weakness: '火焰', weaknessDesc: '燃烧时攻击减半',
    skill: { name: '巨角冲撞', desc: '2倍伤害', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; return { dmg: d, msg: '🐂 牛头巨兽发起巨角冲撞！' }; } },
    phase2: { name: '牛头巨兽·暴怒', atkMul: 1.5, defBonus: 1, skill: { name: '狂牛践踏', desc: '25点AOE', fn: (e, p) => { p.hp -= 25; return { dmg: 25, msg: '🐂💢 狂牛践踏！整个战场都在震动' }; } } }
  }
]);

// ===== Tier 2: 进阶攻坚 (Boss Rush 第11-20战) =====
R.registerAll('bossRushT2', [
  { // 1
    id: 'br_wooma_king', name: '沃玛教主', hp: 280, atk: 24, def: 8, icon: '👹',
    desc: '沃玛寺庙之主', weakness: '圣光', weaknessDesc: '圣光下无法回血',
    skill: { name: '暗黑天幕', desc: '造成伤害+降攻2回合', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 8); p.hp -= d; p.debuffAtk = { turns: 2, value: 4 }; return { dmg: d, msg: '👹 沃玛教主释放暗黑天幕！攻击力降低' }; } },
    phase2: { name: '沃玛教主·魔神化', atkMul: 1.5, defBonus: 4, skill: { name: '魔神降临', desc: '2倍伤害+全属性降低', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p.debuffAtk = { turns: 3, value: 5 }; p.def = Math.max(0, p.def - 2); return { dmg: d, msg: '👹💢 魔神降临！全属性被削弱' }; } } }
  },
  { // 2
    id: 'br_white_boar', name: '白野猪', hp: 320, atk: 26, def: 9, icon: '🐗',
    desc: '石墓七层的小白', weakness: '冰霜', weaknessDesc: '冻结时无法冲锋',
    skill: { name: '野蛮冲撞', desc: '2倍伤害+自身回血', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; const h = Math.floor(e.maxHp * 0.1); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: d, heal: h, msg: '🐗 白野猪发起野蛮冲撞！' }; } },
    phase2: { name: '白野猪·狂暴', atkMul: 1.4, defBonus: 3, skill: { name: '猪突猛进', desc: '2.5倍伤害+眩晕', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2.5) - p.def); p.hp -= d; p._stoneGaze = true; return { dmg: d, msg: '🐗💢 猪突猛进！被撞晕了' }; } } }
  },
  { // 3
    id: 'br_evil_scorpion', name: '邪恶钳虫', hp: 250, atk: 22, def: 10, icon: '🦂',
    desc: '蜈蚣洞的巨型钳虫', weakness: '火焰', weaknessDesc: '燃烧时甲壳软化-5防',
    skill: { name: '巨钳绞杀', desc: '造成伤害+中毒', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 6); p.hp -= d; p.bleed = (p.bleed || 0) + 4; return { dmg: d, msg: '🦂 邪恶钳虫钳住你！剧毒入体' }; } },
    phase2: { name: '邪恶钳虫·毒化', atkMul: 1.4, defBonus: 2, skill: { name: '万毒钳', desc: '伤害+每回合8点中毒', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 10); p.hp -= d; p.bleed = (p.bleed || 0) + 8; return { dmg: d, msg: '🦂💢 万毒钳！剧毒侵蚀全身' }; } } }
  },
  { // 4
    id: 'br_dragon_worm', name: '触龙神', hp: 300, atk: 23, def: 7, icon: '🐉',
    desc: '蜈蚣洞死亡棺材的主宰', weakness: '冰霜', weaknessDesc: '冻结时无法钻地',
    skill: { name: '毒雾喷吐', desc: 'AOE 18点伤害+全体中毒', fn: (e, p) => { p.hp -= 18; p.bleed = (p.bleed || 0) + 3; return { dmg: 18, msg: '🐉 触龙神喷吐毒雾！' }; } },
    phase2: { name: '触龙神·真龙变', atkMul: 1.5, defBonus: 4, skill: { name: '龙息', desc: '30点固定伤害+眩晕', fn: (e, p) => { p.hp -= 30; p._stoneGaze = true; return { dmg: 30, msg: '🐉💢 龙息！灼热的气浪席卷战场' }; } } }
  },
  { // 5
    id: 'br_stone_corpse_king', name: '石墓尸王', hp: 350, atk: 28, def: 11, icon: '🧟',
    desc: '石墓深处的尸王', weakness: '圣光', weaknessDesc: '圣光下无法复活',
    skill: { name: '尸爆', desc: '造成伤害+自爆回血', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; const h = Math.floor(d * 0.3); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: d, heal: h, msg: '🧟 石墓尸王引爆尸体！吸取了生命' }; } },
    phase2: { name: '石墓尸王·不灭', atkMul: 1.6, defBonus: 3, skill: { name: '亡灵大军', desc: '伤害+召唤(回复满血)', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 12); p.hp -= d; e.hp = e.maxHp; return { dmg: d, msg: '🧟💢 亡灵大军！尸王回复了全部生命' }; } } }
  },
  { // 6
    id: 'br_zuma_king', name: '祖玛教主', hp: 380, atk: 30, def: 9, icon: '👑',
    desc: '祖玛寺庙的最终守护者', weakness: '圣光', weaknessDesc: '圣光下防御减半',
    skill: { name: '祖玛之怒', desc: '造成伤害+降防2回合', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 10); p.hp -= d; p.def = Math.max(0, p.def - 3); return { dmg: d, msg: '👑 祖玛教主降下神罚！防御被削弱' }; } },
    phase2: { name: '祖玛教主·神化', atkMul: 1.6, defBonus: 5, skill: { name: '天罚', desc: '无视防御40点伤害', fn: (e, p) => { p.hp -= 40; return { dmg: 40, msg: '👑💢 天罚！祖玛教主的意志降临' }; } } }
  },
  { // 7
    id: 'br_hongmo_king', name: '虹魔教主', hp: 340, atk: 27, def: 8, icon: '👿',
    desc: '封魔殿的主人', weakness: '暗影', weaknessDesc: '暗影步可破魔盾',
    skill: { name: '虹魔大法', desc: '造成伤害+吸血40%', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 7); p.hp -= d; const h = Math.floor(d * 0.4); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: d, heal: h, msg: '👿 虹魔教主施展虹魔大法！吸取生命' }; } },
    phase2: { name: '虹魔教主·血魔', atkMul: 1.5, defBonus: 3, skill: { name: '血魔大法', desc: '2倍伤害+吸血60%+降攻', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; const h = Math.floor(d * 0.6); e.hp = Math.min(e.maxHp, e.hp + h); p.debuffAtk = { turns: 2, value: 3 }; return { dmg: d, heal: h, msg: '👿💢 血魔大法！你的力量被吸走' }; } } }
  },
  { // 8
    id: 'br_light_king', name: '光之城主赛格哈特', hp: 360, atk: 29, def: 10, icon: '⚔️',
    desc: '天空之城主宰', weakness: '暗影', weaknessDesc: '暗影步可穿过光盾',
    skill: { name: '光之剑', desc: '造成1.8倍伤害', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.8) - p.def); p.hp -= d; return { dmg: d, msg: '⚔️ 光之城主挥出光之剑！' }; } },
    phase2: { name: '光之城主·觉醒', atkMul: 1.5, defBonus: 5, skill: { name: '万光归一', desc: '无视防御35点伤害', fn: (e, p) => { p.hp -= 35; p.debuffAtk = { turns: 3, value: 4 }; return { dmg: 35, msg: '⚔️💢 万光归一！光明吞噬一切' }; } } }
  },
  { // 9
    id: 'br_underworld_king', name: '黄泉教主', hp: 330, atk: 25, def: 9, icon: '💀',
    desc: '苍月岛骨魔洞之主', weakness: '圣光', weaknessDesc: '圣光下无法召唤',
    skill: { name: '黄泉引路', desc: '造成伤害+降攻降防', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 6); p.hp -= d; p.debuffAtk = { turns: 2, value: 4 }; p.def = Math.max(0, p.def - 2); return { dmg: d, msg: '💀 黄泉教主引路黄泉！全属性削弱' }; } },
    phase2: { name: '黄泉教主·阎罗', atkMul: 1.5, defBonus: 4, skill: { name: '阎罗令', desc: '35点固定伤害+全属性降低', fn: (e, p) => { p.hp -= 35; p.debuffAtk = { turns: 3, value: 5 }; p.def = Math.max(0, p.def - 3); return { dmg: 35, msg: '💀💢 阎罗令！生死簿上已写下你的名字' }; } } }
  },
  { // 10
    id: 'br_bull_demon_king', name: '牛魔王', hp: 400, atk: 32, def: 10, icon: '🐂',
    desc: '苍月岛牛魔寺庙之主', weakness: '火焰', weaknessDesc: '燃烧时狂暴解除',
    skill: { name: '牛魔冲撞', desc: '2倍伤害', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; return { dmg: d, msg: '🐂 牛魔王发起冲撞！' }; } },
    phase2: { name: '牛魔王·魔化', atkMul: 1.6, defBonus: 4, skill: { name: '魔王践踏', desc: '2.5倍伤害+眩晕+降防', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2.5) - p.def); p.hp -= d; p._stoneGaze = true; p.def = Math.max(0, p.def - 4); return { dmg: d, msg: '🐂💢 魔王践踏！天地为之震颤' }; } } }
  }
]);

// ===== Tier 3: 困难挑战 (Boss Rush 第21-35战) =====
R.registerAll('bossRushT3', [
  { // 1
    id: 'br_red_moon_demon', name: '赤月恶魔', hp: 520, atk: 36, def: 13, icon: '🌕',
    desc: '赤月峡谷的远古恶魔', weakness: '圣光', weaknessDesc: '圣光下攻击大幅削弱',
    skill: { name: '赤月诅咒', desc: '造成伤害+降全属性2回合', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 12); p.hp -= d; p.debuffAtk = { turns: 3, value: 5 }; p.def = Math.max(0, p.def - 3); return { dmg: d, msg: '🌕 赤月恶魔降下诅咒！全属性削弱' }; } },
    phase2: { name: '赤月恶魔·真身', atkMul: 1.7, defBonus: 5, skill: { name: '血月降临', desc: '无视防御45点伤害+吸血', fn: (e, p) => { p.hp -= 45; const h = Math.floor(45 * 0.5); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: 45, heal: h, msg: '🌕💢 血月降临！赤月恶魔展现真身' }; } } }
  },
  { // 2
    id: 'br_blood_demon', name: '双头血魔', hp: 550, atk: 38, def: 11, icon: '👹',
    desc: '石墓阵的远古血魔', weakness: '冰霜', weaknessDesc: '冻结时无法分裂',
    skill: { name: '血之祭献', desc: '造成伤害+自身回血15%', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; const h = Math.floor(e.maxHp * 0.15); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: d, heal: h, msg: '👹 双头血魔祭献血液！回复了生命' }; } },
    phase2: { name: '双头血魔·融合', atkMul: 1.6, defBonus: 6, skill: { name: '血海滔天', desc: '50点固定伤害+吸血50%', fn: (e, p) => { p.hp -= 50; const h = Math.floor(50 * 0.5); e.hp = Math.min(e.maxHp, e.hp + h); p.bleed = (p.bleed || 0) + 6; return { dmg: 50, heal: h, msg: '👹💢 血海滔天！双头血魔融为一体' }; } } }
  },
  { // 3
    id: 'br_double_gold', name: '双头金刚', hp: 500, atk: 35, def: 14, icon: '💪',
    desc: '石墓阵的黄金巨人', weakness: '暗影', weaknessDesc: '暗影步可找弱点击破',
    skill: { name: '金刚拳', desc: '2倍伤害+眩晕概率', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; if (Math.random() < 0.4) p._stoneGaze = true; return { dmg: d, msg: '💪 双头金刚挥出金刚拳！' }; } },
    phase2: { name: '双头金刚·怒目', atkMul: 1.5, defBonus: 7, skill: { name: '金刚怒目', desc: '2.5倍伤害+破防', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2.5) - p.def); p.hp -= d; p.def = Math.max(0, p.def - 5); return { dmg: d, msg: '💪💢 金刚怒目！防御被击碎' }; } } }
  },
  { // 4
    id: 'br_dragon_lord', name: '魔龙教主', hp: 600, atk: 40, def: 15, icon: '🐲',
    desc: '魔龙血域的霸主', weakness: '冰霜', weaknessDesc: '冰冻时龙息失效',
    skill: { name: '魔龙吐息', desc: '全员25点伤害', fn: (e, p) => { p.hp -= 25; return { dmg: 25, msg: '🐲 魔龙教主喷出魔龙吐息！' }; } },
    phase2: { name: '魔龙教主·真龙', atkMul: 1.8, defBonus: 5, skill: { name: '真龙天火', desc: '50点固定伤害+眩晕', fn: (e, p) => { p.hp -= 50; p._stoneGaze = true; return { dmg: 50, msg: '🐲💢 真龙天火！焚尽八荒' }; } } }
  },
  { // 5
    id: 'br_dark_bull_king', name: '暗之牛魔王', hp: 560, atk: 42, def: 10, icon: '🐃',
    desc: '牛魔王的暗影分身', weakness: '圣光', weaknessDesc: '圣光下暗影消散',
    skill: { name: '暗影冲撞', desc: '2倍伤害+降攻', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p.debuffAtk = { turns: 2, value: 4 }; return { dmg: d, msg: '🐃 暗之牛魔王发起暗影冲撞！' }; } },
    phase2: { name: '暗之牛魔王·噬光', atkMul: 1.7, defBonus: 4, skill: { name: '暗黑天幕', desc: '45点固定伤害+减2能量', fn: (e, p) => { p.hp -= 45; p.energy = Math.max(0, (p.energy || 0) - 2); return { dmg: 45, msg: '🐃💢 暗黑天幕！能量被吞噬' }; } } }
  },
  { // 6
    id: 'br_lotus', name: '长脚罗特斯', hp: 530, atk: 34, def: 12, icon: '🐙',
    desc: '第八使徒·天帷巨兽的支配者', weakness: '火焰', weaknessDesc: '火焰下触手萎缩',
    skill: { name: '触手缠绕', desc: '造成伤害+降攻+束缚', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; p.debuffAtk = { turns: 3, value: 4 }; return { dmg: d, msg: '🐙 罗特斯的触手缠绕了你！' }; } },
    phase2: { name: '罗特斯·真身', atkMul: 1.6, defBonus: 5, skill: { name: '精神控制', desc: '伤害+跳过玩家回合+吸血', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 15); p.hp -= d; p._stoneGaze = true; const h = Math.floor(e.maxHp * 0.2); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: d, heal: h, msg: '🐙💢 精神控制！你的意志被侵蚀' }; } } }
  },
  { // 7
    id: 'br_bug_king', name: '虫王戮蛊', hp: 480, atk: 33, def: 16, icon: '🐛',
    desc: '悲鸣洞穴的虫王', weakness: '火焰', weaknessDesc: '燃烧时虫壳脆化',
    skill: { name: '虫群风暴', desc: 'AOE 20点伤害+中毒', fn: (e, p) => { p.hp -= 20; p.bleed = (p.bleed || 0) + 5; return { dmg: 20, msg: '🐛 虫王释放虫群风暴！毒虫噬体' }; } },
    phase2: { name: '虫王戮蛊·暴走', atkMul: 1.7, defBonus: 4, skill: { name: '戮蛊钻心', desc: '无视防御40点伤害+剧毒', fn: (e, p) => { p.hp -= 40; p.bleed = (p.bleed || 0) + 10; return { dmg: 40, msg: '🐛💢 戮蛊钻心！幼虫钻入体内' }; } } }
  },
  { // 8
    id: 'br_ice_dragon', name: '冰龙斯卡萨', hp: 580, atk: 37, def: 13, icon: '🐉',
    desc: '万年雪山的冰霜巨龙', weakness: '火焰', weaknessDesc: '燃烧时冰甲融化',
    skill: { name: '冰霜吐息', desc: '全员22点伤害+迟缓', fn: (e, p) => { p.hp -= 22; p.debuffAtk = { turns: 2, value: 3 }; return { dmg: 22, msg: '🐉 冰龙斯卡萨喷出冰霜吐息！' }; } },
    phase2: { name: '斯卡萨·暴风雪', atkMul: 1.7, defBonus: 6, skill: { name: '绝对零度', desc: '45点伤害+冻结(跳过回合)', fn: (e, p) => { p.hp -= 45; p._stoneGaze = true; return { dmg: 45, msg: '🐉💢 绝对零度！时空都被冻结' }; } } }
  },
  { // 9
    id: 'br_headless_knight', name: '无头骑士', hp: 510, atk: 39, def: 11, icon: '🐴',
    desc: '暗黑城入口的诅咒骑士', weakness: '圣光', weaknessDesc: '圣光下诅咒解除',
    skill: { name: '诅咒之枪', desc: '2倍伤害+降防', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p.def = Math.max(0, p.def - 3); return { dmg: d, msg: '🐴 无头骑士掷出诅咒之枪！' }; } },
    phase2: { name: '无头骑士·怨念', atkMul: 1.6, defBonus: 5, skill: { name: '怨念风暴', desc: '40点伤害+降全属性', fn: (e, p) => { p.hp -= 40; p.debuffAtk = { turns: 3, value: 5 }; p.def = Math.max(0, p.def - 4); return { dmg: 40, msg: '🐴💢 怨念风暴！无尽的怨恨席卷而来' }; } } }
  },
  { // 10
    id: 'br_mecha_bull', name: '牛头械王', hp: 620, atk: 41, def: 17, icon: '🤖',
    desc: '比尔马克帝国试验场的机械巨兽', weakness: '暗影', weaknessDesc: '暗影步可瘫痪电路',
    skill: { name: '机械冲撞', desc: '造成伤害+自身防御+5', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.8) - p.def); p.hp -= d; e.def += 5; return { dmg: d, msg: '🤖 牛头械王发起机械冲撞！装甲强化' }; } },
    phase2: { name: '牛头械王·过载', atkMul: 1.8, defBonus: 3, skill: { name: '全弹发射', desc: '55点固定AOE伤害', fn: (e, p) => { p.hp -= 55; return { dmg: 55, msg: '🤖💢 全弹发射！导弹覆盖了整个战场' }; } } }
  }
]);

// ===== Tier 4: 终极使徒 (Boss Rush 第36-50战) =====
R.registerAll('bossRushT4', [
  { // 1
    id: 'br_anton', name: '火焰吞噬者·安徒恩', hp: 900, atk: 55, def: 20, icon: '🔥',
    desc: '第七使徒·魔界的火焰巨兽', weakness: '冰霜', weaknessDesc: '冰霜下火焰核心冷却',
    skill: { name: '灭世之焰', desc: '全员35点伤害+全体燃烧', fn: (e, p) => { p.hp -= 35; p.bleed = (p.bleed || 0) + 6; return { dmg: 35, msg: '🔥 安徒恩喷出灭世之焰！大地化为焦土' }; } },
    phase2: { name: '安徒恩·火山核心', atkMul: 2.0, defBonus: 8, skill: { name: '火山爆发', desc: '60点固定伤害+全属性降低', fn: (e, p) => { p.hp -= 60; p.debuffAtk = { turns: 4, value: 8 }; p.def = Math.max(0, p.def - 5); return { dmg: 60, msg: '🔥💢 火山爆发！安徒恩的核心完全激活' }; } } }
  },
  { // 2
    id: 'br_bakal', name: '爆龙王·巴卡尔', hp: 1000, atk: 60, def: 22, icon: '🐲',
    desc: '龙族之王·第九使徒', weakness: '暗影', weaknessDesc: '暗影下龙威减弱',
    skill: { name: '龙之怒', desc: '2倍伤害+降防', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p.def = Math.max(0, p.def - 5); return { dmg: d, msg: '🐲 巴卡尔释放龙之怒！防御崩碎' }; } },
    phase2: { name: '巴卡尔·龙王真身', atkMul: 2.0, defBonus: 10, skill: { name: '龙神裁决', desc: '无视防御70点伤害', fn: (e, p) => { p.hp -= 70; p._stoneGaze = true; return { dmg: 70, msg: '🐲💢 龙神裁决！巴卡尔的终焉之力' }; } } }
  },
  { // 3
    id: 'br_ozma', name: '混沌之神·奥兹玛', hp: 950, atk: 58, def: 19, icon: '👁️',
    desc: '第十使徒·混沌的化身', weakness: '圣光', weaknessDesc: '圣光下混沌消散',
    skill: { name: '混沌侵蚀', desc: '造成伤害+随机封印技能CD+2', fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 18); p.hp -= d; return { dmg: d, msg: '👁️ 奥兹玛释放混沌侵蚀！现实开始扭曲' }; } },
    phase2: { name: '奥兹玛·混沌真神', atkMul: 2.1, defBonus: 8, skill: { name: '混沌审判', desc: '65点伤害+减3能量+降全属性', fn: (e, p) => { p.hp -= 65; p.energy = Math.max(0, (p.energy || 0) - 3); p.debuffAtk = { turns: 4, value: 8 }; p.def = Math.max(0, p.def - 4); return { dmg: 65, msg: '👁️💢 混沌审判！奥兹玛撕裂了现实' }; } } }
  },
  { // 4
    id: 'br_luke', name: '制造者·卢克', hp: 850, atk: 52, def: 21, icon: '🔮',
    desc: '第九使徒·光与暗的支配者', weakness: '暗影', weaknessDesc: '暗影可绕过光盾',
    skill: { name: '光暗转换', desc: '造成伤害+自身回血20%', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; const h = Math.floor(e.maxHp * 0.2); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: d, heal: h, msg: '🔮 卢克转换光暗能量！回复了生命' }; } },
    phase2: { name: '卢克·光暗一体', atkMul: 1.9, defBonus: 10, skill: { name: '创世之光', desc: '55点固定伤害+眩晕', fn: (e, p) => { p.hp -= 55; p._stoneGaze = true; e.atk += 10; return { dmg: 55, msg: '🔮💢 创世之光！卢克展现了真正的力量' }; } } }
  },
  { // 5
    id: 'br_diregie', name: '黑色瘟疫·狄瑞吉', hp: 880, atk: 50, def: 16, icon: '☠️',
    desc: '第六使徒·瘟疫之源', weakness: '火焰', weaknessDesc: '火焰净化瘟疫',
    skill: { name: '瘟疫蔓延', desc: '全员25点伤害+全体中毒5回合', fn: (e, p) => { p.hp -= 25; p.bleed = (p.bleed || 0) + 8; return { dmg: 25, msg: '☠️ 狄瑞吉释放瘟疫！剧毒在空气中蔓延' }; } },
    phase2: { name: '狄瑞吉·万疫之源', atkMul: 1.9, defBonus: 6, skill: { name: '致死瘟疫', desc: '50点伤害+每回合扣10HP', fn: (e, p) => { p.hp -= 50; p.bleed = (p.bleed || 0) + 10; p.debuffAtk = { turns: 4, value: 6 }; return { dmg: 50, msg: '☠️💢 致死瘟疫！万物凋零' }; } } }
  },
  { // 6
    id: 'br_sirocco', name: '潜行者·希洛克', hp: 920, atk: 56, def: 17, icon: '🌑',
    desc: '第五使徒·阴影中的猎手', weakness: '圣光', weaknessDesc: '圣光下无处遁形',
    skill: { name: '暗影突袭', desc: '3倍伤害+自身扣10%生命', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 3) - p.def); p.hp -= d; e.hp -= Math.floor(e.maxHp * 0.1); return { dmg: d, msg: '🌑 希洛克从阴影中发起致命一击！' }; } },
    phase2: { name: '希洛克·无形', atkMul: 2.1, defBonus: 5, skill: { name: '无形斩', desc: '无视防御65点伤害+必闪玩家下回合', fn: (e, p) => { p.hp -= 65; p._stoneGaze = true; return { dmg: 65, msg: '🌑💢 无形斩！希洛克超越了维度' }; } } }
  },
  { // 7
    id: 'br_prey', name: '天骄·普雷', hp: 980, atk: 62, def: 20, icon: '🦅',
    desc: '第三使徒·苍穹之王', weakness: '暗影', weaknessDesc: '暗影步可近身',
    skill: { name: '天之裁决', desc: '全员30点伤害+降攻', fn: (e, p) => { p.hp -= 30; p.debuffAtk = { turns: 3, value: 6 }; return { dmg: 30, msg: '🦅 普雷降下天之裁决！攻击力被压制' }; } },
    phase2: { name: '普雷·苍穹霸主', atkMul: 2.0, defBonus: 9, skill: { name: '苍穹坠', desc: '无视防御65点伤害+减3能量', fn: (e, p) => { p.hp -= 65; p.energy = Math.max(0, (p.energy || 0) - 3); return { dmg: 65, msg: '🦅💢 苍穹坠！天空崩塌' }; } } }
  },
  { // 8
    id: 'br_kane', name: '宿命者·卡恩', hp: 1200, atk: 68, def: 25, icon: '👑',
    desc: '第一使徒·无敌的存在', weakness: null, weaknessDesc: '传说中没有弱点',
    skill: { name: '命运裁决', desc: '无视防御40点伤害+降全属性', fn: (e, p) => { p.hp -= 40; p.debuffAtk = { turns: 4, value: 8 }; p.def = Math.max(0, p.def - 5); return { dmg: 40, msg: '👑 卡恩降下命运裁决！万物皆在宿命之中' }; } },
    phase2: { name: '卡恩·终焉', atkMul: 2.3, defBonus: 12, skill: { name: '终焉之刻', desc: '无视防御85点伤害+封印+减5能量', fn: (e, p) => { p.hp -= 85; p._stoneGaze = true; p.energy = Math.max(0, (p.energy || 0) - 5); return { dmg: 85, msg: '👑💢 终焉之刻！卡恩展现了第一使徒的真正力量' }; } } }
  },
  { // 9
    id: 'br_derast', name: '纯血者·德瓦斯特', hp: 870, atk: 54, def: 18, icon: '🩸',
    desc: '洞察之眼的纯血恶魔', weakness: '火焰', weaknessDesc: '火焰可焚烧血池',
    skill: { name: '血池', desc: '造成伤害+吸血50%+流血', fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.8) - p.def); p.hp -= d; const h = Math.floor(d * 0.5); e.hp = Math.min(e.maxHp, e.hp + h); p.bleed = (p.bleed || 0) + 5; return { dmg: d, heal: h, msg: '🩸 德瓦斯特将你拖入血池！' }; } },
    phase2: { name: '德瓦斯特·血神', atkMul: 1.9, defBonus: 7, skill: { name: '血之盛宴', desc: '60点伤害+吸血100%', fn: (e, p) => { p.hp -= 60; e.hp = e.maxHp; return { dmg: 60, msg: '🩸💢 血之盛宴！德瓦斯特回复了全部生命' }; } } }
  },
  { // 10
    id: 'br_berias', name: '毁灭之贝利亚斯', hp: 940, atk: 60, def: 22, icon: '💥',
    desc: '黑鸦之境的毁灭使者', weakness: '冰霜', weaknessDesc: '冻结时毁灭之力停滞',
    skill: { name: '毁灭风暴', desc: '全员35点AOE伤害', fn: (e, p) => { p.hp -= 35; return { dmg: 35, msg: '💥 贝利亚斯召唤毁灭风暴！' }; } },
    phase2: { name: '贝利亚斯·湮灭', atkMul: 2.0, defBonus: 9, skill: { name: '湮灭', desc: '70点固定伤害+降防归零', fn: (e, p) => { p.hp -= 70; p.def = Math.max(0, p.def - 8); return { dmg: 70, msg: '💥💢 湮灭！万物归于虚空' }; } } }
  }
]);
