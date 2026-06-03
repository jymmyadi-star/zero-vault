import { z } from 'zod';

export const passwordPayloadSchema = z.object({
  username: z.string().optional().default(''),
  password: z.string().min(1, 'Password is required'),
  url: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  totpSecret: z
    .string()
    .optional()
    .default('')
    .refine(
      (val) => !val || /^[A-Z2-7]+=*$/i.test(val.replace(/\s/g, '')),
      'TOTP secret must be a valid Base32 string',
    ),
  customFields: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string(),
        hidden: z.boolean().default(true),
      }),
    )
    .optional()
    .default([]),
});

export const seedPayloadSchema = z.object({
  walletName: z.string().optional().default(''),
  mnemonic: z.string().min(1, 'Seed phrase is required'),
  passphrase: z.string().optional().default(''),
  derivationPath: z.string().optional().default("m/44'/60'/0'/0/0"),
  notes: z.string().optional().default(''),
});

export const notePayloadSchema = z.object({
  content: z.string().min(1, 'Note content is required'),
});

export const vaultItemSchemas = {
  password: passwordPayloadSchema,
  seed_phrase: seedPayloadSchema,
  note: notePayloadSchema,
};

export type VaultItemType = 'password' | 'seed_phrase' | 'note';

export type PasswordPayload = z.infer<typeof passwordPayloadSchema>;
export type SeedPayload = z.infer<typeof seedPayloadSchema>;
export type NotePayload = z.infer<typeof notePayloadSchema>;
export type VaultPayload = PasswordPayload | SeedPayload | NotePayload;

export function getSchema(type: VaultItemType): z.ZodSchema {
  return vaultItemSchemas[type];
}

export function validatePayload(
  type: VaultItemType,
  data: unknown,
): { success: true; data: VaultPayload } | { success: false; error: string } {
  const schema = getSchema(type);
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as VaultPayload };
  }
  const firstIssue = result.error.issues[0];
  const field = firstIssue?.path.join('.') || 'payload';
  const message = firstIssue?.message || 'Invalid data';
  return { success: false, error: `${field}: ${message}` };
}
