// ===================== v0.80 构建选择器 =====================
// 从 main.js 提取：难度/职业/技能/赐福/天赋/追猎/Zone 选择
// 被新游戏、无尽挑战、Boss Rush、地下城、天梯共用
import { Game } from '../../core/state.js';
import { R } from '../../core/registry.js';
import { RNG } from '../../core/rng.js';
import * as Loot from '../../systems/loot.js';
import * as Combat from '../../systems/combat.js';
import { applyEquipStats } from '../../systems/equipment.js';
import { log, toast } from '../effects.js';
import { switchScreen } from '../screens.js';
import { RARITY_COLOR } from '../../content/relics.js';

export function buildDifficultySelect(onPick) {
  const grid = document.getElementById("diff-grid"); grid.innerHTML = "";
  const diffs = R.get('difficulties');
  const coins = Game.meta.difficultyCoins || 0;
  var baseDiffs = Object.values(diffs).filter(function(d) { return d.asc === 0; });
  baseDiffs.forEach(function(d) {
    var div = document.createElement("div"); div.className = "card";
    div.innerHTML = '<div class="icon">' + d.icon + '</div><div class="name">' + d.name + '</div><div class="desc">' + d.desc + '</div>';
    div.onclick = function() {
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
            } else { toast("难度币不足！通关任何难度可获得"); }
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
  if (coins > 0) {
    var coinInfo = document.createElement("div");
    coinInfo.style.cssText = "text-align:center;color:#ffa502;font-size:11px;margin-top:8px";
    coinInfo.textContent = "🪙 持有难度币: " + coins + "（通关获得）";
    grid.appendChild(coinInfo);
  }
}

export function buildClassSelect(onPick, gridId) {
  if (!gridId) gridId = "class-grid";
  const grid = document.getElementById(gridId); grid.innerHTML = "";
  const unlocked = Game.meta.unlocks || ["warrior", "mage"];
  const classes = R.get('classes');
  Object.values(classes).forEach(function(c) {
    const div = document.createElement("div"); div.className = "card";
    const locked = !unlocked.includes(c.id);
    var portraitFile = 'portrait_' + c.id + '.jpg';
    div.innerHTML = '<div style="width:80px;height:80px;border-radius:50%;overflow:hidden;margin:0 auto 8px;border:2px solid ' + (locked ? '#333' : '#c8a8ff') + '"><img src="img/' + portraitFile + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'"></div><div class="icon" style="font-size:20px">' + c.icon + '</div><div class="name">' + c.name + (locked ? ' 🔒' : '') + '</div><div class="desc">' + c.desc + '</div>';
    if (!locked) div.onclick = function() { onPick(c); }; else div.style.opacity = "0.4";
    grid.appendChild(div);
  });
}

export function buildSkillSelect(cls, onPick) {
  const grid = document.getElementById("skill-grid"); grid.innerHTML = "";
  (cls.skills || []).forEach(function(sk) {
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = '<div class="icon">' + sk.icon + '</div><div class="name">' + sk.name + '</div><div class="desc">' + sk.desc + '</div>';
    div.onclick = function() { onPick(sk); }; grid.appendChild(div);
  });
}

export function buildStartBonus(onDone) {
  var grid = document.getElementById("talent-grid"); grid.innerHTML = "";
  var h2 = document.querySelector("#talent-select h2");
  if (h2) h2.textContent = "🎁 开局赐福 · 三选一";
  var bonuses = [
    { icon: "🔮", name: "遗物赐福", desc: "随机获得一件稀有品质遗物", apply: function(s) {
      var rares = (R.get('relics') || []).filter(function(r) { return r.rarity === 'rare' || r.rarity === 'epic'; });
      if (rares.length > 0) { var r = { ...s.rng.pick(rares) }; if (r.passive) { r.passive(s.player); r.applied = true; } s.relics.push(r); log("<span class='win'>🎁 " + r.name + "</span>"); }
    }},
    { icon: "💰", name: "财宝赐福", desc: "开局额外获得80金币", apply: function(s) { s.gold += 80; } },
    { icon: "⚡", name: "迅捷赐福", desc: "本局所有技能CD-1回合（含后续学的新技能）", apply: function(s) {
      s.player._blessingSwift = true;
      s.activeSkills.forEach(function(sk) { /* handled via runtime cdReduction in combat.js */ });
    }},
    { icon: "❤️", name: "生命赐福", desc: "生命上限+25", apply: function(s) { s.player.maxHp += 25; s.player.hp += 25; } },
    { icon: "📦", name: "装备赐福", desc: "开局随机获得2件装备", apply: function(s) {
      for (var i = 0; i < 2; i++) { var eq = Loot.genEquip(s.zone ? s.zone.id : null); s.equip.push(eq); applyEquipStats(s.player, eq); }
      Combat.recalcEquipSetBonus();
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

export function buildTalentSelect(onPick) {
  const grid = document.getElementById("talent-grid"); grid.innerHTML = "";
  const s = Game.state;
  const pool = R.get('talents');
  const picks = s.rng ? s.rng.pickMulti(pool, 3) : pool.slice(0, 3);
  picks.forEach(function(t) {
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = '<div class="icon">' + t.icon + '</div><div class="name">' + t.name + '</div><div class="desc">' + t.desc + '</div>';
    div.onclick = function() { onPick(t); }; grid.appendChild(div);
  });
}

// 追猎目标选择
var _huntPicks = [];
export function buildHuntSelect(onDone) {
  var s = Game.state;
  s.huntTargets = [];
  var grid = document.getElementById("hunt-grid"); grid.innerHTML = "";
  document.getElementById("hunt-count").textContent = "0/2";
  _huntPicks = [];
  var discovered = Game.meta && Game.meta.discoveredRelics ? Game.meta.discoveredRelics : [];
  if (discovered.length < 3) {
    document.getElementById("hunt-pool-info").textContent = '🔍 需要发现至少3种圣物才能解锁追猎（当前：' + discovered.length + '种）';
    document.getElementById("hunt-grid").innerHTML = '<div style="color:#667788;padding:20px;text-align:center">📚 继续冒险来发现更多圣物吧！</div>';
    document.getElementById("btn-hunt-confirm").style.display = 'none';
    document.getElementById("btn-hunt-skip").textContent = '继续冒险';
    document.getElementById("btn-hunt-skip").onclick = function() { onDone(); };
    document.getElementById("btn-hunt-back").onclick = function() { switchScreen("talent-select"); };
    switchScreen("hunt-select");
    return;
  }
  var allRelics = R.get('relics') || [];
  var pool = discovered.map(function(id) { return allRelics.find(function(r) { return r.id === id; }); }).filter(Boolean);
  var show = s.rng ? s.rng.shuffle(pool).slice(0, 12) : pool.slice(0, 12);
  document.getElementById("hunt-pool-info").textContent = '已发现 ' + discovered.length + ' 种圣物，选择追猎目标（5倍出现率）';
  show.forEach(function(rel) {
    var div = document.createElement("div"); div.className = "card";
    div.style.cssText = "position:relative;cursor:pointer;transition:all .15s";
    div.innerHTML = '<div class="icon">' + rel.icon + '</div><div class="name" style="color:' + (RARITY_COLOR[rel.rarity] || '#ccc') + '">' + rel.name + '</div><div class="desc" style="font-size:10px">' + rel.desc + '</div><div class="hunt-mark" style="display:none;position:absolute;top:4px;right:4px;color:#ffa502;font-size:14px">🎯</div>';
    div.onclick = function() {
      var mark = div.querySelector(".hunt-mark");
      var idx = _huntPicks.indexOf(rel.id);
      if (idx >= 0) { _huntPicks.splice(idx, 1); mark.style.display = "none"; div.style.borderColor = ""; div.style.boxShadow = ""; }
      else if (_huntPicks.length < 2) { _huntPicks.push(rel.id); mark.style.display = "block"; div.style.borderColor = "#ffa502"; div.style.boxShadow = "0 0 12px rgba(255,165,2,.4)"; }
      document.getElementById("hunt-count").textContent = _huntPicks.length + "/2";
    };
    grid.appendChild(div);
  });
  document.getElementById("btn-hunt-confirm").onclick = function() {
    s.huntTargets = _huntPicks.slice();
    s.buildDirection = _huntPicks.length > 0 ? 'hunt' : '';
    Game.sync();
    onDone();
  };
  document.getElementById("btn-hunt-skip").onclick = function() {
    s.huntTargets = []; s.buildDirection = '';
    Game.sync();
    onDone();
  };
  document.getElementById("btn-hunt-back").onclick = function() {
    switchScreen("talent-select");
  };
  switchScreen("hunt-select");
}

export function buildZoneSelect(choices, onPick) {
  document.getElementById("zone-info").textContent = '前方出现岔路，选择你的道路';
  const grid = document.getElementById("zone-grid"); grid.innerHTML = "";
  if (!choices || choices.length === 0) return;
  choices.forEach(function(zid) {
    const z = R.get('zones', zid); if (!z) return;
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = '<div class="icon">' + z.icon + '</div><div class="name">' + z.name + '</div><div class="desc">' + z.desc + '</div>';
    div.onclick = function() { onPick(z); }; grid.appendChild(div);
  });
}
