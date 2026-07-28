// ===================== 动态注册中心（地基）=====================
// DLC 文件只需 import R 然后调用 R.register() 即可注入内容。
// 不再需要手动修改 Registry 聚合对象。
import { Events } from './event-bus.js';

class Registry {
  constructor() {
    // 按类别存储：对象（按id索引）或数组（列表）
    this._store = {
      classes: {}, zones: {}, enemies: {}, bosses: {},
      endlessBosses: [], talents: [], relics: [], curses: [],
      monsterTags: [], equipQualities: [], equipTypes: [],
      equipPrefixes: [], potions: [], difficulties: {},
      dailyGlobalMods: [], dailyPlayerMods: [], dailyEnemyMods: [],
      metaLimits: {}, roomTypes: {}, roomTemplates: { simple: [], normal: [] },
      simpleRoute: [], synergies: []
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
      store.push(...items);
    } else {
      Object.assign(store, items);
    }
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
