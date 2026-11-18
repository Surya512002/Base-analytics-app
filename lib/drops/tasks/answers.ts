/**
 * Answer tasks: learn-to-earn quizzes and secret words (event codes, puzzle answers).
 * Answers are stored only as salted hashes and never sent to claimers; attempts are limited.
 */
import { keccak256, stringToBytes } from "viem";
import { z } from "zod";
import type { TaskType } from "../types";

export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function answerHash(salt: string, answer: string): string {
  return keccak256(stringToBytes(`${salt}|${normalizeAnswer(answer)}`));
}

function newSalt(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

const hashes = z.array(z.string().regex(/^0x[0-9a-f]{64}$/)).min(1).max(10);
const attempts = z.number().int().min(1).max(20).default(3);

async function spendAttempt(
  kv: import("../types").TaskKv,
  key: string,
  max: number
): Promise<{ ok: true; left: number } | { ok: false }> {
  const used = await kv.incr(key);
  if (used > max) return { ok: false };
  return { ok: true, left: max - used };
}

// ───────────────────────────── quiz ─────────────────────────────

const quizStored = z.object({
  salt: z.string().regex(/^[0-9a-f]{32}$/),
  questions: z.array(z.object({ question: z.string().min(1).max(200), hashes })).min(1).max(10),
  passMark: z.number().int().min(1),
  maxAttempts: attempts,
});
type QuizConfig = z.infer<typeof quizStored>;

const quizInput = z.object({
  questions: z
    .array(z.object({ question: z.string().min(1).max(200), answers: z.array(z.string().min(1).max(100)).min(1).max(10) }))
    .min(1)
    .max(10),
  passMark: z.number().int().min(1).optional(),
  maxAttempts: attempts,
});

export const quizTask: TaskType<QuizConfig> = {
  type: "quiz",
  label: "Answer a quiz",
  trust: "answer",
  needsSubmission: true,
  recheckAtClaim: false,
  configSchema: quizStored.refine((c) => c.passMark <= c.questions.length, "Pass mark is above the number of questions"),
  prepare(input) {
    // Already-prepared configs (re-saving a definition) pass through unchanged.
    const stored = quizStored.safeParse(input);
    if (stored.success) return stored.data;
    const q = quizInput.parse(input);
    const salt = newSalt();
    return {
      salt,
      questions: q.questions.map((x) => ({ question: x.question, hashes: x.answers.map((a) => answerHash(salt, a)) })),
      passMark: q.passMark ?? q.questions.length,
      maxAttempts: q.maxAttempts,
    };
  },
  publicConfig: (c) => ({ questions: c.questions.map((q) => q.question), passMark: c.passMark, maxAttempts: c.maxAttempts }),
  async verify(config, ctx) {
    const answers = (ctx.submission as { answers?: unknown } | undefined)?.answers;
    if (!Array.isArray(answers) || answers.length !== config.questions.length || answers.some((a) => typeof a !== "string" || a.length > 200)) {
      return { status: "failed", message: "Answer every question." };
    }
    const key = `drops:attempts:${ctx.dropsContract.toLowerCase()}:${ctx.dropId}:${ctx.taskId}:${ctx.claimer.toLowerCase()}`;
    const attempt = await spendAttempt(ctx.kv, key, config.maxAttempts);
    if (!attempt.ok) return { status: "failed", message: "No attempts left for this quiz." };
    const correct = config.questions.filter((q, i) => q.hashes.includes(answerHash(config.salt, answers[i] as string))).length;
    if (correct >= config.passMark) return { status: "passed", message: `Passed (${correct}/${config.questions.length}).` };
    return {
      status: "failed",
      message: `${correct}/${config.questions.length} correct. ${attempt.left} ${attempt.left === 1 ? "attempt" : "attempts"} left.`,
    };
  },
};

// ───────────────────────────── secret word ─────────────────────────────

const secretStored = z.object({ salt: z.string().regex(/^[0-9a-f]{32}$/), hashes, hint: z.string().max(120).optional(), maxAttempts: attempts });
type SecretConfig = z.infer<typeof secretStored>;
const secretInput = z.object({ answers: z.array(z.string().min(1).max(100)).min(1).max(10), hint: z.string().max(120).optional(), maxAttempts: attempts });

export const secretWordTask: TaskType<SecretConfig> = {
  type: "secret_word",
  label: "Enter the secret word",
  trust: "answer",
  needsSubmission: true,
  recheckAtClaim: false,
  configSchema: secretStored,
  prepare(input) {
    const stored = secretStored.safeParse(input);
    if (stored.success) return stored.data;
    const s = secretInput.parse(input);
    const salt = newSalt();
    return { salt, hashes: s.answers.map((a) => answerHash(salt, a)), hint: s.hint, maxAttempts: s.maxAttempts };
  },
  publicConfig: (c) => ({ hint: c.hint, maxAttempts: c.maxAttempts }),
  async verify(config, ctx) {
    const answer = (ctx.submission as { answer?: unknown } | undefined)?.answer;
    if (typeof answer !== "string" || !answer.trim() || answer.length > 200) return { status: "failed", message: "Enter the word." };
    const key = `drops:attempts:${ctx.dropsContract.toLowerCase()}:${ctx.dropId}:${ctx.taskId}:${ctx.claimer.toLowerCase()}`;
    const attempt = await spendAttempt(ctx.kv, key, config.maxAttempts);
    if (!attempt.ok) return { status: "failed", message: "No attempts left." };
    return config.hashes.includes(answerHash(config.salt, answer))
      ? { status: "passed", message: "Correct." }
      : { status: "failed", message: `Not quite. ${attempt.left} ${attempt.left === 1 ? "attempt" : "attempts"} left.` };
  },
};
