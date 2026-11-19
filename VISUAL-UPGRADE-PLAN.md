# VISUAL UPGRADE PLAN — SOLARA BAY ronde 6f

> Diagnosa kenapa kota 6e masih "burem" saat dimainkan (bukan screenshot),
> dan perbaikan yang diterapkan di kode game ronde 6f. Ditulis sebelum
> menulis ulang kode, dari pembacaan `game/src/render.js` + `game/src/city.js`
> ronde 6e (baca sekadarnya untuk diagnosa).

## Diagnosa penyebab burem (6e, commit 9f8d67b)

1. **Tanah satu tekstur raksasa di-stretch.** `groundTexture` = satu canvas
   2048×2048 yang menutupi seluruh peta 640×640 m → hanya **3,2 px/meter**.
   Semua marka jalan, zebra cross, trotoar, garis pantai digambar di tekstur
   ini. Dari dekat, marka jalan hanya beberapa piksel lebar → blur; dari
   jauh, mip-map mengaburkan sisanya. Ini penyebab utama "jalan burem".
2. **Fasad gedung di-stretch vertikal.** `facadeTexture` 512×512 dipakai
   satu kali untuk seluruh sisi gedung, berapa pun tingginya. Tower 40 m+
   memakai tekstur yang sama dengan ruko 8 m → jendela terentang vertikal,
   detail bata/kaca hancur. Anisotropy di-cap 8.
3. **Fog terlalu dekat.** `Fog(0x8fc3e8, 120, 700)` — kabut mulai 120 m,
   jadi gedung jarak menengah sudah larut ke warna kabut → seluruh kota
   terasa berkabut/burem, bukan tajam.
4. **Awan = sprite blur.** Awan dibuat dari tekstur radial-gradient 128 px
   yang di-stretch jadi sprite 120–240 m lebar → gumpalan putih kabur,
   langit terasa kosong dan buram.
5. **Pohon satu geometri, satu warna.** Palem = batang silinder + beberapa
   bidang datar, tanpa variasi bentuk/warna antar pohon → dari jauh hanya
   gumpalan hijau kabur.
6. **Mobil kotak polos.** Body = box + kabin box, warna datar, tanpa
   grille, bumper, spion, lampu geometri → terlihat seperti mainan blur.
7. **Pejalan kaki kotak polos.** Person = torso box + kepala, satu set
   warna → dari jarak main terasa seperti kotak berjalan.
8. **Tone mapping mencuci kontras.** ACES + exposure 1.12 + Lambert datar
   membuat warna pudar; tepi objek kurang kontras sehingga terasa tidak tajam.

## Perbaikan di ronde 6f (di kode game, bukan screenshot)

- **Jalan HD:** ground texture naik ke 4096² (6,4 px/m) + marka jalan
  (garis tengah putus-putus, garis tepi, zebra cross) sebagai **geometri
  plane tajam** di atas aspal, bukan bagian dari tekstur tanah. Trotoar +
  curb sebagai geometri box dengan tepi tegas.
- **Gedung HD:** fasad 1024², `RepeatWrapping` dengan repeat per gedung
  (`repeat.y = tinggi/14`, `repeat.x = lebar/14`) sehingga jendela selalu
  berukuran sama dan tajam; anisotropy = maksimum renderer; jendela kaca +
  frame + balkon + AC + tangki air + antena sebagai geometri; atap berdetail.
- **Fog:** mulai 220 m, habis 1100 m — kota jarak menengah tetap tajam.
- **Langit aesthetic:** gradasi 3 warna + matahari cakram tajam (disc
  geometri + glow), bulan di malam hari, awan dari tekstur 256 px bergambar
  gumpalan berlapis + awan mesh (bola-bola Lambert) yang bergerak pelan,
  bintang tajam.
- **Pohon HD:** batang bersegmen cincin, 8 pelepah × 3 leaflet runcing,
  tandan kelapa, variasi skala/warna/rotasi per instance; tambah pohon
  rindang (batang + 3 bola tajuk flat-shaded) di taman.
- **Mobil HD + drivable:** body berlapis (lower body, kap, kabin kaca,
  bumper, grille, spion, spoiler sport, lampu emissive depan/belakang,
  velg + jari-jari), tetap arcade physics + E masuk/keluar.
- **Orang HD:** kepala + topi/rambut, torso jaket, lengan, kaki, sepatu,
  variasi warna kulit/baju/celana, ayunan jalan prosedural.
- **Renderer tajam:** `setPixelRatio(min(dpr, 2))` + antialias aktif di
  hardware; shadow map 2048; exposure 1.05; `outputColorSpace` sRGB.
- **Burung (baru):** 14 burung ambient — dua sayap segitiga yang mengepak,
  terbang melingkar di langit, siang hari.
- **Pejalan kaki ambient (baru, diperkuat):** 36 pejalan kaki berjalan di
  trotoar dengan waypoint, variasi kecepatan/arah, lari saat ada bahaya.

## Verifikasi ketajaman

Playtest live 1280×720 (bukan hanya screenshot): boot → title → play →
jalan kaki → curi VELOZ COMET RS → mengemudi → misi jalan, 0 error.
4 screenshot baru (chase/drive/street/night) dicek visual: ke-7 poin Dham
harus kelihatan di frame yang dirender game, bukan diedit pasca-capture.
