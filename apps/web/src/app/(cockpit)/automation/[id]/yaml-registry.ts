import { z } from "zod";
import {
  NESY_MOBILE_COUNTRIES,
  NESY_MOBILE_ENVIRONMENTS,
  type NesyMobileCountry,
  type NesyMobileEnvironment,
  resolveNesyMobileApplicationId,
} from "@/services/nesy-mobile-env";

export const DEFAULT_LOGIN_BUTTON_ID = "com.arasdigital.nesymobile:id/btn_login";
export const DEFAULT_PIN_VIEW_ID = "com.arasdigital.nesymobile:id/pinView";

export const DEFAULT_LAUNCH_APP_COUNTRY: NesyMobileCountry = "HR";
export const DEFAULT_LAUNCH_APP_ENVIRONMENT: NesyMobileEnvironment = "stage";

/** @deprecated Legacy combined keys kept for migration only. */
export const AppEnvironmentMapping = {
  HR_STAGE: "com.arasdigital.nesymobile.test",
  HR_PROD: "com.arasdigital.nesymobileprod",
  SI_STAGE: "com.arasdigital.nesymobile.sitest",
  SI_PROD: "com.arasdigital.nesymobileprod.si",
  RS_STAGE: "com.arasdigital.nesymobile.rstest",
  RS_PROD: "com.arasdigital.nesymobileprod.rs",
  BA_STAGE: "com.arasdigital.nesymobile.batest",
  BA_PROD: "com.arasdigital.nesymobileprod.ba",
  ME_STAGE: "com.arasdigital.nesymobile.metest",
  ME_PROD: "com.arasdigital.nesymobileprod.me",
} as const;

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
    .regex(/^\d{4}$/, "PIN code must consist of digits only.")
    .describe("Courier Login PIN Code"),
});

export type AuthLoginParams = z.infer<typeof AuthLoginSchema>;

export const IfLoginSchema = z.object({
  loginButtonId: z.string().trim().min(1, "Login button ID is required.").default(DEFAULT_LOGIN_BUTTON_ID),
});

export type IfLoginParams = z.infer<typeof IfLoginSchema>;

export const DEFAULT_ROUTE_SPINNER_ID = "com.arasdigital.nesymobile:id/dialog_spinner";
export const DEFAULT_ROUTE_OK_BUTTON_ID = "com.arasdigital.nesymobile:id/yesButton";

export const CheckRouteSchema = z.object({
  expectedRoute: z.string().optional().describe("Specific route to check (Optional)"),
});

export type CheckRouteParams = z.infer<typeof CheckRouteSchema>;

export const DEFAULT_MANUEL_INPUT_ID = "com.arasdigital.nesymobile:id/manuel_input";
export const DEFAULT_BARCODE_INPUT_ID = "com.arasdigital.nesymobile:id/et_input_dialog_barcode_number";
export const DEFAULT_BARCODE_OK_BUTTON_ID = "com.arasdigital.nesymobile:id/btn_ok";

export const DEFAULT_DIALOG_TITLE_ID = "com.arasdigital.nesymobile:id/tv_arasDg_title";
export const DEFAULT_DIALOG_MESSAGE_ID = "com.arasdigital.nesymobile:id/tv_arasDg_message";
export const DEFAULT_DIALOG_POSITIVE_BUTTON_ID = "com.arasdigital.nesymobile:id/btn_arasDg_positive_button";
export const DEFAULT_DIALOG_NEGATIVE_BUTTON_ID = "com.arasdigital.nesymobile:id/btn_arasDg_negative_button";

export type DialogSeverity = "info" | "warning" | "error";

export interface DialogStrategy {
  /** Maestro'nun basacağı butonun text'i */
  action: "OK" | "Cancel";
  /** Dialog kapandıktan sonra akış devam eder mi? */
  flowContinues: boolean;
  /** React Flow UI'da kullanıcıya gösterilecek uyarı seviyesi */
  severity: DialogSeverity;
}

export const DIALOG_STRATEGY: Record<string, DialogStrategy> = {
  HUB_WARNING: {
    action: "OK",
    flowContinues: true,
    severity: "warning",
  },
  DELY_DELR_STOR_LOST: {
    action: "Cancel",
    flowContinues: false,
    severity: "error",
  },
  NETWORK_ERROR: {
    action: "OK",
    flowContinues: false,
    severity: "error",
  },
  GENERIC_ERROR: {
    action: "OK",
    flowContinues: false,
    severity: "error",
  },
};

export const LoadToVehicleSchema = z.object({
  barcode: z
    .string()
    .min(1, "Barcode number is required.")
    .describe("Manual barcode number of the shipment to be loaded (scanned)"),
});

export type LoadToVehicleParams = z.infer<typeof LoadToVehicleSchema>;

export const DEFAULT_SEARCH_TEXT_ID = "com.arasdigital.nesymobile:id/tietSearchText";
export const DEFAULT_SEARCH_BUTTON_ID = "com.arasdigital.nesymobile:id/search_button";
export const DEFAULT_CLOSE_SEARCH_ID = "com.arasdigital.nesymobile:id/close_search";
export const DEFAULT_SEARCH_FAB_ID = "com.arasdigital.nesymobile:id/close_search_bar";
export const DEFAULT_STOP_CARD_ID = "com.arasdigital.nesymobile:id/stopCard";

export const OpenShipmentSchema = z.object({
  barcode: z
    .string()
    .min(1, "Tracking / barcode number is required.")
    .describe("Shipment barcode number to search (waybill / tracking no)"),
});

export type OpenShipmentParams = z.infer<typeof OpenShipmentSchema>;

export const OpenParcelSchema = z.object({
  trackingNumber: z
    .string()
    .min(1, "Parcel tracking number is required.")
    .describe("Parcel tracking number to search"),
});

export type OpenParcelParams = z.infer<typeof OpenParcelSchema>;

export const SelectRouteSchema = z.object({
  routeNumber: z
    .string()
    .min(1, "Please enter a valid route number.")
    .describe("Route to select (e.g. '01' or 'Route 1')"),
});

export type SelectRouteParams = z.infer<typeof SelectRouteSchema>;

export const RequestTourStartSchema = z.object({});

export type RequestTourStartParams = z.infer<typeof RequestTourStartSchema>;

export function parseRequestTourStartParams(input: unknown): RequestTourStartParams {
  return RequestTourStartSchema.parse(asRecord(input));
}

export const DeliveryOperationSchema = z.object({
  personDelivered: z.string().optional().describe("Name of the person delivered to"),
  waitBeforeDelivery: z.coerce.number().default(0).describe("Waiting time before delivery (ms)"),
});

export type DeliveryOperationParams = z.infer<typeof DeliveryOperationSchema>;

export function parseDeliveryOperationParams(input: unknown): DeliveryOperationParams {
  return DeliveryOperationSchema.parse(asRecord(input));
}

export const WaitSchema = z.object({
  timeout: z.coerce.number().default(5000).describe("Waiting time (ms)"),
});

export type WaitParams = z.infer<typeof WaitSchema>;

export function parseWaitParams(input: unknown): WaitParams {
  return WaitSchema.parse(asRecord(input));
}

export const ScanBarcodeSchema = z.object({
  barcode: z.string().min(1, "Please enter the barcode number.").describe("Barcode to be scanned via manual input"),
});

export type ScanBarcodeParams = z.infer<typeof ScanBarcodeSchema>;

export function parseScanBarcodeParams(input: unknown): ScanBarcodeParams {
  return ScanBarcodeSchema.parse(asRecord(input));
}

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

  if (value in AppEnvironmentMapping) {
    const [country, tier] = value.split("_") as [NesyMobileCountry, "STAGE" | "PROD"];
    if (!isLaunchAppCountry(country)) return undefined;
    return { country, environment: tier === "STAGE" ? "stage" : "prod" };
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "production" || normalized === "prod") {
    return { country: DEFAULT_LAUNCH_APP_COUNTRY, environment: "prod" };
  }
  if (normalized === "stage" || normalized === "staging" || normalized === "test" || normalized === "dev") {
    return { country: DEFAULT_LAUNCH_APP_COUNTRY, environment: "stage" };
  }

  return undefined;
}

export function resolveLaunchAppApplicationId(params: Pick<LaunchAppParams, "country" | "environment">) {
  return resolveNesyMobileApplicationId(params.country, params.environment);
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

export function parseLaunchAppParams(input: unknown): LaunchAppParams {
  return LaunchAppSchema.parse(coerceLaunchAppParams(input));
}

export function coerceAuthLoginParams(input: unknown): Partial<AuthLoginParams> {
  const config = asRecord(input);
  return {
    pinCode: typeof config.pinCode === "string" ? config.pinCode : "",
  };
}

export function parseAuthLoginParams(input: unknown): AuthLoginParams {
  return AuthLoginSchema.parse(coerceAuthLoginParams(input));
}

export function coerceIfLoginParams(input: unknown): Partial<IfLoginParams> {
  const config = asRecord(input);
  return {
    loginButtonId: typeof config.loginButtonId === "string" ? config.loginButtonId : DEFAULT_LOGIN_BUTTON_ID,
  };
}

export function parseIfLoginParams(input: unknown): IfLoginParams {
  return IfLoginSchema.parse(coerceIfLoginParams(input));
}

export function coerceCheckRouteParams(input: unknown): Partial<CheckRouteParams> {
  const config = asRecord(input);
  return {
    expectedRoute: typeof config.expectedRoute === "string" ? config.expectedRoute : undefined,
  };
}

export function parseCheckRouteParams(input: unknown): CheckRouteParams {
  return CheckRouteSchema.parse(coerceCheckRouteParams(input));
}

export function coerceSelectRouteParams(input: unknown): Partial<SelectRouteParams> {
  const config = asRecord(input);
  const raw = config.routeNumber ?? config.route;
  return {
    routeNumber: typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "",
  };
}

export function parseSelectRouteParams(input: unknown): SelectRouteParams {
  return SelectRouteSchema.parse(coerceSelectRouteParams(input));
}

export function coerceLoadToVehicleParams(input: unknown): Partial<LoadToVehicleParams> {
  const config = asRecord(input);
  return {
    barcode: typeof config.barcode === "string" ? config.barcode : "",
  };
}

export function parseLoadToVehicleParams(input: unknown): LoadToVehicleParams {
  return LoadToVehicleSchema.parse(coerceLoadToVehicleParams(input));
}

export function coerceOpenShipmentParams(input: unknown): Partial<OpenShipmentParams> {
  const config = asRecord(input);
  const raw = config.barcode ?? config.trackingNumber;
  return {
    barcode: typeof raw === "string" ? raw : "",
  };
}

export function parseOpenShipmentParams(input: unknown): OpenShipmentParams {
  return OpenShipmentSchema.parse(coerceOpenShipmentParams(input));
}

export function coerceOpenParcelParams(input: unknown): Partial<OpenParcelParams> {
  const config = asRecord(input);
  return {
    trackingNumber: typeof config.trackingNumber === "string" ? config.trackingNumber : "",
  };
}

export function parseOpenParcelParams(input: unknown): OpenParcelParams {
  return OpenParcelSchema.parse(coerceOpenParcelParams(input));
}

export const AUTH_LOGIN = (params: AuthLoginParams, appId?: string): string => {
  const pinId = appId ? `${appId}:id/pinView` : DEFAULT_PIN_VIEW_ID;
  const loginId = appId ? `${appId}:id/btn_login` : DEFAULT_LOGIN_BUTTON_ID;
  return `
# --- Courier PIN Login Flow ---
- tapOn:
    id: "${pinId}"
- inputText: "${params.pinCode}"
- tapOn:
    id: "${loginId}"
`;
};

export const IF_LOGIN = (
  _config: IfLoginParams,
  trueBranchYaml: string,
  falseBranchYaml: string,
  _appId?: string,
): string => {
  void _appId;

  const indent = (yamlStr: string, spaces = 6) => {
    if (!yamlStr.trim()) return "";
    return yamlStr
      .trim()
      .split("\n")
      .map((line) => `${" ".repeat(spaces)}${line}`)
      .join("\n");
  };

  return `
# --- CONDITION: IF LOGIN (Logcat bridge driven) ---
# Runner waits for: ACTION: CHECK_LOGIN | DATA: {"is_logged_in":"true|false"}
- evalScript: \${console.log("AWAIT_BRIDGE::CHECK_LOGIN")}

# FALSE BRANCH (CHECK_LOGIN is_logged_in=false -> perform login)
${indent(falseBranchYaml, 0) || '- evalScript: ${console.log("If Login: Login branch is empty")}'}

# Runner waits after login branch for: ACTION: LOGIN_STATUS | DATA: {"login_success":"true"}
- evalScript: \${console.log("AWAIT_BRIDGE::LOGIN_STATUS")}

# TRUE / CONVERGENCE BRANCH (CHECK_LOGIN is_logged_in=true -> continue)
${trueBranchYaml.trim() ? trueBranchYaml : `- evalScript: \${console.log("If Login: Continuing to convergence")}`}
`;
};

export const LAUNCH_APP = (params: LaunchAppParams): string => {
  const resolvedAppId = resolveLaunchAppApplicationId(params);

  return `
# --- START APPLICATION STEP ---
- launchApp:
    appId: "${resolvedAppId}"
    clearState: ${params.clearState ? "true" : "false"}
- waitForAnimationToEnd
`;
};

export const SELECT_ROUTE = (params: SelectRouteParams, appId?: string): string => {
  const spinnerId = appId ? `${appId}:id/dialog_spinner` : DEFAULT_ROUTE_SPINNER_ID;
  const okButtonId = appId ? `${appId}:id/yesButton` : DEFAULT_ROUTE_OK_BUTTON_ID;
  return `
# --- ROUTE SELECTION ---
- tapOn:
    id: "${spinnerId}"
- scrollUntilVisible:
    element:
      text: "${params.routeNumber}"
    direction: DOWN
- tapOn: "${params.routeNumber}"
- tapOn:
    id: "${okButtonId}"
`;
};

export const CHECK_ROUTE = (
  _config: CheckRouteParams,
  trueBranchYaml: string,
  falseBranchYaml: string,
  _appId?: string,
): string => {
  void _appId;

  const indentLines = (yamlStr: string, spaces = 6) => {
    if (!yamlStr.trim()) return "";
    return yamlStr
      .trim()
      .split("\n")
      .map((line) => `${" ".repeat(spaces)}${line}`)
      .join("\n");
  };

  return `
# --- CONDITION: CHECK ROUTE (Logcat bridge driven) ---
# Runner waits for: ACTION: CHECK_ROUTE | DATA: {"route_required":"true|false"}
- evalScript: \${console.log("AWAIT_BRIDGE::CHECK_ROUTE")}

# FALSE BRANCH (CHECK_ROUTE route_required=true -> select route first)
${indentLines(falseBranchYaml, 0) || `- evalScript: \${console.log("Check Route: Route selection branch is empty")}`}

# Runner waits after route branch for: ACTION: ROUTE_STATUS | DATA: {"route_selected":"true"}
- evalScript: \${console.log("AWAIT_BRIDGE::ROUTE_STATUS")}

# CONVERGENCE (Steps running after both branches)
${trueBranchYaml.trim() ? trueBranchYaml : `- evalScript: \${console.log("Check Route: Convergence point, continuing")}`}
`;
};

export const VALIDATE_STOPLIST = (): string => `
# --- AUTOMATION BRIDGE: VALIDATE_STOPLIST ---
# Maestro signals the studio to "Wait for VALIDATE_STOPLIST log here".
# Logcat sniffer catches the VALIDATE_STOPLIST event from the app and updates the step status.
- evalScript: \${console.log("AWAIT_BRIDGE::VALIDATE_STOPLIST")}
- waitForAnimationToEnd
`;

export const REQUEST_TOUR_START = (params: RequestTourStartParams, appId: string): string => `
# --- REQUEST TOUR START FLOW ---

# 1. Press Start Tour (btn_out) Button
- tapOn:
    id: "${appId}:id/btn_out"

# 2. (Optional) If Multicolli Warning Dialog (ArasDialog) appears, select "Continue"
- runFlow:
    when:
      visible:
        id: "${appId}:id/btn_arasDg_positive_button"
    commands:
      - tapOn:
          id: "${appId}:id/btn_arasDg_positive_button"

# 3. (Optional) If Exit Request (Auto/Manual Route) Dialog appears, select "Auto Route"
- runFlow:
    when:
      visible:
        id: "${appId}:id/auto_route"
    commands:
      - tapOn:
          id: "${appId}:id/auto_route"

# 4. Wait for Backend Request Result
- evalScript: \${console.log("AWAIT_BRIDGE::REQUEST_TOUR_START")}
`;

export const SCAN_BARCODE = (params: ScanBarcodeParams, appId: string): string => {
  const manuelInputId = `${appId}:id/manuel_input`;
  const barcodeInputId = `${appId}:id/et_input_dialog_barcode_number`;
  const btnOkId = `${appId}:id/btn_ok`;

  return `
# --- SCAN BARCODE ON TASK LIST (Manual Input Dialog) ---
# 1. Press manual input icon in toolbar
- tapOn:
    id: "${manuelInputId}"
# 2. Wait for dialog to open
- extendedWaitUntil:
    visible:
      id: "${barcodeInputId}"
    timeout: 5000
# 3. Click barcode input field and write barcode
- tapOn:
    id: "${barcodeInputId}"
- inputText: "${params.barcode}"
# 4. Press OK button -> processBarcodeTransaction -> navigate to DeliveryFragment
- tapOn:
    id: "${btnOkId}"
# 5. Bridge log: SCAN_PARCEL | SUCCESS
- evalScript: \${console.log("AWAIT_BRIDGE::SCAN_PARCEL")}
`;
};

export const DELIVER_PARCEL = (params: DeliveryOperationParams, appId: string): string => {
  const deliveryNameId = `${appId}:id/tie_delivery_name`;
  const signaturePadId = `${appId}:id/signature_pad_rl`;
  const btnDeliverId = `${appId}:id/btn_deliver`;
  const btnDelyId = `${appId}:id/btnDely`;
  const dialogPositiveId = `${appId}:id/btn_arasDg_positive_button`;

  let yaml = `
# --- DELIVER PARCEL FLOW ---
# 1. Wait for a top-level field to ensure screen is loaded
- extendedWaitUntil:
    visible:
      id: "${deliveryNameId}"
    timeout: 10000`;

  if (params.waitBeforeDelivery > 0) {
    yaml += `\n# Wait before delivery: ${params.waitBeforeDelivery}ms\n- swipe:\n    start: "50%, 50%"\n    end: "50%, 50%"\n    duration: ${params.waitBeforeDelivery}`;
  }

  const personName = params.personDelivered || "${TASK_PARTY}";
  yaml += `
# 2. Fill Person Delivered field and hide keyboard
- tapOn:
    id: "${deliveryNameId}"
- inputText: "${personName}"
- pressKey: Enter
- hideKeyboard`;



  yaml += `
# 3. Scroll down until Delivery button is visible
- scrollUntilVisible:
    element:
      id: "${btnDeliverId}"
    direction: DOWN
    timeout: 10000`;

  yaml += `
# 4. Draw signature (wider swipe)
- swipe:
    start: "30%, 75%"
    end: "70%, 75%"
    duration: 400`;

  yaml += `
# Wait for UI to settle before tapping delivery button
- evalScript: \${console.log("NESY_STEP::Wait for UI to settle")}
- swipe:
    start: "50%, 50%"
    end: "50%, 50%"
    duration: 1000`;

  yaml += `
# 5. Press Delivery button
- tapOn:
    id: "${btnDeliverId}"`;

  yaml += `
# --- DIALOG MANAGEMENT ---
# (Optional) DELY/DEPS
- runFlow:
    when:
      visible:
        id: "${btnDelyId}"
    commands:
      - tapOn:
          id: "${btnDelyId}"`;

  yaml += `
# (Optional) Are you sure?
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;

  yaml += `
# (Optional) Payment
- runFlow:
    when:
      visible:
        id: "${dialogPositiveId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"`;

  yaml += `
# 6. Verify local step completion
- evalScript: \${console.log("AWAIT_BRIDGE::DELIVER_PARCEL")}`;

  return yaml;
};

export const WAIT_NODE = (params: WaitParams): string => `
# --- WAIT: ${params.timeout}ms ---
- evalScript: \${console.log("NESY_WAIT::${params.timeout}")}
- swipe:
    start: "50%, 50%"
    end: "50%, 50%"
    duration: ${params.timeout}
`;

export const LOAD_TO_VEHICLE = (params: LoadToVehicleParams, appId?: string): string => {
  const manuelInputId = appId ? `${appId}:id/manuel_input` : DEFAULT_MANUEL_INPUT_ID;
  const barcodeInputId = appId ? `${appId}:id/et_input_dialog_barcode_number` : DEFAULT_BARCODE_INPUT_ID;
  const okButtonId = appId ? `${appId}:id/btn_ok` : DEFAULT_BARCODE_OK_BUTTON_ID;
  const dialogTitleId = appId ? `${appId}:id/tv_arasDg_title` : DEFAULT_DIALOG_TITLE_ID;
  const dialogPositiveId = appId ? `${appId}:id/btn_arasDg_positive_button` : DEFAULT_DIALOG_POSITIVE_BUTTON_ID;
  const dialogNegativeId = appId ? `${appId}:id/btn_arasDg_negative_button` : DEFAULT_DIALOG_NEGATIVE_BUTTON_ID;

  return `
# --- LOAD TO VEHICLE PROCESS ---
# 1. Click "Manual Barcode" (Pencil) icon on top right of Stop List screen
- tapOn:
    id: "${manuelInputId}"
# 2. Wait for the opened dialog to appear on screen and write the barcode in the input field
- extendedWaitUntil:
    visible:
      id: "${barcodeInputId}"
    timeout: 3000
- inputText: "${params.barcode}"
# 3. Confirm barcode (press OK button)
- tapOn:
    id: "${okButtonId}"

# ─── ScanProcessor Pipeline — Dialog Handling ───
# Once barcode is OK'd, ScanProcessor starts a 3-step pipeline:
#   FETCH_SHIPMENT → CREATE_TASK → FETCH_SCHEDULE
# In each step, ArasDialog may appear (HUB_WARNING, GENERIC_ERROR, NETWORK_ERROR, etc.)
# Studio tracks DIALOG_SHOWN/DIALOG_DISMISSED events from logcat.

# 4. FETCH_SHIPMENT stage — dialog may appear
- extendedWaitUntil:
    visible:
      id: "${dialogTitleId}"
    timeout: 5000
    optional: true
- runFlow:
    when:
      visible:
        id: "${dialogTitleId}"
    commands:
      # ArasDialog shown — dismiss by pressing positive button (OK)
      # HUB_WARNING → OK → flow continues
      # GENERIC_ERROR / NETWORK_ERROR → OK → flow stops (bridge tracks it)
      - tapOn:
          id: "${dialogPositiveId}"

# 5. CREATE_TASK stage — second dialog may appear
- extendedWaitUntil:
    visible:
      id: "${dialogTitleId}"
    timeout: 3000
    optional: true
- runFlow:
    when:
      visible:
        id: "${dialogTitleId}"
    commands:
      - tapOn:
          id: "${dialogPositiveId}"

# 6. Automation Bridge Waiting
# Studio determines final status by listening to FETCH_SHIPMENT, CREATE_TASK, FETCH_SCHEDULE results
# and DIALOG_SHOWN/DIALOG_DISMISSED events via logcat.
- evalScript: \${console.log("AWAIT_BRIDGE::LOAD_TO_VEHICLE")}
`;
};

export const OPEN_SHIPMENT = (params: OpenShipmentParams, appId?: string): string => {
  const searchFabId = appId ? `${appId}:id/close_search_bar` : DEFAULT_SEARCH_FAB_ID;
  const searchTextId = appId ? `${appId}:id/tietSearchText` : DEFAULT_SEARCH_TEXT_ID;
  const searchButtonId = appId ? `${appId}:id/search_button` : DEFAULT_SEARCH_BUTTON_ID;
  const stopCardId = appId ? `${appId}:id/stopCard` : DEFAULT_STOP_CARD_ID;

  return `
# --- SHIPMENT SEARCH & OPEN ---
# 1. Press Search FAB -> search bar opens (default visibility=gone)
- tapOn:
    id: "${searchFabId}"
# 2. Wait for search bar to open
- extendedWaitUntil:
    visible:
      id: "${searchTextId}"
    timeout: 3000
# 3. Write barcode in search input
- tapOn:
    id: "${searchTextId}"
- eraseText: 50
- inputText: "${params.barcode}"
# 4. Press search button (orange 🔍)
- tapOn:
    id: "${searchButtonId}"
# 5. Wait for results to load (Bridge listens to SEARCH_STOP event)
- evalScript: \${console.log("AWAIT_BRIDGE::SEARCH_STOP")}
# 6. Click first result (first stop card in RecyclerView)
- tapOn:
    index: 0
    id: "${stopCardId}"
`;
};

export const OPEN_PARCEL = (params: OpenParcelParams, appId?: string): string => {
  const searchFabId = appId ? `${appId}:id/close_search_bar` : DEFAULT_SEARCH_FAB_ID;
  const searchTextId = appId ? `${appId}:id/tietSearchText` : DEFAULT_SEARCH_TEXT_ID;
  const searchButtonId = appId ? `${appId}:id/search_button` : DEFAULT_SEARCH_BUTTON_ID;
  const stopCardId = appId ? `${appId}:id/stopCard` : DEFAULT_STOP_CARD_ID;

  return `
# --- PARCEL SEARCH & OPEN ---
# 1. Press Search FAB -> search bar opens
- tapOn:
    id: "${searchFabId}"
# 2. Wait for search bar to open
- extendedWaitUntil:
    visible:
      id: "${searchTextId}"
    timeout: 3000
# 3. Write tracking number in search input
- tapOn:
    id: "${searchTextId}"
- eraseText: 50
- inputText: "${params.trackingNumber}"
# 4. Press search button
- tapOn:
    id: "${searchButtonId}"
# 5. Wait for results to load
- evalScript: \${console.log("AWAIT_BRIDGE::SEARCH_STOP")}
# 6. Click first result
- tapOn:
    index: 0
    id: "${stopCardId}"
`;
};

export const Registry = {
  LAUNCH_APP,
  IF_LOGIN,
  AUTH_LOGIN,
  SELECT_ROUTE,
  CHECK_ROUTE,
  VALIDATE_STOPLIST,
  LOAD_TO_VEHICLE,
  OPEN_SHIPMENT,
  OPEN_PARCEL,
  REQUEST_TOUR_START,
  SCAN_BARCODE,
  DELIVER_PARCEL,
  WAIT_NODE,
} as const;
