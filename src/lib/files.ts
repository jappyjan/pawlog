export type ViewerFile = { storageId: string; name: string; contentType?: string; size?: number; url: string | null };
export type FileKind = "image" | "pdf" | "text" | "video" | "audio" | "docx" | "other";

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/** What the in-app viewer can show for a file (by MIME type, falling back to the extension). */
export function fileKind(f: { name: string; contentType?: string }): FileKind {
  const t = (f.contentType ?? "").toLowerCase();
  const e = ext(f.name);
  if (t === "application/pdf" || e === "pdf") return "pdf";
  if ((t.startsWith("image/") && !/hei[cf]/.test(t)) || ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp"].includes(e)) return "image";
  if (t.startsWith("video/") || ["mp4", "mov", "webm", "m4v"].includes(e)) return "video";
  if (t.startsWith("audio/") || ["mp3", "m4a", "wav", "ogg", "aac"].includes(e)) return "audio";
  if (t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || e === "docx") return "docx";
  if (t.startsWith("text/") || ["application/json", "application/xml"].includes(t) || ["txt", "csv", "md", "json", "xml", "log", "tsv"].includes(e)) return "text";
  return "other";
}

export const FILE_ICON: Record<FileKind, string> = {
  image: "🖼️",
  pdf: "📄",
  text: "📝",
  video: "🎬",
  audio: "🎵",
  docx: "📃",
  other: "📎",
};

/** Accept list for the upload picker: photos/camera, PDFs and other common formats. */
export const ACCEPT =
  "image/*,application/pdf,text/plain,text/csv,text/markdown,application/json,video/*,audio/*,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.csv,.md,.heic,.heif";

/** Save a (cross-origin) file under its real name: <a download> is ignored for other origins. */
export async function downloadFile(f: ViewerFile) {
  if (!f.url) return;
  const blob = await (await fetch(f.url)).blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = f.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Native share sheet with the file itself (iOS/Android), e.g. to send the insurance PDF. */
export async function shareFile(f: ViewerFile, title: string) {
  if (!f.url) return false;
  const blob = await (await fetch(f.url)).blob();
  const file = new File([blob], f.name, { type: blob.type || f.contentType });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title }).catch(() => {});
    return true;
  }
  return false;
}
