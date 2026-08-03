// ===================== v0.80 混沌词条统一数据源 =====================
// 替代之前分散在 main.js (CHAOS_MODS) 和 build-mode.js (CHAOS_TIERS) 的重复定义
// 每个词条有唯一 id，用于去重和追踪
import { R } from '../core/registry.js';

var CHAOS_MODS_BY_TIER = {
  tier1: [
    { id:'chaos_berserk',  name:'敌人狂暴', desc:'敌人攻击+30%', apply:function(s){s.enemyAtkMul=(s.enemyAtkMul||1)*1.3;} },
    { id:'chaos_hpUp',     name:'敌人血牛', desc:'敌人血量+40%', apply:function(s){s.enemyHpMul=(s.enemyHpMul||1)*1.4;} },
    { id:'chaos_cursed',   name:'诅咒缠身', desc:'开局获得1个随机诅咒', apply:function(s){var c=s.rng.pick(R.get('curses')||[]);if(c){s.curses.push(c);c.apply(s.player);}} },
    { id:'chaos_cdUp',     name:'灵力压制', desc:'技能CD+1回合', apply:function(s){s._chaosCdPenalty=(s._chaosCdPenalty||0)+1;} },
    { id:'chaos_drain',    name:'生命透支', desc:'每回合扣3%HP，攻击+25%', apply:function(s){s.player.atk=Math.floor(s.player.atk*1.25);s._chaosDrain=true;} },
    { id:'chaos_crit',     name:'暴击失控', desc:'双方暴击率+30%', apply:function(s){s.player.critRate+=0.3;s._chaosCrit=true;} },
    { id:'chaos_cdrParty', name:'技能狂欢', desc:'所有技能CD-1，但敌人+1只', apply:function(s){s._chaosCdrBonus=(s._chaosCdrBonus||0)+1;s._chaosExtraEnemy=true;} },
    { id:'chaos_gold',     name:'财富诅咒', desc:'金币翻倍，但商店价格×3', apply:function(s){s.player.goldMul=(s.player.goldMul||1)*2;s._chaosPrice=true;} },
    { id:'chaos_shield',   name:'护盾衰减', desc:'护盾效果-50%，吸血+15%', apply:function(s){s.player.lifeSteal=(s.player.lifeSteal||0)+0.15;s._chaosShieldHalf=true;} },
    { id:'chaos_elite',    name:'双重压力', desc:'精英怪+1，精英奖励×2', apply:function(s){s._chaosExtraElite=true;} },
    { id:'chaos_precise',  name:'精准打击', desc:'敌人暴击率+25%，玩家暴伤+50%', apply:function(s){s.player.critMul=(s.player.critMul||1.5)+0.5;s._chaosCrit=true;} },
  ],
  tier2: [
    { id:'chaos_gaze',     name:'深渊凝视', desc:'敌人每回合+5%攻击(叠加)', apply:function(s){s._chaosDeepGaze=true;} },
    { id:'chaos_blood',    name:'鲜血契约', desc:'生命上限-50%，攻击+80%', apply:function(s){s.player.maxHp=Math.floor(s.player.maxHp*0.5);s.player.hp=Math.min(s.player.hp,s.player.maxHp);s.player.atk=Math.floor(s.player.atk*1.8);} },
    { id:'chaos_element',  name:'元素紊乱', desc:'燃烧/中毒伤害翻倍，玩家受50%元素伤', apply:function(s){s._chaosElement=true;} },
    { id:'chaos_extra',    name:'多重分身', desc:'每波敌人+1', apply:function(s){s._chaosExtraEnemy=true;} },
    { id:'chaos_steel',    name:'钢铁皮肤', desc:'敌人防御+50%，玩家穿透+30%', apply:function(s){s.enemyDefMul=(s.enemyDefMul||1)*1.5;s.player.pen=(s.player.pen||0)+0.3;} },
    { id:'chaos_void',     name:'虚空侵蚀', desc:'每回合扣4%HP，攻击+40%', apply:function(s){s.player.atk=Math.floor(s.player.atk*1.4);s._chaosDrain=true;s._chaosDrainPct=0.04;} },
    { id:'chaos_brutal',   name:'残暴', desc:'敌人攻击+50%，血量-30%', apply:function(s){s.enemyAtkMul=(s.enemyAtkMul||1)*1.5;s.enemyHpMul=(s.enemyHpMul||1)*0.7;} },
    { id:'chaos_spread',   name:'诅咒蔓延', desc:'获1个随机诅咒，每个诅咒+10%攻', apply:function(s){var c=s.rng.pick(R.get('curses')||[]);if(c){s.curses.push(c);c.apply(s.player);}s._chaosCurseAtk=true;} },
  ],
  tier3: [
    { id:'chaos_doom',     name:'末日迫近', desc:'每10回合所有单位受30%HP伤害', apply:function(s){s._chaosDoom=true;} },
    { id:'chaos_soul',     name:'灵魂灼烧', desc:'放技能扣10%HP，技能伤害+100%', apply:function(s){s.player.skillMul=(s.player.skillMul||1)*2;s._chaosSoulBurn=true;} },
    { id:'chaos_famine',   name:'无尽饥荒', desc:'回复-80%，每击杀永久+2攻', apply:function(s){s._chaosFamine=true;} },
    { id:'chaos_end',      name:'终焉', desc:'敌人全属性+40%，玩家全属性+15%', apply:function(s){s.enemyAtkMul=(s.enemyAtkMul||1)*1.4;s.enemyHpMul=(s.enemyHpMul||1)*1.4;s.enemyDefMul=(s.enemyDefMul||1)*1.4;s.player.atk=Math.floor(s.player.atk*1.15);s.player.maxHp=Math.floor(s.player.maxHp*1.15);s.player.hp=Math.floor(s.player.hp*1.15);s.player.def=Math.floor(s.player.def*1.15);} },
    { id:'chaos_rift',     name:'裂隙震荡', desc:'每5回合双方各受15%HP伤害', apply:function(s){s._chaosRift=true;} },
    { id:'chaos_madness',  name:'疯狂', desc:'暴伤+150%，每暴扣5%HP', apply:function(s){s.player.critMul=(s.player.critMul||1.5)+1.5;s._chaosMadness=true;} },
  ]
};

// 注册为唯一数据源
R.registerAll('chaosMods', CHAOS_MODS_BY_TIER);

// 便捷导出（兼容旧代码中的 CHAOS_TIERS 引用）
export { CHAOS_MODS_BY_TIER };
