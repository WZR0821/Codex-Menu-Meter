// 离线启动的已核实基线；运行时优先合并 Codex 自己更新的可用模型目录。
const BASE_MODELS = [
  { slug: 'gpt-6.1-sol', efforts: ['medium', 'max'] },
  { slug: 'gpt-6-astra', efforts: ['medium', 'max'] },
  { slug: 'gpt-6-luna', efforts: ['medium', 'max'] }
];

function modelVersion(label) {
  return (String(label || '').match(/gpt[-\s]?(\d+(?:\.\d+)*)/i)?.[1] || '0').split('.').map(Number);
}

function compareModelVersions(left, right) {
  const a = modelVersion(left);
  const b = modelVersion(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (b[index] || 0) - (a[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function modelFamily(label) {
  return String(label || '').toLowerCase().match(/(?:^|[\s-])(sol|terra|luna|astra)(?:$|[\s-])/)?.[1] || 'other';
}

function readModelCatalog(cache) {
  const bySlug = new Map(BASE_MODELS.map((model) => [model.slug, model]));
  for (const model of Array.isArray(cache?.models) ? cache.models : []) {
    const slug = String(model?.slug || '').toLowerCase();
    if (model.visibility !== 'list' || !/^gpt-\d+(?:\.\d+)*(?:-[a-z\d-]+)?$/.test(slug)) continue;
    const supported = (model.supported_reasoning_levels || []).map((level) => String(level.effort || '').toLowerCase());
    // 保留最常用/最强两个档位；其他实测档位仍由雷达原样提供。
    const efforts = ['medium', 'max'].filter((effort) => supported.includes(effort));
    if (!efforts.length && supported.length) efforts.push(supported.includes('xhigh') ? 'xhigh' : supported[0]);
    bySlug.set(slug, { slug, efforts });
  }
  return [...bySlug.values()];
}

function mergeCatalogItems(radarItems, catalog) {
  const items = radarItems.filter((item) => !item.catalogOnly).map((item) => ({ ...item }));
  for (const model of catalog) {
    const modelLabel = model.slug.replace(/^gpt/i, 'GPT').replace(/-(?=[a-z])/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    for (const reasoningEffort of model.efforts) {
      const existing = items.find((item) => item.modelLabel.toLowerCase() === modelLabel.toLowerCase()
        && String(item.reasoningEffort || '').toLowerCase() === reasoningEffort);
      if (existing) {
        existing.modelId = model.slug;
        continue;
      }
      items.push({
        label: `${modelLabel} ${reasoningEffort}`, modelLabel, modelId: model.slug, reasoningEffort,
        score: null, status: 'unknown', passed: null, tasks: null,
        averageCostUsd: null, averageTaskSeconds: null, sampleCount24h: null, recentScores: [],
        catalogOnly: true
      });
    }
  }
  const newestByFamily = new Map();
  for (const item of items.slice().sort((a, b) => compareModelVersions(a.modelLabel, b.modelLabel))) {
    const family = modelFamily(item.modelLabel);
    if (!newestByFamily.has(family)) newestByFamily.set(family, item.modelLabel);
  }
  const currentGeneration = Math.max(0, ...items.map((item) => modelVersion(item.modelLabel)[0]));
  return items.map((item) => ({
    ...item,
    isLatest: newestByFamily.get(modelFamily(item.modelLabel)) === item.modelLabel,
    isCurrentGeneration: modelVersion(item.modelLabel)[0] === currentGeneration
  }));
}

function latestFamilyItem(items, family, reasoningEffort) {
  const candidates = items.filter((item) => modelFamily(item.modelLabel) === family);
  candidates.sort((a, b) => compareModelVersions(a.modelLabel, b.modelLabel));
  const modelLabel = candidates[0]?.modelLabel;
  if (!modelLabel) return null;
  return candidates.find((item) => item.modelLabel === modelLabel && item.reasoningEffort === reasoningEffort)
    || candidates.find((item) => item.modelLabel === modelLabel);
}

module.exports = { readModelCatalog, mergeCatalogItems, latestFamilyItem, compareModelVersions };
