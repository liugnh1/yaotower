// ===================== 屏幕/弹窗切换 =====================
import { playMusic } from '../core/audio.js';

export const SCREENS = ["start","city-hub","difficulty-select","class-select","skill-select","talent-select","hunt-select","zone-select","room-select","main","gameover"];
export const MODALS = ["reward","shop","event","endless-choice","potion-modal","daily-panel","daily-checkin","leaderboard","compendium","tap-lb-panel","tap-cloud-panel","skill-popup"];

var _modalStack = [];
var _modalBaseZ = 1000;

export function switchScreen(id) {
  SCREENS.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle("hidden", s !== id);
    else console.warn("[screens] switchScreen: element not found:", s);
  });
  if (id === "main") { const m = document.getElementById("main"); if (m) m.classList.remove("hidden"); }
  if (id === "gameover") { const g = document.getElementById("gameover"); if (g) g.style.display = "block"; }
  // 返回主界面时恢复菜单音乐
  if (id === "start" || id === "city-hub") { playMusic('menu'); }
}

export function showModal(id) {
  const el = document.getElementById(id);
  if (!el) { console.warn("[screens] showModal: element not found:", id); return; }
  // z-index 层叠管理：后开的弹窗永远在最上面
  var idx = _modalStack.indexOf(id);
  if (idx >= 0) _modalStack.splice(idx, 1);
  _modalStack.push(id);
  el.style.zIndex = _modalBaseZ + _modalStack.length * 10;
  el.style.display = "block";
}

export function hideModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = "none"; el.style.zIndex = ""; }
  var idx = _modalStack.indexOf(id);
  if (idx >= 0) _modalStack.splice(idx, 1);
}

export function hideAllModals() {
  MODALS.forEach(id => hideModal(id));
  _modalStack = [];
}
