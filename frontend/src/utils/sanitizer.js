export function sanitize(string) {
  return string.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
