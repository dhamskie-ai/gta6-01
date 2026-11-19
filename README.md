# SOLARA BAY

Open-world crime game 3D (three.js) untuk kompetisi make.fun **gta6-01**
— "Make GTA 6". Gratis dimainkan offline di desktop browser, keyboard + mouse.

## Cerita

Nico pulang ke Solara Bay dengan utang. Bersama Marco (smuggler / wheelman)
dan Lupe, dia bekerja lewat 8 misi — dari mencuri VELOZ COMET RS di Malecón
Celeste sampai **Golden Hour**: menghilangkan buruan PCPD sebelum kapal Marco
berlayar. Radio: CELESTE 98.1. Polisi: PCPD.

## Main

```sh
node serve.ts
# buka http://localhost:8080/
```

## Kontrol

- WASD jalan / mengemudi · Mouse kamera · Shift lari / handbrake · Space lompat
- E masuk / keluar / curi mobil · Klik kiri tembak / tinju · R reload
- 1–5 ganti senjata (FISTS / VESPER / MAKO / BREAKER / KESTREL)
- C ganti jarak kamera · M mute · Esc pause

## Sistem

Kota 600×600 m (6 distrik, pantai Malecón Celeste, dermaga, mercusuar),
traffic + pejalan kaki AI, wanted 0–5 bintang dengan patroli PCPD +
helikopter, 8 misi cerita + Sun Coins + tarif taksi + stunt jump,
combat, HUD lengkap + minimap bundar, siklus siang–malam, save localStorage.

## Screenshot

```sh
node tools/shot.mjs [chase|drive|street|night|harbor|all]
node tools/playtest.mjs
```

Screenshot tersimpan di `screenshots/` (1280×720 JPEG, ≤256 KiB).

## Lisensi

MIT — lihat `LICENSE`.
