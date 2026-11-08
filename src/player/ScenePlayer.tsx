"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { World } from "../contract/manifest";
import { QaPanel } from "./QaPanel";
import { Startup } from "./Startup";
import { createPlayer, type PlayerController, type PlayerHandle, type PlayerStatus } from "./runtime";
import { parsePlayerParams, type QueryRecord } from "./time";

const WORLD_LABEL: Record<World, string> = { samaritan: "Samaritan", machine: "Machine" };

export interface ScenePlayerProps {
  world: World;
  query: QueryRecord;
}

/**
 * Full-viewport player for one world. Stable markers live on
 * `[data-reference-marker]`: data-state (loading|ready|missing|error) and
 * data-time (canonical clip seconds, 6 decimals) are written by the runtime.
 */
export function ScenePlayer({ world, query }: ScenePlayerProps) {
  const paramsKey = JSON.stringify(parsePlayerParams(query));
  const params = useMemo(() => JSON.parse(paramsKey) as ReturnType<typeof parsePlayerParams>, [paramsKey]);

  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<PlayerStatus>({ state: "loading" });
  const [controller, setController] = useState<PlayerController | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    const frame = frameRef.current;
    const marker = markerRef.current;
    if (!host || !frame || !marker) return;
    const handle: PlayerHandle = createPlayer({ world, params, host, frame, marker, onStatus: (next) => {
      // Real readiness already means the first frame was drawn. Unlock input
      // in this same callback, before React's later overlay-dismissal effect.
      if (next.state === "ready") handle.controller.setInteractionReady();
      setStatus(next);
    },
      interactionReady: !(world === "machine" && params.mode === "interactive") });
    setController(handle.controller);
    return () => {
      handle.dispose();
      setController(null);
    };
  }, [world, params, attempt]);

  const label = WORLD_LABEL[world];
  const startup = world === "machine" && params.mode === "interactive";
  const completeStartup = useCallback(() => controller?.setInteractionReady(), [controller]);

  return (
    <main className="ref-player" ref={hostRef} aria-label={`${label} scene`}>
      {/* Marker attributes are owned by the runtime after mount; React never re-sets them. */}
      <div
        ref={markerRef}
        hidden
        data-reference-marker=""
        data-world={world}
        data-mode={params.mode}
        data-state="loading"
        data-time=""
      />
      <div className="ref-frame" ref={frameRef} />
      {startup && (status.state === "loading" || status.state === "ready") ? <Startup key={`${paramsKey}:${attempt}`} ready={status.state === "ready"} onComplete={completeStartup} detail={status.state === "loading" ? status.detail : undefined} loadedBytes={status.state === "loading" ? status.loadedBytes : undefined} /> : null}
      {status.state !== "ready" && !(startup && status.state === "loading") ? (
        <div className="ref-status" role="status" aria-live="polite">
          {status.state === "loading" ? (
            <p>{label}: loading scene…</p>
          ) : (
            <div>
              <p className="ref-status-title">
                {label}: {status.message}
              </p>
              <p className="ref-status-detail">{status.detail}</p>
              <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry loading scene</button>
            </div>
          )}
        </div>
      ) : null}
      {params.qa && status.state === "ready" && controller ? (
        <QaPanel controller={controller} manifest={status.manifest} />
      ) : null}
    </main>
  );
}
