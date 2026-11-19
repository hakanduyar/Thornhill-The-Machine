# Thornhill — The Machine

[Repository](https://github.com/hakanduyar/Thornhill-The-Machine) · [Issues](https://github.com/hakanduyar/Thornhill-The-Machine/issues)

An experimental, full-screen 3D interface inspired by *Person of Interest*. Explore a layered information world and visit 8 anchored photographic screens. The scene, camera and route are imported from a bundled GLB; the player controls time along that route.

This is an unofficial fan interface, not a surveillance service or an official production asset. The eight photographs are synthetic stills, not footage from the series. An optional experiment (below) replaces seven of them with short recorded excerpts from a public research dataset; the second still stays as it is.

## Try the demo

[Open the live demo](https://hakanduyar.github.io/Thornhill-The-Machine/). No installation or account is required. The demo loads a bundled 3D scene, so the first visit may take longer on a slow connection.

Use a WebGL-capable browser with hardware acceleration available. A landscape viewport fits the authored camera framing best; portrait layout and lower-powered devices still need broader testing. This is an experimental preview, not a guarantee of smooth performance on every device.

The default demo does not automatically include every experimental scene or opening candidate. For a reproducible static build and deployment procedure, see [Static demo deployment](docs/STATIC-DEMO.md).

## Run locally

Requires Node.js 22 or newer and pnpm 11.17.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. For a production build:

```sh
pnpm build
pnpm start
```

## Controls

- Wheel: continuous forward/backward movement along the authored route.
- Touch: one vertical swipe moves one focus stop forward (swipe up) or back (swipe down), in portrait and landscape. Tapping during the trip cancels it. In `mode=reference` (exact mode), touch drag moves along the route as before.
- Arrow/Page keys: navigate; Space or K: toggle playback.
- Home/End: navigate to the route boundaries.
- `/machine?mode=reference&t=10&qa=1`: exact authored-time inspection with diagnostic controls.

The opening completes before interactive navigation begins. The authored route lasts approximately 84.68 seconds at 1× playback. Manual navigation uses bounded acceleration and compressed stationary holds; playback retains the full authored timing. The network contains a larger distant branching formation and smaller surrounding clouds.

## Optional recorded-feed experiment

Add `?recordedFeed=1` to an interactive Machine URL (for example `/machine?recordedFeed=1`) to replace seven of the eight screens with muted video excerpts (25 to 55 seconds each). Screen 2 (`screen_02_roadside_car`) has no recorded excerpt yet and keeps its original still. Each video starts preparing as the route approaches its screen, plays while that screen is in view, and stops when the route moves away or the tab is hidden. At most two videos are decoded at once (the current screen and the nearest upcoming one). Neutral square markers are drawn over the footage from authored tracking data, not live detection.

The default page, exact `mode=reference`, and `prefers-reduced-motion` are unchanged and show the stills. Nothing from the experiment is fetched without the parameter. If a video cannot load or autoplay is blocked, that screen keeps its still image and the others are unaffected.

Limits: these are ordinary recorded replays, not live cameras. Loop points are not guaranteed to be seamless. Seven of eight screens are covered; this is not a claim that all eight are live. Credits, source and license are in [ASSETS.md](ASSETS.md) and `public/assets/recorded-feeds/mXX/CREDITS.txt` beside each excerpt.

## Project status

A working experimental preview, not a production or accessibility certification. The public source has received navigation updates since its initial checkpoint; it is not claimed to reproduce an archived build byte for byte. Desktop and portrait visual consistency, continuous-motion comfort and performance across devices still need broader testing. See [the roadmap](docs/ROADMAP.md).

`pnpm test` runs control, scene-contract and lifecycle checks; `pnpm typecheck` checks TypeScript. Tests use synthetic fixtures or a real GLB with a simulated renderer and do not replace browser visual review.

## How it works

[Architecture decisions](docs/decisions/README.md) explain the technology choices, tradeoffs and conditions for revisiting them.

Next.js and React host a Three.js player. A small manifest identifies the authoritative camera, animation, duration and screen anchors. No accounts, analytics service or application backend are configured. See [architecture](docs/ARCHITECTURE.md) and [asset provenance](ASSETS.md).

## AI-assisted development

Claude Code contributed to scene authoring and production implementation. Codex contributed implementation, integration, orchestration, tests and independent review. OpenAI image generation produced the fictional photographic stills. Unity and Blender were used for scene production and export. Human direction and visual decisions guided the result. This is an account of actual tool roles, not a claim of hand-authored work or a fabricated contributor history.

## Contributing and license

Focused improvements and reproducible bug reports are welcome; see [contributing](CONTRIBUTING.md). Application source is offered under the [MIT license](LICENSE). Scene/media licensing is described separately in [ASSETS.md](ASSETS.md). Names and imagery associated with the original series are not endorsed or licensed by this project.
