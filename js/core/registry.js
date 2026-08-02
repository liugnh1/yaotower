// ===================== 动态注册中心（地基）=====================
// DLC 文件只需 import R 然后调用 R.register() 即可注入内容。
// 不再需要手动修改 Registry 聚合对象。
import { Events } from './event-bus.js';

class Registry {
  constructor() {
    // 按类别存储：对象（按id索引）或数组（列表）
    this._store = {
      classes: {}, zones: {}, enemies: {}, bosses: {}, bosses_hell: {},
      endlessBosses: [], talents: [], relics: [], curses: [],
      monsterTags: [], equipQualities: [], equipTypes: [],
      equipPrefixes: [], potions: [], difficulties: {},
      dailyGlobalMods: [], dailyPlayerMods: [], dailyEnemyMods: [],
      roomTypes: {}, roomTemplates: {},
      simpleRoute: {}, synergies: [], achievements: [],
      dailyQuests: [], weeklyQuests: [],
      forgeRecipes: [], bossMaterials: {}, extraMaterials: [],
      skillRecipes: [], talentTree: [],  // v0.50 天赋树
      classMasterySkills: {}, classMasteryRelics: {}, classAdvancements: {}, awakeningPassives: {},  // v0.50
      hiddenLegendaries: [], fateBrands: [],  // v0.50
      dungeons: {}, dungeonEnchants: {}, dungeonRunes: [], towerMods: [],  // v0.60 深渊裂隙
      bossRushT1: [], bossRushT2: [], bossRushT3: [], bossRushT4: []  // v0.70 Boss Rush专属
    };
  }

  // ---- 核心 API ----

  /** DLC 唯一入口：注册单个内容 */
  register(category, id, data) {
    const store = this._store[category];
    if (!store) { console.warn(`Registry: unknown category "${category}"`); return; }
    if (Array.isArray(store)) {
      store.push(data);
    } else {
      store[id] = data;
    }
  }

  /** 批量注册（content 迁移文件使用） */
  registerAll(category, items) {
    const store = this._store[category];
    if (!store) { console.warn(`Registry: unknown category "${category}"`); return; }
    if (Array.isArray(store)) {
      // v0.50 查重
      items.forEach(function(item) {
        if (item && item.id) {
          var dup = store.find(function(s) { return s.id === item.id; });
          if (dup) { console.warn('Registry: 重复注册 [' + category + '] ' + item.id + ' — 已跳过'); return; }
        }
        store.push(item);
      });
    } else {
      // 对象类型：检查key冲突
      Object.keys(items).forEach(function(k) {
        if (store.hasOwnProperty(k)) { console.warn('Registry: 重复key [' + category + '] ' + k + ' — 将被覆盖'); }
      });
      Object.assign(store, items);
    }
  }

  has(category, id) {
    var store = this._store[category];
    if (!store) return false;
    if (Array.isArray(store)) return store.some(function(s) { return s.id === id; });
    return !!store[id];
  }

  /** 获取内容。id 为空时返回整个类别 */
  get(category, id) {
    return id != null ? this._store[category]?.[id] : this._store[category];
  }

  /** 从类别中随机选取（需要 rng） */
  pick(category, rng) {
    const s = this._store[category];
    if (!s) return null;
    if (Array.isArray(s)) return s.length ? rng.pick(s) : null;
    const keys = Object.keys(s);
    return keys.length ? s[rng.pick(keys)] : null;
  }
}

export const R = new Registry();

// ===================== 常用访问快捷方式 =====================
// 兼容旧代码 Registry.xxx 的写法，通过 Proxy 路由
// 用法：import { Reg } from './registry.js'; Reg.classes.warrior
export const Reg = new Proxy(R, {
  get(target, prop) {
    if (prop in target) return target[prop];       // 方法优先
    return target.get(prop);                        // 否则当作类别名
  }
});
