import {Suspense} from 'react';
import {SceneFromLocation} from '../../src/player/SceneFromLocation';
import {SceneFallback} from '../../src/player/SceneFallback';
import type { Metadata } from "next";

import { ScenePlayer } from "../../src/player/ScenePlayer";
import type { QueryRecord } from "../../src/player/time";

export const metadata: Metadata = { title: "Machine — reference player" };

export default async function MachinePage({ searchParams }: { searchParams: Promise<QueryRecord> }) {
  if(process.env.STATIC_EXPORT==='1')return <Suspense fallback={<SceneFallback/>}><SceneFromLocation world="machine"/></Suspense>;
  return <ScenePlayer world="machine" query={await searchParams} />;
}
