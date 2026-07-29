// ===================== 妖塔3.0 入口 =====================
// 地基重构版 — main.js 只做：加载内容 → 绑定按钮 → 协调流程

// ---- 加载所有游戏数据（触发 Registry 注册）----
import '../content/classes.js';
import '../content/enemies.js';
import '../content/bosses.js';
import '../content/zones.js';
import '../content/relics.js';
import '../content/curses.js';
import '../content/talents.js';
import '../content/monster-tags.js';
import '../content/difficulties.js';
import '../content/potions.js';
import '../content/equipment.js';
import '../content/daily-mods.js';
import '../content/meta-limits.js';
import '../content/room-types.js';
import '../content/room-templates.js';
import '../content/synergies.js';
import '../content/achievements.js';
import '../content/quests.js';
import '../content/forge.js';
import { TapSave } from '../platform/tapsave.js';
import { TapLeaderboard } from '../platform/tapleaderboard.js';
import { TapAchievement } from '../platform/tapachievement.js';

// ---- 核心 ----
import { Game, onRender } from "./state.js";
import { R } from "./registry.js";
import { E, Events } from "./event-bus.js";
import { initAudio, playSound, stopHeartbeat } from "./audio.js";
import { RNG } from "./rng.js";

// ---- 系统 ----
import * as Combat from "../systems/combat.js";
import * as Loot from "../systems/loot.js";
import * as Room from "../systems/room.js";
import * as Shop from "../systems/shop.js";
import * as EventSys from "../systems/event.js";
import * as Prog from "../systems/progression.js";
import * as Synergy from "../systems/synergy.js";

// ---- UI ----
import { render, log, toast, float, switchScreen, showModal, hideModal, hideAllModals } from "../ui/render.js";
import { RARITY_COLOR, RARITY_NAME } from '../content/relics.js';
import { animPlayerAttack, animPlayerCrit, animEnemyHit, animEnemyAttack, animPlayerHit, animEnemyKill, animPlayerDodge, animPlayerDefend, updateArena, bigFloat, screenShake, logTurnSeparator } from "../ui/effects.js";

// ===================== 初始化 =====================
import { validateAll } from './validate.js';
Game.init();
validateAll(); // 启动时扫描所有配置，控制台输出警告
onRender(s => render(s));
initAudio();
// TapTap平台模块初始化（浏览器环境自动跳过）
TapSave.init();
TapLeaderboard.init();
TapAchievement.init();
// 桥接存档：Game.save后自动同步云端
var _origSave = Game.save.bind(Game);
Game.save = function() { _origSave(); if (this.state.totalFloor > 0) TapSave.saveToCloud('auto_save', this.state); };
// 桥接成就
var _origUnlock = Game.unlockAchievement.bind(Game);
Game.unlockAchievement = function(id) { _origUnlock(id); TapAchievement.unlock(id); };
// 桥接排行榜
var _origAddLB = Game.addLeaderboard.bind(Game);
Game.addLeaderboard = function(entry) { _origAddLB(entry); TapLeaderboard.submitScore('total', entry.floor); };

window._usePotion = i => { Combat.usePotion(i); };
window._showAchPanel = () => { showAchievementPanel(); };

// ===================== 序幕（首次访问） =====================
const PROLOGUE_KEY = "yaotower_v3.2_prologue_done";
(function playPrologue() {
  if (localStorage.getItem(PROLOGUE_KEY)) return; // 已看过，跳过
  const lines = [
    "魔塔的阴影正在蔓延……",
    "边境城池，是人类最后的庇护所。",
    "你，是这座城中最后的勇士。",
    "踏入迷雾，直面妖邪——",
    "愿先祖之灵护佑你的征程。"
  ];
  const el = document.getElementById("prologue");
  const txt = document.getElementById("prologue-text");
  if (!el || !txt) return;

  el.style.display = "flex";
  let lineIdx = 0, charIdx = 0, done = false;

  function typeNext() {
    if (done) return;
    if (lineIdx >= lines.length) { finishPrologue(); return; }

    if (charIdx === 0) {
      txt.innerHTML = ""; // 新行开始
    }

    if (charIdx < lines[lineIdx].length) {
      txt.innerHTML = lines[lineIdx].substring(0, charIdx + 1) + '<span class="cursor"></span>';
      charIdx++;
      setTimeout(typeNext, 60 + Math.random() * 40);
    } else {
      // 当前行打完，停顿后换行
      txt.innerHTML = lines[lineIdx] + '<span class="cursor"></span>';
      charIdx = 0; lineIdx++;
      setTimeout(typeNext, 400);
    }
  }

  function finishPrologue() {
    done = true;
    localStorage.setItem(PROLOGUE_KEY, "1");
    el.classList.add("fade-out");
    setTimeout(() => { el.style.display = "none"; }, 800);
  }

  // 点击跳过
  el.onclick = () => {
    if (!done) finishPrologue();
  };

  setTimeout(typeNext, 400);
})();

// ===================== 事件订阅：战斗反馈 → UI =====================
Events.on(E.BATTLE_START, d => {
  if (d.type === 'doubleFirst') log("<span class='info'>💨 天赋触发·首回合连击！</span>");
  if (d.type === 'doubleAttack' || d.type === 'doubleSkill') log("<span class='info'>💨 连击！</span>");
  if (d.type === 'defend') { log("🛡️ 防御姿态！下回合反击+35%", "info"); animPlayerDefend(); }
  if (d.type === 'dodge') { log("🍃 闪避！"); animPlayerDodge(); bigFloat("闪避！", "big-dodge", 800); playSound("dodge");
    var wf = document.createElement("div"); wf.className = "white-flash"; document.body.appendChild(wf); setTimeout(function(){wf.remove();}, 400);
  }
  if (d.type === 'chargeAttack') { log(`<span class="warn">⚠️ ${d.name} 蓄力攻击！伤害翻倍！</span>`); animEnemyAttack(); }
  if (d.type === 'potion') { log(`<span class="heal">🧪 使用了 ${d.name}！${d.desc}</span>`); trackQuest('potion', 1); }
  if (d.type === 'cleanse' && d.name) log(`<span class="info">🧴 清除了诅咒：${d.name}</span>`);
  if (d.type === 'burn') log(`<span class="warn">🔥 燃烧！${d.turns}回合，每回合${d.dmg}伤害</span>`);
  if (d.type === 'slow') log("<span class='info'>❄️ 迟缓！敌人下回合攻击力降低</span>");
  if (d.type === 'stun') log(`<span class="win">⚡ ${d.name} 被眩晕！跳过下回合</span>`);
  if (d.type === 'bossSkill') log(`<span class="warn">${d.msg}</span>`);
  if (d.type === 'bossPhase2') { log(`<span class="warn">💢 Boss进入二阶段：${d.name}！</span>`); toast("⚠️ Boss暴怒！二阶段！"); playSound("bossRoar"); screenShake(2);
    var main = document.getElementById("main"); if (main) { main.classList.add("boss-rage"); setTimeout(function(){main.classList.remove("boss-rage");}, 8000); }
  }
  if (d.type === 'achievement') { const ach = (R.get('achievements') || []).find(a => a.id === d.id); if (ach) { toast(`🏆 成就解锁：${ach.name}！`); playSound("achievement"); showAchievementCard(ach); } }
  if (d.type === 'synCritDice') log("<span class='win'>🎲 命运之眼触发！伤害翻倍！</span>");
  if (d.type === 'synergy') { log(`<span class="win">🔗 羁绊激活：${d.name}！${d.desc}</span>`); bigFloat("🔗 羁绊激活！", "big-crit", 1200); screenShake(1);
    var sr = document.createElement("div"); sr.id = "synergy-ring"; document.body.appendChild(sr); setTimeout(function(){sr.remove();}, 1300);
  }
  if (d.type === 'stoneGaze') log("<span class='warn'>🗿 被石化了！跳过本回合</span>");
  if (d.tags) log(`<span class="warn">⚠️ 第${d.floor}层·${d.zone.name}：${d.enemy.name} ${d.tags}</span>`);
  // Boss登场暗幕
  if (d.intent && Game.state._currentRoomType === 'boss') {
    var bo = document.getElementById("boss-entrance-overlay"); if (!bo) { bo = document.createElement("div"); bo.id = "boss-entrance-overlay"; document.body.appendChild(bo); }
    bo.classList.add("fire"); setTimeout(function(){bo.classList.remove("fire");}, 1500);
  }
});

Events.on(E.PLAYER_DAMAGED, d => {
  if (d.crit) {
    log(`💥 <b class="crit">暴击！</b>造成 <span class="dmg">${d.dmg}</span> 点伤害`,"crit");
    float(d.dmg+"!","float-crit");
    animPlayerCrit(); animEnemyHit();
    trackQuest('crit', 1);
    // 暴击裂纹特效
    var co = document.getElementById("crit-overlay"); if (!co) { co = document.createElement("div"); co.id = "crit-overlay"; document.body.appendChild(co); }
    co.classList.add("fire"); setTimeout(function(){co.classList.remove("fire");}, 300);
  }
  else if (d.counter) { log(`⚔️ <b style="color:#ffa502">反击！</b>造成 <span class="dmg">${d.dmg}</span> 点伤害`); float(d.dmg,"float-dmg"); animEnemyHit(); }
  else if (d.source === 'thorn' && d.target === 'enemy') { log(`<span class="warn">荆棘反弹 ${d.dmg}！</span>`); }
  else if (d.source === 'thorn') { log(`<span class="warn">${d.enemy} 反伤 ${d.dmg}！</span>`); animPlayerHit(); }
  else if (d.source === 'burn' && d.target === 'enemy') { log(`<span class="warn">🔥 燃烧造成 ${d.dmg} 伤害</span>`); }
  else if (d.source === 'bleed') { log(`<span class="warn">☠️ 流血损失 ${d.dmg} 生命</span>`); }
  else if (d.source && d.target === 'self') { /* 自伤不播放动画 */ }
  else if (d.source && d.target === 'player') { log(`${d.source || ''} 造成 <span class="dmg">${d.dmg}</span> 伤害`); animPlayerHit(); }
  else if (d.source && d.dmg > 0) {
    // 区分玩家攻击敌人 vs 敌人攻击玩家
    if (d.source === Game.state.enemy?.name) { log(`${d.source} 攻击，造成 <span class="dmg">${d.dmg}</span> 伤害`); float(d.dmg,"float-dmg"); animPlayerHit(); }
    else { log(`${d.source} 攻击，造成 <span class="dmg">${d.dmg}</span> 伤害`); float(d.dmg,"float-dmg"); animEnemyHit(); }
  }
  else { log(`⚔️ 造成 <span class="dmg">${d.dmg}</span> 点伤害`); float(d.dmg,"float-dmg"); animEnemyHit(); }
});

Events.on(E.PLAYER_HEALED, d => {
  if (d.source === 'lifeSteal') log(`<span class="heal">恢复 ${d.amount} 生命</span>`);
  if (d.source === 'regen') log(`<span class="heal">恢复 ${d.amount} 生命</span>`);
  if (d.source === 'rebirth') { log(`<span class="win">🔥 凤凰羽触发！浴火重生！</span>`); bigFloat("重生！", "big-heal", 1200);
    var main = document.getElementById("main"); if (main) { main.classList.add("heal-glow"); setTimeout(function(){main.classList.remove("heal-glow");}, 900); }
  }
  if (d.amount >= 30) { var main = document.getElementById("main"); if (main) { main.classList.add("heal-glow"); setTimeout(function(){main.classList.remove("heal-glow");}, 900); } }
});

Events.on(E.ENEMY_KILLED, d => {
  log(`<span class="win">✨ ${d.name} 被斩杀！</span>`);
  animEnemyKill();
  bigFloat("击杀！", "big-kill", 1000);
  // 击杀闪白
  var flash = document.getElementById("kill-flash");
  if (flash) { flash.classList.add("fire"); setTimeout(function() { flash.classList.remove("fire"); }, 250); }
  const roomType = Game.state._currentRoomType;
  trackQuest('kill', 1);
  if (roomType === 'boss') trackQuest('boss', 1);
  if (roomType === 'elite') trackQuest('elite', 1);
});

Events.on(E.GOLD_CHANGED, d => {
  if (d.delta > 0) {
    if (d.fast) log(`<span class="win">🏆 限时击杀！仅用${Game.state.turnInFloor}回合，金币翻倍！</span>`);
    log(`<span class="gold">💰 获得 ${d.delta} 金币</span>`); float("+"+d.delta,"float-gold");
    playSound("gold");
    trackQuest('gold', d.delta);
  }
  if (d.souls > 0) { log(`<span class="win">💎 获得 ${d.souls} 魂晶！</span>`); float("+"+d.souls+"💎","float-gold"); playSound("relic"); }
});

Events.on(E.CURSE_APPLIED, d => {
  if (d.type === 'debuffAtk') log(`<span class="warn">☠️ ${d.name} 的诅咒降低了你的攻击力！</span>`);
});

Events.on(E.ROOM_ENTER, d => { /* 由 showRoomInfo 处理 */ });

Events.on(E.TURN_END, d => {
  if (d.turnInFloor > 1) logTurnSeparator(d.turnInFloor);
});

Events.on(E.GAME_OVER, () => { stopHeartbeat(); onGameOver(); });
Events.on(E.GAME_CLEAR, () => { stopHeartbeat(); gameClear(); });

// ===================== 按钮绑定 =====================
document.getElementById("btn-newgame").onclick = () => { initAudio(); startNewGame(); };
document.getElementById("btn-continue").onclick = () => { try { if (Game.load()) { continueGame(); } else { Game.deleteSave(); render(Game.state); toast("存档损坏，已自动重置"); } } catch(e) { console.error("读档崩溃:", e); Game.deleteSave(); render(Game.state); toast("存档异常，已重置"); } };
document.getElementById("btn-daily").onclick = showQuestBoard;
document.getElementById("btn-meta").onclick = showMetaPanel;
document.getElementById("btn-delete").onclick = () => { if (confirm("确定删除存档？图鉴和排行榜将保留。")) { Game.hardReset(); switchScreen("start"); render(Game.state); } };
document.getElementById("btn-show-lb-start").onclick = () => { if (!TapLeaderboard.showPanel('total')) showLeaderboard(); };
document.getElementById("btn-close-daily").onclick = () => hideModal("daily-panel");
document.getElementById("btn-close-lb").onclick = () => hideModal("leaderboard");
document.getElementById("btn-compendium").onclick = () => showCompendium();
document.getElementById("btn-city-enter").onclick = () => showCityHub();
document.getElementById("btn-city-back").onclick = () => switchScreen("start");
document.getElementById("btn-close-compendium").onclick = () => hideModal("compendium");
document.getElementById("btn-hard-restart").onclick = () => { Game.hardReset(); switchScreen("start"); render(Game.state); };
document.getElementById("btn-read-save").onclick = () => { if (Game.load()) continueGame(); };
document.getElementById("btn-show-lb").onclick = () => { if (!TapLeaderboard.showPanel('total')) showLeaderboard(); };

// 战斗按钮（带容错）
const _safe = (fn, name) => () => { try { fn(); } catch(e) { console.error(`[妖塔] ${name} 崩溃:`, e); toast("操作失败，已记录错误"); } };
document.getElementById("btn-atk").onclick = _safe(function() { Combat.clearAuto(); Combat.doAttack(); }, "doAttack");
// 技能按钮 → 弹出技能选择
document.getElementById("btn-skill").onclick = _safe(function() { Combat.clearAuto(); showSkillPopup(); }, "openSkillPopup");
// 闪避按钮
document.getElementById("btn-def").onclick = _safe(function() { Combat.clearAuto(); Combat.doDefend(); }, "doDefend");
document.getElementById("btn-auto").onclick = _safe(Combat.toggleAuto, "toggleAuto");

Combat.setCB(onWin, () => {}); // onOver 由 Events 处理

// 全局错误捕获
window.onerror = (msg, src, line, col, err) => {
  console.error("[妖塔] 全局异常:", msg, "at", src, ":", line, ":", col, err?.stack);
  toast("游戏出现异常，已尝试保存进度");
  try { Game.sync(); } catch(e) {}
};

// ===================== 局外成长 =====================
function showMetaPanel() {
  buildMetaPanel(id => {
    const meta = Game.meta;
    const lim = R.get('metaLimits', id);
    if (!meta.upgrades) meta.upgrades = {};
    const cur = meta.upgrades[id] || 0;
    if (cur >= lim.max) { alert("已达上限"); return; }
    if (meta.tp < lim.cost) { alert("天赋点不足"); return; }
    meta.tp -= lim.cost;
    meta.upgrades[id] = Math.min(lim.max, cur + lim.step); // 防止浮点溢出
    Game.saveMeta();
    buildMetaPanel(id2 => showMetaPanel());
    showModal("meta-panel");
  });
  showModal("meta-panel");
}

function buildMetaPanel(onUpgrade) {
  const el = document.getElementById("meta-panel"); if (!el) return;
  el.style.display = "block";
  const content = document.getElementById("meta-content"); content.innerHTML = "";
  const meta = Game.meta;

  // TP 显示
  document.getElementById("meta-tp").textContent = `${meta.tp || 0} TP · ${meta.souls || 0} 魂晶`;

  // 天赋点升级（原有）
  const limits = R.get('metaLimits');
  Object.entries(limits).forEach(([id, lim]) => {
    const cur = meta.upgrades ? (meta.upgrades[id] || 0) : 0;
    const maxLevel = Math.floor(lim.max / lim.step);
    const curLevel = Math.floor(cur / lim.step);
    const div = document.createElement("div");
    div.style.cssText = "margin-bottom:10px;padding:10px;background:#0d1117;border-radius:6px";
    div.innerHTML = `<b>${lim.name}</b> <span style="color:#ffa502">Lv.${curLevel}/${maxLevel}</span><br>` +
      `<span style="color:#8899bb;font-size:12px">${lim.desc||''} 当前: +${Math.floor(cur*100)}% 消耗: ${lim.cost}TP</span><br>` +
      `<button class="modal-btn" style="margin-top:6px" ${meta.tp<lim.cost||cur>=lim.max?'disabled':''}>升级</button>`;
    div.querySelector("button").onclick = () => onUpgrade(id);
    content.appendChild(div);
  });

  // 职业解锁
  const classDivider = document.createElement("div");
  classDivider.style.cssText = "margin:16px 0 10px;padding:6px;background:#102010;border-radius:6px;text-align:center;color:#89e894;font-size:13px;font-weight:bold";
  classDivider.textContent = "🎭 职业解锁";
  content.appendChild(classDivider);

  const classUnlocks = [
    { id: "archer", name: "🏹 弓手", cost: 30, desc: "远程狙击·超高暴伤·先手优势" },
    { id: "monk", name: "🧘 武僧", cost: 30, desc: "攻守兼备·生命回复·韧性极强" },
  ];

  classUnlocks.forEach(cu => {
    const unlocked = (meta.unlocks || []).includes(cu.id);
    const div = document.createElement("div");
    div.style.cssText = "margin-bottom:8px;padding:10px;background:#0d1117;border-left:3px solid #89e894;border-radius:4px";
    if (unlocked) {
      div.innerHTML = `<b style="color:#89e894">${cu.name}</b> <span style="color:#667788">[已解锁]</span><br><span style="color:#8899bb;font-size:12px">${cu.desc}</span>`;
    } else {
      div.innerHTML = `<b style="color:#89e894">${cu.name}</b> <span style="color:#ffa502">🔒</span><br>` +
        `<span style="color:#8899bb;font-size:12px">${cu.desc} 消耗: ${cu.cost}魂晶</span><br>` +
        `<button class="modal-btn" style="margin-top:4px;font-size:12px" ${meta.souls<cu.cost?'disabled':''}>解锁</button>`;
      div.querySelector("button").onclick = () => {
        if (meta.souls < cu.cost) return;
        meta.souls -= cu.cost;
        if (!meta.unlocks) meta.unlocks = ["warrior", "mage", "shadow"];
        meta.unlocks.push(cu.id);
        Game.saveMeta();
        buildMetaPanel(id2 => showMetaPanel());
        showModal("meta-panel");
        toast(`🎭 ${cu.name} 已解锁！`);
      };
    }
    content.appendChild(div);
  });

  // 魂晶商店分隔
  const divider = document.createElement("div");
  divider.style.cssText = "margin:16px 0 10px;padding:6px;background:#1a1020;border-radius:6px;text-align:center;color:#c8a8ff;font-size:13px;font-weight:bold";
  divider.textContent = "💎 魂晶兑换";
  content.appendChild(divider);

  // 魂晶升级项
  const soulItems = [
    { id: "soulStartGold", name: "初始金币 +30", cost: 5, desc: "每局开局额外获得30金币", max: 3, apply: (s) => { s.gold += 30; } },
    { id: "soulStartHp", name: "生命祝福", cost: 8, desc: "每局开局生命上限+10", max: 3, apply: (s) => { s.player.maxHp += 10; s.player.hp += 10; } },
    { id: "soulStartAtk", name: "攻击祝福", cost: 8, desc: "每局开局攻击力+3", max: 3, apply: (s) => { s.player.atk += 3; } },
    { id: "soulStartPotion", name: "额外药水", cost: 10, desc: "每局开局多携带1瓶药水", max: 2, apply: (s) => { const pots = Game.getStartPotions(); s.potions.push(...pots.slice(0, 1)); } },
    { id: "soulStartRelic", name: "远古遗物", cost: 20, desc: "开局随机获得1个普通遗物", max: 1, apply: (s) => { const commons = (R.get('relics') || []).filter(r => r.rarity === 'common'); if (commons.length) { const r = { ...s.rng.pick(commons) }; if (r.passive) { r.passive(s.player); r.applied = true; } s.relics.push(r); } } },
  ];

  soulItems.forEach(item => {
    const cur = meta.soulUpgrades ? (meta.soulUpgrades[item.id] || 0) : 0;
    const div = document.createElement("div");
    div.style.cssText = "margin-bottom:8px;padding:10px;background:#0d1117;border-left:3px solid #c8a8ff;border-radius:4px";
    div.innerHTML = `<b style="color:#c8a8ff">${item.name}</b> <span style="color:#ffa502">${cur}/${item.max}</span><br>` +
      `<span style="color:#8899bb;font-size:12px">${item.desc} 消耗: ${item.cost}魂晶</span><br>` +
      `<button class="modal-btn" style="margin-top:4px;font-size:12px" ${meta.souls<item.cost||cur>=item.max?'disabled':''}>兑换</button>`;
    div.querySelector("button").onclick = () => {
      if (meta.souls < item.cost || cur >= item.max) return;
      meta.souls -= item.cost;
      if (!meta.soulUpgrades) meta.soulUpgrades = {};
      meta.soulUpgrades[item.id] = cur + 1;
      Game.saveMeta();
      buildMetaPanel(onUpgrade);
      showModal("meta-panel");
    };
    content.appendChild(div);
  });
}

function startNewGame() {
  const inputEl = document.getElementById("seed-input");
  const input = inputEl ? inputEl.value.trim() : "";
  Game.hardReset();
  const s = Game.state;
  s.seed = input || ("" + Date.now());
  s.rng = new RNG(s.seed);

  // 难度+职业同屏选择
  let pickedDiff = null;
  buildDifficultySelect(diff => {
    pickedDiff = diff;
    s.difficulty = diff.id;
    // 运势和遗产延后到pickClass中(player创建后)应用
    s._pendingFortune = getDailyFortune();
    Game.saveMeta();
    // 高亮已选难度
    document.querySelectorAll("#diff-grid .card").forEach(c => c.style.opacity = "0.5");
    const sel = document.querySelector(`#diff-grid .card[data-diff="${diff.id}"]`);
    if (sel) { sel.style.opacity = "1"; sel.style.borderColor = "#ffa502"; }
  });
  buildClassSelect(cls => {
    if (!pickedDiff) { toast("请先选择难度"); return; }
    pickClass(cls);
  });
  switchScreen("difficulty-select");
}

function pickClass(cls) {
  console.log("[妖塔] pickClass:", cls.name);
  const s = Game.state;
  s.playerClass = cls;
  s.player = {
    hp: cls.hp, maxHp: cls.maxHp, mp: cls.maxMp, maxMp: cls.maxMp,
    atk: cls.atk, def: cls.def, critRate: cls.critRate, critMul: cls.critMul,
    skillMul: cls.skillMul, mpCost: cls.mpCost, pen: cls.pen,
    lifeSteal: cls.lifesteal || 0, thorn: 0, goldMul: 1, dodge: cls.dodge || 0, bleed: 0,
    rage: false, doubleFirst: false, debuffAtk: null, dmgReduce: 0,
    berserk: false, rebirth: false, regen: 0
  };
  // 影卫被动：击杀回复20%生命
  if (cls.id === "shadow") s.player._shadowBorn = true;
  Game.applyMetaBonus(s.player);
  // 开局药水（修复 startPotion 陷阱）
  const startPots = Game.getStartPotions();
  s.potions.push(...startPots);
  // 应用魂晶升级
  applySoulUpgrades(s);

  // 应用运势和遗产（player已创建）
  if (s._pendingFortune) { s._pendingFortune.apply(s); s._fortuneName = s._pendingFortune.name; if (s._pendingFortune.mutation) { s._pendingFortune.mutation.apply(s); s._mutationName = s._pendingFortune.mutation.name; } s._pendingFortune = null; }
  applyLegacy(s);

  // 开局选1个本命技能
  buildSkillSelect(cls, function(sk) {
    s.activeSkills = [{ ...sk }];
    s.activeSkill = s.activeSkills[0];
    s.skillLevels = {};
    s.skillLevels[sk.id] = 1;
    // 开局变数三选一
    buildStartBonus(function() {
      if (!s.noTalent) {
        buildTalentSelect(function(tal) {
          s.talent = tal;
          tal.apply(s.player);
          initZone("plains");
        });
        switchScreen("talent-select");
      } else {
        initZone("plains");
      }
    });
    switchScreen("talent-select"); // 复用天赋选择屏幕
  });
  switchScreen("skill-select");
}

function initZone(zoneId) {
  console.log("[妖塔] initZone zoneId=", zoneId);
  Room.initZone(zoneId);
  enterRoom();
}

// ---- 进入房间：默认直入，偶尔出现岔路 ----
// 暖场3间不出岔路，之后战斗有30%概率出岔路；特殊房间直接入
function enterRoom() {
  const s = Game.state;
  Room.prepareRoomEntry();

  const roomType = Room.drawOne();
  console.log("[妖塔] drawOne:", roomType, "pool剩余:", s._roomPool.length);

  // 无尽深渊：池空→下一张无尽图
  if (!roomType && s.endless) {
    s.endlessFloor++;
    if (s.endlessFloor % 10 === 0) { showChaosModifier(); return; }
    initEndlessZone();
    return;
  }

  // Zone 结束 → 分支或通关
  if (!roomType) {
    if (Room.isFinalZone(s.zone.id)) { gameClear(); return; }
    const route = R.get("simpleRoute");
    const nextChoices = Room.getZoneChoices(s.zone.id);
    if (nextChoices.length > 1) {
      buildZoneSelect(nextChoices, z => initZone(z.id));
      switchScreen("zone-select");
    } else if (nextChoices.length === 1) {
      initZone(nextChoices[0]);
    }
    return;
  }

  hideAllModals();

  // Boss 直接进场
  if (roomType === "boss") { processRoom("boss"); return; }

  // 特殊房间直接进（本身就是事件/选择）
  const directTypes = ["shop", "event", "shrine", "altar", "chest", "elite"];
  if (directTypes.includes(roomType)) { processRoom(roomType); return; }

  // 战斗房间：暖场3间不出岔路，之后 ~40% 概率出现分岔
  const isWarmup = s.floorInZone <= 3;
  const forkChance = 0.40;
  if (!isWarmup && s.rng.chance(forkChance) && s._roomPool.length > 0) {
    const other = Room.tryDrawDifferent(roomType);
    if (other) {
      // 30%概率生成风险门(奖励翻倍但敌人多一词条)
      var riskDoor = s.rng.chance(0.30);
      console.log("[妖塔] 岔路:", roomType, "vs", other, riskDoor ? "(风险门!)" : "");
      const rs = document.getElementById('room-select');
      if (rs) { rs.style.backgroundImage = `url('img/bg-battle-${s.zone.id}.jpg?v=033')`; }
      showRoomFork(roomType, other, riskDoor);
      return;
    }
  }

  // 默认：直接进入战斗
  processRoom(roomType);
}

// ---- 展示双门分岔路 ----
function showRoomFork(typeA, typeB, riskDoor) {
  const s = Game.state;
  const rtA = R.get('roomTypes', typeA) || R.get('roomTypes', 'battle');
  const rtB = R.get('roomTypes', typeB) || R.get('roomTypes', 'battle');

  document.getElementById("room-info").textContent = `第 ${s.totalFloor} 层 · ${s.zone.name}`;

  const left = document.getElementById("fork-left");
  const right = document.getElementById("fork-right");
  const vs = document.querySelector(".fork-vs");
  const btn = document.getElementById("btn-enter-room");

  if (left) {
    left.style.display = ""; left.dataset.type = typeA;
    left.querySelector(".door-icon").textContent = rtA.icon;
    left.querySelector(".door-name").textContent = rtA.name;
    left.querySelector(".door-hint").textContent = getRoomHint(typeA);
    if (riskDoor) {
      left.classList.add("fork-risk");
      left.querySelector(".door-name").textContent = '🩸 ' + rtA.name;
      left.querySelector(".door-hint").textContent = '⚠️ 敌人+1词条 · 奖励×2';
    } else { left.classList.remove("fork-risk"); }
    left.onclick = () => { s._riskRoom = riskDoor; const other = typeB; Room.returnRoom(other); processRoom(typeA); };
  }
  if (right) {
    right.style.display = ""; right.dataset.type = typeB;
    right.querySelector(".door-icon").textContent = rtB.icon;
    right.querySelector(".door-name").textContent = rtB.name;
    right.querySelector(".door-hint").textContent = getRoomHint(typeB);
    right.classList.remove("fork-risk");
    right.onclick = () => { s._riskRoom = false; const other = typeA; Room.returnRoom(other); processRoom(typeB); };
  }
  if (vs) vs.style.display = "";
  if (btn) btn.style.display = "none";

  switchScreen("room-select");
}

// 房间类型提示文字
function getRoomHint(type) {
  const hints = {
    battle: "普通怪物 · 稳定奖励",
    elite: "⚠️ 强敌 · 双倍掉落",
    shop: "消费金币 · 购买道具",
    chest: "免费开启 · 随机惊喜",
    shrine: "献祭金币 · 换取祝福",
    altar: "承受诅咒 · 换取遗物",
    event: "随机遭遇 · 祸福难料",
    boss: "💀 关底首领 · 遗物奖励"
  };
  return hints[type] || "未知";
}

function updateBattleBg() {
  const s = Game.state;
  const zoneId = s.zone ? s.zone.id : 'plains';
  const main = document.getElementById('main');
  if (main) main.style.backgroundImage = `url('img/bg-battle-${zoneId}.jpg?v=033')`;
}

// 房间预告卡
function showRoomPreview(roomId, callback) {
  var rt = R.get('roomTypes', roomId) || R.get('roomTypes', 'battle');
  var preview = document.getElementById("room-preview");
  document.getElementById("room-preview-icon").textContent = rt.icon || "🚪";
  document.getElementById("room-preview-name").textContent = rt.name || "未知";
  preview.classList.add("show");
  setTimeout(function() {
    preview.classList.remove("show");
    if (callback) callback();
  }, 500);
}

function processRoom(roomId) {
  // 隐藏分岔路界面，防止门和弹窗重叠可点击
  const rs = document.getElementById('room-select');
  if (rs) rs.classList.add('hidden');

  showRoomPreview(roomId, function() {
    try {
      Game.state._currentRoomType = roomId;
      if (roomId === "shop") { openShop(); }
      else if (roomId === "event" || roomId === "shrine" || roomId === "altar") { openEvent(roomId); }
      else if (roomId === "chest") { openChest(); }
      else if (roomId === "boss") { updateBattleBg(); Combat.startBattle("boss"); switchScreen("main"); }
      else if (roomId === "elite") { updateBattleBg(); Combat.startBattle("elite"); switchScreen("main"); }
      else { updateBattleBg(); Combat.startBattle("normal"); switchScreen("main"); }
    } catch(e) {
      console.error("[妖塔] processRoom 崩溃:", e);
      toast("出错了，请刷新页面。错误已记录到控制台");
      Game.sync();
    }
  });
}

function nextRoom() {
  const s = Game.state;
  if (Room.isZoneEnd()) {
    if (Room.isFinalZone(s.zone.id)) { gameClear(); return; }
    const route = R.get("simpleRoute");
    const nextChoices = Room.getZoneChoices(s.zone.id);
    if (nextChoices.length > 1) {
      showModal("endless-choice");
      document.getElementById("btn-next-zone").onclick = () => { hideModal("endless-choice"); Room.advanceFloor(); buildZoneSelect(nextChoices, z => initZone(z.id)); switchScreen("zone-select"); };
      document.getElementById("btn-end-run").onclick = () => { hideModal("endless-choice"); Room.advanceFloor(); gameClear(); };
    } else if (nextChoices.length === 1) {
      Room.advanceFloor();
      initZone(nextChoices[0]);
    }
  } else {
    Room.advanceFloor();
    trackQuest('floor', Game.state.totalFloor);
    Game.sync(); enterRoom();
  }
}

// ===================== 战斗回调 =====================
function unlockAchievement(id) { Game.unlockAchievement(id); }

function onWin(isFast) {
  const s = Game.state;
  const roomType = s._currentRoomType;
  // 心魔镜像战：胜利给传说遗物
  if (s._mirrorFight) {
    s._mirrorFight = false;
    const legendary = (R.get('relics') || []).filter(r => r.rarity === "legendary");
    if (legendary.length > 0) {
      const r = s.rng.pick(legendary);
      Shop.acquireRelic({ ...r });
      log(`<span class='win'>🪞 击败心魔！获得传说遗物：${r.name}！</span>`);
    }
    showReward(isFast, eq => takeEquip(eq), attr => takeAttrReward(attr, isFast, false), false);
    showModal("reward");
    return;
  }
  // 困兽斗场：胜利给对应奖励
  if (s._arenaReward) {
    s._arenaReward();
    s._arenaReward = null;
    log("<span class='win'>🏟️ 困兽斗胜利！</span>");
    showReward(isFast, eq => takeEquip(eq), attr => takeAttrReward(attr, isFast, false), false);
    showModal("reward");
    return;
  }
  if (roomType === "boss") {
    s.gold += 50 + s.totalFloor;
    // Boss专属遗物（首次击败掉落）
    var zoneId = s.zone ? s.zone.id : null;
    if (zoneId && !Game.meta.bossRelicsFound) Game.meta.bossRelicsFound = [];
    var bossRelicId = 'boss_' + zoneId;
    if (zoneId && !Game.meta.bossRelicsFound.includes(bossRelicId)) {
      Game.meta.bossRelicsFound.push(bossRelicId);
      Game.saveMeta();
      var bossRelic = getBossRelic(zoneId);
      if (bossRelic) {
        Shop.acquireRelic(bossRelic);
        log('<span class="win">👑 首次击败！获得Boss专属遗物：' + bossRelic.name + '！</span>');
        toast('👑 Boss专属遗物：' + bossRelic.name);
      }
    }
    // Boss材料掉落（局内）
    const bossMat = zoneId ? (R.get('bossMaterials') || {})[zoneId] : null;
    if (!s.forgeMats) s.forgeMats = {};
    if (bossMat && s.rng.chance(bossMat.dropRate)) {
      s.forgeMats[bossMat.id] = (s.forgeMats[bossMat.id] || 0) + 1;
      log(`<span class="win">💎 Boss掉落材料：${bossMat.name}！</span>`);
      toast(`💎 获得材料：${bossMat.name}！`);
    }
    const extras = R.get('extraMaterials') || [];
    extras.forEach(ex => {
      if (ex.dropFromZones.includes(zoneId) && s.rng.chance(ex.dropRate)) {
        s.forgeMats[ex.id] = (s.forgeMats[ex.id] || 0) + 1;
        log(`<span class="win">🔥 稀有材料：${ex.name}！</span>`);
      }
    });
    // 悬赏官猎杀令
    var bounty = Game.meta.activeBounty;
    if (bounty) {
      var bossName = s.enemy ? s.enemy.name : '';
      if (bossName.indexOf(bounty.boss) >= 0) {
        Game.meta.souls += bounty.reward;
        log('<span class="win">🎯 猎杀令完成！+' + bounty.reward + '魂晶</span>');
        toast('🎯 猎杀令完成！+' + bounty.reward + '魂晶');
        Game.meta.activeBounty = null;
        Game.saveMeta();
      }
    }
    // 技能升级（先于遗物选择）
    showSkillUpgrade(function() { showBossRelicPick(isFast); });
  } else if (roomType === "elite") {
    s.gold += 30;
    showReward(isFast, eq => takeEquip(eq), attr => takeAttrReward(attr, isFast, false), true);
  } else {
    // 矿洞环境：金币+50%
    const goldMul = s._zoneMod?.id === "cave_gold" ? 1.5 : 1;
    const baseGold = s.rng.range(8, 15);
    var extraGold = s.player && s.player._luckyCharm ? 15 : 0;
    s.gold += Math.floor(baseGold * goldMul * (s._riskReward ? 2 : 1)) + extraGold;
    showReward(isFast, eq => takeEquip(eq), attr => takeAttrReward(attr, isFast, false), s._riskReward || false);
  }
  showModal("reward");
}

function onGameOver() {
  const s = Game.state;
  Game.meta.totalDeaths++;
  // 无尽最高记录
  if (s.endless && s.endlessFloor > (Game.meta.highestEndless||0)) {
    Game.meta.highestEndless = s.endlessFloor;
    document.getElementById("end-score").innerHTML += '<br><span style="color:#ffa502">🌀无尽最高:' + s.endlessFloor + '层</span>';
  }
  // 战斗记录
  saveRunHistory(false);
  var legacy = saveLegacy();
  if (legacy) log('<span class="info">📦 遗产仓库：' + (legacy.data.name || '物品') + '已保存，下局可用</span>');
  const tp = Prog.calcTP(s.totalFloor, false);
  const souls = Math.floor(s.totalFloor / 5); // 死亡: 每5层1魂晶
  if (tp > 0) { Game.addTP(Math.floor(tp * Prog.getAdTPBonus())); }
  if (souls > 0) { Game.meta.souls += souls; }
  Game.addLeaderboard({ char: s.playerClass ? s.playerClass.name : "--", diff: s.difficulty, floor: s.totalFloor });
  Prog.awardCharExp(s);
  Game.saveMeta();
  const rewards = [tp > 0 ? `${tp} 天赋点` : '', souls > 0 ? `${souls} 魂晶` : ''].filter(Boolean).join(' + ');
  showGameOver(false, rewards || "无奖励");
}

// ===================== 结局系统 =====================
var ENDINGS = {
  casual: {
    icon: "🏰", title: "守门人陨落",
    lines: ["你击败了魔塔的守门人。","大门在你面前缓缓开启——","但门后，是无尽的黑暗与更深的回廊。","魔塔的秘密远不止于此……","—— 这只是开始。","（在普通难度下继续探索真正的魔塔）"],
    cls: "ending-casual"
  },
  standard: {
    icon: "⚔️", title: "将军之殇",
    lines: ["魔塔将军倒下了。","他的铠甲化为齑粉，魔气四散。","然而，塔顶传来令人战栗的狂笑——","那是魔王的声音。","魔塔的真正主人，仍在最高处等待。","—— 你以为的终点，只是起点。","（在炼狱难度下挑战魔王·终焉）"],
    cls: "ending-standard"
  },
  hell: {
    icon: "👑", title: "终焉之陨",
    lines: ["魔王发出最后的嘶吼……","黑暗从魔塔中褪去。","边境城池迎来了久违的黎明。","勇士，你的名字将被刻入史册。","—— 妖塔 · 终章 ——","感谢游玩。"],
    cls: "ending-hell"
  }
};

function showEnding(onDone) {
  var s = Game.state;
  var diff = s.difficulty || 'standard';
  var ending = ENDINGS[diff] || ENDINGS.standard;
  var el = document.getElementById("ending-screen");
  el.className = ending.cls;
  el.style.display = "flex";
  document.getElementById("ending-icon").textContent = ending.icon;
  document.getElementById("ending-title").textContent = ending.title;
  var txt = document.getElementById("ending-text");
  txt.innerHTML = "";
  // 打字机：逐行显示（全部在同一卡片内）
  var li = 0, ci = 0;
  function typeLine() {
    if (li >= ending.lines.length) return;
    if (ci === 0) { var d = document.createElement("div"); d.id = "end-line-" + li; txt.appendChild(d); }
    var lineEl = document.getElementById("end-line-" + li);
    if (ci < ending.lines[li].length) {
      lineEl.textContent = ending.lines[li].substring(0, ci + 1);
      ci++;
      setTimeout(typeLine, 50 + Math.random() * 30);
    } else {
      ci = 0; li++;
      setTimeout(typeLine, 300);
    }
  }
  setTimeout(typeLine, 400);

  // 点击跳过→直接显示全部→0.8s后调用回调
  var done = false;
  el.onclick = function() {
    if (done) return; done = true;
    txt.innerHTML = ending.lines.map(function(l) { return "<div>" + l + "</div>"; }).join("");
    setTimeout(function() { el.style.display = "none"; if (onDone) onDone(); }, 800);
  };
}

function gameClear() {
  const s = Game.state;
  // 炼狱塔上层通关后→无尽深渊选择
  if (s.zone && s.zone.id === 'tower_upper' && !s.endless) {
    showEndlessChoice();
    return;
  }
  // 显示结局→结算
  showEnding(function() {
    doGameClear();
  });
}

function showEndlessChoice() {
  var el = document.getElementById("endless-choice");
  el.style.display = "block";
  document.getElementById("btn-next-zone").textContent = "🌀 进入无尽深渊";
  document.getElementById("btn-next-zone").onclick = function() {
    el.style.display = "none";
    Game.state.endless = true;
    Game.state.endlessFloor = 0;
    Game.state.zoneIndex = 99;
    initEndlessZone();
  };
  document.getElementById("btn-end-run").textContent = "🏠 见好就收（结算）";
  document.getElementById("btn-end-run").onclick = function() {
    el.style.display = "none";
    showEnding(function() { doGameClear(); });
  };
}

// ===================== 无尽深渊混沌词条 =====================
var CHAOS_MODS = [
  { name: "敌人狂暴", desc: "所有敌人攻击+30%", apply: function(s) { s.enemyAtkMul = (s.enemyAtkMul||1) * 1.3; } },
  { name: "敌人血牛", desc: "所有敌人血量+40%", apply: function(s) { s.enemyHpMul = (s.enemyHpMul||1) * 1.4; } },
  { name: "诅咒缠身", desc: "开局获得1个随机诅咒", apply: function(s) { var curse = s.rng.pick(R.get('curses')||[]); if(curse){s.curses.push(curse);curse.apply(s.player);} } },
  { name: "灵力压制", desc: "技能CD+1回合", apply: function(s) { s.activeSkills.forEach(function(sk){sk.cooldown++;}); } },
  { name: "生命透支", desc: "每回合扣3%生命，但攻击+25%", apply: function(s) { s.player.atk = Math.floor(s.player.atk*1.25); s._chaosDrain = true; } },
  { name: "暴击失控", desc: "双方暴击率+30%", apply: function(s) { s.player.critRate += 0.3; s._chaosCrit = true; } },
  { name: "技能狂欢", desc: "所有技能CD-1，但敌人+1只", apply: function(s) { s.activeSkills.forEach(function(sk){if(sk.cooldown>1)sk.cooldown--;}); s._chaosExtraEnemy = true; } },
  { name: "财富诅咒", desc: "金币翻倍，但商店价格×3", apply: function(s) { s.player.goldMul = (s.player.goldMul||1)*2; s._chaosPrice = true; } },
];

function showChaosModifier() {
  var s = Game.state;
  var el = document.getElementById("reward");
  el.style.display = "block";
  var list = document.getElementById("reward-list");
  list.innerHTML = "";
  var hdr = document.createElement("div");
  hdr.style.cssText = "color:#ff4444;font-size:16px;font-weight:bold;margin-bottom:8px;text-align:center;grid-column:1/-1";
  hdr.textContent = "🌀 混沌降临 · 第" + s.endlessFloor + "层";
  list.appendChild(hdr);
  list.style.display = "grid"; list.style.gridTemplateColumns = "1fr 1fr"; list.style.gap = "8px";

  var picks = s.rng.pickMulti(CHAOS_MODS, 3);
  picks.forEach(function(mod) {
    var card = document.createElement("div");
    card.style.cssText = "background:#1a0a0a;border:2px solid #8b0000;border-radius:10px;padding:14px;text-align:center;cursor:pointer;transition:all .15s";
    card.innerHTML = "<div style=\"font-size:28px;margin-bottom:6px\">🌀</div><div style=\"color:#ff7b7b;font-weight:bold;font-size:14px\">" + mod.name + "</div><div style=\"color:#8899bb;font-size:11px\">" + mod.desc + "</div>";
    card.onmouseenter = function(){this.style.borderColor="#ff4444";this.style.transform="scale(1.04)";};
    card.onmouseleave = function(){this.style.borderColor="#8b0000";this.style.transform="scale(1)";};
    card.onclick = function() {
      mod.apply(s);
      log("<span class='warn'>🌀 混沌词条：" + mod.name + "</span>");
      el.style.display = "none";
      initEndlessZone();
    };
    list.appendChild(card);
  });
  showModal("reward");
}

// ===================== 离线小屋 =====================
function showHunterLodge() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block"; el.querySelector("h3").textContent = "🏚️ 猎人小屋";
  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var meta = Game.meta;

  var lastLogin = meta.lastLogin || '';
  var now = new Date();
  var offlineMs = 0;
  if (lastLogin) {
    var last = new Date(lastLogin);
    if (!isNaN(last.getTime())) offlineMs = Math.max(0, now.getTime() - last.getTime());
  }
  var offlineHours = Math.floor(offlineMs / 3600000);
  // 衰减：前1小时100%，第2小时80%，之后每小时间50%
  var decayedHours = offlineHours <= 1 ? offlineHours : (1 + (offlineHours - 1) * 0.5);
  var offlineStones = Math.min(50, Math.floor(decayedHours * 3));
  var offlineSouls = Math.min(20, Math.floor(decayedHours * 1));

  var info = document.createElement("div");
  info.style.cssText = "text-align:center;padding:12px;margin-bottom:10px;background:#1a1520;border-radius:8px";
  info.innerHTML = '<div style="font-size:40px;margin-bottom:8px">🏚️</div>' +
    '<div style="color:#8899bb;font-size:12px">离线时长：' + offlineHours + '小时</div>' +
    '<div style="color:#ffa502;font-size:13px;margin-top:6px">累计收益：💎' + offlineStones + '灵石 · 💀' + offlineSouls + '魂晶</div>';
  content.appendChild(info);

  if (offlineStones > 0 || offlineSouls > 0) {
    var claimBtn = document.createElement("button");
    claimBtn.className = "modal-btn";
    claimBtn.textContent = "📦 一键领取";
    claimBtn.onclick = function() {
      meta.stones = (meta.stones||0) + offlineStones;
      meta.souls = (meta.souls||0) + offlineSouls;
      meta.lastLogin = now.toISOString();
      Game.saveMeta();
      showHunterLodge();
      toast('📦 领取了' + offlineStones + '灵石 + ' + offlineSouls + '魂晶！');
    };
    content.appendChild(claimBtn);
  }

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
}

function initEndlessZone() {
  var s = Game.state;
  s.zone = { id: "endless", name: "无尽深渊", icon: "🌀", enemyPool: "tower_upper", scale: 1 + s.endlessFloor * 0.02, modifier: { id: "endless", desc: "🌀 无尽深渊第" + s.endlessFloor + "层" } };
  s.floorInZone = 1;
  s._zoneMod = s.zone.modifier;
  // 生成房间：5-6间纯战斗+精英
  var templates = [["battle","battle","elite","battle","battle","battle"]];
  s._roomPool = s.rng.pick(templates).slice();
  s._bossReady = false;
  enterRoom();
}

function doGameClear() {
  const s = Game.state;
  Game.meta.totalWins++;
  saveRunHistory(true);
  // 难度币+灵石：通关奖励
  if (!Game.meta.difficultyCoins) Game.meta.difficultyCoins = 0;
  Game.meta.difficultyCoins++;
  if (!Game.meta.stones) Game.meta.stones = 0;
  Game.meta.stones += 5 + (s.zoneIndex || 0) * 2;
  if (s.mode === "simple" && Game.meta.highestSimple < s.totalFloor) Game.meta.highestSimple = s.totalFloor;
  const tp = Prog.calcTP(s.totalFloor, true);
  const souls = 10 + s.totalFloor;
  Game.addTP(tp);
  Game.meta.souls += souls;
  Game.addLeaderboard({ char: s.playerClass ? s.playerClass.name : "--", diff: s.difficulty, floor: s.totalFloor });
  Prog.awardCharExp(s);
  // 难度递进解锁：通关简单→解锁普通，通关普通→解锁炼狱
  const diff = R.get('difficulties', s.difficulty);
  if (diff && diff.next) {
    if (!Game.meta.unlockedDiffs) Game.meta.unlockedDiffs = ["casual"];
    if (!Game.meta.unlockedDiffs.includes(diff.next)) {
      Game.meta.unlockedDiffs.push(diff.next);
      const nextDiff = R.get('difficulties', diff.next);
      console.log("[妖塔] 解锁新难度:", nextDiff ? nextDiff.name : diff.next);
    }
  }
  Game.saveMeta();
  // 成就：难度通关
  if (s.difficulty === "casual") unlockAchievement("clear_casual");
  if (s.difficulty === "standard") unlockAchievement("clear_standard");
  if (s.difficulty === "hell") unlockAchievement("clear_hell");
  showGameOver(true, `通关奖励：${tp} 天赋点 + ${souls} 魂晶！`);
  Game.deleteSave();
}

// ===================== 装备属性管理 =====================
function applyEquipStats(p, eq) {
  if (eq.stat === "maxHp") { p.maxHp += eq.val; p.hp = Math.min(p.hp + eq.val, p.maxHp); }
  else if (eq.stat === "maxMp") { p.maxMp += eq.val; p.mp = Math.min(p.mp + eq.val, p.maxMp); }
}
function removeEquipStats(p, eq) {
  if (eq.stat === "maxHp") { p.maxHp = Math.max(1, p.maxHp - eq.val); p.hp = Math.min(p.hp, p.maxHp); }
  else if (eq.stat === "maxMp") { p.maxMp = Math.max(1, p.maxMp - eq.val); p.mp = Math.min(p.mp, p.maxMp); }
}

// 全局：添加装备（满时弹出替换选择）
window._addEquip = function(eq) {
  const s = Game.state;
  if (s.equip.length >= 6) {
    showEquipReplace(eq, () => { playSound("equip"); Game.sync(); });
  } else {
    s.equip.push(eq);
    applyEquipStats(s.player, eq);
    playSound("equip");
    log(`${eq.icon} <span style="color:${eq.color}"><b>${eq.fullName||eq.name}</b></span> 已装备！${eq.stat.toUpperCase()}+${eq.val}`, "win");
    trackQuest('equip', 1);
    Game.sync();
  }
};

// 丢弃装备（从装备栏点击触发）
window._discardEquip = function(idx) {
  const s = Game.state;
  if (idx < 0 || idx >= s.equip.length) return;
  const eq = s.equip.splice(idx, 1)[0];
  removeEquipStats(s.player, eq);
  log(`<span class='warn'>已丢弃 ${eq.fullName||eq.name}</span>`);
  Game.sync();
};

// 满装备时弹出替换选择
function showEquipReplace(newEq, onDone, onCancel) {
  const s = Game.state;
  const el = document.getElementById("equip-replace");
  const list = document.getElementById("equip-replace-list");
  el.style.display = "block"; list.innerHTML = "";
  const STAT_LABEL = { atk: '⚔️攻击', def: '🛡️防御', maxHp: '❤️生命', critRate: '💥暴击', maxMp: '🔮灵力' };

  // 显示新装备（点击取消）
  const newBtn = document.createElement("button"); newBtn.className = "modal-btn";
  const fxTag = newEq._combatEffect ? ` · 特效:${newEq._combatEffect.type}` : '';
  newBtn.innerHTML = `🆕 <b style="color:${newEq.color}">${newEq.fullName||newEq.name}</b> — ${STAT_LABEL[newEq.stat]||newEq.stat}+${newEq.val}${fxTag} <span style="color:#89e894">[保留此件·取消]</span>`;
  newBtn.style.borderColor = "#89e894";
  newBtn.onclick = () => { el.style.display = "none"; if (onCancel) onCancel(); }; // 取消，不拿新装备
  list.appendChild(newBtn);

  // 显示旧装备（点击丢弃该件，拿新装备）
  s.equip.forEach((eq, i) => {
    const btn = document.createElement("button"); btn.className = "modal-btn";
    const qTag = eq.qualityName ? `[${eq.qualityName}]` : '';
    const fxTag2 = eq._combatEffect ? ` · 特效:${eq._combatEffect.type}` : '';
    btn.innerHTML = `${eq.icon} <b style="color:${eq.color}">${eq.fullName||eq.name}</b> — ${STAT_LABEL[eq.stat]||eq.stat}+${eq.val}${fxTag2} <span style="color:#ff7b7b;font-size:11px">${qTag}</span>`;
    btn.onclick = () => {
      removeEquipStats(s.player, eq);
      s.equip.splice(i, 1);
      s.equip.push(newEq);
      applyEquipStats(s.player, newEq);
      log(`<span class='warn'>替换装备：${eq.fullName||eq.name} → ${newEq.fullName||newEq.name}</span>`);
      el.style.display = "none";
      if (onDone) onDone();
    };
    list.appendChild(btn);
  });
}

// ===================== 奖励处理 =====================
function takeEquip(eq) {
  const s = Game.state;
  if (s.equip.length >= 6) {
    hideModal("reward");
    showEquipReplace(eq, () => {
      playSound("equip");
      log(`${eq.icon} <span style="color:${eq.color}"><b>${eq.fullName||eq.name}</b></span> 已装备！`, "win");
      nextRoom();
    }, () => {
      // 取消替换：重新显示奖励弹窗
      showModal("reward");
    });
  } else {
    s.equip.push(eq);
    applyEquipStats(s.player, eq);
    playSound("equip");
    log(`${eq.icon} <span style="color:${eq.color}"><b>${eq.fullName||eq.name}</b></span> 已装备！${eq.stat.toUpperCase()}+${eq.val}`, "win");
    hideModal("reward"); nextRoom();
  }
}

function takeAttrReward(type, isFast, isBoss) {
  const s = Game.state, p = s.player;
  switch (type) {
    case "atk": { const v = isBoss ? (isFast ? 15 : 8) : (isFast ? 10 : 5); p.atk += v; log("攻击 +" + v, "win"); Game.sync(); break; }
    case "hp":  { const v = isBoss ? (isFast ? 80 : 40) : (isFast ? 50 : 25); p.maxHp += v; p.hp += v; log("生命上限 +" + v, "heal"); Game.sync(); break; }
    case "mp":  { const v = isBoss ? (isFast ? 30 : 15) : (isFast ? 20 : 10); p.maxMp += v; p.mp += v; log("灵力上限 +" + v, "info"); Game.sync(); break; }
    case "heal": p.hp = p.maxHp; log("生命全满", "heal"); playSound("heal"); Game.sync(); break;
  }
  hideModal("reward"); nextRoom();
}

function takeRelic(r) {
  Shop.acquireRelic(r);
  playSound("relic");
  log(`${r.icon} <b style="color:${RARITY_COLOR[r.rarity]}">${r.name}</b> 已获得！${r.desc}`, "win");
  trackQuest('relic', 1);
  hideModal("reward"); nextRoom();
}

// ===================== 商店 =====================
function openShop() {
  const s = Game.state;
  trackQuest('shop', 1);
  // 遗物：商队令牌（进入商店+15金）
  if (s.player._merchantPass && !s._shopTokenUsed) {
    s.gold += 15; s._shopTokenUsed = true;
    log("<span class='gold'>🎫 商队令牌：进入商店获得15金币！</span>");
  }
  document.getElementById("shop").style.display = "block";
  document.getElementById("shop-gold").textContent = s.gold || 0;
  const list = document.getElementById("shop-list"); list.innerHTML = "";
  const items = Shop.getShopItems();
  var diffCfg = R.get('difficulties', s.difficulty) || {};
  const mul = (s.adDiscount ? 0.5 : 1) * (diffCfg.shopMul || 1);
  const STAT_LABEL = { atk: '⚔️攻击', def: '🛡️防御', maxHp: '❤️生命', critRate: '💥暴击', maxMp: '🔮灵力' };
  items.forEach(it => {
    const finalCost = Math.floor(it.cost * mul);
    const btn = document.createElement("button"); btn.className = "modal-btn";
    let detail = '';
    if (it.type === 'equip' && it.data) {
      const d = it.data;
      detail = `<br><span style="font-size:10px;color:#8899bb">${STAT_LABEL[d.stat]||d.stat}+${d.val} · ${d.qualityName||''}${d._combatEffect ? ' · 特效:'+d._combatEffect.type : ''}</span>`;
    } else if (it.type === 'relic' && it.data) {
      detail = `<br><span style="font-size:10px;color:#c8a8ff">${it.data.desc||''}</span>`;
    } else if (it.type === 'potion') {
      detail = `<br><span style="font-size:10px;color:#70a1ff">${it.name.includes('生命')?'回复50生命':it.name.includes('灵力')?'回复30灵力':'回满生命灵力'}</span>`;
    }
    btn.innerHTML = `${it.icon} ${it.name} — <span style="color:#ffdd77">${finalCost}G</span>${s.adDiscount ? ' <span style="color:#89e894">[5折]</span>' : ''}${detail}`;
    btn.disabled = (s.gold || 0) < finalCost;
    btn.onclick = () => { if (Shop.buyItem({ ...it, cost: it.cost })) { Game.sync(); openShop(); } };
    list.appendChild(btn);
  });
  const canAd = Game.canWatchAd();
  console.log("[妖塔] openShop: canAd=", canAd, "meta.adWatched=", Game.meta?.adWatched, "adDiscount=", s.adDiscount);
  document.getElementById("btn-ad-refresh").disabled = !canAd;
  document.getElementById("btn-ad-refresh").onclick = () => { if (Game.watchAd()) { s.adRefreshCount++; openShop(); } else { toast("今日广告次数已用完"); } };
  document.getElementById("btn-ad-discount").disabled = !canAd || s.adDiscount;
  document.getElementById("btn-ad-discount").onclick = () => { if (Game.watchAd()) { s.adDiscount = true; Game.sync(); openShop(); } else { toast("今日广告次数已用完"); } };
  document.getElementById("btn-close-shop").onclick = () => { hideModal("shop"); nextRoom(); };
}

// ===================== 事件 =====================
function openEvent(roomType) {
  const s = Game.state;
  trackQuest('event', 1);
  let type;
  if (roomType === "event") {
    // 随机事件类型（15种事件池）
    const pool = [
      "shrine", "shrine", "altar", "altar",
      "gamble", "trade", "mystery",
      "memory_merchant", "mirror_fight", "training_stone",
      "beast_arena", "time_rift", "heal_spring",
      "black_market", "wandering_sage", "forge"
    ];
    type = s.rng.pick(pool);
  } else {
    type = roomType;
  }
  const el = document.getElementById("event"); el.style.display = "block";
  const title = document.getElementById("event-title"), desc = document.getElementById("event-desc"), btns = document.getElementById("event-btns");
  btns.innerHTML = "";
  const onClose = () => { hideModal("event"); nextRoom(); };

  if (type === "chest") {
    title.textContent = "📦 尘封宝箱"; desc.textContent = "免费开启，命运自有安排。";
    addEventBtn("开启", () => {
      EventSys.openChest((resultType, data) => {
        if (resultType === 'equip') { playSound("equip"); log("<span class='win'>宝箱开出装备！</span>"); }
        else if (resultType === 'gold') log("<span class='gold'>宝箱开出 30 金币！</span>");
        else { playSound("equip"); log("<span class='win'>宝箱开出遗物！</span>"); }
        Game.sync(); onClose();
      });
    });
  } else if (type === "shrine") {
    title.textContent = "⛩️ 古老神龛"; desc.textContent = "献祭金币，获得祝福。";
    addEventBtn("奉献 30G：永久攻击+3", () => { if (Shop.shrineOffer('atk')) { Game.sync(); onClose(); } else alert("金币不足！"); });
    addEventBtn("奉献 30G：回满生命", () => { if (Shop.shrineOffer('heal')) { Game.sync(); onClose(); } else alert("金币不足！"); });
    addEventBtn("奉献 50G：随机稀有遗物", () => { if (s.gold >= 50) { s.gold -= 50; const r = Loot.genRelic(); Shop.acquireRelic(r); log(`<span class='win'>神龛赐予：${r.name}！</span>`); Game.sync(); onClose(); } else alert("金币不足！"); });
    addEventBtn("离开", onClose);
  } else if (type === "altar") {
    title.textContent = "☠️ 黑暗祭坛"; desc.textContent = "承受诅咒，换取强大力量。";
    const rel = Loot.genRelic(), curse = s.rng.pick(R.get('curses'));
    addEventBtn(`获得 ${rel.name}，承受 ${curse.name}`, () => {
      Shop.acquireRelic(rel);
      s.curses.push(curse); curse.apply(s.player);
      log(`<span class="warn">☠️ 诅咒：${curse.desc}</span>`);
      Game.sync(); onClose();
    });
    // 第二个选项：不同遗物+不同诅咒
    const rel2 = Loot.genRelic(), curse2 = s.rng.pick(R.get('curses'));
    if (rel2.id !== rel.id) {
      addEventBtn(`获得 ${rel2.name}，承受 ${curse2.name}`, () => {
        Shop.acquireRelic(rel2);
        s.curses.push(curse2); curse2.apply(s.player);
        log(`<span class="warn">☠️ 诅咒：${curse2.desc}</span>`);
        Game.sync(); onClose();
      });
    }
    addEventBtn("离开", onClose);
  } else if (type === "gamble") {
    title.textContent = "🎰 赌徒的试炼"; desc.textContent = "命运之轮转动……你敢押注吗？";
    addEventBtn("押 50G：50% 获得稀有遗物", () => {
      if (s.gold < 50) { alert("金币不足！"); return; }
      s.gold -= 50;
      if (s.rng.chance(0.5)) {
        const r = Loot.genRelic(); Shop.acquireRelic(r);
        log(`<span class="win">🎰 命运眷顾！获得 ${r.name}！</span>`);
      } else {
        log("<span class='warn'>🎰 赌输了……金币化为乌有</span>");
      }
      Game.sync(); onClose();
    });
    addEventBtn("押 30% 最大生命：50% 攻击+8", () => {
      const cost = Math.floor(s.player.maxHp * 0.3);
      s.player.hp -= cost;
      if (s.rng.chance(0.5)) {
        s.player.atk += 8;
        log("<span class='win'>🎰 赌赢了！攻击永久+8！</span>");
      } else {
        log(`<span class='warn'>🎰 赌输了……损失 ${cost} 生命</span>`);
      }
      if (s.player.hp <= 0) s.player.hp = 1;
      Game.sync(); onClose();
    });
    addEventBtn("不赌为赢", onClose);
  } else if (type === "trade") {
    title.textContent = "🔮 流浪商人"; desc.textContent = "以物易物，各取所需。";
    const eq = s.equip.length > 0 ? s.rng.pick(s.equip) : null;
    if (eq) {
      addEventBtn(`献祭 ${eq.fullName||eq.name}：攻击+5`, () => {
        const idx = s.equip.indexOf(eq);
        if (idx >= 0) {
          removeEquipStats(s.player, eq);
          s.equip.splice(idx, 1);
        }
        s.player.atk += 5;
        log("<span class='win'>装备已献祭，攻击+5！</span>");
        Game.sync(); onClose();
      });
    }
    addEventBtn("花费 40G：购买随机遗物", () => {
      if (s.gold < 40) { alert("金币不足！"); return; }
      s.gold -= 40;
      const r = Loot.genRelic(); Shop.acquireRelic(r);
      log(`<span class='win'>🔮 获得 ${r.name}！</span>`);
      Game.sync(); onClose();
    });
    addEventBtn("离开", onClose);
  } else if (type === "mystery") {
    title.textContent = "❓ 迷雾中的身影"; desc.textContent = "一个模糊的人影向你伸出手……";
    const outcomes = [
      { text: "接受馈赠", fn: () => {
        if (s.rng.chance(0.6)) {
          const r = Loot.genRelic(); Shop.acquireRelic(r);
          log(`<span class='win'>陌生人的礼物：${r.name}！</span>`);
        } else {
          const dmg = Math.floor(s.player.maxHp * 0.2);
          s.player.hp = Math.max(1, s.player.hp - dmg);
          log(`<span class='warn'>不是馈赠，是陷阱！损失 ${dmg} 生命</span>`);
        }
      }},
      { text: "转身离开", fn: () => { log("你绕过了迷雾……"); } }
    ];
    outcomes.forEach(o => addEventBtn(o.text, () => { o.fn(); Game.sync(); onClose(); }));
  } else if (type === "memory_merchant") {
    // 🧠 记忆商人：牺牲一件遗物换永久属性
    title.textContent = "🧠 记忆商人";
    desc.textContent = "\"给我一件遗物……我赋予你永恒的恩赐。\"";
    if (s.relics.length > 0) {
      const sacrifice = s.rng.pick(s.relics);
      const bonusType = s.rng.pick(["atk", "hp", "crit"]);
      const bonusLabel = bonusType === "atk" ? "攻击+5" : bonusType === "hp" ? "生命上限+30" : "暴击率+10%";
      addEventBtn(`献祭 ${sacrifice.name}：${bonusLabel}`, () => {
        const idx = s.relics.indexOf(sacrifice);
        if (idx >= 0) {
          if (sacrifice.onRemove) sacrifice.onRemove(s.player);
          s.relics.splice(idx, 1);
          Synergy.recheckSynergies(); // 防止联动加成残留
        }
        if (bonusType === "atk") s.player.atk += 5;
        else if (bonusType === "hp") { s.player.maxHp += 30; s.player.hp += 30; }
        else s.player.critRate += 0.10;
        log(`<span class='win'>🧠 ${sacrifice.name}已献祭，${bonusLabel}！</span>`);
        Game.sync(); onClose();
      });
    } else {
      desc.textContent += "\n（你没有遗物可以交易……）";
    }
    addEventBtn("离开", onClose);
  } else if (type === "mirror_fight") {
    // 🪞 心魔镜像：和自身复制体战斗，赢了给传说遗物
    title.textContent = "🪞 心魔镜像";
    desc.textContent = "一面巨大的镜子……你看到了另一个自己。击败她，你将获得传说中的力量。";
    addEventBtn("踏入镜中（挑战自身镜像）", () => {
      hideModal("event");
      // 创建镜像敌人（基于玩家属性）
      const mirror = {
        name: s.playerClass ? s.playerClass.name + "的镜像" : "心魔",
        hp: Math.floor(s.player.maxHp * 0.8), maxHp: Math.floor(s.player.maxHp * 0.8),
        atk: Math.floor(s.player.atk * 0.8), def: Math.max(1, s.player.def),
        tags: [], _buffs: [], aiTurn: 0,
        skill: { name: "镜像斩", desc: "和你的技能相同的招式", fn: (e, p) => { const d = Math.max(1, Math.floor(e.atk * 1.5) - p.def); p.hp -= d; return { dmg: d, msg: '🪞 镜像释放了你的技能！' }; } }
      };
      s.enemy = mirror;
      s._mirrorFight = true; // 必须在startBattle之前设置
      s._currentRoomType = "event";
      updateBattleBg();
      Combat.startBattle("normal");
      switchScreen("main");
    });
    addEventBtn("转身离开", onClose);
  } else if (type === "training_stone") {
    // 📜 修行石碑：花金币买永久属性
    title.textContent = "📜 修行石碑";
    desc.textContent = "石碑上刻着古老的修行功法……";
    addEventBtn("参悟攻击之道（40G：攻击+4）", () => {
      if (s.gold < 40) { alert("金币不足！"); return; }
      s.gold -= 40; s.player.atk += 4;
      log("<span class='win'>📜 攻击+4！</span>");
      Game.sync(); onClose();
    });
    addEventBtn("参悟防御之道（30G：防御+3）", () => {
      if (s.gold < 30) { alert("金币不足！"); return; }
      s.gold -= 30; s.player.def += 3;
      log("<span class='win'>📜 防御+3！</span>");
      Game.sync(); onClose();
    });
    addEventBtn("参悟生命之道（50G：生命上限+35）", () => {
      if (s.gold < 50) { alert("金币不足！"); return; }
      s.gold -= 50; s.player.maxHp += 35; s.player.hp += 35;
      log("<span class='win'>📜 生命上限+35！</span>");
      Game.sync(); onClose();
    });
    addEventBtn("离开", onClose);
  } else if (type === "beast_arena") {
    // 🏟️ 困兽斗：选一个敌人打，不同奖励
    title.textContent = "🏟️ 困兽斗场";
    desc.textContent = "选择你的对手，获胜后获得相应奖励。";
    const beasts = [
      { name: "困兽·蛮牛", hp: 60, atk: 14, def: 2, reward: "攻击+4", fn: () => { s.player.atk += 4; log("<span class='win'>🏟️ 击败蛮牛！攻击+4</span>"); } },
      { name: "困兽·毒蝎", hp: 45, atk: 18, def: 1, reward: "暴击率+8%", fn: () => { s.player.critRate += 0.08; log("<span class='win'>🏟️ 击败毒蝎！暴击率+8%</span>"); } },
      { name: "困兽·巨龟", hp: 90, atk: 10, def: 5, reward: "生命上限+40", fn: () => { s.player.maxHp += 40; s.player.hp += 40; log("<span class='win'>🏟️ 击败巨龟！生命上限+40</span>"); } }
    ];
    beasts.forEach(b => {
      addEventBtn(`${b.name}（奖励：${b.reward}）`, () => {
        hideModal("event");
        s.enemy = { name: b.name, hp: b.hp, maxHp: b.hp, atk: b.atk, def: b.def, tags: [], _buffs: [], aiTurn: 0 };
        s._currentRoomType = "event";
        s._arenaReward = b.fn; // 必须在startBattle之前设置
        updateBattleBg();
        Combat.startBattle("normal");
        switchScreen("main");
      });
    });
    addEventBtn("离开", onClose);
  } else if (type === "time_rift") {
    // ⏳ 时空裂隙：跳过当前房间拿奖励
    title.textContent = "⏳ 时空裂隙";
    desc.textContent = "一道裂缝通向未知……跳进去可以跳过此层直接获得奖励。";
    addEventBtn("跳入裂隙（随机遗物+跳过战斗）", () => {
      const r = Loot.genRelic(); Shop.acquireRelic(r);
      log(`<span class='win'>⏳ 时空裂隙赐予：${r.name}！</span>`);
      Game.sync(); onClose();
    });
    addEventBtn("谨慎离开", onClose);
  } else if (type === "heal_spring") {
    // 💧 治愈之泉
    title.textContent = "💧 治愈之泉";
    desc.textContent = "一汪清泉散发着柔和的光芒……";
    addEventBtn("饮用泉水（回复50%生命）", () => {
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + Math.floor(s.player.maxHp * 0.5));
      log("<span class='heal'>💧 泉水治愈了你</span>");
      Game.sync(); onClose();
    });
    addEventBtn("沐浴泉中（回复100%生命，但随机获得一个诅咒）", () => {
      s.player.hp = s.player.maxHp;
      const curse = s.rng.pick(R.get('curses'));
      s.curses.push(curse); curse.apply(s.player);
      log(`<span class='warn'>💧 泉水中隐藏着诅咒：${curse.desc}</span>`);
      Game.sync(); onClose();
    });
    addEventBtn("离开", onClose);
  } else if (type === "black_market") {
    // 🌑 黑市
    title.textContent = "🌑 黑市商人";
    desc.textContent = "\"生命不值钱……但在这里，它可以买到一切。\"";
    addEventBtn("消耗20%生命：获得随机遗物", () => {
      const cost = Math.floor(s.player.maxHp * 0.2);
      s.player.hp = Math.max(1, s.player.hp - cost);
      const r = Loot.genRelic(); Shop.acquireRelic(r);
      log(`<span class='win'>🌑 黑市交易：${r.name}（消耗${cost}生命）</span>`);
      Game.sync(); onClose();
    });
    addEventBtn("消耗35%生命：攻击+10", () => {
      const cost = Math.floor(s.player.maxHp * 0.35);
      s.player.hp = Math.max(1, s.player.hp - cost);
      s.player.atk += 10;
      log(`<span class='win'>🌑 黑市交易：攻击+10（消耗${cost}生命）</span>`);
      Game.sync(); onClose();
    });
    addEventBtn("不交易", onClose);
  } else if (type === "wandering_sage") {
    // 🧙 云游仙人：猜谜
    title.textContent = "🧙 云游仙人";
    const riddles = [
      { q: "什么东西越分越多？", a: "快乐", hint: "是一种情绪" },
      { q: "什么东西打破了才能用？", a: "蛋", hint: "和早餐有关" },
      { q: "什么东西越洗越脏？", a: "水", hint: "每天都要喝的" }
    ];
    const riddle = s.rng.pick(riddles);
    desc.textContent = `\"回答我的问题，正确则有赏，错误则受罚……\\n${riddle.q}\"`;
    addEventBtn("回答（正确：稀有遗物）", () => {
      const answer = prompt(riddle.q + "\n（提示：" + riddle.hint + "）");
      if (answer && (answer.includes(riddle.a) || riddle.a.includes(answer))) {
        const r = Loot.genRelic(); Shop.acquireRelic(r);
        log(`<span class='win'>🧙 仙人颔首：${r.name}！</span>`);
      } else {
        const curse = s.rng.pick(R.get('curses'));
        s.curses.push(curse); curse.apply(s.player);
        log(`<span class='warn'>🧙 仙人大怒：${curse.desc}</span>`);
      }
      Game.sync(); onClose();
    });
    addEventBtn("不回答（安全离开）", onClose);
  } else if (type === "forge") {
    openForgeStone(onClose);
  }
}

// ===================== 锻造石台（局内装备合成/重铸） =====================
function openForgeStone(onClose) {
  const s = Game.state;
  const title = document.getElementById("event-title");
  const desc = document.getElementById("event-desc");
  const btns = document.getElementById("event-btns");
  title.textContent = "⚒️ 锻造石台";
  btns.innerHTML = "";

  // 材料展示
  const mats = s.forgeMats || {};
  const matEntries = Object.entries(mats).filter(function(e) { return e[1] > 0; });
  let matText = "当前持有材料：";
  if (matEntries.length === 0) {
    matText += " 暂无（击败Boss有概率掉落）";
  } else {
    const bm = R.get('bossMaterials') || {};
    const ex = R.get('extraMaterials') || [];
    matEntries.forEach(function(e) {
      var id = e[0], count = e[1];
      var name = id, icon = "💎";
      Object.values(bm).forEach(function(m) { if (m && m.id === id) { name = m.name; icon = m.icon; } });
      ex.forEach(function(m) { if (m.id === id) { name = m.name; icon = m.icon; } });
      matText += " " + icon + name + "×" + count;
    });
  }
  desc.textContent = matText;

  // 1. 装备合成：2件同品质 → 1件高一级
  addEventBtn("🔨 装备合成（2件同品质 → 高一级品质）", function() {
    if (s.equip.length < 2) { alert("至少需要2件装备！"); return; }
    // 按品质分组
    var groups = {};
    s.equip.forEach(function(eq, i) {
      var q = eq.qualityName || "普通";
      if (!groups[q]) groups[q] = [];
      groups[q].push(i);
    });
    // 找第一组有≥2件的品质
    var found = null;
    ["破旧","普通","精良","稀有","史诗","传说"].forEach(function(q) {
      if (!found && groups[q] && groups[q].length >= 2) found = q;
    });
    if (!found) { alert("没有2件同品质的装备可合成！"); return; }
    var idx2 = groups[found][1];
    var idx1 = groups[found][0];
    // 移除2件旧装备
    var eq1 = s.equip.splice(Math.max(idx1, idx2), 1)[0];
    var eq0 = s.equip.splice(Math.min(idx1, idx2), 1)[0];
    removeEquipStats(s.player, eq0);
    removeEquipStats(s.player, eq1);
    // 生成高一级品质装备
    var qualityOrder = ["破旧","普通","精良","稀有","史诗","传说","神话"];
    var curIdx = qualityOrder.indexOf(found);
    var nextQ = qualityOrder[Math.min(qualityOrder.length - 1, curIdx + 1)];
    var newEq = Loot.genEquip(s.zone ? s.zone.id : null);
    // 设置目标品质
    var qualities = R.get('equipQualities');
    var targetQ = null;
    qualities.forEach(function(q) { if (q.name === nextQ) targetQ = q; });
    if (targetQ) {
      // 基于装备类型基础值重新计算属性
      var equipTypes = R.get('equipTypes');
      var eqType = equipTypes.find(function(t) { return t.type === newEq.type; });
      if (eqType) {
        newEq.val = Math.floor(eqType.base * targetQ.mul);
        if (newEq.prefix) {
          var prefixes = R.get('equipPrefixes');
          var pref = prefixes.find(function(p) { return p.name === newEq.prefix; });
          if (pref && pref.statBonus && pref.statBonus[newEq.stat]) {
            newEq.val += pref.statBonus[newEq.stat];
          }
        }
      }
      newEq.color = targetQ.color;
      newEq.qualityName = targetQ.name;
    }
    s.equip.push(newEq);
    applyEquipStats(s.player, newEq);
    log("<span class='win'>🔨 合成成功！获得 " + newEq.fullName + "（" + nextQ + "）</span>");
    toast("🔨 合成成功：" + newEq.fullName);
    playSound("equip");
    Game.sync();
    hideModal("event"); onClose();
  });

  // 2. 装备重铸：花金币随机刷新前缀
  addEventBtn("🔮 装备重铸（40G - 重铸一件装备的前缀和属性）", function() {
    if (s.gold < 40) { alert("金币不足40！"); return; }
    if (s.equip.length === 0) { alert("没有可重铸的装备！"); return; }
    // 弹出装备选择
    var eqList = s.equip.map(function(eq, i) {
      return { idx: i, name: eq.fullName || eq.name, eq: eq };
    });
    var choice = prompt("选择要重铸的装备（输入编号1-" + eqList.length + "）：\n" + eqList.map(function(e, i) { return (i+1) + ". " + e.name; }).join("\n"));
    var idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= s.equip.length) { alert("无效选择！"); return; }
    s.gold -= 40;
    // 移除旧装备属性
    var oldEq = s.equip[idx];
    removeEquipStats(s.player, oldEq);
    // 生成新装备（同类型同品质，随机前缀）
    var newEq = Loot.genEquip(s.zone ? s.zone.id : null);
    newEq.stat = oldEq.stat;
    newEq.type = oldEq.type;
    newEq.icon = oldEq.icon;
    newEq.name = oldEq.name;
    newEq.fullName = (newEq.prefix ? newEq.prefix + '·' : '') + oldEq.name;
    s.equip[idx] = newEq;
    applyEquipStats(s.player, newEq);
    log("<span class='win'>🔮 重铸完成：" + newEq.fullName + "</span>");
    toast("🔮 重铸完成");
    playSound("equip");
    Game.sync();
    hideModal("event"); onClose();
  });

  // 3. 神话锻造：消耗材料+金币
  var recipes = R.get('forgeRecipes') || [];
  recipes.forEach(function(recipe) {
    var canForge = recipe.materials.every(function(mid) { return (mats[mid] || 0) > 0; }) && s.gold >= recipe.cost;
    var matNames = recipe.materials.map(function(mid) {
      var has = (mats[mid] || 0) > 0;
      var nm = mid; var bm = R.get('bossMaterials') || {}; var ex = R.get('extraMaterials') || [];
      Object.values(bm).forEach(function(m) { if (m && m.id === mid) nm = m.name; });
      ex.forEach(function(m) { if (m.id === mid) nm = m.name; });
      return (has ? "✓" : "✗") + nm;
    }).join(" + ");
    addEventBtn(recipe.icon + " 锻造" + recipe.name + "（" + recipe.cost + "G · " + matNames + "）", function() {
      if (!canForge) { alert("材料或金币不足！"); return; }
      recipe.materials.forEach(function(mid) { mats[mid]--; });
      s.gold -= recipe.cost;
      // 创建神话装备
      var mythic = {
        icon: recipe.icon, name: recipe.name, fullName: recipe.name,
        stat: recipe.stat, val: recipe.val,
        color: "#ff6644", qualityName: "神话", type: "weapon",
        _combatEffect: recipe.combatEffect, _zoneSet: "mythic"
      };
      // 添加bonus属性
      if (recipe.bonus) {
        Object.keys(recipe.bonus).forEach(function(k) {
          if (k === 'atk') s.player.atk += recipe.bonus[k];
          else if (k === 'def') s.player.def += recipe.bonus[k];
          else if (k === 'maxHp') { s.player.maxHp += recipe.bonus[k]; s.player.hp += recipe.bonus[k]; }
          else if (k === 'maxMp') { s.player.maxMp += recipe.bonus[k]; s.player.mp += recipe.bonus[k]; }
          else if (k === 'critRate') s.player.critRate += recipe.bonus[k];
          else if (k === 'pen') s.player.pen = (s.player.pen || 0) + recipe.bonus[k];
          else if (k === 'regen') s.player.regen = (s.player.regen || 0) + recipe.bonus[k];
        });
      }
      window._addEquip(mythic);
      // 记录到展架
      if (!Game.meta.forgedItems) Game.meta.forgedItems = [];
      if (!Game.meta.forgedItems.includes(recipe.id)) {
        Game.meta.forgedItems.push(recipe.id);
        Game.saveMeta();
      }
      log("<span class='win'>⚒️ 锻造神话装备：" + recipe.name + "！</span>");
      toast("⚒️ 锻造成功：" + recipe.name + "！");
      playSound("relic");
      Game.sync();
      hideModal("event"); onClose();
    });
  });

  // 4. 技能合成：两个满级技能 → 终极技
  var skillRecipes = R.get('skillRecipes') || [];
  skillRecipes.forEach(function(recipe) {
    var skills = s.activeSkills || [];
    var hasBoth = recipe.requires.every(function(reqId) {
      return skills.some(function(sk) { return sk.id === reqId && (s.skillLevels[sk.id] || 1) >= 3; });
    });
    var canSynthesize = hasBoth && s.gold >= 100;
    var reqNames = recipe.requires.map(function(id) {
      var found = skills.find(function(sk) { return sk.id === id; });
      var lv = found ? (s.skillLevels[found.id] || 1) : 1;
      return (lv >= 3 ? "✓" : "✗") + (found ? found.name : id) + "(Lv3)";
    }).join(" + ");
    addEventBtn(recipe.icon + " 技能合成：" + recipe.name + "（100G · " + reqNames + "）", function() {
      if (!canSynthesize) { alert("需要两个技能都达到Lv3且金币≥100！"); return; }
      s.gold -= 100;
      // 移除两个原技能
      var toRemove = [];
      recipe.requires.forEach(function(reqId) {
        var idx = skills.findIndex(function(sk) { return sk.id === reqId; });
        if (idx >= 0) toRemove.push(idx);
      });
      toRemove.sort(function(a, b) { return b - a; });
      toRemove.forEach(function(idx) { skills.splice(idx, 1); });
      // 添加合成技能
      var synth = {
        id: recipe.id, name: recipe.name, icon: recipe.icon,
        desc: recipe.desc, mul: recipe.mul, cooldown: recipe.cooldown,
        effect: recipe.effects ? recipe.effects[0] : null
      };
      if (recipe.extraPen) synth.extraPen = recipe.extraPen;
      if (recipe.selfDmg) synth.selfDmg = recipe.selfDmg;
      if (recipe.heal) synth.heal = recipe.heal;
      skills.push(synth);
      s.skillLevels[synth.id] = 3;
      // 应用bonus
      if (recipe.bonus) {
        Object.keys(recipe.bonus).forEach(function(k) {
          if (k === 'atk') s.player.atk += recipe.bonus[k];
          else if (k === 'critRate') s.player.critRate += recipe.bonus[k];
          else if (k === 'critMul') s.player.critMul += recipe.bonus[k];
          else if (k === 'pen') s.player.pen = (s.player.pen || 0) + recipe.bonus[k];
          else if (k === 'maxHp') { s.player.maxHp += recipe.bonus[k]; s.player.hp += recipe.bonus[k]; }
        });
      }
      log("<span class='win'>⚒️ 技能合成：" + recipe.name + "！</span>");
      toast("⚒️ " + recipe.name + "！");
      playSound("relic");
      Game.sync();
      hideModal("event"); onClose();
    });
  });

  addEventBtn("离开锻造台", onClose);
}

// ===================== 技能升级（Boss战后，回调模式） =====================
function showSkillUpgrade(onDone) {
  var s = Game.state;
  var skills = s.activeSkills || [];
  var cls = s.playerClass;
  if (!cls) { if (onDone) onDone(); return; }

  // 创建升级选择弹窗（复用reward弹窗，但回调确保不冲突）
  var el = document.getElementById("reward");
  if (el.style.display === "block") { if (onDone) onDone(); return; }
  var list = document.getElementById("reward-list");
  list.innerHTML = "";
  var hdr = document.createElement("div");
  hdr.style.cssText = "color:#c8a8ff;font-size:14px;margin-bottom:10px;font-weight:bold";
  hdr.textContent = "⬆ Boss击败 · 选择成长方向";
  list.appendChild(hdr);

  var done = false;
  function finish() {
    if (done) return; done = true;
    el.style.display = "none";
    Game.sync();
    if (onDone) setTimeout(onDone, 300);
  }

  // 选项1-3：升级已有技能
  skills.forEach(function(sk, i) {
    var lv = (s.skillLevels && s.skillLevels[sk.id]) || 1;
    if (lv >= 3 || !sk.upgrades || !sk.upgrades[lv - 1]) return;
    var up = sk.upgrades[lv - 1];
    var btn = document.createElement("button");
    btn.className = "modal-btn";
    btn.style.cssText = "text-align:left;padding:10px;margin-bottom:6px;border:2px solid #5a3bab";
    btn.innerHTML = "⬆ " + sk.icon + " 升级<b style=\"color:#c8a8ff\">" + sk.name + "</b> → <b style=\"color:#ffa502\">Lv" + (lv + 1) + " " + up.name + "</b><br>" +
      "<span style=\"color:#8899bb;font-size:11px\">" + up.desc + " CD:" + (up.cd || sk.cooldown) + "回合</span>";
    btn.onclick = function() {
      sk.name = up.name;
      sk.mul = up.mul;
      sk.cooldown = up.cd || sk.cooldown;
      if (up.effect) sk.effect = up.effect;
      Object.keys(up).forEach(function(k) {
        if (k !== 'name' && k !== 'desc' && k !== 'mul' && k !== 'cd' && k !== 'effect') sk[k] = up[k];
      });
      s.skillLevels[sk.id] = lv + 1;
      log("<span class='win'>⬆ " + sk.icon + " " + sk.name + " Lv" + (lv + 1) + "！</span>");
      toast(sk.icon + " " + sk.name + " Lv" + (lv + 1));
      finish();
    };
    list.appendChild(btn);
  });

  // 选项：学习新技能（从职业未拥有的技能中选）
  var ownedIds = skills.map(function(sk) { return sk.id; });
  var available = cls.skills.filter(function(sk) { return !ownedIds.includes(sk.id); });
  if (available.length > 0 && skills.length < 3) {
    var learnBtn = document.createElement("button");
    learnBtn.className = "modal-btn";
    learnBtn.style.cssText = "text-align:left;padding:10px;margin-bottom:6px;border:2px solid #89e894";
    learnBtn.innerHTML = "📖 <b style=\"color:#89e894\">学习新技能</b> <span style=\"color:#8899bb;font-size:11px\">（" + available.length + "个可选）</span>";
    learnBtn.onclick = function() {
      // 显示可选技能的子列表
      list.innerHTML = "";
      var backHdr = document.createElement("div");
      backHdr.style.cssText = "color:#89e894;font-size:14px;margin-bottom:10px;font-weight:bold";
      backHdr.textContent = "📖 选择要学习的技能";
      list.appendChild(backHdr);
      available.forEach(function(nsk) {
        var b = document.createElement("button");
        b.className = "modal-btn";
        b.style.cssText = "text-align:left;padding:10px;margin-bottom:6px;border:2px solid #89e894";
        b.innerHTML = nsk.icon + " <b style=\"color:#89e894\">" + nsk.name + "</b><br>" +
          "<span style=\"color:#8899bb;font-size:11px\">" + nsk.desc + " CD:" + (nsk.cooldown || 2) + "回合</span>";
        b.onclick = function() {
          var newSk = { ...nsk };
          skills.push(newSk);
          s.skillLevels[newSk.id] = 1;
          s.activeSkill = skills[0];
          log("<span class='win'>📖 学会新技能：" + newSk.icon + " " + newSk.name + "！</span>");
          toast("📖 学会：" + newSk.name);
          finish();
        };
        list.appendChild(b);
      });
    };
    list.appendChild(learnBtn);
  }

  // 跳过
  var skipBtn = document.createElement("button");
  skipBtn.className = "modal-btn";
  skipBtn.style.cssText = "background:#1a1a2a;color:#667788";
  skipBtn.textContent = "跳过（+50金币）";
  skipBtn.onclick = function() {
    s.gold += 50;
    log("<span class='gold'>💰 放弃成长，获得50金币</span>");
    finish();
  };
  list.appendChild(skipBtn);

  el.style.display = "block";
}

// 应用魂晶局外升级
function applySoulUpgrades(s) {
  const up = Game.meta.soulUpgrades || {};
  const counts = { soulStartGold: up.soulStartGold || 0, soulStartHp: up.soulStartHp || 0, soulStartAtk: up.soulStartAtk || 0, soulStartPotion: up.soulStartPotion || 0, soulStartRelic: up.soulStartRelic || 0 };
  if (counts.soulStartGold > 0) s.gold += 30 * counts.soulStartGold;
  if (counts.soulStartHp > 0) { const b = 10 * counts.soulStartHp; s.player.maxHp += b; s.player.hp += b; }
  if (counts.soulStartAtk > 0) s.player.atk += 3 * counts.soulStartAtk;
  if (counts.soulStartPotion > 0) {
    const pool = R.get('potions').filter(p => p.id === 'heal' || p.id === 'mp');
    for (let i = 0; i < counts.soulStartPotion; i++) s.potions.push({ ...pool[i % pool.length] });
  }
  if (counts.soulStartRelic > 0) {
    const commons = (R.get('relics') || []).filter(r => r.rarity === 'common');
    if (commons.length) {
      const r = { ...s.rng.pick(commons) };
      if (r.passive) { r.passive(s.player); r.applied = true; }
      s.relics.push(r);
    }
  }
}

function addEventBtn(txt, fn) {
  const b = document.createElement("button"); b.className = "modal-btn"; b.textContent = txt; b.onclick = fn;
  document.getElementById("event-btns").appendChild(b);
}

function openChest() {
  openEvent("chest");
}

// ===================== 继续游戏 =====================
function continueGame() {
  const s = Game.state;
  if (s.player && s.player.hp <= 0) {
    s.gameOver = true; Game.sync(); showGameOver(false, ""); return;
  }
  s.gameOver = false;
  hideAllModals();
  if (s.enemy && s.enemy.hp > 0) { updateBattleBg(); switchScreen("main"); }
  else { enterRoom(); }
  log("<span class='info'>💾 已加载存档，继续冒险...</span>");
  Game.sync();
}

// ===================== 每日挑战 =====================
function showDailyPanel() {
  const d = new Date();
  const today = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const seed = parseInt(today, 10);
  const gMods = R.get('dailyGlobalMods'); const pMods = R.get('dailyPlayerMods'); const eMods = R.get('dailyEnemyMods');
  const g = gMods[seed % 9], p = pMods[Math.floor(seed / 9) % 9], e = eMods[Math.floor(seed / 81) % 9];
  const box = document.getElementById("daily-mods");
  box.innerHTML = `<div style="margin-bottom:8px"><b style="color:#c8a8ff">🌍 全局：</b>${g.name} — ${g.desc}</div>
<div style="margin-bottom:8px"><b style="color:#89e894">👤 角色：</b>${p.name} — ${p.desc}</div>
<div><b style="color:#ff7b7b">👹 怪物：</b>${e.name} — ${e.desc}</div>`;
  document.getElementById("btn-start-daily").onclick = () => {
    Game.hardReset();
    const s = Game.state;
    s.mode = "daily"; s.seed = "daily_" + today; s.rng = new RNG(s.seed);
    s.difficulty = "standard"; s.dailyMods = { globalId: g.id, playerId: p.id, enemyId: e.id };
    hideModal("daily-panel");
    buildClassSelect(cls => {
      s.playerClass = cls;
      s.player = {
        hp: cls.hp, maxHp: cls.maxHp, mp: cls.maxMp, maxMp: cls.maxMp,
        atk: cls.atk, def: cls.def, critRate: cls.critRate, critMul: cls.critMul,
        skillMul: cls.skillMul, mpCost: cls.mpCost, pen: cls.pen,
        lifeSteal: 0, thorn: 0, goldMul: 1, dodge: 0, bleed: 0,
        rage: false, doubleFirst: false, debuffAtk: null, dmgReduce: 0,
        berserk: false, rebirth: false, regen: 0
      };
      Game.applyMetaBonus(s.player);
      applySoulUpgrades(s);
      g.apply(s); p.apply(s); e.apply(s);
      var sk = s.rng.pick(cls.skills);
      s.activeSkills = [{ ...sk }];
      s.activeSkill = s.activeSkills[0];
      s.skillLevels = {};
      s.skillLevels[sk.id] = 1;
      initZone("plains");
    }, "class-grid-daily");
    switchScreen("class-select");
  };
  showModal("daily-panel");
}

// ===================== 任务/悬赏系统 =====================
function initQuests() {
  if (!Game.meta.questProgress) Game.meta.questProgress = {};
  const qp = Game.meta.questProgress;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const weekNum = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 86400000 / 7);
  const weekKey = `${d.getFullYear()}-W${weekNum}`;

  // 每日重置
  if (qp.dailyDate !== today) {
    qp.dailyDate = today;
    qp.daily = {};
    // 随机选3个每日任务
    const pool = R.get('dailyQuests') || [];
    const picks = Game.state.rng ? Game.state.rng.pickMulti(pool, 3) : pool.slice(0, 3);
    qp.dailyPicks = picks.map(q => q.id);
    picks.forEach(q => { qp.daily[q.id] = 0; });
    qp.dailyCompleted = {};
  }

  // 每周重置
  if (qp.weeklyDate !== weekKey) {
    qp.weeklyDate = weekKey;
    qp.weekly = {};
    const wPool = R.get('weeklyQuests') || [];
    const wPicks = wPool.slice(0, 3);
    qp.weeklyPicks = wPicks.map(q => q.id);
    wPicks.forEach(q => { qp.weekly[q.id] = 0; });
    qp.weeklyCompleted = {};
  }

  Game.saveMeta();
}

// 追踪任务进度
function trackQuest(type, val = 1) {
  initQuests();
  const qp = Game.meta.questProgress;
  const dailyQuests = R.get('dailyQuests') || [];
  const weeklyQuests = R.get('weeklyQuests') || [];

  // 每日任务
  if (qp.daily) {
    for (const q of dailyQuests) {
      const id = q.id;
      if (qp.daily[id] === undefined || qp.dailyCompleted[id]) continue;
      switch (type) {
        case 'kill': if (id.includes('kill')) qp.daily[id] += val; break;
        case 'boss': if (id.includes('boss')) qp.daily[id] += val; break;
        case 'gold': if (id.includes('gold')) qp.daily[id] += val; break;
        case 'floor': if (id.includes('floor')) qp.daily[id] = Math.max(qp.daily[id], val); break;
        case 'elite': if (id.includes('elite')) qp.daily[id] += val; break;
        case 'shop': if (id.includes('shop')) qp.daily[id] += val; break;
        case 'crit': if (id.includes('crit')) qp.daily[id] += val; break;
        case 'potion': if (id.includes('potion')) qp.daily[id] += val; break;
        case 'relic': if (id.includes('relic')) qp.daily[id] += val; break;
        case 'equip': if (id.includes('equip')) qp.daily[id] += val; break;
        case 'curse': if (id.includes('curse')) qp.daily[id] += val; break;
        case 'event': if (id.includes('event')) qp.daily[id] += val; break;
      }
      if (qp.daily[id] >= q.target) {
        qp.dailyCompleted[id] = true;
        const r = q.reward;
        Game.meta.tp += (r.tp || 0); Game.meta.souls += (r.souls || 0);
        toast(`✅ 每日任务完成：${q.name}！+${r.tp||0}TP +${r.souls||0}魂晶`);
      }
    }
  }
  // 每周任务同理
  if (qp.weekly) {
    for (const q of weeklyQuests) {
      const id = q.id;
      if (qp.weekly[id] === undefined || qp.weeklyCompleted[id]) continue;
      if (type === 'kill' && id.includes('kill')) qp.weekly[id] += val;
      else if (type === 'boss' && id.includes('boss')) qp.weekly[id] += val;
      else if (type === 'floor' && id.includes('floor')) qp.weekly[id] = Math.max(qp.weekly[id], val);
      else if (type === 'clear' && id.includes('clear')) qp.weekly[id] += val;
      else if (type === 'class' && id.includes('class')) { /* 单独处理 */ }
      if (qp.weekly[id] >= q.target) {
        qp.weeklyCompleted[id] = true;
        const r = q.reward;
        Game.meta.tp += (r.tp || 0); Game.meta.souls += (r.souls || 0);
        toast(`🌟 每周挑战完成：${q.name}！+${r.tp||0}TP +${r.souls||0}魂晶`);
      }
    }
  }
  Game.saveMeta();
}

// 显示悬赏板（每日挑战 + 每日任务 + 每周挑战）
function showQuestBoard() {
  initQuests();
  const qp = Game.meta.questProgress || {};
  const dailyQuests = R.get('dailyQuests') || [];
  const weeklyQuests = R.get('weeklyQuests') || [];

  // 复用 daily-panel 弹窗
  const el = document.getElementById("daily-panel");
  const box = document.getElementById("daily-mods");
  el.querySelector("h3").textContent = "📋 悬赏板";

  let html = '<div style="text-align:left;font-size:13px">';

  // 每日挑战
  const d = new Date();
  const today = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const seed = parseInt(today, 10);
  const gMods = R.get('dailyGlobalMods'); const pMods = R.get('dailyPlayerMods'); const eMods = R.get('dailyEnemyMods');
  const g = gMods[seed % 9], p = pMods[Math.floor(seed / 9) % 9], e = eMods[Math.floor(seed / 81) % 9];
  html += `<div style="margin-bottom:10px;padding:8px;background:#0d1117;border-radius:6px;border-left:3px solid #c8a8ff">`;
  html += `<b style="color:#c8a8ff">📅 每日挑战</b><br>`;
  html += `<div style="margin-bottom:4px"><b style="color:#c8a8ff">🌍 全局：${g.name}</b></div>`;
  html += `<div style="margin-bottom:8px;color:#8899bb;font-size:11px;padding-left:8px">${g.desc}</div>`;
  html += `<div style="margin-bottom:4px"><b style="color:#89e894">👤 角色：${p.name}</b></div>`;
  html += `<div style="margin-bottom:8px;color:#8899bb;font-size:11px;padding-left:8px">${p.desc}</div>`;
  html += `<div style="margin-bottom:4px"><b style="color:#ff7b7b">👹 怪物：${e.name}</b></div>`;
  html += `<div style="margin-bottom:8px;color:#8899bb;font-size:11px;padding-left:8px">${e.desc}</div>`;
  html += `</div>`;

  // 每日任务
  if (qp.dailyPicks && qp.dailyPicks.length > 0) {
    html += `<div style="margin-bottom:4px;color:#ffa502;font-weight:bold">📋 每日任务</div>`;
    for (const id of qp.dailyPicks) {
      const q = dailyQuests.find(q => q.id === id);
      if (!q) continue;
      const progress = qp.daily[id] || 0;
      const done = qp.dailyCompleted[id];
      const pct = Math.min(100, Math.floor(progress / q.target * 100));
      html += `<div style="margin-bottom:6px;padding:6px;background:#0d1117;border-radius:4px;border-left:3px solid ${done?'#89e894':'#354a70'}">`;
      html += `${q.icon} <b>${q.name}</b> ${done?'✅':''}<br>`;
      html += `<span style="color:#8899bb;font-size:11px">${q.desc}</span> `;
      html += `<span style="color:#ffa502;font-size:11px">+${q.reward.tp||0}TP +${q.reward.souls||0}💎</span><br>`;
      html += `<div style="background:#1a1f35;height:4px;border-radius:2px;margin-top:3px"><div style="background:${done?'#89e894':'#ffa502'};height:100%;width:${pct}%;border-radius:2px;transition:width .3s"></div></div>`;
      html += `<span style="color:#667788;font-size:10px">${Math.min(progress, q.target)}/${q.target}</span>`;
      html += `</div>`;
    }
  }

  // 每周挑战
  if (qp.weeklyPicks && qp.weeklyPicks.length > 0) {
    html += `<div style="margin-top:10px;margin-bottom:4px;color:#c8a8ff;font-weight:bold">🌟 每周挑战</div>`;
    for (const id of qp.weeklyPicks) {
      const q = weeklyQuests.find(q => q.id === id);
      if (!q) continue;
      const progress = qp.weekly[id] || 0;
      const done = qp.weeklyCompleted[id];
      const pct = Math.min(100, Math.floor(progress / q.target * 100));
      html += `<div style="margin-bottom:6px;padding:6px;background:#0d1117;border-radius:4px;border-left:3px solid ${done?'#89e894':'#4a3b8b'}">`;
      html += `${q.icon} <b>${q.name}</b> ${done?'✅':''}<br>`;
      html += `<span style="color:#8899bb;font-size:11px">${q.desc}</span> `;
      html += `<span style="color:#ffa502;font-size:11px">+${q.reward.tp||0}TP +${q.reward.souls||0}💎</span><br>`;
      html += `<div style="background:#1a1f35;height:4px;border-radius:2px;margin-top:3px"><div style="background:${done?'#89e894':'#c8a8ff'};height:100%;width:${pct}%;border-radius:2px;transition:width .3s"></div></div>`;
      html += `<span style="color:#667788;font-size:10px">${Math.min(progress, q.target)}/${q.target}</span>`;
      html += `</div>`;
    }
  }

  html += '</div>';
  box.innerHTML = html;

  // 每日挑战按钮
  document.getElementById("btn-start-daily").style.display = "block";
  document.getElementById("btn-start-daily").onclick = () => {
    Game.hardReset();
    const s = Game.state;
    s.mode = "daily"; s.seed = "daily_" + today; s.rng = new RNG(s.seed);
    s.difficulty = "standard"; s.dailyMods = { globalId: g.id, playerId: p.id, enemyId: e.id };
    hideModal("daily-panel");
    buildClassSelect(cls => {
      s.playerClass = cls;
      s.player = {
        hp: cls.hp, maxHp: cls.maxHp, mp: cls.maxMp, maxMp: cls.maxMp,
        atk: cls.atk, def: cls.def, critRate: cls.critRate, critMul: cls.critMul,
        skillMul: cls.skillMul, mpCost: cls.mpCost, pen: cls.pen,
        lifeSteal: 0, thorn: 0, goldMul: 1, dodge: 0, bleed: 0,
        rage: false, doubleFirst: false, debuffAtk: null, dmgReduce: 0,
        berserk: false, rebirth: false, regen: 0
      };
      Game.applyMetaBonus(s.player);
      applySoulUpgrades(s);
      g.apply(s); p.apply(s); e.apply(s);
      var sk = s.rng.pick(cls.skills);
      s.activeSkills = [{ ...sk }];
      s.activeSkill = s.activeSkills[0];
      s.skillLevels = {};
      s.skillLevels[sk.id] = 1;
      initZone("plains");
    }, "class-grid-daily");
    switchScreen("class-select");
  };

  document.getElementById("btn-close-daily").onclick = () => hideModal("daily-panel");
  showModal("daily-panel");
}

// ===================== UI 辅助函数 =====================
function buildDifficultySelect(onPick) {
  const grid = document.getElementById("diff-grid"); grid.innerHTML = "";
  const diffs = R.get('difficulties');
  const coins = Game.meta.difficultyCoins || 0;
  // 只显示基础难度（asc=0），折叠显示进阶
  var baseDiffs = Object.values(diffs).filter(function(d) { return d.asc === 0; });
  baseDiffs.forEach(function(d) {
    var div = document.createElement("div"); div.className = "card";
    div.innerHTML = '<div class="icon">' + d.icon + '</div><div class="name">' + d.name + '</div><div class="desc">' + d.desc + '</div>';
    div.onclick = function() {
      // 显示该难度的Ascension选项
      grid.innerHTML = "";
      var backBtn = document.createElement("div");
      backBtn.className = "card"; backBtn.style.cssText = "background:#1a1a2a;border:1px dashed #3a3a5a";
      backBtn.innerHTML = '<div class="icon">↩</div><div class="name">返回</div>';
      backBtn.onclick = function() { buildDifficultySelect(onPick); };
      grid.appendChild(backBtn);

      var ascLevels = Object.values(diffs).filter(function(x) { return x.id.startsWith(d.id); });
      ascLevels.forEach(function(asc) {
        var card = document.createElement("div"); card.className = "card";
        var unlocked = Game.meta.unlockedDiffs ? Game.meta.unlockedDiffs.includes(asc.id) : (asc.asc === 0);
        if (!unlocked) {
          card.style.opacity = "0.4";
          card.innerHTML = '<div class="icon">🔒</div><div class="name">' + asc.name + '</div><div class="desc">花费1难度币解锁（持有:' + coins + '）</div>';
          card.onclick = function() {
            if (coins > 0) {
              Game.meta.difficultyCoins--;
              if (!Game.meta.unlockedDiffs) Game.meta.unlockedDiffs = ["casual"];
              Game.meta.unlockedDiffs.push(asc.id);
              Game.saveMeta();
              buildDifficultySelect(onPick);
              toast("🔓 已解锁 " + asc.name);
            } else { toast("难度币不足！通关任意难度可获得"); }
          };
        } else {
          var rewardText = asc.asc > 0 ? ' · 魂晶×' + (2 + asc.asc * 2) : '';
          card.innerHTML = '<div class="icon">' + asc.icon + '</div><div class="name">' + asc.name + '</div><div class="desc">' + asc.desc + rewardText + '</div>';
          card.onclick = function() { onPick(asc); };
        }
        grid.appendChild(card);
      });
    };
    grid.appendChild(div);
  });
  // 难度币显示
  if (coins > 0) {
    var coinInfo = document.createElement("div");
    coinInfo.style.cssText = "text-align:center;color:#ffa502;font-size:11px;margin-top:8px";
    coinInfo.textContent = "🪙 持有难度币: " + coins + "（通关获得）";
    grid.appendChild(coinInfo);
  }
}

function buildClassSelect(onPick, gridId = "class-grid") {
  const grid = document.getElementById(gridId); grid.innerHTML = "";
  const unlocked = Game.meta.unlocks || ["warrior", "mage"];
  const classes = R.get('classes');
  Object.values(classes).forEach(c => {
    const div = document.createElement("div"); div.className = "card";
    const locked = !unlocked.includes(c.id);
    var portraitFile = 'portrait_' + c.id + '.jpg';
    div.innerHTML = '<div style="width:80px;height:80px;border-radius:50%;overflow:hidden;margin:0 auto 8px;border:2px solid ' + (locked ? '#333' : '#c8a8ff') + '"><img src="img/' + portraitFile + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'"></div><div class="icon" style="font-size:20px">' + c.icon + '</div><div class="name">' + c.name + (locked ? ' 🔒' : '') + '</div><div class="desc">' + c.desc + '</div>';
    if (!locked) div.onclick = () => onPick(c); else div.style.opacity = "0.4";
    grid.appendChild(div);
  });
}

function buildSkillSelect(cls, onPick) {
  const grid = document.getElementById("skill-grid"); grid.innerHTML = "";
  (cls.skills || []).forEach(sk => {
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = `<div class="icon">${sk.icon}</div><div class="name">${sk.name}</div><div class="desc">${sk.desc}</div>`;
    div.onclick = () => onPick(sk); grid.appendChild(div);
  });
}

function buildStartBonus(onDone) {
  var grid = document.getElementById("talent-grid"); grid.innerHTML = "";
  var h2 = document.querySelector("#talent-select h2");
  if (h2) h2.textContent = "🎁 开局赐福 · 三选一";
  var bonuses = [
    { icon: "🔮", name: "遗物赐福", desc: "随机获得一件稀有品质遗物", apply: function(s) {
      var rares = (R.get('relics') || []).filter(function(r) { return r.rarity === 'rare' || r.rarity === 'epic'; });
      if (rares.length > 0) { var r = { ...s.rng.pick(rares) }; if (r.passive) { r.passive(s.player); r.applied = true; } s.relics.push(r); log("<span class='win'>🎁 " + r.name + "</span>"); }
    }},
    { icon: "💰", name: "财宝赐福", desc: "开局额外获得80金币", apply: function(s) { s.gold += 80; } },
    { icon: "⚡", name: "迅捷赐福", desc: "本局所有技能CD-1回合", apply: function(s) {
      s.activeSkills.forEach(function(sk) { if (sk.cooldown > 1) sk.cooldown--; });
    }},
    { icon: "❤️", name: "生命赐福", desc: "生命上限+25", apply: function(s) { s.player.maxHp += 25; s.player.hp += 25; } },
    { icon: "📦", name: "装备赐福", desc: "开局随机获得2件装备", apply: function(s) {
      for (var i = 0; i < 2; i++) { var eq = Loot.genEquip(s.zone ? s.zone.id : null); s.equip.push(eq); applyEquipStats(s.player, eq); }
    }},
  ];
  var picks = Game.state.rng ? Game.state.rng.pickMulti(bonuses, 3) : bonuses.slice(0, 3);
  picks.forEach(function(b) {
    var div = document.createElement("div"); div.className = "card";
    div.innerHTML = '<div class="icon">' + b.icon + '</div><div class="name">' + b.name + '</div><div class="desc">' + b.desc + '</div>';
    div.onclick = function() { b.apply(Game.state); Game.state.blessingType = b.icon; Game.sync(); if (h2) h2.textContent = "✨ 选择天赋"; onDone(); };
    grid.appendChild(div);
  });
}

function buildTalentSelect(onPick) {
  const grid = document.getElementById("talent-grid"); grid.innerHTML = "";
  const s = Game.state;
  const pool = R.get('talents');
  console.log("[妖塔] buildTalentSelect: pool=", pool ? pool.length : 'NULL/UNDEFINED', "rng=", !!s.rng);
  const picks = s.rng ? s.rng.pickMulti(pool, 3) : pool.slice(0, 3);
  console.log("[妖塔] buildTalentSelect: picks=", picks.map(t=>t.name).join(', '));
  picks.forEach(t => {
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = `<div class="icon">${t.icon}</div><div class="name">${t.name}</div><div class="desc">${t.desc}</div>`;
    div.onclick = () => onPick(t); grid.appendChild(div);
  });
  console.log("[妖塔] buildTalentSelect: grid children=", grid.children.length);
}

function buildZoneSelect(choices, onPick) {
  document.getElementById("zone-info").textContent = `前方出现岔路，选择你的道路`;
  const grid = document.getElementById("zone-grid"); grid.innerHTML = "";
  if (!choices || choices.length === 0) return;
  choices.forEach(zid => {
    const z = R.get('zones', zid); if (!z) return;
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = `<div class="icon">${z.icon}</div><div class="name">${z.name}</div><div class="desc">${z.desc}</div>`;
    div.onclick = () => onPick(z); grid.appendChild(div);
  });
}


// ---- 战利品弹窗 ----
function showReward(isFast, onEquip, onAttr, isElite) {
  var s = Game.state;
  var el = document.getElementById("reward"); el.style.display = "block";
  var list = document.getElementById("reward-list"); list.innerHTML = "";
  list.style.display = "grid"; list.style.gridTemplateColumns = "1fr 1fr"; list.style.gap = "10px";

  var hdr = document.createElement("div");
  hdr.style.cssText = "grid-column:1/-1;text-align:center;color:" + (isElite ? "#ff4444" : "#ffdd77") + ";font-size:16px;font-weight:bold;margin-bottom:4px";
  hdr.textContent = isElite ? "👺 精英战利品" : "🎁 战利品";
  list.appendChild(hdr);

  // 2个装备大卡片
  for (var i = 0; i < 2; i++) {
    var eq = Loot.genEquip(s.zone ? s.zone.id : null);
    (function(equip) {
      var card = document.createElement("div");
      card.style.cssText = "background:#111827;border:2px solid " + equip.color + ";border-radius:12px;padding:16px 10px;text-align:center;cursor:pointer;transition:all .15s;box-shadow:0 0 " + (equip.qualityName === "传说" ? "16px" : "0") + " " + equip.color;
      card.innerHTML = "<div style=\"font-size:40px;margin-bottom:8px\">" + equip.icon + "</div>" +
        "<div style=\"color:" + equip.color + ";font-weight:bold;font-size:14px;margin-bottom:4px\">" + (equip.fullName||equip.name) + "</div>" +
        "<div style=\"color:#8899bb;font-size:11px\">" + equip.stat.toUpperCase() + "+" + equip.val + " · " + (equip.qualityName||"") + "</div>" +
        (equip._zoneSet ? "<div style=\"color:#ffa502;font-size:10px;margin-top:2px\">🏷️ " + equip._zoneSet + "套装</div>" : "");
      card.onmouseenter = function() { this.style.transform = "scale(1.04)"; this.style.borderColor = "#fff"; };
      card.onmouseleave = function() { this.style.transform = "scale(1)"; this.style.borderColor = equip.color; };
      card.onclick = function() { onEquip(equip); };
      list.appendChild(card);
    })(eq);
  }

  var attrs = [
    { id: "atk", name: "⚔️ 攻击+" + (isFast ? 10 : 5), icon: "" }
  ];
  attrs.forEach(function(a) {
    var btn = document.createElement("button");
    btn.className = "modal-btn";
    btn.style.cssText = "grid-column:1/-1;text-align:center;font-size:13px";
    btn.textContent = a.name;
    btn.onclick = function() { onAttr(a.id, isFast); };
    list.appendChild(btn);
  });
}

// ---- Boss 遗物三选一 ----
function showBossRelicPick(isFast) {
  var el = document.getElementById("reward"); el.style.display = "block";
  var list = document.getElementById("reward-list"); list.innerHTML = "";
  list.style.display = "grid"; list.style.gridTemplateColumns = "1fr 1fr"; list.style.gap = "10px";

  var hdr = document.createElement("div");
  hdr.style.cssText = "grid-column:1/-1;text-align:center;color:#ffa502;font-size:18px;font-weight:bold;margin-bottom:6px";
  hdr.textContent = "💀 Boss宝库 · 选择遗物";
  list.appendChild(hdr);

  var relics = [];
  for (var i = 0; i < 3; i++) {
    var rel = Loot.genRelic();
    var tries = 0;
    while (relics.some(function(r) { return r.id === rel.id; }) && tries < 10) { rel = Loot.genRelic(); tries++; }
    relics.push(rel);
  }

  relics.forEach(function(rel) {
    var rc = RARITY_COLOR[rel.rarity] || "#667788";
    var card = document.createElement("div");
    card.style.cssText = "background:#111827;border:2px solid " + rc + ";border-radius:12px;padding:14px 8px;text-align:center;cursor:pointer;transition:all .15s;box-shadow:0 0 12px " + (rel.rarity === "legendary" ? rc : "transparent");
    card.innerHTML = "<div style=\"font-size:36px;margin-bottom:6px\">" + rel.icon + "</div>" +
      "<div style=\"color:" + rc + ";font-weight:bold;font-size:14px;margin-bottom:4px\">" + rel.name + "</div>" +
      "<div style=\"color:#8899bb;font-size:10px;line-height:1.4\">" + rel.desc + "</div>" +
      "<div style=\"color:" + rc + ";font-size:9px;margin-top:3px\">" + (RARITY_NAME[rel.rarity] || "") + "</div>";
    card.onmouseenter = function() { this.style.transform = "scale(1.04)"; };
    card.onmouseleave = function() { this.style.transform = "scale(1)"; };
    card.onclick = function() { takeRelic(rel); };
    list.appendChild(card);
  });

  var skipBtn = document.createElement("button");
  skipBtn.className = "modal-btn";
  skipBtn.style.cssText = "grid-column:1/-1;text-align:center;background:#1a1a2a;color:#667788";
  skipBtn.textContent = "放弃遗物（+30金币）";
  skipBtn.onclick = function() { Game.state.gold += 30; hideModal("reward"); nextRoom(); };
  list.appendChild(skipBtn);
}

// ===================== 技能弹出面板（复用event弹窗） =====================
function showSkillPopup() {
  var s = Game.state;
  var skills = s.activeSkills || [];
  if (skills.length === 0) { toast("没有可用技能"); return; }
  var el = document.getElementById("event");
  el.style.display = "block";
  document.getElementById("event-title").textContent = "⚡ 选择技能";
  document.getElementById("event-desc").textContent = "点击技能释放（冷却中的不可用）";
  var btns = document.getElementById("event-btns");
  btns.innerHTML = "";

  skills.forEach(function(sk, i) {
    var cdKey = sk.id || ('skill_' + i);
    var cd = s.skillCooldowns ? (s.skillCooldowns[cdKey] || 0) : 0;
    var lv = s.skillLevels ? (s.skillLevels[sk.id] || 1) : 1;
    var label = sk.icon + " " + sk.name + " Lv" + lv;
    if (cd > 0) label += " [冷却" + cd + "回合]";
    else label += " → 释放";
    var btn = document.createElement("button");
    btn.className = "modal-btn";
    btn.textContent = label;
    btn.style.color = cd > 0 ? "#665588" : "#c8a8ff";
    if (cd === 0) {
      btn.onclick = function() {
        el.style.display = "none";
        Combat.doSkill(i);
      };
    } else {
      btn.disabled = true;
    }
    btns.appendChild(btn);
  });

  var cancelBtn = document.createElement("button");
  cancelBtn.className = "modal-btn";
  cancelBtn.style.background = "#1a1a2a"; cancelBtn.style.color = "#667788";
  cancelBtn.textContent = "取消";
  cancelBtn.onclick = function() { el.style.display = "none"; };
  btns.appendChild(cancelBtn);
}

function openPotionModal() {
  const s = Game.state; const el = document.getElementById("potion-modal"); el.style.display = "block";
  const list = document.getElementById("potion-list-modal"); list.innerHTML = "";
  if (s.potions.length === 0) { list.innerHTML = '<div style="color:#667788">暂无药水</div>'; }
  else {
    s.potions.forEach((p, i) => {
      const btn = document.createElement("button"); btn.className = "modal-btn";
      btn.innerHTML = `${p.icon} ${p.name} — ${p.desc}`; btn.onclick = () => { window._usePotion(i); hideModal("potion-modal"); };
      list.appendChild(btn);
    });
  }
}

// ===================== 称号系统 =====================
var TITLES = [
  { id: "t_newbie", name: "初入江湖", icon: "🌱", cond: function(m) { return true; } },
  { id: "t_clear_casual", name: "守门人克星", icon: "🏰", cond: function(m) { return (m.achievements||[]).includes("clear_casual"); } },
  { id: "t_clear_standard", name: "魔塔征服者", icon: "⚔️", cond: function(m) { return (m.achievements||[]).includes("clear_standard"); } },
  { id: "t_clear_hell", name: "炼狱主宰", icon: "🔥", cond: function(m) { return (m.achievements||[]).includes("clear_hell"); } },
  { id: "t_relic_10", name: "遗物猎人", icon: "📦", cond: function(m) { return (m.discoveredRelics||[]).length >= 10; } },
  { id: "t_relic_20", name: "遗物大师", icon: "🔮", cond: function(m) { return (m.discoveredRelics||[]).length >= 20; } },
  { id: "t_relic_all", name: "万象皆通", icon: "🌟", cond: function(m) { var all = R.get('relics')||[]; return (m.discoveredRelics||[]).length >= all.length; } },
  { id: "t_wins_5", name: "身经百战", icon: "💪", cond: function(m) { return (m.totalWins||0) >= 5; } },
  { id: "t_wins_20", name: "不败传说", icon: "👑", cond: function(m) { return (m.totalWins||0) >= 20; } },
  { id: "t_deaths_10", name: "不死小强", icon: "🪳", cond: function(m) { return (m.totalDeaths||0) >= 10; } },
  { id: "t_city_max", name: "城主大人", icon: "🏰", cond: function(m) { return (m.cityLevel||1) >= 5; } },
  { id: "t_forge_myth", name: "神话锻造师", icon: "⚒️", cond: function(m) { return (m.forgedItems||[]).length > 0; } },
];

function showAchievementPanel() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block"; el.querySelector("h3").textContent = "🏆 成就与称号";
  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var meta = Game.meta;

  // 称号选择
  if (!meta.equippedTitle) meta.equippedTitle = "t_newbie";
  var equipped = TITLES.find(function(t) { return t.id === meta.equippedTitle; }) || TITLES[0];

  var titleDiv = document.createElement("div");
  titleDiv.style.cssText = "text-align:center;margin-bottom:12px;padding:10px;background:#1a1520;border-radius:8px;border:1px solid #ffa502";
  titleDiv.innerHTML = '<div style="color:#8899bb;font-size:10px;margin-bottom:4px">当前称号</div>' +
    '<div style="font-size:24px">' + equipped.icon + '</div>' +
    '<div style="color:#ffa502;font-size:16px;font-weight:bold">' + equipped.name + '</div>';
  content.appendChild(titleDiv);

  // 可选称号列表
  var unlockedCount = 0;
  TITLES.forEach(function(t) {
    var isUnlocked = t.cond(meta);
    if (isUnlocked) unlockedCount++;
    var isEquipped = meta.equippedTitle === t.id;
    var div = document.createElement("div");
    div.style.cssText = "margin-bottom:4px;padding:8px;background:#0d1117;border-radius:4px;display:flex;align-items:center;gap:8px;border-left:3px solid " + (isEquipped ? "#ffa502" : (isUnlocked ? "#5a4080" : "#1a1a2a"));
    div.innerHTML = '<span style="font-size:22px">' + (isUnlocked ? t.icon : '🔒') + '</span>' +
      '<div style="flex:1"><b style="color:' + (isUnlocked ? '#ddccaa' : '#444') + '">' + t.name + '</b></div>';
    if (isUnlocked && !isEquipped) {
      var eqBtn = document.createElement("button");
      eqBtn.className = "modal-btn"; eqBtn.style.cssText = "font-size:10px;padding:3px 8px;width:auto";
      eqBtn.textContent = "装备";
      eqBtn.onclick = function() { meta.equippedTitle = t.id; Game.saveMeta(); render(Game.state); showAchievementPanel(); toast('👑 已装备称号：' + t.name); };
      div.appendChild(eqBtn);
    }
    if (isEquipped) { var badge = document.createElement("span"); badge.style.cssText = "color:#ffa502;font-size:10px"; badge.textContent = "✅使用中"; div.appendChild(badge); }
    content.appendChild(div);
  });

  // 成就列表
  var achHdr = document.createElement("div");
  achHdr.style.cssText = "color:#c8a8ff;font-weight:bold;margin:12px 0 6px;font-size:13px";
  achHdr.textContent = "📋 成就进度（" + (meta.achievements||[]).length + "/" + (R.get('achievements')||[]).length + "）";
  content.appendChild(achHdr);

  var categories = { combat: "⚔️战斗", build: "🔗构筑", collect: "📦收集", challenge: "🏆挑战" };
  var achList = R.get('achievements') || [];
  Object.keys(categories).forEach(function(cat) {
    var catAchs = achList.filter(function(a) { return a.category === cat; });
    if (catAchs.length === 0) return;
    var catDiv = document.createElement("div");
    catDiv.style.cssText = "color:#8899bb;font-size:10px;margin:4px 0 2px";
    catDiv.textContent = categories[cat];
    content.appendChild(catDiv);
    catAchs.forEach(function(a) {
      var done = (meta.achievements||[]).includes(a.id);
      var div = document.createElement("div");
      div.style.cssText = "padding:3px 6px;font-size:10px;color:" + (done ? "#89e894" : "#444");
      div.textContent = (done ? "✅" : "⬜") + " " + a.icon + " " + a.name + " — " + a.desc;
      content.appendChild(div);
    });
  });

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
}

// ===================== 成就卡片动画 =====================
function showAchievementCard(ach) {
  var card = document.getElementById("ach-card");
  if (!card) {
    card = document.createElement("div"); card.id = "ach-card";
    card.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);z-index:11000;background:linear-gradient(180deg,#2a1a0a,#1a0a00);border:3px solid #ffa502;border-radius:16px;padding:24px;text-align:center;pointer-events:none;transition:transform .4s cubic-bezier(.175,.885,.32,1.275);box-shadow:0 0 60px rgba(255,165,2,.5)";
    document.body.appendChild(card);
  }
  card.innerHTML = '<div style="font-size:48px">🏆</div><div style="color:#ffa502;font-size:20px;font-weight:bold;margin:8px 0">成就解锁！</div><div style="color:#ffdd77;font-size:16px">' + ach.name + '</div><div style="color:#8899bb;font-size:11px;margin-top:4px">' + (ach.desc || '') + '</div>';
  card.style.transform = "translate(-50%,-50%) scale(1)";
  setTimeout(function() { card.style.transform = "translate(-50%,-50%) scale(0)"; }, 1800);
}

// ===================== 战斗记录保存 =====================
function saveRunHistory(win) {
  var s = Game.state;
  if (!Game.meta.runHistory) Game.meta.runHistory = [];
  var d = new Date();
  Game.meta.runHistory.push({
    win: win,
    char: s.playerClass ? s.playerClass.name : '--',
    diff: s.difficulty || 'standard',
    floor: s.totalFloor || 0,
    relics: s.relics ? s.relics.length : 0,
    equip: s.equip ? s.equip.length : 0,
    maxDmg: s.stats ? s.stats.totalDmg : 0,
    date: d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate()
  });
  // 只保留最近20条
  if (Game.meta.runHistory.length > 20) Game.meta.runHistory = Game.meta.runHistory.slice(-20);
  Game.saveMeta();
}

// ===================== 大学士：遗物研究+宝典 =====================
function showScholarPanel() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block"; el.querySelector("h3").textContent = "📖 大学士 · 遗物研究";
  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var spiritStones = Game.meta.stones || 0;

  var info = document.createElement("div");
  info.style.cssText = "color:#8899bb;font-size:12px;margin-bottom:10px;text-align:center";
  info.innerHTML = '可用灵石:' + spiritStones + '<br><span style="color:#667788">研究遗物可提升下局该遗物出现率</span>';
  content.appendChild(info);

  // 遗物研究列表（显示稀有+史诗遗物，花灵石研究）
  var relics = R.get('relics') || [];
  var studyList = relics.filter(function(r) { return r.rarity === 'rare' || r.rarity === 'epic'; });
  studyList = studyList.slice(0, 6); // 只显示6个
  studyList.forEach(function(r) {
    var cost = r.rarity === 'epic' ? 12 : 6;
    var div = document.createElement("div");
    div.style.cssText = "margin-bottom:6px;padding:8px;background:#0d1117;border-radius:4px;display:flex;align-items:center;gap:8px";
    div.innerHTML = '<span style="font-size:20px">' + r.icon + '</span><div style="flex:1"><b style="color:#ddccaa">' + r.name + '</b><br><span style="color:#667788;font-size:10px">' + r.desc + '</span></div>';
    var btn = document.createElement("button");
    btn.className = "modal-btn"; btn.style.cssText = "font-size:10px;padding:4px 8px;white-space:nowrap";
    btn.textContent = "研究(" + cost + "灵石)";
    btn.disabled = spiritStones < cost;
    btn.onclick = function() {
      Game.meta.stones -= cost;
      if (!Game.meta.studiedRelic) Game.meta.studiedRelic = '';
      Game.meta.studiedRelic = r.id;
      Game.meta.studiedDate = new Date().toDateString();
      Game.saveMeta();
      showScholarPanel();
      toast('📖 正在研究 ' + r.name + '，下局出现率翻倍！');
    };
    div.appendChild(btn);
    content.appendChild(div);
  });

  // 已研究状态
  if (Game.meta.studiedRelic) {
    var studied = relics.find(function(r) { return r.id === Game.meta.studiedRelic; });
    if (studied && Game.meta.studiedDate === new Date().toDateString()) {
      var sDiv = document.createElement("div");
      sDiv.style.cssText = "margin-top:8px;padding:6px;background:#1a2a1a;border-radius:4px;text-align:center;color:#89e894;font-size:11px";
      sDiv.textContent = '✅ 今日正在研究：' + studied.name + '（下局出现率翻倍）';
      content.appendChild(sDiv);
    }
  }

  // 快捷入口
  var compBtn = document.createElement("button");
  compBtn.className = "modal-btn"; compBtn.textContent = "📚 打开万象宝典";
  compBtn.onclick = function() { el.style.display = "none"; showCompendium(); };
  content.appendChild(compBtn);

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
}

// ===================== 悬赏官：Boss猎杀令 =====================
function showBountyHunterPanel() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block"; el.querySelector("h3").textContent = "📋 悬赏官 · 猎杀令";
  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var s = Game.state;

  var info = document.createElement("div");
  info.style.cssText = "color:#8899bb;font-size:12px;margin-bottom:10px;text-align:center";
  info.innerHTML = '花费金币发布猎杀令，击败指定Boss拿魂晶奖励';
  content.appendChild(info);

  // 三个猎杀令选项
  var bounties = [
    { name: "裂地者猎杀令", boss: "平原领主", cost: 30, reward: 5, desc: "击败迷雾平原的裂地者" },
    { name: "树精猎杀令", boss: "森林之王", cost: 40, reward: 8, desc: "击败幽暗森林的苍古树精" },
    { name: "守门人猎杀令", boss: "魔塔守门人", cost: 60, reward: 15, desc: "击败魔塔门前的守门人" },
  ];

  var activeBounty = Game.meta.activeBounty;
  bounties.forEach(function(b) {
    var div = document.createElement("div");
    div.style.cssText = "margin-bottom:6px;padding:8px;background:#0d1117;border-radius:4px";
    var isActive = activeBounty && activeBounty.boss === b.boss;
    div.innerHTML = '<b style="color:#ddccaa">🎯 ' + b.name + '</b><br>' +
      '<span style="color:#667788;font-size:10px">' + b.desc + ' · 花费' + b.cost + 'G · 奖励' + b.reward + '魂晶</span>';
    var btn = document.createElement("button");
    btn.className = "modal-btn"; btn.style.cssText = "font-size:10px;padding:4px 8px;margin-top:4px";
    if (isActive) {
      btn.textContent = "进行中...";
      btn.disabled = true;
      btn.style.color = "#ffa502";
    } else {
      btn.textContent = "接取(" + b.cost + "G)";
      btn.disabled = (s.gold || 0) < b.cost;
      btn.onclick = function() {
        s.gold -= b.cost;
        Game.meta.activeBounty = { boss: b.boss, reward: b.reward };
        Game.saveMeta();
        showBountyHunterPanel();
        toast('🎯 已接取' + b.name + '！');
      };
    }
    div.appendChild(btn);
    content.appendChild(div);
  });

  // 快捷入口
  var dailyBtn = document.createElement("button");
  dailyBtn.className = "modal-btn"; dailyBtn.textContent = "📅 查看每日悬赏";
  dailyBtn.onclick = function() { el.style.display = "none"; showQuestBoard(); };
  content.appendChild(dailyBtn);

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
}

// ===================== 史官：战斗记录 =====================
function showHistorianPanel() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block"; el.querySelector("h3").textContent = "📜 史官 · 征战记录";
  var content = document.getElementById("meta-content"); content.innerHTML = "";

  var history = Game.meta.runHistory || [];
  if (history.length === 0) {
    content.innerHTML = '<div style="color:#667788;text-align:center;padding:20px">暂无战斗记录<br><span style="font-size:11px">完成一局游戏后自动记录</span></div>';
  } else {
    // 显示最近5局
    var recent = history.slice(-5).reverse();
    recent.forEach(function(h, i) {
      var div = document.createElement("div");
      div.style.cssText = "margin-bottom:8px;padding:10px;background:#0d1117;border-radius:6px;border-left:3px solid " + (h.win ? "#89e894" : "#ff7b7b");
      div.innerHTML = '<b style="color:#ddccaa">#' + (history.length - i) + ' ' + (h.win ? '🏆通关' : '💀阵亡') + '</b> ' +
        '<span style="color:#667788;font-size:10px">' + (h.date || '') + '</span><br>' +
        '<span style="color:#8899bb;font-size:11px">' + (h.char || '--') + ' · ' + (h.diff || '') + ' · 第' + (h.floor || 0) + '层</span><br>' +
        '<span style="color:#667788;font-size:10px">遗物' + (h.relics || 0) + '件 · 装备' + (h.equip || 0) + '件 · 最高伤害' + (h.maxDmg || 0) + '</span>';
      content.appendChild(div);
    });
  }

  // 统计摘要
  if (history.length > 0) {
    var totalRuns = history.length;
    var wins = history.filter(function(h) { return h.win; }).length;
    var bestFloor = 0; history.forEach(function(h) { if (h.floor > bestFloor) bestFloor = h.floor; });
    var statsDiv = document.createElement("div");
    statsDiv.style.cssText = "margin-top:10px;padding:8px;background:#1a1520;border-radius:4px;text-align:center;color:#c8a8ff;font-size:12px";
    statsDiv.innerHTML = '共' + totalRuns + '局 · 通关' + wins + '次 · 最高' + bestFloor + '层 · 胜率' + Math.floor(wins / totalRuns * 100) + '%';
    content.appendChild(statsDiv);
  }

  // 排行榜入口
  var lbBtn = document.createElement("button");
  lbBtn.className = "modal-btn"; lbBtn.textContent = "🏆 查看排行榜";
  lbBtn.onclick = function() { el.style.display = "none"; if (!TapLeaderboard.showPanel('total')) showLeaderboard(); };
  content.appendChild(lbBtn);

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
}

// ===================== 主城建造界面 =====================
function showCityHub() {
  switchScreen("city-hub");
  var meta = Game.meta;
  if (!meta.cityLevel) meta.cityLevel = 1;
  var cityLv = meta.cityLevel;
  var spiritStones = meta.stones || 0;
  var coins = meta.difficultyCoins || 0;

  // 资源+等级
  var res = document.getElementById("city-resources");
  var levelCosts = [0, 0, 15, 30, 50, 80];
  var nextCost = cityLv < 5 ? levelCosts[cityLv + 1] : 0;
  res.innerHTML = '🏰 主城 Lv.' + cityLv + '/5 · 💎灵石:' + spiritStones + ' · 🪙难度币:' + coins;
  if (nextCost > 0) {
    res.innerHTML += ' <button id=\"btn-upgrade-city\" style=\"font-size:10px;padding:2px 8px;background:#2a1a0a;border:1px solid #8a6030;color:#ffcc88;border-radius:4px;cursor:pointer\">⬆升级(' + nextCost + '灵石)</button>';
  }

  // 升级按钮
  setTimeout(function() {
    var upBtn = document.getElementById("btn-upgrade-city");
    if (upBtn) upBtn.onclick = function() {
      if (spiritStones >= nextCost && cityLv < 5) {
        meta.stones -= nextCost;
        meta.cityLevel = cityLv + 1;
        Game.saveMeta();
        showCityHub();
        toast('🏰 主城升至Lv.' + (cityLv + 1) + '！');
      }
    };
  }, 100);

  // 成长指南
  var guide = document.getElementById("city-guide");
  if (guide) {
    if (cityLv < 5 && spiritStones >= nextCost) {
      guide.innerHTML = '🎯 可<b>升级主城</b>至Lv.' + (cityLv + 1) + '（' + nextCost + '灵石），解锁新功能！';
    } else if (cityLv < 5) {
      guide.innerHTML = '🎯 <b>出城探险</b>赚取灵石升级主城（差' + (nextCost - spiritStones) + '灵石升Lv.' + (cityLv + 1) + '）';
    } else {
      guide.innerHTML = '👑 主城已满级 · 边境城池的传奇 · <b>出城挑战更高难度吧！</b>';
    }
  }

  // NPC列表：根据等级显示/锁定
  var npcList = document.querySelector('.city-npc-list');
  if (!npcList) return;

  var npcDefs = [
    { id: 'altar', name: '女神祭司 · 艾琳娜', icon: '🧙‍♀️', quote: cityLv >= 5 ? '"你已成为边境城池的传说……"' : '"女神的光辉指引着每一位勇士……"', func: '🔮 天赋强化 · 魂晶兑换', unlockLv: 1 },
    { id: 'class', name: '战斗大师 · 雷恩', icon: '🗡️', quote: cityLv >= 5 ? '"我已经没有什么可以教你了。"' : '"想变强？选对路比拼命更重要。"', func: '🎭 职业解锁 · 觉醒转职', unlockLv: 1 },
    { id: 'forge', name: '铁匠 · 锻炉', icon: '👨‍🏭', quote: cityLv >= 5 ? '"这些灵石……足够打造神器了。"' : '"好钢用在刀刃上……你有材料吗？"', func: '⚒️ 装备分解 · 锻造升级', unlockLv: 2 },
    { id: 'compendium', name: '大学士 · 奥兰多', icon: '📖', quote: cityLv >= 5 ? '"所有的知识，都已汇聚于此。"' : '"知识就是力量，记录即是对抗遗忘。"', func: '🔬 遗物研究 · 万象宝典', unlockLv: 3 },
    { id: 'daily', name: '悬赏官 · 卡斯特', icon: '📋', quote: cityLv >= 5 ? '"已经没有猎物能难倒你了。"' : '"今天的猎物已经张贴出来了。"', func: '🎯 Boss猎杀令 · 每日悬赏', unlockLv: 4 },
    { id: 'lodge', name: '猎人 · 老格林', icon: '🏚️', quote: '"歇歇脚吧勇士，小屋永远欢迎你。"', func: '🏚️ 离线收益 · 猎人小屋', unlockLv: 1 },
    { id: 'leaderboard', name: '史官 · 格里芬', icon: '📜', quote: cityLv >= 5 ? '"你的传奇，将永载史册。"' : '"每一位英雄的故事都应该被铭记。"', func: '📊 征战记录 · 历代最强', unlockLv: 5 },
  ];

  npcList.innerHTML = '';
  npcDefs.forEach(function(npc) {
    var locked = cityLv < npc.unlockLv;
    var div = document.createElement('div');
    div.className = 'city-npc';
    if (locked) { div.style.opacity = '0.4'; div.style.borderColor = '#1a1a2a'; }
    div.innerHTML = '<div class="npc-portrait">' + (locked ? '🔒' : npc.icon) + '</div>' +
      '<div class="npc-body">' +
        '<div class="npc-role">' + npc.name + '</div>' +
        '<div class="npc-quote">' + (locked ? '（主城Lv.' + npc.unlockLv + '解锁）' : npc.quote) + '</div>' +
        '<div class="npc-func">' + npc.func + '</div>' +
      '</div>';
    if (!locked) {
      div.onclick = function() {
        switch (npc.id) {
          case 'altar': showMetaPanel(); break;
          case 'class': showClassShrine(); break;
          case 'forge': showForgePanel(); break;
          case 'compendium': showScholarPanel(); break;
          case 'lodge': showHunterLodge(); break;
          case 'leaderboard': showHistorianPanel(); break;
          case 'daily': showBountyHunterPanel(); break;
        }
      };
    }
    npcList.appendChild(div);
  });
}

// 职业神殿（转职/觉醒）
function showClassShrine() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block";
  el.querySelector("h3").textContent = "🎭 职业神殿";
  var content = document.getElementById("meta-content");
  content.innerHTML = "";

  var classes = R.get('classes');
  var unlocked = Game.meta.unlocks || ["warrior","mage","shadow"];
  var spiritStones = Game.meta.stones || 0;

  Object.values(classes).forEach(function(c) {
    var hasClass = unlocked.includes(c.id);
    var div = document.createElement("div");
    div.style.cssText = "margin-bottom:10px;padding:10px;background:#0d1117;border-radius:6px;border-left:3px solid " + (hasClass ? "#89e894" : "#333");
    div.innerHTML = '<div style="display:flex;align-items:center;gap:10px"><img src="img/portrait_' + c.id + '.jpg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid ' + (hasClass ? '#c8a8ff' : '#333') + '" onerror="this.style.display=\'none\'"><div><b>' + c.icon + ' ' + c.name + '</b> ' + (hasClass ? '<span style="color:#89e894">已解锁</span>' : '<span style="color:#555">🔒 20魂晶解锁</span>') + '</div></div>' +
      '<br><span style="color:#8899bb;font-size:11px">' + c.desc + '</span>';
    if (!hasClass) {
      var btn = document.createElement("button");
      btn.className = "modal-btn"; btn.style.cssText = "margin-top:4px;font-size:11px";
      btn.textContent = "20魂晶解锁";
      btn.disabled = (Game.meta.souls || 0) < 20;
      btn.onclick = function() {
        if ((Game.meta.souls || 0) >= 20) {
          Game.meta.souls -= 20;
          if (!Game.meta.unlocks) Game.meta.unlocks = ["warrior","mage","shadow"];
          Game.meta.unlocks.push(c.id);
          Game.saveMeta();
          showClassShrine();
          toast('🎭 ' + c.name + ' 已解锁！');
        }
      };
      div.appendChild(btn);
    }
    // 觉醒按钮（已解锁职业且spiritStones足够）
    if (hasClass && spiritStones >= 10) {
      var awakenBtn = document.createElement("button");
      awakenBtn.className = "modal-btn"; awakenBtn.style.cssText = "margin-top:4px;font-size:11px;background:#2a1a0a;border-color:#8a6030;color:#ffcc88";
      awakenBtn.textContent = "⭐ 觉醒（10灵石）";
      awakenBtn.onclick = function() {
        Game.meta.stones -= 10;
        if (!Game.meta.awakenedClasses) Game.meta.awakenedClasses = {};
        Game.meta.awakenedClasses[c.id] = true;
        Game.saveMeta();
        showClassShrine();
        toast('⭐ ' + c.name + ' 已觉醒！属性提升');
      };
      div.appendChild(awakenBtn);
    }
    content.appendChild(div);
  });

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭";
  closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
}

// 锻造工坊面板
function showForgePanel() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block";
  el.querySelector("h3").textContent = "⚒️ 锻造工坊";
  var content = document.getElementById("meta-content");
  content.innerHTML = "";
  var s = Game.state;

  var spiritStones = Game.meta.stones || 0;
  var levels = Game.meta.buildingLevels || {};
  var forgeLv = levels.forge || 1;

  var info = document.createElement("div");
  info.style.cssText = "color:#8899bb;font-size:12px;margin-bottom:10px;text-align:center";
  info.innerHTML = '锻造台 Lv.' + forgeLv + ' · 可用灵石:' + spiritStones + '<br><span style="color:#667788">升级锻造台可解锁更多合成配方</span>';
  content.appendChild(info);

  // 升级按钮
  var upBtn = document.createElement("button");
  upBtn.className = "modal-btn";
  upBtn.textContent = "⬆ 升级锻造台（" + (forgeLv * 15) + "灵石）";
  upBtn.disabled = spiritStones < forgeLv * 15;
  upBtn.onclick = function() {
    var cost = forgeLv * 15;
    if (spiritStones >= cost) {
      Game.meta.stones -= cost;
      if (!Game.meta.buildingLevels) Game.meta.buildingLevels = {};
      Game.meta.buildingLevels.forge = forgeLv + 1;
      Game.saveMeta();
      showForgePanel();
      toast('⚒️ 锻造台升至Lv.' + (forgeLv + 1));
    }
  };
  content.appendChild(upBtn);

  // 装备分解
  var salvageDiv = document.createElement("div");
  salvageDiv.style.cssText = "margin-top:10px;padding:8px;background:#1a1010;border-radius:4px";
  salvageDiv.innerHTML = '<b style="color:#ffaa88">♻️ 装备分解</b><br><span style="color:#8899bb;font-size:11px">分解不需要的装备换取灵石（品质越高越多）</span>';

  var s = Game.state;
  if (s.equip && s.equip.length > 0) {
    s.equip.forEach(function(eq, i) {
      var salvageValue = 1;
      if (eq.qualityName === '精良') salvageValue = 2;
      else if (eq.qualityName === '稀有') salvageValue = 3;
      else if (eq.qualityName === '史诗') salvageValue = 5;
      else if (eq.qualityName === '传说') salvageValue = 8;
      else if (eq.qualityName === '神话') salvageValue = 15;
      var btn = document.createElement("button");
      btn.className = "modal-btn"; btn.style.cssText = "font-size:10px;padding:3px 8px;margin:2px;display:inline-block;width:auto";
      btn.textContent = eq.fullName + ' → ' + salvageValue + '灵石';
      btn.onclick = function() {
        removeEquipStats(s.player, eq);
        s.equip.splice(i, 1);
        Game.meta.stones = (Game.meta.stones || 0) + salvageValue;
        Game.saveMeta();
        Game.sync();
        showForgePanel();
        toast('♻️ 分解获得' + salvageValue + '灵石');
      };
      salvageDiv.appendChild(btn);
    });
  } else {
    salvageDiv.innerHTML += '<br><span style="color:#667788;font-size:10px">当前无装备可分解</span>';
  }
  content.appendChild(salvageDiv);

  // 合成配方说明
  var forgeDiv = document.createElement("div");
  forgeDiv.style.cssText = "margin-top:10px;color:#667788;font-size:11px;text-align:left";
  forgeDiv.innerHTML = '<b style="color:#ffaa88">锻造台功能：</b><br>' +
    '· 在探索中遇到<b>锻造石台</b>事件时可进行装备合成<br>' +
    '· Boss掉落材料可在锻造石台锻造神话装备<br>' +
    '· Lv.2: 合成费用-30%<br>' +
    '· Lv.3: 可锻造出双属性装备';
  content.appendChild(forgeDiv);

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭";
  closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
}

// ===================== 万象宝典 =====================
function showCompendium() {
  // 重置为首页
  document.getElementById("comp-home").style.display = "block";
  document.getElementById("comp-detail").style.display = "none";

  // 绑定首页四格卡片点击
  document.querySelectorAll(".comp-card-main").forEach(card => {
    card.onclick = () => {
      const cat = card.dataset.cat;
      document.getElementById("comp-home").style.display = "none";
      document.getElementById("comp-detail").style.display = "block";
      openCompDetail(cat);
    };
  });

  // 返回按钮
  document.getElementById("btn-comp-back").onclick = () => {
    document.getElementById("comp-home").style.display = "block";
    document.getElementById("comp-detail").style.display = "none";
  };

  showModal("compendium");
}

function openCompDetail(cat) {
  const title = document.getElementById("comp-detail-title");
  const content = document.getElementById("comp-detail-content");
  content.innerHTML = "";

  switch (cat) {
    case "classes":
      title.textContent = "⚔️ 角色道途";
      renderCompClasses(content);
      break;
    case "monsters":
      title.textContent = "👹 妖兽图鉴";
      renderCompMonsters(content);
      break;
    case "equip":
      title.textContent = "🎒 装备宝库";
      renderCompEquip(content);
      break;
    case "relics":
      title.textContent = "🔮 远古遗物";
      renderCompRelics(content);
      break;
    case "trophies":
      title.textContent = "🏆 藏品展架";
      renderCompTrophies(content);
      break;
  }
}

function renderCompClasses(content) {
  content.className = 'comp-classes';
  const classes = R.get('classes');
  const unlocked = Game.meta.unlocks || ["warrior", "mage", "shadow"];
  Object.values(classes).forEach(c => {
    const isUnlocked = unlocked.includes(c.id);
    const div = document.createElement("div");
    div.className = "comp-item";
    div.style.opacity = isUnlocked ? "1" : "0.4";
    div.innerHTML = `
      <div class="comp-item-icon">${c.icon}</div>
      <div class="comp-item-body">
        <div class="comp-item-name">${c.name} ${isUnlocked ? '' : '🔒'}</div>
        <div class="comp-item-stat">❤️${c.maxHp} ⚔️${c.atk} 🛡️${c.def} 💥${Math.floor(c.critRate*100)}% 🔮${c.maxMp}</div>
        <div class="comp-item-stat">暴伤${c.critMul}x · 消耗${c.mpCost}MP · 穿透${Math.floor((c.pen||0)*100)}%${c.dodge ? ' · 🍃'+Math.floor(c.dodge*100)+'%' : ''}</div>
        <div class="comp-item-desc">${c.desc}</div>
        <div class="comp-item-desc">技能：${(c.skills||[]).map(s=>s.icon+s.name).join(' · ')}</div>
      </div>
    `;
    content.appendChild(div);
  });
}

function renderCompMonsters(content) {
  content.className = 'comp-list';
  const codex = Game.getAllCodex();
  const entries = Object.values(codex);
  if (entries.length === 0) {
    content.innerHTML = '<div style="color:#887766;text-align:center;padding:30px">尚未遭遇任何妖兽<br><span style="font-size:11px;color:#5a4a3a">击败怪物后自动录入万象宝典</span></div>';
    return;
  }
  entries.sort((a, b) => (b.lastFloor || 0) - (a.lastFloor || 0));
  entries.forEach(m => {
    const div = document.createElement("div");
    div.className = "comp-item";
    div.innerHTML = `
      <div class="comp-item-icon">👹</div>
      <div class="comp-item-info">
        <div class="comp-item-name">${m.name || '?'}</div>
        <div class="comp-item-stat">❤️${m.hp||'-'} ⚔️${m.atk||'-'} 🛡️${m.def||'-'} · 首遇第${m.floor||'?'}层 · 击杀${m.kills||0}次</div>
      </div>
    `;
    content.appendChild(div);
  });
}

function renderCompEquip(content) {
  content.className = '';
  const types = R.get('equipTypes') || [];
  const qualities = R.get('equipQualities') || [];
  const prefixes = R.get('equipPrefixes') || [];

  let html = '<div style="color:#ccaa88;font-weight:bold;margin-bottom:8px;font-size:13px">⚔️ 装备类型</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:12px">';
  types.forEach(t => {
    html += `<div class="comp-item"><div class="comp-item-icon">${t.name.includes('武器')?'⚔️':t.name.includes('护甲')?'🛡️':t.name.includes('头盔')?'⛑️':t.name.includes('戒指')?'💍':'🔮'}</div><div class="comp-item-name">${t.name}</div><div class="comp-item-stat">${t.stat.toUpperCase()} 基础${t.base}</div></div>`;
  });
  html += '</div>';

  html += '<div style="color:#ccaa88;font-weight:bold;margin-bottom:6px;font-size:13px">⭐ 品质等级</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">';
  qualities.forEach(q => {
    html += `<div class="comp-item"><div class="comp-item-name">${q.name}</div><div class="comp-item-stat">×${q.mul}</div></div>`;
  });
  html += '</div>';

  html += '<div style="color:#ccaa88;font-weight:bold;margin-bottom:6px;font-size:13px">✨ 稀有前缀（' + prefixes.length + '种）</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">';
  prefixes.forEach(p => {
    html += `<div class="comp-item"><div class="comp-item-name">${p.name}</div><div class="comp-item-desc">${p.statBonus||''}</div></div>`;
  });
  html += '</div>';

  content.innerHTML = html;
}

function renderCompRelics(content) {
  content.className = '';
  const relics = R.get('relics') || [];
  // 遗物发现追踪
  if (!Game.meta.discoveredRelics) Game.meta.discoveredRelics = [];
  var discovered = Game.meta.discoveredRelics;
  var foundCount = discovered.length;
  var progHtml = '<div style="text-align:center;margin-bottom:8px"><span style="color:#ffa502;font-size:13px;font-weight:bold">已发现 ' + foundCount + ' / ' + relics.length + ' 件遗物</span>';
  progHtml += '<div style="width:100%;height:6px;background:#1a1a2a;border-radius:3px;margin-top:4px;overflow:hidden">';
  progHtml += '<div style="height:100%;background:linear-gradient(90deg,#c8a8ff,#ffa502);width:' + (relics.length > 0 ? Math.floor(foundCount / relics.length * 100) : 0) + '%;border-radius:3px"></div></div></div>';
  const RARITY_ORDER = ['legendary','epic','rare','common'];
  const RARITY_LABEL = { legendary:'传说', epic:'史诗', rare:'稀有', common:'普通' };
  const RARITY_ICON = { legendary:'🟠', epic:'🟣', rare:'🔵', common:'⚪' };

  const grouped = { legendary:[], epic:[], rare:[], common:[] };
  relics.forEach(r => {
    if (grouped[r.rarity]) grouped[r.rarity].push(r);
    else grouped.common.push(r);
  });

  let html = progHtml;
  RARITY_ORDER.forEach(rarity => {
    const list = grouped[rarity];
    if (!list || list.length === 0) return;
    html += `<div style="color:#ccaa88;font-weight:bold;margin:8px 0 4px;font-size:12px">${RARITY_ICON[rarity]} ${RARITY_LABEL[rarity]}（${list.length}）</div>`;
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px">';
    list.forEach(r => {
      var found = discovered.includes(r.id);
      if (found) {
        html += '<div class="comp-item comp-rarity-' + rarity + '">' +
          '<div class="comp-item-icon">' + r.icon + '</div>' +
          '<div class="comp-item-name">' + r.name + '</div>' +
          '<div class="comp-item-desc">' + r.desc + '</div></div>';
      } else {
        html += '<div class="comp-item" style="opacity:0.3;border-color:#1a1a2a">' +
          '<div class="comp-item-icon" style="filter:grayscale(1)">❓</div>' +
          '<div class="comp-item-name" style="color:#333">???</div>' +
          '<div class="comp-item-desc" style="color:#222">尚未发现</div></div>';
      }
    });
    html += '</div>';
  });

  content.innerHTML = html;
}

function renderCompTrophies(content) {
  content.className = 'comp-classes';
  const recipes = R.get('forgeRecipes') || [];
  const forgedItems = Game.meta.forgedItems || [];
  const total = recipes.length;
  const unlocked = forgedItems.length;

  var progDiv = document.createElement("div");
  progDiv.style.cssText = "text-align:center;margin-bottom:12px;color:#ffaa88;font-size:14px;font-weight:bold";
  progDiv.textContent = "已锻造 " + unlocked + " / " + total + " 件神话装备";
  content.appendChild(progDiv);

  var barBg = document.createElement("div");
  barBg.style.cssText = "width:100%;height:8px;background:#1a1010;border-radius:4px;margin-bottom:14px;overflow:hidden";
  var bar = document.createElement("div");
  bar.style.cssText = "height:100%;background:linear-gradient(90deg,#ff6644,#ffaa44);width:" + (total > 0 ? Math.floor(unlocked / total * 100) : 0) + "%;border-radius:4px;transition:width .5s";
  barBg.appendChild(bar);
  content.appendChild(barBg);

  recipes.forEach(function(recipe) {
    var done = forgedItems.includes(recipe.id);
    var div = document.createElement("div");
    div.className = "comp-item";
    div.style.opacity = done ? "1" : "0.35";
    div.style.borderColor = done ? "#ff6644" : "#2a1a1a";
    div.innerHTML = "<div class=\"comp-item-icon\" style=\"font-size:36px\">" + (done ? recipe.icon : "❓") + "</div>" +
      "<div class=\"comp-item-name\" style=\"color:" + (done ? "#ff6644" : "#554444") + "\">" + (done ? recipe.name : "??? ???") + "</div>" +
      "<div class=\"comp-item-stat\" style=\"color:" + (done ? "#ccaa88" : "#443333") + "\">" + (done ? recipe.desc : "未锻造的神话装备") + "</div>" +
      (done ? "" : "<div class=\"comp-item-desc\" style=\"color:#443322;font-size:9px\">" + (recipe.hint || '') + "</div>");
    content.appendChild(div);
  });
}


function showLeaderboard() {
  const lb = document.getElementById("lb-content");
  if (lb) {
    const list = Game.getLeaderboard();
    if (list.length === 0) { lb.innerHTML = '<div style="color:#667788;text-align:center">暂无记录</div>'; }
    else { lb.innerHTML = list.map((e, i) => `<div style="margin-bottom:6px;padding:6px;background:#0d1117;border-radius:4px"><b>#${i+1}</b> ${e.char||'--'} · ${e.diff||'standard'} · <span style="color:#ffa502">${e.floor}层</span> · ${e.date||''}</div>`).join(''); }
  }
  showModal("leaderboard");
}

function showGameOver(isWin, rewardText) {
  var s = Game.state;
  var title = document.getElementById("end-title");
  var score = document.getElementById("end-score");
  var reward = document.getElementById("meta-reward");

  title.textContent = isWin ? "🏆 凯旋归来！" : "💀 倒在征途";
  title.style.color = isWin ? "#ffa502" : "#ff7b7b";
  title.style.fontSize = "28px";

  var floor = s.totalFloor || 0;
  var clsName = s.playerClass ? s.playerClass.name : "--";
  var tip = "";
  if (!isWin) {
    var tips = [
      "下次试试先堆防御再输出",
      "多逛商店，遗物比装备更重要",
      "Boss二阶段要用技能打断",
      "把金币留到锻造台，神话装备很强",
      "选技能时考虑CD搭配，别全选长CD的"
    ];
    tip = "<div style=\"color:#8899bb;font-size:12px;margin-top:8px;font-style:italic\">💡 " + tips[Math.floor(Math.random() * tips.length)] + "</div>";
  }

  score.innerHTML = "<div style=\"font-size:48px;color:#ffdd77;font-weight:bold;margin:12px 0\">第 " + floor + " 层</div>" +
    "<div style=\"color:#8899bb;font-size:14px\">" + clsName + " · " + (s.difficulty || "standard") + "</div>" +
    "<div style=\"color:#667788;font-size:11px;margin-top:4px\">遗物:" + (s.relics? s.relics.length : 0) + "件 · 装备:" + (s.equip? s.equip.length : 0) + "件 · 技能:" + (s.activeSkills? s.activeSkills.length : 0) + "个</div>" +
    tip;

  reward.innerHTML = "<div style=\"background:#1a1520;border:1px solid #ffa502;border-radius:8px;padding:12px;margin-top:12px\">" +
    "<div style=\"color:#ffa502;font-weight:bold;font-size:15px\">" + (rewardText || "结算奖励") + "</div>" +
    "<div style=\"color:#8899bb;font-size:11px;margin-top:4px\">天赋点可在女神祭坛升级属性</div>" +
    "</div>";

  // 按钮改大
  // 分享按钮
  var shareText = '【妖塔】' + clsName + ' · ' + (s.difficulty || 'standard') + ' · 第' + floor + '层 · 遗物' + (s.relics ? s.relics.length : 0) + '件 · 装备' + (s.equip ? s.equip.length : 0) + '件';
  var shareBtn = document.createElement("button");
  shareBtn.textContent = "📋 复制战绩";
  shareBtn.style.cssText = "display:block;margin:8px auto;padding:10px 24px;background:#1a2a3a;border:1px solid #3a5a7a;color:#8899bb;border-radius:8px;cursor:pointer;font-size:13px;width:80%;max-width:300px";
  shareBtn.onclick = function() {
    if (navigator.clipboard) { navigator.clipboard.writeText(shareText).then(function() { toast("📋 战绩已复制！"); }); }
    else { prompt("复制这段战绩：", shareText); }
  };
  score.appendChild(shareBtn);

  var restartBtn = document.getElementById("btn-hard-restart");
  restartBtn.textContent = "🔄 再来一局";
  restartBtn.style.cssText = "padding:18px 40px;font-size:20px;background:linear-gradient(180deg,#ffa502,#cc7700);color:#000;font-weight:bold;border:none;border-radius:12px;cursor:pointer;margin:8px;min-height:56px;width:80%;max-width:300px";
  restartBtn.onclick = function() { Game.hardReset(); switchScreen("start"); render(Game.state); };

  var saveBtn = document.getElementById("btn-read-save");
  saveBtn.style.display = Game.hasSave() ? "inline-block" : "none";

  switchScreen("gameover");
}

// ===================== 每日运势 + 开局突变 =====================
function getDailyFortune() {
  var today = new Date(); var seed = today.getFullYear() * 10000 + (today.getMonth()+1) * 100 + today.getDate();
  var fortunes = [
    { icon: "💰", name: "财运亨通", desc: "今日金币获取+30%", apply: function(s) { s.player.goldMul = (s.player.goldMul || 1) * 1.3; } },
    { icon: "⚡", name: "灵力涌动", desc: "今日长CD技能-1回合(CD≥3的)", apply: function(s) { (s.activeSkills || []).forEach(function(sk) { if (sk.cooldown >= 3) sk.cooldown--; }); } },
    { icon: "🛡️", name: "坚如磐石", desc: "今日开局防御+5", apply: function(s) { s.player.def += 5; } },
    { icon: "💪", name: "战神附体", desc: "今日开局攻击+5", apply: function(s) { s.player.atk += 5; } },
    { icon: "🔮", name: "遗物亲和", desc: "今日遗物掉率提升", apply: function(s) { s._fortuneRelic = true; } },
    { icon: "❤️", name: "生命恩赐", desc: "今日开局生命+30", apply: function(s) { s.player.maxHp += 30; s.player.hp += 30; } },
    { icon: "🔥", name: "烈焰之日", desc: "今日所有敌人自带燃烧", apply: function(s) { s._fortuneBurn = true; } },
    { icon: "💀", name: "诅咒之日", desc: "今日商店半价但开局带1诅咒", apply: function(s) { s._fortuneCurse = true; } },
  ];
  // 开局突变：规则级全局改变（与运势独立）
  var mutations = [
    { icon: "☠️", name: "亡灵天灾", desc: "所有敌人被击杀后3回合复活一次(半血)", apply: function(s) { s._mutationUndead = true; } },
    { icon: "🌀", name: "魔力紊乱", desc: "技能CD随机±1回合(每次释放后)", apply: function(s) { s._mutationChaos = true; } },
    { icon: "⚖️", name: "元素失衡", desc: "火焰/冰霜伤害翻倍·物理伤害减半", apply: function(s) { s._mutationElement = true; } },
    { icon: "😈", name: "诅咒狂欢", desc: "开局3诅咒·每诅咒+25%全属性", apply: function(s) { var curses = R.get('curses')||[]; for(var i=0;i<3;i++){var c=s.rng.pick(curses);if(c){s.curses.push(c);c.apply(s.player);s.player.atk=Math.floor(s.player.atk*1.25);s.player.def=Math.floor(s.player.def*1.25);}} } },
    { icon: "⏰", name: "时间加速", desc: "每回合自动过2回合(敌人双动·CD双降)", apply: function(s) { s._mutationTime = true; } },
    { icon: "🩸", name: "血月降临", desc: "治疗减半·攻击附带30%吸血", apply: function(s) { s.player.lifeSteal=(s.player.lifeSteal||0)+0.3; s._mutationBlood = true; } },
    { icon: "💎", name: "富矿层", desc: "所有掉落翻倍·但精英敌人+1", apply: function(s) { s.player.goldMul=(s.player.goldMul||1)*2; s._mutationRich = true; } },
    { icon: "👻", name: "幽灵模式", desc: "闪避率+30%·但被击中时受伤翻倍", apply: function(s) { s.player.dodge=(s.player.dodge||0)+0.3; s._mutationGhost = true; } },
  ];
  var fortuneIdx = seed % fortunes.length;
  var mutIdx = Math.floor(seed / 9) % mutations.length;
  var result = fortunes[fortuneIdx];
  result.mutation = mutations[mutIdx];
  return result;
}

// ===================== 连续登录 =====================
function checkLoginStreak() {
  var today = new Date(); var todayStr = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
  var meta = Game.meta;
  if (!meta.loginStreak) meta.loginStreak = 0;
  if (!meta.lastLogin) meta.lastLogin = '';

  var yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  var yesterdayStr = yesterday.getFullYear() + '-' + (yesterday.getMonth()+1) + '-' + yesterday.getDate();

  if (meta.lastLogin === todayStr) return; // 今天已登录
  if (meta.lastLogin === yesterdayStr) { meta.loginStreak++; } // 连续
  else if (meta.lastLogin === '') { meta.loginStreak = 1; } // 首次
  else { meta.loginStreak = Math.max(1, meta.loginStreak - 1); } // 断签扣1天

  meta.lastLogin = todayStr;
  Game.saveMeta();
}

// ===================== Boss专属遗物 =====================
function getBossRelic(zoneId) {
  var relics = {
    plains: { id:'boss_plains', name:'大地之力', icon:'🦏', rarity:'epic', desc:'技能释放时相邻敌人受50%溅射伤害', passive:function(p){p._bossPlains=true;}, onRemove:function(p){p._bossPlains=false;} },
    forest: { id:'boss_forest', name:'自然之愈', icon:'🌲', rarity:'epic', desc:'每回合末若未攻击则回复15%HP', passive:function(p){p._bossForest=true;}, onRemove:function(p){p._bossForest=false;} },
    cave:   { id:'boss_cave',   name:'晶岩护体', icon:'💎', rarity:'epic', desc:'受击时获得1层晶化(防御+2可叠3层)', passive:function(p){p._bossCave=true;}, onRemove:function(p){p._bossCave=false;} },
    ruins:  { id:'boss_ruins',  name:'远古咒印', icon:'📜', rarity:'epic', desc:'攻击时附加1个随机debuff(燃烧/迟缓/中毒)', passive:function(p){p._bossRuins=true;}, onRemove:function(p){p._bossRuins=false;} },
    frozen: { id:'boss_frozen', name:'永冻之触', icon:'❄️', rarity:'epic', desc:'技能命中必定迟缓，已迟缓的敌人冻结1回合', passive:function(p){p._bossFrozen=true;}, onRemove:function(p){p._bossFrozen=false;} },
    voidgate:{id:'boss_void',   name:'虚空裂隙', icon:'🌀', rarity:'epic', desc:'击杀敌人时生成虚空裂隙(2回合后爆炸伤害全场)', passive:function(p){p._bossVoid=true;}, onRemove:function(p){p._bossVoid=false;} },
    tower:  { id:'boss_tower',  name:'破塔之誓', icon:'🛕', rarity:'legendary', desc:'对Boss伤害+40%，Boss战中每回合回复5%HP', passive:function(p){p._bossTower=true;}, onRemove:function(p){p._bossTower=false;} },
    desert: { id:'boss_desert', name:'流沙之舞', icon:'🏜️', rarity:'epic', desc:'闪避成功后下次攻击必暴击且+50%伤害', passive:function(p){p._bossDesert=true;}, onRemove:function(p){p._bossDesert=false;} },
    swamp:  { id:'boss_swamp',  name:'腐沼之种', icon:'🌿', rarity:'epic', desc:'中毒的敌人死亡时治疗你10%最大HP', passive:function(p){p._bossSwamp=true;}, onRemove:function(p){p._bossSwamp=false;} },
  };
  return relics[zoneId] || null;
}

// ===================== 遗产仓库 =====================
function saveLegacy() {
  var s = Game.state;
  if (!s) return;
  var items = [];
  if (s.equip && s.equip.length > 0) items.push({ type: 'equip', data: s.equip[s.equip.length - 1] });
  if (s.relics && s.relics.length > 0) items.push({ type: 'relic', data: s.relics[s.relics.length - 1] });
  if (items.length > 0) {
    var pick = items[Math.floor(Math.random() * items.length)];
    Game.meta.legacyItem = pick;
    Game.saveMeta();
    return pick;
  }
  return null;
}
function applyLegacy(s) {
  var item = Game.meta.legacyItem;
  if (!item) return;
  if (item.type === 'equip' && item.data) {
    s.equip.push(item.data);
    applyEquipStats(s.player, item.data);
  } else if (item.type === 'relic' && item.data) {
    var r = item.data;
    if (r.passive && !r.applied) { r.passive(s.player); r.applied = true; }
    s.relics.push(r);
  }
  Game.meta.legacyItem = null;
  Game.saveMeta();
  log('<span class="win">📦 遗产仓库：继承了上局的' + (item.data.name || '物品') + '！</span>');
}

// 初始渲染
try {
  checkLoginStreak();
  var fortune = getDailyFortune();
  var fortuneEl = document.getElementById("daily-fortune");
  if (fortuneEl) fortuneEl.innerHTML = fortune.icon + ' 运势：<b>' + fortune.name + '</b> — ' + fortune.desc +
    (fortune.mutation ? '<br>' + fortune.mutation.icon + ' 突变：<b style="color:#ff6644">' + fortune.mutation.name + '</b> — ' + fortune.mutation.desc : '');
  var streakEl = document.getElementById("login-streak");
  if (streakEl) streakEl.textContent = '🔥连续' + (Game.meta.loginStreak || 1) + '天';
  console.log("[妖塔] 开始初始渲染, state:", Game.state ? 'OK' : 'NULL');
  render(Game.state);
  console.log("[妖塔] 初始渲染完成");
} catch(e) {
  console.error("[妖塔] 初始渲染失败:", e.message, e.stack);
}
console.log("妖塔 v0.40 | 全周期留存优化");
