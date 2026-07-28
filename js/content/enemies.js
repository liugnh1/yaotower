// 怪物定义（按主题分组）
import { R } from '../core/registry.js';

R.registerAll('enemies', {
  plains: [
    { name: "野兔精",  hp: 25, atk: 6,  def: 0, exp: "不堪一击", icon: "🐰" },
    { name: "山魈",    hp: 40, atk: 8,  def: 1, exp: "略有身手", icon: "👹" },
    { name: "野狼",    hp: 55, atk: 10, def: 1, exp: "凶性毕露", icon: "🐺" }
  ],
  forest: [
    { name: "毒蜂",    hp: 35, atk: 12, def: 0, exp: "成群结队", icon: "🐝" },
    { name: "树妖",    hp: 70, atk: 10, def: 3, exp: "根深蒂固", icon: "🌳" },
    { name: "幽灵狼",  hp: 60, atk: 14, def: 1, exp: "来去无踪", icon: "👻" }
  ],
  cave: [
    { name: "矿洞鼠",  hp: 30, atk: 8,  def: 2, exp: "成群出没", icon: "🐀" },
    { name: "岩石怪",  hp: 90, atk: 9,  def: 6, exp: "坚如磐石", icon: "🪨" },
    { name: "蝙蝠群",  hp: 50, atk: 13, def: 0, exp: "遮天蔽日", icon: "🦇" }
  ]
});
