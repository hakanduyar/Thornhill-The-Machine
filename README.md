# Thornhill — The Machine

[Repository](https://github.com/hakanduyar/Thornhill-The-Machine) · [Issues](https://github.com/hakanduyar/Thornhill-The-Machine/issues)

An experimental, full-screen 3D interface inspired by *Person of Interest*. Explore a layered information world and visit 8 anchored photographic screens. The scene, camera and route are imported from a bundled GLB; the player controls time along that route.

This is an unofficial fan interface, not a surveillance service or an official production asset. The eight photographs are synthetic stills, not footage from the series. An optional experiment (below) replaces one of them with a short recorded excerpt from a public research dataset.

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

Add `?recordedFeed=1` to an interactive Machine URL (for example `/machine?recordedFeed=1`) to replace only the first screen (`screen_01_hallway`) with a 30-second muted video excerpt. The video starts preparing as the route approaches that screen, plays while the screen is in view, and stops when the route moves away or the tab is hidden. Neutral square markers are drawn over the footage from authored tracking data, not live detection.

The default page, exact `mode=reference`, and the other seven screens are unchanged. Nothing from the experiment is fetched without the parameter. If the video cannot load or autoplay is blocked, the still image stays and the scene remains usable. Under `prefers-reduced-motion` the experiment is not started.

Limits: this is an ordinary recorded replay, not a live camera. The loop point is not guaranteed to be seamless, and only the first feed is covered; it is not a claim that all eight screens are live. Credits, source and license are in [ASSETS.md](ASSETS.md) and `public/assets/recorded-feeds/m05/CREDITS.txt`.

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
