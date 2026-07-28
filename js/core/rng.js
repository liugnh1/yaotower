// ===================== 种子随机器 =====================
export class RNG {
  constructor(s) { this.seed = s ? this.hash(s) : Date.now(); }
  hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
    return Math.abs(h) || 1;
  }
  next() { this.seed = (this.seed * 9301 + 49297) % 233280; return this.seed / 233280; }
  range(a, b) { return Math.floor(this.next() * (b - a + 1)) + a; }
  pick(arr) { return arr[this.range(0, arr.length - 1)]; }
  chance(p) { return this.next() < p; }
  // P2-10: 使用 Fisher-Yates 洗牌替代 sort() 比较器，保证均匀分布
  pickMulti(arr, n) {
    return this.shuffle(arr).slice(0, n);
  }
  // 洗牌
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
