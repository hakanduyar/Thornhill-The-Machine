import type { Metadata } from "next";

import { CameraSpace } from "../../src/player/CameraSpace";

export const metadata: Metadata = { title: "Camera space" };

export default function CameraSpacePage() {
  return <CameraSpace />;
}
