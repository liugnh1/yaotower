// ===================== v0.80 万象宝典 =====================
// 从 main.js 提取：图鉴/百科全渲染
import { Game } from '../../core/state.js';
import { R } from '../../core/registry.js';
import { showModal } from '../screens.js';

export function showCompendium() {
  showModal("compendium");
  var compEl = document.getElementById("compendium");
  if (compEl) { compEl.style.display = "flex"; compEl.style.flexDirection = "row"; }
  var navBtns = document.querySelectorAll("#comp-nav .comp-nav-btn");
  navBtns.forEach(function(btn) {
    btn.onclick = function() {
      var cat = btn.dataset.cat;
      navBtns.forEach(function(b){b.style.background='#111';b.style.color='#667';b.classList.remove('active');});
      btn.style.background = '#1a2a1a'; btn.style.color = '#89e894'; btn.classList.add('active');
      openCompDetail(cat);
    };
  });
  setTimeout(function() { openCompDetail("classes"); }, 50);
}

function openCompDetail(cat) {
  const title = document.getElementById("comp-detail-title");
  const content = document.getElementById("comp-detail-content");
  content.innerHTML = "";
  switch (cat) {
    case "classes": title.textContent = "⚔️ 角色道途"; renderCompClasses(content); break;
    case "monsters": title.textContent = "👹 妖兽图鉴"; renderCompMonsters(content); break;
    case "equip": title.textContent = "🎒 装备宝库"; renderCompEquip(content); break;
    case "relics": title.textContent = "🔮 远古遗物"; renderCompRelics(content); break;
    case "trophies": title.textContent = "🏆 藏品展架"; renderCompTrophies(content); break;
    case "stats": title.textContent = "📊 数据统计"; renderCompStats(content); break;
  }
}

function renderCompStats(content) {
  var meta = Game.meta;
  var totalRuns = meta.totalRuns || 0;
  var wins = meta.totalWins || 0;
  var deaths = meta.totalDeaths || 0;
  var kills = meta.totalKills || 0;
  var relicsFound = (meta.discoveredRelics || []).length;
  var totalRelics = (R.get('relics') || []).length;
  var classes = R.get('classes');
  content.innerHTML = '<div style="color:#ccaa88;font-size:12px;line-height:1.8">' +
    '📊 总局数：<b>' + totalRuns + '</b><br>' +
    '🏆 通关次数：<b>' + wins + '</b><br>' +
    '💀 死亡次数：<b>' + deaths + '</b><br>' +
    (totalRuns > 0 ? '📈 胜率：<b>' + Math.floor(wins/totalRuns*100) + '%</b><br>' : '') +
    '⚔️ 总击杀：<b>' + kills + '</b><br>' +
    '🔮 遗物发现：<b>' + relicsFound + '/' + totalRelics + '</b><br>' +
    '⭐ 成就：<b>' + (meta.achievements||[]).length + '</b>个<br>' +
    '🏰 主城等级：<b>Lv.' + (meta.cityLevel||1) + '</b><br>';
  if (classes) {
    content.innerHTML += '<br><b style="color:#ffa502">职业统计：</b><br>';
    Object.values(classes).forEach(function(c) {
      var exp = (meta.charExp && meta.charExp[c.id]) ? meta.charExp[c.id] : 0;
      var lv = Game.getMasteryLevel(c.id);
      var adv = Game.getAdvancement(c.id) || '';
      var awk = Game.isAwakened(c.id) ? '⭐' : '';
      content.innerHTML += c.icon + c.name + '：精通Lv.' + lv + ' EXP:' + exp + ' ' + adv + ' ' + awk + '<br>';
    });
  }
}

function renderCompClasses(content) {
  content.className = 'comp-classes';
  const classes = R.get('classes');
  const unlocked = Game.meta.unlocks || ["warrior", "mage", "shadow"];
  Object.values(classes).forEach(function(c) {
    const isUnlocked = unlocked.includes(c.id);
    const div = document.createElement("div");
    div.className = "comp-item";
    div.style.opacity = isUnlocked ? "1" : "0.4";
    div.innerHTML =
      '<div class="comp-item-icon">' + c.icon + '</div>' +
      '<div class="comp-item-body">' +
        '<div class="comp-item-name">' + c.name + ' ' + (isUnlocked ? '' : '🔒') + '</div>' +
        '<div class="comp-item-stat">❤️' + c.maxHp + ' ⚔️' + c.atk + ' 🛡️' + c.def + ' 💥' + Math.floor(c.critRate*100) + '% ⚡' + (c.maxEnergy||3) + '</div>' +
        '<div class="comp-item-stat">暴伤' + c.critMul + 'x · 穿透' + Math.floor((c.pen||0)*100) + '%' + (c.dodge ? ' · 🍃'+Math.floor(c.dodge*100)+'%' : '') + '</div>' +
        '<div class="comp-item-desc">' + c.desc + '</div>' +
        '<div class="comp-item-desc">技能：' + (c.skills||[]).map(function(s){return s.icon+s.name;}).join(' · ') + '</div>' +
      '</div>';
    content.appendChild(div);
  });
}

function renderCompMonsters(content) {
  content.className = '';
  content.innerHTML = '';
  const codex = Game.getAllCodex();
  const allEnemies = R.get('enemies') || {};
  var totalDiscovered = Object.keys(codex).length;
  var totalMonsters = 0;
  Object.values(allEnemies).forEach(function(pool) { totalMonsters += pool.length; });
  var progDiv = document.createElement('div');
  progDiv.style.cssText = 'text-align:center;margin-bottom:10px';
  progDiv.innerHTML = '<span style="color:#ffa502;font-size:13px;font-weight:bold">已发现 ' + totalDiscovered + ' / ' + totalMonsters + ' 种妖兽</span>' +
    '<div style="width:100%;height:6px;background:#1a1a2a;border-radius:3px;margin-top:4px;overflow:hidden">' +
    '<div style="height:100%;background:linear-gradient(90deg,#c8a8ff,#ffa502);width:' + (totalMonsters > 0 ? Math.floor(totalDiscovered/totalMonsters*100) : 0) + '%;border-radius:3px"></div></div>';
  content.appendChild(progDiv);
  if (totalDiscovered === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'color:#887766;text-align:center;padding:30px';
    empty.innerHTML = '尚未遭遇任何妖兽<br><span style="font-size:11px;color:#5a4a3a">击败怪物后自动录入万象宝典</span>';
    content.appendChild(empty);
    return;
  }
  var poolOrder = ['plains','forest','cave','ruins','frozen','desert','swamp','voidgate','tower_lower','tower_upper'];
  poolOrder.forEach(function(poolKey) {
    var pool = allEnemies[poolKey];
    if (!pool || pool.length === 0) return;
    var zones = R.get('zones') || {};
    var zone = zones[poolKey];
    var zoneName = zone ? (zone.icon + ' ' + zone.name) : poolKey;
    var zoneHdr = document.createElement('div');
    zoneHdr.style.cssText = 'color:#ccaa88;font-weight:bold;margin:10px 0 6px;font-size:12px;border-bottom:1px solid #1a1a2e;padding-bottom:4px';
    var zoneFound = pool.filter(function(e) { return codex[e.name]; }).length;
    zoneHdr.textContent = zoneName + ' (' + zoneFound + '/' + pool.length + ')';
    content.appendChild(zoneHdr);
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:6px';
    pool.forEach(function(enemy) {
      var entry = codex[enemy.name];
      var discovered = !!entry;
      var card = document.createElement('div');
      if (discovered) {
        card.style.cssText = 'background:#0d1117;border:1px solid #2a3040;border-radius:8px;padding:8px 4px;text-align:center;transition:all .15s';
        card.innerHTML =
          '<div style="font-size:28px;margin-bottom:3px">' + (enemy.icon || '👹') + '</div>' +
          '<div style="color:#ddccaa;font-weight:bold;font-size:10px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + enemy.name + '</div>' +
          '<div style="color:#ffa502;font-size:12px;font-weight:bold;margin-top:1px">×' + (entry.kills || 0) + '</div>';
      } else {
        card.style.cssText = 'background:#0a0a10;border:1px solid #151520;border-radius:8px;padding:8px 4px;text-align:center;opacity:0.4';
        card.innerHTML =
          '<div style="font-size:28px;margin-bottom:3px;filter:grayscale(1)brightness(0.3)">' + (enemy.icon || '👹') + '</div>' +
          '<div style="color:#222;font-weight:bold;font-size:10px;margin-bottom:2px">???</div>' +
          '<div style="color:#1a1a1a;font-size:8px">???</div>';
      }
      card.onmouseenter = function() { if (discovered) { this.style.borderColor = '#5a4080'; this.style.transform = 'translateY(-2px)'; } };
      card.onmouseleave = function() { if (discovered) { this.style.borderColor = '#2a3040'; this.style.transform = 'translateY(0)'; } };
      grid.appendChild(card);
    });
    content.appendChild(grid);
  });
}

function renderCompEquip(content) {
  content.className = '';
  const types = R.get('equipTypes') || [];
  const qualities = R.get('equipQualities') || [];
  const prefixes = R.get('equipPrefixes') || [];
  var typeIcons = { weapon:'⚔️', armor:'🛡️', helm:'⛑️', ring:'💍', amulet:'📿', bracelet:'⛓️', belt:'🎗️', medal:'🏅' };
  var html = '<div style="color:#ccaa88;font-weight:bold;margin-bottom:8px;font-size:13px">⚔️ 装备类型</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:12px">';
  types.forEach(function(t) {
    var icon = typeIcons[t.type] || '🔮';
    var statLabel = { atk:'攻击', def:'防御', maxHp:'生命', critRate:'暴击', dodge:'闪避' }[t.stat] || t.stat;
    html += '<div class="comp-item" style="padding:8px;background:#0d1117;border-radius:6px">';
    html += '<div style="font-size:24px;margin-bottom:4px">' + icon + '</div>';
    html += '<div style="color:#ddccaa;font-weight:bold;font-size:12px">' + t.name + '</div>';
    html += '<div style="color:#8899bb;font-size:10px">' + statLabel + ' 基础' + t.base + '</div></div>';
  });
  html += '</div>';
  html += '<div style="color:#ccaa88;font-weight:bold;margin-bottom:6px;font-size:13px">⭐ 品质等级</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:12px">';
  qualities.forEach(function(q) {
    html += '<div class="comp-item" style="padding:6px;background:#0d1117;border-radius:4px;text-align:center">';
    html += '<div style="color:' + q.color + ';font-weight:bold;font-size:11px">' + q.name + '</div>';
    html += '<div style="color:#667;font-size:9px">×' + q.mul + ' 权重' + q.weight + '</div></div>';
  });
  html += '</div>';
  html += '<div style="color:#ccaa88;font-weight:bold;margin-bottom:6px;font-size:13px">✨ 稀有前缀（' + prefixes.length + '种）</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">';
  var labels = { atk:'⚔️攻击', def:'🛡️防御', maxHp:'❤️生命', critRate:'💥暴击', dodge:'🍃闪避', lifeSteal:'🩸吸血', pen:'🗡️穿透', critMul:'🎯暴伤', dmgReduce:'🛡️减伤' };
  prefixes.forEach(function(p) {
    var bonusText = '';
    if (p.statBonus && typeof p.statBonus === 'object') {
      Object.keys(p.statBonus).forEach(function(k) { if (p.statBonus[k]) bonusText += (labels[k]||k) + '+' + p.statBonus[k] + ' '; });
    }
    var nameHtml = p.name || '<span style="color:#445">(无前缀)</span>';
    html += '<div class="comp-item" style="padding:6px;background:#0d1117;border-radius:4px">';
    html += '<div style="color:#ddccaa;font-weight:bold;font-size:11px">' + nameHtml + '</div>';
    html += '<div style="color:#89e894;font-size:9px">' + (bonusText || '—') + '</div></div>';
  });
  html += '</div>';
  content.innerHTML = html;
}

function renderCompRelics(content) {
  content.className = '';
  content.innerHTML = '';
  const relics = R.get('relics') || [];
  if (!Game.meta.discoveredRelics) Game.meta.discoveredRelics = [];
  var discovered = Game.meta.discoveredRelics;
  const RARITY_ORDER = ['legendary','epic','rare','common'];
  const RARITY_LABEL = { legendary:'传说', epic:'史诗', rare:'稀有', common:'普通' };
  const RARITY_ICON = { legendary:'🟠', epic:'🟣', rare:'🔵', common:'⚪' };
  var normalRelics = relics.filter(function(r) { return !r.category || r.category === 'normal'; });
  var coreRelics = relics.filter(function(r) { return r.category === 'core'; });
  var normalFound = normalRelics.filter(function(r) { return discovered.includes(r.id); }).length;
  var coreFound = coreRelics.filter(function(r) { return discovered.includes(r.id); }).length;
  var progDiv = document.createElement('div');
  progDiv.style.cssText = 'text-align:center;margin-bottom:10px';
  progDiv.innerHTML = '<span style="color:#ffa502;font-size:13px;font-weight:bold">已发现 ' + discovered.length + ' / ' + relics.length + ' 件遗物</span>' +
    '<div style="width:100%;height:6px;background:#1a1a2a;border-radius:3px;margin-top:4px;overflow:hidden">' +
    '<div style="height:100%;background:linear-gradient(90deg,#c8a8ff,#ffa502);width:' + (relics.length > 0 ? Math.floor(discovered.length/relics.length*100) : 0) + '%;border-radius:3px"></div></div>';
  content.appendChild(progDiv);
  var tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:6px;margin-bottom:10px';
  var activeTab = sessionStorage.getItem('_compRelicTab') || 'normal';
  function makeTab(label, icon, count, found, tabId) {
    var btn = document.createElement('button');
    var isActive = activeTab === tabId;
    btn.style.cssText = 'flex:1;padding:8px 6px;border-radius:8px;border:2px solid ' + (isActive ? '#ffa502' : '#2a2a3a') +
      ';background:' + (isActive ? '#2a1a0a' : '#111') + ';color:' + (isActive ? '#ffcc88' : '#667') +
      ';font-size:12px;cursor:pointer;text-align:center;transition:all .15s';
    btn.innerHTML = icon + ' ' + label + '<br><span style="font-size:9px;color:' + (isActive ? '#ffa502' : '#445') + '">' + found + '/' + count + '</span>';
    btn.onclick = function() {
      sessionStorage.setItem('_compRelicTab', tabId);
      renderCompRelics(content);
    };
    return btn;
  }
  tabBar.appendChild(makeTab('普通遗物', '📦', normalRelics.length, normalFound, 'normal'));
  tabBar.appendChild(makeTab('特殊遗物', '🔮', coreRelics.length, coreFound, 'core'));
  content.appendChild(tabBar);
  var activeRelics = activeTab === 'core' ? coreRelics : normalRelics;
  var activeLabel = activeTab === 'core' ? '特殊遗物 · 虚空交易获得' : '普通遗物 · 掉落/商店/宝箱获得';
  var labelDiv = document.createElement('div');
  labelDiv.style.cssText = 'color:' + (activeTab === 'core' ? '#ffa502' : '#8899bb') + ';font-size:10px;margin-bottom:6px;text-align:center';
  labelDiv.textContent = activeLabel;
  content.appendChild(labelDiv);
  var grouped = { legendary:[], epic:[], rare:[], common:[] };
  activeRelics.forEach(function(r) {
    if (grouped[r.rarity]) grouped[r.rarity].push(r);
    else grouped.common.push(r);
  });
  var listDiv = document.createElement('div');
  RARITY_ORDER.forEach(function(rarity) {
    var list = grouped[rarity];
    if (!list || list.length === 0) return;
    var hdr = document.createElement('div');
    hdr.style.cssText = 'color:#ccaa88;font-weight:bold;margin:6px 0 3px;font-size:11px';
    hdr.textContent = RARITY_ICON[rarity] + ' ' + RARITY_LABEL[rarity] + '（' + list.length + '）';
    listDiv.appendChild(hdr);
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-bottom:6px';
    list.forEach(function(r) {
      var found = discovered.includes(r.id);
      var card = document.createElement('div');
      card.className = 'comp-item comp-rarity-' + rarity;
      if (!found) {
        card.style.opacity = '0.3'; card.style.borderColor = '#1a1a2a';
        card.innerHTML = '<div class="comp-item-icon" style="filter:grayscale(1)">❓</div><div class="comp-item-name" style="color:#333">???</div><div class="comp-item-desc" style="color:#222">尚未发现</div>';
      } else {
        if (activeTab === 'core') card.style.borderColor = '#ffa502';
        card.innerHTML = '<div class="comp-item-icon">' + r.icon + '</div><div class="comp-item-name">' + r.name + '</div><div class="comp-item-desc">' + r.desc + '</div>';
      }
      grid.appendChild(card);
    });
    listDiv.appendChild(grid);
  });
  content.appendChild(listDiv);
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
