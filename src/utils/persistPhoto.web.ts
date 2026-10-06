// I blob URL scadono al refresh. Memorizziamo miniature autonome e contenute
// nella cache locale, senza riempire localStorage con foto a piena risoluzione.
export async function persistPhoto(uri: string): Promise<string> {
  if (!uri.startsWith("blob:")) return uri;
  const image = new Image();
  image.src = uri;
  await image.decode();
  const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossibile preparare la foto. Riprova.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}
