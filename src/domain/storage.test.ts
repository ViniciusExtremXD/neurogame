import { describe, expect, it } from "vitest";
import {
  advanceQuestion,
  createSession,
  finishSession,
  pauseSession,
  retryQuestion,
  submitAnswer,
} from "./engine";
import {
  clearProgress,
  emptyProgress,
  exportProgress,
  importProgress,
  loadProgress,
  recordSession,
  saveProgress,
  STORAGE_KEY,
} from "./storage";
import type { ProgressData, StorageLike, StudyTarget } from "./types";

const targets: StudyTarget[] = Array.from({ length: 4 }, (_, i) => ({
  id: `target-${i}`,
  name: `Estrutura ${i} esquerda`,
  aliases: [`E${i} esquerda`],
  category: "fixture",
  moduleId: "module",
  source: "Fonte acadêmica da fixture",
  eligible: true,
  labelIds: [i + 1],
  views: ["3d", "axial"],
  sliceIndices: { axial: i + 10 },
}));

function progress(): ProgressData {
  let session = createSession(targets, {
    id: "restore-me",
    seed: "frozen-order",
    mode: "exam",
    count: 3,
    startedAt: 1000,
  });
  const q = session.questions[0];
  session = submitAnswer(
    session,
    q.id,
    q.kind === "name"
      ? targets.find((t) => t.id === q.targetId)!.name
      : q.targetId,
    targets,
    1500,
  );
  session = advanceQuestion(session, q.id, 1600);
  session = pauseSession(session, 2000);
  return {
    ...emptyProgress(),
    activeSession: session,
    preferences: { reducedMotion: true, tutorialDismissed: true },
  };
}

/** A small real in-memory Storage implementation, not a mock of domain behavior. */
class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("versioned progress", () => {
  it("restores the exact order, alternatives, seed, answers, timer, pause and preferences", () => {
    const original = progress();
    const result = importProgress(exportProgress(original), targets);
    expect(result).toEqual({ ok: true, data: original });
  });

  it("records an active session then a completed run once, without inflating history on repeated saves", () => {
    const active = progress().activeSession!;
    let data = recordSession(emptyProgress(), active);
    expect(data.activeSession?.id).toBe("restore-me");
    const finished = finishSession(active, 3000);
    data = recordSession(data, finished);
    data = recordSession(data, finished);
    expect(data.sessions).toHaveLength(1);
    expect(data.activeSession).toBeNull();
    expect(importProgress(exportProgress(data), targets)).toEqual({
      ok: true,
      data,
    });
  });

  it("migrates the explicit v0 envelope by adding defaults, while refusing unknown future formats", () => {
    const old = { schemaVersion: 0, sessions: [], activeSession: null };
    expect(importProgress(JSON.stringify(old), targets)).toEqual({
      ok: true,
      data: emptyProgress(),
    });
    expect(
      importProgress('{"schemaVersion":999,"sessions":[]}', targets),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/versão/i) });
  });

  it.each([
    "",
    "{invalid",
    "null",
    "[]",
    '{"schemaVersion":1}',
    " ".repeat(2_000_001),
  ])("refuses malformed, missing or oversized data", (text) => {
    expect(importProgress(text, targets)).toMatchObject({
      ok: false,
      error: expect.any(String),
    });
  });

  it("rejects otherwise valid JSON exceeding the byte budget before restoring it", () => {
    const text = " ".repeat(2_000_001) + JSON.stringify(emptyProgress());
    expect(importProgress(text, targets)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/grande|tamanho/i),
    });
  });

  it.each([
    [
      "unknown target",
      (data: ProgressData) => {
        data.activeSession!.questions[0].targetId = "does-not-exist";
      },
    ],
    [
      "unavailable view",
      (data: ProgressData) => {
        data.activeSession!.questions[0].view = "coronal";
      },
    ],
    [
      "fake correct answer",
      (data: ProgressData) => {
        data.activeSession!.questions[0].attempts[0].correct = false;
      },
    ],
    [
      "replayed question ID",
      (data: ProgressData) => {
        data.activeSession!.questions[1].id =
          data.activeSession!.questions[0].id;
      },
    ],
    [
      "out of range cursor",
      (data: ProgressData) => {
        data.activeSession!.cursor = 30;
      },
    ],
    [
      "negative elapsed time",
      (data: ProgressData) => {
        data.activeSession!.pausedMs = -10;
      },
    ],
    [
      "unrepresentable calendar date",
      (data: ProgressData) => {
        data.activeSession!.updatedAt = 1e100;
      },
    ],
    [
      "contradictory end state",
      (data: ProgressData) => {
        data.activeSession!.finishedAt = 3000;
      },
    ],
    [
      "assisted exam",
      (data: ProgressData) => {
        data.activeSession!.questions[1].hintUsed = true;
      },
    ],
    [
      "fabricated pool total",
      (data: ProgressData) => {
        data.activeSession!.availableCount = 9000;
      },
    ],
    [
      "unsolicited profile field",
      (data: ProgressData) => {
        Object.assign(data, { email: "not-a-profile" });
      },
    ],
    [
      "unknown nested field",
      (data: ProgressData) => {
        Object.assign(data.activeSession!.questions[0], { injected: "field" });
      },
    ],
    [
      "advanced before answer",
      (data: ProgressData) => {
        data.activeSession!.questions[0].status = "pending";
      },
    ],
    [
      "answered item marked skipped",
      (data: ProgressData) => {
        data.activeSession!.questions[0].status = "skipped";
      },
    ],
  ])("rejects inconsistent imported state: %s", (_label, mutate) => {
    const data = progress();
    mutate(data);
    expect(importProgress(JSON.stringify(data), targets)).toMatchObject({
      ok: false,
    });
  });

  it("validates slice indices and every distractor against the trusted current catalog", () => {
    const session = createSession(targets, {
      id: "choices",
      seed: "seed",
      mode: "practice",
      count: 1,
      views: ["axial"],
      kinds: ["choice"],
    });
    const data = { ...emptyProgress(), activeSession: session };
    data.activeSession.questions[0].sliceIndex = 999;
    expect(importProgress(JSON.stringify(data), targets).ok).toBe(false);
    data.activeSession.questions[0].sliceIndex = targets.find(
      (t) => t.id === session.questions[0].targetId,
    )!.sliceIndices!.axial;
    data.activeSession.questions[0].options[0] = "unknown-choice";
    expect(importProgress(JSON.stringify(data), targets).ok).toBe(false);
  });

  it("restores a legitimate retry without accepting a forged retry after a correct answer", () => {
    let session = createSession(targets, {
      id: "retry",
      seed: "seed",
      mode: "practice",
      count: 1,
      kinds: ["name"],
    });
    session = submitAnswer(
      session,
      session.questions[0].id,
      "errado",
      targets,
      100,
    );
    session = retryQuestion(session, session.questions[0].id);
    const data = { ...emptyProgress(), activeSession: session };
    expect(importProgress(JSON.stringify(data), targets).ok).toBe(true);
    session.questions[0].attempts[0].value = targets.find(
      (t) => t.id === session.questions[0].targetId,
    )!.name;
    session.questions[0].attempts[0].correct = true;
    expect(importProgress(JSON.stringify(data), targets).ok).toBe(false);
  });
});

describe("local storage boundary", () => {
  it("loads an empty store and saves, restores and clears only its own key", () => {
    const storage = new MemoryStorage();
    storage.setItem("another-app", "keep");
    expect(loadProgress(targets, storage)).toEqual({
      ok: true,
      data: emptyProgress(),
    });
    expect(saveProgress(progress(), storage)).toEqual({ ok: true, data: null });
    expect(loadProgress(targets, storage)).toEqual({
      ok: true,
      data: progress(),
    });
    expect(clearProgress(storage)).toEqual({ ok: true, data: null });
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem("another-app")).toBe("keep");
  });

  it("reports inaccessible storage without throwing or destroying in-memory progress", () => {
    const unavailable: StorageLike = {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        throw new Error("QuotaExceededError");
      },
      removeItem() {
        throw new Error("SecurityError");
      },
    };
    const data = progress();
    expect(saveProgress(data, unavailable)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/memória/i),
    });
    expect(loadProgress(targets, unavailable)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/armazenamento/i),
    });
    expect(clearProgress(unavailable)).toMatchObject({ ok: false });
    expect(data.activeSession?.seed).toBe("frozen-order");
  });
});
