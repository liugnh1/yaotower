// 房间模板 — 类以撒结合的房间排列
// 每个 Zone 必定包含：战斗×5-6 / 商店×1 / 宝箱×1 / 特殊房×1 / Boss×1 / 精英×0-1
// 前2间固定为战斗（暖场攒钱），Boss固定末尾，其余位置有限随机打乱
import { R } from '../core/registry.js';

// 每关9间房 + Boss的结构模板
// 规则：前3间强制战斗暖场 → 商店最早在第4间 → 精英/特殊房分布中后段
// battle=战斗 shop=商店 chest=宝箱 event=随机事件 shrine=神龛 altar=祭坛 elite=精英
const STRUCTURES = [
  // 模板1：常规 — 店在第4，精英第7，神龛第8
  ["battle","battle","battle","shop","chest","battle","elite","shrine","battle"],
  // 模板2：店靠后 — 店在第6，精英第8
  ["battle","battle","battle","chest","battle","shop","battle","elite","battle"],
  // 模板3：双特殊 — 店在第4，神龛第5，精英在末
  ["battle","battle","battle","shop","shrine","battle","chest","battle","elite"],
  // 模板4：祭坛变体 — 店在第4，祭坛第6
  ["battle","battle","battle","shop","battle","altar","chest","elite","battle"],
  // 模板5：事件流 — 店在第4，事件第7，精英第8
  ["battle","battle","battle","shop","chest","battle","event","elite","battle"],
  // 模板6：精英前置 — 店在第4，精英第2（高回报高风险）
  ["battle","elite","battle","shop","battle","chest","shrine","battle","battle"],
];

R.registerAll('roomTemplates', {
  simple: STRUCTURES,
  normal: []
});
