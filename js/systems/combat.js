// ===================== 战斗系统 v0.33 =====================
// 新增：Boss二阶段、精英词条扩展、装备前缀战斗效果、遗物羁绊战斗集成、敌人意图系统
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';
import { playSound, startHeartbeat, stopHeartbeat } from '../core/audio.js';
import { addBuff, tickBuffs, hasBuff, removeBuff } from './buff.js';
import { animPlayerAttack, animEnemyAttack, showBossNarrative, bigFloat, screenShake, log } from '../ui/effects.js';

let _onWin = null, _onOver = null, _autoTimer = null;
export function setCB(w, o) { _onWin = w; _onOver = o; }
export function clearAuto() { if (_autoTimer) { clearTimeout(_autoTimer); _autoTimer = null; } }

// ---- 战斗入口 ----
export function startBattle(type) {
  const s = Game.state;
  // Boss战强制手动，普通/精英自动战斗
  clearAuto();
  s.auto = (type !== "boss"); s._speedMode = false;
  s.defending = false; s.nextBoost = 0; s.turnInFloor = 0;
  s.skillCooldowns = {};
  if (s.auto) _autoTimer = setTimeout(function() { autoLoop(); }, 400);
  s._bossPhase2 = false; s._bossDamaged = false; s._furyActive = false;
  s._desperationUsed = false; s._despAtkDoubled = false;
  s._shadowUsed = false; // 暗影斗篷每场战斗重置
  s._enemyIntent = null; s._eliteMod = null; s._eliteVenom = 0;
  s._healOnKill = 0;
  // 如果调用方已预设了敌人（如心魔镜像/困兽斗），跳过生成，仅做难度缩放
  const hasPreset = s.enemy && s.enemy.hp > 0 && s.enemy.atk > 0;
  if (!hasPreset) s.enemy = null;
  if (hasPreset) {
    // 预设敌人：只做难度/Zone缩放，不重新生成
    const diff = R.get('difficulties', s.difficulty) || R.get('difficulties', 'standard');
    const zoneScale = s.zone ? (s.zone.scale || 1.0) : 1.0;
    s.enemy.hp = Math.floor(s.enemy.hp * diff.monsterMul * zoneScale);
    s.enemy.atk = Math.floor(s.enemy.atk * diff.monsterMul * (1 + (zoneScale - 1) * 0.25));
    s.enemy.maxHp = s.enemy.hp;
    s.enemy.aiTurn = 0; s.enemy.tags = []; s.enemy._buffs = [];
    s.enemies = [s.enemy];
    s.selectedTarget = 0;
    Game.sync();
    return;
  }
  // 波次系统：普通2波/精英3波/Boss1波(+小怪)
  s._waves = []; s._waveIndex = 0;
  var totalWaves = type === "boss" ? 1 : (type === "elite" ? 3 : 2);

  // 生成敌人（1-3只）
  var enemies = [];
  if (type === "boss") {
    // 炼狱20层：后半段用hell专属Boss
    var isHellDeep = (s.difficulty||'').startsWith('hell') && s.floorInZone > 10;
    var bossKey = s.zone ? s.zone.id : (s.zoneIndex + 1);
    var boss = isHellDeep ? (R.get('bosses_hell')||{})[bossKey] : null;
    if (!boss) boss = R.get('bosses', bossKey);
    const endless = R.get('endlessBosses');
    const endlessIdx = Math.max(0, Math.min(s.zoneIndex - 4, (endless || []).length - 1));
    const bossData = boss || (endless && endless.length > 0 ? endless[endlessIdx] : null);
    if (!bossData) { console.error("No boss data for zoneIndex", s.zoneIndex); return; }
    s._bossIntro = bossData.intro || null;
    s._bossPhase2Intro = bossData.phase2Intro || null;
    enemies.push({ ...bossData, maxHp: bossData.hp, hp: bossData.hp, aiTurn: 0, tags: [], _buffs: [] });
    // Ascension Boss小怪
    var diffCfg = R.get('difficulties', s.difficulty) || {};
    if (diffCfg.bossExtra || s.rng.chance(0.4)) {
      var minionPool = R.get('enemies', s.zone?.enemyPool) || R.get('enemies', 'plains');
      var minion = { ...s.rng.pick(minionPool) };
      minion.hp = Math.floor(minion.hp * 0.5); minion.maxHp = minion.hp;
      minion.tags = []; minion._buffs = [];
      enemies.push(minion);
    }
  } else {
    var pool = R.get('enemies', s.zone?.enemyPool) || R.get('enemies', 'plains');
    var baseCount = type === "elite" ? 2 : 1;
    // Ascension难度额外敌人
    var diff2 = R.get('difficulties', s.difficulty) || {};
    if (diff2.extraEnemy) baseCount += diff2.extraEnemy;
    var count = Math.min(4, baseCount + (type === "elite" ? 1 : s.rng.range(0, 1)));
    for (var i = 0; i < count; i++) {
      var pick = s.rng.pick(pool);
      if (!pick) continue;
      var em = { ...pick, maxHp: pick.hp, hp: pick.hp, aiTurn: 0, tags: [], _buffs: [] };
      if (type === "elite") {
        em.hp = Math.floor(em.hp * 1.5); em.atk = Math.floor(em.atk * 1.3);
        em.maxHp = em.hp;
      }
      enemies.push(em);
    }
  }
  s.enemies = enemies;
  s.selectedTarget = 0;
  s.enemy = enemies[0];
  s._waveIndex = 0;
  s._waveTotal = totalWaves;

  // 预生成后续波次
  if (totalWaves > 1) {
    s._waves = [enemies];
    for (var w = 1; w < totalWaves; w++) {
      var waveEnemies = [];
      var wCount = type === "elite" ? s.rng.range(2, 3) : s.rng.range(1, 3);
      var wPool = R.get('enemies', s.zone?.enemyPool) || R.get('enemies', 'plains');
      for (var j = 0; j < wCount; j++) {
        var wp = s.rng.pick(wPool);
        if (!wp) continue;
        var we = { ...wp, maxHp: wp.hp, hp: wp.hp, aiTurn: 0, tags: [], _buffs: [] };
        if (type === "elite") { we.hp = Math.floor(we.hp * 1.3); we.atk = Math.floor(we.atk * 1.2); we.maxHp = we.hp; }
        waveEnemies.push(we);
      }
      s._waves.push(waveEnemies);
    }
  } else {
    s._waves = [enemies];
  }
  // 战斗初始化收尾逻辑
  function finalizeBattle() {
    const diff2 = R.get('difficulties', s.difficulty) || R.get('difficulties', 'standard');
    const zoneScale2 = s.zone ? (s.zone.scale || 1.0) : 1.0;
    s.enemies.forEach(function(em) {
      em.hp = Math.floor(em.hp * diff2.monsterMul * zoneScale2);
      em.atk = Math.floor(em.atk * diff2.monsterMul * (1 + (zoneScale2 - 1) * 0.25));
      em.maxHp = em.hp;
      if (s.enemyHpMul) { em.hp = Math.floor(em.hp * s.enemyHpMul); em.maxHp = em.hp; }
      if (s.enemyAtkMul) em.atk = Math.floor(em.atk * s.enemyAtkMul);
      if (s.enemyDefMul) em.def = Math.floor(em.def * s.enemyDefMul);
      if (type === "boss" && s._zoneMod?.id === "tower_regen") {
        em.hp = Math.floor(em.hp * 1.3); em.atk = Math.floor(em.atk * 1.3); em.maxHp = em.hp;
      }
    });
    s.enemy = s.enemies[0];
    s.selectedTarget = 0;
    // 装备套装效果：清旧值→同zoneSet计数→直接应用到属性
    ['_set_atk','_set_def','_set_maxHp','_set_dodge','_set_lifeSteal','_set_critRate','_set_critMul','_set_pen','_set_maxMp','_set_dmgReduce'].forEach(function(k){ s.player[k]=0; });
    s.player._setActive2 = null; s.player._setActive4 = null;
    var setCounts = {};
    s.equip.forEach(function(eq) { if (eq._zoneSet) { setCounts[eq._zoneSet] = (setCounts[eq._zoneSet]||0)+1; } });
    Object.keys(setCounts).forEach(function(setName) {
      var count = setCounts[setName];
      var zone = null;
      Object.values(R.get('zones')||{}).forEach(function(z) { if (z.equipSet === setName) zone = z; });
      if (!zone) return;
      var bonus = (count >= 4 && zone.equipBonus4) ? zone.equipBonus4 : ((count >= 2 && zone.equipBonus) ? zone.equipBonus : null);
      if (!bonus) return;
      s.player._setActive2 = (count >= 2) ? setName : null;
      s.player._setActive4 = (count >= 4) ? setName : null;
      if (bonus.atk) s.player.atk += bonus.atk;
      if (bonus.def) s.player.def += bonus.def;
      if (bonus.maxHp) { s.player.maxHp += bonus.maxHp; s.player.hp += bonus.maxHp; }
      if (bonus.dodge) s.player.dodge = (s.player.dodge||0) + bonus.dodge;
      if (bonus.lifeSteal) s.player.lifeSteal = (s.player.lifeSteal||0) + bonus.lifeSteal;
      if (bonus.critRate) s.player.critRate += bonus.critRate;
      if (bonus.critMul) s.player.critMul += bonus.critMul;
      if (bonus.pen) s.player.pen = (s.player.pen||0) + bonus.pen;
      if (bonus.maxMp) { s.player.maxMp += bonus.maxMp; s.player.mp += bonus.maxMp; }
      if (bonus.dmgReduce) s.player.dmgReduce = (s.player.dmgReduce||0) + bonus.dmgReduce;
    });
    // 套装激活日志
    if (s.player._setActive4) { setTimeout(function(){ log('<span class="win">🏷️ 套装激活：' + s.player._setActive4 + ' 4件套！</span>'); }, 200); }
    else if (s.player._setActive2) { setTimeout(function(){ log('<span class="info">🏷️ 套装激活：' + s.player._setActive2 + ' 2件套</span>'); }, 200); }
    // 恢复怪物标签系统
    if (s._zoneMod?.id === "ruins_ancient") addTag(s);
    if (s.floorInZone > 3 && s.rng.chance(0.55)) addTag(s);
    if (diff2.extraTag && s.rng.chance(0.35)) addTag(s);
    if (diff2.doubleTag && s.rng.chance(0.5)) { addTag(s); addTag(s); }
    // 风险门：额外词条
    if (s._riskRoom) { addTag(s); s._riskReward = true; s._riskRoom = false; }
    // 新Zone环境：魔塔下层扣血+攻 / 魔塔上层+暴击
    if (s._zoneMod?.id === "tower_lower_drain" && s.player) { s.player.atk = Math.floor(s.player.atk * 1.2); }
    if (s._zoneMod?.id === "tower_upper_seal" && s.player) { s.player.critRate += 0.25; }
    // 恢复意图系统
    s.enemies.forEach(function(em) { if (em.hp > 0) updateIntentFor(em, s); });
    Events.emit(E.BATTLE_START, { type: type, floor: s.totalFloor, zone: s.zone });
    if (type === "boss") playSound("bossRoar");
    if (s.player.doubleFirst) Events.emit(E.BATTLE_START, { type: 'doubleFirst' });
    Game.sync();
  }

  // Boss开场叙事
  if (type === "boss" && s._bossIntro) {
    showBossNarrative(s._bossIntro, () => finalizeBattle());
  } else {
    finalizeBattle();
  }
}

function addTag(s) {
  const tag = s.rng.pick(R.get('monsterTags'));
  if (!tag) return; // 空池守卫
  // 对所有活着的敌人添加标签
  (s.enemies || []).forEach(function(en) {
    if (en.hp <= 0) return;
    if (!en.tags) en.tags = [];
    if (!en.tags.find(x => x.id === tag.id)) {
      const c = { ...tag }; c.apply(en); en.tags.push(c);
    }
  });
}

// ---- 敌人意图系统（v0.40：多敌人版）----
function updateIntentFor(enemy, s) {
  if (!enemy) return;
  var hpPct = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
  var actions = [];
  if (enemy.skill && s.turnInFloor > 0 && (s.turnInFloor + 1) % 3 === 0) {
    actions.push({ type: "skill", icon: "⚡", name: enemy.skill.name || "技能" });
  } else if (hpPct < 0.3 && s.rng.chance(0.3)) {
    actions.push({ type: "defend", icon: "🛡️", name: "防御姿态" });
  } else if (enemy.aiCharge && s.rng.chance(0.4)) {
    actions.push({ type: "charge", icon: "⚡", name: "蓄力" });
  } else if (hpPct < 0.5 && s.rng.chance(0.3)) {
    actions.push({ type: "heavy", icon: "💢", name: "重击" });
  } else {
    actions.push({ type: "attack", icon: "⚔️", name: "攻击" });
  }
  enemy._intent = s.rng.pick(actions);
}

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
// 获取当前选中敌人
function getTarget(s) {
  var es = s.enemies || [];
  if (es.length === 0) return null;
  if (s.selectedTarget >= es.length) s.selectedTarget = 0;
  var t = es[s.selectedTarget];
  if (!t || t.hp <= 0) {
    for (var i = 0; i < es.length; i++) { if (es[i].hp > 0) { s.selectedTarget = i; return es[i]; } }
    return null;
  }
  return t;
}

export function doAttack() {
  const s = Game.state; var t = getTarget(s);
  // 没有活着的敌人→检查是否该触发胜利
  if (s.gameOver) return;
  if (!t) {
    var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
    if (!anyAlive) { win(); return; }
    return; // 有活着的但没选中→等render刷新
  }
  s.defending = false;
  animPlayerAttack();
  if (s.player._stoneGaze) { delete s.player._stoneGaze; enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700); return; }
  // 破绽系统：每3回合敌人露破绽
  var weakSpot = (s.turnInFloor > 0 && s.turnInFloor % 3 === 0);
  let dmg = calcDmg(null, t);
  if (weakSpot) { dmg = Math.floor(dmg * 3); bigFloat("💢破绽！", "big-crit", 600); }
  applyDmg(dmg, false, t);
  if (s.player.doubleFirst && s.turnInFloor === 0) {
    Events.emit(E.BATTLE_START, { type: 'doubleAttack' });
    var t2 = getTarget(s); if (t2) applyDmg(calcDmg(null, t2), false, t2);
    s.player.doubleFirst = false;
  }
  t = getTarget(s); if (!t) { win(); return; }
  enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700);
}

// CD制技能：传技能索引。AOE技能打全体，普通技能打选中目标
export function doSkill(skillIdx) {
  const s = Game.state;
  const skills = s.activeSkills || [];
  if (skillIdx < 0 || skillIdx >= skills.length) return;
  const sk = skills[skillIdx];
  if (!sk) return;
  const cdKey = sk.id || ('skill_' + skillIdx);
  if ((s.skillCooldowns[cdKey] || 0) > 0) return;
  // 没有活着的敌人→胜利
  var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
  if (!anyAlive) { win(); return; }
  s.defending = false;
  animPlayerAttack();
  if (s.player._stoneGaze) { delete s.player._stoneGaze; enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700); return; }
  s.skillCooldowns[cdKey] = (sk.cooldown != null ? sk.cooldown : 2);
  // 遗物：回音石（20%概率技能不进入冷却）
  if (s.player._echoStone && s.rng && s.rng.chance(0.20)) {
    s.skillCooldowns[cdKey] = 0;
    bigFloat("🪨 回音！", "float-dmg", 600);
  }
  if (sk.selfDmg) { const cost = Math.max(1, Math.floor(s.player.hp * sk.selfDmg)); s.player.hp -= cost; if (s.player.hp <= 0) { s.player.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; } }
  if (sk.effect === "smoke") { s._smokeNext = true; }
  if (sk.heal) { const h = Math.floor(s.player.maxHp * sk.heal); s.player.hp = Math.min(s.player.maxHp, s.player.hp + h); }
  if (sk.reduceCD) {
    Object.keys(s.skillCooldowns).forEach(function(k) {
      if (k !== cdKey && s.skillCooldowns[k] > 0) s.skillCooldowns[k] = Math.max(0, s.skillCooldowns[k] - sk.reduceCD);
    });
  }
  // 升级附加效果
  if (sk.immune) { s.defending = true; }
  if (sk.dmgRed) { s.player.dmgReduce = (s.player.dmgReduce || 0) + sk.dmgRed; s._tempDmgRed = (s._tempDmgRed || 0) + sk.dmgRed; }
  if (sk.selfDef) { s.player.def += sk.selfDef; s._tempDefBonus = (s._tempDefBonus || 0) + sk.selfDef; }
  if (sk.defBreak && s.enemy) { s.enemy.def = Math.max(0, (s.enemy.def || 0) - sk.defBreak); }
  if (sk.permAtk) { s.player.atk += sk.permAtk; }
  if (sk.permDef) { s.player.def += sk.permDef; }
  if (sk.freeze && s.enemy && s.enemy.hp > 0) { addBuff(s.enemy, { id:'stun', name:'冻结', turns:1, onTick:function(){return'stunned';} }); }
  if (sk.poison && s.enemy && s.enemy.hp > 0) { addBuff(s.enemy, { id:'poison', name:'中毒', turns:3, data:{dmg:4+Math.floor(s.totalFloor/5)}, onTick:function(e,b){e.hp-=b.data.dmg;if(e.hp<=0)return'dead';} }); }
  if (sk.lifeSteal) { s.player.lifeSteal = (s.player.lifeSteal || 0) + sk.lifeSteal; }
  if (sk.lifeStealUp) { s.player.lifeSteal = (s.player.lifeSteal || 0) + sk.lifeStealUp; }
  if (sk.nextCrit) { s._smokeNext = true; }
  if (sk.critUp) { s.player.critRate += sk.critUp; }
  if (sk.critMulUp) { s.player.critMul += sk.critMulUp; }
  if (sk.dodgeUp) { s.player.dodge = (s.player.dodge || 0) + sk.dodgeUp; }
  if (sk.cleanse && s.curses.length > 0) { var rmc = s.curses.pop(); if (rmc && rmc.remove) rmc.remove(s.player); }
  if (sk.thorns) { s.player.thorn = (s.player.thorn || 0) + sk.thorns; }
  if (sk.debuff && s.enemy) { s.enemy.atk = Math.max(1, (s.enemy.atk || 0) - sk.debuff); }

  // 绝境逆转：HP<15%→全CD清零+伤害翻倍（每场战斗仅1次）
  if (s.player.hp < s.player.maxHp * 0.15 && !s._desperationUsed) {
    s._desperationUsed = true;
    Object.keys(s.skillCooldowns).forEach(function(k) { s.skillCooldowns[k] = 0; });
    s.player.atk = Math.floor(s.player.atk * 2);
    bigFloat("⚡绝境逆转！", "big-crit", 1200);
    log("<span class='win'>⚡ 绝境逆转！全技能冷却清零+攻击翻倍！</span>");
    s._despAtkDoubled = true;
  }

  // AOE：打全体，伤害×0.7
  if (sk.aoe) {
    var enemies = s.enemies || [];
    enemies.forEach(function(e) {
      if (e.hp <= 0) return;
      var dmg = calcDmg(sk, e);
      dmg = Math.floor(dmg * 0.7);
      applyDmg(dmg, true, e);
      if (sk.effect && sk.effect !== "smoke" && sk.effect !== "pen") applySkillEffectTo(sk.effect, e, s);
    });
  } else {
    // 单体：打选中目标
    var t = getTarget(s);
    if (!t) { win(); return; }
    var dmg = calcDmg(sk, t);
    if (s._smokeNext) { s._smokeNext = false; dmg = Math.floor(dmg * s.player.critMul); s.stats.critCount++; }
    applyDmg(dmg, true, t);
    if (sk.doubleHit && t.hp > 0) { var d2 = calcDmg(sk, t); applyDmg(d2, true, t); }
    if (sk.effect && t.hp > 0 && sk.effect !== "smoke" && sk.effect !== "pen") applySkillEffectTo(sk.effect, t, s);
  }

  var alive = (s.enemies || []).filter(function(e) { return e.hp > 0; });
  if (alive.length === 0) { win(); return; }
  enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700);
}

// 技能效果应用（作用于特定敌人）
function applySkillEffectTo(effect, enemy, s) {
  if (!enemy || enemy.hp <= 0) return;
  switch (effect) {
    case 'burn':
      enemy._buffs.push({ id:'burn', name:'燃烧', turns:2, data:{dmg:4+Math.floor(s.totalFloor/5)}, onTick:function(e,b){e.hp-=b.data.dmg;if(e.hp<=0)return'dead';} });
      break;
    case 'slow':
      enemy._buffs.push({ id:'slow', name:'迟缓', turns:1, onRemove:function(){} });
      break;
    case 'stun':
      if (s.rng.chance(0.5)) enemy._buffs.push({ id:'stun', name:'眩晕', turns:1, onTick:function(){return'stunned';} });
      break;
    case 'poison':
      enemy._buffs.push({ id:'poison', name:'中毒', turns:3, data:{dmg:4+Math.floor(s.totalFloor/5)}, onTick:function(e,b){e.hp-=b.data.dmg;if(e.hp<=0)return'dead';} });
      break;
  }
}

export function doDefend() {
  const s = Game.state; var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
  if (s.gameOver) return;
  if (!anyAlive) { win(); return; }
  s.defending = true; s.nextBoost = 0.35;
  s._interrupted = true; // 打断敌人本回合技能/蓄力
  Events.emit(E.BATTLE_START, { type: 'defend' });
  playSound("hit"); enemyTurn(); Game.sync(); if (s.auto) setTimeout(autoLoop, 700);
}

// ---- 伤害计算（集成装备前缀效果 + 羁绊效果）----
function calcDmg(sk, targetEnemy) {
  const p = Game.state.player, e = targetEnemy || Game.state.enemy, s = Game.state;
  if (!e) return 1;
  let atk = p.atk;
  s.equip.forEach(q => { if (q.stat === "atk") atk += q.val; });
  if (p.rage && p.hp < p.maxHp * 0.3) atk = Math.floor(atk * 1.5);
  if (p.berserk) { const r = Math.max(0, 1 - p.hp / p.maxHp); atk = Math.floor(atk * (1 + r)); }
  if (p.debuffAtk && p.debuffAtk.turns > 0) atk = Math.max(1, atk - p.debuffAtk.value);
  if (s.potionAtk) atk = Math.floor(atk * (1 + s.potionAtk));
  if (p._synGoldTycoon) { const bonus = Math.min(15, Math.floor(s.gold / 30) * 3); atk += bonus; }
  if (p._synCurseMaster) { atk += s.curses.length * 5; }
  if (p._curseBlade) { atk += s.curses.length * 5; }
  if (p._synFuryBorn && s._furyActive) { atk = Math.floor(atk * 1.5); }
  if (p._greedBag && s.gold > 0) { atk += Math.min(18, Math.floor(s.gold / 30) * 3); }
  const isSkill = sk && sk.mul;
  let def = e.def;
  if (isSkill) {
    const pen = (p.pen || 0) + (sk.extraPen || 0) + (sk.pen || 0);
    def = Math.floor(def * (1 - pen));
  }
  let dmg = Math.max(1, atk - def);
  if (isSkill) dmg = Math.floor(dmg * (sk.mul || p.skillMul));
  else if (sk && sk.mul) dmg = Math.floor(dmg * sk.mul);
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
  // 遗物：死亡标记（对低血+50%伤害）
  if (p._deathMark && e.hp < e.maxHp * 0.35) dmg = Math.floor(dmg * 1.5);
  // 装备前缀：混沌（30%概率+50%）
  const chaosEq = s.equip.find(q => q._combatEffect?.type === "chaos");
  if (chaosEq && s.rng.chance(chaosEq._combatEffect.value)) dmg = Math.floor(dmg * 1.5);
  // 羁绊：暗影之舞（首回合+30%）
  if (p._synShadowDance && s.turnInFloor === 0) dmg = Math.floor(dmg * 1.3);
  // 遗物：先手之刃（首回合+50%）
  if (p._firstStrike && s.turnInFloor === 0) dmg = Math.floor(dmg * 1.5);
  return dmg;
}

function applyDmg(dmg, skill, targetEnemy) {
  const s = Game.state, p = s.player;
  var e = targetEnemy || s.enemy;
  if (!e || e.hp <= 0) return;
  let cr = p.critRate; s.equip.forEach(q => { if (q.stat === "critRate") cr += q.val / 100; });
  let crit = s.rng.chance(cr);
  if (crit) {
    dmg = Math.floor(dmg * p.critMul); s.stats.critCount++;
    Events.emit(E.PLAYER_DAMAGED, { dmg, crit: true, skill });
    playSound("crit");
  } else if (s.nextBoost > 0 && s.nextBoost !== 0.35) {
    Events.emit(E.PLAYER_DAMAGED, { dmg, crit: false, counter: true });
    playSound("attack");
  } else {
    Events.emit(E.PLAYER_DAMAGED, { dmg, crit: false });
    playSound("attack");
  }
  s.stats.totalDmg += dmg; e.hp -= dmg;
  if (dmg > 25) playSound("heavyHit");
  if (!skill) applyEquipCombatEffects(s);
  if (p.lifeSteal > 0) {
    const h = Math.floor(dmg * p.lifeSteal);
    p.hp = Math.min(p.maxHp, p.hp + h);
    Events.emit(E.PLAYER_HEALED, { amount: h, hp: p.hp, maxHp: p.maxHp, source: 'lifeSteal' });
  }
  s.relics.forEach(r => { if (r.onAttack) r.onAttack(p, dmg, s); });
  // 遗物特效反馈
  if (p._medusaHead && s.rng.chance(0.1) && e && e.hp > 0) { e.hp = 0; bigFloat("🗿 石化！", "big-crit", 1000); playSound("crit"); }
  if (p._gamblersDice && !crit && dmg > 0) { bigFloat("🎲", "float-dmg", 500); }
  if (dmg >= 200) checkAchievement(s, "one_shot_200");
  if (e.thorn) {
    const th = Math.floor(dmg * e.thorn);
    p.hp -= th;
    Events.emit(E.PLAYER_DAMAGED, { dmg: th, source: 'thorn', enemy: e.name });
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
        // 取最大值而非覆盖（多件装备叠加）
        s._healOnKill = Math.max(s._healOnKill || 0, fx.value || 0.1);
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
  const s = Game.state, p = s.player;
  animEnemyAttack();
  var enemies = s.enemies || [];
  var hasLiveTarget = false;
  enemies.forEach(function(e) {
    if (e.hp <= 0) return;
    hasLiveTarget = true;
    var status = tickBuffs(e, true);
    if (status === 'dead') { return; }
    if (status === 'stunned') return;
    // 打断检查
    if (s._interrupted && (e.aiCharge || (e._intent && (e._intent.type === 'skill' || e._intent.type === 'heavy')))) {
      e._intent = null; e.chargeTurns = 0;
      setTimeout(function() { bigFloat("🛡️ 打断！", "big-crit", 800); screenShake(1); }, 50);
    }
    var dmg = Math.max(1, e.atk - p.def);
    if (hasBuff(e, 'slow')) { dmg = Math.floor(dmg * 0.7); removeBuff(e, 'slow'); }
    if (!s._interrupted && e.aiCharge) { e.chargeTurns = (e.chargeTurns || 0) + 1; if (e.chargeTurns % 3 === 0) dmg = Math.floor(dmg * 2); }
    if (s.defending) dmg = Math.floor(dmg * 0.5);
    if (s.nextBoost > 0.3) { dmg = Math.floor(dmg * 0.5); } // 防御减伤
    if (p.dodge && s.rng.chance(p.dodge)) {
      dmg = 0; Events.emit(E.BATTLE_START, { type: 'dodge' });
      return;
    }
    // 镜盾格挡
    if (p._mirrorShield && s.rng && s.rng.chance(0.2)) { dmg = 0; bigFloat("🛡️ 格挡！", "big-dodge", 700); return; }
    strike(dmg, e);
    if (p.hp <= 0) return;
  });

  if (p.hp <= 0) { p.hp = 0; Game.sync(); setTimeout(() => gameOver(), 500); return; }
  s._interrupted = false;
  var realAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
  if (!realAlive) {
    // 遗物：时间沙漏（击杀后获得额外行动=治疗+CD-1）
    if (p._extraTurn) {
      p._extraTurn = false;
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.15));
      Object.keys(s.skillCooldowns).forEach(function(k) { if (s.skillCooldowns[k] > 0) s.skillCooldowns[k]--; });
      bigFloat("⏳ 额外行动！", "big-crit", 1000);
    }
    win(); return;
  }
  if (s.defending) s.defending = false;
  if (s.skillCooldowns) {
    Object.keys(s.skillCooldowns).forEach(function(k) { if (s.skillCooldowns[k] > 0) s.skillCooldowns[k]--; });
  }
  // 新Zone环境
  if (s._zoneMod?.id === "tower_lower_drain") { var drain = Math.max(1, Math.floor(s.player.maxHp * 0.02)); s.player.hp -= drain; }
  if (s._zoneMod?.id === "swamp_poison") { s.player.hp -= 3; s.enemies.forEach(function(e) { if (e.hp > 0) e.hp -= 3; }); }
  if (s._zoneMod?.id === "tower_upper_seal" && s.turnInFloor % 3 === 0 && s.activeSkills && s.activeSkills.length > 0) {
    var rIdx = s.rng.range(0, s.activeSkills.length - 1);
    var rSk = s.activeSkills[rIdx];
    if (rSk && rSk.id) s.skillCooldowns[rSk.id] = Math.max((s.skillCooldowns[rSk.id] || 0), 1);
  }
  // 时间加速突变：每回合过2回合
  if (s._mutationTime) { s.turn++; s.turnInFloor++; if (s.skillCooldowns) { Object.keys(s.skillCooldowns).forEach(function(k) { if (s.skillCooldowns[k] > 0) s.skillCooldowns[k]--; }); } }
  // 亡灵天灾：被击杀敌人3回合后复活
  if (s._mutationUndead && s._undeadQueue) {
    s._undeadQueue = s._undeadQueue.filter(function(u) { u.turns--; if (u.turns <= 0) { u.enemy.hp = Math.floor(u.enemy.maxHp * 0.5); s.enemies.push(u.enemy); log('<span class="warn">☠️ ' + u.enemy.name + '复活了！</span>'); return false; } return true; });
  }
  // 魔力紊乱：技能CD随机变化
  if (s._mutationChaos && s.skillCooldowns && s.rng.chance(0.3)) {
    var keys = Object.keys(s.skillCooldowns).filter(function(k){return s.skillCooldowns[k]>0;});
    if (keys.length > 0) { var rk = s.rng.pick(keys); s.skillCooldowns[rk] = s.rng.range(0, 3); }
  }
  // 幽灵模式受伤翻倍已在strike中处理
  s.turn++; s.turnInFloor++;
  // 遗物回合效果（烈焰光环、末日时钟、贤者之石等）
  s.relics.forEach(function(r) { if (r.onTurn) r.onTurn(s.player, s.enemy, s); });
  Events.emit(E.TURN_END, { turn: s.turn, turnInFloor: s.turnInFloor });
}

function strike(dmg, e) {
  const s = Game.state, p = s.player;
  if (!e) return;
  // 遗物：暗影斗篷（每场战斗首次受击完全闪避）
  if (p._shadowCloak && !s._shadowUsed) {
    s._shadowUsed = true; dmg = 0;
    bigFloat("🌑 暗影闪避！", "big-dodge", 700);
    Events.emit(E.BATTLE_START, { type: 'dodge' });
    return;
  }
  if (s._mutationGhost) dmg = Math.floor(dmg * 2); // 幽灵模式受伤翻倍
  if (s._mutationBlood && p.hp < p.maxHp * 0.5) dmg = Math.floor(dmg * 0.7); // 血月低血减伤
  p.hp -= dmg;
  if (s._currentRoomType === "boss" && dmg > 0) s._bossDamaged = true;
  Events.emit(E.PLAYER_DAMAGED, { dmg, hp: p.hp, maxHp: p.maxHp, source: e.name });
  playSound("hit");
  if (e.lifeSteal) { const h = Math.floor(dmg * e.lifeSteal); e.hp = Math.min(e.maxHp, e.hp + h); }
  s.relics.forEach(r => { if (r.onHit) r.onHit(p, e, dmg, s); });
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
  stopHeartbeat();
  // Boss二阶段检测（从enemies中找boss，确保多敌人场景正确）
  var bossEnemy = null;
  (s.enemies || []).forEach(function(e) {
    if (e.phase2 && !bossEnemy) bossEnemy = e;
  });
  if (!bossEnemy) bossEnemy = s.enemy;

  // 波次切换：还有下一波→生成新敌人
  if (s._waveIndex + 1 < s._waveTotal && s._waves && s._waves[s._waveIndex + 1]) {
    s._waveIndex++;
    var wasAuto = s.auto; var wasSpeed = s._speedMode;
    var nextWave = s._waves[s._waveIndex];
    var dScale = R.get('difficulties', s.difficulty) || {};
    var zScale = s.zone ? (s.zone.scale || 1.0) : 1.0;
    nextWave.forEach(function(em) {
      em.hp = Math.floor(em.hp * (dScale.monsterMul||1) * zScale);
      em.atk = Math.floor(em.atk * (dScale.monsterMul||1) * (1 + (zScale-1)*0.25));
      em.maxHp = em.hp;
    });
    s.enemies = nextWave;
    s.enemy = nextWave.length > 0 ? nextWave[0] : null;
    s.selectedTarget = 0;
    if (!s.enemy) { win(); return; } // 空波次直接胜利
    s.turnInFloor = 0;
    s.auto = wasAuto; s._speedMode = wasSpeed;
    log('<span class="win">⚔️ 第' + (s._waveIndex+1) + '/' + s._waveTotal + '波敌人来袭！</span>');
    bigFloat('⚔️ 第' + (s._waveIndex+1) + '波！', 'big-crit', 800);
    Game.sync();
    clearAuto();
    if (wasAuto || wasSpeed) { _autoTimer = setTimeout(function() { autoLoop(); }, 800); }
    return;
  }

  if (s._currentRoomType === "boss" && !s._bossPhase2 && bossEnemy && bossEnemy.phase2) {
    var phase2Hp = Math.floor((bossEnemy.maxHp || bossEnemy.hp * 2) * 0.5);
    if (bossEnemy.hp <= phase2Hp) {
      s._bossPhase2 = true;
      var p2 = bossEnemy.phase2;
      var doPhase2 = function() {
        bossEnemy.name = p2.name;
        bossEnemy.atk = Math.floor((bossEnemy.atk || 10) * (p2.atkMul || 1.3));
        bossEnemy.def = (bossEnemy.def || 0) + (p2.defBonus || 0);
        bossEnemy.skill = p2.skill;
        bossEnemy.hp = phase2Hp;
        bossEnemy.maxHp = phase2Hp;
        bossEnemy._buffs = [];
        s._furyActive = false;
        s.enemy = bossEnemy;
        s.selectedTarget = s.enemies.indexOf(bossEnemy);
        if (s.selectedTarget < 0) s.selectedTarget = 0;
        // 清除已死的小怪
        s.enemies = s.enemies.filter(function(e) { return e.hp > 0 || e === bossEnemy; });
        s.auto = false; s._speedMode = false; clearAuto();
        Events.emit(E.BATTLE_START, { type: 'bossPhase2', name: p2.name });
        Game.sync();
      };
      if (s._bossPhase2Intro) {
        showBossNarrative(s._bossPhase2Intro, function() { doPhase2(); });
      } else {
        doPhase2();
      }
      return;
    }
  }
  // 正常击杀
  var killedName = s.enemies ? s.enemies.map(function(e){return e.name;}).join("、") : "敌人";
  Events.emit(E.ENEMY_KILLED, { name: killedName, floor: s.totalFloor });
  playSound("win");
  if (s.enemies) s.enemies.forEach(function(e) { Game.recordKill(e.name, s.totalFloor, e); });
  // 亡灵天灾：记录待复活敌人
  if (s._mutationUndead) {
    if (!s._undeadQueue) s._undeadQueue = [];
    s.enemies.forEach(function(e) { if (e.hp <= 0) s._undeadQueue.push({ enemy: e, turns: 3 }); });
  }
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
  s.relics.forEach(r => { if (r.onKill) r.onKill(s.player, s); });
  // 影卫被动
  if (s.player._shadowBorn) { s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.floor(s.player.maxHp * 0.2)); }
  // 羁绊：狂战士之魂（击杀后下回合+50%伤害）
  if (s.player._synFuryBorn) { s._furyActive = true; }
  // 羁绊：收割者（击杀回复20%生命）
  if (s.player._synExecutioner) { s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.floor(s.player.maxHp * 0.2)); }
  // 遗物：血钱（额外金币但扣血）
  if (s.relics.some(r => r.id === "blood_money") || s.player._bloodMoney) { s.gold += 15; s.player.hp -= Math.floor(s.player.maxHp * 0.05); }
  // 遗物：战痕（每2场战斗+2攻）
  if (s.relics.some(r => r.id === "battle_scar") && s.player._scarBattles !== undefined) {
    s.player._scarBattles++;
    if (s.player._scarBattles % 2 === 0) {
      s.player.atk += 2;
      s.player._scarAtkGain = (s.player._scarAtkGain || 0) + 2;
      Events.emit(E.BATTLE_START, { type: 'bossSkill', name: '战痕', skillName: '', msg: `💢 战痕累积！攻击永久+2（总计+${s.player._scarAtkGain}）` });
    }
  }
  // 清理金盾临时防御（下次战斗根据新金币重新计算）
  if (s.player._gsDefBonus) { s.player.def -= s.player._gsDefBonus; delete s.player._gsDefBonus; }
  // 成就追踪（难度通关成就由 main.js gameClear 处理）
  if (roomType === 'boss' && !s._bossDamaged) checkAchievement(s, "flawless_boss");
  if (s.gold >= 200) checkAchievement(s, "gold_200");
  if (s.relics.length >= 6) checkAchievement(s, "six_relics");
  if (s.equip.length >= 6) checkAchievement(s, "six_equips");
  if (s.curses.length >= 3) checkAchievement(s, "three_curses");
  if (s.totalFloor >= 30 && s.endless) checkAchievement(s, "endless_30");
  // _furyActive 由 startBattle() 清除，此处不再清零（否则狂战士之魂永远不触发）
  s.stats.roomsCleared++;
  s.auto = false; s._speedMode = false; clearAuto();
  Game.sync();
  if (_onWin) {
    setTimeout(function() { _onWin(fast); }, 300);
  } else {
    console.error("[妖塔] _onWin 回调未设置，无法弹出奖励！");
  }
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
  // 遗物：血盾（致命伤害以1血存活，每局1次）
  if (s.player._bloodShield && s.player.hp <= 0) {
    s.player.hp = 1; s.player._bloodShield = false;
    Events.emit(E.PLAYER_HEALED, { amount: 1, hp: 1, maxHp: s.player.maxHp, source: 'bloodShield' });
    playSound("heal"); bigFloat("🛡️ 血盾！", "big-dodge", 1000); Game.sync(); return;
  }
  if (s.player.rebirth && s.player.hp <= 0) {
    s.player.hp = Math.floor(s.player.maxHp * 0.5); s.player.rebirth = false;
    Events.emit(E.PLAYER_HEALED, { amount: s.player.hp, hp: s.player.hp, maxHp: s.player.maxHp, source: 'rebirth' });
    playSound("heal"); Game.sync(); return;
  }
  s.auto = false; s.gameOver = true; playSound("lose"); Game.sync();
  Events.emit(E.GAME_OVER, {});
  if (_onOver) _onOver();
}

// ---- 战斗模式（手动→加速→自动 三档循环）----
export function toggleAuto() {
  const s = Game.state; clearAuto();
  if (!s.auto && !s._speedMode) { s._speedMode = true; s.auto = false; }
  else if (s._speedMode) { s._speedMode = false; s.auto = true; }
  else { s._speedMode = false; s.auto = false; }
  Game.sync();
  if (s.auto || s._speedMode) {
    var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
    if (anyAlive) autoLoop();
  }
}
function autoLoop() {
  const s = Game.state;
  var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
  if (s.gameOver || (!s.auto && !s._speedMode) || !anyAlive) { clearAuto(); return; }
  var spd = s._speedMode ? 350 : 700;
  if (s.auto) {
    if (s.player.hp < s.player.maxHp * 0.25 && s.potions.length > 0) { usePotion(0); _autoTimer = setTimeout(autoLoop, spd); return; }
    var maxEnemyAtk = 0; (s.enemies || []).forEach(function(e) { if (e.hp > 0 && e.atk > maxEnemyAtk) maxEnemyAtk = e.atk; });
    if (s.player.hp < s.player.maxHp * 0.2 && maxEnemyAtk > s.player.def + 5) { doDefend(); _autoTimer = setTimeout(autoLoop, spd); return; }
    var available = []; var skills = s.activeSkills || [];
    skills.forEach(function(sk, i) { var cdKey = sk.id || ('skill_' + i); if ((s.skillCooldowns[cdKey] || 0) === 0) available.push(i); });
    if (available.length > 0 && s.rng.chance(0.6)) { doSkill(s.rng.pick(available)); }
    else { doAttack(); }
  } else {
    // 加速模式：简单AI + 生存检查
    if (s.player.hp < s.player.maxHp * 0.2 && s.potions.length > 0) { usePotion(0); _autoTimer = setTimeout(autoLoop, spd); return; }
    var avail2 = []; var skills2 = s.activeSkills || [];
    skills2.forEach(function(sk, i) { var cdKey = sk.id || ('skill_' + i); if ((s.skillCooldowns[cdKey] || 0) === 0) avail2.push(i); });
    if (avail2.length > 0 && s.rng.chance(0.5)) { doSkill(s.rng.pick(avail2)); }
    else { doAttack(); }
  }
  _autoTimer = setTimeout(autoLoop, spd);
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
  // 遗物：不灭之瓶（药水额外回复20%最大生命）
  if (s.player._eternalVial) {
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.floor(s.player.maxHp * 0.2));
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
