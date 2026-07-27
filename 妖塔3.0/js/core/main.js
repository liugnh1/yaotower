import { Game, onRender } from "./state.js";
import { initAudio, playSound } from "./audio.js";
import { RNG } from "./rng.js";
import * as Battle from "./battle.js";
import * as UI from "./ui.js";
import { CLASSES, TALENTS, ROOM_TEMPLATES, ZONES, SIMPLE_ROUTE, POTIONS, DIFFICULTIES, META_LIMITS, RARITY_COLOR } from "./config.js";
function genEquip(){return UI.genEquip()}
function genRelic(){return UI.genRelic()}

// ===================== 初始化 =====================
Game.init();
onRender(s=>UI.render(s));
initAudio();

// 暴露药水使用给HTML
window._usePotion=i=>{Battle.usePotion(i);};

// 绑定按钮
document.getElementById("btn-newgame").onclick=()=>{initAudio();startNewGame();};
document.getElementById("btn-continue").onclick=()=>{if(Game.load()){continueGame();}else{alert("存档损坏或不存在");}};
document.getElementById("btn-codex").onclick=()=>UI.showCodex();
document.getElementById("btn-daily").onclick=showDailyPanel;
document.getElementById("btn-delete").onclick=()=>{if(confirm("确定删除存档？图鉴和排行榜将保留。")){Game.hardReset();UI.switchScreen("start");UI.render(Game.state);}};
document.getElementById("btn-close-codex").onclick=()=>UI.hideModal("codex-panel");
document.getElementById("btn-close-daily").onclick=()=>UI.hideModal("daily-panel");
document.getElementById("btn-close-lb").onclick=()=>UI.hideModal("leaderboard");
document.getElementById("btn-hard-restart").onclick=()=>{Game.hardReset();UI.switchScreen("start");UI.render(Game.state);};
document.getElementById("btn-read-save").onclick=()=>{if(Game.load())continueGame();};

// 战斗按钮
document.getElementById("btn-atk").onclick=()=>Battle.doAttack();
document.getElementById("btn-skill").onclick=()=>Battle.doSkill();
document.getElementById("btn-def").onclick=()=>Battle.doDefend();
document.getElementById("btn-auto").onclick=()=>Battle.toggleAuto();
document.getElementById("btn-potion").onclick=()=>UI.openPotionModal();
document.getElementById("btn-close-potion").onclick=()=>UI.hideModal("potion-modal");

Battle.setCB(onWin, onGameOver);

// ===================== 新游戏流程 =====================
function startNewGame(){
  const inputEl=document.getElementById("seed-input");
const input=inputEl?inputEl.value.trim():"";
  Game.hardReset();
  const s=Game.state;
  s.seed=input||(""+Date.now());
  s.rng=new RNG(s.seed);
  // 难度选择
  UI.buildDifficultySelect(diff=>{
    s.difficulty=diff.id;
    Game.saveMeta(); // 记录难度偏好
    UI.switchScreen("class-select");
    UI.buildClassSelect(cls=>pickClass(cls));
  });
  UI.switchScreen("difficulty-select");
}

function pickClass(cls){
  const s=Game.state;
  s.playerClass=cls;
  s.player={hp:cls.hp,maxHp:cls.maxHp,mp:cls.maxMp,maxMp:cls.maxMp,atk:cls.atk,def:cls.def,critRate:cls.critRate,critMul:cls.critMul,skillMul:cls.skillMul,mpCost:cls.mpCost,pen:cls.pen,lifeSteal:0,thorn:0,goldMul:1,dodge:0,bleed:0,rage:false,doubleFirst:false,debuffAtk:null,dmgReduce:0,berserk:false,rebirth:false,regen:0};
  // 应用局外加成
  Game.applyMetaBonus(s.player);
  // 技能选择
  UI.buildSkillSelect(cls,sk=>{
    s.activeSkill=sk;
    s.player.skillMul=sk.mul;
    if(sk.extraCost)s.player.mpCost+=sk.extraCost;
    if(sk.extraPen)s.player.pen+=sk.extraPen;
    UI.switchScreen("zone-select");
    initZone(0);
  });
  UI.switchScreen("skill-select");
}

// ===================== 关卡/房间系统 =====================
function initZone(idx){
  const s=Game.state;
  s.zoneIndex=idx;
  s.zone=ZONES[SIMPLE_ROUTE[idx].zone];
  s.floorInZone=1;
  // 生成房间队列
  const template=ROOM_TEMPLATES.simple[idx]||ROOM_TEMPLATES.simple[0];
  const bossRoom=template[template.length-1];
  const others=template.slice(0,-1);
  s.roomQueue=s.rng.shuffle(others).concat(bossRoom);
  s.roomIndex=0;
  // 如果是第一关，直接开始；否则让玩家选路线
  if(idx===0){enterRoom();}
  else{
    const route=SIMPLE_ROUTE[idx-1];
    if(route&&route.choices.length>1){
      UI.buildZoneSelect(idx-1,z=>{s.zone=z;enterRoom();});
      UI.switchScreen("zone-select");
    }else{enterRoom();}
  }
}

function enterRoom(){
  const s=Game.state;
  s.potionAtk=0;s.potionDef=0;
  const roomId=s.roomQueue[s.roomIndex];
  if(!roomId){// 本关结束
    if(s.zoneIndex>=4){// 简单模式通关
      gameClear();return;
    }
    s.zoneIndex++;initZone(s.zoneIndex);return;
  }
  UI.hideAllModals();
  UI.showRoomInfo(s);
  UI.switchScreen("room-select");
  document.getElementById("btn-enter-room").onclick=()=>processRoom(roomId);
}

function processRoom(roomId){
  const s=Game.state;
  s.roomIndex++;
  if(roomId==="shop"){openShop();}
 else if(roomId==="event"||roomId==="shrine"||roomId==="altar"){openEvent(roomId);}
  else if(roomId==="chest"){openChest();}
  else if(roomId==="boss"){Battle.startBattle("boss");UI.switchScreen("main");}
  else if(roomId==="elite"){Battle.startBattle("elite");UI.switchScreen("main");}
  else{Battle.startBattle("normal");UI.switchScreen("main");}
}

function nextRoom(){
  const s=Game.state;
  if(s.roomIndex>=s.roomQueue.length){// 关底
    if(s.zoneIndex>=4){gameClear();return;}
    UI.showModal("endless-choice");
    document.getElementById("btn-next-zone").onclick=()=>{UI.hideModal("endless-choice");s.totalFloor++;s.zoneIndex++;initZone(s.zoneIndex);};
    document.getElementById("btn-end-run").onclick=()=>{UI.hideModal("endless-choice");gameClear();};
  }else{
    s.totalFloor++;
    s.floorInZone++;
    saveAuto();enterRoom();
  }
}

// ===================== 战斗回调 =====================
function onWin(isFast){
  const s=Game.state;
  // 奖励
  if(s.roomQueue[s.roomIndex-1]==="boss"){
    s.gold+=50+s.totalFloor;
    UI.showBossReward(isFast,rel=>takeRelic(rel),attr=>takeAttrReward(attr,isFast,true));
  }else{
    UI.showReward(isFast,eq=>takeEquip(eq),attr=>takeAttrReward(attr,isFast,false));
  }
  UI.showModal("reward");
}

function onGameOver(){
  const s=Game.state;
  Game.meta.totalDeaths++;
  // 天赋点奖励（根据层数）
  const tp=Math.floor(s.totalFloor/10);
  if(tp>0){Game.addTP(tp);}
  Game.addLeaderboard({char:s.playerClass?s.playerClass.name:"--",diff:s.difficulty,floor:s.totalFloor});
  Game.saveMeta();
  UI.showGameOver(false, tp>0?`获得 ${tp} 天赋点`:"");
}

function gameClear(){
  const s=Game.state;
  Game.meta.totalWins++;
  if(s.mode==="simple"&&Game.meta.highestSimple<s.totalFloor)Game.meta.highestSimple=s.totalFloor;
  // 解锁弓箭手
 // 弓箭手职业尚未实装，暂不解锁
  // if(!Game.meta.unlocks.includes("archer")){Game.meta.unlocks.push("archer");}
  const tp=5+Math.floor(s.totalFloor/10);
  Game.addTP(tp);
  Game.addLeaderboard({char:s.playerClass?s.playerClass.name:"--",diff:s.difficulty,floor:s.totalFloor});
  Game.saveMeta();
  UI.showGameOver(true,`通关奖励：${tp} 天赋点！`);
  Game.deleteSave();
}

// ===================== 奖励处理 =====================
function takeEquip(eq){
  const s=Game.state;
  if(s.equip.length>=6){log("<span class='warn'>装备栏已满，丢弃旧装备</span>");s.equip.shift();}
  s.equip.push(eq);playSound("equip");
  log(`${eq.icon} <span style="color:${eq.color}"><b>${eq.prefix||''}${eq.name}</b></span> 已装备！${eq.stat.toUpperCase()}+${eq.val}`,"win");
  UI.hideModal("reward");nextRoom();
}
function takeAttrReward(type,isFast,isBoss){
  const s=Game.state,p=s.player;
  const mul=isBoss?1.5:1;
  switch(type){
    case"atk":p.atk+=Math.floor((isFast?10:5)*mul);log("攻击 +"+Math.floor((isFast?10:5)*mul),"win");break;
    case"hp":p.maxHp+=Math.floor((isFast?50:25)*mul);p.hp+=Math.floor((isFast?50:25)*mul);log("生命上限 +"+Math.floor((isFast?50:25)*mul),"heal");break;
    case"mp":p.maxMp+=Math.floor((isFast?20:10)*mul);p.mp+=Math.floor((isFast?20:10)*mul);log("灵力上限 +"+Math.floor((isFast?20:10)*mul),"info");break;
    case"heal":p.hp=p.maxHp;log("生命全满","heal");playSound("heal");break;
  }
  UI.hideModal("reward");nextRoom();
}
function takeRelic(r){
  const s=Game.state;
  if(s.relics.length>=6){log("<span class='warn'>遗物栏已满，替换最旧的遗物</span>");s.relics.shift();}
  if(r.passive&&!r.applied){r.passive(s.player);r.applied=true;}s.relics.push(r);playSound("equip");log(`${r.icon} <b style="color:${RARITY_COLOR[r.rarity]}">${r.name}</b> 已获得！${r.desc}`,"win");
  UI.hideModal("reward");nextRoom();
}

// ===================== 商店 =====================
function openShop(){
  UI.openShop(()=>{},()=>{UI.hideModal("shop");nextRoom();});
}

// ===================== 事件 =====================
function openEvent(roomId){
  UI.openEvent(roomId, ()=>{UI.hideModal("event");nextRoom();});
}

function openChest(){
  const s=Game.state;
  const roll=s.rng.next();
  if(roll<0.5){const eq=genEquip();if(s.equip.length>=6)s.equip.shift();s.equip.push(eq);playSound("equip");log("<span class='win'>宝箱开出装备！</span>","win");}
  else if(roll<0.8){s.gold+=30;log("<span class='gold'>宝箱开出 30 金币！</span>");}
  else{const rel=genRelic();if(s.relics.length>=6){log("<span class='warn'>遗物栏已满，替换最旧的遗物</span>");s.relics.shift();}s.relics.push(rel);if(rel.passive&&!rel.applied){rel.passive(s.player);rel.applied=true;}playSound("equip");log("<span class='win'>宝箱开出遗物！</span>","win");}
  Game.sync();setTimeout(()=>nextRoom(),600);
}

// ===================== 继续游戏 =====================
function continueGame(){
  const s=Game.state;
  s.gameOver=false;
  UI.hideAllModals();
  // 判断当前在哪个界面
  if(s.enemy&&s.enemy.hp>0){UI.switchScreen("main");}
  else{enterRoom();}
  log("<span class='info'>💾 已加载存档，继续冒险...</span>");
  Game.sync();
}

// ===================== 每日挑战 =====================
function showDailyPanel(){
  const today=new Date().toISOString().slice(0,10).replace(/-/g,"");
  const seed=parseInt(today,10);
  UI.showDaily(seed,(gmod,pmod,emod)=>{
    Game.hardReset();
    const s=Game.state;
    s.seed="daily_"+today;s.rng=new RNG(s.seed);
    s.difficulty="standard";s.dailyMods={global:gmod,player:pmod,enemy:emod};
    UI.hideModal("daily-panel");
    UI.buildClassSelect(cls=>{
      s.playerClass=cls;
      s.player={hp:cls.hp,maxHp:cls.maxHp,mp:cls.maxMp,maxMp:cls.maxMp,atk:cls.atk,def:cls.def,critRate:cls.critRate,critMul:cls.critMul,skillMul:cls.skillMul,mpCost:cls.mpCost,pen:cls.pen,lifeSteal:0,thorn:0,goldMul:1,dodge:0,bleed:0,rage:false,doubleFirst:false,debuffAtk:null,dmgReduce:0,berserk:false,rebirth:false,regen:0};
      Game.applyMetaBonus(s.player);
      // 修复：每日修饰器必须在 player 初始化后才能应用
      gmod.apply(s);pmod.apply(s);emod.apply(s);
      // 技能
      const sk=s.rng.pick(cls.skills);
      s.activeSkill=sk;s.player.skillMul=sk.mul;if(sk.extraCost)s.player.mpCost+=sk.extraCost;
      initZone(0);
    });
    UI.switchScreen("class-select");
  });
}

// ===================== 工具 =====================
function log(h,c=""){const d=document.getElementById("log"),s=document.createElement("div");s.className=c;s.innerHTML=h;d.appendChild(s);d.scrollTop=d.scrollHeight;while(d.children.length>30)d.removeChild(d.firstChild);}
function saveAuto(){Game.sync();}

// 初始渲染
UI.render(Game.state);
console.log("妖塔3.0 地基已加载 | core/ 6文件 + ui + main");