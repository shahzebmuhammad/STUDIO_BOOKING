export type ClientRecord = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  sessions: number;
  initials: string;
  tone: string;
  emirate?: string;
  vatNumber?: string;
  notes?: string;
  photoId?: string;
};

export type PaymentRecord = {
  id: string;
  invoice: string;
  clientId: string;
  clientName: string;
  amount: number;
  method: "Cash" | "Card";
  status: "Paid" | "Unpaid" | "Partially paid" | "Refunded";
  createdAt: string;
  paymentLink?: string;
  receiptId?: string;
  receiptName?: string;
};

export const seedClients: ClientRecord[] = [
  { id: "CL-2081", name: "Sara Khalid", company: "The Founder’s Table", email: "sara@founderstable.ae", phone: "+971 50 482 1930", sessions: 12, initials: "SK", tone: "violet", emirate: "Dubai", vatNumber: "100581234500003", notes: "Prefers Studio A and a two-camera setup." },
  { id: "CL-2082", name: "Omar Al Nuaimi", company: "OAN Creative", email: "omar@oancreative.ae", phone: "+971 55 631 2804", sessions: 8, initials: "OA", tone: "blue", emirate: "Abu Dhabi", vatNumber: "100493827100003", notes: "Monthly brand podcast recording." },
  { id: "CL-2083", name: "Noura Creative", company: "Noura Creative FZ-LLC", email: "hello@nouracreative.ae", phone: "+971 52 118 7621", sessions: 6, initials: "NC", tone: "peach", emirate: "Dubai", notes: "Campaign voice-over and video work." },
  { id: "CL-2084", name: "Majid Fahad", company: "Independent creator", email: "majid@mfahad.me", phone: "+971 56 790 4432", sessions: 4, initials: "MF", tone: "mint", emirate: "Sharjah", notes: "Creator membership client." },
  { id: "CL-2085", name: "Layla Al Ansari", company: "Good Morning Gulf", email: "layla@gmgulf.ae", phone: "+971 50 904 2261", sessions: 11, initials: "LA", tone: "lilac", emirate: "Dubai", notes: "Weekly show production." },
];

const CLIENTS_KEY = "mpl-clients";
const PAYMENTS_KEY = "mpl-payments";

export function loadClients(): ClientRecord[] {
  if (typeof window === "undefined") return seedClients;
  try {
    const saved = JSON.parse(window.localStorage.getItem(CLIENTS_KEY) ?? "[]") as ClientRecord[];
    return [...saved, ...seedClients.filter((client) => !saved.some((item) => item.id === client.id))];
  } catch {
    window.localStorage.removeItem(CLIENTS_KEY);
    return seedClients;
  }
}

export function saveClients(records: ClientRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLIENTS_KEY, JSON.stringify(records));
}

export function loadPayments(): PaymentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(PAYMENTS_KEY) ?? "[]") as PaymentRecord[];
  } catch {
    window.localStorage.removeItem(PAYMENTS_KEY);
    return [];
  }
}

export function savePayments(records: PaymentRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAYMENTS_KEY, JSON.stringify(records));
}

const RECEIPTS_DB = "mpl-local-receipts";
const RECEIPTS_STORE = "receipts";
const MEDIA_STORE = "media";

function openReceiptDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RECEIPTS_DB, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(RECEIPTS_STORE)) request.result.createObjectStore(RECEIPTS_STORE);
      if (!request.result.objectStoreNames.contains(MEDIA_STORE)) request.result.createObjectStore(MEDIA_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open receipt storage."));
  });
}

export async function storeReceipt(file: File): Promise<string> {
  const database = await openReceiptDatabase();
  const id = crypto.randomUUID();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(RECEIPTS_STORE, "readwrite");
    transaction.objectStore(RECEIPTS_STORE).put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not store the receipt."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Receipt storage was cancelled."));
  });
  database.close();
  return id;
}

export async function openStoredReceipt(id: string): Promise<Blob> {
  const database = await openReceiptDatabase();
  const receipt = await new Promise<Blob>((resolve, reject) => {
    const request = database.transaction(RECEIPTS_STORE, "readonly").objectStore(RECEIPTS_STORE).get(id);
    request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error("Receipt file was not found."));
    request.onerror = () => reject(request.error ?? new Error("Could not read the receipt."));
  });
  database.close();
  return receipt;
}

export async function storeMedia(file: File): Promise<string> {
  const database = await openReceiptDatabase();
  const id = crypto.randomUUID();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE, "readwrite");
    transaction.objectStore(MEDIA_STORE).put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not store the image."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Image storage was cancelled."));
  });
  database.close();
  return id;
}

export async function openStoredMedia(id: string): Promise<Blob> {
  const database = await openReceiptDatabase();
  const media = await new Promise<Blob>((resolve, reject) => {
    const request = database.transaction(MEDIA_STORE, "readonly").objectStore(MEDIA_STORE).get(id);
    request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error("Image file was not found."));
    request.onerror = () => reject(request.error ?? new Error("Could not read the image."));
  });
  database.close();
  return media;
}
