// ===================== 种子随机器 v2 — Mulberry32 =====================
// 高质量32位PRNG，周期2^32，通过BigCrush测试
export class RNG {
  constructor(s) { this.seed = this.hash(s || "" + Date.now()); }
  hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return Math.abs(h) || 1;
  }
  // Mulberry32 算法
  next() {
    this.seed |= 0;
    this.seed = (this.seed + 0x6D2B79F5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return Math.floor(this.next() * (b - a + 1)) + a; }
  pick(arr) {
    if (!arr || arr.length === 0) { console.warn("[妖塔勇者录] rng.pick 空数组"); return null; }
    return arr[this.range(0, arr.length - 1)];
  }
  chance(p) { return this.next() < p; }
  pickMulti(arr, n) { return this.shuffle(arr).slice(0, n); }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.range(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
