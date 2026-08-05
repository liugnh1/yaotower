// ===================== v0.81 装备背包面板 =====================
import { Game } from '../../core/state.js';
import { EQUIP_TYPES, QUALITY_COLORS, STAT_SHORT, dismantleEquip } from '../../systems/outgame-equip.js';
import { showModal, hideModal } from '../screens.js';
import { toast } from '../effects.js';

var RUNE_ICONS = { fire:'🔥', ice:'❄️', dark:'💀', light:'🌟', thunder:'⚡' };

// filterType: 筛选装备类型 (null=全部, 或具体type string)
// onPick: 选择回调 (equipId)
export function showEquipBag(filterType, onPick) {
  var meta = Game.meta;
  if (!meta.outgameEquip) meta.outgameEquip = [];
  var items = meta.outgameEquip;
  if (filterType) {
    // 左右戒指/手镯互通：点击任一侧都显示所有戒指/手镯
    var filterGroup = [filterType];
    if (filterType === "ringL" || filterType === "ringR") filterGroup = ["ringL","ringR","ring"];
    if (filterType === "braceletL" || filterType === "braceletR") filterGroup = ["braceletL","braceletR","bracelet"];
    items = items.filter(function(e){ return filterGroup.indexOf(e.type) >= 0; });
  }

  var el = document.getElementById('meta-panel');
  el.style.display = 'block'; el.style.maxWidth = '420px';
  var titleEl = document.getElementById('meta-title');
  if (titleEl) titleEl.textContent = filterType ? ('📦 选择' + (EQUIP_TYPES.find(function(t){return t.type===filterType;})||{}).name || filterType) : '📦 装备背包';
  var subtitle = document.getElementById('meta-subtitle');
  if (subtitle) subtitle.textContent = items.length + '件 | 💎' + (meta.stones||0) + ' 💀' + (meta.souls||0) + ' 📦' + (meta.materials||0);
  var content = document.getElementById('meta-content');
  content.innerHTML = '';

  if (items.length === 0) {
    content.innerHTML = '<div style="color:#556;text-align:center;padding:30px">背包为空<br><span style="font-size:11px">去铁匠铺打造装备吧</span></div>';
    var closeBtn2 = document.createElement('button');
    closeBtn2.className = 'modal-btn'; closeBtn2.textContent = '关闭'; closeBtn2.style.cssText = 'margin-top:8px;width:100%';
    closeBtn2.onclick = function() { el.style.display = 'none'; };
    content.appendChild(closeBtn2);
    return;
  }

  // 品质筛选标签
  if (!filterType) {
    var filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex;gap:3px;margin-bottom:8px;flex-wrap:wrap';
    var allQualities = ['全部','破旧','普通','精良','稀有','史诗','传说','神话'];
    allQualities.forEach(function(qn) {
      var btn = document.createElement('button');
      btn.style.cssText = 'font-size:9px;padding:2px 6px;border-radius:4px;border:1px solid #333;background:#111;color:#667;cursor:pointer';
      btn.textContent = qn;
      btn.onclick = function() {
        if (qn === '全部') { showEquipBag(null, onPick); }
        else { showEquipBag(null, onPick); /* TODO: 筛选 */ }
      };
      filterBar.appendChild(btn);
    });
    content.appendChild(filterBar);
  }

  items.forEach(function(eq) {
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;margin:2px 0;background:#0d1117;border-radius:6px;border-left:3px solid ' + (eq.color||'#ccc') + ';cursor:pointer;transition:all .15s';
    card.onmouseenter = function(){ this.style.background = '#1a1a2e'; };
    card.onmouseleave = function(){ this.style.background = '#0d1117'; };

    var iconDiv = document.createElement('div');
    iconDiv.style.cssText = 'font-size:28px;width:36px;text-align:center';
    iconDiv.textContent = eq.icon || '🔮';

    var infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'flex:1;min-width:0';
    var runeStr = eq.runes && eq.runes.length > 0 ? eq.runes.map(function(r){ return RUNE_ICONS[r]||'?'; }).join('') : '';
    infoDiv.innerHTML = '<div style="color:' + (eq.color||'#ccc') + ';font-weight:bold;font-size:12px">' + eq.name + '</div>' +
      '<div style="color:#8899bb;font-size:10px">' + STAT_SHORT[eq.stat] + ':' + eq.val + (eq.extraVal>0?'<span style="color:#ffa502">(+' + eq.extraVal + ')</span>':'') +
      (eq.enhanceLv>0?' <span style="color:#ff6644">+' + eq.enhanceLv + '</span>':'') +
      ' | ' + eq.qualityName + ' | 孔:' + eq.runeSlots + (runeStr?' ' + runeStr:'') +
      '</div>';

    // 按钮区
    var btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'display:flex;flex-direction:column;gap:2px';

    if (onPick) {
      var equipBtn = document.createElement('button');
      equipBtn.style.cssText = 'font-size:9px;padding:2px 8px;background:#1a2a1a;border:1px solid #3a5a3a;color:#89e894;border-radius:3px;cursor:pointer;white-space:nowrap';
      equipBtn.textContent = '装备';
      equipBtn.onclick = function(e) { e.stopPropagation(); onPick(eq.id); };
      btnDiv.appendChild(equipBtn);
    }

    var dismantleBtn = document.createElement('button');
    dismantleBtn.style.cssText = 'font-size:9px;padding:2px 8px;background:#2a1a1a;border:1px solid #5a3a3a;color:#ff8888;border-radius:3px;cursor:pointer;white-space:nowrap';
    dismantleBtn.textContent = '分解';
    dismantleBtn.onclick = function(e) {
      e.stopPropagation();
      if (confirm('确定分解 ' + eq.name + '？')) {
        var result = dismantleEquip(eq.id);
        toast(result.msg);
        showEquipBag(filterType, onPick);
      }
    };
    btnDiv.appendChild(dismantleBtn);

    card.appendChild(iconDiv);
    card.appendChild(infoDiv);
    card.appendChild(btnDiv);

    if (!onPick) {
      card.onclick = function() {
        // 点击卡片：预览/强化入口（后续 Phase C 加入）
      };
    }

    content.appendChild(card);
  });

  // 底部
  var closeRow = document.createElement('div');
  closeRow.style.cssText = 'display:flex;gap:6px;margin-top:8px';
  if (!filterType) {
    var batchBtn = document.createElement('button');
    batchBtn.className = 'modal-btn';
    batchBtn.style.cssText = 'font-size:10px;background:#5a2020;flex:1';
    batchBtn.textContent = '🗑️ 一键分解破旧/普通';
    batchBtn.onclick = function() {
      if (!confirm('确定分解所有破旧和普通品质的装备？')) return;
      var toDismantle = meta.outgameEquip.filter(function(e){ return e.quality === 'worn' || e.quality === 'common'; });
      toDismantle.forEach(function(e){ dismantleEquip(e.id); });
      toast('已分解' + toDismantle.length + '件');
      showEquipBag(filterType, onPick);
    };
    closeRow.appendChild(batchBtn);
  }
  var closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn'; closeBtn.style.cssText = 'flex:1;font-size:11px';
  closeBtn.textContent = '关闭';
  closeBtn.onclick = function() { el.style.display = 'none'; };
  closeRow.appendChild(closeBtn);
  content.appendChild(closeRow);
}
