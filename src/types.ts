import { z } from 'zod'

export const inputSchema = z.object({
  issuerId: z.string().min(1),
  keyId: z.string().min(1),
  key: z.string().min(1),
  bundleId: z.string().min(1),
  version: z.string().min(1),
  buildNumber: z.string().min(1),
  timeout: z.string().default('1200'),
  interval: z.string().default('30')
})

export const configSchema = inputSchema.transform((input) => ({
  ...input,
  timeout: z
    .number()
    .min(60, 'Timeout must be at least 60 seconds')
    .max(1200, 'Timeout cannot exceed 1200 seconds')
    .parse(parseInt(input.timeout, 10)),
  interval: z
    .number()
    .min(10, 'Interval must be at least 10 seconds')
    .max(300, 'Interval cannot exceed 300 seconds')
    .parse(parseInt(input.interval, 10))
}))

export type ActionInput = z.infer<typeof inputSchema>
export type Config = z.infer<typeof configSchema>

export interface BuildInfo {
  id: string
  version: string
  buildNumber: string
  processingState: string
  uploadedDate?: string
}

export interface ActionOutput {
  buildId: string
  processingState: string
  version: string
  buildNumber: string
  elapsedTime: string
}
