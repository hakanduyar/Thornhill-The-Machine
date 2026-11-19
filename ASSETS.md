# Asset provenance and licensing

The bundled GLB contains original project-authored geometry and animation produced with Unity and Blender. Its photographic panes use fictional AI-generated surveillance-style stills, with atlas and format derivatives for rendering. These are not television footage or real surveillance images. The one exception is the optional recorded-feed experiment below, whose video is a real recording from a public research dataset. No show video, reference screenshot collection or private production prompt is bundled.

## License scope

The [MIT license](LICENSE) does not cover `public/assets/recorded-feeds/m05/` (see below). It covers the original application source, tests, authored scene geometry/animation and generated still-image assets, to the extent the project can license them. This grant does not assert exclusive ownership of generated output or grant rights to third-party trademarks, characters, television footage or other third-party material. Dependencies retain their own licenses. System font families are referenced through CSS; no font files are distributed.

*Person of Interest* and related names belong to their respective rights holders. This is an unofficial fan interface and is not affiliated with or endorsed by the original production. Inspiration is not a claim of official provenance.

## Transparency and packaging

OpenAI image generation produced the synthetic photographic stills. Existing embedded content credentials remain where present; they record generation provenance rather than a rights guarantee. Private production annotations were removed from the GLB header without changing geometry, animation, material data or decoded texture pixels. The public scene manifest contains only the runtime contract and authored-time bookmarks.

| Material | Origin | Distribution |
|---|---|---|
| Scene geometry and camera animation | Original project authoring with Unity and Blender | MIT, within the scope above |
| Photographic atlas and focal stills | Synthetic image generation and derived encodings | MIT, within the scope above |
| Interface code and procedural visual elements | Original project implementation | MIT |
| Referenced system fonts | Installed on the viewer's device | Not bundled |
| External library code | Resolved through the package lockfile | Respective upstream licenses |
| Recorded-feed excerpt (`recorded-feeds/m05`, opt-in only) | MEVA dataset, Kitware, Inc. / IARPA; excerpted and re-encoded | CC BY 4.0 (video, poster and project-authored tracking), not MIT |

## Optional recorded-feed experiment (`?recordedFeed=1`)

Only the first screen can show a recorded excerpt, and only when the URL opts in. The default scene loads none of these files.

- **Source:** MEVA camera G330 (school gymnasium), [2018-05-18.12-15-00.12-20-00.school.G330.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drop-5-mevid/2018-05-18.12-15-00.12-20-00.school.G330.r13.avi), seconds 90-120.
- **Credit:** MEVA, Kitware, Inc. / IARPA.
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); dataset statement at <https://mevadata.org/resources/MEVA-data-license.txt>. The full terms are at those links; this file only summarizes them.
- **Changes:** excerpted 30 seconds, audio removed, re-encoded as H.264 at the native frame rate, poster frame extracted. `loop.mp4` SHA-256 `4743281DB4EDAF75EA81E6024BFBAE9961C2E6D739B5ABDDE1352A3B45A241A6`.
- **Tracking:** `tracking.json` is project-authored marker data (14 neutral tracks, normalized top-left bounds), not live inference or identification. It is licensed CC BY 4.0 together with the video and poster as one asset package.
- **License scope:** `loop.mp4` and `poster.jpg` retain CC BY 4.0 from the source material, and the project-authored `tracking.json` is also offered under CC BY 4.0 as part of that asset package. The original application code remains MIT.
- **Limitations:** an ordinary recorded replay, not a live camera. The loop seam is not guaranteed to be invisible. Not endorsed by MEVA, Kitware or IARPA.

The same summary ships beside the files in `public/assets/recorded-feeds/m05/CREDITS.txt`.
