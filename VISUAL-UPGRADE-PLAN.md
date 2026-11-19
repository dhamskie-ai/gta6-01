# VISUAL UPGRADE PLAN — SOLARA BAY ronde 6g

> Diagnosa kenapa kota 6e masih "burem" saat dimainkan (bukan screenshot),
> perbaikan yang diterapkan di kode game ronde 6f, dan yang dibawa ke
> ronde 6g (rebuild fresh + kontrol sentuh HP). Ditulis dari DESIGN.md,
> bukan dari membaca kode lama.

## Diagnosa penyebab burem (6e)

1. **Tanah satu tekstur raksasa di-stretch.** Satu canvas 2048×2048 untuk
   seluruh peta 640×640 m → hanya 3,2 px/meter. Marka jalan, zebra cross,
   trotoar, garis pantai semua di tekstur ini → blur dari dekat, mip-map
   mengaburkan dari jauh. Penyebab utama "jalan burem".
2. **Fasad gedung di-stretch vertikal.** Tekstur 512×512 dipakai satu kali
   untuk seluruh sisi gedung, berapa pun tingginya. Tower 40 m+ memakai
   tekstur yang sama dengan ruko 8 m → jendela terentang, detail hancur.
   Anisotropy di-cap 8.
3. **Fog terlalu dekat.** Fog mulai 120 m → gedung jarak menengah larut ke
   warna kabut → kota terasa berkabut/burem.
4. **Awan = sprite blur.** Radial-gradient 128 px di-stretch jadi sprite
   120–240 m → gumpalan putih kabur, langit kosong.
5. **Pohon satu geometri, satu warna.** Palem = batang + bidang datar,
   tanpa variasi → gumpalan hijau kabur dari jauh.
6. **Mobil kotak polos.** Body + kabin box, warna datar, tanpa grille,
   bumper, spion, lampu geometri → seperti mainan blur.
7. **Pejalan kaki kotak polos.** Torso box + kepala, satu set warna.
8. **Tone mapping mencuci kontras.** ACES + exposure 1.12 + Lambert datar
   membuat warna pudar, tepi kurang kontras.

## Perbaikan (6f, dibawa ke 6g)

- **Jalan HD:** ground texture 4096² (6,4 px/m) + marka jalan (garis tengah
  putus-putus, garis tepi, zebra cross) sebagai geometri plane tajam di
  atas aspal. Trotoar + curb sebagai geometri box bertepi tegas.
- **Gedung HD:** fasad 1024², RepeatWrapping dengan repeat per gedung
  (repeat.y = tinggi/14, repeat.x = lebar/14) → jendela selalu sama besar
  dan tajam; anisotropy = maksimum renderer; jendela kaca + frame +
  balkon + AC + tangki air + antena sebagai geometri; atap berdetail.
- **Fog:** mulai 220 m, habis 1100 m — kota jarak menengah tetap tajam.
- **Langit aesthetic:** gradasi 3 warna + matahari cakram tajam (disc
  geometri + glow), bulan di malam hari, awan dari tekstur 256 px
  bergambar gumpalan berlapis + awan mesh (bola-bola Lambert) yang
  bergerak pelan, bintang tajam.
- **Pohon HD:** batang bersegmen cincin, 8 pelepah × 3 leaflet runcing,
  tandan kelapa, variasi skala/warna/rotasi per instance; tambah pohon
  rindang (batang + 3 bola tajuk flat-shaded) di taman.
- **Mobil HD + drivable:** body berlapis (lower body, kap, kabin kaca,
  bumper, grille, spion, spoiler sport, lampu emissive depan/belakang,
  velg + jari-jari), arcade physics + E masuk/keluar.
- **Orang HD:** kepala + topi/rambut, torso jaket, lengan, kaki, sepatu,
  variasi warna kulit/baju/celana, ayunan jalan prosedural.
- **Renderer tajam:** setPixelRatio(min(dpr, 2)) + antialias; shadow map
  2048; exposure 1.05; outputColorSpace sRGB.
- **Burung (baru):** 14 burung ambient — dua sayap segitiga mengepak,
  terbang melingkar di langit, siang hari.
- **Pejalan kaki ambient (baru, diperkuat):** 36 pejalan kaki berjalan di
  trotoar dengan waypoint, variasi kecepatan/arah, lari saat ada bahaya.

## Baru di ronde 6g

- **Rebuild fresh** dari DESIGN.md + rencana ini: konten sama seperti 6f
  (7 poin Dham semua di game: pohon HD hidup, jalan HD tajam, mobil HD
  bisa dinaikin, gedung berdetail HD, langit aesthetic, burung terbang,
  pejalan kaki bergerak) + re-theme penuh ke nama referensi Dham:
  Nico, Marco, Lupe, Malecón Celeste, CELESTE 98.1, VELOZ COMET RS,
  PCPD, Marlin Ceviche; 8 misi (First Gear, Meet Marco, Courier Run,
  Docks Job, Neon Nights, Street Race, Beach Party, Golden Hour).
- **Kontrol sentuh HP** (baru, `game/src/touch.js`): virtual joystick
  kiri bawah (jalan + nyetir), tombol MASUK / REM / KAM kanan bawah,
  geser jari untuk putar kamera. Hanya muncul di perangkat sentuh
  (deteksi `ontouchstart` / pointer coarse); desktop tetap keyboard +
  mouse tanpa perubahan. Tombol besar untuk jempol, tidak menutupi HUD
  misi / kecepatan / radio.
- **Konten dunia 6g:** street race di Malecón, beach party + jetski +
  mancing di Marina Bay, bus + taco truck, mercusuar, bintang malam.

## Verifikasi ketajaman

Playtest live 1280×720 (bukan hanya screenshot): boot → title → play →
jalan kaki → curi VELOZ COMET RS → mengemudi → misi jalan, 0 error,
ditambah playtest sentuh (emulasi touch Playwright): joystick gerakkan
pemain → tombol masuk mobil → nyetir pakai joystick → keluar mobil.
4 screenshot baru (chase/drive/street/night) + 1 screenshot mode sentuh
dicek visual: ke-7 poin Dham harus kelihatan di frame yang dirender
game, bukan diedit pasca-capture.
