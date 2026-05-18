import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

const ymlPath = path.resolve('./src/assets/configs/enchantments/enchantments.yml');
const jsonPath = path.resolve('./src/assets/configs/enchantments/enchantments.json');

const content = fs.readFileSync(ymlPath, 'utf8');
const parsed = yaml.parse(content);

const result: Record<string, any> = {};

for (const [key, value] of Object.entries(parsed)) {
  if (!value || typeof value !== 'object') continue;

  const ench = value as any;

  // Try to determine max level
  let maxLevel = 0;
  if (ench.levels) {
    const levels = Object.keys(ench.levels)
      .map(k => parseInt(k, 10))
      .filter(n => !isNaN(n));
    if (levels.length > 0) {
      maxLevel = Math.max(...levels);
    }
  }

  result[key] = {
    id: key,
    display: ench.display ? ench.display.replace(/%group-color%/g, '') : '',
    description: ench.description ? ench.description.replace(/\n/g, ' ') : '',
    appliesTo: ench['applies-to'] || '',
    group: ench.group || '',
    maxLevel: maxLevel
  };
}

fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`Successfully converted ${Object.keys(result).length} enchantments to ${jsonPath}`);
