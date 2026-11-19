// 8 misi cerita SOLARA BAY + aktivitas sampingan (taksi, stunt jump,
// sun coin, garasi, respray, toko senjata). Marker 3D + minimap menunjuk
// tujuan; dialog Marco / Mara / Lupe di HUD.
import { mulberry32, rr, pick, clamp } from './random.js';
import { createCar } from './vehicles.js';
import { makePersonModel } from './traffic.js';
import { spawnGuards } from './combat.js';
import { buyWeapon } from './combat.js';
import { clearWantedAtRespray } from './police.js';
import { MALECON_X } from './city.js';
import { CFG } from './config.js';

export const MISSIONS = [
  { name: 'First Gear', reward: 500, obj: 'Curi VELOZ COMET RS merah, antar ke bengkel Mara', sub: 'Tekan E di dekat mobil · hindari PCPD' },
  { name: 'Meet Marco', reward: 300, obj: 'Temui Marco di Marlin Ceviche, Malecón Celeste', sub: 'Ikuti marker kuning di minimap' },
  { name: 'Courier Run', reward: 800, obj: 'Antar 3 paket ke checkpoint dalam 4 menit', sub: 'Tabrakan = paket rusak' },
  { name: 'Docks Job', reward: 1200, obj: 'Curi truk Hauler, lawan 4 penjaga, kabur bintang 2', sub: 'Tembak dengan klik kiri · R reload' },
  { name: 'Neon Nights', reward: 1000, obj: 'Buntuti kurir Dario tanpa ketahuan, lalu kejar dia', sub: 'Malam hari · jaga jarak 8–35 m' },
  { name: 'Street Race', reward: 1500, obj: 'Menangkan balapan jalanan di Malecón Celeste', sub: 'Lewati 4 checkpoint sebelum rival' },
  { name: 'Beach Party', reward: 900, obj: 'Pesta pantai: jetski lewati 3 buoy, lalu mancing di dermaga', sub: 'E — naik jetski · E — mancing' },
  { name: 'Golden Hour', reward: 5000, obj: 'Lolos manhunt sebelum kapal Marco berlayar', sub: 'Mereka melihatmu — putus line of sight!' },
];
const DIALOGS = [
  ['Mara', 'BENGKEL · MARA VOSS', 'Nico! Mobil merah itu — VELOZ COMET RS. Ambil, antar ke bengkelku. Jangan sampai PCPD lihat.'],
  ['Marco', 'SMUGGLER · WHEELMAN', 'Nico, akhirnya. Dario menguasai dermaga. Bantu aku, dan utangmu lunas sebelum matahari tenggelam.'],
  ['Kip', 'HACKER · KIP', 'Tiga paket, empat menit. Rute sudah di minimap. Jangan tabrak apa pun — paketnya rapuh.'],
  ['Marco', 'SMUGGLER · WHEELMAN', 'Truk Hauler di Docks penuh barang Dario. Empat penjaga. Ambil truknya, kabur ke garasi Mara.'],
  ['Lupe', 'RADIO · CELESTE 98.1', 'Malam ini kurir Dario lewat Malecón. Buntuti dari jauh, jangan sampai dia sadar — lalu kejar.'],
  ['Marco', 'SMUGGLER · WHEELMAN', 'Balapan malam ini di Malecón. Menang, dan seluruh kota tahu nama Nico. Kalah… jangan kalah.'],
  ['Lupe', 'RADIO · CELESTE 98.1', 'Pesta pantai di Marina Bay! Jetski dulu, tiga buoy — lalu mancing di ujung dermaga. Santai, Nico.'],
  ['Marco', 'SMUGGLER · WHEELMAN', 'Kapal berlayar dua menit lagi, Nico! Lepas dari manhunt itu dan kejar dermaga!'],
];
export function createMissions(W) {
  const beaconMat = new W.three.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.5 });
  const beacon = new W.three.Mesh(new W.three.CylinderGeometry(0.5, 2.2, 90, 12, 1, true), beaconMat);
  beacon.visible = false;
  W.scene.add(beacon);
  const ring = new W.three.Mesh(new W.three.TorusGeometry(2.4, 0.22, 8, 24),
    new W.three.MeshBasicMaterial({ color: 0xffd25a }));
  ring.rotation.x = Math.PI / 2; ring.visible = false;
  W.scene.add(ring);
  const M = {
    current: 0, stage: 0, timer: 0, flags: {}, marker: null,
    nearInteract: null, onInteract: null, beacon, ring,
    marco: null, courier: null, rivals: [], raceCp: 0, tailT: 0,
    taxiFare: null, taxiCd: 0, resprayT: 0, prevDriving: false,
    stuntCd: {}, fishT: 0,
  };
  W.missions = M;
  return M;
}
function setMarker(W, x, z) {
  const M = W.missions;
  M.marker = { x, z };
  M.beacon.position.set(x, 45, z);
  M.beacon.visible = true;
  M.ring.position.set(x, 0.4, z);
  M.ring.visible = true;
}
function clearMarker(W) {
  W.missions.marker = null;
  W.missions.beacon.visible = false;
  W.missions.ring.visible = false;
}
function say(W, i) {
  const [name, role, text] = DIALOGS[i];
  W.hud.showDialog(name, role, text, 7);
}
export function startMission(W, i) {
  const M = W.missions;
  M.current = i; M.stage = 0; M.timer = 0; M.flags = {};
  M.taxiFare = null;
  say(W, i);
  const S = W.city.spots;
  if (i === 0) setMarker(W, 17, 84);
  if (i === 1) {
    if (!M.marco) {
      const rng = mulberry32(W.seed + 21);
      const g = makePersonModel(W.three, rng, { shirt: 0xffd25a, pants: 0x2a2e33 });
      g.position.set(S.marlin.x + 4, 0, S.marlin.z + 12);
      W.scene.add(g);
      M.marco = { group: g, x: S.marlin.x + 4, z: S.marlin.z + 12 };
    }
    setMarker(W, S.marlin.x, S.marlin.z + 12);
  }
  if (i === 2) { M.timer = 240; setMarker(W, 160, -160); }
  if (i === 3) setMarker(W, S.docks.x, S.docks.z);
  if (i === 4) { W.hour = 21; setMarker(W, -80, -80); }
  if (i === 5) setMarker(W, S.raceStart.x, S.raceStart.z);
  if (i === 6) setMarker(W, S.beach.x, S.beach.z);
  if (i === 7) {
    W.hour = 18.5;
    M.timer = 107;
    W.police.addWanted(W, 4, 'manhunt Golden Hour');
    setMarker(W, S.pier.x, S.pier.z);
  }
  W.hud.toast(`JOB ${i + 1}/8 — ${MISSIONS[i].name}`);
}
export function completeMission(W, reward) {
  const M = W.missions;
  const m = MISSIONS[M.current];
  W.cash += reward || m.reward;
  W.audio.jingle();
  W.hud.toast(`JOB SELESAI: ${m.name}  +$${reward || m.reward}`);
  clearMarker(W);
  M.nearInteract = null; M.onInteract = null;
  W.saveGame();
  if (M.current >= MISSIONS.length - 1) {
    W.endGame(`Utang lunas. Dario kalah. Kapal Marco berlayar saat matahari tenggelam — Nico bebas. RESPECT: SHOT CALLER.`);
    return;
  }
  startMission(W, M.current + 1);
}
export function failMission(W, reason) {
  W.audio.fail();
  W.showDead('MISI GAGAL', `${reason} — tekan RETRY untuk coba lagi.`);
}
function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
export function updateMissions(W, dt) {
  const M = W.missions;
  const P = W.player;
  const px = P.car ? P.car.x : P.x;
  const pz = P.car ? P.car.z : P.z;
  const S = W.city.spots;
  // Beacon berputar.
  if (M.marker) {
    M.beacon.rotation.y += dt;
    M.ring.rotation.z += dt;
    M.ring.position.y = 0.4 + Math.sin(W.elapsed * 2) * 0.2;
  }
  // --- Sun coin ---
  for (const c of W.city.sunCoins) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 2;
    if (dist2(px, pz, c.x, c.z) < 1.9) {
      c.taken = true; c.mesh.visible = false;
      W.cash += CFG.sunCoinValue;
      W.stats.coins++;
      W.audio.coin();
      W.hud.toast(`Sun coin +$${CFG.sunCoinValue} (${W.stats.coins}/30)`);
    }
  }
  // --- Garasi: keluar mobil di dekat garasi = simpan ---
  if (M.prevDriving && !P.car && dist2(P.x, P.z, S.garage.x, S.garage.z) < 12) {
    if (W.garage.length < 3) {
      W.garage.push('mobil curian');
      W.hud.toast('Mobil disimpan di garasi Mara.');
      W.saveGame();
    }
  }
  M.prevDriving = !!P.car;
  // --- Respray otomatis: pelan di dekat Spray & Shine ---
  if (P.car && dist2(px, pz, S.spray.x, S.spray.z) < 7 && Math.abs(P.car.speed) < 2 && W.police.wanted > 0) {
    M.resprayT += dt;
    if (M.resprayT > 2) { M.resprayT = 0; clearWantedAtRespray(W); }
  } else M.resprayT = 0;
  // --- Stunt jump: lewati ramp kencang ---
  for (const [rx, rz] of [[120, 40], [-40, -120], [200, 120]]) {
    const key = `${rx},${rz}`;
    M.stuntCd[key] = (M.stuntCd[key] || 0) - dt;
    if (P.car && Math.abs(P.car.speed) > 18 && dist2(px, pz, rx, rz) < 3.5 && M.stuntCd[key] <= 0) {
      M.stuntCd[key] = 60;
      W.cash += CFG.stuntBonus;
      W.hud.toast(`STUNT JUMP! +$${CFG.stuntBonus}`);
      W.audio.jingle();
    }
  }
  // --- Taksi: bawa CABRO, penumpang muncul otomatis ---
  M.taxiCd -= dt;
  if (P.car && P.car.kind === 'cabro' && !M.taxiFare && M.taxiCd <= 0) {
    const from = pick(mulberry32((W.elapsed | 0) + 3), [[0, 0], [-160, 80], [80, -160], [-238, 120]]);
    const to = pick(mulberry32((W.elapsed | 0) + 9), [[120, 160], [-120, -120], [200, -80], [56, 96]]);
    M.taxiFare = { fx: from[0], fz: from[1], tx: to[0], tz: to[1], picked: false };
    W.hud.toast('Penumpang taksi menunggu — ikuti marker hijau.');
  }
  if (M.taxiFare) {
    const f = M.taxiFare;
    if (!f.picked && dist2(px, pz, f.fx, f.fz) < 6) { f.picked = true; W.hud.toast('Penumpang naik! Antar ke tujuan.'); }
    else if (f.picked && dist2(px, pz, f.tx, f.tz) < 6) {
      W.cash += CFG.taxiFare; M.taxiFare = null; M.taxiCd = 20;
      W.hud.toast(`Tarif taksi +$${CFG.taxiFare}`);
      W.audio.coin();
    }
  }
  // --- Interaksi toko senjata ---
  M.nearInteract = null; M.onInteract = null;
  if (!P.car && dist2(P.x, P.z, S.guns.x, S.guns.z) < 7) {
    const next = !W.combat.owned[2] ? 2 : !W.combat.owned[3] ? 3 : -1;
    if (next >= 0) {
      M.nearInteract = `E — Beli ${CFG.weapons[next].name} $${CFG.weapons[next].price}`;
      M.onInteract = () => buyWeapon(W, next);
    } else M.nearInteract = "Cal's Guns — semua senjata dimiliki";
  }
  // --- Logika misi aktif ---
  const m = M.current;
  if (m === 0) {
    if (M.stage === 0 && P.car === W.traffic.missionCar) { M.stage = 1; setMarker(W, S.garage.x, S.garage.z); W.hud.toast('Bagus! Sekarang ke bengkel Mara.'); }
    else if (M.stage === 1 && P.car && dist2(px, pz, S.garage.x, S.garage.z) < 9) completeMission(W);
  } else if (m === 1) {
    // Titik temu = depan restoran (di luar footprint gedung). Interaksi
    // tetap tersedia selama stage 1 (bukan satu frame saja).
    const mx = S.marlin.x, mz = S.marlin.z + 12;
    if (M.stage === 0 && dist2(P.x, P.z, mx, mz) < 7) M.stage = 1;
    if (M.stage === 1) {
      M.nearInteract = 'E — Bicara dengan Marco';
      M.onInteract = () => {
        W.hud.showDialog('Marco', 'SMUGGLER · WHEELMAN', 'Dario pikir dia bisa beli seluruh Malecón. Kita buktikan dia salah. Kerja bagus, Nico.', 6);
        completeMission(W);
      };
    }
  } else if (m === 2) {
    M.timer -= dt;
    const cps = [[160, -160], [-160, 160], [80, 240]];
    if (M.timer <= 0) { failMission(W, 'Waktu habis — paket terlambat'); return; }
    if (M.stage < 3 && dist2(px, pz, cps[M.stage][0], cps[M.stage][1]) < 7) {
      M.stage++;
      W.audio.coin();
      if (M.stage < 3) setMarker(W, cps[M.stage][0], cps[M.stage][1]);
      else completeMission(W);
    }
  } else if (m === 3) {
    if (M.stage === 0 && dist2(px, pz, S.docks.x, S.docks.z) < 26) {
      M.stage = 1;
      spawnGuards(W, S.docks.x, S.docks.z, 4);
      W.hud.toast('4 penjaga Dario! Lumpuhkan mereka.');
    } else if (M.stage === 1 && W.combat.enemies.filter((e) => !e.dead).length === 0) {
      M.stage = 2;
      if (!M.hauler) M.hauler = createCar(W, 'hauler', S.docks.x + 10, S.docks.z + 6, 0);
      setMarker(W, M.hauler.x, M.hauler.z);
      W.hud.toast('Jalan bersih! Curi truk Hauler.');
    } else if (M.stage === 2 && P.car === M.hauler) {
      M.stage = 3;
      W.police.addWanted(W, 2, 'truk Docks dicuri');
      setMarker(W, S.garage.x, S.garage.z);
    } else if (M.stage === 3 && P.car === M.hauler && dist2(px, pz, S.garage.x, S.garage.z) < 9) completeMission(W);
  } else if (m === 4) {
    if (!M.courier) {
      M.courier = createCar(W, 'cometa', -80, -80, 0, 0x2a2e33);
      M.courier.driver = 'courier';
      M.courierNode = 0;
    }
    const c = M.courier;
    if (M.stage === 0) {
      // Kurir jalan pelan di graf; pemain buntuti 8–35 m selama 25 dtk.
      const d = dist2(px, pz, c.x, c.z);
      if (d < 6) { M.spotT = (M.spotT || 0) + dt; if (M.spotT > 2) { failMission(W, 'Ketahuan! Kurir kabur'); return; } }
      else M.spotT = 0;
      if (d > 8 && d < 35) { M.tailT += dt; if (M.tailT >= 25) { M.stage = 1; W.hud.toast('Dia kabur! KEJAR!'); W.police.addWanted(W, 3, 'kejar-kejaran Neon Nights'); } }
      else M.tailT = Math.max(0, M.tailT - dt * 0.5);
      moveCourier(W, c, 9, dt);
      setMarker(W, c.x, c.z);
    } else if (M.stage === 1) {
      moveCourier(W, c, 24, dt);
      if (dist2(px, pz, c.x, c.z) < 9) completeMission(W);
    }
  } else if (m === 5) {
    if (M.stage === 0 && P.car && dist2(px, pz, S.raceStart.x, S.raceStart.z) < 10) {
      M.stage = 1; M.raceCp = 0;
      M.rivals = [];
      const kinds = ['cometa', 'pip', 'veloz'];
      kinds.forEach((k, i) => {
        const rc = createCar(W, k, S.raceStart.x + 4 + i * 5, S.raceStart.z - 6 - i * 3, Math.PI);
        rc.driver = 'rival';
        M.rivals.push({ car: rc, z: S.raceStart.z, speed: 22 + i * 1.5 });
      });
      W.hud.toast('BALAPAN! Lewati 4 checkpoint di Malecón!');
    } else if (M.stage === 1) {
      const cps = [0, 80, 160, 240];
      const cz = cps[M.raceCp];
      setMarker(W, MALECON_X(cz), cz);
      if (dist2(px, pz, MALECON_X(cz), cz) < 11) {
        M.raceCp++;
        W.audio.coin();
        if (M.raceCp >= 4) { completeMission(W); return; }
      }
      for (const r of M.rivals) {
        r.z += r.speed * dt;
        r.car.x = MALECON_X(r.z); r.car.z = r.z;
        r.car.heading = Math.atan2(MALECON_X(r.z + 5) - MALECON_X(r.z - 5), 10);
        r.car.group.position.set(r.car.x, 0, r.car.z);
        r.car.group.rotation.y = r.car.heading;
        if (r.z >= 240) { failMission(W, 'Rival finis duluan'); return; }
      }
    }
  } else if (m === 6) {
    if (M.stage === 0 && dist2(P.x, P.z, S.beach.x, S.beach.z) < 9) {
      M.stage = 1;
      setMarker(W, S.jetski.x, S.jetski.z);
      W.hud.toast('Pesta pantai! Naik jetski di air.');
    } else if (M.stage === 1) {
      if (!M.jetskiCar && dist2(P.x, P.z, S.jetski.x, S.jetski.z) < 8) {
        M.nearInteract = 'E — Naik jetski';
        M.onInteract = () => {
          M.jetskiCar = createCar(W, 'pip', S.jetski.x, S.jetski.z, 0, 0xffd25a);
          M.jetskiCar.driver = 'player';
          P.car = M.jetskiCar; P.group.visible = false;
          W.audio.engine(true, 0);
          W.hud.toast('Jetski! Lewati 3 buoy kuning.');
        };
      }
      if (M.jetskiCar && P.car === M.jetskiCar) {
        const buoys = [[-318, 80], [-318, 120], [-318, 160]];
        const b = buoys[M.buoy || 0];
        if (b) {
          setMarker(W, b[0], b[1]);
          if (dist2(px, pz, b[0], b[1]) < 7) { M.buoy = (M.buoy || 0) + 1; W.audio.coin(); }
        } else {
          M.stage = 2;
          setMarker(W, S.fishing.x, S.fishing.z);
          W.hud.toast('Buoy selesai! Mancing di ujung dermaga.');
        }
      }
    } else if (M.stage === 2) {
      if (!P.car && dist2(P.x, P.z, S.fishing.x, S.fishing.z) < 6) {
        M.nearInteract = 'E — Mancing';
        M.onInteract = () => { M.fishing = true; W.hud.toast('Memancing… tunggu gigitan.'); };
      }
      if (M.fishing) {
        M.fishT += dt;
        if (M.fishT > 5) { M.fishing = false; M.fishT = 0; W.audio.coin(); completeMission(W); }
      }
    }
  } else if (m === 7) {
    M.timer -= dt;
    if (M.timer <= 0) { failMission(W, 'Kapal Marco sudah berlayar'); return; }
    if (M.stage === 0) {
      if (W.police.wanted === 0) {
        M.stage = 1;
        setMarker(W, S.pier.x, S.pier.z);
        W.hud.toast('Manhunt lepas! KEJAR KAPAL di dermaga!');
      }
    } else if (M.stage === 1 && dist2(P.x, P.z, S.pier.x, S.pier.z) < 9) completeMission(W);
  }
}
function moveCourier(W, c, speed, dt) {
  // Kurir ikut graf jalan: pilih node berikut yang menjauhi pemain.
  const nodes = W.city.nodes;
  if (c._t === undefined || c._t >= 1) {
    const from = nearestNodeIdx(W, c.x, c.z);
    const links = nodes[from].links;
    c._from = from;
    c._to = links.length ? links[Math.floor(Math.random() * links.length)] : from;
    c._t = 0;
  }
  const a = nodes[c._from], b = nodes[c._to];
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  c._t += (speed * dt) / len;
  c.x = a.x + (b.x - a.x) * Math.min(1, c._t);
  c.z = a.z + (b.z - a.z) * Math.min(1, c._t);
  c.heading = Math.atan2(b.x - a.x, b.z - a.z);
  c.group.position.set(c.x, 0, c.z);
  c.group.rotation.y = c.heading;
}
function nearestNodeIdx(W, x, z) {
  let best = 0, bd = Infinity;
  W.city.nodes.forEach((n, i) => {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
