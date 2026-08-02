function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // Una data senza orario viene interpretata come giorno locale, evitando che
  // il fuso orario possa spostarla al giorno precedente.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatAppDate(value: string | Date): string {
  const date = toDate(value);
  if (!date) return "—";
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function formatAppDateTime(value: string | Date): string {
  const date = toDate(value);
  if (!date) return "—";
  return `${formatAppDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Inserisce automaticamente i trattini mentre l'utente digita GG-MM-AAAA.
export function normalizeAppDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

// Oracle continua a ricevere YYYY-MM-DD; il formato tecnico non viene mai
// mostrato all'utente.
export function appDateInputToIso(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad(month)}-${pad(day)}`;
}
