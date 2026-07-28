// 成就系统 —— 四类成就，解锁后提供微幅局外永久加成
// 战斗类 / 构筑类 / 收集类 / 挑战类
import { R } from '../core/registry.js';

R.registerAll('achievements', [
  // ===== 战斗类 =====
  { id: "one_shot_200",  name: "一击必杀",   desc: "单次造成200+伤害",                    icon: "💥", category: "combat",  bonus: { atkBonus: 0.02 } },
  { id: "crit_master",   name: "暴击大师",   desc: "单局累计暴击50次",                    icon: "🎯", category: "combat",  bonus: { critBonus: 0.02 } },
  { id: "flawless_boss", name: "无伤屠王",   desc: "无伤击败任意Boss",                    icon: "✨", category: "combat",  bonus: { defBonus: 0.02 } },
  { id: "speed_demon",   name: "速通使者",   desc: "5回合内击败Boss",                      icon: "⚡", category: "combat",  bonus: { atkBonus: 0.03 } },
  { id: "survivor",      name: "绝处逢生",   desc: "生命低于5%时反杀敌人",                icon: "❤️", category: "combat",  bonus: { hpBonus: 0.03 } },
  { id: "dodge_lucky",   name: "灵巧之身",   desc: "单局闪避10次",                        icon: "🍃", category: "combat",  bonus: { dodgeBonus: 0.02 } },

  // ===== 构筑类 =====
  { id: "full_synergy",  name: "羁绊之主",   desc: "单局激活4组遗物羁绊",                  icon: "🔗", category: "build",   bonus: { startPotion: 1 } },
  { id: "six_relics",    name: "遗物收藏家", desc: "同时持有6个遗物",                      icon: "🏺", category: "build",   bonus: { luckBonus: 0.02 } },
  { id: "six_equips",    name: "全副武装",   desc: "同时装备6件装备",                      icon: "⚔️", category: "build",   bonus: { goldBonus: 0.05 } },
  { id: "three_curses",  name: "诅咒缠身",   desc: "同时持有3个诅咒",                      icon: "☠️", category: "build",   bonus: { atkBonus: 0.02 } },
  { id: "curse_breaker", name: "破咒者",     desc: "用净化药水移除诅咒",                   icon: "🧪", category: "build",   bonus: { hpBonus: 0.02 } },

  // ===== 收集类 =====
  { id: "kill_100",      name: "百人斩",     desc: "累计击败100个敌人",                    icon: "🗡️", category: "collect", bonus: { atkBonus: 0.01 } },
  { id: "kill_500",      name: "千人屠",     desc: "累计击败500个敌人",                    icon: "💀", category: "collect", bonus: { atkBonus: 0.03 } },
  { id: "gold_200",      name: "财主",       desc: "单局获得200金币",                      icon: "💰", category: "collect", bonus: { goldBonus: 0.05 } },
  { id: "relic_10",      name: "遗物猎人",   desc: "累计获得10种不同遗物",                  icon: "📦", category: "collect", bonus: { luckBonus: 0.03 } },

  // ===== 挑战类 =====
  { id: "clear_casual",  name: "初出茅庐",   desc: "简单难度通关",                        icon: "🌱", category: "challenge", bonus: { hpBonus: 0.02 } },
  { id: "clear_standard",name: "渐入佳境",   desc: "普通难度通关",                        icon: "⚔️", category: "challenge", bonus: { atkBonus: 0.02 } },
  { id: "clear_hell",    name: "炼狱行者",   desc: "炼狱难度通关",                        icon: "🔥", category: "challenge", bonus: { allBonus: 0.05 } },
  { id: "endless_30",    name: "无尽深渊",   desc: "无尽模式到达30层",                     icon: "🌀", category: "challenge", bonus: { atkBonus: 0.03 } },
  { id: "all_classes",   name: "道途圆满",   desc: "所有职业各通关一次",                   icon: "🌟", category: "challenge", bonus: { allBonus: 0.03 } }
]);
