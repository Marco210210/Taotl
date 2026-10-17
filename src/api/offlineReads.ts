// Expo Go continua a usare il proprio comportamento corrente.
export function offlineRead<T>(_token: string, _path: string, load: (timeoutMs?: number) => Promise<T>): Promise<T> {
  return load();
}
export async function clearOfflineReads(_token: string): Promise<void> {}
