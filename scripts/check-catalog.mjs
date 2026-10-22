import { loadCatalog } from '../src/catalog.mjs';

const dictionary = loadCatalog();
const errors = [];
for (const [source, translated] of Object.entries(dictionary)) {
  if (!source || typeof translated !== 'string') { errors.push('Empty key or non-string value'); continue; }
  if (/ZX[QV]\s*\d|QXZ|VXZ/.test(translated)) errors.push(`Unresolved translation marker: ${source.slice(0, 80)}`);
  for (const token of source.match(/`[^`]+`|\b[A-Z][A-Z0-9_]*_[A-Z0-9_]+\b|\{\{[^}]+\}\}/g) || []) {
    if (!translated.includes(token)) errors.push(`Missing technical placeholder ${token}: ${source.slice(0, 80)}`);
  }
}
if (errors.length) {
  errors.forEach(error => console.error(error));
  process.exitCode = 1;
} else console.log(`Catalog OK: ${Object.keys(dictionary).length} entries; technical placeholders preserved.`);
