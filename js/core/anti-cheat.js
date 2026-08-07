// ===================== v0.82 防篡改系统 =====================
// 多层防护：值混淆 + 影子比对 + 突变检测 + 时间校验 + DevTools检测
// 针对：GG修改器、Cheat Engine、控制台注入、变速齿轮、存档篡改

// ===== 层1：值混淆存储 =====
// 每个关键值用独立的运行时密钥加密存储，内存扫描器无法定位
var _sessionSeed = 0; // 游戏启动时随机生成
var _keyTable = {};   // 每值独立的派生密钥

function _initSession() {
  // 会话种子：混合时间戳+随机数+硬编码盐
  _sessionSeed = ((Date.now() * 0x6D2B79F5) ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
}

function _deriveKey(valueName) {
  // 为每个值名派生独立的密钥（确定性，但依赖会话种子）
  var base = 0;
  for (var i = 0; i < valueName.length; i++) {
    base = ((base << 5) - base + valueName.charCodeAt(i)) | 0;
  }
  return (_sessionSeed ^ base ^ 0x5A3F7C2E) >>> 0;
}

function _getKey(name) {
  if (!_keyTable[name]) _keyTable[name] = _deriveKey(name);
  return _keyTable[name];
}

// 混淆：value → (value XOR key) * prime
var OBFUSCATE_PRIME = 0x7D3;
function _pack(value, name) {
  if (value == null || typeof value !== 'number' || isNaN(value)) return null;
  var key = _getKey(name);
  return ((value ^ key) * OBFUSCATE_PRIME) | 0;
}
// 反混淆
function _unpack(packed, name) {
  if (packed == null || typeof packed !== 'number' || isNaN(packed)) return null;
  var key = _getKey(name);
  return ((packed / OBFUSCATE_PRIME) | 0) ^ key;
}

// ===== 层2：影子存储 =====
// 每个关键值有2个影子副本，用不同的混淆方式存储
// 影子存在独立的 hiddenState 对象中（不暴露到 Game.state）
var _shadows = {};      // { valueName: { primary, secondary, lastKnown } }
var SHADOW_PRIME = 0x9D1;

function _shadowPack(value, name) {
  var key = _getKey(name) ^ 0x3C7A;
  return ((value ^ key) * SHADOW_PRIME) | 0;
}
function _shadowUnpack(packed, name) {
  var key = _getKey(name) ^ 0x3C7A;
  return ((packed / SHADOW_PRIME) | 0) ^ key;
}

// 写入影子值
function _writeShadow(name, value) {
  if (value == null || typeof value !== 'number' || isNaN(value)) return;
  if (!_shadows[name]) _shadows[name] = {};
  _shadows[name].primary = _pack(value, name + '_s1');
  _shadows[name].secondary = _shadowPack(value, name + '_s2');
  _shadows[name].lastKnown = value;
}

// 读取并验证影子值
function _verifyShadow(name) {
  var s = _shadows[name];
  if (!s) return { valid: true, value: null }; // 还没初始化，跳过
  var v1 = _unpack(s.primary, name + '_s1');
  var v2 = _shadowUnpack(s.secondary, name + '_s2');
  if (v1 === null || v2 === null) return { valid: false, value: null, reason: 'null_shadow' };
  if (v1 !== v2) return { valid: false, value: null, reason: 'shadow_mismatch', expected: v1, got: v2 };
  return { valid: true, value: v1 };
}

// ===== 层3：突变合法性检测 =====
// 记录每个值的最后合法值+时间，检测异常跳变
var _lastValid = {};    // { valueName: { value, time, changeLog: [] } }
var _changeLimits = {   // 单次变化上限（游戏逻辑不可能超过）
  gold: 200,            // 金币单次增加不可能超过200（正常最大~50）
  essence: 50,          // 灵蕴单次不可能超过50
  souls: 20,            // 魂晶
  stones: 30,           // 灵石
  forgeStones: 15,      // 锻造石
  materials: 20,        // 素材
  jadeSpirits: 10,      // 灵玉
  player_hp: 9999,      // HP可以大幅变化（治疗等），不严格限制
  player_atk: 100,      // 攻击力单次增加不可能超过100
};

function _validateMutation(name, newValue, source) {
  var prev = _lastValid[name];
  if (!prev) return true; // 首次赋值，放行

  var delta = newValue - prev.value;
  var limit = _changeLimits[name] || 9999;

  // 减少通常合法（消费），但异常大幅减少也检测
  if (delta < -999999) {
    console.warn('[反作弊] 异常减少:', name, delta, '来源:', source);
    return false;
  }

  // 增加超过上限
  if (delta > limit) {
    console.warn('[反作弊] 异常增加:', name, '+'+delta, '上限:', limit, '来源:', source);
    return false;
  }

  // 负值检测
  if (newValue < 0 && name !== 'player_hp') {
    console.warn('[反作弊] 负值:', name, newValue);
    return false;
  }

  return true;
}

function _recordMutation(name, value) {
  if (!_lastValid[name]) _lastValid[name] = { changeLog: [] };
  _lastValid[name].value = value;
  _lastValid[name].time = Date.now();
  // 保留最近5条变更记录用于审计
  var log = _lastValid[name].changeLog;
  log.push({ value: value, time: Date.now() });
  if (log.length > 5) log.shift();
}

// ===== 层4: DevTools 检测 =====
var _devtoolsDetected = false;
var _devtoolsWarningCount = 0;

function _checkDevTools() {
  // 方法1: console.log 特征检测
  var devtoolsOpen = false;

  // 阈值检测：将一个大对象打印到console，测量执行时间
  // devtools打开时console操作会显著变慢
  var threshold = 50; // ms
  var start = performance ? performance.now() : Date.now();
  var obj = {};
  for (var i = 0; i < 1000; i++) obj['k' + i] = i;
  var consoleStart = performance ? performance.now() : Date.now();
  try { console.log(obj); } catch(e) {}
  var consoleEnd = performance ? performance.now() : Date.now();
  try { console.clear(); } catch(e) {}
  var duration = consoleEnd - consoleStart;
  if (duration > threshold) { devtoolsOpen = true; }

  // 方法2: debugger 时间差检测
  var dbgStart = performance ? performance.now() : Date.now();
  debugger; // eslint-disable-line
  var dbgEnd = performance ? performance.now() : Date.now();
  if (dbgEnd - dbgStart > 100) { devtoolsOpen = true; }

  // 方法3: window尺寸异常检测（devtools通常占窗口一部分）
  if (typeof window !== 'undefined' && window.outerHeight && window.innerHeight) {
    var ratio = window.innerHeight / window.outerHeight;
    if (ratio < 0.6) { devtoolsOpen = true; }
  }

  if (devtoolsOpen && !_devtoolsDetected) {
    _devtoolsWarningCount++;
    _devtoolsDetected = true;
    if (_devtoolsWarningCount >= 3) {
      console.warn('[反作弊] DevTools 多次检测到开启');
      return true;
    }
  }
  if (!devtoolsOpen) { _devtoolsDetected = false; }
  return false;
}

// ===== 层5: 时间校验（防变速齿轮）=====
var _timeTracking = { lastReal: 0, lastGame: 0, violations: 0 };

function _checkTimeIntegrity(gameTime) {
  var realTime = Date.now();
  if (!_timeTracking.lastReal) {
    _timeTracking.lastReal = realTime;
    _timeTracking.lastGame = gameTime || 0;
    return true;
  }
  var realDelta = realTime - _timeTracking.lastReal;
  var gameDelta = (gameTime || 0) - _timeTracking.lastGame;

  // 游戏时间不应该比真实时间快太多（允许1.5倍，因为自动战斗会加速）
  // 超过3倍则可能是变速齿轮
  if (realDelta > 1000 && gameDelta > 0) {
    var speedRatio = gameDelta / realDelta;
    if (speedRatio > 3.0) {
      _timeTracking.violations++;
      console.warn('[反作弊] 疑似变速: 游戏速度' + speedRatio.toFixed(1) + 'x');
      if (_timeTracking.violations >= 3) return false;
    } else if (speedRatio < 0.1 && realDelta > 60000) {
      // 游戏时间几乎停滞但真实时间在走 → 可能冻结了游戏计时器
      _timeTracking.violations++;
      if (_timeTracking.violations >= 3) return false;
    }
  }

  _timeTracking.lastReal = realTime;
  _timeTracking.lastGame = gameTime || 0;
  return true;
}

// ===== 层6: 原型完整性检测 =====
var _protoSnapshots = {};

function _snapshotPrototypes() {
  try {
    _protoSnapshots.Array = {
      push: Array.prototype.push,
      splice: Array.prototype.splice,
      map: Array.prototype.map,
      filter: Array.prototype.filter,
      forEach: Array.prototype.forEach,
      indexOf: Array.prototype.indexOf
    };
    _protoSnapshots.Object = {
      keys: Object.keys,
      assign: Object.assign
    };
    _protoSnapshots.Math = {
      random: Math.random,
      floor: Math.floor
    };
    _protoSnapshots.JSON = {
      parse: JSON.parse,
      stringify: JSON.stringify
    };
  } catch(e) {}
}

function _checkPrototypes() {
  try {
    if (Array.prototype.push !== _protoSnapshots.Array.push) return false;
    if (Array.prototype.indexOf !== _protoSnapshots.Array.indexOf) return false;
    if (Math.random !== _protoSnapshots.Math.random) return false;
    if (JSON.parse !== _protoSnapshots.JSON.parse) return false;
    return true;
  } catch(e) { return false; }
}

// ===== 对外 API =====

/** 初始化防篡改系统（游戏启动时调用一次） */
export function initAntiCheat() {
  _initSession();
  _snapshotPrototypes();
  console.log('[反作弊] 会话种子已初始化 · 7层防护激活');
}

/** 上报合法值变更（每次游戏逻辑修改关键值时调用） */
export function trackValue(name, value) {
  if (value == null) return;
  _writeShadow(name, value);
  _recordMutation(name, value);
}

/** 校验单个值是否被篡改 */
export function verifyValue(name, currentValue) {
  // 1. 影子比对
  var shadow = _verifyShadow(name);
  if (!shadow.valid) {
    console.warn('[反作弊] ' + name + ' 影子校验失败: ' + shadow.reason);
    return { valid: false, reason: 'shadow_' + shadow.reason };
  }

  // 2. 突变检测
  var prev = _lastValid[name];
  if (prev && prev.value !== undefined) {
    // 影子值应该是上次记录的合法值
    var expected = shadow.value !== null ? shadow.value : prev.value;
    // 允许小幅偏差（如治疗/消耗等）
    var tolerance = (name === 'gold') ? 60 : (_changeLimits[name] || 9999);
    if (Math.abs(currentValue - expected) > tolerance && expected !== 0) {
      console.warn('[反作弊] ' + name + ' 值异常: 当前=' + currentValue + ' 期望≈' + expected + ' 偏差=' + Math.abs(currentValue-expected));
      // 再次确认影子内部一致性
      if (shadow.value !== null && Math.abs(currentValue - shadow.value) > tolerance) {
        return { valid: false, reason: 'value_mismatch', current: currentValue, expected: expected };
      }
    }
  }

  // 3. 负值检测
  if (currentValue < 0 && name !== 'player_hp') {
    return { valid: false, reason: 'negative_value' };
  }

  return { valid: true };
}

/** 全局完整性巡检（每10秒调用一次） */
export function integrityCheck(state, meta) {
  var issues = [];

  // 检查原型完整性
  if (!_checkPrototypes()) {
    issues.push('prototype_tampered');
  }

  // 检查meta关键值
  if (meta) {
    var metaChecks = ['essence', 'souls', 'stones', 'forgeStones', 'materials', 'jadeSpirits'];
    for (var i = 0; i < metaChecks.length; i++) {
      var key = metaChecks[i];
      var val = meta[key];
      if (val != null) {
        var result = verifyValue(key, val);
        if (!result.valid) issues.push('meta_' + key + '_' + result.reason);
      }
    }
  }

  // 检查state关键值
  if (state) {
    if (state.gold != null) {
      var gr = verifyValue('gold', state.gold);
      if (!gr.valid) issues.push('gold_' + gr.reason);
    }
    if (state.player) {
      if (state.player.atk != null) {
        var ar = verifyValue('player_atk', state.player.atk);
        if (!ar.valid) issues.push('atk_' + ar.reason);
      }
    }
  }

  // 时间校验（检测变速齿轮）
  if (state && state.turn != null) {
    if (!_checkTimeIntegrity(state.turn)) {
      issues.push('speed_hack');
    }
  }

  return issues;
}

/** DevTools 检测 */
export function checkDebugger() {
  return _checkDevTools();
}

/** 获取会话种子哈希（用于存档签名增强） */
export function getSessionHash() {
  return (_sessionSeed >>> 0).toString(36);
}

/** 反混淆值（仅供调试/存档序列化） */
export function revealValue(packed, name) {
  return _unpack(packed, name);
}
/** 混淆值（存档序列化前） */
export function concealValue(value, name) {
  return _pack(value, name);
}

// 初始化会话种子
_initSession();
