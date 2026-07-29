// ===================== 音效系统 v2 =====================
// 使用 Web Audio API 生成程序化音效，无需外部音频文件
let ctx = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { console.warn("[妖塔] 音频初始化失败"); }
}

// ---- 工具函数 ----
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
