export const basenameOf = (path: string): string => {
  const normalized = path.replace(/\\\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
};

export const formatTimestamp = (value?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const copyToClipboard = async (text: string): Promise<void> => {
  if (typeof window === "undefined") return;

  const navClipboard = window.navigator?.clipboard?.writeText;
  if (typeof navClipboard === "function") {
    await navClipboard.call(window.navigator.clipboard, text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

