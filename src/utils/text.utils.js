// utils/text.utils.js

export function truncateText(text, maxLength = 100) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength - 3) + "..." : text;
}

export function truncateForSlack(text, limit = 2900) {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + "...\n\n_Summary truncated. Full response logged in MemGo._";
}