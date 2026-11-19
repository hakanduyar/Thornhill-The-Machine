# Architecture

See [architecture decisions](decisions/README.md) for the current technology rationale, asset/runtime boundary and feature delivery policy. These decisions were documented on 2026-11-07; they do not claim an earlier alternatives benchmark.

- `app/`: full-viewport page, shared styles and document metadata. The root redirects to `/machine`.
- `src/contract/manifest.ts`: validates the local scene manifest and same-origin asset URLs.
- `src/player/sceneRig.ts`: binds the imported camera and animation; evaluates exact authored time with Three's animation mixer.
- `src/player/runtime.ts`: rendering, input, bounded manual traversal, playback and visibility lifecycle.
- `src/player/machineSynapse.ts`: bounded procedural neural branches with owned geometry and reversible source-layer visibility.
- `src/player/machineTreatment.ts`: cloned-material tonal treatment evaluated in authored time, independently of the optional extended navigation clock.
- `app/camera-space/`, `src/player/CameraSpace.tsx`, `CameraSpace.module.css`, `cameraSpaceFeeds.ts`: an isolated route with its own Three.js scene. The adapter defines the ten stops, binds the original eight anchors to slots 0, 1, 3, 4, 5, 7, 8, 9 and the ship and apron extras to slots 2 and 6, and puts them on a seconds clock (hold starts at 7.5 + slot × 9.5, each hold 3 s). The route maps eased travel between stops onto that clock and hands it to `createRecordedFeed`, which keeps ownership of preparation, the two-decoder bound and release. `recordedFeed.ts` accepts an optional same-canvas caption callback; absent, behavior is unchanged.
- `src/player/Startup.tsx`: foreground-time opening sequence and interaction barrier.
- `public/assets/machine/`: the bundled scene and minimal public manifest.
- `tests/`: contract, timing, route and lifecycle checks.

## Time and ownership

The authored animation owns spatial transforms. Input changes the time at which it is evaluated; the player does not construct a competing camera path. Reference mode and diagnostic bookmarks use exact local clip seconds, not television footage timestamps. Playback advances by visible elapsed time, while manual input is bounded. Hidden-tab handling prevents accumulated hidden time from becoming a jump.

## Assets and privacy

Scene geometry, animation, materials and textures are embedded in GLB. Public packaging removes private production annotations from the asset header, while retaining image content credentials and functional scene data. No private production projects, source captures, logs or editing histories are needed to run the app.

## Change boundaries

Keep navigation, scene assets, ambient behavior and opening changes independently reviewable. Match snapshots at identical authored times and test forward/reverse transitions. A test pass establishes its stated control contract; actual render quality and device performance require separate observation.
