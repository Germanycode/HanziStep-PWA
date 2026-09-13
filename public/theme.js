// Applies the saved theme before the first paint. Settings live in IndexedDB
// (async), so the theme is mirrored to localStorage for this synchronous read.
// Kept as a file rather than an inline script so the production CSP can use
// script-src 'self' with no unsafe-inline.
try {
  document.documentElement.dataset.theme = localStorage.getItem('hanzistep-theme') === 'light' ? 'light' : 'dark';
} catch {
  document.documentElement.dataset.theme = 'dark';
}
