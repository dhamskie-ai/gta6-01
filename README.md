# SOLARA BAY — Make GTA 6 (gta6-01)

Open-world crime game 3D (three.js) di kota pantai fiktif Solara Bay.
Protagonis **Nico**, sopir pelarian yang pulang dan bekerja untuk **Marco**
(smuggler/wheelman) demi melunasi utang, sambil memburu developer **Dario Kane**.

## Main

```sh
node serve.ts
# buka http://localhost:8080
```

Offline, tanpa login, tanpa network request. Keyboard + mouse di desktop,
kontrol sentuh (joystick + tombol MASUK/KELUAR/REM/KAM) di HP.

## Kontrol

- WASD jalan / nyetir, Shift lari & handbrake, Space lompat
- E masuk / keluar mobil, mouse geser = kamera, scroll = zoom
- Klik kiri tembak, 1/2/3 ganti senjata, R isi peluru
- F aktivitas: taksi, balapan jalanan, mancing, foto, paket kilat
- H klakson, M mute, Esc jeda

## Sistem

- Kota 600×600 m, 7 distrik: Malecón Celeste, Marina Bay, Old Solara,
  The Spires, The Docks, Vista Hills, Calle Verde
- 8 misi cerita (First Gear → Golden Hour), wanted 0–5 + PCPD
  (mobil patroli, polisi jalan kaki, helikopter di wanted ≥ 3)
- Traffic AI 22 mobil + ~90 pejalan kaki berkerumun di Malecón, pasar,
  kafe pantai, plaza — plus pedagang kaki lima & kios pasar
- 7 model mobil detail (sedan, VELOZ COMET RS sport, taksi, truk, van,
  bus, polisi) — semua bisa dicuri & dikendarai
- Aktivitas: supir taksi (timer + bayaran), balapan jalanan dadakan lawan
  2 AI, mancing dengan timing bar + koleksi 4 jenis ikan, 6 spot foto
  tersembunyi, misi sampingan paket kilat
- Siklus siang–malam: golden hour oranye-ungu, neon menyala, jendela
  menyala, lampu depan mobil, bintang & bulan detail
- Suara WebAudio sintetis: mesin mengikuti kecepatan, klakson, rem/skid,
  sirene, ambien kota + kicau burung, musik pad A-minor
- Save otomatis di localStorage setelah tiap misi

## Dossier

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Lisensi

MIT — lihat `LICENSE`.
