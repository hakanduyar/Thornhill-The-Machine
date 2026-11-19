import {Suspense} from 'react';
import {SceneFromLocation} from '../../src/player/SceneFromLocation';
import {SceneFallback} from '../../src/player/SceneFallback';
import type { Metadata } from "next";

import { ScenePlayer } from "../../src/player/ScenePlayer";
import type { QueryRecord } from "../../src/player/time";

export const metadata: Metadata = { title: "Machine — reference player" };

export default async function MachinePage({ searchParams }: { searchParams: Promise<QueryRecord> }) {
  const preload = <link rel="preload" href={process.env.NEXT_PUBLIC_SCENE_PRELOAD_URL} as="fetch" crossOrigin="anonymous" />;
  if(process.env.STATIC_EXPORT==='1')return <>{preload}<Suspense fallback={<SceneFallback/>}><SceneFromLocation world="machine"/></Suspense></>;
  return <>{preload}<ScenePlayer world="machine" query={await searchParams} /></>;
}
