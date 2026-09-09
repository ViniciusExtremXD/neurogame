export type Plane = "axial" | "coronal" | "sagittal";
export type StudyView = "3d" | Plane;
export type QuestionKind = "locate" | "name" | "choice";

/** Only content with a sourced and verified mapping may be eligible. */
export interface StudyTarget {
  id: string;
  name: string;
  aliases: string[];
  moduleId: string;
  category: string;
  source: string;
  eligible: boolean;
  views: StudyView[];
  labelIds: number[];
  sliceIndices?: Partial<Record<Plane, number>>;
}

export interface SessionConfig {
  /** A NEW UUID for each run; the seed controls content, never the event identity. */
  id: string;
  seed: string;
  mode: "practice" | "exam";
  count: number;
  kinds?: QuestionKind[];
  views?: StudyView[];
  moduleIds?: string[];
  targetIds?: string[];
  startedAt?: number;
  timeLimitMs?: number;
}

export interface AnswerAttempt {
  value: string;
  correct: boolean;
  assisted: boolean;
  answeredAt: number;
}

export interface Question {
  /** Changes on retry so delayed events cannot answer the next attempt. */
  id: string;
  targetId: string;
  kind: QuestionKind;
  view: StudyView;
  /** Target IDs, not labels. Empty except for multiple choice. */
  options: string[];
  sliceIndex?: number;
  status: "pending" | "answered" | "skipped" | "invalidated";
  attempts: AnswerAttempt[];
  hintUsed: boolean;
  retryCount: number;
  invalidationReason: string | null;
}

export interface Session {
  id: string;
  seed: string;
  mode: "practice" | "exam";
  requestedCount: number;
  availableCount: number;
  questions: Question[];
  cursor: number;
  status: "active" | "finished";
  startedAt: number;
  updatedAt: number;
  finishedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;
  timeLimitMs: number | null;
}

export interface ScoreBreakdown {
  total: number;
  valid: number;
  invalidated: number;
  answered: number;
  omitted: number;
  independentCorrect: number;
  assistedCorrect: number;
  retryCorrect: number;
  firstAttemptErrors: number;
  attempts: number;
  hints: number;
  retries: number;
  /** Independent first-attempt successes / all valid questions, including omissions. */
  accuracy: number | null;
}

export interface SessionSummary extends ScoreBreakdown {
  elapsedMs: number;
  currentStreak: number;
  bestStreak: number;
  reviewTargetIds: string[];
  byModule: Record<string, ScoreBreakdown>;
  byView: Partial<Record<StudyView, ScoreBreakdown>>;
}

export interface ProgressData {
  schemaVersion: 1;
  sessions: Session[];
  activeSession: Session | null;
  preferences: { reducedMotion: boolean; tutorialDismissed: boolean };
}

export type DataResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
