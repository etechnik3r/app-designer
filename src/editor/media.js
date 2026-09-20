/* Bilder aufbereiten.
   Alles laeuft im Browser: verkleinern, neu kodieren, als Data-URL
   ins Dokument legen. Damit bleibt der Export eine einzige Datei und
   es verlaesst kein Kinderfoto den Rechner.

   Nebeneffekt, der hier Absicht ist: das Neukodieren ueber ein
   Canvas wirft saemtliche EXIF-Daten weg - Handyfotos tragen sonst
   GPS-Koordinaten in die exportierte Datei.                        */

import { newId } from "../shared/path.js";

export const IMAGE_PRESETS = {
  klein: { max: 600, quality: 0.8, label: "klein (600 px)" },
  normal: { max: 1000, quality: 0.82, label: "normal (1000 px)" },
  gross: { max: 1600, quality: 0.85, label: "groß (1600 px)" },
};

export async function importImage(file, presetName = "normal") {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("Das ist keine Bilddatei.");
  }
  const preset = IMAGE_PRESETS[presetName] || IMAGE_PRESETS.normal;

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    .catch(() => createImageBitmap(file));

  const scale = Math.min(1, preset.max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let mime = "image/webp";
  let data = canvas.toDataURL(mime, preset.quality);
  if (!data.startsWith("data:image/webp")) {     // aeltere Safari-Versionen
    mime = "image/jpeg";
    data = canvas.toDataURL(mime, preset.quality);
  }

  return {
    id: newId("img"),
    asset: { mime, w: width, h: height, data, bytes: Math.round((data.length - 22) * 0.75) },
  };
}

/* App-Symbol aus Emoji und Themefarben. Spart dem Nutzer den
   Umweg ueber ein Grafikprogramm. */
export function makeIcon(emoji, background, size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background || "#171540";
  ctx.fillRect(0, 0, size, size);
  ctx.font = `${Math.round(size * 0.58)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji || "🎉", size / 2, size * 0.54);
  return canvas.toDataURL("image/png");
}

export function dataUrlToBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function pickFile({ accept = "image/*", multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener("change", () => resolve(multiple ? [...input.files] : input.files[0] || null));
    input.click();
  });
}
