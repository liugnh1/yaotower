// 房间类型定义
import { R } from '../core/registry.js';

R.registerAll('roomTypes', {
  battle:  { id: "battle",  icon: "👹", name: "战斗", desc: "遭遇怪物",        color: "#ff7b7b" },
  elite:   { id: "elite",   icon: "👺", name: "精英", desc: "强敌，高级奖励",   color: "#ff4444" },
  shop:    { id: "shop",    icon: "🏪", name: "商店", desc: "购买道具与装备",   color: "#70a1ff" },
  chest:   { id: "chest",   icon: "📦", name: "宝箱", desc: "免费奖励",         color: "#ffa502" },
  event:   { id: "event",   icon: "❓", name: "事件", desc: "随机遭遇",         color: "#89e894" },
  boss:    { id: "boss",    icon: "💀", name: "Boss", desc: "关底首领",         color: "#ffa502" },
  shrine:  { id: "shrine",  icon: "⛩️", name: "神龛", desc: "献祭换祝福",       color: "#c8a8ff" },
  altar:   { id: "altar",   icon: "☠️", name: "祭坛", desc: "诅咒换遗物",       color: "#ff4444" }
});
