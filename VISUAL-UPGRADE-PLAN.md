# Visual upgrade plan — SOLARA BAY (round 7c)

Dense-world upgrade from Dham's 6j note: "mobilnya sepi banget, tambahin
mobil-mobilnya; gedung-gedung, orang-orang, burung-burung, pohon-pohon,
jalanan semua ditambah biar rame" — graphics stay HD, no 120 FPS claim.

## Density targets (seeded, deterministic, `?seed=8`)

- Traffic cars: 36 on the road graph (was ~14), plus 24 parked cars.
- Pedestrians: ~150 on sidewalks, varied colours/clothes, flee on gunfire.
- Birds: 22 circling above Marina Bay and the plaza.
- Buildings: ~120 across 6 districts, 3 height styles, emissive windows.
- Trees: palm rows along Malecón Celeste + shade trees in parks (~200).
- Streets: full grid + beach curve + ring roads, zebra crossings, traffic
  lights, signs, benches, street lamps (lit at night), neon shop signs.

## Performance budget (keeps it smooth, no FPS claim)

- InstancedMesh for buildings, palms and lamps (few draw calls).
- One directional light, 1024 shadow map, pixelRatio capped at 1.
- Spawn/despawn traffic + pedestrians within ~150 m of the player.
- MeshLambertMaterial, canvas textures drawn once at load, zero image files.

## Screenshots (cover = chase)

1-chase (downtown, dusk, 3 stars, 2 police cars), 2-drive (golden hour,
beach road), 3-street (Old Solara market, on foot, mission 2 Meet Marco),
4-night (Marina neon), 5-touch (touch controls), 6-road-zoom (ring road),
7-phone (phone dialog, bottom-right, clear of the vitals HUD top-left).
