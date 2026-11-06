import type { Metadata } from "next";

import { ScenePlayer } from "../../src/player/ScenePlayer";
import type { QueryRecord } from "../../src/player/time";

export const metadata: Metadata = { title: "Machine — reference player" };

export default async function MachinePage({ searchParams }: { searchParams: Promise<QueryRecord> }) {
  return <ScenePlayer world="machine" query={await searchParams} />;
}
