import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  RotateCcw,
  Plus,
  Minus,
  Eye,
  EyeOff,
  Focus,
  Tags,
  Box,
  Scan,
  PanelsTopLeft,
  Move,
  MousePointer2,
  Expand,
  Rotate3d,
} from "lucide-react";
import type { AnatomyAsset } from "../atlas/types";
import type { Plane } from "../atlas/spatial";
import { SceneBoundary } from "../atlas/SceneBoundary";
import SliceViewer from "../atlas/SliceViewer";
const BrainScene = lazy(() => import("../atlas/BrainScene"));

export interface ViewportProps {
  assets: AnatomyAsset[];
  selectedId: string | null;
  highlightedId?: string | null;
  onSelect: (id: string) => void;
  assessment?: boolean;
  reducedMotion: boolean;
  view: "3d" | "split" | "slices";
  setView: (v: "3d" | "split" | "slices") => void;
  plane: Plane;
  setPlane: (p: Plane) => void;
  sliceIndex: number;
  setSliceIndex: (i: number) => void;
  onReady?: (ready: boolean) => void;
  onError?: (message: string) => void;
  title: string;
  questionKey?: string;
  onLabels?: (ids: number[]) => void;
  sliceAssets?: AnatomyAsset[];
}
export default function AtlasViewport(props: ViewportProps) {
  const {
    assets,
    selectedId,
    onSelect,
    reducedMotion,
    view,
    setView,
    plane,
    setPlane,
    sliceIndex,
    setSliceIndex,
    assessment = false,
  } = props;
  const [preset, setPreset] = useState("lateral");
  const [resetKey, setResetKey] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isolated, setIsolated] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [opacity, setOpacity] = useState(1);
  const [labels, setLabels] = useState(true);
  const [overlay, setOverlay] = useState(true);
  const [error, setError] = useState("");
  const [sceneReady, setSceneReady] = useState(false);
  const [sliceReady, setSliceReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const sceneOnReady = useCallback(
    (value: boolean) => setSceneReady(value),
    [],
  );
  const sliceOnReady = useCallback(
    (value: boolean) => setSliceReady(value),
    [],
  );
  const onFailure = useCallback(
    (message: string) => {
      setError(message);
      props.onError?.(message);
    },
    [props.onError],
  );
  const ready =
    view === "3d"
      ? sceneReady
      : view === "slices"
        ? sliceReady
        : sceneReady && sliceReady;
  // Rendering readiness is separate from pointer callbacks: an absent asset can never score an answer.
  const report = props.onReady;
  const selected = assets.find(
    (a) => a.id === (props.highlightedId ?? selectedId),
  );
  const rightSide =
    assets.some((a) => a.hemisphere === "right") &&
    !assets.some((a) => a.hemisphere === "left");
  const scenePreset =
    rightSide && (preset === "lateral" || preset === "medial")
      ? `${preset}-right`
      : preset;
  const visibleCount = assessment
    ? assets.length
    : assets.filter(
        (a) =>
          !hiddenIds.includes(a.id) &&
          (!isolated || a.id === selectedId) &&
          (preset !== "medial" ||
            a.hemisphere !== (rightSide ? "left" : "right")),
      ).length;
  const effectiveAssets = useMemo(() => assets, [assets]);
  const enabledSelect = useCallback(
    (id: string) => {
      if (ready) onSelect(id);
    },
    [ready, onSelect],
  );
  // A lightweight effect reports changes without coupling domain logic to Three.js.
  useReportReady(ready, report);
  return (
    <section
      className={`atlas-viewport ${view === "split" ? "split-view" : ""}`}
      aria-label="Visualizador anatômico"
    >
      <div className="viewport-topbar">
        {assessment ? (
          <span className="assessment-view-label">
            {view === "3d"
              ? "Modelo 3D · mapa de identificação"
              : `Ressonância T1 · corte ${plane === "sagittal" ? "sagital" : plane}`}
          </span>
        ) : (
          <div className="view-tabs" role="tablist" aria-label="Visualização">
            <button
              role="tab"
              aria-selected={view === "3d"}
              onClick={() => setView("3d")}
            >
              <Box size={16} />
              <span>Modelo 3D</span>
            </button>
            <button
              role="tab"
              aria-selected={view === "split"}
              onClick={() => setView("split")}
            >
              <PanelsTopLeft size={16} />
              <span>3D + cortes</span>
            </button>
            <button
              role="tab"
              aria-selected={view === "slices"}
              onClick={() => setView("slices")}
            >
              <Scan size={16} />
              <span>Cortes de RM</span>
            </button>
          </div>
        )}
        <button
          className="icon-button expand-button"
          title="Expandir visualizador"
          aria-label="Expandir visualizador"
          onClick={(e) => {
            const node = e.currentTarget.closest("section");
            if (document.fullscreenElement) void document.exitFullscreen();
            else void node?.requestFullscreen();
          }}
        >
          <Expand size={17} />
        </button>
      </div>
      <div className="scene-area">
        {view !== "slices" && (
          <div className="model-stage" data-ready={sceneReady}>
            <div className="model-caption">
              <span className="live-dot" />
              {assessment ? "IDENTIFICAÇÃO ANATÔMICA" : props.title}
              <small>Atlas SPL/NAC · espaço RAS</small>
            </div>
            {assets.length ? (
              <SceneBoundary
                key={`${retry}-${props.questionKey || ""}`}
                onError={onFailure}
                fallback={
                  <div className="model-fallback">
                    <Scan size={32} />
                    <h3>Continue pelos cortes</h3>
                    <p>O recurso 3D está indisponível neste momento.</p>
                    <button
                      className="secondary"
                      onClick={() => setView("slices")}
                    >
                      Abrir atlas de RM
                    </button>
                  </div>
                }
              >
                <Suspense
                  fallback={
                    <div className="model-loading">
                      <span className="loading-ring" />
                      Preparando o atlas 3D…
                    </div>
                  }
                >
                  <BrainScene
                    assets={effectiveAssets}
                    selectedId={assessment ? null : selectedId}
                    highlightedId={props.highlightedId}
                    onSelect={enabledSelect}
                    onReady={sceneOnReady}
                    onError={onFailure}
                    isolated={!assessment && isolated}
                    hiddenIds={assessment ? [] : hiddenIds}
                    opacity={assessment ? 1 : opacity}
                    labels={labels && !assessment}
                    assessment={assessment}
                    reducedMotion={reducedMotion}
                    preset={scenePreset}
                    resetKey={resetKey}
                    zoom={zoom}
                    plane={plane}
                    sliceIndex={sliceIndex}
                    showPlane={view === "split"}
                  />
                </Suspense>
              </SceneBoundary>
            ) : (
              <div className="model-fallback">
                <BookPlaceholder />
                <h3>Um espaço para ampliar</h3>
                <p>
                  As estruturas deste módulo estão documentadas no roteiro. A
                  representação visual ainda precisa de ativos e correspondência
                  confiáveis.
                </p>
              </div>
            )}
            {assets.length > 0 && visibleCount === 0 && (
              <div className="model-fallback">
                <h3>Nenhuma estrutura visível</h3>
                <p>As estruturas deste grupo estão ocultas.</p>
                <button
                  className="secondary"
                  onClick={() => {
                    setHiddenIds([]);
                    setIsolated(false);
                  }}
                >
                  Exibir estruturas
                </button>
              </div>
            )}
            {visibleCount > 0 && !sceneReady && !error && (
              <div className="loading-caption" role="status">
                Carregando modelos reais…
              </div>
            )}

            {!assessment && (
              <div className="floating-tools">
                <button
                  className="icon-button"
                  title="Aproximar"
                  aria-label="Aproximar"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                >
                  <Plus size={20} />
                </button>
                <button
                  className="icon-button"
                  title="Afastar"
                  aria-label="Afastar"
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                >
                  <Minus size={20} />
                </button>
                <span />
                <button
                  className="icon-button"
                  title="Restaurar vista"
                  aria-label="Restaurar vista"
                  onClick={() => {
                    setZoom(1);
                    setPreset("lateral");
                    setIsolated(false);
                    setHiddenIds([]);
                    setOpacity(1);
                    setResetKey((k) => k + 1);
                  }}
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            )}
            <div className="model-instructions">
              <Rotate3d size={14} />
              <span>Arraste para girar</span>
              <span className="divider">·</span>
              <Move size={13} />
              <span>Botão direito para mover</span>
              <span className="divider">·</span>
              <MousePointer2 size={13} />
              <span>Clique para {assessment ? "responder" : "explorar"}</span>
            </div>
          </div>
        )}
        {view !== "3d" && (
          <div className="slice-stage">
            <div className="slice-heading">
              <span>RESSONÂNCIA T1</span>
              <small>1 mm · mesmo volume do modelo</small>
            </div>
            <div className="plane-tabs">
              {(["axial", "coronal", "sagittal"] as Plane[]).map((p) => (
                <button
                  key={p}
                  aria-pressed={plane === p}
                  disabled={assessment}
                  onClick={() => setPlane(p)}
                >
                  {p === "sagittal"
                    ? "Sagital"
                    : p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <SliceViewer
              key={`${retry}-${props.questionKey || ""}`}
              plane={plane}
              index={sliceIndex}
              selectedLabel={selected?.labelId ?? null}
              assets={props.sliceAssets ?? assets}
              onLabels={props.onLabels}
              overlay={overlay && !assessment}
              assessment={assessment}
              onSelect={enabledSelect}
              onReady={sliceOnReady}
              onError={onFailure}
            />
            <div className="slice-position">
              <label htmlFor="slice-position">
                Posição do corte <strong>{sliceIndex} / 255</strong>
              </label>
              <input
                id="slice-position"
                type="range"
                min="0"
                max="255"
                value={sliceIndex}
                disabled={assessment}
                onChange={(e) => setSliceIndex(Number(e.target.value))}
              />
              <small>
                Coordenada física: {128 - sliceIndex} mm ·{" "}
                {plane === "axial"
                  ? "eixo S"
                  : plane === "coronal"
                    ? "eixo A"
                    : "eixo R"}
              </small>
            </div>
            {!assessment && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={overlay}
                  onChange={(e) => setOverlay(e.target.checked)}
                />{" "}
                Sobrepor segmentação anatômica
              </label>
            )}
          </div>
        )}
      </div>
      {!assessment && view !== "slices" && (
        <div className="viewport-controls">
          <label>
            Vista{" "}
            <select
              aria-label="Vista anatômica"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              <option value="lateral">
                Lateral {rightSide ? "direita" : "esquerda"}
              </option>
              <option value="medial">
                Medial {rightSide ? "direita" : "esquerda"}
              </option>
              <option value="superior">Superior</option>
              <option value="inferior">Inferior</option>
              <option value="anterior">Anterior</option>
              <option value="posterior">Posterior</option>
            </select>
          </label>
          <div className="control-divider" />
          <button
            className={isolated ? "active" : ""}
            aria-pressed={isolated}
            disabled={!selectedId}
            onClick={() => setIsolated((i) => !i)}
          >
            <Focus size={16} />
            Isolar
          </button>
          <button
            disabled={!selectedId}
            onClick={() =>
              selectedId &&
              setHiddenIds((ids) =>
                ids.includes(selectedId)
                  ? ids.filter((id) => id !== selectedId)
                  : [...ids, selectedId],
              )
            }
          >
            {hiddenIds.includes(selectedId || "") ? (
              <Eye size={16} />
            ) : (
              <EyeOff size={16} />
            )}
            Ocultar
          </button>
          <button
            aria-pressed={labels}
            className={labels ? "active" : ""}
            onClick={() => setLabels((l) => !l)}
          >
            <Tags size={16} />
            Rótulo
          </button>
          <label className="opacity-control">
            Opacidade
            <input
              aria-label="Opacidade"
              type="range"
              min=".1"
              max="1"
              step=".05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            onClick={() => {
              setError("");
              setRetry((r) => r + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}
    </section>
  );
}

function useReportReady(ready: boolean, report: ViewportProps["onReady"]) {
  useEffect(() => {
    report?.(ready);
  }, [ready, report]);
}
function BookPlaceholder() {
  return <LayersPlaceholder />;
}
function LayersPlaceholder() {
  return <Box size={34} strokeWidth={1.2} />;
}
