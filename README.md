# SOLARA BAY — Make GTA 6 (make.fun gta6-01)

Open-world crime game 3D (three.js) di kota pantai fiktif Solara Bay.
Nico pulang ke kotanya: curi mobil, kabur dari PCPD, kerjakan 8 job untuk
Marco dan Lupe di sepanjang Malecón Celeste — dengan radio CELESTE 98.1
mengiringi dari VELOZ COMET RS.

## Main

```sh
node serve.ts
# buka http://localhost:8080
```

Tidak ada build step, tidak ada network request: semua art prosedural
(geometri three.js + canvas texture) dan semua suara WebAudio sintetis.

## Kontrol

- WASD jalan / nyetir, Shift lari / handbrake, Space lompat / rem
- Mouse: putar kamera (klik untuk pointer lock), scroll/C: jarak kamera
- E: masuk / keluar mobil, bicara dengan NPC
- H: klakson · M: mute · 1/2/3: senjata · R: reload
- T: taksi · R: balapan (di mobil) · F: mancing · P: foto · K: paket kilat
- HP (layar sentuh): joystick kiri, tombol MASUK/KELUAR, REM, KAM, TEMBAK

## Sistem

- Kota 640×640 m: Malecón Celeste, Old Solara, Plaza Spires, The Docks,
  mercusuar, dermaga, kincir ria, pantai + jetski, bus & taco truck
- 8 misi cerita (First Gear, Meet Marco, Courier Run, Docks Job, Neon
  Nights, Street Race, Beach Party, Golden Hour) + 5 aktivitas sampingan:
  taksi $40, balapan $120, mancing $15/ikan, 6 spot foto (+$60), paket $60
- Wanted 0–5 bintang, patroli PCPD + polisi jalan kaki + helikopter di 3+
- 7 model mobil drivable (sport, taksi, sedan, van, truk, bus, polisi)
- Siklus siang–malam, sunset oranye-ungu, neon, jendela menyala malam
- Save otomatis di localStorage setelah tiap misi selesai

## Screenshot

```sh
node tools/shot.mjs chase    # dst: screenshots/1-chase.jpg
```

## Dossier

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Lisensi: MIT — lihat LICENSE.
