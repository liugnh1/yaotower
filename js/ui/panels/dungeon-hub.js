// ===================== v0.83 深渊裂隙主界面 =====================
import { Game } from '../../core/state.js';
import { R } from '../../core/registry.js';
import { E, Events } from '../../core/event-bus.js';
import { toast } from '../effects.js';
import { switchScreen } from '../screens.js';

// 材料计数
function countMat(matId) {
  var d = Game.meta.dungeon;
  return d && d.bossMarks ? (d.bossMarks[matId]||0) : 0;
}
function consumeMat(matId, n) {
  var d = Game.meta.dungeon;
  if (!d) return;
  if (!d.bossMarks) d.bossMarks = {};
  d.bossMarks[matId] = Math.max(0, (d.bossMarks[matId]||0) - n);
}

// ===== 锻造台面板（覆盖在裂隙界面上） =====
function showForgeOverlay() {
  var d = Game.meta.dungeon;
  if (!d) return;
  var enchants = R.get('dungeonEnchants');
  if (!enchants) return;

  var overlay = document.getElementById('rift-overlay');
  var content = document.getElementById('rift-overlay-content');
  if (!overlay || !content) return;
  overlay.style.display = 'flex';
  content.innerHTML = '';

  var title = document.createElement('div');
  title.style.cssText = 'color:#ffcc88;font-size:15px;font-weight:bold;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(140,100,60,.3)';
  title.textContent = '⚒️ 秘境锻造台';
  content.appendChild(title);

  // 精炼
  var rSec = document.createElement('div');
  rSec.style.cssText = 'margin-bottom:10px;padding:8px;background:rgba(10,8,18,.7);border:1px solid rgba(80,40,130,.2);border-radius:8px';
  rSec.innerHTML = '<div style="color:#c8a8ff;font-weight:bold;font-size:12px;margin-bottom:4px">🔨 精炼</div><div style="color:#667;font-size:10px;margin-bottom:6px">消耗素材+锻造石提升基础属性</div>';
  [{key:'refineAtk',name:'攻击',cost:20,icon:'⚔️'},{key:'refineHp',name:'生命',cost:20,icon:'❤️'},{key:'refineDef',name:'防御',cost:20,icon:'🛡️'}].forEach(function(st){
    var lv = d.forge[st.key]||0, cost = st.cost+lv*10, rate = lv<3?100:(lv<6?75:50);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;font-size:10px';
    row.innerHTML = '<span style="width:16px">'+st.icon+'</span><span style="width:28px;color:#ccc">'+st.name+'</span><span style="color:#ffa502;width:28px">+'+lv+'</span><span style="color:#667;flex:1">素材×'+cost+' 锻石×'+Math.floor(cost/2)+' | '+rate+'%</span>';
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:3px 10px;font-size:10px;background:rgba(40,20,10,.8);border:1px solid #8a6030;color:#ffcc88;border-radius:4px;cursor:pointer';
    btn.textContent = '精炼';
    btn.disabled = (Game.meta.materials||0)<cost||(Game.meta.forgeStones||0)<Math.floor(cost/2);
    btn.onclick = function(){
      if((Game.meta.materials||0)<cost||(Game.meta.forgeStones||0)<Math.floor(cost/2)) return;
      Game.meta.materials-=cost; Game.meta.forgeStones-=Math.floor(cost/2);
      if(Math.random()*100<rate){ d.forge[st.key]=(d.forge[st.key]||0)+1; toast('✅ '+st.name+'精炼成功！+'+d.forge[st.key]+'级'); }
      else { var prev=d.forge[st.key]||0; d.forge[st.key]=lv<6?Math.max(0,prev-1):0; toast(prev>0?'❌ 精炼失败！降为+'+d.forge[st.key]+'级':'❌ 精炼失败！归零'); }
      Game.saveMeta(); showForgeOverlay();
    };
    row.appendChild(btn); rSec.appendChild(row);
  });
  content.appendChild(rSec);

  // 附魔
  var eSec = document.createElement('div');
  eSec.style.cssText = 'padding:8px;background:rgba(10,8,18,.7);border:1px solid rgba(100,60,160,.25);border-radius:8px';
  eSec.innerHTML = '<div style="color:#c8a8ff;font-weight:bold;font-size:12px;margin-bottom:4px">✨ 附魔</div><div style="color:#667;font-size:10px;margin-bottom:6px">消耗Boss材料提升属性</div>';
  var dungeons = R.get('dungeons');
  Object.keys(enchants).forEach(function(key){
    if(key==='asc') return;
    var en = enchants[key];
    var eKey = 'enchant'+key.charAt(0).toUpperCase()+key.slice(1);
    var lv = d.forge[eKey]||0, maxLv = en.max||5;
    var cost = en.costs[Math.min(lv, en.costs.length-1)];
    var matName = '';
    Object.values(dungeons||{}).forEach(function(dg){ if(dg.material&&dg.material.id===en.material) matName = dg.material.icon+' '+dg.material.name; });
    var hasMat = countMat(en.material) >= cost;
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;margin:3px 0;font-size:10px';
    row.innerHTML = '<span style="width:60px;color:#ccc">'+en.name+'</span><span style="color:#ffa502;width:20px">+'+lv+'/'+maxLv+'</span><span style="color:#667;flex:1;font-size:9px">'+matName+'×'+cost+'</span>';
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:3px 8px;font-size:10px;background:rgba(20,16,40,.8);border:1px solid #5a4080;color:#c8a8ff;border-radius:4px;cursor:pointer';
    btn.textContent = lv>=maxLv?'满级':'附魔';
    btn.disabled = lv>=maxLv||!hasMat;
    btn.onclick = function(){
      if(lv>=maxLv||!hasMat) return;
      consumeMat(en.material, cost);
      d.forge[eKey] = (d.forge[eKey]||0)+1;
      Game.saveMeta(); toast('✨ '+en.name+'附魔 +'+(lv+1)+'！'); showForgeOverlay();
    };
    row.appendChild(btn); eSec.appendChild(row);
  });
  // 升华
  var asc = enchants.asc;
  if(asc){
    var ascLv = d.forge.enchantAsc||0, hasAsc = countMat(asc.material) >= asc.costs[0];
    var row3 = document.createElement('div');
    row3.style.cssText = 'display:flex;align-items:center;gap:4px;margin:3px 0;font-size:10px;padding-top:6px;border-top:1px solid rgba(100,60,160,.2)';
    row3.innerHTML = '<span style="width:60px;color:#ffcc88">🌟 升华</span><span style="color:#ffa502;width:20px">'+ascLv+'/1</span><span style="color:#667;flex:1;font-size:9px">⚜️ 魔塔印记×5</span>';
    var btn3 = document.createElement('button');
    btn3.style.cssText = 'padding:3px 8px;font-size:10px;background:rgba(30,20,10,.8);border:1px solid #dda030;color:#ffcc88;border-radius:4px;cursor:pointer';
    btn3.textContent = ascLv>=1?'已升华':'升华';
    btn3.disabled = ascLv>=1||!hasAsc;
    btn3.onclick = function(){
      if(ascLv>=1||!hasAsc) return;
      consumeMat(asc.material, asc.costs[0]); d.forge.enchantAsc = 1;
      Game.saveMeta(); toast('🌟 升华成功！随机装备品质+1阶'); showForgeOverlay();
    };
    row3.appendChild(btn3); eSec.appendChild(row3);
  }
  content.appendChild(eSec);

  var closeBtn = document.createElement('button');
  closeBtn.className = 'restart-btn'; closeBtn.style.cssText = 'margin-top:10px;width:100%';
  closeBtn.textContent = '← 返回裂隙'; closeBtn.onclick = function(){ overlay.style.display = 'none'; };
  content.appendChild(closeBtn);
}

// ===== 天梯面板 =====
function showTowerOverlay() {
  var d = Game.meta.dungeon;
  var overlay = document.getElementById('rift-overlay');
  var content = document.getElementById('rift-overlay-content');
  if (!overlay || !content) return;
  overlay.style.display = 'flex'; content.innerHTML = '';

  var title = document.createElement('div');
  title.style.cssText = 'color:#c8a8ff;font-size:15px;font-weight:bold;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(100,60,160,.3)';
  title.textContent = '🏔️ 无尽天梯';
  content.appendChild(title);

  var stats = document.createElement('div');
  stats.style.cssText = 'padding:10px;background:rgba(10,8,18,.7);border:1px solid rgba(100,60,160,.25);border-radius:8px;margin-bottom:10px;font-size:12px;color:#8899bb;line-height:2';
  stats.innerHTML = '<div>🏆 最高层数: <b style="color:#ffa502">'+(d.tower.bestFloor||0)+'</b></div>'+
    '<div>📊 赛季最高: <b style="color:#c8a8ff">'+(d.tower.seasonFloor||0)+'</b></div>'+
    '<div>🔥 最大连击: <b style="color:#ff6644">'+(d.tower.maxCombo||0)+'</b></div>'+
    '<div style="margin-top:6px;font-size:10px;color:#667">每10层获得随机词缀 · 50层后每5层强制2词缀<br>死亡结算分数，冲分排名</div>';
  content.appendChild(stats);

  var startBtn = document.createElement('button');
  startBtn.className = 'modal-btn';
  startBtn.style.cssText = 'width:100%;padding:12px;font-size:14px;background:rgba(20,12,30,.9);border:1px solid #5a4080;color:#c8a8ff;border-radius:8px;cursor:pointer';
  startBtn.textContent = '⚔️ 挑战天梯';
  startBtn.onclick = function(){ overlay.style.display = 'none'; Events.emit(E.TOWER_START); };
  content.appendChild(startBtn);

  var closeBtn = document.createElement('button');
  closeBtn.className = 'restart-btn'; closeBtn.style.cssText = 'margin-top:8px;width:100%';
  closeBtn.textContent = '← 返回裂隙'; closeBtn.onclick = function(){ overlay.style.display = 'none'; };
  content.appendChild(closeBtn);
}

// ===== 主入口 =====
export function showDungeonHub() {
  switchScreen('dungeon-hub');
  var d = Game.meta.dungeon;
  if(!d){
    Game.meta.dungeon = {keys:0,keyFragments:0,totalCleared:0,bossMarks:{},clears:{},forge:{enchantAtk:0,enchantHp:0,enchantDef:0,enchantCrit:0,enchantPen:0,enchantVamp:0,refineAtk:0,refineHp:0,refineDef:0,runes:[]},tower:{bestScore:0,bestFloor:0,seasonScore:0,seasonFloor:0,combo:0,maxCombo:0}};
    d = Game.meta.dungeon;
  }
  renderHub(d);
}

function renderHub(d) {
  // 资源栏
  var res = document.getElementById('rift-resources');
  if (res) res.innerHTML = '🔑 裂隙钥匙: <b>'+(d.keys||0)+'</b> 把 · 碎片: <b>'+(d.keyFragments||0)+'</b>/10 · 已通关: <b>'+(d.totalCleared||0)+'</b>次';

  // 副本列表
  var list = document.getElementById('rift-dungeon-list');
  if (!list) return;
  list.innerHTML = '';
  var dungeons = R.get('dungeons');
  Object.values(dungeons).forEach(function(dg){
    var unlocked = dg.unlock==='initial'
      || (dg.unlock==='clear_normal'&&(Game.meta.achievements||[]).includes('clear_standard'))
      || (dg.unlock==='clear_hell'&&(Game.meta.achievements||[]).includes('clear_hell'))
      || (dg.unlock==='key_purchase'&&(d.keys||0)>0);
    var cleared = (d.clears||{})[dg.id]||0;
    var matCount = dg.material ? countMat(dg.material.id) : 0;

    var card = document.createElement('div');
    card.className = 'rift-dungeon-card' + (unlocked?'':' locked');
    card.innerHTML =
      '<div class="rift-dg-icon">'+dg.icon+'</div>'+
      '<div class="rift-dg-info"><div class="rift-dg-name">'+dg.name+'</div><div class="rift-dg-material">'+(dg.material?dg.material.icon+' '+dg.material.name+' ×'+matCount:'')+'</div></div>'+
      '<div class="rift-dg-meta"><div class="rift-dg-floors">'+dg.floors+'层</div>'+(unlocked?'<div class="rift-dg-clears">通关'+cleared+'次</div>':'<div class="rift-dg-lock">🔒 '+dg.unlockDesc+'</div>')+'</div>';
    if (unlocked) {
      card.onclick = function(){
        if((d.keys||0)<=0){ toast('🔒 需要裂隙钥匙！'); return; }
        d.keys--; Game.saveMeta();
        switchScreen('class-select'); // main.js监听DUNGEON_ENTER前需要先切屏
        Events.emit(E.DUNGEON_ENTER, { dungeonId: dg.id });
      };
    }
    list.appendChild(card);
  });

  // 钥匙兑换
  var buyRow = document.createElement('div');
  buyRow.style.cssText = 'margin-top:6px;display:flex;gap:4px';
  buyRow.innerHTML = '<button id="btn-buy-key" style="flex:1;padding:8px;font-size:11px;background:rgba(30,20,10,.8);border:1px solid #8a6030;color:#ffcc88;border-radius:6px;cursor:pointer">⚒️ 50锻石→1钥匙</button><button id="btn-fuse-key" style="flex:1;padding:8px;font-size:11px;background:rgba(20,16,40,.8);border:1px solid #5a4080;color:#c8a8ff;border-radius:6px;cursor:pointer">🔮 10碎片→1钥匙</button>';
  list.appendChild(buyRow);
  document.getElementById('btn-buy-key').onclick = function(){
    if((Game.meta.forgeStones||0)<50){ toast('锻造石不足50'); return; }
    Game.meta.forgeStones-=50; d.keys=(d.keys||0)+1; Game.saveMeta(); renderHub(d); toast('🔑 +1钥匙');
  };
  document.getElementById('btn-fuse-key').onclick = function(){
    if((d.keyFragments||0)<10){ toast('碎片不足10个'); return; }
    d.keyFragments-=10; d.keys=(d.keys||0)+1; Game.saveMeta(); renderHub(d); toast('🔑 合成1把钥匙');
  };

  // 右侧功能
  var side = document.getElementById('rift-side-cards');
  if (side) {
    side.innerHTML =
      '<div class="rift-func-btn forge" id="btn-rift-forge"><span class="btn-icon">⚒️</span>秘境锻造台</div>'+
      '<div class="rift-func-btn tower" id="btn-rift-tower"><span class="btn-icon">🏔️</span>无尽天梯</div>';
    document.getElementById('btn-rift-forge').onclick = showForgeOverlay;
    document.getElementById('btn-rift-tower').onclick = showTowerOverlay;
  }

  // Boss印记
  var marks = document.getElementById('rift-boss-marks');
  if (marks) {
    marks.innerHTML = '';
    Object.values(dungeons).forEach(function(dg){
      if (!dg.material) return;
      var earned = countMat(dg.material.id) > 0;
      var mark = document.createElement('span');
      mark.className = 'rift-boss-mark' + (earned?' earned':'');
      mark.title = dg.material.icon+' '+dg.material.name+(earned?' (已获得)':' (未获得)');
      mark.textContent = dg.icon;
      marks.appendChild(mark);
    });
  }
}
