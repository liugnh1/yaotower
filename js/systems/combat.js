// ===================== 战斗系统 v0.40 — 能量制 =====================
// 能量系统：每回合3能量，攻击1⚡，技能1-3⚡，防御0⚡（免费1次）
// 每回合最多2次行动，能量耗尽或手动结束回合触发敌人行动
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { checkCurseSynergies } from '../systems/synergy.js';
import { E, Events } from '../core/event-bus.js';
import { playSound, stopHeartbeat } from '../core/audio.js';
import { addBuff, tickBuffs, hasBuff, removeBuff } from './buff.js';
import { animPlayerAttack, animPlayerCrit, animEnemyAttack, showBossNarrative, bigFloat, screenShake, log, toast } from '../ui/effects.js';

let _onWin = null, _onOver = null, _autoTimer = null;
export function setCB(w, o) { _onWin = w; _onOver = o; }
export function clearAuto() { if (_autoTimer) { clearInterval(_autoTimer); _autoTimer = null; } }

function startAutoLoop() {
  clearAuto();
  const s = Game.state;
  if (!s || !s.auto || s.gameOver) return;
  var spd = s._turboMode ? 175 : (s._speedMode ? 350 : 700);
  _autoTimer = setInterval(function() {
    if ((!s.auto && !s._speedMode && !s._turboMode) || s.gameOver) { clearAuto(); return; }
    try { autoLoop(); } catch(e) { console.error(e); }
  }, spd);
}

// ---- 能量/行动管理 ----
const MAX_ENERGY = 3;
const MAX_ACTIONS = 2;

function refillEnergy(s) {
  if (!s.player) return;
  // 防御NaN：确保能量始终为合法数字
  if (typeof s.player.energy !== 'number' || isNaN(s.player.energy)) s.player.energy = 0;
  if (typeof s.player.maxEnergy !== 'number' || isNaN(s.player.maxEnergy)) s.player.maxEnergy = MAX_ENERGY;
  // 能量留存：未用完的能量最多保留2点到下回合
  var carry = Math.min(2, s.player.energy || 0);
  s.player.energy = Math.min((s.player.maxEnergy || MAX_ENERGY) + carry, 10); // 硬上限10
  // 满溢爆发：能量≥5 → 所有技能CD-1
  if (s.player.energy >= 5 && s.skillCooldowns) {
    Object.keys(s.skillCooldowns).forEach(function(k) {
      if (s.skillCooldowns[k] > 0) s.skillCooldowns[k]--;
    });
    bigFloat('💥 满溢爆发！', 'big-crit', 800);
    log('<span class="win">💥 能量满溢！所有技能CD-1</span>');
  }
  s._actionsThisTurn = 0;
  s._defendedThisTurn = false;
}

// 每行动后检查是否自动结束回合
function afterAction(s) {
  s._acting = false;
  Game.sync();
  var anyAlive = (s.enemies || []).some(function(e) { return e && e.hp > 0; });
  if (!anyAlive) { win(); return; }
  // 能量耗尽或行动满 → 自动触发敌人回合
  if ((s.player && s.player.energy <= 0) || (s._actionsThisTurn || 0) >= MAX_ACTIONS) {
    if (s.auto || s._speedMode) { enemyTurn(); }
  }
  Game.sync();
}

// ---- 战斗入口 ----
export function startBattle(type) {
  const s = Game.state;
  // Boss战强制手动，普通/精英自动战斗
  clearAuto();
  s.auto = (type !== "boss"); s._speedMode = false;
  // ====== 全面重置战斗状态 ======
  s.defending = false; s.nextBoost = 0; s.turnInFloor = 0;
  s.skillCooldowns = {};
  s._interrupted = false; s._comboCount = 0; s._lastTarget = null;
  s._lastCrit = false; s._iceNext = false; s._shadowCounter = false;
  s._keystoneFiredThisBattle = false; // v0.50 天赋大点特效每战首次
  // 能量系统初始化
  if (s.player) { s.player.energy = s.player.maxEnergy || MAX_ENERGY; }
  s._actionsThisTurn = 0; s._defendedThisTurn = false;
  if (s.auto || s._speedMode || s._turboMode) startAutoLoop();
  s._bossPhase2 = false; s._bossDamaged = false;
  s._desperationUsed = false; s._despAtkDoubled = false;
  s._acting = false; s._winning = false;
  if (s.player) { s.player._drumAtk = 0; s.player._tempHp = 0; }
  // v0.51 天赋·护体：每场战斗开始获得护盾
  if (s.player && s.player._talentStartShield) { s.player._tempHp = (s.player._tempHp || 0) + s.player._talentStartShield; bigFloat('🛡️ 护体+' + s.player._talentStartShield, 'float-heal', 600); }
  // 天使之翼：每场战斗重置
  if (s.player && s.relics.some(function(r){return r.id==='angel_wings';})) s.player._angelWings = true;
  s._shadowUsed = false; s._deathGamble = false;
  s._enemyIntent = null; s._eliteMod = null; s._eliteVenom = 0;
  s.adDiscount = false; s.adRefreshCount = 0;
  s._healOnKill = 0;
  // 清除临时药剂效果
  s.potionAtk = 0; s.potionDef = 0;
  // 清除临时状态标记
  s._deathGamble = false;
  // 清理金盾临时防御
  if (s.player && s.player._gsDefBonus) { s.player.def -= s.player._gsDefBonus; delete s.player._gsDefBonus; }
  if (s.player && s.player._tempDefBonus) { s.player.def -= s.player._tempDefBonus; s.player._tempDefBonus = 0; }
  if (s.player && s.player._tempDmgRed) { s.player.dmgReduce = (s.player.dmgReduce || 0) - s.player._tempDmgRed; s.player._tempDmgRed = 0; }
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
    // 能量初始化
    if (s.player) { s.player.energy = s.player.maxEnergy || MAX_ENERGY; }
    s._actionsThisTurn = 0; s._defendedThisTurn = false;
    Game.sync();
    return;
  }
  // 波次系统：仅精英保留多波，普通/Boss单波全出
  s._waves = []; s._waveIndex = 0;
  var totalWaves = type === "elite" ? 2 : 1;

  // 生成敌人
  var enemies = [];
  if (type === "boss") {
    var bossKey = s.zone ? s.zone.id : 'plains';
    var isHell = s.difficulty && (s.difficulty === 'hell' || s.difficulty.startsWith('hell_'));
    var boss = isHell ? (R.get('bosses_hell', bossKey) || R.get('bosses', bossKey)) : R.get('bosses', bossKey);
    const endless = R.get('endlessBosses');
    const endlessIdx = Math.max(0, Math.min(s.zoneIndex - 4, (endless || []).length - 1));
    const bossData = boss || (endless && endless.length > 0 ? endless[endlessIdx] : null);
    if (!bossData) { console.error("No boss data for zoneIndex", s.zoneIndex); return; }
    s._bossIntro = bossData.intro || null;
    s._bossPhase2Intro = bossData.phase2Intro || null;
    enemies.push({ ...bossData, maxHp: bossData.hp, hp: bossData.hp, aiTurn: 0, tags: [], _buffs: [] });
    var diffCfg = R.get('difficulties', s.difficulty) || {};
    if (diffCfg.bossExtra || s.rng.chance(0.4)) {
      var minionPool = R.get('enemies', s.zone?.enemyPool) || R.get('enemies', 'plains');
      var minion = { ...s.rng.pick(minionPool) };
      minion.hp = Math.floor(minion.hp * 0.5); minion.maxHp = minion.hp;
      minion.tags = []; minion._buffs = [];
      enemies.push(minion);
    }
  } else {
    var zoneKey = s.zone ? s.zone.enemyPool : 'plains';
    var pool = R.get('enemies', zoneKey) || R.get('enemies', 'plains');
    var baseCount = type === "elite" ? 2 : 1;
    var diff2 = R.get('difficulties', s.difficulty) || {};
    if (diff2.extraEnemy) baseCount += Math.min(2, diff2.extraEnemy); // 上限+2
    var count = Math.min(3, baseCount + (type === "elite" ? 1 : 0));
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
  s._waves = [enemies];

  // 仅精英有第2波
  if (type === "elite") {
    var waveEnemies2 = [];
    var wCount2 = s.rng.range(2, 3);
    var wPool2 = R.get('enemies', s.zone?.enemyPool) || R.get('enemies', 'plains');
    for (var j2 = 0; j2 < wCount2; j2++) {
      var wp2 = s.rng.pick(wPool2);
      if (!wp2) continue;
      var we2 = { ...wp2, maxHp: wp2.hp, hp: wp2.hp, aiTurn: 0, tags: [], _buffs: [] };
      we2.hp = Math.floor(we2.hp * 1.3); we2.atk = Math.floor(we2.atk * 1.2); we2.maxHp = we2.hp;
      waveEnemies2.push(we2);
    }
    s._waves.push(waveEnemies2);
  }
  // 战斗初始化收尾逻辑
  function finalizeBattle() {
    const diff2 = R.get('difficulties', s.difficulty) || R.get('difficulties', 'standard');
    const zoneScale2 = s.zone ? (s.zone.scale || 1.0) : 1.0;
    s.enemies.forEach(function(em) {
      em.hp = Math.floor(em.hp * diff2.monsterMul * zoneScale2);
      em.atk = Math.floor(em.atk * diff2.monsterMul * (1 + (zoneScale2 - 1) * 0.25));
      em.maxHp = em.hp;
      // v0.51: DEF也受难度和Zone缩放（之前只缩放HP/ATK）
      em.def = Math.floor((em.def || 0) * (1 + (diff2.monsterMul - 1) * 0.5) * (1 + (zoneScale2 - 1) * 0.15));
      if (s.enemyHpMul) { em.hp = Math.floor(em.hp * s.enemyHpMul); em.maxHp = em.hp; }
      if (s.enemyAtkMul) em.atk = Math.floor(em.atk * s.enemyAtkMul);
      if (s.enemyDefMul) em.def = Math.floor(em.def * s.enemyDefMul);
      if (type === "boss" && s._zoneMod?.id === "tower_regen") {
        em.hp = Math.floor(em.hp * 1.3); em.atk = Math.floor(em.atk * 1.3); em.maxHp = em.hp;
      }
      // v0.50 P1: 怪物动态成长 — 每层HP+2%, ATK+1.5%, DEF+1%
      var floorScale = s.totalFloor || 1;
      em.hp = Math.floor(em.hp * (1 + floorScale * 0.02));
      em.atk = Math.floor(em.atk * (1 + floorScale * 0.015));
      em.def = Math.floor((em.def || 0) * (1 + floorScale * 0.01));
      em.maxHp = em.hp;
    });
    s.enemy = s.enemies[0];
    s.selectedTarget = 0;
    // 装备套装效果：先还原旧加成，再应用新加成
    if (s.player._set_atk) s.player.atk -= s.player._set_atk;
    if (s.player._set_def) s.player.def -= s.player._set_def;
    if (s.player._set_maxHp) { s.player.maxHp -= s.player._set_maxHp; s.player.hp -= s.player._set_maxHp; }
    if (s.player._set_dodge) s.player.dodge = (s.player.dodge||0) - s.player._set_dodge;
    if (s.player._set_lifeSteal) s.player.lifeSteal = (s.player.lifeSteal||0) - s.player._set_lifeSteal;
    if (s.player._set_critRate) s.player.critRate -= s.player._set_critRate;
    if (s.player._set_critMul) s.player.critMul -= s.player._set_critMul;
    if (s.player._set_pen) s.player.pen = (s.player.pen||0) - s.player._set_pen;
    if (s.player._set_dmgReduce) s.player.dmgReduce = (s.player.dmgReduce||0) - s.player._set_dmgReduce;
    // 清零追踪变量
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
      if (bonus.dmgReduce) s.player.dmgReduce = (s.player.dmgReduce||0) + bonus.dmgReduce;
    });
    // 套装激活日志
    if (s.player._setActive4) { setTimeout(function(){ log('<span class="win">🏷️ 套装激活：' + s.player._setActive4 + ' 4件套！</span>'); }, 200); }
    else if (s.player._setActive2) { setTimeout(function(){ log('<span class="info">🏷️ 套装激活：' + s.player._setActive2 + ' 2件套</span>'); }, 200); }
    // 恢复怪物标签系统
    // v0.50 P2: 精英怪必定携带词条，炼狱难度精英2词条
    if (type === "elite") {
      addTag(s); // 精英必定1词条
      if (diff2.id && diff2.id.startsWith('hell')) addTag(s); // 炼狱精英2词条
    }
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
    // 【毒雾】非战斗获取标记 → 战斗开始时对所有敌人施加中毒
    if (s.player._toxicCloud && s.enemies) {
      s.enemies.forEach(function(e) {
        if (e.hp > 0) e._buffs.push({ id:'poison', name:'中毒', turns:3, data:{dmg:5},
          onTick: function(em,b){ em.hp -= b.data.dmg; if (em.hp <= 0) return 'dead'; } });
      });
    }
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
  var tags = R.get('monsterTags');
  if (!tags || tags.length === 0) return;
  const tag = s.rng.pick(tags);
  if (!tag) return;
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
  const s = Game.state;
  if (s.gameOver || s._acting) return;
  s._acting = true;
  try {
  var t = getTarget(s);
  if (s.gameOver) return;
  if (!t) {
    var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
    if (!anyAlive) { win(); return; }
    return;
  }
  // 能量和行动次数检查（含NaN防护）
  var attackCost = Math.max(1, s.player._forgetfulCurse ? 2 : 1);
  if (typeof s.player.energy !== 'number' || isNaN(s.player.energy) || s.player.energy < attackCost) { s.player.energy = 0; return; }
  if ((s._actionsThisTurn || 0) >= MAX_ACTIONS) return;
  s.player.energy = Math.max(0, s.player.energy - attackCost);
  s._actionsThisTurn = (s._actionsThisTurn || 0) + 1;
  s.defending = false;
  s._skillUseStreak = 0; // 重置技能疲劳
  animPlayerAttack();
  if (s.player._stoneGaze) { delete s.player._stoneGaze; afterAction(s); return; }
  let dmg = calcDmg(null, t);
  var fc2 = s._smokeNext; if (fc2) s._smokeNext = false;
  applyDmg(dmg, false, t, fc2);
  // ====== 攻击联动 + 核心遗物 ======
  var p = s.player, tbuffs = t._buffs || [];
  // 【焚天之魂】普攻附加1层燃烧（ATK×15%加成伤害）
  if (p._coreFlame) {
    var flameDmg = Math.floor((p.atk || 10) * 0.15) + 2;
    addBuff(t, { id:'burn', name:'燃烧', turns:2, data:{dmg: flameDmg},
      onTick: function(e,b) { e.hp -= b.data.dmg; Events.emit(E.PLAYER_DAMAGED, { dmg: b.data.dmg, source: 'burn', target: 'enemy' }); if (e.hp <= 0) return 'dead'; } });
    bigFloat('🔥 焚天', 'float-crit', 500);
  }
  // 【极寒之心】防御后普攻→施加迟缓
  if (p._coreIce && s._iceNext) { addBuff(t, { id:'slow', name:'迟缓', turns:2, onRemove: function(){} }); s._iceNext = false; bigFloat('❄️ 极寒', 'float-dmg', 400); }
  // 【暗影之魂】闪避后攻击→3倍伤害
  if (p._coreShadow && s._shadowCounter) { dmg = Math.floor(dmg * 3); s._shadowCounter = false; bigFloat('🌑 暗杀！', 'big-crit', 900); }
  // 1) 对燃烧目标 → 立即结算1跳 + 延长1回合
  var burnB = tbuffs.find(function(b) { return b.id === 'burn'; });
  if (burnB && burnB.data && burnB.data.dmg) {
    t.hp -= burnB.data.dmg;
    burnB.turns = (burnB.turns || 0) + 1;
    Events.emit(E.PLAYER_DAMAGED, { dmg: burnB.data.dmg, source: 'burn', target: 'enemy' });
  }
  // 2) 对迟缓目标 → 额外冰霜伤害（极寒之心持有者+80%而非30%）
  if (tbuffs.some(function(b) { return b.id === 'slow'; })) {
    var iceMul = p._coreIce ? 0.8 : 0.3;
    var extra = Math.floor((p.atk || 10) * iceMul);
    t.hp -= extra;
  }
  // ====== 联动结束 ======
  if (s.player.doubleFirst && s.turnInFloor === 0) {
    Events.emit(E.BATTLE_START, { type: 'doubleAttack' });
    var t2 = getTarget(s); if (t2) { var d2 = calcDmg(null, t2); applyDmg(d2, false, t2); }
    s.player.doubleFirst = false;
  }
  t = getTarget(s); if (!t) { win(); return; }
  afterAction(s);
  } finally { s._acting = false; }
}

// CD制技能：传技能索引。AOE技能打全体，普通技能打选中目标
export function doSkill(skillIdx) {
  const s = Game.state;
  if (s.gameOver || s._acting) return;
  s._acting = true;
  try {
  const skills = s.activeSkills || [];
  if (skillIdx < 0 || skillIdx >= skills.length) return;
  const sk = skills[skillIdx];
  if (!sk) return;
  const cdKey = sk.id || ('skill_' + skillIdx);
  if ((s.skillCooldowns[cdKey] || 0) > 0) return;
  // 能量和行动次数检查
  if ((s._actionsThisTurn || 0) >= MAX_ACTIONS) return;
  // v0.50 P1: 能量消耗计算（含精通Lv7减免 + 过载 + 健忘诅咒 + 精通Lv15负面），最低1能量
  var baseCost = (sk.energyCost || 1);
  var energyReduction = 0;
  if (s.player._masteryEnergy) energyReduction++; // 精通Lv7
  if (s.player._overload) { energyReduction = 99; s.player._overload = false; } // 过载：一次性免费
  if (s.player._forgetfulCurse) baseCost++; // 健忘诅咒：+1消耗
  if (s.player._masteryDownside === 'energy') baseCost++; // 战士精通Lv15负面：技能能量+1
  // v0.50 P3: 技能疲劳 — 连续3回合使用技能后，第3回合额外+1能量消耗
  s._skillUseStreak = (s._skillUseStreak || 0) + 1;
  if (s._skillUseStreak >= 3) { baseCost++; bigFloat('😫 疲劳！', 'float-dmg', 500); }
  var cost = Math.max(1, baseCost - energyReduction);
  if (s.player.energy < cost) return;
  // 没有活着的敌人→胜利
  var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
  if (!anyAlive) { win(); return; }
  s.player.energy -= cost;
  s._actionsThisTurn = (s._actionsThisTurn || 0) + 1;
  s.defending = false;
  s._interrupted = true; // 技能也能打断敌人蓄力
  animPlayerAttack();
  if (s.player._stoneGaze) { delete s.player._stoneGaze; afterAction(s); return; }
  // v0.50 P1: 应用CD减免（天赋树"疾风" + 精通Lv4 + 无限法力遗物），最低CD=2
  var baseCD = (sk.cooldown != null ? sk.cooldown : 2);
  var cdReduction = 0;
  if (s.player.skillCDR) cdReduction++;       // 天赋树"疾风"
  if (s.player._masteryCDR) cdReduction++;     // 精通Lv4
  if (s.player._infMana) cdReduction++;        // 无限法力遗物
  if (s.player._blessingSwift) cdReduction++;  // 迅捷赐福
  if (s.player._talentMage) cdReduction++;     // 元素亲和
  baseCD = Math.max(0, baseCD - cdReduction);
  s.skillCooldowns[cdKey] = Math.max(1, baseCD);
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
    var fcAoe = s._smokeNext; if (fcAoe) s._smokeNext = false;
    enemies.forEach(function(e) {
      if (e.hp <= 0) return;
      var dmg = calcDmg(sk, e);
      dmg = Math.floor(dmg * 0.7);
      applyDmg(dmg, true, e, fcAoe);
      if (sk.effect && sk.effect !== "smoke" && sk.effect !== "pen") applySkillEffectTo(sk.effect, e, s);
    });
  } else {
    // 单体：打选中目标
    var t = getTarget(s);
    if (!t) { win(); return; }
    var dmg = calcDmg(sk, t);
    var fc = s._smokeNext; if (fc) s._smokeNext = false;
    applyDmg(dmg, true, t, fc);
    if (sk.doubleHit && t.hp > 0) { var d2 = calcDmg(sk, t); applyDmg(d2, true, t); }
    if (sk.effect && t.hp > 0 && sk.effect !== "smoke" && sk.effect !== "pen") applySkillEffectTo(sk.effect, t, s);
    if (t.hp > 0) checkElementalReaction(sk, t, s); // v0.50 元素联动
    // v0.50 P3: Boss反制 — 炼狱难度Boss/精英被技能命中后下次攻击+20%（叠3层）
    if (t.hp > 0 && (s._currentRoomType === 'boss' || s._currentRoomType === 'elite')) {
      var isHell2 = s.difficulty && s.difficulty.startsWith('hell');
      if (isHell2) t._counterStacks = Math.min(3, (t._counterStacks || 0) + 1);
    }
  }

  var alive = (s.enemies || []).filter(function(e) { return e.hp > 0; });
  if (alive.length === 0) { win(); return; }
  afterAction(s);
  } finally { s._acting = false; }
}

// v0.50 元素联动检测
function checkElementalReaction(skill, enemy, s) {
  if (!skill || !enemy || enemy.hp <= 0) return;
  var p = s.player;
  var effect = skill.effect;
  // 蒸发：燃烧目标被冰霜技能命中 → 额外15%当前HP伤害
  if (effect === 'slow' && enemy._buffs && enemy._buffs.some(function(b){return b.id==='burn';})) {
    var extra = Math.floor(enemy.hp * 0.15);
    if (extra > 0) { enemy.hp -= extra; bigFloat('🔥蒸发！-' + extra, 'big-fire', 600); log('<span class="warn">🔥 蒸发！冰霜命中燃烧目标，额外' + extra + '伤害</span>'); }
  }
  // 超导：迟缓目标被闪电技能命中 → 闪电链弹射+2
  if (skill.id && skill.id.indexOf('thunder') >= 0 && enemy._buffs && enemy._buffs.some(function(b){return b.id==='slow';})) {
    p._superconduct = true; bigFloat('⚡超导！弹射+2', 'big-thunder', 500); log('<span class="win">⚡ 超导！迟缓传导闪电，弹射+2</span>');
  }
  // 过载：闪电技能暴击 → 下次技能免费
  if (s._lastCrit && (skill.id && (skill.id.indexOf('thunder') >= 0 || skill.id.indexOf('lightning') >= 0)) && p._coreThunder) {
    p._overload = true; bigFloat('⚡过载！下次技能免费', 'big-thunder', 500); log('<span class="win">⚡ 过载！下次技能免费</span>');
  }
  // 侵蚀：中毒目标被暗影技能命中 → 中毒立即结算3回合
  if ((effect === 'poison' || (skill.id && skill.id.indexOf('shd') >= 0)) && enemy._buffs) {
    var pois = enemy._buffs.filter(function(b){return b.id==='poison';});
    pois.forEach(function(pb){ if(pb.data&&pb.data.dmg){ var d=pb.data.dmg*Math.min(3,pb.turns||1); enemy.hp-=d; pb.turns=Math.max(0,(pb.turns||0)-3); bigFloat('☠️侵蚀！-' + d, 'big-shadow', 500); log('<span class="warn">☠️ 侵蚀！暗影引爆中毒，' + d + '伤害</span>'); } });
  }
  // 净化：诅咒持有者被圣光技能命中 → 移除1诅咒永久HP+5
  if (p._coreLight && s.curses.length > 0 && (skill.id && (skill.id.indexOf('light') >= 0 || skill.id.indexOf('heal') >= 0))) {
    var removed = s.curses.shift();
    p.maxHp += 5; p.hp += 5;
    bigFloat('✨净化！-' + (removed?removed.name:'诅咒') + ' HP+5', 'big-light', 700); log('<span class="heal">✨ 净化！移除' + (removed?removed.name:'诅咒') + '，HP+5</span>');
  }
  // 共鸣：持有2个同元素遗物+使用该元素技能 → 免费协同攻击50%ATK
  var eleFlags = [{k:'_coreFlame',e:'burn'},{k:'_coreIce',e:'slow'},{k:'_coreShadow',e:'poison'},{k:'_coreThunder',e:'stun'}];
  eleFlags.forEach(function(ef){
    if (p[ef.k] && p._coreCurse && skill.effect === ef.e && s.rng.chance(0.3)) {
      var extraDmg = Math.floor(p.atk * 0.5);
      enemy.hp -= extraDmg;
      bigFloat('🌀共鸣！-' + extraDmg, 'big-crit', 500); log('<span class="win">🌀 元素共鸣！协同攻击-' + extraDmg + '</span>');
    }
  });
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
  const s = Game.state;
  if (s.gameOver || s._acting) return;
  s._acting = true;
  try {
  var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
  if (s.gameOver) return;
  if (!anyAlive) { win(); return; }
  // 每回合只能防御1次（免费动作），受行动次数限制
  if (s._defendedThisTurn) return;
  if ((s._actionsThisTurn || 0) >= MAX_ACTIONS) return;
  s._defendedThisTurn = true;
  s._actionsThisTurn = (s._actionsThisTurn || 0) + 1;
  s._skillUseStreak = 0; // 重置技能疲劳
  s.defending = true; s.nextBoost = 0.35;
  s._interrupted = true; // 打断敌人本回合技能/蓄力
  // 【极寒之心】防御后下次普攻施加迟缓
  if (s.player._coreIce) s._iceNext = true;
  Events.emit(E.BATTLE_START, { type: 'defend' });
  playSound("hit");
  afterAction(s);
  } finally { s._acting = false; }
}

// ---- 手动结束回合 ----
export function doEndTurn() {
  const s = Game.state;
  if (s.gameOver || s._acting) return;
  s._acting = true;
  try {
  var wasAuto = s.auto, wasSpeed = s._speedMode, wasTurbo = s._turboMode;
  clearAuto();
  if (s.player && s.player.energy > 0 && s.player.hp < s.player.maxHp) {
    var healAmt = s.player.energy;
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + healAmt);
    if (healAmt > 0) log('<span class="heal">💤 剩余能量转化为' + healAmt + '点治疗</span>');
  }
  // v0.50 圣光之佑：每回合回复6%HP，治疗时对敌人造成50%等量伤害
  if (s.player && s.player._coreLight && s.player.hp < s.player.maxHp) {
    var p2 = s.player;
    var lightHeal = Math.floor(p2.maxHp * 0.06);
    var actualHeal = Math.min(lightHeal, p2.maxHp - p2.hp);
    p2.hp = Math.min(p2.maxHp, p2.hp + lightHeal);
    if (actualHeal > 0 && s.enemies && s.enemies.length > 0) {
      var alive = s.enemies.filter(function(ee){return ee && ee.hp > 0;});
      if (alive.length > 0) {
        var target = alive[Math.floor(Math.random() * alive.length)];
        target.hp -= Math.floor(actualHeal * 0.5);
        bigFloat('-' + Math.floor(actualHeal * 0.5) + '✨', 'float-heal', 400);
      }
    }
  }
  enemyTurn();
  Game.sync();
  } finally { s._acting = false; }
}

// ---- 伤害计算（集成装备前缀效果 + 羁绊效果）----
function calcDmg(sk, targetEnemy) {
  const p = Game.state.player, e = targetEnemy || Game.state.enemy, s = Game.state;
  if (!e) return 1;
  let atk = p.atk; // 装备属性已在applyEquipStats中直写
  if (p.rage && p.hp < p.maxHp * 0.3) atk = Math.floor(atk * 1.5);
  if (p.berserk) { const r = Math.max(0, 1 - p.hp / p.maxHp); atk = Math.floor(atk * (1 + r)); }
  if (p.debuffAtk && p.debuffAtk.turns > 0) atk = Math.max(1, atk - p.debuffAtk.value);
  if (s.potionAtk) atk = Math.floor(atk * (1 + s.potionAtk));
  if (p._greedBag && s.gold > 0) { atk += Math.min(18, Math.floor(s.gold / 30) * 3); }
  // 【血晶石】每损失10%生命+4攻击
  if (p._bloodRuby) { var lostPct = 1 - p.hp/p.maxHp; atk += Math.floor(lostPct * 10) * 4; }
  // 【战鼓】每5回合+10攻击（在enemyTurn中累加）— 这里读取累加值
  if (p._warDrum && p._drumAtk) atk += p._drumAtk;
  const isSkill = sk && sk.mul;
  let def = e.def;
  if (isSkill) {
    const pen = (p.pen || 0) + (sk.extraPen || 0) + (sk.pen || 0);
    def = Math.floor(def * (1 - pen));
  }
  // v0.50 P2: 护甲减伤公式 — def越高收益越递减
  let dmg = Math.floor(atk * (1 - def / (def + 100)));
  dmg = Math.max(1, dmg);
  // v0.51: 铁壁药剂 — 玩家防御+50%（减伤50%）
  if (s.potionDef) dmg = Math.floor(dmg * (1 - s.potionDef));
  // 【破绽系统】每3回合敌人露破绽，技能和普攻均享受3倍伤害
  if (s.turnInFloor > 0 && s.turnInFloor % 3 === 0 && !s._weakSpotShown) {
    dmg = Math.floor(dmg * 3); s._weakSpotShown = true;
    bigFloat("💢破绽！", "big-crit", 600);
  } else if (s.turnInFloor > 0 && s.turnInFloor % 3 === 0) {
    dmg = Math.floor(dmg * 3);
  }
  // 【咒缚之源】每个诅咒+20%总伤害（必须在 dmg 定义之后）
  if (p._coreCurse && s.curses.length > 0) { dmg = Math.floor(dmg * (1 + s.curses.length * 0.12)); }
  if (isSkill) dmg = Math.floor(dmg * (sk.mul || p.skillMul));
  else if (sk && sk.mul) dmg = Math.floor(dmg * sk.mul);
  dmg = Math.max(dmg, Math.floor(atk * 0.15));
  if (s.nextBoost > 0) { dmg = Math.floor(dmg * (1 + s.nextBoost)); }
  // 装备前缀：处刑者（低血+25%伤害）
  const execEq = s.equip.find(q => q._combatEffect && q._combatEffect.type === "executioner");
  if (execEq && e.hp < e.maxHp * 0.3) dmg = Math.floor(dmg * (1 + execEq._combatEffect.value));
  // 遗物：死亡标记（对低血+50%伤害）
  if (p._deathMark && e.hp < e.maxHp * 0.35) dmg = Math.floor(dmg * 1.5);
  // 装备前缀：混沌（30%概率+50%）
  const chaosEq = s.equip.find(q => q._combatEffect && q._combatEffect.type === "chaos");
  if (chaosEq && s.rng.chance(chaosEq._combatEffect.value)) dmg = Math.floor(dmg * 1.5);
  // 【钢盾卫士】普攻伤害-60%，被技能击中后破盾3回合
  if (e._shield) {
    if (sk) { e._shieldBroken = 3; } // 技能击碎护盾
    else if (!e._shieldBroken || e._shieldBroken <= 0) { dmg = Math.floor(dmg * 0.4); }
  }
  return dmg;
}

function applyDmg(dmg, skill, targetEnemy, forceCrit) {
  const s = Game.state, p = s.player;
  var e = targetEnemy || s.enemy;
  if (!e || e.hp <= 0) return;
  let cr = p.critRate; // 装备已直写
  // 【烟幕】下回合必暴：forceCrit=true时强制暴击，避免双重乘算
  var crit = forceCrit ? true : s.rng.chance(cr);
  s._lastCrit = !!crit;
  if (p._gamblersDice && !crit && dmg > 0) { dmg = Math.floor(dmg * 0.5); }
  // 【中毒引爆】暴击时对该敌人立即结算全部剩余中毒伤害
  if (crit && e._buffs) {
    var pBuffs = e._buffs.filter(function(b) { return b.id === 'poison'; });
    pBuffs.forEach(function(pb) {
      if (pb.data && pb.data.dmg) {
        var total = pb.data.dmg * (pb.turns || 1);
        e.hp -= total;
        e._buffs = e._buffs.filter(function(b) { return b.id !== 'poison'; });
        bigFloat('☠️ 引爆！' + total, 'big-crit', 700);
      }
    });
  }
  // v0.50 雷霆之怒：暴击时释放闪电链
  if (crit && p._coreThunder && s.enemies && s.enemies.length > 1) {
    var chainDmg = Math.floor(dmg * 0.3); // 闪电伤害+30%
    var chainTargets = s.enemies.filter(function(te) { return te !== e && te.hp > 0; });
    var chainCount = Math.min(p._thunderChain >= 1 ? 3 : 2, chainTargets.length);
    bigFloat('⚡ 闪电链！×' + chainCount, 'float-gold', 500);
    for (var ci = 0; ci < chainCount; ci++) {
      var target = chainTargets[ci % chainTargets.length];
      if (target && target.hp > 0) {
        var bounceDmg = Math.floor(chainDmg * Math.pow(0.7, ci));
        target.hp -= bounceDmg;
        bigFloat('-' + bounceDmg + '⚡', 'big-crit', 300 + ci * 100);
      }
    }
  }
  // v0.51 天赋大点·破军：15%概率无视防御
  var keystoneBroke = false;
  if (s.player._keystoneBreak && s.rng.chance(0.15)) {
    dmg = Math.floor(dmg * 1.5); // 等效无视防御
    keystoneBroke = true;
    if (!s._keystoneFiredThisBattle) { bigFloat('⚔️破军！', 'big-crit', 700); s._keystoneFiredThisBattle = true; }
  }
  // v0.50 天赋大点·洞察：宝箱双倍在loot.js处理
  // 【咒怨人偶】每个诅咒+0.3暴伤倍率
  var curseCritBonus = p._cursedDoll ? s.curses.length * 0.3 : 0;
  // v0.51: 厄运诅咒正面：每个诅咒+15%暴伤
  if (p._doomCritBonus) curseCritBonus += s.curses.length * 0.15;
  if (crit) {
    dmg = Math.floor(dmg * (p.critMul + curseCritBonus)); s.stats.critCount++;
    s._runCrits = (s._runCrits || 0) + 1;
    // v0.60 雷霆之怒：暴击获得过载层数
    if (p._coreThunder) { p._overloadStacks = (p._overloadStacks || 0) + 1; }
    if (s._runCrits >= 50) checkAchievement(s, "crit_master");
    Events.emit(E.PLAYER_DAMAGED, { dmg, crit: true, skill });
    playSound("crit");
  } else if (s.nextBoost > 0 && s.nextBoost !== 0.35) {
    Events.emit(E.PLAYER_DAMAGED, { dmg, crit: false, counter: true });
    playSound("attack");
  } else {
    Events.emit(E.PLAYER_DAMAGED, { dmg, crit: false });
    playSound("attack");
  }
  // v0.50 转职/觉醒被动伤害修正（必须在扣血之前应用）
  if (p._advancementId === 'shd_assassin' && s._currentRoomType === 'boss') dmg = Math.floor(dmg * 1.3);
  if (p._advancementId === 'arc_sniper' && !skill) dmg = Math.floor(dmg * 1.4);
  if (p._advancementId === 'shd_ninja' && p._ninjaCounter) { dmg = Math.floor(dmg * 3); p._ninjaCounter = false; }
  if (p._awakeningPassive === 'war_berserker') { var hpPct = p.hp / p.maxHp; dmg = Math.floor(dmg * (1 + (1 - hpPct) * 0.8)); }
  if (p._awakeningPassive === 'monk_avenger' && p._avengerAtk) dmg = Math.floor(dmg * (1 + p._avengerAtk * 0.5 / Math.max(1, p.atk)));

  s.stats.totalDmg += dmg; e.hp -= dmg;
  if (dmg > 25) playSound("heavyHit");
  if (!skill) applyEquipCombatEffects(s);
  if (p.lifeSteal > 0) {
    var ls = Math.min(p.lifeSteal, 0.5);
    const h = Math.floor(dmg * ls);
    var over = p.hp + h - p.maxHp;
    p.hp = Math.min(p.maxHp, p.hp + h);
    if (p._vampLord && over > 0) { p._tempHp = (p._tempHp||0) + over; bigFloat("🧛 +"+over+" 临时HP", "float-heal", 500); }
    Events.emit(E.PLAYER_HEALED, { amount: h, hp: p.hp, maxHp: p.maxHp, source: 'lifeSteal' });
  }

  s.relics.forEach(r => { if (r.onAttack) r.onAttack(p, dmg, s); });
  // 遗物特效反馈
  // 【避雷针】暴击时释放闪电链弹射2次
  if (p._lightningRod && crit && s.enemies) {
    var others = s.enemies.filter(function(x){return x!==e && x.hp>0;});
    for (var z=0; z<2 && others.length>0; z++) {
      var target = others[Math.floor(s.rng.next()*others.length)];
      var boltDmg = Math.floor(dmg * 0.4);
      target.hp -= boltDmg;
      bigFloat("⚡ "+boltDmg, "float-dmg", 400);
      others = others.filter(function(x){return x!==target && x.hp>0;});
    }
  }
  if (p._medusaHead && !skill && s.rng.chance(0.1) && e && e.hp > 0) { e.hp = 0; bigFloat("🗿 石化！", "big-crit", 1000); playSound("crit"); }
  if (p._gamblersDice && !crit && dmg > 0) { bigFloat("🎲", "float-dmg", 500); }
  if (dmg >= 200) checkAchievement(s, "one_shot_200");
  if (e.thorn) {
    const th = Math.floor(dmg * e.thorn);
    p.hp = Math.max(0, p.hp - th);
    Events.emit(E.PLAYER_DAMAGED, { dmg: th, source: 'thorn', enemy: e.name });
  }
  // v0.60: Boss二阶段在血量跨过30%阈值时触发（而非死亡后）
  if (s._currentRoomType === "boss" && !s._bossPhase2 && e.phase2) {
    var p2Threshold = Math.floor(e.maxHp * 0.3);
    if (e.hp <= p2Threshold && e.hp > 0) {
      s._bossPhase2 = true;
      clearAuto(); // 强制切换手动
      var p2 = e.phase2;
      // 二阶段数值强化
      e.atk = Math.floor((e.atk || 10) * (p2.atkMul || 1.0));
      e.def = Math.max(0, (e.def || 0) + (p2.defBonus || 0));
      e.skill = p2.skill;
      e._buffs = [];
      e.name = p2.name || e.name;
      // HP恢复
      var newMaxHp = Math.floor((e.maxHp || e.hp * 2) * 1.2);
      e.maxHp = newMaxHp; e.hp = newMaxHp;
      // Boss狂暴状态
      s._bossRage = true;
      s._bossRageAttacks = 1;
      s._bossRageIgnoreDodge = 0.5;
      s._furyActive = false;
      // 重置玩家临时增益
      if (s._despAtkDoubled) { s.player.atk = Math.floor(s.player.atk / 2); }
      s._desperationUsed = false; s._despAtkDoubled = false;
      s.potionAtk = 0; s.potionDef = 0;
      // 喘息回合：恢复玩家30%HP + 50%能量
      var healAmt = Math.floor(s.player.maxHp * 0.30);
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + healAmt);
      s.player.energy = Math.min(s.player.maxEnergy || 3, s.player.energy + Math.ceil((s.player.maxEnergy || 3) * 0.5));
      log('<span class="heal">💨 Boss变身中……喘息之机！HP+' + healAmt + '</span>');
      bigFloat('💢 Boss暴怒！', 'big-crit', 1500);
      Events.emit(E.BATTLE_START, { type: 'bossPhase2', name: p2.name || e.name });
      Game.sync();
    }
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
          const bdmg = (fx.value || 4) + Math.floor(s.totalFloor / 5);
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
        // 多件装备累加
        s._healOnKill = (s._healOnKill || 0) + (fx.value || 0.1);
        break;
      case "chaos":
        // 30%概率伤害+50%
        if (s.rng.chance(fx.value || 0.3)) {
          s._chaosBoost = true;
          bigFloat("🌀 混沌！", "big-crit", 500);
        }
        break;
      case "executioner":
        // 对低血敌人+25%伤害（在calcDmg中读取）
        s._executioner = (s._executioner || 0) + (fx.value || 0.25);
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
  // v0.50 诅咒协同检测
  checkCurseSynergies();
  // v0.50 转职被动：圣骑士每回合回复3%HP
  if (p._advancementId === 'war_paladin') { var palHeal = Math.floor(p.maxHp * 0.03); p.hp = Math.min(p.maxHp, p.hp + palHeal); }
  // v0.50 转职被动：悟道者治疗+50%
  if (p._advancementId === 'monk_enlightened') p._brandHealMul = (p._brandHealMul || 1) * 1.5;
  // v0.60 雷霆之怒：过载≥5层 → 雷暴全体50伤害
  if (p._coreThunder && (p._overloadStacks || 0) >= 5) {
    p._overloadStacks = 0;
    s.enemies.forEach(function(e){ if(e&&e.hp>0){ e.hp -= 50; } });
    bigFloat('⚡雷暴！全体-50', 'big-crit', 900);
  }
  // v0.50 行走的天灾：5诅咒 → 敌人每回合-3%HP
  if (p._cursePlague) {
    s.enemies.forEach(function(e) { if (e && e.hp > 0) { var d = Math.max(1, Math.floor(e.maxHp * 0.03)); e.hp -= d; } });
  }
  // v0.50 P2: 厄运诅咒 — 持有3+诅咒时每回合损失2%最大生命
  if (p._doomCurse && s.curses.length >= 3) {
    var doomDmg = Math.max(1, Math.floor(p.maxHp * 0.02));
    p.hp = Math.max(0, p.hp - doomDmg);
    if (p.hp <= 0) { p.hp = 0; Game.sync(); setTimeout(function() { gameOver(); }, 500); return; }
  }
  // 过滤已死亡敌人，防止空对象访问
  s.enemies = (s.enemies || []).filter(function(e) { return e && e.hp > 0; });
  if (s.selectedTarget >= s.enemies.length) s.selectedTarget = 0;
  var enemies = s.enemies;
  var hasLiveTarget = false;
  enemies.forEach(function(e) {
    if (!e || e.hp <= 0) return;
    hasLiveTarget = true;
    var status = tickBuffs(e, true);
    if (status === 'dead') { return; }
    if (status === 'stunned') return;
    // 打断检查
    if (s._interrupted && (e.aiCharge || (e._intent && (e._intent.type === 'skill' || e._intent.type === 'heavy')))) {
      e._intent = null; e.chargeTurns = 0;
      setTimeout(function() { bigFloat("🛡️ 打断！", "big-crit", 800); screenShake(1); }, 50);
    }
    // v0.51: 怪物词缀[诅咒] — 概率施加随机诅咒
    if (e.aiCurse && s.rng && s.rng.chance(0.20)) {
      var curses = R.get('curses') || [];
      if (curses.length > 0) {
        var curse = s.rng.pick(curses);
        s.curses.push(curse);
        if (curse.apply) curse.apply(s.player);
        bigFloat('☠️ 诅咒！' + curse.name, 'float-dmg', 500);
      }
    }
    // v0.60 Boss弱点系统
    var bossAtk = e.atk;
    if (e.weakness === '火焰' && hasBuff(e, 'burn')) { bossAtk = Math.floor(bossAtk * 0.5); bigFloat('🔥弱点！', 'float-dmg', 400); }
    if (e.weakness === '冰霜' && hasBuff(e, 'frozen')) { e.lifeSteal = 0; }
    if (e.weakness === '圣光' && p._coreLight) { e.lifeSteal = 0; bigFloat('🌟弱点！', 'float-dmg', 400); }
    var dmg = Math.floor(bossAtk * (1 - p.def / (p.def + 100)));
    dmg = Math.max(1, dmg);
    // v0.51: 怪物词缀[迅捷] — 首回合双动
    if (e.doubleFirst && s.turnInFloor === 0) {
      var swiftDmg = Math.floor(dmg * 0.6);
      var swiftDmg2 = Math.floor(dmg * 0.6);
      strike(swiftDmg, e);
      dmg = swiftDmg2;
    }
    // v0.50 P3: Boss反制 — 每层+20%伤害，攻击后重置
    if (e._counterStacks > 0) {
      dmg = Math.floor(dmg * (1 + e._counterStacks * 0.2));
      e._counterStacks = 0;
    }
    // v0.50 P0: 精通Lv15负面效果（所有难度生效）
    if (p._masteryDownside === 'fragile') dmg = Math.floor(dmg * 1.3);       // 影卫: 承伤+30%
    if (p._masteryDownside === 'elemental') dmg = Math.floor(dmg * 1.2);      // 法师: 元素伤+20%
    if (p._masteryDownside === 'close') dmg = Math.floor(dmg * 1.25);         // 弓手: 近身受罚
    // 应用减伤属性
    if (p.dmgReduce > 0) dmg = Math.floor(dmg * (1 - Math.min(p.dmgReduce, 0.8)));
    if (hasBuff(e, 'slow')) { dmg = Math.floor(dmg * 0.7); removeBuff(e, 'slow'); }
    if (!s._interrupted && e.aiCharge) { e.chargeTurns = (e.chargeTurns || 0) + 1; if (e.chargeTurns % 3 === 0) dmg = Math.floor(dmg * 2); }
    if (s.defending) dmg = Math.floor(dmg * 0.5);
    if (p.dodge && s.rng.chance(p.dodge)) {
      dmg = 0; Events.emit(E.BATTLE_START, { type: 'dodge' });
      s._runDodges = (s._runDodges || 0) + 1;
      if (s._runDodges >= 10) checkAchievement(s, "dodge_lucky");
      // 【忍者足袋】闪避后下回合必暴
      if (p._ninjaTabi) { s._smokeNext = true; }
      if (p._coreShadow) { s._shadowCounter = true; bigFloat('🌑 暗影反击！', 'big-dodge', 700); }
      return;
    }
    // 镜盾格挡
    // 【镜盾】20%概率完全格挡（同时触发onHit回调）
    if (p._mirrorShield && s.rng && s.rng.chance(0.2)) {
      var mirrorRelic = s.relics.find(function(r) { return r.id === 'mirror_shield'; });
      if (mirrorRelic && mirrorRelic.onHit) mirrorRelic.onHit(p, e, dmg, s);
      dmg = 0; bigFloat("🛡️ 格挡！", "big-dodge", 700); return;
    }
    strike(dmg, e);
    if (p.hp <= 0) return;
  });

  // v0.50 P1: Boss Rage — 二阶段Boss额外攻击一次，无视50%闪避
  if (s._bossRage && s._currentRoomType === 'boss' && p.hp > 0) {
    enemies.forEach(function(e) {
      if (!e || e.hp <= 0 || p.hp <= 0) return;
      var rageDmg = Math.floor(e.atk * (1 - p.def / (p.def + 100)));
      rageDmg = Math.max(1, rageDmg);
      if (p.dmgReduce > 0) rageDmg = Math.floor(rageDmg * (1 - Math.min(p.dmgReduce, 0.8)));
      if (s.defending) rageDmg = Math.floor(rageDmg * 0.5);
      // Rage无视50%闪避
      var effectiveDodge = (p.dodge || 0) * (1 - (s._bossRageIgnoreDodge || 0.5));
      if (effectiveDodge > 0 && s.rng.chance(effectiveDodge)) {
        rageDmg = 0; Events.emit(E.BATTLE_START, { type: 'dodge' });
        bigFloat('🌑 闪避！', 'big-dodge', 700);
        return;
      }
      // 镜盾仍可格挡
      if (p._mirrorShield && s.rng && s.rng.chance(0.2)) {
        rageDmg = 0; bigFloat("🛡️ 格挡！", "big-dodge", 700); return;
      }
      strike(rageDmg, e);
    });
  }

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
  // 标准回合CD-1
  if (s.skillCooldowns) {
    Object.keys(s.skillCooldowns).forEach(function(k) { if (s.skillCooldowns[k] > 0) s.skillCooldowns[k]--; });
  }
  // v0.50: 精通Lv4 CDR额外-1
  if (s.player._masteryCDR && s.skillCooldowns) {
    Object.keys(s.skillCooldowns).forEach(function(k) { if (s.skillCooldowns[k] > 0) s.skillCooldowns[k]--; });
  }
  // 【无限法力】额外-1CD
  if (s.player._infMana && s.skillCooldowns) {
    Object.keys(s.skillCooldowns).forEach(function(k) { if (s.skillCooldowns[k] > 0) s.skillCooldowns[k]--; });
  }
  // 新Zone环境
  if (s._zoneMod?.id === "tower_lower_drain") { s.player.hp = Math.max(0, s.player.hp - Math.max(1, Math.floor(s.player.maxHp * 0.02))); }
  if (s._zoneMod?.id === "swamp_poison") { s.player.hp = Math.max(0, s.player.hp - 3); s.enemies.forEach(function(e) { if (e.hp > 0) e.hp = Math.max(0, e.hp - 3); }); }
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
  // 【毒雾花】每回合为全体敌人回复生命
  (s.enemies || []).forEach(function(em) {
    if (em._healAllies && em.hp > 0) {
      s.enemies.forEach(function(other) {
        if (other.hp > 0 && other !== em) {
          var healAmt = Math.floor(other.maxHp * (em._healAllies || 0.15));
          other.hp = Math.min(other.maxHp, other.hp + healAmt);
        }
      });
    }
  });
  // 幽灵模式受伤翻倍已在strike中处理
  // 护盾恢复计时
  s.enemies.forEach(function(em) { if (em._shieldBroken > 0) em._shieldBroken--; });
  // 【神之手】每3回合自动释放一次免费技能（不耗能不进CD）
  if (s.player._godHand && s.turnInFloor % 3 === 0 && s.activeSkills && s.activeSkills.length > 0) {
    var ghSkills = s.activeSkills.filter(function(sk, i) { var k = sk.id || ('skill_'+i); return (s.skillCooldowns[k]||0) === 0; });
    if (ghSkills.length > 0) {
      var gSk = ghSkills[Math.floor(Math.random() * ghSkills.length)];
      var gIdx = s.activeSkills.indexOf(gSk);
      if (gIdx >= 0) {
        var saveE = s.player.energy; s.player.energy = Math.max(s.player.energy, (gSk.energyCost||1));
        try { doSkill(gIdx); } finally { s.player.energy = saveE; var k2 = gSk.id || ('skill_'+gIdx); s.skillCooldowns[k2] = 0; }
      }
    }
  }
  // 【战鼓】每5回合攻击+10
  if (s.player._warDrum && s.turnInFloor % 5 === 0) { s.player._drumAtk = (s.player._drumAtk||0) + 10; }
  // v0.51 天赋·再生：每回合回复X%最大生命
  if (s.player._talentRegenPct) { var regenAmt = Math.floor(s.player.maxHp * s.player._talentRegenPct); s.player.hp = Math.min(s.player.maxHp, s.player.hp + regenAmt); }
  s.turn++; s.turnInFloor++;
  s._weakSpotShown = false;
  // 能量回满，重置行动计数
  refillEnergy(s);
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
  // v0.50 复仇者受击累积ATK
  if (p._advancementId === 'monk_avenger') { p._avengerAtk = (p._avengerAtk || 0) + 3; }
  // 【玻璃大炮】受伤翻倍 / 【脆弱诅咒】受伤+30%
  if (p._glassCannon) dmg = Math.floor(dmg * 2);
  if (p._fragileFlag) dmg = Math.floor(dmg * 1.3);
  // 临时HP缓冲
  if (p._tempHp > 0) { var absorbed = Math.min(p._tempHp, dmg); p._tempHp -= absorbed; dmg -= absorbed; }
  p.hp = Math.max(0, p.hp - dmg);
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
    p.hp = Math.max(0, p.hp - th);
    Events.emit(E.PLAYER_DAMAGED, { dmg: th, source: 'thorn', enemy: e.name });
    delete e._crystalThorns;
  }
}

// ---- 胜利（含Boss二阶段转换）----
function win() {
  const s = Game.state;
  if (s._winning) return;
  s._winning = true;
  s._acting = false;
  stopHeartbeat();
  // Boss二阶段检测（从enemies中找boss，确保多敌人场景正确）
  var bossEnemy = null;
  (s.enemies || []).forEach(function(e) {
    if (e.phase2 && !bossEnemy) bossEnemy = e;
  });
  if (!bossEnemy) bossEnemy = s.enemy;

  // 波次切换：还有下一波→生成新敌人
  // 波次切换前触发击杀遗物
  s.relics.forEach(function(r) { if (r.onKill) r.onKill(s.player, s); });
  if (s._waveIndex + 1 < s._waveTotal && s._waves && s._waves[s._waveIndex + 1]) {
    s._waveIndex++;
    var wasAuto = s.auto; var wasSpeed = s._speedMode; var wasTurbo = s._turboMode;
    var nextWave = s._waves[s._waveIndex];
    var dScale = R.get('difficulties', s.difficulty) || {};
    var zScale = s.zone ? (s.zone.scale || 1.0) : 1.0;
    nextWave.forEach(function(em) {
      em.hp = Math.floor(em.hp * (dScale.monsterMul||1) * zScale);
      em.atk = Math.floor(em.atk * (dScale.monsterMul||1) * (1 + (zScale-1)*0.25));
      em.maxHp = em.hp;
      // v0.50 P1: 怪物动态成长
      var floorScale = s.totalFloor || 1;
      em.hp = Math.floor(em.hp * (1 + floorScale * 0.02));
      em.atk = Math.floor(em.atk * (1 + floorScale * 0.015));
      em.def = Math.floor((em.def || 0) * (1 + floorScale * 0.01));
      em.maxHp = em.hp;
    });
    s.enemies = nextWave;
    s.enemy = s.enemies.length > 0 ? s.enemies[0] : null;
    s.selectedTarget = 0;
    if (!s.enemy) { win(); return; } // 空波次直接胜利
    // 波次重置
    s.turnInFloor = 0;
    s._desperationUsed = false; s._despAtkDoubled = false; // 绝境逆转重置
    s._healOnKill = 0; // 击杀回血重置
    // 毒雾：新波次重新施加
    if (s.player._toxicCloud) {
      s.enemies.forEach(function(e) {
        if (e.hp > 0) e._buffs.push({ id:'poison', name:'中毒', turns:3, data:{dmg:5},
          onTick: function(em,b){ em.hp -= b.data.dmg; if (em.hp <= 0) return 'dead'; } });
      });
    }
    s.auto = wasAuto; s._speedMode = wasSpeed;
    log('<span class="win">⚔️ 第' + (s._waveIndex+1) + '/' + s._waveTotal + '波敌人来袭！</span>');
    bigFloat('⚔️ 第' + (s._waveIndex+1) + '波！', 'big-crit', 800);
    Game.sync();
    clearAuto();
    s._winning = false; // 重置胜利锁，让下一波能正常触发奖励
    if (wasAuto || wasSpeed || wasTurbo) { var s2 = Game.state; if (s2.auto || s2._speedMode || s2._turboMode) startAutoLoop(); }
    return;
  }

  // v0.60: Boss二阶段触发已迁移到applyDmg()中处理
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
  if (fast) { g = Math.floor(g * 2); if (s._currentRoomType === "boss") checkAchievement(s, "speed_demon"); }
  s.gold += g;
  s._runKills = (s._runKills || 0) + (s.enemies ? s.enemies.length : 0);
  // 累计击杀（跨局）追踪
  if (!Game.meta.totalKills) Game.meta.totalKills = 0;
  Game.meta.totalKills += (s.enemies ? s.enemies.length : 0);
  // v0.50 战斗结束清理战斗频道事件
  Events.clearChannel('battle');
  if (Game.meta.totalKills >= 100) checkAchievement(s, "kill_100");
  if (Game.meta.totalKills >= 500) checkAchievement(s, "kill_500");
  // 绝境反杀：HP<5%时击杀→survivor
  if (s.player && s.player.hp > 0 && s.player.maxHp > 0 && s.player.hp < s.player.maxHp * 0.05) checkAchievement(s, "survivor");
  Events.emit(E.GOLD_CHANGED, { gold: s.gold, delta: g, fast });
  // 击杀回能：每波击杀奖励1临时能量
  if (s.player && s.player.energy < (s.player.maxEnergy || MAX_ENERGY) + 2) {
    s.player.energy = Math.min(s.player.energy + 1, (s.player.maxEnergy || MAX_ENERGY) + 2);
    bigFloat('⚡ +1能量', 'float-gold', 500);
  }
  // 魂晶掉落 + v0.50 通用素材
  const roomType = s._currentRoomType || '';
  let souls = 0, materials = 0;
  if (roomType === 'elite') { souls = s.rng.range(1, 2); materials = s.rng.range(1, 2); }
  else if (roomType === 'boss') { souls = 2 + s.zoneIndex; materials = s.rng.range(2, 5); }
  if (souls > 0) { Game.addSouls(souls); }
  if (materials > 0) { Game.addMaterials(materials); }
  // v0.50 Boss材料掉落
  if (roomType === 'boss' && s.zone) {
    var bossMats = R.get('bossMaterials');
    var matData = bossMats ? bossMats[s.zone.id] : null;
    if (matData && matData.id && s.rng.chance(matData.dropRate || 0.35)) {
      if (!s.forgeMats) s.forgeMats = {};
      s.forgeMats[matData.id] = (s.forgeMats[matData.id] || 0) + 1;
      bigFloat('🧱 +' + (matData.name || matData.id), 'float-gold', 600);
    }
    // 额外稀有材料
    var extraMats = R.get('extraMaterials') || [];
    extraMats.forEach(function(em) {
      if (em.dropFromZones && em.dropFromZones.indexOf(s.zone.id) >= 0 && s.rng.chance(em.dropRate || 0.18)) {
        if (!s.forgeMats) s.forgeMats = {};
        s.forgeMats[em.id] = (s.forgeMats[em.id] || 0) + 1;
        bigFloat('🔥 +' + (em.name || em.id), 'float-gold', 700);
      }
    });
  }
  // v0.50 狂战士击杀额外+1⚡
  if (s.player._advancementId === 'war_berserker') { s.player.energy = Math.min(s.player.maxEnergy || 3, s.player.energy + 1); }
  // 装备前缀：神圣（击杀回血）
  if (s._healOnKill) { s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.floor(s.player.maxHp * s._healOnKill)); s._healOnKill = 0; }
  // 遗物击杀效果已在波次切换前触发
  // 影卫被动
  if (s.player._shadowBorn) { s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.floor(s.player.maxHp * 0.2)); }
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
  // v0.51: 遗物保底计数器（每场战斗+1，掉落遗物时重置）
  s._relicPity = (s._relicPity || 0) + 1;
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
  if (!s.player) { s.gameOver = true; s._acting = false; clearAuto(); Game.sync(); return; }
  // v0.51 天赋大点·不灭：锁1血+免疫1回合（每局1次）
  if (s.player._keystoneImmortal && s.player.hp <= 0 && !s._keystoneImmortalUsed) {
    s.player.hp = 1; s.player._immortalTriggered = true;
    s._keystoneImmortalUsed = true;
    playSound("heal"); bigFloat("🔥 不灭！", "big-crit", 1200); Game.sync(); return;
  }
  // 遗物：血盾（致命伤害以1血存活，每局1次）
  if (s.player._bloodShield && s.player.hp <= 0) {
    s.player.hp = 1; s.player._bloodShield = false; s._acting = false;
    Events.emit(E.PLAYER_HEALED, { amount: 1, hp: 1, maxHp: s.player.maxHp, source: 'bloodShield' });
    playSound("heal"); bigFloat("🛡️ 血盾！", "big-dodge", 1000); Game.sync(); return;
  }
  if (s.player.rebirth && s.player.hp <= 0) {
    s.player.hp = Math.floor(s.player.maxHp * 0.5); s.player.rebirth = false;
    Events.emit(E.PLAYER_HEALED, { amount: s.player.hp, hp: s.player.hp, maxHp: s.player.maxHp, source: 'rebirth' });
    playSound("heal"); Game.sync(); return;
  }
  // 【天使之翼】每场战斗首次死亡复活30%
  if (s.player._angelWings && s.player.hp <= 0) {
    s.player.hp = Math.floor(s.player.maxHp * 0.3); s.player._angelWings = false;
    Events.emit(E.PLAYER_HEALED, { amount: s.player.hp, hp: s.player.hp, maxHp: s.player.maxHp, source: 'angelWings' });
    playSound("heal"); bigFloat("👼 天使之翼！", "big-heal", 1000); Game.sync(); return;
  }
  s.auto = false; s._speedMode = false; s.gameOver = true; s._acting = false; clearAuto(); stopHeartbeat(); playSound("lose"); Game.sync();
  Events.emit(E.GAME_OVER, {});
  if (_onOver) _onOver();
}

// ---- 战斗模式（手动→×2→自动→×4 四档循环）----
export function toggleAuto() {
  const s = Game.state; clearAuto();
  if (!s.auto && !s._speedMode && !s._turboMode) { s._speedMode = true; s.auto = false; s._turboMode = false; }     // ×2
  else if (s._speedMode) { s._speedMode = false; s.auto = true; s._turboMode = false; }                              // 自动
  else if (s.auto) { s._speedMode = false; s.auto = false; s._turboMode = true; }                                    // ×4
  else { s._speedMode = false; s.auto = false; s._turboMode = false; }                                                // 手动
  Game.sync();
  if (s.auto || s._speedMode || s._turboMode) startAutoLoop();
}
function autoLoop() {
  const s = Game.state;
  if (!s || s.gameOver || s._winning || !s.player || !s.enemies) { clearAuto(); return; }
  var anyAlive = s.enemies.some(function(e) { return e && e.hp > 0; });
  if (!anyAlive || (!s.auto && !s._speedMode && !s._turboMode)) { clearAuto(); return; }
  // 能量耗尽→直接结束回合（绕过doEndTurn的_acting锁，防卡死）
  if (!s.player || s.player.energy <= 0 || (s._actionsThisTurn || 0) >= MAX_ACTIONS) {
    s._acting = true; try { enemyTurn(); Game.sync(); } finally { s._acting = false; }
    return;
  }

  var enemyCharging = s.enemies.some(function(e) { return e && e.hp > 0 && e._intent && (e._intent.type === 'charge' || e._intent.type === 'heavy'); });
  if (enemyCharging && !s._defendedThisTurn && (s._actionsThisTurn||0) < MAX_ACTIONS) { doDefend(); return; }
  if (s.player.hp < s.player.maxHp * 0.25 && s.potions.length > 0) { usePotion(0); return; }
  if (s.player.hp < s.player.maxHp * 0.15 && !s._defendedThisTurn && (s._actionsThisTurn||0) < MAX_ACTIONS) { doDefend(); return; }
  if (s.curses.length >= 2) { var ci2 = s.potions.findIndex(function(p){return p.id==='cleanse';}); if(ci2>=0){ usePotion(ci2); return; } }
  var available = []; var skills = s.activeSkills || [];
  skills.forEach(function(sk, i) { var cdKey = sk.id || ('skill_' + i); if ((s.skillCooldowns[cdKey] || 0) === 0 && (sk.energyCost || 1) <= s.player.energy) available.push(i); });
  if (available.length > 0) {
    var enemyCount = s.enemies.filter(function(e) { return e.hp > 0; }).length;
    var aoeIdx = -1;
    if (enemyCount >= 2) available.forEach(function(i) { var sk2 = skills[i]; if (sk2.aoe && (sk2.energyCost||1) <= s.player.energy) aoeIdx = i; });
    if (aoeIdx >= 0 && s.rng.chance(0.7)) { doSkill(aoeIdx); return; }
    if (s.rng.chance(0.6)) { doSkill(s.rng.pick(available)); return; }
  }
  if (s.player.energy >= 1 && (s._actionsThisTurn||0) < MAX_ACTIONS) { doAttack(); return; }
  // 兜底：无可用行动→强制结束回合
  s._acting = true; try { enemyTurn(); Game.sync(); } finally { s._acting = false; }
}

// ---- 药水（含炼金宗师羁绊增强）----
export function usePotion(idx) {
  const s = Game.state; if (idx < 0 || idx >= s.potions.length) return false;
  var wasAuto = s.auto, wasSpeed = s._speedMode, wasTurbo = s._turboMode;
  clearAuto();
  try {
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
  } finally {
    if (wasAuto || wasSpeed || wasTurbo) { s.auto = wasAuto; s._speedMode = wasSpeed; s._turboMode = wasTurbo; }
    if (wasAuto || wasSpeed || wasTurbo) startAutoLoop();
    Game.sync();
  }
  return true;
}

// ---- 外部查询意图（给 render 用）----
export function getIntent() { return Game.state._enemyIntent; }

// ---- 装备中途更换时重新计算套装加成（供shop/event调用）----
export function recalcEquipSetBonus() {
  var s = Game.state; var p = s.player; if (!p) return;
  // 还原旧加成
  if (p._set_atk) p.atk -= p._set_atk;
  if (p._set_def) p.def -= p._set_def;
  if (p._set_maxHp) { p.maxHp -= p._set_maxHp; p.hp = Math.min(p.hp, p.maxHp); }
  if (p._set_dodge) p.dodge = (p.dodge||0) - p._set_dodge;
  if (p._set_lifeSteal) p.lifeSteal = (p.lifeSteal||0) - p._set_lifeSteal;
  if (p._set_critRate) p.critRate -= p._set_critRate;
  if (p._set_critMul) p.critMul -= p._set_critMul;
  if (p._set_pen) p.pen = (p.pen||0) - p._set_pen;
  if (p._set_maxMp) { p.maxMp -= p._set_maxMp; p.mp = Math.min(p.mp, p.maxMp); }
  if (p._set_dmgReduce) p.dmgReduce = (p.dmgReduce||0) - p._set_dmgReduce;
  ['_set_atk','_set_def','_set_maxHp','_set_dodge','_set_lifeSteal','_set_critRate','_set_critMul','_set_pen','_set_maxMp','_set_dmgReduce'].forEach(function(k){ p[k]=0; });
  p._setActive2 = null; p._setActive4 = null;
  // 重新计算
  var setCounts = {};
  s.equip.forEach(function(eq) { if (eq._zoneSet) setCounts[eq._zoneSet] = (setCounts[eq._zoneSet]||0)+1; });
  Object.keys(setCounts).forEach(function(setName) {
    var count = setCounts[setName], zone = null;
    Object.values(R.get('zones')||{}).forEach(function(z) { if (z.equipSet === setName) zone = z; });
    if (!zone) return;
    var bonus = (count >= 4 && zone.equipBonus4) ? zone.equipBonus4 : ((count >= 2 && zone.equipBonus) ? zone.equipBonus : null);
    if (!bonus) return;
    p._setActive2 = (count >= 2) ? setName : null;
    p._setActive4 = (count >= 4) ? setName : null;
    if (bonus.atk) { p.atk += bonus.atk; p._set_atk = bonus.atk; }
    if (bonus.def) { p.def += bonus.def; p._set_def = bonus.def; }
    if (bonus.maxHp) { p.maxHp += bonus.maxHp; p.hp += bonus.maxHp; p._set_maxHp = bonus.maxHp; }
    if (bonus.dodge) { p.dodge = (p.dodge||0) + bonus.dodge; p._set_dodge = bonus.dodge; }
    if (bonus.lifeSteal) { p.lifeSteal = (p.lifeSteal||0) + bonus.lifeSteal; p._set_lifeSteal = bonus.lifeSteal; }
    if (bonus.critRate) { p.critRate += bonus.critRate; p._set_critRate = bonus.critRate; }
    if (bonus.critMul) { p.critMul += bonus.critMul; p._set_critMul = bonus.critMul; }
    if (bonus.pen) { p.pen = (p.pen||0) + bonus.pen; p._set_pen = bonus.pen; }
    if (bonus.maxMp) { p.maxMp += bonus.maxMp; p.mp += bonus.maxMp; p._set_maxMp = bonus.maxMp; }
    if (bonus.dmgReduce) { p.dmgReduce = (p.dmgReduce||0) + bonus.dmgReduce; p._set_dmgReduce = bonus.dmgReduce; }
  });
  Game.sync();
}

// ---- 恢复自动战斗（供外部调用，如技能弹窗取消后）----
export function resumeAuto() {
  const s = Game.state;
  if (!s.auto && !s._speedMode) return;
  var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
  if (!anyAlive || s.gameOver) return;
  clearAuto(); startAutoLoop();
}
