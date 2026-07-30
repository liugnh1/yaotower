// ===================== 天赋树数据定义 v0.50 =====================
// PoE风格简化版。消耗灵蕴逐节点点亮。替代旧 meta-limits.js。
import { R } from '../core/registry.js';

// 每个节点包含：id, name, icon, branch, layer, cost, bonus, requires, isKeystone
// branch: 'root'|'combat'|'survival'|'explore'|'fortune'
// layer: 0-5（0=根, 5=终极前, keystone=终极）
R.registerAll('talentTree', [
  // ===== 根节点（layer 0）=====
  { id: "root_atk",  name: "神力·攻", icon: "⚔️", branch: "root", layer: 0, cost: 1,
    bonus: { atkMul: 0.02 }, // 可叠加5层（在UI中控制，每个根节点可多次购买）
    desc: "攻击力 +2%，可叠加至5层" },
  { id: "root_hp",   name: "神力·血", icon: "❤️", branch: "root", layer: 0, cost: 1,
    bonus: { hpMul: 0.03 },
    desc: "生命值 +3%，可叠加至5层" },
  { id: "root_def",  name: "神力·防", icon: "🛡️", branch: "root", layer: 0, cost: 1,
    bonus: { defMul: 0.02 },
    desc: "防御力 +2%，可叠加至5层" },

  // ===== 战斗大师分支 =====
  { id: "cbt_crit",    name: "致命",   icon: "💥", branch: "combat", layer: 1, cost: 2,
    bonus: { critRate: 0.02 }, requires: [],
    desc: "暴击率 +2%" },
  { id: "cbt_critdmg", name: "重击",   icon: "🎯", branch: "combat", layer: 2, cost: 2,
    bonus: { critMul: 0.08 }, requires: ["cbt_crit"],
    desc: "暴击伤害 +8%" },
  { id: "cbt_lifesteal",name:"嗜血",   icon: "🩸", branch: "combat", layer: 3, cost: 3,
    bonus: { lifeSteal: 0.05 }, requires: ["cbt_critdmg"],
    desc: "吸血 +5%" },
  { id: "cbt_pen",     name: "穿甲",   icon: "🗡️", branch: "combat", layer: 4, cost: 3,
    bonus: { pen: 0.10 }, requires: ["cbt_lifesteal"],
    desc: "穿透 +10%" },
  { id: "cbt_cdr",     name: "疾风",   icon: "💨", branch: "combat", layer: 5, cost: 5,
    bonus: { skillCDR: true }, requires: ["cbt_pen"],
    desc: "技能冷却-1回合（最低1）" },
  { id: "cbt_keystone",name: "破军",   icon: "⚡", branch: "combat", layer: 99, cost: 8, isKeystone: true,
    bonus: { keystone_break: true }, requires: ["cbt_cdr"],
    desc: "攻击15%概率无视防御" },

  // ===== 生存专家分支 =====
  { id: "sur_dodge",   name: "灵巧",   icon: "🍃", branch: "survival", layer: 1, cost: 2,
    bonus: { dodge: 0.03 }, requires: [],
    desc: "闪避率 +3%" },
  { id: "sur_block",   name: "铁壁",   icon: "🛡️", branch: "survival", layer: 2, cost: 2,
    bonus: { dmgReduce: 0.06 }, requires: ["sur_dodge"],
    desc: "受击时20%概率减伤30%" },
  { id: "sur_shield",  name: "护体",   icon: "💎", branch: "survival", layer: 3, cost: 3,
    bonus: { startShield: 30 }, requires: ["sur_block"],
    desc: "每场战斗开始获得30点护盾" },
  { id: "sur_regen",   name: "再生",   icon: "💚", branch: "survival", layer: 4, cost: 3,
    bonus: { regenPct: 0.03 }, requires: ["sur_shield"],
    desc: "每回合回复3%最大生命" },
  { id: "sur_tough",   name: "坚韧",   icon: "🏋️", branch: "survival", layer: 5, cost: 5,
    bonus: { dmgReduce: 0.10 }, requires: ["sur_regen"],
    desc: "伤害减免 +10%" },
  { id: "sur_keystone",name: "不灭",   icon: "🔥", branch: "survival", layer: 99, cost: 8, isKeystone: true,
    bonus: { keystone_immortal: true }, requires: ["sur_tough"],
    desc: "受致命伤时锁1血+免疫1回合（每局1次）" },

  // ===== 探索者分支 =====
  { id: "exp_gold",    name: "财富",   icon: "💰", branch: "explore", layer: 1, cost: 2,
    bonus: { goldMul: 0.10 }, requires: [],
    desc: "金币获取 +10%" },
  { id: "exp_relic",   name: "寻宝",   icon: "🔍", branch: "explore", layer: 2, cost: 2,
    bonus: { relicRate: 0.15 }, requires: ["exp_gold"],
    desc: "遗物出现率 +15%" },
  { id: "exp_discount",name: "议价",   icon: "🏷️", branch: "explore", layer: 3, cost: 3,
    bonus: { shopDiscount: 0.15 }, requires: ["exp_relic"],
    desc: "商店价格 -15%" },
  { id: "exp_event",   name: "直觉",   icon: "👁️", branch: "explore", layer: 4, cost: 3,
    bonus: { eventGood: 0.20 }, requires: ["exp_discount"],
    desc: "事件好选项概率 +20%" },
  { id: "exp_slots",   name: "扩容",   icon: "🎒", branch: "explore", layer: 5, cost: 5,
    bonus: { relicSlots: 1 }, requires: ["exp_event"],
    desc: "遗物持有上限 +1" },
  { id: "exp_keystone",name: "洞察",   icon: "👁️", branch: "explore", layer: 99, cost: 8, isKeystone: true,
    bonus: { keystone_doubleChest: true }, requires: ["exp_slots"],
    desc: "宝箱奖励翻倍" },

  // ===== 命运分支 =====
  { id: "frt_rare",    name: "天眷",   icon: "⭐", branch: "fortune", layer: 1, cost: 2,
    bonus: { rareWeight: 0.20 }, requires: [],
    desc: "稀有遗物权重 +20%" },
  { id: "frt_elite",   name: "挑战",   icon: "👺", branch: "fortune", layer: 2, cost: 2,
    bonus: { eliteRate: 0.15 }, requires: ["frt_rare"],
    desc: "精英房出现率 +15%" },
  { id: "frt_chest",   name: "丰收",   icon: "📦", branch: "fortune", layer: 3, cost: 3,
    bonus: { chestBonus: 1 }, requires: ["frt_elite"],
    desc: "宝箱额外+1件奖励" },
  { id: "frt_cleanse", name: "净化",   icon: "🧴", branch: "fortune", layer: 4, cost: 3,
    bonus: { curseReduce: 0.30 }, requires: ["frt_chest"],
    desc: "诅咒负面效果 -30%" },
  { id: "frt_extra",   name: "奇迹",   icon: "✨", branch: "fortune", layer: 5, cost: 5,
    bonus: { relicChoice: 1 }, requires: ["frt_cleanse"],
    desc: "遗物选择时多一个选项" },
  { id: "frt_keystone",name: "天命",   icon: "🌟", branch: "fortune", layer: 99, cost: 8, isKeystone: true,
    bonus: { keystone_startRareRelic: true }, requires: ["frt_extra"],
    desc: "开局可选1件随机稀有遗物" }
]);
