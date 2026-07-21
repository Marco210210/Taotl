export function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
