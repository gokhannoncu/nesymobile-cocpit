import { API_BASE } from "@/services/api";

export interface SavedMobileDevice {
  id: string;
  deviceId: string;
  adbDeviceId: string | null;
  modelName: string;
  product: string | null;
  transportId: string | null;
  label: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveMobileDevicePayload {
  deviceId: string;
  adbDeviceId?: string;
  modelName?: string;
  product?: string;
  transportId?: string;
  label?: string;
}

export class MobileDeviceAlreadySavedError extends Error {
  constructor(message = "This device ID is already saved.") {
    super(message);
    this.name = "MobileDeviceAlreadySavedError";
  }
}

export async function saveMobileDevice(
  payload: SaveMobileDevicePayload
): Promise<SavedMobileDevice> {
  const response = await fetch(`${API_BASE}/mobile-devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 409) {
      throw new MobileDeviceAlreadySavedError(
        (json as { message?: string }).message
      );
    }
    throw new Error((json as { message?: string }).message ?? "Mobile device could not be saved.");
  }
  return (json as { data: SavedMobileDevice }).data;
}

export async function fetchMobileDevices(): Promise<SavedMobileDevice[]> {
  const response = await fetch(`${API_BASE}/mobile-devices`);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((json as { message?: string }).message ?? "Mobile devices could not be fetched.");
  }
  return (json as { data: SavedMobileDevice[] }).data;
}
