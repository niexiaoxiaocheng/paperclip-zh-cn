import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveTarget, compatibility } from '../src/target.mjs';
import { audit, install, restore, verify, status, inventory } from '../src/installer.mjs';
import { checkInvariants } from '../src/invariants.mjs';
import { displayEnum } from '../src/display-enums.mjs';

const mainName = 'index-test.js';
const catalogName = 'catalog-test.js';
const fixtureCode = `
function jsx(type,props){return {type,props};}
function named(fn,name){return fn;}
function label(value){return value.replace(/_/g," ").replace(/\\b\\w/g,s=>s.toUpperCase());}
named(label,"statusLabel");
export const payload={status:"todo",role:"admin",method:"POST",path:"/api/issues"};
export function view(userTitle){return jsx("section",{children:[
  jsx("button",{children:"Save",onClick:()=>payload.status==="todo"}),
  jsx("p",{children:userTitle}),
  jsx("p",{children:payload.role||"unset"}),
  jsx("p",{children:label("in_progress")}),
  jsx("code",{children:"Run"}),
  jsx("span",{children:"Last updated: "+userTitle})
]});}
`;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paperclip-zh-test-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('paperclip-zh-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const server = path.join(root, 'server');
  const ui = path.join(server, 'ui-dist');
  fs.mkdirSync(path.join(ui, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(server, 'package.json'), JSON.stringify({ name: '@paperclipai/server', version: compatibility.paperclipVersion, type: 'module' }));
  fs.writeFileSync(path.join(ui, 'index.html'), `<!doctype html><html lang="en"><script type="module" src="/assets/${mainName}"></script><div id="root"></div></html>`);
  fs.writeFileSync(path.join(ui, 'assets', mainName), fixtureCode);
  fs.writeFileSync(path.join(ui, 'assets', catalogName), 'export const catalog={label:"Sign in with Example",children:"Plugins"};');
  fs.writeFileSync(path.join(ui, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const target = resolveTarget({ serverDir: server });
  const profile = { ...compatibility, catalogAsset: catalogName, assetSha256: {} };
  for (const name of [mainName, catalogName]) profile.assetSha256[`assets/${name}`] = crypto.createHash('sha256').update(fs.readFileSync(path.join(ui, 'assets', name))).digest('hex');
  return { root, target, profile };
}

test('install preserves payloads and user text, localizes UI and restores exactly', async t => {
  const { target, profile } = fixture(t);
  const original = inventory(target.ui);
  const analysis = audit(target, { profile });
  assert.ok(analysis.translatedLiterals > 0);
  assert.equal(fs.existsSync(target.backup), false, 'audit must not create a backup');
  assert.deepEqual(inventory(target.ui), original);
  const result = install(target, { profile });
  assert.ok(verify(target, { profile }).ok);
  const module = await import(pathToFileURL(path.join(target.ui, 'assets', mainName.replace('.js', `.zh-${result.revision}.js`))));
  assert.deepEqual(module.payload, { status: 'todo', role: 'admin', method: 'POST', path: '/api/issues' });
  const rows = module.view('Dashboard').props.children;
  assert.equal(rows[0].props.children, '保存');
  assert.equal(rows[0].props.onClick(), true);
  assert.equal(rows[1].props.children, 'Dashboard');
  assert.equal(rows[2].props.children, '管理员');
  assert.equal(rows[3].props.children, '进行中');
  assert.equal(rows[4].props.children, 'Run', 'executable samples remain original');
  assert.equal(rows[5].props.children.includes('Dashboard'), true);
  assert.equal(install(target, { profile }).revision, result.revision, 'reinstall must be deterministic');
  assert.equal(status(target).language, 'zh-CN');
  restore(target, { profile });
  for (const [relative, hash] of Object.entries(original)) assert.equal(inventory(target.ui)[relative], hash);
  assert.equal(status(target).language, 'en');
  assert.equal(fs.existsSync(path.join(target.ui, 'zh-cn-install.json')), false);
  assert.equal(fs.existsSync(target.backup), true, 'restore retains the original backup');
});

test('rejects unsupported or locally modified targets without activation', t => {
  const { target, profile } = fixture(t);
  const index = fs.readFileSync(path.join(target.ui, 'index.html'), 'utf8');
  assert.throws(() => install(target), /Unsupported or modified upstream/);
  assert.equal(fs.existsSync(target.backup), false);
  assert.equal(fs.existsSync(target.lock), false);
  fs.appendFileSync(path.join(target.ui, 'assets', mainName), '\n// local change');
  assert.throws(() => install(target, { profile }), /Unsupported or modified upstream/);
  assert.equal(fs.readFileSync(path.join(target.ui, 'index.html'), 'utf8'), index);
  fs.writeFileSync(path.join(target.server, 'package.json'), JSON.stringify({ name: '@paperclipai/server', version: '999.0.0' }));
  assert.throws(() => resolveTarget({ serverDir: target.server }), /Unsupported Paperclip/);
});

test('rejects concurrent operations, detects corruption and refuses a damaged backup', t => {
  const { target, profile } = fixture(t);
  fs.writeFileSync(target.lock, 'test-lock');
  assert.throws(() => install(target, { profile }), /Another operation/);
  fs.unlinkSync(target.lock);
  const result = install(target, { profile });
  const asset = path.join(target.ui, 'assets', mainName.replace('.js', `.zh-${result.revision}.js`));
  fs.appendFileSync(asset, '\n// changed after install');
  assert.throws(() => verify(target, { profile }), /missing or modified/);
  fs.appendFileSync(path.join(target.backup, 'favicon.svg'), 'tampered');
  assert.throws(() => restore(target, { profile }), /Backup inventory/);
  assert.equal(fs.existsSync(target.lock), false);
});

test('protocol checks reject changed enums, API paths and comparisons', () => {
  const original = 'export const p={status:"todo",path:"/api/issues"};if(p.status==="todo"){}';
  assert.throws(() => checkInvariants(original, original.replaceAll('todo', '待办'), 'fixture'), /invariant changed/);
  assert.throws(() => checkInvariants(original, original.replace('/api/issues', '/api/tasks'), 'fixture'), /invariant changed/);
});

test('display enums preserve arbitrary text and non-string values', () => {
  assert.equal(displayEnum('In Progress'), '进行中');
  assert.equal(displayEnum('owner'), '组织所有者');
  for (const value of ['Dashboard', 'Custom Role', null, 0, { name: 'Board' }]) assert.equal(displayEnum(value), value);
});

test('CLI help is read-only and invalid options fail before target resolution', () => {
  const entry = fileURLToPath(new URL('../bin/paperclip-zh-cn.mjs', import.meta.url));
  const help = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' });
  const invalid = spawnSync(process.execPath, [entry, 'install', '--unknown'], { encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage/);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Invalid option/);
});
