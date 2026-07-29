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

R.registerAll('roomTemplates', {
  simple: STRUCTURES,
  normal: []
});
