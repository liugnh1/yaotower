// ===================== UI 效果（log / toast / float）=====================
// 统一的 UI 效果函数，所有模块通过 import 使用，不再各自定义

export function log(h, c = "") {
  const d = document.getElementById("log");
  if (!d) return;
  const s = document.createElement("div");
  s.className = c; s.innerHTML = h;
  d.appendChild(s); d.scrollTop = d.scrollHeight;
  while (d.children.length > 30) d.removeChild(d.firstChild);
}

export function toast(m) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = m; t.style.opacity = "1";
  setTimeout(() => { t.style.opacity = "0"; }, 2000);
}

export function float(txt, cls) {
  const fc = document.getElementById("float-container");
  if (!fc) return;
  const el = document.createElement("div");
  el.className = "float-text " + cls;
  el.textContent = txt;
  el.style.left = (40 + Math.random() * 20) + "%";
  el.style.top = "45%";
  fc.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
