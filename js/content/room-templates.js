// 房间模板 — 压缩版：每Zone 5间+Boss=6间（原9+Boss）
import { R } from '../core/registry.js';

const STRUCTURES = [
  ["battle","battle","shop","chest","elite"],
  ["battle","battle","battle","shop","event"],
  ["battle","battle","chest","shrine","elite"],
  ["battle","shop","battle","altar","elite"],
  ["battle","battle","shop","event","elite"],
  ["battle","elite","battle","shop","chest"],
];

// 普通模式：10间
var NORMAL_STRUCTURES = [
  ["battle","battle","battle","shop","battle","chest","battle","shrine","battle","elite"],
  ["battle","battle","battle","chest","battle","shop","battle","event","elite","battle"],
  ["battle","battle","shop","battle","battle","altar","battle","chest","elite","battle"],
];
// 炼狱模式：20间
var HELL_STRUCTURES = [
  ["battle","battle","battle","shop","battle","chest","battle","shrine","battle","elite","battle","event","battle","shop","battle","altar","battle","chest","elite","battle"],
  ["battle","battle","shop","battle","battle","chest","battle","elite","battle","shrine","battle","event","battle","shop","battle","chest","battle","altar","elite","battle"],
];

R.registerAll('roomTemplates', {
  simple: STRUCTURES,
  normal: NORMAL_STRUCTURES,
  hell: HELL_STRUCTURES
});
