// 房间模板 — 类以撒结合的房间排列
// 每个 Zone 必定包含：战斗×5-6 / 商店×1 / 宝箱×1 / 特殊房×1 / Boss×1 / 精英×0-1
// 前2间固定为战斗（暖场攒钱），Boss固定末尾，其余位置有限随机打乱
import { R } from '../core/registry.js';

// 每关10间房的结构模板（不含Boss，Boss由initZone固定追加在末尾）
// battle=战斗 shop=商店 chest=宝箱 event=随机事件 shrine=神龛 altar=祭坛 elite=精英
const STRUCTURES = [
  // 模板1：常规，精英在中段
  ["battle","battle","battle","shop","chest","battle","elite","shrine","battle"],
  // 模板2：精英靠后
  ["battle","battle","shop","battle","chest","battle","event","elite","battle"],
  // 模板3：双特殊房
  ["battle","battle","battle","shop","shrine","battle","chest","battle","elite"],
  // 模板4：祭坛变体
  ["battle","battle","shop","battle","altar","chest","battle","elite","battle"],
  // 模板5：店靠前变体
  ["battle","battle","shop","battle","battle","chest","elite","event","battle"],
  // 模板6：精英在前的挑战型
  ["battle","elite","battle","shop","battle","chest","shrine","battle","battle"],
];

R.registerAll('roomTemplates', {
  simple: STRUCTURES,
  normal: []
});
