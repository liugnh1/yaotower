// ===================== v0.81 灵玉商店 =====================
// 看广告赚灵玉 → 自由兑换货币
import { Game } from '../../core/state.js';
import { R } from '../../core/registry.js';
import { toast } from '../effects.js';

var EXCHANGE_RATES = [
  { label:'💀 魂晶 ×15', cost:1, fn:function(m){ m.souls = (m.souls||0) + 15; return '魂晶 +15'; } },
  { label:'🔮 灵蕴 ×20', cost:1, fn:function(m){ Game.addEssence(20); return '灵蕴 +20'; } },
  { label:'⚒️ 锻石 ×4',  cost:1, fn:function(m){ m.forgeStones = (m.forgeStones||0) + 4; return '锻石 +4'; } },
  { label:'📦 材料 ×4',  cost:1, fn:function(m){ m.materials = (m.materials||0) + 4; return '材料 +4'; } },
  { label:'💎 灵石 ×12', cost:1, fn:function(m){ m.stones = (m.stones||0) + 12; return '灵石 +12'; } },
  { label:'🔑 钥匙 ×1',  cost:3, fn:function(m){ if(!m.dungeon) m.dungeon={keys:0}; m.dungeon.keys=(m.dungeon.keys||0)+1; return '钥匙 +1'; } },
  { label:'🛡️ 保护券',    cost:2, fn:function(m){ m.protectCharm = (m.protectCharm||0) + 1; return '强化保护券 +1'; } },
];

export function showJadeShop() {
  var meta = Game.meta;
  var el = document.getElementById('meta-panel');
  el.style.display = 'block'; el.style.maxWidth = '400px';
  var titleEl = document.getElementById('meta-title');
  if (titleEl) titleEl.textContent = '💎 灵玉商店';
  var subtitle = document.getElementById('meta-subtitle');
  var adWatched = meta.adWatched || 0;
  var adLimit = 10;
  try { var s = Game.state; var diff = s && s.difficulty ? R.get('difficulties', s.difficulty) : null; if (diff) adLimit = diff.adLimit || 10; } catch(e) {}
  if (subtitle) subtitle.innerHTML = '💎 灵玉: <b style="color:#ffa502">' + (meta.jadeSpirits || 0) + '</b> | 📺 今日广告: <b>' + adWatched + '/' + adLimit + '</b>';
  var content = document.getElementById('meta-content');
  content.innerHTML = '';

  // 看广告赚灵玉
  var adRow = document.createElement('div');
  adRow.style.cssText = 'text-align:center;padding:10px;background:#1a1a2e;border-radius:8px;margin-bottom:10px';
  adRow.innerHTML = '<div style="font-size:36px;margin-bottom:4px">📺</div><div style="color:#ccbb99;font-size:12px">看一次广告 = 1 灵玉</div>';
  var watchBtn = document.createElement('button');
  watchBtn.className = 'modal-btn';
  watchBtn.style.cssText = 'margin-top:6px;font-size:14px;padding:8px 20px;background:#2a1a0a;border-color:#ffa502;color:#ffcc88';
  watchBtn.textContent = '📺 看广告 (+1灵玉)';
  watchBtn.disabled = !Game.canWatchAd();
  watchBtn.onclick = function() {
    if (Game.watchAd()) {
      meta.jadeSpirits = (meta.jadeSpirits || 0) + 1;
      Game.saveMeta();
      toast('💎 灵玉 +1！当前: ' + meta.jadeSpirits);
      showJadeShop();
    } else {
      toast('今日广告次数已用完');
    }
  };
  adRow.appendChild(watchBtn);
  content.appendChild(adRow);

  // 兑换列表
  EXCHANGE_RATES.forEach(function(rate) {
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;padding:8px 10px;margin:3px 0;background:#0d1117;border-radius:6px;cursor:pointer;transition:all .15s';
    card.onmouseenter = function(){ this.style.background = '#1a1a2e'; };
    card.onmouseleave = function(){ this.style.background = '#0d1117'; };

    var labelSpan = document.createElement('span');
    labelSpan.style.cssText = 'flex:1;font-size:13px;font-weight:bold;color:#ffcc88';
    labelSpan.textContent = rate.label;

    var costSpan = document.createElement('span');
    costSpan.style.cssText = 'font-size:11px;color:#667;margin-right:8px';
    costSpan.textContent = '💎×' + rate.cost;

    var buyBtn = document.createElement('button');
    buyBtn.style.cssText = 'font-size:10px;padding:4px 12px;background:#1a2a1a;border:1px solid #3a5a3a;color:#89e894;border-radius:4px;cursor:pointer';
    buyBtn.textContent = '兑换';
    var canBuy = (meta.jadeSpirits || 0) >= rate.cost;
    buyBtn.disabled = !canBuy;
    buyBtn.onclick = function(e) {
      e.stopPropagation();
      if ((meta.jadeSpirits || 0) < rate.cost) return;
      meta.jadeSpirits -= rate.cost;
      var msg = rate.fn(meta);
      Game.saveMeta();
      toast('✅ ' + msg);
      showJadeShop();
    };

    card.appendChild(labelSpan);
    card.appendChild(costSpan);
    card.appendChild(buyBtn);
    content.appendChild(card);
  });

  // 保护券说明
  if ((meta.protectCharm || 0) > 0) {
    var protectInfo = document.createElement('div');
    protectInfo.style.cssText = 'text-align:center;margin-top:6px;padding:6px;background:#2a1a0a;border-radius:6px;font-size:11px;color:#ffa502';
    protectInfo.textContent = '🛡️ 持有保护券: ' + meta.protectCharm + '张（强化失败时自动消耗，不降级）';
    content.appendChild(protectInfo);
  }

  var closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn'; closeBtn.style.cssText = 'margin-top:8px;width:100%';
  closeBtn.textContent = '关闭';
  closeBtn.onclick = function() { el.style.display = 'none'; };
  content.appendChild(closeBtn);
}
