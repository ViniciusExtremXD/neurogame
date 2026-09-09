import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Flag,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import type { AnatomyAsset } from "../atlas/types";
import type { Question, Session, StudyTarget } from "../domain/types";
import {
  advanceQuestion,
  elapsedMs,
  eligibleTargets,
  finishSession,
  invalidateQuestion,
  pauseSession,
  resumeSession,
  retryQuestion,
  skipQuestion,
  submitAnswer,
  summarizeSession,
  useHint,
} from "../domain/engine";
import { moduleNames } from "../content/catalog";
import AtlasViewport from "./AtlasViewport";

interface StudyProps {
  session: Session;
  targets: StudyTarget[];
  assets: AnatomyAsset[];
  onChange: (next: Session, expected: Session) => void;
  onExplore: (id: string) => void;
  onReview: (ids: string[]) => void;
  reducedMotion: boolean;
}

export default function StudyWorkspace({
  session,
  targets,
  assets,
  onChange,
  onExplore,
  onReview,
  reducedMotion,
}: StudyProps) {
  const [input, setInput] = useState({ questionId: "", value: "" });
  const [readiness, setReadiness] = useState({ questionId: "", ready: false });
  const [focus, setFocus] = useState<{ questionId: string; id: string | null }>(
    { questionId: "", id: null },
  );
  const [labels, setLabels] = useState<{ questionId: string; ids: number[] }>({
    questionId: "",
    ids: [],
  });
  const [failure, setFailure] = useState<{
    questionId: string;
    reason: string;
  } | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [now, setNow] = useState(Date.now());
  const latest = useRef(session);
  const received = useRef(session);
  // A local readiness render can precede the parent's transition render. Do not
  // replace that transition with the same older prop during the intervening render.
  if (received.current !== session) {
    received.current = session;
    latest.current = session;
  }
  const loadingPause = useRef<string | null>(null);
  const question = session.questions[session.cursor];
  const questionId = question?.id;
  const target = assets.find((a) => a.id === question?.targetId);
  const ready = readiness.questionId === questionId && readiness.ready;

  // Two events before React renders must still see the latest attempt.
  // The parent also compares expected against its current ref before storing a transition.
  const commit = useCallback(
    (transform: (current: Session) => Session, origin?: string) => {
      const expected = latest.current;
      if (origin && expected.questions[expected.cursor]?.id !== origin) return;
      const next = transform(expected);
      if (next !== expected) {
        latest.current = next;
        onChange(next, expected);
      }
    },
    [onChange],
  );
  const readyCallback = useCallback(
    (value: boolean) =>
      setReadiness({ questionId: questionId ?? "", ready: value }),
    [questionId],
  );
  const labelsCallback = useCallback(
    (ids: number[]) => setLabels({ questionId: questionId ?? "", ids }),
    [questionId],
  );
  const errorCallback = useCallback(
    (reason: string) => {
      if (questionId) setFailure({ questionId, reason });
    },
    [questionId],
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      session.timeLimitMs &&
      session.status === "active" &&
      elapsedMs(session, now) >= session.timeLimitMs
    )
      commit((current) => finishSession(current, now));
  }, [session, now, commit]);
  useEffect(() => {
    if (!questionId || session.status !== "active") return;
    if (
      (ready || question.status === "invalidated") &&
      loadingPause.current === questionId
    ) {
      if (session.pausedAt !== null)
        commit((current) => resumeSession(current, Date.now()), questionId);
      else loadingPause.current = null;
    } else if (
      !ready &&
      question.status === "pending" &&
      session.pausedAt === null
    ) {
      loadingPause.current = questionId;
      commit((current) => pauseSession(current, Date.now()), questionId);
    }
  }, [
    questionId,
    question?.status,
    session.status,
    session.pausedAt,
    ready,
    commit,
  ]);
  useEffect(() => {
    // Resource promises can settle between the parent's state transitions. Keep
    // the failure until the matching question has actually become invalidated.
    if (
      failure?.questionId === questionId &&
      session.status === "active" &&
      question.status !== "invalidated"
    )
      commit(
        (current) =>
          invalidateQuestion(current, failure.questionId, failure.reason),
        failure.questionId,
      );
  }, [failure, questionId, question?.status, session, commit]);

  const eligible = useMemo(() => eligibleTargets(targets), [targets]);
  const sceneAssets = useMemo(() => {
    if (!target || question?.view !== "3d") return assets;
    // The whole available module/side is the map; the camera never centers on the answer.
    return assets.filter(
      (a) =>
        a.moduleId === target.moduleId &&
        a.surface &&
        (a.hemisphere === target.hemisphere || a.hemisphere === "midline"),
    );
  }, [assets, target, question?.view]);
  const keyboardAssets = useMemo(
    () =>
      sceneAssets.filter(
        (asset) =>
          eligible.some(
            (t) =>
              t.id === asset.id && question && t.views.includes(question.view),
          ) &&
          (question?.view === "3d" ||
            (labels.questionId === questionId &&
              labels.ids.includes(asset.labelId))),
      ),
    [sceneAssets, eligible, question, labels, questionId],
  );

  if (session.status === "finished")
    return (
      <StudyResults
        session={session}
        targets={targets}
        onExplore={onExplore}
        onReview={onReview}
      />
    );
  if (!question || !target)
    return (
      <div role="alert">
        <p>O alvo desta questão está indisponível.</p>
        <button
          className="primary"
          onClick={() =>
            commit((current) => {
              const q = current.questions[current.cursor];
              return q
                ? advanceQuestion(
                    invalidateQuestion(
                      resumeSession(current, Date.now()),
                      q.id,
                      "Alvo ausente no catálogo visual.",
                    ),
                    q.id,
                    Date.now(),
                  )
                : finishSession(current, Date.now());
            })
          }
        >
          Anular e continuar
        </button>
      </div>
    );

  const practice = session.mode === "practice";
  const submitted = question.status !== "pending";
  const result = question.attempts.at(-1);
  const reveal = practice && (submitted || question.hintUsed);
  const highlighted =
    question.kind === "locate" && !reveal
      ? focus.questionId === question.id
        ? focus.id
        : null
      : target.id;
  const remaining = session.timeLimitMs
    ? Math.max(0, session.timeLimitMs - elapsedMs(session, now))
    : elapsedMs(session, now);
  const paused = session.pausedAt !== null;
  const preparing = paused && loadingPause.current === question.id;
  const answer = input.questionId === question.id ? input.value : "";
  const unanswered = session.questions.filter(
    (q) => q.status !== "invalidated" && q.attempts.length === 0,
  ).length;
  const answerQuestion = (value: string) => {
    if (ready && !paused)
      commit(
        (current) =>
          submitAnswer(current, question.id, value, targets, Date.now()),
        question.id,
      );
  };
  const togglePause = () => {
    loadingPause.current = null;
    commit(
      (current) =>
        current.pausedAt !== null
          ? resumeSession(current, Date.now())
          : pauseSession(current, Date.now()),
      question.id,
    );
  };
  return (
    <div className="study-workspace">
      <div className="study-session-header">
        <div>
          <span className="eyebrow">
            {practice ? "TREINO" : "SIMULADO"} ·{" "}
            {moduleNames[target.moduleId] || target.moduleId}
          </span>
          <h1>
            {question.kind === "locate"
              ? `Localize: ${target.name}`
              : "Qual é a estrutura destacada?"}
          </h1>
        </div>
        <div className="session-meta">
          <span>
            {session.cursor + 1}
            <small> / {session.questions.length}</small>
          </span>
          <span className="timer">
            {Math.floor(remaining / 60000)
              .toString()
              .padStart(2, "0")}
            :
            {Math.floor((remaining / 1000) % 60)
              .toString()
              .padStart(2, "0")}
          </span>
          <button
            className="icon-button"
            disabled={preparing}
            aria-label={paused ? "Continuar sessão" : "Pausar sessão"}
            onClick={togglePause}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </div>
      </div>
      <div className="session-progress">
        <i
          style={{
            width: `${(session.cursor / session.questions.length) * 100}%`,
          }}
        />
      </div>
      {paused && !preparing && (
        <div className="paused-session">
          <Pause size={34} />
          <h2>Uma pausa também faz parte.</h2>
          <p>O cronômetro está pausado. Continue quando estiver pronto.</p>
          <button className="primary" onClick={togglePause}>
            Continuar <Play size={17} />
          </button>
        </div>
      )}
      <div
        className="study-columns"
        style={paused && !preparing ? { display: "none" } : undefined}
      >
        <AtlasViewport
          key={question.id}
          questionKey={question.id}
          assets={sceneAssets}
          title="Mapa de identificação"
          selectedId={null}
          highlightedId={highlighted}
          onSelect={(id) => {
            if (question.kind === "locate") answerQuestion(id);
          }}
          assessment
          reducedMotion={reducedMotion}
          view={question.view === "3d" ? "3d" : "slices"}
          setView={() => {}}
          plane={question.view === "3d" ? "axial" : question.view}
          setPlane={() => {}}
          sliceIndex={question.sliceIndex ?? 128}
          setSliceIndex={() => {}}
          onReady={readyCallback}
          onError={errorCallback}
          onLabels={labelsCallback}
        />
        <aside className="answer-panel">
          <span className="eyebrow">
            {question.kind === "locate"
              ? "ENCONTRE NO ATLAS"
              : question.kind === "name"
                ? "ESCREVA O NOME"
                : "ESCOLHA UMA ALTERNATIVA"}
          </span>
          <h2>
            {question.kind === "locate"
              ? "Onde está a estrutura?"
              : question.kind === "name"
                ? "O que você reconhece?"
                : "Faça a conexão."}
          </h2>
          <p>
            {question.kind === "locate"
              ? "Clique diretamente no modelo ou no corte, ou percorra os alvos numerados com o teclado."
              : question.kind === "name"
                ? "Digite o nome completo. Acentos e maiúsculas não alteram a correção; o lado anatômico importa."
                : "Uma das quatro estruturas corresponde ao destaque."}
          </p>
          {question.kind === "name" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                answerQuestion(answer);
              }}
            >
              <label className="field-label">
                Sua resposta
                <input
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Nome da estrutura"
                  value={answer}
                  disabled={submitted || !ready || paused}
                  onChange={(event) =>
                    setInput({
                      questionId: question.id,
                      value: event.target.value,
                    })
                  }
                />
              </label>
              <button
                className="primary"
                disabled={!answer.trim() || submitted || !ready || paused}
              >
                Confirmar resposta <ArrowRight size={16} />
              </button>
            </form>
          )}
          {question.kind === "choice" && (
            <div className="answer-options">
              {question.options.map((id, i) => (
                <button
                  key={id}
                  disabled={submitted || !ready || paused}
                  onClick={() => answerQuestion(id)}
                >
                  <span>{String.fromCharCode(65 + i)}</span>
                  {assets.find((a) => a.id === id)?.name ||
                    "Alternativa indisponível"}
                </button>
              ))}
            </div>
          )}
          {question.kind === "locate" && (
            <details className="keyboard-targets">
              <summary>Selecionar com teclado</summary>
              <p>
                Tab destaca cada região numerada. Enter registra a resposta. Os
                nomes ficam ocultos.
              </p>
              <div>
                {keyboardAssets.map((asset, i) => (
                  <button
                    key={asset.id}
                    disabled={submitted || !ready || paused}
                    onFocus={() =>
                      setFocus({ questionId: question.id, id: asset.id })
                    }
                    onBlur={() =>
                      setFocus({ questionId: question.id, id: null })
                    }
                    onClick={() => answerQuestion(asset.id)}
                    aria-label={`Alvo ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </details>
          )}
          {!ready && !submitted && (
            <p role="status" className="muted">
              Preparando o mapa. O cronômetro fica pausado durante o
              carregamento.
            </p>
          )}
          {practice && question.status === "pending" && !question.hintUsed && (
            <button
              className="text-button hint-button"
              disabled={!ready || paused}
              onClick={() =>
                commit((current) => useHint(current, question.id), question.id)
              }
            >
              <Lightbulb size={17} />
              Consultar resposta com ajuda
            </button>
          )}
          {reveal && (
            <div
              className={`answer-feedback ${result?.correct && question.status !== "invalidated" ? "correct" : "neutral"}`}
              role="status"
            >
              <strong>
                {question.status === "invalidated"
                  ? "Questão anulada"
                  : question.hintUsed && !submitted
                    ? "Ajuda consultada"
                    : result?.correct
                      ? question.retryCount
                        ? "Acerto após repetição."
                        : question.hintUsed
                          ? "Acerto com ajuda."
                          : "Correto. Conexão feita!"
                      : question.status === "skipped"
                        ? "Fica para a revisão."
                        : "Vamos observar de novo."}
              </strong>
              {question.status === "invalidated" ? (
                <p>
                  {question.invalidationReason} Esta questão fica fora da
                  pontuação.
                </p>
              ) : (
                <>
                  <h3>{target.name}</h3>
                  <p>{target.description?.summary}</p>
                  {target.description?.references[0] && (
                    <small>
                      {target.description.references[0].title}{" "}
                      {target.description.references[0].pages}
                    </small>
                  )}
                  {(question.hintUsed || question.retryCount > 0) && (
                    <small>
                      Ajuda e repetição não contam como acerto independente.
                    </small>
                  )}
                </>
              )}
            </div>
          )}
          {!practice && submitted && (
            <div className="info-note" role="status">
              {question.status === "invalidated"
                ? `Questão anulada por falha de recurso. ${question.invalidationReason ?? ""}`
                : question.status === "skipped"
                  ? "Questão pulada. Você poderá revisar o conteúdo no final."
                  : "Resposta registrada. A correção estará disponível no final."}
            </div>
          )}
          <div className="answer-bottom">
            {submitted ? (
              <>
                <button
                  className="primary"
                  disabled={paused}
                  onClick={() =>
                    commit(
                      (current) =>
                        advanceQuestion(current, question.id, Date.now()),
                      question.id,
                    )
                  }
                >
                  {session.cursor === session.questions.length - 1
                    ? "Ver resultado"
                    : "Próxima questão"}
                  <ArrowRight size={17} />
                </button>
                {practice &&
                  question.status === "answered" &&
                  result &&
                  !result.correct &&
                  question.retryCount < 49 && (
                    <button
                      className="text-button"
                      onClick={() =>
                        commit(
                          (current) => retryQuestion(current, question.id),
                          question.id,
                        )
                      }
                    >
                      <RotateCcw size={15} />
                      Tentar novamente
                    </button>
                  )}
              </>
            ) : (
              <button
                className="text-button"
                disabled={paused || !ready}
                onClick={() =>
                  commit(
                    (current) => skipQuestion(current, question.id),
                    question.id,
                  )
                }
              >
                Pular esta questão <ArrowRight size={15} />
              </button>
            )}
            <button
              className="text-button muted"
              onClick={() => setConfirmFinish(true)}
            >
              <Flag size={14} />
              Encerrar sessão
            </button>
          </div>
        </aside>
      </div>
      {confirmFinish && (
        <div className="delete-confirm" role="alert">
          <p>
            Encerrar agora? {unanswered}{" "}
            {unanswered === 1
              ? "questão sem resposta entrará como omitida"
              : "questões sem resposta entrarão como omitidas"}
            .
          </p>
          <button
            className="primary"
            onClick={() => {
              setConfirmFinish(false);
              commit((current) => finishSession(current, Date.now()));
            }}
          >
            Encerrar e ver resultado
          </button>
          <button
            className="text-button"
            onClick={() => setConfirmFinish(false)}
          >
            Continuar sessão
          </button>
        </div>
      )}
    </div>
  );
}

function outcome(question: Question): string {
  if (question.status === "invalidated") return "Anulada por falha de recurso";
  if (question.status === "skipped" && question.attempts.length === 0)
    return "Omitida";
  if (question.attempts[0]?.correct)
    return question.attempts[0].assisted
      ? "Acerto com ajuda"
      : "Acerto independente";
  if (question.attempts.slice(1).some((attempt) => attempt.correct))
    return "Acerto após repetição";
  return "Erro na primeira tentativa";
}

export function StudyResults({
  session,
  targets,
  onExplore,
  onReview,
}: {
  session: Session;
  targets: StudyTarget[];
  onExplore: (id: string) => void;
  onReview: (ids: string[]) => void;
}) {
  const summary = summarizeSession(session, targets);
  if (!summary) return null;
  return (
    <div className="results-page">
      <span className="eyebrow">CADA TENTATIVA CONSTRÓI UMA CONEXÃO</span>
      <h1>Sessão concluída.</h1>
      <p className="page-intro">
        Revisar o que faltou é o próximo passo para lembrar melhor.
      </p>
      <div className="score-grid">
        <div className="score-hero">
          <strong>
            {summary.accuracy === null
              ? "—"
              : Math.round(summary.accuracy) + "%"}
          </strong>
          <span>acertos independentes</span>
        </div>
        <div>
          <strong>
            {summary.independentCorrect}
            <small> / {summary.valid}</small>
          </strong>
          <span>na primeira tentativa</span>
        </div>
        <div>
          <strong>{summary.omitted}</strong>
          <span>questões omitidas</span>
        </div>
        <div>
          <strong>{summary.assistedCorrect + summary.retryCorrect}</strong>
          <span>acertos com ajuda ou repetição</span>
        </div>
      </div>
      <p className="scoring-note">
        Percentual = acertos sem ajuda na primeira tentativa ÷ questões válidas,
        incluindo omitidas. {summary.invalidated} anuladas ficam fora do
        denominador.
      </p>
      <button
        className="primary"
        disabled={!summary.reviewTargetIds.length}
        onClick={() => onReview(summary.reviewTargetIds)}
      >
        <RotateCcw size={17} />
        Revisar {summary.reviewTargetIds.length} estruturas
      </button>
      <div className="results-table">
        <h2>Revisão da sessão</h2>
        {session.questions.map((question, i) => {
          const target = targets.find((t) => t.id === question.targetId);
          const independent =
            question.status !== "invalidated" &&
            question.attempts[0]?.correct &&
            !question.attempts[0]?.assisted;
          return (
            <div className="result-row" key={question.id}>
              <span className={`result-icon ${independent ? "correct" : ""}`}>
                {question.status === "invalidated" ? (
                  <Flag size={17} />
                ) : independent ? (
                  <Check size={17} />
                ) : (
                  <X size={17} />
                )}
              </span>
              <span className="result-number">{i + 1}</span>
              <div>
                <strong>{target?.name}</strong>
                <small>
                  {moduleNames[target?.moduleId || ""]} ·{" "}
                  {question.view === "3d"
                    ? "Modelo 3D"
                    : question.view === "sagittal"
                      ? "Sagital"
                      : question.view}{" "}
                  · {outcome(question)}
                </small>
              </div>
              <button
                className="text-button"
                onClick={() => onExplore(question.targetId)}
              >
                Explorar <ArrowRight size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
