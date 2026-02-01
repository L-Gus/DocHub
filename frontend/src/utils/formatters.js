export function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
