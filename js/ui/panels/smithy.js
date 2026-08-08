// ===================== v0.86 铁匠铺（UI升级：固定尺寸+卡片化） =====================
// 打造装备 / 强化 / 符文管理 / 品质升阶
import { Game } from '../../core/state.js';
import { genOutgameEquip, enhanceEquip, embedRune, removeRune, upgradeQuality, EQUIP_TYPES, QUALITY_COLORS, STAT_SHORT } from '../../systems/outgame-equip.js';
import { toast } from '../effects.js';

var RUNE_ICONS = { fire:'🔥', ice:'❄️', dark:'💀', light:'🌟', thunder:'⚡' };
var RUNE_NAMES = { fire:'紫微·火', ice:'七杀·冰', dark:'破军·暗', light:'天机·光', thunder:'贪狼·雷' };
var RUNE_EFFECTS = { fire:'ATK+8', ice:'DEF+5', dark:'暴伤+15%', light:'HP+40', thunder:'暴击+5%' };

var ENHANCE_RATE = ['100%','95%','85%','75%','65%','55%','45%','35%','25%','15%'];

// 面板骨架：固定尺寸，内容区内部滚动（不再整体弹窗滑动条）
export function openSmithyPanel() {
  var meta = Game.meta;
  var el = document.getElementById('meta-panel');
  // v0.86: 防重复打开叠加 — 先清理上次遗留的页签/内容/关闭按钮
  var oldTab = document.getElementById('smithy-tab-bar');
  if (oldTab) oldTab.remove();
  var oldTabContent = document.getElementById('smithy-tab-content');
  if (oldTabContent) oldTabContent.remove();
  var oldClose = document.getElementById('smithy-close-btn');
  if (oldClose) oldClose.remove();
  // v0.86: 清空内容区（从纸娃娃跳转时防旧内容残留）
  var mc0 = document.getElementById('meta-content');
  if (mc0) mc0.innerHTML = '';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.maxWidth = '480px';
  el.style.width = '94%';
  el.style.height = '76vh';
  el.style.maxHeight = '76vh';
  el.style.padding = '0';
  el.style.overflow = 'hidden';

  // 标题栏
  var titleEl = document.getElementById('meta-title');
  if (titleEl) titleEl.textContent = '🎲 铁匠铺';
  titleEl.style.cssText = 'padding:12px 16px 8px;margin:0;font-size:16px;color:#ffcc88;border-bottom:1px solid rgba(255,165,0,.15)';
  var subtitle = document.getElementById('meta-subtitle');
  if (subtitle) subtitle.style.cssText = 'padding:0 16px 8px;margin:0;font-size:11px;color:#8899bb';
  if (subtitle) subtitle.innerHTML = '💎<b>' + (meta.stones||0) + '</b> · 💀<b>' + (meta.souls||0) + '</b> · 📦<b>' + (meta.materials||0) + '</b> · ⚒️<b>' + (meta.forgeStones||0) + '</b>';

  var content = document.getElementById('meta-content');
  content.style.cssText = 'flex:1;overflow-y:auto;padding:12px 14px;text-align:left;font-size:12px;min-height:0';

  // === Tab栏（胶囊式） ===
  var tabBar = document.createElement('div');
  tabBar.id = 'smithy-tab-bar';
  tabBar.style.cssText = 'display:flex;gap:4px;padding:10px 14px 0;background:rgba(0,0,0,.15)';
  var tabs = [
    { key:'打造', icon:'🎲' }, { key:'强化', icon:'🔨' }, { key:'符文', icon:'💠' }, { key:'升阶', icon:'🌟' }
  ];
  var activeTab = { current: '打造' };
  function renderTab(t) {
    activeTab.current = t;
    tabBar.querySelectorAll('button').forEach(function(b){
      var on = b.dataset.tab === t;
      b.style.background = on ? 'rgba(255,165,0,.15)' : 'transparent';
      b.style.color = on ? '#ffcc88' : '#667';
      b.style.borderColor = on ? 'rgba(255,165,0,.4)' : '#2a2a3a';
    });
    renderContent(t);
  }
  tabs.forEach(function(t) {
    var btn = document.createElement('button');
    btn.dataset.tab = t.key;
    btn.textContent = t.icon + ' ' + t.key;
    btn.style.cssText = 'flex:1;padding:7px 0;border-radius:8px 8px 0 0;border:1px solid #2a2a3a;border-bottom:none;background:transparent;color:#667;cursor:pointer;font-size:12px;transition:all .15s';
    btn.onclick = function() { renderTab(t.key); };
    tabBar.appendChild(btn);
  });
  el.insertBefore(tabBar, content);

  var tabContent = document.createElement('div');
  tabContent.id = 'smithy-tab-content';
  content.appendChild(tabContent);

  function renderContent(tab) {
    tabContent.innerHTML = '';
    switch(tab) {
      case '打造': renderCraft(tabContent); break;
      case '强化': renderEnhance(tabContent); break;
      case '符文': renderRunes(tabContent); break;
      case '升阶': renderUpgrade(tabContent); break;
    }
  }
  renderTab('打造');

  // v0.86: 统一清理 — 移除铁匠铺全部元素 + 重置面板样式（防残留叠加）
  function cleanupPanel() {
    ['smithy-tab-bar','smithy-tab-content','smithy-doll-btn','smithy-close-btn'].forEach(function(id){
      var el2 = document.getElementById(id);
      if (el2) el2.remove();
    });
    el.style.height = ''; el.style.maxHeight = ''; el.style.width = ''; el.style.maxWidth = '';
    el.style.flexDirection = ''; el.style.padding = ''; el.style.overflow = '';
    var mc = document.getElementById('meta-content');
    if (mc) mc.style.cssText = '';
    var cc = document.getElementById('btn-close-meta');
    if (cc) cc.style.display = 'none';
  }

  // 底部：角色装备（纸娃娃）+ 关闭
  var dollBtn = document.createElement('button');
  dollBtn.id = 'smithy-doll-btn';
  dollBtn.style.cssText = 'margin:0 14px 8px;padding:8px;font-size:12px;background:#12121e;border:1px solid #5a4080;color:#c8a8ff;border-radius:8px;cursor:pointer;flex-shrink:0';
  dollBtn.textContent = '🛡️ 角色装备管理';
  dollBtn.onclick = function() {
    // v0.86: 先完整清理铁匠铺再进纸娃娃（防元素残留叠加）
    cleanupPanel();
    import('./equip-doll.js').then(function(m) { m.showEquipDoll(); });
  };
  el.appendChild(dollBtn);

  // 底部关闭
  var closeBtn = document.createElement('button');
  closeBtn.id = 'smithy-close-btn';
  closeBtn.className = 'modal-btn';
  closeBtn.style.cssText = 'margin:10px 14px 14px;padding:9px;font-size:13px;background:#1a1a2a;border:1px solid #333;color:#889;border-radius:8px;cursor:pointer;flex-shrink:0';
  closeBtn.textContent = '关闭';
  closeBtn.onclick = function() { cleanupPanel(); el.style.display = 'none'; };
  el.appendChild(closeBtn);
}

// ---- 打造页 ----
function renderCraft(container) {
  var meta = Game.meta;
  var cost = { mats:6, stones:15, souls:30 };
  var canAfford = (meta.materials||0) >= cost.mats && (meta.stones||0) >= cost.stones && (meta.souls||0) >= cost.souls;

  var info = document.createElement('div');
  info.style.cssText = 'text-align:center;padding:10px;background:linear-gradient(135deg,rgba(42,26,10,.6),rgba(20,12,6,.6));border:1px solid rgba(255,165,0,.2);border-radius:10px;margin-bottom:10px;font-size:11px;color:#ccbb99';
  info.innerHTML = '消耗 <b style="color:#ffa502">📦'+cost.mats+'</b> <b style="color:#70a1ff">💎'+cost.stones+'</b> <b style="color:#c8a8ff">💀'+cost.souls+'</b><br><span style="font-size:10px;color:#667">品质随机 · 5%概率极品暴击(+2~+8)</span>';
  container.appendChild(info);

  var craftBtn = document.createElement('button');
  craftBtn.className = 'modal-btn';
  craftBtn.style.cssText = 'width:100%;padding:14px;font-size:15px;border-radius:10px;background:linear-gradient(180deg,#3a2410,#2a1a0a);border:1px solid #ffa502;color:#ffcc88;cursor:pointer;font-weight:bold;' + (canAfford ? '' : 'opacity:.4;cursor:not-allowed');
  craftBtn.textContent = '🎲 打造随机装备';
  craftBtn.disabled = !canAfford;
  craftBtn.onclick = function() {
    var eq = genOutgameEquip();
    meta.materials -= cost.mats; meta.stones -= cost.stones; meta.souls -= cost.souls;
    Game.saveMeta();
    var msg = '打造成功！' + eq.name + ' ' + STAT_SHORT[eq.stat] + ':' + eq.val + (eq.extraVal>0?'(+' + eq.extraVal + ')':'') + ' [' + eq.qualityName + ']';
    toast(msg);
    renderCraft(container);
  };
  container.appendChild(craftBtn);

  var typeLabel = document.createElement('div');
  typeLabel.style.cssText = 'color:#8899bb;font-size:10px;margin-top:10px;text-align:center';
  typeLabel.textContent = '指定类型打造（消耗×1.5）';
  container.appendChild(typeLabel);

  var typeGrid = document.createElement('div');
  typeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:6px';
  EQUIP_TYPES.forEach(function(t) {
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:8px 2px;font-size:16px;border-radius:8px;border:1px solid #2a2a3a;background:#12121e;cursor:pointer;transition:all .15s';
    btn.textContent = t.icon;
    btn.title = t.name + ' (📦' + Math.ceil(cost.mats*1.5) + ' 💎' + Math.ceil(cost.stones*1.5) + ' 💀' + Math.ceil(cost.souls*1.5) + ')';
    var typeCost = { mats:Math.ceil(cost.mats*1.5), stones:Math.ceil(cost.stones*1.5), souls:Math.ceil(cost.souls*1.5) };
    var canType = (meta.materials||0) >= typeCost.mats && (meta.stones||0) >= typeCost.stones && (meta.souls||0) >= typeCost.souls;
    btn.disabled = !canType;
    btn.style.opacity = canType ? '1' : '.3';
    btn.onmouseenter = function() { this.style.borderColor = '#ffa502'; this.style.background = '#1a1a2e'; };
    btn.onmouseleave = function() { this.style.borderColor = '#2a2a3a'; this.style.background = '#12121e'; };
    btn.onclick = function() {
      var eq = genOutgameEquip(t.type);
      meta.materials -= typeCost.mats; meta.stones -= typeCost.stones; meta.souls -= typeCost.souls;
      Game.saveMeta();
      toast('打造成功！' + eq.name);
      renderCraft(container);
    };
    typeGrid.appendChild(btn);
  });
  container.appendChild(typeGrid);
}

// ---- 强化页 ----
function renderEnhance(container) {
  var meta = Game.meta;
  var allEquip = (meta.outgameEquip||[]).concat(Object.values(meta.outgameEquipped||{}).filter(Boolean));

  if (allEquip.length === 0) {
    container.innerHTML = '<div style="color:#556;text-align:center;padding:24px">还没有装备 · 先去「打造」一件</div>';
    return;
  }

  allEquip.forEach(function(eq) {
    var lv = eq.enhanceLv || 0;
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;margin:4px 0;background:#0d1117;border-radius:8px;border-left:3px solid ' + (eq.color||'#ccc') + ';transition:all .15s';
    card.innerHTML =
      '<div style="font-size:22px;width:30px;text-align:center">' + (eq.icon||'🔮') + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="color:' + (eq.color||'#ccc') + ';font-weight:bold;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + eq.name + '</div>' +
        '<div style="color:#8899bb;font-size:9px">' + STAT_SHORT[eq.stat] + ':' + eq.val + '</div>' +
        '<div style="margin-top:2px;font-size:9px;color:' + (lv>=8?'#ff6644':lv>=5?'#ffa502':'#5a5') + '">' + '▮'.repeat(lv+1) + '<span style="color:#222">' + '▮'.repeat(10-lv) + '</span> +' + lv + ' · ' + (ENHANCE_RATE[lv]||'?') + '</div>' +
      '</div>';

    var enhanceBtn = document.createElement('button');
    enhanceBtn.style.cssText = 'font-size:10px;padding:5px 10px;background:#2a1a0a;border:1px solid #8a6030;color:#ffcc88;border-radius:6px;cursor:pointer;white-space:nowrap;flex-shrink:0';
    enhanceBtn.textContent = '强化 +' + (lv+1);
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
  var meta = Game.meta;
  var dg = meta.dungeon;
  var runeStock = dg && dg.forge ? (dg.forge.runes || []) : [];

  var stockDiv = document.createElement('div');
  stockDiv.style.cssText = 'padding:8px 10px;background:linear-gradient(135deg,rgba(26,18,46,.5),rgba(16,12,30,.5));border-radius:8px;margin-bottom:8px;font-size:11px';
  stockDiv.innerHTML = '<b style="color:#c8a8ff">💠 符文仓库</b><br>';
  if (runeStock.length === 0) {
    stockDiv.innerHTML += '<span style="color:#556;font-size:10px">暂无符文 · 裂隙副本Boss有概率掉落</span>';
  } else {
    runeStock.forEach(function(r) {
      stockDiv.innerHTML += '<span style="display:inline-block;margin:2px 3px;padding:2px 8px;background:#0d1117;border:1px solid rgba(140,100,220,.3);border-radius:12px;font-size:10px;color:#c8a8ff">' + (RUNE_ICONS[r]||'?') + ' ' + (RUNE_NAMES[r]||r) + ' <span style="color:#667">(' + (RUNE_EFFECTS[r]||'') + ')</span></span>';
    });
  }
  container.appendChild(stockDiv);

  var allEquip = (meta.outgameEquip||[]).concat(Object.values(meta.outgameEquipped||{}).filter(Boolean));
  var anySlot = false;
  allEquip.forEach(function(eq) {
    if ((eq.runeSlots||0) <= 0) return;
    anySlot = true;
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;margin:3px 0;background:#0d1117;border-radius:8px;border-left:3px solid ' + (eq.color||'#ccc');
    var curRunes = eq.runes || [];
    var runeStr = curRunes.map(function(r){ return (RUNE_ICONS[r]||'?'); }).join(' ') || '空';
    card.innerHTML = '<div style="font-size:18px;width:26px;text-align:center">' + (eq.icon||'🔮') + '</div>' +
      '<div style="flex:1;min-width:0"><div style="color:' + (eq.color||'#ccc') + ';font-weight:bold;font-size:11px">' + eq.name + '</div>' +
      '<div style="color:#8899bb;font-size:9px">孔: <span style="color:#c8a8ff">' + curRunes.length + '/' + eq.runeSlots + '</span> ' + runeStr + '</div></div>';

    if (runeStock.length > 0 && curRunes.length < eq.runeSlots) {
      var embedBtn = document.createElement('button');
      embedBtn.style.cssText = 'font-size:10px;padding:4px 8px;background:#1a2a1a;border:1px solid #3a5a3a;color:#89e894;border-radius:6px;cursor:pointer;flex-shrink:0';
      embedBtn.textContent = '镶嵌';
      embedBtn.onclick = function() {
        var runeId = runeStock[0];
        var result = embedRune(eq.id, runeId);
        toast(result.msg);
        renderRunes(container);
      };
      card.appendChild(embedBtn);
    }
    if (curRunes.length > 0) {
      var removeBtn = document.createElement('button');
      removeBtn.style.cssText = 'font-size:10px;padding:4px 8px;background:#2a1a1a;border:1px solid #5a3a3a;color:#ff8888;border-radius:6px;cursor:pointer;margin-left:2px;flex-shrink:0';
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
  if (!anySlot) {
    var note = document.createElement('div');
    note.style.cssText = 'color:#556;text-align:center;padding:14px;font-size:10px';
    note.textContent = '精良及以上品质的装备才有符文孔';
    container.appendChild(note);
  }
}

// ---- 升阶页 ----
function renderUpgrade(container) {
  var meta = Game.meta;
  var allEquip = (meta.outgameEquip||[]).concat(Object.values(meta.outgameEquipped||{}).filter(Boolean));

  var dg = meta.dungeon;
  var ascLeft = (dg && dg.forge && dg.forge.enchantAsc > 0) ? dg.forge.enchantAsc : 0;

  var info = document.createElement('div');
  info.style.cssText = 'text-align:center;padding:8px 10px;background:linear-gradient(135deg,rgba(26,18,46,.5),rgba(16,12,30,.5));border-radius:8px;margin-bottom:8px;font-size:11px;color:#ccbb99';
  info.innerHTML = ascLeft > 0
    ? '🌟 升华次数: <b style="color:#ffd700">' + ascLeft + '</b>（优先消耗，免广告）· 每件装备仅一次'
    : '📺 看广告升一阶品质 · 每件装备仅一次';
  container.appendChild(info);

  var upgradable = allEquip.filter(function(eq){ return !eq._upgraded && eq.quality !== 'mythic'; });
  if (upgradable.length === 0) {
    container.innerHTML += '<div style="color:#556;text-align:center;padding:20px;font-size:10px">没有可升阶的装备（每件仅一次 · 神话已满阶）</div>';
    return;
  }

  upgradable.forEach(function(eq) {
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;margin:3px 0;background:#0d1117;border-radius:8px;border-left:3px solid ' + (eq.color||'#ccc');
    card.innerHTML = '<div style="font-size:20px;width:28px;text-align:center">' + (eq.icon||'🔮') + '</div>' +
      '<div style="flex:1;min-width:0"><div style="color:' + (eq.color||'#ccc') + ';font-weight:bold;font-size:11px">' + eq.name + '</div>' +
      '<div style="color:#8899bb;font-size:9px">' + eq.qualityName + ' → 升一阶</div></div>';

    var upgradeBtn = document.createElement('button');
    upgradeBtn.style.cssText = 'font-size:10px;padding:5px 10px;background:#2a1a0a;border:1px solid #ffa502;color:#ffcc88;border-radius:6px;cursor:pointer;white-space:nowrap;flex-shrink:0';
    upgradeBtn.textContent = ascLeft > 0 ? '🌟 升华' : '📺 升阶';
    upgradeBtn.onclick = function() {
      if (ascLeft > 0) {
        dg.forge.enchantAsc--;
        Game.saveMeta();
      } else {
        if (!Game.watchAd()) { toast('广告不可用（今日次数已用完）'); return; }
      }
      var result = upgradeQuality(eq.id);
      toast(result.msg);
      renderUpgrade(container);
    };
    card.appendChild(upgradeBtn);
    container.appendChild(card);
  });
}
