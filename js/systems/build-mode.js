// ===================== v0.80 构筑系统（无尽/BossRush） =====================
// 从 main.js 提取的构建模式：职业→技能→遗物→诅咒→七罪→混沌词条→启动挑战
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { RNG } from '../core/rng.js';
import * as Shop from './shop.js';
import { toast } from '../ui/effects.js';

var BUILD_STEPS = ['选择职业','选择技能','选择遗物','选择诅咒','七罪诅咒','混沌词条'];
var SIN_CURSES = [
  { id:'sin_pride', name:'傲慢之印', icon:'👑', desc:'受到伤害+30%', pos:'所有伤害+20%' },
  { id:'sin_envy', name:'嫉妒之噬', icon:'🐍', desc:'每回合扣2%最大生命', pos:'击杀回复12%最大HP' },
  { id:'sin_wrath', name:'暴怒之焰', icon:'🔥', desc:'每受击防御-1(可叠加)', pos:'每损失10%HP，攻击+6%' },
  { id:'sin_sloth', name:'懒惰之息', icon:'😴', desc:'最大能量-1', pos:'ATK+15%' },
  { id:'sin_greed', name:'贪婪之欲', icon:'🪙', desc:'每回合扣2%最大生命', pos:'击杀灵石×3' },
  { id:'sin_gluttony', name:'暴食之腹', icon:'🍖', desc:'每回合扣2%最大生命', pos:'回复效果+120%+吸血+5%' },
  { id:'sin_lust', name:'色欲之魅', icon:'💋', desc:'受到伤害+25%', pos:'暴击率+20%' },
];
// v0.80: CHAOS_TIERS 移除 → 统一数据源 content/chaos-mods.js (R.get('chaosMods'))

// 回调注入：launchBuildChallenge 需要 main.js 中的这些函数
var _injected = { loadOutgameEquipToState: null, initBossRush: null, initEndlessChallengeZone: null };

// 仅注入回调，不启动构建流程
export function injectBuildCallbacks(injected) {
  if (injected) {
    if (injected.loadOutgameEquipToState) _injected.loadOutgameEquipToState = injected.loadOutgameEquipToState;
    if (injected.initBossRush) _injected.initBossRush = injected.initBossRush;
    if (injected.initEndlessChallengeZone) _injected.initEndlessChallengeZone = injected.initEndlessChallengeZone;
  }
}

export function startBuildMode(mode) {
  if (!mode) { console.warn('[build-mode] startBuildMode: mode 为空，已忽略'); return; }
  Game.hardReset();
  var s = Game.state;
  s.mode = (mode === 'bossrush') ? 'boss_rush' : 'endless_challenge';
  s._buildMode = mode;
  s._buildStep = 0;
  s.seed = '' + Date.now(); s.rng = new RNG(s.seed);
  if (!s.build) s.build = { classId:null, skillIds:[], relicIds:{legendary:null,epic:null,rare:[],common:[]}, curseIds:[], sinCurseId:null, chaosModId:null };
  s.build.classId = null; s.build.skillIds = []; s.build.relicIds = {legendary:null,epic:null,rare:[],common:[]};
  s.build.curseIds = []; s.build.sinCurseId = null; s.build.chaosModId = null;
  s._buildCurseDraw = []; s._buildChaosDraw = [];
  document.getElementById('start').classList.add('hidden');
  document.getElementById('btn-build-exit').onclick = function() {
    document.getElementById('build-panel').classList.add('hidden');
    document.getElementById('start').classList.remove('hidden');
  };
  showBuildStep();
}

function showBuildStep() {
  var s = Game.state;
  var step = s._buildStep || 0;
  var el = document.getElementById('build-panel');
  el.classList.remove('hidden');
  document.getElementById('build-title').textContent = BUILD_STEPS[step] || '';
  document.getElementById('build-step').textContent = '步骤 ' + (step+1) + '/' + BUILD_STEPS.length + ' · ' + (s._buildMode==='bossrush'?'Boss Rush':'无尽挑战');
  document.getElementById('build-confirm').style.display = 'block';
  document.getElementById('build-back').style.display = step > 0 ? 'block' : 'none';
  document.getElementById('build-status').textContent = '';
  document.getElementById('build-confirm').onclick = advanceBuildStep;
  document.getElementById('build-back').onclick = function(){ s._buildStep--; showBuildStep(); };
  switch(step) {
    case 0: showBuildClassSelect(); break;
    case 1: showBuildSkillSelect(); break;
    case 2: showBuildRelicSelect(); break;
    case 3: showBuildCurseSelect(); break;
    case 4: showBuildSinCurseSelect(); break;
    case 5: showBuildChaosSelect(); break;
  }
}

function advanceBuildStep() {
  var s = Game.state;
  var step = s._buildStep || 0;
  var ok = true;
  if (step === 0 && !s.build.classId) { toast('请选择职业'); ok = false; }
  if (step === 1 && s.build.skillIds.length === 0) { toast('请至少选择1个技能'); ok = false; }
  if (step === 2 && (!s.build.relicIds.legendary && !s.build.relicIds.epic && s.build.relicIds.rare.length===0 && s.build.relicIds.common.length===0)) { toast('请至少选择1件遗物'); ok = false; }
  if (step === 3 && s.build.curseIds.length === 0) { toast('请至少选择1个诅咒'); ok = false; }
  if (step === 4 && !s.build.sinCurseId) { toast('请选择七罪诅咒'); ok = false; }
  if (step === 5 && s.build.chaosModId == null) { toast('请选择混沌词条'); ok = false; }
  if (!ok) return;
  if (step >= 5) { launchBuildChallenge(); return; }
  s._buildStep = step + 1;
  showBuildStep();
}

function showBuildClassSelect() {
  var content = document.getElementById('build-content');
  content.innerHTML = '';
  var classes = R.get('classes');
  if (!classes) return;
  document.getElementById('build-confirm').style.display = 'block';
  Object.values(classes).forEach(function(cls) {
    var card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = '<span class="bc-icon">' + cls.icon + '</span><div class="bc-info"><div class="bc-name">' + cls.name + '</div><div class="bc-desc">HP:' + cls.maxHp + ' ATK:' + cls.atk + ' DEF:' + cls.def + '</div></div><span class="bc-check">✓</span>';
    card.onclick = function() {
      Game.state.build.classId = cls.id;
      content.querySelectorAll('.build-card').forEach(function(c){c.classList.remove('selected');});
      card.classList.add('selected');
    };
    if (Game.state.build.classId === cls.id) card.classList.add('selected');
    content.appendChild(card);
  });
}

function showBuildSkillSelect() {
  var content = document.getElementById('build-content');
  content.innerHTML = '';
  var s = Game.state;
  var cls = R.get('classes', s.build.classId);
  if (!cls) { toast('请先选择职业'); return; }
  var skills = [];
  (cls.skills || []).forEach(function(sk){ skills.push({...sk, source:'职业'}); });
  (Game.meta.synthSkills || []).forEach(function(sk){ skills.push({...sk, source:'合成'}); });
  var mLv = Game.getMasteryLevel(cls.id);
  if (mLv >= 15 && Game.isAwakened(cls.id)) {
    var mSkills = R.get('classMasterySkills');
    if (mSkills && mSkills[cls.id]) {
      mSkills[cls.id].forEach(function(ms){ if (ms.masteryLv >= 10) skills.push({...ms, source:'觉醒大招'}); });
    }
  }
  document.getElementById('build-status').textContent = '已选 ' + s.build.skillIds.length + '/3';
  skills.forEach(function(sk) {
    var card = document.createElement('div');
    card.className = 'build-card';
    var isSel = s.build.skillIds.indexOf(sk.id) >= 0;
    if (isSel) card.classList.add('selected');
    card.innerHTML = '<span class="bc-icon">' + (sk.icon||'📜') + '</span><div class="bc-info"><div class="bc-name">' + sk.name + '</div><div class="bc-desc">' + (sk.desc||'') + ' · ' + sk.source + '</div></div><span class="bc-check">✓</span>';
    card.onclick = function() {
      if (isSel) { s.build.skillIds = s.build.skillIds.filter(function(id){return id!==sk.id;}); }
      else if (s.build.skillIds.length < 3) { s.build.skillIds.push(sk.id); }
      else { toast('最多选择3个技能'); return; }
      showBuildSkillSelect();
    };
    content.appendChild(card);
  });
}

function showBuildRelicSelect() {
  var content = document.getElementById('build-content');
  content.innerHTML = '';
  var s = Game.state;
  var discovered = Game.meta.discoveredRelics || [];
  var allRelics = R.get('relics') || [];
  var avail = allRelics.filter(function(r){ return discovered.indexOf(r.id) >= 0 && (!r.category || r.category !== 'core'); });
  if (Game.meta.forgedRelic) { var fr = allRelics.find(function(r){return r.id===Game.meta.forgedRelic;}); if (fr && avail.indexOf(fr)<0) avail.push(fr); }
  var tiers = [
    { key:'legendary', label:'✨ 传说', count:1, filter:function(r){return r.rarity==='legendary'||r.id===Game.meta.forgedRelic;} },
    { key:'epic', label:'💜 史诗', count:1, filter:function(r){return r.rarity==='epic';} },
    { key:'rare', label:'💙 稀有', count:2, filter:function(r){return r.rarity==='rare';} },
    { key:'common', label:'🤍 普通', count:2, filter:function(r){return r.rarity==='common';} },
  ];
  document.getElementById('build-status').textContent = '已选遗物 · 觉醒专属/符文自动携带';
  tiers.forEach(function(tier) {
    var tierDiv = document.createElement('div');
    var sel = tier.key==='legendary'?[s.build.relicIds.legendary].filter(Boolean):(s.build.relicIds[tier.key]||[]);
    tierDiv.innerHTML = '<div class="build-tier-title">' + tier.label + ' <span class="bt-count">' + sel.length + '/' + tier.count + '</span></div>';
    var grid = document.createElement('div'); grid.className = 'build-tier';
    avail.filter(tier.filter).forEach(function(r) {
      var card = document.createElement('div');
      card.className = 'build-card';
      var isSel = (tier.key==='legendary') ? (s.build.relicIds.legendary===r.id) : (s.build.relicIds[tier.key]||[]).indexOf(r.id)>=0;
      if (isSel) card.classList.add('selected');
      card.innerHTML = '<span class="bc-icon">' + (r.icon||'🔮') + '</span><div class="bc-info"><div class="bc-name">' + r.name + '</div><div class="bc-desc">' + (r.desc||'') + '</div></div><span class="bc-check">✓</span>';
      card.onclick = function() {
        if (tier.key === 'legendary') { s.build.relicIds.legendary = isSel ? null : r.id; }
        else {
          var arr = s.build.relicIds[tier.key] || [];
          if (isSel) { s.build.relicIds[tier.key] = arr.filter(function(id){return id!==r.id;}); }
          else if (arr.length < tier.count) { s.build.relicIds[tier.key] = arr.concat(r.id); }
          else { toast(tier.label+'最多选'+tier.count+'个'); return; }
        }
        showBuildRelicSelect();
      };
      grid.appendChild(card);
    });
    tierDiv.appendChild(grid);
    content.appendChild(tierDiv);
  });
}

function showBuildCurseSelect() {
  var content = document.getElementById('build-content');
  content.innerHTML = '';
  var s = Game.state;
  var validCurses = ['weak','slow','bleed','fear','blind','fragile','forgetful','badluck','doom'];
  var allCurses = R.get('curses') || [];
  var pool = allCurses.filter(function(c){ return validCurses.indexOf(c.id) >= 0; });
  if (!s._buildCurseDraw || s._buildCurseDraw.length === 0) {
    s._buildCurseDraw = (s.rng || { pickMulti: function(arr,n){ var a=arr.slice(); for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;} return a.slice(0,n); } }).pickMulti(pool, Math.min(3, pool.length));
  }
  var curses = s._buildCurseDraw;
  document.getElementById('build-status').textContent = '已选 ' + s.build.curseIds.length + '/3  (展示3张随机诅咒)';
  curses.forEach(function(c) {
    var card = document.createElement('div');
    card.className = 'build-card';
    var isSel = s.build.curseIds.indexOf(c.id) >= 0;
    if (isSel) card.classList.add('selected');
    card.innerHTML = '<span class="bc-icon">' + (c.icon||'☠️') + '</span><div class="bc-info"><div class="bc-name">' + c.name + '</div><div class="bc-desc">' + (c.desc||'') + '</div></div><span class="bc-check">✓</span>';
    card.onclick = function() {
      if (isSel) { s.build.curseIds = s.build.curseIds.filter(function(id){return id!==c.id;}); }
      else if (s.build.curseIds.length < 3) { s.build.curseIds.push(c.id); }
      else { toast('最多选择3个诅咒'); return; }
      showBuildCurseSelect();
    };
    content.appendChild(card);
  });
  var rerollBtn = document.createElement('button');
  rerollBtn.className = 'modal-btn';
  rerollBtn.style.cssText = 'margin-top:8px;font-size:12px;background:#2a1a0a;border-color:#8a6030;color:#ffcc88';
  rerollBtn.textContent = '🎲 重新抽取（3张）';
  rerollBtn.onclick = function() { s._buildCurseDraw = []; s.build.curseIds = []; showBuildCurseSelect(); };
  content.appendChild(rerollBtn);
}

function showBuildSinCurseSelect() {
  var content = document.getElementById('build-content');
  content.innerHTML = '';
  var s = Game.state;
  document.getElementById('build-status').textContent = '七罪诅咒：必须选择1个';
  SIN_CURSES.forEach(function(sc) {
    var card = document.createElement('div');
    card.className = 'build-card';
    var isSel = s.build.sinCurseId === sc.id;
    if (isSel) card.classList.add('selected');
    card.innerHTML = '<span class="bc-icon">' + sc.icon + '</span><div class="bc-info"><div class="bc-name">' + sc.name + '</div><div class="bc-desc"><span style="color:#ff7b7b">−' + sc.desc + '</span> · <span style="color:#89e894">+' + sc.pos + '</span></div></div><span class="bc-check">✓</span>';
    card.onclick = function() {
      s.build.sinCurseId = isSel ? null : sc.id;
      showBuildSinCurseSelect();
    };
    content.appendChild(card);
  });
}

function showBuildChaosSelect() {
  var content = document.getElementById('build-content');
  content.innerHTML = '';
  var s = Game.state;
  document.getElementById('build-status').textContent = '混沌词条：三选一';
  if (!s._buildChaosDraw || s._buildChaosDraw.length === 0) {
    var tiers = R.get('chaosMods'); var pool = tiers ? tiers.tier1 : [];
    s._buildChaosDraw = (s.rng ? s.rng.pickMulti(pool, 3) : pool.slice(0, 3));
  }
  var picks = s._buildChaosDraw;
  picks.forEach(function(mod, i) {
    var card = document.createElement('div');
    card.className = 'build-card';
    var isSel = s.build.chaosModId === i;
    if (isSel) card.classList.add('selected');
    card.innerHTML = '<span class="bc-icon">🌀</span><div class="bc-info"><div class="bc-name">' + mod.name + '</div><div class="bc-desc">' + mod.desc + '</div></div><span class="bc-check">✓</span>';
    card.onclick = function() {
      s.build.chaosModId = i;
      s._buildChaosPick = picks[i];
      showBuildChaosSelect();
    };
    content.appendChild(card);
  });
  document.getElementById('build-confirm').textContent = '🚀 确认构筑 · 开始挑战';
}

function launchBuildChallenge() {
  var s = Game.state;
  var build = s.build;
  var cls = R.get('classes', build.classId);
  if (!cls) { toast('职业数据错误'); return; }
  s.playerClass = cls;
  s.player = { hp:cls.hp, maxHp:cls.maxHp, mp:cls.maxMp, maxMp:cls.maxMp, atk:cls.atk, def:cls.def, critRate:cls.critRate, critMul:cls.critMul, skillMul:cls.skillMul, mpCost:cls.mpCost, pen:cls.pen, lifeSteal:0, thorn:0, goldMul:1, dodge:cls.dodge||0, bleed:0, rage:false, doubleFirst:false, debuffAtk:null, dmgReduce:0, berserk:false, rebirth:false, regen:0, energy:3, maxEnergy:3 };
  Game.applyMetaBonus(s.player);
  Game.applyMasteryBonuses(s.player, cls.id);
  Game.applyAdvancementBonuses(s.player, cls.id);
  Game.applyAwakeningBonuses(s.player, cls.id);
  Game.applyBrandBonuses(s.player);
  Game.applyFinalCaps(s.player);
  s.activeSkills = [];
  build.skillIds.forEach(function(sid) {
    var sk = (cls.skills||[]).find(function(x){return x.id===sid;}) || (Game.meta.synthSkills||[]).find(function(x){return x.id===sid;}) || null;
    if (!sk) { var mSkills = R.get('classMasterySkills'); if (mSkills && mSkills[cls.id]) sk = mSkills[cls.id].find(function(x){return x.id===sid;}); }
    if (sk) s.activeSkills.push({...sk});
  });
  if (s.activeSkills.length === 0) { var defSk = cls.skills[Math.floor(s.rng.next() * cls.skills.length)]; s.activeSkills.push({...defSk}); } // v0.85: Math.random→s.rng 保种子
  s.activeSkill = s.activeSkills[0]; s.skillLevels = {}; s.activeSkills.forEach(function(sk){s.skillLevels[sk.id]=1;});
  var allRelics = R.get('relics') || [];
  var loadRelic = function(rid) {
    if (!rid) return;
    var r = allRelics.find(function(x){return x.id===rid;});
    if (r) Shop.acquireRelic({...r});
  };
  loadRelic(build.relicIds.legendary);
  loadRelic(build.relicIds.epic);
  (build.relicIds.rare||[]).forEach(loadRelic);
  (build.relicIds.common||[]).forEach(loadRelic);
  var awkRelic = Game.getAwakenedRelic ? Game.getAwakenedRelic(cls.id) : null;
  if (awkRelic) { var ar = allRelics.find(function(r){return r.id===awkRelic;}); if (ar) Shop.acquireRelic({...ar}); }
  _injected.loadOutgameEquipToState(s);
  var allCurses = R.get('curses') || [];
  build.curseIds.forEach(function(cid) {
    var c = allCurses.find(function(x){return x.id===cid;});
    if (c) { s.curses.push(c); c.apply(s.player); }
  });
  if (build.sinCurseId) {
    var sin = SIN_CURSES.find(function(x){return x.id===build.sinCurseId;});
    if (sin) {
      s._sinCurse = sin;
      switch(sin.id) {
        case 'sin_pride': s.player._sinPride = true; break;
        case 'sin_envy': s.player._sinEnvy = true; break;
        case 'sin_wrath': s.player._sinWrath = true; s.player._sinWrathDef = 0; break;
        case 'sin_sloth': s.player.maxEnergy = Math.max(1, (s.player.maxEnergy||3)-1); s.player.energy = s.player.maxEnergy; s.player.atk = Math.floor(s.player.atk*1.15); break;
        case 'sin_greed': s.player._sinGreed = true; break;
        case 'sin_gluttony': s.player._sinGluttony = true; s.player.lifeSteal = (s.player.lifeSteal||0) + 0.05; break;
        case 'sin_lust': s.player.critRate += 0.20; s.player._sinLust = true; break;
      }
    }
  }
  document.getElementById('build-panel').classList.add('hidden');
  if (s._buildMode === 'bossrush') {
    s.seed = '' + Date.now(); s.rng = new RNG(s.seed); s.difficulty = 'hell';
    s.bossRushIndex = 0; s.bossRushHP = 0;
  } else {
    s.seed = '' + Date.now(); s.rng = new RNG(s.seed); s.difficulty = 'standard';
    s.endless = true; s.endlessFloor = 0; s.endlessChaosCount = 0; s._nextChaosFloor = 10;
  }
  if (s._buildChaosPick) {
    s._buildChaosPick.apply(s);
    if (!s._appliedMutations) s._appliedMutations = [];
    s._appliedMutations.push(s._buildChaosPick.name);
  }
  if (s._buildMode === 'bossrush') {
    _injected.initBossRush();
  } else {
    _injected.initEndlessChallengeZone();
  }
}
