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
  document.getElementById("meta-tp").textContent = meta.tp || 0;
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
}

// ===================== 新游戏流程 =====================
function startNewGame() {
  const inputEl = document.getElementById("seed-input");
  const input = inputEl ? inputEl.value.trim() : "";
  Game.hardReset();
  const s = Game.state;
  s.seed = input || ("" + Date.now());
  s.rng = new RNG(s.seed);
  buildDifficultySelect(diff => {
    s.difficulty = diff.id;
    Game.saveMeta();
    switchScreen("class-select");
    buildClassSelect(cls => pickClass(cls));
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
        console.log("[妖塔] 天赋应用完成，准备 initZone");
        initZone(0);
      });
      console.log("[妖塔] 显示天赋选择界面");
      switchScreen("talent-select");
    } else {
      console.log("[妖塔] noTalent=true，跳过天赋直接 initZone");
      initZone(0);
    }
  });
  switchScreen("skill-select");
}

function initZone(idx) {
  console.log("[妖塔] initZone idx=", idx, "rng=", !!Game.state.rng);
  // Room.initZone 设置区域数据，返回 false 表示需要玩家选路线
  const canEnter = Room.initZone(idx);
  console.log("[妖塔] Room.initZone returned canEnter=", canEnter);
  if (!canEnter) {
    // 需要选路线：显示路线选择界面
    const route = R.get('simpleRoute')[idx - 1];
    buildZoneSelect(idx - 1, z => { Game.state.zone = z; enterRoom(); });
    switchScreen("zone-select");
    return;
  }
  // 直接进入第一个房间
  enterRoom();
}

function enterRoom() {
  const s = Game.state;
  console.log("[妖塔] enterRoom called, roomIndex=", s.roomIndex, "queueLen=", s.roomQueue.length);
  // 重置每房间状态
  Room.prepareRoomEntry();
  const roomId = Room.getCurrentRoomId();
  console.log("[妖塔] current roomId=", roomId);
  if (!roomId) {
    // 本关房间已用完，推进到下一区域
    if (Room.isSimpleRouteEnd(s.zoneIndex)) { gameClear(); return; }
    s.zoneIndex++;
    if (!Room.initZone(s.zoneIndex)) { return; } // 需要选路线，zone-select 已显示
    enterRoom(); // 直接进入第一个房间
    return;
  }
  hideAllModals();
  showRoomInfo(s);
  switchScreen("room-select");
  document.getElementById("btn-enter-room").onclick = () => processRoom(roomId);
}

function processRoom(roomId) {
  document.getElementById("btn-enter-room").onclick = null;
  try {
    Room.advanceRoom(); // roomIndex++
    if (roomId === "shop") { openShop(); }
    else if (roomId === "event" || roomId === "shrine" || roomId === "altar") { openEvent(roomId); }
    else if (roomId === "chest") { openChest(); }
    else if (roomId === "boss") { Combat.startBattle("boss"); switchScreen("main"); }
    else if (roomId === "elite") { Combat.startBattle("elite"); switchScreen("main"); }
    else { Combat.startBattle("normal"); switchScreen("main"); }
  } catch(e) {
    console.error("[妖塔] processRoom 崩溃:", e);
    toast("出错了，请刷新页面。错误已记录到控制台");
    Game.sync(); // 尝试保存当前状态
  }
}

function nextRoom() {
  const s = Game.state;
  if (Room.isZoneEnd()) {
    // 本关结束
    if (Room.isSimpleRouteEnd(s.zoneIndex)) { gameClear(); return; }
    showModal("endless-choice");
    document.getElementById("btn-next-zone").onclick = () => { hideModal("endless-choice"); Room.advanceFloor(); s.zoneIndex++; initZone(s.zoneIndex); };
    document.getElementById("btn-end-run").onclick = () => { hideModal("endless-choice"); Room.advanceFloor(); gameClear(); };
  } else {
    Room.advanceFloor();
    Game.sync(); enterRoom();
  }
}

// ===================== 战斗回调 =====================
function onWin(isFast) {
  const s = Game.state;
  if (s.roomQueue[s.roomIndex - 1] === "boss") {
    s.gold += 50 + s.totalFloor;
    showBossReward(isFast, rel => takeRelic(rel), attr => takeAttrReward(attr, isFast, true));
  } else {
    showReward(isFast, eq => takeEquip(eq), attr => takeAttrReward(attr, isFast, false));
  }
  showModal("reward");
}

function onGameOver() {
  const s = Game.state;
  Game.meta.totalDeaths++;
  const tp = Prog.calcTP(s.totalFloor, false);
  if (tp > 0) { Game.addTP(Math.floor(tp * Prog.getAdTPBonus())); }
  Game.addLeaderboard({ char: s.playerClass ? s.playerClass.name : "--", diff: s.difficulty, floor: s.totalFloor });
  Prog.awardCharExp(s);
  Game.saveMeta();
  showGameOver(false, tp > 0 ? `获得 ${tp} 天赋点` : "");
}

function gameClear() {
  const s = Game.state;
  Game.meta.totalWins++;
  if (s.mode === "simple" && Game.meta.highestSimple < s.totalFloor) Game.meta.highestSimple = s.totalFloor;
  const tp = Prog.calcTP(s.totalFloor, true);
  Game.addTP(tp);
  Game.addLeaderboard({ char: s.playerClass ? s.playerClass.name : "--", diff: s.difficulty, floor: s.totalFloor });
  Prog.awardCharExp(s);
  Game.saveMeta();
  showGameOver(true, `通关奖励：${tp} 天赋点！`);
  Game.deleteSave();
}

// ===================== 奖励处理 =====================
function takeEquip(eq) {
  const s = Game.state, p = s.player;
  if (s.equip.length >= 6) { log("<span class='warn'>装备栏已满，丢弃旧装备</span>"); s.equip.shift(); }
  s.equip.push(eq); playSound("equip");
  if (eq.stat === "maxHp") { p.maxHp += eq.val; p.hp = Math.min(p.hp + eq.val, p.maxHp); }
  else if (eq.stat === "maxMp") { p.maxMp += eq.val; p.mp = Math.min(p.mp + eq.val, p.maxMp); }
  log(`${eq.icon} <span style="color:${eq.color}"><b>${eq.prefix||''}${eq.name}</b></span> 已装备！${eq.stat.toUpperCase()}+${eq.val}`, "win");
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
  const s = Game.state;
  if (s.relics.length >= 6) { const old = s.relics[0]; if (old && old.onRemove) old.onRemove(s.player); log("<span class='warn'>遗物栏已满，替换最旧的遗物</span>"); s.relics.shift(); }
  if (r.passive && !r.applied) { r.passive(s.player); r.applied = true; }
  s.relics.push(r); playSound("equip");
  log(`${r.icon} <b style="color:${RARITY_COLOR[r.rarity]}">${r.name}</b> 已获得！${r.desc}`, "win");
  // 检查遗物联动
  const activated = Synergy.checkSynergies();
  activated.forEach(syn => log(`<span class="win">🔗 羁绊激活：${syn.name}！${syn.desc}</span>`));
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
  document.getElementById("btn-ad-refresh").disabled = !canAd;
  document.getElementById("btn-ad-refresh").onclick = () => { if (Game.watchAd()) { s.adRefreshCount++; openShop(); } };
  document.getElementById("btn-ad-discount").disabled = !canAd || s.adDiscount;
  document.getElementById("btn-ad-discount").onclick = () => { if (Game.watchAd()) { s.adDiscount = true; Game.sync(); openShop(); } };
  document.getElementById("btn-close-shop").onclick = () => { hideModal("shop"); nextRoom(); };
}

// ===================== 事件 =====================
function openEvent(roomType) {
  const s = Game.state;
  let type;
  if (roomType === "event") {
    type = EventSys.randomEventType(s);
  } else {
    type = roomType;
  }
  const el = document.getElementById("event"); el.style.display = "block";
  const title = document.getElementById("event-title"), desc = document.getElementById("event-desc"), btns = document.getElementById("event-btns");
  btns.innerHTML = "";
  const onClose = () => { hideModal("event"); nextRoom(); };

  if (type === "shrine") {
    title.textContent = "⛩️ 古老神龛"; desc.textContent = "献祭金币，获得祝福。";
    addEventBtn("奉献 30G：永久攻击+3", () => { if (Shop.shrineOffer('atk')) { Game.sync(); onClose(); } else alert("金币不足！"); });
    addEventBtn("奉献 30G：回满生命", () => { if (Shop.shrineOffer('heal')) { Game.sync(); onClose(); } else alert("金币不足！"); });
    addEventBtn("离开", onClose);
  } else if (type === "chest") {
    title.textContent = "📦 尘封宝箱"; desc.textContent = "免费开启，命运自有安排。";
    addEventBtn("开启", () => {
      EventSys.openChest((resultType, data) => {
        if (resultType === 'equip') { playSound("equip"); log("<span class='win'>宝箱开出装备！</span>"); }
        else if (resultType === 'gold') log("<span class='gold'>宝箱开出 30 金币！</span>");
        else { playSound("equip"); log("<span class='win'>宝箱开出遗物！</span>"); }
        Game.sync(); onClose();
      });
    });
  } else {
    title.textContent = "☠️ 黑暗祭坛"; desc.textContent = "接受诅咒，换取强大力量。";
    const rel = Loot.genRelic(), curse = s.rng.pick(R.get('curses'));
    addEventBtn(`获得 ${rel.name}，但承受 ${curse.name}`, () => {
      Shop.acquireRelic(rel);
      s.curses.push(curse); curse.apply(s.player);
      log(`<span class="warn">☠️ 诅咒：${curse.desc}</span>`);
      Game.sync(); onClose();
    });
    addEventBtn("离开", onClose);
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
  if (s.enemy && s.enemy.hp > 0) { switchScreen("main"); }
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
      g.apply(s); p.apply(s); e.apply(s);
      const sk = s.rng.pick(cls.skills);
      s.activeSkill = sk; s.player.skillMul = sk.mul; if (sk.extraCost) s.player.mpCost += sk.extraCost;
      initZone(0);
    });
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

function buildClassSelect(onPick) {
  const grid = document.getElementById("class-grid"); grid.innerHTML = "";
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

function buildZoneSelect(zoneIdx, onPick) {
  document.getElementById("zone-info").textContent = `第 ${zoneIdx + 1} 关结束，前方出现岔路`;
  const grid = document.getElementById("zone-grid"); grid.innerHTML = "";
  const route = R.get('simpleRoute')[zoneIdx]; if (!route || route.choices.length === 0) return;
  route.choices.forEach(zid => {
    const z = R.get('zones', zid); if (!z) return;
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = `<div class="icon">${z.icon}</div><div class="name">${z.name}</div><div class="desc">${z.desc}</div>`;
    div.onclick = () => onPick(z); grid.appendChild(div);
  });
}

function showRoomInfo(s) {
  const roomId = s.roomQueue[s.roomIndex]; if (!roomId) return;
  const rt = R.get('roomTypes', roomId) || R.get('roomTypes', 'battle');
  document.getElementById("room-info").textContent = `第 ${s.totalFloor} 层 · ${s.zone.name}`;
  document.getElementById("room-desc").innerHTML = `<span style="color:${rt.color};font-size:32px">${rt.icon}</span><br><b>${rt.name}</b><br><span style="color:#8899bb">${rt.desc}</span>`;
}

// ---- 战利品弹窗 ----
function showReward(isFast, onEquip, onAttr) {
  const el = document.getElementById("reward"); el.style.display = "block";
  const list = document.getElementById("reward-list"); list.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const eq = Loot.genEquip();
    const btn = document.createElement("button"); btn.className = "modal-btn";
    btn.innerHTML = `${eq.icon} <b style="color:${eq.color}">${eq.prefix || ''}${eq.name}</b> <span class="tag">${eq.stat.toUpperCase()}+${eq.val}</span>`;
    btn.onclick = () => onEquip(eq); list.appendChild(btn);
  }
  const attrs = [
    { id: "atk", name: "攻击 +" + (isFast ? 10 : 5), icon: "🔴" },
    { id: "hp", name: "生命上限 +" + (isFast ? 50 : 25), icon: "🟢" },
    { id: "mp", name: "灵力上限 +" + (isFast ? 20 : 10), icon: "🔵" },
    { id: "heal", name: "恢复全部生命", icon: "🟡" }
  ];
  attrs.forEach(a => {
    const btn = document.createElement("button"); btn.className = "modal-btn";
    btn.innerHTML = `${a.icon} ${a.name}`; btn.onclick = () => onAttr(a.id, isFast); list.appendChild(btn);
  });
}

function showBossReward(isFast, onRelic, onAttr) {
  const el = document.getElementById("reward"); el.style.display = "block";
  const list = document.getElementById("reward-list"); list.innerHTML = "";
  const rel = Loot.genRelic();
  const btn = document.createElement("button"); btn.className = "modal-btn";
  btn.innerHTML = `${rel.icon} <b style="color:${RARITY_COLOR[rel.rarity]}">${rel.name}</b> <span class="tag">${RARITY_NAME[rel.rarity]}·${rel.desc}</span>`;
  btn.onclick = () => onRelic(rel); list.appendChild(btn);
  const attrs = [
    { id: "atk", name: "攻击 +" + (isFast ? 15 : 8), icon: "🔴" },
    { id: "hp", name: "生命上限 +" + (isFast ? 80 : 40), icon: "🟢" },
    { id: "mp", name: "灵力上限 +" + (isFast ? 30 : 15), icon: "🔵" },
    { id: "heal", name: "恢复全部生命", icon: "🟡" }
  ];
  attrs.forEach(a => {
    const btn2 = document.createElement("button"); btn2.className = "modal-btn";
    btn2.innerHTML = `${a.icon} ${a.name}`; btn2.onclick = () => onAttr(a.id, isFast); list.appendChild(btn2);
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
