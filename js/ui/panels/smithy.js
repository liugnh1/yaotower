// ===================== v0.81 铁匠铺 =====================
// 打造装备 / 强化 / 符文管理
import { Game } from '../../core/state.js';
import { genOutgameEquip, enhanceEquip, embedRune, removeRune, upgradeQuality, EQUIP_TYPES, QUALITY_COLORS, STAT_SHORT } from '../../systems/outgame-equip.js';
import { toast } from '../effects.js';

var RUNE_ICONS = { fire:'🔥', ice:'❄️', dark:'💀', light:'🌟', thunder:'⚡' };
var RUNE_NAMES = { fire:'紫微·火', ice:'七杀·冰', dark:'破军·暗', light:'天机·光', thunder:'贪狼·雷' };
var RUNE_EFFECTS = { fire:'ATK+8', ice:'DEF+5', dark:'暴伤+15%', light:'HP+40', thunder:'暴击+5%' };

export function openSmithyPanel() {
  var meta = Game.meta;
  var el = document.getElementById('meta-panel');
  el.style.display = 'block'; el.style.maxWidth = '460px';
  var titleEl = document.getElementById('meta-title');
  if (titleEl) titleEl.textContent = '🎲 铁匠铺';
  var subtitle = document.getElementById('meta-subtitle');
  if (subtitle) subtitle.innerHTML = '💎' + (meta.stones||0) + ' 💀' + (meta.souls||0) + ' 📦' + (meta.materials||0);
  var content = document.getElementById('meta-content');
  content.innerHTML = '';

  // === Tab栏 ===
  var tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:4px;margin-bottom:8px';
  var tabs = ['打造', '强化', '符文', '升阶'];
  var activeTab = { current: '打造' };
  function renderTab(t) {
    activeTab.current = t;
    tabBar.querySelectorAll('button').forEach(function(b){ b.style.background = '#111'; b.style.color = '#667'; });
    renderContent(t);
  }

  tabs.forEach(function(t) {
    var btn = document.createElement('button');
    btn.style.cssText = 'flex:1;padding:6px;border-radius:6px;border:1px solid #2a2a3a;background:#111;color:#667;cursor:pointer;font-size:11px';
    btn.textContent = t;
    btn.onclick = function() { renderTab(t); };
    tabBar.appendChild(btn);
  });
  content.appendChild(tabBar);

  var tabContent = document.createElement('div');
  tabContent.id = 'smithy-tab-content';
  content.appendChild(tabContent);

  function renderContent(tab) {
    switch(tab) {
      case '打造': renderCraft(tabContent); break;
      case '强化': renderEnhance(tabContent); break;
      case '符文': renderRunes(tabContent); break;
      case '升阶': renderUpgrade(tabContent); break;
    }
  }

  renderContent('打造');

  var closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn'; closeBtn.style.cssText = 'margin-top:8px;width:100%';
  closeBtn.textContent = '关闭';
  closeBtn.onclick = function() { el.style.display = 'none'; };
  content.appendChild(closeBtn);
}

// ---- 打造页 ----
function renderCraft(container) {
  container.innerHTML = '';
  var meta = Game.meta;
  var cost = { mats:6, stones:15, souls:30 };
  var canAfford = (meta.materials||0) >= cost.mats && (meta.stones||0) >= cost.stones && (meta.souls||0) >= cost.souls;

  var info = document.createElement('div');
  info.style.cssText = 'text-align:center;padding:8px;background:#1a1a2e;border-radius:8px;margin-bottom:8px;font-size:11px;color:#ccbb99';
  info.innerHTML = '消耗 📦' + cost.mats + ' 💎' + cost.stones + ' 💀' + cost.souls + '<br>品质随机 · 5%概率极品暴击(+2~+8)';
  container.appendChild(info);

  // 打造按钮
  var craftBtn = document.createElement('button');
  craftBtn.className = 'modal-btn';
  craftBtn.style.cssText = 'width:100%;padding:12px;font-size:16px;' + (canAfford ? 'background:#2a1a0a;border-color:#ffa502;color:#ffcc88' : '');
  craftBtn.textContent = '🎲 打造随机装备';
  craftBtn.disabled = !canAfford;
  craftBtn.onclick = function() {
    var eq = genOutgameEquip();
    var msg = '打造成功！' + eq.name + ' ' + STAT_SHORT[eq.stat] + ':' + eq.val + (eq.extraVal>0?'(+' + eq.extraVal + ')':'') + ' [' + eq.qualityName + ']';
    toast(msg);
    renderCraft(container);
  };
  container.appendChild(craftBtn);

  // 选择类型打造（多消耗）
  var typeLabel = document.createElement('div');
  typeLabel.style.cssText = 'color:#8899bb;font-size:10px;margin-top:8px;text-align:center';
  typeLabel.textContent = '指定类型打造（消耗×1.5）';
  container.appendChild(typeLabel);

  var typeGrid = document.createElement('div');
  typeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-top:4px';
  EQUIP_TYPES.forEach(function(t) {
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:4px 2px;font-size:9px;border-radius:4px;border:1px solid #2a2a3a;background:#111;color:#667;cursor:pointer';
    btn.textContent = t.icon;
    btn.title = t.name + ' (📦' + Math.ceil(cost.mats*1.5) + ' 💎' + Math.ceil(cost.stones*1.5) + ' 💀' + Math.ceil(cost.souls*1.5) + ')';
    var typeCost = { mats:Math.ceil(cost.mats*1.5), stones:Math.ceil(cost.stones*1.5), souls:Math.ceil(cost.souls*1.5) };
    var canType = (meta.materials||0) >= typeCost.mats && (meta.stones||0) >= typeCost.stones && (meta.souls||0) >= typeCost.souls;
    btn.disabled = !canType;
    btn.onclick = function() {
      var eq = genOutgameEquip(t.type);
      toast('打造成功！' + eq.name);
      renderCraft(container);
    };
    typeGrid.appendChild(btn);
  });
  container.appendChild(typeGrid);
}

// ---- 强化页 ----
function renderEnhance(container) {
  container.innerHTML = '';
  var meta = Game.meta;
  var allEquip = (meta.outgameEquip||[]).concat(Object.values(meta.outgameEquipped||{}).filter(Boolean));

  if (allEquip.length === 0) {
    container.innerHTML = '<div style="color:#556;text-align:center;padding:20px">没有可强化的装备</div>';
    return;
  }

  allEquip.forEach(function(eq) {
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;margin:2px 0;background:#0d1117;border-radius:6px;border-left:3px solid ' + (eq.color||'#ccc');
    card.innerHTML = '<div style="font-size:24px;width:32px;text-align:center">' + (eq.icon||'🔮') + '</div>' +
      '<div style="flex:1;min-width:0"><div style="color:' + (eq.color||'#ccc') + ';font-weight:bold;font-size:11px">' + eq.name + '</div>' +
      '<div style="color:#8899bb;font-size:9px">' + STAT_SHORT[eq.stat] + ':' + eq.val + ' <span style="color:#ff6644">+' + (eq.enhanceLv||0) + '</span></div></div>';

    var enhanceBtn = document.createElement('button');
    enhanceBtn.style.cssText = 'font-size:9px;padding:4px 10px;background:#2a1a0a;border:1px solid #8a6030;color:#ffcc88;border-radius:4px;cursor:pointer;white-space:nowrap';
    enhanceBtn.textContent = '强化 +' + ((eq.enhanceLv||0)+1);
    enhanceBtn.onclick = function() {
      var result = enhanceEquip(eq.id);
      toast(result.msg);
      renderEnhance(container);
    };
    card.appendChild(enhanceBtn);
    container.appendChild(card);
  });
}

// ---- 符文页 ----
function renderRunes(container) {
  container.innerHTML = '';
  var meta = Game.meta;
  var dg = meta.dungeon;
  var runeStock = dg && dg.forge ? (dg.forge.runes || []) : [];

  // 符文库存
  var stockDiv = document.createElement('div');
  stockDiv.style.cssText = 'padding:8px;background:#1a1a2e;border-radius:8px;margin-bottom:8px;font-size:11px';
  stockDiv.innerHTML = '<b style="color:#ffa502">💎 符文仓库</b><br>';
  if (runeStock.length === 0) {
    stockDiv.innerHTML += '<span style="color:#556">暂无符文 · 在地下城 Boss 有概率掉落</span>';
  } else {
    runeStock.forEach(function(r) {
      stockDiv.innerHTML += '<span style="display:inline-block;margin:2px 4px;padding:2px 6px;background:#0d1117;border-radius:4px">' + (RUNE_ICONS[r]||'?') + ' ' + (RUNE_NAMES[r]||r) + ' (' + (RUNE_EFFECTS[r]||'') + ')</span>';
    });
  }
  container.appendChild(stockDiv);

  // 可镶嵌的装备列表
  var allEquip = (meta.outgameEquip||[]).concat(Object.values(meta.outgameEquipped||{}).filter(Boolean));
  allEquip.forEach(function(eq) {
    if ((eq.runeSlots||0) <= 0) return;
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;margin:2px 0;background:#0d1117;border-radius:6px;border-left:3px solid ' + (eq.color||'#ccc');
    var curRunes = eq.runes || [];
    var runeStr = curRunes.map(function(r){ return (RUNE_ICONS[r]||'?'); }).join(' ') || '空';
    card.innerHTML = '<div style="font-size:20px;width:28px;text-align:center">' + (eq.icon||'🔮') + '</div>' +
      '<div style="flex:1;min-width:0"><div style="color:' + (eq.color||'#ccc') + ';font-weight:bold;font-size:11px">' + eq.name + '</div>' +
      '<div style="color:#8899bb;font-size:9px">孔:' + curRunes.length + '/' + eq.runeSlots + ' ' + runeStr + '</div></div>';

    if (runeStock.length > 0 && curRunes.length < eq.runeSlots) {
      var embedBtn = document.createElement('button');
      embedBtn.style.cssText = 'font-size:9px;padding:2px 6px;background:#1a2a1a;border:1px solid #3a5a3a;color:#89e894;border-radius:4px;cursor:pointer';
      embedBtn.textContent = '镶嵌';
      embedBtn.onclick = function() {
        var runeId = runeStock[0]; // 简化：选第一个
        var result = embedRune(eq.id, runeId);
        toast(result.msg);
        renderRunes(container);
      };
      card.appendChild(embedBtn);
    }
    if (curRunes.length > 0) {
      var removeBtn = document.createElement('button');
      removeBtn.style.cssText = 'font-size:9px;padding:2px 6px;background:#2a1a1a;border:1px solid #5a3a3a;color:#ff8888;border-radius:4px;cursor:pointer;margin-left:2px';
      removeBtn.textContent = '取下';
      removeBtn.onclick = function() {
        var result = removeRune(eq.id, curRunes[0]);
        toast(result.msg);
        renderRunes(container);
      };
      card.appendChild(removeBtn);
    }
    container.appendChild(card);
  });
}

// ---- 升阶页 ----
function renderUpgrade(container) {
  container.innerHTML = '';
  var meta = Game.meta;
  var allEquip = (meta.outgameEquip||[]).concat(Object.values(meta.outgameEquipped||{}).filter(Boolean));

  var info = document.createElement('div');
  info.style.cssText = 'text-align:center;padding:8px;background:#1a1a2e;border-radius:8px;margin-bottom:8px;font-size:11px;color:#ccbb99';
  info.innerHTML = '📺 看广告升一阶品质 · 每件装备仅一次';
  container.appendChild(info);

  allEquip.forEach(function(eq) {
    if (eq._upgraded) return;
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;margin:2px 0;background:#0d1117;border-radius:6px;border-left:3px solid ' + (eq.color||'#ccc');
    card.innerHTML = '<div style="font-size:20px;width:28px;text-align:center">' + (eq.icon||'🔮') + '</div>' +
      '<div style="flex:1"><div style="color:' + (eq.color||'#ccc') + ';font-weight:bold;font-size:11px">' + eq.name + '</div>' +
      '<div style="color:#8899bb;font-size:9px">' + eq.qualityName + ' → 升一阶</div></div>';

    var upgradeBtn = document.createElement('button');
    upgradeBtn.style.cssText = 'font-size:9px;padding:4px 8px;background:#2a1a0a;border:1px solid #ffa502;color:#ffcc88;border-radius:4px;cursor:pointer;white-space:nowrap';
    upgradeBtn.textContent = '📺 升阶';
    upgradeBtn.onclick = function() {
      if (confirm('看广告升阶 ' + eq.name + '？')) {
        var result = upgradeQuality(eq.id);
        toast(result.msg);
        renderUpgrade(container);
      }
    };
    card.appendChild(upgradeBtn);
    container.appendChild(card);
  });
}

// openSmithyPanel 已在顶部 export function 导出
