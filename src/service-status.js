// 官方状态页（Atlassian Statuspage 的 /api/v2/summary.json）解析。
// 只看和本应用相关的组件：整页指示灯常因无关产品（例如网页端连接器）变黄，不能直接拿来报警。

const STATUS_PAGES = {
  claude: {
    url: 'https://status.claude.com/api/v2/summary.json',
    home: 'https://status.claude.com/',
    components: [/^claude code$/i, /^claude api\b/i],
    incidentPattern: /claude code|claude api|api\.anthropic|oauth|login|rate limit/i
  },
  codex: {
    url: 'https://status.openai.com/api/v2/summary.json',
    home: 'https://status.openai.com/',
    components: [/codex/i, /^responses$/i, /^login$/i],
    incidentPattern: /codex|responses|login|rate limit/i
  }
};

const COMPONENT_LEVEL = {
  operational: 'none',
  degraded_performance: 'minor',
  partial_outage: 'major',
  major_outage: 'critical',
  under_maintenance: 'maintenance'
};
const LEVEL_RANK = { none: 0, maintenance: 1, minor: 2, major: 3, critical: 4 };

function worstLevel(levels) {
  return levels.reduce((worst, level) => (LEVEL_RANK[level] > LEVEL_RANK[worst] ? level : worst), 'none');
}

function normalizeStatusSummary(raw, provider) {
  const page = STATUS_PAGES[provider];
  if (!page || !raw || typeof raw !== 'object' || !Array.isArray(raw.components)) return null;
  const seen = new Set();
  const components = [];
  for (const component of raw.components) {
    const name = String(component?.name || '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    if (!page.components.some((pattern) => pattern.test(name))) continue;
    seen.add(name.toLowerCase());
    components.push({
      name,
      status: String(component.status || 'operational'),
      level: COMPONENT_LEVEL[component.status] || 'none'
    });
  }
  const relevantNames = new Set(components.map((component) => component.name.toLowerCase()));
  const incidents = (Array.isArray(raw.incidents) ? raw.incidents : [])
    .filter((incident) => incident && incident.status !== 'resolved' && incident.status !== 'postmortem')
    .filter((incident) => {
      const affected = Array.isArray(incident.components) ? incident.components.map((item) => String(item?.name || '').toLowerCase()) : [];
      if (affected.length) return affected.some((name) => relevantNames.has(name));
      return page.incidentPattern.test(String(incident.name || ''));
    })
    .slice(0, 3)
    .map((incident) => ({
      name: String(incident.name || '').slice(0, 160),
      impact: ['none', 'minor', 'major', 'critical', 'maintenance'].includes(incident.impact) ? incident.impact : 'minor',
      status: String(incident.status || ''),
      updatedAt: Date.parse(incident.updated_at || incident.created_at) || null
    }));
  const level = worstLevel([
    ...components.map((component) => component.level),
    ...incidents.map((incident) => incident.impact === 'none' ? 'minor' : incident.impact)
  ]);
  return {
    provider,
    level,
    components,
    incidents,
    pageIndicator: String(raw.status?.indicator || 'none'),
    pageDescription: String(raw.status?.description || '').slice(0, 120),
    home: page.home
  };
}

module.exports = { STATUS_PAGES, normalizeStatusSummary, worstLevel };
