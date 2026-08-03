// ===================== v0.81 纸娃娃装备面板 =====================
// 中间人物位，四周 10 装备槽，右侧属性面板
import { Game } from '../../core/state.js';
import { EQUIP_TYPES, QUALITY_COLORS, STAT_LABELS, STAT_SHORT, equipOutgameItem, unequipOutgameItem } from '../../systems/outgame-equip.js';
import { showEquipBag } from './equip-bag.js';
import { openSmithyPanel } from './smithy.js';

var RUNE_ICONS = { fire:'🔥', ice:'❄️', dark:'💀', light:'🌟', thunder:'⚡' };
var RUNE_NAMES = { fire:'紫微', ice:'七杀', dark:'破军', light:'天机', thunder:'贪狼' };

// 槽位布局（CSS grid 坐标）
var SLOT_POSITIONS = {
  weapon:     { col:2, row:1 },
  helm:       { col:1, row:2 },
  armor:      { col:3, row:2 },
  ringL:      { col:1, row:3 },
  ringR:      { col:3, row:3 },
  braceletL:  { col:1, row:4 },
  braceletR:  { col:3, row:4 },
  amulet:     { col:1, row:5 },
  belt:       { col:3, row:5 },
  medal:      { col:2, row:6 },
};

export function showEquipDoll() {
  var meta = Game.meta;
  if (!meta.outgameEquipped) meta.outgameEquipped = {};
  if (!meta.outgameEquip) meta.outgameEquip = [];

  var el = document.getElementById('meta-panel');
  el.style.display = 'block'; el.style.maxWidth = '500px';
  var titleEl = document.getElementById('meta-title');
  if (titleEl) titleEl.textContent = '⚒️ 角色装备';
  var subtitle = document.getElementById('meta-subtitle');
  if (subtitle) subtitle.innerHTML = '📦 背包: <b>' + meta.outgameEquip.length + '</b>件 | 💎' + (meta.stones||0) + ' 💀' + (meta.souls||0) + ' 📦' + (meta.materials||0);
  var content = document.getElementById('meta-content');
  content.innerHTML = '';

  // 主布局：左侧纸娃娃 + 右侧属性
  var mainRow = document.createElement('div');
  mainRow.style.cssText = 'display:flex;gap:12px';

  // === 左侧：纸娃娃 ===
  var dollArea = document.createElement('div');
  dollArea.style.cssText = 'flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:auto auto auto auto auto auto;gap:4px;padding:8px;background:#0d0d15;border-radius:10px;min-width:280px';

  // 角色位（中间，占 3 列 2 行）
  var charSlot = document.createElement('div');
  charSlot.style.cssText = 'grid-column:2;grid-row:2/4;display:flex;align-items:center;justify-content:center;min-height:120px;min-width:80px';
  charSlot.innerHTML = '<div style="width:80px;height:120px;background:#1a1a2e;border-radius:8px;border:2px dashed #3a3a5a;display:flex;align-items:center;justify-content:center;color:#555;font-size:36px">🧍</div>';
  dollArea.appendChild(charSlot);

  // 装备槽
  EQUIP_TYPES.forEach(function(t) {
    var pos = SLOT_POSITIONS[t.type];
    if (!pos) return;
    var slot = document.createElement('div');
    slot.style.cssText = 'grid-column:' + pos.col + ';grid-row:' + pos.row + ';padding:4px;background:#111;border-radius:6px;border:1px solid #2a2a3a;text-align:center;cursor:pointer;min-height:44px;transition:all .15s;font-size:11px';
    slot.title = t.name + ' - 点击装备/卸下';

    var equipped = meta.outgameEquipped[t.type];
    if (equipped) {
      slot.style.borderColor = equipped.color || '#ccc';
      slot.style.background = '#1a1a2a';
      var runeStr = '';
      if (equipped.runes && equipped.runes.length > 0) {
        runeStr = '<div style="font-size:8px;margin-top:2px">' + equipped.runes.map(function(r){ return (RUNE_ICONS[r]||'?'); }).join('') + '</div>';
      }
      var effectStr = equipped.effect ? '<div style="color:#ffa502;font-size:7px;margin-top:1px">' + equipped.effect.desc + '</div>' : '';
      slot.innerHTML = '<div style="font-size:20px">' + t.icon + '</div><div style="color:' + (equipped.color||'#ccc') + ';font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + STAT_SHORT[equipped.stat] + ':' + equipped.val + (equipped.extraVal>0?'<span style="color:#ffa502">(+' + equipped.extraVal + ')</span>':'') + '</div>' + (equipped.enhanceLv > 0 ? '<span style="color:#ff6644;font-size:8px">+' + equipped.enhanceLv + '</span>' : '') + effectStr + runeStr;
      slot.onclick = function() {
        if (confirm('卸下 ' + equipped.name + '？')) {
          unequipOutgameItem(t.type);
          showEquipDoll();
        }
      };
    } else {
      slot.innerHTML = '<div style="color:#445;font-size:20px">' + t.icon + '</div><div style="color:#445;font-size:9px">' + t.name + '</div>';
      slot.onclick = function() {
        if (meta.outgameEquip.length === 0) { alert('背包为空，请先去铁匠铺打造装备'); return; }
        // 打开背包选装备（筛选同类型）
        showEquipBag(t.type, function(equipId) {
          equipOutgameItem(equipId, t.type);
          showEquipDoll();
        });
      };
    }
    dollArea.appendChild(slot);
  });

  mainRow.appendChild(dollArea);

  // === 右侧：属性面板 ===
  var statPanel = document.createElement('div');
  statPanel.style.cssText = 'flex:0 0 140px;padding:8px;background:#0d0d15;border-radius:10px;font-size:11px;color:#ccbb99;line-height:1.8';

  var totalAtk = 0, totalDef = 0, totalHp = 0, totalCrit = 0, totalDodge = 0;
  Object.values(meta.outgameEquipped||{}).forEach(function(eq) {
    if (!eq) return;
    var val = eq.val + (eq.extraVal||0);
    switch (eq.stat) {
      case 'atk': totalAtk += val; break;
      case 'def': totalDef += val; break;
      case 'maxHp': totalHp += val; break;
      case 'critRate': totalCrit += val; break;
      case 'dodge': totalDodge += val; break;
    }
  });

  statPanel.innerHTML = '<div style="color:#ffa502;font-weight:bold;margin-bottom:6px;font-size:12px">📊 装备属性</div>' +
    '<div>⚔️ ATK: <b style="color:#ff6644">' + totalAtk + '</b></div>' +
    '<div>🛡️ DEF: <b style="color:#70a1ff">' + totalDef + '</b></div>' +
    '<div>❤️ HP: <b style="color:#89e894">' + totalHp + '</b></div>' +
    '<div>💥 暴击: <b style="color:#ffa502">' + totalCrit + '%</b></div>' +
    '<div>🍃 闪避: <b style="color:#c8a8ff">' + totalDodge + '%</b></div>' +
    '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #2a2a3a;font-size:9px;color:#667">' +
    '💰' + (meta.stones||0) + '灵石<br>💀' + (meta.souls||0) + '魂晶<br>📦' + (meta.materials||0) + '材料</div>';

  mainRow.appendChild(statPanel);
  content.appendChild(mainRow);

  // === 底部按钮 ===
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;margin-top:8px';
  btnRow.innerHTML = '<button class="modal-btn" style="flex:1;font-size:11px" id="btn-open-bag">📦 背包(' + meta.outgameEquip.length + ')</button>' +
    '<button class="modal-btn" style="flex:1;font-size:11px;background:#2a1a0a;border-color:#8a6030;color:#ffcc88" id="btn-open-smithy">🎲 铁匠铺</button>' +
    '<button class="modal-btn" style="flex:1;font-size:11px" id="btn-close-doll">关闭</button>';
  content.appendChild(btnRow);

  document.getElementById('btn-open-bag').onclick = function() { showEquipBag(null, null); };
  document.getElementById('btn-open-smithy').onclick = function() { el.style.display='none'; openSmithyPanel(); };
  document.getElementById('btn-close-doll').onclick = function() { el.style.display = 'none'; };
}
