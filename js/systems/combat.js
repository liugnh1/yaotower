// ===================== 战斗系统 =====================
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
  s.enemy = null; let base;
  if (type === "boss") {
    const boss = R.get('bosses', s.zoneIndex + 1);
    const endless = R.get('endlessBosses');
    const endlessIdx = Math.max(0, Math.min(s.zoneIndex - 4, (endless || []).length - 1));
    const bossData = boss || (endless && endless.length > 0 ? endless[endlessIdx] : null);
    if (!bossData) { console.error("No boss data for zoneIndex", s.zoneIndex); return; }
    base = { ...bossData };
  } else if (type === "elite") {
    const pool = R.get('enemies', s.zone.enemyPool) || R.get('enemies', 'plains');
    base = { ...s.rng.pick(pool) };
    base.hp = Math.floor(base.hp * 1.5); base.atk = Math.floor(base.atk * 1.3); base.def += 2;
  } else {
    const pool = R.get('enemies', s.zone.enemyPool) || R.get('enemies', 'plains');
    base = { ...s.rng.pick(pool) };
  }
  const diff = R.get('difficulties', s.difficulty) || R.get('difficulties', 'standard');
  base.hp = Math.floor(base.hp * diff.monsterMul); base.atk = Math.floor(base.atk * diff.monsterMul);
  // 每日修饰器
  if (s.enemyHpMul) base.hp = Math.floor(base.hp * s.enemyHpMul);
  if (s.enemyAtkMul) base.atk = Math.floor(base.atk * s.enemyAtkMul);
  if (s.enemyDefMul) base.def = Math.floor(base.def * s.enemyDefMul);
  s.enemy = { ...base, maxHp: base.hp, hp: base.hp, aiTurn: 0, tags: [], _buffs: [] };
  if (s.enemySwift) s.enemy.doubleFirst = true;
  if (s.dailyMods.enemyId === "e7" && type === "boss") { s.enemy.hp = Math.floor(s.enemy.hp * 1.5); s.enemy.maxHp = s.enemy.hp; }
  if (s.enemyExtraTag || s.dailyMods.enemyId === "e9") addTag(s);
  if (s.floorInZone > 3 && s.rng.chance(0.55)) addTag(s);
  if (diff.extraTag && s.rng.chance(0.35)) addTag(s);
  const tt = s.enemy.tags.map(x => x.name).join(" ");
  Events.emit(E.BATTLE_START, { type, enemy: s.enemy, floor: s.totalFloor, zone: s.zone, tags: tt });
  if (s.player.doubleFirst) Events.emit(E.BATTLE_START, { type: 'doubleFirst' });
  Game.sync();
}

function addTag(s) {
  const tag = s.rng.pick(R.get('monsterTags'));
  if (!s.enemy.tags.find(x => x.id === tag.id)) {
    const c = { ...tag }; c.apply(s.enemy); s.enemy.tags.push(c);
  }
}

// ---- 玩家动作 ----
export function doAttack() {
  const s = Game.state; if (s.gameOver || !s.enemy || s.enemy.hp <= 0) return;
  s.defending = false; let dmg = calcDmg(false); applyDmg(dmg, false);
  if (s.player.doubleFirst && s.turnInFloor === 0) {
    Events.emit(E.BATTLE_START, { type: 'doubleAttack' });
    applyDmg(calcDmg(false), false); s.player.doubleFirst = false;
  }
  if (s.enemy.hp <= 0) { win(); return; }
  enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700);
}

export function doSkill() {
  const s = Game.state; if (s.gameOver || !s.enemy || s.enemy.hp <= 0 || s.player.mp < s.player.mpCost) return;
  s.defending = false; s.player.mp -= s.player.mpCost;
  // 魔力共鸣羁绊: 技能消耗5%最大生命
  if (s.player._synOrbRing) { const cost = Math.max(1, Math.floor(s.player.maxHp * 0.05)); s.player.hp -= cost; Events.emit(E.PLAYER_DAMAGED, { dmg: cost, source: 'synergy', target: 'self' }); if (s.player.hp <= 0) { s.player.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; } }
  let dmg = calcDmg(true); applyDmg(dmg, true);
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

// ---- 伤害计算 ----
function calcDmg(skill) {
  const p = Game.state.player, e = Game.state.enemy;
  let atk = p.atk;
  Game.state.equip.forEach(q => { if (q.stat === "atk") atk += q.val; });
  if (p.rage && p.hp < p.maxHp * 0.3) atk = Math.floor(atk * 1.5);
  if (p.berserk) { const r = Math.max(0, 1 - p.hp / p.maxHp); atk = Math.floor(atk * (1 + r)); }
  if (p.debuffAtk && p.debuffAtk.turns > 0) atk = Math.max(1, atk - p.debuffAtk.value);
  if (Game.state.potionAtk) atk = Math.floor(atk * (1 + Game.state.potionAtk));
  let def = e.def; if (skill) def = Math.floor(def * (1 - (p.pen || 0)));
  let dmg = Math.max(1, atk - def); if (skill) dmg = Math.floor(dmg * p.skillMul);
  if (Game.state.nextBoost > 0) { dmg = Math.floor(dmg * (1 + Game.state.nextBoost)); }
  return dmg;
}

function applyDmg(dmg, skill) {
  const s = Game.state, p = s.player;
  let cr = p.critRate; s.equip.forEach(q => { if (q.stat === "critRate") cr += q.val / 100; });
  let crit = s.rng.chance(cr);
  if (crit) {
    dmg = Math.floor(dmg * p.critMul); s.stats.critCount++;
    // 命运之眼羁绊: 暴击15%概率伤害翻倍
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
  if (p.lifeSteal > 0) {
    // 血族觉醒羁绊: 吸血翻倍，溢出转临时生命
    const mul = p._synVampBlood ? 2 : 1;
    const h = Math.floor(dmg * p.lifeSteal * mul);
    const beforeHp = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + h);
    if (p._synVampBlood && beforeHp + h > p.maxHp) {
      const overflow = beforeHp + h - p.maxHp;
      if (!p._tempHp) p._tempHp = 0;
      p._tempHp += overflow;
      p.hp += overflow; // 临时生命可以超过上限
    }
    Events.emit(E.PLAYER_HEALED, { amount: h, hp: p.hp, maxHp: p.maxHp, source: 'lifeSteal' });
  }
  s.relics.forEach(r => { if (r.onAttack) r.onAttack(p, dmg); });
  // 技能效果系统: burn/slow/stun
  if (skill && s.activeSkill && s.activeSkill.effect && s.enemy.hp > 0) {
    applySkillEffect(s.activeSkill.effect, s);
  }
  if (s.enemy.thorn) {
    const th = Math.floor(dmg * s.enemy.thorn);
    p.hp -= th;
    Events.emit(E.PLAYER_DAMAGED, { dmg: th, source: 'thorn', enemy: s.enemy.name });
  }
  s.nextBoost = 0;
}

// ---- 技能效果应用（通过 Buff 系统）----
function applySkillEffect(effect, s) {
  const floor = s.totalFloor;
  switch (effect) {
    case 'burn': {
      const dmg = 5 + Math.floor(floor / 5);
      addBuff(s.enemy, {
        id: 'burn', name: '燃烧', turns: 2, data: { dmg },
        onTick: (e, b) => {
          e.hp -= b.data.dmg;
          Events.emit(E.PLAYER_DAMAGED, { dmg: b.data.dmg, source: 'burn', target: 'enemy' });
          if (e.hp <= 0) return 'dead';
        }
      });
      Events.emit(E.BATTLE_START, { type: 'burn', turns: 2, dmg });
      break;
    }
    case 'slow':
      addBuff(s.enemy, {
        id: 'slow', name: '迟缓', turns: 1,
        onRemove: () => {} // 效果在 enemyTurn 中读取
      });
      Events.emit(E.BATTLE_START, { type: 'slow' });
      break;
    case 'stun':
      if (s.rng.chance(0.5)) {
        addBuff(s.enemy, {
          id: 'stun', name: '眩晕', turns: 1,
          onTick: () => 'stunned'
        });
        Events.emit(E.BATTLE_START, { type: 'stun', name: s.enemy.name });
      }
      break;
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
    Events.emit(E.TURN_END, { turn: s.turn, turnInFloor: s.turnInFloor });
    Game.sync(); if (s.auto) setTimeout(autoLoop, 700);
    return;
  }

  let dmg = Math.max(1, e.atk - p.def);
  // 迟缓效果: 攻击力减30%
  if (hasBuff(e, 'slow')) { dmg = Math.floor(dmg * 0.7); removeBuff(e, 'slow'); }
  s.equip.forEach(q => { if (q.stat === "def") dmg = Math.max(1, dmg - q.val); });
  if (p.dmgReduce) dmg = Math.floor(dmg * (1 - p.dmgReduce));
  if (Game.state.potionDef) dmg = Math.floor(dmg * (1 - Game.state.potionDef));
  if (e.aiCharge) {
    e.chargeTurns = (e.chargeTurns || 0) + 1;
    if (e.chargeTurns % 3 === 0) {
      dmg = Math.floor(dmg * 2);
      Events.emit(E.BATTLE_START, { type: 'chargeAttack', name: e.name });
    }
  }
  // Boss 特殊技能：每3回合触发一次
  if (e.skill && s.turnInFloor > 0 && s.turnInFloor % 3 === 0) {
    const result = e.skill.fn(e, p);
    if (result) {
      Events.emit(E.BATTLE_START, { type: 'bossSkill', name: e.name, skillName: e.skill.name, msg: result.msg, dmg: result.dmg });
      if (result.heal) Events.emit(E.PLAYER_HEALED, { amount: result.heal, source: 'boss' });
    }
    // 晶石巨像晶化：防御翻倍1回合+反伤
    if (result && result.crystal) {
      addBuff(e, { id: 'crystal', name: '晶化', turns: 1, onRemove: (enemy) => { enemy.def = Math.floor(enemy.def / 2); } });
      e._crystalThorns = true; delete e._thorns;
    }
    if (p.hp <= 0) { p.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; }
  }
  if (s.defending) { dmg = Math.floor(dmg * 0.5); s.defending = false; }
  if (p.dodge && s.rng.chance(p.dodge)) { dmg = 0; Events.emit(E.BATTLE_START, { type: 'dodge' }); }
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
  p.mp = Math.min(p.maxMp, p.mp + 3);
  if (p.regen) { p.hp = Math.min(p.maxHp, p.hp + p.regen); Events.emit(E.PLAYER_HEALED, { amount: p.regen, hp: p.hp, maxHp: p.maxHp, source: 'regen' }); }
  // 临时生命每回合衰减一半
  if (p._tempHp && p._tempHp > 0) {
    const decay = Math.ceil(p._tempHp / 2);
    p._tempHp -= decay;
    p.hp = Math.max(p.maxHp, p.hp - decay); // 衰减但不会低于 maxHp
    if (p._tempHp <= 0) delete p._tempHp;
  }
  s.relics.forEach(r => { if (r.onTurn) r.onTurn(p, e); });
  if (e.hp <= 0) { win(); return; }
  s.turn++; s.turnInFloor++;
  Events.emit(E.TURN_END, { turn: s.turn, turnInFloor: s.turnInFloor });
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
  Events.emit(E.PLAYER_DAMAGED, { dmg, hp: p.hp, maxHp: p.maxHp, source: e.name });
  playSound("hit");
  if (e.lifeSteal) { const h = Math.floor(dmg * e.lifeSteal); e.hp = Math.min(e.maxHp, e.hp + h); }
  s.relics.forEach(r => { if (r.onHit) r.onHit(p, e, dmg); });
  if (p.thorn) {
    const th = Math.floor(dmg * p.thorn);
    e.hp -= th;
    Events.emit(E.PLAYER_DAMAGED, { dmg: th, source: 'thorn', target: 'enemy' });
  }
  // 晶石巨像晶化反伤（仅一次）
  if (e._crystalThorns) {
    const th = Math.floor(dmg * 0.3);
    p.hp -= th;
    Events.emit(E.PLAYER_DAMAGED, { dmg: th, source: 'thorn', enemy: e.name });
    delete e._crystalThorns;
  }
}

// ---- 胜利 ----
function win() {
  const s = Game.state;
  Events.emit(E.ENEMY_KILLED, { name: s.enemy.name, floor: s.totalFloor });
  playSound("win");
  Game.recordKill(s.enemy.name, s.totalFloor, s.enemy);
  if (s.totalFloor > s.highest) s.highest = s.totalFloor;
  let g = 10 + s.rng.range(0, 15) + Math.floor(s.totalFloor / 2);
  if (s.player.goldMul) g = Math.floor(g * s.player.goldMul);
  if (s.enemyGoldMul) g = Math.floor(g * s.enemyGoldMul);
  const lim = s.totalFloor <= 10 ? 15 : (s.totalFloor === 99 ? 30 : 20);
  const fast = s.turnInFloor <= lim;
  if (fast) { g = Math.floor(g * 2); }
  s.gold += g;
  Events.emit(E.GOLD_CHANGED, { gold: s.gold, delta: g, fast });
  s.relics.forEach(r => { if (r.onKill) r.onKill(s.player); });
  s.stats.roomsCleared++;
  Game.sync();
  setTimeout(() => { if (_onWin) _onWin(fast); }, 400);
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
  // 生存优先：低血量时先防御
  if (s.player.hp < s.player.maxHp * 0.25 && s.enemy.atk > s.player.def + 5) doDefend();
  else if (s.player.mp >= s.player.mpCost && s.rng.chance(0.6)) doSkill();
  else doAttack();
  _autoTimer = setTimeout(autoLoop, 700);
}

// ---- 药水 ----
export function usePotion(idx) {
  const s = Game.state; if (idx < 0 || idx >= s.potions.length) return false;
  // 手动用药水时停止自动战斗
  clearAuto(); s.auto = false;
  const pot = s.potions[idx]; pot.fn(s.player, s); s.potions.splice(idx, 1);
  if (pot.id === "cleanse" && s.curses.length > 0) {
    const removed = s.curses.pop();
    if (removed && removed.remove) { removed.remove(s.player); Events.emit(E.CURSE_REMOVED, { curse: removed }); }
    Events.emit(E.BATTLE_START, { type: 'cleanse', name: removed?.name });
  }
  playSound("potion");
  Events.emit(E.BATTLE_START, { type: 'potion', name: pot.name, desc: pot.desc });
  Game.sync(); return true;
}
