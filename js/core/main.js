// ===================== 妖塔勇者录 入口 =====================
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
import '../content/talent-tree.js';  // v0.50 天赋树（替代旧meta-limits）
import '../content/fate-brands.js'; // v0.50 命运烙印
import '../content/room-types.js';
import '../content/room-templates.js';
import '../content/synergies.js';
import '../content/achievements.js';
import '../content/quests.js';
import '../content/forge.js';
import '../content/dungeons.js'; // v0.60 深渊裂隙·秘境副本
import '../content/boss-rush-bosses.js'; // v0.70 Boss Rush专属Boss池（传奇+DNF）
import '../content/chaos-mods.js'; // v0.80 混沌词条统一数据源
import '../content/outgame-equips.js'; // v0.81 局外装备数据
import { TapSave } from '../platform/tapsave.js';
import { TapLeaderboard } from '../platform/tapleaderboard.js';
import { TapAchievement } from '../platform/tapachievement.js';

// ---- 核心 ----
import { Game, onRender } from "./state.js";
import { R } from "./registry.js";
import { E, Events } from "./event-bus.js";
import { initAudio, playSound, stopHeartbeat, playMusic, stopMusic, setMusicVolume, setMusicMuted, isMusicMuted } from "./audio.js";
import { RNG } from "./rng.js";

// ---- 系统 ----
import * as Combat from "../systems/combat.js";
import * as Loot from "../systems/loot.js";
import * as Room from "../systems/room.js";
import * as Shop from "../systems/shop.js";
import * as EventSys from "../systems/event.js";
import * as Prog from "../systems/progression.js";
import * as Synergy from "../systems/synergy.js";
import { addEquip, getEquipLimit } from "../systems/equipment.js"; // v0.80: 提取装备逻辑
import { startBuildMode, injectBuildCallbacks } from "../systems/build-mode.js"; // v0.80: 提取构建模式
import { loadOutgameEquipToState, initEndlessChallengeZone, generateEndlessRooms, initBossRush, nextBossRushStage, initEndlessZone, injectModeCallbacks } from "../systems/modes.js"; // v0.80: 提取模式初始化
import { buildDifficultySelect, buildClassSelect, buildSkillSelect, buildStartBonus, buildTalentSelect, buildHuntSelect, buildZoneSelect } from "../ui/panels/build-selectors.js"; // v0.80: 提取构建选择器
import { showCompendium } from "../ui/panels/compendium.js"; // v0.80: 提取万象宝典
import { showEquipDoll } from "../ui/panels/equip-doll.js"; // v0.81: 纸娃娃装备面板
import { showEquipBag } from "../ui/panels/equip-bag.js"; // v0.81: 装备背包
import { openSmithyPanel } from "../ui/panels/smithy.js"; // v0.81: 铁匠铺
import { showJadeShop } from "../ui/panels/jade-shop.js"; // v0.81: 灵玉商店
import { showDungeonHub } from "../ui/panels/dungeon-hub.js"; // v0.83: 深渊裂隙

// ---- UI ----
import { render, log, toast, float, switchScreen, showModal, hideModal, hideAllModals } from "../ui/render.js";
import { RARITY_COLOR, RARITY_NAME } from '../content/relics.js';
import { animPlayerAttack, animPlayerCrit, animEnemyHit, animEnemyAttack, animPlayerHit, animEnemyKill, animPlayerDodge, animPlayerDefend, updateArena, bigFloat, screenShake, logTurnSeparator, showBossNarrative } from "../ui/effects.js";

// ===================== 初始化 =====================
import { validateAll } from './validate.js';
Game.init();
validateAll(); // 启动时扫描所有配置，控制台输出警告
onRender(s => render(s));
initAudio();
playMusic('menu'); // 主界面背景音乐（若被 autoplay 阻止，audio.js 内部自动等用户交互后重试）
// TapTap平台模块初始化（浏览器环境自动跳过）
TapSave.init();
TapLeaderboard.init();
TapAchievement.init();
// 桥接存档：Game.save后自动同步云端（节流：1秒最多1次）
var _lastCloudSave = 0;
var _origSave = Game.save.bind(Game);
Game.save = function() { _origSave(); if (this.state.totalFloor > 0) { var now = Date.now(); if (now - _lastCloudSave > 1000) { _lastCloudSave = now; TapSave.saveToCloud('auto_save', this.state); } } };
// 桥接成就
var _origUnlock = Game.unlockAchievement.bind(Game);
Game.unlockAchievement = function(id) { _origUnlock(id); TapAchievement.unlock(id); };
// 桥接排行榜
var _origAddLB = Game.addLeaderboard.bind(Game);
Game.addLeaderboard = function(entry, type) {
  var lbType = type || ((Game.state.mode === 'endless_challenge' || Game.state.mode === 'boss_rush' || Game.state.mode === 'dungeon') ? 'cultivate' : 'pure');
  _origAddLB(entry, lbType);
  TapLeaderboard.submitScore(lbType === 'cultivate' ? 'total_culti' : 'total', entry.floor);
};

// v0.80: _usePotion → render.js 改用 DOM 构建+Combat 导入

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

Events.on(E.CURSE_REMOVED, d => { trackQuest('cleanse', 1); });

Events.on(E.GOLD_CHANGED, d => {
  if (d.delta > 0) {
    if (d.fast) log(`<span class="win">🏆 限时击杀！仅用${Game.state.turnInFloor}回合，金币翻倍！</span>`);
    log(`<span class="gold">💰 获得 ${d.delta} 金币</span>`); float("+"+d.delta,"float-gold");
    playSound("gold");
    trackQuest('gold', d.delta);
  }
  if (d.souls > 0) { log(`<span class="win">👻 获得 ${d.souls} 魂晶！</span>`); float("+"+d.souls+"👻","float-gold"); playSound("relic"); }
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
// v0.83: 深渊裂隙事件 — 委托给已有的 startDungeon/startTower
Events.on(E.DUNGEON_ENTER, function(data) { if (data && data.dungeonId) startDungeon(data.dungeonId); });
Events.on(E.TOWER_START, function() { startTower(); });
// v0.80: 替代 window._* 全局函数 — EventBus 桥接
Events.on(E.SHOW_ACH_PANEL, showAchievementPanel);
Events.on(E.EQUIP_DISCARD, function(data) { if (data) discardEquip(data.index); });
Events.on(E.META_UPGRADED, () => {
  // 刷新主界面遗物进度、称号等
  var relP = document.getElementById("relic-progress");
  if (relP) { var d2 = Game.meta?.discoveredRelics?.length || 0; var t2 = (R.get('relics')||[]).length; relP.textContent = '📚 遗物 ' + d2 + '/' + t2; }
  var rcB = document.getElementById("relic-count-bar");
  if (rcB) { var d3 = Game.meta?.discoveredRelics?.length || 0; var t3 = (R.get('relics')||[]).length; rcB.textContent = '🔮' + d3 + '/' + t3; }
});

// ===================== 按钮绑定 =====================
// v0.80: 全部按钮用 _safe 包裹，防止静默崩溃
const _safe = (fn, name) => () => { try { fn(); } catch(e) { console.error(`[妖塔勇者录] ${name} 崩溃:`, e); toast("操作失败，已记录错误"); } };
document.getElementById("btn-newgame").onclick = _safe(() => { initAudio(); startNewGame(); }, "newGame");
document.getElementById("btn-continue").onclick = _safe(() => { if (Game.load()) { continueGame(); } else { Game.deleteSave(); render(Game.state); toast("存档损坏，已自动重置"); } }, "continue");
document.getElementById("btn-daily").onclick = _safe(showQuestBoard, "showQuestBoard");
document.getElementById("btn-meta").onclick = _safe(showMetaPanel, "showMetaPanel");
document.getElementById("btn-delete").onclick = _safe(() => { if (confirm("确定删除存档？图鉴和排行榜将保留。")) { Game.hardReset(); switchScreen("start"); render(Game.state); } }, "deleteSave");
document.getElementById("btn-show-lb-start").onclick = _safe(() => showLeaderboard(), "showLeaderboard");
document.getElementById("btn-tap-lb").onclick = _safe(() => showTapLeaderboard(), "showTapLeaderboard");
document.getElementById("btn-cloud-save").onclick = _safe(() => showCloudSavePanel(), "showCloudSave");
document.getElementById("btn-equip-doll").onclick = _safe(() => showEquipDoll(false), "showEquipDoll");
document.getElementById("btn-equip-bag").onclick = _safe(() => showEquipBag(null, null), "showEquipBag");
document.getElementById("btn-close-daily").onclick = _safe(() => hideModal("daily-panel"), "closeDaily");
document.getElementById("btn-login").onclick = _safe(() => showDailyCheckin(), "showDailyCheckin");
document.getElementById("btn-close-lb").onclick = _safe(() => hideModal("leaderboard"), "closeLeaderboard");
document.getElementById("btn-compendium").onclick = _safe(() => showCompendium(), "showCompendium");
document.getElementById("btn-endless").onclick = _safe(() => { if (!(Game.meta.achievements||[]).includes('clear_standard') && !(Game.meta.achievements||[]).includes('clear_casual')) { toast('🔒 需要先通关任一难度'); return; } startBuildMode('endless'); }, "startEndless");
document.getElementById("btn-bossrush").onclick = _safe(() => { if (!(Game.meta.achievements||[]).includes('clear_standard')) { toast('🔒 需要通关普通模式后才能解锁Boss Rush'); return; } startBuildMode('bossrush'); }, "startBossRush");
document.getElementById("btn-dungeon-hub").onclick = _safe(() => showDungeonHub(), "showDungeonHub");
document.getElementById("btn-rift-back").onclick = _safe(() => switchScreen("start"), "riftBack");
document.getElementById("btn-city-enter").onclick = _safe(() => showCityHub(), "showCityHub");
document.getElementById("btn-city-back").onclick = _safe(() => switchScreen("start"), "cityBack");
document.getElementById("btn-close-compendium").onclick = _safe(() => { var el = document.getElementById("compendium"); if (el) el.style.display = "none"; hideModal("compendium"); }, "closeCompendium");

// v0.50 设置面板（含音频/游戏/数据/关于）
var btnSettings = document.getElementById("btn-settings");
if (btnSettings) btnSettings.onclick = _safe(function() {
  var el = document.getElementById("settings-panel");
  el.style.display = "block";
  // 修行模式
  var chkPure = document.getElementById("chk-pure-mode");
  if (chkPure) {
    chkPure.checked = !!Game.meta._pureMode;
    chkPure.onchange = function() {
      Game.meta._pureMode = chkPure.checked;
      Game.saveMeta();
      toast(chkPure.checked ? '🗿 修行模式已开启' : '🗿 修行模式已关闭');
    };
  }
  // 音乐静音
  var chkMute = document.getElementById("chk-music-mute");
  if (chkMute) {
    chkMute.checked = isMusicMuted();
    chkMute.onchange = function() { setMusicMuted(chkMute.checked); };
  }
  // 音乐音量滑块
  var sldMusic = document.getElementById("snd-music-vol");
  var lblMusic = document.getElementById("snd-music-val");
  if (sldMusic) {
    sldMusic.oninput = function() {
      var v = sldMusic.value / 100;
      setMusicVolume(v);
      if (lblMusic) lblMusic.textContent = sldMusic.value + '%';
    };
  }
}, "openSettings");
// v0.82 存档保存/读取（替代旧导出/导入，防作弊）
var _saveMode = null; // 'save' | 'load'
function showSaveSlots(mode) {
  _saveMode = mode;
  var panel = document.getElementById("save-slots-panel");
  var title = document.getElementById("save-slots-title");
  var info = document.getElementById("save-slots-info");
  var list = document.getElementById("save-slots-list");
  if (!panel || !list) return;

  if (mode === 'save') {
    title.textContent = '💾 保存存档';
    info.textContent = '选择一个槽位保存当前进度（含局外成长）';
    info.style.color = '#8899bb';
  } else {
    title.textContent = '📂 读取存档';
    info.innerHTML = '<span style="color:#ffa502">⚠ 读取存档将覆盖当前进度！</span>';
  }

  list.innerHTML = '';
  for (var i = 0; i < 3; i++) {
    (function(slotIdx) {
      var si = Game.getSlotInfo(slotIdx);
      var div = document.createElement("div");
      div.style.cssText = 'padding:10px 12px;border-radius:8px;cursor:pointer;font-size:13px;transition:all .15s';

      if (si && !si.empty) {
        var dateStr = si.timestamp ? new Date(si.timestamp).toLocaleString('zh-CN') : '未知时间';
        var validMark = si.valid ? '✅' : '⚠️ 校验失败';
        var validColor = si.valid ? '#89e894' : '#ff6644';
        div.style.background = 'linear-gradient(135deg, rgba(26,26,46,.9), rgba(20,30,40,.85))';
        div.style.border = '1px solid ' + (si.valid ? '#2a3a2a' : '#4a2020');
        div.innerHTML = '<div style="font-weight:bold;color:#ffa502">📁 槽位 ' + (slotIdx+1) + '</div>' +
          '<div style="color:#8899bb;font-size:11px">🏰 ' + (si.className || '未知职业') + ' · 第' + si.floor + '层</div>' +
          '<div style="color:#667;font-size:10px">🕐 ' + dateStr + ' <span style="color:' + validColor + '">' + validMark + '</span></div>';
        div.onmouseenter = function() { div.style.borderColor = '#ffa502'; };
        div.onmouseleave = function() { div.style.borderColor = si.valid ? '#2a3a2a' : '#4a2020'; };
        div.onclick = function() { handleSlotAction(slotIdx, si); };
      } else {
        div.style.background = 'rgba(20,20,30,.5)';
        div.style.border = '1px dashed #333';
        div.innerHTML = '<div style="color:#667">📁 槽位 ' + (slotIdx+1) + ' — 空</div>';
        div.onmouseenter = function() { div.style.borderColor = '#667'; };
        div.onmouseleave = function() { div.style.borderColor = '#333'; };
        div.onclick = function() { handleSlotAction(slotIdx, si); };
      }
      list.appendChild(div);
    })(i);
  }

  // 自动存档显示
  var autoDiv = document.createElement("div");
  autoDiv.style.cssText = 'padding:8px 12px;border-radius:8px;font-size:11px;color:#556;background:rgba(10,10,20,.5);border:1px solid #1a1a2a;margin-top:6px';
  autoDiv.innerHTML = '🤖 自动存档：游戏进行中自动保存，与手动存档独立';
  list.appendChild(autoDiv);

  panel.style.display = 'block';
}

function handleSlotAction(slotIdx, slotInfo) {
  if (_saveMode === 'save') {
    // 保存确认
    if (slotInfo && !slotInfo.empty) {
      if (!confirm('⚠ 槽位 ' + (slotIdx+1) + ' 已有存档（第' + slotInfo.floor + '层），确定覆盖？')) return;
    }
    var ok = Game.saveToSlot(slotIdx);
    if (ok) {
      toast('💾 存档已保存到槽位 ' + (slotIdx+1));
      document.getElementById("save-slots-panel").style.display = 'none';
    } else {
      toast('❌ 保存失败');
    }
  } else if (_saveMode === 'load') {
    if (!slotInfo || slotInfo.empty) { toast('📭 该槽位为空'); return; }
    if (!slotInfo.valid) { toast('⚠️ 存档校验失败，可能已损坏或被篡改'); return; }
    if (!confirm('⚠ 读取存档将覆盖当前进度！\n槽位' + (slotIdx+1) + '：' + (slotInfo.className||'?') + ' 第' + slotInfo.floor + '层\n\n确定读取？')) return;
    var data = Game.loadFromSlot(slotIdx);
    if (!data || data.error) {
      toast('❌ 读取失败：' + (data && data.error === 'checksum_failed' ? '存档校验失败' : '数据损坏'));
      return;
    }
    if (!Game.applySlotData(data)) { toast('❌ 应用存档失败'); return; }
    document.getElementById("save-slots-panel").style.display = 'none';
    // 如果存档中有游戏进度则加载，否则回到主界面
    if (Game.load()) {
      continueGame();
      toast('📂 存档已读取 — 继续冒险！');
    } else {
      switchScreen("start"); render(Game.state);
      toast('📂 元数据已读取');
    }
  }
}

var btnSaveGame = document.getElementById("btn-save-game");
if (btnSaveGame) btnSaveGame.onclick = _safe(function() { showSaveSlots('save'); }, "saveGame");
var btnLoadGame = document.getElementById("btn-load-game");
if (btnLoadGame) btnLoadGame.onclick = _safe(function() { showSaveSlots('load'); }, "loadGame");
var btnCloseSaveSlots = document.getElementById("btn-close-save-slots");
if (btnCloseSaveSlots) btnCloseSaveSlots.onclick = _safe(function() { document.getElementById("save-slots-panel").style.display = 'none'; }, "closeSaveSlots");
// 重置全部数据
var btnResetAll = document.getElementById("btn-reset-all");
if (btnResetAll) btnResetAll.onclick = _safe(function() {
  if (confirm("⚠️ 确定要重置全部数据吗？\n这将删除：存档、元数据、图鉴、排行榜、所有局外进度\n此操作不可恢复！")) {
    Game.hardReset(true);
    switchScreen("start"); render(Game.state);
    toast('🌊 全部数据已重置');
  }
}, "resetAll");
// 关闭
var btnCloseSettings = document.getElementById("btn-close-settings");
if (btnCloseSettings) btnCloseSettings.onclick = _safe(function() {
  document.getElementById("settings-panel").style.display = "none";
}, "closeSettings");

// 管理员模式
var adminInput = document.getElementById("admin-input");
if (adminInput) {
  adminInput.addEventListener("input", function() {
    if (adminInput.value.trim() === "崔海涛牛逼") {
      adminInput.value = "";
      adminInput.style.color = "#0a0";
      adminInput.placeholder = ">>> 管理员模式已激活 <<<";
      activateAdminMode();
    }
  });
}

function activateAdminMode() {
  var meta = Game.meta;
  meta.essence = 999; meta.souls = 9999; meta.stones = 9999;
  meta.forgeStones = 999; meta.materials = 999; meta.memoryFragments = 999;
  meta.unlocks = ["warrior","mage","shadow","archer","monk"];
  meta.unlockedDiffs = ["casual","casual_1","casual_2","casual_3","standard","standard_1","standard_2","standard_3","hell","hell_1","hell_2","hell_3"];
  var tree = R.get('talentTree') || [];
  meta.talentNodes = tree.map(function(n){return n.id;});
  var achs = R.get('achievements') || [];
  meta.achievements = achs.map(function(a){return a.id;});
  var relics = R.get('relics') || [];
  meta.discoveredRelics = relics.map(function(r){return r.id;});
  if (!meta.classMastery) meta.classMastery = {};
  ["warrior","mage","shadow","archer","monk"].forEach(function(cid){
    meta.classMastery[cid] = {level:15,exp:999}; meta.charExp[cid] = 999;
  });
  meta.classAdvancement = {warrior:"war_berserker",mage:"mage_archmage",shadow:"shd_assassin",archer:"arc_sniper",monk:"monk_enlightened"};
  if (!meta.awakenedClasses) meta.awakenedClasses = {};
  ["warrior","mage","shadow","archer","monk"].forEach(function(cid){meta.awakenedClasses[cid]=true;});
  var brands = R.get('fateBrands')||[];
  meta.unlockedBrands = brands.map(function(b){return b.id;});
  meta.equippedBrands = [brands[0]?brands[0].id:null,brands[1]?brands[1].id:null];
  if(!meta.brandLevels) meta.brandLevels = {};
  brands.forEach(function(b){meta.brandLevels[b.id]=3;});
  meta.unlockedLore = ["lore_human","lore_demon","lore_ancient","lore_warrior","lore_mage","lore_shadow","lore_final"];
  meta.decorations = ["dec_dummy","dec_fountain","dec_library","dec_spring","dec_observatory"];
  meta.cityLevel = 5; meta.onboardingStage = 5;
  meta.totalWins = Math.max(meta.totalWins||0,50);
  meta.totalRuns = Math.max(meta.totalRuns||0,60);
  meta.highestNormal = 99;
  Game.saveMeta();
  document.getElementById("settings-panel").style.display = "none";
  toast('👑 管理员模式已激活 · 全部内容已解锁');
  setTimeout(function(){render(Game.state);},300);
}
document.getElementById("btn-hard-restart").onclick = _safe(() => { Game.hardReset(); switchScreen("start"); render(Game.state); }, "hardRestart");
document.getElementById("btn-read-save").onclick = _safe(() => { if (Game.load()) continueGame(); }, "readSave");
document.getElementById("btn-show-lb").onclick = _safe(() => showLeaderboard(), "showLeaderboard2");

// 战斗按钮（带容错）
document.getElementById("btn-atk").onclick = _safe(function() { Combat.clearAuto(); Combat.doAttack(); }, "doAttack");
document.getElementById("btn-skill").onclick = _safe(function() { Combat.clearAuto(); showSkillPopup(); }, "openSkillPopup");
document.getElementById("btn-def").onclick = _safe(function() { Combat.clearAuto(); Combat.doDefend(); }, "doDefend");
document.getElementById("btn-endturn").onclick = _safe(function() { Combat.doEndTurn(); }, "doEndTurn");
document.getElementById("btn-auto").onclick = _safe(Combat.toggleAuto, "toggleAuto");
// v0.80: 见好就收按钮改用 addEventListener，不再用 HTML onclick
var _retreatBtn = document.getElementById("btn-retreat");
if (_retreatBtn) _retreatBtn.addEventListener("click", function() {
  if (confirm('确定见好就收？将以当前层数结算奖励。')) retreatEndless();
});

Combat.setCB(onWin, () => {}); // onOver 由 Events 处理
// v0.80: _onRelicFull → EventBus
Events.on(E.RELICS_FULL, function(data) { if (data && data.relic) showRelicReplace(data.relic); });

// v0.50 存档保护：关闭页面前自动保存
window.addEventListener("beforeunload", function() {
  try { if (Game.state && Game.state.totalFloor > 1) Game.save(); Game.saveMeta(); } catch(e) {}
});

// 全局错误捕获
window.onerror = (msg, src, line, col, err) => {
  console.error("[妖塔勇者录] 全局异常:", msg, "at", src, ":", line, ":", col, err?.stack);
  toast("游戏出现异常，已尝试保存进度");
  try { Game.sync(); } catch(e) {}
};

// ===================== 天赋树面板 v0.50 =====================
function showTalentTree() {
  var el = document.getElementById("meta-panel");
  var content = document.getElementById("meta-content");
  var subtitle = document.getElementById("meta-subtitle");
  el.style.display = "block";
  var titleEl = document.getElementById("meta-title");
  if (titleEl) titleEl.textContent = "🌟 天赋树";
  if (subtitle) {
    var tpEl2 = document.getElementById("meta-tp");
    if (tpEl2) tpEl2.textContent = Game.getEssence() + ' 灵蕴 · ' + (Game.meta.souls || 0) + ' 魂晶';
    else subtitle.innerHTML = '灵蕴: <b>' + Game.getEssence() + '</b> · 魂晶: <b>' + (Game.meta.souls || 0) + '</b>';
  }

  var tree = R.get('talentTree') || [];
  var unlocked = Game.meta.talentNodes || [];
  var branches = [
    { id: 'root', name: '根脉', icon: '🌳', desc: '基础属性（可重复点亮）' },
    { id: 'combat', name: '战斗大师', icon: '⚔️', desc: '暴击·暴伤·吸血·穿透·CD缩减' },
    { id: 'survival', name: '生存专家', icon: '🛡️', desc: '闪避·格挡·护盾·回复·减伤' },
    { id: 'explore', name: '探索者', icon: '🗺️', desc: '金币·遗物率·折扣·事件·扩容' },
    { id: 'fortune', name: '命运', icon: '🍀', desc: '稀有度·精英房·宝箱·净化·多选' }
  ];

  // 计算当前加成
  var bonuses = Game.getTalentBonuses();
  var summaryEl = document.createElement("div");
  summaryEl.style.cssText = "background:#1a1a2e;padding:8px 12px;border-radius:8px;margin-bottom:12px;font-size:11px;color:#ccbb99";
  var summaryParts = [];
  if (bonuses.atkMul > 0) summaryParts.push('ATK+' + Math.floor(bonuses.atkMul * 100) + '%');
  if (bonuses.hpMul > 0) summaryParts.push('HP+' + Math.floor(bonuses.hpMul * 100) + '%');
  if (bonuses.defMul > 0) summaryParts.push('DEF+' + Math.floor(bonuses.defMul * 100) + '%');
  if (bonuses.critRate > 0) summaryParts.push('暴击+' + Math.floor(bonuses.critRate * 100) + '%');
  if (bonuses.critMul > 0) summaryParts.push('暴伤+' + Math.floor(bonuses.critMul * 100) + '%');
  if (bonuses.lifeSteal > 0) summaryParts.push('吸血+' + Math.floor(bonuses.lifeSteal * 100) + '%');
  if (bonuses.pen > 0) summaryParts.push('穿透+' + Math.floor(bonuses.pen * 100) + '%');
  if (bonuses.dodge > 0) summaryParts.push('闪避+' + Math.floor(bonuses.dodge * 100) + '%');
  if (bonuses.dmgReduce > 0) summaryParts.push('减伤+' + Math.floor(bonuses.dmgReduce * 100) + '%');
  summaryEl.innerHTML = '📊 当前加成：' + (summaryParts.length > 0 ? summaryParts.join(' · ') : '尚未点亮任何节点');

  // 重置按钮
  var resetBtn = document.createElement("button");
  resetBtn.className = "modal-btn"; resetBtn.style.cssText = "font-size:11px;padding:4px 12px;background:#5a2020";
  // v0.51: 检查本周是否已使用免费重置
  var today = new Date().toDateString();
  var freeResetAvail = (Game.meta.lastFreeReset || '') !== today;
  if (freeResetAvail) {
    resetBtn.textContent = '🔄 免费重置（本周1次）';
    resetBtn.style.background = '#2a5a20';
  } else {
    resetBtn.textContent = '🔄 重置全部分支（20魂晶）';
    resetBtn.style.background = '#5a2020';
  }
  resetBtn.onclick = function() {
    var isFree = (Game.meta.lastFreeReset || '') !== new Date().toDateString();
    if (!isFree && (Game.meta.souls || 0) < 20) { alert("魂晶不足20"); return; }
    if (!confirm(isFree ? "本周免费重置，确定重置所有天赋节点？将返还全部灵蕴。" : "确定重置所有天赋节点？消耗20魂晶，返还全部灵蕴。")) return;
    if (!isFree) Game.meta.souls = Math.max(0, (Game.meta.souls || 0) - 20);
    Game.meta.lastFreeReset = new Date().toDateString();
    var allNodes = Game.meta.talentNodes || [];
    var refund = allNodes.reduce(function(sum, nid) {
      var nd = tree.find(function(n) { return n.id === nid; });
      return sum + (nd ? nd.cost : 0);
    }, 0);
    Game.resetAllTalents();
    Game.meta.essence = Math.min(999, (Game.meta.essence || 0) + refund);
    Game.saveMeta();
    showTalentTree();
    toast('🔄 天赋树已重置' + (isFree ? '（免费）' : '') + '，返还' + refund + '灵蕴');
  };
  content.innerHTML = '';
  
  content.appendChild(summaryEl);

  // ===== v1.0 线性分支列表（Tab切换，降低渲染复杂度）=====
  var BRANCH_STORAGE_KEY = '_tt_activeBranch';
  var activeBranch = sessionStorage.getItem(BRANCH_STORAGE_KEY) || 'root';
  var oStage = Game.meta.onboardingStage || 0;
  var rootMax = oStage >= 2 ? 5 : 3;

  // Tab栏
  var tabBar = document.createElement("div");
  tabBar.style.cssText = "display:flex;gap:3px;margin-bottom:8px;overflow-x:auto;padding-bottom:4px";
  branches.forEach(function(br) {
    var tab = document.createElement("button");
    var isActive = activeBranch === br.id;
    var locked = oStage < 1 && br.id !== 'root';
    tab.style.cssText = "flex:1;min-width:55px;padding:6px 2px;border-radius:6px;border:1px solid " + (isActive ? "#ffa502" : "#2a2a3a") +
      ";background:" + (isActive ? "#2a1a0a" : "#111") + ";color:" + (isActive ? "#ffcc88" : (locked ? '#444' : '#667')) +
      ";font-size:10px;cursor:" + (locked ? 'default' : 'pointer') + ";white-space:nowrap;text-align:center";
    var brNodes = tree.filter(function(n) { return n.branch === br.id; });
    var brOwned = brNodes.filter(function(n) { return unlocked.includes(n.id); }).length;
    var info = locked ? '🔒' : (brOwned + '/' + brNodes.length);
    tab.innerHTML = br.icon + '<br>' + br.name + '<br><span style="font-size:8px">' + info + '</span>';
    if (!locked) tab.onclick = function() {
      sessionStorage.setItem(BRANCH_STORAGE_KEY, br.id);
      showTalentTree();
    };
    tabBar.appendChild(tab);
  });
  content.appendChild(tabBar);

  // 阶段锁提示
  if (oStage < 1) {
    var lockNote = document.createElement("div");
    lockNote.style.cssText = "text-align:center;color:#667;font-size:10px;margin-bottom:6px";
    lockNote.textContent = '🔒 非根脉分支在「觉醒」阶段（通关1次）后解锁 · 根节点上限' + rootMax + '层';
    content.appendChild(lockNote);
  }

  // 渲染当前活跃分支的节点
  var curBr = branches.find(function(b) { return b.id === activeBranch; }) || branches[0];
  var branchNodes = tree.filter(function(n) { return n.branch === curBr.id; });
  branchNodes.sort(function(a, b) { return a.layer - b.layer; });

  var nodeGrid = document.createElement("div");
  nodeGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:8px 0";

  var layerNodes = {};
  branchNodes.forEach(function(node) {
    var l = node.layer;
    if (!layerNodes[l]) layerNodes[l] = [];
    layerNodes[l].push(node);
  });

  var layers = Object.keys(layerNodes).sort(function(a,b){return parseInt(a)-parseInt(b);});
  layers.forEach(function(layer) {
    var layerDiv = document.createElement("div");
    layerDiv.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;justify-content:center;width:100%;margin-bottom:2px";
    if (parseInt(layer) > 1) {
      var arrow = document.createElement("div");
      arrow.style.cssText = "width:100%;text-align:center;font-size:14px;color:#445;margin:-2px 0";
      arrow.textContent = '↓';
      layerDiv.appendChild(arrow);
    }
    layerNodes[layer].forEach(function(node) {
      var rootCount = (curBr.id === 'root' && node.id.startsWith('root_'))
        ? unlocked.filter(function(n) { return n === node.id; }).length : 0;
      var owned = curBr.id === 'root'
        ? (rootCount >= rootMax)
        : unlocked.includes(node.id);
      var canBuy = false;
      if (!owned) {
        if (!node.requires || node.requires.length === 0) {
          canBuy = true;
        } else {
          canBuy = node.requires.every(function(req) { return unlocked.includes(req); });
        }
        if (curBr.id === 'root' && node.id.startsWith('root_')) { canBuy = rootCount < rootMax; }
        if (curBr.id !== 'root' && oStage < 1) { canBuy = false; }
      }

      var card = document.createElement("div");
      var isKeystone = node.isKeystone;
      card.style.cssText = "padding:" + (isKeystone ? "8px 10px" : "5px 7px") + ";border-radius:6px;text-align:center;font-size:" +
        (isKeystone ? "12px" : "10px") + ";width:" + (isKeystone ? "100px" : "75px") +
        ";cursor:pointer;transition:all .15s;" +
        (owned ? "background:#2a3a1a;border:2px solid " + (isKeystone ? "#ffa502" : "#4a7a2a") + ";opacity:0.85" :
         canBuy ? "background:#1a1a3a;border:2px solid #3a4a7a" :
         "background:#1a1a1a;border:2px solid #2a2a2a;opacity:0.4");
      if (isKeystone && !owned) card.style.border = "2px dashed #5a4a2a";
      card.title = node.desc + (isKeystone ? ' [终极大点]' : '') + '\n消耗: ' + node.cost + '灵蕴';

      var iconSpan = isKeystone ? '⭐' : node.icon;
      var labelText = node.name;
      if (curBr.id === 'root' && !owned) labelText += '×' + (rootCount + 1);
      card.innerHTML = '<div style="font-size:' + (isKeystone ? '22px' : '16px') + '">' + iconSpan + '</div>' +
        '<div style="color:' + (owned ? '#7acc7a' : canBuy ? '#ccbb99' : '#555') + ';font-weight:' + (isKeystone ? 'bold' : 'normal') + '">' + labelText + '</div>' +
        '<div style="font-size:9px;color:#667">' + node.cost + '灵蕴</div>';
      if (owned && !isKeystone) card.innerHTML += '<div style="color:#7acc7a;font-size:8px">✅</div>';

      card.onclick = function() {
        if (owned) return;
        if (!canBuy) { toast('需要先点亮前置节点'); return; }
        var cost = node.cost;
        if (Game.getEssence() < cost) { toast('灵蕴不足（需' + cost + '）'); return; }
        Game.meta.essence -= cost;
        Game.unlockTalentNode(node.id);
        Game.saveMeta();
        if (isKeystone) toast('🌟 终极大点「' + node.name + '」已点亮！');
        else toast('✅ ' + node.name + ' 已点亮');
        showTalentTree();
        render(Game.state);
      };
      layerDiv.appendChild(card);
    });
    nodeGrid.appendChild(layerDiv);
  });

  content.appendChild(nodeGrid);

  // 分支说明
  var brDesc = document.createElement("div");
  brDesc.style.cssText = "text-align:center;color:#556;font-size:9px;margin-top:4px";
  brDesc.textContent = curBr.desc + ' · 已点亮 ' + branchNodes.filter(function(n){return unlocked.includes(n.id);}).length + '/' + branchNodes.length + '节点 · 根上限' + rootMax + '层';
  content.appendChild(brDesc);

  // 重置按钮
  content.appendChild(resetBtn);

  // 关闭按钮
  var closeBtn = document.createElement("button");
  closeBtn.className = "modal-btn"; closeBtn.style.cssText = "margin-top:8px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
}

// ===================== 局外成长 =====================
function showMetaPanel() {
  // v0.50 重定向到天赋树（替代旧TP升级面板）
  showTalentTree();
}

// buildMetaPanel 已在 v0.50 被天赋树替代，已移除
// v0.80: BUILD_STEPS / SIN_CURSES / CHAOS_TIERS + 全部构建模式函数 → js/systems/build-mode.js

// 觉醒专属遗物ID（从职业配置中获取）
Game.getAwakenedRelic = function(cid) {
  var cls = R.get('classes', cid);
  if (!cls || !cls.awakenRelic) return null;
  return cls.awakenRelic;
};

// ===================== v0.60 新模式入口（替换原直接开始） =====================
function startEndlessChallenge() {
  // 检查解锁条件
  if (!(Game.meta.achievements||[]).includes('clear_standard') && !(Game.meta.achievements||[]).includes('clear_casual')) {
    toast('🔒 需要通关普通模式后才能解锁无尽挑战'); return;
  }
  Game.hardReset();
  var s = Game.state;
  s.mode = 'endless_challenge';
  s.seed = '' + Date.now(); s.rng = new RNG(s.seed);
  s.difficulty = 'standard';
  // 选职业 → 局外装备确认 → 开始
  buildClassSelect(function(cls) {
    s.playerClass = cls;
    s.player = { hp:cls.hp, maxHp:cls.maxHp, mp:cls.maxMp, maxMp:cls.maxMp, atk:cls.atk, def:cls.def, critRate:cls.critRate, critMul:cls.critMul, skillMul:cls.skillMul, mpCost:cls.mpCost, pen:cls.pen, lifeSteal:0, thorn:0, goldMul:1, dodge:cls.dodge||0, bleed:0, rage:false, doubleFirst:false, debuffAtk:null, dmgReduce:0, berserk:false, rebirth:false, regen:0, energy:3, maxEnergy:3 };
    Game.applyMetaBonus(s.player);
    var mSkills = R.get('classMasterySkills');
    var mLv = Game.getMasteryLevel(cls.id);
    if (mLv >= 3 && mSkills && mSkills[cls.id]) { mSkills[cls.id].forEach(function(ms){if(mLv>=ms.masteryLv)s.activeSkills.push({...ms});}); }
    var sk = s.rng.pick(cls.skills);
    s.activeSkills.unshift({...sk}); s.activeSkill = s.activeSkills[0]; s.skillLevels = {}; s.skillLevels[sk.id] = 1;
    // 局外装备：从 outgameEquipped 加载
    loadOutgameEquipToState(s);
    initEndlessChallengeZone();
  });
  switchScreen("class-select");
}
function startBossRush() {
  if (!(Game.meta.achievements||[]).includes('clear_standard')) { toast('🔒 需要通关普通模式后才能解锁Boss Rush'); return; }
  Game.hardReset();
  var s = Game.state;
  s.mode = 'boss_rush'; s.bossRushIndex = 0; s.bossRushHP = 0;
  s.seed = '' + Date.now(); s.rng = new RNG(s.seed);
  s.difficulty = 'hell';
  buildClassSelect(function(cls) {
    s.playerClass = cls;
    s.player = { hp:cls.hp, maxHp:cls.maxHp, mp:cls.maxMp, maxMp:cls.maxMp, atk:cls.atk, def:cls.def, critRate:cls.critRate, critMul:cls.critMul, skillMul:cls.skillMul, mpCost:cls.mpCost, pen:cls.pen, lifeSteal:0, thorn:0, goldMul:1, dodge:cls.dodge||0, bleed:0, rage:false, doubleFirst:false, debuffAtk:null, dmgReduce:0, berserk:false, rebirth:false, regen:0, energy:3, maxEnergy:3 };
    Game.applyMetaBonus(s.player);
    var mSkills = R.get('classMasterySkills');
    var mLv = Game.getMasteryLevel(cls.id);
    if (mLv >= 3 && mSkills && mSkills[cls.id]) { mSkills[cls.id].forEach(function(ms){if(mLv>=ms.masteryLv)s.activeSkills.push({...ms});}); }
    var sk = s.rng.pick(cls.skills);
    s.activeSkills.unshift({...sk}); s.activeSkill = s.activeSkills[0]; s.skillLevels = {}; s.skillLevels[sk.id] = 1;
    loadOutgameEquipToState(s);
    initBossRush();
  });
  switchScreen("class-select");
}

// v0.80: 向 build-mode.js 和 modes.js 注入 main.js 中仍保留的回调
injectBuildCallbacks({ loadOutgameEquipToState: loadOutgameEquipToState, initBossRush: initBossRush, initEndlessChallengeZone: initEndlessChallengeZone });
injectModeCallbacks({ enterRoom: enterRoom, gameClear: gameClear, updateBattleBg: updateBattleBg });

// 地下城/天梯启动（由 dungeon-hub.js 通过 EventBus 触发）
function startDungeon(dungeonId) {
  Game.hardReset(); var s = Game.state; s.mode = 'dungeon'; s.dungeonId = dungeonId; s.dungeonFloor = 0;
  var dg = R.get('dungeons', dungeonId); if(!dg) return;
  s.seed = 'dungeon_'+dungeonId+'_'+Date.now(); s.rng = new RNG(s.seed); s.difficulty = 'standard';
  buildClassSelect(function(cls){
    s.playerClass = cls;
    s.player = { hp:cls.hp, maxHp:cls.maxHp, mp:cls.maxMp, maxMp:cls.maxMp, atk:cls.atk, def:cls.def, critRate:cls.critRate, critMul:cls.critMul, skillMul:cls.skillMul, mpCost:cls.mpCost, pen:cls.pen, lifeSteal:0, thorn:0, goldMul:1, dodge:cls.dodge||0, bleed:0, rage:false, doubleFirst:false, debuffAtk:null, dmgReduce:0, berserk:false, rebirth:false, regen:0, energy:3, maxEnergy:3 };
    Game.applyMetaBonus(s.player);
    var mSkills = R.get('classMasterySkills'); var mLv = Game.getMasteryLevel(cls.id);
    if(mLv>=3&&mSkills&&mSkills[cls.id]){mSkills[cls.id].forEach(function(ms){if(mLv>=ms.masteryLv)s.activeSkills.push({...ms});});}
    var sk = s.rng.pick(cls.skills); s.activeSkills.unshift({...sk}); s.activeSkill=s.activeSkills[0]; s.skillLevels={};s.skillLevels[sk.id]=1;
    loadOutgameEquipToState(s);
    initDungeonZone(dg);
  });
  switchScreen('class-select');
}
function initDungeonZone(dg) {
  var s = Game.state;
  s.zone = { id:'dungeon_'+dg.id, name:dg.name, icon:dg.icon, enemyPool:dg.enemyPool, scale:1+(Game.meta.dungeon.clears[dg.id]||0)*0.02, modifier:{id:'dungeon',desc:dg.name} };
  s._roomPool = []; for(var i=0;i<dg.floors-1;i++) s._roomPool.push('battle'); s._roomPool.push('boss');
  s._bossReady = false; s.floorInZone = 1; s.totalFloor = 1;
  enterRoom();
}
function startTower() {
  Game.hardReset(); var s = Game.state; s.mode = 'tower'; s.towerFloor = 0; s.towerCombo = 0; s.towerMaxCombo = 0; s.towerRestCount = 0;
  s.seed = 'tower_'+Date.now(); s.rng = new RNG(s.seed); s.difficulty = 'hell';
  buildClassSelect(function(cls){
    s.playerClass = cls;
    s.player = { hp:cls.hp, maxHp:cls.maxHp, mp:cls.maxMp, maxMp:cls.maxMp, atk:cls.atk, def:cls.def, critRate:cls.critRate, critMul:cls.critMul, skillMul:cls.skillMul, mpCost:cls.mpCost, pen:cls.pen, lifeSteal:0, thorn:0, goldMul:1, dodge:cls.dodge||0, bleed:0, rage:false, doubleFirst:false, debuffAtk:null, dmgReduce:0, berserk:false, rebirth:false, regen:0, energy:3, maxEnergy:3 };
    Game.applyMetaBonus(s.player);
    var mSkills = R.get('classMasterySkills'); var mLv = Game.getMasteryLevel(cls.id);
    if(mLv>=3&&mSkills&&mSkills[cls.id]){mSkills[cls.id].forEach(function(ms){if(mLv>=ms.masteryLv)s.activeSkills.push({...ms});});}
    var sk = s.rng.pick(cls.skills); s.activeSkills.unshift({...sk}); s.activeSkill=s.activeSkills[0]; s.skillLevels={};s.skillLevels[sk.id]=1;
    loadOutgameEquipToState(s);
    nextTowerFloor();
  });
  switchScreen('class-select');
}
function nextTowerFloor() {
  var s = Game.state; s.towerFloor++; s.totalFloor = s.towerFloor;
  var scale = 1 + s.towerFloor * 0.08;
  var isBossFloor = s.towerFloor % 10 === 0;
  if(isBossFloor){
    var bosses = Object.values(R.get('bosses')||{}).concat(Object.values(R.get('bosses_hell')||{}));
    var bd = s.rng.pick(bosses);
    s.enemy = { name:bd.name, hp:Math.floor(bd.hp*scale), maxHp:Math.floor(bd.hp*scale), atk:Math.floor(bd.atk*scale), def:bd.def+s.towerFloor, tags:[], _buffs:[], aiTurn:0, skill:bd.skill };
    s.enemies = [s.enemy]; s._currentRoomType = 'boss';
  } else {
    var poolName = 'tower_upper'; var pool = (R.get('enemies')||{})[poolName]||[];
    var ed = pool.length>0?s.rng.pick(pool):{name:'深渊守卫',hp:80,atk:12,def:2,icon:'👹'};
    var count = s.towerFloor>=20?3:(s.towerFloor>=10?2:1);
    s.enemies = []; for(var i=0;i<count;i++){ s.enemies.push({name:ed.name+'#'+(i+1),hp:Math.floor(ed.hp*scale),maxHp:Math.floor(ed.hp*scale),atk:Math.floor(ed.atk*scale),def:Math.floor((ed.def||0)*scale),tags:[],_buffs:[],aiTurn:0}); }
    s.enemy = s.enemies[0]; s.selectedTarget = 0; s._currentRoomType = 'battle';
  }
  // 混沌词缀（每10层）
  if(s.towerFloor%10===0&&s.towerFloor>0){
    var mods = R.get('towerMods')||[]; if(mods.length>0){ var m = s.rng.pick(mods); m.apply(s); log('<span class="warn">🌀 天梯词缀：'+m.name+' — '+m.desc+'</span>'); }
  }
  updateBattleBg(); Combat.startBattle(isBossFloor?'boss':'normal'); switchScreen('main');
}
// v0.60 保留原 startNewGame（普通模式入口，被新模式函数扩展但保持兼容）
function startNewGame() {
  const inputEl = document.getElementById("seed-input");
  const input = inputEl ? inputEl.value.trim() : "";
  if (Game.meta.studiedRelic && Game.meta.studiedDate === new Date().toDateString()) {
    if (!Game.meta.studiedPity) Game.meta.studiedPity = 0;
    Game.meta.studiedPity++;
    Game.saveMeta();
  }
  Game.hardReset();
  const s = Game.state;
  var _origPush = s.curses.push;
  s.curses.push = function() { var r = _origPush.apply(this, arguments); try { Synergy.checkCurseSynergies(); } catch(e) {} return r; };
  s.seed = input || ("" + Date.now());
  s.rng = new RNG(s.seed);
  let pickedDiff = null;
  buildDifficultySelect(diff => {
    pickedDiff = diff;
    s.difficulty = diff.id;
    s._pendingFortune = getDailyFortune();
    Game.saveMeta();
    document.querySelectorAll("#diff-grid .card").forEach(c => c.style.opacity = "0.5");
    const sel = document.querySelector(`#diff-grid .card[data-diff="${diff.id}"]`);
    if (sel) { sel.style.opacity = "1"; sel.style.borderColor = "#ffa502"; }
  });
  buildClassSelect(cls => {
    if (!pickedDiff) { toast("请先选择难度"); return; }
    pickClass(cls);
  });
  switchScreen("difficulty-select");
  if ((Game.meta.onboardingStage || 0) === 0) {
    setTimeout(function(){ showTutorialById('pick'); }, 400);
  }
}

function pickClass(cls) {
  console.log("[妖塔勇者录] pickClass:", cls.name);
  const s = Game.state;
  s.playerClass = cls;
  s.player = {
    hp: cls.hp, maxHp: cls.maxHp, mp: cls.maxMp, maxMp: cls.maxMp,
    atk: cls.atk, def: cls.def, critRate: cls.critRate, critMul: cls.critMul,
    skillMul: cls.skillMul, mpCost: cls.mpCost, pen: cls.pen,
    lifeSteal: cls.lifesteal || 0, thorn: 0, goldMul: 1, dodge: cls.dodge || 0, bleed: 0,
    rage: false, doubleFirst: false, debuffAtk: null, dmgReduce: 0,
    berserk: false, rebirth: false, regen: 0,
    energy: 3, maxEnergy: 3
  };
  // 影卫被动：击杀回复20%生命
  if (cls.id === "shadow") s.player._shadowBorn = true;
  Game.applyMetaBonus(s.player);
  Game.applyMasteryBonuses(s.player, cls.id); // v0.50 职业精通加成
  Game.applyAdvancementBonuses(s.player, cls.id); // v0.50 转职加成
  Game.applyAwakeningBonuses(s.player, cls.id); // v0.50 觉醒加成
  Game.applyBrandBonuses(s.player); // v0.50 命运烙印加成
  // v0.60: 烙印「咒王」— 开局获得1个随机诅咒（双刃剑，立刻生效）
  if (s.player._brandStartCurseChoice) {
    var startCurse = s.rng.pick(R.get('curses') || []);
    if (startCurse) {
      s.curses.push(startCurse);
      startCurse.apply(s.player);
      log('<span class="warn">💀 咒王烙印：开局获得诅咒「' + startCurse.name + '」</span>');
    }
  }
  // v0.60: 所有局外/精通/转职/觉醒/烙印加成应用完毕，应用最终硬上限
  Game.applyFinalCaps(s.player);
  // v0.51 天赋大点·开局稀有遗物
  if (s.player._keystoneStartRareRelic) {
    var rareRelics = (R.get('relics') || []).filter(function(r) { return r.rarity === 'rare' || r.rarity === 'epic'; });
    if (rareRelics.length > 0) {
      var startRelic = { ...s.rng.pick(rareRelics) };
      if (startRelic.onAcquire && !startRelic._acquired) { startRelic.onAcquire(s.player, s); startRelic._acquired = true; }
      if (startRelic.passive && !startRelic.applied) { startRelic.passive(s.player); startRelic.applied = true; }
      startRelic.stars = 1;
      s.relics.push(startRelic);
      if (!Game.meta.discoveredRelics) Game.meta.discoveredRelics = [];
      if (!Game.meta.discoveredRelics.includes(startRelic.id)) { Game.meta.discoveredRelics.push(startRelic.id); Game.saveMeta(); }
      log('<span class="win">🌟 天赋赐福：开局获得' + startRelic.name + '！</span>');
    }
  }
  // v0.50 星象日星应用
  var stars = Game.meta.stars;
  if (stars && stars.daily) {
    var ds = stars.daily;
    if (ds.name === '荧惑守心') { s._startRelic = true; }
    if (ds.name === '太白经天') { s._firstTurnDmg = 2; }
    if (ds.name === '镇星不动') { s._bossDmgRed = 0.3; }
    log('<span class="win">☀️ 日星「' + ds.name + '」生效：' + ds.desc + '</span>');
  }
  // v0.50 恒星永久加成
  if (stars && stars.permanent && stars.permanent.length > 0) {
    stars.permanent.forEach(function(ss) {
      if (ss.name === '武曲') s.player.atk = Math.floor(s.player.atk * 1.03);
      if (ss.name === '天相') s._shopDiscount = (s._shopDiscount||0) + 0.08;
      if (ss.name === '七杀') s.player.critMul = (s.player.critMul||1.5) + 0.10;
      if (ss.name === '破军') s.player.pen = (s.player.pen||0) + 0.08;
      if (ss.name === '贪狼') s.player.lifeSteal = (s.player.lifeSteal||0) + 0.05;
    });
  }
  // v0.50 回忆加成
  var lore = Game.meta.unlockedLore || [];
  if (lore.includes('lore_human')) s.player.maxHp = Math.floor(s.player.maxHp * 1.02);
  if (lore.includes('lore_demon')) s.player.atk = Math.floor(s.player.atk * 1.02);
  if (lore.includes('lore_ancient')) s.player.def = Math.floor(s.player.def * 1.02);
  if (lore.includes('lore_final')) { s.player.atk = Math.floor(s.player.atk * 1.03); s.player.maxHp = Math.floor(s.player.maxHp * 1.03); }
  // v0.50 精通Lv3/10解锁技能
  var masteryLv = Game.getMasteryLevel(cls.id);
  if (masteryLv >= 3) {
    var masterySkills = R.get('classMasterySkills');
    if (masterySkills && masterySkills[cls.id]) {
      masterySkills[cls.id].forEach(function(ms) {
        if (masteryLv >= ms.masteryLv) s.activeSkills.push({ ...ms });
      });
    }
  }
  // v0.50 精通Lv5解锁专属遗物
  if (masteryLv >= 5) {
    var masteryRelics = R.get('classMasteryRelics');
    if (masteryRelics && masteryRelics[cls.id]) {
      var mRelic = { ...masteryRelics[cls.id] };
      mRelic.passive = function(p) { p['_' + mRelic.id] = true; };
      mRelic.onRemove = function(p) { p['_' + mRelic.id] = false; };
      mRelic.passive(s.player);
      s.relics.push(mRelic);
    }
  }
  // 开局药水
  const startPots = Game.getStartPotions();
  s.potions.push(...startPots);
  // 应用运势和遗产（player已创建）
  if (s._pendingFortune) { s._pendingFortune.apply(s); s._fortuneName = s._pendingFortune.name; if (s._pendingFortune.mutation) { s._pendingFortune.mutation.apply(s); s._mutationName = s._pendingFortune.mutation.name; } s._pendingFortune = null; }
  applyLegacy(s);

  // 开局选1个本命技能（保留已解锁的精通技能，不覆盖）
  buildSkillSelect(cls, function(sk) {
    s.activeSkills.unshift({ ...sk }); // 放在第一位，保留 masteryLv>=3 已push的精通技能
    s.activeSkill = s.activeSkills[0];
    s.skillLevels = {};
    s.skillLevels[sk.id] = 1;
    // 开局变数三选一
    buildStartBonus(function() {
      if (!s.noTalent) {
        buildTalentSelect(function(tal) {
          s.talent = tal;
          tal.apply(s.player);
          // 元素亲和/迅捷赐福：现有技能CD-1
          if (tal.id === 'mage' || s.player._blessingSwift) { s.activeSkills.forEach(function(sk) { /* sk.cooldown mutation removed — handled via runtime cdReduction in combat.js doSkill() */ }); }
          // 追猎目标选择（在天赋之后，进入区域之前）
          buildHuntSelect(function() {
            initZone("plains");
          });
        });
        switchScreen("talent-select");
      } else {
        // 每日挑战无天赋：直接追猎选择
        buildHuntSelect(function() {
          initZone("plains");
        });
      }
    });
    switchScreen("talent-select"); // 复用天赋选择屏幕
  });
  switchScreen("skill-select");
}

function initZone(zoneId) {
  console.log("[妖塔勇者录] initZone zoneId=", zoneId);
  Room.initZone(zoneId);
  // 新手引导：首次进入战斗前展示战斗基础
  if ((Game.meta.onboardingStage || 0) === 0) {
    setTimeout(function(){ showTutorialById('battle'); }, 300);
  }
  enterRoom();
}

// ---- 进入房间：默认直入，偶尔出现岔路 ----
// 暖场3间不出岔路，之后战斗有30%概率出岔路；特殊房间直接入
export function enterRoom() {
  const s = Game.state;
  Room.prepareRoomEntry();

  const roomType = Room.drawOne();
  console.log("[妖塔勇者录] drawOne:", roomType, "pool剩余:", s._roomPool.length);

  // 无尽深渊：池空→下一张无尽图
  if (!roomType && s.endless) {
    s.endlessFloor++;
    // v0.70: 混沌词条按实际战斗层数触发（每10层），而非zone循环计数
    var nextChaosAt = s._nextChaosFloor || 10;
    if (s.totalFloor >= nextChaosAt) {
      s._nextChaosFloor = nextChaosAt + 10;
      showChaosModifier(); return;
    }
    initEndlessZone();
    return;
  }

  // Zone 结束 → 分支或通关
  if (!roomType) {
    if (Room.isFinalZone(s.zone.id)) { gameClear(); return; }
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
      console.log("[妖塔勇者录] 岔路:", roomType, "vs", other, riskDoor ? "(风险门!)" : "");
      const rs = document.getElementById('room-select');
      if (rs) { var _zid = s.zone ? s.zone.id : 'tower'; var _hasBg = ['plains','forest','cave','ruins','frozen','voidgate','tower','desert','swamp','tower_lower','tower_upper'].indexOf(_zid) >= 0; rs.style.backgroundImage = 'url(\'img/bg-battle-' + (_hasBg ? _zid : 'tower') + '.webp?v=033\')'; }
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

export function updateBattleBg() {
  const s = Game.state;
  const zoneId = s.zone ? s.zone.id : 'plains';
  // v0.70: boss_rush/dungeon等虚拟Zone回退到默认背景
  var bgFile = 'img/bg-battle-' + zoneId + '.webp?v=033';
  var fallbackBg = 'img/bg-battle-tower.webp?v=033';
  // 已知有背景的Zone列表
  var knownBgs = ['plains','forest','cave','ruins','frozen','voidgate','tower','desert','swamp','tower_lower','tower_upper'];
  if (knownBgs.indexOf(zoneId) === -1) bgFile = fallbackBg;
  const main = document.getElementById('main');
  if (main) main.style.backgroundImage = 'url(\'' + bgFile + '\')';
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
  // v0.50 分支结局追踪
  var zs = Game.state._zoneStats || { battles: 0, eventsPerfect: 0, sacrifices: 0 };
  if (roomId === "battle" || roomId === "elite" || roomId === "boss") zs.battles++;
  if (roomId === "event") zs.eventsPerfect++; // 默认完美，失败在event中扣
  Game.state._zoneStats = zs;

  // 隐藏分岔路界面，防止门和弹窗重叠可点击
  const rs = document.getElementById('room-select');
  if (rs) rs.classList.add('hidden');

  showRoomPreview(roomId, function() {
    try {
      Game.state._currentRoomType = roomId;
      if (roomId === "shop") { openShop(); }
      else if (roomId === "event" || roomId === "shrine" || roomId === "altar") { openEvent(roomId); }
      else if (roomId === "chest") { openChest(); }
      else if (roomId === "boss") { updateBattleBg(); playMusic('boss'); Combat.startBattle("boss"); switchScreen("main"); }
      else if (roomId === "elite") { updateBattleBg(); playMusic('battle'); Combat.startBattle("elite"); switchScreen("main"); }
      else { updateBattleBg(); playMusic('battle'); Combat.startBattle("normal"); switchScreen("main"); }
    } catch(e) {
      console.error("[妖塔勇者录] processRoom 崩溃:", e);
      toast("出错了，请刷新页面。错误已记录到控制台");
      // v0.80: 状态完整性检查——如果崩溃后player为空，自动回开始界面
      if (!Game.state.player) { Game.hardReset(); switchScreen("start"); render(Game.state); log("<span class='warn'>⚠️ 游戏状态异常，已自动重置</span>"); }
      Game.sync();
    }
  });
}

function nextRoom() {
  const s = Game.state;
  if (Room.isZoneEnd()) {
    // v0.50 分支结局判定
    var ending = Room.checkZoneEnding();
    if (ending) {
      var reward = Room.getZoneEndingReward(ending);
      if (reward) {
        log('<span class="win">' + reward.text + '</span>');
        if (reward.memoryFragments) Game.meta.memoryFragments = (Game.meta.memoryFragments||0) + reward.memoryFragments;
        if (reward.materials) Game.addMaterials(reward.materials);
        if (reward.essence) Game.addEssence(reward.essence);
        Game.saveMeta();
      }
    }
    if (Room.isFinalZone(s.zone.id)) { gameClear(); return; }
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
  try {
  const s = Game.state;
  const roomType = s._currentRoomType;
  // v0.60 无尽/BossRush：跳过所有局内奖励弹窗，直接下一房间
  var isChallengeMode = s.mode === 'boss_rush' || s.mode === 'endless_challenge' || s.endless;
  if (isChallengeMode) {
    if (s.mode === 'boss_rush') {
      s.bossRushIndex++;
      // v0.70: 战后回复 — 每击败Boss回复25%最大生命+额外能量
      var brHeal = Math.floor(s.player.maxHp * 0.25);
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + brHeal);
      s.player.energy = Math.min(s.player.maxEnergy + 2, (s.player.energy || 0) + 2);
      s._bossRushHP = s.player.hp;
      log('<span class="win">💀 击败第' + s.bossRushIndex + '个Boss！</span>');
      hideModal("reward");
      nextBossRushStage();
    } else {
      // 无尽模式：直接enterRoom跳过zone结束检测
      hideModal("reward");
      Room.advanceFloor();
      enterRoom();
    }
    return;
  }
  // 心魔镜像战：胜利给传说遗物
  if (s._mirrorFight) {
    s._mirrorFight = false;
    Game.recordKill("心魔镜像", s.totalFloor, { maxHp: 100, atk: s.player ? s.player.atk : 20, def: 5 });
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
    // v0.60 深渊裂隙钥匙碎片掉落（每个Boss必掉1-2个）
    if (!Game.meta.dungeon) Game.meta.dungeon = { keys:0, keyFragments:0, totalCleared:0, bossMarks:{}, clears:{}, forge:{enchantAtk:0,enchantHp:0,enchantDef:0,enchantCrit:0,enchantPen:0,enchantVamp:0,refineAtk:0,refineHp:0,refineDef:0,runes:[]}, tower:{bestScore:0,bestFloor:0,seasonScore:0,seasonFloor:0,combo:0,maxCombo:0} };
    var fragCount = zoneId === 'tower' || zoneId === 'voidgate' ? 2 : 1;
    Game.meta.dungeon.keyFragments = (Game.meta.dungeon.keyFragments || 0) + fragCount;
    if (Game.meta.dungeon.keyFragments >= 10) {
      Game.meta.dungeon.keyFragments -= 10;
      Game.meta.dungeon.keys = (Game.meta.dungeon.keys || 0) + 1;
      log('<span class="win">🔑 集齐10个裂隙碎片，合成1把裂隙钥匙！</span>');
      toast('🔑 获得裂隙钥匙！可进入深渊裂隙副本');
    }
    Game.saveMeta();
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
    // 悬赏官猎杀令（v0.60: 奖励改为灵石）
    var bounty = Game.meta.activeBounty;
    if (bounty) {
      var bossName = s.enemy ? s.enemy.name : '';
      if (bossName.indexOf(bounty.boss) >= 0) {
        Game.meta.stones = (Game.meta.stones || 0) + bounty.reward;
        log('<span class="win">🎯 猎杀令完成！+💎' + bounty.reward + '灵石</span>');
        toast('🎯 猎杀令完成！+' + bounty.reward + '灵石');
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
  // 新手引导：首战胜利后展示完成提示（延迟等奖励弹窗关闭）
  if ((Game.meta.onboardingStage || 0) === 0 && document.getElementById('tutorial-overlay')) {
    setTimeout(function(){ showTutorialById('done'); }, 500);
  }
  } catch(e) {
    console.error("[main] onWin崩溃:", e);
    toast("奖励异常，点击继续");
    var list2 = document.getElementById("reward-list");
    if (list2) { list2.innerHTML = ''; var errBtn = document.createElement('button'); errBtn.className = 'modal-btn'; errBtn.textContent = '继续冒险'; errBtn.onclick = function() { hideModal("reward"); nextRoom(); }; list2.appendChild(errBtn); showModal("reward"); }
    else { nextRoom(); }
  }
}

function onGameOver() {
  const s = Game.state;
  stopMusic(); playMusic('defeat');
  Game.meta.totalDeaths++;
  // v0.70 无尽/BossRush评分（使用实际战斗层数totalFloor而非循环计数endlessFloor）
  var scoreText = '';
  if (s.mode === 'endless_challenge' || s.endless) {
    var actualFloor = s.totalFloor || 0;
    var score = actualFloor * 100 + (s._runKills||0) * 5 + (s.stats.roomsCleared||0) * 2;
    if (!Game.meta.endlessBest || score > (Game.meta.endlessBest.score||0)) {
      Game.meta.endlessBest = { score:score, floor:actualFloor, kills:s._runKills||0, date:new Date().toLocaleDateString() };
    }
    if (actualFloor > (Game.meta.highestEndless||0)) Game.meta.highestEndless = actualFloor;
    scoreText = '🌀 无尽深渊 · 第' + actualFloor + '层 · 评分:' + score;
  }
  if (s.mode === 'boss_rush') {
    var hpPct = s.player ? Math.floor(s.player.hp / s.player.maxHp * 100) : 0;
    var brScore = s.bossRushIndex * 200 + hpPct;
    if (!Game.meta.bossRushBest || brScore > (Game.meta.bossRushBest.score||0)) {
      Game.meta.bossRushBest = { score:brScore, defeated:s.bossRushIndex, hpPct:hpPct, date:new Date().toLocaleDateString() };
    }
    scoreText = '💀 击败Boss:' + s.bossRushIndex + '/50 · 评分:' + brScore;
  }
  // 战斗记录
  saveRunHistory(false);
  var legacy = saveLegacy();
  if (legacy) log('<span class="info">📦 遗产仓库：' + (legacy.data.name || '物品') + '已保存，下局可用</span>');
  // v0.70 无尽/BR货币加成（使用实际层数）
  var modeMul = (s.mode === 'endless_challenge' || s.endless || s.mode === 'boss_rush') ? 2 : 1;
  const essence = Prog.calcEssence(s.totalFloor, false) * modeMul;
  const souls = Math.floor(s.totalFloor / 5) * modeMul;
  const stones = (s.mode === 'endless_challenge' || s.endless) ? Math.floor(s.totalFloor / 5) * modeMul : (s.totalFloor >= 10 ? Math.floor(s.totalFloor / 10) * modeMul : 0);
  if (essence > 0) { Game.addEssence(essence); }
  if (souls > 0) { Game.addSouls(souls); }
  if (stones > 0) { Game.addStones(stones); }
  Game.addForgeStones(Prog.calcForgeStones(false, s.difficulty, s.totalFloor));
  Game.addMaterials(Prog.calcMaterials(s.totalFloor, false));
  Game.addLeaderboard({ char: s.playerClass ? s.playerClass.name : "--", diff: s.difficulty, floor: s.totalFloor });
  Prog.awardCharExp(s);
  var newStage = Game.checkOnboarding();
  if (newStage >= 0) showStageUpPopup(newStage);
  Game.saveMeta();
  var deathForge = Prog.calcForgeStones(false, s.difficulty, s.totalFloor);
  var rewards = [essence > 0 ? `${essence} 灵蕴` : '', souls > 0 ? `${souls} 魂晶` : '', stones > 0 ? `${stones} 灵石` : '', deathForge > 0 ? `锻石+${deathForge}` : ''].filter(Boolean).join(' + ');
  if (scoreText) rewards += ' | ' + scoreText;
  showGameOver(false, rewards || "无奖励");
}

// v0.80 无尽见好就收 — 改为命名函数，由按钮绑定处 addEventListener
function retreatEndless() {
  var s = Game.state;
  if (!s.endless && s.mode !== 'endless_challenge') return;
  stopMusic(); playMusic('defeat');
  var actualFloor = s.totalFloor || 0;
  var score = actualFloor * 100 + (s._runKills||0) * 5 + (s.stats.roomsCleared||0) * 2;
  if (!Game.meta.endlessBest || score > (Game.meta.endlessBest.score||0)) {
    Game.meta.endlessBest = { score:score, floor:actualFloor, kills:s._runKills||0, date:new Date().toLocaleDateString() };
  }
  if (actualFloor > (Game.meta.highestEndless||0)) Game.meta.highestEndless = actualFloor;
  Game.meta.totalRuns = (Game.meta.totalRuns||0) + 1;
  var stones = Math.floor(actualFloor / 5) * 2;
  var essence = Prog.calcEssence(actualFloor, true);
  if (stones > 0) Game.addStones(stones);
  if (essence > 0) Game.addEssence(essence);
  Game.addForgeStones(Prog.calcForgeStones(true, s.difficulty, actualFloor));
  Game.addMaterials(Prog.calcMaterials(actualFloor, true));
  Game.saveMeta();
  Game.deleteSave();
  s.gameOver = true;
  showGameOver(true, '🏳️ 见好就收！第' + actualFloor + '层 · 评分:' + score + ' 💎+' + stones);
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
    lines: ["魔王发出最后的嘶吼……","黑暗从魔塔中褪去。","边境城池迎来了久违的黎明。","勇士，你的名字将被刻入史册。","—— 妖塔勇者录 · 终章 ——","感谢游玩。"],
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
  var eIcon = document.getElementById("ending-icon"); if (eIcon) eIcon.textContent = ending.icon;
  var eTitle = document.getElementById("ending-title"); if (eTitle) eTitle.textContent = ending.title;
  var txt = document.getElementById("ending-text");
  if (!txt) return;
  txt.innerHTML = "";
  // 打字机：逐行显示（全部在同一卡片内）
  var li = 0, ci = 0;
  function typeLine() {
    if (li >= ending.lines.length) return;
    if (ci === 0) { var d = document.createElement("div"); d.id = "end-line-" + li; if (txt) txt.appendChild(d); }
    var lineEl = document.getElementById("end-line-" + li);
    if (!lineEl) return;
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

// v0.51 首次通关纪念动画
function showFirstClearCelebration(title) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer';
  overlay.innerHTML = '<div style="color:#ffdd77;font-size:48px;font-weight:bold;animation:bigFloatPop .6s ease-out forwards">🏆</div>' +
    '<div style="color:#ffdd77;font-size:36px;font-weight:bold;margin-top:20px;animation:bigFloatPop .8s ease-out forwards">' + title + '</div>' +
    '<div style="color:#8899aa;font-size:14px;margin-top:30px;animation:bigFloatPop 1s ease-out forwards">点击任意位置继续</div>';
  document.body.appendChild(overlay);
  overlay.onclick = function() { document.body.removeChild(overlay); };
  setTimeout(function() { if (document.body.contains(overlay)) document.body.removeChild(overlay); }, 8000);
}

function gameClear() {
  const s = Game.state;
  stopMusic(); playMusic('victory');
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

// ===================== 无尽深渊混沌词条 v0.80 =====================
// 数据统一在 content/chaos-mods.js (R.get('chaosMods'))
// 去重改用 mod.id 替代 mod.name 字符串匹配

function showChaosModifier() {
  var s = Game.state;
  var el = document.getElementById("reward");
  if (!el) return;
  var list = document.getElementById("reward-list");
  if (!list) return;
  list.innerHTML = "";
  var hdr = document.createElement("div");
  hdr.style.cssText = "color:#ff4444;font-size:16px;font-weight:bold;margin-bottom:8px;text-align:center;grid-column:1/-1";
  hdr.textContent = "🌀 混沌降临 · 第" + (s.totalFloor || s.endlessFloor) + "层";
  list.appendChild(hdr);
  list.style.display = "grid"; list.style.gridTemplateColumns = "1fr 1fr"; list.style.gap = "8px";

  // v0.80: 从 Registry 读取统一数据源
  var currentFloor = s.totalFloor || 0;
  var tiers = R.get('chaosMods');
  var pool;
  if (currentFloor <= 30) {
    pool = tiers ? tiers.tier1 : [];
  } else if (currentFloor <= 60) {
    pool = tiers ? tiers.tier2 : [];
  } else {
    pool = tiers ? tiers.tier3 : [];
  }
  if (!pool || pool.length === 0) return;
  var picks = s.rng.pickMulti(pool, 3);
  if (!s._appliedMutationIds) s._appliedMutationIds = []; // v0.80: ID 去重替代 name 字符串

  picks.forEach(function(mod) {
    var card = document.createElement("div");
    card.style.cssText = "background:#1a0a0a;border:2px solid #8b0000;border-radius:10px;padding:14px;text-align:center;cursor:pointer;transition:all .15s";
    card.innerHTML = "<div style=\"font-size:28px;margin-bottom:6px\">🌀</div><div style=\"color:#ff7b7b;font-weight:bold;font-size:14px\">" + mod.name + "</div><div style=\"color:#8899bb;font-size:11px\">" + mod.desc + "</div>";
    card.onmouseenter = function(){this.style.borderColor="#ff4444";this.style.transform="scale(1.04)";};
    card.onmouseleave = function(){this.style.borderColor="#8b0000";this.style.transform="scale(1)";};
    card.onclick = function() {
      var modId = mod.id || mod.name;
      if (s._appliedMutationIds && s._appliedMutationIds.indexOf(modId) >= 0) {
        log("<span class='info'>🌀 已拥有此混沌词条，选择其他</span>");
        return;
      }
      mod.apply(s);
      if (!s._appliedMutations) s._appliedMutations = [];
      if (!s._appliedMutationIds) s._appliedMutationIds = [];
      s._appliedMutations.push(mod.name);
      s._appliedMutationIds.push(modId);
      log("<span class='warn'>🌀 混沌词条：" + mod.name + "（共" + s._appliedMutations.length + "个）</span>");
      el.style.display = "none";
      hideModal("reward");
      if (s.mode === 'endless_challenge') {
        initEndlessChallengeZone();
      } else {
        initEndlessZone();
      }
    };
    list.appendChild(card);
  });
  showModal("reward");
}

// ===================== 离线小屋 =====================
function showHunterLodge() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block"; var h3 = el.querySelector("h3"); if (h3) h3.textContent = "🏚️ 猎人小屋";
  var subtitle = document.getElementById("meta-subtitle"); if (subtitle) subtitle.innerHTML = '';
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
  // 离线收益：前2h全价，之后70%效率，最低50%保底
  var decayedHours = offlineHours <= 2 ? offlineHours : Math.max(offlineHours * 0.5, 2 + (offlineHours - 2) * 0.7);
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

// v0.80: initEndlessZone → js/systems/modes.js

function doGameClear() {
  const s = Game.state;
  Game.meta.totalWins++;
  // all_classes 追踪
  if (!Game.meta.clearedClasses) Game.meta.clearedClasses = [];
  var cid = s.playerClass ? s.playerClass.id : null;
  // all_classes: 至少标准难度才算
  if (cid && s.difficulty && !s.difficulty.startsWith('casual') && !Game.meta.clearedClasses.includes(cid)) {
    Game.meta.clearedClasses.push(cid);
    if (Game.meta.clearedClasses.length >= 5) Game.unlockAchievement("all_classes");
  }
  saveRunHistory(true);
  // 通关时也保存遗产
  var legacy = saveLegacy();
  if (legacy) log('<span class="info">📦 遗产仓库：' + (legacy.data.name || '物品') + '已保存，下局可用</span>');
  // 难度币+灵石：通关奖励
  if (!Game.meta.difficultyCoins) Game.meta.difficultyCoins = 0;
  Game.meta.difficultyCoins++;
  Game.addStones(10 + (s.zoneIndex || 0) * 3);
  if (s.mode === "simple" && Game.meta.highestSimple < s.totalFloor) Game.meta.highestSimple = s.totalFloor;
  const essence = Prog.calcEssence(s.totalFloor, true);
  const souls = 10 + s.totalFloor;
  Game.addEssence(essence);
  Game.addSouls(souls);
  Game.addForgeStones(Prog.calcForgeStones(true, s.difficulty));
  Game.addMaterials(Prog.calcMaterials(s.totalFloor, true));
  // v0.81: 地下城通关结算
  if (s.mode === 'dungeon' && s.dungeonId) {
    var dg = Game.meta.dungeon;
    if (!dg) { Game.meta.dungeon = { keys:0, keyFragments:0, totalCleared:0, bossMarks:{}, clears:{}, forge:{enchantAtk:0,enchantHp:0,enchantDef:0,enchantCrit:0,enchantPen:0,enchantVamp:0,refineAtk:0,refineHp:0,refineDef:0,runes:[]}, tower:{bestScore:0,bestFloor:0,seasonScore:0,seasonFloor:0,combo:0,maxCombo:0} }; dg = Game.meta.dungeon; }
    if (!dg.clears) dg.clears = {};
    dg.clears[s.dungeonId] = (dg.clears[s.dungeonId] || 0) + 1;
    dg.totalCleared = (dg.totalCleared || 0) + 1;
    dg.keys = (dg.keys || 0) + 1; // 返还钥匙
    var matBonus = 3 + (dg.clears[s.dungeonId] || 1);
    Game.addMaterials(matBonus);
    log('<span class="win">⛏️ 地下城通关！+' + matBonus + '材料 +1钥匙 (已通关' + dg.clears[s.dungeonId] + '次)</span>');
    // Boss 符文掉落 (15%)
    var runeMap = { plains:'fire', forest:'light', cave:'ice', ruins:'dark', frozen:'water', voidgate:'earth', tower:'thunder' };
    var runeId = runeMap[s.dungeonId];
    if (runeId && s.rng.chance(0.15)) {
      if (!dg.forge.runes) dg.forge.runes = [];
      if (dg.forge.runes.indexOf(runeId) < 0) { dg.forge.runes.push(runeId); log('<span class="win">💎 获得符文：' + runeId + '！</span>'); }
    }
  }
  // v0.81: 天梯分数记录
  if (s.mode === 'tower') {
    var dg2 = Game.meta.dungeon;
    if (!dg2) { Game.meta.dungeon = { keys:0, keyFragments:0, totalCleared:0, bossMarks:{}, clears:{}, forge:{enchantAtk:0,enchantHp:0,enchantDef:0,enchantCrit:0,enchantPen:0,enchantVamp:0,refineAtk:0,refineHp:0,refineDef:0,runes:[]}, tower:{bestScore:0,bestFloor:0,seasonScore:0,seasonFloor:0,combo:0,maxCombo:0} }; dg2 = Game.meta.dungeon; }
    if (!dg2.tower) dg2.tower = {bestScore:0,bestFloor:0,seasonScore:0,seasonFloor:0,combo:0,maxCombo:0};
    if (s.totalFloor > (dg2.tower.bestFloor || 0)) { dg2.tower.bestFloor = s.totalFloor; dg2.tower.bestScore = s.totalFloor * 100 + (s._runKills||0) * 5; }
    dg2.tower.seasonFloor = Math.max(dg2.tower.seasonFloor || 0, s.totalFloor);
  }
  Game.addLeaderboard({ char: s.playerClass ? s.playerClass.name : "--", diff: s.difficulty, floor: s.totalFloor });
  Prog.awardCharExp(s);
  var newStage2 = Game.checkOnboarding();
  if (newStage2 >= 0) showStageUpPopup(newStage2);
  // 难度递进解锁：通关简单→解锁普通，通关普通→解锁炼狱
  const diff = R.get('difficulties', s.difficulty);
  if (diff && diff.next) {
    if (!Game.meta.unlockedDiffs) Game.meta.unlockedDiffs = ["casual"];
    if (!Game.meta.unlockedDiffs.includes(diff.next)) {
      Game.meta.unlockedDiffs.push(diff.next);
      const nextDiff = R.get('difficulties', diff.next);
      console.log("[妖塔勇者录] 解锁新难度:", nextDiff ? nextDiff.name : diff.next);
    }
  }
  Game.saveMeta();
  // 成就：难度通关
  var wasFirstClear = false;
  var clearTitle = '';
  if (s.difficulty === "casual" && !(Game.meta.achievements||[]).includes("clear_casual")) { unlockAchievement("clear_casual"); wasFirstClear = true; clearTitle = '初出茅庐'; }
  if (s.difficulty === "standard" && !(Game.meta.achievements||[]).includes("clear_standard")) { unlockAchievement("clear_standard"); wasFirstClear = true; clearTitle = '魔塔征服者'; }
  if (s.difficulty === "hell" && !(Game.meta.achievements||[]).includes("clear_hell")) { unlockAchievement("clear_hell"); wasFirstClear = true; clearTitle = '炼狱主宰'; }
  // v0.51: 首次通关纪念动画
  if (wasFirstClear) showFirstClearCelebration(clearTitle);
  showGameOver(true, `通关奖励：${essence} 灵蕴 + ${souls} 魂晶！`);
  Game.deleteSave();
}

// ===================== 装备属性管理 =====================
function _recalcEquipCombatFlags(p, equip) {
  // 重置
  p._execEquip = 0; p._chaosEquip = 0;
  for (var i = 0; i < equip.length; i++) {
    var fx = equip[i]._combatEffect;
    if (!fx) continue;
    if (fx.type === 'executioner') p._execEquip = fx.value || 0.25;
    if (fx.type === 'chaos') p._chaosEquip = fx.value || 0.3;
  }
}

function applyEquipStats(p, eq) {
  switch (eq.stat) {
    case "maxHp": p.maxHp += eq.val; p.hp = Math.min(p.hp + eq.val, p.maxHp); break;
    case "atk": p.atk += eq.val; break;
    case "def": p.def += eq.val; break;
    case "critRate": p.critRate += eq.val / 100; break;
    case "dodge": p.dodge = (p.dodge||0) + eq.val / 100; break;
    default: break;
  }
  // v0.60: 前缀额外属性（如神圣+4防+20血+3%闪，全部生效）
  if (eq._extraStats) {
    if (eq._extraStats.atk) p.atk += eq._extraStats.atk;
    if (eq._extraStats.def) p.def += eq._extraStats.def;
    if (eq._extraStats.maxHp) { p.maxHp += eq._extraStats.maxHp; p.hp = Math.min(p.hp + eq._extraStats.maxHp, p.maxHp); }
    if (eq._extraStats.critRate) p.critRate += eq._extraStats.critRate / 100;
    if (eq._extraStats.dodge) p.dodge = (p.dodge||0) + eq._extraStats.dodge / 100;
  }
  // v0.82: 锻造/附魔装备的bonusStats（与equipment.js保持一致）
  if (eq._bonusStats) {
    if (eq._bonusStats.atk) p.atk += eq._bonusStats.atk;
    if (eq._bonusStats.def) p.def += eq._bonusStats.def;
    if (eq._bonusStats.maxHp) { p.maxHp += eq._bonusStats.maxHp; p.hp = Math.min(p.hp + eq._bonusStats.maxHp, p.maxHp); }
    if (eq._bonusStats.dodge) p.dodge = (p.dodge||0) + eq._bonusStats.dodge;
    if (eq._bonusStats.critRate) p.critRate += eq._bonusStats.critRate;
    if (eq._bonusStats.pen) p.pen = (p.pen||0) + eq._bonusStats.pen;
    if (eq._bonusStats.regen) p.regen = (p.regen||0) + eq._bonusStats.regen;
  }
}
function removeEquipStats(p, eq) {
  switch (eq.stat) {
    case "maxHp": p.maxHp = Math.max(1, p.maxHp - eq.val); p.hp = Math.min(p.hp, p.maxHp); break;
    case "atk": p.atk = Math.max(1, p.atk - eq.val); break;
    case "def": p.def = Math.max(0, p.def - eq.val); break;
    case "critRate": p.critRate = Math.max(0, p.critRate - eq.val / 100); break;
    case "dodge": p.dodge = Math.max(0, (p.dodge||0) - eq.val / 100); break;
    default: break;
  }
  // v0.60: 移除前缀额外属性
  if (eq._extraStats) {
    if (eq._extraStats.atk) p.atk = Math.max(1, p.atk - eq._extraStats.atk);
    if (eq._extraStats.def) p.def = Math.max(0, p.def - eq._extraStats.def);
    if (eq._extraStats.maxHp) { p.maxHp = Math.max(1, p.maxHp - eq._extraStats.maxHp); p.hp = Math.min(p.hp, p.maxHp); }
    if (eq._extraStats.critRate) p.critRate = Math.max(0, p.critRate - eq._extraStats.critRate / 100);
    if (eq._extraStats.dodge) p.dodge = Math.max(0, (p.dodge||0) - eq._extraStats.dodge / 100);
  }
  // 移除锻造配方的bonus属性
  if (eq._bonusStats) {
    if (eq._bonusStats.atk) p.atk = Math.max(1, p.atk - eq._bonusStats.atk);
    if (eq._bonusStats.def) p.def = Math.max(0, p.def - eq._bonusStats.def);
    if (eq._bonusStats.maxHp) { p.maxHp = Math.max(1, p.maxHp - eq._bonusStats.maxHp); p.hp = Math.min(p.hp, p.maxHp); }
    if (eq._bonusStats.dodge) p.dodge = Math.max(0, (p.dodge||0) - eq._bonusStats.dodge);
    if (eq._bonusStats.critRate) p.critRate = Math.max(0, p.critRate - eq._bonusStats.critRate);
    if (eq._bonusStats.pen) p.pen = Math.max(0, (p.pen||0) - eq._bonusStats.pen);
    if (eq._bonusStats.regen) p.regen = Math.max(0, (p.regen||0) - eq._bonusStats.regen);
  }
}

// v0.80: addEquip 从 equipment.js 导入，本地包装传入回调和 trackQuest
function addEquipWrapped(eq) {
  addEquip(eq, trackQuest, function(onFullEq) {
    showEquipReplace(onFullEq, function() { playSound("equip"); Game.sync(); });
  });
}

// 丢弃装备（从装备栏点击触发）v0.80: 从 window 全局改为 EventBus
var _discarding = false;
function discardEquip(idx) {
  if (_discarding) return;
  _discarding = true;
  try {
    const s = Game.state;
    if (idx < 0 || idx >= s.equip.length) return;
    const eq = s.equip.splice(idx, 1)[0];
    removeEquipStats(s.player, eq);
    log(`<span class='warn'>已丢弃 ${eq.fullName||eq.name}</span>`);
    Combat.recalcEquipSetBonus(); Game.sync();
  } finally { _discarding = false; }
}

// 满装备时弹出替换选择
function showEquipReplace(newEq, onDone, onCancel) {
  const s = Game.state;
  const el = document.getElementById("equip-replace");
  const list = document.getElementById("equip-replace-list");
  el.style.display = "block"; list.innerHTML = "";
  const STAT_LABEL = { atk: '⚔️攻击', def: '🛡️防御', maxHp: '❤️生命', critRate: '💥暴击', dodge: '🍃闪避', maxEnergy: '⚡能量' };

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
      Combat.recalcEquipSetBonus();
      log(`<span class='warn'>替换装备：${eq.fullName||eq.name} → ${newEq.fullName||newEq.name}</span>`);
      el.style.display = "none";
      if (onDone) onDone();
    };
    list.appendChild(btn);
  });
}

// v0.50 遗物满时弹出替换面板
function showRelicReplace(newRelic) {
  var s = Game.state;
  var el = document.getElementById("equip-replace"); // 复用equip-replace面板
  var list = document.getElementById("equip-replace-list");
  el.style.display = "block"; list.innerHTML = "";

  // 新遗物（点击取消）
  var newBtn = document.createElement("button"); newBtn.className = "modal-btn";
  newBtn.innerHTML = '🆕 <b style="color:' + (RARITY_COLOR[newRelic.rarity] || '#ccc') + '">' + newRelic.icon + newRelic.name + '</b> <span style="color:#89e894">[保留此件·取消]</span>';
  newBtn.style.borderColor = "#89e894";
  newBtn.onclick = function() { el.style.display = "none"; }; // 不拿
  list.appendChild(newBtn);

  // 已持有遗物（点击丢弃该件，拿新遗物）
  s.relics.forEach(function(r, i) {
    var btn = document.createElement("button"); btn.className = "modal-btn";
    var stars = (r.stars && r.stars > 1) ? '⭐'.repeat(r.stars - 1) : '';
    btn.innerHTML = r.icon + stars + ' <b style="color:' + (RARITY_COLOR[r.rarity] || '#ccc') + '">' + r.name + '</b><br><span style="font-size:9px;color:#667">' + (r.desc||'') + '</span> <span style="color:#ff7b7b;font-size:10px">[丢弃]</span>';
    btn.onclick = function() {
      // 移除旧遗物，添加新遗物
      if (r.onRemove) r.onRemove(s.player);
      Events.emit(E.RELIC_REMOVED, { relic: r });
      s.relics.splice(i, 1);
      // 添加新遗物
      if (newRelic.onAcquire && !newRelic._acquired) { newRelic.onAcquire(s.player, s); newRelic._acquired = true; }
      if (newRelic.passive && !newRelic.applied) { newRelic.passive(s.player); newRelic.applied = true; }
      newRelic.stars = 1;
      s.relics.push(newRelic);
      // 追踪
      if (!Game.meta.discoveredRelics) Game.meta.discoveredRelics = [];
      if (!Game.meta.discoveredRelics.includes(newRelic.id)) { Game.meta.discoveredRelics.push(newRelic.id); Game.saveMeta(); }
      Events.emit(E.RELIC_GAINED, { relic: newRelic });
      Synergy.recheckSynergies(); Synergy.checkSynergies();
      el.style.display = "none";
      Game.sync();
      render(Game.state);
    };
    list.appendChild(btn);
  });
}

// ===================== 奖励处理 =====================
function takeEquip(eq) {
  const s = Game.state;
  if (s.equip.length >= getEquipLimit(s)) {
    hideModal("reward");
    showEquipReplace(eq, () => {
      playSound("equip");
      log(`${eq.icon} <span style="color:${eq.color}"><b>${eq.fullName||eq.name}</b></span> 已装备！`, "win");
      nextRoom();
    }, () => {
      // v0.60: 取消替换，安全关闭弹窗并继续（避免奖励弹窗状态不一致）
      log('已保留现有装备');
      nextRoom();
    });
  } else {
    s.equip.push(eq);
    applyEquipStats(s.player, eq);
    Combat.recalcEquipSetBonus();
    playSound("equip");
    log(`${eq.icon} <span style="color:${eq.color}"><b>${eq.fullName||eq.name}</b></span> 已装备！${eq.stat.toUpperCase()}+${eq.val}`, "win");
    hideModal("reward"); nextRoom();
  }
}

function takeAttrReward(type, isFast, isBoss) {
  const s = Game.state, p = s.player;
  switch (type) {
    case "atk": { const v = isBoss ? (isFast ? 5 : 3) : (isFast ? 3 : 2); p.atk += v; log("攻击 +" + v, "win"); Game.sync(); break; }
    case "hp":  { const v = isBoss ? (isFast ? 40 : 20) : (isFast ? 25 : 15); p.maxHp += v; p.hp += v; log("生命上限 +" + v, "heal"); Game.sync(); break; }
    case "mp":  { const v = 1; p.maxEnergy = (p.maxEnergy||3) + v; p.energy = Math.min(p.energy+v, p.maxEnergy); log("最大能量 +" + v, "info"); Game.sync(); break; }
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
  var talentDisc = (s.player && s.player._talentShopDiscount) ? s.player._talentShopDiscount : 0;
  const mul = (s.adDiscount ? 0.5 : 1) * (diffCfg.shopMul || 1) * (1 - talentDisc);
  const STAT_LABEL = { atk: '⚔️攻击', def: '🛡️防御', maxHp: '❤️生命', critRate: '💥暴击', dodge: '🍃闪避', maxEnergy: '⚡能量' };
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
      detail = `<br><span style="font-size:10px;color:#70a1ff">${it.name.includes('生命')?'回复50生命':it.name.includes('能量')?'回复3能量':'回满生命'}</span>`;
    }
    btn.innerHTML = `${it.icon} ${it.name} — <span style="color:#ffdd77">${finalCost}G</span>${s.adDiscount ? ' <span style="color:#89e894">[5折]</span>' : ''}${detail}`;
    btn.disabled = (s.gold || 0) < finalCost;
    btn.onclick = () => { if (Shop.buyItem({ ...it, cost: it.cost })) { Game.sync(); openShop(); } };
    list.appendChild(btn);
  });
  const canAd = Game.canWatchAd();
  console.log("[妖塔勇者录] openShop: canAd=", canAd, "meta.adWatched=", Game.meta?.adWatched, "adDiscount=", s.adDiscount);
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
    // 事件池 + 冷却：最近3次事件不会重复
    if (!s._recentEvents) s._recentEvents = [];
    const pool = [
      "shrine", "shrine", "altar", "altar",
      "gamble", "trade", "mystery",
      "memory_merchant", "mirror_fight", "training_stone",
      "beast_arena", "time_rift", "heal_spring",
      "black_market", "curse_altar", "wandering_sage",
      "fate_wheel", "death_gamble", "void_trade"
    ];
    // 过滤最近3次事件，防重复
    var filtered = pool.filter(function(t) { return s._recentEvents.indexOf(t) === -1; });
    if (filtered.length === 0) filtered = pool;
    type = s.rng.pick(filtered);
    s._recentEvents.push(type);
    if (s._recentEvents.length > 3) s._recentEvents.shift();
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
      if (EventSys.goodEventChance(s, 0.5)) {
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
      if (EventSys.goodEventChance(s, 0.5)) {
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
          Combat.recalcEquipSetBonus();
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
        if (EventSys.goodEventChance(s, 0.6)) {
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
  } else if (type === "curse_altar") {
    // v0.50 深渊祭坛：主动接受诅咒换稀有遗物（最多3次/局，烙印可提升上限）
    title.textContent = "💀 深渊祭坛";
    if (!s._curseTradeCount) s._curseTradeCount = 0;
    var curseCap = 3 + (s.player && s.player._brandCurseCapExtra ? s.player._brandCurseCapExtra : 0);
    desc.textContent = s._curseTradeCount >= curseCap
      ? "祭坛已经沉寂……你已经献祭得够多了。"
      : "\"献上你的命运，换取力量……接受一个随机诅咒，获得一件稀有以上遗物。\"（已献祭" + s._curseTradeCount + "/" + curseCap + "次）";
    if (s._curseTradeCount < curseCap) {
      addEventBtn("💀 接受诅咒（获得稀有+遗物）", () => {
        var curse = s.rng.pick(R.get('curses')||[]);
        if (curse) { s.curses.push(curse); curse.apply(s.player); log('<span class="warn">💀 深渊祭坛：获得诅咒「' + curse.name + '」</span>'); }
        var relic = Loot.genRelic();
        if (relic) { Shop.acquireRelic(relic); log('<span class="win">💀 深渊祭坛：获得「' + relic.name + '」</span>'); }
        s._curseTradeCount = (s._curseTradeCount||0) + 1;
        Synergy.checkCurseSynergies();
        Game.sync(); onClose();
      });
    }
    addEventBtn("离开", onClose);
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
  } else if (type === "fate_wheel") {
    // 🎲 命运轮盘
    title.textContent = "🎡 命运轮盘";
    desc.textContent = "命运之轮缓缓转动……50%概率获得传说遗物，50%概率失去所有金币。";
    addEventBtn("转动轮盘！", () => {
      if (s.rng.chance(0.5)) {
        var legends = (R.get('relics') || []).filter(function(r) { return r.rarity === 'legendary'; });
        var r = legends.length > 0 ? s.rng.pick(legends) : Loot.genRelic();
        Shop.acquireRelic(r);
        log("<span class='win'>🎡 命运眷顾！获得传说遗物：" + r.name + "！</span>");
        toast("🎡 命运眷顾！" + r.name);
      } else {
        s.gold = 0;
        log("<span class='warn'>🎡 命运嘲弄……金币归零！</span>");
      }
      Game.sync(); onClose();
    });
    addEventBtn("不赌（安全离开）", onClose);
  } else if (type === "death_gamble") {
    // 💀 死神赌局
    title.textContent = "💀 死神赌局";
    desc.textContent = "\"把命押上，我给你力量……\" 生命永久降至1，但攻击力翻倍。";
    addEventBtn("接受赌局", () => {
      s.player.hp = 1; s.player.maxHp = Math.max(1, s.player.maxHp);
      s.player.atk = Math.floor(s.player.atk * 2);
      s._deathGamble = true;
      log("<span class='win'>💀 死神赌局！HP→1，ATK×2！</span>");
      toast("💀 生命=1，攻击翻倍！");
      Game.sync(); onClose();
    });
    addEventBtn("拒绝（安全离开）", onClose);
  } else if (type === "void_trade") {
    // 🕳️ 虚空交易 — Build定义事件
    title.textContent = "🕳️ 虚空交易";
    desc.textContent = "交出你拥有的3件遗物，从核心遗物中选择1件。核心遗物将改变你的战斗方式。";
    if (s.relics.length < 3) {
      desc.textContent += "\n（你需要至少3件遗物才能交易……）";
      addEventBtn("离开", onClose);
    } else {
      addEventBtn("交易（交出3件→选1件核心）", () => {
        // 移除前3件遗物
        var removed = s.relics.splice(0, 3);
        removed.forEach(function(r) { if (r.onRemove) r.onRemove(s.player); });
        // 重检羁绊（移除遗物后可能失效）
        Synergy.recheckSynergies();
        // 展示核心遗物选择
        var coreRelics = (R.get('relics') || []).filter(function(r) {
          return r.id === 'core_flame' || r.id === 'core_ice' || r.id === 'core_shadow' || r.id === 'core_curse';
        });
        showCoreRelicChoice(coreRelics, onClose);
      });
      addEventBtn("离开", onClose);
    }
  }
}

// ---- 核心遗物选择弹窗 ----
function showCoreRelicChoice(coreRelics, onClose) {
  var el = document.getElementById("event"); el.style.display = "block";
  var title = document.getElementById("event-title");
  var desc = document.getElementById("event-desc");
  var btns = document.getElementById("event-btns");
  title.textContent = "🔮 选择你的核心遗物";
  desc.textContent = "每种核心遗物将定义一个完全不同的Build方向：";
  btns.innerHTML = "";
  coreRelics.forEach(function(r) {
    var btn = document.createElement("button");
    btn.className = "modal-btn";
    btn.style.cssText = "text-align:left;padding:10px;margin-bottom:6px;border:2px solid #ffa502;color:#ffcc88";
    btn.innerHTML = r.icon + " <b>" + r.name + "</b><br><span style='font-size:11px;color:#8899bb'>" + r.desc + "</span>";
    btn.onclick = function() {
      Shop.acquireRelic(r);
      log("<span class='win'>🕳️ 虚空交易完成！获得核心遗物：" + r.name + "！</span>");
      toast("🕳️ 获得：" + r.name);
      Game.sync();
      el.style.display = "none";
      onClose();
    };
    btns.appendChild(btn);
  });
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
    Combat.recalcEquipSetBonus();
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
    Combat.recalcEquipSetBonus();
    log("<span class='win'>🔮 重铸完成：" + newEq.fullName + "</span>");
    toast("🔮 重铸完成");
    trackQuest('forge', 1); playSound("equip");
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
        color: "#ff6644", qualityName: "神话", type: recipe.type || "weapon",
        _combatEffect: recipe.combatEffect, _zoneSet: "mythic", _bonusStats: {}
      };
      // 添加bonus属性（追踪到装备上，丢弃时自动移除）
      if (recipe.bonus) {
        Object.keys(recipe.bonus).forEach(function(k) {
          if (k === 'atk') { s.player.atk += recipe.bonus[k]; mythic._bonusStats.atk = recipe.bonus[k]; }
          else if (k === 'def') { s.player.def += recipe.bonus[k]; mythic._bonusStats.def = recipe.bonus[k]; }
          else if (k === 'maxHp') { s.player.maxHp += recipe.bonus[k]; s.player.hp += recipe.bonus[k]; mythic._bonusStats.maxHp = recipe.bonus[k]; }
          else if (k === 'dodge') { s.player.dodge = (s.player.dodge||0) + recipe.bonus[k]; mythic._bonusStats.dodge = recipe.bonus[k]; }
          else if (k === 'critRate') { s.player.critRate += recipe.bonus[k]; mythic._bonusStats.critRate = recipe.bonus[k]; }
          else if (k === 'pen') { s.player.pen = (s.player.pen || 0) + recipe.bonus[k]; mythic._bonusStats.pen = recipe.bonus[k]; }
          else if (k === 'regen') { s.player.regen = (s.player.regen || 0) + recipe.bonus[k]; mythic._bonusStats.regen = recipe.bonus[k]; }
        });
      }
      addEquipWrapped(mythic);
      // 记录到展架
      if (!Game.meta.forgedItems) Game.meta.forgedItems = [];
      if (!Game.meta.forgedItems.includes(recipe.id)) {
        Game.meta.forgedItems.push(recipe.id);
        trackQuest('forge', 1);
        Game.saveMeta();
      }
      log("<span class='win'>⚒️ 锻造神话装备：" + recipe.name + "！</span>");
      toast("⚒️ 锻造成功：" + recipe.name + "！");
      playSound("relic");
      Game.sync();
      hideModal("event"); onClose();
    });
  });

  // v0.60: 隐藏传说装备 — 满足条件时在锻造石台出现
  var hiddenLegendaries = R.get('hiddenLegendaries') || [];
  hiddenLegendaries.forEach(function(recipe) {
    // 检查条件是否满足
    var conditionMet = false;
    if (recipe.condition === 'synergy_frost_king') {
      conditionMet = (s._activeSynergies || []).indexOf('frost_king_2') >= 0 || (s._activeSynergies || []).indexOf('frost_king_3') >= 0;
    } else if (recipe.condition === 'dodge_30') {
      conditionMet = (s.player && (s.player.dodge || 0) >= 0.30);
    } else if (recipe.condition === 'crit_kill_boss') {
      conditionMet = (s.stats && s.stats.critCount > 0 && s._currentRoomType === 'boss');
    } else if (recipe.condition === 'skills_3') {
      conditionMet = ((s.activeSkills || []).length >= 3);
    } else if (recipe.condition === 'hit_by_dragon') {
      conditionMet = (s.stats && s.stats.totalDmg > 0);
    } else if (recipe.condition === 'all_relics') {
      var allRelics = R.get('relics') || [];
      var commonRelics = allRelics.filter(function(r) { return r.rarity === 'common'; });
      var owned = (Game.meta.discoveredRelics || []);
      conditionMet = commonRelics.every(function(r) { return owned.indexOf(r.id) >= 0; });
    }
    if (!conditionMet) return; // 条件不满足，不显示
    var cost = recipe.cost;
    var canForge = (Game.meta.forgeStones || 0) >= cost.forgeStones && (Game.meta.materials || 0) >= cost.materials
      && cost.bossMats.every(function(mid) { return (s.forgeMats && s.forgeMats[mid] || 0) > 0; });
    var matDesc = cost.bossMats.map(function(mid) {
      var has = (s.forgeMats && s.forgeMats[mid] || 0) > 0;
      return (has ? "✓" : "✗") + mid;
    }).join(" + ");
    addEventBtn(recipe.icon + ' 锻造「' + recipe.name + '」(' + cost.forgeStones + '锻石·' + cost.materials + '素材·' + matDesc + ') [' + recipe.conditionDesc + ']', function() {
      if (!canForge) { alert("材料不足！需要锻造石、素材和Boss材料"); return; }
      Game.meta.forgeStones -= cost.forgeStones;
      Game.meta.materials -= cost.materials;
      cost.bossMats.forEach(function(mid) { if (s.forgeMats && s.forgeMats[mid]) s.forgeMats[mid]--; });
      var mythic = {
        icon: recipe.icon, name: recipe.name, fullName: recipe.name,
        stat: recipe.stat, val: recipe.val,
        color: "#ff9944", qualityName: "传说", type: recipe.type || "armor",
        _combatEffect: null, _zoneSet: "legendary", _bonusStats: {}
      };
      if (recipe.bonus) {
        Object.keys(recipe.bonus).forEach(function(k) {
          if (k === 'atk') { s.player.atk += recipe.bonus[k]; mythic._bonusStats.atk = recipe.bonus[k]; }
          else if (k === 'def') { s.player.def += recipe.bonus[k]; mythic._bonusStats.def = recipe.bonus[k]; }
          else if (k === 'maxHp') { s.player.maxHp += recipe.bonus[k]; s.player.hp += recipe.bonus[k]; mythic._bonusStats.maxHp = recipe.bonus[k]; }
          else if (k === 'pen') { s.player.pen = (s.player.pen || 0) + recipe.bonus[k] / 100; mythic._bonusStats.pen = recipe.bonus[k] / 100; }
        });
      }
      addEquipWrapped(mythic);
      log('<span class="win">🌟 锻造传说装备：' + recipe.name + '！</span>');
      toast('🌟 锻造成功：' + recipe.name);
      playSound('relic');
      Game.sync(); Game.saveMeta();
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
      "<span style=\"color:#8899bb;font-size:11px\">" + up.desc + " CD:" + (up.cd || sk.cooldown) + "回合 ⚡" + (up.energyCost || sk.energyCost || 1) + "</span>";
    btn.onclick = function() {
      sk.name = up.name;
      sk.mul = up.mul;
      sk.cooldown = up.cd || sk.cooldown;
      if (up.effect) sk.effect = up.effect;
      Object.keys(up).forEach(function(k) {
        if (k !== 'name' && k !== 'desc' && k !== 'mul' && k !== 'cd' && k !== 'effect') sk[k] = up[k];
      });
      // CD减免由combat.js运行时计算（_blessingSwift/_talentMage已设为player flag）
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
          "<span style=\"color:#8899bb;font-size:11px\">" + nsk.desc + " CD:" + (nsk.cooldown || 2) + "回合 ⚡" + (nsk.energyCost || 1) + "</span>";
        b.onclick = function() {
          var newSk = { ...nsk };
          // CD减免由combat.js运行时计算
          skills.push(newSk);
          s.skillLevels[newSk.id] = 1;
          // 不覆盖 activeSkill，保留玩家最初选择的技能引用
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
        berserk: false, rebirth: false, regen: 0,
        energy: 3, maxEnergy: 3
      };
      Game.applyMetaBonus(s.player);
      g.apply(s); p.apply(s); e.apply(s);
      // 精通技能（若已解锁）
      var mLv = Game.getMasteryLevel(cls.id);
      if (mLv >= 3) {
        var mSkills = R.get('classMasterySkills');
        if (mSkills && mSkills[cls.id]) {
          mSkills[cls.id].forEach(function(ms) { if (mLv >= ms.masteryLv) s.activeSkills.push({ ...ms }); });
        }
      }
      var sk = s.rng.pick(cls.skills);
      s.activeSkills.unshift({ ...sk });
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
        case 'cleanse': if (id.includes('cleanse')) qp.daily[id] += val; break;
        case 'forge': if (id.includes('forge')) qp.daily[id] += val; break;
        case 'event': if (id.includes('event')) qp.daily[id] += val; break;
      }
      if (qp.daily[id] >= q.target) {
        qp.dailyCompleted[id] = true;
        const r = q.reward;
        Game.addEssence(r.essence || r.tp || 0); Game.addSouls(r.souls || 0);
        if (r.stones) Game.addStones(r.stones);
        toast(`✅ 每日任务完成：${q.name}！+${r.essence||r.tp||0}灵蕴 +${r.souls||0}魂晶`);
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
        Game.addEssence(r.essence || r.tp || 0); Game.addSouls(r.souls || 0);
        if (r.stones) Game.addStones(r.stones);
        toast(`🌟 每周挑战完成：${q.name}！+${r.essence||r.tp||0}灵蕴 +${r.souls||0}魂晶`);
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
  var h3 = el.querySelector("h3"); if (h3) h3.textContent = "📋 悬赏板";

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
      html += `<span style="color:#ffa502;font-size:11px">+${q.reward.tp||0}灵蕴 +${q.reward.souls||0}💎</span><br>`;
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
      html += `<span style="color:#ffa502;font-size:11px">+${q.reward.tp||0}灵蕴 +${q.reward.souls||0}💎</span><br>`;
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
        berserk: false, rebirth: false, regen: 0,
        energy: 3, maxEnergy: 3
      };
      Game.applyMetaBonus(s.player);
      g.apply(s); p.apply(s); e.apply(s);
      var mLv2 = Game.getMasteryLevel(cls.id);
      if (mLv2 >= 3) {
        var mSkills2 = R.get('classMasterySkills');
        if (mSkills2 && mSkills2[cls.id]) {
          mSkills2[cls.id].forEach(function(ms) { if (mLv2 >= ms.masteryLv) s.activeSkills.push({ ...ms }); });
        }
      }
      var sk = s.rng.pick(cls.skills);
      s.activeSkills.unshift({ ...sk });
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
// ---- 战利品弹窗 ----
function showReward(isFast, onEquip, onAttr, isElite) {
  var s = Game.state;
  var list = document.getElementById("reward-list"); if (!list) return;
  try {
  list.innerHTML = "";
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
    { id: "atk", name: "⚔️ 攻击+" + (isFast ? 3 : 2), icon: "" }
  ];
  attrs.forEach(function(a) {
    var btn = document.createElement("button");
    btn.className = "modal-btn";
    btn.style.cssText = "grid-column:1/-1;text-align:center;font-size:13px";
    btn.textContent = a.name;
    btn.onclick = function() { onAttr(a.id, isFast); };
    list.appendChild(btn);
  });
  } catch(e) {
    console.error("[showReward] 异常:", e);
    var errBtn2 = document.createElement('button'); errBtn2.className = 'modal-btn'; errBtn2.textContent = '继续冒险（奖励异常）'; errBtn2.onclick = function() { hideModal("reward"); nextRoom(); }; list.innerHTML = ''; list.appendChild(errBtn2);
  }
}

// ---- Boss 遗物三选一 ----
function showBossRelicPick(isFast) {
  var list = document.getElementById("reward-list"); if (!list) return; list.innerHTML = "";
  list.style.display = "grid"; list.style.gridTemplateColumns = "1fr 1fr"; list.style.gap = "10px";

  var hdr = document.createElement("div");
  hdr.style.cssText = "grid-column:1/-1;text-align:center;color:#ffa502;font-size:18px;font-weight:bold;margin-bottom:6px";
  hdr.textContent = "💀 Boss宝库 · 选择遗物";
  list.appendChild(hdr);

  var relics = [];
  var choiceCount = 3 + (Game.state.player && Game.state.player._talentRelicChoice ? Game.state.player._talentRelicChoice : 0);
  for (var i = 0; i < choiceCount; i++) {
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
  showModal("reward");
}

// ===================== 技能弹出面板（复用event弹窗） =====================
function showSkillPopup() {
  var s = Game.state;
  var skills = s.activeSkills || [];
  if (skills.length === 0) { toast("没有可用技能"); return; }
  var el = document.getElementById("event");
  el.style.display = "block";
  document.getElementById("event-title").textContent = "⚡ 选择技能（能量: " + (s.player ? s.player.energy : 0) + "/" + (s.player ? s.player.maxEnergy || 3 : 3) + "）";
  document.getElementById("event-desc").textContent = "点击技能释放";
  var btns = document.getElementById("event-btns");
  btns.innerHTML = "";

  skills.forEach(function(sk, i) {
    var cdKey = sk.id || ('skill_' + i);
    var cd = s.skillCooldowns ? (s.skillCooldowns[cdKey] || 0) : 0;
    var cost = sk.energyCost || 1;
    var lv = s.skillLevels ? (s.skillLevels[sk.id] || 1) : 1;
    var label = sk.icon + " " + sk.name + " Lv" + lv + " [" + cost + "⚡]";
    if (cd > 0) label += " CD" + cd;
    var btn = document.createElement("button");
    btn.className = "modal-btn";
    btn.textContent = label;
    var noEnergy = s.player && s.player.energy < cost;
    if (cd > 0) { btn.style.color = "#665588"; btn.disabled = true; }
    else if (noEnergy) { btn.style.color = "#886644"; btn.disabled = true; btn.textContent += " (能量不足)"; }
    else { btn.style.color = "#c8a8ff"; }
    if (cd === 0 && !noEnergy) {
      btn.onclick = function() {
        el.style.display = "none";
        Combat.doSkill(i);
      };
    }
    btns.appendChild(btn);
  });

  var cancelBtn = document.createElement("button");
  cancelBtn.className = "modal-btn";
  cancelBtn.style.background = "#1a1a2a"; cancelBtn.style.color = "#667788";
  cancelBtn.textContent = "取消";
  cancelBtn.onclick = function() {
    el.style.display = "none";
    Combat.resumeAuto();
  };
  btns.appendChild(cancelBtn);
}

function openPotionModal() {
  const s = Game.state; const el = document.getElementById("potion-modal"); el.style.display = "block";
  const list = document.getElementById("potion-list-modal"); list.innerHTML = "";
  if (s.potions.length === 0) { list.innerHTML = '<div style="color:#667788">暂无药水</div>'; }
  else {
    s.potions.forEach((p, i) => {
      const btn = document.createElement("button"); btn.className = "modal-btn";
      btn.innerHTML = `${p.icon} ${p.name} — ${p.desc}`; btn.onclick = () => { Combat.usePotion(i); hideModal("potion-modal"); };
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
  el.style.display = "block"; var h3 = el.querySelector("h3"); if (h3) h3.textContent = "🏆 成就与称号";
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
  el.style.display = "block"; var h3 = el.querySelector("h3"); if (h3) h3.textContent = "📖 大学士 · 遗物研究";
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
    div.style.cssText = "margin-bottom:6px;padding:8px;background:url('img/Wanted‑hunt order card background image.webp') center/cover,#0d1117;border-radius:4px;display:flex;align-items:center;gap:8px";
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

  // 已研究状态 + v0.50 保底计数器
  if (Game.meta.studiedRelic) {
    var studied = relics.find(function(r) { return r.id === Game.meta.studiedRelic; });
    if (studied && Game.meta.studiedDate === new Date().toDateString()) {
      if (!Game.meta.studiedPity) Game.meta.studiedPity = 0;
      var pity = Game.meta.studiedPity || 0;
      var bonus = 100 + pity * 5; // 基础翻倍 + 保底每局+5%
      var sDiv = document.createElement("div");
      sDiv.style.cssText = "margin-top:8px;padding:6px;background:#1a2a1a;border-radius:4px;text-align:center;color:#89e894;font-size:11px";
      sDiv.textContent = '✅ 今日正在研究：' + studied.name + '（出现率×' + (bonus/100).toFixed(1) + '倍）';
      if (pity > 0) sDiv.textContent += ' · 保底+' + (pity * 5) + '%（' + pity + '局未遇）';
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
  el.style.display = "block"; var h3 = el.querySelector("h3"); if (h3) h3.textContent = "📋 悬赏官 · 猎杀令";
  var subtitle = document.getElementById("meta-subtitle"); if (subtitle) subtitle.innerHTML = '';
  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var s = Game.state;

  var info = document.createElement("div");
  info.style.cssText = "color:#8899bb;font-size:12px;margin-bottom:10px;text-align:center";
  info.innerHTML = '花费灵石发布猎杀令，击败指定Boss拿灵石奖励';
  content.appendChild(info);

  // 三个猎杀令选项（v0.60: 金币→灵石）
  var bounties = [
    { name: "裂地者猎杀令", boss: "平原领主", cost: 10, reward: 15, desc: "击败迷雾平原的裂地者" },
    { name: "树精猎杀令", boss: "森林之王", cost: 15, reward: 25, desc: "击败幽暗森林的苍古树精" },
    { name: "守门人猎杀令", boss: "魔塔守门人", cost: 25, reward: 40, desc: "击败魔塔门前的守门人" },
  ];

  var activeBounty = Game.meta.activeBounty;
  var stones = Game.meta.stones || 0;
  bounties.forEach(function(b) {
    var div = document.createElement("div");
    div.style.cssText = "margin-bottom:6px;padding:8px;background:url('img/Wanted‑hunt order card background image.webp') center/cover,#0d1117;border-radius:4px";
    var isActive = activeBounty && activeBounty.boss === b.boss;
    div.innerHTML = '<b style="color:#ddccaa">🎯 ' + b.name + '</b><br>' +
      '<span style="color:#667788;font-size:10px">' + b.desc + ' · 花费' + b.cost + '💎 · 奖励' + b.reward + '💎</span>';
    var btn = document.createElement("button");
    btn.className = "modal-btn"; btn.style.cssText = "font-size:10px;padding:4px 8px;margin-top:4px";
    if (isActive) {
      btn.textContent = "进行中...";
      btn.disabled = true;
      btn.style.color = "#ffa502";
    } else {
      btn.textContent = "接取(" + b.cost + "💎)";
      btn.disabled = stones < b.cost;
      btn.onclick = function() {
        Game.meta.stones = (Game.meta.stones || 0) - b.cost;
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
  el.style.display = "block"; var h3 = el.querySelector("h3"); if (h3) h3.textContent = "📜 史官 · 征战记录";
  var subtitle = document.getElementById("meta-subtitle"); if (subtitle) subtitle.innerHTML = '';
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

  // 资源+等级
  var res = document.getElementById("city-resources");
  var levelCosts = [0, 0, 15, 30, 50, 80];
  var nextCost = cityLv < 5 ? levelCosts[cityLv + 1] : 0;
  var matCount = Game.meta.materials || 0;
  var forgeCount = Game.meta.forgeStones || 0;
  res.innerHTML = '🏰 主城 Lv.' + cityLv + '/5 · 💎灵石:' + spiritStones + ' · 🌟灵蕴:' + Game.getEssence() + ' · 👻魂晶:' + (meta.souls||0) + ' · ⚒️锻石:' + forgeCount + ' · 📦素材:' + matCount;
  if (nextCost > 0) {
    res.innerHTML += ' <button id=\"btn-upgrade-city\" style=\"font-size:10px;padding:2px 8px;background:#2a1a0a;border:1px solid #8a6030;color:#ffcc88;border-radius:4px;cursor:pointer\">⬆升级(' + nextCost + '灵石)</button>';
  }

  setTimeout(function() {
    var upBtn = document.getElementById("btn-upgrade-city");
    if (upBtn) upBtn.onclick = function() {
      if (spiritStones >= nextCost && cityLv < 5) {
        meta.stones -= nextCost;
        meta.cityLevel = cityLv + 1;
        Game.saveMeta();
        showCityHub();
        toast('🏰 主城升至Lv.' + meta.cityLevel + '！新区域已开放！');
      }
    };
  }, 100);

  // v0.60 修行石碑（始终可见）
  var stele = document.getElementById("stele-status");
  if (stele) {
    var pureMode = Game.meta._pureMode || false;
    stele.textContent = pureMode ? '🗿 修行模式：纯肉鸽（无局外加成）' : '🗿 修行石碑：局外加成生效中';
    stele.style.color = pureMode ? '#ff6644' : '#667788';
    stele.style.cursor = 'pointer';
    stele.style.display = '';
    stele.onclick = function() {
      Game.meta._pureMode = !Game.meta._pureMode;
      Game.saveMeta();
      showCityHub();
      toast(Game.meta._pureMode ? '🗿 修行模式开启' : '🗿 修行模式关闭');
    };
  }

  // v0.60 引导提示
  var guide = document.getElementById("city-guide");
  if (guide) {
    if (cityLv < 5 && spiritStones >= nextCost) {
      guide.innerHTML = '🎯 可<b>升级主城</b>至Lv.' + (cityLv + 1) + '（' + nextCost + '灵石）——解锁新区域！';
    } else if (cityLv < 5) {
      guide.innerHTML = '🎯 <b>出城探险</b>赚取灵石（差' + (nextCost - spiritStones) + '升Lv.' + (cityLv + 1) + '）';
    } else {
      guide.innerHTML = '👑 主城已满级 · <b>挑战更高难度吧！</b>';
    }
  }

  var npcQuotes = {
    altar: ['女神的光辉指引着每一位勇士……','灵蕴是成长的根本，善用它。','你有天赋，我看得出来。'],
    class: ['战斗是最好的老师。','每个职业都有它独特的道途。','你想变得更强吗？'],
    forge: ['叮叮当当……这把剑快好了！','好材料才能打出好装备。','给我锻造石，还你神兵利器。'],
    compendium: ['知识就是力量。','这座塔里藏着无数秘密……','每一件遗物都有它的故事。'],
    skillworkshop: ['技能的奥秘无穷无尽。','符文与残卷……这是古老的智慧。'],
    daily: ['今天的悬赏可不简单！','怪物不会自己送上门来。','猎杀，或者被猎杀。'],
    lodge: ['休息一下也无妨。','冒险之余也要记得补充资源。','我在塔里待了三十年，还能给你些好东西。'],
    astrology: ['星象在变化……命运在转动。','今天的天象对你有利。','仰望星空，答案就在那儿。'],
    leaderboard: ['历史由胜利者书写。','让我看看你的战绩……','又一位传奇诞生了吗？'],
    lore: ['每段回忆都是一份力量。','那些被遗忘的故事，等你来发现。','书籍是通往过去的钥匙。'],
    relicforge: ['把遗物给我……我能炼出更强的。','三件凡品，可换一件珍宝。','遗物的力量远不止于此。'],
    codex: ['裂隙中的装备，都逃不过我的眼睛。','每件装备都有它独一无二的印记。','收藏越多，力量越强。'],
    fatebrand: ['命运可以烙印……只要你付出灵蕴。','每个烙印都是通往力量的道途。','选择你的命运，勇士。']
  };

  // NPC定义：unlockCityLv = 需要主城达到多少级才解锁
  var npcDefs = [
    { zone:'shrine', id:'altar', name:'女神祭司', icon:'🧙‍♀️', func:'天赋树', unlockCityLv:1, action:function(){showTalentTree();} },
    { zone:'shrine', id:'class', name:'战斗大师', icon:'🗡️', func:'职业精通', unlockCityLv:2, action:function(){showClassMastery();} },
    { zone:'shrine', id:'astrology', name:'占星师', icon:'🔭', func:'星象占星', unlockCityLv:3, action:function(){showAstrologyPanel();} },
    { zone:'workshop', id:'forge', name:'老铁匠', icon:'👨‍🏭', func:'锻造工坊', unlockCityLv:1, action:function(){showForgePanel();} },
    { zone:'workshop', id:'smithy', name:'神匠', icon:'⚒️', func:'装备打造', unlockCityLv:1, action:function(){showEquipDoll();} }, // v0.81
    { zone:'plaza', id:'jade', name:'灵玉商人', icon:'💎', func:'灵玉兑换', unlockCityLv:1, action:function(){showJadeShop();} }, // v0.81
    { zone:'workshop', id:'skillworkshop', name:'铭文师', icon:'📜', func:'技能工坊', unlockCityLv:2, action:function(){showSkillWorkshop();} },
    { zone:'adventure', id:'lodge', name:'老猎人', icon:'🏚️', func:'离线收益', unlockCityLv:0, action:function(){showHunterLodge();} },
    { zone:'adventure', id:'daily', name:'悬赏官', icon:'📋', func:'每日悬赏', unlockCityLv:1, action:function(){showBountyHunterPanel();} },
    { zone:'plaza', id:'leaderboard', name:'史官', icon:'📜', func:'征战史记', unlockCityLv:1, action:function(){showHistorianPanel();} },
    { zone:'plaza', id:'lore', name:'藏书家', icon:'📚', func:'轮回回忆', unlockCityLv:2, action:function(){showLorePanel();} },
    // Lv.4 解锁
    { zone:'workshop', id:'relicforge', name:'遗物师', icon:'🔮', func:'遗物合成', unlockCityLv:4, action:function(){showRelicForge();} },
    { zone:'plaza', id:'codex', name:'鉴宝师', icon:'📦', func:'装备图鉴', unlockCityLv:4, action:function(){showGearCodex();} },
    // Lv.5 解锁
    { zone:'shrine', id:'fatebrand', name:'命印师', icon:'🌟', func:'命运烙印', unlockCityLv:5, action:function(){showBrandPanel();} },
  ];

  // 清空各区域 + 重置解锁计数
  ['shrine','workshop','adventure','plaza'].forEach(function(zone) {
    var el = document.getElementById('zone-npcs-' + zone);
    if (el) el.innerHTML = '';
    var lvEl = document.getElementById('zone-lv-' + zone);
    if (lvEl) lvEl.textContent = '';
  });

  // 渲染NPC（直接根据主城等级解锁）
  npcDefs.forEach(function(npc) {
    var zoneEl = document.getElementById('zone-npcs-' + npc.zone);
    if (!zoneEl) return;
    // unlockCityLv=0 始终开放, 否则检查主城等级
    var locked = npc.unlockCityLv > 0 && cityLv < npc.unlockCityLv;
    var lockHint = locked ? ('🔒 需主城Lv.' + npc.unlockCityLv) : npc.func;
    var div = document.createElement('div');
    div.className = 'city-npc' + (locked ? ' locked' : '');
    var quoteHtml = '';
    if (!locked && npcQuotes[npc.id]) {
      var quotes = npcQuotes[npc.id];
      quoteHtml = '<div class="npc-quote">"' + quotes[Math.floor(Math.random() * quotes.length)] + '"</div>';
    }
    div.innerHTML = '<span class="npc-icon">' + (locked ? '🔒' : npc.icon) + '</span>' +
      '<div class="npc-info"><span class="npc-name">' + npc.name + '</span>' +
      ' <span class="npc-func" style="color:' + (locked ? '#554' : '#8899bb') + '">' + lockHint + '</span></div>' +
      quoteHtml;
    if (!locked) div.onclick = npc.action;
    if (locked) div.title = '升级主城到Lv.' + npc.unlockCityLv + '来解锁';
    zoneEl.appendChild(div);
  });

  // 更新各区域解锁进度
  ['shrine','workshop','adventure','plaza'].forEach(function(zone) {
    var lvEl = document.getElementById('zone-lv-' + zone);
    if (!lvEl) return;
    var total = npcDefs.filter(function(n) { return n.zone === zone; }).length;
    var unlocked = npcDefs.filter(function(n) { return n.zone === zone && (n.unlockCityLv === 0 || cityLv >= n.unlockCityLv); }).length;
    lvEl.textContent = unlocked + '/' + total;
  });

}

// v0.50 职业精通面板
function showClassMastery() {
  var el = document.getElementById("meta-panel");
  // 保存并重置 meta-panel/content 样式，避免与其他面板互相污染
  var _origPanelStyle = { maxW: el.style.maxWidth, maxH: el.style.maxHeight, pad: el.style.padding };
  var content = document.getElementById("meta-content");
  var _origContentCss = content.style.cssText;
  function _cleanup() {
    el.style.maxWidth = _origPanelStyle.maxW; el.style.maxHeight = _origPanelStyle.maxH;
    el.style.padding = _origPanelStyle.pad; content.style.cssText = _origContentCss;
    var sub = document.getElementById("meta-subtitle"); if (sub) sub.style.display = "";
  }
  // 绑定关闭清理（每次重新绑定）
  var closeBtn = document.getElementById("btn-close-meta");
  if (closeBtn) { closeBtn.style.display = ""; closeBtn.onclick = function() { _cleanup(); el.style.display = "none"; }; }

  el.style.display = "block"; el.style.padding = "0";
  el.style.maxWidth = "420px"; el.style.maxHeight = "75vh";

  var titleEl = document.getElementById("meta-title");
  if (titleEl) titleEl.textContent = "🎖️ 职业精通";
  var subtitle = document.getElementById("meta-subtitle");
  if (subtitle) { subtitle.innerHTML = '使用职业通关获得经验 · 提升精通等级解锁专属技能和遗物'; subtitle.style.display = "none"; }

  content.innerHTML = '';
  content.style.cssText = "display:flex;flex-direction:row;max-height:55vh;overflow:hidden";

  var classes = R.get('classes');
  var unlocked = Game.meta.unlocks || ["warrior","mage","shadow"];
  var classList = Object.values(classes);

  // 左侧职业导航
  var sidebar = document.createElement("div");
  sidebar.style.cssText = "width:62px;background:#0d1117;padding:6px 3px;overflow-y:auto;flex-shrink:0;border-right:1px solid #1a1a2e;display:flex;flex-direction:column;gap:3px";
  var activeClass = sessionStorage.getItem('_cm_activeClass') || (classList[0] ? classList[0].id : null);

  // 右侧详情区
  var detailArea = document.createElement("div");
  detailArea.style.cssText = "flex:1;padding:6px 8px;overflow-y:auto;max-height:55vh";

  function renderDetail(c) {
    detailArea.innerHTML = '';
    var hasClass = unlocked.includes(c.id);
    var mastery = (Game.meta.classMastery && Game.meta.classMastery[c.id]) ? Game.meta.classMastery[c.id] : { level: 0, exp: 0 };
    var lv = mastery.level || 0;
    var exp = mastery.exp || 0;
    var nextExp = [5,10,20,35,55,80,110,145,185,230,280,335,395,460,530][lv] || 999;
    var pct = lv >= 15 ? 100 : Math.min(100, Math.floor(exp / nextExp * 100));

    // 职业头部
    var header = document.createElement("div");
    header.style.cssText = "text-align:center;padding:2px 0 8px;border-bottom:1px solid #1a1a2e;margin-bottom:8px";
    header.innerHTML = '<div style="font-size:40px;margin-bottom:4px">' + c.icon + '</div>' +
      '<div style="color:#ddccaa;font-weight:bold;font-size:15px">' + c.name + '</div>' +
      '<div style="color:#ffa502;font-size:20px;font-weight:bold;margin-top:3px">Lv.' + lv + ' <span style="font-size:11px;color:#8899bb">/ 15</span></div>' +
      '<div style="background:#1a1a2e;border-radius:4px;height:6px;margin:5px 8px 0;overflow:hidden">' +
      '<div style="background:linear-gradient(90deg,#c8a8ff,#ffa502);height:100%;border-radius:4px;width:' + pct + '%"></div></div>' +
      '<div style="color:#667;font-size:9px;margin-top:2px">' + (lv >= 15 ? '✨ 已满级' : exp + ' / ' + nextExp + ' EXP') + '</div>';
    detailArea.appendChild(header);

    // 精通时间线
    var timeline = document.createElement("div");
    timeline.style.cssText = "padding:0 2px";
    var milestones = [
      { lv:3, txt:'解锁第4技能', ico:'🔥' }, { lv:5, txt:'专属遗物', ico:'🔮' },
      { lv:10, txt:'解锁大招', ico:'🌟' }, { lv:15, txt:'职业称号', ico:'👑' }
    ];
    var allBonuses = [
      { lv:1, txt:'技能伤害+10%' },{ lv:2, txt:'主属性+3%' },{ lv:4, txt:'技能CD-1' },
      { lv:6, txt:'主属性+6%' },{ lv:7, txt:'技能能量-1' },{ lv:8, txt:'暴击率+5%' },
      { lv:9, txt:'生命+15%' },{ lv:11, txt:'全属性+3%' },{ lv:12, txt:'药水效果+10%' },
      { lv:13, txt:'初始金币+30' },{ lv:14, txt:'主属性+10%' }
    ];
    milestones.forEach(function(m) {
      var row = document.createElement("div");
      var ok = lv >= m.lv;
      row.style.cssText = "display:flex;align-items:center;gap:6px;padding:4px 0;font-size:10px;border-bottom:1px dotted #1a1a2e;" +
        (ok ? "color:#ddccaa" : "color:#444;opacity:0.6");
      row.innerHTML = '<span style="font-size:16px;width:22px;text-align:center">' + (ok ? m.ico : '🔒') + '</span>' +
        '<b>' + m.txt + '</b><span style="margin-left:auto;font-size:8px;color:' + (ok ? '#89e894' : '#445') + '">Lv.' + m.lv + '</span>';
      timeline.appendChild(row);
    });
    detailArea.appendChild(timeline);

    // 小字属性加成
    var smDiv = document.createElement("div");
    smDiv.style.cssText = "margin-top:4px;padding:4px 6px;background:#0d1117;border-radius:4px;font-size:9px;color:#667;line-height:1.6";
    smDiv.innerHTML = '<b style="color:#8899bb">属性加成：</b> ' + allBonuses.map(function(b){return (lv>=b.lv?'✅':'🔒')+b.txt;}).join(' · ');
    detailArea.appendChild(smDiv);

    // 技能列表
    if ((c.skills || []).length > 0) {
      var skDiv = document.createElement("div");
      skDiv.style.cssText = "margin-top:6px;padding-top:6px;border-top:1px solid #1a1a2e";
      skDiv.innerHTML = '<div style="color:#c8a8ff;font-size:10px;font-weight:bold;margin-bottom:3px">📜 职业技能</div>';
      (c.skills||[]).forEach(function(sk) {
        skDiv.innerHTML += '<div style="font-size:9px;color:#8899bb;padding:1px 0">' + sk.icon + ' <b>' + sk.name + '</b> ' + sk.desc + '</div>';
      });
      detailArea.appendChild(skDiv);
    }

    // 转职/觉醒
    if (hasClass && lv >= 10) {
      var advId = Game.getAdvancement(c.id);
      var advDiv = document.createElement("div");
      advDiv.style.cssText = "margin-top:6px;padding-top:6px;border-top:1px solid #1a1a2e";
      if (!advId) {
        var btn = document.createElement("button");
        btn.className = "modal-btn"; btn.style.cssText = "width:100%;font-size:10px;padding:6px;background:#2a1a0a;border-color:#8a6030;color:#ffcc88";
        btn.textContent = '🔱 转职（50魂晶+30灵石）';
        btn.onclick = function(){ showAdvancementPanel(c.id); };
        advDiv.appendChild(btn);
      } else if (!Game.isAwakened(c.id)) {
        var btn2 = document.createElement("button");
        btn2.className = "modal-btn"; btn2.style.cssText = "width:100%;font-size:10px;padding:6px;background:#2a1a0a;border-color:#8a6030;color:#ffcc88";
        btn2.textContent = '⭐ 觉醒（80魂晶+50灵石+30锻石）';
        btn2.onclick = function(){ if(Game.applyAwakening(c.id)){toast('⭐ 觉醒！全属性+15%');showClassMastery();}else{toast('条件不足');} };
        advDiv.appendChild(btn2);
      } else {
        advDiv.innerHTML += '<div style="text-align:center;color:#ffa502;font-size:10px;padding:4px">⭐ 已觉醒 · 全属性+15%</div>';
      }
      detailArea.appendChild(advDiv);
    }
  }

  // 构建左侧导航
  classList.forEach(function(c) {
    var hasClass = unlocked.includes(c.id);
    var isActive = activeClass === c.id;
    var btn = document.createElement("div");
    btn.style.cssText = "padding:5px 2px;border-radius:5px;text-align:center;cursor:" + (hasClass ? "pointer" : "default") +
      ";background:" + (isActive ? "#2a1a0a" : "#111") + ";border:1px solid " + (isActive ? "#ffa502" : "#1a1a1a") +
      ";opacity:" + (hasClass ? "1" : "0.4") + ";transition:all .15s";
    btn.innerHTML = '<div style="font-size:20px">' + (hasClass ? c.icon : '🔒') + '</div>' +
      '<div style="font-size:8px;color:' + (isActive ? '#ffcc88' : (hasClass ? '#8899bb' : '#444')) + ';margin-top:1px">' + c.name + '</div>';
    if (hasClass) {
      btn.onclick = function() { sessionStorage.setItem('_cm_activeClass', c.id); showClassMastery(); };
    }
    sidebar.appendChild(btn);
  });

  content.appendChild(sidebar);
  content.appendChild(detailArea);
  // 默认渲染第一个
  var sel = classList.find(function(c){return c.id === activeClass;}) || classList[0];
  renderDetail(sel);

}

// v0.50 转职面板
function showAdvancementPanel(charId) {
  var el = document.getElementById("meta-panel");
  var content = document.getElementById("meta-content");
  el.style.display = "block";
  var titleEl = document.getElementById("meta-title");
  var cls = R.get('classes', charId);
  if (titleEl) titleEl.textContent = '🔱 ' + (cls ? cls.name : '') + ' · 转职';
  var subtitle = document.getElementById("meta-subtitle");
  if (subtitle) subtitle.innerHTML = '精通Lv.10解锁 · 消耗50魂晶+30灵石 · <b style="color:#ff6644">选择不可逆转！</b>';

  content.innerHTML = '';
  var advs = R.get('classAdvancements');
  if (!advs || !advs[charId]) { content.innerHTML = '<div style="color:#667">该职业暂无转职路线</div>'; return; }
  var currentAdv = Game.getAdvancement(charId);
  var canAdv = Game.canAdvance(charId);
  var hasSouls = (Game.meta.souls || 0) >= 50;
  var hasStones = (Game.meta.stones || 0) >= 30;

  advs[charId].forEach(function(adv) {
    var isCurrent = currentAdv === adv.id;
    var div = document.createElement("div");
    div.style.cssText = "margin-bottom:10px;padding:12px;background:#0d1117;border-radius:8px;border:2px solid " + (isCurrent ? "#ffa502" : "#2a2a3a");
    div.innerHTML = '<div style="font-size:16px">' + adv.icon + ' <b>' + adv.name + '</b>' + (isCurrent ? ' <span style="color:#ffa502;font-size:11px">✅ 已选择</span>' : '') + '</div>' +
      '<div style="color:#8899bb;font-size:11px;margin:4px 0">' + adv.desc + '</div>' +
      '<div style="color:#ffcc88;font-size:10px">🎯 ' + adv.passive + '</div>';
    if (adv.statChange) {
      var changes = [];
      if (adv.statChange.atk) changes.push('ATK' + (adv.statChange.atk > 0 ? '+' : '') + adv.statChange.atk);
      if (adv.statChange.def) changes.push('DEF' + (adv.statChange.def > 0 ? '+' : '') + adv.statChange.def);
      if (adv.statChange.maxHp) changes.push('HP' + (adv.statChange.maxHp > 0 ? '+' : '') + adv.statChange.maxHp);
      if (adv.statChange.skillMul) changes.push('技能倍率+' + adv.statChange.skillMul);
      if (adv.statChange.critMul) changes.push('暴伤+' + adv.statChange.critMul);
      if (adv.statChange.pen) changes.push('穿透+' + Math.floor(adv.statChange.pen * 100) + '%');
      if (adv.statChange.dodge) changes.push('闪避+' + Math.floor(adv.statChange.dodge * 100) + '%');
      div.innerHTML += '<div style="color:#89e894;font-size:10px">📊 ' + changes.join(' · ') + '</div>';
    }

    if (!isCurrent && !currentAdv) {
      var btn = document.createElement("button");
      btn.className = "modal-btn"; btn.style.cssText = "margin-top:6px;font-size:11px;width:100%";
      btn.textContent = canAdv && hasSouls && hasStones ? '🔱 选择此转职（50魂晶+30灵石）' : (!canAdv ? '🔒 需要精通Lv.10' : '💰 资源不足');
      btn.disabled = !(canAdv && hasSouls && hasStones);
      btn.onclick = function() {
        if (!confirm('确定选择「' + adv.name + '」吗？此操作不可逆转！')) return;
        var result = Game.applyAdvancement(charId, adv.id);
        if (result) {
          toast('🔱 转职成功！你已成为「' + adv.name + '」！');
          showAdvancementPanel(charId);
        } else {
          toast('转职失败，请检查条件');
        }
      };
      div.appendChild(btn);
    }
    content.appendChild(div);
  });

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭";
  closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
}

// v0.50 技能合成工坊
function showSkillWorkshop() {
  var el = document.getElementById("meta-panel"); el.style.display = "block";
  var titleEl = document.getElementById("meta-title");
  if (titleEl) titleEl.textContent = "📜 技能工坊";
  var subtitle = document.getElementById("meta-subtitle");
  if (subtitle) subtitle.innerHTML = '通用素材: <b>' + (Game.meta.materials||0) + '</b> · 合成技能可带入局内使用';

  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var mats = Game.meta.materials || 0;
  var synthSkills = Game.meta.synthSkills || [];

  // 已合成的技能（只能删除最新合成的，LIFO）
  if (synthSkills.length > 0) {
    var ownedDiv = document.createElement("div");
    ownedDiv.style.cssText = "margin-bottom:10px;padding:8px;background:#1a2a1a;border-radius:6px";
    ownedDiv.innerHTML = '<b style="color:#89e894;font-size:12px">📦 已合成技能（' + synthSkills.length + '/5 · 开局可选 · 只能删除最新的）</b><br>';
    synthSkills.forEach(function(sk, idx) {
      var isLast = idx === synthSkills.length - 1;
      ownedDiv.innerHTML += '<span style="color:#ddccaa;font-size:11px">' + (sk.icon||'📜') + sk.name + ' (' + (sk.desc||'') + ')</span> ';
      if (isLast) {
        var delBtn = document.createElement("button");
        delBtn.textContent = '✕'; delBtn.style.cssText = "font-size:9px;padding:0 3px;background:#5a2020;color:#f88;border:none;border-radius:2px;cursor:pointer";
        delBtn.onclick = function() {
          Game.meta.synthSkills.pop();
          Game.saveMeta();
          showSkillWorkshop();
        };
        ownedDiv.appendChild(delBtn);
      }
      ownedDiv.appendChild(document.createElement("br"));
    });
    content.appendChild(ownedDiv);
  }

  // 合成选项
  var crafts = [
    { name: "随机普通技能", cost: 30, desc: "获得1个随机基础技能", quality: "普通" },
    { name: "随机稀有技能", cost: 75, desc: "获得1个强化技能(Mul+20%)", quality: "稀有" },
    { name: "指定元素技能", cost: 90, desc: "从选定元素(火/冰/雷/暗/光)中随机", quality: "稀有" },
    { name: "随机史诗技能", cost: 150, desc: "获得1个双效果技能", quality: "史诗" },
    { name: "技能升级", cost: 45, desc: "将已有合成技能效果+15%", quality: "升级" }
  ];
  crafts.forEach(function(c) {
    var btn = document.createElement("button");
    btn.className = "modal-btn"; btn.style.cssText = "margin-bottom:4px;width:100%;text-align:left;font-size:12px";
    btn.innerHTML = '<b>' + c.name + '</b> · ' + c.cost + '素材 <span style="color:#667;font-size:10px">' + c.desc + '</span>';
    btn.disabled = mats < c.cost;
    btn.onclick = function() {
      if (mats < c.cost) return;
      Game.meta.materials -= c.cost;
      if (!Game.meta.synthSkills) Game.meta.synthSkills = [];
      if (Game.meta.synthSkills.length >= 5) { toast('最多保存5个合成技能'); return; }
      var skillPool = R.get('classes') ? Object.values(R.get('classes')).flatMap(function(cls){return cls.skills||[];}) : [];
      var picked = skillPool.length > 0 ? skillPool[Math.floor(Math.random() * skillPool.length)] : null;
      if (picked) {
        var synthSk = { id: 'synth_' + Date.now(), name: picked.name, icon: picked.icon || '📜', desc: picked.desc || '', mul: picked.mul || 1.5, cooldown: picked.cooldown || 3, energyCost: picked.energyCost || 2 };
        Game.meta.synthSkills.push(synthSk);
        Game.saveMeta();
        showSkillWorkshop();
        toast('📜 合成成功：' + synthSk.name + '！开局可选');
      }
    };
    content.appendChild(btn);
  });

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:8px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
}

// v0.50 星象占星
function showAstrologyPanel() {
  var el = document.getElementById("meta-panel"); el.style.display = "block";
  var titleEl = document.getElementById("meta-title");
  if (titleEl) titleEl.textContent = "🔭 占星台";
  var subtitle = document.getElementById("meta-subtitle");
  if (subtitle) subtitle.innerHTML = '灵石: <b>' + (Game.meta.stones||0) + '</b> · 每日可免费占星1次';

  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var stones = Game.meta.stones || 0;
  var stars = Game.meta.stars || { daily: null, permanent: [], seasonal: null };

  // 日星区域
  var dailyDiv = document.createElement("div");
  dailyDiv.style.cssText = "margin-bottom:10px;padding:10px;background:#0d1117;border-radius:8px;border:1px solid #2a3a2a";
  dailyDiv.innerHTML = '<b style="color:#ffa502">☀️ 日星（仅下一局生效）</b><br>';
  if (stars.daily) {
    dailyDiv.innerHTML += '<span style="color:#89e894">当前日星：' + (stars.daily.name||'') + ' - ' + (stars.daily.desc||'') + '</span>';
  } else {
    dailyDiv.innerHTML += '<span style="color:#667">尚未抽取日星</span>';
  }
  var dailyBtn = document.createElement("button");
  dailyBtn.className = "modal-btn"; dailyBtn.style.cssText = "margin-top:4px;font-size:11px;width:100%";
  var claimedToday = Game.meta.lastClaimDay === new Date().getFullYear()+'-'+(new Date().getMonth()+1)+'-'+new Date().getDate();
  var hasDrawn = claimedToday && stars.daily;
  dailyBtn.textContent = hasDrawn ? '☀️ 已占星（今日）' : (stones >= 10 ? '☀️ 占星（10灵石）' : '☀️ 占星（10灵石）- 灵石不足');
  dailyBtn.disabled = hasDrawn || stones < 10;

  var doDailyDraw = function() {
    var pool = [
      { name: "荧惑守心", desc: "开局获得1件随机稀有遗物", icon: "🔴" },
      { name: "太白经天", desc: "首回合伤害×2", icon: "⚪" },
      { name: "岁星临凡", desc: "怪物词缀-1", icon: "🟤" },
      { name: "辰星护体", desc: "首战护盾翻倍", icon: "🔵" },
      { name: "镇星不动", desc: "Boss伤害-30%", icon: "🟡" }
    ];
    var pick = pool[Math.floor(Math.random() * pool.length)];
    Game.meta.stars.daily = pick;
    Game.meta.lastClaimDay = new Date().getFullYear()+'-'+(new Date().getMonth()+1)+'-'+new Date().getDate();
    Game.saveMeta();
    showAstrologyPanel();
    toast('☀️ 日星「' + pick.name + '」已降临！');
  };
  dailyBtn.onclick = doDailyDraw;
  dailyDiv.appendChild(dailyBtn);

  // 日星重随按钮
  if (hasDrawn) {
    var rerollBtn = document.createElement("button");
    rerollBtn.className = "modal-btn";
    rerollBtn.style.cssText = "margin-top:3px;font-size:10px;width:100%;background:#2a1a0a;border-color:#8a6030;color:#ffcc88";
    var rerollCost = 5;
    rerollBtn.textContent = '🔄 重随日星（' + rerollCost + '灵石）';
    rerollBtn.disabled = stones < rerollCost;
    rerollBtn.onclick = function() {
      if ((Game.meta.stones||0) < rerollCost) { toast('灵石不足'); return; }
      Game.meta.stones -= rerollCost;
      doDailyDraw();
    };
    dailyDiv.appendChild(rerollBtn);
  }
  content.appendChild(dailyDiv);

  // 恒星区域
  var permDiv = document.createElement("div");
  permDiv.style.cssText = "margin-bottom:10px;padding:10px;background:#0d1117;border-radius:8px;border:1px solid #2a2a3a";
  permDiv.innerHTML = '<b style="color:#c8a8ff">⭐ 恒星（永久加成，最多3个）</b><br>';
  var permPool = [
    { name: "武曲", desc: "全伤害+3%", icon: "🔵" }, { name: "文曲", desc: "遗物掉落率+5%", icon: "⚪" },
    { name: "天相", desc: "商店价格-8%", icon: "🟡" }, { name: "七杀", desc: "暴伤+10%", icon: "🔴" },
    { name: "破军", desc: "穿透+8%", icon: "🟣" }, { name: "贪狼", desc: "吸血+5%", icon: "🟢" }
  ];
  var doPermDraw = function() {
    var pick = permPool[Math.floor(Math.random() * permPool.length)];
    if (!Game.meta.stars.permanent) Game.meta.stars.permanent = [];
    Game.meta.stars.permanent.push(pick);
    Game.meta.stones -= 30;
    Game.saveMeta();
    showAstrologyPanel();
    toast('⭐ 恒星「' + pick.name + '」已点亮！');
  };
  if (stars.permanent && stars.permanent.length > 0) {
    stars.permanent.forEach(function(s, i) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin:2px 0";
      row.innerHTML = '<span style="color:#ddc;font-size:11px">' + s.icon + s.name + ': ' + s.desc + '</span>';
      var rerollBtn2 = document.createElement("button");
      rerollBtn2.className = "modal-btn";
      rerollBtn2.style.cssText = "font-size:9px;padding:1px 6px;background:#2a1a0a;border-color:#8a6030;color:#ffcc88";
      rerollBtn2.textContent = '🔄' + 15 + '灵石';
      rerollBtn2.disabled = stones < 15;
      (function(idx) {
        rerollBtn2.onclick = function() {
          if ((Game.meta.stones||0) < 15) { toast('灵石不足'); return; }
          var p2 = permPool[Math.floor(Math.random() * permPool.length)];
          Game.meta.stars.permanent[idx] = p2;
          Game.meta.stones -= 15;
          Game.saveMeta();
          showAstrologyPanel();
          toast('⭐ 恒星已重随为「' + p2.name + '」！');
        };
      })(i);
      row.appendChild(rerollBtn2);
      permDiv.appendChild(row);
    });
  }
  var permBtn = document.createElement("button");
  permBtn.className = "modal-btn"; permBtn.style.cssText = "margin-top:4px;font-size:11px;width:100%";
  var slotsFull = stars.permanent && stars.permanent.length >= 3;
  permBtn.textContent = slotsFull ? '⭐ 恒星槽位已满' : (stones >= 30 ? '⭐ 抽取恒星（30灵石）' : '⭐ 抽取恒星（30灵石）- 灵石不足');
  permBtn.disabled = slotsFull || stones < 30;
  permBtn.onclick = doPermDraw;
  permDiv.appendChild(permBtn);
  content.appendChild(permDiv);

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:8px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
}

// v0.50 轮回回忆（藏书阁）
function showLorePanel() {
  var el = document.getElementById("meta-panel"); el.style.display = "block";
  var titleEl = document.getElementById("meta-title");
  if (titleEl) titleEl.textContent = "📚 轮回回忆 · 藏书阁";
  var subtitle = document.getElementById("meta-subtitle");
  if (subtitle) subtitle.innerHTML = '回忆碎片: <b>' + (Game.meta.memoryFragments||0) + '</b> · 合成篇章解锁永久加成';

  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var frags = Game.meta.memoryFragments || 0;
  var unlocked = Game.meta.unlockedLore || [];

  var chapters = [
    { id: "lore_human", name: "人族崛起", cost: 5, bonus: "HP+2%", icon: "👤" },
    { id: "lore_demon", name: "魔族沉沦", cost: 5, bonus: "ATK+2%", icon: "👹" },
    { id: "lore_ancient", name: "远古创世", cost: 8, bonus: "DEF+2%", icon: "🌍" },
    { id: "lore_warrior", name: "战士起源", cost: 10, bonus: "战士伤害+5%", icon: "⚔️" },
    { id: "lore_mage", name: "法师起源", cost: 10, bonus: "法师伤害+5%", icon: "🔮" },
    { id: "lore_shadow", name: "影刃起源", cost: 10, bonus: "影刃伤害+5%", icon: "🗡️" },
    { id: "lore_final", name: "魔王往事", cost: 15, bonus: "全属性+3%+隐藏遗物", icon: "👑" }
  ];

  chapters.forEach(function(ch) {
    var isUnlocked = unlocked.includes(ch.id);
    var div = document.createElement("div");
    div.style.cssText = "margin-bottom:6px;padding:8px;background:#0d1117;border-radius:6px;border-left:3px solid " + (isUnlocked ? "#89e894" : "#333");
    div.innerHTML = '<b>' + ch.icon + ' ' + ch.name + '</b> · ' + ch.cost + '碎片 · ' + ch.bonus +
      (isUnlocked ? ' <span style="color:#89e894">✅ 已解锁</span>' : '');
    if (!isUnlocked) {
      var btn = document.createElement("button");
      btn.className = "modal-btn"; btn.style.cssText = "font-size:10px;padding:2px 8px;float:right";
      btn.textContent = "合成(" + ch.cost + "碎片)";
      btn.disabled = frags < ch.cost;
      btn.onclick = function() {
        Game.meta.memoryFragments -= ch.cost;
        if (!Game.meta.unlockedLore) Game.meta.unlockedLore = [];
        Game.meta.unlockedLore.push(ch.id);
        Game.saveMeta();
        showLorePanel();
        toast('📖 ' + ch.name + ' 篇章解锁！' + ch.bonus);
      };
      div.appendChild(btn);
    }
    content.appendChild(div);
  });

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:8px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
}

// 锻造工坊面板
function showForgePanel() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block";
  var h3 = el.querySelector("h3"); if (h3) h3.textContent = "⚒️ 锻造工坊";
  var content = document.getElementById("meta-content");
  content.innerHTML = "";
  var s = Game.state;

  // v0.60: 工坊功能等级跟随主城等级
  var workshopLv = Math.min(Game.meta.cityLevel || 1, 3);
  var spiritStones = Game.meta.stones || 0;
  var forgeStones = Game.meta.forgeStones || 0;
  var materials = Game.meta.materials || 0;

  var info = document.createElement("div");
  info.style.cssText = "color:#8899bb;font-size:12px;margin-bottom:10px;text-align:center";
  var lvEffects = ['','基础锻造','合成配方+1 · 高级重铸','锻造折扣20%'];
  info.innerHTML = '⚒️ 工坊 Lv.' + workshopLv + '/3 · ' + (lvEffects[workshopLv] || '') +
    '<br><span style="color:#667788">灵石:' + spiritStones + ' · 锻石:' + forgeStones + ' · 素材:' + materials + '</span>' +
    '<br><span style="color:#554;font-size:9px">升级主城即可提升工坊等级，解锁更多功能</span>';
  content.appendChild(info);

  // 装备分解
  var salvageDiv = document.createElement("div");
  salvageDiv.style.cssText = "margin-top:10px;padding:8px;background:#1a1010;border-radius:4px";
  salvageDiv.innerHTML = '<b style="color:#ffaa88">♻️ 装备分解</b><br><span style="color:#8899bb;font-size:11px">分解不需要的装备换取灵石（品质越高越多）</span>';

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
        Combat.recalcEquipSetBonus();
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

  // v0.50 Boss材料库存
  var mats = s.forgeMats || {};
  var matNames = Object.keys(mats);
  if (matNames.length > 0) {
    var matDiv = document.createElement("div");
    matDiv.style.cssText = "margin-top:10px;padding:8px;background:#1a1520;border-radius:4px";
    matDiv.innerHTML = '<b style="color:#ffa502;font-size:12px">🧱 Boss材料库存</b><br>';
    matNames.forEach(function(k) {
      if (mats[k] > 0) matDiv.innerHTML += '<span style="color:#ccaa88;font-size:10px">' + k.replace('mat_','').replace(/_/g,' ') + ': ' + mats[k] + '</span> · ';
    });
    content.appendChild(matDiv);
  }

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭";
  closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
}

// ===================== v0.60 命运烙印（Lv.5解锁） =====================
function showBrandPanel() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block"; var h3 = el.querySelector("h3"); if (h3) h3.textContent = "🌟 命印师 · 命运烙印";
  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var meta = Game.meta;
  var essence = Game.getEssence();

  if (!meta.unlockedBrands) meta.unlockedBrands = [];
  if (!meta.equippedBrands) meta.equippedBrands = [];
  if (!meta.brandLevels) meta.brandLevels = {};

  var brands = R.get('fateBrands') || [];
  var equipSlots = meta.equippedBrands;

  // 顶部：灵蕴 + 已装备
  var topDiv = document.createElement("div");
  topDiv.style.cssText = "text-align:center;margin-bottom:10px;padding:8px;background:#1a1520;border-radius:8px;border:1px solid #c8a8ff";
  topDiv.innerHTML = '<span style="color:#c8a8ff;font-size:12px">🌟 灵蕴:' + essence + '</span>' +
    ' · <span style="color:#ffa502;font-size:12px">装备烙印: 最多2个</span>';
  content.appendChild(topDiv);

  // 已装备烙印
  var eqDiv = document.createElement("div");
  eqDiv.style.cssText = "display:flex;gap:8px;margin-bottom:10px";
  for (var s = 0; s < 2; s++) {
    var slotEl = document.createElement("div");
    slotEl.style.cssText = "flex:1;padding:6px;background:#0d1117;border-radius:6px;text-align:center;min-height:40px;border:1px dashed #333";
    var bid = equipSlots[s];
    if (bid) {
      var b = brands.find(function(x) { return x.id === bid; });
      if (b) {
        var blv = meta.brandLevels[bid] || 0;
        slotEl.innerHTML = '<span style="font-size:18px">' + b.icon + '</span><br><span style="color:#ddccaa;font-size:10px">' + b.name + ' Lv.' + blv + '</span>';
        slotEl.title = '点击卸下';
        slotEl.style.border = "1px solid #c8a8ff";
        slotEl.style.cursor = "pointer";
        (function(slotIdx) {
          slotEl.onclick = function() {
            meta.equippedBrands[slotIdx] = null;
            Game.saveMeta();
            showBrandPanel();
            toast('已卸下烙印');
          };
        })(s);
      }
    } else {
      slotEl.innerHTML = '<span style="color:#444;font-size:10px">空槽位</span>';
    }
    eqDiv.appendChild(slotEl);
  }
  content.appendChild(eqDiv);

  // 烙印列表
  brands.forEach(function(brand) {
    var unlocked = meta.unlockedBrands.includes(brand.id);
    var lv = meta.brandLevels[brand.id] || 0;
    var maxLv = brand.levels.length;
    var equipped = equipSlots[0] === brand.id || equipSlots[1] === brand.id;
    var equippedSlot = equipSlots[0] === brand.id ? 0 : (equipSlots[1] === brand.id ? 1 : -1);

    var div = document.createElement("div");
    div.style.cssText = "margin-bottom:6px;padding:8px;background:#0d1117;border-radius:6px;border-left:3px solid " + (equipped ? '#c8a8ff' : (unlocked ? '#5a4080' : '#222')) + ";opacity:" + (unlocked ? '1' : '0.5');
    div.innerHTML = '<div style="display:flex;align-items:center;gap:8px">' +
      '<span style="font-size:22px">' + (unlocked ? brand.icon : '🔒') + '</span>' +
      '<div style="flex:1"><b style="color:' + (unlocked ? '#ddccaa' : '#555') + '">' + brand.name + '</b>' +
      '<br><span style="color:#667788;font-size:10px">' + brand.desc + '</span>' +
      '<br><span style="color:#448;font-size:9px">' + (unlocked ? 'Lv.' + lv + '/' + maxLv : brand.unlockDesc) + '</span></div></div>';

    if (unlocked) {
      var btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:4px;margin-top:6px";

      // 装备/卸下按钮
      if (equipped) {
        var uneqBtn = document.createElement("button");
        uneqBtn.className = "modal-btn";
        uneqBtn.style.cssText = "font-size:9px;padding:2px 6px;width:auto;background:#2a1020;border-color:#c8a8ff;color:#c8a8ff";
        uneqBtn.textContent = "已装备(槽" + (equippedSlot + 1) + ")";
        (function(bid, slot) {
          uneqBtn.onclick = function() {
            meta.equippedBrands[slot] = null;
            Game.saveMeta();
            showBrandPanel();
            toast('已卸下 ' + brand.name);
          };
        })(brand.id, equippedSlot);
        btnRow.appendChild(uneqBtn);
      } else if (!equipSlots[0] || !equipSlots[1]) {
        var eqBtn = document.createElement("button");
        eqBtn.className = "modal-btn";
        var openSlot = !equipSlots[0] ? 0 : 1;
        eqBtn.style.cssText = "font-size:9px;padding:2px 6px;width:auto;background:#1a2a1a;border-color:#89e894;color:#89e894";
        eqBtn.textContent = "装备(槽" + (openSlot + 1) + ")";
        (function(bid, slot) {
          eqBtn.onclick = function() {
            meta.equippedBrands[slot] = bid;
            Game.saveMeta();
            showBrandPanel();
            toast('已装备 ' + brand.name);
          };
        })(brand.id, openSlot);
        btnRow.appendChild(eqBtn);
      }

      // 升级按钮
      if (lv < maxLv) {
        var cost = brand.levels[lv].cost;
        var canUp = essence >= cost;
        var upBtn = document.createElement("button");
        upBtn.className = "modal-btn";
        upBtn.style.cssText = "font-size:9px;padding:2px 6px;width:auto;background:" + (canUp ? '#2a1a0a' : '#111') + ";border-color:" + (canUp ? '#ffa502' : '#333') + ";color:" + (canUp ? '#ffcc88' : '#555');
        upBtn.textContent = "⬆Lv." + (lv + 1) + "(" + cost + "灵蕴)";
        upBtn.disabled = !canUp;
        (function(bid) {
          upBtn.onclick = function() {
            if (Game.upgradeBrand(bid)) {
              showBrandPanel();
              toast(brand.icon + ' ' + brand.name + ' 升至Lv.' + (lv + 1) + '！');
            } else { toast('灵蕴不足'); }
          };
        })(brand.id);
        btnRow.appendChild(upBtn);
      }

      // 效果预览
      for (var i = 0; i < brand.levels.length; i++) {
        var lvEffect = brand.levels[i];
        var active = i < lv;
        var effSpan = document.createElement("span");
        effSpan.style.cssText = "font-size:9px;color:" + (active ? '#89e894' : '#444') + ";display:block;margin-top:2px";
        effSpan.textContent = (active ? '✅ ' : '⬜ ') + 'Lv.' + (i + 1) + ': ' + lvEffect.effect;
        div.appendChild(effSpan);
      }

      div.appendChild(btnRow);
    }

    content.appendChild(div);
  });

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
}

// ===================== v0.60 遗物合成（Lv.4解锁） =====================
function showRelicForge() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block"; var h3 = el.querySelector("h3"); if (h3) h3.textContent = "🔮 遗物师 · 遗物合成";
  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var meta = Game.meta;
  var essence = Game.getEssence();

  var info = document.createElement("div");
  info.style.cssText = "color:#8899bb;font-size:12px;margin-bottom:10px;text-align:center";
  info.innerHTML = '🌟 灵蕴:' + essence + '<br><span style="color:#667788">消耗灵蕴合成遗物，下局必定携带</span>';
  content.appendChild(info);

  // 获取已发现的遗物列表（排除核心遗物）
  var allRelics = R.get('relics') || [];
  var discovered = meta.discoveredRelics || [];
  var craftable = allRelics.filter(function(r) {
    return discovered.includes(r.id) && !r.isCore;
  });

  if (craftable.length === 0) {
    var emptyDiv = document.createElement("div");
    emptyDiv.style.cssText = "color:#667788;text-align:center;padding:20px";
    emptyDiv.textContent = "尚未发现可合成的遗物……多探索几局吧！";
    content.appendChild(emptyDiv);
  } else {
    // 按稀有度排序
    var rarityOrder = { common:1, rare:2, epic:3, legendary:4 };
    craftable.sort(function(a, b) { return (rarityOrder[a.rarity]||0) - (rarityOrder[b.rarity]||0); });
    craftable = craftable.slice(0, 8); // 最多显示8个

    craftable.forEach(function(r) {
      var cost = r.rarity === 'legendary' ? 200 : r.rarity === 'epic' ? 80 : r.rarity === 'rare' ? 30 : 10;
      var div = document.createElement("div");
      div.style.cssText = "margin-bottom:6px;padding:8px;background:url('img/Wanted‑hunt order card background image.webp') center/cover,#0d1117;border-radius:4px;display:flex;align-items:center;gap:8px";
      div.innerHTML = '<span style="font-size:20px">' + r.icon + '</span><div style="flex:1"><b style="color:#ddccaa">' + r.name + '</b><br><span style="color:#667788;font-size:10px">' + r.desc + '</span></div>';
      var btn = document.createElement("button");
      btn.className = "modal-btn"; btn.style.cssText = "font-size:10px;padding:4px 8px;white-space:nowrap";
      btn.textContent = "合成(" + cost + "灵蕴)";
      btn.disabled = essence < cost;
      btn.onclick = function() {
        Game.meta.essence -= cost;
        // v0.60 标记为下局初始携带
        if (!Game.meta.forgedRelic) Game.meta.forgedRelic = '';
        Game.meta.forgedRelic = r.id;
        Game.saveMeta();
        showRelicForge();
        toast('🔮 已合成 ' + r.name + '，下局开局必定获得！');
      };
      div.appendChild(btn);
      content.appendChild(div);
    });
  }

  // 显示当前已合成的遗物
  if (Game.meta.forgedRelic) {
    var forged = allRelics.find(function(r) { return r.id === Game.meta.forgedRelic; });
    if (forged) {
      var fDiv = document.createElement("div");
      fDiv.style.cssText = "margin-top:8px;padding:6px;background:#2a1a2a;border-radius:4px;text-align:center;color:#c8a8ff;font-size:11px";
      fDiv.textContent = '✅ 已合成：' + forged.name + ' — 下局开局获得';
      content.appendChild(fDiv);
    }
  }

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
}

// ===================== v0.60 装备收藏图鉴（Lv.4解锁，深渊裂隙装备） =====================
function showGearCodex() {
  var el = document.getElementById("meta-panel");
  el.style.display = "block"; var h3 = el.querySelector("h3"); if (h3) h3.textContent = "📦 鉴宝师 · 装备图鉴";
  var content = document.getElementById("meta-content"); content.innerHTML = "";
  var meta = Game.meta;

  // 初始化裂隙装备图鉴
  if (!meta.dungeonGearCodex) meta.dungeonGearCodex = {};
  var codex = meta.dungeonGearCodex;

  // 裂隙装备图鉴条目定义
  var gearEntries = [
    { id:'enchantAtk', name:'锋锐附魔', icon:'⚔️', desc:'秘境锻造台·攻击附魔', group:'附魔' },
    { id:'enchantHp', name:'坚韧附魔', icon:'❤️', desc:'秘境锻造台·生命附魔', group:'附魔' },
    { id:'enchantDef', name:'壁垒附魔', icon:'🛡️', desc:'秘境锻造台·防御附魔', group:'附魔' },
    { id:'enchantCrit', name:'致命附魔', icon:'💥', desc:'秘境锻造台·暴击附魔', group:'附魔' },
    { id:'enchantPen', name:'穿透附魔', icon:'🗡️', desc:'秘境锻造台·穿透附魔', group:'附魔' },
    { id:'enchantVamp', name:'吸血附魔', icon:'🩸', desc:'秘境锻造台·吸血附魔', group:'附魔' },
    { id:'refineAtk', name:'攻击精炼', icon:'🔥', desc:'秘境锻造台·攻击精炼', group:'精炼' },
    { id:'refineHp', name:'生命精炼', icon:'💚', desc:'秘境锻造台·生命精炼', group:'精炼' },
    { id:'refineDef', name:'防御精炼', icon:'💎', desc:'秘境锻造台·防御精炼', group:'精炼' },
    { id:'bossMat', name:'Boss材料收藏', icon:'🏆', desc:'击败裂隙Boss获得材料', group:'收藏' },
    { id:'rune', name:'符文收藏', icon:'💠', desc:'秘境锻造台·符文镶嵌', group:'收藏' },
    { id:'keyUsed', name:'裂隙探索家', icon:'🔑', desc:'累计使用裂隙钥匙', group:'成就' },
    { id:'towerFloor', name:'天梯攀登者', icon:'🏔️', desc:'无尽天梯最高层数', group:'成就' },
  ];

  // 进度统计
  var dungeon = meta.dungeon || {};
  var forgeLevels = dungeon.forge || {};
  var collected = 0;

  // 自动更新图鉴进度
  if ((forgeLevels.enchantAtk||0) >= 6) codex.enchantAtk = Math.max(codex.enchantAtk||0, 1);
  if ((forgeLevels.enchantHp||0) >= 6) codex.enchantHp = Math.max(codex.enchantHp||0, 1);
  if ((forgeLevels.enchantDef||0) >= 6) codex.enchantDef = Math.max(codex.enchantDef||0, 1);
  if ((forgeLevels.enchantCrit||0) >= 5) codex.enchantCrit = Math.max(codex.enchantCrit||0, 1);
  if ((forgeLevels.enchantPen||0) >= 5) codex.enchantPen = Math.max(codex.enchantPen||0, 1);
  if ((forgeLevels.enchantVamp||0) >= 5) codex.enchantVamp = Math.max(codex.enchantVamp||0, 1);
  if ((forgeLevels.refineAtk||0) >= 3) codex.refineAtk = Math.max(codex.refineAtk||0, 1);
  if ((forgeLevels.refineHp||0) >= 3) codex.refineHp = Math.max(codex.refineHp||0, 1);
  if ((forgeLevels.refineDef||0) >= 3) codex.refineDef = Math.max(codex.refineDef||0, 1);
  if (Object.keys(dungeon.clears||{}).length >= 1) codex.bossMat = Math.max(codex.bossMat||0, 1);
  if ((forgeLevels.runes||[]).length >= 3) codex.rune = Math.max(codex.rune||0, 1);
  if ((dungeon.keys||0) >= 5 || (dungeon.totalCleared||0) >= 3) codex.keyUsed = Math.max(codex.keyUsed||0, 1);
  if ((dungeon.tower||{}).bestFloor >= 20) codex.towerFloor = Math.max(codex.towerFloor||0, 1);

  // 统计
  collected = Object.values(codex).filter(function(v) { return v > 0; }).length;

  var statsDiv = document.createElement("div");
  statsDiv.style.cssText = "text-align:center;margin-bottom:10px;padding:10px;background:#1a1520;border-radius:8px;border:1px solid #ffa502";
  statsDiv.innerHTML = '<div style="font-size:28px">📦</div>' +
    '<div style="color:#ffa502;font-size:14px;font-weight:bold">收藏进度：' + collected + '/' + gearEntries.length + '</div>' +
    '<div style="color:#667788;font-size:10px;margin-top:4px">全部收集可获得 <b style="color:#ffa502">永久灵蕴+50</b> 奖励</div>';
  content.appendChild(statsDiv);

  // 渲染图鉴条目
  gearEntries.forEach(function(ge) {
    var owned = (codex[ge.id] || 0) > 0;
    var div = document.createElement("div");
    div.style.cssText = "margin-bottom:4px;padding:8px;background:#0d1117;border-radius:4px;display:flex;align-items:center;gap:8px;border-left:3px solid " + (owned ? '#ffa502' : '#222') + ";opacity:" + (owned ? '1' : '0.5');
    div.innerHTML = '<span style="font-size:20px">' + (owned ? ge.icon : '🔒') + '</span>' +
      '<div style="flex:1"><b style="color:' + (owned ? '#ddccaa' : '#555') + '">' + ge.name + '</b>' +
      '<br><span style="color:#667788;font-size:10px">' + ge.desc + ' [' + ge.group + ']</span></div>' +
      '<span style="font-size:12px;color:' + (owned ? '#ffa502' : '#444') + '">' + (owned ? '✅' : '—') + '</span>';
    content.appendChild(div);
  });

  // 全收集奖励
  if (collected >= gearEntries.length && !codex._rewardClaimed) {
    var rewardBtn = document.createElement("button");
    rewardBtn.className = "modal-btn"; rewardBtn.style.cssText = "margin-top:8px;width:100%;background:#2a1a0a;border-color:#ffa502;color:#ffcc88";
    rewardBtn.textContent = "🏆 领取全收集奖励：灵蕴+50";
    rewardBtn.onclick = function() {
      codex._rewardClaimed = true;
      meta.essence = (meta.essence || 0) + 50;
      Game.saveMeta();
      showGearCodex();
      toast('🏆 全图鉴收集完成！灵蕴+50！');
    };
    content.appendChild(rewardBtn);
  }

  var closeBtn = document.createElement("button");
  closeBtn.className = "restart-btn"; closeBtn.style.cssText = "margin-top:10px;width:100%";
  closeBtn.textContent = "关闭"; closeBtn.onclick = function() { el.style.display = "none"; };
  content.appendChild(closeBtn);
  showModal("meta-panel");
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

// ===================== TapTap 在线排行榜 =====================
function showTapLeaderboard(tab) {
  tab = tab || 'total';
  var el = document.getElementById('tap-lb-panel');
  el.style.display = 'block';
  var statusEl = document.getElementById('tap-lb-status');
  var contentEl = document.getElementById('tap-lb-content');

  // 尝试 TapTap SDK
  var opened = TapLeaderboard.showPanel(tab);
  if (opened) {
    statusEl.textContent = '✅ TapTap 在线排行榜已打开';
    contentEl.innerHTML = '<div style="color:#667;text-align:center;padding:20px">排行榜面板已在 TapTap 客户端中打开</div>';
  } else {
    statusEl.textContent = '⚠️ 浏览器环境 · 显示本地排行';
    var list = Game.getLeaderboard();
    if (list.length === 0) {
      contentEl.innerHTML = '<div style="color:#667788;text-align:center;padding:20px">暂无记录<br><span style="font-size:11px">在 TapTap 客户端中运行可查看在线排行</span></div>';
    } else {
      contentEl.innerHTML = list.map(function(e, i) {
        return '<div style="margin-bottom:6px;padding:8px;background:#0d1117;border-radius:6px;display:flex;justify-content:space-between">' +
          '<span><b style="color:#ffa502">#' + (i+1) + '</b> ' + (e.char||'--') + ' · ' + (e.diff||'standard') + '</span>' +
          '<span style="color:#ffa502;font-weight:bold">' + e.floor + '层</span>' +
          '<span style="color:#667;font-size:10px">' + (e.date||'') + '</span></div>';
      }).join('');
    }
  }

  document.getElementById('btn-tap-lb-total').onclick = function() { showTapLeaderboard('total'); };
  document.getElementById('btn-tap-lb-daily').onclick = function() { showTapLeaderboard('daily'); };
  document.getElementById('btn-close-tap-lb').onclick = function() { el.style.display = 'none'; };
  showModal('tap-lb-panel');
}

// ===================== TapTap 云存档面板 =====================
async function showCloudSavePanel() {
  var el = document.getElementById('tap-cloud-panel');
  el.style.display = 'block';
  var statusEl = document.getElementById('tap-cloud-status');
  var slotsEl = document.getElementById('tap-cloud-slots');

  statusEl.textContent = '🔍 检测云存档...';
  slotsEl.innerHTML = '<div style="color:#667;text-align:center;padding:10px">加载中...</div>';

  // 尝试获取远程存档列表
  var slots = [];
  try { slots = await TapSave.getArchiveList(); } catch(e) {}

  if (slots.length === 0) {
    statusEl.textContent = '⚠️ 浏览器环境（无 TapTap 客户端）\n使用本地 localStorage 存档';
    slotsEl.innerHTML = '<div style="color:#8899bb;text-align:center;padding:20px">' +
      '<div style="font-size:36px;margin-bottom:8px">☁️</div>' +
      '在 TapTap 客户端中运行可使用云存档<br>' +
      '<span style="color:#667;font-size:11px">云端存档可跨设备同步 · 永不丢失</span></div>';
  } else {
    statusEl.textContent = '✅ 云端已存储 ' + slots.length + ' 个存档';
    slotsEl.innerHTML = slots.map(function(s, i) {
      return '<div style="margin-bottom:4px;padding:6px;background:#0d1117;border-radius:4px;display:flex;justify-content:space-between;align-items:center">' +
        '<span>☁️ <b>' + (s.name||'存档'+(i+1)) + '</b></span>' +
        '<span style="color:#667;font-size:10px">' + (s.summary||'') + '</span>' +
        '<button class="modal-btn" style="font-size:10px;padding:2px 8px;width:auto;margin:0" onclick="window._loadCloudSlot(\'' + s.name + '\')">📥</button></div>';
    }).join('');
  }

  document.getElementById('btn-cloud-upload').onclick = async function() {
    if (TapSave.saveToCloud) {
      var ok = await TapSave.saveToCloud('slot_' + new Date().toISOString().slice(0,10), Game.state);
      toast(ok ? '☁️ 上传成功！' : '❌ 上传失败（非 TapTap 环境）');
      showCloudSavePanel();
    }
  };
  document.getElementById('btn-cloud-download').onclick = async function() {
    var data = await TapSave.loadFromCloud('auto_save');
    if (data) {
      if (Game.importSave(JSON.stringify(data))) { toast('☁️ 云存档已下载！'); render(Game.state); }
      else { toast('❌ 下载失败'); }
    } else {
      toast('❌ 未找到云存档（或非 TapTap 环境）');
    }
  };
  document.getElementById('btn-close-tap-cloud').onclick = function() { el.style.display = 'none'; };
  showModal('tap-cloud-panel');
}
window._loadCloudSlot = async function(name) {
  var data = await TapSave.loadFromCloud(name);
  if (data && Game.importSave(JSON.stringify(data))) {
    toast('☁️ 已加载云存档: ' + name);
    render(Game.state);
  } else { toast('❌ 加载失败'); }
};

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
  var shareText = '【妖塔勇者录】' + clsName + ' · ' + (s.difficulty || 'standard') + ' · 第' + floor + '层 · 遗物' + (s.relics ? s.relics.length : 0) + '件 · 装备' + (s.equip ? s.equip.length : 0) + '件';
  var shareBtn = document.createElement("button");
  shareBtn.textContent = "📋 复制战绩";
  shareBtn.style.cssText = "display:block;margin:8px auto;padding:10px 24px;background:#1a2a3a;border:1px solid #3a5a7a;color:#8899bb;border-radius:8px;cursor:pointer;font-size:13px;width:80%;max-width:300px";
  shareBtn.onclick = function() {
    if (navigator.clipboard) { navigator.clipboard.writeText(shareText).then(function() { toast("📋 战绩已复制！"); }); }
    else { prompt("复制这段战绩：", shareText); }
  };
  score.appendChild(shareBtn);

  // v0.50 药水弹窗关闭按钮
  var btnClosePotion = document.getElementById("btn-close-potion");
  if (btnClosePotion) btnClosePotion.onclick = function() { hideModal("potion-modal"); };

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
    { icon: "⚡", name: "能量涌动", desc: "开局额外+1最大能量", apply: function(s) { s.player.maxEnergy = (s.player.maxEnergy||3)+1; s.player.energy = s.player.maxEnergy; } },
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
  var mutIdx = (seed * 7 + 5) % mutations.length; // v0.71: 原Math.floor(seed/9)每9天才变一次，改为每天变化
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

// v0.51 每日签到奖励（7天循环 + UI面板 + 广告双倍）
var CHECKIN_REWARDS = [
  { essence: 3,            desc: '灵蕴 +3',             icon: '🌟' },
  { souls: 5,              desc: '魂晶 +5',             icon: '👻' },
  { stones: 8,             desc: '灵石 +8',             icon: '💎' },
  { essence: 5, souls: 3,  desc: '灵蕴+5 魂晶+3',       icon: '🌟' },
  { stones: 12,            desc: '灵石 +12',            icon: '💎' },
  { souls: 10,             desc: '魂晶 +10',            icon: '👻' },
  { essence: 10,materials:5, desc: '灵蕴+10 素材+5 ⭐',  icon: '🌟' }
];
function claimDailyReward(applyFn) {
  var meta = Game.meta;
  if (!meta.lastClaimDay) meta.lastClaimDay = '';
  var today = new Date(); var todayStr = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
  if (meta.lastClaimDay === todayStr) return null;
  var day = ((meta.loginStreak || 1) - 1) % 7;
  var reward = CHECKIN_REWARDS[day];
  if (!reward) return null;
  if (applyFn) { applyFn(reward); } else {
    if (reward.essence) Game.addEssence(reward.essence);
    if (reward.souls) Game.addSouls(reward.souls);
    if (reward.stones) Game.addStones(reward.stones);
    if (reward.materials) Game.addMaterials(reward.materials);
  }
  meta.lastClaimDay = todayStr;
  Game.saveMeta();
  return { day: day + 1, desc: reward.desc, reward: reward };
}

function showDailyCheckin() {
  var meta = Game.meta;
  var today = new Date(); var todayStr = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
  var alreadyClaimed = (meta.lastClaimDay === todayStr);
  var alreadyAdClaimed = meta._adClaimedDay === todayStr;
  var day = ((meta.loginStreak || 1) - 1) % 7;

  var el = document.getElementById('daily-checkin');
  el.style.display = 'block';

  // 连续签到天数
  document.getElementById('checkin-streak').textContent = '🔥 连续签到 ' + (meta.loginStreak || 1) + ' 天';

  // 7天网格
  var grid = document.getElementById('checkin-grid');
  grid.innerHTML = '';
  CHECKIN_REWARDS.forEach(function(r, i) {
    var cell = document.createElement('div');
    var isToday = i === day;
    var isPast = alreadyClaimed ? (i < day || (i === day && alreadyClaimed)) : (i < day);
    cell.style.cssText = 'padding:6px 2px;text-align:center;border-radius:6px;font-size:10px;' +
      (isToday ? 'border:2px solid #ffa502;background:#2a1a0a;' : isPast ? 'background:#1a2a1a;opacity:0.7;' : 'background:#111;opacity:0.4;');
    cell.innerHTML = '<div style="font-size:18px">' + r.icon + '</div><div style="color:' + (isToday?'#ffa502':'#667') + ';font-size:8px;margin-top:2px">' + r.desc + '</div>' +
      (isPast ? '<div style="color:#89e894;font-size:8px">✅</div>' : '');
    grid.appendChild(cell);
  });

  // 状态和按钮
  var status = document.getElementById('checkin-status');
  var btnClaim = document.getElementById('btn-checkin-claim');
  var btnAd = document.getElementById('btn-checkin-ad');

  if (alreadyClaimed) {
    status.textContent = alreadyAdClaimed ? '✅ 今日已签到 + 双倍已领取' : '✅ 今日已签到 · 还可看广告双倍';
    btnClaim.textContent = '✅ 已签到';
    btnClaim.disabled = true;
    btnClaim.style.opacity = '0.5';
    btnAd.textContent = alreadyAdClaimed ? '✅ 已双倍' : '📺 广告双倍（再领一次）';
    btnAd.disabled = alreadyAdClaimed || !Game.canWatchAd();
    btnAd.style.display = '';
  } else {
    status.textContent = '点击签到领取今日奖励';
    btnClaim.textContent = '📅 签到';
    btnClaim.disabled = false;
    btnClaim.style.opacity = '1';
    btnAd.textContent = '📺 广告双倍';
    btnAd.disabled = !Game.canWatchAd();
    btnAd.style.display = '';
  }

  btnClaim.onclick = function() {
    if (alreadyClaimed && !alreadyAdClaimed) {
      // 已签到 → 点击变成看广告再领一次
      if (Game.watchAd()) {
        var result = claimDailyReward(null); // 再领一次相同的奖励
        if (result) {
          meta._adClaimedDay = todayStr; Game.saveMeta();
          toast('📺 双倍签到！再得 ' + result.desc);
        }
      } else { toast('今日广告次数已用完'); }
    } else if (!alreadyClaimed) {
      var result = claimDailyReward(null);
      if (result) {
        toast('📅 签到第' + result.day + '天！' + result.desc);
        // 签到后显示广告双倍按钮
        btnAd.style.display = '';
        btnAd.disabled = !Game.canWatchAd();
      }
    }
    showDailyCheckin(); // 刷新面板
  };

  btnAd.onclick = function() {
    if (alreadyAdClaimed) { toast('今日已双倍领取'); return; }
    if (!Game.watchAd()) { toast('今日广告次数已用完'); return; }
    if (!alreadyClaimed) {
      // 未签到 → 广告双倍：直接领2份
      var result = claimDailyReward(function(r) {
        if (r.essence) Game.addEssence(r.essence * 2);
        if (r.souls) Game.addSouls(r.souls * 2);
        if (r.stones) Game.addStones(r.stones * 2);
        if (r.materials) Game.addMaterials(r.materials * 2);
      });
      if (result) {
        meta.lastClaimDay = todayStr; meta._adClaimedDay = todayStr;
        Game.saveMeta();
        toast('📺 广告双倍签到！' + result.desc + ' ×2！');
      }
    } else if (!alreadyAdClaimed) {
      // 已签到 → 广告再领一次（单倍）
      if (Game.watchAd()) {
        var result2 = claimDailyReward(null);
        if (result2) {
          meta._adClaimedDay = todayStr; Game.saveMeta();
          toast('📺 再领一次！' + result2.desc);
        }
      }
    }
    showDailyCheckin();
  };

  document.getElementById('btn-close-checkin').onclick = function() { el.style.display = 'none'; };
  showModal('daily-checkin');
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

// ===================== 新手引导 =====================
var _tutorialSteps = [
  { id:'welcome', title:'🏰 欢迎，勇士！', text:'边境城池是人类最后的庇护所。<br>魔塔的阴影正在蔓延，而你——<br>是这座城中最后的希望。', btn:'踏入征程', onShow:null },
  { id:'gate', title:'⚔️ 第一步：出城探险', text:'点击 <b style="color:#ffaaaa">"出城探险"</b> 按钮<br>选择难度和道途，踏上征程。', btn:'我知道了', onShow:function(){
    var gate = document.getElementById('btn-newgame'); if(gate) gate.style.boxShadow='0 0 24px #ffa502';
  }},
  { id:'pick', title:'🎭 选择道途', text:'每个职业有独特的技能和属性。<br>新手推荐 <b style="color:#ffaaaa">战士</b>：高血量、高容错。<br>选择难度后点击职业卡片即可开始。', btn:'开始冒险', onShow:null },
  { id:'battle', title:'⚡ 战斗基础', text:'每回合有 <b style="color:#ffdd77">3点能量</b><br>⚔️ 攻击消耗1点 · ⚡技能消耗1-3点<br>🛡️ 防御免费 · ⏩ 结束回合', btn:'明白！', onShow:function(){
    var atk = document.getElementById('btn-atk'); if(atk) atk.style.boxShadow='0 0 24px #ffa502';
    setTimeout(function(){ if(atk) atk.style.boxShadow=''; },2500);
  }},
  { id:'done', title:'🌟 准备就绪！', text:'你已经掌握了基础操作。<br>击败敌人、收集遗物、爬向塔顶——<br><b style="color:#ffa502">愿先祖之灵护佑你的征程！</b>', btn:'开始战斗！', onShow:null },
];
var _tutorialIdx = -1;
function showTutorialStep(idx) {
  if (idx >= _tutorialSteps.length) return;
  _tutorialIdx = idx;
  var step = _tutorialSteps[idx];
  // 移除旧引导层
  var old = document.getElementById('tutorial-overlay');
  if (old) old.remove();
  // 创建新引导层
  var overlay = document.createElement('div');
  overlay.id = 'tutorial-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-direction:column';
  overlay.innerHTML = '<div style="text-align:center;max-width:300px;padding:28px 20px;background:linear-gradient(180deg,#1a1528,#0d0a18);border:2px solid #5a4080;border-radius:16px;box-shadow:0 0 60px rgba(100,60,160,.5);animation:modalPopIn .3s ease-out">' +
    '<div style="font-size:48px;margin-bottom:12px">' + (step.id==='welcome'?'🏰':step.id==='gate'?'⚔️':step.id==='pick'?'🎭':step.id==='battle'?'⚡':'🌟') + '</div>' +
    '<div style="color:#c8a8ff;font-size:20px;font-weight:bold;margin-bottom:12px">' + step.title + '</div>' +
    '<div style="color:#c6d8e8;font-size:14px;line-height:2;margin-bottom:20px">' + step.text + '</div>' +
    '<button id="tutorial-btn" style="padding:12px 32px;background:linear-gradient(180deg,#8b0000,#5a0000);color:#fff;border:2px solid #cc3333;border-radius:10px;font-size:15px;font-weight:bold;cursor:pointer">' + step.btn + '</button>' +
    '<div style="color:#445;font-size:10px;margin-top:10px">点击背景也可跳过</div>' +
  '</div>';
  document.body.appendChild(overlay);
  document.getElementById('tutorial-btn').onclick = function(e) { e.stopPropagation(); advanceTutorial(); };
  overlay.onclick = function() { advanceTutorial(); };
  if (step.onShow) step.onShow();
}
function advanceTutorial() {
  var overlay = document.getElementById('tutorial-overlay');
  if (overlay) overlay.remove();
  _tutorialIdx++;
  if (_tutorialIdx < _tutorialSteps.length) {
    showTutorialStep(_tutorialIdx);
  } else {
    // 引导完成
    Game.meta.onboardingStage = Math.max(Game.meta.onboardingStage||0, 1);
    Game.saveMeta();
  }
}
// v0.51 阶段推进弹窗
var STAGE_NAMES = ['初入','觉醒','精进','超越','命运','传说'];
var STAGE_ICONS = ['🌱','🌟','📚','🔥','🍀','👑'];
var STAGE_UNLOCKS = [
  '仅战士/法师/影刃可用',
  '天赋树开放（根节点上限3层）· 职业精通面板',
  '天赋树全分支 · 锻造工坊 · 遗物研究 · 技能工坊 · 每日悬赏',
  '转职觉醒 · 弓手/武僧解锁 · 史官 · 藏书家',
  '星象占星 · 命运烙印 · 遗物许愿',
  '无尽挑战 · 隐藏装备合成 · 全部内容解锁'
];
function showStageUpPopup(newStage) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:12000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-direction:column;animation:modalPopIn .3s ease-out';
  overlay.innerHTML =
    '<div style="font-size:64px;margin-bottom:16px;animation:bigFloatPop .8s ease-out forwards">' + (STAGE_ICONS[newStage] || '🌟') + '</div>' +
    '<div style="color:#ffa502;font-size:28px;font-weight:bold;margin-bottom:8px;letter-spacing:4px">' + STAGE_NAMES[newStage] + '</div>' +
    '<div style="color:#c8a8ff;font-size:16px;margin-bottom:24px">新的力量已解锁</div>' +
    '<div style="color:#8899bb;font-size:13px;text-align:center;max-width:280px;line-height:1.8;margin-bottom:30px">' + (STAGE_UNLOCKS[newStage] || '') + '</div>' +
    '<div style="color:#667;font-size:11px;animation:pulse-skip 2s ease-in-out infinite">点击任意位置继续</div>';
  document.body.appendChild(overlay);
  overlay.onclick = function() { overlay.remove(); };
  // 6秒后自动消失
  setTimeout(function() { if (document.body.contains(overlay)) overlay.remove(); }, 6000);
}
// v0.80: window._showStageUp 移除（死代码，无任何调用方）

// v0.80: 改为本地函数，不再挂 window 全局
function showTutorialById(stepId) {
  var idx = _tutorialSteps.findIndex(function(s){return s.id===stepId;});
  if (idx >= 0) showTutorialStep(idx);
}

// 初始渲染
try {
  checkLoginStreak();
  // 每日签到按钮（不再自动弹出 toast，改为玩家主动点击按钮触发面板）
  var streakEl = document.getElementById("btn-login");
  if (streakEl) {
    var today2 = new Date(); var todayStr2 = today2.getFullYear() + '-' + (today2.getMonth()+1) + '-' + today2.getDate();
    var alreadyClaimed = Game.meta.lastClaimDay === todayStr2;
    streakEl.textContent = alreadyClaimed ? '✅ 已签到(' + (Game.meta.loginStreak||1) + '天)' : '📅 每日签到(连续' + (Game.meta.loginStreak||1) + '天)';
  }

  var fortune = getDailyFortune();
  var fortuneEl = document.getElementById("daily-fortune");
  if (fortuneEl) fortuneEl.innerHTML = fortune.icon + ' 运势：<b>' + fortune.name + '</b> — ' + fortune.desc +
    (fortune.mutation ? '<br>' + fortune.mutation.icon + ' 突变：<b style="color:#ff6644">' + fortune.mutation.name + '</b> — ' + fortune.mutation.desc : '');
  // meta-bar 和 btn-login 由 render() 实时刷新，此处不再重复设置
  console.log("[妖塔勇者录] 开始初始渲染, state:", Game.state ? 'OK' : 'NULL');
  render(Game.state);
  console.log("[妖塔勇者录] 初始渲染完成");
  // 新手引导：仅 onboardingStage===0 时触发
  if ((Game.meta.onboardingStage || 0) === 0) {
    setTimeout(function(){ showTutorialStep(0); }, 600);
  }
} catch(e) {
  console.error("[妖塔勇者录] 初始渲染失败:", e.message, e.stack);
}
console.log("妖塔勇者录 v0.81 | 妖塔勇者录");
