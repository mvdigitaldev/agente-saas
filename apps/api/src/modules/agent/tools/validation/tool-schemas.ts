import { z } from 'zod';

// UUID validation helper
const uuidSchema = z.string().uuid('Deve ser um UUID válido');

// ISO date validation (YYYY-MM-DD)
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Deve estar no formato YYYY-MM-DD');

// ISO datetime validation (ISO 8601)
const isoDateTimeSchema = z.string().datetime('Deve estar no formato ISO 8601 (ex: 2024-01-15T10:00:00Z)');

// Schemas para cada tool
export const toolSchemas = {
  get_available_slots: z.object({
    start_date: isoDateSchema,
    end_date: isoDateSchema.optional(),
    service_id: uuidSchema,
    staff_id: uuidSchema.optional(),
  }).refine(
    (data) => !data.end_date || data.end_date >= data.start_date,
    {
      message: 'end_date deve ser posterior ou igual a start_date',
      path: ['end_date'],
    }
  ),

  create_appointment: z.object({
    client_id: uuidSchema,
    service_id: uuidSchema,
    staff_id: uuidSchema,
    start_time: isoDateTimeSchema,
    end_time: isoDateTimeSchema,
    resource_id: uuidSchema.optional(),
    notes: z.string().optional(),
  }).refine(
    (data) => new Date(data.end_time) > new Date(data.start_time),
    {
      message: 'end_time deve ser posterior a start_time',
      path: ['end_time'],
    }
  ),

  reschedule_appointment: z.object({
    appointment_id: uuidSchema,
    start_time: isoDateTimeSchema,
    end_time: isoDateTimeSchema,
  }).refine(
    (data) => new Date(data.end_time) > new Date(data.start_time),
    {
      message: 'end_time deve ser posterior a start_time',
      path: ['end_time'],
    }
  ),

  cancel_appointment: z.object({
    appointment_id: uuidSchema,
  }),

  list_appointments: z.object({
    client_id: uuidSchema.optional(),
    status: z.enum(['scheduled', 'confirmed', 'cancelled', 'completed']).optional(),
    start_date: isoDateSchema.optional(),
    end_date: isoDateSchema.optional(),
  }),

  list_services: z.object({
    active_only: z.boolean().optional(),
  }),

  list_staff: z.object({
    active_only: z.boolean().optional(),
  }),

  get_client_info: z.object({
    client_id: uuidSchema.optional(),
  }),

  request_human_handoff: z.object({
    reason: z.string().optional(),
  }),

  send_media: z.object({
    media_url: z.string().url('Deve ser uma URL válida'),
    caption: z.string().optional(),
  }),
};

export type ToolSchemaName = keyof typeof toolSchemas;

