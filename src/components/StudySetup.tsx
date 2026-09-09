import { useMemo, useState } from "react";
import {
  ArrowRight,
  Crosshair,
  Keyboard,
  ListChecks,
  Shuffle,
  Timer,
  Target,
} from "lucide-react";
import { createSession, eligibleTargets } from "../domain/engine";
import type {
  QuestionKind,
  Session,
  SessionConfig,
  StudyTarget,
} from "../domain/types";
import type { Catalog } from "../content/catalog";

export default function StudySetup({
  mode,
  targets,
  catalog,
  onStart,
  targetIds,
}: {
  mode: "practice" | "exam";
  targets: StudyTarget[];
  catalog: Catalog;
  onStart: (session: Session) => void;
  targetIds?: string[];
}) {
  const [kind, setKind] = useState<QuestionKind>("locate");
  const [count, setCount] = useState(10);
  const [time, setTime] = useState(0);
  const eligible = useMemo(() => eligibleTargets(targets), [targets]);
  const [modules, setModules] = useState<string[]>(
    catalog.modules
      .filter((m) => eligible.some((t) => t.moduleId === m.id))
      .map((m) => m.id),
  );
  const [seed, setSeed] = useState(
    "neuro-" + new Date().toISOString().slice(0, 10),
  );
  const [view, setView] = useState("mixed");
  const [startError, setStartError] = useState("");
  const configuration = useMemo<Omit<SessionConfig, "id" | "startedAt">>(
    () => ({
      seed,
      mode,
      count,
      kinds: mode === "practice" ? [kind] : undefined,
      moduleIds: modules,
      targetIds,
      views:
        view === "3d"
          ? ["3d"]
          : view === "slices"
            ? ["axial", "coronal", "sagittal"]
            : undefined,
      timeLimitMs: time ? time * 60000 : undefined,
    }),
    [seed, mode, count, kind, modules, targetIds, view, time],
  );
  const draft = useMemo(() => {
    try {
      return {
        session: createSession(targets, { ...configuration, id: "preview" }),
        error: "",
      };
    } catch (e) {
      return {
        session: null,
        error:
          e instanceof Error
            ? e.message
            : "Não há questões para estes filtros.",
      };
    }
  }, [targets, configuration]);
  function start() {
    if (!draft.session) return;
    try {
      onStart(
        createSession(targets, {
          ...configuration,
          id: crypto.randomUUID(),
          startedAt: Date.now(),
        }),
      );
      setStartError("");
    } catch (error) {
      setStartError(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a sessão. Tente novamente.",
      );
    }
  }
  return (
    <div className="study-setup">
      <div className="eyebrow">
        {mode === "practice"
          ? "PRÁTICA COM PROPÓSITO"
          : "COLOQUE SEU CONHECIMENTO À PROVA"}
      </div>
      <h1>
        {mode === "practice"
          ? "Aprenda um pouco. Lembre muito."
          : "Seu próximo desafio."}
      </h1>
      <p className="page-intro">
        {mode === "practice"
          ? "Explore diferentes formas de reconhecer a anatomia. Cada resposta abre espaço para entender e revisar."
          : "Combine estruturas e cortes em uma sessão reproduzível. A correção aparece quando você terminar."}
      </p>
      {targetIds && (
        <div className="info-note">
          <Target size={18} />
          Revisão direcionada: {targetIds.length}{" "}
          {targetIds.length === 1 ? "estrutura" : "estruturas"}. As vistas
          disponíveis determinam o total de questões.
        </div>
      )}
      {mode === "practice" && (
        <div className="mode-cards">
          {(
            [
              {
                id: "locate",
                icon: Crosshair,
                title: "Localizar",
                description: "Encontre a estrutura no modelo ou no corte.",
              },
              {
                id: "name",
                icon: Keyboard,
                title: "Nomear",
                description: "Observe o destaque e escreva o nome.",
              },
              {
                id: "choice",
                icon: ListChecks,
                title: "Múltipla escolha",
                description: "Reconheça a estrutura entre quatro alternativas.",
              },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              className={`mode-card ${kind === option.id ? "selected" : ""}`}
              onClick={() => setKind(option.id)}
              aria-pressed={kind === option.id}
            >
              <option.icon size={25} />
              <h2>{option.title}</h2>
              <p>{option.description}</p>
              <span className="radio-indicator" />
            </button>
          ))}
        </div>
      )}
      <div className="setup-grid">
        <section className="setup-panel">
          <h2>O que vamos estudar?</h2>
          <p>Somente estruturas com alvo e fonte conferidos.</p>
          <div className="module-options">
            {catalog.modules.map((module) => {
              const n = eligible.filter(
                (t) =>
                  t.moduleId === module.id &&
                  (!targetIds || targetIds.includes(t.id)),
              ).length;
              return (
                <label key={module.id} className={!n ? "disabled-option" : ""}>
                  <input
                    type="checkbox"
                    disabled={!n}
                    checked={modules.includes(module.id)}
                    onChange={(e) =>
                      setModules((ids) =>
                        e.target.checked
                          ? [...ids, module.id]
                          : ids.filter((id) => id !== module.id),
                      )
                    }
                  />
                  <span>{module.name}</span>
                  <small>{n ? n + " alvos" : "sem questões"}</small>
                </label>
              );
            })}
          </div>
        </section>
        <section className="setup-panel">
          <h2>Do seu jeito</h2>
          <label className="field-label">
            Visualização
            <select
              aria-label="Visualização do treino"
              value={view}
              onChange={(e) => setView(e.target.value)}
            >
              <option value="mixed">Modelo 3D + cortes variados</option>
              <option value="3d">Somente modelo 3D</option>
              <option value="slices">Somente cortes de RM</option>
            </select>
          </label>
          <label className="field-label">
            Número de questões
            <input
              type="number"
              min="1"
              max="1000"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          {mode === "exam" && (
            <label className="field-label">
              <span>
                <Timer size={15} /> Tempo opcional
              </span>
              <select
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
              >
                <option value="0">Sem limite de tempo</option>
                <option value="5">5 minutos</option>
                <option value="10">10 minutos</option>
                <option value="20">20 minutos</option>
              </select>
            </label>
          )}
          <label className="field-label">
            <span>
              <Shuffle size={15} /> Código da sequência (seed)
            </span>
            <input
              value={seed}
              maxLength={100}
              onChange={(e) => setSeed(e.target.value)}
            />
          </label>
          <p className="muted">
            Use o mesmo código e os mesmos filtros para repetir a sequência. Seu
            histórico fica neste navegador.
          </p>
        </section>
      </div>
      <div className="setup-footer">
        <div>
          {draft.session ? (
            <>
              <strong>
                {draft.session.questions.length} questões nesta sessão
              </strong>
              <small>
                {draft.session.availableCount} combinações válidas de estrutura
                e vista disponíveis
                {count > draft.session.questions.length
                  ? " · quantidade ajustada ao banco real"
                  : ""}
                .
              </small>
            </>
          ) : (
            <span role="status">{draft.error}</span>
          )}
        </div>
        <button className="primary" disabled={!draft.session} onClick={start}>
          {mode === "practice" ? "Começar treino" : "Iniciar simulado"}
          <ArrowRight size={18} />
        </button>
      </div>
      {startError && <p role="alert">{startError}</p>}
    </div>
  );
}
