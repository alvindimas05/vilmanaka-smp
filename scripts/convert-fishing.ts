import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

const fishesPath = path.resolve('./src/assets/configs/fishing/fishes.yml');
const baitsPath = path.resolve('./src/assets/configs/fishing/baits.yml');
const rodsPath = path.resolve('./src/assets/configs/fishing/rods.yml');
const lootConditionsPath = path.resolve('./src/assets/configs/fishing/loot-conditions.yml');
const jsonPath = path.resolve('./src/assets/configs/fishing/fishing.json');

const parseYaml = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    return yaml.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return {};
};

const getRarityTier = (group: string) => {
  if (group.startsWith('common')) return 'COMMON';
  if (group.startsWith('rare')) return 'RARE';
  if (group.startsWith('epic')) return 'EPIC';
  if (group.startsWith('leg')) return 'LEGENDARY';
  if (group.startsWith('mythical')) return 'MYTHICAL';
  return 'COMMON';
};

const getWorldFromGroup = (group: string) => {
  if (group.includes('nether')) return 'Nether';
  if (group.includes('end') || group === 'barreleye_fish') return 'The End';
  return 'Overworld';
};

const fishesYml = parseYaml(fishesPath);
const baitsYml = parseYaml(baitsPath);
const rodsYml = parseYaml(rodsPath);
const lootConditionsYml = parseYaml(lootConditionsPath);

// Function to clean formatting tags like <white>, <b>, <gradient:...>
const cleanText = (text: string) => {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, '').replace(/%group-color%/g, '');
};

// Base weight extraction
const weights: Record<string, number> = {};
const extractWeights = (obj: any) => {
  if (!obj || typeof obj !== 'object') return;
  if (obj.list && Array.isArray(obj.list)) {
    for (const item of obj.list) {
      if (typeof item === 'string') {
        // e.g. group_for_each:common_ow:+100 or barreleye_fish:+0.01
        const parts = item.split(':');
        const weightStr = parts[parts.length - 1]; // +100
        const id = parts[parts.length - 2]; // common_ow
        if (weightStr.startsWith('+')) {
          weights[id] = parseFloat(weightStr.substring(1));
        }
      }
    }
  }
  if (obj['sub-groups']) {
    for (const key of Object.keys(obj['sub-groups'])) {
      extractWeights(obj['sub-groups'][key]);
    }
  }
};
if (lootConditionsYml.global_pool) {
  extractWeights(lootConditionsYml.global_pool);
}

const result = {
  fishes: [] as any[],
  baits: [] as any[],
  rods: [] as any[]
};

const groupTotals: Record<string, number> = {};
const worldTotals: Record<string, number> = {};
const worldRarityTotals: Record<string, Record<string, number>> = {};

// Parse Fishes first pass to get group totals
for (const [key, value] of Object.entries(fishesYml)) {
  if (!value || typeof value !== 'object') continue;
  const fish = value as any;
  const group = Array.isArray(fish.group) ? fish.group[0] : fish.group;
  const baseWeight = weights[group] || weights[key] || 0;
  
  if (!groupTotals[group]) groupTotals[group] = 0;
  groupTotals[group] += baseWeight;

  const world = getWorldFromGroup(group);
  const rarity = getRarityTier(group);

  if (!worldTotals[world]) worldTotals[world] = 0;
  worldTotals[world] += baseWeight;

  if (!worldRarityTotals[world]) worldRarityTotals[world] = {};
  if (!worldRarityTotals[world][rarity]) worldRarityTotals[world][rarity] = 0;
  worldRarityTotals[world][rarity] += baseWeight;
}

// Parse Fishes second pass
for (const [key, value] of Object.entries(fishesYml)) {
  if (!value || typeof value !== 'object') continue;
  const fish = value as any;
  const name = cleanText(fish.display?.name);
  const lore = (fish.display?.lore || [])
    .map(cleanText)
    .filter((l: string) => !l.startsWith('Size: '));
  
  const group = Array.isArray(fish.group) ? fish.group[0] : fish.group;
  const baseWeight = weights[group] || weights[key] || 0;
  const totalWeight = groupTotals[group] || 1;
  const percentage = baseWeight > 0 ? ((baseWeight / totalWeight) * 100).toFixed(2) + '%' : '0%';

  const world = getWorldFromGroup(group);
  const rarity = getRarityTier(group);

  const rarityChanceNum = worldTotals[world] > 0 ? (worldRarityTotals[world][rarity] / worldTotals[world]) : 0;
  const rarityChance = (rarityChanceNum * 100).toFixed(2) + '%';
  
  const worldChanceNum = worldTotals[world] > 0 ? (baseWeight / worldTotals[world]) : 0;
  const worldChance = (worldChanceNum * 100).toFixed(2) + '%';

  let image = `/src/assets/images/fishing/${key}.png`;

  result.fishes.push({
    id: key,
    name,
    lore,
    group,
    size: fish.size,
    price: {
      base: fish.price?.base || 0,
      bonus: fish.price?.bonus || 0,
    },
    percentage,
    rarityChance,
    worldChance,
    world,
    image
  });
}

// Parse Baits
for (const [key, value] of Object.entries(baitsYml)) {
  if (!value || typeof value !== 'object') continue;
  const bait = value as any;
  result.baits.push({
    id: key,
    name: bait.nick || key,
    maxBaits: bait['max-baits'] || -1,
    image: `/src/assets/images/fishing/${key}.png`
  });
}

// Parse Rods
for (const [key, value] of Object.entries(rodsYml)) {
  if (!value || typeof value !== 'object') continue;
  if (key === 'FISHING_ROD') continue; // vanilla rod logic mostly
  const rod = value as any;
  const name = cleanText(rod.display?.name || key);
  const lore = (rod.display?.lore || []).map(cleanText).filter((l: string) => l !== '');
  
  const effects = [];
  if (rod.effects) {
    for (const [eKey, eVal] of Object.entries(rod.effects)) {
      const effect = eVal as any;
      if (effect.type !== 'group-mod') {
        effects.push({ type: effect.type, value: effect.value });
      }
    }
  }

  result.rods.push({
    id: key,
    name,
    lore,
    maxDurability: rod['max-durability'],
    effects,
    image: `/src/assets/images/fishing/${key}.png`
  });
}

fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`Successfully compiled fishing configurations to ${jsonPath}`);
