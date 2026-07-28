// ===================== 屏幕/弹窗切换 =====================
export const SCREENS = ["start","difficulty-select","class-select","skill-select","talent-select","zone-select","room-select","main","gameover"];
export const MODALS = ["reward","shop","event","endless-choice","potion-modal","daily-panel","codex-panel","leaderboard"];

export function switchScreen(id) {
  SCREENS.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle("hidden", s !== id);
    else console.warn("[screens] switchScreen: element not found:", s);
  });
  if (id === "main") { const m = document.getElementById("main"); if (m) m.classList.remove("hidden"); }
  if (id === "gameover") { const g = document.getElementById("gameover"); if (g) g.style.display = "block"; }
}
export function showModal(id) { const el = document.getElementById(id); if (el) el.style.display = "block"; else console.warn("[screens] showModal: element not found:", id); }
export function hideModal(id) { const el = document.getElementById(id); if (el) el.style.display = "none"; }
export function hideAllModals() { MODALS.forEach(id => hideModal(id)); }
