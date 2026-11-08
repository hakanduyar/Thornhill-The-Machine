// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import type {SceneManifest} from '../src/contract/manifest';
import type {PlayerOptions} from '../src/player/runtime';
const mock=vi.hoisted(()=>({options:null as PlayerOptions|null,unlock:vi.fn(),dispose:vi.fn()}));
vi.mock('../src/player/runtime',()=>({createPlayer:(options:PlayerOptions)=>{
  mock.options=options;options.onStatus({state:'loading'});
  return {controller:{setInteractionReady:mock.unlock},dispose:mock.dispose};
}}));
import {ScenePlayer} from '../src/player/ScenePlayer';

it('unlocks input synchronously with real ready, before the overlay effect',async()=>{
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try {
    await act(async()=>root.render(<ScenePlayer world="machine" query={{}}/>));
    expect(mock.unlock).not.toHaveBeenCalled();
    await act(async()=>{
      mock.options!.onStatus({state:'ready',manifest:{} as SceneManifest});
      // Assert within the status callback turn, without yielding for effects.
      expect(mock.unlock).toHaveBeenCalledOnce();
    });
  } finally {await act(async()=>root.unmount());host.remove();}
});
