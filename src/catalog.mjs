import fs from 'node:fs';

export function loadCatalog() {
  return {
    ...JSON.parse(fs.readFileSync(new URL('../locales/base.generated.json', import.meta.url), 'utf8')),
    ...JSON.parse(fs.readFileSync(new URL('../locales/zh-CN.json', import.meta.url), 'utf8')),
  };
}

export function createTranslator(dictionary) {
  const trimmed = Object.fromEntries(Object.entries(dictionary).map(([en, zh]) => [en.trim(), zh.trim()]));
  return value => {
    if (Object.hasOwn(dictionary, value)) return dictionary[value];
    const key = value.trim();
    return key && Object.hasOwn(trimmed, key) ? value.replace(key, trimmed[key]) : undefined;
  };
}
