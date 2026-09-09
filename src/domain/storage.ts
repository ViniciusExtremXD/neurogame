import {
  availableViews,
  eligibleTargets,
  isAnswerCorrect,
  normalizeAnswer,
  questionIdentity,
} from "./engine";
import type {
  AnswerAttempt,
  DataResult,
  ProgressData,
  Question,
  Session,
  StorageLike,
  StudyTarget,
} from "./types";

export const STORAGE_KEY = "neurogame:progress:v1";
export const MAX_IMPORT_BYTES = 2_000_000;
export function emptyProgress(): ProgressData {
  return {
    schemaVersion: 1,
    sessions: [],
    activeSession: null,
    preferences: { reducedMotion: false, tutorialDismissed: false },
  };
}

function check(
  condition: unknown,
  message = "O progresso contém uma sessão ou questão inválida.",
): asserts condition {
  if (!condition) throw new Error(message);
}

function record(
  value: unknown,
  required: string[],
  optional: string[] = [],
): asserts value is Record<string, unknown> {
  check(
    typeof value === "object" && value !== null && !Array.isArray(value),
    "A estrutura do arquivo é inválida.",
  );
  const keys = Object.keys(value);
  check(
    required.every((key) => keys.includes(key)) &&
      keys.every((key) => required.includes(key) || optional.includes(key)),
    "O arquivo contém campos ausentes ou não reconhecidos.",
  );
}

function finite(value: unknown, min = 0): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min;
}

function integer(
  value: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): value is number {
  return finite(value, min) && Number.isInteger(value) && value <= max;
}

function string(value: unknown, max = 200): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}

function validateQuestion(
  value: unknown,
  session: Session,
  index: number,
  targets: StudyTarget[],
  eligible: StudyTarget[],
): Question {
  record(
    value,
    [
      "id",
      "targetId",
      "kind",
      "view",
      "options",
      "status",
      "attempts",
      "hintUsed",
      "retryCount",
      "invalidationReason",
    ],
    ["sliceIndex"],
  );
  check(
    string(value.targetId) &&
      ["locate", "name", "choice"].includes(value.kind as string) &&
      ["3d", "axial", "coronal", "sagittal"].includes(value.view as string),
  );
  check(
    ["pending", "answered", "skipped", "invalidated"].includes(
      value.status as string,
    ) && typeof value.hintUsed === "boolean",
  );
  check(
    integer(value.retryCount, 0, 49) &&
      value.id === questionIdentity(session.id, index, value.retryCount),
  );
  check(
    Array.isArray(value.options) &&
      value.options.length <= 4 &&
      value.options.every((id) => string(id)),
  );
  check(Array.isArray(value.attempts) && value.attempts.length <= 50);
  const q = value as unknown as Question;
  const target = targets.find((t) => t.id === q.targetId);
  check(
    target && availableViews(target).includes(q.view),
    "Uma estrutura ou vista não pertence ao catálogo atual.",
  );
  check(
    q.status === "invalidated" || eligible.some((t) => t.id === q.targetId),
    "Uma questão não possui alvo elegível e fonte válida.",
  );
  check(
    q.view === "3d"
      ? q.sliceIndex === undefined
      : integer(q.sliceIndex, 0) &&
          q.sliceIndex === target.sliceIndices?.[q.view],
    "Uma questão aponta para um corte incompatível com o catálogo.",
  );
  if (q.kind === "choice") {
    check(
      q.options.length === 4 &&
        new Set(q.options).size === 4 &&
        q.options.includes(q.targetId),
    );
    check(
      q.options.every((id) =>
        eligible.some(
          (t) =>
            t.id === id &&
            t.moduleId === target.moduleId &&
            t.category === target.category &&
            availableViews(t).includes(q.view),
        ),
      ),
      "Uma alternativa não é válida para esta estrutura e vista.",
    );
  } else check(q.options.length === 0);
  check(
    q.status === "invalidated"
      ? string(q.invalidationReason, 500)
      : q.invalidationReason === null,
  );
  if (q.status === "pending" || q.status === "skipped")
    check(q.attempts.length === q.retryCount);
  else if (q.status === "answered")
    check(q.attempts.length === q.retryCount + 1);
  else
    check(
      q.attempts.length === q.retryCount ||
        q.attempts.length === q.retryCount + 1,
    );
  if (session.mode === "exam")
    check(!q.hintUsed && q.retryCount === 0 && q.attempts.length <= 1);
  let lastAnsweredAt = session.startedAt;
  let assisted = false;
  for (let i = 0; i < q.attempts.length; i++) {
    const raw: unknown = q.attempts[i];
    record(raw, ["value", "correct", "assisted", "answeredAt"]);
    check(
      string(raw.value, 500) &&
        normalizeAnswer(raw.value).length > 0 &&
        typeof raw.correct === "boolean" &&
        typeof raw.assisted === "boolean",
    );
    check(
      finite(raw.answeredAt, lastAnsweredAt) &&
        raw.answeredAt <= session.updatedAt,
    );
    const attempt = raw as unknown as AnswerAttempt;
    check(!assisted || attempt.assisted);
    check(!attempt.assisted || q.hintUsed);
    check(session.mode !== "exam" || !attempt.assisted);
    check(q.kind !== "choice" || q.options.includes(attempt.value));
    check(
      q.kind !== "locate" ||
        eligible.some(
          (t) => t.id === attempt.value && availableViews(t).includes(q.view),
        ),
    );
    check(
      attempt.correct === isAnswerCorrect(target, q.kind, attempt.value),
      "O resultado de uma resposta não corresponde ao catálogo.",
    );
    check(
      !attempt.correct || (i === q.attempts.length - 1 && q.retryCount === i),
      "Uma repetição foi registrada após uma resposta correta.",
    );
    lastAnsweredAt = attempt.answeredAt;
    assisted = attempt.assisted;
  }
  if (q.status === "answered")
    check(q.attempts.at(-1)?.assisted === q.hintUsed);
  if (index < session.cursor) check(q.status !== "pending");
  if (index > session.cursor)
    check(
      q.attempts.length === 0 &&
        !q.hintUsed &&
        q.retryCount === 0 &&
        (session.status === "finished"
          ? q.status === "skipped"
          : q.status === "pending"),
    );
  if (session.status === "finished") check(q.status !== "pending");
  return q;
}

function validateSession(
  value: unknown,
  expectedStatus: Session["status"],
  targets: StudyTarget[],
  eligible: StudyTarget[],
): Session {
  record(value, [
    "id",
    "seed",
    "mode",
    "requestedCount",
    "availableCount",
    "questions",
    "cursor",
    "status",
    "startedAt",
    "updatedAt",
    "finishedAt",
    "pausedAt",
    "pausedMs",
    "timeLimitMs",
  ]);
  check(
    string(value.id) &&
      string(value.seed) &&
      ["practice", "exam"].includes(value.mode as string) &&
      value.status === expectedStatus,
  );
  check(
    Array.isArray(value.questions) &&
      value.questions.length > 0 &&
      value.questions.length <= 1000,
  );
  check(
    integer(value.requestedCount, value.questions.length, 1000) &&
      integer(value.availableCount, value.questions.length),
  );
  // Availability was computed before applying the requested count, but cannot exceed the real catalog.
  check(
    value.availableCount <=
      targets.reduce((total, t) => total + availableViews(t).length, 0),
  );
  check(integer(value.cursor, 0, value.questions.length - 1));
  check(
    finite(value.startedAt) &&
      finite(value.updatedAt, value.startedAt) &&
      value.updatedAt <= 8_640_000_000_000_000 &&
      finite(value.pausedMs) &&
      value.pausedMs <= value.updatedAt - value.startedAt,
  );
  check(
    value.timeLimitMs === null || finite(value.timeLimitMs, Number.MIN_VALUE),
  );
  check(
    value.pausedAt === null ||
      (finite(value.pausedAt, value.startedAt) &&
        value.pausedAt <= value.updatedAt),
  );
  check(
    expectedStatus === "finished"
      ? value.finishedAt === value.updatedAt && value.pausedAt === null
      : value.finishedAt === null,
  );
  const session = value as unknown as Session;
  const identities = new Set<string>();
  let previousAnsweredAt = session.startedAt;
  for (let index = 0; index < session.questions.length; index++) {
    const question = validateQuestion(
      session.questions[index],
      session,
      index,
      targets,
      eligible,
    );
    const identity = `${question.targetId}/${question.view}`;
    check(
      !identities.has(identity),
      "A sessão contém um item e vista repetidos.",
    );
    identities.add(identity);
    if (question.attempts.length > 0) {
      check(question.attempts[0].answeredAt >= previousAnsweredAt);
      previousAnsweredAt = question.attempts.at(-1)!.answeredAt;
    }
  }
  return session;
}

export function exportProgress(data: ProgressData): string {
  const text = JSON.stringify(data);
  check(
    new TextEncoder().encode(text).byteLength <= MAX_IMPORT_BYTES,
    "O histórico é grande demais para exportar. Reduza as sessões salvas.",
  );
  return text;
}

export function importProgress(
  text: string,
  targets: StudyTarget[],
): DataResult<ProgressData> {
  if (
    typeof text !== "string" ||
    text.length > MAX_IMPORT_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES
  ) {
    return { ok: false, error: "O arquivo é grande demais. O limite é 2 MB." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "O arquivo não contém JSON válido." };
  }
  try {
    check(
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed),
      "A estrutura do arquivo é inválida.",
    );
    const version = (parsed as Record<string, unknown>).schemaVersion;
    check(
      version === 0 || version === 1,
      "Versão de progresso não suportada. Exporte usando uma versão compatível do NeuroGame.",
    );
    record(
      parsed,
      version === 0
        ? ["schemaVersion", "sessions", "activeSession"]
        : ["schemaVersion", "sessions", "activeSession", "preferences"],
    );
    const preferences: unknown =
      version === 0 ? emptyProgress().preferences : parsed.preferences;
    record(preferences, ["reducedMotion", "tutorialDismissed"]);
    check(
      typeof preferences.reducedMotion === "boolean" &&
        typeof preferences.tutorialDismissed === "boolean",
    );
    check(
      Array.isArray(parsed.sessions) && parsed.sessions.length <= 100,
      "O histórico deve conter no máximo 100 sessões.",
    );
    const eligible = eligibleTargets(targets);
    const sessions = parsed.sessions.map((s) =>
      validateSession(s, "finished", targets, eligible),
    );
    const activeSession =
      parsed.activeSession === null
        ? null
        : validateSession(parsed.activeSession, "active", targets, eligible);
    const allSessions = [
      ...sessions,
      ...(activeSession ? [activeSession] : []),
    ];
    check(
      new Set(allSessions.map((s) => s.id)).size === allSessions.length,
      "O arquivo repete uma sessão no histórico.",
    );
    return {
      ok: true,
      data: {
        schemaVersion: 1,
        sessions,
        activeSession,
        preferences: {
          reducedMotion: preferences.reducedMotion,
          tutorialDismissed: preferences.tutorialDismissed,
        },
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível validar o progresso.",
    };
  }
}
export function saveProgress(
  data: ProgressData,
  storage?: StorageLike,
): DataResult<null> {
  try {
    (storage ?? globalThis.localStorage).setItem(
      STORAGE_KEY,
      exportProgress(data),
    );
    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      error:
        "Não foi possível salvar. O progresso permanece em memória; exporte uma cópia.",
    };
  }
}
export function loadProgress(
  targets: StudyTarget[],
  storage?: StorageLike,
): DataResult<ProgressData> {
  try {
    const text = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    return text === null
      ? { ok: true, data: emptyProgress() }
      : importProgress(text, targets);
  } catch {
    return {
      ok: false,
      error:
        "O armazenamento local está indisponível. Você pode continuar em memória.",
    };
  }
}
export function clearProgress(storage?: StorageLike): DataResult<null> {
  try {
    (storage ?? globalThis.localStorage).removeItem(STORAGE_KEY);
    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      error: "Não foi possível apagar o armazenamento local.",
    };
  }
}
export function recordSession(
  data: ProgressData,
  session: Session,
): ProgressData {
  if (session.status === "active") return { ...data, activeSession: session };
  return {
    ...data,
    sessions: [
      ...data.sessions.filter((s) => s.id !== session.id),
      session,
    ].slice(-100),
    activeSession:
      data.activeSession?.id === session.id ? null : data.activeSession,
  };
}
