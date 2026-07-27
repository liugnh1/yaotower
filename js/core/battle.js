import { Game } from "./state.js";
import { playSound } from "./audio.js";
import { MONSTER_TAGS, DIFFICULTIES, ENEMIES, ZONE_BOSSES, ENDLESS_BOSSES } from "./config.js";

let _onWin=null,_onOver=null;
export function setCB(w,o){_onWin=w;_onOver=o;}

function log(h,c=""){const d=document.getElementById("log"),s=document.createElement("div");s.className=c;s.innerHTML=h;d.appendChild(s);d.scrollTop=d.scrollHeight;while(d.children.length>30)d.removeChild(d.firstChild);}
function toast(m){const t=document.getElementById("toast");t.textContent=m;t.style.opacity=1;setTimeout(()=>t.style.opacity=0,2000);}
function float(txt,cls){const fc=document.getElementById("float-container"),el=document.createElement("div");el.className="float-text "+cls;el.textContent=txt;el.style.left=(40+Math.random()*20)+"%";el.style.top="45%";fc.appendChild(el);setTimeout(()=>el.remove(),1000);}

function addTag(s){const tag=s.rng.pick(MONSTER_TAGS);if(!s.enemy.tags.find(x=>x.id===tag.id)){const c={...tag};c.apply(s.enemy);s.enemy.tags.push(c);}}

export function startBattle(type){
  const s=Game.state;
  s.auto=false;s.defending=false;s.nextBoost=0;s.turnInFloor=0;
  s.enemy=null;let base;
  if(type==="boss"){
    const boss=ZONE_BOSSES[s.zoneIndex+1]||ENDLESS_BOSSES[Math.min(s.zoneIndex-4,ENDLESS_BOSSES.length-1)];
    base={...boss};
  }else if(type==="elite"){
    const pool=ENEMIES[s.zone.enemyPool]||ENEMIES.plains;
    base={...s.rng.pick(pool)};
    base.hp=Math.floor(base.hp*1.5);base.atk=Math.floor(base.atk*1.3);base.def+=2;
  }else{
    const pool=ENEMIES[s.zone.enemyPool]||ENEMIES.plains;
    base={...s.rng.pick(pool)};
  }
  const diff=DIFFICULTIES[s.difficulty];
  base.hp=Math.floor(base.hp*diff.monsterMul);base.atk=Math.floor(base.atk*diff.monsterMul);
  // 每日修饰器
  if(s.dailyMods.enemy){
    if(s.dailyMods.enemy.id==="e1")base.hp=Math.floor(base.hp*1.2);
    if(s.dailyMods.enemy.id==="e2")base.atk=Math.floor(base.atk*1.2);
    if(s.dailyMods.enemy.id==="e3")base.def=Math.floor(base.def*1.3);
  }
  s.enemy={...base,maxHp:base.hp,hp:base.hp,aiTurn:0,tags:[]};
  if(s.dailyMods.enemy){
    if(s.dailyMods.enemy.id==="e4")s.enemy.doubleFirst=true;
    if(s.dailyMods.enemy.id==="e7"&&type==="boss"){s.enemy.hp=Math.floor(s.enemy.hp*1.5);s.enemy.maxHp=s.enemy.hp;}
    if(s.dailyMods.enemy.id==="e9")addTag(s);
  }
  if(s.floorInZone>3&&s.rng.chance(0.55))addTag(s);
  if(diff.extraTag&&s.rng.chance(0.35))addTag(s);
  Game.sync();
  const tt=s.enemy.tags.map(x=>x.name).join(" ");
  log(`<span class="warn">⚠️ 第${s.totalFloor}层·${s.zone.name}：${s.enemy.name} ${tt}</span>`);
  if(s.player.doubleFirst)log("<span class='info'>💨 天赋触发·首回合连击！</span>");
}

export function doAttack(){
  const s=Game.state;if(s.gameOver||!s.enemy||s.enemy.hp<=0)return;
  s.defending=false;let dmg=calcDmg(false);applyDmg(dmg,false);
  if(s.player.doubleFirst&&s.turnInFloor===0){log("<span class='info'>💨 连击！</span>");applyDmg(calcDmg(false),false);}
  s.player.doubleFirst=false;
  if(s.enemy.hp<=0){win();return;}enemyTurn();Game.sync();if(s.auto)setTimeout(autoLoop,700);
}
export function doSkill(){
  const s=Game.state;if(s.gameOver||!s.enemy||s.enemy.hp<=0||s.player.mp<s.player.mpCost)return;
  s.defending=false;s.player.mp-=s.player.mpCost;let dmg=calcDmg(true);applyDmg(dmg,true);
  if(s.enemy.hp<=0){win();return;}enemyTurn();Game.sync();if(s.auto)setTimeout(autoLoop,700);
}
export function doDefend(){
  const s=Game.state;if(s.gameOver||!s.enemy||s.enemy.hp<=0)return;
  s.defending=true;s.nextBoost=0.35;log("🛡️ 防御姿态！下回合反击+35%","info");playSound("hit");
  enemyTurn();Game.sync();if(s.auto)setTimeout(autoLoop,700);
}

function calcDmg(skill){
  const p=Game.state.player,e=Game.state.enemy;
  let atk=p.atk;Game.state.equip.forEach(q=>{if(q.stat==="atk")atk+=q.val;});
  if(p.rage&&p.hp<p.maxHp*0.3)atk=Math.floor(atk*1.5);
  if(p.berserk){const r=Math.max(0,1-p.hp/p.maxHp);atk=Math.floor(atk*(1+r));}
  if(p.debuffAtk&&p.debuffAtk.turns>0)atk=Math.max(1,atk-p.debuffAtk.value);
  if(Game.state.potionAtk)atk=Math.floor(atk*(1+Game.state.potionAtk));
  let def=e.def;if(skill)def=Math.floor(def*(1-(p.pen||0)));
  let dmg=Math.max(1,atk-def);if(skill)dmg=Math.floor(dmg*p.skillMul);
  if(Game.state.nextBoost>0){dmg=Math.floor(dmg*(1+Game.state.nextBoost));}
  return dmg;
}

function applyDmg(dmg,skill){
  const s=Game.state,p=s.player;
  let cr=p.critRate;s.equip.forEach(q=>{if(q.stat==="critRate")cr+=q.val/100;});
  let crit=Math.random()<cr;
  if(crit){dmg=Math.floor(dmg*p.critMul);s.stats.critCount++;log(`💥 <b class="crit">暴击！</b>造成 <span class="dmg">${dmg}</span> 点伤害`,"crit");playSound("crit");float(dmg+"!","float-crit");}
  else if(s.nextBoost>0&&s.nextBoost!==0.35){log(`⚔️ <b style="color:#ffa502">反击！</b>造成 <span class="dmg">${dmg}</span> 点伤害`);playSound("attack");float(dmg,"float-dmg");}
  else{log(`⚔️ 造成 <span class="dmg">${dmg}</span> 点伤害`);playSound("attack");float(dmg,"float-dmg");}
  s.stats.totalDmg+=dmg;s.enemy.hp-=dmg;
  if(p.lifeSteal>0){const h=Math.floor(dmg*p.lifeSteal);p.hp=Math.min(p.maxHp,p.hp+h);log(`<span class="heal">恢复 ${h} 生命</span>`);}
  s.relics.forEach(r=>{if(r.onAttack)r.onAttack(p,dmg);});
  if(s.enemy.thorn){const th=Math.floor(dmg*s.enemy.thorn);p.hp-=th;log(`<span class="warn">${s.enemy.name} 反伤 ${th}！</span>`);}
  s.nextBoost=0;
}

function enemyTurn(){
  const s=Game.state,p=s.player,e=s.enemy;
  let dmg=Math.max(1,e.atk-p.def);s.equip.forEach(q=>{if(q.stat==="def")dmg=Math.max(1,dmg-q.val);});
  if(p.dmgReduce)dmg=Math.floor(dmg*(1-p.dmgReduce));
  if(Game.state.potionDef)dmg=Math.floor(dmg*(1-Game.state.potionDef));
  if(e.aiCharge){e.chargeTurns=(e.chargeTurns||0)+1;if(e.chargeTurns%3===0){dmg=Math.floor(dmg*2);log(`<span class="warn">⚠️ ${e.name} 蓄力攻击！伤害翻倍！</span>`);}}
  if(s.defending){dmg=Math.floor(dmg*0.5);s.defending=false;}
  if(p.dodge&&s.rng.chance(p.dodge)){dmg=0;log("🍃 闪避！");}
  if(e.doubleFirst&&s.turnInFloor===0){
    log(`<span class="warn">${e.name} 迅捷连击！</span>`);e.doubleFirst=false;
    strike(dmg);if(e.hp<=0){win();return;}if(p.hp>0)strike(dmg);if(e.hp<=0){win();return;}
  }else{strike(dmg);if(e.hp<=0){win();return;}}
  if(p.hp<=0){p.hp=0;Game.sync();setTimeout(()=>gameOver(),500);return;}
  if(p.bleed){p.hp-=p.bleed;log(`<span class="warn">☠️ 流血损失 ${p.bleed} 生命</span>`);}
  if(p.hp<=0){p.hp=0;Game.sync();setTimeout(()=>gameOver(),500);return;}
  p.mp=Math.min(p.maxMp,p.mp+3);
  if(p.regen){p.hp=Math.min(p.maxHp,p.hp+p.regen);log(`<span class="heal">恢复 ${p.regen} 生命</span>`);}
  // 修复：统一调用 relic.onTurn(p,e)，不再硬编码 demon_heart
  s.relics.forEach(r=>{if(r.onTurn)r.onTurn(p,e);});
  if(e.hp<=0){win();return;}
  s.turn++;s.turnInFloor++;
  if(e.aiCurse&&s.rng.chance(0.4)){p.debuffAtk={turns:2,value:3+Math.floor(s.totalFloor/5)};log(`<span class="warn">☠️ ${e.name} 的诅咒降低了你的攻击力！</span>`);}
  if(p.debuffAtk){p.debuffAtk.turns--;if(p.debuffAtk.turns<=0)delete p.debuffAtk;}
}
function strike(dmg){
  const s=Game.state,p=s.player,e=s.enemy;
  p.hp-=dmg;log(`${e.name} 攻击，造成 <span class="dmg">${dmg}</span> 伤害`);playSound("hit");
  if(e.lifeSteal){const h=Math.floor(dmg*e.lifeSteal);e.hp=Math.min(e.maxHp,e.hp+h);}
  s.relics.forEach(r=>{if(r.onHit)r.onHit(p,e,dmg);});
  if(p.thorn){const th=Math.floor(dmg*p.thorn);e.hp-=th;log(`<span class="warn">荆棘反弹 ${th}！</span>`);}
}

function win(){
  const s=Game.state;Game.sync();
  log(`<span class="win">✨ ${s.enemy.name} 被斩杀！</span>`);playSound("win");
  Game.recordKill(s.enemy.name,s.totalFloor,s.enemy);
  if(s.totalFloor>s.highest)s.highest=s.totalFloor;
  let g=10+s.rng.range(0,15)+Math.floor(s.totalFloor/2);
  if(s.player.goldMul)g=Math.floor(g*s.player.goldMul);
  const lim=s.totalFloor<=10?15:(s.totalFloor===99?30:20);
  const fast=s.turnInFloor<=lim;
  if(fast){g=Math.floor(g*2);log(`<span class="win">🏆 限时击杀！仅用${s.turnInFloor}回合，金币翻倍！</span>`);}
  s.gold+=g;log(`<span class="gold">💰 获得 ${g} 金币</span>`);float("+"+g,"float-gold");
  s.relics.forEach(r=>{if(r.onKill)r.onKill(s.player);});
  s.stats.roomsCleared++;
  Game.sync();
  setTimeout(()=>{if(_onWin)_onWin(fast);},400);
}

export function gameOver(){
  const s=Game.state;
  if(s.player.rebirth&&s.player.hp<=0){
    s.player.hp=Math.floor(s.player.maxHp*0.5);s.player.rebirth=false;
    log(`<span class="win">🔥 凤凰羽触发！浴火重生！</span>`);playSound("heal");Game.sync();return;
  }
  s.auto=false;s.gameOver=true;playSound("lose");Game.sync();
  if(_onOver)_onOver();
}

export function toggleAuto(){
  const s=Game.state;s.auto=!s.auto;Game.sync();
  if(s.auto)autoLoop();
}
function autoLoop(){
  const s=Game.state;
  if(s.gameOver||!s.auto||!s.enemy||s.enemy.hp<=0)return;
  if(s.player.mp>=s.player.mpCost&&s.rng.chance(0.6))doSkill();
  else if(s.player.hp<s.player.maxHp*0.25&&s.enemy.atk>s.player.def+5)doDefend();
  else doAttack();
}

// 使用药水
export function usePotion(idx){
  const s=Game.state;if(idx<0||idx>=s.potions.length)return false;
  const pot=s.potions[idx];pot.fn(s.player,s);s.potions.splice(idx,1);
  playSound("potion");log(`<span class="heal">🧪 使用了 ${pot.name}！${pot.desc}</span>`);
  Game.sync();return true;
}