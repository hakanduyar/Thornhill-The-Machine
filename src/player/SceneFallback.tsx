import { assetPath } from '../contract/assetPath';

/** Static HTML remains useful while the application scripts are still arriving. */
export function SceneFallback() {
  return <main className="ref-player" aria-label="Loading scene">
    <div className="sam-startup machine-startup" role="status">
      <div className="machine-panel">
        <div className="machine-panel-title">SYSTEM</div><div className="machine-panel-rule" />
        <div className="machine-panel-row">CONNECTING TO SCENE</div>
        <a href={assetPath('/machine/')} className="machine-panel-progress">Reload page</a>
        <noscript>JavaScript is required to display this scene.</noscript>
      </div>
    </div>
  </main>;
}
