# SOLARA BAY — Make GTA 6 (gta6-01)

Open-world crime game 3D (three.js) di kota pantai fiktif Solara Bay.
Nico pulang ke kota, bekerja untuk Marco (wheelman) dan Lupe (client),
melarikan diri dari PCPD di boulevard Malecón Celeste — 8 misi sampai
finale Golden Hour.

## Main

```sh
node serve.ts        # http://localhost:8080/game/
```

WASD jalan/nyetir, mouse kamera, E curi mobil / interaksi, Shift lari /
handbrake, Space lompat, klik kiri tinju / tembak, R reload, 1–5 senjata,
C kamera, M mute, Esc pause.

## Sistem

- Kota 600×600 m, 7 distrik, ~120 bangunan, palem, neon, mercusuar,
  dermaga, pantai, kios pasar, jetski
- 8 mobil prosedural (termasuk Veloz Comet RS, Solara Bus, taco truck),
  traffic + pejalan kaki AI
- Wanted 0–5 PCPD: mobil kejar, polisi jalan kaki, helikopter, roadblock
- 8 misi cerita + balap jalanan, pesta pantai, mancing, taksi, sun coin
- HUD: panel misi, daftar PCPD, minimap lingkaran, dialog, radio
  CELESTE 98.1, speedometer
- Siklus siang–malam, golden hour, suara WebAudio sintetis

## Screenshot

```sh
node tools/shot.mjs     # 4 scene ke screenshots/
node tools/playtest.mjs # title → jalan → curi → kendara
```

## Dossier

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Lisensi MIT.
