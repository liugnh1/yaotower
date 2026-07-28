// ===================== 战斗系统 v0.33 =====================
// 新增：Boss二阶段、精英词条扩展、装备前缀战斗效果、遗物羁绊战斗集成、敌人意图系统
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';
import { playSound } from '../core/audio.js';
import { addBuff, tickBuffs, hasBuff, removeBuff } from './buff.js';

let _onWin = null, _onOver = null, _autoTimer = null;
export function setCB(w, o) { _onWin = w; _onOver = o; }
function clearAuto() { if (_autoTimer) { clearTimeout(_autoTimer); _autoTimer = null; } }

// ---- 战斗入口 ----
export function startBattle(type) {
  const s = Game.state;
  s.auto = false; s.defending = false; s.nextBoost = 0; s.turnInFloor = 0;
  s._bossPhase2 = false; s._bossDamaged = false; s._furyActive = false;
  s._enemyIntent = null; s._eliteMod = null; s._eliteVenom = 0;
  s._healOnKill = 0;
  // 如果调用方已预设了敌人（如心魔镜像/困兽斗），跳过生成，仅做难度缩放
  const hasPreset = s.enemy && s.enemy.hp > 0 && s.enemy.atk > 0;
  if (!hasPreset) s.enemy = null;
  let base;
  if (hasPreset) {
    // 预设敌人：只做难度/Zone缩放，不重新生成
    const diff = R.get('difficulties', s.difficulty) || R.get('difficulties', 'standard');
    const zoneScale = s.zone ? (s.zone.scale || 1.0) : 1.0;
    s.enemy.hp = Math.floor(s.enemy.hp * diff.monsterMul * zoneScale);
    s.enemy.atk = Math.floor(s.enemy.atk * diff.monsterMul * (1 + (zoneScale - 1) * 0.25));
    s.enemy.maxHp = s.enemy.hp;
    s.enemy.aiTurn = 0; s.enemy.tags = []; s.enemy._buffs = [];
    updateIntent(s);
    Game.sync();
    return;
  }
  if (type === "boss") {
    const boss = R.get('bosses', s.zone ? s.zone.id : (s.zoneIndex + 1));
    const endless = R.get('endlessBosses');
    const endlessIdx = Math.max(0, Math.min(s.zoneIndex - 4, (endless || []).length - 1));
    const bossData = boss || (endless && endless.length > 0 ? endless[endlessIdx] : null);
    if (!bossData) { console.error("No boss data for zoneIndex", s.zoneIndex); return; }
    base = { ...bossData };
  } else if (type === "elite") {
    const pool = R.get('enemies', s.zone?.enemyPool) || R.get('enemies', 'plains');
    const pick = s.rng.pick(pool);
    if (!pick) { console.error("[妖塔] 精英池为空"); return; }
    base = { ...pick };
    base.hp = Math.floor(base.hp * 1.5); base.atk = Math.floor(base.atk * 1.3); base.def += 2;
    // 精英随机词条（扩充至8种）
    const eliteMods = ["regen", "frenzy", "shield", "venom", "thorn", "vamp", "weakness", "clone"];
    s._eliteMod = s.rng.pick(eliteMods);
    if (s._eliteMod === "shield") { base.hp += 30; }
    if (s._eliteMod === "venom") s._eliteVenom = 5;
    if (s._eliteMod === "thorn") base.thorn = (base.thorn || 0) + 0.2;
    if (s._eliteMod === "vamp") base.lifeSteal = (base.lifeSteal || 0) + 0.2;
  } else {
    const pool = R.get('enemies', s.zone?.enemyPool) || R.get('enemies', 'plains');
    const pick = s.rng.pick(pool);
    if (!pick) { console.error("[妖塔] 怪物池为空"); return; }
    base = { ...pick };
  }
  const diff = R.get('difficulties', s.difficulty) || R.get('difficulties', 'standard');
  const zoneScale = s.zone ? (s.zone.scale || 1.0) : 1.0;
  base.hp = Math.floor(base.hp * diff.monsterMul * zoneScale);
  base.atk = Math.floor(base.atk * diff.monsterMul * (1 + (zoneScale - 1) * 0.25));
  if (s.enemyHpMul) base.hp = Math.floor(base.hp * s.enemyHpMul);
  if (s.enemyAtkMul) base.atk = Math.floor(base.atk * s.enemyAtkMul);
  if (s.enemyDefMul) base.def = Math.floor(base.def * s.enemyDefMul);
  // 魔塔环境：Boss全属性+30%
  if (type === "boss" && s._zoneMod?.id === "tower_regen") {
    base.hp = Math.floor(base.hp * 1.3); base.atk = Math.floor(base.atk * 1.3); base.def = Math.floor(base.def * 1.3);
  }
  s.enemy = { ...base, maxHp: base.hp, hp: base.hp, aiTurn: 0, tags: [], _buffs: [] };
  if (s.enemySwift) s.enemy.doubleFirst = true;
  if (s.dailyMods.enemyId === "e7" && type === "boss") { s.enemy.hp = Math.floor(s.enemy.hp * 1.5); s.enemy.maxHp = s.enemy.hp; }
  // 遗迹环境：怪物多一个词条（必须在 s.enemy 创建之后）
  if (s._zoneMod?.id === "ruins_ancient") addTag(s);
  if (s.enemyExtraTag || s.dailyMods.enemyId === "e9") addTag(s);
  if (s.floorInZone > 3 && s.rng.chance(0.55)) addTag(s);
  if (diff.extraTag && s.rng.chance(0.35)) addTag(s);
  // 初始化敌人意图
  updateIntent(s);
  const tt = s.enemy.tags.map(x => x.name).join(" ");
  Events.emit(E.BATTLE_START, { type, enemy: s.enemy, floor: s.totalFloor, zone: s.zone, tags: tt, intent: s._enemyIntent });
  if (s.player.doubleFirst) Events.emit(E.BATTLE_START, { type: 'doubleFirst' });
  Game.sync();
}

function addTag(s) {
  const tag = s.rng.pick(R.get('monsterTags'));
  if (!tag) return; // 空池守卫
  if (!s.enemy.tags.find(x => x.id === tag.id)) {
    const c = { ...tag }; c.apply(s.enemy); s.enemy.tags.push(c);
  }
}

// ---- 敌人意图系统 ----
function updateIntent(s) {
  const e = s.enemy; if (!e) return;
  const hpPct = e.hp / e.maxHp;
  // AI决策：根据血量、buff、技能冷却选择行动
  const actions = [];
  if (e.skill && s.turnInFloor > 0 && (s.turnInFloor + 1) % 3 === 0) {
    // 下回合是技能回合
    actions.push({ type: "skill", icon: "⚡", name: e.skill.name || "技能" });
  } else if (hpPct < 0.3 && s.rng.chance(0.3)) {
    // 低血量概率蓄力/防御
    actions.push({ type: "defend", icon: "🛡️", name: "防御姿态" });
  } else if (e.aiCharge && s.rng.chance(0.4)) {
    actions.push({ type: "charge", icon: "⚡", name: "蓄力" });
  } else if (hpPct < 0.5 && s.rng.chance(0.3)) {
    actions.push({ type: "heavy", icon: "💢", name: "重击" });
  } else {
    actions.push({ type: "attack", icon: "⚔️", name: "攻击" });
  }
  s._enemyIntent = s.rng.pick(actions);
}

// ---- 玩家动作 ----
export function doAttack() {
  const s = Game.state; if (s.gameOver || !s.enemy || s.enemy.hp <= 0) return;
  s.defending = false;
  if (s.player._stoneGaze) { delete s.player._stoneGaze; enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700); return; }
  let dmg = calcDmg(false); applyDmg(dmg, false);
  if (s.player.doubleFirst && s.turnInFloor === 0) {
    Events.emit(E.BATTLE_START, { type: 'doubleAttack' });
    applyDmg(calcDmg(false), false); s.player.doubleFirst = false;
  }
  if (s.enemy.hp <= 0) { win(); return; }
  enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700);
}

export function doSkill() {
  const s = Game.state; if (s.gameOver || !s.enemy || s.enemy.hp <= 0 || s.player.mp < s.player.mpCost) return;
  s.defending = false;
  if (s.player._stoneGaze) { delete s.player._stoneGaze; enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700); return; }
  s.player.mp -= s.player.mpCost;
  // 魔力共鸣羁绊: 技能消耗5%最大生命
  if (s.player._synOrbRing) { const cost = Math.max(1, Math.floor(s.player.maxHp * 0.05)); s.player.hp -= cost; Events.emit(E.PLAYER_DAMAGED, { dmg: cost, source: 'synergy', target: 'self' }); if (s.player.hp <= 0) { s.player.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; } }
  // 影卫·暗杀：自伤10%当前生命
  const activeSk = s.activeSkill;
  if (activeSk && activeSk.selfDmg) { const cost = Math.max(1, Math.floor(s.player.hp * activeSk.selfDmg)); s.player.hp -= cost; Events.emit(E.PLAYER_DAMAGED, { dmg: cost, source: 'skill', target: 'self' }); if (s.player.hp <= 0) { s.player.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; } }
  // 影卫·烟幕：下回合必定暴击
  if (activeSk && activeSk.effect === "smoke") { s._smokeNext = true; }
  let dmg = calcDmg(true);
  // 烟幕效果：必定暴击
  if (s._smokeNext) { s._smokeNext = false; dmg = Math.floor(dmg * s.player.critMul); s.stats.critCount++; }
  applyDmg(dmg, true);
  if (s.player.doubleFirst && s.turnInFloor === 0) {
    Events.emit(E.BATTLE_START, { type: 'doubleSkill' });
    applyDmg(calcDmg(true), true); s.player.doubleFirst = false;
  }
  if (s.enemy.hp <= 0) { win(); return; }
  enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700);
}

export function doDefend() {
  const s = Game.state; if (s.gameOver || !s.enemy || s.enemy.hp <= 0) return;
  s.defending = true; s.nextBoost = 0.35;
  Events.emit(E.BATTLE_START, { type: 'defend' });
  playSound("hit"); enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700);
}

// ---- 伤害计算（集成装备前缀效果 + 羁绊效果）----
function calcDmg(skill) {
  const p = Game.state.player, e = Game.state.enemy, s = Game.state;
  let atk = p.atk;
  s.equip.forEach(q => { if (q.stat === "atk") atk += q.val; });
  if (p.rage && p.hp < p.maxHp * 0.3) atk = Math.floor(atk * 1.5);
  if (p.berserk) { const r = Math.max(0, 1 - p.hp / p.maxHp); atk = Math.floor(atk * (1 + r)); }
  if (p.debuffAtk && p.debuffAtk.turns > 0) atk = Math.max(1, atk - p.debuffAtk.value);
  if (s.potionAtk) atk = Math.floor(atk * (1 + s.potionAtk));
  // 羁绊：金库守卫（每30金+3攻，上限15）
  if (p._synGoldTycoon) { const bonus = Math.min(15, Math.floor(s.gold / 30) * 3); atk += bonus; }
  // 羁绊：咒术大师（每个诅咒+5攻）
  if (p._synCurseMaster) { atk += s.curses.length * 5; }
  // 羁绊：狂战士之魂（击杀触发后伤害+50%）
  if (p._synFuryBorn && s._furyActive) { atk = Math.floor(atk * 1.5); }
  let def = e.def; if (skill) def = Math.floor(def * (1 - (p.pen || 0)));
  let dmg = Math.max(1, atk - def); if (skill) dmg = Math.floor(dmg * p.skillMul);
  // 伤害保底：至少造成攻击力15%的伤害，防止高防敌人完全打不动
  dmg = Math.max(dmg, Math.floor(atk * 0.15));
  if (s.nextBoost > 0) { dmg = Math.floor(dmg * (1 + s.nextBoost)); }
  // 装备前缀：处刑者（低血+25%伤害）
  const execEq = s.equip.find(q => q._combatEffect?.type === "executioner");
  if (execEq && e.hp < e.maxHp * 0.3) dmg = Math.floor(dmg * (1 + execEq._combatEffect.value));
  // 遗物：处刑者
  const hasExecRelic = s.relics.some(r => r.id === "executioner");
  if (hasExecRelic && e.hp < e.maxHp * 0.3) dmg = Math.floor(dmg * 1.4);
  // 羁绊：收割者（低血+50%伤害）
  if (p._synExecutioner && e.hp < e.maxHp * 0.4) dmg = Math.floor(dmg * 1.5);
  // 装备前缀：混沌（30%概率+50%）
  const chaosEq = s.equip.find(q => q._combatEffect?.type === "chaos");
  if (chaosEq && s.rng.chance(chaosEq._combatEffect.value)) dmg = Math.floor(dmg * 1.5);
  // 羁绊：暗影之舞（首回合+30%）
  if (p._synShadowDance && s.turnInFloor === 0) dmg = Math.floor(dmg * 1.3);
  return dmg;
}

function applyDmg(dmg, skill) {
  const s = Game.state, p = s.player;
  let cr = p.critRate; s.equip.forEach(q => { if (q.stat === "critRate") cr += q.val / 100; });
  // 羁绊：咒术大师（每个诅咒+5%暴击）
  if (p._synCurseMaster) cr += s.curses.length * 0.05;
  let crit = s.rng.chance(cr);
  if (crit) {
    const critMul = p.critMul + (s._zoneMod?.id === "void_crit" ? 0.5 : 0);
    dmg = Math.floor(dmg * critMul); s.stats.critCount++;
    if (p._synCritDice && s.rng.chance(0.15)) { dmg = Math.floor(dmg * 2); Events.emit(E.BATTLE_START, { type: 'synCritDice' }); }
    Events.emit(E.PLAYER_DAMAGED, { dmg, crit: true, skill });
    playSound("crit");
  } else if (s.nextBoost > 0 && s.nextBoost !== 0.35) {
    Events.emit(E.PLAYER_DAMAGED, { dmg, crit: false, counter: true });
    playSound("attack");
  } else {
    Events.emit(E.PLAYER_DAMAGED, { dmg, crit: false });
    playSound("attack");
  }
  s.stats.totalDmg += dmg; s.enemy.hp -= dmg;
  // 装备前缀战斗效果：普攻附加
  if (!skill) applyEquipCombatEffects(s);
  // 吸血处理
  if (p.lifeSteal > 0) {
    const mul = p._synVampBlood ? 2 : 1;
    const h = Math.floor(dmg * p.lifeSteal * mul);
    const beforeHp = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + h);
    if (p._synVampBlood && beforeHp + h > p.maxHp) {
      const overflow = beforeHp + h - p.maxHp;
      if (!p._tempHp) p._tempHp = 0;
      p._tempHp += overflow;
      p.hp += overflow;
    }
    Events.emit(E.PLAYER_HEALED, { amount: h, hp: p.hp, maxHp: p.maxHp, source: 'lifeSteal' });
  }
  s.relics.forEach(r => { if (r.onAttack) r.onAttack(p, dmg); });
  // 技能效果系统: burn/slow/stun
  if (skill && s.activeSkill && s.activeSkill.effect && s.enemy.hp > 0) {
    applySkillEffect(s.activeSkill.effect, s);
  }
  // 成就追踪：单次200+伤害
  if (dmg >= 200) checkAchievement(s, "one_shot_200");
  if (s.enemy.thorn) {
    const th = Math.floor(dmg * s.enemy.thorn);
    p.hp -= th;
    Events.emit(E.PLAYER_DAMAGED, { dmg: th, source: 'thorn', enemy: s.enemy.name });
  }
  s.nextBoost = 0;
}

// ---- 装备前缀战斗效果 ----
function applyEquipCombatEffects(s) {
  s.equip.forEach(q => {
    const fx = q._combatEffect; if (!fx) return;
    switch (fx.type) {
      case "burn":
        if (s.rng.chance(0.5)) {
          const bdmg = 3 + Math.floor(s.totalFloor / 5);
          addBuff(s.enemy, { id: 'burn', name: '燃烧', turns: 2, data: { dmg: bdmg },
            onTick: (e, b) => { e.hp -= b.data.dmg; Events.emit(E.PLAYER_DAMAGED, { dmg: b.data.dmg, source: 'burn', target: 'enemy' }); if (e.hp <= 0) return 'dead'; } });
          Events.emit(E.BATTLE_START, { type: 'burn', turns: 2, dmg: bdmg });
        }
        break;
      case "slow":
        if (s.rng.chance(0.4)) {
          addBuff(s.enemy, { id: 'slow', name: '迟缓', turns: 1, onRemove: () => {} });
          Events.emit(E.BATTLE_START, { type: 'slow' });
        }
        break;
      case "stun":
        if (s.rng.chance(fx.value || 0.3)) {
          addBuff(s.enemy, { id: 'stun', name: '眩晕', turns: 1, onTick: () => 'stunned' });
          Events.emit(E.BATTLE_START, { type: 'stun', name: s.enemy.name });
        }
        break;
      case "lifesteal":
        const h = Math.floor((s.player.atk * (fx.value || 0.08)));
        s.player.hp = Math.min(s.player.maxHp, s.player.hp + h);
        break;
      case "heal_on_kill":
        // 效果在 win() 中触发，此处记录标记
        s._healOnKill = (fx.value || 0.1);
        break;
    }
  });
}

// ---- 技能效果应用 ----
function applySkillEffect(effect, s) {
  const floor = s.totalFloor;
  switch (effect) {
    case 'burn': {
      const dmg = 5 + Math.floor(floor / 5);
      addBuff(s.enemy, { id: 'burn', name: '燃烧', turns: 2, data: { dmg },
        onTick: (e, b) => { e.hp -= b.data.dmg; Events.emit(E.PLAYER_DAMAGED, { dmg: b.data.dmg, source: 'burn', target: 'enemy' }); if (e.hp <= 0) return 'dead'; } });
      Events.emit(E.BATTLE_START, { type: 'burn', turns: 2, dmg });
      break;
    }
    case 'slow':
      addBuff(s.enemy, { id: 'slow', name: '迟缓', turns: 1, onRemove: () => {} });
      Events.emit(E.BATTLE_START, { type: 'slow' });
      break;
    case 'stun':
      if (s.rng.chance(0.5)) {
        addBuff(s.enemy, { id: 'stun', name: '眩晕', turns: 1, onTick: () => 'stunned' });
        Events.emit(E.BATTLE_START, { type: 'stun', name: s.enemy.name });
      }
      break;
    case 'poison': {
      const poisonDmg = 4 + Math.floor(floor / 5);
      addBuff(s.enemy, { id: 'poison', name: '中毒', turns: 3, data: { dmg: poisonDmg },
        onTick: (e, b) => { e.hp -= b.data.dmg; Events.emit(E.PLAYER_DAMAGED, { dmg: b.data.dmg, source: 'burn', target: 'enemy' }); if (e.hp <= 0) return 'dead'; } });
      Events.emit(E.BATTLE_START, { type: 'burn', turns: 3, dmg: poisonDmg });
      break;
    }
  }
}

// ---- 敌人回合 ----
function enemyTurn() {
  const s = Game.state, p = s.player, e = s.enemy;
  // 统一 tick 敌人 buff
  const status = tickBuffs(e, true);
  if (status === 'dead') { win(); return; }
  if (status === 'stunned') {
    p.mp = Math.min(p.maxMp, p.mp + 3);
    s.turn++; s.turnInFloor++;
    updateIntent(s); Events.emit(E.TURN_END, { turn: s.turn, turnInFloor: s.turnInFloor, intent: s._enemyIntent });
    Game.sync(); if (s.auto) setTimeout(autoLoop, 700);
    return;
  }

  let dmg = Math.max(1, e.atk - p.def);
  // 意图：重击（1.5x伤害）
  if (s._enemyIntent?.type === "heavy") dmg = Math.floor(dmg * 1.5);
  // 意图：防御（本回合减伤）
  if (s._enemyIntent?.type === "defend") { e.def = Math.floor(e.def * 1.5); s._enemyDefended = true; }
  // 精英词条：再生
  if (s._eliteMod === "regen" && s.turnInFloor > 0 && s.turnInFloor % 3 === 0) {
    const healAmt = Math.floor(e.maxHp * 0.15);
    e.hp = Math.min(e.maxHp, e.hp + healAmt);
    Events.emit(E.PLAYER_HEALED, { amount: healAmt, source: 'boss' });
  }
  // 精英词条：狂怒
  if (s._eliteMod === "frenzy" && e.hp < e.maxHp * 0.5) dmg = Math.floor(dmg * 2);
  // 精英词条：虚弱（每3回合减玩家攻击）
  if (s._eliteMod === "weakness" && s.turnInFloor > 0 && s.turnInFloor % 3 === 0) {
    p.debuffAtk = { turns: 3, value: 3 };
    Events.emit(E.BATTLE_START, { type: 'debuff', name: e.name });
  }
  // 精英词条：分身（每5回合一次额外攻击）
  if (s._eliteMod === "clone" && s.turnInFloor > 0 && s.turnInFloor % 5 === 0) {
    const cloneDmg = Math.floor(dmg * 0.4);
    p.hp -= cloneDmg;
    Events.emit(E.PLAYER_DAMAGED, { dmg: cloneDmg, source: 'clone', enemy: e.name });
  }
  // 迟缓效果
  if (hasBuff(e, 'slow')) { dmg = Math.floor(dmg * 0.7); removeBuff(e, 'slow'); }
  s.equip.forEach(q => { if (q.stat === "def") dmg = Math.max(1, dmg - q.val); });
  if (p.dmgReduce) dmg = Math.floor(dmg * (1 - p.dmgReduce));
  // 诅咒：脆弱
  if (p._fragileFlag) dmg = Math.floor(dmg * 1.3);
  if (s.potionDef) dmg = Math.floor(dmg * (1 - s.potionDef));
  if (e.aiCharge) {
    e.chargeTurns = (e.chargeTurns || 0) + 1;
    if (e.chargeTurns % 3 === 0) { dmg = Math.floor(dmg * 2); Events.emit(E.BATTLE_START, { type: 'chargeAttack', name: e.name }); }
  }
  // Boss 特殊技能：每3回合触发一次
  if (e.skill && s.turnInFloor > 0 && s.turnInFloor % 3 === 0) {
    const result = e.skill.fn(e, p);
    if (result) {
      Events.emit(E.BATTLE_START, { type: 'bossSkill', name: e.name, skillName: e.skill.name, msg: result.msg, dmg: result.dmg });
      if (result.heal) Events.emit(E.PLAYER_HEALED, { amount: result.heal, source: 'boss' });
    }
    if (result && result.crystal) {
      addBuff(e, { id: 'crystal', name: '晶化', turns: 1, onRemove: (enemy) => { if (enemy._crystalDoubled) { enemy.def = Math.floor(enemy.def / 2); delete enemy._crystalDoubled; } } });
      e._crystalThorns = true; delete e._thorns;
    }
    if (p.hp <= 0) { p.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; }
  }
  if (s.defending) { dmg = Math.floor(dmg * 0.5); s.defending = false; }
  // Zone环境：虚空裂隙（敌人有概率暴击，+50%伤害）
  if (s._zoneMod?.id === "void_crit" && s.rng.chance(0.15)) {
    dmg = Math.floor(dmg * 1.5);
    Events.emit(E.BATTLE_START, { type: 'chargeAttack', name: e.name + '（虚空暴击）' });
  }
  if (p.dodge && s.rng.chance(p.dodge)) {
    dmg = 0; Events.emit(E.BATTLE_START, { type: 'dodge' });
    // 羁绊：暗影之舞（闪避成功回复20%生命）
    if (p._synShadowDance) { const heal = Math.floor(p.maxHp * 0.2); p.hp = Math.min(p.maxHp, p.hp + heal); Events.emit(E.PLAYER_HEALED, { amount: heal, hp: p.hp, maxHp: p.maxHp, source: 'dodge' }); }
    // 遗物：影步（闪避回血10%）
    if (p._shadowStep) { const heal = Math.floor(p.maxHp * 0.1); p.hp = Math.min(p.maxHp, p.hp + heal); }
  }
  if (e.doubleFirst && s.turnInFloor === 0) {
    e.doubleFirst = false;
    strike(dmg); if (e.hp <= 0) { win(); return; }
    if (p.hp > 0) strike(dmg);
    if (p.hp <= 0) { p.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; }
    if (e.hp <= 0) { win(); return; }
  } else {
    strike(dmg); if (e.hp <= 0) { win(); return; }
  }
  if (p.hp <= 0) { p.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; }
  if (p.bleed) { p.hp -= p.bleed; Events.emit(E.PLAYER_DAMAGED, { dmg: p.bleed, source: 'bleed' }); }
  if (p.hp <= 0) { p.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; }
  // 遗物：恶魔契约（每回合扣4血）
  if (p._demonPact) { p.hp -= 4; Events.emit(E.PLAYER_DAMAGED, { dmg: 4, source: 'demonPact' }); }
  // 羁绊：绝望契约（每回合扣6血）
  if (p._synGlassDemon) { p.hp -= 6; Events.emit(E.PLAYER_DAMAGED, { dmg: 6, source: 'synGlassDemon' }); }
  if (p.hp <= 0) { p.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; }
  // Zone环境：森林瘴气（每3回合中毒）
  if (s._zoneMod?.id === "forest_poison" && s.turnInFloor > 0 && s.turnInFloor % 3 === 0) {
    const poisonDmg = 4 + Math.floor(s.totalFloor / 10);
    p.hp -= poisonDmg;
    Events.emit(E.PLAYER_DAMAGED, { dmg: poisonDmg, source: 'burn', target: 'player' });
    if (p.hp <= 0) { p.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; }
  }
  // Zone环境：极寒冰原（灵力回复减半，但敌人受冻迟缓）
  const mpRegen = s._zoneMod?.id === "frozen_mp" ? 2 : 5;
  p.mp = Math.min(p.maxMp, p.mp + mpRegen);
  if (p.regen) { p.hp = Math.min(p.maxHp, p.hp + p.regen); Events.emit(E.PLAYER_HEALED, { amount: p.regen, hp: p.hp, maxHp: p.maxHp, source: 'regen' }); }
  // 精英词条：毒雾
  if (s._eliteVenom) { p.hp -= s._eliteVenom; Events.emit(E.PLAYER_DAMAGED, { dmg: s._eliteVenom, source: 'burn', target: 'player' }); }
  if (p.hp <= 0) { p.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; }
  // 临时生命衰减
  if (p._tempHp && p._tempHp > 0) {
    const decay = Math.ceil(p._tempHp / 2);
    p._tempHp -= decay;
    p.hp = Math.max(p.maxHp, p.hp - decay);
    if (p._tempHp <= 0) delete p._tempHp;
  }
  // 防御姿势力恢复
  if (s._enemyDefended) { e.def = Math.floor(e.def / 1.5); s._enemyDefended = false; }
  s.relics.forEach(r => { if (r.onTurn) r.onTurn(p, e); });
  if (e.hp <= 0) { win(); return; }
  s.turn++; s.turnInFloor++;
  // 成就追踪：低血量反杀
  if (p.hp < p.maxHp * 0.05 && e.hp < e.maxHp * 0.1) checkAchievement(s, "survivor");
  updateIntent(s);
  Events.emit(E.TURN_END, { turn: s.turn, turnInFloor: s.turnInFloor, intent: s._enemyIntent });
  let curseRate = 0.4;
  if (s.enemyCurseRate) curseRate += s.enemyCurseRate;
  if (e.aiCurse && s.rng.chance(curseRate)) {
    p.debuffAtk = { turns: 3, value: 3 + Math.floor(s.totalFloor / 5) };
    Events.emit(E.CURSE_APPLIED, { type: 'debuffAtk', turns: 3, value: p.debuffAtk.value, name: e.name });
  }
  if (p.debuffAtk) { p.debuffAtk.turns--; if (p.debuffAtk.turns <= 0) delete p.debuffAtk; }
}

function strike(dmg) {
  const s = Game.state, p = s.player, e = s.enemy;
  p.hp -= dmg;
  if (s._currentRoomType === "boss" && dmg > 0) s._bossDamaged = true; // 无伤成就追踪
  Events.emit(E.PLAYER_DAMAGED, { dmg, hp: p.hp, maxHp: p.maxHp, source: e.name });
  playSound("hit");
  if (e.lifeSteal) { const h = Math.floor(dmg * e.lifeSteal); e.hp = Math.min(e.maxHp, e.hp + h); }
  s.relics.forEach(r => { if (r.onHit) r.onHit(p, e, dmg); });
  if (p.thorn) {
    const th = Math.floor(dmg * p.thorn);
    e.hp -= th;
    Events.emit(E.PLAYER_DAMAGED, { dmg: th, source: 'thorn', target: 'enemy' });
  }
  if (e._crystalThorns) {
    const th = Math.floor(dmg * 0.3);
    p.hp -= th;
    Events.emit(E.PLAYER_DAMAGED, { dmg: th, source: 'thorn', enemy: e.name });
    delete e._crystalThorns;
  }
}

// ---- 胜利（含Boss二阶段转换）----
function win() {
  const s = Game.state;
  // Boss二阶段检测
  if (s._currentRoomType === "boss" && !s._bossPhase2 && s.enemy.phase2) {
    const phase2Hp = Math.floor(s.enemy.maxHp * 0.5);
    if (s.enemy.hp <= phase2Hp) {
      s._bossPhase2 = true;
      const p2 = s.enemy.phase2;
      s.enemy.name = p2.name;
      s.enemy.atk = Math.floor(s.enemy.atk * p2.atkMul);
      s.enemy.def += (p2.defBonus || 0);
      s.enemy.skill = p2.skill;
      s.enemy.hp = phase2Hp;
      s.enemy.maxHp = phase2Hp; // 二阶段新血条
      s.enemy._buffs = []; // 清除debuff进入二阶段
      s._furyActive = false;
      Events.emit(E.BATTLE_START, { type: 'bossPhase2', name: p2.name });
      Game.sync();
      return;
    }
  }
  // 正常击杀
  Events.emit(E.ENEMY_KILLED, { name: s.enemy.name, floor: s.totalFloor });
  playSound("win");
  Game.recordKill(s.enemy.name, s.totalFloor, s.enemy);
  if (s.totalFloor > s.highest) s.highest = s.totalFloor;
  let g = 10 + s.rng.range(0, 15) + Math.floor(s.totalFloor / 2);
  if (s.player.goldMul) g = Math.floor(g * s.player.goldMul);
  if (s.enemyGoldMul) g = Math.floor(g * s.enemyGoldMul);
  const lim = s.totalFloor <= 10 ? 15 : (s.totalFloor === 99 ? 30 : 20);
  const fast = s.turnInFloor <= lim;
  if (fast) { g = Math.floor(g * 2); checkAchievement(s, "speed_demon"); }
  s.gold += g;
  Events.emit(E.GOLD_CHANGED, { gold: s.gold, delta: g, fast });
  // 魂晶掉落
  const roomType = s._currentRoomType || '';
  let souls = 0;
  if (roomType === 'elite') souls = s.rng.range(1, 2);
  else if (roomType === 'boss') souls = 2 + s.zoneIndex;
  if (souls > 0) { Game.meta.souls += souls; Game.saveMeta(); Events.emit(E.GOLD_CHANGED, { souls }); }
  // 装备前缀：神圣（击杀回血）
  if (s._healOnKill) { s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.floor(s.player.maxHp * s._healOnKill)); s._healOnKill = 0; }
  // 遗物击杀效果
  s.relics.forEach(r => { if (r.onKill) r.onKill(s.player); });
  // 影卫被动
  if (s.player._shadowBorn) { s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.floor(s.player.maxHp * 0.2)); }
  // 羁绊：狂战士之魂（击杀后下回合+50%伤害）
  if (s.player._synFuryBorn) { s._furyActive = true; }
  // 羁绊：收割者（击杀回复20%生命）
  if (s.player._synExecutioner) { s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.floor(s.player.maxHp * 0.2)); }
  // 遗物：血钱（额外金币但扣血）
  if (s.relics.some(r => r.id === "blood_money")) { s.gold += 15; s.player.hp -= Math.floor(s.player.maxHp * 0.05); }
  // 成就追踪（难度通关成就由 main.js gameClear 处理）
  if (roomType === 'boss' && !s._bossDamaged) checkAchievement(s, "flawless_boss");
  if (s.gold >= 200) checkAchievement(s, "gold_200");
  if (s.relics.length >= 6) checkAchievement(s, "six_relics");
  if (s.equip.length >= 6) checkAchievement(s, "six_equips");
  if (s.curses.length >= 3) checkAchievement(s, "three_curses");
  if (s.totalFloor >= 30 && s.endless) checkAchievement(s, "endless_30");
  // _furyActive 由 startBattle() 清除，此处不再清零（否则狂战士之魂永远不触发）
  s.stats.roomsCleared++;
  Game.sync();
  setTimeout(() => { if (_onWin) _onWin(fast); }, 400);
}

function checkAchievement(s, id) {
  if (!Game.meta.achievements) Game.meta.achievements = [];
  if (!Game.meta.achievements.includes(id)) {
    Game.meta.achievements.push(id);
    Game.saveMeta();
    Events.emit(E.BATTLE_START, { type: 'achievement', id });
  }
}

// ---- 游戏结束 ----
function gameOver() {
  const s = Game.state;
  if (s.player.rebirth && s.player.hp <= 0) {
    s.player.hp = Math.floor(s.player.maxHp * 0.5); s.player.rebirth = false;
    Events.emit(E.PLAYER_HEALED, { amount: s.player.hp, hp: s.player.hp, maxHp: s.player.maxHp, source: 'rebirth' });
    playSound("heal"); Game.sync(); return;
  }
  s.auto = false; s.gameOver = true; playSound("lose"); Game.sync();
  Events.emit(E.GAME_OVER, {});
  if (_onOver) _onOver();
}

// ---- 自动战斗 ----
export function toggleAuto() {
  const s = Game.state; clearAuto(); s.auto = !s.auto; Game.sync();
  if (s.auto) autoLoop();
}
function autoLoop() {
  const s = Game.state;
  if (s.gameOver || !s.auto || !s.enemy || s.enemy.hp <= 0) { clearAuto(); return; }
  if (s.player.hp < s.player.maxHp * 0.25 && s.enemy.atk > s.player.def + 5) doDefend();
  else if (s.player.mp >= s.player.mpCost && s.rng.chance(0.6)) doSkill();
  else doAttack();
  _autoTimer = setTimeout(autoLoop, 700);
}

// ---- 药水（含炼金宗师羁绊增强）----
export function usePotion(idx) {
  const s = Game.state; if (idx < 0 || idx >= s.potions.length) return false;
  clearAuto(); s.auto = false;
  const pot = s.potions[idx];
  // 炼金宗师羁绊：药水额外回复30%生命+5灵力
  if (s.player._synAlchemyGrand) {
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.floor(s.player.maxHp * 0.3));
    s.player.mp = Math.min(s.player.maxMp, s.player.mp + 5);
  }
  pot.fn(s.player, s); s.potions.splice(idx, 1);
  if (pot.id === "cleanse" && s.curses.length > 0) {
    const removed = s.curses.pop();
    if (removed && removed.remove) { removed.remove(s.player); Events.emit(E.CURSE_REMOVED, { curse: removed }); }
    Events.emit(E.BATTLE_START, { type: 'cleanse', name: removed?.name });
    checkAchievement(s, "curse_breaker");
  }
  playSound("potion");
  Events.emit(E.BATTLE_START, { type: 'potion', name: pot.name, desc: pot.desc });
  Game.sync(); return true;
}

// ---- 外部查询意图（给 render 用）----
export function getIntent() { return Game.state._enemyIntent; }
