// ===================== 任务/挑战系统 =====================
// 每日任务 + 累计成就型挑战，在悬赏板展示
import { R } from '../core/registry.js';

// 每日任务池（每天随机刷3个）
R.registerAll('dailyQuests', [
  { id: "dq_kill_10",   name: "斩妖除魔",   desc: "击败10只怪物",       target: 10,  reward: { essence: 3, souls: 1 }, icon: "⚔️" },
  { id: "dq_boss_2",    name: "首领猎手",   desc: "击败2个Boss",        target: 2,   reward: { essence: 5, souls: 2 }, icon: "💀" },
  { id: "dq_gold_100",  name: "聚财有道",   desc: "累计获得100金币",    target: 100, reward: { essence: 3, souls: 1 }, icon: "💰" },
  { id: "dq_floor_20",  name: "勇攀高峰",   desc: "到达第20层",          target: 20,  reward: { essence: 8, souls: 3 }, icon: "🏔️" },
  { id: "dq_elite_3",   name: "精英狩猎",   desc: "击败3只精英怪物",    target: 3,   reward: { essence: 5, souls: 2 }, icon: "👺" },
  { id: "dq_shop_3",    name: "购物达人",   desc: "访问3次商店",        target: 3,   reward: { essence: 3, souls: 1 }, icon: "🏪" },
  { id: "dq_crit_5",    name: "致命一击",   desc: "打出5次暴击",        target: 5,   reward: { essence: 3, souls: 1 }, icon: "💥" },
  { id: "dq_potion_3",  name: "药水收藏家", desc: "使用3瓶药水",        target: 3,   reward: { essence: 3, souls: 1 }, icon: "🧪" },
  { id: "dq_relic_5",   name: "遗物收集者", desc: "累计获得5个遗物",    target: 5,   reward: { essence: 6, souls: 2 }, icon: "🔮" },
  { id: "dq_equip_5",   name: "装备大师",   desc: "累计装备5件装备",    target: 5,   reward: { essence: 4, souls: 1 }, icon: "🎒" },
  { id: "dq_cleanse_1", name: "诅咒净化",   desc: "清除1个诅咒",        target: 1,   reward: { essence: 5, souls: 2 }, icon: "🧴" },
  { id: "dq_event_3",   name: "命运的抉择", desc: "触发3次随机事件",    target: 3,   reward: { essence: 4, souls: 1 }, icon: "❓" },
]);

// 每周挑战（更难的长期目标）
R.registerAll('weeklyQuests', [
  { id: "wq_floor_50",  name: "踏破妖塔",   desc: "本周内到达第50层",    target: 50,  reward: { essence: 20, souls: 10, stones: 8 }, icon: "🛕" },
  { id: "wq_boss_10",   name: "屠魔勇士",   desc: "本周击败10个Boss",    target: 10,  reward: { essence: 15, souls: 8, stones: 5 },  icon: "💀" },
  { id: "wq_clear_any", name: "通关达人",   desc: "本周通关任意难度1次", target: 1,   reward: { essence: 25, souls: 15, stones: 10 }, icon: "🏆" },
  { id: "wq_kill_100",  name: "百妖斩",     desc: "本周击杀100只怪物",   target: 100, reward: { essence: 20, souls: 10, stones: 5 }, icon: "⚔️" },
  { id: "wq_3class",    name: "博采众长",   desc: "本周使用3个不同职业", target: 3,   reward: { essence: 15, souls: 12, stones: 5 }, icon: "🎭" },
]);

// 任务进度追踪（存储在 Game.meta 中）
// meta.questProgress = { daily: { dq_kill_10: 5, ... }, weekly: { ... }, dailyDate: "2026-07-29", weeklyDate: "2026-W31" }
