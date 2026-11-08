import {Suspense} from 'react';
import {redirect} from 'next/navigation';
import {SceneFromLocation} from '../src/player/SceneFromLocation';
import {SceneFallback} from '../src/player/SceneFallback';
export default function Index(){
 if(process.env.STATIC_EXPORT==='1')return <Suspense fallback={<SceneFallback/>}><SceneFromLocation world="machine"/></Suspense>;
 redirect('/machine');
}
