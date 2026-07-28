// ===================== 主渲染函数 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';
import { log, toast, float } from './effects.js';
import { switchScreen, showModal, hideModal, hideAllModals } from './screens.js';
import { RARITY_COLOR } from '../content/relics.js';
import { getIntent } from '../systems/combat.js';

export function render(s) {
  // 城池界面：有存档时显示"记忆之书"
  const cb = document.getElementById("continue-box");
  if (cb) cb.style.display = Game.hasSave() ? "block" : "none";
  document.getElementById("gold-text").textContent = s.gold || 0;

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
    const sk = s.activeSkill;
    document.getElementById("pl-skill-name").textContent = sk ? `${sk.icon} ${sk.name}` : "无技能";
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
  else relList.innerHTML = s.relics.map(r => `<span style="color:${RARITY_COLOR[r.rarity]}" title="${r.desc}">${r.icon}${r.name}</span>`).join(" ");

  // 药水列表
  const potList = document.getElementById("potion-list");
  if (s.potions.length === 0) potList.innerHTML = '<span style="color:#445566">暂无</span>';
  else potList.innerHTML = s.potions.map((p, i) => `<span style="color:#70a1ff;cursor:pointer" onclick="window._usePotion(${i})">${p.icon}${p.name}</span>`).join(" ");

  // Debuff栏
  const dbEl = document.getElementById("debuff-bar"); let db = "";
  if (s.player?.debuffAtk?.turns > 0) db += `<span style="color:#ff4444;font-size:12px">⚔️攻击-${s.player.debuffAtk.value}(${s.player.debuffAtk.turns}回合)</span>`;
  if (s.player?.bleed) db += `<span style="color:#ff4444;font-size:12px;margin-left:6px">☠️流血-${s.player.bleed}/回合</span>`;
  let cr = s.player?.critRate || 0; s.equip.forEach(e => { if (e.stat === "critRate") cr += e.val / 100; });
  if (cr > 0) db += `<span style="color:#ffa502;font-size:12px;margin-left:6px">💥暴击${Math.floor(cr * 100)}%</span>`;
  if (s.potionAtk) db += `<span style="color:#89e894;font-size:12px;margin-left:6px">💪药剂+${Math.floor(s.potionAtk * 100)}%攻</span>`;
  dbEl.innerHTML = db || "";

  // 敌人信息
  if (s.enemy) {
    const ehp = s.enemy.maxHp > 0 ? Math.max(0, s.enemy.hp) / s.enemy.maxHp * 100 : 0;
    const fill = document.getElementById("enemy-hp-fill");
    fill.style.width = ehp + "%";
    if (ehp > 60) fill.style.background = "linear-gradient(90deg,#8b0000,#ff4444)";
    else if (ehp > 30) fill.style.background = "linear-gradient(90deg,#8b4500,#ffaa00)";
    else fill.style.background = "linear-gradient(90deg,#550000,#ff0000)";
    const isBoss = s._currentRoomType === "boss";
    const ne = document.getElementById("enemy-name");
    ne.style.color = isBoss ? "#ffa502" : "#ff7b7b"; ne.textContent = s.enemy.name;
    document.getElementById("enemy-tag").textContent = s.enemy.tags.map(t => t.name).join(" ");
    // 敌人意图显示（失明诅咒时隐藏）
    const intentEl = document.getElementById("enemy-intent");
    if (intentEl) {
      if (s.player?._blindCurse) {
        intentEl.textContent = "???";
      } else {
        const intent = getIntent();
        intentEl.textContent = intent ? `${intent.icon} 下回合：${intent.name}` : "";
      }
    }
    // 失明时隐藏HP信息
    const blind = s.player?._blindCurse;
    document.getElementById("enemy-hp-text").textContent = blind ? "HP: ???/???" : `HP: ${Math.max(0, s.enemy.hp)}/${s.enemy.maxHp}`;
    if (blind) { const fill = document.getElementById("enemy-hp-fill"); fill.style.width = "100%"; fill.style.background = "linear-gradient(90deg,#333,#555)"; }
  } else {
    document.getElementById("enemy-name").textContent = "--";
    document.getElementById("enemy-name").style.color = "#ff7b7b";
    document.getElementById("enemy-tag").textContent = "";
    const intentEl2 = document.getElementById("enemy-intent");
    if (intentEl2) intentEl2.textContent = "";
    document.getElementById("enemy-hp-fill").style.width = "0%";
    document.getElementById("enemy-hp-text").textContent = "HP: --/--";
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

  document.getElementById("btn-atk").disabled = !s.enemy || s.enemy.hp <= 0;
  document.getElementById("btn-def").disabled = !s.enemy || s.enemy.hp <= 0;
  const btnAuto = document.getElementById("btn-auto");
  if (btnAuto) { btnAuto.style.background = s.auto ? "#8b0000" : "#2a3d66"; btnAuto.textContent = s.auto ? "⏹ 停止" : "▶️ 自动"; }
}

// ---- 屏幕切换 ----
function _switch(id) { switchScreen(id); }

// ---- 暴露 render/log/toast/float ----
export { log, toast, float, _switch as switchScreen, showModal, hideModal, hideAllModals };
