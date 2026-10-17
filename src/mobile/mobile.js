const TEXT = {
  'zh-CN': {
    connecting: '正在连接 Mac',
    live: 'Mac 在线 · 实时同步',
    offline: 'Mac 已离线',
    cloudConnecting: '正在读取加密快照',
    cloudLive: '加密同步 · {time}',
    cloudOffline: '云端暂不可用 · 上次 {time}',
    cloudReadOnly: '端到端加密 · 只读同步',
    pairingKicker: '端到端加密',
    pairingTitle: '连接用量面板',
    pairingCopy: '扫描电脑设置中的二维码，或输入恢复码。',
    pairingInput: '恢复码',
    pairingSubmit: '连接',
    pairingNote: '密钥只保存在这个浏览器中',
    pairingInvalid: '恢复码无效，请从电脑端重新复制',
    pairingFailed: '连接失败，请稍后重试',
    unpair: '解除此设备',
    unpairConfirm: '解除后需要重新扫描二维码才能查看。确定继续吗？',
    usage: '用量',
    radar: '雷达',
    usageTitle: '{name} 额度',
    tokenTitle: 'Token 活动',
    iqTitle: '今日 IQ',
    radarTitle: '额度雷达',
    radarSubtabIntelligence: '智力',
    radarSubtabQuota: '额度',
    radarSubtabReset: '重置',
    recommendedModel: '推荐模型',
    recommendedMeta: 'IQ {score} · 推理强度 {reasoning}',
    recommendedWaiting: '等待模型样本',
    degradationAlert: '降智预警',
    degradationMonitoring: '样本积累中',
    degradationStable: '当前稳定',
    degradationWatch: '{model} 下降 {delta} IQ',
    degradationWarning: '{model} 下降 {delta} IQ，请留意',
    iqModelsTitle: '模型 IQ',
    iqSortIq: 'IQ',
    iqSortValue: '性价比',
    iqSortSpeed: '速度',
    iqMetricReasoning: '推理',
    iqMetricCost: '平均费用',
    iqMetricTime: '平均耗时',
    iqMetricSamples: '24h 样本',
    metricPending: '待收集',
    secondsShort: '秒',
    minutesShort: '分钟',
    hoursShort: '小时',
    expandModels: '展开其余 {n} 个模型',
    collapseModels: '收起模型',
    modelGroupSol: 'Sol',
    modelGroupAstra: 'Astra',
    latestModels: '最新：{models}',
    onlyLatestModels: '仅看最新',
    allModels: '全部模型',
    iqMetricGraded: '已判题次',
    sourceDetails: '筛选与数据说明',
    activityDetails: '统计详情',
    quotaDetails: '使用明细',
    metricCoverage: '测评覆盖',
    radarAttention: '数据需留意 · 展开数据说明查看',
    radarPartialShort: '已读取 {n}/{total} 个档位',
    radarCoverage: '覆盖 {n}/{total} 题',
    radarReadAt: '读取 {t}',
    radarBenchNotice: '与原站当前雷达分同源（满分 150）；题次为累计已判题次，非 24h 样本。',
    radarPartialRead: '本轮已读取 {n}/{total} 个档位，其余保留缓存或待下次读取。',
    radarCostEvidence: '平均 API 等价费用；已知样本 {n}/{total}，缺失值不当作零；非订阅实扣。',
    radarSourceStale: '数据源测评停留于 {date}，下方为历史实测，非当前实时 IQ。',
    radarLatestPending: '新模型尚无实测 IQ，点击“全部模型”可查看历史实测。',
    modelGroupTerra: 'Terra',
    modelGroupLuna: 'Luna',
    modelGroupOther: '其他',
    noIqData: '暂无 IQ 数据',
    passedRatio: '{p} / {t} 通过',
    modelUsageTitle: '模型消耗',
    modelUsagePeriod: '最近采样日',
    modelUsageModel: '模型',
    modelUsageTokens: 'Token',
    modelUsageShare: '占比',
    modelUsageEstimate: '估算成本',
    modelUsageTotal: '最近一天共 {v}',
    modelUsageNoActivity: '暂无 Token 活动',
    modelUsageEstimatedTotal: '估算 {v}',
    modelUsageAvgCost: '均价 {v}',
    modelUsageSampleCount: '{n} 样本',
    modelUsageUnavailable: '基准待收集',
    noQuotaRadar: '暂无额度雷达数据',
    calibTitle: '额度校准',
    calibStatus: '已校准',
    calibNone: '暂无校准说明',
    srcTitle: '数据来源',
    sourceStatus: '外部来源',
    attributionClaude: '数据来自 Claude Code 雷达 claudecoderadar.com',
    noRadarNotes: '暂无雷达说明数据',
    resetTimelineTitle: '最近的重置状态',
    statusAvailable: '可用',
    statusRedeemed: '已使用',
    statusExpired: '已过期',
    statusUnknown: '未知',
    expiresAt: '到期 {t}',
    noExpiry: '暂无到期时间',
    creditsAvailable: '当前可用 {n} 张重置卡',
    noResetCards: '暂无重置卡数据',
    recentDays: '近 30 天',
    updated: '更新 {time}',
    remaining: '{label} 剩余',
    label5h: '5 小时',
    labelWeek: '一周',
    noReset: '暂无重置时间',
    resetAt: '{time} 重置',
    today: '今日 Token',
    total: '近 30 天',
    io: '读写 {value}',
    cacheHit: '缓存命中率 {value}',
    cacheHitHint: '缓存读取 Token 占总输入 Token 的比例；≥99% 绿色，95–99% 黄色，<95% 红色',
    windowUsage5h: '5h Token',
    windowUsageWeek: '周 Token',
    totalShort: '总 {value}',
    cacheHitShort: '命中 {value}',
    sessions: '{count} 个会话',
    cost: '约 {value}',
    noData: '暂无数据',
    passed: '{passed}/{tasks} 通过',
    readOnly: '只读安全连接',
    refreshing: '正在让 Mac 刷新数据',
    refreshFailed: '刷新请求失败',
    unauthorized: '访问密钥无效，请从电脑端重新复制链接',
    sourceCodex: 'Codex Radar',
    sourceClaude: 'Claude Radar',
    measured: '实测额度',
    sharedUsed: '共享用量',
    reset: '重置',
    tier: '套餐',
    unavailable: '不可用'
  },
  'en-US': {
    connecting: 'Connecting to Mac',
    live: 'Mac online · Live sync',
    offline: 'Mac offline',
    cloudConnecting: 'Reading encrypted snapshot',
    cloudLive: 'Encrypted sync · {time}',
    cloudOffline: 'Cloud unavailable · Last {time}',
    cloudReadOnly: 'End-to-end encrypted · Read only',
    pairingKicker: 'End-to-end encrypted',
    pairingTitle: 'Connect usage dashboard',
    pairingCopy: 'Scan the QR code in Mac settings or enter the recovery code.',
    pairingInput: 'Recovery code',
    pairingSubmit: 'Connect',
    pairingNote: 'The key stays in this browser only',
    pairingInvalid: 'Invalid recovery code. Copy a new one from the Mac.',
    pairingFailed: 'Unable to connect. Try again shortly.',
    unpair: 'Unpair this device',
    unpairConfirm: 'You will need to scan the QR code again. Continue?',
    usage: 'Usage',
    radar: 'Radar',
    usageTitle: '{name} quota',
    tokenTitle: 'Token activity',
    iqTitle: "Today's IQ",
    radarTitle: 'Quota radar',
    radarSubtabIntelligence: 'Intelligence',
    radarSubtabQuota: 'Quota',
    radarSubtabReset: 'Reset',
    recommendedModel: 'Recommended model',
    recommendedMeta: 'IQ {score} · Reasoning {reasoning}',
    recommendedWaiting: 'Waiting for model samples',
    degradationAlert: 'Degradation alert',
    degradationMonitoring: 'Collecting samples',
    degradationStable: 'Stable',
    degradationWatch: '{model} down {delta} IQ',
    degradationWarning: '{model} down {delta} IQ — watch closely',
    iqModelsTitle: 'Model IQ',
    iqSortIq: 'IQ',
    iqSortValue: 'Value',
    iqSortSpeed: 'Speed',
    iqMetricReasoning: 'Reasoning',
    iqMetricCost: 'Avg. cost',
    iqMetricTime: 'Avg. time',
    iqMetricSamples: 'Samples',
    metricPending: 'Pending',
    secondsShort: 's',
    minutesShort: 'm',
    hoursShort: 'h',
    expandModels: 'Show {n} more models',
    collapseModels: 'Show fewer models',
    modelGroupSol: 'Sol',
    modelGroupAstra: 'Astra',
    latestModels: 'Latest: {models}',
    onlyLatestModels: 'Latest only',
    allModels: 'All models',
    iqMetricGraded: 'Graded runs',
    sourceDetails: 'Filters & data notes',
    activityDetails: 'Activity details',
    quotaDetails: 'Usage details',
    metricCoverage: 'Coverage',
    radarAttention: 'Data needs attention · expand data notes',
    radarPartialShort: '{n}/{total} selections loaded',
    radarCoverage: '{n}/{total} tasks covered',
    radarReadAt: 'Read {t}',
    radarBenchNotice: 'Current RadarBench score, out of 150. Graded counts are cumulative, not 24h samples.',
    radarPartialRead: 'Read {n}/{total} selections; others keep cached values or await the next read.',
    radarCostEvidence: 'Mean API-equivalent cost; {n}/{total} samples have cost evidence. Missing values are not zero; not subscription charges.',
    radarSourceStale: 'Measurements last updated {date}. Historical scores, not current live IQ.',
    radarLatestPending: 'No measured IQ for the latest models yet. Select All models for historical measurements.',
    modelGroupTerra: 'Terra',
    modelGroupLuna: 'Luna',
    modelGroupOther: 'Other',
    noIqData: 'No IQ data',
    passedRatio: '{p}/{t} passed',
    modelUsageTitle: 'Model usage',
    modelUsagePeriod: 'Latest sample day',
    modelUsageModel: 'Model',
    modelUsageTokens: 'Tokens',
    modelUsageShare: 'Share',
    modelUsageEstimate: 'Est. cost',
    modelUsageTotal: '{v} in the latest day',
    modelUsageNoActivity: 'No token activity',
    modelUsageEstimatedTotal: 'Est. {v}',
    modelUsageAvgCost: 'Avg {v}',
    modelUsageSampleCount: '{n} samples',
    modelUsageUnavailable: 'Benchmark pending',
    noQuotaRadar: 'No quota radar data',
    calibTitle: 'Quota calibration',
    calibStatus: 'Calibrated',
    calibNone: 'No calibration notes',
    srcTitle: 'Data source',
    sourceStatus: 'External source',
    attributionClaude: 'Data from Claude Code Radar (claudecoderadar.com)',
    noRadarNotes: 'No radar notes yet',
    resetTimelineTitle: 'Recent reset status',
    statusAvailable: 'Available',
    statusRedeemed: 'Used',
    statusExpired: 'Expired',
    statusUnknown: 'Unknown',
    expiresAt: 'Expires {t}',
    noExpiry: 'No expiry',
    creditsAvailable: '{n} reset credits available',
    noResetCards: 'No reset credit data',
    recentDays: 'Last 30 days',
    updated: 'Updated {time}',
    remaining: '{label} left',
    label5h: '5 hours',
    labelWeek: 'One week',
    noReset: 'No reset time',
    resetAt: 'Resets {time}',
    today: 'Today',
    total: 'Last 30 days',
    io: 'I/O {value}',
    cacheHit: 'Cache hit {value}',
    cacheHitHint: 'Cached input as a share of all input; green at 99% and above, yellow at 95–99%, red below 95%',
    windowUsage5h: '5h Token',
    windowUsageWeek: 'Week Token',
    totalShort: 'Total {value}',
    cacheHitShort: 'Hit {value}',
    sessions: '{count} sessions',
    cost: 'Approx. {value}',
    noData: 'No data yet',
    passed: '{passed}/{tasks} passed',
    readOnly: 'Secure read-only link',
    refreshing: 'Refreshing data on Mac',
    refreshFailed: 'Refresh request failed',
    unauthorized: 'Invalid access key. Copy a new link from the Mac app.',
    sourceCodex: 'Codex Radar',
    sourceClaude: 'Claude Radar',
    measured: 'Measured',
    sharedUsed: 'Shared use',
    reset: 'Reset',
    tier: 'Tier',
    unavailable: 'Unavailable'
  },
  'ja-JP': {
    connecting: 'Mac に接続中',
    live: 'Mac オンライン · ライブ同期',
    offline: 'Mac オフライン',
    cloudConnecting: '暗号化スナップショットを取得中',
    cloudLive: '暗号化同期 · {time}',
    cloudOffline: 'クラウド接続不可 · 最終 {time}',
    cloudReadOnly: 'エンドツーエンド暗号化 · 読み取り専用',
    pairingKicker: 'エンドツーエンド暗号化',
    pairingTitle: '使用量パネルを接続',
    pairingCopy: 'Mac設定のQRコードを読み取るか、復旧コードを入力してください。',
    pairingInput: '復旧コード',
    pairingSubmit: '接続',
    pairingNote: 'キーはこのブラウザ内だけに保存されます',
    pairingInvalid: '復旧コードが無効です。Macから再度コピーしてください。',
    pairingFailed: '接続できません。しばらくしてから再試行してください。',
    unpair: 'この端末の連携を解除',
    unpairConfirm: '再度QRコードの読み取りが必要になります。続行しますか？',
    usage: '使用量',
    radar: 'レーダー',
    usageTitle: '{name} クォータ',
    tokenTitle: 'Token アクティビティ',
    iqTitle: '今日の IQ',
    radarTitle: 'クォータレーダー',
    radarSubtabIntelligence: '知能',
    radarSubtabQuota: 'クォータ',
    radarSubtabReset: 'リセット',
    recommendedModel: 'おすすめモデル',
    recommendedMeta: 'IQ {score} · 推論強度 {reasoning}',
    recommendedWaiting: 'モデルサンプル待ち',
    degradationAlert: '性能低下アラート',
    degradationMonitoring: 'サンプル収集中',
    degradationStable: '安定',
    degradationWatch: '{model} は IQ {delta} 低下',
    degradationWarning: '{model} は IQ {delta} 低下。要確認',
    iqModelsTitle: 'モデル IQ',
    iqSortIq: 'IQ',
    iqSortValue: 'コスパ',
    iqSortSpeed: '速度',
    iqMetricReasoning: '推論',
    iqMetricCost: '平均コスト',
    iqMetricTime: '平均時間',
    iqMetricSamples: 'サンプル',
    metricPending: '収集中',
    secondsShort: '秒',
    minutesShort: '分',
    hoursShort: '時間',
    expandModels: '残り {n} モデルを表示',
    collapseModels: '折りたたむ',
    modelGroupSol: 'Sol',
    modelGroupAstra: 'Astra',
    latestModels: '最新：{models}',
    onlyLatestModels: '最新のみ',
    allModels: '全モデル',
    iqMetricGraded: '累計採点数',
    sourceDetails: '絞り込みとデータについて',
    activityDetails: '利用の詳細',
    quotaDetails: '使用内訳',
    metricCoverage: '測定範囲',
    radarAttention: 'データに注意・詳細をご確認ください',
    radarPartialShort: '{n}/{total} 段階を取得済み',
    radarCoverage: '{n}/{total}問をカバー',
    radarReadAt: '取得 {t}',
    radarBenchNotice: '原サイトの現在のレーダースコア（150点満点）。採点数は累計で24時間サンプルではありません。',
    radarPartialRead: '今回{n}/{total}設定を取得。他はキャッシュを保持するか次回取得を待機。',
    radarCostEvidence: '平均API換算費用。既知サンプル{n}/{total}。欠損はゼロ扱いせず、実際のサブスク課金ではありません。',
    radarSourceStale: '測定更新は{date}までです。過去の実測値であり、現在のIQではありません。',
    radarLatestPending: '最新モデルの実測IQは未公開です。「全モデル」で過去の実測値を表示できます。',
    modelGroupTerra: 'Terra',
    modelGroupLuna: 'Luna',
    modelGroupOther: 'その他',
    noIqData: 'IQ データがありません',
    passedRatio: '{p}/{t} 合格',
    modelUsageTitle: 'モデル消費',
    modelUsagePeriod: '最新サンプル日',
    modelUsageModel: 'モデル',
    modelUsageTokens: 'Token',
    modelUsageShare: '割合',
    modelUsageEstimate: '推定コスト',
    modelUsageTotal: '最新日の合計 {v}',
    modelUsageNoActivity: 'トークン活動なし',
    modelUsageEstimatedTotal: '推定 {v}',
    modelUsageAvgCost: '平均 {v}',
    modelUsageSampleCount: '{n} サンプル',
    modelUsageUnavailable: 'ベンチマーク待ち',
    noQuotaRadar: 'クォータレーダーのデータがありません',
    calibTitle: 'クォータ校正',
    calibStatus: '校正済み',
    calibNone: '校正情報なし',
    srcTitle: 'データ提供',
    sourceStatus: '外部ソース',
    attributionClaude: 'データ提供：Claude Code レーダー claudecoderadar.com',
    noRadarNotes: 'レーダー情報がありません',
    resetTimelineTitle: '最近のリセット状況',
    statusAvailable: '利用可',
    statusRedeemed: '使用済み',
    statusExpired: '期限切れ',
    statusUnknown: '不明',
    expiresAt: '期限 {t}',
    noExpiry: '期限情報なし',
    creditsAvailable: '利用可能なリセットカード {n} 枚',
    noResetCards: 'リセットカードのデータがありません',
    recentDays: '直近 30 日',
    updated: '{time} 更新',
    remaining: '{label} 残量',
    label5h: '5 時間',
    labelWeek: '1 週間',
    noReset: 'リセット時刻なし',
    resetAt: '{time} リセット',
    today: '今日の Token',
    total: '直近 30 日',
    io: '読み書き {value}',
    cacheHit: 'キャッシュヒット率 {value}',
    cacheHitHint: '全入力 Token に占めるキャッシュ読み取りの割合。99% 以上は緑、95–99% は黄、95% 未満は赤',
    windowUsage5h: '5h Token',
    windowUsageWeek: '週間 Token',
    totalShort: '合計 {value}',
    cacheHitShort: 'ヒット {value}',
    sessions: '{count} セッション',
    cost: '約 {value}',
    noData: 'データがありません',
    passed: '{passed}/{tasks} 合格',
    readOnly: '安全な読み取り専用接続',
    refreshing: 'Mac のデータを更新中',
    refreshFailed: '更新リクエストに失敗',
    unauthorized: 'アクセスキーが無効です。Mac からリンクを再取得してください。',
    sourceCodex: 'Codex Radar',
    sourceClaude: 'Claude Radar',
    measured: '実測',
    sharedUsed: '共有使用量',
    reset: 'リセット',
    tier: 'プラン',
    unavailable: '利用不可'
  }
};

const els = {
  connectionLabel: document.getElementById('connectionLabel'),
  refreshButton: document.getElementById('refreshButton'),
  providerSwitch: document.getElementById('providerSwitch'),
  viewSwitch: document.querySelector('.view-switch'),
  viewButtons: [...document.querySelectorAll('.view-button')],
  views: [...document.querySelectorAll('.view')],
  usageHeading: document.getElementById('usageHeading'),
  usageUpdated: document.getElementById('usageUpdated'),
  quotaGrid: document.getElementById('quotaGrid'),
  tokenUpdated: document.getElementById('tokenUpdated'),
  tokenCard: document.getElementById('tokenCard'),
  radarSubtabs: [...document.querySelectorAll('.radar-subtab')],
  radarSubviews: [...document.querySelectorAll('.radar-subview')],
  recommendedTitle: document.getElementById('recommendedTitle'),
  recommendedModel: document.getElementById('recommendedModel'),
  recommendedMeta: document.getElementById('recommendedMeta'),
  iqDegradeTitle: document.getElementById('iqDegradeTitle'),
  iqDegradeAlert: document.getElementById('iqDegradeAlert'),
  iqDegradeValue: document.getElementById('iqDegradeValue'),
  iqTitle: document.getElementById('iqTitle'),
  iqSortButtons: [...document.querySelectorAll('[data-iq-sort]')],
  expandModels: document.getElementById('expandModels'),
  iqUpdated: document.getElementById('iqUpdated'),
  iqList: document.getElementById('iqList'),
  modelCatalogNotice: document.getElementById('modelCatalogNotice'),
  radarDataNotice: document.getElementById('radarDataNotice'),
  radarBriefStatus: document.getElementById('radarBriefStatus'),
  modelCatalogNames: document.getElementById('modelCatalogNames'),
  latestModelsFilter: document.getElementById('latestModelsFilter'),
  modelUsageTitle: document.getElementById('modelUsageTitle'),
  modelUsagePeriod: document.getElementById('modelUsagePeriod'),
  modelUsageSummary: document.getElementById('modelUsageSummary'),
  modelUsageRows: document.getElementById('modelUsageRows'),
  quotaRadarTitle: document.getElementById('quotaRadarTitle'),
  radarSource: document.getElementById('radarSource'),
  radarCard: document.getElementById('radarCard'),
  resetTitle: document.getElementById('resetTitle'),
  resetSource: document.getElementById('resetSource'),
  resetCards: document.getElementById('resetCards'),
  footerStatus: document.getElementById('footerStatus'),
  toast: document.getElementById('toast'),
  pairingGate: document.getElementById('pairingGate'),
  pairingKicker: document.getElementById('pairingKicker'),
  pairingTitle: document.getElementById('pairingTitle'),
  pairingCopy: document.getElementById('pairingCopy'),
  pairingInputLabel: document.getElementById('pairingInputLabel'),
  pairingInput: document.getElementById('pairingInput'),
  pairingSubmit: document.getElementById('pairingSubmit'),
  pairingNote: document.getElementById('pairingNote'),
  syncDeviceButton: document.getElementById('syncDeviceButton')
};

const SYNC_DATABASE = 'cmm-mobile-sync';
const SYNC_STORE = 'private';
const SYNC_CREDENTIAL_KEY = 'credentials';
const SYNC_ENVELOPE_KEY = 'last-envelope';
const CLOUD_POLL_MS = 30_000;
let accessToken = '';
let currentState = null;
let provider = 'codex';
let activeView = 'usage';
let activeRadarView = 'intelligence';
const radarSortByProvider = {};
const radarExpandedByProvider = {};
const radarLatestByProvider = {};
const selectedDayByProvider = {};
const sectionSignatures = new Map();
const renderedMarkup = new WeakMap();
const disclosureState = new Map();

function restoreDisclosures(root = document) {
  root.querySelectorAll('details[data-detail]').forEach((detail) => {
    detail.dataset.detailOwner = provider;
    detail.open = disclosureState.get(`${provider}:${detail.dataset.detail}`) || false;
  });
}

document.addEventListener('toggle', (event) => {
  const detail = event.target;
  if (detail.matches?.('details[data-detail]')) {
    disclosureState.set(`${detail.dataset.detailOwner}:${detail.dataset.detail}`, detail.open);
  }
}, true);

function detailMetric(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}
let renderFrame = null;
let eventSource = null;
let reconnectTimer = null;
let toastTimer = null;
let lang = 'zh-CN';
let connectionMode = 'local';
let syncCredentials = null;
let syncEtag = '';
let syncUpdatedAt = null;
let syncPollTimer = null;
let pairingFragmentInvalid = false;

function T(key, params = {}) {
  const table = TEXT[lang] || TEXT['zh-CN'];
  return String(table[key] || TEXT['zh-CN'][key] || key).replace(/\{(\w+)\}/g, (_match, name) => params[name] ?? '');
}

function renderSection(key, dependencies, renderContent) {
  const signature = JSON.stringify([provider, lang, ...dependencies]);
  if (sectionSignatures.get(key) === signature) return;
  renderContent();
  sectionSignatures.set(key, signature);
}

function updateHtml(element, markup) {
  if (renderedMarkup.get(element) === markup) return false;
  element.innerHTML = markup;
  restoreDisclosures(element);
  renderedMarkup.set(element, markup);
  return true;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function openSyncDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SYNC_STORE)) {
        request.result.createObjectStore(SYNC_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_failed'));
  });
}

async function readPrivateValue(key) {
  const database = await openSyncDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SYNC_STORE, 'readonly');
    const request = transaction.objectStore(SYNC_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('indexeddb_failed'));
    transaction.oncomplete = () => database.close();
  });
}

async function writePrivateValue(key, value) {
  const database = await openSyncDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SYNC_STORE, 'readwrite');
    transaction.objectStore(SYNC_STORE).put(value, key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error || new Error('indexeddb_failed'));
  });
}

async function clearPrivateValues() {
  const database = await openSyncDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SYNC_STORE, 'readwrite');
    transaction.objectStore(SYNC_STORE).clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error || new Error('indexeddb_failed'));
  });
}

function pairingCodeFromHash() {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!hash) return '';
  const params = new URLSearchParams(hash);
  return params.get('pair') || '';
}

function clearPairingFragment() {
  if (!location.hash) return;
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}

function readAccessToken() {
  const queryToken = new URLSearchParams(location.search).get('token') || '';
  const rawHash = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const hashToken = rawHash && !rawHash.includes('=') ? rawHash : '';
  const urlToken = queryToken || hashToken;
  if (urlToken) {
    localStorage.setItem('cmm-mobile-token', urlToken);
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.href = `/mobile/manifest.webmanifest?token=${encodeURIComponent(urlToken)}`;
  }
  return urlToken || localStorage.getItem('cmm-mobile-token') || '';
}

function renderPairingText(messageKey = 'pairingNote', error = false) {
  els.pairingKicker.textContent = T('pairingKicker');
  els.pairingTitle.textContent = T('pairingTitle');
  els.pairingCopy.textContent = T('pairingCopy');
  els.pairingInputLabel.textContent = T('pairingInput');
  els.pairingSubmit.textContent = T('pairingSubmit');
  els.pairingNote.textContent = T(messageKey);
  els.pairingNote.classList.toggle('error', error);
}

function showPairingGate(messageKey = 'pairingNote', error = false) {
  document.body.classList.add('unpaired');
  document.body.classList.remove('ready');
  els.pairingGate.hidden = false;
  renderPairingText(messageKey, error);
}

function hidePairingGate() {
  document.body.classList.remove('unpaired');
  els.pairingGate.hidden = true;
  els.pairingNote.classList.remove('error');
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(path, { ...options, headers, cache: 'no-store' });
  if (response.status === 401) throw new Error('unauthorized');
  if (!response.ok) throw new Error(`http_${response.status}`);
  return response.json();
}

function setConnection(connected) {
  document.body.classList.toggle('offline', !connected);
  if (connectionMode === 'cloud') {
    const time = syncUpdatedAt ? formatClock(syncUpdatedAt) : '--';
    els.connectionLabel.textContent = connected
      ? T('cloudLive', { time })
      : T('cloudOffline', { time });
    return;
  }
  els.connectionLabel.textContent = connected ? T('live') : T('offline');
}

function connectEvents() {
  eventSource?.close();
  clearTimeout(reconnectTimer);
  const eventUrl = accessToken
    ? `/api/events?token=${encodeURIComponent(accessToken)}`
    : '/api/events';
  eventSource = new EventSource(eventUrl);
  eventSource.addEventListener('state', (event) => {
    try {
      applyState(JSON.parse(event.data));
      setConnection(true);
    } catch {
      setConnection(false);
    }
  });
  eventSource.onerror = () => {
    setConnection(false);
    eventSource?.close();
    reconnectTimer = window.setTimeout(connectEvents, 5000);
  };
}

async function refreshCloudState() {
  if (!syncCredentials) throw new Error('unpaired');
  const { authToken } = await window.CMM_SYNC_CRYPTO.deriveMaterial(syncCredentials);
  const headers = new Headers({ Authorization: `Bearer ${authToken}` });
  if (syncEtag) headers.set('If-None-Match', syncEtag);
  const response = await fetch(`/v1/snapshots/${encodeURIComponent(syncCredentials.accountId)}`, {
    headers,
    cache: 'no-store'
  });
  if (response.status === 304) {
    setConnection(true);
    return currentState;
  }
  if (response.status === 401) throw new Error('unauthorized');
  if (!response.ok) throw new Error(`http_${response.status}`);
  const envelope = await response.json();
  const payload = await window.CMM_SYNC_CRYPTO.decryptPayload(envelope, syncCredentials);
  if (Number(payload?.version) !== 1 || !payload?.providers) throw new Error('invalid_snapshot');
  syncEtag = response.headers.get('etag') || '';
  syncUpdatedAt = Number(envelope.updatedAt) || null;
  await writePrivateValue(SYNC_ENVELOPE_KEY, envelope);
  applyState(payload);
  hidePairingGate();
  setConnection(true);
  return payload;
}

async function applyCachedCloudState() {
  const envelope = await readPrivateValue(SYNC_ENVELOPE_KEY);
  if (!envelope || !syncCredentials) return false;
  try {
    const payload = await window.CMM_SYNC_CRYPTO.decryptPayload(envelope, syncCredentials);
    syncUpdatedAt = Number(envelope.updatedAt) || null;
    applyState(payload);
    setConnection(false);
    return true;
  } catch {
    return false;
  }
}

function scheduleCloudPolling() {
  clearInterval(syncPollTimer);
  syncPollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') refreshCloudState().catch(() => setConnection(false));
  }, CLOUD_POLL_MS);
}

async function loadCloudCredentials() {
  const fragmentCode = pairingCodeFromHash();
  if (fragmentCode) {
    try {
      const credentials = window.CMM_SYNC_CRYPTO.parsePairingCode(fragmentCode);
      await writePrivateValue(SYNC_CREDENTIAL_KEY, credentials);
      clearPairingFragment();
      return credentials;
    } catch {
      pairingFragmentInvalid = true;
      clearPairingFragment();
      return null;
    }
  }
  return readPrivateValue(SYNC_CREDENTIAL_KEY);
}

async function startCloudMode() {
  connectionMode = 'cloud';
  document.body.classList.add('cloud-mode');
  els.syncDeviceButton.hidden = false;
  els.connectionLabel.textContent = T('cloudConnecting');
  selectView(activeView);
  syncCredentials = await loadCloudCredentials();
  if (!syncCredentials) {
    showPairingGate(pairingFragmentInvalid ? 'pairingInvalid' : 'pairingNote', pairingFragmentInvalid);
    return;
  }
  hidePairingGate();
  const cached = await applyCachedCloudState();
  scheduleCloudPolling();
  try {
    await refreshCloudState();
  } catch {
    if (!cached) showPairingGate('pairingFailed', true);
    else setConnection(false);
  }
}

async function submitPairingCode() {
  const value = els.pairingInput.value.trim();
  try {
    const credentials = window.CMM_SYNC_CRYPTO.parsePairingCode(value);
    await writePrivateValue(SYNC_CREDENTIAL_KEY, credentials);
    syncCredentials = credentials;
    els.pairingInput.value = '';
    hidePairingGate();
    els.connectionLabel.textContent = T('cloudConnecting');
    scheduleCloudPolling();
    await refreshCloudState();
  } catch (error) {
    showPairingGate(
      error.message === 'invalid_pairing_code' ? 'pairingInvalid' : 'pairingFailed',
      true
    );
  }
}

async function unpairCloudDevice() {
  if (!window.confirm(T('unpairConfirm'))) return;
  clearInterval(syncPollTimer);
  syncPollTimer = null;
  syncCredentials = null;
  syncEtag = '';
  syncUpdatedAt = null;
  currentState = null;
  await clearPrivateValues();
  showPairingGate();
}

function applyState(state) {
  const nextLanguage = TEXT[state.language] ? state.language : 'zh-CN';
  const languageChanged = !currentState || lang !== nextLanguage;
  currentState = state;
  lang = nextLanguage;
  document.documentElement.lang = lang;
  const providerIds = Object.keys(state.providers || {});
  if (!providerIds.includes(provider)) provider = providerIds[0] || 'codex';
  if (languageChanged) renderStaticText();
  renderProviders(providerIds);
  if (!renderFrame) renderFrame = window.requestAnimationFrame(() => {
    renderFrame = null;
    render();
  });
  if (!document.body.classList.contains('ready')) {
    window.requestAnimationFrame(() => {
      document.body.classList.add('ready');
    });
  }
}

function renderStaticText() {
  document.querySelectorAll('[data-ui-copy]').forEach((node) => { node.textContent = T(node.dataset.uiCopy); });
  els.viewButtons[0].textContent = T('usage');
  els.viewButtons[1].textContent = T('radar');
  els.footerStatus.textContent = T(connectionMode === 'cloud' ? 'cloudReadOnly' : 'readOnly');
  els.syncDeviceButton.title = T('unpair');
  els.syncDeviceButton.setAttribute('aria-label', T('unpair'));
  document.querySelector('.token-heading h2').textContent = T('tokenTitle');
  if (els.radarSubtabs[0]) els.radarSubtabs[0].textContent = T('radarSubtabIntelligence');
  if (els.radarSubtabs[1]) els.radarSubtabs[1].textContent = T('radarSubtabQuota');
  if (els.radarSubtabs[2]) els.radarSubtabs[2].textContent = T('radarSubtabReset');
  if (els.recommendedTitle) els.recommendedTitle.textContent = T('recommendedModel');
  if (els.iqDegradeTitle) els.iqDegradeTitle.textContent = T('degradationAlert');
  if (els.iqTitle) els.iqTitle.textContent = T('iqModelsTitle');
  if (els.modelUsageTitle) els.modelUsageTitle.textContent = T('modelUsageTitle');
  if (els.modelUsagePeriod) els.modelUsagePeriod.textContent = T('modelUsagePeriod');
  if (els.quotaRadarTitle) els.quotaRadarTitle.textContent = T('radarTitle');
  if (els.resetTitle) els.resetTitle.textContent = T('reset');
  const sortLabels = { iq: 'iqSortIq', value: 'iqSortValue', speed: 'iqSortSpeed' };
  els.iqSortButtons.forEach((button) => {
    button.textContent = T(sortLabels[button.dataset.iqSort] || 'iqSortIq');
  });
}

function renderProviders(providerIds) {
  const key = providerIds.join(',');
  if (els.providerSwitch.dataset.providers !== key) {
    els.providerSwitch.dataset.providers = key;
    els.providerSwitch.style.setProperty('--provider-count', providerIds.length || 1);
    els.providerSwitch.innerHTML = providerIds.map((id) => (
      `<button class="provider-button" type="button" data-provider="${escapeHtml(id)}">${escapeHtml(currentState.providers[id].label)}</button>`
    )).join('');
  }
  els.providerSwitch.style.setProperty('--provider-index', Math.max(0, providerIds.indexOf(provider)));
  els.providerSwitch.querySelectorAll('.provider-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.provider === provider);
  });
}

function render() {
  const providerData = currentState?.providers?.[provider];
  document.body.dataset.provider = provider;
  document.body.dataset.view = activeView;
  if (!providerData) return;
  restoreDisclosures();
  if (activeView === 'usage') {
    els.usageHeading.textContent = T('usageTitle', { name: providerData.label });
    renderSection('usage', [providerData.usage, providerData.activity?.data?.windows], () => renderUsage(providerData.usage, providerData.activity));
    renderSection('activity', [providerData.activity, selectedDayByProvider[provider], isoDate(new Date())], () => renderActivity(providerData.activity));
    return;
  }
  renderRadar(providerData.radar, providerData.usage, providerData.activity);
}

function renderUsage(usageSlice, activitySlice) {
  els.usageUpdated.textContent = formatUpdated(usageSlice?.fetchedAt);
  const usage = usageSlice?.data;
  if (!usage) {
    updateHtml(els.quotaGrid, empty(usageSlice?.error));
    return;
  }
  const activityWindows = activitySlice?.data?.windows || {};
  const cards = [];
  if (usage.fiveHourUnlimited) {
    cards.push(quotaTemplate({ remainingPercent: 100 }, T('label5h'), true, activityWindows.fiveHour, 'fiveHour'));
  } else if (usage.primaryWindow) {
    cards.push(quotaTemplate(usage.primaryWindow, T('label5h'), false, activityWindows.fiveHour, 'fiveHour'));
  }
  if (usage.secondaryWindow) {
    cards.push(quotaTemplate(usage.secondaryWindow, T('labelWeek'), false, activityWindows.week, 'week'));
  }
  for (const windowValue of usage.extraWindows || []) {
    cards.push(quotaTemplate(windowValue, windowValue.name || T('labelWeek')));
  }
  updateHtml(els.quotaGrid, cards.length ? cards.join('') : empty(usageSlice?.error));
}

function quotaTemplate(windowValue, label, unlimited = false, activityWindow = null, activityWindowKey = null) {
  const remaining = unlimited ? 100 : clamp(Math.round(Number(windowValue.remainingPercent) || 0), 0, 100);
  const color = remaining <= 20 ? 'var(--danger)' : remaining <= 50 ? 'var(--warning)' : 'var(--accent)';
  const reset = unlimited ? '∞' : windowValue.resetAt ? formatClock(windowValue.resetAt) : '--';
  const footer = unlimited ? 'Unlimited' : windowValue.resetAt
    ? T('resetAt', { time: formatDateTime(windowValue.resetAt) })
    : T('noReset');
  return `
    <article class="quota-card" style="--quota:${remaining}%; --quota-color:${color}">
      <div class="quota-top">
        <span>${escapeHtml(T('remaining', { label }))}</span>
        <span class="quota-reset">${escapeHtml(reset)}</span>
      </div>
      <strong class="quota-value">${unlimited ? '∞' : `${remaining}%`}</strong>
      <div class="quota-progress"><i></i></div>
      <small>${escapeHtml(footer)}</small>
      ${quotaActivityTemplate(activityWindowKey, activityWindow)}
    </article>
  `;
}

function quotaActivityTemplate(windowKey, activityWindow) {
  if (!activityWindow) return '';
  const tone = cacheHitTone(activityWindow.cachedInputTokens, activityWindow.inputTokens);
  const titleKey = windowKey === 'fiveHour' ? 'windowUsage5h' : 'windowUsageWeek';
  return `
    <details class="quota-activity inline-details" data-detail="quota-${escapeHtml(windowKey)}">
      <summary>${escapeHtml(T('quotaDetails'))}</summary>
      <div class="disclosure-content">
      <div class="quota-activity-head">
        <span>${escapeHtml(T(titleKey))}</span>
        <b>${escapeHtml(T('totalShort', { value: formatTokens(activityWindow.tokens, false) }))}</b>
      </div>
      <small>
        <span>${escapeHtml(T('io', { value: formatTokens(activityWindow.ioTokens, false) }))}</span>
        <em class="cache-hit-rate ${tone}">${escapeHtml(T('cacheHitShort', {
          value: formatCacheHitRate(activityWindow.cachedInputTokens, activityWindow.inputTokens)
        }))}</em>
      </small>
      </div>
    </details>
  `;
}

function renderActivity(activitySlice) {
  const activity = activitySlice?.data;
  els.tokenUpdated.textContent = activity ? T('recentDays') : formatUpdated(activitySlice?.fetchedAt);
  if (!activity) {
    updateHtml(els.tokenCard, empty(activitySlice?.error));
    return;
  }
  const days = normalizeDays(activity.days || []);
  const today = days.at(-1) || emptyDay(new Date());
  const selectedDay = days.find((day) => day.day === selectedDayByProvider[provider]) || today;
  const total = days.reduce((sum, day) => sum + day.tokens, 0);
  const totalIo = days.reduce((sum, day) => sum + day.ioTokens, 0);
  const totalInput = days.reduce((sum, day) => sum + Number(day.inputTokens || 0), 0);
  const totalCachedInput = days.reduce((sum, day) => sum + Number(day.cachedInputTokens || 0), 0);
  const max = Math.max(1, ...days.map((day) => day.tokens));

  updateHtml(els.tokenCard, `
    <div class="token-summary">
      <div>
        <span>${escapeHtml(T('today'))}</span>
        <strong>${escapeHtml(formatTokens(today.tokens))}</strong>
      </div>
      <div>
        <span>${escapeHtml(T('total'))}</span>
        <strong>${escapeHtml(formatTokens(total))}</strong>
      </div>
    </div>
    <div class="token-detail"><strong id="selectedDayLabel">${escapeHtml(`${formatDay(selectedDay.day)} · ${formatTokens(selectedDay.tokens)}`)}</strong></div>
    <details class="inline-details" data-detail="token-metrics">
      <summary>${escapeHtml(T('activityDetails'))}</summary>
      <div class="disclosure-content">
    <div class="heatmap">
      ${days.map((day) => `
        <button
          class="heat-cell${day.day === selectedDay.day ? ' active' : ''}"
          type="button"
          data-day="${escapeHtml(day.day)}"
          style="--level:${heatLevel(day.tokens, max)}"
          aria-label="${escapeHtml(day.day)}"
        >${escapeHtml(day.day.slice(-2).replace(/^0/, ''))}</button>
      `).join('')}
    </div>
        <dl class="detail-metrics">
          ${detailMetric(T('today'), T('io', { value: formatTokens(today.ioTokens, false) }))}
          ${detailMetric(T('total'), T('io', { value: formatTokens(totalIo, false) }))}
          ${detailMetric(T('today'), T('cacheHit', { value: formatCacheHitRate(today.cachedInputTokens, today.inputTokens) }))}
          ${detailMetric(T('total'), T('cacheHit', { value: formatCacheHitRate(totalCachedInput, totalInput) }))}
        </dl>
        <div class="selected-day-detail" id="tokenDetail">${tokenDetailTemplate(selectedDay)}</div>
      </div>
    </details>
  `);
}

function normalizeDays(rawDays) {
  const byDay = new Map(rawDays.map((day) => [day.day, day]));
  const days = [];
  const today = new Date();
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = isoDate(date);
    const source = byDay.get(key) || {};
    const hasCacheMetrics = source.inputTokens !== null
      && source.inputTokens !== undefined
      && source.cachedInputTokens !== null
      && source.cachedInputTokens !== undefined
      && Number.isFinite(Number(source.inputTokens))
      && Number.isFinite(Number(source.cachedInputTokens));
    days.push({
      day: key,
      tokens: Number(source.tokens ?? source.value ?? 0) || 0,
      ioTokens: Number(source.ioTokens || 0) || 0,
      inputTokens: hasCacheMetrics ? Math.max(0, Number(source.inputTokens)) : null,
      cachedInputTokens: hasCacheMetrics ? Math.max(0, Number(source.cachedInputTokens)) : null,
      threads: Number(source.threads || 0) || 0,
      costUsd: Number(source.costUsd || 0) || 0
    });
  }
  return days;
}

function tokenDetailTemplate(day) {
  const detailMeta = `${T('sessions', { count: day.threads })} · ${T('cost', { value: formatUsd(day.costUsd) })}`;
  const cacheText = T('cacheHit', { value: formatCacheHitRate(day.cachedInputTokens, day.inputTokens) });
  return `
    <strong>${escapeHtml(`${formatDay(day.day)} · ${formatTokens(day.tokens)}`)}</strong>
    <span>${escapeHtml(detailMeta)} · <em class="cache-hit-rate ${cacheHitTone(day.cachedInputTokens, day.inputTokens)}">${escapeHtml(cacheText)}</em></span>
  `;
}

function renderRadar(radarSlice, usageSlice, activitySlice) {
  const radar = radarSlice?.data;
  const items = radarItemsForProvider(radar);
  const updatedAt = provider === 'claude'
    ? radar?.iqUpdatedAt || radar?.updatedAt
    : radar?.modelIq?.updatedAt || radar?.monitoredAt || radar?.modelIq?.latestDate;
  els.iqUpdated.textContent = formatRadarTime(updatedAt) || formatUpdated(radarSlice?.fetchedAt);
  if (radar?.modelIq?.timestampBasis === 'read') els.iqUpdated.textContent = T('radarReadAt', { t: formatDateTime(updatedAt) });
  els.radarSource.textContent = provider === 'claude' ? T('sourceClaude') : T('sourceCodex');
  if (activeRadarView === 'intelligence') {
    renderSection('iq', [radarSlice, radarSortByProvider[provider], radarExpandedByProvider[provider], radarLatestByProvider[provider]], () => renderIqCards(items, radarSlice?.error));
    const timestamp = Date.parse(updatedAt);
    const notices = [];
    if (radar?.modelIq?.scoreMode === 'radar-bench-v2-150') {
      notices.push(T('radarBenchNotice'));
      if (radar.modelIq.partial) notices.push(T('radarPartialRead', { n: radar.modelIq.receivedCount, total: radar.modelIq.requestedCount }));
    }
    if (radar && radarSlice?.error) notices.push(radarSlice.error);
    if (Number.isFinite(timestamp) && Date.now() - timestamp > 72 * 3600_000) {
      notices.push(T('radarSourceStale', { date: new Intl.DateTimeFormat(lang, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp) }));
    }
    if (radarLatestByProvider[provider] && !items.some((item) => item.isLatest && item.isCurrentGeneration && radarScore(item) !== null)) notices.push(T('radarLatestPending'));
    els.radarDataNotice.textContent = notices.join(' ');
    els.radarDataNotice.hidden = !notices.length;
    els.radarDataNotice.classList.toggle('info', radar?.modelIq?.scoreMode === 'radar-bench-v2-150' && !radarSlice?.error);
    const stale = Number.isFinite(timestamp) && Date.now() - timestamp > 72 * 3600_000;
    const partial = radar?.modelIq?.partial;
    els.radarBriefStatus.hidden = !radarSlice?.error && !stale && !partial;
    els.radarBriefStatus.textContent = radarSlice?.error || stale ? T('radarAttention')
      : partial ? T('radarPartialShort', { n: radar.modelIq.receivedCount, total: radar.modelIq.requestedCount }) : '';
  } else if (activeRadarView === 'quota') {
    renderSection('quota', [radarSlice, activitySlice?.data], () => {
      renderModelUsage(radar, activitySlice);
      renderQuotaRadar(radar, provider);
    });
  } else {
    renderSection('reset', [usageSlice, radarSlice], () => renderResetCards(usageSlice, radar, provider));
  }
  syncRadarView();
}

function radarItemsForProvider(radar) {
  if (!radar) return [];
  return provider === 'claude' ? radar.items || [] : radar.modelIq?.items || [];
}

function renderIqCards(allItems, error = null) {
  const latestOnly = Boolean(radarLatestByProvider[provider]);
  const items = latestOnly ? allItems.filter((item) => item.isLatest && item.isCurrentGeneration) : allItems;
  const names = provider === 'codex'
    ? [...new Set(allItems.filter((item) => item.isLatest && item.isCurrentGeneration).map((item) => item.modelLabel))]
      .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
    : [];
  els.modelCatalogNotice.hidden = names.length === 0;
  els.modelCatalogNames.textContent = T('latestModels', { models: names.join(' / ') });
  els.latestModelsFilter.textContent = T(latestOnly ? 'allModels' : 'onlyLatestModels');
  els.latestModelsFilter.setAttribute('aria-pressed', String(latestOnly));
  if (!items.length) {
    renderRadarSummary([]);
    updateHtml(els.iqList, empty(error || T('noIqData')));
    els.expandModels.hidden = true;
    return;
  }

  const sort = radarSortByProvider[provider] || 'iq';
  const sortedItems = sortRadarItems(items, sort);
  const expanded = Boolean(radarExpandedByProvider[provider]);
  const visibleSet = new Set(expanded ? sortedItems : sortedItems.slice(0, 6));
  const groups = groupRadarItems(sortedItems, visibleSet, expanded);
  renderRadarSummary(allItems.filter((item) => !item.catalogOnly));

  els.iqSortButtons.forEach((button) => {
    const active = button.dataset.iqSort === sort;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    const labels = { iq: 'iqSortIq', value: 'iqSortValue', speed: 'iqSortSpeed' };
    button.textContent = `${T(labels[button.dataset.iqSort] || 'iqSortIq')}${active ? (sort === 'speed' ? ' ↑' : ' ↓') : ''}`;
  });

  updateHtml(els.iqList, groups.map((group) => `
    <section class="mobile-model-group ${escapeHtml(group.key)}">
      <div class="mobile-model-group-head">
        <span><i class="model-group-dot" aria-hidden="true"></i><strong>${escapeHtml(group.label)}</strong></span>
        <em>${group.total}</em>
      </div>
      <div class="mobile-iq-group-items">
        ${group.items.map(mobileIqTemplate).join('')}
      </div>
    </section>
  `).join(''));

  const hiddenCount = Math.max(0, sortedItems.length - 6);
  els.expandModels.hidden = hiddenCount === 0;
  els.expandModels.textContent = expanded ? T('collapseModels') : T('expandModels', { n: hiddenCount });
  els.expandModels.setAttribute('aria-expanded', String(expanded));
}

function sortRadarItems(items, sort) {
  return items.slice().sort((left, right) => {
    if (sort === 'value') {
      const valueOrder = compareRadarNumbers(radarValueScore(left), radarValueScore(right));
      if (valueOrder !== 0) return valueOrder;
    } else if (sort === 'speed') {
      const speedOrder = compareRadarNumbers(radarAverageSeconds(left), radarAverageSeconds(right), true);
      if (speedOrder !== 0) return speedOrder;
    }
    const iqOrder = compareRadarNumbers(radarScore(left), radarScore(right));
    if (iqOrder !== 0) return iqOrder;
    return String(left.modelLabel || left.label || '').localeCompare(String(right.modelLabel || right.label || ''), 'en', { sensitivity: 'base' });
  });
}

function compareRadarNumbers(left, right, ascending = false) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftValid = left !== null && left !== undefined && left !== '' && Number.isFinite(leftNumber);
  const rightValid = right !== null && right !== undefined && right !== '' && Number.isFinite(rightNumber);
  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;
  return ascending ? leftNumber - rightNumber : rightNumber - leftNumber;
}

function radarScore(item) {
  if (item?.score === null || item?.score === undefined || item?.score === '') return null;
  const score = Number(item?.score);
  return Number.isFinite(score) ? score : null;
}

function radarAverageCost(item) {
  const average = Number(item?.averageCostUsd ?? item?.avgCostUsd);
  if (Number.isFinite(average) && average > 0) return average;
  const total = Number(item?.costUsd);
  const tasks = Number(item?.tasks);
  return Number.isFinite(total) && total > 0 && Number.isFinite(tasks) && tasks > 0 ? total / tasks : null;
}

function radarAverageSeconds(item) {
  const seconds = Number(item?.averageTaskSeconds ?? item?.avgTaskSeconds);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  const hours = Number(item?.wallHours);
  return Number.isFinite(hours) && hours > 0 ? hours * 3600 : null;
}

function radarValueScore(item) {
  const score = radarScore(item);
  const cost = radarAverageCost(item);
  return score !== null && cost !== null ? score / cost : null;
}

function groupRadarItems(items, visibleSet, expanded) {
  const order = [
    ['astra', T('modelGroupAstra')],
    ['sol', T('modelGroupSol')],
    ['terra', T('modelGroupTerra')],
    ['luna', T('modelGroupLuna')],
    ['other', T('modelGroupOther')]
  ];
  const grouped = new Map(order.map(([key, label]) => [key, { key, label, total: 0, items: [] }]));
  items.forEach((item) => {
    const key = radarModelGroup(item);
    const group = grouped.get(key) || grouped.get('other');
    group.total += 1;
    if (expanded || visibleSet.has(item)) group.items.push(item);
  });
  return order.map(([key]) => grouped.get(key)).filter((group) => group.items.length);
}

function radarModelGroup(item) {
  const label = `${item?.modelLabel || ''} ${item?.label || ''}`.toLowerCase();
  if (label.includes('sol')) return 'sol';
  if (label.includes('terra')) return 'terra';
  if (label.includes('luna')) return 'luna';
  if (label.includes('astra')) return 'astra';
  return 'other';
}

function mobileIqTemplate(item) {
  const score = radarScore(item);
  const status = item.status || 'unknown';
  const modelName = item.modelLabel || item.label || 'Model';
  const reasoning = item.reasoningEffort ? String(item.reasoningEffort).toUpperCase() : T('metricPending');
  const metrics = [
    [T('iqMetricCost'), formatAverageCost(item), item.costBasis === 'official_standard_api_equivalent' ? T('radarCostEvidence', { n: item.costKnownSamples ?? '-', total: item.costTotalSamples ?? '-' }) : ''],
    [T('iqMetricTime'), formatAverageTime(item)],
    [T(item.sampleBasis === 'graded' ? 'iqMetricGraded' : 'iqMetricSamples'), formatSampleCount(item)],
    [T('metricCoverage'), formatPassedRatio(item)]
  ];
  return `
    <details class="model-detail inline-details ${escapeHtml(status)}" data-detail="model:${escapeHtml(`${item.modelId || modelName}:${item.reasoningEffort || ''}`)}">
      <summary class="model-summary">
        <span class="model-identity"><strong>${escapeHtml(modelName)}</strong><small>${escapeHtml(reasoning)}</small></span>
        <span class="model-score"><small>IQ</small><strong>${score === null ? '--' : score.toFixed(1)}</strong></span>
      </summary>
      <div class="disclosure-content">
        <dl class="detail-metrics">${metrics.map(([label, value]) => detailMetric(label, value)).join('')}</dl>
        ${item.costBasis === 'official_standard_api_equivalent' ? `<p class="detail-note">${escapeHtml(T('radarCostEvidence', { n: item.costKnownSamples ?? '-', total: item.costTotalSamples ?? '-' }))}</p>` : ''}
      </div>
    </details>
  `;
}

function formatPassedRatio(item) {
  if (item?.sampleBasis === 'graded' && item.coverage !== null && item.benchmarkTasks !== null) {
    return T('radarCoverage', { n: item.coverage, total: item.benchmarkTasks });
  }
  if (item?.passed === null || item?.passed === undefined || item?.passed === ''
    || item?.tasks === null || item?.tasks === undefined || item?.tasks === '') {
    return T('metricPending');
  }
  const passed = Number(item?.passed);
  const tasks = Number(item?.tasks);
  return Number.isFinite(passed) && Number.isFinite(tasks)
    ? T('passedRatio', { p: Math.round(passed), t: Math.round(tasks) })
    : T('metricPending');
}

function formatAverageCost(item) {
  const cost = radarAverageCost(item);
  return cost === null ? '-' : `$${cost.toFixed(item?.costBasis === 'official_standard_api_equivalent' ? 2 : cost >= 10 ? 1 : 2)}`;
}

function formatAverageTime(item) {
  const human = String(item?.averageTaskTimeHuman || '').trim();
  if (human) return localizeRadarDuration(human);
  const seconds = radarAverageSeconds(item);
  if (seconds === null) return '-';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}${T('secondsShort')}`;
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}${T('minutesShort')}`;
  return `${(seconds / 3600).toFixed(seconds >= 36_000 ? 0 : 1)}${T('hoursShort')}`;
}

function localizeRadarDuration(value) {
  const match = String(value || '').match(/^([\d.]+)\s*(秒|分钟|小时|分|时)$/);
  if (!match) return String(value || '');
  if (match[2] === '秒') return `${match[1]}${T('secondsShort')}`;
  if (match[2] === '分钟' || match[2] === '分') return `${match[1]}${T('minutesShort')}`;
  return `${match[1]}${T('hoursShort')}`;
}

function formatSampleCount(item) {
  const value = item?.sampleBasis === 'graded' ? item.sampleCount : item?.sampleCount24h;
  if (value === null || value === undefined || value === '') return '-';
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? String(Math.round(count)) : '-';
}

function renderRadarSummary(items) {
  const recommended = sortRadarItems(items, 'iq')[0];
  els.recommendedModel.textContent = recommended
    ? recommended.modelLabel || recommended.label || 'Model'
    : '--';
  els.recommendedMeta.textContent = recommended
    ? T('recommendedMeta', {
        score: radarScore(recommended) === null ? '--' : radarScore(recommended).toFixed(1),
        reasoning: recommended.reasoningEffort ? String(recommended.reasoningEffort).toUpperCase() : '-'
      })
    : T('recommendedWaiting');

  const signal = radarDegradationSignal(items);
  els.iqDegradeAlert.classList.toggle('warning', signal.level === 'warning');
  els.iqDegradeAlert.classList.toggle('watch', signal.level === 'watch');
  els.iqDegradeValue.textContent = signal.message;
}

function radarDegradationSignal(items) {
  const changes = items.map((item) => {
    const series = Array.isArray(item?.recentScores)
      ? item.recentScores.filter((sample) => sample?.score !== null
          && sample?.score !== undefined
          && sample?.score !== ''
          && Number.isFinite(Number(sample.score)))
      : [];
    if (series.length < 2) return null;
    return { item, delta: Number(series.at(-1).score) - Number(series[0].score) };
  }).filter(Boolean);
  if (!changes.length) return { level: 'neutral', message: T('degradationMonitoring') };
  const worst = changes.reduce((current, next) => next.delta < current.delta ? next : current);
  const drop = Math.abs(worst.delta);
  if (worst.delta <= -5) return { level: 'warning', message: T('degradationWarning', { model: worst.item.modelLabel || worst.item.label || 'Model', delta: drop.toFixed(1) }) };
  if (worst.delta <= -2) return { level: 'watch', message: T('degradationWatch', { model: worst.item.modelLabel || worst.item.label || 'Model', delta: drop.toFixed(1) }) };
  return { level: 'stable', message: T('degradationStable') };
}

function renderModelUsage(radar, activitySlice) {
  const radarItems = radarItemsForProvider(radar);
  const activityUsage = aggregateActivityModelUsage(activitySlice);
  const rows = activityUsage.rows.map((row) => ({ ...row, radarItem: findRadarItemForModel(row.model, radarItems) }));
  if (!rows.length) {
    els.modelUsageSummary.innerHTML = '';
    els.modelUsageRows.innerHTML = empty(activitySlice?.error || T('modelUsageNoActivity'));
    return;
  }
  els.modelUsageSummary.innerHTML = `
    <span>${escapeHtml(activityUsage.totalTokens > 0 ? T('modelUsageTotal', { v: formatTokens(activityUsage.totalTokens) }) : T('modelUsageNoActivity'))}</span>
    ${activityUsage.totalCost > 0 ? `<strong>${escapeHtml(T('modelUsageEstimatedTotal', { v: formatUsd(activityUsage.totalCost) }))}</strong>` : ''}
  `;
  els.modelUsageRows.innerHTML = `
    <div class="model-usage-row model-usage-head">
      <span>${escapeHtml(T('modelUsageModel'))}</span><span>${escapeHtml(T('modelUsageTokens'))}</span><span>${escapeHtml(T('modelUsageShare'))}</span><span>${escapeHtml(T('modelUsageEstimate'))}</span>
    </div>
    ${rows.map((row) => {
      const shareKnown = row.share !== null
        && row.share !== undefined
        && Number.isFinite(Number(row.share));
      const share = shareKnown ? `${Math.round(Number(row.share) * 1000) / 10}%` : T('metricPending');
      const bar = shareKnown ? `<i style="--share:${clamp(Number(row.share) * 100, 0, 100)}%"></i>` : '';
      return `<div class="model-usage-row">
        <span class="model-usage-model"><i class="model-usage-dot ${escapeHtml(radarModelGroup(row.radarItem || { modelLabel: row.model }))}" aria-hidden="true"></i><strong>${escapeHtml(formatModelName(row.model))}</strong></span>
        <strong>${escapeHtml(row.tokens === null ? T('metricPending') : formatTokens(row.tokens, false))}</strong>
        <span class="model-usage-share-cell"><span class="model-usage-share">${bar}</span><b>${escapeHtml(share)}</b></span>
        <strong>${escapeHtml(row.estimatedCost === null ? T('metricPending') : formatUsd(row.estimatedCost))}</strong>
      </div>`;
    }).join('')}
  `;
}

function aggregateActivityModelUsage(activitySlice) {
  const days = Array.isArray(activitySlice?.data?.days)
    ? activitySlice.data.days.filter((day) => !day.future && Array.isArray(day.models) && day.models.length)
    : [];
  if (!days.length) return { rows: [], totalTokens: 0, totalCost: 0 };
  const latestDay = days.map((day) => String(day.day || '')).sort().at(-1);
  const selectedDays = days.filter((day) => day.day === latestDay);
  const modelMap = new Map();
  selectedDays.forEach((day) => day.models.forEach((model) => {
    const key = String(model?.model || '').trim();
    if (key) modelMap.set(key, (modelMap.get(key) || 0) + Math.max(0, Number(model?.value) || 0));
  }));
  const totalTokens = [...modelMap.values()].reduce((sum, value) => sum + value, 0);
  const totalCost = selectedDays.reduce((sum, day) => sum + Math.max(0, Number(day.costUsd) || 0), 0);
  const rows = [...modelMap.entries()].sort((left, right) => right[1] - left[1]).map(([model, tokens]) => ({
    model,
    tokens,
    share: totalTokens > 0 ? tokens / totalTokens : null,
    estimatedCost: totalCost > 0 && totalTokens > 0 ? totalCost * tokens / totalTokens : null
  }));
  return { rows, totalTokens, totalCost };
}

function findRadarItemForModel(model, items) {
  const key = normalizeModelKey(model);
  return items.find((item) => [item?.modelLabel, item?.label].filter(Boolean).map(normalizeModelKey).some((candidate) => candidate.includes(key) || key.includes(candidate))) || null;
}

function normalizeModelKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatModelName(value) {
  return String(value || 'Model').replace(/^gpt-/i, 'GPT-').replace(/-/g, ' ');
}

function formatModelBenchmark(item) {
  if (!item) return T('modelUsageUnavailable');
  const parts = [];
  const cost = formatAverageCost(item);
  const time = formatAverageTime(item);
  const samples = formatSampleCount(item);
  if (cost !== '-') parts.push(T('modelUsageAvgCost', { v: cost }));
  if (time !== '-') parts.push(time);
  if (samples !== '-') parts.push(T('modelUsageSampleCount', { n: samples }));
  return parts.length ? parts.join(' · ') : T('modelUsageUnavailable');
}

function renderQuotaRadar(radar, providerId) {
  if (!radar) {
    els.radarCard.innerHTML = empty(T('noQuotaRadar'));
    return;
  }
  if (providerId === 'claude') {
    const quota = radar.quota || {};
    const byKey = Object.fromEntries((quota.usage || []).map((row) => [row.key, row]));
    const rows = [
      [T('measured'), formatUsd(quota.baseH5), formatUsd(quota.baseD7)],
      [T('sharedUsed'), formatPercent(byKey.h5?.usedPercent), formatPercent(byKey.d7?.usedPercent)],
      [T('reset'), byKey.h5?.resetText || '-', byKey.d7?.resetText || '-']
    ];
    els.radarCard.innerHTML = radarTableTemplate(T('tier'), rows);
    return;
  }
  const rows = (radar.quotaRadar?.rows || []).map((row) => [row.tier || '-', formatUsd(row.five_h), formatUsd(row.seven_d)]);
  els.radarCard.innerHTML = rows.length ? radarTableTemplate(T('tier'), rows) : empty(T('noQuotaRadar'));
}

function radarTableTemplate(firstLabel, rows) {
  return `<div class="radar-table">
    <div class="radar-row radar-head"><span>${escapeHtml(firstLabel)}</span><strong>5h</strong><strong>7d</strong></div>
    ${rows.map(([label, five, week]) => `<div class="radar-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(five)}</strong><strong>${escapeHtml(week)}</strong></div>`).join('')}
  </div>`;
}

function renderResetCards(usageSlice, radar, providerId) {
  if (providerId === 'claude') {
    const quota = radar?.quota || {};
    const calibratedAt = formatRadarTime(quota.updatedAt || radar?.updatedAt);
    els.resetSource.textContent = calibratedAt || '--';
    if (!radar) {
      els.resetCards.innerHTML = empty(T('noRadarNotes'));
      return;
    }
    els.resetCards.innerHTML = `<div class="reset-timeline">
      <div class="reset-timeline-summary"><span>${escapeHtml(T('resetTimelineTitle'))}</span><strong>${escapeHtml(calibratedAt || '--')}</strong></div>
      ${resetTimelineItem(T('calibTitle'), T('calibStatus'), quota.chartLabel || quota.note || T('calibNone'), 'available')}
      ${resetTimelineItem(T('srcTitle'), T('sourceStatus'), T('attributionClaude'), 'neutral')}
    </div>`;
    return;
  }

  els.resetSource.textContent = T('sourceCodex');
  const credits = usageSlice?.data?.resetCredits;
  if (!credits) {
    els.resetCards.innerHTML = empty(T('noResetCards'));
    return;
  }
  if (credits.error) {
    els.resetCards.innerHTML = empty(credits.error);
    return;
  }
  if (!credits.credits?.length) {
    els.resetCards.innerHTML = empty(T('creditsAvailable', { n: credits.availableCount ?? 0 }));
    return;
  }
  els.resetCards.innerHTML = `<div class="reset-timeline">
    <div class="reset-timeline-summary"><span>${escapeHtml(T('resetTimelineTitle'))}</span><strong>${escapeHtml(T('creditsAvailable', { n: credits.availableCount ?? credits.credits.length }))}</strong></div>
    ${credits.credits.map((credit) => resetTimelineItem(
      credit.title || 'Codex reset',
      resetStatusLabel(credit.status),
      credit.expiresAt ? T('expiresAt', { t: formatDateTime(credit.expiresAt) }) : T('noExpiry'),
      resetStatusClass(credit.status)
    )).join('')}
  </div>`;
}

function resetTimelineItem(title, status, detail, tone = 'neutral') {
  return `<article class="reset-item ${escapeHtml(tone)}"><span class="reset-marker" aria-hidden="true"></span><div class="reset-item-body"><div class="reset-item-head"><strong>${escapeHtml(title)}</strong><span class="reset-status ${escapeHtml(tone)}">${escapeHtml(status)}</span></div><p>${escapeHtml(detail)}</p></div></article>`;
}

function resetStatusClass(status) {
  return ['available', 'redeemed', 'expired'].includes(status) ? status : 'neutral';
}

function resetStatusLabel(status) {
  const key = { available: 'statusAvailable', redeemed: 'statusRedeemed', expired: 'statusExpired' }[status] || 'statusUnknown';
  return T(key);
}

function syncRadarView() {
  document.body.dataset.radarView = activeRadarView;
  els.radarSubtabs.forEach((button) => {
    const active = button.dataset.radarView === activeRadarView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  els.radarSubviews.forEach((view) => view.classList.toggle('active', view.dataset.radarView === activeRadarView));
}

function selectView(view) {
  if (view !== 'usage' && view !== 'radar') return;
  const changed = activeView !== view;
  activeView = view;
  if (view === 'radar' && changed) activeRadarView = 'intelligence';
  document.body.dataset.view = view;
  els.viewSwitch.dataset.view = view;
  if (changed && currentState) render();
  els.viewButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  els.views.forEach((node) => node.classList.toggle('active', node.id === `${view}View`));
  if (view === 'radar') syncRadarView();
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  toastTimer = window.setTimeout(() => els.toast.classList.remove('visible'), 2200);
}

function empty(message) {
  return `<div class="empty">${escapeHtml(message || T('noData'))}</div>`;
}

function formatUpdated(value) {
  if (!value) return '--';
  return T('updated', { time: formatClock(value) });
}

function formatRadarTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : formatUpdated(date.getTime());
}

function formatClock(value) {
  const date = new Date(Number(value) || value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDateTime(value) {
  const date = new Date(Number(value) || value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat(lang, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDay(day) {
  const date = new Date(`${day}T00:00:00`);
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(date);
}

function formatTokens(value, withUnit = true) {
  const number = Number(value) || 0;
  const formatted = new Intl.NumberFormat(lang, {
    notation: number >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: number >= 10_000 ? 1 : 0
  }).format(number);
  return withUnit ? `${formatted} token` : formatted;
}

function formatUsd(value) {
  if (value === null || value === undefined || value === '') return '--';
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD', maximumFractionDigits: number < 1 ? 2 : 1 }).format(number);
}

function formatHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return '--';
  return hours < 1 ? `${Math.max(1, Math.round(hours * 60))}m` : `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '--';
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}%` : '--';
}

function cacheHitPercent(cachedInputTokens, inputTokens) {
  const cached = Number(cachedInputTokens);
  const input = Number(inputTokens);
  if (!Number.isFinite(cached) || !Number.isFinite(input) || input <= 0) return null;
  return clamp((cached / input) * 100, 0, 100);
}

function formatCacheHitRate(cachedInputTokens, inputTokens) {
  const rate = cacheHitPercent(cachedInputTokens, inputTokens);
  if (rate === null) return '--';
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(rate)}%`;
}

function cacheHitTone(cachedInputTokens, inputTokens) {
  const rate = cacheHitPercent(cachedInputTokens, inputTokens);
  if (rate === null) return 'cache-hit-neutral';
  // 按显示出来的那个数字（保留 1 位小数）判色，否则 98.97% 会显示成 99% 却是黄色。
  const shown = Math.round(rate * 10) / 10;
  if (shown >= 99) return 'cache-hit-good';
  if (shown >= 95) return 'cache-hit-warning';
  return 'cache-hit-critical';
}

function heatLevel(value, max) {
  if (!value) return 0;
  const ratio = value / Math.max(1, max);
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.55) return 4;
  if (ratio >= 0.32) return 3;
  if (ratio >= 0.14) return 2;
  return 1;
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function emptyDay(date) {
  return {
    day: isoDate(date),
    tokens: 0,
    ioTokens: 0,
    inputTokens: null,
    cachedInputTokens: null,
    threads: 0,
    costUsd: 0
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

els.providerSwitch.addEventListener('click', (event) => {
  const button = event.target.closest('.provider-button');
  if (!button || button.dataset.provider === provider) return;
  provider = button.dataset.provider;
  activeRadarView = 'intelligence';
  renderProviders(Object.keys(currentState.providers || {}));
  const wasUsage = activeView === 'usage';
  selectView('usage');
  if (wasUsage) render();
});

els.viewButtons.forEach((button) => {
  button.addEventListener('click', () => selectView(button.dataset.view));
});

els.radarSubtabs.forEach((button) => {
  button.addEventListener('click', () => {
    const nextView = ['intelligence', 'quota', 'reset'].includes(button.dataset.radarView)
      ? button.dataset.radarView
      : 'intelligence';
    if (activeRadarView === nextView) return;
    activeRadarView = nextView;
    syncRadarView();
    if (currentState) render();
  });
});

els.iqSortButtons.forEach((button) => {
  button.addEventListener('click', () => {
    radarSortByProvider[provider] = button.dataset.iqSort || 'iq';
    if (currentState && activeView === 'radar') render();
  });
});

els.expandModels.addEventListener('click', () => {
  radarExpandedByProvider[provider] = !radarExpandedByProvider[provider];
  if (currentState && activeView === 'radar') render();
});

els.latestModelsFilter.addEventListener('click', () => {
  radarLatestByProvider[provider] = !radarLatestByProvider[provider];
  radarExpandedByProvider[provider] = false;
  if (currentState) render();
});

els.tokenCard.addEventListener('click', (event) => {
  const cell = event.target.closest('.heat-cell');
  if (!cell || !currentState) return;
  const activity = currentState.providers?.[provider]?.activity?.data;
  const day = normalizeDays(activity?.days || []).find((item) => item.day === cell.dataset.day);
  if (!day) return;
  selectedDayByProvider[provider] = day.day;
  const selectedLabel = document.getElementById('selectedDayLabel');
  if (selectedLabel) selectedLabel.textContent = `${formatDay(day.day)} · ${formatTokens(day.tokens)}`;
  els.tokenCard.querySelectorAll('.heat-cell').forEach((node) => node.classList.toggle('active', node === cell));
  const detail = document.getElementById('tokenDetail');
  if (detail) {
    detail.innerHTML = tokenDetailTemplate(day);
    detail.classList.remove('detail-pop');
    window.requestAnimationFrame(() => detail.classList.add('detail-pop'));
  }
});

els.refreshButton.addEventListener('click', async () => {
  if (els.refreshButton.disabled) return;
  els.refreshButton.disabled = true;
  els.refreshButton.setAttribute('aria-busy', 'true');
  els.refreshButton.classList.add('loading');
  showToast(connectionMode === 'cloud' ? T('cloudConnecting') : T('refreshing'));
  try {
    if (connectionMode === 'cloud') await refreshCloudState();
    else await api('/api/refresh', { method: 'POST' });
  } catch (error) {
    showToast(error.message === 'unauthorized' ? T('unauthorized') : T('refreshFailed'));
  } finally {
    els.refreshButton.classList.remove('loading');
    els.refreshButton.disabled = false;
    els.refreshButton.removeAttribute('aria-busy');
  }
});

els.pairingSubmit.addEventListener('click', submitPairingCode);
els.pairingInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitPairingCode();
});
els.syncDeviceButton.addEventListener('click', unpairCloudDevice);

document.addEventListener('visibilitychange', () => {
  if (connectionMode === 'cloud' && document.visibilityState === 'visible' && syncCredentials) {
    refreshCloudState().catch(() => setConnection(false));
  }
});

async function start() {
  if (window.CMM_MOBILE_MODE === 'cloud') {
    try {
      await startCloudMode();
    } catch {
      showPairingGate('pairingFailed', true);
    }
    return;
  }
  accessToken = readAccessToken();
  els.connectionLabel.textContent = T('connecting');
  selectView(activeView);
  try {
    if (accessToken) {
      await fetch('/api/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
      });
    }
    applyState(await api('/api/state'));
    setConnection(true);
    connectEvents();
  } catch (error) {
    setConnection(false);
    els.quotaGrid.innerHTML = empty(error.message === 'unauthorized' ? T('unauthorized') : T('offline'));
    els.tokenCard.innerHTML = empty(error.message === 'unauthorized' ? T('unauthorized') : T('offline'));
    els.iqList.innerHTML = empty(error.message === 'unauthorized' ? T('unauthorized') : T('offline'));
    els.radarCard.innerHTML = empty(error.message === 'unauthorized' ? T('unauthorized') : T('offline'));
    if (error.message !== 'unauthorized') reconnectTimer = window.setTimeout(start, 5000);
  }
}

start();
