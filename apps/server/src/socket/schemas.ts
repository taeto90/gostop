import { z } from 'zod';

export const NicknameSchema = z.string().trim().min(1).max(20);
export const EmojiAvatarSchema = z.string().min(1).max(8);
export const UserIdSchema = z.string().min(8).max(64);
export const RoomIdSchema = z.string().length(6);

const PasswordSchema = z.string().trim().min(4).max(20);

export const RoomCreateSchema = z.object({
  userId: UserIdSchema,
  nickname: NicknameSchema,
  emojiAvatar: EmojiAvatarSchema,
  asSpectator: z.boolean(),
  password: PasswordSchema.optional(),
  mediaMode: z.enum(['video', 'voice-only']).optional(),
});

export const RoomJoinSchema = z.object({
  userId: UserIdSchema,
  roomId: RoomIdSchema,
  nickname: NicknameSchema,
  emojiAvatar: EmojiAvatarSchema,
  asSpectator: z.boolean(),
  password: PasswordSchema.optional(),
});

export const RoomRejoinSchema = z.object({
  userId: UserIdSchema,
  roomId: RoomIdSchema,
});

export const AssignGwangPaliSchema = z.object({
  targetUserId: UserIdSchema,
  assigned: z.boolean(),
});

export const TargetUserSchema = z.object({
  targetUserId: UserIdSchema,
});

export const ReorderPlayersSchema = z.object({
  playerIds: z.array(UserIdSchema).min(1).max(5),
});

export const UpdateRulesSchema = z.object({
  rules: z
    .object({
      winScore: z.union([z.literal(3), z.literal(5), z.literal(7)]).optional(),
      shakeBonusType: z.enum(['multiplier', 'addPoint']).optional(),
      bombStealCount: z.union([z.literal(1), z.literal(2)]).optional(),
      allowGukJoon: z.boolean().optional(),
      allowMyungttadak: z.boolean().optional(),
      turnTimeLimitSec: z
        .union([
          z.literal(0),
          z.literal(30),
          z.literal(40),
          z.literal(50),
          z.literal(60),
          z.literal(90),
        ])
        .optional(),
      jokerCount: z
        .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
        .optional(),
      mediaMode: z.enum(['video', 'voice-only']).optional(),
    })
    .strict(),
});

export const ChatSendSchema = z.object({
  text: z.string().trim().min(1).max(200),
});

export const Toggle9YeolSchema = z.object({
  value: z.boolean(),
});

const AiDifficultySchema = z.enum(['easy', 'medium', 'hard']);

const PresetIdSchema = z.enum([
  'default',
  'jjok',
  'ddak',
  'ppeok',
  'self-ppeok',
  'chongtong',
  'ssaktsseuli',
  'bomb',
  'shake',
  'nagari',
  'myungdda',
  'gukjoon',
  'pi-pak',
  'gwang-pak',
  'myung-pak',
  'last-turn-sweep',
  'joker-flip',
  'gwang-3',
  'gwang-3-bisam',
  'gwang-4',
  'gwang-5',
  'hongdan',
  'cheongdan',
  'chodan',
  'godori',
  'nine-yeol-toggle',
  'case2-just-eat',
  'case4-pick-modal',
  'case4-double',
  'go-stop',
  'gobak',
]);

export const SetTestPresetSchema = z.object({
  preset: PresetIdSchema,
});

export const GameStartSchema = z.object({
  // 호스트가 명시한 봇 난이도 — length만큼 봇 합류. player + bot ≤ 5.
  botDifficulties: z.array(AiDifficultySchema).max(4).optional(),
  /** 테스트 모드 — preset 없으면 손패 1장 + 바닥 1장 (흐름 검증용) */
  testMode: z.boolean().optional(),
  /** 테스트 모드 preset (testMode일 때만 적용). 명시 카드 고정 분배 */
  testPreset: PresetIdSchema.optional(),
});

export const AddBotsSchema = z.object({
  botDifficulties: z.array(AiDifficultySchema).max(4),
});

export const GameActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('play-card'),
    cardId: z.string(),
    targetAfterHand: z.string().optional(),
    targetAfterDraw: z.string().optional(),
    declineBomb: z.boolean().optional(),
  }),
  z.object({ type: z.literal('choose-flip'), chosenCardId: z.string() }),
  z.object({ type: z.literal('declare-go') }),
  z.object({ type: z.literal('declare-stop') }),
  z.object({
    type: z.literal('shake'),
    month: z.number().int().min(1).max(12),
  }),
  z.object({ type: z.literal('bomb'), cardIds: z.array(z.string()) }),
]);
