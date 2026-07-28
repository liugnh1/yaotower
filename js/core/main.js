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

// ---- 核心 ----
import { Game, onRender } from "./state.js";
import { R } from "./registry.js";
import { E, Events } from "./event-bus.js";
import { initAudio, playSound } from "./audio.js";
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

// ===================== 初始化 =====================
import { validateAll } from './validate.js';
Game.init();
validateAll(); // 启动时扫描所有配置，控制台输出警告
onRender(s => render(s));
initAudio();
window._usePotion = i => { Combat.usePotion(i); };

// ===================== 事件订阅：战斗反馈 → UI =====================
Events.on(E.BATTLE_START, d => {
  if (d.type === 'doubleFirst') log("<span class='info'>💨 天赋触发·首回合连击！</span>");
  if (d.type === 'doubleAttack' || d.type === 'doubleSkill') log("<span class='info'>💨 连击！</span>");
  if (d.type === 'defend') log("🛡️ 防御姿态！下回合反击+35%", "info");
  if (d.type === 'dodge') log("🍃 闪避！");
  if (d.type === 'chargeAttack') log(`<span class="warn">⚠️ ${d.name} 蓄力攻击！伤害翻倍！</span>`);
  if (d.type === 'potion') log(`<span class="heal">🧪 使用了 ${d.name}！${d.desc}</span>`);
  if (d.type === 'cleanse' && d.name) log(`<span class="info">🧴 清除了诅咒：${d.name}</span>`);
  if (d.type === 'burn') log(`<span class="warn">🔥 燃烧！${d.turns}回合，每回合${d.dmg}伤害</span>`);
  if (d.type === 'slow') log("<span class='info'>❄️ 迟缓！敌人下回合攻击力降低</span>");
  if (d.type === 'stun') log(`<span class="win">⚡ ${d.name} 被眩晕！跳过下回合</span>`);
  if (d.type === 'bossSkill') log(`<span class="warn">${d.msg}</span>`);
  if (d.type === 'synCritDice') log("<span class='win'>🎲 命运之眼触发！伤害翻倍！</span>");
  if (d.type === 'synergy') log(`<span class="win">🔗 羁绊激活：${d.name}！${d.desc}</span>`);
  if (d.type === 'stoneGaze') log("<span class='warn'>🗿 被石化了！跳过本回合</span>");
  if (d.tags) log(`<span class="warn">⚠️ 第${d.floor}层·${d.zone.name}：${d.enemy.name} ${d.tags}</span>`);
});

Events.on(E.PLAYER_DAMAGED, d => {
  if (d.crit) { log(`💥 <b class="crit">暴击！</b>造成 <span class="dmg">${d.dmg}</span> 点伤害`,"crit"); float(d.dmg+"!","float-crit"); }
  else if (d.counter) { log(`⚔️ <b style="color:#ffa502">反击！</b>造成 <span class="dmg">${d.dmg}</span> 点伤害`); float(d.dmg,"float-dmg"); }
  else if (d.source === 'thorn' && d.target === 'enemy') { log(`<span class="warn">荆棘反弹 ${d.dmg}！</span>`); }
  else if (d.source === 'thorn') { log(`<span class="warn">${d.enemy} 反伤 ${d.dmg}！</span>`); }
  else if (d.source === 'burn' && d.target === 'enemy') { log(`<span class="warn">🔥 燃烧造成 ${d.dmg} 伤害</span>`); }
  else if (d.source === 'bleed') { log(`<span class="warn">☠️ 流血损失 ${d.dmg} 生命</span>`); }
  else if (d.source && d.dmg > 0) { log(`${d.source} 攻击，造成 <span class="dmg">${d.dmg}</span> 伤害`); float(d.dmg,"float-dmg"); }
  else { log(`⚔️ 造成 <span class="dmg">${d.dmg}</span> 点伤害`); float(d.dmg,"float-dmg"); }
});

Events.on(E.PLAYER_HEALED, d => {
  if (d.source === 'lifeSteal') log(`<span class="heal">恢复 ${d.amount} 生命</span>`);
  if (d.source === 'regen') log(`<span class="heal">恢复 ${d.amount} 生命</span>`);
  if (d.source === 'rebirth') log(`<span class="win">🔥 凤凰羽触发！浴火重生！</span>`);
});

Events.on(E.ENEMY_KILLED, d => {
  log(`<span class="win">✨ ${d.name} 被斩杀！</span>`);
});

Events.on(E.GOLD_CHANGED, d => {
  if (d.delta > 0) {
    if (d.fast) log(`<span class="win">🏆 限时击杀！仅用${Game.state.turnInFloor}回合，金币翻倍！</span>`);
    log(`<span class="gold">💰 获得 ${d.delta} 金币</span>`); float("+"+d.delta,"float-gold");
  }
  if (d.souls > 0) { log(`<span class="win">💎 获得 ${d.souls} 魂晶！</span>`); float("+"+d.souls+"💎","float-gold"); }
});

Events.on(E.CURSE_APPLIED, d => {
  if (d.type === 'debuffAtk') log(`<span class="warn">☠️ ${d.name} 的诅咒降低了你的攻击力！</span>`);
});

Events.on(E.ROOM_ENTER, d => { /* 由 showRoomInfo 处理 */ });

Events.on(E.GAME_OVER, () => onGameOver());
Events.on(E.GAME_CLEAR, () => gameClear());

// ===================== 按钮绑定 =====================
document.getElementById("btn-newgame").onclick = () => { initAudio(); startNewGame(); };
document.getElementById("btn-continue").onclick = () => { try { if (Game.load()) { continueGame(); } else { Game.deleteSave(); render(Game.state); toast("存档损坏，已自动重置"); } } catch(e) { console.error("读档崩溃:", e); Game.deleteSave(); render(Game.state); toast("存档异常，已重置"); } };
document.getElementById("btn-codex").onclick = () => showCodexPanel();
document.getElementById("btn-daily").onclick = showDailyPanel;
document.getElementById("btn-meta").onclick = showMetaPanel;
document.getElementById("btn-delete").onclick = () => { if (confirm("确定删除存档？图鉴和排行榜将保留。")) { Game.hardReset(); switchScreen("start"); render(Game.state); } };
document.getElementById("btn-show-lb-start").onclick = () => showLeaderboard();
document.getElementById("btn-close-codex").onclick = () => hideModal("codex-panel");
document.getElementById("btn-close-daily").onclick = () => hideModal("daily-panel");
document.getElementById("btn-close-lb").onclick = () => hideModal("leaderboard");
document.getElementById("btn-hard-restart").onclick = () => { Game.hardReset(); switchScreen("start"); render(Game.state); };
document.getElementById("btn-read-save").onclick = () => { if (Game.load()) continueGame(); };
document.getElementById("btn-show-lb").onclick = () => showLeaderboard();

// 战斗按钮（带容错）
const _safe = (fn, name) => () => { try { fn(); } catch(e) { console.error(`[妖塔] ${name} 崩溃:`, e); toast("操作失败，已记录错误"); } };
document.getElementById("btn-atk").onclick = _safe(Combat.doAttack, "doAttack");
document.getElementById("btn-skill").onclick = _safe(Combat.doSkill, "doSkill");
document.getElementById("btn-def").onclick = _safe(Combat.doDefend, "doDefend");
document.getElementById("btn-auto").onclick = _safe(Combat.toggleAuto, "toggleAuto");
document.getElementById("btn-potion").onclick = _safe(openPotionModal, "openPotion");
document.getElementById("btn-close-potion").onclick = () => hideModal("potion-modal");

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
    { id: "soulStartRelic", name: "远古遗物", cost: 20, desc: "开局随机获得1个普通遗物", max: 1, apply: (s) => { const commons = R.get('relics').filter(r => r.rarity === 'common'); if (commons.length) { const r = { ...s.rng.pick(commons) }; if (r.passive) { r.passive(s.player); r.applied = true; } s.relics.push(r); } } },
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

// ===================== 新游戏流程 =====================
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
    lifeSteal: 0, thorn: 0, goldMul: 1, dodge: 0, bleed: 0,
    rage: false, doubleFirst: false, debuffAtk: null, dmgReduce: 0,
    berserk: false, rebirth: false, regen: 0
  };
  Game.applyMetaBonus(s.player);
  // 开局药水（修复 startPotion 陷阱）
  const startPots = Game.getStartPotions();
  s.potions.push(...startPots);
  // 应用魂晶升级
  applySoulUpgrades(s);

  buildSkillSelect(cls, sk => {
    s.activeSkill = sk;
    s.player.skillMul = sk.mul;
    if (sk.extraCost) s.player.mpCost += sk.extraCost;
    if (sk.extraPen) s.player.pen += sk.extraPen;
    if (!s.noTalent) {
      buildTalentSelect(tal => {
        console.log("[妖塔] 天赋选中:", tal.name);
        s.talent = tal;
        tal.apply(s.player);
        console.log("[妖塔] 天赋应用完成，准备出发");
        initZone("plains");
      });
      console.log("[妖塔] 显示天赋选择界面");
      switchScreen("talent-select");
    } else {
      console.log("[妖塔] noTalent=true，跳过天赋直接出发");
      initZone("plains");
    }
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

  // Zone 结束 → 分支或通关
  if (!roomType) {
    if (Room.isFinalZone(s.zone.id)) { gameClear(); return; }
    const route = R.get("simpleRoute");
    const nextChoices = route[s.zone.id] ? route[s.zone.id].choices : [];
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

  // 战斗房间：暖场3间不出岔路，之后 ~30% 概率出现分岔
  const isWarmup = s.floorInZone <= 3;
  const forkChance = 0.30;
  if (!isWarmup && s.rng.chance(forkChance) && s._roomPool.length > 0) {
    const other = Room.tryDrawDifferent(roomType);
    if (other) {
      console.log("[妖塔] 岔路:", roomType, "vs", other);
      const rs = document.getElementById('room-select');
      if (rs) { rs.style.backgroundImage = `url('img/bg-battle-${s.zone.id}.jpg?v=032')`; }
      showRoomFork(roomType, other);
      return;
    }
  }

  // 默认：直接进入战斗
  processRoom(roomType);
}

// ---- 展示双门分岔路 ----
function showRoomFork(typeA, typeB) {
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
    left.onclick = () => { const other = typeB; Room.returnRoom(other); processRoom(typeA); };
  }
  if (right) {
    right.style.display = ""; right.dataset.type = typeB;
    right.querySelector(".door-icon").textContent = rtB.icon;
    right.querySelector(".door-name").textContent = rtB.name;
    right.querySelector(".door-hint").textContent = getRoomHint(typeB);
    right.onclick = () => { const other = typeA; Room.returnRoom(other); processRoom(typeB); };
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
  if (main) main.style.backgroundImage = `url('img/bg-battle-${zoneId}.jpg?v=032')`;
}

function processRoom(roomId) {
  // 隐藏分岔路界面，防止门和弹窗重叠可点击
  const rs = document.getElementById('room-select');
  if (rs) rs.classList.add('hidden');

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
}

function nextRoom() {
  const s = Game.state;
  if (Room.isZoneEnd()) {
    if (Room.isFinalZone(s.zone.id)) { gameClear(); return; }
    const route = R.get("simpleRoute");
    const nextChoices = route[s.zone.id] ? route[s.zone.id].choices : [];
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
    Game.sync(); enterRoom();
  }
}

// ===================== 战斗回调 =====================
function onWin(isFast) {
  const s = Game.state;
  const roomType = s._currentRoomType;
  if (roomType === "boss") {
    s.gold += 50 + s.totalFloor;
    showBossRelicPick(isFast);
  } else if (roomType === "elite") {
    s.gold += 30;
    showReward(isFast, eq => takeEquip(eq), attr => takeAttrReward(attr, isFast, false), true);
  } else {
    showReward(isFast, eq => takeEquip(eq), attr => takeAttrReward(attr, isFast, false), false);
  }
  showModal("reward");
}

function onGameOver() {
  const s = Game.state;
  Game.meta.totalDeaths++;
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

function gameClear() {
  const s = Game.state;
  Game.meta.totalWins++;
  if (s.mode === "simple" && Game.meta.highestSimple < s.totalFloor) Game.meta.highestSimple = s.totalFloor;
  const tp = Prog.calcTP(s.totalFloor, true);
  const souls = 10 + s.totalFloor; // 通关: 10+层数额外魂晶
  Game.addTP(tp);
  Game.meta.souls += souls;
  Game.addLeaderboard({ char: s.playerClass ? s.playerClass.name : "--", diff: s.difficulty, floor: s.totalFloor });
  Prog.awardCharExp(s);
  Game.saveMeta();
  showGameOver(true, `通关奖励：${tp} 天赋点 + ${souls} 魂晶！`);
  Game.deleteSave();
}

// ===================== 奖励处理 =====================
function takeEquip(eq) {
  const s = Game.state, p = s.player;
  if (s.equip.length >= 6) { log("<span class='warn'>装备栏已满，丢弃旧装备</span>"); s.equip.shift(); }
  s.equip.push(eq); playSound("equip");
  if (eq.stat === "maxHp") { p.maxHp += eq.val; p.hp = Math.min(p.hp + eq.val, p.maxHp); }
  else if (eq.stat === "maxMp") { p.maxMp += eq.val; p.mp = Math.min(p.mp + eq.val, p.maxMp); }
  log(`${eq.icon} <span style="color:${eq.color}"><b>${eq.fullName||eq.name}</b></span> 已装备！${eq.stat.toUpperCase()}+${eq.val}`, "win");
  hideModal("reward"); nextRoom();
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
  playSound("equip");
  log(`${r.icon} <b style="color:${RARITY_COLOR[r.rarity]}">${r.name}</b> 已获得！${r.desc}`, "win");
  hideModal("reward"); nextRoom();
}

// ===================== 商店 =====================
function openShop() {
  const s = Game.state;
  document.getElementById("shop").style.display = "block";
  document.getElementById("shop-gold").textContent = s.gold || 0;
  const list = document.getElementById("shop-list"); list.innerHTML = "";
  const items = Shop.getShopItems();
  const mul = s.adDiscount ? 0.5 : 1;
  items.forEach(it => {
    const finalCost = Math.floor(it.cost * mul);
    const btn = document.createElement("button"); btn.className = "modal-btn";
    btn.innerHTML = `${it.icon} ${it.name} — <span style="color:#ffdd77">${finalCost}G</span>${s.adDiscount ? ' <span style="color:#89e894">[5折]</span>' : ''}`;
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
  let type;
  if (roomType === "event") {
    // 随机事件类型（包括赌博）
    const pool = ["shrine", "altar", "gamble", "gamble", "trade", "mystery"];
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
          s.equip.splice(idx, 1);
          if (eq.stat === "maxHp") { s.player.maxHp -= eq.val; s.player.hp = Math.min(s.player.hp, s.player.maxHp); }
          else if (eq.stat === "maxMp") { s.player.maxMp -= eq.val; s.player.mp = Math.min(s.player.mp, s.player.maxMp); }
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
  }
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
    const commons = R.get('relics').filter(r => r.rarity === 'common');
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
      const sk = s.rng.pick(cls.skills);
      s.activeSkill = sk; s.player.skillMul = sk.mul; if (sk.extraCost) s.player.mpCost += sk.extraCost;
      initZone("plains");
    }, "class-grid-daily");
    switchScreen("class-select");
  };
  showModal("daily-panel");
}

// ===================== UI 辅助函数 =====================
function buildDifficultySelect(onPick) {
  const grid = document.getElementById("diff-grid"); grid.innerHTML = "";
  const diffs = R.get('difficulties');
  Object.values(diffs).forEach(d => {
    const div = document.createElement("div"); div.className = "card"; div.dataset.diff = d.id;
    div.innerHTML = `<div class="icon">${d.icon}</div><div class="name">${d.name}</div><div class="desc">${d.desc}</div>`;
    div.onclick = () => onPick(d); grid.appendChild(div);
  });
}

function buildClassSelect(onPick, gridId = "class-grid") {
  const grid = document.getElementById(gridId); grid.innerHTML = "";
  const unlocked = Game.meta.unlocks || ["warrior", "mage"];
  const classes = R.get('classes');
  Object.values(classes).forEach(c => {
    const div = document.createElement("div"); div.className = "card";
    const locked = !unlocked.includes(c.id);
    div.innerHTML = `<div class="icon">${c.icon}</div><div class="name">${c.name}${locked ? '🔒' : ''}</div><div class="desc">${c.desc}</div>`;
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

function showRoomInfo(s) {
  const roomId = s.roomQueue[s.roomIndex]; if (!roomId) return;
  const rt = R.get('roomTypes', roomId) || R.get('roomTypes', 'battle');
  const isBoss = roomId === 'boss';
  document.getElementById("room-info").textContent = `第 ${s.totalFloor} 层 · ${s.zone.name}`;
  document.getElementById("room-desc").innerHTML = `<span style="color:${rt.color};font-size:32px">${rt.icon}</span><br><b>${rt.name}</b><br><span style="color:#8899bb">${rt.desc}</span>${isBoss ? '<br><span style="color:#ff4444;font-size:14px">⚠️ 关底首领 · 准备迎战！</span>' : ''}`;
  if (isBoss) document.getElementById("room-info").style.color = "#ff4444";
  else document.getElementById("room-info").style.color = "";
}

// ---- 战利品弹窗 ----
function showReward(isFast, onEquip, onAttr, isElite) {
  const el = document.getElementById("reward"); el.style.display = "block";
  const list = document.getElementById("reward-list"); list.innerHTML = "";
  if (isElite) {
    const hdr = document.createElement("div");
    hdr.style.cssText = "color:#ff4444;font-size:13px;margin-bottom:8px;font-weight:bold";
    hdr.textContent = "👺 精英奖励 · 双倍掉落！";
    list.appendChild(hdr);
  }
  const n = isElite ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const eq = Loot.genEquip();
    const btn = document.createElement("button"); btn.className = "modal-btn";
    btn.innerHTML = `${eq.icon} <b style="color:${eq.color}">${eq.fullName||eq.name}</b> <span class="tag">${eq.stat.toUpperCase()}+${eq.val}</span>`;
    btn.onclick = () => onEquip(eq); list.appendChild(btn);
  }
  const bonus = isElite ? 3 : 0;
  const attrs = [
    { id: "atk", name: "攻击 +" + ((isFast ? 10 : 5) + bonus), icon: "🔴" },
    { id: "hp", name: "生命上限 +" + ((isFast ? 50 : 25) + bonus * 5), icon: "🟢" },
    { id: "mp", name: "灵力上限 +" + ((isFast ? 20 : 10) + bonus), icon: "🔵" },
    { id: "heal", name: "恢复全部生命", icon: "🟡" }
  ];
  attrs.forEach(a => {
    const btn = document.createElement("button"); btn.className = "modal-btn";
    btn.innerHTML = `${a.icon} ${a.name}`; btn.onclick = () => onAttr(a.id, isFast); list.appendChild(btn);
  });
}

// ---- Boss 遗物三选一 ----
function showBossRelicPick(isFast) {
  const el = document.getElementById("reward"); el.style.display = "block";
  const list = document.getElementById("reward-list"); list.innerHTML = "";
  const hdr = document.createElement("div");
  hdr.style.cssText = "color:#ffa502;font-size:14px;margin-bottom:10px;font-weight:bold";
  hdr.textContent = "💀 Boss 遗物 · 三选一";
  list.appendChild(hdr);

  const relics = [];
  for (let i = 0; i < 3; i++) {
    let rel = Loot.genRelic();
    // 去重
    let tries = 0;
    while (relics.some(r => r.id === rel.id) && tries < 10) {
      rel = Loot.genRelic(); tries++;
    }
    relics.push(rel);
  }

  relics.forEach(rel => {
    const btn = document.createElement("button"); btn.className = "modal-btn";
    btn.style.cssText = "text-align:left;padding:12px;margin-bottom:8px;border:2px solid " + (RARITY_COLOR[rel.rarity] || "#667788");
    btn.innerHTML = `${rel.icon} <b style="color:${RARITY_COLOR[rel.rarity]}">${rel.name}</b> <span class="tag" style="color:${RARITY_COLOR[rel.rarity]}">${RARITY_NAME[rel.rarity]}</span><br><span style="color:#8899bb;font-size:12px">${rel.desc}</span>`;
    btn.onclick = () => { takeRelic(rel); };
    list.appendChild(btn);
  });

  // 属性奖励备选
  const divider = document.createElement("div");
  divider.style.cssText = "color:#667788;font-size:12px;margin:8px 0";
  divider.textContent = "—— 或者选择属性奖励 ——";
  list.appendChild(divider);

  const attrs = [
    { id: "atk", name: "攻击 +" + (isFast ? 15 : 8), icon: "🔴" },
    { id: "hp", name: "生命上限 +" + (isFast ? 80 : 40), icon: "🟢" },
    { id: "mp", name: "灵力上限 +" + (isFast ? 30 : 15), icon: "🔵" },
    { id: "heal", name: "恢复全部生命", icon: "🟡" }
  ];
  attrs.forEach(a => {
    const btn = document.createElement("button"); btn.className = "modal-btn";
    btn.innerHTML = `${a.icon} ${a.name}`; btn.onclick = () => takeAttrReward(a.id, isFast, true); list.appendChild(btn);
  });
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

function showCodexPanel() {
  const data = Game.getAllCodex(); const content = document.getElementById("codex-content");
  const entries = Object.values(data);
  if (entries.length === 0) { content.innerHTML = '<div style="color:#667788;text-align:center;padding:20px">暂无记录<br><span style="font-size:12px">击败怪物后将自动记录</span></div>'; }
  else { content.innerHTML = entries.sort((a, b) => (b.lastFloor || 0) - (a.lastFloor || 0)).map(m => `<div class="codex-entry"><b>${m.name || '?'}</b> <span>第${m.floor || '?'}层首遇</span> <span style="color:#ffa502">击杀${m.kills || 0}次</span><br><span>HP:${m.hp || '-'} ATK:${m.atk || '-'} DEF:${m.def || '-'}</span></div>`).join(''); }
  showModal("codex-panel");
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
  const s = Game.state;
  document.getElementById("end-title").textContent = isWin ? "🏆 通关！" : "☠️ 身死道消";
  document.getElementById("end-score").innerHTML = `角色：${s.playerClass ? s.playerClass.name : '--'}<br>难度：${s.difficulty || 'standard'}<br>到达层数：${s.totalFloor || 0}`;
  document.getElementById("meta-reward").textContent = rewardText || "";
  switchScreen("gameover");
}

// 初始渲染
try {
  console.log("[妖塔] 开始初始渲染, state:", Game.state ? 'OK' : 'NULL');
  render(Game.state);
  console.log("[妖塔] 初始渲染完成");
} catch(e) {
  console.error("[妖塔] 初始渲染失败:", e.message, e.stack);
}
console.log("妖塔 v0.32 | Registry + EventBus + DLC架构 | 6项地基升级完成");
