# Asset provenance and licensing

The bundled GLB contains original project-authored geometry and animation produced with Unity and Blender. Its photographic panes use fictional AI-generated surveillance-style stills, with atlas and format derivatives for rendering. These are not television footage or real surveillance images. The one exception is the optional recorded-feed experiment below, whose videos are real recordings from a public research dataset. No show video, reference screenshot collection or private production prompt is bundled.

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
| Recorded-feed excerpts (`recorded-feeds/m01` to `m07`, opt-in only) | MEVA dataset, Kitware, Inc. / IARPA; excerpted and re-encoded | CC BY 4.0 (video, poster and project-authored tracking), not MIT |

## Optional recorded-feed experiment (`?recordedFeed=1`)

Seven of the eight screens can show a recorded excerpt, and only when the URL opts in. Screen 2 (`screen_02_roadside_car`) has no recorded media yet and keeps its original still. The default scene loads none of these files.

| Screen | Folder | Source (MEVA camera, site label from filename) | Excerpt seconds | `loop.mp4` SHA-256 |
| --- | --- | --- | --- | --- |
| 1 `screen_01_hallway` | `m05` | G330 (school), [2018-05-18.12-15-00.12-20-00.school.G330.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drop-5-mevid/2018-05-18.12-15-00.12-20-00.school.G330.r13.avi) | 90-120 | `4743281DB4EDAF75EA81E6024BFBAE9961C2E6D739B5ABDDE1352A3B45A241A6` |
| 3 `screen_03_lockers` | `m06` | G328 (school), [2018-03-13.17-35-00.17-40-00.school.G328.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drops-123-r13/2018-03-13/17/2018-03-13.17-35-00.17-40-00.school.G328.r13.avi) | 15-50 | `BE9A010A04D614C3D36CD8D93774A578BA5E36D5BF4199CAC69E8F978EA6F8D4` |
| 4 `screen_04_armed_corridor` | `m04` | G436 (hospital), [2018-05-18.15-15-07.15-20-07.hospital.G436.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drop-5-mevid/2018-05-18.15-15-07.15-20-07.hospital.G436.r13.avi) | 75-100 | `5B18F7078826CBFEC07D00C57FE83D447570D673A1C2FC1161F875909F602B87` |
| 5 `screen_05_stairwell_person` | `m07` | G639 (school), [2018-05-16.14-25-01.14-30-01.school.G639.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drop-5-mevid/2018-05-16.14-25-01.14-30-01.school.G639.r13.avi) | 10-45 | `F4EC720F3DA77F451832F799EEE31678522F3C941A2B913063849FAA135C419E` |
| 6 `screen_06_clock_hallway` | `m01` | G326 (admin), [2018-03-09.10-10-01.10-15-01.admin.G326.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drops-123-r13/2018-03-09/10/2018-03-09.10-10-01.10-15-01.admin.G326.r13.avi) | 5-30 | `A2CADFA77809F0164E2694D04816A23AA7E6C3E8A54B3A7ABD22286C6F901352` |
| 7 `screen_07_workroom` | `m02` | G341 (hospital), [2018-03-15.15-55-06.16-00-06.hospital.G341.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drops-123-r13/2018-03-15/16/2018-03-15.15-55-06.16-00-06.hospital.G341.r13.avi) | 25-80 | `9B649CFEAAB4DE2B1FFE4716493E59ECD2DF8FC1CAF73B8A1336B1BC9B42E471` |
| 8 `screen_08_cafeteria` | `m03` | G301 (hospital), [2018-05-16.18-20-00.18-25-00.hospital.G301.r13.avi](https://mevadata-public-01.s3.amazonaws.com/drop-5-mevid/2018-05-16.18-20-00.18-25-00.hospital.G301.r13.avi) | 270-300 | `26D7CE54F3BED7825A0E1E5C6AAC21EFF17A072180BDA301DACC8257D50B9248` |

- **Credit:** MEVA, Kitware, Inc. / IARPA.
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); dataset statement at <https://mevadata.org/resources/MEVA-data-license.txt>. The full terms are at those links; this file only summarizes them.
- **Changes:** each source was cut to the excerpt above, audio removed, re-encoded as H.264 at the native frame rate, and a poster frame extracted.
- **Tracking:** each `tracking.json` is project-authored marker data (neutral tracks, normalized top-left bounds), not live inference or identification. It is licensed CC BY 4.0 together with the video and poster as one asset package.
- **License scope:** `loop.mp4` and `poster.jpg` retain CC BY 4.0 from the source material, and the project-authored `tracking.json` is also offered under CC BY 4.0 as part of that asset package. The original application code remains MIT.
- **Limitations:** ordinary recorded replays, not live cameras. Loop seams are not guaranteed to be invisible. Not endorsed by MEVA, Kitware or IARPA.

The same summary ships beside the files in each `public/assets/recorded-feeds/mXX/CREDITS.txt`.
