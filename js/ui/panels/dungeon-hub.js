// ===================== v0.84 深渊裂隙 · 第二世界 =====================
import { Game } from '../../core/state.js';
import { R } from '../../core/registry.js';
import { E, Events } from '../../core/event-bus.js';
import { toast } from '../effects.js';
import { switchScreen } from '../screens.js';
import { showEquipDoll } from './equip-doll.js';
import { showEquipBag } from './equip-bag.js';

// ===== 材料 =====
function countMat(matId) { var d=Game.meta.dungeon; return d&&d.bossMarks?(d.bossMarks[matId]||0):0; }
function consumeMat(matId,n) { var d=Game.meta.dungeon; if(!d)return; if(!d.bossMarks)d.bossMarks={}; d.bossMarks[matId]=Math.max(0,(d.bossMarks[matId]||0)-n); }

// ===== 难度 =====
var DIFF=[{id:'normal',name:'普通',icon:'⚪',mult:1.0},{id:'hard',name:'困难',icon:'🟡',mult:1.5},{id:'nightmare',name:'噩梦',icon:'🔴',mult:2.5}];
var QS=['"材料带来了吗？"','"这矿石纯度不错……"','"再淬一次火就更好了。"','"赫菲斯托从不失手——嗯，很少失手。"'];
var QK=['"只有强者能通过……"','"你的极限远不止于此。"','"我曾见过无数勇者——你是特别的。"','"塔纳托斯从不低估任何一个挑战者。"'];
var QG=['"让我看看你的旅程……"','"每枚印记都是一段故事。"','"符文在低语，你听见了吗？"','"卡珊德拉记得每一位勇者的足迹。"'];

// ===== 裂隙角色基础属性（固定数值，不依赖职业） =====
var RIFT_BASE = { atk:18, maxHp:120, def:5, critRate:0.25, pen:0, lifeSteal:0 };

// ===== 裂隙战力（纯属性） =====
// 返回 {stats, breakdown} — breakdown 显示各来源贡献，便于调试
function riftStats(){
  var cs=RIFT_BASE;
  var s={atk:cs.atk||0,maxHp:cs.maxHp||0,def:cs.def||0,critRate:cs.critRate||0,pen:cs.pen||0,lifeSteal:cs.lifeSteal||0};
  var br={base:{atk:s.atk,maxHp:s.maxHp,def:s.def,critRate:s.critRate},equip:{atk:0,maxHp:0,def:0,critRate:0},talent:{atk:0,maxHp:0,def:0,critRate:0,pen:0,lifeSteal:0},forge:{atk:0,maxHp:0,def:0,critRate:0,pen:0,lifeSteal:0}};
  // 天赋树加成（复用 state.js 统一计算，与战斗 applyRiftBonuses 一致；不用floor防取整吞掉小基数加成）
  var tb = (Game.getTalentBonuses) ? Game.getTalentBonuses() : {};
  if (tb.atkMul) { var a0=s.atk; s.atk = s.atk * (1 + tb.atkMul); br.talent.atk += s.atk - a0; }
  if (tb.hpMul) { var h0=s.maxHp; s.maxHp = s.maxHp * (1 + tb.hpMul); br.talent.maxHp += s.maxHp - h0; }
  if (tb.defMul) { var d0=s.def; s.def = s.def * (1 + tb.defMul); br.talent.def += s.def - d0; }
  if (tb.critRate) { s.critRate += tb.critRate; br.talent.critRate += tb.critRate; }
  if (tb.pen) { s.pen = (s.pen||0) + tb.pen; br.talent.pen += tb.pen; }
  if (tb.lifeSteal) { s.lifeSteal = (s.lifeSteal||0) + tb.lifeSteal; br.talent.lifeSteal += tb.lifeSteal; }
  // 硬上限：只封「职业+天赋」（v0.85: 精炼/附魔/装备均在其后叠加，与战斗 applyRiftBonuses 一致）
  var ba=cs.atk||0,bh=cs.maxHp||0,bd=cs.def||0;
  s.atk=Math.min(s.atk,Math.floor(ba*1.40));s.maxHp=Math.min(s.maxHp,Math.floor(bh*1.50));s.def=Math.min(s.def,Math.floor(bd*1.35));
  s.critRate=Math.min(s.critRate,(cs.critRate||0)+0.30);s.pen=Math.min(s.pen||0,0.80);s.lifeSteal=Math.min(s.lifeSteal||0,0.40);
  // 精炼/附魔在硬上限之后叠加（核心养成，不受局外加成上限约束）
  var dg=Game.meta.dungeon;if(dg&&dg.forge){var f=dg.forge;
    if(f.enchantAtk){s.atk+=f.enchantAtk*8;br.forge.atk+=f.enchantAtk*8;}
    if(f.enchantHp){s.maxHp+=f.enchantHp*25;br.forge.maxHp+=f.enchantHp*25;}
    if(f.enchantDef){s.def+=f.enchantDef*4;br.forge.def+=f.enchantDef*4;}
    if(f.enchantCrit){s.critRate+=f.enchantCrit*0.03;br.forge.critRate+=f.enchantCrit*0.03;}
    if(f.enchantPen){s.pen=(s.pen||0)+f.enchantPen*0.05;br.forge.pen+=f.enchantPen*0.05;}
    if(f.enchantVamp){s.lifeSteal=(s.lifeSteal||0)+f.enchantVamp*0.04;br.forge.lifeSteal+=f.enchantVamp*0.04;}
    if(f.refineAtk){s.atk+=f.refineAtk;br.forge.atk+=f.refineAtk;}
    if(f.refineHp){s.maxHp+=f.refineHp*5;br.forge.maxHp+=f.refineHp*5;}
    if(f.refineDef){s.def+=f.refineDef;br.forge.def+=f.refineDef;}
  }
  // 装备在硬上限之后叠加（无上限，同主世界战斗）
  var eq=Game.meta.outgameEquipped||{};
  Object.keys(eq).forEach(function(slot){
    var eqi=eq[slot];
    if(!eqi)return;
    var val=(eqi.val||0)+(eqi.extraVal||0);
    switch(eqi.stat){
      case 'atk':s.atk+=val;br.equip.atk+=val;break;
      case 'def':s.def+=val;br.equip.def+=val;break;
      case 'maxHp':s.maxHp+=val;br.equip.maxHp+=val;break;
      case 'critRate':s.critRate+=(val||0)/100;br.equip.critRate+=(val||0)/100;break;
      case 'dodge':break;
    }
    (eqi._effects||[]).forEach(function(fx){
      if(fx.key==='bonusAtk'){s.atk+=fx.val;br.equip.atk+=fx.val;}
      if(fx.key==='bonusDef'){s.def+=fx.val;br.equip.def+=fx.val;}
      if(fx.key==='bonusHp'){s.maxHp+=fx.val;br.equip.maxHp+=fx.val;}
      if(fx.key==='critRate'){s.critRate+=(fx.val||0)/100;br.equip.critRate+=(fx.val||0)/100;}
    });
  });
  s.rn=(dg&&dg.forge&&dg.forge.runes)?dg.forge.runes.length:0;
  s._br=br;
  return s;
}
function calcRiftPower(){var s=riftStats();return Math.floor(s.atk*15+s.maxHp+s.def*10+s.critRate*200+(s.pen||0)*150+(s.lifeSteal||0)*100+s.rn*25);}

// ===== 锻造台 =====
function showForgeOverlay(section){
  section=section||'refine';var d=Game.meta.dungeon;if(!d)return;var en=R.get('dungeonEnchants'),dg=R.get('dungeons');if(!en)return;
  var ov=document.getElementById('rift-overlay'),ct=document.getElementById('rift-overlay-content');if(!ov||!ct)return;
  ov.style.display='flex';ct.innerHTML='';
  var ti=document.createElement('div');ti.style.cssText='color:#ffcc88;font-size:15px;font-weight:bold;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(140,100,60,.3)';ti.textContent='👨‍🏭 老铁匠 · 裂隙工坊';ct.appendChild(ti);
  var tb=document.createElement('div');tb.style.cssText='display:flex;gap:4px;margin-bottom:10px';
  tb.innerHTML='<button style="flex:1;padding:6px;font-size:11px;background:'+(section==='refine'?'rgba(40,20,10,.9)':'rgba(10,8,18,.7)')+';border:1px solid '+(section==='refine'?'#8a6030':'#333')+';color:'+(section==='refine'?'#ffcc88':'#667')+';border-radius:6px;cursor:pointer">🔨 精炼</button><button style="flex:1;padding:6px;font-size:11px;background:'+(section==='enchant'?'rgba(20,16,40,.9)':'rgba(10,8,18,.7)')+';border:1px solid '+(section==='enchant'?'#5a4080':'#333')+';color:'+(section==='enchant'?'#c8a8ff':'#667')+';border-radius:6px;cursor:pointer">✨ 附魔</button>';
  tb.children[0].onclick=function(){showForgeOverlay('refine');};tb.children[1].onclick=function(){showForgeOverlay('enchant');};ct.appendChild(tb);
  if(section==='refine'){var rs=document.createElement('div');
    // v0.85: 显示每级加成（生命每级+5，攻防每级+1）
    rs.innerHTML='<div style="color:#667;font-size:10px;margin-bottom:8px">攻击每级+1 · 生命每级+5 · 防御每级+1</div>';
    [{key:'refineAtk',name:'攻击',icon:'⚔️'},{key:'refineHp',name:'生命',icon:'❤️'},{key:'refineDef',name:'防御',icon:'🛡️'}].forEach(function(st){var lv=d.forge[st.key]||0,cost=20+lv*10,rate=lv<3?100:(lv<6?75:50);
      var rw=document.createElement('div');rw.style.cssText='display:flex;align-items:center;gap:6px;margin:3px 0;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:10px';
      var perLv = st.key==='refineHp' ? 5 : 1;
      rw.innerHTML='<span style="width:16px">'+st.icon+'</span><span style="width:28px;color:#ccc">'+st.name+'</span><span style="color:#ffa502;width:32px">+'+lv+'</span><span style="color:#667;flex:1">素材×'+cost+' 锻石×'+Math.floor(cost/2)+' | '+rate+'%</span><span style="color:#889;font-size:9px">+'+(lv*perLv)+'属性</span>';
      var bn=document.createElement('button');bn.style.cssText='padding:3px 10px;font-size:10px;background:rgba(40,20,10,.8);border:1px solid #8a6030;color:#ffcc88;border-radius:4px;cursor:pointer';bn.textContent='精炼';bn.disabled=(Game.meta.materials||0)<cost||(Game.meta.forgeStones||0)<Math.floor(cost/2);
      bn.onclick=function(){if((Game.meta.materials||0)<cost||(Game.meta.forgeStones||0)<Math.floor(cost/2))return;Game.meta.materials-=cost;Game.meta.forgeStones-=Math.floor(cost/2);
        if(Math.random()*100<rate){d.forge[st.key]=(d.forge[st.key]||0)+1;toast('✅ '+st.name+'精炼成功！+'+d.forge[st.key]+'级');}
        else{var pr=d.forge[st.key]||0;d.forge[st.key]=lv<6?Math.max(0,pr-1):0;toast(pr>0?'❌ 精炼失败！降为+'+d.forge[st.key]+'级':'❌ 精炼失败！归零');}Game.saveMeta();showForgeOverlay('refine');};rw.appendChild(bn);rs.appendChild(rw);});ct.appendChild(rs);
  }else{var es=document.createElement('div');es.innerHTML='<div style="color:#667;font-size:10px;margin-bottom:8px">消耗Boss材料提升属性 · 失败不降级</div>';
    Object.keys(en).forEach(function(key){if(key==='asc')return;var e=en[key],ek='enchant'+key.charAt(0).toUpperCase()+key.slice(1),lv=d.forge[ek]||0,mx=e.max||5,cost=e.costs[Math.min(lv,e.costs.length-1)],mn='';
      Object.values(dg||{}).forEach(function(dd){if(dd.material&&dd.material.id===e.material)mn=dd.material.icon+' '+dd.material.name;});var hm=countMat(e.material)>=cost;
      var rw=document.createElement('div');rw.style.cssText='display:flex;align-items:center;gap:4px;margin:3px 0;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:10px';
      rw.innerHTML='<span style="width:56px;color:#ccc">'+e.name+'</span><span style="color:#ffa502;width:24px">+'+lv+'/'+mx+'</span><span style="color:#667;flex:1;font-size:9px">'+mn+'×'+cost+'</span>';
      var bn=document.createElement('button');bn.style.cssText='padding:3px 8px;font-size:10px;background:rgba(20,16,40,.8);border:1px solid #5a4080;color:#c8a8ff;border-radius:4px;cursor:pointer';bn.textContent=lv>=mx?'满级':'附魔';bn.disabled=lv>=mx||!hm;
      bn.onclick=function(){if(lv>=mx||!hm)return;consumeMat(e.material,cost);d.forge[ek]=(d.forge[ek]||0)+1;Game.saveMeta();toast('✨ '+e.name+'附魔 +'+(lv+1)+'！');showForgeOverlay('enchant');};rw.appendChild(bn);es.appendChild(rw);});
    var asc=en.asc;if(asc){var al=d.forge.enchantAsc||0,ha=countMat(asc.material)>=asc.costs[0];
      var r3=document.createElement('div');r3.style.cssText='display:flex;align-items:center;gap:4px;margin:3px 0;font-size:10px;padding-top:6px;border-top:1px solid rgba(100,60,160,.2)';
      r3.innerHTML='<span style="width:56px;color:#ffcc88">🌟 升华</span><span style="color:#ffa502;width:24px">'+al+'/1</span><span style="color:#667;flex:1;font-size:9px">⚜️ 魔塔印记×5</span>';
      var b3=document.createElement('button');b3.style.cssText='padding:3px 8px;font-size:10px;background:rgba(30,20,10,.8);border:1px solid #dda030;color:#ffcc88;border-radius:4px;cursor:pointer';b3.textContent=al>=1?'已升华':'升华';b3.disabled=al>=1||!ha;
      b3.onclick=function(){if(al>=1||!ha)return;consumeMat(asc.material,asc.costs[0]);d.forge.enchantAsc=1;Game.saveMeta();toast('🌟 升华成功！');showForgeOverlay('enchant');};r3.appendChild(b3);es.appendChild(r3);}ct.appendChild(es);}
  var cb=document.createElement('button');cb.className='restart-btn';cb.style.cssText='margin-top:10px;width:100%';cb.textContent='← 返回裂隙';cb.onclick=function(){ov.style.display='none';renderHub();};ct.appendChild(cb);
}

// ===== 天梯 =====
function showTowerOverlay(){var d=Game.meta.dungeon,ov=document.getElementById('rift-overlay'),ct=document.getElementById('rift-overlay-content');if(!ov||!ct)return;ov.style.display='flex';ct.innerHTML='';
  var ti=document.createElement('div');ti.style.cssText='color:#c8a8ff;font-size:15px;font-weight:bold;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(100,60,160,.3)';ti.textContent='🗿 守门人 · 无尽天梯';ct.appendChild(ti);
  var st=document.createElement('div');st.style.cssText='padding:10px;background:rgba(10,8,18,.7);border:1px solid rgba(100,60,160,.25);border-radius:8px;margin-bottom:10px;font-size:12px;color:#8899bb;line-height:2';
  st.innerHTML='<div>🏆 最高层数: <b style="color:#ffa502">'+(d.tower.bestFloor||0)+'</b></div><div>📊 赛季最高: <b style="color:#c8a8ff">'+(d.tower.seasonFloor||0)+'</b></div><div style="margin-top:6px;font-size:10px;color:#667">每10层获得命运转盘 · 怪物获得新词缀</div>';ct.appendChild(st);
  var sb=document.createElement('button');sb.className='modal-btn';sb.style.cssText='width:100%;padding:12px;font-size:14px;background:rgba(20,12,30,.9);border:1px solid #5a4080;color:#c8a8ff;border-radius:8px;cursor:pointer';sb.textContent='⚔️ 挑战天梯';sb.onclick=function(){ov.style.display='none';showSkillPick(null,null,null,'tower');};ct.appendChild(sb);
  var cb=document.createElement('button');cb.className='restart-btn';cb.style.cssText='margin-top:8px;width:100%';cb.textContent='← 返回裂隙';cb.onclick=function(){ov.style.display='none';renderHub();};ct.appendChild(cb);
}

// ===== 命运转盘 =====
var WP=[{name:'裂隙钥匙',icon:'🔑',qty:1,prob:0.125,id:'key'},{name:'锻造石',icon:'💎',qty:10,prob:0.25,id:'forge_stone'},{name:'通用素材',icon:'📦',qty:5,prob:0.25,id:'material'},{name:'随机Boss材料',icon:'🛡️',qty:1,prob:0.125,id:'boss_mat'},{name:'魂晶',icon:'💀',qty:20,prob:0.125,id:'soul'},{name:'随机符文',icon:'💠',qty:1,prob:0.0625,id:'rune'},{name:'双倍钥匙(下次)',icon:'⚡',qty:1,prob:0.03125,id:'double_key'},{name:'稀有升华材料',icon:'🌟',qty:1,prob:0.03125,id:'asc_mat'}];
function showFateWheel(){var d=Game.meta.dungeon;if(!d)return;if(!d._wheelSpins)d._wheelSpins=0;var ov=document.getElementById('rift-overlay'),ct=document.getElementById('rift-overlay-content');if(!ov||!ct)return;ov.style.display='flex';ct.innerHTML='';
  var ti=document.createElement('div');ti.style.cssText='color:#ffcc88;font-size:16px;font-weight:bold;margin-bottom:8px;text-align:center';ti.textContent='🎰 命运转盘';ct.appendChild(ti);
  var inf=document.createElement('div');inf.style.cssText='color:#889;font-size:10px;text-align:center;margin-bottom:10px';inf.textContent='可用: '+(d._wheelSpins||0)+'次 | 每10层天梯+1次';ct.appendChild(inf);
  var wh=document.createElement('div');wh.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:10px 0';
  WP.forEach(function(p,i){var sl=document.createElement('div');sl.className='wheel-slot';sl.id='wheel-slot-'+i;sl.style.cssText='padding:8px;text-align:center;background:rgba(10,8,18,.8);border:1px solid rgba(80,40,130,.3);border-radius:6px;font-size:11px;color:#ccc;transition:all .15s';sl.innerHTML=p.icon+' '+p.name+'<br><span style="font-size:9px;color:#667">×'+p.qty+'</span>';wh.appendChild(sl);});ct.appendChild(wh);
  var rd=document.createElement('div');rd.id='wheel-result';rd.style.cssText='text-align:center;font-size:13px;color:#ffa502;min-height:20px;margin:8px 0';ct.appendChild(rd);
  var sb=document.createElement('button');sb.style.cssText='width:100%;padding:12px;font-size:14px;background:rgba(30,20,10,.9);border:1px solid #dda030;color:#ffcc88;border-radius:8px;cursor:pointer;margin-bottom:6px';sb.textContent='🎰 转动转盘 ('+(d._wheelSpins||0)+'次)';sb.disabled=(d._wheelSpins||0)<=0;
  sb.onclick=function(){if((d._wheelSpins||0)<=0)return;d._wheelSpins--;sb.textContent='🎰 转动转盘 ('+d._wheelSpins+'次)';sb.disabled=d._wheelSpins<=0;
    var sls=document.querySelectorAll('.wheel-slot'),roll=Math.random(),cum=0,ti2=0;for(var pi=0;pi<WP.length;pi++){cum+=WP[pi].prob;if(roll<=cum){ti2=pi;break;}}
    var sc=0,ci=0,ts=10+ti2;function tk(){sls.forEach(function(s){s.style.borderColor='rgba(80,40,130,.3)';s.style.background='rgba(10,8,18,.8)';});sls[ci].style.borderColor='#ffa502';sls[ci].style.background='rgba(30,20,10,.9)';ci=(ci+1)%8;sc++;if(sc<ts){setTimeout(tk,80+sc*15);}else{var pz=WP[ti2];awardWheelPrize(pz);rd.innerHTML='<span style="color:#ffd700;font-weight:bold">🎉 获得: '+pz.icon+' '+pz.name+' ×'+pz.qty+'!</span>';Game.saveMeta();setTimeout(function(){showFateWheel();},1500);}}tk();};ct.appendChild(sb);
  var ts2=new Date().toDateString(),au=d._lastAdWheel===ts2,ab=document.createElement('button');ab.style.cssText='width:100%;padding:8px;font-size:11px;background:rgba(20,16,40,.8);border:1px solid #5a4080;color:#888;border-radius:6px;cursor:pointer';ab.textContent=au?'📺 广告转盘 (今日已用)':'📺 观看广告 · 免费转1次';ab.disabled=au;
  ab.onclick=function(){
    // v0.85: 修复免费转盘 — 必须消耗广告次数
    if(!Game.watchAd()){toast('广告不可用（今日次数已用完）');return;}
    d._lastAdWheel=ts2;d._wheelSpins=(d._wheelSpins||0)+1;Game.saveMeta();document.getElementById('wheel-result').textContent='📺 +1次转盘机会！';showFateWheel();
  };ct.appendChild(ab);
  var cb=document.createElement('button');cb.className='restart-btn';cb.style.cssText='margin-top:8px;width:100%';cb.textContent='← 返回裂隙';cb.onclick=function(){ov.style.display='none';renderHub();};ct.appendChild(cb);
}
function awardWheelPrize(p){var d=Game.meta.dungeon;switch(p.id){case'key':d.keys=(d.keys||0)+p.qty;break;case'forge_stone':Game.meta.forgeStones=(Game.meta.forgeStones||0)+p.qty;break;case'material':Game.meta.materials=(Game.meta.materials||0)+p.qty;break;case'boss_mat':{var dgs=R.get('dungeons'),ks=Object.keys(dgs||{}),r=dgs[ks[Math.floor(Math.random()*ks.length)]];if(r&&r.material){d.bossMarks[r.material.id]=(d.bossMarks[r.material.id]||0)+1;}break;}case'soul':Game.meta.souls=(Game.meta.souls||0)+p.qty;break;case'rune':{var rns=R.get('dungeonRunes')||[],uo=rns.filter(function(r){return(d.forge.runes||[]).indexOf(r.id)<0;});if(uo.length>0){if(!d.forge.runes)d.forge.runes=[];d.forge.runes.push(uo[Math.floor(Math.random()*uo.length)].id);}break;}case'double_key':d._nextDoubleKey=true;break;case'asc_mat':{var dg2=R.get('dungeons'),td=dg2&&dg2.tower;if(td&&td.material){d.bossMarks[td.material.id]=(d.bossMarks[td.material.id]||0)+1;}break;}}
}

// ===== 结算面板 =====
function showSettlementOverlay(d){var se=d._pendingSettlement;if(!se)return;d._pendingSettlement=null;Game.saveMeta(); // v0.85: 清空后保存防存档残留重复弹
  var dgs=R.get('dungeons'),dg2=dgs&&dgs[se.dungeonId],ov=document.getElementById('rift-overlay'),ct=document.getElementById('rift-overlay-content');if(!ov||!ct)return;
  ov.style.display='flex';ct.innerHTML='';var ti=document.createElement('div');ti.style.cssText='color:#ffcc88;font-size:16px;font-weight:bold;text-align:center;margin-bottom:8px';ti.textContent='⛏️ '+(dg2?dg2.name:'副本')+' · '+(se.difficultyName||'')+' 通关！';ct.appendChild(ti);
  if(se.surge){var st=document.createElement('div');st.style.cssText='color:#0ff;font-size:11px;text-align:center;margin-bottom:8px';st.textContent='🌊 深渊涌动 · 双倍掉落！';ct.appendChild(st);}
  var it=document.createElement('div');it.style.cssText='background:rgba(10,8,18,.8);border:1px solid rgba(80,40,130,.3);border-radius:8px;padding:10px;margin:10px 0;line-height:1.8';
  it.innerHTML=(dg2&&dg2.material?'<div style="color:#c0a0f0;font-size:12px">'+dg2.material.icon+' '+dg2.material.name+' ×'+se.bossMats+'</div>':'')+'<div style="color:#ccc;font-size:12px">🔑 钥匙 +'+(se.keys||0)+'</div><div style="color:#ccc;font-size:12px">💎 锻造石 +'+(se.forgeStones||0)+'</div><div style="color:#ccc;font-size:12px">📦 通用素材 +'+(se.materials||0)+'</div>'+(se.rune?'<div style="color:#d0c0f0;font-size:12px">💠 符文: '+se.rune+'</div>':'');ct.appendChild(it);
  var op=se.oldPower||0,np=calcRiftPower(),pd=document.createElement('div');pd.style.cssText='text-align:center;font-size:13px;font-weight:bold;margin:8px 0;padding:6px;background:rgba(255,215,0,.08);border-radius:6px';
  if(np!==op){var df2=np-op;pd.innerHTML='⚡ 裂隙战力: <span style="color:#ffd700">'+op.toLocaleString()+' → '+np.toLocaleString()+'</span> <span style="color:'+(df2>=0?'#5a5':'#f66')+'">('+(df2>=0?'+':'')+df2+')</span>';}else{pd.innerHTML='⚡ 裂隙战力: <span style="color:#ffd700">'+np.toLocaleString()+'</span>';}ct.appendChild(pd);
  var cb=document.createElement('button');cb.style.cssText='width:100%;padding:12px;font-size:14px;background:rgba(30,20,10,.9);border:1px solid #dda030;color:#ffcc88;border-radius:8px;cursor:pointer;margin-top:8px';cb.textContent='返回裂隙';cb.onclick=function(){ov.style.display='none';renderHub();};ct.appendChild(cb);
}

// ===== 秘境之门 → 副本选择 =====
function showDungeonSelect(){var ov=document.getElementById('rift-overlay'),ct=document.getElementById('rift-overlay-content');if(!ov||!ct)return;ov.style.display='flex';ct.innerHTML='';
  var ti=document.createElement('div');ti.style.cssText='color:#c8a8ff;font-size:16px;font-weight:bold;margin-bottom:4px;text-align:center';ti.textContent='🌑 秘境之门';ct.appendChild(ti);
  var su=document.createElement('div');su.style.cssText='color:#556;font-size:10px;text-align:center;margin-bottom:10px';su.textContent='选择副本与难度 · 消耗1把裂隙钥匙';ct.appendChild(su);
  var d=Game.meta.dungeon,dgs=R.get('dungeons'),en=R.get('dungeonEnchants'),ts2=new Date().toDateString(),si=0;
  for(var i=0;i<ts2.length;i++)si=(si*31+ts2.charCodeAt(i))%7;var dks=Object.keys(dgs||{}),srg=dks[si]||'plains',dfk=(Game.meta._lastDungeonBonus!==ts2);
  Object.values(dgs).forEach(function(dg){var mc=dg.material?countMat(dg.material.id):0,isS=(dg.id===srg),eh='';
    if(dg.material&&en){for(var ek in en){if(ek==='asc')continue;var e=en[ek];if(e.material===dg.material.id){var eKy='enchant'+ek.charAt(0).toUpperCase()+ek.slice(1),elv=(d.forge||{})[eKy]||0,mx=e.max||5;
          if(elv>=mx){eh='<span style="color:#5a5;font-size:10px">✓ '+e.name+'已满级</span>';}else{var nd=e.costs[Math.min(elv,e.costs.length-1)],df3=nd-mc;eh='<span style="color:#ffa502;font-size:10px">'+e.name+' Lv'+elv+'→'+(elv+1)+' 需'+nd+(df3>0?' 差'+df3+' ⚠':' ✓')+'</span>';}break;}}}
    var cd=document.createElement('div');cd.style.cssText='margin-bottom:8px;padding:10px;background:rgba(10,8,18,.8);border:1px solid '+(isS?'rgba(0,200,200,.4)':'rgba(80,40,130,.2)')+';border-radius:8px';
    cd.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:22px">'+dg.icon+'</span><div style="flex:1"><div style="color:#d0c0f0;font-weight:bold;font-size:13px">'+dg.name+(isS?' <span style="color:#0ff;font-size:10px">🌊涌动</span>':'')+'</div><div style="color:#667;font-size:10px">'+(dg.material?dg.material.icon+' '+dg.material.name+' ×'+mc:'')+'</div></div></div>'+(eh?'<div style="margin-bottom:4px">'+eh+'</div>':'')+'<div style="display:flex;gap:4px" id="diff-btns-'+dg.id+'"></div>';ct.appendChild(cd);
    var dr=cd.querySelector('#diff-btns-'+dg.id);DIFF.forEach(function(df){var bn=document.createElement('button');bn.style.cssText='flex:1;padding:6px 4px;font-size:10px;background:rgba(10,8,18,.8);border:1px solid rgba(80,40,130,.3);color:#ccc;border-radius:4px;cursor:pointer';bn.innerHTML=df.icon+' '+df.name+'<br><span style="font-size:8px;color:#556">×'+df.mult.toFixed(1)+'</span>';
      bn.onclick=function(){if((d.keys||0)<=0){toast('🔒 需要裂隙钥匙！');return;}ov.style.display='none';d.keys--;Game.saveMeta();showSkillPick(dg.id,df,isS);};dr.appendChild(bn);});
  });
  var br=document.createElement('div');br.style.cssText='margin-top:8px;display:flex;gap:4px';br.innerHTML='<button id="btn-buy-key" style="flex:1;padding:8px;font-size:11px;background:rgba(30,20,10,.8);border:1px solid #8a6030;color:#ffcc88;border-radius:6px;cursor:pointer">⚒️ 50锻石→1钥匙</button><button id="btn-fuse-key" style="flex:1;padding:8px;font-size:11px;background:rgba(20,16,40,.8);border:1px solid #5a4080;color:#c8a8ff;border-radius:6px;cursor:pointer">🔮 10碎片→1钥匙</button>';ct.appendChild(br);
  document.getElementById('btn-buy-key').onclick=function(){if((Game.meta.forgeStones||0)<50){toast('锻造石不足50');return;}Game.meta.forgeStones-=50;d.keys=(d.keys||0)+1;Game.saveMeta();showDungeonSelect();toast('🔑 +1钥匙');};
  document.getElementById('btn-fuse-key').onclick=function(){if((d.keyFragments||0)<10){toast('碎片不足10个');return;}d.keyFragments-=10;d.keys=(d.keys||0)+1;Game.saveMeta();showDungeonSelect();toast('🔑 合成1把钥匙');};
  var cb=document.createElement('button');cb.className='restart-btn';cb.style.cssText='margin-top:8px;width:100%';cb.textContent='← 返回裂隙';cb.onclick=function(){ov.style.display='none';};ct.appendChild(cb);
}
// ===== 技能选择（多选3，从主城打造的技能中选） =====
function showSkillPick(did,df,isS,target){
  target = target || 'dungeon';
  var ov=document.getElementById('rift-overlay'),ct=document.getElementById('rift-overlay-content');
  if(!ov||!ct)return;
  var synth=Game.meta.synthSkills||[];
  ov.style.display='flex';ct.innerHTML='';
  var ti=document.createElement('div');ti.style.cssText='color:#ffcc88;font-size:16px;font-weight:bold;margin-bottom:4px;text-align:center';ti.textContent='📜 选择技能';ct.appendChild(ti);
  var su=document.createElement('div');su.style.cssText='color:#556;font-size:10px;text-align:center;margin-bottom:10px';su.textContent='从主城打造的技能中选择，最多3个 · 选完直接'+(target==='tower'?'爬塔':'开战');ct.appendChild(su);
  if(synth.length===0){
    var emp=document.createElement('div');emp.style.cssText='color:#556;font-size:11px;text-align:center;padding:16px;background:rgba(10,8,18,.7);border-radius:8px;margin-bottom:10px';
    emp.innerHTML='还没有打造技能<br><span style="font-size:10px;color:#445">前往主城·铭文师·技能工坊打造后，即可带入裂隙</span>';ct.appendChild(emp);
  }
  var picked=[];
  var status=document.createElement('div');status.style.cssText='color:#ffa502;font-size:11px;text-align:center;margin-bottom:8px';status.textContent='已选 0/3';ct.appendChild(status);
  synth.forEach(function(sk){
    var card=document.createElement('div');card.style.cssText='display:flex;align-items:center;gap:8px;padding:10px;margin:4px 0;background:rgba(10,8,18,.8);border:1px solid rgba(80,40,130,.3);border-radius:8px;cursor:pointer;transition:all .15s';
    card.innerHTML='<span style="font-size:22px">'+(sk.icon||'📜')+'</span><div style="flex:1"><div style="color:#d0c0f0;font-size:12px;font-weight:bold">'+sk.name+'</div><div style="color:#667;font-size:10px">'+(sk.desc||'')+'</div></div><span class="sk-check" style="color:#5a5;font-size:14px">✓</span>';
    var chk=card.querySelector('.sk-check');chk.style.opacity='0';
    card.onclick=function(){
      var idx=picked.indexOf(sk.id);
      if(idx>=0){picked.splice(idx,1);chk.style.opacity='0';card.style.borderColor='rgba(80,40,130,.3)';}
      else if(picked.length<3){picked.push(sk.id);chk.style.opacity='1';card.style.borderColor='rgba(140,100,220,.6)';}
      else{toast('最多选择3个技能');return;}
      status.textContent='已选 '+picked.length+'/3';
    };
    ct.appendChild(card);
  });
  var goBtn=document.createElement('button');goBtn.style.cssText='width:100%;padding:12px;font-size:14px;background:rgba(30,20,10,.9);border:1px solid #dda030;color:#ffcc88;border-radius:8px;cursor:pointer;margin-top:8px';
  goBtn.textContent=target==='tower'?'🏔️ 挑战天梯':'⚔️ 出战';
  goBtn.onclick=function(){
    ov.style.display='none';
    if (target === 'tower') { Events.emit(E.TOWER_START, { skillIds: picked }); }
    else { startDungeon(did,df,isS,picked); }
  };
  ct.appendChild(goBtn);
  var cb=document.createElement('button');cb.className='restart-btn';cb.style.cssText='margin-top:8px;width:100%';cb.textContent='← 返回裂隙';
  cb.onclick=function(){
    // v0.85: 返回退还已扣的钥匙（副本路径）
    if (target !== 'tower') { var dd=Game.meta.dungeon; dd.keys=(dd.keys||0)+1; Game.saveMeta(); toast('🔑 钥匙已退还'); }
    ov.style.display='none';renderHub();
  };
  ct.appendChild(cb);
}

function startDungeon(did,df,isS,skillIds){
  var d=Game.meta.dungeon;
  d._lastDifficulty=df;d._lastSurge=isS;d._lastSkillIds=skillIds||[];
  Events.emit(E.DUNGEON_ENTER,{dungeonId:did,difficulty:df.id,surge:isS,diffObj:df,skillIds:skillIds||[]});
}

// ===== 符文面板（旅法师） =====
function showRuneOverlay(){var d=Game.meta.dungeon,ov=document.getElementById('rift-overlay'),ct=document.getElementById('rift-overlay-content');if(!ov||!ct)return;ov.style.display='flex';ct.innerHTML='';
  var ti=document.createElement('div');ti.style.cssText='color:#c8a8ff;font-size:15px;font-weight:bold;margin-bottom:4px;padding-bottom:6px;border-bottom:1px solid rgba(100,60,160,.3)';ti.textContent='📜 旅法师 · 符文低语';ct.appendChild(ti);
  var hn=document.createElement('div');hn.style.cssText='color:#556;font-size:10px;margin-bottom:10px';hn.textContent='符文在裂隙中自动生效 · 已激活: '+((d.forge||{}).runes||[]).length+' / '+(R.get('dungeonRunes')||[]).length;ct.appendChild(hn);
  var rns=R.get('dungeonRunes')||[],ow=(d.forge||{}).runes||[];rns.forEach(function(r){var hs=ow.indexOf(r.id)>=0,rw=document.createElement('div');
    rw.style.cssText='display:flex;align-items:center;gap:8px;padding:8px;margin:4px 0;background:rgba(10,8,18,.7);border:1px solid '+(hs?'rgba(140,100,220,.4)':'rgba(30,20,40,.3)')+';border-radius:6px;opacity:'+(hs?'1':'0.5');
    rw.innerHTML='<span style="font-size:22px">'+r.icon+'</span><div style="flex:1"><div style="color:'+(hs?'#d0c0f0':'#555')+';font-size:12px;font-weight:bold">'+r.name+'</div><div style="color:#667;font-size:10px">'+r.desc+'</div></div>'+(hs?'<span style="color:#5a5;font-size:10px">✓ 已激活</span>':'<span style="color:#444;font-size:10px">未获得</span>');ct.appendChild(rw);});
  var cb=document.createElement('button');cb.className='restart-btn';cb.style.cssText='margin-top:10px;width:100%';cb.textContent='← 返回裂隙';cb.onclick=function(){ov.style.display='none';renderHub();};ct.appendChild(cb);
}

// ===== 天梯结算面板 =====
function showTowerSettlementOverlay(d){
  var se=d._pendingTowerSettlement;
  if(!se)return;
  d._pendingTowerSettlement=null;
  Game.saveMeta(); // v0.85: 清空后保存 — 防存档残留导致每次重进都弹
  var ov=document.getElementById('rift-overlay'),ct=document.getElementById('rift-overlay-content');
  if(!ov||!ct)return;
  ov.style.display='flex';ct.innerHTML='';
  var ti=document.createElement('div');ti.style.cssText='color:#c8a8ff;font-size:16px;font-weight:bold;text-align:center;margin-bottom:4px';ti.textContent='🏔️ 无尽天梯 · 结算';ct.appendChild(ti);
  var su=document.createElement('div');su.style.cssText='color:#556;font-size:10px;text-align:center;margin-bottom:10px';su.textContent='守门人·塔纳托斯审视着你的战绩';ct.appendChild(su);
  var box=document.createElement('div');box.style.cssText='background:rgba(10,8,18,.8);border:1px solid rgba(80,40,130,.3);border-radius:8px;padding:12px;margin:10px 0;line-height:2.2;text-align:center';
  box.innerHTML='<div style="font-size:28px">🗿</div>'+
    '<div>🏆 最高层数: <b style="color:#ffd700;font-size:16px">'+se.floor+'</b> 层</div>'+
    '<div>💀 击败敌人: <b style="color:#c8a8ff">'+se.kills+'</b> 个</div>'+
    (se.spins>0?'<div>🎰 命运转盘 <b style="color:#ffa502">+'+se.spins+'</b> 次（每10层里程碑）</div>':'')+
    (se.newBest?'<div style="color:#89e894;font-size:11px">✨ 新纪录！</div>':'');
  ct.appendChild(box);
  var cb=document.createElement('button');cb.style.cssText='width:100%;padding:12px;font-size:14px;background:rgba(20,12,30,.9);border:1px solid #5a4080;color:#c8a8ff;border-radius:8px;cursor:pointer;margin-top:8px';
  cb.textContent='返回裂隙';cb.onclick=function(){ov.style.display='none';renderHub();};ct.appendChild(cb);
}

// ===== 副本死亡结算面板（v0.85：像天梯一样的小弹窗） =====
function showDungeonDeathOverlay(d){
  var se=d._pendingDeathSettlement;
  if(!se)return;
  d._pendingDeathSettlement=null;
  Game.saveMeta(); // v0.85: 清空后保存防存档残留重复弹
  var dgs=R.get('dungeons'),dg2=dgs&&dgs[se.dungeonId];
  var ov=document.getElementById('rift-overlay'),ct=document.getElementById('rift-overlay-content');
  if(!ov||!ct)return;
  ov.style.display='flex';ct.innerHTML='';
  var ti=document.createElement('div');ti.style.cssText='color:#ff6644;font-size:16px;font-weight:bold;text-align:center;margin-bottom:4px';ti.textContent='💀 副本战死';ct.appendChild(ti);
  var su=document.createElement('div');su.style.cssText='color:#556;font-size:10px;text-align:center;margin-bottom:10px';su.textContent='深渊吞没了你的身影……';ct.appendChild(su);
  var box=document.createElement('div');box.style.cssText='background:rgba(18,8,8,.8);border:1px solid rgba(200,60,60,.3);border-radius:8px;padding:12px;margin:10px 0;line-height:2.2;text-align:center';
  box.innerHTML='<div style="font-size:28px">⛏️</div>'+
    '<div>📍 '+(dg2?dg2.name:'副本')+' · <b style="color:#ffcc88">'+se.difficultyName+'</b></div>'+
    '<div style="font-size:10px;color:#667">抵达第 <b style="color:#ffa502">'+se.floor+'</b> 层</div>'+
    '<div style="font-size:10px;color:#556">🔑 钥匙已消耗 · 掉落已消散</div>';
  ct.appendChild(box);
  var cb=document.createElement('button');cb.style.cssText='width:100%;padding:12px;font-size:14px;background:rgba(30,10,10,.9);border:1px solid #a04040;color:#ff8888;border-radius:8px;cursor:pointer;margin-top:8px';
  cb.textContent='返回裂隙';cb.onclick=function(){ov.style.display='none';renderHub();};ct.appendChild(cb);
}

// ===== 结算数据导出 =====
export function createSettlement(did,srg,kg,fsg,mg,bmg,rn){var d=Game.meta.dungeon,df=d._lastDifficulty||DIFF[0],op=calcRiftPower();d.totalCleared=(d.totalCleared||0)+1;
  d._pendingSettlement={dungeonId:did,difficultyName:df.name,surge:srg,oldPower:op,keys:kg,forgeStones:fsg,materials:mg,bossMats:bmg,rune:rn||null};Game.saveMeta();}

// 副本死亡结算数据
export function createDungeonDeath(dungeonId, floor){
  var d=Game.meta.dungeon;
  var df=d._lastDifficulty||DIFF[0];
  d._pendingDeathSettlement={dungeonId:dungeonId,difficultyName:df.name,floor:floor};
  Game.saveMeta();
}

// 天梯结算数据
export function createTowerSettlement(floor, kills, spins, newBest){
  var d=Game.meta.dungeon;
  d._pendingTowerSettlement={floor:floor,kills:kills,spins:spins,newBest:newBest};
  Game.saveMeta();
}

// ===== 主入口 =====
export function showDungeonHub(){switchScreen('dungeon-hub');var bb=document.getElementById('btn-rift-back');if(bb)bb.onclick=function(){switchScreen('start');};
  var d=Game.meta.dungeon;if(!d){Game.meta.dungeon={keys:0,keyFragments:0,totalCleared:0,bossMarks:{},clears:{},forge:{enchantAtk:0,enchantHp:0,enchantDef:0,enchantCrit:0,enchantPen:0,enchantVamp:0,refineAtk:0,refineHp:0,refineDef:0,runes:[]},tower:{bestScore:0,bestFloor:0,seasonScore:0,seasonFloor:0,combo:0,maxCombo:0}};d=Game.meta.dungeon;}
  var en2=document.getElementById('rift-entrance'),bd=document.querySelector('.rift-body');
  if(en2&&bd&&!sessionStorage.getItem('_riftVisited')){sessionStorage.setItem('_riftVisited','1');bd.classList.add('anim-hidden');renderHub();
    var pt=en2.querySelector('.rift-particles');if(pt){pt.innerHTML='';for(var i=0;i<30;i++){var p=document.createElement('div');p.className='rift-particle';var a=Math.random()*Math.PI*2,dd=40+Math.random()*160;p.style.setProperty('--px',Math.cos(a)*dd+'px');p.style.setProperty('--py',Math.sin(a)*dd+'px');p.style.animationDelay=(0.3+Math.random()*0.6)+'s';pt.appendChild(p);}}
    en2.style.display='flex';en2.classList.add('animating');setTimeout(function(){en2.classList.add('fadeout');setTimeout(function(){en2.style.display='none';en2.classList.remove('animating','fadeout');bd.classList.remove('anim-hidden');bd.classList.add('anim-show');if(d._pendingSettlement)showSettlementOverlay(d);else if(d._pendingTowerSettlement)showTowerSettlementOverlay(d);else if(d._pendingDeathSettlement)showDungeonDeathOverlay(d);},400);},1800);
  }else{renderHub();if(d._pendingSettlement)showSettlementOverlay(d);else if(d._pendingTowerSettlement)showTowerSettlementOverlay(d);else if(d._pendingDeathSettlement)showDungeonDeathOverlay(d);}
}

// ===== 渲染裂隙小镇 =====
function renderHub(){var d=Game.meta.dungeon,pw=calcRiftPower();
  var rs=document.getElementById('rift-resources');if(rs)rs.innerHTML='⚡ 裂隙战力: <b style="color:#ffd700;font-size:14px">'+pw.toLocaleString()+'</b> &nbsp;|&nbsp; 🔑 <b>'+(d.keys||0)+'</b> · 碎片 <b>'+(d.keyFragments||0)+'</b>/10 · 通关 <b>'+(d.totalCleared||0)+'</b>次 &nbsp; <button id="btn-rift-char" style="font-size:10px;padding:2px 6px;background:rgba(20,16,40,.6);border:1px solid #5a4080;color:#889;border-radius:4px;cursor:pointer">📋 角色</button> <button id="btn-rift-bag" style="font-size:10px;padding:2px 6px;background:rgba(20,16,40,.6);border:1px solid #5a4080;color:#889;border-radius:4px;cursor:pointer">🎒 背包</button>';
  var pt=document.getElementById('rift-portal');if(pt)pt.onclick=showDungeonSelect;
  var bc=document.getElementById('btn-rift-char');if(bc)bc.onclick=showRiftCharPanel;
  var bb2=document.getElementById('btn-rift-bag');if(bb2)bb2.onclick=function(){showEquipBag(null,null);};
  var sd=document.getElementById('rift-smith-dialogue');if(sd)sd.textContent=QS[Math.floor(Math.random()*QS.length)];
  var bf=document.getElementById('btn-rift-forge'),be2=document.getElementById('btn-rift-enchant');if(bf)bf.onclick=function(){showForgeOverlay('refine');};if(be2)be2.onclick=function(){showForgeOverlay('enchant');};
  var kd=document.getElementById('rift-keeper-dialogue');if(kd)kd.textContent=QK[Math.floor(Math.random()*QK.length)];
  var ki=document.getElementById('rift-keeper-info');if(ki){var tw=d.tower||{};ki.textContent='🏆 最高 '+ (tw.bestFloor||0) +'层 · 赛季 '+(tw.seasonFloor||0)+'层';}
  var bt=document.getElementById('btn-rift-tower'),bw=document.getElementById('btn-rift-wheel');if(bt)bt.onclick=showTowerOverlay;if(bw)bw.onclick=showFateWheel;
  var sgd=document.getElementById('rift-sage-dialogue');if(sgd)sgd.textContent=QG[Math.floor(Math.random()*QG.length)];
  var mk=document.getElementById('rift-boss-marks');if(mk){mk.innerHTML='';var dgs=R.get('dungeons');Object.values(dgs).forEach(function(dg){if(!dg.material)return;var e2=countMat(dg.material.id)>0;var m=document.createElement('span');m.className='rift-boss-mark'+(e2?' earned':'');m.title=dg.material.icon+' '+dg.material.name+(e2?' (已获得)':' (未获得)');m.textContent=dg.icon;mk.appendChild(m);});}
  var rd=document.getElementById('rift-runes-display');if(rd){rd.innerHTML='';var rns=R.get('dungeonRunes')||[],ow=(d.forge||{}).runes||[];rns.forEach(function(r){var o2=ow.indexOf(r.id)>=0;var rn=document.createElement('span');rn.className='rift-rune'+(o2?' owned':'');rn.title=r.name+(o2?' (已激活)':' (未获得)');rn.style.opacity=o2?'1':'0.3';rn.textContent=r.icon;rd.appendChild(rn);});
    var rb2=document.createElement('button');rb2.style.cssText='font-size:9px;padding:2px 6px;background:rgba(20,16,40,.6);border:1px solid #5a4080;color:#888;border-radius:4px;margin-left:4px;cursor:pointer';rb2.textContent='管理';rb2.onclick=function(){showRuneOverlay();};rd.appendChild(rb2);}
}

// 角色面板 = showEquipDoll（纸娃娃）
// 背包面板 = showEquipBag（装备背包）

// ===== 裂隙角色总属性面板 =====
function showRiftCharPanel(){var s=riftStats(),ov=document.getElementById('rift-overlay'),ct=document.getElementById('rift-overlay-content');if(!ov||!ct)return;ov.style.display='flex';ct.innerHTML='';
  var ti=document.createElement('div');ti.style.cssText='color:#ffcc88;font-size:15px;font-weight:bold;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(140,100,60,.3)';ti.textContent='📋 角色属性';ct.appendChild(ti);
  // 总属性
  var sec1=document.createElement('div');sec1.style.cssText='margin-bottom:10px;padding:8px;background:rgba(10,8,18,.7);border:1px solid rgba(80,40,130,.2);border-radius:8px';
  sec1.innerHTML='<div style="color:#7a6aaa;font-size:10px;font-weight:bold;margin-bottom:6px">📊 属性总览</div>';
  var stats=[{label:'攻击',val:Math.round(s.atk),icon:'⚔️'},{label:'生命',val:Math.round(s.maxHp),icon:'❤️'},{label:'防御',val:Math.round(s.def),icon:'🛡️'},{label:'暴击率',val:(s.critRate*100).toFixed(1)+'%',icon:'💥'},{label:'穿透',val:((s.pen||0)*100).toFixed(0)+'%',icon:'🗡️'},{label:'吸血',val:((s.lifeSteal||0)*100).toFixed(1)+'%',icon:'🩸'}];
  stats.forEach(function(st){var rw=document.createElement('div');rw.style.cssText='display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.02)';rw.innerHTML='<span style="width:16px;text-align:center">'+st.icon+'</span><span style="color:#667;font-size:10px;width:42px">'+st.label+'</span><span style="color:#ffcc88;font-weight:bold;font-size:12px">'+st.val+'</span>';sec1.appendChild(rw);});
  // 符文
  var runeRow=document.createElement('div');runeRow.style.cssText='display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.02)';runeRow.innerHTML='<span style="width:16px;text-align:center">💠</span><span style="color:#667;font-size:10px;width:42px">符文</span><span style="color:#c8a8ff;font-weight:bold;font-size:12px">'+s.rn+'个已激活</span>';sec1.appendChild(runeRow);
  ct.appendChild(sec1);
  // 来源分解
  var br=s._br||{};
  var sec2=document.createElement('div');sec2.style.cssText='margin-bottom:8px;padding:8px;background:rgba(10,8,18,.5);border:1px solid rgba(80,40,130,.15);border-radius:8px;font-size:9px;color:#556;line-height:1.7';
  var R2=function(n){return Math.round(n||0);};
  sec2.innerHTML='<div style="color:#7a6aaa;font-size:10px;font-weight:bold;margin-bottom:4px">🧩 属性来源</div>'+
    '⚔️ 攻击: 职业'+R2(br.base?br.base.atk:0)+' + 装备'+R2(br.equip?br.equip.atk:0)+' + 天赋'+R2(br.talent?br.talent.atk:0)+' + 精炼/附魔'+R2(br.forge?br.forge.atk:0)+'<br>'+
    '❤️ 生命: 职业'+R2(br.base?br.base.maxHp:0)+' + 装备'+R2(br.equip?br.equip.maxHp:0)+' + 天赋'+R2(br.talent?br.talent.maxHp:0)+' + 精炼/附魔'+R2(br.forge?br.forge.maxHp:0)+'<br>'+
    '🛡️ 防御: 职业'+R2(br.base?br.base.def:0)+' + 装备'+R2(br.equip?br.equip.def:0)+' + 天赋'+R2(br.talent?br.talent.def:0)+' + 精炼/附魔'+R2(br.forge?br.forge.def:0);
  ct.appendChild(sec2);
  // 战力
  var pw=calcRiftPower(),pd=document.createElement('div');pd.style.cssText='text-align:center;padding:8px;margin-bottom:8px;background:rgba(255,215,0,.06);border-radius:6px;color:#ffd700;font-size:13px;font-weight:bold';pd.textContent='⚡ 裂隙战力: '+pw.toLocaleString();ct.appendChild(pd);
  // 按钮：查看装备
  var eqBtn=document.createElement('button');eqBtn.style.cssText='width:100%;padding:10px;font-size:13px;background:rgba(20,16,40,.8);border:1px solid #5a4080;color:#c8a8ff;border-radius:8px;cursor:pointer;margin-bottom:8px';eqBtn.textContent='⚒️ 查看装备（纸娃娃）';eqBtn.onclick=function(){ov.style.display='none';showEquipDoll();};ct.appendChild(eqBtn);
  var cb=document.createElement('button');cb.className='restart-btn';cb.style.cssText='margin-top:4px;width:100%';cb.textContent='← 返回裂隙';cb.onclick=function(){ov.style.display='none';};ct.appendChild(cb);
}
