import { readFileSync, writeFileSync } from 'node:fs';

const root = 'demos/order-risk/';
const read = name => readFileSync(root + name, 'utf8');
const js = ['data.js', 'scene.js', 'calc.js', 'app.js'].map(name => read(name)
  .replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gm, '')
  .replace(/^export\s+/gm, '')).join('\n');
if (/<\/script/i.test(js)) throw new Error('脚本包含不能安全内嵌的闭合标签');
const output = read('index.html')
  .replace('<link rel="stylesheet" href="./styles.css">', `<style>\n${read('styles.css')}\n</style>`)
  .replace('<script type="module" src="./app.js"></script>', `<script>\n${js}\n</script>`);
if (process.argv.includes('--check')) {
  if (readFileSync('订单风险-本地预览.html', 'utf8') !== output) throw new Error('本地预览不是最新版本');
} else writeFileSync('订单风险-本地预览.html', output);
