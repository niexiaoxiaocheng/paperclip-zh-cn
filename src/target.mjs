import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const compatibility = JSON.parse(fs.readFileSync(new URL('../compatibility.json', import.meta.url), 'utf8'));

export function resolveTarget(options = {}) {
  if (options.serverDir && options.payload) throw Error('--server-dir and --payload are mutually exclusive.');
  const expand = value => value === '~' ? os.homedir() : value.startsWith(`~${path.sep}`) || value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : path.resolve(value);
  const home = process.env.PAPERCLIP_HOME || path.join(os.homedir(), '.paperclip');
  const payload = options.payload ? expand(options.payload) : path.join(home, 'cli', 'current');
  const directory = options.serverDir ? expand(options.serverDir) : path.join(payload, 'node_modules', '@paperclipai', 'server');
  if (!fs.existsSync(path.join(directory, 'package.json'))) throw Error('Paperclip server not found. Use --payload <managed-install-root> or --server-dir <@paperclipai/server-directory>. Run this command inside WSL if Paperclip is installed there.');
  const server = fs.realpathSync(directory);
  const pkg = JSON.parse(fs.readFileSync(path.join(server, 'package.json'), 'utf8'));
  if (pkg.name !== '@paperclipai/server') throw Error('Target must be the @paperclipai/server package directory.');
  if (pkg.version !== compatibility.paperclipVersion) throw Error(`Unsupported Paperclip ${pkg.version}; this release supports ${compatibility.paperclipVersion}. No files changed.`);
  const ui = path.join(server, 'ui-dist');
  if (!fs.existsSync(path.join(ui, 'index.html'))) throw Error('Built ui-dist/index.html not found. Source/dev mode is not supported.');
  return { server, ui, version: pkg.version, backup: `${ui}.original-zh-cn`, metadata: `${ui}.original-zh-cn.meta.json`, lock: `${ui}.zh-cn.lock` };
}
