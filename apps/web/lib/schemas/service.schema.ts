import { z } from "zod";

/**
 * Schema para validação de criação de serviço no frontend
 */
export const createServiceSchema = z.object({
  nome: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres")
    .trim(),
  descricao: z
    .string()
    .max(1000, "Descrição deve ter no máximo 1000 caracteres")
    .trim()
    .optional()
    .nullable(),
  preco: z
    .union([z.number().min(0, "Preço não pode ser negativo").max(999999.99, "Preço muito alto"), z.null(), z.undefined()])
    .optional()
    .nullable(),
  duracao_minutos: z
    .number()
    .int("Duração deve ser um número inteiro")
    .min(1, "Duração deve ser pelo menos 1 minuto")
    .max(1440, "Duração não pode exceder 24 horas (1440 minutos)"),
  image_url: z
    .string()
    .optional()
    .nullable()
    .or(z.literal("")), // Deprecated: usar images[] - aceita string vazia ou null
  images: z
    .array(z.string().url("URL de imagem inválida"))
    .optional()
    .nullable(),
  ativo: z.boolean().optional().default(true),
  available_online: z.boolean().optional().default(true),
  show_price_online: z.boolean().optional().default(true),
  fixed_price: z.boolean().optional().default(true),
  staff_ids: z.array(z.string()).optional().default([]),
});

/**
 * Schema para validação de atualização de serviço
 */
export const updateServiceSchema = createServiceSchema.partial();

/**
 * Schema para validação de importação de serviços
 */
export const importServicesSchema = z.object({
  services: z.array(createServiceSchema).min(1, "Deve haver pelo menos um serviço"),
});

/**
 * Tipo TypeScript derivado do schema de criação
 */
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/**
 * Tipo TypeScript derivado do schema de atualização
 */
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/**
 * Tipo TypeScript derivado do schema de importação
 */
export type ImportServicesInput = z.infer<typeof importServicesSchema>;

