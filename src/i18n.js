// 共享三语文案。主进程用 require 加载，面板/设置页通过 <script> 标签加载（挂在 window.CMM_I18N）。
(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global && typeof global === 'object') global.CMM_I18N = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const FALLBACK = 'zh-CN';
  const LOCALES = ['zh-CN', 'en-US', 'ja-JP'];

  // key: [zh-CN, en-US, ja-JP]
  const dict = {
    // 状态行
    statusUsage: ['用量 {time}', 'Usage {time}', '使用量 {time}'],
    statusUsageLoading: ['正在读取用量', 'Loading usage', '使用量を取得中'],
    statusUsageRefreshing: ['用量刷新中', 'Refreshing usage', '使用量を更新中'],
    statusUsageFailed: ['用量读取失败', 'Usage fetch failed', '使用量の取得に失敗'],
    statusToken: ['Token {time}', 'Token {time}', 'Token {time}'],
    statusRadar: ['雷达 {time}', 'Radar {time}', 'レーダー {time}'],
    statusRadarLoading: ['正在读取雷达', 'Loading radar', 'レーダーを取得中'],
    statusRadarRefreshing: ['雷达刷新中', 'Refreshing radar', 'レーダーを更新中'],
    statusRadarFailed: ['雷达读取失败', 'Radar fetch failed', 'レーダーの取得に失敗'],
    statusWaiting: ['等待刷新', 'Waiting for refresh', '更新待ち'],

    // 页签与区块标题
    tabUsage: ['用量', 'Usage', '使用量'],
    tabRadar: ['雷达', 'Radar', 'レーダー'],
    usageTitleCodex: ['GPT 额度', 'GPT Quota', 'GPT 使用枠'],
    usageTitleClaude: ['Claude 额度', 'Claude Quota', 'Claude 使用枠'],
    usageTitleExtra: ['{name} 额度', '{name} Quota', '{name} 使用枠'],
    tokenTitle: ['Token 活动', 'Token Activity', 'トークン活動'],
    iqTitle: ['今日 IQ', 'Model IQ', '本日の IQ'],
    quotaRadarTitle: ['额度雷达', 'Quota Radar', 'クォータレーダー'],
    resetTitleCodex: ['重置', 'Reset', 'リセット'],
    resetTitleClaude: ['重置', 'Reset', 'リセット'],
    openSource: ['打开来源', 'Open source', 'ソースを開く'],

    // 额度卡
    updatedAt: ['更新 {time}', 'Updated {time}', '更新 {time}'],
    officialSuffix: [' · CLI 官方', ' · Official', ' · CLI 公式'],
    officialTip: [
      '来自 Claude CLI 登录账号的官方用量接口',
      'From the official usage API of your Claude CLI account',
      'Claude CLI アカウントの公式使用量 API から取得'
    ],
    noUsageData: ['暂无用量数据', 'No usage data yet', '使用量データがありません'],
    windowUnavailable: ['窗口数据不可用', 'Window data unavailable', 'ウィンドウデータなし'],
    label5h: ['5 小时', '5h', '5時間'],
    labelWeek: ['一周', 'Weekly', '週間'],
    remainingTitle: ['{label} 剩余', '{label} left', '{label} 残量'],
    remainingWord: ['剩余', 'left', '残量'],
    inactiveFooter: ['使用后开始计时', 'Timer starts after first use', '使用開始後にカウント'],
    noResetFooter: ['重置时间暂未提供', 'Reset time not provided', 'リセット時刻は未提供'],
    notStarted: ['未开始', 'Not started', '未開始'],
    noneShort: ['暂无', '—', 'なし'],
    unlimitedBadge: ['无限制', 'Unlimited', '無制限'],
    unlimitedFooter: ['Codex 已取消 5 小时限制', 'Codex removed the 5-hour limit', 'Codex は5時間制限を廃止'],
    resetSoon: ['即将重置', 'Resetting soon', 'まもなくリセット'],
    resetInDH: ['{d}天{h}小时后重置', 'Resets in {d}d {h}h', '{d}日{h}時間後にリセット'],
    resetInD: ['{d}天后重置', 'Resets in {d}d', '{d}日後にリセット'],
    resetInHM: ['{h}小时{m}分钟后重置', 'Resets in {h}h {m}m', '{h}時間{m}分後にリセット'],
    resetInH: ['{h}小时后重置', 'Resets in {h}h', '{h}時間後にリセット'],
    resetInM: ['{m}分钟后重置', 'Resets in {m}m', '{m}分後にリセット'],
    tomorrowAt: ['明天 {time}', 'Tmrw {time}', '明日 {time}'],

    // Token 活动
    localSuffix: [' · 本地统计', ' · Local stats', ' · ローカル集計'],
    todayUsed: ['今天已使用', 'Today used', '今日の使用量'],
    windowUsed: ['近 {n} 天已使用', '{n}-day used', '直近{n}日の使用量'],
    usedAmount: ['已使用 {v}', 'Used {v}', '使用済み {v}'],
    ioAmount: ['读写 {v}', 'I/O {v}', '読み書き {v}'],
    cacheHitRate: ['缓存命中率 {v}', 'Cache hit {v}', 'キャッシュヒット率 {v}'],
    cacheHitHint: ['缓存读取 Token 占总输入 Token 的比例；≥99% 绿色，95–99% 黄色，<95% 红色', 'Cached input as a share of all input; green at 99% and above, yellow at 95–99%, red below 95%', '全入力 Token に占めるキャッシュ読み取りの割合。99% 以上は緑、95–99% は黄、95% 未満は赤'],
    windowUsage5h: ['5h Token', '5h Token', '5h Token'],
    windowUsageWeek: ['周 Token', 'Week Token', '週間 Token'],
    totalShort: ['总 {v}', 'Total {v}', '合計 {v}'],
    cacheHitShort: ['命中 {v}', 'Hit {v}', 'ヒット {v}'],
    sessionsCount: ['{n} 个会话', '{n} sessions', '{n} セッション'],
    noTokenData: ['暂无 Token 活动数据', 'No token activity yet', 'トークン活動データがありません'],
    tokenDetailHint: ['点击日期固定详情', 'Click a day to pin details', '日付をクリックして詳細を固定'],
    heatmapLess: ['少', 'Less', '少'],
    heatmapMore: ['多', 'More', '多'],
    heatmapAria: ['每日用量热力图', 'Daily usage heatmap', '日次使用量ヒートマップ'],
    noticeLocal: [
      '统计自 {dir} 本地会话记录',
      'Computed from local session logs in {dir}',
      '{dir} のローカル記録から集計'
    ],
    colonSep: ['：', ': ', '：'],
    costLine: ['折算 API 成本：今天 ≈ {today} · 近 {n} 天 ≈ {total}', 'Est. API cost: today ≈ {today} · {n}-day ≈ {total}', 'API 換算コスト：本日 ≈ {today} · 直近{n}日 ≈ {total}'],
    costHint: ['按各模型公开牌价估算（输入/输出/缓存分别计价），订阅已覆盖', 'Estimated from public per-model list prices (input/output/cache); covered by your subscription', '各モデルの公開料金から概算（サブスクリプションでカバー済み）'],

    // 趋势 / 燃烧率
    trendTitle: ['额度曲线', 'Quota curve', 'クォータ推移'],
    trendEmpty: ['采样数据积累中，稍后就有曲线了', 'Collecting samples — the curve will appear soon', 'サンプル収集中。まもなく表示されます'],
    trendSampleProgress: ['有效曲线样本 {n}/3', '{n}/3 curve samples', '有効な曲線サンプル {n}/3'],
    trendSamplePending: ['{window}：正在积累样本 {n}/3', '{window}: collecting samples {n}/3', '{window}：サンプル収集中 {n}/3'],
    trendChartAria: ['近 24 小时额度已用百分比曲线', 'Quota used over the last 24 hours', '過去24時間のクォータ使用率'],
    trendYAxis: ['已用 %', 'Used %', '使用率 %'],
    trendX24h: ['24 小时前', '24h ago', '24時間前'],
    trendX12h: ['12 小时前', '12h ago', '12時間前'],
    trendXNow: ['现在', 'Now', '現在'],
    trendUnavailable: ['{window}：暂无采样', '{window}: no samples yet', '{window}：サンプルなし'],
    trendUnlimited: ['{window}：暂无限额', '{window}: currently unlimited', '{window}：現在は無制限'],
    burnFlat: ['{window}：节奏平稳，重置前无触顶风险', '{window}: steady pace, no cap risk before reset', '{window}：ペース安定、リセット前の上限到達なし'],
    burnRising: ['{window}：▲ {rate}%/时 · 预计 {time} 触顶', '{window}: ▲ {rate}%/h · projected to cap at {time}', '{window}：▲ {rate}%/時 · {time} 頃に上限予測'],
    burnSafe: ['{window}：▲ {rate}%/时 · 重置前不会触顶', '{window}: ▲ {rate}%/h · won’t cap before reset', '{window}：▲ {rate}%/時 · リセット前は到達しない'],
    windowName5h: ['5 小时', '5h', '5時間'],
    windowNameWeek: ['周额度', 'Weekly', '週間'],

    // 通知
    notifyLowTitle: ['{name} {window}额度告急', '{name} {window} quota running low', '{name} {window}クォータ残りわずか'],
    notifyLowBody: ['{window}剩余 {remaining}%，注意安排收尾。', '{window} has {remaining}% left — plan to wrap up.', '{window}の残りは {remaining}% です。'],
    notifyResetTitle: ['{name} 额度已重置', '{name} quota reset', '{name} クォータがリセット'],
    notifyResetBody: ['{window}窗口已重置，满血复活。', 'The {window} window has reset — back to full.', '{window}ウィンドウがリセットされ、全回復しました。'],

    // 雷达
    lastUpdated: ['最近更新 {t}', 'Updated {t}', '最終更新 {t}'],
    radarSubtabIntelligence: ['智力', 'Intelligence', '知能'],
    radarSubtabQuota: ['额度', 'Quota', 'クォータ'],
    radarSubtabReset: ['重置', 'Reset', 'リセット'],
    recommendedModel: ['推荐模型', 'Recommended model', 'おすすめモデル'],
    recommendedMeta: ['IQ {score} · 推理强度 {reasoning}', 'IQ {score} · Reasoning {reasoning}', 'IQ {score} · 推論強度 {reasoning}'],
    recommendedWaiting: ['等待模型样本', 'Waiting for model samples', 'モデルサンプル待ち'],
    degradationAlert: ['降智预警', 'Degradation alert', '性能低下アラート'],
    degradationMonitoring: ['样本积累中', 'Collecting samples', 'サンプル収集中'],
    degradationStable: ['当前稳定', 'Stable', '安定'],
    degradationWatch: ['{model} 下降 {delta} IQ', '{model} down {delta} IQ', '{model} は IQ {delta} 低下'],
    degradationWarning: ['{model} 下降 {delta} IQ，请留意', '{model} down {delta} IQ — watch closely', '{model} は IQ {delta} 低下。要確認'],
    iqModelsTitle: ['模型 IQ', 'Model IQ', 'モデル IQ'],
    iqSortIq: ['IQ', 'IQ', 'IQ'],
    iqSortValue: ['性价比', 'Value', 'コスパ'],
    iqSortSpeed: ['速度', 'Speed', '速度'],
    iqMetricReasoning: ['推理强度', 'Reasoning', '推論強度'],
    iqMetricCost: ['平均费用', 'Avg. cost', '平均コスト'],
    iqMetricTime: ['平均耗时', 'Avg. time', '平均時間'],
    iqMetricSamples: ['24h 样本数', '24h samples', '24時間サンプル'],
    modelUsageTitle: ['模型消耗', 'Model usage', 'モデル消費'],
    modelUsagePeriod: ['最近采样日', 'Latest sample day', '最新サンプル日'],
    modelUsageModel: ['模型', 'Model', 'モデル'],
    modelUsageTokens: ['Token', 'Tokens', 'Token'],
    modelUsageShare: ['占比', 'Share', '割合'],
    modelUsageEstimate: ['估算成本', 'Est. cost', '推定コスト'],
    modelUsageTotal: ['最近一天共 {v}', '{v} in the latest day', '最新日の合計 {v}'],
    modelUsageNoActivity: ['暂无 Token 活动', 'No token activity', 'トークン活動なし'],
    modelUsageEstimatedTotal: ['估算 {v}', 'Est. {v}', '推定 {v}'],
    modelUsageAvgCost: ['均价 {v}', 'Avg {v}', '平均 {v}'],
    modelUsageSampleCount: ['{n} 样本', '{n} samples', '{n} サンプル'],
    modelUsageBenchmark: ['均价 {cost} · {time} · {samples} 样本', 'Avg {cost} · {time} · {samples} samples', '平均 {cost} · {time} · {samples} サンプル'],
    modelUsageUnavailable: ['基准待收集', 'Benchmark pending', 'ベンチマーク待ち'],
    metricPending: ['待收集', 'Pending', '収集中'],
    iqColumnModel: ['模型', 'Model', 'モデル'],
    iqColumnScore: ['IQ', 'IQ', 'IQ'],
    iqColumnReasoning: ['推理', 'Reasoning', '推論'],
    iqColumnCost: ['费用', 'Cost', 'コスト'],
    iqColumnTime: ['耗时', 'Time', '時間'],
    iqColumnSamples: ['样本', 'Samples', 'サンプル'],
    iqColumnGradedSamples: ['题次', 'Graded', '採点数'],
    sourceDetails: ['筛选与数据说明', 'Filters & data notes', '絞り込みとデータについて'],
    activityDetails: ['统计详情', 'Activity details', '利用の詳細'],
    quotaDetails: ['使用明细', 'Usage details', '使用内訳'],
    metricCoverage: ['测评覆盖', 'Coverage', '測定範囲'],
    radarAttention: ['数据需留意 · 展开数据说明查看', 'Data needs attention · expand data notes', 'データに注意・詳細をご確認ください'],
    radarPartialShort: ['已读取 {n}/{total} 个档位', '{n}/{total} selections loaded', '{n}/{total} 段階を取得済み'],
    statusCompactOk: ['已更新 {time}', 'Updated {time}', '更新 {time}'],
    statusCompactError: ['{n} 项读取异常', '{n} data issues', '{n} 件の読み取りエラー'],
    statusCompactLoading: ['正在更新…', 'Updating…', '更新中…'],
    radarCoverage: ['覆盖 {n}/{total} 题', '{n}/{total} tasks covered', '{n}/{total}問をカバー'],
    radarReadAt: ['读取 {t}', 'Read {t}', '取得 {t}'],
    radarBenchNotice: ['与原站当前雷达分同源（满分 150）；题次为累计已判题次，非 24h 样本。', 'Current RadarBench score, out of 150. Graded counts are cumulative, not 24h samples.', '原サイトの現在のレーダースコア（150点満点）。採点数は累計で24時間サンプルではありません。'],
    radarPartialRead: ['本轮已读取 {n}/{total} 个档位，其余保留缓存或等待下次读取。', 'Read {n}/{total} selections; others keep cached values or await the next read.', '今回{n}/{total}設定を取得。他はキャッシュを保持するか次回取得を待機。'],
    radarCostEvidence: ['平均 API 等价费用；已知费用样本 {n}/{total}，缺失值不当作零；非订阅实扣。', 'Mean API-equivalent cost; {n}/{total} samples have cost evidence. Missing values are not zero; not subscription charges.', '平均API換算費用。既知の費用サンプル{n}/{total}。欠損はゼロ扱いせず、実際のサブスク課金ではありません。'],
    modelsUsed: ['按模型', 'By model', 'モデル別'],
    secondsShort: ['秒', 's', '秒'],
    minutesShort: ['分钟', 'm', '分'],
    hoursShort: ['小时', 'h', '時間'],
    expandModels: ['展开其余 {n} 个模型', 'Show {n} more models', '残り {n} モデルを表示'],
    collapseModels: ['收起模型', 'Show fewer models', '折りたたむ'],
    modelGroupSol: ['Sol', 'Sol', 'Sol'],
    modelGroupAstra: ['Astra', 'Astra', 'Astra'],
    latestModels: ['最新：{models}', 'Latest: {models}', '最新：{models}'],
    onlyLatestModels: ['仅看最新', 'Latest only', '最新のみ'],
    allModels: ['全部模型', 'All models', '全モデル'],
    modelGroupTerra: ['Terra', 'Terra', 'Terra'],
    modelGroupLuna: ['Luna', 'Luna', 'Luna'],
    modelGroupOther: ['其他', 'Other', 'その他'],
    noIqData: ['暂无 IQ 数据', 'No IQ data', 'IQ データがありません'],
    passedRatio: ['{p} / {t} 通过', '{p}/{t} passed', '{p}/{t} 合格'],
    badSample: ['样本异常', 'Bad sample', 'サンプル異常'],
    colTier: ['档位', 'Tier', 'ティア'],
    colMetric: ['指标', 'Metric', '指標'],
    rowMeasured: ['实测额度', 'Measured quota', '実測クォータ'],
    rowSharedUsed: ['共享池已用', 'Shared pool used', '共有プール使用'],
    rowReset: ['重置', 'Reset', 'リセット'],
    noQuotaRadar: ['暂无额度雷达数据', 'No quota radar data', 'クォータレーダーのデータがありません'],
    calibTitle: ['额度校准', 'Quota calibration', 'クォータ校正'],
    calibStatus: ['已校准', 'Calibrated', '校正済み'],
    calibNone: ['暂无校准说明', 'No calibration notes', '校正情報なし'],
    srcTitle: ['数据来源', 'Data source', 'データ提供'],
    sourceStatus: ['外部来源', 'External source', '外部ソース'],
    attributionClaude: [
      '数据来自 Claude Code 雷达 claudecoderadar.com',
      'Data from Claude Code Radar (claudecoderadar.com)',
      'データ提供：Claude Code レーダー claudecoderadar.com'
    ],
    noRadarNotes: ['暂无雷达说明数据', 'No radar notes yet', 'レーダー情報がありません'],
    resetTimelineTitle: ['最近的重置状态', 'Recent reset status', '最近のリセット状況'],
    statusAvailable: ['可用', 'Available', '利用可'],
    statusRedeemed: ['已使用', 'Used', '使用済み'],
    statusExpired: ['已过期', 'Expired', '期限切れ'],
    statusUnknown: ['未知', 'Unknown', '不明'],
    expiresAt: ['到期 {t}', 'Expires {t}', '期限 {t}'],
    noExpiry: ['暂无到期时间', 'No expiry', '期限情報なし'],
    creditsAvailable: ['当前可用 {n} 张重置卡', '{n} reset credits available', '利用可能なリセットカード {n} 枚'],
    noResetCards: ['暂无重置卡数据', 'No reset credit data', 'リセットカードのデータがありません'],
    wallHours: ['{h}小时', '{h}h', '{h}時間'],
    wallMinutes: ['{m}分钟', '{m}m', '{m}分'],
    amSuffix: [' 上午', ' AM', ' 午前'],
    pmSuffix: [' 下午', ' PM', ' 午後'],

    // 托盘（主进程）
    trayCodex: ['GPT 5h：{p}  周：{s}', 'GPT 5h {p} · W {s}', 'GPT 5h：{p}  週：{s}'],
    trayClaude: ['CC 5h：{p}  周：{s}', 'CC 5h {p} · W {s}', 'CC 5h：{p}  週：{s}'],
    trayTipLoadingCodex: ['Codex 用量读取中', 'Loading Codex usage', 'Codex 使用量を取得中'],
    trayTipLoadingClaude: ['Claude 用量读取中', 'Loading Claude usage', 'Claude 使用量を取得中'],
    trayTipCodex: [
      '5小时剩余 {p}%，周额度剩余 {s}%{limit}',
      '5h {p}% left, weekly {s}% left{limit}',
      '5時間残り {p}%、週間残り {s}%{limit}'
    ],
    trayTipCodexUnlimited: [
      '5小时不限量，周额度剩余 {s}%{limit}',
      '5h unlimited, weekly {s}% left{limit}',
      '5時間は無制限、週間残り {s}%{limit}'
    ],
    trayTipClaude: [
      'Claude 5小时剩余 {p}%，周额度剩余 {s}%{limit}',
      'Claude: 5h {p}% left, weekly {s}% left{limit}',
      'Claude 5時間残り {p}%、週間残り {s}%{limit}'
    ],
    trayTipLimit: ['，已触及限额', ' — limit reached', '、上限到達'],
    trayFive: ['5h：{p}', '5h {p}', '5h：{p}'],
    trayWeek: ['周：{p}', 'W {p}', '週：{p}'],
    settingsTitle: ['AI Usage Signal Bar 设置', 'AI Usage Signal Bar Settings', 'AI Usage Signal Bar 設定'],

    // 错误（主进程）
    errCodexAuthMissing: [
      '找不到 ~/.codex/auth.json，请先在 Codex 中登录 ChatGPT 账号。',
      '~/.codex/auth.json not found. Sign in to Codex first.',
      '~/.codex/auth.json が見つかりません。先に Codex でログインしてください。'
    ],
    errCodexAuthInvalid: [
      '~/.codex/auth.json 不是有效 JSON，请重新登录 Codex。',
      '~/.codex/auth.json is not valid JSON. Sign in to Codex again.',
      '~/.codex/auth.json が不正な JSON です。Codex に再ログインしてください。'
    ],
    errCodexAuthNoToken: [
      'Codex 登录凭证里没有 access_token，请重新登录 Codex。',
      'No access_token in Codex credentials. Sign in to Codex again.',
      'Codex の資格情報に access_token がありません。再ログインしてください。'
    ],
    errExpired: [
      '{provider} 登录已过期，请重新登录后再刷新。',
      '{provider} session expired. Sign in again, then refresh.',
      '{provider} のログインが期限切れです。再ログイン後に更新してください。'
    ],
    errTimeout: [
      '{provider} 请求超时，请稍后重试。',
      '{provider} request timed out. Try again later.',
      '{provider} リクエストがタイムアウトしました。しばらくして再試行してください。'
    ],
    errHttp: ['请求失败：HTTP {status}', 'Request failed: HTTP {status}', 'リクエスト失敗：HTTP {status}'],
    errFetch: ['{provider} 数据读取失败。', '{provider} data fetch failed.', '{provider} データの取得に失敗しました。'],
    errSystemProxy: ['系统代理连接失败，请检查代理软件是否正在运行。', 'System proxy connection failed. Check your proxy app.', 'システムプロキシに接続できません。プロキシアプリを確認してください。'],
    errNetwork: ['{provider} 网络连接失败，请检查网络或系统代理。', '{provider} network connection failed. Check your network or system proxy.', '{provider} に接続できません。ネットワークとシステムプロキシを確認してください。'],
    errInvalidJsonResponse: ['数据源返回了网页或无效数据，并非可读取的 JSON。', 'The source returned a webpage or invalid JSON.', 'データソースがWebページまたは不正なJSONを返しました。'],
    errUsageResponseInvalid: ['用量接口返回了无法识别的数据，未将其当作零额度。', 'Unrecognized usage response; not treated as zero quota.', '使用量の応答形式が不明です。残量ゼロとしては扱いません。'],
    errRadarNoMetrics: ['雷达数据源未提供有效测评数据。', 'The radar source returned no valid measurements.', 'レーダーの有効な測定データがありません。'],
    errClaudeRadarSourceUnavailable: ['Claude 雷达原数据源已不再返回测评 JSON，暂时无法获取 IQ。', 'The original Claude radar source no longer serves benchmark JSON. IQ is unavailable.', '元のClaudeレーダーが測定JSONを提供していないため、IQを取得できません。'],
    radarSourceStale: ['数据源测评停留于 {date}，下方为历史实测，非当前实时 IQ。', 'Measurements last updated {date}. These are historical scores, not current live IQ.', '測定更新は{date}までです。過去の実測値であり、現在のIQではありません。'],
    radarLatestPending: ['新模型尚无实测 IQ，点击“全部模型”可查看历史实测。', 'No measured IQ for the latest models yet. Select All models for historical measurements.', '最新モデルの実測IQは未公開です。「全モデル」で過去の実測値を表示できます。'],
    errClaude429: [
      'Claude 官方接口限流，已保留上次精确数据。',
      'Claude API rate-limited; keeping last exact data.',
      'Claude API がレート制限中。前回のデータを保持します。'
    ],
    errClaudeTimeout: [
      'Claude 官方请求超时，已保留上次精确数据。',
      'Claude API timed out; keeping last exact data.',
      'Claude API がタイムアウト。前回のデータを保持します。'
    ],
    errClaude5xx: [
      'Claude 官方服务暂时不可用，已保留上次精确数据。',
      'Claude API temporarily unavailable; keeping last exact data.',
      'Claude API が一時的に利用不可。前回のデータを保持します。'
    ],
    errClaudeNoCli: [
      '未找到 Claude CLI 登录，请先在 Claude Code 中登录。',
      'No Claude CLI login found. Sign in via Claude Code first.',
      'Claude CLI のログインが見つかりません。Claude Code でログインしてください。'
    ],
    errClaudeAuthExpired: [
      'Claude 登录已过期，请重新登录：claude auth login --claudeai',
      'Claude sign-in expired. Sign in again: claude auth login --claudeai',
      'Claude のログイン期限が切れました。再ログイン：claude auth login --claudeai'
    ],
    errClaudeBadData: [
      'Claude 官方接口返回了无法识别的数据。',
      'Claude API returned unrecognized data.',
      'Claude API が不明なデータを返しました。'
    ],
    errClaudeUnavailable: [
      'Claude 官方用量暂时不可用。',
      'Claude usage temporarily unavailable.',
      'Claude 使用量は一時的に取得できません。'
    ],
    // Claude 断连卡片与一键重连
    claudeConnectTitleExpired: ['Claude Code 登录已过期', 'Claude Code sign-in expired', 'Claude Code のログイン期限切れ'],
    claudeConnectTitleMissing: ['尚未连接 Claude Code', 'Claude Code not connected', 'Claude Code 未接続'],
    claudeConnectBodyExpired: [
      '额度读取自 Claude Code 的登录。重新登录一次，这里会自动恢复。',
      'Quota is read from your Claude Code sign-in. Sign in again and this will recover on its own.',
      '使用枠は Claude Code のログインから取得します。再ログインすると自動で復帰します。'
    ],
    claudeConnectBodyMissing: [
      '额度读取自 Claude Code 的登录。在终端登录一次即可开始显示。',
      'Quota is read from your Claude Code sign-in. Sign in once in Terminal to get started.',
      '使用枠は Claude Code のログインから取得します。ターミナルで一度ログインしてください。'
    ],
    claudeConnectAction: ['重新连接', 'Reconnect', '再接続'],
    claudeConnectActionMissing: ['连接', 'Connect', '接続'],
    claudeConnectWaiting: ['等待登录完成…', 'Waiting for sign-in…', 'ログイン待ち…'],
    claudeConnectWaitingHint: [
      '已在「终端」打开登录，请在浏览器中完成授权。',
      'Sign-in opened in Terminal. Finish authorizing in your browser.',
      'ターミナルでログインを開きました。ブラウザで認証を完了してください。'
    ],
    claudeConnectFailed: [
      '无法打开终端，请手动运行：{command}',
      'Could not open Terminal. Run manually: {command}',
      'ターミナルを開けません。手動で実行してください：{command}'
    ],
    claudeReconnectShellTitle: ['重新连接 Claude Code', 'Reconnect Claude Code', 'Claude Code を再接続'],
    claudeReconnectShellMissing: [
      '未找到 claude 命令，请先安装 Claude Code：',
      'The claude command was not found. Install Claude Code first:',
      'claude コマンドが見つかりません。先に Claude Code をインストールしてください：'
    ],
    claudeReconnectShellDone: [
      '登录完成后，菜单栏会在几秒内自动恢复，可以关闭此窗口。',
      'Once signed in, the menu bar recovers within seconds. You can close this window.',
      'ログイン後、数秒でメニューバーが復帰します。このウィンドウは閉じて構いません。'
    ],
    errClaudeRefreshFailed: [
      '刷新 Claude 登录凭证失败',
      'Failed to refresh Claude credentials',
      'Claude 資格情報の更新に失敗'
    ],
    errNoLocalClaude: [
      '~/.claude/projects 里还没有本地用量记录。',
      'No local usage records in ~/.claude/projects yet.',
      '~/.claude/projects にローカル記録がまだありません。'
    ],
    errNoLocalCodex: [
      '~/.codex 里还没有本地用量记录。',
      'No local usage records in ~/.codex yet.',
      '~/.codex にローカル記録がまだありません。'
    ],
    errNoApiKey: [
      '未配置 API Key，请在设置中填写。',
      'No API key configured. Add one in Settings.',
      'API Key が未設定です。設定で入力してください。'
    ],
    errQwenNoApi: [
      'Qwen 官方暂未提供额度查询接口，请在百炼控制台查看用量。',
      'Qwen has no public quota API yet. Check usage in the Model Studio console.',
      'Qwen は公開クォータ API を提供していません。コンソールでご確認ください。'
    ],

    // 设置窗口
    title: ['设置', 'Settings', '設定'],
    subtitle: ['AI Usage Signal Bar', 'AI Usage Signal Bar', 'AI Usage Signal Bar'],
    language: ['语言', 'Language', '言語'],
    languageHint: ['应用全局显示语言（面板 / 菜单栏 / 设置）', 'Display language for the whole app (panel / menu bar / settings)', 'アプリ全体の表示言語（パネル / メニューバー / 設定）'],
    openAtLogin: ['开机自启动', 'Open at login', 'ログイン時に起動'],
    openAtLoginHint: ['登录后自动启动菜单栏工具', 'Start the menu bar app after login', 'ログイン後にメニューバーツールを起動'],
    autoHide: ['跟随菜单栏收起', 'Follow menu bar', 'メニューバーに追従'],
    autoHideHint: ['菜单栏隐藏时自动收起面板', 'Hide the panel when the menu bar hides', 'メニューバー非表示時にパネルを閉じる'],
    autoSwitchProvider: ['跟随前台应用', 'Follow frontmost app', '最前面のアプリに追従'],
    autoSwitchProviderHint: [
      '打开 Codex / Claude Code 时自动切换，仍可手动选择',
      'Switch for Codex / Claude Code; manual selection stays available',
      'Codex / Claude Code に自動切替。手動選択も利用可能'
    ],
    notifications: ['额度提醒通知', 'Quota notifications', 'クォータ通知'],
    notificationsHint: ['剩余 20% / 5% 时提醒，重置后通知满血复活', 'Alert at 20% / 5% remaining; notify when the window resets', '残り 20% / 5% で通知、リセット時にもお知らせ'],
    hotkey: ['全局快捷键 ⌥⌘U', 'Global hotkey ⌥⌘U', 'グローバルショートカット ⌥⌘U'],
    hotkeyHint: ['在任何应用中按 ⌥⌘U 呼出/收起面板', 'Press ⌥⌘U anywhere to toggle the panel', 'どのアプリからでも ⌥⌘U でパネルを開閉'],
    refreshData: ['刷新数据', 'Refresh data', 'データを更新'],
    refreshDataHint: ['立即更新用量和雷达', 'Update usage and radar now', '使用量とレーダーを今すぐ更新'],
    openRadar: ['打开当前雷达', 'Open current radar', '現在のレーダーを開く'],
    openRadarHint: ['在浏览器查看当前数据源页面', 'View the active source page in browser', '現在のデータソースをブラウザで表示'],
    showApp: ['显示应用位置', 'Show app location', 'アプリの場所を表示'],
    showAppHint: ['在访达中定位这个 App', 'Reveal this app in Finder', 'Finder でこの App を表示'],
    quitApp: ['退出程序', 'Quit app', '終了'],
    quitAppHint: ['关闭菜单栏工具', 'Close the menu bar tool', 'メニューバーツールを閉じる'],
    providerSection: ['模型显示', 'Visible providers', '表示するプロバイダ'],
    claudeHint: ['在面板、菜单栏和 Touch Bar 中显示 Claude', 'Show Claude in the panel, menu bar, and Touch Bar', 'パネル、メニューバー、Touch Bar に Claude を表示'],
    kimiHint: ['显示 Kimi Coding Plan 额度（api.kimi.com）', 'Show Kimi Coding Plan quota (api.kimi.com)', 'Kimi Coding Plan のクォータを表示'],
    glmHint: ['显示智谱 GLM Coding Plan 额度（bigmodel.cn / z.ai）', 'Show GLM Coding Plan quota (bigmodel.cn / z.ai)', 'GLM Coding Plan のクォータを表示'],
    qwenHint: ['官方暂无额度查询接口，开启后仅显示说明', 'No public quota API; shows a notice only', '公開クォータ API 非対応。案内のみ表示'],
    apiKey: ['API Key', 'API Key', 'API Key'],
    apiKeyHint: ['仅保存在本机设置文件中', 'Stored only in the local settings file', 'ローカル設定ファイルにのみ保存'],
    mobileSection: ['手机联动', 'Mobile link', 'モバイル連携'],
    mobileEnabled: ['启用手机面板', 'Enable mobile dashboard', 'モバイル画面を有効化'],
    mobileEnabledHint: ['在本机启动只读、安全的移动端页面', 'Start a secure read-only mobile page on this Mac', 'このMacで安全な読み取り専用ページを起動'],
    mobileSecurity: ['只传输脱敏后的只读数据', 'Only sanitized read-only data is shared', '匿名化された読み取り専用データのみ共有'],
    mobileAddress: ['访问地址', 'Access address', 'アクセス先'],
    mobilePreview: ['预览', 'Preview', 'プレビュー'],
    mobileCopy: ['复制链接', 'Copy link', 'リンクをコピー'],
    mobileRotate: ['更换密钥', 'New key', 'キーを更新'],
    mobileStarting: ['正在启动', 'Starting', '起動中'],
    mobileLocalReady: ['本机预览已就绪', 'Local preview ready', 'ローカルプレビュー準備完了'],
    mobileLanReady: ['同一 Wi-Fi 访问已就绪', 'Same-Wi-Fi access ready', '同じWi-Fiからアクセス可能'],
    mobileRemoteReady: ['手机远程访问已就绪', 'Remote mobile access ready', 'モバイル遠隔アクセス準備完了'],
    mobileStopped: ['服务未启动', 'Service stopped', 'サービス停止中'],
    mobileLocalHint: ['连接 Wi-Fi 后可生成手机地址', 'Connect to Wi-Fi to create a phone address', 'Wi-Fiに接続するとモバイル用URLを生成します'],
    mobileLanHint: ['手机连接同一 Wi-Fi 后扫描二维码；外网访问需配置 Tailscale', 'Scan on the same Wi-Fi; configure Tailscale for remote access', '同じWi-FiでQRを読み取り、外出先ではTailscaleを設定'],
    mobileRemoteHint: ['同一 Tailscale 账户下的设备可安全访问', 'Devices in the same tailnet can connect securely', '同じTailnetの端末から安全にアクセスできます'],
    mobileError: ['手机服务启动失败', 'Mobile service failed to start', 'モバイルサービスの起動に失敗'],
    tailscaleInstall: ['安装 Tailscale', 'Install Tailscale', 'Tailscaleをインストール'],
    tailscaleInstallHint: ['安装后可在外网安全访问', 'Required for secure remote access', '安全な遠隔アクセスに必要です'],
    tailscaleConfigure: ['配置远程访问', 'Configure remote access', '遠隔アクセスを設定'],
    tailscaleConfigureHint: ['使用 Tailscale Serve 建立私人 HTTPS 地址', 'Create a private HTTPS address with Tailscale Serve', 'Tailscale Serveで非公開HTTPSを作成'],
    tailscaleReady: ['远程已连接', 'Remote ready', '遠隔接続済み'],
    tailscaleDisconnected: ['Tailscale 未连接', 'Tailscale disconnected', 'Tailscale未接続'],
    tailscaleConsent: ['等待网页授权', 'Waiting for approval', '承認待ち'],
    tailscaleNotInstalled: ['未安装', 'Not installed', '未インストール'],
    tailscaleNotConfigured: ['待配置', 'Setup needed', '設定が必要'],
    tailscaleError: ['异常', 'Error', 'エラー'],
    mobileCopied: ['链接已复制', 'Link copied', 'リンクをコピーしました'],
    mobileKeyRotated: ['访问密钥已更换', 'Access key replaced', 'アクセスキーを更新しました'],
    cloudSyncSection: ['加密云同步', 'Encrypted cloud sync', '暗号化クラウド同期'],
    cloudSyncEnabled: ['启用网页云同步', 'Enable web cloud sync', 'Webクラウド同期を有効化'],
    cloudSyncEnabledHint: ['Mac 本地加密，云端只保存密文', 'Encrypted on the Mac; the cloud stores ciphertext only', 'Macで暗号化し、クラウドには暗号文のみ保存'],
    cloudSyncServer: ['同步服务地址', 'Sync service URL', '同期サービスURL'],
    cloudSyncSecurity: ['解密密钥不会上传到服务器', 'The decryption key never reaches the server', '復号キーはサーバーへ送信されません'],
    cloudSyncPreview: ['打开网页', 'Open web app', 'Webアプリを開く'],
    cloudSyncCopy: ['复制配对链接', 'Copy pairing link', 'ペアリングリンクをコピー'],
    cloudSyncRecovery: ['复制恢复码', 'Copy recovery code', '復旧コードをコピー'],
    cloudSyncNow: ['立即同步', 'Sync now', '今すぐ同期'],
    cloudSyncReset: ['重置配对', 'Reset pairing', 'ペアリングをリセット'],
    cloudSyncDisabled: ['云同步未开启', 'Cloud sync is off', 'クラウド同期はオフです'],
    cloudSyncUnconfigured: ['请先填写同步服务地址', 'Enter a sync service URL first', '同期サービスURLを入力してください'],
    cloudSyncSyncing: ['正在加密上传', 'Encrypting and uploading', '暗号化してアップロード中'],
    cloudSyncReady: ['端到端加密同步已就绪', 'End-to-end encrypted sync is ready', 'エンドツーエンド暗号化同期の準備完了'],
    cloudSyncError: ['同步失败', 'Sync failed', '同期に失敗しました'],
    cloudSyncNever: ['尚未完成首次同步', 'No successful sync yet', 'まだ同期されていません'],
    cloudSyncLast: ['上次同步 {time}', 'Last synced {time}', '最終同期 {time}'],
    cloudSyncCopied: ['配对信息已复制', 'Pairing details copied', 'ペアリング情報をコピーしました'],
    cloudSyncResetConfirm: ['重置后已绑定的手机将无法继续访问。确定重置吗？', 'Paired phones will lose access. Reset pairing?', 'リセットするとペアリング済み端末はアクセスできなくなります。続行しますか？'],
    synced: ['已同步', 'Synced', '同期済み'],
    saving: ['保存中', 'Saving', '保存中'],
    refreshing: ['刷新中', 'Refreshing', '更新中'],
    refreshed: ['已刷新', 'Refreshed', '更新済み'],
    opened: ['已打开', 'Opened', '開きました']
  };

  function normalizeLanguage(language) {
    return LOCALES.includes(language) ? language : FALLBACK;
  }

  function t(language, key, params) {
    const entry = dict[key];
    if (!entry) return key;
    let text = entry[LOCALES.indexOf(normalizeLanguage(language))] ?? entry[0];
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  }

  function formatTokenCount(language, value, { withUnit = true } = {}) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    const locale = normalizeLanguage(language);
    if (locale === 'en-US') {
      const unit = withUnit ? ' tokens' : '';
      if (number >= 1e9) return `${(number / 1e9).toFixed(2)}B${unit}`;
      if (number >= 1e6) return `${(number / 1e6).toFixed(2)}M${unit}`;
      if (number >= 1e4) return `${(number / 1e3).toFixed(1)}K${unit}`;
      return `${new Intl.NumberFormat('en-US').format(Math.round(number))}${unit}`;
    }
    const unit = withUnit ? ' token' : '';
    const hundredMillion = locale === 'ja-JP' ? '億' : '亿';
    if (number >= 1e8) return `${(number / 1e8).toFixed(2)} ${hundredMillion}${unit}`;
    if (number >= 1e4) return `${(number / 1e4).toFixed(2)} 万${unit}`;
    return `${new Intl.NumberFormat('en-US').format(Math.round(number))}${unit}`;
  }

  return { t, normalizeLanguage, formatTokenCount, LOCALES, FALLBACK };
});
