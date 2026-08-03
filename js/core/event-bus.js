// ===================== 事件总线（地基）=====================
// 所有模块间通信的唯一渠道。DLC 通过 Events.on() 注入行为。
class EventBus {
  constructor() { this._listeners = {}; this._depth = {}; }

  on(event, fn) {
    (this._listeners[event] || (this._listeners[event] = [])).push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const list = this._listeners[event];
    if (list) { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); }
  }

  emit(event, data) {
    // 递归深度保护：同一事件最多嵌套10层
    this._depth[event] = (this._depth[event] || 0) + 1;
    if (this._depth[event] > 10) { this._depth[event]--; console.error('EventBus: 递归溢出', event); return; }
    const list = (this._listeners[event] || []).slice();
    list.forEach(fn => { try { fn(data); } catch (e) { console.error('EventBus:', event, e); } });
    this._depth[event]--;
  }

  clear(event) { delete this._listeners[event]; }

  // v0.50 批量清理频道（按前缀匹配，如 "battle:"）
  clearChannel(channel) {
    var prefix = channel + ':';
    var self = this;
    Object.keys(this._listeners).forEach(function(key) {
      if (key.indexOf(prefix) === 0) delete self._listeners[key];
    });
  }
}

export const Events = new EventBus();

// ===================== 事件名常量 =====================
// 使用常量避免拼写错误
export const E = {
  BATTLE_START:    'battle:start',
  BATTLE_WIN:      'battle:win',
  BATTLE_LOSE:     'battle:lose',
  PLAYER_DAMAGED:  'player:damaged',
  PLAYER_HEALED:   'player:healed',
  ENEMY_KILLED:    'enemy:killed',
  TURN_END:        'turn:end',
  EQUIP_GAINED:    'equip:gained',
  RELIC_GAINED:    'relic:gained',
  RELIC_REMOVED:   'relic:removed',
  CURSE_APPLIED:   'curse:applied',
  CURSE_REMOVED:   'curse:removed',
  GOLD_CHANGED:    'gold:changed',
  ROOM_ENTER:      'room:enter',
  ZONE_CHANGE:     'zone:change',
  GAME_OVER:       'game:over',
  GAME_CLEAR:      'game:clear',
  META_UPGRADED:   'meta:upgraded',
  REGISTRY_UPDATED:'registry:updated',
  // v0.80: 替代 window._* 全局函数
  EQUIP_DISCARD:   'equip:discard',
  RELICS_FULL:     'relics:full',
  SHOW_ACH_PANEL:  'ui:showAchPanel',
};
