import { describe, expect, it } from "vitest";
import {
  advanceQuestion,
  createSession,
  elapsedMs,
  finishSession,
  invalidateQuestion,
  normalizeAnswer,
  pauseSession,
  resumeSession,
  retryQuestion,
  skipQuestion,
  submitAnswer,
  summarizeSession,
  useHint,
} from "./engine";
import type { SessionConfig, StudyTarget } from "./types";

export const targets: StudyTarget[] = [
  {
    id: "a",
    name: "Núcleo A esquerdo",
    aliases: ["NA esquerdo"],
    moduleId: "deep",
    category: "nuclei",
    source: "Fixture acadêmica A",
    eligible: true,
    views: ["3d", "axial"],
    labelIds: [1],
    sliceIndices: { axial: 10 },
  },
  {
    id: "b",
    name: "Núcleo B esquerdo",
    aliases: ["NB esquerdo"],
    moduleId: "deep",
    category: "nuclei",
    source: "Fixture acadêmica B",
    eligible: true,
    views: ["3d", "axial"],
    labelIds: [2],
    sliceIndices: { axial: 12 },
  },
  {
    id: "c",
    name: "Núcleo C esquerdo",
    aliases: [],
    moduleId: "deep",
    category: "nuclei",
    source: "Fixture acadêmica C",
    eligible: true,
    views: ["3d"],
    labelIds: [3],
  },
  {
    id: "d",
    name: "Núcleo D esquerdo",
    aliases: [],
    moduleId: "deep",
    category: "nuclei",
    source: "Fixture acadêmica D",
    eligible: true,
    views: ["3d"],
    labelIds: [4],
  },
  {
    id: "a-right",
    name: "Núcleo A direito",
    aliases: ["NA direito"],
    moduleId: "deep",
    category: "nuclei",
    source: "Fixture acadêmica A direita",
    eligible: true,
    views: ["3d"],
    labelIds: [5],
  },
  {
    id: "unmapped",
    name: "Sem geometria",
    aliases: [],
    moduleId: "deep",
    category: "nuclei",
    source: "Fixture acadêmica",
    eligible: false,
    views: ["3d"],
    labelIds: [],
  },
  {
    id: "unsourced",
    name: "Sem fonte",
    aliases: [],
    moduleId: "deep",
    category: "nuclei",
    source: "",
    eligible: true,
    views: ["3d"],
    labelIds: [6],
  },
];

export const config: SessionConfig = {
  id: "test-session",
  seed: "reproducible",
  mode: "practice",
  count: 10,
  startedAt: 1000,
};

describe("controlled normalization", () => {
  it("ignores accents/case/spacing/hyphens but keeps anatomical laterality and spelling", () => {
    expect(normalizeAnswer("  NÚCLEO-A   EsQuErDo ")).toBe("nucleo a esquerdo");
    expect(normalizeAnswer("núcleo A direito")).not.toBe(
      normalizeAnswer("núcleo A esquerdo"),
    );
    expect(normalizeAnswer("nucle A esquerdo")).not.toBe(
      normalizeAnswer("núcleo A esquerdo"),
    );
  });
});

function nameSession(count = 1) {
  return createSession(targets, {
    ...config,
    kinds: ["name"],
    views: ["3d"],
    targetIds: count === 1 ? ["a"] : undefined,
    count,
  });
}

describe("answer lifecycle and score", () => {
  it("accepts exactly curated equivalents and refuses the opposite side, blank input and fuzzy spelling", () => {
    const session = nameSession();
    const id = session.questions[0].id;
    expect(submitAnswer(session, id, "  ", targets)).toBe(session);
    expect(
      submitAnswer(session, id, "ná   ESQUERDO", targets).questions[0]
        .attempts[0]?.correct,
    ).toBe(true);
    expect(
      submitAnswer(session, id, "NA direito", targets).questions[0].attempts[0]
        ?.correct,
    ).toBe(false);
    expect(
      submitAnswer(session, id, "Núcle A esquerdo", targets).questions[0]
        .attempts[0]?.correct,
    ).toBe(false);
    expect(session.questions[0].attempts).toHaveLength(0);
  });

  it("answers locating and choices with actual target IDs, never display colors or an arbitrary alternative", () => {
    const locating = createSession(targets, {
      ...config,
      kinds: ["locate"],
      targetIds: ["a"],
      views: ["3d"],
    });
    expect(
      submitAnswer(locating, locating.questions[0].id, "a", targets)
        .questions[0].attempts[0]?.correct,
    ).toBe(true);
    expect(
      submitAnswer(locating, locating.questions[0].id, "#ff0000", targets),
    ).toBe(locating);
    const choices = createSession(targets, {
      ...config,
      kinds: ["choice"],
      targetIds: ["a"],
    });
    expect(
      submitAnswer(choices, choices.questions[0].id, "unmapped", targets),
    ).toBe(choices);
    expect(
      submitAnswer(choices, choices.questions[0].id, "a", targets).questions[0]
        .attempts[0]?.correct,
    ).toBe(true);
  });

  it("ignores duplicate submissions and delayed events from prior questions and retries", () => {
    let session = nameSession(3);
    const original = session.questions[0].id;
    session = submitAnswer(session, original, "errado", targets);
    expect(submitAnswer(session, original, "errado", targets)).toBe(session);
    session = retryQuestion(session, original);
    expect(session.questions[0].id).not.toBe(original);
    expect(submitAnswer(session, original, "errado", targets)).toBe(session);
    const retryId = session.questions[0].id;
    session = submitAnswer(session, retryId, "errado", targets);
    session = advanceQuestion(session, retryId);
    expect(session.cursor).toBe(1);
    expect(advanceQuestion(session, retryId)).toBe(session);
    expect(submitAnswer(session, retryId, "errado", targets)).toBe(session);
    expect(session.questions[0].attempts).toHaveLength(2);
  });

  it("does not advance an unanswered question until explicitly skipped", () => {
    let session = nameSession(2);
    const id = session.questions[0].id;
    expect(advanceQuestion(session, id)).toBe(session);
    session = skipQuestion(session, id);
    expect(session.questions[0].status).toBe("skipped");
    expect(submitAnswer(session, id, "answer", targets)).toBe(session);
    expect(advanceQuestion(session, id).cursor).toBe(1);
  });

  it("separates independent, assisted and repeated successes from omissions and system failures", () => {
    let session = nameSession(5);
    const answer = () =>
      targets.find((t) => t.id === session.questions[session.cursor].targetId)!
        .name;
    session = submitAnswer(
      session,
      session.questions[0].id,
      answer(),
      targets,
      1100,
    );
    session = advanceQuestion(session, session.questions[0].id, 1200);
    session = useHint(session, session.questions[1].id);
    session = submitAnswer(
      session,
      session.questions[1].id,
      answer(),
      targets,
      1300,
    );
    session = advanceQuestion(session, session.questions[1].id, 1400);
    session = submitAnswer(
      session,
      session.questions[2].id,
      "errado",
      targets,
      1500,
    );
    session = retryQuestion(session, session.questions[2].id);
    session = submitAnswer(
      session,
      session.questions[2].id,
      answer(),
      targets,
      1600,
    );
    session = advanceQuestion(session, session.questions[2].id, 1700);
    session = invalidateQuestion(
      session,
      session.questions[3].id,
      "Modelo não carregou.",
    );
    session = advanceQuestion(session, session.questions[3].id, 1800);
    session = finishSession(session, 2000);
    expect(summarizeSession(session, targets)).toMatchObject({
      total: 5,
      valid: 4,
      invalidated: 1,
      answered: 3,
      omitted: 1,
      independentCorrect: 1,
      assistedCorrect: 1,
      retryCorrect: 1,
      firstAttemptErrors: 1,
      attempts: 4,
      hints: 1,
      retries: 1,
      accuracy: 25,
      elapsedMs: 1000,
      byModule: { deep: { valid: 4, independentCorrect: 1, accuracy: 25 } },
      byView: { "3d": { valid: 4, accuracy: 25 } },
    });
    const summary = summarizeSession(session, targets)!;
    expect(summary.reviewTargetIds).toContain(session.questions[2].targetId);
    expect(summary.reviewTargetIds).not.toContain(
      session.questions[3].targetId,
    );
    expect(finishSession(session, 4000)).toBe(session);
  });

  it("invalidates a target removed from the trusted pool and never turns failed assets into errors", () => {
    const session = nameSession();
    const removed = targets.map((t) =>
      t.id === "a" ? { ...t, eligible: false } : t,
    );
    const result = submitAnswer(
      session,
      session.questions[0].id,
      "NA esquerdo",
      removed,
    );
    expect(result.questions[0].status).toBe("invalidated");
    expect(summarizeSession(finishSession(result), targets)).toMatchObject({
      valid: 0,
      accuracy: null,
      firstAttemptErrors: 0,
    });
  });

  it("invalidates a choice if a distractor loses eligibility after the question was generated", () => {
    const session = createSession(targets, {
      ...config,
      kinds: ["choice"],
      count: 1,
    });
    const q = session.questions[0];
    const removedId = q.options.find((id) => id !== q.targetId)!;
    const changed = targets.map((t) =>
      t.id === removedId ? { ...t, eligible: false } : t,
    );
    expect(
      submitAnswer(session, q.id, q.targetId, changed).questions[0].status,
    ).toBe("invalidated");
  });

  it("does not label future unanswered practice items as deliberately omitted", () => {
    let session = nameSession(3);
    expect(summarizeSession(session, targets)).toMatchObject({
      omitted: 0,
      valid: 3,
    });
    session = skipQuestion(session, session.questions[0].id);
    expect(summarizeSession(session, targets)).toMatchObject({
      omitted: 1,
      valid: 3,
    });
    expect(summarizeSession(finishSession(session), targets)).toMatchObject({
      omitted: 3,
    });
  });

  it("withholds exam summaries and prevents hints/retries until correction at the end", () => {
    let session = createSession(targets, {
      ...config,
      mode: "exam",
      kinds: ["name"],
      count: 1,
    });
    const id = session.questions[0].id;
    expect(useHint(session, id)).toBe(session);
    session = submitAnswer(session, id, "errado", targets);
    expect(retryQuestion(session, id)).toBe(session);
    expect(summarizeSession(session, targets)).toBeNull();
    session = advanceQuestion(session, id, 2000);
    expect(session.status).toBe("finished");
    expect(summarizeSession(session, targets)?.firstAttemptErrors).toBe(1);
  });

  it("maintains consecutive independent successes and counts every missed valid item in the denominator", () => {
    let session = nameSession(5);
    for (let i = 0; i < 3; i++) {
      const q = session.questions[session.cursor];
      session = submitAnswer(
        session,
        q.id,
        targets.find((t) => t.id === q.targetId)!.name,
        targets,
      );
      session = advanceQuestion(session, q.id);
    }
    session = skipQuestion(session, session.questions[3].id);
    session = advanceQuestion(session, session.questions[3].id);
    const q = session.questions[4];
    session = submitAnswer(
      session,
      q.id,
      targets.find((t) => t.id === q.targetId)!.name,
      targets,
    );
    session = finishSession(session);
    expect(summarizeSession(session, targets)).toMatchObject({
      bestStreak: 3,
      currentStreak: 1,
      accuracy: 80,
      omitted: 1,
    });
  });
});

describe("session timing", () => {
  it("freezes elapsed time while paused, refuses paused answers and excludes paused time when resumed", () => {
    let session = nameSession();
    session = pauseSession(session, 2000);
    expect(elapsedMs(session, 9000)).toBe(1000);
    expect(
      submitAnswer(
        session,
        session.questions[0].id,
        "NA esquerdo",
        targets,
        8000,
      ),
    ).toBe(session);
    session = resumeSession(session, 9000);
    expect(elapsedMs(session, 9500)).toBe(1500);
    session = finishSession(session, 10000);
    expect(elapsedMs(session, 9999999)).toBe(2000);
  });

  it("ends at the active time limit and omits rather than accepting a late answer", () => {
    let session = createSession(targets, {
      ...config,
      kinds: ["name"],
      targetIds: ["a"],
      count: 1,
      timeLimitMs: 1000,
    });
    session = submitAnswer(
      session,
      session.questions[0].id,
      "NA esquerdo",
      targets,
      2001,
    );
    expect(session.status).toBe("finished");
    expect(session.questions[0].attempts).toHaveLength(0);
    expect(session.questions[0].status).toBe("skipped");
    expect(elapsedMs(session)).toBe(1000);
  });
});

describe("question generation", () => {
  it("uses the actual eligible item/view pool and never duplicates an item/view to reach the requested size", () => {
    const session = createSession(targets, { ...config, count: 100 });
    expect(session.availableCount).toBe(7);
    expect(session.questions).toHaveLength(7);
    expect(session.requestedCount).toBe(100);
    expect(
      new Set(session.questions.map((q) => `${q.targetId}/${q.view}`)).size,
    ).toBe(7);
    expect(
      session.questions.every(
        (q) => !["unmapped", "unsourced"].includes(q.targetId),
      ),
    ).toBe(true);
  });

  it("reproduces content for a seed while a fresh run has distinct event identities", () => {
    const one = createSession(targets, config);
    const two = createSession(targets, { ...config, id: "another-run" });
    const content = (s: typeof one) =>
      s.questions.map((q) => [q.targetId, q.view, q.kind, q.options]);
    expect(content(one)).toEqual(content(two));
    expect(
      one.questions.some((q) =>
        two.questions.some((other) => other.id === q.id),
      ),
    ).toBe(false);
    expect(
      content(createSession(targets, { ...config, seed: "different" })),
    ).not.toEqual(content(one));
    expect(new Set(one.questions.map((q) => q.id)).size).toBe(
      one.questions.length,
    );
  });

  it("applies module, target, mode and view filters before reporting availability", () => {
    const session = createSession(targets, {
      ...config,
      kinds: ["name"],
      views: ["axial"],
      targetIds: ["a", "b"],
    });
    expect(session.availableCount).toBe(2);
    expect(
      session.questions.every((q) => q.kind === "name" && q.view === "axial"),
    ).toBe(true);
    expect(session.questions.find((q) => q.targetId === "a")?.sliceIndex).toBe(
      10,
    );
    expect(() =>
      createSession(targets, { ...config, moduleIds: ["missing"] }),
    ).toThrow(/elegív/i);
  });

  it("rejects duplicate IDs and excludes ambiguous names instead of allowing a shared alias to be correct for two structures", () => {
    expect(() => createSession([...targets, targets[0]], config)).toThrow(
      /ID/i,
    );
    const ambiguous = targets.map((t) =>
      t.id === "b" ? { ...t, aliases: ["NA esquerdo"] } : t,
    );
    const session = createSession(ambiguous, { ...config, kinds: ["name"] });
    expect(session.questions.some((q) => ["a", "b"].includes(q.targetId))).toBe(
      false,
    );
  });

  it("uses only distinct equivalent-level choices and omits choice questions without enough suitable distractors", () => {
    const pool = [
      ...targets,
      {
        ...targets[0],
        id: "other-module",
        moduleId: "other",
        name: "Outra região",
        aliases: [],
      },
      {
        ...targets[0],
        id: "other-category",
        category: "vessel",
        name: "Artéria",
        aliases: [],
      },
    ];
    const session = createSession(pool, { ...config, kinds: ["choice"] });
    for (const q of session.questions) {
      const target = pool.find((t) => t.id === q.targetId)!;
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options.filter((id) => id === q.targetId)).toHaveLength(1);
      expect(
        q.options.every((id) =>
          pool.some(
            (t) =>
              t.id === id &&
              t.moduleId === target.moduleId &&
              t.category === target.category,
          ),
        ),
      ).toBe(true);
    }
    expect(session.questions.some((q) => q.view === "axial")).toBe(false);
    expect(() =>
      createSession(targets.slice(0, 2), { ...config, kinds: ["choice"] }),
    ).toThrow(/elegív/i);
  });

  it.each([0, -1, 1.5, NaN, Infinity, 1001])(
    "rejects invalid requested size %s",
    (count) => {
      expect(() => createSession(targets, { ...config, count })).toThrow(
        /quantidade/i,
      );
    },
  );

  it("rejects a finite timestamp that cannot be represented as a calendar date", () => {
    expect(() =>
      createSession(targets, { ...config, startedAt: 1e100 }),
    ).toThrow(/horário/i);
  });
});
