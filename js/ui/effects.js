// ===================== UI 效果 v2（log / toast / float / shake）=====================

export function log(h, c = "") {
  const d = document.getElementById("log");
  if (!d) return;
  const s = document.createElement("div");
  s.className = c; s.innerHTML = h;
  d.appendChild(s); d.scrollTop = d.scrollHeight;
  while (d.children.length > 6) d.removeChild(d.firstChild);
}

// 清除日志
export function clearLog() {
  const d = document.getElementById("log");
  if (d) d.innerHTML = "";
}

// 回合分隔线
export function logTurnSeparator(turn) {
  const d = document.getElementById("log");
  if (!d) return;
  const s = document.createElement("div");
  s.style.cssText = "text-align:center;color:#334466;font-size:10px;margin:4px 0;border-top:1px solid #1a2a40;padding-top:4px";
  s.textContent = `—— 回合 ${turn} ——`;
  d.appendChild(s); d.scrollTop = d.scrollHeight;
  while (d.children.length > 6) d.removeChild(d.firstChild);
}

export function toast(m) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = m; t.style.opacity = "1";
  setTimeout(() => { t.style.opacity = "0"; }, 2000);
}

// ---- 伤害飘字 ----
export function float(txt, cls) {
  const fc = document.getElementById("float-container");
  if (!fc) return;
  // DOM数量限制：超过30个飘字时移除最旧的
  if (fc.children.length > 30) fc.removeChild(fc.firstChild);
  const el = document.createElement("div");
  el.className = "float-text " + cls;
  el.textContent = txt;
  el.style.left = (40 + Math.random() * 20) + "%";
  el.style.top = "40%";
  fc.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

var _bigFloatCount = 0;
export function bigFloat(txt, cls, dur = 1200) {
  const fc = document.getElementById("float-container");
  if (!fc) return;
  // DOM数量限制
  if (fc.children.length > 20) fc.removeChild(fc.firstChild);
  const el = document.createElement("div");
  el.className = "big-float " + cls;
  el.textContent = txt;
  el.style.left = "50%";
  el.style.top = "35%";
  el.style.transform = "translateX(-50%)";
  fc.appendChild(el);
  setTimeout(() => el.remove(), dur);
}

// 屏幕震动
export function screenShake(intensity = 1) {
  const main = document.getElementById("main");
  if (!main) return;
  const style = document.createElement("style");
  style.textContent = intensity > 1
    ? `#main.screen-shake{animation:screenShake .4s ease-out}`
    : `#main.screen-shake{animation:screenShake .3s ease-out}`;
  document.head.appendChild(style);
  main.classList.add("screen-shake");
  setTimeout(() => {
    main.classList.remove("screen-shake");
    style.remove();
  }, intensity > 1 ? 400 : 300);
}

// ===== 战斗竞技场动画 =====

// 玩家攻击动画
export function animPlayerAttack() {
  const sprite = document.getElementById("arena-player-sprite");
  const vs = document.getElementById("arena-vs");
  if (sprite) {
    sprite.classList.remove("arena-player-attack");
    void sprite.offsetWidth;
    sprite.classList.add("arena-player-attack");
  }
  if (vs) {
    vs.classList.remove("crit-spark");
    void vs.offsetWidth;
  }
}

// 玩家暴击动画
export function animPlayerCrit() {
  const sprite = document.getElementById("arena-player-sprite");
  const vs = document.getElementById("arena-vs");
  if (sprite) {
    sprite.classList.remove("arena-player-attack");
    void sprite.offsetWidth;
    sprite.classList.add("arena-crit");
  }
  if (vs) {
    vs.classList.add("crit-spark");
    setTimeout(() => vs.classList.remove("crit-spark"), 400);
  }
  bigFloat("暴击！💥", "big-crit");
  screenShake(1);
}

// 敌人受击
export function animEnemyHit() {
  const sprite = document.getElementById("arena-enemy-sprite");
  if (sprite) {
    sprite.classList.remove("arena-enemy-hit");
    void sprite.offsetWidth;
    sprite.classList.add("arena-enemy-hit");
  }
}

// 敌人攻击
export function animEnemyAttack() {
  const sprite = document.getElementById("arena-enemy-sprite");
  if (sprite) {
    sprite.classList.remove("arena-enemy-attack");
    void sprite.offsetWidth;
    sprite.classList.add("arena-enemy-attack");
  }
}

// 玩家受击
export function animPlayerHit() {
  const sprite = document.getElementById("arena-player-sprite");
  const main = document.getElementById("main");
  if (sprite) {
    sprite.classList.remove("arena-player-hit");
    void sprite.offsetWidth;
    sprite.classList.add("arena-player-hit");
  }
  // 受重伤时震动
  if (main && main.classList.contains("low-hp")) {
    screenShake(1);
  }
}

// 敌人击杀
export function animEnemyKill() {
  const sprite = document.getElementById("arena-enemy-sprite");
  if (sprite) {
    sprite.classList.remove("arena-kill");
    void sprite.offsetWidth;
    sprite.classList.add("arena-kill");
  }
  screenShake(2);
}

// 闪避
export function animPlayerDodge() {
  const sprite = document.getElementById("arena-player-sprite");
  if (sprite) {
    sprite.classList.remove("arena-dodge");
    void sprite.offsetWidth;
    sprite.classList.add("arena-dodge");
  }
}

// 防御姿态
export function animPlayerDefend() {
  const sprite = document.getElementById("arena-player-sprite");
  if (sprite) {
    sprite.classList.remove("arena-defend");
    void sprite.offsetWidth;
    sprite.classList.add("arena-defend");
  }
}

// 更新竞技场角色显示
export function updateArena(playerIcon, playerLabel, enemyIcon, enemyLabel) {
  const ps = document.getElementById("arena-player-sprite");
  const pl = document.getElementById("arena-player-label");
  const es = document.getElementById("arena-enemy-sprite");
  const el = document.getElementById("arena-enemy-label");
  if (ps) ps.textContent = playerIcon || "⚔️";
  if (pl) pl.textContent = playerLabel || "勇者";
  if (es) es.textContent = enemyIcon || "👹";
  if (el) el.textContent = enemyLabel || "妖兽";
}

// ===== Boss 打字机叙事 =====
let _narrativeDone = false;
let _narrativeCallback = null;
let _narrativeTimer = null;

/**
 * 显示Boss叙事覆盖层
 * @param {string[]} lines - 要逐行打出的文字
 * @param {Function} onComplete - 叙事完成后的回调
 */
export function showBossNarrative(lines, onComplete) {
  if (!lines || lines.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  const el = document.getElementById("boss-narrative");
  const txt = document.getElementById("boss-narrative-text");
  if (!el || !txt) {
    if (onComplete) onComplete();
    return;
  }

  // 停止之前的叙事
  _narrativeDone = true;
  _narrativeCallback = null;
  if (_narrativeTimer) { clearTimeout(_narrativeTimer); _narrativeTimer = null; }

  el.style.display = "flex";
  el.classList.remove("fade-out");
  _narrativeDone = false;
  _narrativeCallback = onComplete;

  let lineIdx = 0, charIdx = 0;

  function typeNext() {
    if (_narrativeDone) return;
    if (lineIdx >= lines.length) { finishNarrative(); return; }

    if (charIdx === 0) {
      txt.innerHTML = "";
    }

    if (charIdx < lines[lineIdx].length) {
      txt.innerHTML = lines[lineIdx].substring(0, charIdx + 1) + '<span class="cursor"></span>';
      charIdx++;
      // Boss叙事稍慢，更有压迫感
      const delay = lines[lineIdx].startsWith('——') ? 100 : 55 + Math.random() * 35;
      _narrativeTimer = setTimeout(typeNext, delay);
    } else {
      txt.innerHTML = lines[lineIdx] + '<span class="cursor"></span>';
      charIdx = 0; lineIdx++;
      const pause = lines[lineIdx - 1] && lines[lineIdx - 1].startsWith('——') ? 600 : 350 + Math.random() * 200;
      _narrativeTimer = setTimeout(typeNext, pause);
    }
  }

  function finishNarrative() {
    _narrativeDone = true;
    const cb = _narrativeCallback;
    _narrativeCallback = null;
    el.classList.add("fade-out");
    setTimeout(() => {
      el.style.display = "none";
      if (cb) cb();
    }, 600);
  }

  // 点击跳过
  el.onclick = () => {
    if (!_narrativeDone) finishNarrative();
  };

  setTimeout(typeNext, 300);
}

