// HUD: vitals, stars, cash, clock, objective, prompts, phone dialog
// (bottom-right, clear of the vitals top-left), minimap, menus, save/load.
import { MISSIONS } from './missions.js';
import { SAVE_KEY } from './config.js';

export function createHud(S) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    el: { stars: $('stars'), health: $('healthFill'), armor: $('armorFill'), cash: $('cash'), clock: $('clock'), objective: $('objective'), prompt: $('prompt'), dialog: $('dialog'), speed: $('speedNum'), weapon: $('weapon'), minimap: $('minimap'), title: $('title'), pause: $('pause'), over: $('over'), missionEnd: $('missionEnd') },
    promptTimer: 0, dialogTimer: 0, objectiveText: 'SOLARA BAY',
    setObjective(t) { this.objectiveText = t; this.el.objective.textContent = t; },
    showPrompt(t, dur = 2.5) { this.el.prompt.textContent = t; this.el.prompt.style.display = 'block'; this.promptTimer = dur; },
    hidePrompt() { this.el.prompt.style.display = 'none'; },
    showDialog(who, text) {
      this.el.dialog.querySelector('.who').textContent = who + ' — phone';
      this.el.dialog.querySelector('.text').textContent = text;
      this.el.dialog.style.display = 'block'; this.dialogTimer = 7;
    },
    hideDialog() { this.el.dialog.style.display = 'none'; },
    showMissionEnd(title, text) {
      document.getElementById('endTitle').textContent = title;
      document.getElementById('endText').textContent = text;
      this.el.missionEnd.classList.remove('hidden'); S.phase = 'missionEnd';
    },
    showGameOver(title, text) {
      document.getElementById('overTitle').textContent = title;
      document.getElementById('overText').textContent = text || '';
      this.el.over.classList.remove('hidden'); S.phase = 'over';
    },
    showTitle() {
      this.el.title.classList.remove('hidden');
      this.el.pause.classList.add('hidden'); this.el.over.classList.add('hidden'); this.el.missionEnd.classList.add('hidden');
      S.phase = 'title';
    },
    showPause(show) { this.el.pause.classList.toggle('hidden', !show); },
    update(dt) {
      const p = S.player;
      this.el.health.style.width = p.hp + '%';
      this.el.armor.style.width = p.armor + '%';
      this.el.cash.textContent = '$' + p.cash;
      const w = S.police.wanted;
      this.el.stars.textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
      const h = Math.floor(S.timeHours) % 24, m = Math.floor((S.timeHours % 1) * 60);
      this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · CELESTE 98.1`;
      const speed = p.inCar && p.car ? Math.abs(p.car.speed) * 3.6 : 0;
      this.el.speed.textContent = Math.round(speed);
      this.el.weapon.textContent = p.weapon === 'fists' ? 'Fists' : `Vesper Pistol · ${p.ammo}/12`;
      if (this.promptTimer > 0) { this.promptTimer -= dt; if (this.promptTimer <= 0) this.hidePrompt(); }
      if (this.dialogTimer > 0) { this.dialogTimer -= dt; if (this.dialogTimer <= 0) this.hideDialog(); }
      if (S.missions.active) {
        const def = MISSIONS[S.missions.current];
        if (def.timer) this.el.objective.textContent = `${this.objectiveText} · ${Math.ceil(S.missions.timer)}s`;
      }
      this.drawMinimap();
    },
    drawMinimap() {
      const cv = this.el.minimap; if (!cv) return;
      const g = cv.getContext('2d'); const W = 180, scale = W / 640;
      g.clearRect(0, 0, W, W);
      g.fillStyle = '#0d2436'; g.fillRect(0, 0, W, W);
      g.fillStyle = '#2e7fb8'; g.fillRect(0, 0, 14, W); // sea west
      g.fillStyle = '#e8d49a'; g.fillRect(14, 0, 5, W); // beach
      g.strokeStyle = '#8a929c'; g.lineWidth = 2;
      for (const x of [-240, -160, -80, 0, 80, 160, 240]) { g.beginPath(); g.moveTo((x + 320) * scale, 0); g.lineTo((x + 320) * scale, W); g.stroke(); }
      for (const z of [-240, -160, -80, 0, 80, 160, 240]) { g.beginPath(); g.moveTo(0, (z + 320) * scale); g.lineTo(W, (z + 320) * scale); g.stroke(); }
      const dot = (x, z, color, r = 3) => { g.fillStyle = color; g.beginPath(); g.arc((x + 320) * scale, (z + 320) * scale, r, 0, 7); g.fill(); };
      dot(96, -64, '#37d67a', 4); // garage
      dot(80, -88, '#b46bff', 3); dot(160, 0, '#b46bff', 3); // shops
      if (S.missions.active) {
        const obj = MISSIONS[S.missions.current].objectives[S.missions.stage];
        if (obj) { dot(obj.x, obj.z, '#ffd23f', 5); }
      }
      for (const c of S.police.cars) dot(c.group.position.x, c.group.position.z, '#ff4444', 3);
      const p = S.player.mesh.position;
      g.fillStyle = '#fff';
      g.save(); g.translate((p.x + 320) * scale, (p.z + 320) * scale); g.rotate(-S.player.yaw);
      g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill(); g.restore();
    },
  };
  // Menu buttons.
  $('btnNew').onclick = () => { S.audio.ensure(); S.audio.startMusic(); S.newGame(); };
  $('btnContinue').onclick = () => { S.audio.ensure(); S.audio.startMusic(); S.loadGame() ? S.resumeFromSave() : S.newGame(); };
  $('btnResume').onclick = () => S.togglePause(false);
  $('btnRestart').onclick = () => { S.togglePause(false); S.missions.start(S.missions.current); S.resetPlayer(); };
  $('btnSave').onclick = () => { S.saveGame(); hud.showPrompt('Game saved'); };
  $('btnQuit').onclick = () => { S.saveGame(); S.togglePause(false); hud.showTitle(); };
  $('btnRetry').onclick = () => { hud.el.over.classList.add('hidden'); S.resetPlayer(); S.missions.start(S.missions.current); S.phase = 'playing'; };
  $('btnOverTitle').onclick = () => hud.showTitle();
  $('btnNext').onclick = () => {
    hud.el.missionEnd.classList.add('hidden'); S.phase = 'playing';
    const next = S.missions.current + 1;
    if (next < MISSIONS.length) S.missions.start(next);
    else hud.showTitle();
  };
  return hud;
}

export function saveGameData(S) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: S.player.cash, mission: Math.min(S.missions.current + 1, MISSIONS.length - 1),
      coins: S.missions.collected, hp: S.player.hp, armor: S.player.armor,
      stats: S.stats, x: S.player.mesh.position.x, z: S.player.mesh.position.z,
    }));
    return true;
  } catch { return false; }
}
export function loadGameData() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}
