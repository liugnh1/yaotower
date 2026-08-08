// ===================== 主渲染函数 v0.82 性能优化 =====================
import { Game } from '../core/state.js';
import { R } from '../core/registry.js';
import { E, Events } from '../core/event-bus.js';
import { log, toast, float, updateArena } from './effects.js';
import { switchScreen, showModal, hideModal, hideAllModals } from './screens.js';
import { RARITY_COLOR } from '../content/relics.js';
import { startHeartbeat, stopHeartbeat } from '../core/audio.js';
import { TIPS } from '../content/tips.js';
import * as Combat from '../systems/combat.js';

// ===== DOM缓存：惰性获取，首次访问后缓存 =====
var _domCache = {};
function $(id) {
  return _domCache[id] || (_domCache[id] = document.getElementById(id));
}
// 清除缓存（屏幕切换后DOM可能被重建）
function _clearDomCache() {
  _domCache = {};
}

// ===== 常量：移到模块级避免每次render重建 =====
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
var STAT_LABEL = { atk: '⚔️攻击', def: '🛡️防御', maxHp: '❤️生命', critRate: '💥暴击', dodge: '🍃闪避', maxEnergy: '⚡能量' };
var BUFF_MAP = { burn: '🔥', poison: '☠️', slow: '❄️', stun: '💫', crystal: '💎' };
var _cachedRelics = null;
var _cachedRelicList = null;
function _getRelicsTotal() {
  if (!_cachedRelics) _cachedRelics = (R.get('relics') || []).length;
  return _cachedRelics;
}
function _getRelicsList() {
  if (!_cachedRelicList) _cachedRelicList = R.get('relics') || [];
  return _cachedRelicList;
}

// ===== 缓存套装映射 (O(n*m) → O(1)) =====
var _setMapCache = null;
function _getSetMap() {
  if (_setMapCache) return _setMapCache;
  _setMapCache = {};
  Object.values(R.get('zones') || {}).forEach(function(z) {
    if (z.equipSet) _setMapCache[z.equipSet] = z;
  });
  return _setMapCache;
}

var _lastTipFloor = -1;
// 上次render计算的hpPct缓存，避免频繁低血量判断
var _lastHpPct = 100;

// v0.60 实时刷新资源条 — 仅主界面可见时轮询
var _pollTimer = null;
function _ensurePolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(function() {
    var startEl = $("start");
    var cityEl = $("city-hub");
    if ((startEl && !startEl.classList.contains("hidden")) ||
        (cityEl && !cityEl.classList.contains("hidden"))) {
      _refreshMetaBar();
      _refreshCityResources();
    }
  }, 2000);
}
function _refreshMetaBar() {
  var bar = $("meta-bar");
  if (!bar || !Game.meta) return;
  bar.textContent = '🌟' + (Game.meta.essence||0) + '灵蕴 · 💎' + (Game.meta.stones||0) + '灵石 · 👻' + (Game.meta.souls||0) + '魂晶 · ⚒️' + (Game.meta.forgeStones||0) + '锻石 · 📦' + (Game.meta.materials||0) + '素材';
}
function _refreshCityResources() {
  var res = $("city-resources");
  if (!res || !Game.meta) return;
  var lv = Game.meta.cityLevel || 1;
  var upBtn = $("btn-upgrade-city");
  if (upBtn) {
    res.childNodes[0] && (res.childNodes[0].textContent = '🏰 主城 Lv.' + lv + '/5 · 💎灵石:' + (Game.meta.stones||0) + ' · 🌟灵蕴:' + (Game.meta.essence||0) + ' · 👻魂晶:' + (Game.meta.souls||0) + ' · ⚒️锻石:' + (Game.meta.forgeStones||0) + ' · 📦素材:' + (Game.meta.materials||0) + ' ');
  } else {
    res.textContent = '🏰 主城 Lv.' + lv + '/5 · 💎灵石:' + (Game.meta.stones||0) + ' · 🌟灵蕴:' + (Game.meta.essence||0) + ' · 👻魂晶:' + (Game.meta.souls||0) + ' · ⚒️锻石:' + (Game.meta.forgeStones||0) + ' · 📦素材:' + (Game.meta.materials||0);
  }
}
_ensurePolling();

// ===== 主渲染函数 =====
export function render(s) {
  // 房间切换提示
  if (s && s.totalFloor !== _lastTipFloor && TIPS && TIPS.length > 0) {
    _lastTipFloor = s.totalFloor;
    var tipEl = $("loading-tip");
    if (tipEl) { tipEl.textContent = '💡 ' + TIPS[Math.floor(Math.random() * TIPS.length)]; tipEl.style.display = 'block'; setTimeout(function() { tipEl.style.display = 'none'; }, 4000); }
  }

  _refreshMetaBar();
  _refreshCityResources();

  // 签到按钮
  var loginBtn = $("btn-login");
  if (loginBtn && Game.meta) {
    var todayStr = new Date().getFullYear() + '-' + (new Date().getMonth()+1) + '-' + new Date().getDate();
    loginBtn.textContent = Game.meta.lastClaimDay === todayStr ? '✅ 已签到(' + (Game.meta.loginStreak||1) + '天)' : '📅 每日签到(连续' + (Game.meta.loginStreak||1) + '天)';
  }

  // 称号
  var titleEl = $("player-title");
  if (titleEl && Game.meta) {
    var t = TITLES.find(function(x) { return x.id === (Game.meta.equippedTitle || "t_newbie"); }) || TITLES[0];
    titleEl.textContent = t.icon + " " + t.name;
    titleEl.onclick = function() { Events.emit(E.SHOW_ACH_PANEL); };
  }

  // 继续存档
  var cb = $("continue-box");
  if (cb) cb.style.display = Game.hasSave() ? "block" : "none";

  // 遗物进度
  // v0.85: 过滤已失效的遗物ID（旧版本删除的遗物），避免发现数超过总数
  var relProgress = $("relic-progress");
  if (relProgress) {
    var _allRelics = _getRelicsList();
    var discovered = 0;
    if (Game.meta && Game.meta.discoveredRelics) {
      discovered = Game.meta.discoveredRelics.filter(function(id) {
        return _allRelics.some(function(r) { return r.id === id; });
      }).length;
    }
    var total = _allRelics.length;
    relProgress.textContent = '📚 遗物 ' + discovered + '/' + total;
    relProgress.style.color = discovered >= total ? '#ffa502' : '#667788';
  }

  // 金币
  var goldEl = $("gold-text");
  if (goldEl) goldEl.textContent = s.gold || 0;

  // 货币栏
  var mcb = $("meta-currency-bar");
  if (mcb && Game.meta) mcb.textContent = '🌟' + (Game.meta.essence || 0) + ' 💎' + (Game.meta.souls || 0);

  // 战斗遗物计数
  var rcBar = $("relic-count-bar");
  if (rcBar) {
    var _rl = _getRelicsList();
    var d2 = 0;
    if (Game.meta && Game.meta.discoveredRelics) {
      d2 = Game.meta.discoveredRelics.filter(function(id) {
        return _rl.some(function(r) { return r.id === id; });
      }).length;
    }
    var t2 = _rl.length;
    rcBar.textContent = '🔮' + d2 + '/' + t2;
    rcBar.style.color = d2 >= t2 ? '#ffa502' : '#667788';
  }

  // 猎杀令
  var bountyEl = $("bounty-tracker");
  if (bountyEl) {
    var bounty = Game.meta ? Game.meta.activeBounty : null;
    if (bounty) { bountyEl.textContent = '🎯猎杀:' + bounty.boss + ' +' + bounty.reward + '魂晶'; bountyEl.style.display = ''; }
    else { bountyEl.style.display = 'none'; }
  }

  // ===== 玩家状态 =====
  if (s.player) {
    var hpPct = s.player.maxHp > 0 ? Math.max(0, s.player.hp) / s.player.maxHp * 100 : 0;

    // 能量条
    var maxE = s.player.maxEnergy || 3;
    var curE = Math.max(0, s.player.energy || 0);
    var ePct = Math.min(100, maxE > 0 ? curE / maxE * 100 : 0);
    var overflow = Math.max(0, curE - maxE);
    var energyEl = $("pl-energy");
    if (energyEl) {
      var eBars = '';
      for (var ei = 0; ei < Math.min(curE, maxE); ei++) eBars += '⚡';
      for (var ej = 0; ej < overflow; ej++) eBars += '💛';
      for (var ek = 0; ek < Math.max(0, maxE - curE); ek++) eBars += '⚫';
      energyEl.textContent = eBars + ' ' + curE + '/' + maxE;
    }
    var energyFill = $("energy-fill");
    if (energyFill) energyFill.style.width = ePct + "%";

    // 低血量效果 — 只在状态变化时操作classList
    var mainEl = $("main");
    if (mainEl) {
      var isLow = hpPct < 25 && s.enemy;
      if (isLow && _lastHpPct >= 25) mainEl.classList.add("low-hp");
      else if (!isLow && _lastHpPct < 25) mainEl.classList.remove("low-hp");
      _lastHpPct = hpPct;
    }

    // HP/ATK/DEF — 纯文本更新，用textContent
    var plHp = $("pl-hp");
    if (plHp) plHp.textContent = Math.max(0, s.player.hp) + '/' + s.player.maxHp;
    var hpFill = $("hp-fill");
    if (hpFill) hpFill.style.width = hpPct + "%";
    var plAtk = $("pl-atk");
    if (plAtk) plAtk.textContent = s.player.atk;
    var plDef = $("pl-def");
    if (plDef) plDef.textContent = s.player.def;

    // 技能按钮
    var skills = s.activeSkills || [];
    var skillBtn = $("btn-skill");
    var allReady = true;
    if (s.skillCooldowns) {
      var cdVals = s.skillCooldowns;
      for (var ck in cdVals) { if (cdVals[ck] > 0) { allReady = false; break; } }
    }
    if (skillBtn) {
      if (skills.length === 0) {
        skillBtn.textContent = "⚡ 无技能"; skillBtn.disabled = true;
      } else if (allReady) {
        var parts = [];
        for (var si = 0; si < skills.length; si++) {
          parts.push(skills[si].icon + skills[si].name + '(' + (skills[si].energyCost||1) + '⚡)');
        }
        skillBtn.textContent = "⚡ " + parts.join(" ");
        skillBtn.disabled = (s.player.energy <= 0);
      } else {
        var cdParts = [];
        var allOnCD = true;
        for (var sj = 0; sj < skills.length; sj++) {
          var cdKey = skills[sj].id || ('skill_' + sj);
          var cd = s.skillCooldowns[cdKey] || 0;
          cdParts.push(cd > 0 ? skills[sj].icon + ' ⏳' + cd : skills[sj].icon + ' ✓');
          if (!cd) allOnCD = false;
        }
        skillBtn.textContent = "⚡ " + cdParts.join(" ");
        skillBtn.disabled = allOnCD;
      }
    }

    // 当前技能名
    var skillEl = $("pl-skill-name");
    if (skillEl && s.activeSkill) {
      var cd2 = s.skillCooldowns ? (s.skillCooldowns[s.activeSkill.id] || 0) : 0;
      skillEl.textContent = s.activeSkill.icon + ' ' + s.activeSkill.name + ' Lv' + (s.skillLevels ? (s.skillLevels[s.activeSkill.id]||1) : 1) + (cd2 > 0 ? ' ⏳' + cd2 : '');
    }

    // 自动指示器
    var ai = $("auto-indicator");
    if (ai) ai.textContent = s._turboMode ? "💨 ×4极速中..." : (s._speedMode ? "⚡ ×2加速中..." : (s.auto ? "🤖 自动中..." : ""));
  }

  // ===== 装备列表 =====
  var eqList = $("equip-list");
  if (eqList) {
    if (s.equip.length === 0) {
      eqList.textContent = '';
      var emptySpan = document.createElement("span");
      emptySpan.style.color = '#445566';
      emptySpan.textContent = '暂无';
      eqList.appendChild(emptySpan);
    } else {
      // 使用DocumentFragment批量插入
      var frag = document.createDocumentFragment();
      // 套装统计
      var setCounts = {};
      for (var ei2 = 0; ei2 < s.equip.length; ei2++) {
        var eq = s.equip[ei2];
        if (eq._zoneSet) setCounts[eq._zoneSet] = (setCounts[eq._zoneSet]||0) + 1;
      }
      var setKeys = Object.keys(setCounts);
      var setMap = _getSetMap();
      if (setKeys.length > 0) {
        var setDiv = document.createElement("div");
        setDiv.style.cssText = "margin-bottom:4px;font-size:10px;color:#ffa502";
        var setParts = [];
        for (var ski = 0; ski < setKeys.length; ski++) {
          var k = setKeys[ski];
          var c = setCounts[k];
          var zone2 = setMap[k];
          var active2 = c >= 4 ? '4件' : (c >= 2 ? '2件' : '');
          var bonusText = '';
          if (c >= 4 && zone2 && zone2.equipBonus4) bonusText = JSON.stringify(zone2.equipBonus4).replace(/[{}"]/g,'').replace(/,/g,' ');
          else if (c >= 2 && zone2 && zone2.equipBonus) bonusText = JSON.stringify(zone2.equipBonus).replace(/[{}"]/g,'').replace(/,/g,' ');
          setParts.push('🏷️' + k + '(' + c + '/2)(' + (c>=4?4:c) + '/4)' + (active2 ? ' ✅' + active2 + ':+' + bonusText : ''));
        }
        setDiv.textContent = setParts.join(' ');
        frag.appendChild(setDiv);
      }
      // 装备条目
      for (var ei3 = 0; ei3 < s.equip.length; ei3++) {
        (function(e, i) {
          var span = document.createElement("span");
          var qTag = e.qualityName ? '[' + e.qualityName + ']' : '';
          var statLabel = STAT_LABEL[e.stat] || e.stat;
          span.textContent = (qTag || '') + e.icon + (e.fullName||e.name) + ' ' + statLabel + '+' + e.val;
          span.style.cssText = 'color:' + e.color + ';cursor:pointer;margin-right:4px;display:inline-block;padding:2px 4px;border-radius:3px;transition:background .2s';
          span.title = '点击丢弃 ' + (e.fullName||e.name);
          span.onclick = function() { if (confirm('确定丢弃 ' + (e.fullName||e.name) + '？')) Events.emit(E.EQUIP_DISCARD, { index: i }); };
          span.onmouseenter = function() { span.style.background = 'rgba(255,100,100,0.25)'; };
          span.onmouseleave = function() { span.style.background = 'transparent'; };
          frag.appendChild(span);
        })(s.equip[ei3], ei3);
      }
      eqList.textContent = '';
      eqList.appendChild(frag);
    }
  }

  // ===== 遗物列表 =====
  var relList = $("relic-list");
  if (relList) {
    if (s.relics.length === 0) {
      relList.textContent = '暂无';
      relList.style.color = '#445566';
    } else {
      var relParts = [];
      for (var ri = 0; ri < s.relics.length; ri++) {
        var r = s.relics[ri];
        relParts.push(r.icon + r.name + (r.stars > 1 ? '⭐'.repeat(r.stars - 1) : ''));
      }
      relList.textContent = relParts.join(' ');
      relList.style.color = '';
    }
  }

  // ===== 药水 =====
  var potList = $("potion-list");
  if (potList) {
    if (s.potions.length === 0) {
      potList.textContent = '暂无';
      potList.style.color = '#445566';
    } else {
      potList.textContent = '';
      potList.style.color = '';
      for (var pi = 0; pi < s.potions.length; pi++) {
        (function(p, i) {
          var sp = document.createElement('span');
          sp.style.cssText = 'color:#70a1ff;cursor:pointer';
          sp.textContent = p.icon + p.name;
          sp.onclick = function() { Combat.usePotion(i); };
          potList.appendChild(sp);
          potList.appendChild(document.createTextNode(' '));
        })(s.potions[pi], pi);
      }
    }
  }

  // ===== 战斗遗物栏 =====
  var relicBar = $("relic-bar");
  if (relicBar) {
    if (s.relics && s.relics.length > 0) {
      var rbParts = [];
      for (var rj = 0; rj < s.relics.length; rj++) {
        var rr = s.relics[rj];
        rbParts.push(rr.icon + rr.name);
      }
      relicBar.textContent = rbParts.join(' · ');
      relicBar.style.display = '';
    } else {
      relicBar.style.display = 'none';
    }
  }

  // ===== Debuff栏 =====
  var dbEl = $("debuff-bar");
  if (dbEl) {
    var db = "";
    if (s.player && s.player.debuffAtk && s.player.debuffAtk.turns > 0) db += '⚔️攻击-' + s.player.debuffAtk.value + '(' + s.player.debuffAtk.turns + ') ';
    if (s.player && s.player.bleed) db += '☠️流血-' + s.player.bleed + '/回合 ';
    if (s.player && (s.player.critRate||0) > 0) db += '💥暴击' + Math.floor((s.player.critRate||0) * 100) + '% ';
    if (s.potionAtk) db += '💪药剂+' + Math.floor(s.potionAtk * 100) + '%攻 ';
    dbEl.textContent = db || "";
  }

  // ===== 敌人区域 =====
  var enemyArea = $("enemy-area");
  if (enemyArea) {
    var enemies = s.enemies || [];
    if (enemies.length === 0) {
      enemyArea.textContent = '--';
      enemyArea.style.color = '#667788';
      enemyArea.style.textAlign = 'center';
      enemyArea.style.padding = '10px';
    } else {
      enemyArea.style.color = '';
      enemyArea.style.textAlign = '';
      enemyArea.style.padding = '';
      var efrag = document.createDocumentFragment();
      for (var ei4 = 0; ei4 < enemies.length; ei4++) {
        (function(e, i) {
          if (!e) return;
          var ehp = e.maxHp > 0 ? Math.max(0, e.hp) / e.maxHp * 100 : 0;
          var isBoss = s._currentRoomType === "boss";
          var selected = (s.selectedTarget === i);
          var blind = s.player && s.player._blindCurse;

          var card = document.createElement("div");
          card.className = "enemy-card";
          card.style.borderColor = selected ? "#ffdd77" : (isBoss ? "#ffa502" : "#5a3a3a");
          card.style.boxShadow = selected ? "0 0 12px rgba(255,200,100,.5)" : "none";

          // 图标
          var iconDiv = document.createElement("div");
          iconDiv.className = "enemy-card-icon";
          iconDiv.textContent = e.icon || '👹';
          card.appendChild(iconDiv);

          // buff图标
          if (e._buffs && e._buffs.length > 0) {
            var bDiv = document.createElement("div");
            bDiv.style.cssText = "font-size:8px;margin-top:1px";
            for (var bi = 0; bi < e._buffs.length; bi++) {
              bDiv.textContent += BUFF_MAP[e._buffs[bi].id] || '🔹';
            }
            card.appendChild(bDiv);
          }

          // 名字
          var nameDiv = document.createElement("div");
          nameDiv.className = "enemy-card-name";
          nameDiv.style.color = isBoss ? '#ffa502' : '#ff7b7b';
          nameDiv.textContent = e.name;
          card.appendChild(nameDiv);

          // 标签
          if (e.tags && e.tags.length > 0) {
            var tagDiv = document.createElement("div");
            tagDiv.style.cssText = "font-size:8px;color:#ff8844";
            for (var ti = 0; ti < e.tags.length; ti++) {
              tagDiv.textContent += e.tags[ti].name + ' ';
            }
            card.appendChild(tagDiv);
          }

          // HP条
          var hpBarDiv = document.createElement("div");
          hpBarDiv.className = "enemy-card-hp-bar";
          var hpFillDiv = document.createElement("div");
          hpFillDiv.className = "enemy-card-hp-fill";
          var hpBarWidth = blind ? 0 : ehp;
          var hpColor = ehp > 60 ? '#4caf50' : ehp > 30 ? '#ff9800' : '#f44336';
          hpFillDiv.style.cssText = 'width:' + hpBarWidth + '%;background:' + hpColor;
          hpBarDiv.appendChild(hpFillDiv);
          card.appendChild(hpBarDiv);

          // HP文字
          var hpTextDiv = document.createElement("div");
          hpTextDiv.className = "enemy-card-hp-text";
          hpTextDiv.textContent = (blind ? '???/???' : Math.max(0, e.hp) + '/' + e.maxHp) + ' ATK:' + (blind ? '???' : (e.atk || 0));
          card.appendChild(hpTextDiv);

          // 意图
          if (e._intent) {
            var intentDiv = document.createElement("div");
            intentDiv.style.cssText = "font-size:9px;color:" + (blind ? '#888' : '#ffcc00') + ";margin-top:2px";
            intentDiv.textContent = blind ? '❓ 未知' : e._intent.icon + ' ' + e._intent.name;
            card.appendChild(intentDiv);
          }

          card.onclick = function() { s.selectedTarget = i; render(s); };
          efrag.appendChild(card);
        })(enemies[ei4], ei4);
      }
      enemyArea.textContent = '';
      enemyArea.appendChild(efrag);
    }
  }

  // ===== 竞技场 =====
  var activeEnemy = (s.enemies && s.enemies.length > 0)
    ? (s.enemies[s.selectedTarget] || s.enemies[0])
    : s.enemy;
  if (activeEnemy && s.player) {
    updateArena(
      (s.playerClass && s.playerClass.icon) || "⚔️",
      (s.playerClass && s.playerClass.name) || "勇者",
      activeEnemy.icon || (s._currentRoomType === "boss" ? "💀" : "👹"),
      activeEnemy.name || "妖兽"
    );
  }

  // 低血量心跳
  if (s.player && activeEnemy && s.player.hp > 0 && s.player.hp < s.player.maxHp * 0.25) {
    startHeartbeat();
  } else {
    stopHeartbeat();
  }

  // ===== 楼层/回合 =====
  var lim = s.totalFloor <= 10 ? 15 : (s.totalFloor === 99 ? 30 : 20);
  var turnLimitEl = $("turn-limit");
  if (turnLimitEl) turnLimitEl.textContent = '回合: ' + (s.turnInFloor || 0) + '/' + lim;
  var floorEl = $("floor");
  if (floorEl) floorEl.textContent = '第 ' + s.totalFloor + ' 层';
  var zn = $("zone-name");
  if (zn && s.zone) zn.textContent = s.zone.name;

  // ===== 按钮状态 =====
  var anyAlive = (s.enemies || []).some(function(e) { return e.hp > 0; });
  var hasEnergy = (s.player && s.player.energy > 0);
  var actionsTaken = s._actionsThisTurn || 0;
  var canAct = !s.gameOver && anyAlive && actionsTaken < 2;
  var btnAtk = $("btn-atk");
  if (btnAtk) btnAtk.disabled = !canAct || !hasEnergy;
  var btnDef = $("btn-def");
  if (btnDef) btnDef.disabled = !canAct || s._defendedThisTurn;
  var btnEnd = $("btn-endturn");
  if (btnEnd) {
    btnEnd.disabled = !anyAlive || s.gameOver;
    btnEnd.textContent = (s.player && s.player.energy > 0) ? '⏩ 结束回合 (' + s.player.energy + '⚡→💚)' : '⏩ 结束回合';
  }
  var btnAuto = $("btn-auto");
  if (btnAuto) {
    if (s._turboMode) { btnAuto.style.background = "#6a0dad"; btnAuto.textContent = "💨 ×4 极速"; }
    else if (s._speedMode) { btnAuto.style.background = "#8b4500"; btnAuto.textContent = "⚡ ×2 加速"; }
    else if (s.auto) { btnAuto.style.background = "#8b0000"; btnAuto.textContent = "🤖 自动"; }
    else { btnAuto.style.background = "#2a3d66"; btnAuto.textContent = "▶️ 手动"; }
  }
}

// ===== 暴露API =====
function _switch(id) {
  _clearDomCache(); // 屏幕切换时清除DOM缓存
  switchScreen(id);
}
export { log, toast, float, _switch as switchScreen, showModal, hideModal, hideAllModals };