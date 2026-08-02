// ===================== 配置校验（启动时扫描）=====================
// DLC 新增内容时自动检测缺失字段/异常值，控制台打印警告
// 不阻止游戏启动，只在控制台提示
import { R } from './registry.js';

// 每个 category 的必填字段
const REQUIRED = {
  classes: ['id', 'name', 'hp', 'atk', 'def', 'skills'],
  relics: ['id', 'name', 'rarity', 'desc', 'icon'],
  curses: ['id', 'name', 'desc', 'apply', 'remove'],
  talents: ['id', 'name', 'desc', 'apply'],
  potions: ['id', 'name', 'desc', 'fn'],
  enemies: null, // 嵌套对象 { poolName: [...] }，跳过
  bosses: null,   // 数字 key，跳过
  equipQualities: ['name', 'mul', 'weight'],
  equipTypes: ['type', 'name', 'stat', 'base'],
  equipPrefixes: ['name', 'statBonus'],
  difficulties: ['id', 'name', 'monsterMul'],
  dailyGlobalMods: ['id', 'name', 'desc', 'apply'],
  dailyPlayerMods: ['id', 'name', 'desc', 'apply'],
  dailyEnemyMods: ['id', 'name', 'desc', 'apply'],
  roomTypes: ['id', 'icon', 'name', 'desc'],
};

export function validateAll() {
  let warns = 0;
  for (const [category, fields] of Object.entries(REQUIRED)) {
    if (!fields) continue;
    const items = R.get(category);
    if (!items) { console.warn(`[校验] 类别 "${category}" 无数据`); warns++; continue; }
    const list = Array.isArray(items) ? items : Object.values(items);
    list.forEach((item, i) => {
      if (!item) return;
      for (const f of fields) {
        if (item[f] === undefined || item[f] === null) {
          const name = item.name || item.id || `[${i}]`;
          console.warn(`[校验] ${category}/${name} 缺少字段: ${f}`);
          warns++;
        }
      }
      // 数值合理性检查
      if (item.hp !== undefined && item.hp <= 0) console.warn(`[校验] ${item.name} hp=${item.hp} 异常`);
      if (item.atk !== undefined && item.atk < 0) console.warn(`[校验] ${item.name} atk=${item.atk} 异常`);
      if (item.max && item.max <= 0) console.warn(`[校验] ${item.name} max=${item.max} 异常`);
    });
    // 重复 ID 检查
    if (!Array.isArray(items)) {
      const ids = Object.keys(items);
      // 对象 key 本身就是 id，不会重复
    } else {
      const ids = list.map(x => x?.id).filter(Boolean);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      if (dupes.length) console.warn(`[校验] ${category} 重复ID: ${[...new Set(dupes)].join(', ')}`);
    }
  }
  if (warns === 0) console.log('[校验] 所有配置检查通过');
  else console.warn(`[校验] 共 ${warns} 个警告，详见上方`);
}
