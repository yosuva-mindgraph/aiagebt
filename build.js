#!/usr/bin/env node
/* ============================================================================
   Inline everything into dist/index.html.

   One file, no server, no network. Double-click it on a booth machine, press
   F11. The fonts are already data URIs; this folds in the CSS, resolves the ES
   module graph into one classic <script>, and drops config.js in if it exists.

       node build.js            → dist/index.html (never contains config.js — safe to commit and hand out)
                                  + dist/stand.html when config.js exists (keys baked in — gitignored)
       node build.js --no-config  → skip dist/stand.html

   The module inliner is deliberately small: it understands the handful of
   import/export forms this repo actually uses, in dependency order. It is not a
   bundler and does not pretend to be — if the import style changes, change this
   or reach for esbuild.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));

/* Dependency order, leaves first. */
const MODULES = [
  'src/knowledge.js',
  'src/scenes.js',
  'src/avatar.js',
  'src/voice.js',
  'src/ask.js',
  'src/app.js',
];

/** Strip ES module syntax so the files can share one classic script scope. */
function flatten(src) {
  return src
    // import ... from '...';  /  import '...';
    .replace(/^\s*import\s+[^;]*?from\s*['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^\s*import\s*['"][^'"]+['"]\s*;?\s*$/gm, '')
    // export const/let/function/class → plain declaration
    .replace(/^\s*export\s+(?=(const|let|var|function|class|async))/gm, '')
    // export { ... };
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, 'const __default = ');
}

/* Flattening puts every module in one scope, so two modules that each declare a
   private `sleep` become a SyntaxError that only shows up in the built file.
   Catch it here rather than in a browser on a stand. */
function assertNoCollisions(flattened) {
  const owners = new Map();
  const problems = [];
  for (const [file, src] of flattened) {
    const names = new Set();
    // column 0 only — anything indented is inside a function and cannot collide
    for (const m of src.matchAll(/^(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
      names.add(m[1]);
    }
    for (const n of names) {
      if (owners.has(n)) problems.push(`${n} — declared in both ${owners.get(n)} and ${file}`);
      else owners.set(n, file);
    }
  }
  if (problems.length) {
    console.error('top-level name collisions — the built file would not parse:');
    problems.forEach(p => console.error('  ✗ ' + p));
    process.exit(1);
  }
}

function build({ withConfig = true } = {}) {
  const css = read('assets/fonts.css') + '\n' + read('src/styles.css');
  const flattened = MODULES.map(m => [m, flatten(read(m))]);
  assertNoCollisions(flattened);
  const js = flattened.map(([m, src]) => `/* ─── ${m} ${'─'.repeat(Math.max(0, 58 - m.length))} */\n` + src)
    .join('\n\n');

  const configJs = withConfig && exists('config.js') ? read('config.js') : '';

  const assemble = cfg => read('index.html')
    .replace(/<link rel="stylesheet" href="assets\/fonts\.css">\s*\n?/, '')
    .replace(/<link rel="stylesheet" href="src\/styles\.css">/, `<style>\n${css}\n</style>`)
    .replace(/<script src="config\.js"[^>]*><\/script>/,
      cfg ? `<script>\n${cfg}\n</script>` : '<script>window.AIB_CONFIG = window.AIB_CONFIG || {};</script>')
    .replace(/<script type="module" src="src\/app\.js"><\/script>/, `<script>\n${js}\n</script>`);

  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });

  /* dist/index.html is tracked in git and handed out, so it NEVER carries config.js.
     The keyed build for the stand machine is a separate, gitignored file. */
  const html = assemble('');
  const out = path.join(ROOT, 'dist', 'index.html');
  fs.writeFileSync(out, html);
  if (configJs) fs.writeFileSync(path.join(ROOT, 'dist', 'stand.html'), assemble(configJs));

  /* A Claude Artifact supplies its own <!doctype>/<head>/<body> and wraps what it
     is given, so the hosted preview needs the same page with that scaffolding
     removed and the theme stamped by script instead of on <html>. */
  if (process.argv.includes('--artifact')) {
    const body = html
      .slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
      .trim();
    const head = html.slice(html.indexOf('<style>'), html.indexOf('</style>') + 8);
    fs.writeFileSync(path.join(ROOT, 'dist', 'artifact.html'),
      `<title>AIRIS · Thinking Airport</title>\n${head}\n` +
      `<script>document.documentElement.dataset.theme = ` +
      `localStorage.getItem('aib-theme') || 'dark';</script>\n${body}\n`);
    console.log('dist/artifact.html  (head/body scaffolding stripped for hosting)');
  }

  const kb = (read('src/knowledge.js').match(/^\s*id:\s*'/gm) || []).length;
  const scenes = (read('src/scenes.js').match(/^\s*id:\s*'/gm) || []).length;
  console.log(`dist/index.html  ${(html.length / 1024 / 1024).toFixed(2)} MB  (no config — safe to commit and hand out)`);
  console.log(`  ${scenes} scenes · ${kb} knowledge entries`);
  if (configJs) console.log('dist/stand.html  keys baked in — gitignored; open THIS one on the stand machine, never share it');
}

build({ withConfig: !process.argv.includes('--no-config') });
