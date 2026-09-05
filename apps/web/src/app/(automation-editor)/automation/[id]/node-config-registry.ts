import { z } from "zod";
import {
  NESY_MOBILE_COUNTRIES,
  NESY_MOBILE_ENVIRONMENTS,
  type NesyMobileCountry,
  type NesyMobileEnvironment,
} from "@/services/nesy-mobile-env";

export const DEFAULT_LOGIN_BUTTON_ID = "com.arasdigital.nesymobile:id/btn_login";
export const DEFAULT_LAUNCH_APP_COUNTRY: NesyMobileCountry = "HR";
export const DEFAULT_LAUNCH_APP_ENVIRONMENT: NesyMobileEnvironment = "stage";

const LEGACY_COMBINED_ENVIRONMENT = {
  HR_STAGE: { country: "HR", environment: "stage" },
  HR_PROD: { country: "HR", environment: "prod" },
  SI_STAGE: { country: "SI", environment: "stage" },
  SI_PROD: { country: "SI", environment: "prod" },
  RS_STAGE: { country: "RS", environment: "stage" },
  RS_PROD: { country: "RS", environment: "prod" },
  BA_STAGE: { country: "BA", environment: "stage" },
  BA_PROD: { country: "BA", environment: "prod" },
  ME_STAGE: { country: "ME", environment: "stage" },
  ME_PROD: { country: "ME", environment: "prod" },
} as const satisfies Record<string, { country: NesyMobileCountry; environment: NesyMobileEnvironment }>;

export const LaunchAppCountryOptions = NESY_MOBILE_COUNTRIES.map((country) => ({
  label: country,
  value: country,
}));

export const LaunchAppEnvironmentOptions = [
  { label: "Stage", value: "stage" as const },
  { label: "Prod", value: "prod" as const },
] satisfies ReadonlyArray<{ label: string; value: NesyMobileEnvironment }>;

export const LaunchAppSchema = z.object({
  country: z.enum(NESY_MOBILE_COUNTRIES as [NesyMobileCountry, ...NesyMobileCountry[]]).default(
    DEFAULT_LAUNCH_APP_COUNTRY,
  ),
  environment: z
    .enum(NESY_MOBILE_ENVIRONMENTS as [NesyMobileEnvironment, ...NesyMobileEnvironment[]])
    .default(DEFAULT_LAUNCH_APP_ENVIRONMENT),
  clearState: z.boolean().default(false),
});
export type LaunchAppParams = z.infer<typeof LaunchAppSchema>;

export const AuthLoginSchema = z.object({
  pinCode: z
    .string()
    .length(4, "PIN code must be exactly 4 digits.")
    .regex(/^\d{4}$/, "PIN code must consist of digits only."),
});
export type AuthLoginParams = z.infer<typeof AuthLoginSchema>;

export const IfLoginSchema = z.object({
  loginButtonId: z.string().trim().min(1, "Login button ID is required.").default(DEFAULT_LOGIN_BUTTON_ID),
});
export type IfLoginParams = z.infer<typeof IfLoginSchema>;

export const CheckRouteSchema = z.object({
  expectedRoute: z.string().optional(),
});
export type CheckRouteParams = z.infer<typeof CheckRouteSchema>;

export const SelectRouteSchema = z.object({
  routeNumber: z.string().min(1, "Please enter a valid route number."),
});
export type SelectRouteParams = z.infer<typeof SelectRouteSchema>;

export const LoadToVehicleSchema = z.object({
  barcode: z.string().min(1, "Barcode number is required."),
});
export type LoadToVehicleParams = z.infer<typeof LoadToVehicleSchema>;

export const OpenShipmentSchema = z.object({
  barcode: z.string().min(1, "Tracking / barcode number is required."),
});
export type OpenShipmentParams = z.infer<typeof OpenShipmentSchema>;

export const OpenParcelSchema = z.object({
  trackingNumber: z.string().min(1, "Parcel tracking number is required."),
});
export type OpenParcelParams = z.infer<typeof OpenParcelSchema>;

export const DeliveryOperationSchema = z.object({
  barcode: z
    .string({ required_error: "Barcode is required.", invalid_type_error: "Barcode is required." })
    .min(1, "Barcode is required."),
  proofLookupId: z
    .string({ required_error: "Proof Lookup Id is required.", invalid_type_error: "Proof Lookup Id is required." })
    .min(1, "Proof Lookup Id is required."),
  personDelivered: z.string().optional(),
  waitBeforeDelivery: z.coerce.number().default(0),
});
export type DeliveryOperationParams = z.infer<typeof DeliveryOperationSchema>;

export const WaitSchema = z.object({
  timeout: z.coerce.number().default(5000),
});
export type WaitParams = z.infer<typeof WaitSchema>;

export const ScanBarcodeSchema = z.object({
  barcode: z.string().min(1, "Please enter the barcode number."),
});
export type ScanBarcodeParams = z.infer<typeof ScanBarcodeSchema>;

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function isLaunchAppCountry(value: unknown): value is NesyMobileCountry {
  return typeof value === "string" && NESY_MOBILE_COUNTRIES.includes(value as NesyMobileCountry);
}

function isLaunchAppEnvironment(value: unknown): value is NesyMobileEnvironment {
  return typeof value === "string" && NESY_MOBILE_ENVIRONMENTS.includes(value as NesyMobileEnvironment);
}

function parseLegacyCombinedEnvironment(
  value: unknown,
): Partial<Pick<LaunchAppParams, "country" | "environment">> | undefined {
  if (typeof value !== "string") return undefined;
  const mapped = LEGACY_COMBINED_ENVIRONMENT[value as keyof typeof LEGACY_COMBINED_ENVIRONMENT];
  if (mapped) return mapped;

  const normalized = value.trim().toLowerCase();
  if (normalized === "production" || normalized === "prod") {
    return { country: DEFAULT_LAUNCH_APP_COUNTRY, environment: "prod" };
  }
  if (normalized === "stage" || normalized === "staging" || normalized === "test" || normalized === "dev") {
    return { country: DEFAULT_LAUNCH_APP_COUNTRY, environment: "stage" };
  }
  return undefined;
}

export function coerceLaunchAppParams(input: unknown): Partial<LaunchAppParams> {
  const config = asRecord(input);
  const clearState =
    typeof config.clearState === "boolean"
      ? config.clearState
      : typeof config.clearData === "boolean"
        ? config.clearData
        : false;

  if (isLaunchAppCountry(config.country) && isLaunchAppEnvironment(config.environment)) {
    return { country: config.country, environment: config.environment, clearState };
  }

  const fromCombined =
    parseLegacyCombinedEnvironment(config.environment) ??
    parseLegacyCombinedEnvironment(config.targetEnvironment);

  return {
    country: isLaunchAppCountry(config.country)
      ? config.country
      : (fromCombined?.country ?? DEFAULT_LAUNCH_APP_COUNTRY),
    environment: fromCombined?.environment ?? DEFAULT_LAUNCH_APP_ENVIRONMENT,
    clearState,
  };
}

export function coerceAuthLoginParams(input: unknown): Partial<AuthLoginParams> {
  const config = asRecord(input);
  return { pinCode: typeof config.pinCode === "string" ? config.pinCode : "" };
}

export function coerceIfLoginParams(input: unknown): Partial<IfLoginParams> {
  const config = asRecord(input);
  return {
    loginButtonId: typeof config.loginButtonId === "string" ? config.loginButtonId : DEFAULT_LOGIN_BUTTON_ID,
  };
}

export function coerceCheckRouteParams(input: unknown): Partial<CheckRouteParams> {
  const config = asRecord(input);
  return { expectedRoute: typeof config.expectedRoute === "string" ? config.expectedRoute : undefined };
}

export function coerceSelectRouteParams(input: unknown): Partial<SelectRouteParams> {
  const config = asRecord(input);
  const raw = config.routeNumber ?? config.route;
  return { routeNumber: typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "" };
}

export function coerceLoadToVehicleParams(input: unknown): Partial<LoadToVehicleParams> {
  const config = asRecord(input);
  return { barcode: typeof config.barcode === "string" ? config.barcode : "" };
}

export function coerceOpenShipmentParams(input: unknown): Partial<OpenShipmentParams> {
  const config = asRecord(input);
  const raw = config.barcode ?? config.trackingNumber;
  return { barcode: typeof raw === "string" ? raw : "" };
}

export function coerceOpenParcelParams(input: unknown): Partial<OpenParcelParams> {
  const config = asRecord(input);
  return { trackingNumber: typeof config.trackingNumber === "string" ? config.trackingNumber : "" };
}

export function parseDeliveryOperationParams(input: unknown): DeliveryOperationParams {
  return DeliveryOperationSchema.parse(asRecord(input));
}

export function parseWaitParams(input: unknown): WaitParams {
  return WaitSchema.parse(asRecord(input));
}

export function parseScanBarcodeParams(input: unknown): ScanBarcodeParams {
  return ScanBarcodeSchema.parse(asRecord(input));
}
