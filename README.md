# SOLARA BAY — make.fun gta6-01 (round 6g)

Open-world crime game 3D (three.js) di kota pantai fiktif Solara Bay.
Kamu Nico, sopir pelarian yang pulang ke Solara Bay dan berutang pada
Marco, smuggler sekaligus wheelman. Delapan misi cerita di sepanjang
Malecón Celeste — dari curi mobil pertama sampai Golden Hour: lolos dari
manhunt PCPD sebelum kapal Marco berlayar dari dermaga.

## Main

```sh
node serve.ts
# buka http://localhost:8080
```

Offline, tanpa network request. Semua art prosedural (three.js +
canvas texture), semua suara sintetis (WebAudio). Save otomatis di
localStorage.

## Kontrol — keyboard + mouse (desktop)

- WASD jalan / nyetir, Shift lari / handbrake, Space lompat
- Mouse: putar kamera (klik dulu untuk pointer lock), scroll / C: jarak kamera
- E: masuk / keluar mobil, curi mobil, bicara, ambil paket
- Klik kiri: tinju / tembak, R: reload, 1–5: ganti senjata
- Esc: pause, M: mute, H: klakson

## Kontrol — sentuh (HP / tablet)

Di perangkat sentuh, kontrol muncul otomatis di layar:

- Joystick kiri bawah: jalan kaki + nyetir (maju / mundur / belok)
- Tombol kanan bawah: MASUK (masuk / keluar mobil), REM (rem), KAM (kamera)
- Geser jari di layar: putar kamera (pengganti mouse look)

Kontrol sentuh tidak muncul di desktop — di sana tetap keyboard + mouse.

## Misi (8)

1. First Gear — curi mobil pertama, antar ke bengkel Mara
2. Meet Marco — temui Marco di Marlin Ceviche
3. Courier Run — antar 3 paket dalam 4 menit
4. Docks Job — curi truk Hauler, lawan 4 penjaga, kabur bintang 2
5. Neon Nights — buntuti kurir Dario di malam hari
6. Street Race — balapan jalanan di Malecón Celeste
7. Beach Party — pesta pantai: jetski + mancing
8. Golden Hour — lolos manhunt bintang 4, kejar kapal Marco

Aktivitas sampingan: 3 tarif taksi, 3 stunt jump, 30 sun coin,
garasi 3 mobil, toko senjata Cal's Guns, respray Spray & Shine.

## Kota

6 distrik (Marina Bay, Old Solara, The Spires, The Docks, Vista Hills,
Calle Verde), ~120 gedung berfasad HD, jalan dengan marka geometri tajam,
palem hidup, 36 pejalan kaki, 14 mobil traffic, 14 burung, mercusuar,
dermaga + kincir ria, bus, taco truck, jetski, siklus siang–malam penuh.

## Screenshot & dossier

```sh
node tools/shot.mjs            # 4 screenshot 1280x720 (lihat shots.json)
node tools/playtest.mjs        # playtest 6 langkah + playtest sentuh
MAKEFUN_OUTPUT_DIR=out node main.ts   # dossier.json
```

## Lisensi

MIT — lihat LICENSE. Semua nama, karakter, kendaraan, dan musik original.
Bukan Vice City / Los Santos / Liberty City, tanpa aset Rockstar.
