// ===================== 音效系统 v2 =====================
// 音效：Web Audio API 程序化生成（无需外部文件）
// 音乐：HTML5 Audio 播放外部 mp3/ogg 文件
let ctx = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { console.warn("[妖塔勇者录] 音频初始化失败"); }
}

// ===================== 背景音乐系统 =====================
const MUSIC_DIR = 'audio/';
const MUSIC_FILES = {
  menu:    'bgm_menu',     // 主界面
  battle:  'bgm_battle',   // 普通战斗
  boss:    'bgm_boss',     // Boss战
  victory: 'bgm_victory',  // 胜利结算
  defeat:  'bgm_defeat',   // 失败结算
};
// 音乐格式：默认 ogg，如需 mp3 把下面改成 'mp3'
const MUSIC_EXT = 'ogg';

let _currentMusic = null;
let _musicVolume = 0.35;
let _musicMuted = false;
let _pendingPlay = null;
let _musicAvailable = true;

function _loadMusic(name, loop) {
  var audio = new Audio();
  audio.loop = (loop !== false);
  audio.volume = _musicVolume;
  audio.preload = 'auto';
  audio.src = MUSIC_DIR + name + '.' + MUSIC_EXT;
  audio.addEventListener('error', function() {
    _musicAvailable = false;
  });
  return audio;
}

/** 播放指定场景的背景音乐（自动淡入、循环） */
export function playMusic(track) {
  if (_musicMuted) { _pendingPlay = track; return; }
  var name = MUSIC_FILES[track];
  if (!name) return;

  // 相同曲目已在播放 → 跳过
  if (_currentMusic && _currentMusic._trackName === track) return;

  stopMusic(false);

  var loop = (track !== 'victory' && track !== 'defeat'); // 结算音乐不循环
  var audio = _loadMusic(name, loop);
  audio._trackName = track;
  audio.volume = 0;
  audio.play().then(function() {
    _fadeIn(audio);
    _pendingPlay = null; // 播放成功，清除排队
  }).catch(function(e) {
    // autoplay 策略阻止 → 丢弃当前 Audio，排队等用户交互后重建
    if (e.name === 'NotAllowedError') {
      _currentMusic = null;  // 清掉失败的，让重试能创建新的 Audio
      _pendingPlay = track;
      _ensureResumeListener();
    }
  });
  _currentMusic = audio;
}

// 保证点击监听器始终在线（直到音乐真正开始播放）
var _resumeListenerActive = false;
function _ensureResumeListener() {
  if (_resumeListenerActive) return;
  _resumeListenerActive = true;
  function tryPlay() {
    if (!_pendingPlay || _musicMuted) return;
    var t = _pendingPlay; _pendingPlay = null;
    playMusic(t);
  }
  document.addEventListener('click', tryPlay);
  document.addEventListener('keydown', tryPlay);
  // 一旦有音乐成功播放，移除监听
  var origFadeIn = _fadeIn;
  _fadeIn = function(a, d) {
    _resumeListenerActive = false;
    document.removeEventListener('click', tryPlay);
    document.removeEventListener('keydown', tryPlay);
    _fadeIn = origFadeIn;
    return origFadeIn(a, d);
  };
}

/** 停止背景音乐（可选保留引用给淡出） */
export function stopMusic(fadeOut = true) {
  if (!_currentMusic) return;
  var a = _currentMusic;
  if (fadeOut) {
    _fadeOut(a, function() { a.pause(); a.src = ''; });
  } else {
    a.pause(); a.src = '';
  }
  _currentMusic = null;
}

/** 暂停/恢复音乐 */
export function setMusicMuted(muted) {
  _musicMuted = muted;
  if (muted) {
    if (_currentMusic) { _currentMusic.pause(); }
  } else {
    if (_pendingPlay) { playMusic(_pendingPlay); _pendingPlay = null; }
    else if (_currentMusic) { _currentMusic.play().catch(function(){}); }
  }
}
export function isMusicMuted() { return _musicMuted; }

/** 设置音乐音量 0.0 ~ 1.0 */
export function setMusicVolume(v) {
  _musicVolume = Math.max(0, Math.min(1, v));
  if (_currentMusic) _currentMusic.volume = _musicVolume;
}

// 淡入淡出
function _fadeIn(audio, dur = 800) {
  var step = 30, delta = _musicVolume / (dur / step);
  audio.volume = 0;
  var t = setInterval(function() {
    if (!audio || audio.paused) { clearInterval(t); return; }
    var v = Math.min(_musicVolume, audio.volume + delta);
    audio.volume = v;
    if (v >= _musicVolume) clearInterval(t);
  }, step);
}
function _fadeOut(audio, cb, dur = 500) {
  var step = 30, delta = audio.volume / (dur / step);
  var t = setInterval(function() {
    if (!audio || audio.paused) { clearInterval(t); if (cb) cb(); return; }
    var v = Math.max(0, audio.volume - delta);
    audio.volume = v;
    if (v <= 0) { clearInterval(t); if (cb) cb(); }
  }, step);
}

// ===================== 程序化音效 =====================
function osc(type, freq, start, dur, gain = 0.1, dest = null) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.connect(g); g.connect(dest || ctx.destination);
  const n = ctx.currentTime;
  o.frequency.setValueAtTime(freq, n);
  g.gain.setValueAtTime(gain, n);
  g.gain.exponentialRampToValueAtTime(0.001, n + dur);
  o.start(n); o.stop(n + dur);
  return { osc: o, gain: g, startTime: n };
}

function noise(dur, gain = 0.05) {
  if (!ctx) return;
  const bufferSize = ctx.sampleRate * dur;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const g = ctx.createGain();
  source.connect(g); g.connect(ctx.destination);
  const n = ctx.currentTime;
  g.gain.setValueAtTime(gain, n);
  g.gain.exponentialRampToValueAtTime(0.001, n + dur);
  source.start(n); source.stop(n + dur);
}

function toneSeq(freqs, durEach, type = "sine", gain = 0.1) {
  if (!ctx) return;
  freqs.forEach((f, i) => osc(type, f, i * durEach, durEach * 1.2, gain));
}

// ---- 导出音效 ----
export function playSound(t) {
  if (!ctx) return;
  try {
    const n = ctx.currentTime;
    switch (t) {
      // === 战斗音效 ===
      case "attack":
        osc("square", 220, 0, 0.08, 0.1);
        noise(0.06, 0.03);
        break;
      case "crit":
        osc("sawtooth", 880, 0, 0.12, 0.15);
        osc("sine", 1760, 0.05, 0.2, 0.1);
        noise(0.08, 0.04);
        // 二次回响
        setTimeout(() => osc("sine", 1320, 0, 0.1, 0.06), 80);
        break;
      case "skill":
        osc("sine", 440, 0, 0.15, 0.1);
        osc("sine", 660, 0.08, 0.2, 0.08);
        osc("triangle", 880, 0.15, 0.15, 0.06);
        break;
      case "hit":
        osc("triangle", 120, 0, 0.15, 0.15);
        noise(0.1, 0.06);
        break;
      case "heavyHit":
        osc("triangle", 80, 0, 0.2, 0.2);
        noise(0.15, 0.08);
        break;
      // === 结果音效 ===
      case "win":
        toneSeq([523, 659, 784, 1047], 0.1, "sine", 0.12);
        setTimeout(() => toneSeq([1047, 1319], 0.15, "sine", 0.08), 450);
        break;
      case "lose":
        toneSeq([400, 350, 300, 200], 0.15, "triangle", 0.12);
        break;
      // === 物品音效 ===
      case "equip":
        osc("sine", 1200, 0, 0.08, 0.06);
        osc("sine", 1800, 0.06, 0.1, 0.05);
        break;
      case "relic":
        osc("sine", 800, 0, 0.08, 0.06);
        osc("sine", 1200, 0.05, 0.12, 0.06);
        osc("sine", 1600, 0.1, 0.1, 0.04);
        break;
      case "heal":
        osc("sine", 523, 0, 0.2, 0.08);
        osc("sine", 659, 0.15, 0.2, 0.06);
        break;
      case "potion":
        osc("sine", 700, 0, 0.1, 0.08);
        osc("sine", 1000, 0.08, 0.15, 0.06);
        break;
      case "gold":
        osc("sine", 1400, 0, 0.06, 0.05);
        osc("sine", 1800, 0.04, 0.08, 0.04);
        break;
      // === UI音效 ===
      case "click":
        osc("sine", 600, 0, 0.04, 0.04);
        break;
      case "select":
        osc("sine", 800, 0, 0.06, 0.05);
        break;
      case "levelUp":
        toneSeq([523, 659, 784, 1047, 1319], 0.06, "sine", 0.08);
        break;
      case "achievement":
        toneSeq([784, 1047, 1319, 1568], 0.08, "sine", 0.1);
        osc("triangle", 784, 0.35, 0.3, 0.06);
        break;
      // === 特殊 ===
      case "bossRoar":
        osc("sawtooth", 60, 0, 0.3, 0.12);
        osc("square", 120, 0.1, 0.4, 0.08);
        noise(0.3, 0.06);
        break;
      case "dodge":
        osc("sine", 400, 0, 0.1, 0.04);
        osc("sine", 600, 0.05, 0.1, 0.03);
        break;
      case "heartbeat":
        osc("triangle", 40, 0, 0.15, 0.08);
        setTimeout(() => osc("triangle", 40, 0, 0.15, 0.08), 200);
        break;
      default:
        osc("sine", 440, 0, 0.1, 0.05);
    }
  } catch (e) { /* 静默失败 */ }
}

// ---- 心跳循环（低血量时调用） ----
let _heartbeatTimer = null;
export function startHeartbeat() {
  stopHeartbeat();
  if (!ctx) return;
  const tick = () => {
    playSound("heartbeat");
    _heartbeatTimer = setTimeout(tick, 1200);
  };
  tick();
}
export function stopHeartbeat() {
  if (_heartbeatTimer) { clearTimeout(_heartbeatTimer); _heartbeatTimer = null; }
}
