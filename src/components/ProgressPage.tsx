import { Download, Upload, RotateCcw, Trash2, TrendingUp } from "lucide-react";
import type { ProgressData, StudyTarget } from "../domain/types";
import { summarizeSession } from "../domain/engine";
import {
  exportProgress,
  importProgress,
  MAX_IMPORT_BYTES,
} from "../domain/storage";
import { useEffect, useRef, useState } from "react";
import { moduleNames } from "../content/catalog";
export default function ProgressPage({
  progress,
  targets,
  onChange,
  onReview,
  onSession,
}: {
  progress: ProgressData;
  targets: StudyTarget[];
  onChange: (p: ProgressData) => void;
  onReview: (ids: string[]) => void;
  onSession: (id: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importing, setImporting] = useState(false);
  const importOperation = useRef(0);
  const currentProgress = useRef(progress);
  currentProgress.current = progress;
  useEffect(
    () => () => {
      importOperation.current++;
    },
    [],
  );
  function download() {
    try {
      const blob = new Blob([exportProgress(progress)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = "neurogame-progresso.json";
        document.body.append(link);
        link.click();
        link.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMessage(
        "Exportação preparada. Confira o arquivo de progresso nos downloads do navegador.",
      );
    } catch (error) {
      setMessage(
        `Não foi possível exportar o progresso. ${error instanceof Error ? error.message : "Tente novamente."}`,
      );
    }
  }
  async function upload(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const operation = ++importOperation.current;
    const original = progress;
    setImporting(true);
    try {
      if (file.size > MAX_IMPORT_BYTES) {
        setMessage("Arquivo maior que o limite de 2 MB.");
        return;
      }
      const result = importProgress(await file.text(), targets);
      if (
        operation !== importOperation.current ||
        currentProgress.current !== original
      )
        return;
      if (result.ok) {
        onChange(result.data);
        setMessage("Progresso importado com sucesso.");
      } else setMessage(result.error);
    } catch {
      if (operation === importOperation.current)
        setMessage(
          "Não foi possível ler o arquivo. Seu progresso atual foi preservado.",
        );
    } finally {
      if (operation === importOperation.current) {
        input.value = "";
        setImporting(false);
      }
    }
  }
  const summaries = progress.sessions
    .map((s) => ({ session: s, summary: summarizeSession(s, targets)! }))
    .filter((s) => s.summary);
  const total = summaries.reduce((n, s) => n + s.summary.valid, 0);
  const correct = summaries.reduce(
    (n, s) => n + s.summary.independentCorrect,
    0,
  );
  const errors = new Map<string, number>();
  summaries.forEach(({ summary }) =>
    summary.reviewTargetIds.forEach((id) =>
      errors.set(id, (errors.get(id) || 0) + 1),
    ),
  );
  const review = [...errors].sort((a, b) => b[1] - a[1]);
  const moduleScores = Object.fromEntries(
    Object.entries(moduleNames).map(([id, name]) => {
      const valid = summaries.reduce(
        (n, s) => n + (s.summary.byModule[id]?.valid || 0),
        0,
      );
      const correct = summaries.reduce(
        (n, s) => n + (s.summary.byModule[id]?.independentCorrect || 0),
        0,
      );
      return [id, { name, valid, correct }];
    }),
  );
  return (
    <div className="progress-page">
      <span className="eyebrow">UM PASSO DE CADA VEZ</span>
      <h1>Suas conexões estão crescendo.</h1>
      <p className="page-intro">
        Este histórico é seu e fica neste navegador. Exporte uma cópia para
        estudar em outro dispositivo.
      </p>
      <div className="score-grid">
        <div className="score-hero">
          <TrendingUp size={25} />
          <strong>
            {total ? Math.round((correct / total) * 100) + "%" : "—"}
          </strong>
          <span>acertos independentes</span>
        </div>
        <div>
          <strong>{summaries.length}</strong>
          <span>sessões concluídas</span>
        </div>
        <div>
          <strong>{total}</strong>
          <span>questões válidas</span>
        </div>
        <div>
          <strong>{review.length}</strong>
          <span>estruturas para revisar</span>
        </div>
      </div>
      <p className="scoring-note">
        Histórico acumulado de tentativas, não certificação de domínio. Acerto
        independente: sem ajuda, na primeira tentativa. Questões anuladas são
        excluídas.
      </p>
      <div className="progress-columns">
        <section className="setup-panel">
          <h2>Progresso por módulo</h2>
          {Object.entries(moduleScores).filter(([, s]) => s.valid).length ? (
            Object.entries(moduleScores)
              .filter(([, s]) => s.valid)
              .map(([id, s]) => (
                <div className="module-progress" key={id}>
                  <div>
                    <span>{s.name}</span>
                    <strong>{Math.round((s.correct / s.valid) * 100)}%</strong>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${(s.correct / s.valid) * 100}%` }} />
                  </div>
                  <small>
                    {s.correct} acertos independentes / {s.valid} questões
                  </small>
                </div>
              ))
          ) : (
            <p className="muted">Seu primeiro treino inicia esta história.</p>
          )}
        </section>
        <section className="setup-panel">
          <h2>Uma nova chance de lembrar</h2>
          {review.length ? (
            <>
              <p>As estruturas que mais apareceram na revisão.</p>
              {review.slice(0, 8).map(([id, count]) => (
                <div className="review-item" key={id}>
                  <span>{targets.find((t) => t.id === id)?.name}</span>
                  <small>{count} sessões</small>
                </div>
              ))}
              <button
                className="primary"
                onClick={() => onReview(review.map(([id]) => id))}
              >
                <RotateCcw size={16} />
                Revisar erros
              </button>
            </>
          ) : (
            <p className="muted">
              As estruturas a revisar aparecerão aqui depois de uma sessão.
            </p>
          )}
        </section>
      </div>
      <section className="history-panel">
        <h2>Seu histórico</h2>
        {summaries
          .slice()
          .reverse()
          .map(({ session, summary }) => (
            <button
              className="history-row"
              key={session.id}
              onClick={() => onSession(session.id)}
            >
              <span>
                {session.mode === "exam" ? "Simulado" : "Treino"}
                <small>
                  {new Date(
                    session.finishedAt || session.updatedAt,
                  ).toLocaleDateString("pt-BR")}{" "}
                  · {summary.valid} questões
                </small>
              </span>
              <strong>
                {summary.accuracy === null
                  ? "—"
                  : Math.round(summary.accuracy) + "%"}
              </strong>
              <span>Ver revisão →</span>
            </button>
          ))}
      </section>
      <div className="data-actions">
        <button className="secondary" onClick={download}>
          <Download size={16} />
          Exportar progresso
        </button>
        <label className="secondary import-button">
          <Upload size={16} />
          Importar progresso
          <input
            type="file"
            accept="application/json,.json"
            disabled={importing}
            onChange={(e) => void upload(e.currentTarget)}
          />
        </label>
        <button
          className="text-button danger"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={16} />
          Apagar progresso
        </button>
      </div>
      {confirmDelete && (
        <div className="delete-confirm" role="alert">
          <p>
            Apagar o histórico deste navegador? Exporte uma cópia se quiser
            recuperá-lo.
          </p>
          <button
            className="danger-button"
            onClick={() => {
              importOperation.current++;
              setImporting(false);
              onChange({ ...progress, sessions: [], activeSession: null });
              setConfirmDelete(false);
              setMessage("Histórico apagado neste navegador.");
            }}
          >
            Apagar histórico local
          </button>
          <button
            className="text-button"
            onClick={() => setConfirmDelete(false)}
          >
            Cancelar
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
