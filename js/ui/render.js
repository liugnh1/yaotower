// ===================== 主渲染函数 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';
import { log, toast, float, updateArena } from './effects.js';
import { switchScreen, showModal, hideModal, hideAllModals } from './screens.js';
import { RARITY_COLOR } from '../content/relics.js';
import { getIntent } from '../systems/combat.js';
import { startHeartbeat, stopHeartbeat } from '../core/audio.js';

export function render(s) {
  // 称号显示
  var titleEl = document.getElementById("player-title");
  if (titleEl && Game.meta) {
    var equippedId = Game.meta.equippedTitle || "t_newbie";
    var TITLES = [
      { id: "t_newbie", name: "初入江湖", icon: "🌱" },
      { id: "t_clear_casual", name: "守门人克星", icon: "🏰" },
      { id: "t_clear_standard", name: "魔塔征服者", icon: "⚔️" },
      { id: "t_clear_hell", name: "炼狱主宰", icon: "🔥" },
      { id: "t_relic_10", name: "遗物猎人", icon: "📦" },
      { id: "t_relic_20", name: "遗物大师", icon: "🔮" },
      { id: "t_relic_all", name: "万象皆通", icon: "🌟" },
      { id: "t_wins_5", name: "身经百战", icon: "💪" },
      { id: "t_wins_20", name: "不败传说", icon: "👑" },
      { id: "t_deaths_10", name: "不死小强", icon: "🪳" },
      { id: "t_city_max", name: "城主大人", icon: "🏰" },
      { id: "t_forge_myth", name: "神话锻造师", icon: "⚒️" }
    ];
    var t = TITLES.find(function(x) { return x.id === equippedId; }) || TITLES[0];
    titleEl.textContent = t.icon + " " + t.name;
    titleEl.onclick = function() { if (window._showAchPanel) window._showAchPanel(); };
  }

  // 城池界面：有存档时显示"记忆之书"
  const cb = document.getElementById("continue-box");
  if (cb) cb.style.display = Game.hasSave() ? "block" : "none";
  // 遗物收集进度
  var relProgress = document.getElementById("relic-progress");
  if (relProgress) {
    var discovered = (Game.meta && Game.meta.discoveredRelics) ? Game.meta.discoveredRelics.length : 0;
    var total = (R.get('relics') || []).length;
    relProgress.textContent = '📚 遗物 ' + discovered + '/' + total;
    relProgress.style.color = discovered >= total ? '#ffa502' : '#667788';
  }
  document.getElementById("gold-text").textContent = s.gold || 0;
  // 遗物收集进度常驻
  var rcBar = document.getElementById("relic-count-bar");
  if (rcBar) {
    var discovered = (Game.meta && Game.meta.discoveredRelics) ? Game.meta.discoveredRelics.length : 0;
    var totalR = (R.get('relics') || []).length;
    rcBar.textContent = '🔮' + discovered + '/' + totalR;
    rcBar.style.color = discovered >= totalR ? '#ffa502' : '#667788';
  }
  // 猎杀令进度
  var bountyEl = document.getElementById("bounty-tracker");
  if (bountyEl) {
    var bounty = Game.meta ? Game.meta.activeBounty : null;
    if (bounty) { bountyEl.textContent = '🎯猎杀:' + bounty.boss + ' +' + bounty.reward + '魂晶'; bountyEl.style.display = ''; }
    else { bountyEl.style.display = 'none'; }
  }

  if (s.player) {
    const hpPct = s.player.maxHp > 0 ? Math.max(0, s.player.hp) / s.player.maxHp * 100 : 0;
    const mpPct = s.player.maxMp > 0 ? s.player.mp / s.player.maxMp * 100 : 0;
    // 低血量红屏效果
    const mainEl = document.getElementById("main");
    if (mainEl) { if (hpPct < 25 && s.enemy) mainEl.classList.add("low-hp"); else mainEl.classList.remove("low-hp"); }
    document.getElementById("pl-hp").textContent = `${Math.max(0, s.player.hp)}/${s.player.maxHp}`;
    document.getElementById("hp-fill").style.width = hpPct + "%";
    document.getElementById("pl-mp").textContent = `${s.player.mp || 0}/${s.player.maxMp || 0}`;
    document.getElementById("mp-fill").style.width = mpPct + "%";
    let ba = s.player.atk, bd = s.player.def;
    let ab = s.equip.reduce((sum, e) => sum + (e.stat === "atk" ? e.val : 0), 0);
    let db = s.equip.reduce((sum, e) => sum + (e.stat === "def" ? e.val : 0), 0);
    document.getElementById("pl-atk").textContent = ab ? `${ba + ab}(+${ab})` : ba;
    document.getElementById("pl-def").textContent = db ? `${bd + db}(+${db})` : bd;
    // 技能按钮状态
    var skills = s.activeSkills || [];
    var skillBtn = document.getElementById("btn-skill");
    var allReady = true, totalCD = 0;
    if (s.skillCooldowns) {
      Object.values(s.skillCooldowns).forEach(function(v) { totalCD += v; if (v > 0) allReady = false; });
    }
    if (skillBtn) {
      if (skills.length === 0) {
        skillBtn.textContent = "⚡ 技能";
        skillBtn.classList.remove("on-cd");
        skillBtn.disabled = true;
      } else if (allReady && totalCD === 0) {
        skillBtn.textContent = "⚡ 技能(" + skills.length + ")";
        skillBtn.classList.remove("on-cd");
        skillBtn.disabled = false;
      } else {
        skillBtn.textContent = "⚡ CD:" + totalCD;
        skillBtn.classList.add("on-cd");
        skillBtn.disabled = false; // 仍可点击查看CD状态
      }
    }
    document.getElementById("pl-skill-name").textContent = skills.length > 0 ? skills.map(function(sk) { return sk.icon + sk.name; }).join(" ") : "无技能";
    document.getElementById("pl-mp").textContent = skills.length + "技能";
    document.getElementById("mp-fill").style.width = (allReady ? 100 : Math.max(10, 100 - totalCD * 15)) + "%";
    // 自动战斗指示器
    var ai = document.getElementById("auto-indicator");
    if (ai) ai.textContent = s._speedMode ? "⚡ 加速战斗中..." : (s.auto ? "🤖 自动战斗中..." : "");
  }

  // 装备列表（可点击丢弃）
  const eqList = document.getElementById("equip-list");
  const STAT_LABEL = { atk: '⚔️攻击', def: '🛡️防御', maxHp: '❤️生命', critRate: '💥暴击', maxMp: '🔮灵力' };
  if (s.equip.length === 0) eqList.innerHTML = '<span style="color:#445566">暂无</span>';
  else {
    eqList.innerHTML = '';
    s.equip.forEach((e, i) => {
      const span = document.createElement("span");
      const qTag = e.qualityName ? `<span style="font-size:10px;color:${e.color}">[${e.qualityName}]</span>` : '';
      const fxTag = e._combatEffect ? ` <span style="font-size:9px;color:#ffa502">·${e._combatEffect.type}</span>` : '';
      span.innerHTML = `${qTag}${e.icon}<b>${e.fullName||e.name}</b> ${STAT_LABEL[e.stat]||e.stat}+${e.val}${fxTag}`;
      span.style.cssText = `color:${e.color};cursor:pointer;margin-right:4px;display:inline-block;padding:2px 4px;border-radius:3px;transition:background .2s`;
      span.title = `点击丢弃 ${e.fullName||e.name}`;
      span.onclick = () => { if (confirm(`确定丢弃 ${e.fullName||e.name}？`)) window._discardEquip(i); };
      span.onmouseenter = () => { span.style.background = 'rgba(255,100,100,0.25)'; };
      span.onmouseleave = () => { span.style.background = 'transparent'; };
      eqList.appendChild(span);
    });
  }

  // 遗物列表
  const relList = document.getElementById("relic-list");
  if (s.relics.length === 0) relList.innerHTML = '<span style="color:#445566">暂无</span>';
  else relList.innerHTML = s.relics.map(function(r) { var stars = r.stars > 1 ? '⭐'.repeat(r.stars - 1) : ''; return '<span style="color:' + (RARITY_COLOR[r.rarity] || '#ccc') + '" title="' + r.desc + '">' + r.icon + r.name + stars + '</span>'; }).join(" ");

  // 药水列表
  const potList = document.getElementById("potion-list");
  if (potList) {
    if (s.potions.length === 0) potList.innerHTML = '<span style="color:#445566">暂无</span>';
    else potList.innerHTML = s.potions.map((p, i) => `<span style="color:#70a1ff;cursor:pointer" onclick="window._usePotion(${i})">${p.icon}${p.name}</span>`).join(" ");
  }

  // 战斗遗物栏（左上角）
  var relicBar = document.getElementById("relic-bar");
  if (relicBar) {
    if (s.relics && s.relics.length > 0) {
      relicBar.innerHTML = s.relics.map(function(r) {
        var stars = (r.stars && r.stars > 1) ? '<sup style="color:#ffa502;font-size:9px">' + '⭐'.repeat(r.stars - 1) + '</sup>' : '';
        return '<span style="color:' + (RARITY_COLOR[r.rarity] || '#ccc') + '" title="' + r.desc + '">' + r.icon + stars + '</span>';
      }).join('');
      relicBar.style.display = '';
    } else {
      relicBar.style.display = 'none';
    }
  }

  // Debuff栏
  const dbEl = document.getElementById("debuff-bar"); let db = "";
  if (s.player?.debuffAtk?.turns > 0) db += `<span style="color:#ff4444;font-size:12px">⚔️攻击-${s.player.debuffAtk.value}(${s.player.debuffAtk.turns}回合)</span>`;
  if (s.player?.bleed) db += `<span style="color:#ff4444;font-size:12px;margin-left:6px">☠️流血-${s.player.bleed}/回合</span>`;
  let cr = s.player?.critRate || 0; s.equip.forEach(e => { if (e.stat === "critRate") cr += e.val / 100; });
  if (cr > 0) db += `<span style="color:#ffa502;font-size:12px;margin-left:6px">💥暴击${Math.floor(cr * 100)}%</span>`;
  if (s.potionAtk) db += `<span style="color:#89e894;font-size:12px;margin-left:6px">💪药剂+${Math.floor(s.potionAtk * 100)}%攻</span>`;
  dbEl.innerHTML = db || "";

  // 敌人区域（多敌人卡片）
  var enemyArea = document.getElementById("enemy-area");
  if (enemyArea) {
    var enemies = s.enemies || [];
    if (enemies.length === 0) {
      enemyArea.innerHTML = '<div style="color:#667788;text-align:center;padding:10px">--</div>';
    } else {
      enemyArea.innerHTML = '';
      enemies.forEach(function(e, i) {
        if (!e) return;
        var ehp = e.maxHp > 0 ? Math.max(0, e.hp) / e.maxHp * 100 : 0;
        var isBoss = s._currentRoomType === "boss";
        var selected = (s.selectedTarget === i);
        var card = document.createElement("div");
        card.className = "enemy-card";
        card.style.borderColor = selected ? "#ffdd77" : (isBoss ? "#ffa502" : "#5a3a3a");
        card.style.boxShadow = selected ? "0 0 12px rgba(255,200,100,.5)" : "none";
        var intentText = '';
        if (e._intent) { intentText = '<div style="font-size:9px;color:#ffcc00;margin-top:2px">' + e._intent.icon + e._intent.name + '</div>'; }
        var tagText = (e.tags && e.tags.length > 0) ? '<div style="font-size:8px;color:#ff8844">' + e.tags.map(function(t){return t.name;}).join(' ') + '</div>' : '';
        card.innerHTML = '<div class="enemy-card-icon">' + (e.icon || '👹') + '</div>' +
          '<div class="enemy-card-name" style="color:' + (isBoss ? '#ffa502' : '#ff7b7b') + '">' + e.name + '</div>' +
          tagText +
          '<div class="enemy-card-hp-bar"><div class="enemy-card-hp-fill" style="width:' + ehp + '%;background:' + (ehp > 60 ? '#c04040' : ehp > 30 ? '#c08030' : '#c02020') + '"></div></div>' +
          '<div class="enemy-card-hp-text">' + Math.max(0, e.hp) + '/' + e.maxHp + ' ATK:' + (e.atk || 0) + '</div>' +
          intentText;
        card.onclick = function() { s.selectedTarget = i; render(s); };
        enemyArea.appendChild(card);
      });
    }
  }

  // 更新战斗竞技场角色形象
  if (s.enemy && s.player) {
    const pIcon = s.playerClass?.icon || "⚔️";
    const pLabel = s.playerClass?.name || "勇者";
    const eIcon = s.enemy.icon || (s._currentRoomType === "boss" ? "💀" : "👹");
    const eLabel = s.enemy.name || "妖兽";
    updateArena(pIcon, pLabel, eIcon, eLabel);
  }

  // 低血量心跳音效
  if (s.player && s.enemy && s.player.hp > 0 && s.player.hp < s.player.maxHp * 0.25) {
    startHeartbeat();
  } else {
    stopHeartbeat();
  }

  // 回合与楼层
  const lim = s.totalFloor <= 10 ? 15 : (s.totalFloor === 99 ? 30 : 20);
  document.getElementById("turn-limit").textContent = `回合: ${s.turnInFloor || 0}/${lim}`;
  document.getElementById("floor").textContent = `第 ${s.totalFloor} 层`;
  const zn = document.getElementById("zone-name"); if (zn && s.zone) zn.textContent = s.zone.name;

  // 技能按钮
  const btnSkill = document.getElementById("btn-skill");
  if (btnSkill) {
    btnSkill.disabled = s.player ? s.player.mp < s.player.mpCost : true;
    if (s.activeSkill) btnSkill.innerHTML = `${s.activeSkill.icon} ${s.activeSkill.name}`;
    else btnSkill.innerHTML = "⚡ 技能";
  }

  var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
  document.getElementById("btn-atk").disabled = !anyAlive;
  document.getElementById("btn-def").disabled = !anyAlive;
  const btnAuto = document.getElementById("btn-auto");
  if (btnAuto) {
    if (s._speedMode) { btnAuto.style.background = "#8b4500"; btnAuto.textContent = "⚡ 加速中"; }
    else if (s.auto) { btnAuto.style.background = "#8b0000"; btnAuto.textContent = "🤖 自动中"; }
    else { btnAuto.style.background = "#2a3d66"; btnAuto.textContent = "▶️ 手动"; }
  }
}

// ---- 屏幕切换 ----
function _switch(id) { switchScreen(id); }

// ---- 暴露 render/log/toast/float ----
export { log, toast, float, _switch as switchScreen, showModal, hideModal, hideAllModals };
