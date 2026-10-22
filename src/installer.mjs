import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compatibility } from './target.mjs';
import { loadCatalog } from './catalog.mjs';
import { transformAssets } from './engine.mjs';
import { checkInvariants } from './invariants.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const packageVersion = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const manifestPath = target => path.join(target.ui, 'zh-cn-install.json');

export function inventory(directory) {
  const files = {};
  function visit(relative = '') {
    for (const name of fs.readdirSync(path.join(directory, relative)).sort()) {
      const key = relative ? `${relative}/${name}` : name;
      const info = fs.lstatSync(path.join(directory, key));
      if (info.isSymbolicLink()) throw Error(`Nested symlink in UI directory is unsupported: ${key}`);
      if (info.isDirectory()) visit(key);
      else if (info.isFile()) files[key] = digest(fs.readFileSync(path.join(directory, key)));
      else throw Error(`Unexpected UI entry: ${key}`);
    }
  }
  visit();
  return files;
}

function assertProfile(source, profile) {
  for (const [relative, expected] of Object.entries(profile.assetSha256)) {
    const file = path.join(source, relative);
    if (!fs.existsSync(file) || digest(fs.readFileSync(file)) !== expected) throw Error(`Unsupported or modified upstream build: ${relative}. No activation performed.`);
  }
}

function originalSource(target, profile) {
  const source = fs.existsSync(target.backup) ? target.backup : target.ui;
  assertProfile(source, profile);
  const html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
  if (html.includes('.zh-') || !/lang="en"/.test(html)) throw Error('Original English UI is unavailable. Restore a pristine upstream installation first.');
  if (fs.existsSync(target.metadata)) {
    const metadata = JSON.parse(fs.readFileSync(target.metadata, 'utf8'));
    if (metadata.version !== target.version || JSON.stringify(inventory(source)) !== JSON.stringify(metadata.files)) throw Error('Backup inventory/version does not match. Refusing to use this backup.');
  }
  return source;
}

function atomicWrite(file, content) {
  const temp = `${file}.tmp-${process.pid}`;
  const fd = fs.openSync(temp, 'wx');
  try { fs.writeFileSync(fd, content); } finally { fs.closeSync(fd); }
  try { fs.renameSync(temp, file); }
  catch (error) { fs.unlinkSync(temp); throw error; }
}

function withLock(target, operation) {
  let fd;
  try { fd = fs.openSync(target.lock, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw Error(`Another operation is running, or a stale lock exists: ${target.lock}. Confirm no installer is running before removing a stale lock.`);
    throw error;
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid }));
    return operation();
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(target.lock);
  }
}

function makePlan(target, profile) {
  const source = originalSource(target, profile);
  const originalFiles = inventory(source);
  const analysis = transformAssets(source, { catalog: loadCatalog(), catalogAsset: profile.catalogAsset });
  const hash = crypto.createHash('sha256').update(packageVersion).update(JSON.stringify(profile)).update(JSON.stringify(analysis.dictionary)).update(JSON.stringify(originalFiles));
  for (const file of fs.readdirSync(path.join(packageRoot, 'src')).filter(name => name.endsWith('.mjs')).sort()) hash.update(fs.readFileSync(path.join(packageRoot, 'src', file)));
  const revision = hash.digest('hex').slice(0, 12);
  const names = fs.readdirSync(path.join(source, 'assets')).filter(name => name.endsWith('.js')).sort();
  const renamed = new Map(names.map(name => [name, name.replace(/\.js$/, `.zh-${revision}.js`)]));
  const helper = `paperclip-zh-enums.${revision}.js`;
  const rewriteImports = text => text.replace(/[A-Za-z0-9_./-]+\.js/g, value => {
    const name = path.posix.basename(value);
    return renamed.has(name) ? value.slice(0, -name.length) + renamed.get(name) : value;
  });
  const files = new Map([[`assets/${helper}`, fs.readFileSync(new URL('./display-enums.mjs', import.meta.url), 'utf8')]]);
  for (const name of names) {
    const original = fs.readFileSync(path.join(source, 'assets', name), 'utf8');
    const code = analysis.output.get(name) ?? original;
    const preamble = analysis.enumChunks.has(name) ? `import{displayEnum as __paperclipZhDisplayEnum}from"./${helper}";\n` : '';
    const translated = preamble + rewriteImports(code);
    if (analysis.output.has(name)) checkInvariants(original, translated, name);
    files.set(`assets/${renamed.get(name)}`, translated);
  }
  let html = fs.readFileSync(path.join(source, 'index.html'), 'utf8').replace('lang="en"', 'lang="zh-CN"');
  for (const [en, zh] of Object.entries(analysis.dictionary)) if (en.length > 12) html = html.split(en).join(zh);
  files.set('index.html', rewriteImports(html));
  return { source, originalFiles, files, revision, analysis };
}

function summary(plan, mode) {
  return { mode, packageVersion, revision: plan.revision, translatedLiterals: plan.analysis.changed, chunks: plan.analysis.output.size, untranslatedCandidates: plan.analysis.missing.length };
}

export function audit(target, { profile = compatibility, reportDir } = {}) {
  const plan = makePlan(target, profile);
  if (reportDir) {
    fs.mkdirSync(reportDir, { recursive: true });
    atomicWrite(path.join(reportDir, 'untranslated.json'), JSON.stringify(plan.analysis.missing, null, 2) + '\n');
  }
  return summary(plan, 'audit');
}

export function install(target, { profile = compatibility } = {}) {
  return withLock(target, () => {
    const plan = makePlan(target, profile);
    // All transformations and protocol checks finish before the first backup or
    // live-UI write. Each release always starts from the pristine original.
    if (!fs.existsSync(target.backup)) {
      const staging = `${target.backup}.tmp-${process.pid}`;
      if (fs.existsSync(staging)) throw Error(`Backup staging directory exists: ${staging}`);
      fs.cpSync(target.ui, staging, { recursive: true });
      if (JSON.stringify(inventory(staging)) !== JSON.stringify(plan.originalFiles)) throw Error('UI changed during backup; no activation performed.');
      fs.renameSync(staging, target.backup);
    }
    if (!fs.existsSync(target.metadata)) atomicWrite(target.metadata, JSON.stringify({ version: target.version, files: plan.originalFiles }, null, 2));
    const outputFiles = {};
    for (const [relative, code] of plan.files) {
      outputFiles[relative] = digest(code);
      if (relative === 'index.html') continue;
      const file = path.join(target.ui, relative);
      if (fs.existsSync(file)) {
        if (digest(fs.readFileSync(file)) !== outputFiles[relative]) throw Error(`Existing immutable asset differs: ${relative}`);
      } else atomicWrite(file, code);
    }
    // Activate only after every module exists; refresh loads the new graph.
    atomicWrite(path.join(target.ui, 'index.html'), plan.files.get('index.html'));
    atomicWrite(manifestPath(target), JSON.stringify({ ...summary(plan, 'install'), formatVersion: 1, paperclipVersion: target.version, original: target.backup, outputFiles }, null, 2));
    return summary(plan, 'install');
  });
}

export function verify(target, { profile = compatibility } = {}) {
  if (!fs.existsSync(manifestPath(target))) throw Error('No localization installation manifest found.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath(target), 'utf8'));
  if (manifest.formatVersion !== 1 || manifest.paperclipVersion !== target.version) throw Error('Unsupported/legacy installation manifest. Run install to adopt it.');
  const source = originalSource(target, profile);
  for (const [relative, hash] of Object.entries(manifest.outputFiles)) {
    const file = path.join(target.ui, relative);
    if (!fs.existsSync(file) || digest(fs.readFileSync(file)) !== hash) throw Error(`Installed file is missing or modified: ${relative}`);
  }
  for (const name of fs.readdirSync(path.join(source, 'assets')).filter(name => name.endsWith('.js'))) {
    const translated = fs.readFileSync(path.join(target.ui, 'assets', name.replace(/\.js$/, `.zh-${manifest.revision}.js`)), 'utf8');
    const original = fs.readFileSync(path.join(source, 'assets', name), 'utf8');
    if (/[\u3400-\u9fff]/.test(translated)) checkInvariants(original, translated, name);
  }
  if (!/lang="zh-CN"/.test(fs.readFileSync(path.join(target.ui, 'index.html'), 'utf8'))) throw Error('Chinese entry point is not active.');
  return { mode: 'verify', ok: true, paperclipVersion: target.version, revision: manifest.revision, translatedLiterals: manifest.translatedLiterals, checks: ['asset integrity', 'syntax', 'comparison operands', 'object keys', 'protocol values', 'document language'] };
}

export function restore(target, { profile = compatibility } = {}) {
  return withLock(target, () => {
    if (!fs.existsSync(target.backup)) throw Error('No original backup found; nothing changed.');
    const source = originalSource(target, profile);
    const files = inventory(source);
    for (const relative of Object.keys(files)) {
      if (relative === 'index.html') continue;
      const destination = path.join(target.ui, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      if (!fs.existsSync(destination) || digest(fs.readFileSync(destination)) !== files[relative]) atomicWrite(destination, fs.readFileSync(path.join(source, relative)));
    }
    atomicWrite(path.join(target.ui, 'index.html'), fs.readFileSync(path.join(source, 'index.html')));
    if (fs.existsSync(manifestPath(target))) fs.unlinkSync(manifestPath(target));
    return { mode: 'restore', restored: true, paperclipVersion: target.version };
  });
}

export function status(target) {
  const active = /lang="zh-CN"/.test(fs.readFileSync(path.join(target.ui, 'index.html'), 'utf8'));
  const manifest = fs.existsSync(manifestPath(target)) ? JSON.parse(fs.readFileSync(manifestPath(target), 'utf8')) : null;
  return { mode: 'status', paperclipVersion: target.version, language: active ? 'zh-CN' : 'en', managedByThisPackage: manifest?.formatVersion === 1, revision: manifest?.revision ?? null, originalBackup: fs.existsSync(target.backup) };
}
