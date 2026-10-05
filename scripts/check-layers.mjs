// AC-10: domain/ and application/ must not import adapters/ or ui/; domain must not import application.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const RULES = { domain: ['application', 'adapters', 'ui'], application: ['adapters', 'ui'] };

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
  });
}

export function findLayerViolations() {
  const out = [];
  for (const [layer, banned] of Object.entries(RULES)) {
    for (const f of files(join(root, layer))) {
      const src = readFileSync(f, 'utf8');
      if (/\b(fetch|localStorage|sessionStorage|document|window|XMLHttpRequest)\s*[.(]/.test(src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))) out.push(`${f}: uses browser/network I/O`);
      for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
        if (banned.some((b) => m[1].includes(`/${b}/`) || m[1].startsWith(`../${b}`))) out.push(`${f}: ${m[1]}`);
        if (/^(node:|https?:)/.test(m[1])) out.push(`${f}: I/O import ${m[1]}`);
      }
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const v = findLayerViolations();
  console.log(v.length ? v.join('\n') : 'layers ok');
  process.exit(v.length ? 1 : 0);
}
