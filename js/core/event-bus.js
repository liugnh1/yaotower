// ===================== 事件总线（地基）=====================
// 所有模块间通信的唯一渠道。DLC 通过 Events.on() 注入行为。
class EventBus {
  constructor() { this._listeners = {}; }

  on(event, fn) {
    (this._listeners[event] || (this._listeners[event] = [])).push(fn);
    return () => this.off(event, fn); // 返回取消订阅函数
  }

  off(event, fn) {
    const list = this._listeners[event];
    if (list) { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); }
  }

  emit(event, data) {
    // 复制一份再遍历，防止订阅者在回调中修改监听列表
    const list = (this._listeners[event] || []).slice();
    list.forEach(fn => { try { fn(data); } catch (e) { console.error('EventBus:', event, e); } });
  }

  // 清除某事件的所有监听（调试用）
  clear(event) { delete this._listeners[event]; }
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
};
