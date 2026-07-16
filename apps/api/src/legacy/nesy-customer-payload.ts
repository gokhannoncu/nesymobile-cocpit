/**
 * BFF uzerinden ClientSaveShipment cagirilarak gonderilecek
 * musteri; frontend GetCustomerDetails sonrasinda alanlara gore doldurulur.
 */
export interface BffCustomerPayload {
  customerId: number;
  customerCenter: string;
  name: string;
  phone: string;
  gsm: string;
  email?: string | null;
  addressStreet: string;
  addressCity: string;
  addressZipCode: string;
  addressCountry: string;
  addressTitle?: string;
  /** Ornek: "Sokak ,posta ,sehir ,ulke" */
  addressText?: string;
  customerPreferences?: Record<string, unknown>;
}
