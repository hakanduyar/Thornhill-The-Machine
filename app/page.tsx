import {Suspense} from 'react';
import {redirect} from 'next/navigation';
import {SceneFromLocation} from '../src/player/SceneFromLocation';
import {SceneFallback} from '../src/player/SceneFallback';
export default function Index(){
 if(process.env.STATIC_EXPORT==='1')return <><link rel="preload" href={process.env.NEXT_PUBLIC_SCENE_PRELOAD_URL} as="fetch" crossOrigin="anonymous" /><Suspense fallback={<SceneFallback/>}><SceneFromLocation world="machine"/></Suspense></>;
 redirect('/machine');
}
