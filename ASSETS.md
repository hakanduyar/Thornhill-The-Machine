# Asset provenance and licensing

The bundled GLB contains original project-authored geometry and animation produced with Unity and Blender. Its photographic panes use fictional AI-generated surveillance-style stills, with atlas and format derivatives for rendering. These are not television footage or real surveillance images. The one exception is the optional recorded-feed experiment below, whose videos are real recordings from a public research dataset (plus, in the extended itinerary only, two NASA excerpts). No show video, reference screenshot collection or private production prompt is bundled.

## License scope

The [MIT license](LICENSE) does not cover `public/assets/recorded-feeds/` (see below). It covers the original application source, tests, authored scene geometry/animation and generated still-image assets, to the extent the project can license them. This grant does not assert exclusive ownership of generated output or grant rights to third-party trademarks, characters, television footage or other third-party material. Dependencies retain their own licenses. System font families are referenced through CSS; no font files are distributed.

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
| Camera-space roadside still (`camera-space/roadside-still.webp`) | Lossless crop of the synthetic atlas already embedded in the bundled GLB; see `public/assets/camera-space/CREDITS.md`. Retained in the repository, no longer shown by the camera-space interface | MIT, within the scope above |
| Recorded-feed excerpts (`recorded-feeds/m01` to `m04`, `m06`, `m07`, `covered-road` and `parking-walk`, opt-in only; the earlier `m05` files remain in the repository as an unused rollback) | MEVA dataset, Kitware, Inc. / IARPA; excerpted and re-encoded | CC BY 4.0 (video, poster and project-authored tracking), not MIT |
| Recorded-feed excerpt (`recorded-feeds/docked-cargo`, extended itinerary only) | Mixkit stock video; excerpted and re-encoded | Mixkit Stock Video Free License (video and poster), MIT (project-authored tracking), not MIT/CC for the footage |
| Recorded-feed excerpt (`recorded-feeds/apron`, extended itinerary only; the earlier `ship` files remain as an unused rollback) | NASA Scientific Visualization Studio; excerpted and re-encoded | NASA public domain (video and poster), CC BY 4.0 (project-authored tracking), not MIT |

## Optional recorded-feed experiment (`?recordedFeed=1`)

All eight screens can show a recorded excerpt, and only when the URL opts in. The default scene loads none of these files.

| Screen | Folder | Source (MEVA camera, site label from filename) | Excerpt seconds | `loop.mp4` SHA-256 |
| --- | --- | --- | --- | --- |
| 1 `screen_01_hallway` | `parking-walk` | G424 (school), [2018-03-09.10-10-00.10-15-00.school.G424.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drops-123-r13/2018-03-09/10/2018-03-09.10-10-00.10-15-00.school.G424.r13.avi); fixed 1152x648 crop at x=768, y=432, scaled to 960x540, H.264 CRF 25 at the native 30 fps, silent, faststart, 2990605 bytes, forward only (not a new location, not a seamless composition) | 148-190 | `4BFDC569336B7A8819A736400321B86336FA50956887B162F3FAD40B8CFF9B18` |
| 2 `screen_02_roadside_car` | `covered-road` | G505 (bus), [2018-05-18.14-25-00.14-30-00.bus.G505.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drop-5-mevid/2018-05-18.14-25-00.14-30-00.bus.G505.r13.avi); fixed 672x378 crop at x=1248, y=0 of the 1920x1072 frame, scaled to 960x540 at 30 fps, forward only (not a new location, not a seamless composition) | 95-115 | `A98328C58D8F66FD5C267DE7462D3C3AF3107011E064107A2FB1556E4E3DFE1D` |
| 3 `screen_03_lockers` | `m06` | G328 (school), [2018-03-13.17-35-00.17-40-00.school.G328.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drops-123-r13/2018-03-13/17/2018-03-13.17-35-00.17-40-00.school.G328.r13.avi) | 15-50 | `BE9A010A04D614C3D36CD8D93774A578BA5E36D5BF4199CAC69E8F978EA6F8D4` |
| 4 `screen_04_armed_corridor` | `m04` | G436 (hospital), [2018-05-18.15-15-07.15-20-07.hospital.G436.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drop-5-mevid/2018-05-18.15-15-07.15-20-07.hospital.G436.r13.avi) | 75-100 | `5B18F7078826CBFEC07D00C57FE83D447570D673A1C2FC1161F875909F602B87` |
| 5 `screen_05_stairwell_person` | `m07` | G639 (school), [2018-05-16.14-25-01.14-30-01.school.G639.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drop-5-mevid/2018-05-16.14-25-01.14-30-01.school.G639.r13.avi) | 10-45 | `F4EC720F3DA77F451832F799EEE31678522F3C941A2B913063849FAA135C419E` |
| 6 `screen_06_clock_hallway` | `m01` | G326 (admin), [2018-03-09.10-10-01.10-15-01.admin.G326.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drops-123-r13/2018-03-09/10/2018-03-09.10-10-01.10-15-01.admin.G326.r13.avi) | 5-30 | `A2CADFA77809F0164E2694D04816A23AA7E6C3E8A54B3A7ABD22286C6F901352` |
| 7 `screen_07_workroom` | `m02` | G341 (hospital), [2018-03-15.15-55-06.16-00-06.hospital.G341.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drops-123-r13/2018-03-15/16/2018-03-15.15-55-06.16-00-06.hospital.G341.r13.avi) | 25-80 | `9B649CFEAAB4DE2B1FFE4716493E59ECD2DF8FC1CAF73B8A1336B1BC9B42E471` |
| 8 `screen_08_cafeteria` | `m03` | G301 (hospital), [2018-05-16.18-20-00.18-25-00.hospital.G301.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drop-5-mevid/2018-05-16.18-20-00.18-25-00.hospital.G301.r13.avi) | 270-300 | `26D7CE54F3BED7825A0E1E5C6AAC21EFF17A072180BDA301DACC8257D50B9248` |

- **Credit:** MEVA, Kitware, Inc. / IARPA.
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); dataset statement at <https://mevadata.org/resources/MEVA-data-license.txt>. The full terms are at those links; this file only summarizes them.
- **Changes:** each source was cut to the excerpt above, audio removed, re-encoded as H.264 at the native frame rate, and a poster frame extracted. `parking-walk` was additionally cropped, scaled and re-encoded (CRF 25) as described in its row; its 42-second excerpt begins and ends with an empty scene, so it cycles naturally, which is a factual description of that clip and not a claim that any loop seam is invisible. The empty entry and exit are observed, not final tracking proof. `covered-road` was additionally cropped and scaled as described in its row, re-encoded at 30 fps with metadata removed. Its source ETag is multipart (`b1d536ea5714a585e1593be81acbbac3-18`), not a content hash, and no full-file source SHA-256 is recorded; `poster.jpg` SHA-256 is `4FE34677DFF19437DFE4DDC39A3F0CB2874B08C48FDC9F67CF47771BD8ED48D5`.
- **Tracking:** each `tracking.json` is project-authored marker data (neutral tracks, normalized top-left bounds), not live inference or identification. It is licensed CC BY 4.0 together with the video and poster as one asset package.
- **License scope:** `loop.mp4` and `poster.jpg` retain CC BY 4.0 from the source material, and the project-authored `tracking.json` is also offered under CC BY 4.0 as part of that asset package. The original application code remains MIT.
- **Limitations:** ordinary recorded replays, not live cameras. Loop seams are not guaranteed to be invisible. Not endorsed by MEVA, Kitware or IARPA.

The same summary ships beside the files in each `public/assets/recorded-feeds/mXX/CREDITS.txt` and `covered-road/CREDITS.txt`.

## Extended itinerary NASA excerpts (`?recordedFeed=1&itinerary=extended`)

Two further silent excerpts appear only in the extended itinerary, on two panes that exist only there. They come from NASA, not from the MEVA dataset, and are not licensed under CC BY 4.0 or MIT as footage. The default scene and `?recordedFeed=1` alone fetch none of these files.

| Pane | Folder | Source | Excerpt | Length | `loop.mp4` SHA-256 |
| --- | --- | --- | --- | --- | --- |
| ship | `ship` | NASA SVS [Seal Beach - MN Colibri departure](https://svs.gsfc.nasa.gov/13964/), published 2021-10-21 | seconds 22-54 | 32 s | `32CF688646D584DBA602B66868B5C93C673D66693170C216B4220A2478C3F7A7` |
| apron | `apron` | NASA SVS [Palmdale DC-8 apron monitoring](https://svs.gsfc.nasa.gov/12488/) | seconds 77-110 | 33 s | `5E2DD27902145F27DBFB0EC7BDC3A816A046A2F2E4A08F861A3C0C54E962C0C4` |

- **Credit:** ship: NASA's Goddard Space Flight Center (videographers Michael McClare, Sophia Roberts, Michael P. Menzel). Apron: NASA; video by Steve Parcel.
- **License of the footage:** NASA SVS publishes its content as public domain unless otherwise noted, and no exception is indicated for either excerpt ([NASA SVS policy](https://svs.gsfc.nasa.gov/help/)). The MIT license does not apply to `public/assets/recorded-feeds/ship/` or `apron/`, and no endorsement by NASA is implied.
- **Tracking:** each `tracking.json` is project-authored (one neutral object track, normalized top-left bounds, not live inference), offered under CC BY 4.0. The application code remains MIT.
- **Changes:** ship: cut, resized to 720x540 and pillarboxed to 960x540, re-encoded as silent H.264, poster extracted. Apron: cut to a fixed-camera segment (an earlier cut's first 2 seconds, which opened with a zoom, were removed), re-encoded as silent H.264 at 960x540 and 24 fps, new poster at t=0.
- **Limitations:** ordinary recorded replays, not live cameras. The ship clip ends after the ship has left, and neither loop point is seamless. The apron aircraft is parked.

The `ship` folder (NASA, Seal Beach departure) is retained only as an unused rollback; the extended itinerary no longer loads it. The table and notes above for `ship` describe that retained rollback source.

### Docked cargo ship (active third-stop pane, extended itinerary only)

The active ship pane id is `docked-cargo`. It is silent and fetched only with both URL parameters.

| Pane | Folder | Source | Excerpt | Length | `loop.mp4` SHA-256 |
| --- | --- | --- | --- | --- | --- |
| ship pane | `docked-cargo` | Mixkit [Empty cargo ship waiting at the port](https://mixkit.co/free-stock-video/empty-cargo-ship-waiting-at-the-port-4209/) (1280x720, 26.32 s; media file `https://assets.mixkit.co/videos/4209/4209-720.mp4`), retrieved 2026-11-19 | seconds 12-20 | 8 s | `0B0BE771A5336114457A3886B91011D9CFDEA32BFDA6DE3BA05CB0BC1989880D` |

- **Credit:** Mixkit.
- **License of the footage:** `loop.mp4` and `poster.jpg` are under the [Mixkit Stock Video Free License](https://mixkit.co/license/modal/videoFree/) and the [Mixkit terms](https://mixkit.co/terms/) (2025-10-02). They are not MIT and not Creative Commons. The license allows download, copying, modification and distribution in commercial and noncommercial projects, subject to the terms, and excludes stock-inventory or similar services and unmodified commercial resale. These files are distributed only as part of this project, not as a standalone free asset library. See the linked pages for the full conditions.
- **Tracking:** `tracking.json` is project-authored (one neutral static whole-vessel box, id `vessel01`, normalized top-left bounds, not live inference), offered under MIT. The application code remains MIT.
- **Changes:** cut to seconds 12-20 with no crop, reversal, fade or stabilization; resized to 960x540, re-encoded as silent H.264 (CRF 25, fast-start); poster extracted.
- **Limitations:** an ordinary recorded replay, not a live camera. The ship is stationary and docked (not a ferry or a departure). The restart is a plain loop point, not a pixel-perfect seamless water loop. Not endorsed by Mixkit.

Provenance is also in `public/assets/recorded-feeds/docked-cargo/CREDITS.txt`, `ship/CREDITS.txt` (rollback) and `apron/CREDITS.txt`.
