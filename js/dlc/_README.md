# DLC 开发规范

## 如何添加新内容

### 1. 新职业（例：弓箭手）
```javascript
// js/dlc/dlc-archer.js
import { R } from '../core/registry.js';

R.register('classes', 'archer', {
  id: "archer", name: "弓箭手", icon: "🏹",
  hp: 80, maxHp: 80, mp: 30, maxMp: 30,
  atk: 20, def: 2, critRate: 0.20, critMul: 2.0,
  skillMul: 1.8, mpCost: 12, pen: 0.3,
  desc: "远程·高暴击·精准射击",
  skills: [ /* ... */ ]
});
// 然后在 main.js 最底部加一行：
// import '../dlc/dlc-archer.js';
// 在 defMeta 的 unlocks 数组中加 'archer'
```

### 2. 新区域
```javascript
R.register('zones', 'hell', {
  id: "hell", name: "炼狱深渊", icon: "🔥", bg: "#1a0000",
  enemyPool: "hell", desc: "烈焰与硫磺之地"
});
// 同时在 enemies 中添加 'hell' 怪物池
```

### 3. 新遗物
```javascript
R.registerAll('relics', [{
  id: "fire_heart", name: "烈焰之心", rarity: "legendary",
  desc: "所有攻击附加燃烧效果",
  icon: "🔥",
  onAttack: (p, dmg) => { /* ... */ }
}]);
```

### 4. 新事件订阅
```javascript
import { E, Events } from '../core/event-bus.js';
Events.on(E.BATTLE_WIN, (data) => {
  // 在每次战斗胜利后注入自定义行为
});
```

## 事件列表
见 `js/core/event-bus.js` 中的 `E` 常量。

## 原则
- DLC 文件只能 import core/ 模块，不能 import 其他 dlc/ 文件
- 使用 R.register() 注入数据，使用 Events.on() 注入行为
- 不要直接修改 Game.state
