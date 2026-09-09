import type {
  Question,
  QuestionKind,
  ScoreBreakdown,
  Session,
  SessionConfig,
  SessionSummary,
  StudyTarget,
  StudyView,
} from "./types";

const ALL_KINDS: QuestionKind[] = ["locate", "name", "choice"];
const ALL_VIEWS: StudyView[] = ["3d", "axial", "coronal", "sagittal"];

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[-‐‑‒–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function names(target: StudyTarget): Set<string> {
  return new Set(
    [target.name, ...target.aliases].map(normalizeAnswer).filter(Boolean),
  );
}

export function availableViews(target: StudyTarget): StudyView[] {
  return [...new Set(target.views)].filter(
    (view) =>
      ALL_VIEWS.includes(view) &&
      (view === "3d" ||
        (Number.isInteger(target.sliceIndices?.[view]) &&
          target.sliceIndices![view]! >= 0)),
  );
}

/** Ambiguous curated aliases are withheld from assessment, never resolved by proximity. */
export function eligibleTargets(targets: StudyTarget[]): StudyTarget[] {
  const ids = new Set<string>();
  for (const target of targets) {
    if (!target.id.trim() || ids.has(target.id))
      throw new Error("O catálogo contém ID ausente ou duplicado.");
    ids.add(target.id);
  }
  const candidates = targets.filter(
    (target) =>
      target.eligible &&
      target.source.trim() &&
      target.name.trim() &&
      target.moduleId.trim() &&
      target.category.trim() &&
      target.labelIds.length > 0 &&
      target.labelIds.every((label) => Number.isInteger(label) && label > 0) &&
      availableViews(target).length > 0,
  );
  const owners = new Map<string, Set<string>>();
  for (const target of candidates) {
    for (const name of names(target)) {
      const set = owners.get(name) ?? new Set<string>();
      set.add(target.id);
      owners.set(name, set);
    }
  }
  return candidates.filter((target) =>
    [...names(target)].every((name) => owners.get(name)!.size === 1),
  );
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++)
    state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let next = Math.imul(state ^ (state >>> 15), state | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function questionIdentity(
  sessionId: string,
  index: number,
  retry: number,
): string {
  return `${sessionId}:q${index}:r${retry}`;
}

export function createSession(
  targets: StudyTarget[],
  config: SessionConfig,
): Session {
  if (
    !Number.isInteger(config.count) ||
    config.count < 1 ||
    config.count > 1000
  ) {
    throw new Error("Escolha uma quantidade inteira entre 1 e 1000 questões.");
  }
  if (
    !config.id?.trim() ||
    config.id.length > 200 ||
    !config.seed?.trim() ||
    config.seed.length > 200
  ) {
    throw new Error("A sessão precisa de um ID novo e de uma seed válida.");
  }
  if (!["practice", "exam"].includes(config.mode))
    throw new Error("Modo de estudo inválido.");
  const startedAt = config.startedAt ?? 0;
  if (
    !Number.isFinite(startedAt) ||
    startedAt < 0 ||
    startedAt > 8_640_000_000_000_000
  )
    throw new Error("Horário de início inválido.");
  if (
    config.timeLimitMs !== undefined &&
    (!Number.isFinite(config.timeLimitMs) || config.timeLimitMs <= 0)
  ) {
    throw new Error("O limite de tempo deve ser positivo.");
  }
  const kinds = [...new Set(config.kinds ?? ALL_KINDS)];
  const views = [...new Set(config.views ?? ALL_VIEWS)];
  if (
    kinds.some((kind) => !ALL_KINDS.includes(kind)) ||
    views.some((view) => !ALL_VIEWS.includes(view))
  ) {
    throw new Error("Modalidade ou vista inválida.");
  }
  const eligible = eligibleTargets(targets).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const filtered = eligible.filter(
    (target) =>
      (!config.moduleIds || config.moduleIds.includes(target.moduleId)) &&
      (!config.targetIds || config.targetIds.includes(target.id)),
  );
  const random = seededRandom(config.seed);
  const pool: Array<{
    target: StudyTarget;
    view: StudyView;
    kinds: QuestionKind[];
    distractors: StudyTarget[];
  }> = [];
  for (const target of filtered) {
    for (const view of availableViews(target).filter((v) =>
      views.includes(v),
    )) {
      const distractors = eligible.filter(
        (other) =>
          other.id !== target.id &&
          other.category === target.category &&
          other.moduleId === target.moduleId &&
          availableViews(other).includes(view),
      );
      const usableKinds = kinds.filter(
        (kind) => kind !== "choice" || distractors.length >= 3,
      );
      if (usableKinds.length > 0)
        pool.push({ target, view, kinds: usableKinds, distractors });
    }
  }
  if (pool.length === 0)
    throw new Error(
      "Não há questões elegíveis para esta combinação de filtros.",
    );
  const questions = shuffle(pool, random)
    .slice(0, config.count)
    .map((entry, index): Question => {
      const kind = entry.kinds[index % entry.kinds.length];
      return {
        id: questionIdentity(config.id, index, 0),
        targetId: entry.target.id,
        kind,
        view: entry.view,
        options:
          kind === "choice"
            ? shuffle(
                [
                  entry.target.id,
                  ...shuffle(entry.distractors, random)
                    .slice(0, 3)
                    .map((t) => t.id),
                ],
                random,
              )
            : [],
        ...(entry.view !== "3d"
          ? { sliceIndex: entry.target.sliceIndices![entry.view] }
          : {}),
        status: "pending",
        attempts: [],
        hintUsed: false,
        retryCount: 0,
        invalidationReason: null,
      };
    });
  return {
    id: config.id,
    seed: config.seed,
    mode: config.mode,
    requestedCount: config.count,
    availableCount: pool.length,
    questions,
    cursor: 0,
    status: "active",
    startedAt,
    updatedAt: startedAt,
    finishedAt: null,
    pausedAt: null,
    pausedMs: 0,
    timeLimitMs: config.timeLimitMs ?? null,
  };
}

function timestamp(session: Session, now = session.updatedAt): number {
  return Number.isFinite(now) && now <= 8_640_000_000_000_000
    ? Math.max(session.updatedAt, now)
    : session.updatedAt;
}

function currentQuestion(
  session: Session,
  questionId: string,
  allowPaused = false,
): Question | undefined {
  if (
    session.status !== "active" ||
    (!allowPaused && session.pausedAt !== null)
  )
    return undefined;
  const question = session.questions[session.cursor];
  return question?.id === questionId ? question : undefined;
}

function replaceQuestion(
  session: Session,
  question: Question,
  now = session.updatedAt,
): Session {
  return {
    ...session,
    updatedAt: timestamp(session, now),
    questions: session.questions.map((q, i) =>
      i === session.cursor ? question : q,
    ),
  };
}

function expired(session: Session, now: number): boolean {
  return (
    session.timeLimitMs !== null &&
    elapsedMs(session, now) >= session.timeLimitMs
  );
}

export function isAnswerCorrect(
  target: StudyTarget,
  kind: QuestionKind,
  value: string,
): boolean {
  return kind === "name"
    ? names(target).has(normalizeAnswer(value))
    : value === target.id;
}

export function submitAnswer(
  session: Session,
  questionId: string,
  value: string,
  targets: StudyTarget[],
  now = session.updatedAt,
): Session {
  const question = currentQuestion(session, questionId);
  if (!question || question.status !== "pending") return session;
  if (expired(session, now)) return finishSession(session, now);
  const eligible = eligibleTargets(targets);
  const target = eligible.find(
    (t) =>
      t.id === question.targetId && availableViews(t).includes(question.view),
  );
  if (!target)
    return invalidateQuestion(
      session,
      questionId,
      "O alvo não está disponível no catálogo avaliativo.",
    );
  if (
    question.kind === "choice" &&
    !question.options.every((id) =>
      eligible.some(
        (t) =>
          t.id === id &&
          t.moduleId === target.moduleId &&
          t.category === target.category &&
          availableViews(t).includes(question.view),
      ),
    )
  ) {
    return invalidateQuestion(
      session,
      questionId,
      "Uma alternativa não está disponível no catálogo avaliativo.",
    );
  }
  if (
    typeof value !== "string" ||
    value.length > 500 ||
    !normalizeAnswer(value)
  )
    return session;
  if (question.kind === "choice" && !question.options.includes(value))
    return session;
  if (
    question.kind === "locate" &&
    !eligible.some(
      (t) => t.id === value && availableViews(t).includes(question.view),
    )
  )
    return session;
  return replaceQuestion(
    session,
    {
      ...question,
      status: "answered",
      attempts: [
        ...question.attempts,
        {
          value,
          correct: isAnswerCorrect(target, question.kind, value),
          assisted: question.hintUsed,
          answeredAt: timestamp(session, now),
        },
      ],
    },
    now,
  );
}

export function useHint(session: Session, questionId: string): Session {
  const question = currentQuestion(session, questionId);
  if (
    session.mode !== "practice" ||
    !question ||
    question.status !== "pending" ||
    question.hintUsed
  )
    return session;
  return replaceQuestion(session, { ...question, hintUsed: true });
}

export function retryQuestion(session: Session, questionId: string): Session {
  const question = currentQuestion(session, questionId);
  if (
    session.mode !== "practice" ||
    !question ||
    question.status !== "answered" ||
    question.attempts.at(-1)?.correct ||
    question.retryCount >= 49
  )
    return session;
  return replaceQuestion(session, {
    ...question,
    status: "pending",
    retryCount: question.retryCount + 1,
    id: questionIdentity(session.id, session.cursor, question.retryCount + 1),
  });
}

export function skipQuestion(session: Session, questionId: string): Session {
  const question = currentQuestion(session, questionId);
  if (!question || question.status !== "pending") return session;
  return replaceQuestion(session, { ...question, status: "skipped" });
}

export function invalidateQuestion(
  session: Session,
  questionId: string,
  reason: string,
): Session {
  const question = currentQuestion(session, questionId, true);
  if (!question || question.status === "invalidated") return session;
  return replaceQuestion(session, {
    ...question,
    status: "invalidated",
    invalidationReason:
      reason.trim().slice(0, 500) || "Recurso anatômico indisponível.",
  });
}

export function advanceQuestion(
  session: Session,
  questionId: string,
  now = session.updatedAt,
): Session {
  const question = currentQuestion(session, questionId);
  if (!question) return session;
  if (expired(session, now)) return finishSession(session, now);
  if (question.status === "pending") return session;
  if (session.cursor + 1 >= session.questions.length)
    return finishSession(session, now);
  return {
    ...session,
    cursor: session.cursor + 1,
    updatedAt: timestamp(session, now),
  };
}

export function finishSession(
  session: Session,
  now = session.updatedAt,
): Session {
  if (session.status === "finished") return session;
  const finishedAt = timestamp(session, now);
  return {
    ...session,
    status: "finished",
    finishedAt,
    updatedAt: finishedAt,
    pausedAt: null,
    pausedMs:
      session.pausedMs +
      (session.pausedAt === null ? 0 : finishedAt - session.pausedAt),
    questions: session.questions.map((q) =>
      q.status === "pending" ? { ...q, status: "skipped" } : q,
    ),
  };
}

export function pauseSession(session: Session, now: number): Session {
  if (session.status !== "active" || session.pausedAt !== null) return session;
  if (expired(session, now)) return finishSession(session, now);
  const pausedAt = timestamp(session, now);
  return { ...session, pausedAt, updatedAt: pausedAt };
}

export function resumeSession(session: Session, now: number): Session {
  if (session.status !== "active" || session.pausedAt === null) return session;
  const resumedAt = timestamp(session, now);
  return {
    ...session,
    pausedAt: null,
    pausedMs: session.pausedMs + resumedAt - session.pausedAt,
    updatedAt: resumedAt,
  };
}

export function elapsedMs(session: Session, now = session.updatedAt): number {
  const end = session.finishedAt ?? session.pausedAt ?? timestamp(session, now);
  const elapsed = Math.max(0, end - session.startedAt - session.pausedMs);
  return session.timeLimitMs === null
    ? elapsed
    : Math.min(elapsed, session.timeLimitMs);
}

function score(questions: Question[]): ScoreBreakdown {
  const valid = questions.filter((q) => q.status !== "invalidated");
  const independent = (q: Question) =>
    q.attempts[0]?.correct === true && !q.attempts[0].assisted;
  const independentCorrect = valid.filter(independent).length;
  const answered = valid.filter((q) => q.attempts.length > 0).length;
  return {
    total: questions.length,
    valid: valid.length,
    invalidated: questions.length - valid.length,
    answered,
    omitted: valid.filter(
      (q) => q.status === "skipped" && q.attempts.length === 0,
    ).length,
    independentCorrect,
    assistedCorrect: valid.filter(
      (q) => q.attempts[0]?.correct && q.attempts[0].assisted,
    ).length,
    retryCorrect: valid.filter(
      (q) =>
        q.attempts[0]?.correct === false &&
        q.attempts.slice(1).some((a) => a.correct),
    ).length,
    firstAttemptErrors: valid.filter((q) => q.attempts[0]?.correct === false)
      .length,
    attempts: valid.reduce((sum, q) => sum + q.attempts.length, 0),
    hints: valid.filter((q) => q.hintUsed).length,
    retries: valid.reduce((sum, q) => sum + q.retryCount, 0),
    accuracy:
      valid.length === 0 ? null : (independentCorrect / valid.length) * 100,
  };
}

export function summarizeSession(
  session: Session,
  targets: StudyTarget[],
  now = session.updatedAt,
): SessionSummary | null {
  if (session.mode === "exam" && session.status !== "finished") return null;
  let currentStreak = 0;
  let bestStreak = 0;
  const review = new Set<string>();
  const modules = new Map<string, Question[]>();
  const views = new Map<StudyView, Question[]>();
  for (const q of session.questions) {
    const moduleId =
      targets.find((t) => t.id === q.targetId)?.moduleId ?? "unavailable";
    modules.set(moduleId, [...(modules.get(moduleId) ?? []), q]);
    views.set(q.view, [...(views.get(q.view) ?? []), q]);
    if (q.status === "invalidated") continue;
    const independent =
      q.attempts[0]?.correct === true && !q.attempts[0].assisted;
    if (independent) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else if (q.attempts.length > 0 || q.status === "skipped") {
      currentStreak = 0;
      review.add(q.targetId);
    }
  }
  return {
    ...score(session.questions),
    elapsedMs: elapsedMs(session, now),
    currentStreak,
    bestStreak,
    reviewTargetIds: [...review],
    byModule: Object.fromEntries(
      [...modules].map(([id, qs]) => [id, score(qs)]),
    ),
    byView: Object.fromEntries(
      [...views].map(([view, qs]) => [view, score(qs)]),
    ),
  };
}
