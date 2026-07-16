import { z } from 'zod'

export const nesyCountrySchema = z.enum(['HR', 'SI', 'RS', 'BA', 'ME', 'AZ'])
export const nesyEnvironmentSchema = z.enum(['stage', 'prod'])

export const nesyLoginBodySchema = z.object({
  country: nesyCountrySchema,
  environment: nesyEnvironmentSchema,
})

export const nesyLoginResponseSchema = z.object({
  message: z.string(),
  country: nesyCountrySchema,
  environment: nesyEnvironmentSchema,
  result: z.unknown(),
})

export const nesyEnvironmentEntrySchema = z.object({
  apiUrl: z.string(),
  dashboardUrl: z.string(),
  configured: z.boolean(),
  loginEndpoint: z.string(),
})

export const nesyMobileEnvironmentEntrySchema = z.object({
  apiUrl: z.string(),
  applicationId: z.string(),
  selectable: z.boolean(),
})

export const nesyEnvironmentsResponseSchema = z.object({
  dashboard: z.record(z.string(), z.record(z.string(), nesyEnvironmentEntrySchema)),
  mobile: z.record(z.string(), z.record(z.string(), nesyMobileEnvironmentEntrySchema)),
})
