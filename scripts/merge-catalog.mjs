import fs from 'node:fs';

const output = new URL('../locales/zh-CN.json', import.meta.url);
const dictionary = JSON.parse(fs.readFileSync(output, 'utf8'));
for (const name of ['fragments.tsv', 'additions.tsv']) {
  for (const line of fs.readFileSync(new URL(`../locales/${name}`, import.meta.url), 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    const index = line.indexOf('\t');
    if (index < 1) throw Error(`Invalid TSV entry in ${name}`);
    dictionary[line.slice(0, index)] = line.slice(index + 1);
  }
}
fs.writeFileSync(output, JSON.stringify(dictionary, null, 2) + '\n');
console.log(`Merged ${Object.keys(dictionary).length} overrides.`);
