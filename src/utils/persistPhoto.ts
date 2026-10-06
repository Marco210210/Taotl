// Le URI native sono già file persistenti gestiti dall'app.
export async function persistPhoto(uri: string): Promise<string> {
  return uri;
}
