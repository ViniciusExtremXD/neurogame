import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  Crosshair,
  GraduationCap,
  Menu,
  MoveRight,
  Sparkles,
  X,
} from "lucide-react";
import type { Catalog } from "./content/catalog";
import { moduleNames, targetsFromCatalog } from "./content/catalog";
import type { Plane } from "./atlas/spatial";
import type { ProgressData, Session } from "./domain/types";
import {
  emptyProgress,
  loadProgress,
  recordSession,
  saveProgress,
} from "./domain/storage";
import { pauseSession } from "./domain/engine";
import Sidebar from "./components/Sidebar";
import StructureCard from "./components/StructureCard";
import AtlasViewport from "./components/AtlasViewport";
import StudySetup from "./components/StudySetup";
import StudyWorkspace from "./components/StudyWorkspace";
const CoveragePage = lazy(() => import("./components/CoveragePage"));
const ProgressPage = lazy(() => import("./components/ProgressPage"));
const ReferencesPage = lazy(() => import("./components/ReferencesPage"));

type Route =
  | "explorar"
  | "treinar"
  | "simulado"
  | "progresso"
  | "referencias"
  | "cobertura";
const validRoutes: Route[] = [
  "explorar",
  "treinar",
  "simulado",
  "progresso",
  "referencias",
  "cobertura",
];
function initialRoute(): Route {
  const hash = location.hash.slice(1) as Route;
  return validRoutes.includes(hash) ? hash : "explorar";
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(import.meta.env.BASE_URL + "content/catalog.json", {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setCatalog)
      .catch(() => {
        if (!controller.signal.aborted)
          setLoadError("Não foi possível carregar o catálogo anatômico.");
      });
    return () => controller.abort();
  }, [retry]);
  if (!catalog)
    return (
      <main className="app-loading">
        <Brain size={42} />
        <h1>NeuroGame</h1>
        {loadError ? (
          <>
            <p role="alert">{loadError}</p>
            <button
              className="primary"
              onClick={() => {
                setLoadError("");
                setRetry((n) => n + 1);
              }}
            >
              Tentar novamente
            </button>
          </>
        ) : (
          <p>Preparando seu espaço de estudo…</p>
        )}
      </main>
    );
  return <Laboratory catalog={catalog} />;
}

function Laboratory({ catalog }: { catalog: Catalog }) {
  const targets = useMemo(() => targetsFromCatalog(catalog), [catalog]);
  const initialProgress = useMemo(() => loadProgress(targets), [targets]);
  const [progress, setProgress] = useState<ProgressData>(
    initialProgress.ok ? initialProgress.data : emptyProgress(),
  );
  const [storageWarning, setStorageWarning] = useState(
    initialProgress.ok ? "" : initialProgress.error,
  );
  const [route, setRoute] = useState<Route>(initialRoute);
  const [moduleId, setModuleId] = useState("telencefalo");
  const [selectedId, setSelectedId] = useState<string | null>("spl-1024");
  const [hemisphere, setHemisphere] = useState<"left" | "right" | "both">(
    "left",
  );
  const [depth, setDepth] = useState<"surface" | "deep" | "sulci" | "all">(
    "surface",
  );
  const [view, setView] = useState<"3d" | "split" | "slices">("3d");
  const [plane, setPlane] = useState<Plane>("axial");
  const [sliceIndex, setSliceIndex] = useState(110);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const helpTrigger = useRef<HTMLElement | null>(null);
  const [session, setSession] = useState<Session | null>(
    progress.activeSession,
  );
  const [targetIds, setTargetIds] = useState<string[] | undefined>();
  const sessionRef = useRef<Session | null>(progress.activeSession);
  const selectSession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);
  const systemReduced = useReducedMotion();
  const reducedMotion = !!systemReduced || progress.preferences.reducedMotion;
  useEffect(() => {
    if (!tutorial) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTutorial(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = [
        ...document.querySelectorAll<HTMLElement>(
          ".tutorial-modal button:not(:disabled), .tutorial-modal a[href]",
        ),
      ];
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      helpTrigger.current?.focus();
    };
  }, [tutorial]);
  const selected = catalog.assets.find((a) => a.id === selectedId);
  const sessionInRoute =
    session &&
    ((route === "treinar" && session.mode === "practice") ||
      (route === "simulado" && session.mode === "exam"));
  const changeProgress = useCallback((data: ProgressData) => {
    setProgress(data);
    const result = saveProgress(data);
    setStorageWarning(result.ok ? "" : result.error);
  }, []);
  const updateSession = useCallback((next: Session, expected?: Session) => {
    if (expected && sessionRef.current !== expected) return;
    sessionRef.current = next;
    setSession(next);
    setProgress((previous) => {
      const data = recordSession(previous, next);
      const result = saveProgress(data);
      if (!result.ok) setStorageWarning(result.error);
      return data;
    });
  }, []);
  const navigate = useCallback(
    (next: Route) => {
      const current = sessionRef.current;
      const sessionRoute = current?.mode === "exam" ? "simulado" : "treinar";
      if (
        current?.status === "active" &&
        !current.pausedAt &&
        next !== sessionRoute
      )
        updateSession(pauseSession(current, Date.now()));
      setRoute(next);
      location.hash = next;
      setSidebarOpen(false);
    },
    [updateSession],
  );
  useEffect(() => {
    const handler = () => navigate(initialRoute());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [navigate]);
  const chooseModule = useCallback((id: string) => {
    setModuleId(id);
    setSelectedId(null);
    setDepth("all");
    setHemisphere("both");
    if (id === "telencefalo") {
      setDepth("surface");
      setHemisphere("left");
    }
  }, []);
  const selectAsset = useCallback(
    (id: string) => {
      const asset = catalog.assets.find((a) => a.id === id);
      if (!asset) return;
      setSelectedId(id);
      setModuleId(asset.moduleId);
      setHemisphere(asset.hemisphere === "midline" ? "both" : asset.hemisphere);
      setDepth(
        asset.surface ? (asset.labelId >= 5000 ? "sulci" : "surface") : "deep",
      );
    },
    [catalog],
  );
  const explore = useCallback(
    (id: string) => {
      selectAsset(id);
      navigate("explorar");
    },
    [selectAsset, navigate],
  );
  const review = useCallback(
    (ids: string[]) => {
      setTargetIds(ids);
      selectSession(null);
      navigate("treinar");
    },
    [navigate, selectSession],
  );
  const visibleAssets = useMemo(() => {
    if (view === "slices") return catalog.assets;
    return catalog.assets.filter(
      (a) =>
        a.moduleId === moduleId &&
        (hemisphere === "both" ||
          a.hemisphere === hemisphere ||
          a.hemisphere === "midline") &&
        (moduleId !== "telencefalo" ||
          depth === "all" ||
          (depth === "surface"
            ? a.surface && a.labelId < 5000
            : depth === "sulci"
              ? a.surface && a.labelId >= 5000
              : !a.surface)),
    );
  }, [catalog, moduleId, hemisphere, depth, view]);
  function openSlice() {
    if (!selected) return;
    const preferred =
      selected.sliceIndices[plane] !== undefined
        ? plane
        : (Object.keys(selected.sliceIndices)[0] as Plane);
    if (preferred) {
      setPlane(preferred);
      setSliceIndex(selected.sliceIndices[preferred]!);
      setView("split");
    }
  }
  function newSession(next: Session) {
    updateSession(next);
  }
  const pageTitle = moduleNames[moduleId] || "Atlas anatômico";
  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      <div className="app-shell">
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("main-content")?.focus();
          }}
        >
          Pular para o conteúdo
        </a>
        <header className="app-header">
          <a
            className="brand"
            href="#explorar"
            onClick={(e) => {
              e.preventDefault();
              navigate("explorar");
            }}
          >
            <span className="brand-mark">
              <Brain size={26} strokeWidth={1.65} />
            </span>
            <span>
              Neuro<span className="brand-light">Game</span>
              <small>UM NOVO JEITO DE CONECTAR</small>
            </span>
            <span className="beta-badge">BETA</span>
          </a>
          <nav className="primary-nav" aria-label="Principal">
            <button
              className={route === "explorar" ? "active" : ""}
              onClick={() => navigate("explorar")}
            >
              <Brain size={17} />
              Explorar
            </button>
            <button
              className={route === "treinar" ? "active" : ""}
              onClick={() => navigate("treinar")}
            >
              <Crosshair size={17} />
              Treinar
            </button>
            <button
              className={route === "simulado" ? "active" : ""}
              onClick={() => navigate("simulado")}
            >
              <GraduationCap size={18} />
              Simulado
            </button>
          </nav>
          <div className="header-actions">
            <button
              aria-label="Meu progresso"
              className={`progress-link ${route === "progresso" ? "active" : ""}`}
              onClick={() => navigate("progresso")}
            >
              <ChartNoAxesCombined size={18} />
              <span>Meu progresso</span>
            </button>
            <button
              className="icon-button help-button"
              aria-label="Como usar o NeuroGame"
              onClick={(e) => {
                helpTrigger.current = e.currentTarget;
                setTutorial(true);
              }}
            >
              <CircleHelp size={20} />
            </button>
          </div>
        </header>
        {route === "explorar" && (
          <Sidebar
            catalog={catalog}
            moduleId={moduleId}
            setModule={chooseModule}
            selectedId={selectedId}
            onSelect={selectAsset}
            onCoverage={() => navigate("cobertura")}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <main
          id="main-content"
          tabIndex={-1}
          className={`main-content ${route === "explorar" ? "with-sidebar" : ""}`}
        >
          {storageWarning && (
            <div role="alert" className="storage-warning">
              {storageWarning}
            </div>
          )}
          {route === "explorar" ? (
            <>
              <div className="workspace-heading">
                <div>
                  <div className="breadcrumb">
                    <button
                      className="icon-button mobile-only"
                      aria-label="Abrir módulos"
                      onClick={() => setSidebarOpen(true)}
                    >
                      <Menu size={19} />
                    </button>
                    ATLAS INTERATIVO <ChevronRight size={12} />
                    <span>{pageTitle}</span>
                  </div>
                  <h1>
                    {pageTitle}
                    <span className="heading-dot">.</span>
                  </h1>
                  <p>Explore cada estrutura. Entenda como tudo se conecta.</p>
                </div>
                <div className="dataset-badge">
                  <span className="live-dot" />
                  <div>
                    ANATOMIA REAL<small>SPL/NAC Brain Atlas</small>
                  </div>
                </div>
              </div>
              <div className="exploration-layout">
                <div className="visualization-column">
                  <div className="anatomy-filters">
                    <label>
                      Hemisfério
                      <select
                        aria-label="Hemisfério"
                        value={hemisphere}
                        onChange={(e) => {
                          setHemisphere(e.target.value as typeof hemisphere);
                          setSelectedId(null);
                        }}
                      >
                        <option value="left">Esquerdo</option>
                        <option value="right">Direito</option>
                        <option value="both">Ambos</option>
                      </select>
                    </label>
                    {moduleId === "telencefalo" && (
                      <div
                        className="depth-filters"
                        aria-label="Camada anatômica"
                      >
                        <button
                          aria-pressed={depth === "surface"}
                          onClick={() => {
                            setDepth("surface");
                            setSelectedId(null);
                          }}
                        >
                          Superfície
                        </button>
                        <button
                          aria-pressed={depth === "deep"}
                          onClick={() => {
                            setDepth("deep");
                            setSelectedId(null);
                          }}
                        >
                          Profundas
                        </button>
                        <button
                          aria-pressed={depth === "sulci"}
                          onClick={() => {
                            setDepth("sulci");
                            setSelectedId(null);
                          }}
                        >
                          Sulcos
                        </button>
                      </div>
                    )}
                    <span className="muted asset-count">
                      {visibleAssets.length} modelos
                    </span>
                  </div>
                  <AtlasViewport
                    key={moduleId + "-" + hemisphere + "-" + depth}
                    assets={visibleAssets}
                    sliceAssets={catalog.assets}
                    selectedId={selectedId}
                    onSelect={selectAsset}
                    reducedMotion={reducedMotion}
                    view={view}
                    setView={setView}
                    plane={plane}
                    setPlane={setPlane}
                    sliceIndex={sliceIndex}
                    setSliceIndex={setSliceIndex}
                    title={pageTitle}
                  />
                  <div className="learning-strip">
                    <span className="strip-icon">
                      <Sparkles size={20} />
                    </span>
                    <div>
                      <strong>Do espaço para a memória.</strong>
                      <p>
                        Alterne entre o modelo e os cortes para reconhecer a
                        mesma estrutura em outras perspectivas.
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setTargetIds(undefined);
                        selectSession(null);
                        navigate("treinar");
                      }}
                    >
                      Vamos praticar <MoveRight size={20} />
                    </button>
                  </div>
                  {!progress.preferences.tutorialDismissed && (
                    <div className="first-visit-note">
                      <span>
                        <CircleHelp size={15} /> Primeira visita? Comece girando
                        o modelo e selecionando uma estrutura.
                      </span>
                      <button
                        aria-label="Dispensar dica inicial"
                        onClick={() =>
                          changeProgress({
                            ...progress,
                            preferences: {
                              ...progress.preferences,
                              tutorialDismissed: true,
                            },
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>
                <StructureCard
                  asset={selected}
                  onTrain={() => selected && review([selected.id])}
                  onSlice={openSlice}
                />
              </div>
            </>
          ) : (
            <Suspense
              fallback={
                <p className="page-loading">Abrindo espaço de estudo…</p>
              }
            >
              {(route === "treinar" || route === "simulado") &&
                (sessionInRoute ? (
                  <>
                    <div className="session-actions">
                      <button
                        className="text-button"
                        onClick={() => {
                          if (session.status === "active")
                            updateSession(pauseSession(session, Date.now()));
                          selectSession(null);
                          setTargetIds(undefined);
                        }}
                      >
                        ← Configurar outra sessão
                      </button>
                    </div>
                    <StudyWorkspace
                      session={session}
                      assets={catalog.assets}
                      targets={targets}
                      onChange={updateSession}
                      onExplore={explore}
                      onReview={review}
                      reducedMotion={reducedMotion}
                    />
                  </>
                ) : (
                  <>
                    <StudySetup
                      mode={route === "simulado" ? "exam" : "practice"}
                      catalog={catalog}
                      targets={targets}
                      onStart={newSession}
                      targetIds={route === "treinar" ? targetIds : undefined}
                    />
                    {progress.activeSession && (
                      <div className="resume-session">
                        <span>Você tem uma sessão em andamento salva.</span>
                        <button
                          className="secondary"
                          onClick={() => {
                            selectSession(progress.activeSession);
                            navigate(
                              progress.activeSession!.mode === "exam"
                                ? "simulado"
                                : "treinar",
                            );
                          }}
                        >
                          Retomar sessão <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </>
                ))}
              {route === "cobertura" && (
                <CoveragePage catalog={catalog} onExplore={explore} />
              )}
              {route === "progresso" && (
                <ProgressPage
                  progress={progress}
                  targets={targets}
                  onChange={(data) => {
                    changeProgress(data);
                    selectSession(data.activeSession);
                  }}
                  onReview={review}
                  onSession={(id) => {
                    const s = progress.sessions.find((s) => s.id === id);
                    if (s) {
                      selectSession(s);
                      navigate(s.mode === "exam" ? "simulado" : "treinar");
                    }
                  }}
                />
              )}
              {route === "referencias" && <ReferencesPage catalog={catalog} />}
            </Suspense>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <BookOpen size={13} /> Feito para aprender, estrutura por estrutura.
          </span>
          <div>
            <button onClick={() => navigate("cobertura")}>
              Cobertura do roteiro
            </button>
            <button onClick={() => navigate("referencias")}>
              Referências e licenças
            </button>
            <label>
              <input
                type="checkbox"
                checked={reducedMotion}
                disabled={!!systemReduced}
                onChange={(e) =>
                  changeProgress({
                    ...progress,
                    preferences: {
                      ...progress.preferences,
                      reducedMotion: e.target.checked,
                    },
                  })
                }
              />
              Reduzir movimento
            </label>
          </div>
        </footer>
        <AnimatePresence>
          {tutorial && (
            <motion.div
              className="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTutorial(false)}
            >
              <motion.section
                className="tutorial-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tutorial-title"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="icon-button modal-close"
                  aria-label="Fechar tutorial"
                  autoFocus
                  onClick={() => setTutorial(false)}
                >
                  <X size={20} />
                </button>
                <span className="brand-mark">
                  <Brain size={30} />
                </span>
                <h2 id="tutorial-title">Uma estrutura. Muitas conexões.</h2>
                <ol>
                  <li>
                    <strong>Explore com as mãos.</strong> Arraste para girar,
                    role para aproximar e clique para conhecer.
                  </li>
                  <li>
                    <strong>Encontre outra perspectiva.</strong> Em “3D +
                    cortes”, mova o plano pela RM do mesmo atlas.
                  </li>
                  <li>
                    <strong>Teste sua memória.</strong> Localize, escreva ou
                    escolha. Depois, revise os erros no seu ritmo.
                  </li>
                </ol>
                <p>
                  Os nomes em inglês preservam termos do conjunto de origem
                  quando a tradução ainda não está revisada.
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    setTutorial(false);
                    changeProgress({
                      ...progress,
                      preferences: {
                        ...progress.preferences,
                        tutorialDismissed: true,
                      },
                    });
                  }}
                >
                  Começar a explorar <ArrowRight size={17} />
                </button>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
