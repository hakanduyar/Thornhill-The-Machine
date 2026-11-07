// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Startup } from '../src/player/Startup';

let host: HTMLDivElement; let root: Root; let complete: () => void; let completeSpy: ReturnType<typeof vi.fn>;
const show = (ready: boolean) => act(async () => root.render(<Startup ready={ready} onComplete={complete} />));
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host); completeSpy = vi.fn(); complete = completeSpy as unknown as () => void;
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  vi.useRealTimers(); vi.unstubAllGlobals();
});

it('shows the panel while loading and never completes on elapsed time (slow load)', async () => {
  await show(false);
  expect(host.textContent).toContain('PREPARING SCENE');
  expect(host.textContent).not.toMatch(/RESETTING|%/);
  await act(async () => { vi.advanceTimersByTime(60_000); });
  expect(host.textContent).toContain('PREPARING SCENE'); expect(completeSpy).not.toHaveBeenCalled();
});

it('is removed immediately on real readiness with no artificial delay (fast ready)', async () => {
  await show(false); await show(true);
  expect(host.textContent).toBe(''); expect(completeSpy).toHaveBeenCalledTimes(1);
});

it('never reappears or completes twice after readiness', async () => {
  await show(true); await show(true); await show(false);
  expect(host.textContent).toBe('');
  await show(true);
  expect(host.textContent).toBe(''); expect(completeSpy).toHaveBeenCalledTimes(1);
});

it('does not depend on tab visibility or animation frames (hidden tab)', async () => {
  const raf = vi.fn(); vi.stubGlobal('requestAnimationFrame', raf);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  await show(false); document.dispatchEvent(new Event('visibilitychange'));
  expect(host.textContent).toContain('PREPARING SCENE'); expect(completeSpy).not.toHaveBeenCalled();
  await show(true);
  expect(host.textContent).toBe(''); expect(completeSpy).toHaveBeenCalledTimes(1); expect(raf).not.toHaveBeenCalled();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

it('keeps a text activity indicator that does not rely on motion (reduced motion)', async () => {
  await show(false);
  const css = (await import('node:fs')).readFileSync('app/globals.css', 'utf8');
  expect(css).toMatch(/prefers-reduced-motion:reduce\)[^}]*\.machine-panel-mark \{ animation:none; \}[^}]*machine-panel-row::after \{ content:"\.\.\."/);
  expect(host.querySelector('[role=status]')?.getAttribute('aria-label')).toBe('Preparing scene');
});

it('unmounts without completing when loading fails (error stays with the player)', async () => {
  await show(false); await act(async () => root.render(<div />));
  expect(host.textContent).toBe(''); expect(completeSpy).not.toHaveBeenCalled();
});
