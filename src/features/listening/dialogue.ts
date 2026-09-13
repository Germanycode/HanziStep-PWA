import { z } from 'zod';
import { db, type HanziStepDB } from '@/db/db';
import { getSettings } from '@/db/settings';
import type { TextDoc, Word } from '@/domain/types';
import { buildAllowedVocabulary, generatedQuestionSchema, storyCoverage, toQuestions } from '@/features/reading/story';
import { createText } from '@/features/reading/repository';
import { generateJson } from '@/services/ai/gemini';
import { dialoguePrompt, dialogueRules, DIALOGUE_SCHEMA, type DialogueRules } from '@/services/ai/prompts/dialogue';
import { coverageThreshold, retryPrompt } from '@/services/ai/prompts/story';
import { availableSources, searchImages } from '@/services/images/providers';
import { saveImage } from '@/services/images/store';

const dialogueSchema = z.object({
  titleZh: z.string().min(1),
  titleVi: z.string().min(1),
  turns: z
    .array(
      z.object({
        speaker: z.string().default('A'),
        zh: z.string().min(1),
        vi: z.string().default(''),
      }),
    )
    .min(2),
  questions: z.array(generatedQuestionSchema).default([]),
  imageSearchKeywordsEn: z.string().optional(),
});

export type Dialogue = z.infer<typeof dialogueSchema>;

function hanCount(value: string): number {
  return [...value].filter((character) => /\p{Script=Han}/u.test(character)).length;
}

export function validateDialogueRules(dialogue: Dialogue, rules: DialogueRules): Dialogue {
  if (dialogue.turns.length < rules.minTurns || dialogue.turns.length > rules.maxTurns) {
    throw new Error(`Hội thoại AI phải có ${rules.minTurns}–${rules.maxTurns} lượt.`);
  }
  if (dialogue.turns.some((turn) => hanCount(turn.zh) > rules.maxTurnChars)) {
    throw new Error(`Một lượt AI vượt quá ${rules.maxTurnChars} chữ Hán.`);
  }
  const speakers = new Set(dialogue.turns.map((turn) => normalizeSpeaker(turn.speaker, undefined)));
  if (speakers.size !== 2) throw new Error('Hội thoại AI phải có đúng hai người nói A và B.');
  return dialogue;
}

export function parseDialogue(raw: unknown, rules?: DialogueRules): Dialogue {
  const dialogue = dialogueSchema.parse(raw);
  return rules ? validateDialogueRules(dialogue, rules) : dialogue;
}

/** The model sometimes writes "甲/乙" or "A："; everything else becomes B after an A. */
export function normalizeSpeaker(value: string, previous: 'A' | 'B' | undefined): 'A' | 'B' {
  const cleaned = value.trim().toUpperCase();
  if (cleaned.startsWith('A') || cleaned.startsWith('甲')) return 'A';
  if (cleaned.startsWith('B') || cleaned.startsWith('乙')) return 'B';
  return previous === 'A' ? 'B' : 'A';
}

export function dialogueSentences(dialogue: Dialogue): TextDoc['sentences'] {
  let previous: 'A' | 'B' | undefined;
  return dialogue.turns.map((turn) => {
    const speaker = normalizeSpeaker(turn.speaker, previous);
    previous = speaker;
    return { zh: turn.zh, vi: turn.vi, speaker };
  });
}

export interface GenerateDialogueOptions {
  level: number;
  scene: string;
  micro?: boolean;
  signal?: AbortSignal;
  database?: HanziStepDB;
  targets?: readonly Word[];
}

export interface GeneratedDialogue {
  doc: TextDoc;
  coverage: number;
  outside: string[];
  retried: boolean;
}

/** Same closed word list and coverage check as the reading stories (docs/PLAN.md §8.3). */
export async function generateDialogue(options: GenerateDialogueOptions): Promise<GeneratedDialogue> {
  const database = options.database ?? db;
  const settings = await getSettings(database);
  const rules = dialogueRules(options.level, options.micro);
  const targets = options.targets ?? [];
  const { allowed, list, lexicon } = await buildAllowedVocabulary(settings.hskTrack, options.level, targets, database);

  const basePrompt = dialoguePrompt({ level: options.level, rules, scene: options.scene, allowed: list, micro: Boolean(options.micro) });
  const request = (prompt: string) =>
    generateJson<unknown>({
      apiKey: settings.geminiApiKey,
      model: settings.geminiTextModel,
      prompt,
      schema: DIALOGUE_SCHEMA,
      temperature: 0.6,
      signal: options.signal,
      timeoutMs: 45_000,
    }).then((raw) => parseDialogue(raw, rules));

  let dialogue = await request(basePrompt);
  let result = storyCoverage(
    dialogue.turns.map((turn) => turn.zh),
    lexicon,
    allowed,
  );
  let retried = false;

  if (result.coverage < coverageThreshold(options.level)) {
    retried = true;
    try {
      const second = await request(retryPrompt(basePrompt, result.outside));
      const secondResult = storyCoverage(
        second.turns.map((turn) => turn.zh),
        lexicon,
        allowed,
      );
      if (secondResult.coverage > result.coverage) {
        dialogue = second;
        result = secondResult;
      }
    } catch {
      // Keep the first dialogue; the unknown words stay marked in the transcript.
    }
  }

  const doc = await createText(
    {
      kind: 'ai-dialogue',
      title: dialogue.titleZh,
      titleVi: dialogue.titleVi,
      level: options.level,
      genre: options.scene,
      sentences: dialogueSentences(dialogue),
      questions: toQuestions(dialogue),
      coverage: Math.round(result.coverage * 100) / 100,
    },
    database,
  );

  if (dialogue.imageSearchKeywordsEn && availableSources(settings).length > 0) {
    try {
      const [picture] = await searchImages(settings, dialogue.imageSearchKeywordsEn, options.signal);
      if (picture) {
        await saveImage(doc.id, picture, settings, database);
        await database.texts.update(doc.id, { imageUrl: picture.pageUrl });
        doc.imageUrl = picture.pageUrl;
      }
    } catch {
      // An illustration is optional.
    }
  }

  return { doc, coverage: result.coverage, outside: result.outside, retried };
}
