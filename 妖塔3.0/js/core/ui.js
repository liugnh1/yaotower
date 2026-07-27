import { Game } from "./state.js";
import { playSound } from "./audio.js";
import { RARITY_COLOR, RARITY_NAME, ROOM_TYPES, POTIONS, DIFFICULTIES, CLASSES, TALENTS, RELICS, CURSES, EQUIP_QUALITIES, EQUIP_TYPES, EQUIP_PREFIXES, ZONES, SIMPLE_ROUTE, DAILY_GLOBAL_MODS, DAILY_PLAYER_MODS, DAILY_ENEMY_MODS } from "./config.js";

const SCREENS = ["start","difficulty-select","class-select","skill-select","zone-select","room-select","main","gameover"];
const MODALS = ["reward","shop","event","endless-choice","potion-modal","daily-panel","codex-panel","leaderboard"];

function log(h, c="") {
  const d = document.getElementById("log"), s = document.createElement("div");
  s.className = c; s.innerHTML = h;
  d.appendChild(s); d.scrollTop = d.scrollHeight;
  while (d.children.length > 30) d.removeChild(d.firstChild);
}

export function switchScreen(id) {
  SCREENS.forEach(s => document.getElementById(s).classList.toggle("hidden", s !== id));
  if (id === "main") document.getElementById("main").classList.remove("hidden");
  if (id === "gameover") document.getElementById("gameover").style.display = "block";
}
export function showModal(id) { document.getElementById(id).style.display = "block"; }
export function hideModal(id) { document.getElementById(id).style.display = "none"; }
export function hideAllModals() { MODALS.forEach(id => hideModal(id)); }

export function render(s) {
  document.getElementById("continue-box").style.display = Game.hasSave() ? "block" : "none";
  document.getElementById("gold-text").textContent = s.gold || 0;
  if (s.player) {
    const hpPct = s.player.maxHp > 0 ? Math.max(0, s.player.hp) / s.player.maxHp * 100 : 0;
    const mpPct = s.player.maxMp > 0 ? s.player.mp / s.player.maxMp * 100 : 0;
    document.getElementById("pl-hp").textContent = `${Math.max(0, s.player.hp)}/${s.player.maxHp}`;
    document.getElementById("hp-fill").style.width = hpPct + "%";
    document.getElementById("pl-mp").textContent = `${s.player.mp || 0}/${s.player.maxMp || 0}`;
    document.getElementById("mp-fill").style.width = mpPct + "%";
    let ba = s.player.atk, bd = s.player.def;
    let ab = s.equip.reduce((sum, e) => sum + (e.stat === "atk" ? e.val : 0), 0);
    let db = s.equip.reduce((sum, e) => sum + (e.stat === "def" ? e.val : 0), 0);
    document.getElementById("pl-atk").textContent = ab ? `${ba + ab}(+${ab})` : ba;
    document.getElementById("pl-def").textContent = db ? `${bd + db}(+${db})` : bd;
    const sk = s.activeSkill;
    document.getElementById("pl-skill-name").textContent = sk ? `${sk.icon} ${sk.name}` : "无技能";
  }
  const eqList = document.getElementById("equip-list");
  if (s.equip.length === 0) eqList.innerHTML = '<span style="color:#445566">暂无</span>';
  else eqList.innerHTML = s.equip.map(e => `<span style="color:${e.color}" title="${e.prefix || ''}${e.name}">${e.icon}${e.prefix || ''}${e.name}(+${e.val})</span>`).join(" ");
  const relList = document.getElementById("relic-list");
  if (s.relics.length === 0) relList.innerHTML = '<span style="color:#445566">暂无</span>';
  else relList.innerHTML = s.relics.map(r => `<span style="color:${RARITY_COLOR[r.rarity]}" title="${r.desc}">${r.icon}${r.name}</span>`).join(" ");
  const potList = document.getElementById("potion-list");
  if (s.potions.length === 0) potList.innerHTML = '<span style="color:#445566">暂无</span>';
  else potList.innerHTML = s.potions.map((p, i) => `<span style="color:#70a1ff;cursor:pointer" onclick="window._usePotion(${i})">${p.icon}${p.name}</span>`).join(" ");
  const dbEl = document.getElementById("debuff-bar"); let db = "";
  if (s.player?.debuffAtk?.turns > 0) db += `<span style="color:#ff4444;font-size:12px">⚔️攻击-${s.player.debuffAtk.value}(${s.player.debuffAtk.turns}回合)</span>`;
  if (s.player?.bleed) db += `<span style="color:#ff4444;font-size:12px;margin-left:6px">☠️流血-${s.player.bleed}/回合</span>`;
  let cr = s.player?.critRate || 0; s.equip.forEach(e => { if (e.stat === "critRate") cr += e.val / 100; });
  if (cr > 0) db += `<span style="color:#ffa502;font-size:12px;margin-left:6px">💥暴击${Math.floor(cr * 100)}%</span>`;
  if (s.potionAtk) db += `<span style="color:#89e894;font-size:12px;margin-left:6px">💪药剂+${Math.floor(s.potionAtk * 100)}%攻</span>`;
  dbEl.innerHTML = db || "";
  if (s.enemy) {
    const ehp = s.enemy.maxHp > 0 ? Math.max(0, s.enemy.hp) / s.enemy.maxHp * 100 : 0;
    const fill = document.getElementById("enemy-hp-fill");
    fill.style.width = ehp + "%";
    if (ehp > 60) fill.style.background = "linear-gradient(90deg,#8b0000,#ff4444)";
    else if (ehp > 30) fill.style.background = "linear-gradient(90deg,#8b4500,#ffaa00)";
    else fill.style.background = "linear-gradient(90deg,#550000,#ff0000)";
    const isBoss = s.roomQueue[s.roomIndex - 1] === "boss";
    const ne = document.getElementById("enemy-name");
    ne.style.color = isBoss ? "#ffa502" : "#ff7b7b"; ne.textContent = s.enemy.name;
    document.getElementById("enemy-tag").textContent = s.enemy.tags.map(t => t.name).join(" ");
    document.getElementById("enemy-hp-text").textContent = `HP: ${Math.max(0, s.enemy.hp)}/${s.enemy.maxHp}`;
  }
else {
    document.getElementById("enemy-name").textContent = "--";
    document.getElementById("enemy-name").style.color = "#ff7b7b";
    document.getElementById("enemy-tag").textContent = "";
    document.getElementById("enemy-hp-fill").style.width = "0%";
    document.getElementById("enemy-hp-text").textContent = "HP: --/--";
  }
  const lim = s.totalFloor <= 10 ? 15 : (s.totalFloor === 99 ? 30 : 20);
  document.getElementById("turn-limit").textContent = `回合: ${s.turnInFloor || 0}/${lim}`;
  document.getElementById("floor").textContent = `第 ${s.totalFloor} 层`;
  const zn = document.getElementById("zone-name"); if (zn && s.zone) zn.textContent = s.zone.name;
  const btnSkill = document.getElementById("btn-skill");
  if (btnSkill) {
    btnSkill.disabled = s.player ? s.player.mp < s.player.mpCost : true;
    if (s.activeSkill) btnSkill.innerHTML = `${s.activeSkill.icon} ${s.activeSkill.name}`;
    else btnSkill.innerHTML = "⚡ 技能";
  }
  document.getElementById("btn-atk").disabled = !s.enemy || s.enemy.hp <= 0;
  document.getElementById("btn-def").disabled = !s.enemy || s.enemy.hp <= 0;
  const btnAuto = document.getElementById("btn-auto");
  if (btnAuto) { btnAuto.style.background = s.auto ? "#8b0000" : "#2a3d66"; btnAuto.textContent = s.auto ? "⏹ 停止" : "▶️ 自动"; }
}

export function buildDifficultySelect(onPick) {
  const grid = document.getElementById("diff-grid"); grid.innerHTML = "";
  Object.values(DIFFICULTIES).forEach(d => {
    const div = document.createElement("div"); div.className = "card"; div.dataset.diff = d.id;
    div.innerHTML = `<div class="icon">${d.icon}</div><div class="name">${d.name}</div><div class="desc">${d.desc}</div>`;
    div.onclick = () => onPick(d); grid.appendChild(div);
  });
}

export function buildClassSelect(onPick) {
  const grid = document.getElementById("class-grid"); grid.innerHTML = "";
  const unlocked = Game.meta.unlocks || ["warrior", "mage"];
  Object.values(CLASSES).forEach(c => {
    const div = document.createElement("div"); div.className = "card";
    const locked = !unlocked.includes(c.id);
    div.innerHTML = `<div class="icon">${c.icon}</div><div class="name">${c.name}${locked ? '🔒' : ''}</div><div class="desc">${c.desc}</div>`;
    if (!locked) div.onclick = () => onPick(c); else div.style.opacity = "0.4";
    grid.appendChild(div);
  });
}

export function buildSkillSelect(cls, onPick) {
  const grid = document.getElementById("skill-grid"); grid.innerHTML = "";
  const pool = cls.skills || [];
  pool.forEach(sk => {
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = `<div class="icon">${sk.icon}</div><div class="name">${sk.name}</div><div class="desc">${sk.desc}</div>`;
    div.onclick = () => onPick(sk); grid.appendChild(div);
  });
}

export function buildZoneSelect(zoneIdx, onPick) {
  const info = document.getElementById("zone-info");
  info.textContent = `第 ${zoneIdx + 1} 关结束，前方出现岔路`;
  const grid = document.getElementById("zone-grid"); grid.innerHTML = "";
  const route = SIMPLE_ROUTE[zoneIdx]; if (!route || route.choices.length === 0) return;
  route.choices.forEach(zid => {
    const z = ZONES[zid]; if (!z) return;
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = `<div class="icon">${z.icon}</div><div class="name">${z.name}</div><div class="desc">${z.desc}</div>`;
    div.onclick = () => onPick(z); grid.appendChild(div);
  });
}

export function showRoomInfo(s) {
  const roomId = s.roomQueue[s.roomIndex]; if (!roomId) return;
  const rt = ROOM_TYPES[roomId] || ROOM_TYPES.battle;
  document.getElementById("room-info").textContent = `第 ${s.totalFloor} 层 · ${s.zone.name}`;
  document.getElementById("room-desc").innerHTML = `<span style="color:${rt.color};font-size:32px">${rt.icon}</span><br><b>${rt.name}</b><br><span style="color:#8899bb">${rt.desc}</span>`;
}

export function showReward(isFast, onEquip, onAttr) {
  const el = document.getElementById("reward"); el.style.display = "block";
  const list = document.getElementById("reward-list"); list.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const eq = genEquip();
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

export function showBossReward(isFast, onRelic, onAttr) {
  const el = document.getElementById("reward"); el.style.display = "block";
  const list = document.getElementById("reward-list"); list.innerHTML = "";
  const rel = genRelic();
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

export function openShop(onBuy, onClose) {
  const s = Game.state;
  document.getElementById("shop").style.display = "block";
  document.getElementById("shop-gold").textContent = s.gold || 0;
  const list = document.getElementById("shop-list"); list.innerHTML = "";
  const items = [];
  items.push({ name: "生命药水", cost: 20, icon: "🧪", fn: () => { s.player.hp = Math.min(s.player.maxHp, s.player.hp + 50); log("<span class='heal'>恢复 50 生命</span>"); } });
  items.push({ name: "灵力药水", cost: 15, icon: "🔮", fn: () => { s.player.mp = Math.min(s.player.maxMp, s.player.mp + 30); log("<span class='info'>恢复 30 灵力</span>"); } });
  items.push({ name: "强力药水", cost: 35, icon: "🧴", fn: () => { s.player.hp = s.player.maxHp; s.player.mp = s.player.maxMp; log("<span class='heal'>全部恢复！</span>"); } });
  const eq = genEquip(); eq.cost = 25 + Math.floor(eq.val * 3);
  items.push({ name: (eq.prefix || "") + eq.name, cost: eq.cost, icon: eq.icon, fn: () => { if (s.equip.length >= 6) s.equip.shift(); s.equip.push(eq); playSound("equip"); } });
  if (s.rng.chance(0.5)) {
    const rel = genRelic();
    items.push({ name: rel.name, cost: 80, icon: rel.icon, fn: () => { if (s.relics.length >= 6) { s.relics.shift(); } s.relics.push(rel); if (rel.passive && !rel.applied) { rel.passive(s.player); rel.applied = true; } playSound("equip"); } });
  }
  const mul = s.adDiscount ? 0.5 : 1;
  items.forEach(it => {
    const finalCost = Math.floor(it.cost * mul);
    const btn = document.createElement("button"); btn.className = "modal-btn";
    btn.innerHTML = `${it.icon} ${it.name} — <span style="color:#ffdd77">${finalCost}G</span>${s.adDiscount ? ' <span style="color:#89e894">[5折]</span>' : ''}`;
    btn.disabled = (s.gold || 0) < finalCost;
    btn.onclick = () => { if ((s.gold || 0) >= finalCost) { s.gold -= finalCost; it.fn(); Game.sync(); openShop(onBuy, onClose); } };
    list.appendChild(btn);
  });
  const canAd = Game.canWatchAd();
  const btnRef = document.getElementById("btn-ad-refresh"); btnRef.disabled = !canAd;
  btnRef.onclick = () => { if (Game.watchAd()) { s.adRefreshCount++; openShop(onBuy, onClose); } };
  const btnDis = document.getElementById("btn-ad-discount"); btnDis.disabled = !canAd || s.adDiscount;
  btnDis.onclick = () => { if (Game.watchAd()) { s.adDiscount = true; Game.sync(); openShop(onBuy, onClose); } };
  document.getElementById("btn-close-shop").onclick = onClose;
}

export function openEvent(roomType, onClose) {
  const s = Game.state;
  let type;
  if (roomType === "event") {
    const types = ["shrine", "chest", "altar"];
    type = s.rng.pick(types);
  } else {
    type = roomType; // shrine / altar 保持原类型
  }
  const el = document.getElementById("event"); el.style.display = "block";
  const title = document.getElementById("event-title"), desc = document.getElementById("event-desc"), btns = document.getElementById("event-btns");
  btns.innerHTML = "";
  if (type === "shrine") {
    title.textContent = "⛩️ 古老神龛"; desc.textContent = "献祭金币，获得祝福。";
    addBtn("奉献 30G：永久攻击+3", () => { if (s.gold >= 30) { s.gold -= 30; s.player.atk += 3; onClose(); } else alert("金币不足！"); });
    addBtn("奉献 30G：回满生命", () => { if (s.gold >= 30) { s.gold -= 30; s.player.hp = s.player.maxHp; onClose(); } else alert("金币不足！"); });
    addBtn("离开", onClose);
  } else if (type === "chest") {
    title.textContent = "📦 尘封宝箱"; desc.textContent = "免费开启，命运自有安排。";
    addBtn("开启", () => {
      const roll = s.rng.next();
      if (roll < 0.5) { const eq = genEquip(); if (s.equip.length >= 6) s.equip.shift(); s.equip.push(eq); playSound("equip"); log("<span class='win'>宝箱开出装备！</span>"); }
      else if (roll < 0.8) { s.gold += 30; log("<span class='gold'>宝箱开出 30 金币！</span>"); }
      else { const rel = genRelic(); if (s.relics.length >= 6) { log("<span class='warn'>遗物栏已满，替换最旧的遗物</span>"); s.relics.shift(); } s.relics.push(rel); if (rel.passive && !rel.applied) { rel.passive(s.player); rel.applied = true; } playSound("equip"); log("<span class='win'>宝箱开出遗物！</span>"); }
      onClose();
    });
  } else {
    title.textContent = "☠️ 黑暗祭坛"; desc.textContent = "接受诅咒，换取强大力量。";
    const rel = genRelic(), curse = s.rng.pick(CURSES);
    addBtn(`获得 ${rel.name}，但承受 ${curse.name}`, () => {
      if (s.relics.length >= 6) { s.relics.shift(); }
      s.relics.push(rel); if (rel.passive && !rel.applied) { rel.passive(s.player); rel.applied = true; }
      s.curses.push(curse); curse.apply(s.player);
      log(`<span class="warn">☠️ 诅咒：${curse.desc}</span>`); onClose();
    });
    addBtn("离开", onClose);
  }
}
function addBtn(txt, fn) {
  const b = document.createElement("button"); b.className = "modal-btn"; b.textContent = txt; b.onclick = fn;
  document.getElementById("event-btns").appendChild(b);
}

export function openPotionModal() {
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

export function showDaily(seed, onStart) {
  const g = DAILY_GLOBAL_MODS[seed % 9], p = DAILY_PLAYER_MODS[Math.floor(seed / 9) % 9], e = DAILY_ENEMY_MODS[Math.floor(seed / 81) % 9];
  const box = document.getElementById("daily-mods");
  box.innerHTML = `<div style="margin-bottom:8px"><b style="color:#c8a8ff">🌍 全局：</b>${g.name} — ${g.desc}</div>
<div style="margin-bottom:8px"><b style="color:#89e894">👤 角色：</b>${p.name} — ${p.desc}</div>
<div><b style="color:#ff7b7b">👹 怪物：</b>${e.name} — ${e.desc}</div>`;
  document.getElementById("btn-start-daily").onclick = () => onStart(g, p, e);
  showModal("daily-panel");
}

export function showCodex() {
  const data = Game.getAllCodex(); const content = document.getElementById("codex-content");
  const entries = Object.values(data);
  if (entries.length === 0) { content.innerHTML = '<div style="color:#667788;text-align:center;padding:20px">暂无记录<br><span style="font-size:12px">击败怪物后将自动记录</span></div>'; }
  else { content.innerHTML = entries.sort((a, b) => (b.lastFloor || 0) - (a.lastFloor || 0)).map(m => `<div class="codex-entry"><b>${m.name || '?'}</b> <span>第${m.floor || '?'}层首遇</span> <span style="color:#ffa502">击杀${m.kills || 0}次</span><br><span>HP:${m.hp || '-'} ATK:${m.atk || '-'} DEF:${m.def || '-'}</span></div>`).join(''); }
  showModal("codex-panel");
}

export function showLeaderboard() {
  const list = Game.getLeaderboard(); const content = document.getElementById("lb-content");
  if (list.length === 0) { content.innerHTML = '<div style="color:#667788;text-align:center">暂无记录</div>'; }
  else { content.innerHTML = list.map((e, i) => `<div class="lb-entry"><span>#${i + 1} ${e.char}·${e.diff} ${e.floor}层</span><span style="color:#8899bb">${e.date}</span></div>`).join(''); }
  showModal("leaderboard");
}

export function showGameOver(isWin, metaReward) {
  hideAllModals(); switchScreen("gameover");
  const s = Game.state;
  document.getElementById("end-title").textContent = isWin ? "🎉 斩尽妖塔！" : "☠️ 身死道消";
  document.getElementById("end-score").innerHTML = `${isWin ? '通关层数' : '倒在了第'} ${s.totalFloor} 层<br>最高层数：${s.highest}<br>累计伤害：${s.stats.totalDmg}<br>暴击次数：${s.stats.critCount}<br>持有金币：${s.gold}<br>装备数：${s.equip.length} · 遗物数：${s.relics.length}<br>职业：${s.playerClass ? s.playerClass.name : '--'} · 天赋：${s.talent ? s.talent.name : '--'}`;
  document.getElementById("meta-reward").textContent = metaReward || "";
}

function genEquip() {
  const s = Game.state;
  let r = s.rng.next(), cum = 0, q = EQUIP_QUALITIES[0];
  for (const eq of EQUIP_QUALITIES) { cum += eq.weight / 100; if (r < cum) { q = eq; break; } }
  const tp = EQUIP_TYPES[s.rng.range(0, EQUIP_TYPES.length - 1)];
  let base = tp.base; if (s.totalFloor > 10) base = Math.floor(base * (1 + (s.totalFloor - 10) * 0.02));
  let val = Math.max(1, Math.floor(base * q.mul + s.rng.next() * base * 0.5));
  const pref = s.rng.chance(0.3) ? s.rng.pick(EQUIP_PREFIXES) : EQUIP_PREFIXES[0];
  if (pref.statBonus) {
    if (pref.statBonus.atk && tp.stat === "atk") val += pref.statBonus.atk;
    if (pref.statBonus.def && tp.stat === "def") val += pref.statBonus.def;
    if (pref.statBonus.maxHp && tp.stat === "maxHp") val += pref.statBonus.maxHp;
    if (pref.statBonus.maxMp && tp.stat === "maxMp") val += pref.statBonus.maxMp;
    if (pref.statBonus.critRate && tp.stat === "critRate") val += pref.statBonus.critRate;
  }
  return { name: q.name + tp.name, stat: tp.stat, val: val, color: q.color, icon: tp.icon, prefix: pref.name || "", prefixDesc: pref.desc || "" };
}

function genRelic() {
  const s = Game.state;
  const diff = DIFFICULTIES[s.difficulty];
  const avail = RELICS.filter(r => !s.relics.find(x => x.id === r.id));
  const pool = avail.length ? avail : RELICS;
  if (s.rng.chance(diff.legendRate || 0.02)) { const leg = pool.filter(r => r.rarity === "legendary"); if (leg.length) return s.rng.pick(leg); }
  return s.rng.pick(pool);
}

export { genEquip, genRelic };