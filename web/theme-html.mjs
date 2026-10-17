// Expo aggiunge un theme-color statico anche quando il template ne contiene
// già uno. Mantieni quello del template aggiornato prima del primo disegno.
export function normalizeThemeMetadata(html) {
  let found = false;
  return html.replace(/<meta\b[^>]*\bname=["']theme-color["'][^>]*>/gi, tag => {
    if (found) return "";
    found = true;
    return tag;
  });
}
