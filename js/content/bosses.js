// Boss 配置 —— 全部含二阶段
import { R } from '../core/registry.js';

R.registerAll('bosses', {
  plains: {
    name: "平原领主·裂地者", hp: 150, atk: 18, def: 5, exp: "大地颤抖", icon: "🦏",
    intro: ["迷雾散开，大地开始震动……","一头如山丘般大小的巨兽，","从裂开的地面中缓缓爬出。","—— 平原领主 · 裂地者"],
    phase2Intro: ["裂地者的眼中燃起怒火！","大地在它脚下崩裂，岩浆喷涌……","它已不再只是野兽——","—— 平原领主 · 崩山者"],
    skill: { name: "地震", desc: "对玩家造成2倍攻击力伤害", fn: (e, p) => { const d = Math.max(1, e.atk * 2 - p.def); p.hp -= d; return { dmg: d, msg: '🌍 裂地者释放地震！' }; } },
    phase2: { name: "平原领主·崩山者", atkMul: 1.3, defBonus: 3,
      skill: { name: "大地崩裂", desc: "造成2.5倍伤害并降低玩家防御2回合", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2.5) - p.def); p.hp -= d; p.def = Math.max(0, p.def - 3); return { dmg: d, msg: '🌍💢 裂地者暴怒！大地崩裂！防御降低' }; } } }
  },
  forest: {
    name: "森林之王·苍古树精", hp: 220, atk: 22, def: 7, exp: "万木臣服", icon: "🌲",
    intro: ["幽暗的森林深处，万木忽然静默……","一棵参天古树睁开了眼睛。","千百年的根须即是它的手足，","整片森林，都是它的领域。","—— 森林之王 · 苍古树精"],
    phase2Intro: ["树精发出震耳欲聋的咆哮！","无数藤蔓从地底破土而出，","每一根都带着千年的怨念……","—— 森林之王 · 万木之怒"],
    skill: { name: "缠绕", desc: "造成1.5倍伤害并降低玩家攻击2回合", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; p.debuffAtk = { turns: 3, value: 3 }; return { dmg: d, msg: '🌿 苍古树精释放缠绕！攻击力降低' }; } },
    phase2: { name: "森林之王·万木之怒", atkMul: 1.2, defBonus: 4,
      skill: { name: "荆棘风暴", desc: "造成2倍伤害并附加2回合流血", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p.bleed = (p.bleed || 0) + 4; return { dmg: d, msg: '🌿💢 苍古树精召唤荆棘风暴！你开始流血' }; } } }
  },
  cave: {
    name: "矿洞主宰·晶石巨像", hp: 300, atk: 26, def: 10, exp: "坚不可摧", icon: "💎",
    intro: ["矿洞深处传来水晶碰撞的脆响……","无数晶石自行聚合，拼成一尊巨像。","它没有生命，却散发着远古的意志。","—— 矿洞主宰 · 晶石巨像"],
    phase2Intro: ["巨像体内的晶核开始狂暴地跳动！","晶刺如暴雨般从四面八方射来，","这尊古老的守卫，已不再克制自己。","—— 矿洞主宰 · 晶核暴走"],
    skill: { name: "晶化", desc: "本回合防御翻倍并反弹伤害", fn: (e, p) => { if (!e._crystalDoubled) { e._crystalDoubled = true; e.def *= 2; } return { msg: '💎 晶石巨像晶化了！防御翻倍', crystal: true }; } },
    phase2: { name: "矿洞主宰·晶核暴走", atkMul: 1.5, defBonus: -3,
      skill: { name: "晶刺爆发", desc: "造成伤害并永久提升攻击3点", fn: (e, p) => { e.atk += 3; const d = Math.max(1, e.atk - p.def + 10); p.hp -= d; return { dmg: d, msg: '💎💢 晶核暴走！晶刺爆发！攻击力永久提升' }; } } }
  },
  ruins: {
    name: "废墟守护者·石像鬼", hp: 350, atk: 28, def: 8, exp: "千年沉睡", icon: "🗿",
    intro: ["断壁残垣之间，一座石像缓缓转头……","它的目光穿透了千年的时光，","锁定在你的身上。","—— 废墟守护者 · 石像鬼"],
    phase2Intro: ["石像鬼的身体开始崩裂——","但裂痕中透出的不是碎石，","而是古老的咒文与不灭的怨念。","—— 废墟守护者 · 觉醒"],
    skill: { name: "石化凝视", desc: "造成伤害并有概率跳过玩家下回合", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 8); p.hp -= d; if (Math.random() < 0.4) p._stoneGaze = true; return { dmg: d, msg: '🗿 石像鬼释放石化凝视！' }; } },
    phase2: { name: "废墟守护者·觉醒", atkMul: 1.4, defBonus: 5,
      skill: { name: "远古诅咒", desc: "造成伤害+必定跳过玩家下回合+附加诅咒", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 12); p.hp -= d; p._stoneGaze = true; p.debuffAtk = { turns: 3, value: 4 }; return { dmg: d, msg: '🗿💢 石像鬼完全觉醒！远古诅咒降临！' }; } } }
  },
  frozen: {
    name: "冰原之主·霜翼巨鹰", hp: 380, atk: 30, def: 9, exp: "极寒风暴", icon: "🦅",
    intro: ["刺骨的寒风中，一道巨大的阴影掠过……","那是一双遮天蔽日的冰霜之翼。","它的每一次呼吸，都带来暴风雪。","—— 冰原之主 · 霜翼巨鹰"],
    phase2Intro: ["霜翼巨鹰发出刺耳的尖啸！","温度骤降至绝对零度。","连空气都开始凝结成冰……","—— 冰原之主 · 永冻之翼"],
    skill: { name: "暴风雪", desc: "AOE伤害并降低玩家攻击1回合", fn: (e, p) => { const d = 15; p.hp -= d; p.debuffAtk = { turns: 2, value: 2 }; return { dmg: d, msg: '🦅 霜翼巨鹰召唤暴风雪！攻击力降低' }; } },
    phase2: { name: "冰原之主·永冻之翼", atkMul: 1.3, defBonus: 3,
      skill: { name: "绝对零度", desc: "造成25点固定伤害+冻结(眩晕)1回合", fn: (e, p) => { p.hp -= 25; p._stoneGaze = true; return { dmg: 25, msg: '🦅💢 绝对零度！冰封万物！下回合无法行动' }; } } }
  },
  voidgate: {
    name: "虚空守门人", hp: 450, atk: 34, def: 12, exp: "魔塔在前", icon: "🌀",
    intro: ["现实在此处撕裂……","一道裂隙中，站着一个没有面孔的身影。","它身后，魔塔的轮廓已隐约可见。","—— 虚空守门人"],
    phase2Intro: ["守门人的身影开始扭曲、膨胀——","虚空中伸出无数触手般的裂缝，","贪婪地吞噬着周围的一切。","—— 虚空守门人 · 终焉"],
    skill: { name: "虚空裂隙", desc: "造成伤害并回复自身10%最大生命", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 5); p.hp -= d; const heal = Math.floor(e.maxHp * 0.1); e.hp = Math.min(e.maxHp, e.hp + heal); return { dmg: d, heal: heal, msg: '🌀 虚空守门人撕裂空间！回复了生命' }; } },
    phase2: { name: "虚空守门人·终焉", atkMul: 1.5, defBonus: 5,
      skill: { name: "虚空吞噬", desc: "造成1.5倍伤害+回复20%最大生命+减玩家2能量", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; const heal = Math.floor(e.maxHp * 0.2); e.hp = Math.min(e.maxHp, e.hp + heal); p.energy = Math.max(0, (p.energy||0) - 2); return { dmg: d, heal: heal, msg: '🌀💢 虚空吞噬！生命力被吸走，能量流失' }; } } }
  },
  tower: {
    name: "魔塔守门人", hp: 550, atk: 38, def: 15, exp: "简单模式·终极之战", icon: "🛡️",
    intro: ["魔塔的大门在你面前缓缓开启……","黑暗之中，一副铠甲凭空而立。","它没有主人——它自己就是主人。","—— 魔塔守门人"],
    phase2Intro: ["守门人的铠甲开始燃烧——","不，那不是火焰，","那是魔塔积蓄了千年的妖力。","—— 魔塔守门人 · 灭世"],
    skill: { name: "魔塔之怒", desc: "全屏AOE，无视防御造成30点伤害", fn: (e, p) => { p.hp -= 30; return { dmg: 30, msg: '🏰 魔塔守门人释放魔塔之怒！无视防御造成伤害' }; } },
    phase2: { name: "魔塔守门人·灭世", atkMul: 1.6, defBonus: 8,
      skill: { name: "终焉审判", desc: "无视防御造成45点伤害+降低攻击5点", fn: (e, p) => { p.hp -= 45; p.debuffAtk = { turns: 4, value: 5 }; return { dmg: 45, msg: '🏰💢 终焉审判！魔塔的意志降临！' }; } } }
  }
});

R.registerAll('endlessBosses', [
  { name: "深渊领主", hp: 700, atk: 45, def: 18, exp: "深渊凝视", icon: "👁️",
    skill: { name: "深渊凝视", desc: "造成伤害+攻击降低", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 8); p.hp -= d; p.debuffAtk = { turns: 3, value: 4 }; return { dmg: d, msg: '👁️ 深渊凝视……你的灵魂在颤抖' }; } } },
  { name: "虚空吞噬者", hp: 1000, atk: 55, def: 22, exp: "万物归虚", icon: "🌑",
    skill: { name: "归虚", desc: "大伤害+回复", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.8) - p.def); p.hp -= d; const heal = Math.floor(e.maxHp * 0.15); e.hp = Math.min(e.maxHp, e.hp + heal); return { dmg: d, heal: heal, msg: '🌑 万物归虚……' }; } } },
  { name: "混沌魔神·终焉", hp: 1500, atk: 70, def: 28, exp: "万物终结", icon: "☠️",
    skill: { name: "终焉", desc: "毁灭性伤害", fn: (e, p) => { p.hp -= 40; return { dmg: 40, msg: '☠️ 混沌魔神释放终焉之力！' }; } } },
  { name: "时空裂痕之主", hp: 2000, atk: 85, def: 32, exp: "时间尽头", icon: "⏳",
    skill: { name: "时间回溯", desc: "造成伤害+回复自身30%生命+跳过玩家回合", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 5); p.hp -= d; const heal = Math.floor(e.maxHp * 0.3); e.hp = Math.min(e.maxHp, e.hp + heal); p._stoneGaze = true; return { dmg: d, heal: heal, msg: '⏳ 时间回溯！时空裂痕之主恢复了生命' }; } } },
  { name: "万魔之祖", hp: 2800, atk: 100, def: 38, exp: "万魔朝拜", icon: "😈",
    skill: { name: "万魔噬心", desc: "造成50点固定伤害+降低全属性", fn: (e, p) => { p.hp -= 50; p.debuffAtk = { turns: 5, value: 8 }; p.def = Math.max(0, p.def - 5); return { dmg: 50, msg: '😈 万魔噬心！你的灵魂被撕裂' }; } } },
  { name: "妖塔之主·终极", hp: 4000, atk: 120, def: 45, exp: "超越一切", icon: "👑",
    skill: { name: "万物归无", desc: "造成80点固定伤害+回复满血", fn: (e, p) => { p.hp -= 80; e.hp = e.maxHp; return { dmg: 80, heal: e.maxHp, msg: '👑 万物归无……妖塔之主展现了真正的力量' }; } } }
]);

R.registerAll('bosses', {
  desert: {
    name: "沙漠之主·沙王", hp: 280, atk: 22, def: 6, exp: "万沙之王", icon: "🏜️",
    intro: ["热浪扭曲了视线……","黄沙之中，一尊巨大的身影缓缓升起。","它是沙漠的主宰，万沙之王。","—— 沙漠之主 · 沙王"],
    phase2Intro: ["沙王发出震天的咆哮！","沙暴席卷整个战场——","它的力量来自脚下无尽的黄沙。","—— 沙漠之主 · 沙暴化身"],
    skill: { name: "沙暴", desc: "造成伤害+降低玩家命中2回合", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 5); p.hp -= d; return { dmg: d, msg: '🏜️ 沙王召唤沙暴！命中率下降' }; } },
    phase2: { name: "沙漠之主·沙暴化身", atkMul: 1.4, defBonus: 3,
      skill: { name: "流沙吞噬", desc: "造成2倍伤害+吸血", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; const h = Math.floor(d * 0.3); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: d, msg: '🏜️💢 流沙吞噬！沙王吸取了你的生命' }; } } }
  },
  swamp: {
    name: "沼泽女王·藤母", hp: 320, atk: 20, def: 7, exp: "万藤之祖", icon: "🌿",
    intro: ["沼泽深处，无数藤蔓向你伸来……","它们汇成一张巨大的面孔。","沼泽的女王已经苏醒。","—— 沼泽女王 · 藤母"],
    phase2Intro: ["藤母发出刺耳的嘶吼！","成千上万的藤蔓从地底涌出——","每一根都带着腐沼的剧毒。","—— 沼泽女王 · 万藤之怒"],
    skill: { name: "缠绕", desc: "造成伤害+降低攻击2回合", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 3); p.hp -= d; p.debuffAtk = { turns: 3, value: 3 }; return { dmg: d, msg: '🌿 藤母释放缠绕！攻击力降低' }; } },
    phase2: { name: "沼泽女王·万藤之怒", atkMul: 1.3, defBonus: 4,
      skill: { name: "剧毒孢子", desc: "造成伤害+全屏中毒3回合", fn: (e, p) => { p.hp -= 12; p.bleed = (p.bleed || 0) + 5; return { dmg: 12, msg: '🌿💢 剧毒孢子爆发！你开始中毒' }; } } }
  },
  tower_lower: {
    name: "魔塔将军·铁壁", hp: 650, atk: 35, def: 18, exp: "魔塔军团长", icon: "🛡️",
    intro: ["魔塔的深处，沉重的脚步声回荡……","一副漆黑的铠甲挡在你的面前。","他是魔塔的将军，魔王最信任的部下。","—— 魔塔将军 · 铁壁"],
    phase2Intro: ["将军的铠甲开始崩裂——","但裂缝中透出的不是血肉，","而是纯粹的魔气。","—— 魔塔将军 · 魔化将军"],
    skill: { name: "军团冲锋", desc: "造成1.5倍伤害+召唤增援", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; e.atk += 2; return { dmg: d, msg: '🛡️ 铁壁发起军团冲锋！攻击力提升' }; } },
    phase2: { name: "魔塔将军·魔化", atkMul: 1.5, defBonus: 5,
      skill: { name: "魔气斩", desc: "造成2倍伤害+降低防御", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p.def = Math.max(0, p.def - 3); return { dmg: d, msg: '🛡️💢 魔气斩！防御被削弱' }; } } }
  }
});

// 炼狱专属Boss（20层出现）
R.registerAll('bosses_hell', {
  plains: {
    name: "平原霸主·裂地兽王", hp: 320, atk: 28, def: 8, exp: "万兽之王", icon: "🦍",
    intro: ["大地深处传来低沉的咆哮……","一头被魔气侵蚀的巨兽破土而出。","它是平原真正的王。","—— 平原霸主 · 裂地兽王"],
    phase2Intro: ["兽王的眼中燃烧着血色怒火！","它的每一次践踏都让大地崩裂——","魔气已经完全吞噬了它的理智。","—— 平原霸主 · 魔化兽王"],
    skill: { name: "大地崩裂", desc: "造成25点固定伤害+降低防御", fn: (e, p) => { p.hp -= 25; p.def = Math.max(0, p.def - 4); return { dmg: 25, msg: '🦍 兽王践踏！防御被削弱' }; } },
    phase2: { name: "平原霸主·魔化兽王", atkMul: 1.5, defBonus: 4,
      skill: { name: "狂暴冲击", desc: "造成2倍伤害+眩晕", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p._stoneGaze = true; return { dmg: d, msg: '🦍💢 狂暴冲击！你被眩晕' }; } } }
  },
  forest: {
    name: "森林意志·万森之主", hp: 380, atk: 30, def: 10, exp: "森林化身", icon: "🌲",
    intro: ["整片森林开始震颤……","树木的意志凝聚成了一道身影。","—— 森林意志 · 万森之主"],
    phase2Intro: ["森林的愤怒再也无法抑制！","所有树木都化作了它的武器。","—— 森林意志 · 万木审判"],
    skill: { name: "万木穿心", desc: "造成2倍伤害+流血", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 2) - p.def); p.hp -= d; p.bleed = (p.bleed||0)+6; return { dmg: d, msg: '🌲 万木穿心！你开始流血' }; } },
    phase2: { name: "森林意志·万木审判", atkMul: 1.4, defBonus: 5,
      skill: { name: "根须绞杀", desc: "造成30点伤害+吸血30%", fn: (e, p) => { p.hp -= 30; const h = Math.floor(30 * 0.3); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: 30, msg: '🌲💢 根须绞杀！森林吸取了你的生命' }; } } }
  },
  cave: {
    name: "矿洞深处·熔核之龙", hp: 450, atk: 34, def: 12, exp: "熔岩之龙", icon: "🐉",
    intro: ["矿洞深处传来滚烫的热浪……","一头全身流淌着岩浆的巨龙缓缓现身。","—— 矿洞深处 · 熔核之龙"],
    phase2Intro: ["熔核开始不稳定地跳动——","龙的身体被岩浆吞噬重组！","—— 矿洞深处 · 熔核暴龙"],
    skill: { name: "熔岩吐息", desc: "造成全体20点伤害", fn: (e, p) => { p.hp -= 20; return { dmg: 20, msg: '🐉 熔核之龙喷出熔岩吐息！' }; } },
    phase2: { name: "矿洞深处·熔核暴龙", atkMul: 1.6, defBonus: 2,
      skill: { name: "熔核爆发", desc: "造成35点伤害+永久提升攻击5", fn: (e, p) => { p.hp -= 35; e.atk += 5; return { dmg: 35, msg: '🐉💢 熔核爆发！攻击力永久提升' }; } } }
  },
  ruins: {
    name: "废墟古神·失落之眼", hp: 500, atk: 36, def: 14, exp: "远古之神", icon: "👁️",
    intro: ["废墟的中央，一只巨大的眼睛从地底睁开……","那是失落古神残留的意识。","—— 废墟古神 · 失落之眼"],
    phase2Intro: ["古神的意识完全苏醒！","无数只眼睛在虚空中睁开——","—— 废墟古神 · 全视之眼"],
    skill: { name: "凝视", desc: "造成伤害+必定跳过玩家回合", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 10); p.hp -= d; p._stoneGaze = true; return { dmg: d, msg: '👁️ 古神凝视！下回合无法行动' }; } },
    phase2: { name: "废墟古神·全视之眼", atkMul: 1.5, defBonus: 6,
      skill: { name: "精神崩坏", desc: "造成伤害+随机封印1技能2回合", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 15); p.hp -= d; return { dmg: d, msg: '👁️💢 精神崩坏！技能被封印' }; } } }
  },
  desert: {
    name: "沙漠死神·永恒之沙", hp: 420, atk: 32, def: 10, exp: "不死之王", icon: "💀",
    intro: ["沙丘之巅，一具古老的棺椁缓缓打开……","死亡的气息弥漫整个沙漠。","—— 沙漠死神 · 永恒之沙"],
    phase2Intro: ["死神发出了无声的尖啸！","黄沙汇聚成它的全新形态——","—— 沙漠死神 · 不朽法老"],
    skill: { name: "死亡诅咒", desc: "造成伤害+每回合扣5%最大生命3回合", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 8); p.hp -= d; p.bleed = (p.bleed||0)+Math.floor(p.maxHp*0.05); return { dmg: d, msg: '💀 死亡诅咒！生命持续流失' }; } },
    phase2: { name: "沙漠死神·不朽法老", atkMul: 1.4, defBonus: 5,
      skill: { name: "亡灵大军", desc: "造成伤害+回复满血", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 10); p.hp -= d; e.hp = e.maxHp; return { dmg: d, msg: '💀💢 亡灵大军！死神回复了全部生命' }; } } }
  },
  swamp: {
    name: "沼泽深渊·腐化之源", hp: 460, atk: 30, def: 11, exp: "腐化根源", icon: "☠️",
    intro: ["沼泽的中心，一道裂缝通向地底深渊……","腐化的源头从裂缝中涌出。","—— 沼泽深渊 · 腐化之源"],
    phase2Intro: ["腐化之源开始吞噬周围的一切！","沼泽化作了一片剧毒的炼狱——","—— 沼泽深渊 · 万毒之源"],
    skill: { name: "腐化蔓延", desc: "造成伤害+全属性降低2回合", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 5); p.hp -= d; p.debuffAtk = { turns: 3, value: 5 }; p.def = Math.max(0, p.def - 2); return { dmg: d, msg: '☠️ 腐化蔓延！全属性被削弱' }; } },
    phase2: { name: "沼泽深渊·万毒之源", atkMul: 1.5, defBonus: 3,
      skill: { name: "万毒噬心", desc: "造成35点固定伤害+每回合扣8HP持续3回合", fn: (e, p) => { p.hp -= 35; p.bleed = (p.bleed||0)+8; return { dmg: 35, msg: '☠️💢 万毒噬心！剧毒侵蚀' }; } } }
  },
  frozen: {
    name: "冰原之主·极寒之魂", hp: 520, atk: 36, def: 13, exp: "极寒化身", icon: "❄️",
    intro: ["暴风雪的中心，一道寒冰凝聚的身影……","它没有实体，只有纯粹的寒冷。","—— 冰原之主 · 极寒之魂"],
    phase2Intro: ["温度骤降至极限——","连时间都仿佛被冻结。","—— 冰原之主 · 绝对零度"],
    skill: { name: "暴风雪", desc: "造成全体25点伤害+迟缓", fn: (e, p) => { p.hp -= 25; return { dmg: 25, msg: '❄️ 极寒之魂召唤暴风雪！' }; } },
    phase2: { name: "冰原之主·绝对零度", atkMul: 1.5, defBonus: 5,
      skill: { name: "冰封纪元", desc: "造成40点伤害+冻结2回合", fn: (e, p) => { p.hp -= 40; p._stoneGaze = true; return { dmg: 40, msg: '❄️💢 冰封纪元！被冻结' }; } } }
  },
  voidgate: {
    name: "虚空主宰·维度撕裂者", hp: 600, atk: 42, def: 16, exp: "虚空之主", icon: "🌀",
    intro: ["裂隙中走出了一道无法描述的身影……","它的存在本身就在撕裂现实。","—— 虚空主宰 · 维度撕裂者"],
    phase2Intro: ["虚空主宰开始吞噬空间本身——","现实在它周围崩塌。","—— 虚空主宰 · 虚空之神"],
    skill: { name: "维度撕裂", desc: "造成伤害+回复20%生命", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 12); p.hp -= d; const h = Math.floor(e.maxHp*0.2); e.hp = Math.min(e.maxHp, e.hp + h); return { dmg: d, msg: '🌀 维度撕裂！虚空主宰吸取了空间能量' }; } },
    phase2: { name: "虚空主宰·虚空之神", atkMul: 1.7, defBonus: 6,
      skill: { name: "虚空湮灭", desc: "造成50点固定伤害+减3能量", fn: (e, p) => { p.hp -= 50; p.energy = Math.max(0, (p.energy||0) - 3); return { dmg: 50, msg: '🌀💢 虚空湮灭！能量被吞噬' }; } } }
  },
  tower: {
    name: "魔塔双卫·混沌双子", hp: 700, atk: 48, def: 20, exp: "魔王双子", icon: "👥",
    intro: ["魔塔之巅，两道身影并肩而立……","他们是魔王最忠诚的护卫。","—— 魔塔双卫 · 混沌双子"],
    phase2Intro: ["双子融合成了一体！","一具同时拥有光与暗的身躯——","—— 混沌双子 · 光暗一体"],
    skill: { name: "双子合击", desc: "造成两次攻击", fn: (e, p) => { const d = Math.max(1, e.atk - p.def + 8); p.hp -= d; p.hp -= Math.floor(d*0.6); return { dmg: d + Math.floor(d*0.6), msg: '👥 双子发动合击！' }; } },
    phase2: { name: "混沌双子·光暗一体", atkMul: 1.8, defBonus: 8,
      skill: { name: "光暗审判", desc: "造成60点固定伤害+全属性降低", fn: (e, p) => { p.hp -= 60; p.debuffAtk = { turns: 4, value: 5 }; p.def = Math.max(0, p.def - 4); return { dmg: 60, msg: '👥💢 光暗审判！全属性大幅降低' }; } } }
  },
  tower_upper: {
    name: "魔王·终焉", hp: 1000, atk: 45, def: 22, exp: "魔塔之主", icon: "👑",
    intro: ["魔塔的顶端，黑暗凝聚成实体……","一双猩红的眼睛在黑暗中睁开。","它就是魔塔的主人，万魔之王。","—— 魔王 · 终焉"],
    phase2Intro: ["魔王发出震彻天地的狂笑！","黑暗吞噬了所有的光——","现在，你面对的是真正的恶魔。","—— 魔王 · 真·魔王形态"],
    skill: { name: "黑暗降临", desc: "造成30点固定伤害+全属性降低", fn: (e, p) => { p.hp -= 30; p.debuffAtk = { turns: 4, value: 6 }; p.def = Math.max(0, p.def - 3); return { dmg: 30, msg: '👑 黑暗降临！全属性被削弱' }; } },
    phase2: { name: "魔王·真·终焉", atkMul: 1.8, defBonus: 10,
      skill: { name: "终焉审判", desc: "造成50点固定伤害+封印技能1回合", fn: (e, p) => { p.hp -= 50; p._stoneGaze = true; return { dmg: 50, msg: '👑💢 终焉审判！你的技能被封印' }; } }
    }
  }
});
