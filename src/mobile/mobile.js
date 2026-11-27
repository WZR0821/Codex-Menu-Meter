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
    appTitle: 'AI 用量',
    providerNav: '模型平台',
    viewNav: '视图',
    keyInvalid: '访问密钥已失效',
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
    quotaDetails: '使用明细',
    metricCoverage: '测评覆盖',
    radarAttention: '数据需留意 · 展开数据说明查看',
    radarFourNotice: '原站四题众测正式分榜，{date} 批次，满分 150（秦始皇 60、庞贝 45、鹈鹕 22.5、糖果 22.5）。费用和耗时是每题平均，费用按 API 价格估算，不是订阅实扣。',
    radarFourPartial: '本批次 {n}/{total} 个档位四题已判完，其余缺题，暂不计总分。',
    radarFourPartialShort: '已判完 {n}/{total} 个档位',
    iqTaskCombined: '秦始皇',
    iqTaskPompeii: '庞贝',
    iqTaskPelican: '鹈鹕',
    iqTaskCandy: '糖果',
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
    sourceClaudeOfficial: 'Claude 官方',
    statusPending: '达到上限后可用',
    statusPaused: '已暂停',
    resetsLeft: '剩余 {left}/{total} 次',
    resetCardFallback: '额度重置',
    resetKindSession: '5 小时重置',
    resetKindWeekly: '一周重置',
    resetKindFull: '完全重置',
    resetWithheld: '官方接口没有向本应用提供重置卡，可在 Claude Code 里输入 /limit-reset 查看',
    updated: '更新 {time}',
    remaining: '{label} 剩余',
    label5h: '5 小时',
    labelWeek: '一周',
    noReset: '暂无重置时间',
    today: '今日 Token',
    total: '近 30 天',
    totalWeek: '近 7 天',
    io: '读写 {value}',
    cacheHit: '缓存命中率 {value}',
    cacheHitHint: '缓存读取 Token 占总输入 Token 的比例；≥97% 绿色，93–97% 黄色，<93% 红色',
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
    unavailable: '不可用',
    // 以下与桌面面板的文案保持一致（src/i18n.js）
    todayUsed: '今天已使用',
    windowUsed: '近 30 天已使用',
    weekUsed: '近 7 天已使用',
    modelUnknown: '未知型号',
    tokenRangeAria: 'Token 活动时间范围',
    tokenRangeWeek: '7 天',
    tokenRangeMonth: '30 天',
    tokenWeekAria: '近 7 天每日用量，按模型分色',
    resetSoon: '即将重置',
    resetInDH: '{d}天{h}小时后重置',
    resetInD: '{d}天后重置',
    resetInHM: '{h}小时{m}分钟后重置',
    resetInH: '{h}小时后重置',
    resetInM: '{m}分钟后重置',
    resetTime: '重置时间',
    scopedResetTime: '{name} 重置时间',
    inactiveFooter: '使用后开始计时',
    unlimitedBadge: '无限制',
    unlimitedFooter: '已取消 5 小时限制',
    radarPaused: '雷达数据源暂不可用',
    radarPausedHint: '原雷达站已停止提供数据。额度和重置时间来自官方接口，不受影响。',
    resetPassed: '已重置',
    dataAsOf: '数据截至 {time}',
    cloudMacStale: '电脑未上传 · 上次 {time}',
    windowName5h: '5 小时',
    windowNameWeek: '周额度',
    windowNameScoped: '{name}',
    paceRunOut: '{window}：比匀速快 {delta} 个点，约 {time} 用完',
    paceBehind: '{window}：比匀速慢 {delta} 个点，重置前用不完',
    paceSteady: '{window}：接近匀速，重置前用不完',
    paceEarly: '{window}：窗口刚开始，暂不预测',
    paceExhausted: '{window}：已用完，{time} 恢复',
    paceResetPending: '{window}：已过重置时间，等待新数据',
    paceUnknown: '{window}：没有重置时间，无法判断节奏',
    paceAheadBadge: '偏快 {delta}',
    paceAheadShort: '节奏偏快',
    trendAxisStart: '24 小时前',
    trendAxisNow: '现在',
    trendPaceLegend: '匀速',
    trendUsed: '{label} {value}%',
    trendReadout: '{time} 已用：{values}',
    trendLabel: '近 24 小时已用额度曲线',
    serviceLevel_maintenance: '维护中',
    serviceLevel_minor: '性能下降',
    serviceLevel_major: '部分故障',
    serviceLevel_critical: '严重故障',
    serviceStatusLine: '{name} 官方状态：{level}'
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
    appTitle: 'AI Usage',
    providerNav: 'Providers',
    viewNav: 'View',
    keyInvalid: 'Access key no longer valid',
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
    quotaDetails: 'Usage details',
    metricCoverage: 'Coverage',
    radarAttention: 'Data needs attention · expand data notes',
    radarFourNotice: 'Codex Radar four-task leaderboard, {date} round, out of 150 (Qin Shi Huang 60, Pompeii 45, Pelican 22.5, Candy 22.5). Cost and time are per-task averages; costs are API-equivalent estimates, not subscription charges.',
    radarFourPartial: '{n}/{total} selections have all four tasks graded; the rest have no total yet.',
    radarFourPartialShort: '{n}/{total} selections graded',
    iqTaskCombined: 'Qin Shi Huang',
    iqTaskPompeii: 'Pompeii',
    iqTaskPelican: 'Pelican',
    iqTaskCandy: 'Candy',
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
    sourceClaudeOfficial: 'Claude official',
    statusPending: 'Usable at limit',
    statusPaused: 'Paused',
    resetsLeft: '{left}/{total} left',
    resetCardFallback: 'Limit reset',
    resetKindSession: '5-hour reset',
    resetKindWeekly: 'Weekly reset',
    resetKindFull: 'Full reset',
    resetWithheld: 'The official API does not return reset credits to this app. Run /limit-reset in Claude Code to view them.',
    updated: 'Updated {time}',
    remaining: '{label} left',
    label5h: '5 hours',
    labelWeek: 'One week',
    noReset: 'No reset time',
    today: 'Today',
    total: 'Last 30 days',
    totalWeek: 'Last 7 days',
    io: 'I/O {value}',
    cacheHit: 'Cache hit {value}',
    cacheHitHint: 'Cached input as a share of all input; green at 97% and above, yellow at 93–97%, red below 93%',
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
    unavailable: 'Unavailable',
    todayUsed: 'Today used',
    windowUsed: '30-day used',
    weekUsed: '7-day used',
    modelUnknown: 'unknown model',
    tokenRangeAria: 'Token activity range',
    tokenRangeWeek: '7d',
    tokenRangeMonth: '30d',
    tokenWeekAria: 'Daily usage for the last 7 days, colored by model',
    resetSoon: 'Resetting soon',
    resetInDH: 'Resets in {d}d {h}h',
    resetInD: 'Resets in {d}d',
    resetInHM: 'Resets in {h}h {m}m',
    resetInH: 'Resets in {h}h',
    resetInM: 'Resets in {m}m',
    resetTime: 'Resets at',
    scopedResetTime: '{name} resets at',
    inactiveFooter: 'Timer starts after first use',
    unlimitedBadge: 'Unlimited',
    unlimitedFooter: 'No 5-hour limit',
    radarPaused: 'Radar source unavailable',
    radarPausedHint: 'The radar site no longer publishes data. Quota and reset times come from the official API and are unaffected.',
    resetPassed: 'Reset',
    dataAsOf: 'Data as of {time}',
    cloudMacStale: 'Mac not syncing · Last {time}',
    windowName5h: '5h',
    windowNameWeek: 'Weekly',
    windowNameScoped: '{name}',
    paceRunOut: '{window}: {delta} pts ahead, runs out ~{time}',
    paceBehind: '{window}: {delta} pts under pace, lasts until reset',
    paceSteady: '{window}: near even pace, lasts until reset',
    paceEarly: '{window}: window just started, no projection yet',
    paceExhausted: '{window}: used up, back at {time}',
    paceResetPending: '{window}: reset passed, waiting for fresh data',
    paceUnknown: '{window}: no reset time, pace unknown',
    paceAheadBadge: '+{delta} pts',
    paceAheadShort: 'Running fast',
    trendAxisStart: '24h ago',
    trendAxisNow: 'Now',
    trendPaceLegend: 'Even pace',
    trendUsed: '{label} {value}%',
    trendReadout: '{time} used: {values}',
    trendLabel: 'Quota used over the last 24 hours',
    serviceLevel_maintenance: 'Maintenance',
    serviceLevel_minor: 'Degraded',
    serviceLevel_major: 'Partial outage',
    serviceLevel_critical: 'Major outage',
    serviceStatusLine: '{name} status: {level}'
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
    tokenTitle: 'トークン活動',
    appTitle: 'AI 使用量',
    providerNav: 'プロバイダ',
    viewNav: '表示',
    keyInvalid: 'アクセスキーが無効です',
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
    quotaDetails: '使用内訳',
    metricCoverage: '測定範囲',
    radarAttention: 'データに注意・詳細をご確認ください',
    radarFourNotice: '原サイトの4問テスト正式ランキング（{date}実施、150点満点：始皇帝60・ポンペイ45・ペリカン22.5・キャンディ22.5）。費用と時間は1問あたりの平均で、費用はAPI換算の推定です（実際のサブスク課金ではありません）。',
    radarFourPartial: '{n}/{total}設定は4問とも採点済み。残りは未採点の問題があり、合計点はまだありません。',
    radarFourPartialShort: '{n}/{total}設定を採点済み',
    iqTaskCombined: '始皇帝',
    iqTaskPompeii: 'ポンペイ',
    iqTaskPelican: 'ペリカン',
    iqTaskCandy: 'キャンディ',
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
    sourceClaudeOfficial: 'Claude 公式',
    statusPending: '上限到達後に利用可',
    statusPaused: '一時停止中',
    resetsLeft: '残り {left}/{total} 回',
    resetCardFallback: '使用枠リセット',
    resetKindSession: '5時間リセット',
    resetKindWeekly: '週間リセット',
    resetKindFull: 'フルリセット',
    resetWithheld: '公式 API はこのアプリにリセットカードを返しません。Claude Code で /limit-reset を実行して確認できます。',
    updated: '{time} 更新',
    remaining: '{label} 残量',
    label5h: '5 時間',
    labelWeek: '1 週間',
    noReset: 'リセット時刻なし',
    today: '今日の Token',
    total: '直近 30 日',
    totalWeek: '直近 7 日',
    io: '読み書き {value}',
    cacheHit: 'キャッシュヒット率 {value}',
    cacheHitHint: '全入力 Token に占めるキャッシュ読み取りの割合。97% 以上は緑、93–97% は黄、93% 未満は赤',
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
    unavailable: '利用不可',
    todayUsed: '今日の使用量',
    windowUsed: '直近30日の使用量',
    weekUsed: '直近7日の使用量',
    modelUnknown: '不明なモデル',
    tokenRangeAria: 'トークン活動の期間',
    tokenRangeWeek: '7日',
    tokenRangeMonth: '30日',
    tokenWeekAria: '直近7日の日別使用量（モデル別に色分け）',
    resetSoon: 'まもなくリセット',
    resetInDH: '{d}日{h}時間後リセット',
    resetInD: '{d}日後リセット',
    resetInHM: '{h}時間{m}分後リセット',
    resetInH: '{h}時間後リセット',
    resetInM: '{m}分後リセット',
    resetTime: 'リセット時刻',
    scopedResetTime: '{name} のリセット時刻',
    inactiveFooter: '使用開始後にカウント',
    unlimitedBadge: '無制限',
    unlimitedFooter: '5時間制限は廃止',
    radarPaused: 'レーダーのデータ元は利用不可',
    radarPausedHint: '元のレーダーサイトはデータ提供を終了しました。使用枠とリセット時刻は公式 API から取得しており、影響はありません。',
    resetPassed: 'リセット済み',
    dataAsOf: '{time} 時点のデータ',
    cloudMacStale: 'Mac 未同期 · 最終 {time}',
    windowName5h: '5時間',
    windowNameWeek: '週間',
    windowNameScoped: '{name}',
    paceRunOut: '{window}：均等より {delta} pt 速く、{time} 頃に上限',
    paceBehind: '{window}：均等より {delta} pt 遅く、リセットまで持ちます',
    paceSteady: '{window}：ほぼ均等ペース、リセットまで持ちます',
    paceEarly: '{window}：開始直後のため予測なし',
    paceExhausted: '{window}：上限到達、{time} に回復',
    paceResetPending: '{window}：リセット時刻を過ぎました。新しいデータ待ち',
    paceUnknown: '{window}：リセット時刻がなくペース不明',
    paceAheadBadge: '速め +{delta}',
    paceAheadShort: 'ペース速め',
    trendAxisStart: '24 時間前',
    trendAxisNow: '現在',
    trendPaceLegend: '均等ペース',
    trendUsed: '{label} {value}%',
    trendReadout: '{time} 使用：{values}',
    trendLabel: '直近 24 時間の使用量の推移',
    serviceLevel_maintenance: 'メンテナンス中',
    serviceLevel_minor: 'パフォーマンス低下',
    serviceLevel_major: '一部障害',
    serviceLevel_critical: '重大な障害',
    serviceStatusLine: '{name} 公式ステータス：{level}'
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
  quotaDetailsToggle: document.getElementById('quotaDetailsToggle'),
  serviceBanner: document.getElementById('serviceBanner'),
  paceCard: document.getElementById('paceCard'),
  tokenHeading: document.getElementById('tokenHeading'),
  tokenUpdated: document.getElementById('tokenUpdated'),
  tokenRange: document.getElementById('tokenRange'),
  tokenCard: document.getElementById('tokenCard'),
  radarView: document.getElementById('radarView'),
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
// 1 年视图里选中的那个月（key 是「起~止」），按平台、按范围分别记；没选过就默认本月。
const selectedBucketByProvider = {};
// Token 活动看近 7 天、30 天、1 年还是上周的周报（1.1.0 起；2.0.0 加了后两种）。只记在这台手机的浏览器里，读不到就按 30 天。
const TOKEN_RANGE_KEY = 'cmm-mobile-token-range';
const TOKEN_WEEK = window.CMM_TOKEN_WEEK;
// 柱状图、1 年折线、周报、对比、分组明细、单日的按小时分布和额度去向的渲染和桌面面板共用 cards.js（2.0.0）。
const CARDS = window.CMM_CARDS;
let tokenRange = readTokenRange();
// 只在用户点切换的那一次渲染里为真：柱子依次长出来、30 天格子淡入；后台刷新不重播（1.1.1）。
let tokenRangeEnter = false;
// 柱状图当前的模型分组和那一份数据，点某一天时用它给详情里的模型上色。
let currentWeekSeries = null;
let currentTokenView = null;
// 单日明细里的 5 小时窗口要用这一份（点某一天时只重画明细）。
let currentTokenActivity = null;
const sectionSignatures = new Map();
const renderedMarkup = new WeakMap();
const disclosureState = new Map();

function restoreDisclosures(root = document) {
  root.querySelectorAll('details[data-detail]').forEach((detail) => {
    detail.dataset.detailOwner = provider;
    detail.open = disclosureState.get(`${provider}:${detail.dataset.detail}`) || false;
  });
  syncQuotaDetailsToggle();
}

document.addEventListener('toggle', (event) => {
  const detail = event.target;
  if (detail.matches?.('details[data-detail]')) {
    disclosureState.set(`${detail.dataset.detailOwner}:${detail.dataset.detail}`, detail.open);
    if (detail.classList.contains('quota-activity')) syncQuotaDetailsToggle();
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
let connectionAlive = false;
// 节奏计算和桌面面板共用 usage-pace.js（同目录，云端页面也带着它）。
const PACE = window.CMM_PACE || null;
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

// 云端模式下，电脑每隔 heartbeatMs 至少上传一次（数据没变也传）。连续三次没等到，
// 多半是电脑睡眠或断网：云端能连上，但内容已经旧了，状态点改成橙色并写明上次时间。
function cloudSnapshotStale() {
  const heartbeat = Number(currentState?.sync?.heartbeatMs) || 0;
  return Boolean(syncUpdatedAt && heartbeat && Date.now() - syncUpdatedAt > heartbeat * 3);
}

function setConnection(connected) {
  connectionAlive = connected;
  const macStale = connectionMode === 'cloud' && connected && cloudSnapshotStale();
  document.body.classList.toggle('offline', !connected || macStale);
  if (connectionMode === 'cloud') {
    const time = syncUpdatedAt ? formatClock(syncUpdatedAt) : '--';
    els.connectionLabel.textContent = !connected
      ? T('cloudOffline', { time })
      : macStale ? T('cloudMacStale', { time }) : T('cloudLive', { time });
    return;
  }
  els.connectionLabel.textContent = connected ? T('live') : T('offline');
}

// 用访问密钥换一个 HttpOnly Cookie。事件流（EventSource 不能带请求头）靠这个 Cookie 鉴权，
// 密钥不进 URL，也就不会留在代理日志和浏览器历史里。
async function ensureSession() {
  if (!accessToken) return;
  try {
    await fetch('/api/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store'
    });
  } catch {
    // 连不上时由调用方处理。
  }
}

function connectEvents() {
  eventSource?.close();
  clearTimeout(reconnectTimer);
  eventSource = new EventSource('/api/events');
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
    reconnectTimer = window.setTimeout(reconnectEvents, 5000);
  };
}

// 事件流断了：先重新换 Cookie（可能被清掉了），再用访问密钥读一次状态。
// 读到 401 说明电脑上换过访问密钥，停止重连并说明原因；以前会一直显示「Mac 已离线」、每 5 秒重试（2.1.0 修）。
async function reconnectEvents() {
  await ensureSession();
  try {
    applyState(await api('/api/state'));
    setConnection(true);
    connectEvents();
  } catch (error) {
    if (error.message === 'unauthorized') {
      showAccessRevoked();
      return;
    }
    setConnection(false);
    reconnectTimer = window.setTimeout(reconnectEvents, 5000);
  }
}

function showAccessRevoked() {
  setConnection(false);
  els.connectionLabel.textContent = T('keyInvalid');
  showToast(T('unauthorized'));
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
  // 页面标题、大标题和导航的读屏名称也跟着界面语言走（2.1.0 前写死中文）。
  document.title = T('appTitle');
  const heading = document.querySelector('.app-title, header h1:not(#pairingTitle)');
  if (heading) heading.textContent = T('appTitle');
  els.providerSwitch?.setAttribute('aria-label', T('providerNav'));
  document.querySelector('.view-switch')?.setAttribute('aria-label', T('viewNav'));
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
  // 附加平台（Kimi / GLM / Qwen）只有额度，没有本机 Token 记录和雷达：对应的区块收起来。
  const hasActivity = Boolean(providerData.activity);
  const hasRadar = Boolean(providerData.radar);
  document.body.dataset.providerKind = hasActivity || hasRadar ? 'main' : 'extra';
  // Antigravity 有 Token 活动、没有雷达：视图切换和附加平台一样收起（2.1.0）。
  document.body.dataset.radar = hasRadar ? 'on' : 'off';
  els.tokenHeading.hidden = !hasActivity;
  els.tokenCard.hidden = !hasActivity;
  if (!hasRadar && activeView === 'radar') {
    selectView('usage');
    return;
  }
  restoreDisclosures();
  if (activeView === 'usage') {
    // 套餐名只有 Claude 和 Antigravity 显示，和桌面面板一致。
    const planLabel = (provider === 'claude' || provider === 'antigravity') && providerData.usage?.data?.planType
      ? ` · ${formatPlanType(providerData.usage.data.planType)}`
      : '';
    els.usageHeading.textContent = T('usageTitle', { name: providerData.label }) + planLabel;
    // 卡片上写的是「多久后重置」，所以分钟数也算进签名：数据没变，过一分钟也要重画。
    renderSection('usage', [providerData.usage, providerData.activity?.data?.windows, minuteStamp()], () => renderUsage(providerData.usage, providerData.activity));
    renderServiceBanner(providerData.serviceStatus, provider === 'claude' ? 'Claude' : 'OpenAI');
    if (hasActivity) {
      renderSection('activity', [providerData.activity, selectedDayByProvider[provider], selectedBucketByProvider[provider]?.[tokenRange], isoDate(new Date()), tokenRange], () => renderActivity(providerData.activity));
    }
    renderSection('pace', [providerData.usage?.data, providerData.history?.day?.at(-1)?.t, minuteStamp()], () => renderPaceCard(providerData.usage?.data, providerData.history));
    fitPaceCard();
    return;
  }
  els.paceCard.hidden = true;
  renderRadar(providerData.radar, providerData.usage, providerData.activity);
}

function minuteStamp() {
  return Math.floor(Date.now() / 60_000);
}

function formatPlanType(value) {
  const text = String(value || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

const MAIN_PROVIDERS = ['codex', 'claude', 'antigravity'];

function renderUsage(usageSlice, activitySlice) {
  // 获取失败或超过 staleAfterMs 没刷新：标题右侧改成橙色的「数据截至 hh:mm」，卡片照常显示上次的数。
  const stale = Boolean(usageSlice?.data && usageSlice.fetchedAt)
    && (usageSlice.status === 'error' || Boolean(PACE?.isStale(usageSlice.fetchedAt, usageSlice.staleAfterMs)));
  els.usageUpdated.textContent = stale
    ? T('dataAsOf', { time: formatClock(usageSlice.fetchedAt) })
    : formatUpdated(usageSlice?.fetchedAt);
  els.usageUpdated.classList.toggle('stale', stale);
  const usage = usageSlice?.data;
  if (!usage) {
    updateHtml(els.quotaGrid, empty(usageSlice?.error));
    return;
  }
  const activityWindows = activitySlice?.data?.windows || {};
  const isExtra = !MAIN_PROVIDERS.includes(provider);
  const cards = [];
  // GPT / Claude 的专项周限额（例如 Fable）只有一项时并进「一周」卡（1.1.0 起，和桌面同一条规则）：
  // 大数字右侧放名称和剩余，进度条下面多一道细条，它的重置时间放进这张卡的明细里。
  const scopedWindows = isExtra ? [] : (usage.extraWindows || []);
  const { five: foldedFiveWindow, week: foldedScopedWindow } = foldedScopedWindows(scopedWindows, usage);
  if (usage.fiveHourUnlimited) {
    cards.push(unlimitedTemplate(T('label5h'), activityWindows.fiveHour));
  } else if (usage.primaryWindow) {
    cards.push(quotaTemplate(usage.primaryWindow, T('label5h'), {
      kind: 'five',
      activityWindow: activityWindows.fiveHour,
      detailKey: 'fiveHour',
      scopedWindow: foldedFiveWindow
    }));
  }
  if (usage.secondaryWindow) {
    cards.push(quotaTemplate(usage.secondaryWindow, T('labelWeek'), {
      kind: 'week',
      activityWindow: activityWindows.week,
      detailKey: 'week',
      scopedWindow: foldedScopedWindow
    }));
  }
  // 附加平台的额外窗口本身就是主要信息，保持整张卡。GPT / Claude 的专项周限额（例如 Fable）
  // 是补充信息：只有一项时已并进「一周」卡；不止一项（或没有「一周」卡）时才在两张卡下面单列，
  // 多于一项两两并排、只留名称和百分比，免得把 Token 活动挤出一屏。
  const extraWindows = usage.extraWindows || [];
  const compact = !isExtra && extraWindows.length > 1;
  const slimRows = [];
  extraWindows.forEach((windowValue, index) => {
    const name = scopedWindowName(windowValue);
    if (isExtra) {
      cards.push(quotaTemplate(windowValue, name || T('labelWeek'), { kind: 'extra', detailKey: `extra-${index}` }));
    } else if (windowValue !== foldedScopedWindow && windowValue !== foldedFiveWindow) {
      // 「一周 · 」前缀单独包一层：窄屏上先省掉它，把位置让给重置倒计时。
      const prefix = windowValue.fold === 'five' ? T('label5h') : T('labelWeek');
      slimRows.push(quotaSlimRowTemplate(windowValue, name || T('labelWeek'), name && !compact ? prefix : ''));
    }
  });
  // 额度去向（2.0.0）：一整块接在额度卡下面，跟着标题行的「使用明细」按钮一起展开（渲染在 cards.js，和桌面同一份）。
  const attribution = isExtra
    ? ''
    : CARDS.attributionHtml(CARDS.attributionModel(usage.secondaryWindow, activityWindows.week), { lang });
  const markup = cards.length || slimRows.length
    ? `${cards.join('')}${slimRows.length ? `<div class="quota-slim-rows${compact ? ' compact' : ''}">${slimRows.join('')}</div>` : ''}${attribution}`
    : '';
  updateHtml(els.quotaGrid, markup || empty(usageSlice?.error));
}

// 专项限额的显示名、并进哪张卡、卡片标题后的分组名：规则和桌面 renderer.js 同名函数一致（2.1.0）。
function scopedWindowName(windowValue) {
  return String(windowValue?.label || windowValue?.name || '').trim();
}

function foldedScopedWindows(scopedWindows, usage) {
  const named = scopedWindows.filter((item) => scopedWindowName(item));
  const week = named.find((item) => item.fold === 'week')
    || (named.length === 1 && scopedWindows.length === 1 && !named[0].fold ? named[0] : null);
  const five = named.find((item) => item.fold === 'five') || null;
  return {
    five: five && usage.primaryWindow && !usage.fiveHourUnlimited ? five : null,
    week: week && usage.secondaryWindow ? week : null
  };
}

function cardLabel(base, windowValue) {
  const group = String(windowValue?.group || '').trim();
  return group ? `${base} · ${group}` : base;
}

function remainingPercentOf(windowValue) {
  return clamp(Math.round(Number(windowValue?.remainingPercent) || 0), 0, 100);
}

function quotaFooter(windowValue) {
  if (windowValue.resetAt) return formatReset(windowValue.resetAt);
  return T(windowValue.inactive ? 'inactiveFooter' : 'noReset');
}

function quotaTemplate(windowValue, label, { kind = 'five', activityWindow = null, detailKey = null, scopedWindow = null } = {}) {
  const remaining = remainingPercentOf(windowValue);
  const critical = !windowValue.inactive && remaining <= 10;
  const pace = windowPace(windowValue, kind === 'five' ? 'five' : kind === 'week' ? 'week' : extraPaceKey(windowValue));
  const serious = !critical && pace?.tier === 'serious';
  // Antigravity 的分组名放右上角（和桌面一致），标题仍是「5 小时 剩余」。
  const group = String(windowValue.group || '').trim();
  const groupTag = group ? `<span class="quota-group-tag">${escapeHtml(group)}</span>` : '';
  // 有分组标签时「剩余」二字单独包一层，窄屏上省掉它给标签让位（读屏仍读完整标题）。
  const fullTitle = T('remaining', { label });
  const titleRest = fullTitle.startsWith(label) ? fullTitle.slice(label.length) : '';
  const titleHtml = group && titleRest
    ? `<span class="quota-top-label" aria-label="${escapeHtml(fullTitle)}">${escapeHtml(label)}<span class="quota-top-rest">${escapeHtml(titleRest)}</span></span>`
    : `<span class="quota-top-label">${escapeHtml(fullTitle)}</span>`;
  return `
    <article class="quota-card quota-card-${kind}${critical ? ' critical' : ''}${serious ? ' pace-serious' : ''}${scopedWindow ? ' has-scoped' : ''}" style="--quota:${remaining}%">
      <div class="quota-top${group ? ' has-group' : ''}">${titleHtml}${groupTag}</div>
      <div class="quota-value-row"><strong class="quota-value">${remaining}%</strong>${critical ? '' : paceFlagHtml(pace)}${scopedWindow ? quotaScopedStatHtml(scopedWindow) : ''}</div>
      <div class="quota-progress" aria-hidden="true"><i></i>${paceTickHtml(pace)}${scopedWindow ? quotaScopedLaneHtml(scopedWindow) : ''}</div>
      <small>${escapeHtml(quotaFooter(windowValue))}</small>
      ${quotaActivityTemplate(detailKey, activityWindow, windowValue, scopedWindow)}
    </article>
  `;
}

// 「一周」卡里的专项限额（1.1.0，和桌面同样子）：大数字右侧上面名称、下面剩余百分比，
// 进度条下面多一道细条，都用曲线里同一种颜色；节奏偏快时名称前加一个 ▲，颜色只落在图标上。
function scopedWindowState(windowValue) {
  const remaining = remainingPercentOf(windowValue);
  const critical = !windowValue.inactive && remaining <= 10;
  const pace = windowPace(windowValue, extraPaceKey(windowValue));
  return { remaining, critical, pace, serious: !critical && pace?.tier === 'serious' };
}

function quotaScopedStatHtml(windowValue) {
  const { remaining, critical, pace } = scopedWindowState(windowValue);
  const name = scopedWindowName(windowValue);
  const ahead = !critical && ['warning', 'serious'].includes(pace?.tier);
  const icon = ahead ? `<i class="pace-icon tier-${pace.tier}" aria-hidden="true">▲</i>` : '';
  const label = `${T('remaining', { label: name })} ${remaining}%${ahead ? ` · ${T('paceAheadShort')}` : ''}`;
  // 窄屏放不下长名字（Antigravity 的「Claude/GPT」）时换成短名，再放不下就省略号截断，不再顶出卡片（2.1.0）。
  const short = String(windowValue.shortLabel || '').trim();
  const nameHtml = short && short !== name
    ? `<span class="name-full">${escapeHtml(name)}</span><span class="name-short">${escapeHtml(short)}</span>`
    : escapeHtml(name);
  return `<span class="quota-scoped-stat${critical ? ' critical' : ''}" role="img" aria-label="${escapeHtml(label)}"><span class="quota-scoped-name">${icon}${nameHtml}</span><b>${remaining}%</b></span>`;
}

// 进度条下面那一道：和上面的一周共用一个圆角外框；匀速刻度只画在上面那道。
function quotaScopedLaneHtml(windowValue) {
  const { remaining, critical, serious } = scopedWindowState(windowValue);
  return `<span class="quota-scoped-lane${critical ? ' critical' : ''}${serious ? ' pace-serious' : ''}" style="--scoped:${remaining}%"><span class="quota-scoped-fill"></span></span>`;
}

function unlimitedTemplate(label, activityWindow = null) {
  return `
    <article class="quota-card quota-card-five quota-card-unlimited" style="--quota:100%">
      <div class="quota-top">${escapeHtml(T('remaining', { label }))}</div>
      <strong class="quota-value">${escapeHtml(T('unlimitedBadge'))}</strong>
      <div class="quota-progress" aria-hidden="true"><i></i></div>
      <small>${escapeHtml(T('unlimitedFooter'))}</small>
      ${quotaActivityTemplate('fiveHour', activityWindow)}
    </article>
  `;
}

function quotaSlimRowTemplate(windowValue, label, prefix = '') {
  const remaining = remainingPercentOf(windowValue);
  const critical = !windowValue.inactive && remaining <= 10;
  const pace = windowPace(windowValue, extraPaceKey(windowValue));
  const serious = !critical && pace?.tier === 'serious';
  // 行内没有空位放「偏快 N」：只在名称前放一个 ▲，颜色只落在图标上。
  const icon = !critical && ['warning', 'serious'].includes(pace?.tier)
    ? `<i class="pace-icon tier-${pace.tier}" role="img" aria-label="${escapeHtml(T('paceAheadShort'))}">▲</i>`
    : '';
  const prefixHtml = prefix ? `<span class="quota-slim-prefix">${escapeHtml(prefix)} · </span>` : '';
  return `
    <div class="quota-slim-row${critical ? ' critical' : ''}${serious ? ' pace-serious' : ''}" style="--quota:${remaining}%">
      <span class="quota-slim-name">${icon}${prefixHtml}${escapeHtml(T('remaining', { label }))}</span>
      <small>${escapeHtml(quotaFooter(windowValue))}</small>
      <strong>${remaining}%</strong>
      <span class="quota-slim-bar" aria-hidden="true"><i></i>${paceTickHtml(pace)}</span>
    </div>
  `;
}

// ---- 节奏 ----
// 进度条显示的是「剩余」，匀速刻度放在「按匀速此刻应剩」的位置：填充短于刻度就是用得比匀速快。
// 只给 GPT / Claude 算：附加平台的窗口长度不固定，算出来没有意义。
function extraPaceKey(windowValue) {
  return `extra:${String(windowValue?.name || '').trim() || 'limit'}`;
}

function windowPace(windowValue, key) {
  if (!PACE || !windowValue || windowValue.inactive || !MAIN_PROVIDERS.includes(provider)) return null;
  return PACE.computePace(windowValue, { durationMs: PACE.windowDurationMs(key, provider) });
}

function paceTickHtml(pace) {
  if (!pace?.ready || pace.elapsedPercent === null) return '';
  const left = clamp(100 - pace.elapsedPercent, 0, 100);
  return `<span class="pace-tick" style="--pace-left:${left.toFixed(1)}%"></span>`;
}

function paceFlagHtml(pace) {
  if (!pace?.ready || !['warning', 'serious'].includes(pace.tier)) return '';
  const delta = Math.round(Math.abs(pace.delta));
  return `<em class="pace-flag tier-${pace.tier}" aria-label="${escapeHtml(T('paceAheadShort'))}"><i aria-hidden="true">▲</i><span>${escapeHtml(T('paceAheadBadge', { delta }))}</span></em>`;
}

function paceWindowName(entry) {
  if (entry.key === 'five') return T('windowName5h');
  if (entry.key === 'week') return T('windowNameWeek');
  return T('windowNameScoped', { name: entry.name || '' });
}

// 和桌面面板 paceLine 同一套判断，文案按手机宽度缩短。
function paceLineFor(entry) {
  const pace = entry?.pace;
  if (!pace) return null;
  const window = paceWindowName(entry);
  const delta = Math.round(Math.abs(pace.delta || 0));
  switch (pace.status) {
    case 'exhausted':
      return { text: T('paceExhausted', { window, time: formatMoment(pace.resetAt) }), tier: 'critical' };
    case 'reset':
      return { text: T('paceResetPending', { window }), tier: 'neutral' };
    case 'early':
      return { text: T('paceEarly', { window }), tier: 'neutral' };
    case 'unknown':
    case 'idle':
      return { text: T('paceUnknown', { window }), tier: 'neutral' };
    default:
      break;
  }
  if (!pace.lastsUntilReset && pace.runOutAt) {
    return { text: T('paceRunOut', { window, delta, time: formatMoment(pace.runOutAt) }), tier: pace.tier };
  }
  if (pace.status === 'behind') return { text: T('paceBehind', { window, delta }), tier: 'good' };
  return { text: T('paceSteady', { window }), tier: 'good' };
}

// 今天之内只写时刻，跨天带上日期（周限额的用完时间常在几天后）。
function formatMoment(value) {
  const date = new Date(Number(value) || value);
  if (Number.isNaN(date.getTime())) return '--';
  const today = new Date();
  return date.toDateString() === today.toDateString() ? formatClock(date.getTime()) : formatDateTime(date.getTime());
}

// ---- 官方状态 ----
const SERVICE_LEVELS = ['maintenance', 'minor', 'major', 'critical'];

function renderServiceBanner(status, name) {
  const banner = els.serviceBanner;
  const level = SERVICE_LEVELS.includes(status?.level) ? status.level : null;
  document.body.classList.toggle('service-alert', Boolean(level));
  if (!level) {
    banner.hidden = true;
    return;
  }
  const affected = (status.components || []).filter((item) => item.level && item.level !== 'none').map((item) => item.name);
  const detail = status.incidents?.[0]?.name || affected.join(' / ');
  banner.className = `service-banner level-${level}`;
  if (status.home && /^https:\/\//.test(status.home)) banner.href = status.home;
  else banner.removeAttribute('href');
  updateHtml(banner, `<i class="service-dot" aria-hidden="true"></i><b>${escapeHtml(T('serviceStatusLine', { name, level: T(`serviceLevel_${level}`) }))}</b>${detail ? `<span>${escapeHtml(detail)}</span>` : ''}`);
  banner.hidden = false;
}

// ---- 近 24 小时曲线 + 节奏说明 ----
// 曲线画「已用 %」（和桌面面板的额度曲线一致），虚线是当前最紧那个窗口的匀速线。
// 按住或滑过曲线，第一行换成那个时刻的读数；松手 1.5 秒后恢复节奏说明。
const MINI_TREND_SPAN_MS = 24 * 3600_000;
const MINI_TREND_GAP_MS = 45 * 60_000;
const MINI_TREND_W = 300;
const MINI_TREND_H = 52;
const MINI_TREND_PAD = 3;
let miniTrendModel = null;
let miniTrendRestoreTimer = null;

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function miniTrendX(t, start) {
  return clamp((t - start) / MINI_TREND_SPAN_MS, 0, 1) * MINI_TREND_W;
}

function miniTrendY(value) {
  const usable = MINI_TREND_H - MINI_TREND_PAD * 2;
  return MINI_TREND_PAD + (1 - clamp(value, 0, 100) / 100) * usable;
}

function miniTrendSeries(usage, points) {
  const series = [];
  if (!usage.fiveHourUnlimited && usage.primaryWindow) series.push({ key: 'five', cls: 'five', label: cardLabel(T('label5h'), usage.primaryWindow), read: (point) => point.five });
  if (usage.secondaryWindow) series.push({ key: 'week', cls: 'week', label: cardLabel(T('labelWeek'), usage.secondaryWindow), read: (point) => point.week });
  // 专项周限额只画一条：两条同色的线分不清，第二条以后只看卡片。
  const scoped = (usage.extraWindows || []).find((item) => item && !item.inactive && String(item.name || '').trim());
  if ((provider === 'claude' || provider === 'antigravity') && scoped) {
    const name = String(scoped.name).trim();
    series.push({ key: `extra:${name}`, cls: 'scoped', label: scopedWindowName(scoped), read: (point) => point.ex?.[name] });
  }
  return series.filter((item) => points.some((point) => finiteOrNull(item.read(point)) !== null));
}

function miniTrendPath(points, read, start, now) {
  let path = '';
  let previous = null;
  for (const point of points) {
    const t = Number(point.t);
    const value = finiteOrNull(read(point));
    if (!(t >= start && t <= now) || value === null) {
      previous = null;
      continue;
    }
    const command = previous === null || t - previous > MINI_TREND_GAP_MS ? 'M' : 'L';
    path += `${command}${miniTrendX(t, start).toFixed(1)} ${miniTrendY(value).toFixed(1)}`;
    previous = t;
  }
  return path;
}

function renderPaceCard(usage, history) {
  const card = els.paceCard;
  const points = (Array.isArray(history?.day) ? history.day : []).filter((point) => Number.isFinite(Number(point?.t)));
  const now = Date.now();
  const start = now - MINI_TREND_SPAN_MS;
  const series = usage && MAIN_PROVIDERS.includes(provider) ? miniTrendSeries(usage, points) : [];
  const entries = usage && PACE ? PACE.listWindows(usage, { provider, now }) : [];
  const focus = PACE?.mostUrgent(entries) || null;
  const line = paceLineFor(focus);
  // 近 24 小时少于两个点时画不出曲线（刚升级或刚配对），整张卡先不显示。
  const plotted = series.some((item) => points.filter((point) => Number(point.t) >= start && finiteOrNull(item.read(point)) !== null).length >= 2);
  if (!series.length || !line || !plotted) {
    miniTrendModel = null;
    card.dataset.ready = '';
    updateHtml(card, '');
    return;
  }
  const grid = [0, 50, 100].map((value) => `<line class="mini-grid${value === 0 ? ' base' : ''}" x1="0" x2="${MINI_TREND_W}" y1="${miniTrendY(value).toFixed(1)}" y2="${miniTrendY(value).toFixed(1)}" vector-effect="non-scaling-stroke"/>`).join('');
  const focusSeries = series.find((item) => item.key === focus.key);
  let guide = '';
  const pace = focus.pace;
  if (focusSeries && pace?.ready && pace.startAt && pace.durationMs) {
    const from = Math.max(pace.startAt, start);
    const to = Math.min(now, pace.resetAt || now);
    if (to > from) {
      const at = (t) => miniTrendY(((t - pace.startAt) / pace.durationMs) * 100);
      guide = `<path class="mini-guide series-${focusSeries.cls}" d="M${miniTrendX(from, start).toFixed(1)} ${at(from).toFixed(1)}L${miniTrendX(to, start).toFixed(1)} ${at(to).toFixed(1)}" vector-effect="non-scaling-stroke"/>`;
    }
  }
  const paths = series.map((item) => `<path class="mini-series series-${item.cls}" d="${miniTrendPath(points, item.read, start, now)}" vector-effect="non-scaling-stroke"/>`).join('');
  // 末端圆点用 HTML 画：SVG 横向拉伸时圆会变形。
  const dots = series.map((item) => {
    const last = points.filter((point) => Number(point.t) >= start && finiteOrNull(item.read(point)) !== null).at(-1);
    if (!last) return '';
    const left = (miniTrendX(Number(last.t), start) / MINI_TREND_W) * 100;
    return `<span class="mini-dot series-${item.cls}" style="left:${left.toFixed(2)}%;top:${miniTrendY(finiteOrNull(item.read(last))).toFixed(1)}px"></span>`;
  }).join('');
  const legend = series.map((item) => `<span class="mini-key series-${item.cls}"><i></i>${escapeHtml(item.label)}</span>`).join('')
    + (guide ? `<span class="mini-key mini-key-guide"><i></i>${escapeHtml(T('trendPaceLegend'))}</span>` : '');
  const icon = ['warning', 'serious', 'critical'].includes(line.tier)
    ? `<i class="pace-icon tier-${line.tier}" aria-hidden="true">▲</i>`
    : '';
  miniTrendModel = { points, series, start, defaultHtml: `${icon}<span>${escapeHtml(line.text)}</span>` };
  card.dataset.ready = '1';
  updateHtml(card, `
    <div class="pace-line" aria-live="polite">${miniTrendModel.defaultHtml}</div>
    <div class="mini-trend" role="img" aria-label="${escapeHtml(T('trendLabel'))}">
      <div class="mini-plot">
        <svg viewBox="0 0 ${MINI_TREND_W} ${MINI_TREND_H}" preserveAspectRatio="none" aria-hidden="true">${grid}${guide}${paths}</svg>
        ${dots}
        <span class="mini-cursor" hidden></span>
      </div>
      ${[100, 50, 0].map((value) => `<span class="mini-y" aria-hidden="true" style="top:${miniTrendY(value).toFixed(1)}px">${value}%</span>`).join('')}
    </div>
    <div class="mini-trend-foot">
      <span>${escapeHtml(T('trendAxisStart'))}</span>
      <span class="mini-legend">${legend}</span>
      <span>${escapeHtml(T('trendAxisNow'))}</span>
    </div>
  `);
}

function showMiniTrendReadout(event) {
  const chart = event.target.closest?.('.mini-trend');
  const plot = chart?.querySelector('.mini-plot');
  if (!plot || !miniTrendModel) return;
  clearTimeout(miniTrendRestoreTimer);
  const rect = plot.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
  const { points, series, start } = miniTrendModel;
  const t = start + ratio * MINI_TREND_SPAN_MS;
  let nearest = null;
  for (const point of points) {
    const distance = Math.abs(Number(point.t) - t);
    if (Number(point.t) >= start && (!nearest || distance < nearest.distance)) nearest = { point, distance };
  }
  const line = els.paceCard.querySelector('.pace-line');
  const cursor = chart.querySelector('.mini-cursor');
  if (!nearest || nearest.distance > MINI_TREND_GAP_MS || !line || !cursor) return;
  const values = series
    .map((item) => {
      const value = finiteOrNull(item.read(nearest.point));
      return value === null ? '' : T('trendUsed', { label: item.label, value: Math.round(value) });
    })
    .filter(Boolean);
  line.innerHTML = `<span>${escapeHtml(T('trendReadout', { time: formatClock(Number(nearest.point.t)), values: values.join(' · ') }))}</span>`;
  cursor.style.left = `${((miniTrendX(Number(nearest.point.t), start) / MINI_TREND_W) * 100).toFixed(2)}%`;
  cursor.hidden = false;
}

function hideMiniTrendReadout(event) {
  if (!event.target.closest?.('.mini-trend') || !miniTrendModel) return;
  clearTimeout(miniTrendRestoreTimer);
  const restore = () => {
    const line = els.paceCard.querySelector('.pace-line');
    const cursor = els.paceCard.querySelector('.mini-cursor');
    if (line && miniTrendModel) line.innerHTML = miniTrendModel.defaultHtml;
    if (cursor) cursor.hidden = true;
  };
  if (event.pointerType === 'mouse') restore();
  else miniTrendRestoreTimer = window.setTimeout(restore, 1500);
}

// 先放出来量一次：整页超出一屏就收起（小屏、展开明细、有故障横幅时）。
function fitPaceCard() {
  const card = els.paceCard;
  if (!card) return;
  if (activeView !== 'usage' || card.dataset.ready !== '1') {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  if (document.documentElement.scrollHeight > window.innerHeight + 1) card.hidden = true;
}

// 卡片右上角箭头点开的明细：具体的重置时刻，加上同一周期内的本机 Token 用量。
function quotaActivityTemplate(detailKey, activityWindow, windowValue = null, scopedWindow = null) {
  const rows = [];
  if (windowValue?.resetAt) {
    rows.push(`<div class="quota-activity-row"><span>${escapeHtml(T('resetTime'))}</span><b>${escapeHtml(formatDateTime(windowValue.resetAt))}</b></div>`);
  }
  // 并进「一周」卡的专项限额：手机上没有悬停提示，它的重置时间放在这里。
  if (scopedWindow?.resetAt) {
    rows.push(`<div class="quota-activity-row"><span>${escapeHtml(T('scopedResetTime', { name: scopedWindowName(scopedWindow) }))}</span><b>${escapeHtml(formatDateTime(scopedWindow.resetAt))}</b></div>`);
  }
  if (activityWindow) {
    const tone = cacheHitTone(activityWindow.cachedInputTokens, activityWindow.inputTokens);
    const titleKey = detailKey === 'fiveHour' ? 'windowUsage5h' : 'windowUsageWeek';
    rows.push(`<div class="quota-activity-row"><span>${escapeHtml(T(titleKey))}</span><b>${escapeHtml(T('totalShort', { value: formatTokens(activityWindow.tokens, false) }))}</b></div>`);
    rows.push(`<div class="quota-activity-row">
      <span>${escapeHtml(T('io', { value: formatTokens(activityWindow.ioTokens, false) }))}</span>
      <em class="cache-hit-rate ${tone}">${escapeHtml(T('cacheHitShort', {
        value: formatCacheHitRate(activityWindow.cachedInputTokens, activityWindow.inputTokens)
      }))}</em>
    </div>`);
  }
  if (!detailKey || !rows.length) return '';
  return `
    <details class="quota-activity inline-details" data-detail="quota-activity">
      <summary aria-label="${escapeHtml(T('quotaDetails'))}"><span>${escapeHtml(T('quotaDetails'))}</span></summary>
      <div class="disclosure-content">${rows.join('')}</div>
    </details>
  `;
}

// 5 小时卡和一周卡的明细共用标题行右侧这一个按钮（1.1.1，和桌面一致）：一起展开、一起收起，
// 免得只展开一张、并排的另一张空出一截。两张卡的明细用同一个 data-detail，展开状态也一起记。
function quotaDetailsList() {
  return [...els.quotaGrid.querySelectorAll('details.quota-activity')];
}

function syncQuotaDetailsToggle() {
  const button = els.quotaDetailsToggle;
  if (!button || !els.quotaGrid) return;
  const details = quotaDetailsList();
  const open = details.some((detail) => detail.open);
  button.hidden = !details.length;
  button.setAttribute('aria-expanded', String(open));
  const label = T('quotaDetails');
  if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
}

els.quotaDetailsToggle?.addEventListener('click', () => {
  const details = quotaDetailsList();
  if (!details.length) return;
  const open = !details.some((detail) => detail.open);
  disclosureState.set(`${provider}:quota-activity`, open);
  details.forEach((detail) => { detail.open = open; });
  syncQuotaDetailsToggle();
});

// 大数字和单位分开排：数字用圆体，单位用小一号的次要色。
function tokenValueHtml(value) {
  const unit = lang === 'en-US' ? 'tokens' : 'token';
  return `${escapeHtml(formatTokens(value, false))}<small> ${unit}</small>`;
}

function renderActivity(activitySlice) {
  const activity = activitySlice?.data;
  els.tokenUpdated.textContent = formatUpdated(activitySlice?.fetchedAt);
  if (!activity) {
    els.tokenRange.hidden = true;
    currentTokenView = null;
    currentWeekSeries = null;
    currentTokenActivity = null;
    updateHtml(els.tokenCard, empty(activitySlice?.error));
    return;
  }
  renderTokenRangeToggle();
  // 合计、对比和分组都由共用模块按同一张「按天的表」算：近 30 天来自日志，更早的来自电脑上落盘的日汇总（2.0.0）。
  const view = CARDS.buildView(tokenRange, activity);
  const range = view.range;
  const chartView = range !== 'month';
  const dayView = range === 'week' || range === 'month';
  const days = normalizeDays(activity.days || []);
  // 7 天 / 30 天选的是某一天；1 年选的是某个月；周报就是上周一到周日。
  const rangeDays = range === 'week' ? days.slice(-TOKEN_WEEK.WEEK_DAYS) : days;
  const today = days.at(-1) || emptyDay(new Date());
  const selectedDay = dayView ? rangeDays.find((day) => day.day === selectedDayByProvider[provider]) || today : null;
  const selectedBucket = dayView ? null : CARDS.selectedBucket(view, selectedBucketByProvider[provider]?.[range]);
  const totals = view.totals;
  const max = Math.max(1, ...days.map((day) => day.tokens));
  currentTokenView = view;
  currentTokenActivity = activity;
  currentWeekSeries = chartView ? CARDS.seriesFor(view) : null;
  // 30 天格子在其余视图里照样排出来、只是藏起来，柱状图叠在同一格里按它的高度排：切换时卡片尺寸不动。
  const totalLabel = T(range === 'week' ? 'totalWeek' : 'total');
  const detailBody = dayView
    ? `
        <dl class="detail-metrics">
          ${detailMetric(T('today'), T('io', { value: formatTokens(today.ioTokens, false) }))}
          ${detailMetric(totalLabel, T('io', { value: formatTokens(totals.ioTokens, false) }))}
          ${detailMetric(T('today'), T('cacheHit', { value: formatCacheHitRate(today.cachedInputTokens, today.inputTokens) }))}
          ${detailMetric(totalLabel, T('cacheHit', { value: formatCacheHitRate(totals.cachedInputTokens, totals.inputTokens) }))}
        </dl>
        <div class="selected-day-detail" id="tokenDetail">${tokenDetailHtml(selectedDay)}</div>`
    : CARDS.bucketDetailHtml(view, selectedBucket, { lang, series: currentWeekSeries });
  const summaryText = dayView
    ? `${formatDay(selectedDay.day)} · ${formatTokens(selectedDay.tokens)}`
    : CARDS.summaryText(selectedBucket, lang, view);

  updateHtml(els.tokenCard, `
    <div class="token-summary">
      <div>
        <span>${escapeHtml(T('todayUsed'))}</span>
        <strong>${tokenValueHtml(today.tokens)}</strong>
      </div>
      <div>
        <span class="token-stat-label"><span>${escapeHtml(CARDS.statLabel(view, lang))}</span>${CARDS.changeHtml(view, lang)}</span>
        <strong>${tokenValueHtml(totals.tokens)}</strong>
      </div>
    </div>
    <div class="token-stage${chartView ? ' is-week' : ''}${tokenRangeEnter ? ' range-enter' : ''}">
    <div class="heatmap"${chartView ? ' inert aria-hidden="true"' : ''}>
      ${days.map((day) => `
        <button
          class="heat-cell${day.day === (selectedDay || today).day ? ' active' : ''}"
          type="button"
          data-day="${escapeHtml(day.day)}"
          data-level="${heatLevel(day.tokens, max)}"
          aria-label="${escapeHtml(day.day)}"
        >${escapeHtml(day.day.slice(-2).replace(/^0/, ''))}</button>
      `).join('')}
    </div>
    ${chartView ? CARDS.chartHtml(view, {
      lang,
      skin: 'mobile',
      selectedKey: range === 'week' ? selectedDay.day : selectedBucket?.key,
      series: currentWeekSeries
    }) : ''}
    </div>
    <details class="inline-details token-more" data-detail="token-metrics">
      <summary><span id="selectedDayLabel">${escapeHtml(summaryText)}</span></summary>
      <div class="disclosure-content">${detailBody}
      </div>
    </details>
  `);
}

function readTokenRange() {
  try {
    return CARDS.normalizeRange(localStorage.getItem(TOKEN_RANGE_KEY));
  } catch {
    return 'month';
  }
}

function renderTokenRangeToggle() {
  els.tokenRange.hidden = false;
  els.tokenRange.setAttribute('aria-label', T('tokenRangeAria'));
  // 选中底块是容器的伪元素，按 data-range 滑到对应按钮下面（1.1.1；2.0.0 起四段，按钮和桌面同一份）
  els.tokenRange.dataset.range = tokenRange;
  const markup = CARDS.toggleHtml(tokenRange, lang, 'token-range-button');
  if (els.tokenRange.innerHTML !== markup) els.tokenRange.innerHTML = markup;
}

// 所选那天的详情：会话数、成本、命中率，下面是按小时分布和 5 小时窗口（2.0.0，和桌面同一份）；
// 7 天视图再多列一份按模型的拆分（颜色和柱子一致，渲染在 cards.js，和桌面同一份）。
function tokenDetailHtml(day) {
  const bucket = tokenRange === 'week' && currentTokenView
    ? currentTokenView.buckets.find((item) => item.key === day.day)
    : null;
  const models = bucket ? CARDS.modelsHtml(bucket.totals, { lang, series: currentWeekSeries }) : '';
  const hours = CARDS.hoursHtml(day, {
    lang,
    windows: currentTokenActivity?.fiveHourWindows,
    fiveHourUnlimited: currentTokenActivity?.fiveHourUnlimited
  });
  return tokenDetailTemplate(day) + hours + models;
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
      costUsd: Number(source.costUsd || 0) || 0,
      models: Array.isArray(source.models) ? source.models : [],
      // 本地时间每小时的 token（2.0.0），单日明细画按小时分布
      hours: Array.isArray(source.hours) && source.hours.length === 24 ? source.hours : null
    });
  }
  return days;
}

function tokenDetailTemplate(day) {
  const detailMeta = `${T('sessions', { count: day.threads })} · ${T('cost', { value: formatUsd(day.costUsd) })}`;
  const cacheText = T('cacheHit', { value: formatCacheHitRate(day.cachedInputTokens, day.inputTokens) });
  // 日期和总量已经写在这一栏的标题行里，这里只补会话数、折算成本和命中率。
  return `
    <strong>${escapeHtml(formatDay(day.day))}</strong>
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
  // 没有任何雷达数据时，推荐模型卡和排序按钮都是空壳，收起来只留一句说明。
  els.radarView.classList.toggle('radar-no-data', !radar);
  if (activeRadarView === 'intelligence') {
    renderSection('iq', [radarSlice, radarSortByProvider[provider], radarExpandedByProvider[provider], radarLatestByProvider[provider]], () => renderIqCards(items, radarSlice));
    const timestamp = Date.parse(updatedAt);
    const notices = [];
    const fourMode = isCodexFourMode(radar?.modelIq);
    if (radar?.modelIq?.scoreMode === 'radar-bench-v2-150') {
      notices.push(T('radarBenchNotice'));
      if (radar.modelIq.partial) notices.push(T('radarPartialRead', { n: radar.modelIq.receivedCount, total: radar.modelIq.requestedCount }));
    } else if (fourMode) {
      notices.push(T('radarFourNotice', { date: formatRadarRoundDate(radar.modelIq.roundTestedAt) }));
      if (radar.modelIq.partial) notices.push(T('radarFourPartial', { n: radar.modelIq.receivedCount, total: radar.modelIq.requestedCount }));
    }
    if (radar && radarSlice?.error) notices.push(radarSlice.error);
    if (Number.isFinite(timestamp) && Date.now() - timestamp > 72 * 3600_000) {
      notices.push(T('radarSourceStale', { date: new Intl.DateTimeFormat(lang, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp) }));
    }
    if (radarLatestByProvider[provider] && !items.some((item) => item.isLatest && item.isCurrentGeneration && radarScore(item) !== null)) notices.push(T('radarLatestPending'));
    els.radarDataNotice.textContent = notices.join(' ');
    els.radarDataNotice.hidden = !notices.length;
    els.radarDataNotice.classList.toggle('info', (radar?.modelIq?.scoreMode === 'radar-bench-v2-150' || fourMode) && !radarSlice?.error);
    const stale = Number.isFinite(timestamp) && Date.now() - timestamp > 72 * 3600_000;
    const partial = radar?.modelIq?.partial;
    els.radarBriefStatus.hidden = !radarSlice?.error && !stale && !partial;
    els.radarBriefStatus.textContent = radarSlice?.error || stale ? T('radarAttention')
      : partial ? T(fourMode ? 'radarFourPartialShort' : 'radarPartialShort', { n: radar.modelIq.receivedCount, total: radar.modelIq.requestedCount }) : '';
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

// 四题众测分榜（scoreMode 形如 codex-four-weighted-150-v2），和桌面面板同一套判断。
function isCodexFourMode(modelIq) {
  return typeof modelIq?.scoreMode === 'string' && modelIq.scoreMode.startsWith('codex-four');
}

function formatRadarRoundDate(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat(lang, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp)
    : '--';
}

const RADAR_TASK_LABELS = {
  combined: 'iqTaskCombined',
  pompeii: 'iqTaskPompeii',
  pelican: 'iqTaskPelican',
  candy: 'iqTaskCandy'
};

function radarTaskScores(item) {
  return Array.isArray(item?.taskScores)
    ? item.taskScores.filter((task) => RADAR_TASK_LABELS[task?.key])
    : [];
}

function trimDecimal(value) {
  return String(Number(Number(value).toFixed(1)));
}

function formatTaskPoints(task) {
  const points = Number(task?.points);
  const max = Number(task?.max);
  if (task?.points === null || task?.points === undefined || !Number.isFinite(points)) return T('metricPending');
  return Number.isFinite(max) && max > 0 ? `${trimDecimal(points)}/${trimDecimal(max)}` : trimDecimal(points);
}

function radarItemsForProvider(radar) {
  if (!radar) return [];
  return provider === 'claude' ? radar.items || [] : radar.modelIq?.items || [];
}

const RADAR_PAUSED_CODE = 'radar-source-unavailable';

function renderIqCards(allItems, radarSlice = null) {
  const error = radarSlice?.error || null;
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
    const paused = !radarSlice?.data && radarSlice?.errorCode === RADAR_PAUSED_CODE;
    updateHtml(els.iqList, paused
      ? `<div class="empty radar-paused"><strong>${escapeHtml(T('radarPaused'))}</strong><p>${escapeHtml(T('radarPausedHint'))}</p></div>`
      : empty(error || T('noIqData')));
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

// 按原站显示精度（两位小数）比较 IQ：四题分榜常有多档并列满分，浮点误差不该拆开它们。
function radarScoreKey(item) {
  const score = radarScore(item);
  return score === null ? null : Math.round(score * 100) / 100;
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
    const iqOrder = compareRadarNumbers(radarScoreKey(left), radarScoreKey(right));
    if (iqOrder !== 0) return iqOrder;
    // 同分时便宜的在前，推荐模型也就落在同分里最省钱的那一档。
    const costOrder = compareRadarNumbers(radarAverageCost(left), radarAverageCost(right), true);
    if (costOrder !== 0) return costOrder;
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
  const tasks = radarTaskScores(item);
  const metrics = [
    [T('iqMetricCost'), formatAverageCost(item), item.costBasis === 'official_standard_api_equivalent' ? T('radarCostEvidence', { n: item.costKnownSamples ?? '-', total: item.costTotalSamples ?? '-' }) : ''],
    [T('iqMetricTime'), formatAverageTime(item)],
    ...(tasks.length
      ? tasks.map((task) => [T(RADAR_TASK_LABELS[task.key]), formatTaskPoints(task)])
      : [
          [T(item.sampleBasis === 'graded' ? 'iqMetricGraded' : 'iqMetricSamples'), formatSampleCount(item)],
          [T('metricCoverage'), formatPassedRatio(item)]
        ])
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
  // 没有任何档位带历史分数时只会一直显示「样本积累中」，整行收起。
  els.iqDegradeAlert.hidden = signal.level === 'neutral';
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

// 型号写法和桌面一致（token-week.js）：claude-opus-5-5 → Opus 5.5，gpt-6.2-astra → GPT-6.2 Astra。
function formatModelName(value) {
  return TOKEN_WEEK.formatModelName(value) || 'Model';
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
  const credits = usageSlice?.data?.resetCredits;
  if (providerId === 'claude') {
    // 重置卡来自官方用量接口；雷达数据源不可用时这一页只剩它。
    if (credits?.credits?.length) {
      els.resetSource.textContent = T('sourceClaudeOfficial');
      els.resetCards.innerHTML = resetCreditsTimeline(credits, T('resetCardFallback'));
      return;
    }
    if (!radar) {
      els.resetSource.textContent = credits ? T('sourceClaudeOfficial') : '--';
      els.resetCards.innerHTML = empty(!credits
        ? T('noRadarNotes')
        : credits.unavailableReason && credits.unavailableReason !== 'no_grant'
          ? T('resetWithheld')
          : T('creditsAvailable', { n: 0 }));
      return;
    }
    const quota = radar.quota || {};
    const calibratedAt = formatRadarTime(quota.updatedAt || radar.updatedAt);
    els.resetSource.textContent = calibratedAt || '--';
    els.resetCards.innerHTML = `<div class="reset-timeline">
      <div class="reset-timeline-summary"><span>${escapeHtml(T('resetTimelineTitle'))}</span><strong>${escapeHtml(calibratedAt || '--')}</strong></div>
      ${resetTimelineItem(T('calibTitle'), T('calibStatus'), quota.chartLabel || quota.note || T('calibNone'), 'available')}
      ${resetTimelineItem(T('srcTitle'), T('sourceStatus'), T('attributionClaude'), 'neutral')}
    </div>`;
    return;
  }

  els.resetSource.textContent = T('sourceCodex');
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
  els.resetCards.innerHTML = resetCreditsTimeline(credits, 'Codex reset');
}

function resetCreditsTimeline(credits, fallbackTitle) {
  return `<div class="reset-timeline">
    <div class="reset-timeline-summary"><span>${escapeHtml(T('resetTimelineTitle'))}</span><strong>${escapeHtml(T('creditsAvailable', { n: credits.availableCount ?? credits.credits.length }))}</strong></div>
    ${credits.credits.map((credit) => resetTimelineItem(
      credit.title || resetKindTitle(credit.kind) || fallbackTitle,
      resetStatusLabel(credit.status),
      resetCreditDetail(credit),
      resetStatusClass(credit.status)
    )).join('')}
  </div>`;
}

function resetKindTitle(kind) {
  const key = { session: 'resetKindSession', weekly: 'resetKindWeekly', full: 'resetKindFull' }[kind];
  return key ? T(key) : '';
}

function resetCreditDetail(credit) {
  const expiry = credit.expiresAt ? T('expiresAt', { t: formatDateTime(credit.expiresAt) }) : T('noExpiry');
  // 一张卡可以带多次重置（Claude 侧），只有一次时不必写出来。
  return Number(credit.resetsTotal) > 1
    ? `${T('resetsLeft', { left: credit.resetsLeft ?? 0, total: credit.resetsTotal })} · ${expiry}`
    : expiry;
}

function resetTimelineItem(title, status, detail, tone = 'neutral') {
  return `<article class="reset-item ${escapeHtml(tone)}"><span class="reset-marker" aria-hidden="true"></span><div class="reset-item-body"><div class="reset-item-head"><strong>${escapeHtml(title)}</strong><span class="reset-status ${escapeHtml(tone)}">${escapeHtml(status)}</span></div><p>${escapeHtml(detail)}</p></div></article>`;
}

function resetStatusClass(status) {
  return ['available', 'redeemed', 'expired'].includes(status) ? status : 'neutral';
}

function resetStatusLabel(status) {
  const key = {
    available: 'statusAvailable',
    redeemed: 'statusRedeemed',
    expired: 'statusExpired',
    pending: 'statusPending',
    paused: 'statusPaused'
  }[status] || 'statusUnknown';
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
  // render() 跑在切换 active 之前，那时量到的是另一个视图的高度：切完再量一次曲线卡。
  fitPaceCard();
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

// 和桌面面板的 formatTokenCount（src/i18n.js）同一套写法，两边看到的数字才一样。
function formatTokens(value, withUnit = true) {
  const number = Number(value) || 0;
  if (lang === 'en-US') {
    const unit = withUnit ? ' tokens' : '';
    if (number >= 1e9) return `${(number / 1e9).toFixed(2)}B${unit}`;
    if (number >= 1e6) return `${(number / 1e6).toFixed(2)}M${unit}`;
    if (number >= 1e4) return `${(number / 1e3).toFixed(1)}K${unit}`;
    return `${new Intl.NumberFormat('en-US').format(Math.round(number))}${unit}`;
  }
  const unit = withUnit ? ' token' : '';
  const hundredMillion = lang === 'ja-JP' ? '億' : '亿';
  if (number >= 1e8) return `${(number / 1e8).toFixed(2)} ${hundredMillion}${unit}`;
  if (number >= 1e4) return `${(number / 1e4).toFixed(2)} 万${unit}`;
  return `${new Intl.NumberFormat('en-US').format(Math.round(number))}${unit}`;
}

// 相对重置时间，四舍五入到分钟，和桌面面板、Touch Bar 的写法一致。
function formatReset(value) {
  const diffMs = Number(value) - Date.now();
  // 过了 resetAt 而数据还没换成新窗口：写「已重置」，不再一直停在「即将重置」（和桌面面板一致）。
  if (diffMs <= 0) return T('resetPassed');
  const totalMinutes = Math.max(0, Math.round(diffMs / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? T('resetInDH', { d: days, h: hours }) : T('resetInD', { d: days });
  if (hours > 0 && minutes > 0) return T('resetInHM', { h: hours, m: minutes });
  if (hours > 0) return T('resetInH', { h: hours });
  if (minutes > 0) return T('resetInM', { m: minutes });
  return T('resetSoon');
}

// 金额写法和桌面、cards.js 一致（$128、$12.3、$0.45）；以前中文界面会写成「US$128.4」。
function formatUsd(value) {
  if (value === null || value === undefined || value === '') return '--';
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return CARDS.formatUsd(number);
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
  // Antigravity 的常态命中率还不知道，先不上色，和桌面一致（2.1.0）。
  if (provider === 'antigravity') return 'cache-hit-neutral';
  // 按显示出来的那个数字（保留 1 位小数）判色，否则 96.97% 会显示成 97% 却是黄色。
  // 分界 97 / 93（2.0.0 起，原来是 99 / 95），和桌面面板一致。
  const shown = Math.round(rate * 10) / 10;
  if (shown >= 97) return 'cache-hit-good';
  if (shown >= 93) return 'cache-hit-warning';
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

els.tokenRange.addEventListener('click', (event) => {
  const button = event.target.closest('[data-token-range]');
  if (!button) return;
  const next = CARDS.normalizeRange(button.dataset.tokenRange);
  if (next === tokenRange) return;
  tokenRange = next;
  try {
    localStorage.setItem(TOKEN_RANGE_KEY, tokenRange);
  } catch {
    // 无痕模式等存不了：这次照样切换，下次打开回到 30 天。
  }
  tokenRangeEnter = true;
  if (currentState) render();
  tokenRangeEnter = false;
});

els.tokenCard.addEventListener('click', (event) => {
  const cell = event.target.closest('.heat-cell, .week-col');
  if (!cell || !currentState) return;
  // 1 年视图的一列是一个月：记下选中哪个月，整块重画（明细换成那个月的）。
  if (cell.dataset.bucket) {
    const keys = selectedBucketByProvider[provider] || (selectedBucketByProvider[provider] = {});
    if (keys[tokenRange] === cell.dataset.bucket) return;
    keys[tokenRange] = cell.dataset.bucket;
    render();
    return;
  }
  const activity = currentState.providers?.[provider]?.activity?.data;
  const day = normalizeDays(activity?.days || []).find((item) => item.day === cell.dataset.day);
  if (!day) return;
  selectedDayByProvider[provider] = day.day;
  const selectedLabel = document.getElementById('selectedDayLabel');
  if (selectedLabel) selectedLabel.textContent = `${formatDay(day.day)} · ${formatTokens(day.tokens)}`;
  els.tokenCard.querySelectorAll('.heat-cell, .week-col').forEach((node) => {
    node.classList.toggle('active', node === cell);
    if (node.classList.contains('week-col')) node.setAttribute('aria-pressed', String(node === cell));
  });
  const detail = document.getElementById('tokenDetail');
  if (detail) {
    detail.innerHTML = tokenDetailHtml(day);
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
els.paceCard.addEventListener('pointerdown', showMiniTrendReadout);
els.paceCard.addEventListener('pointermove', showMiniTrendReadout);
els.paceCard.addEventListener('pointerup', hideMiniTrendReadout);
els.paceCard.addEventListener('pointercancel', hideMiniTrendReadout);
els.paceCard.addEventListener('pointerleave', hideMiniTrendReadout, true);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (currentState) render();
  if (connectionMode === 'cloud' && syncCredentials) {
    refreshCloudState().catch(() => setConnection(false));
  }
});

// 「多久后重置」要跟着时间走：数据没更新时也每半分钟检查一次，分钟数变了才会真的重画。
window.setInterval(() => {
  if (!currentState || document.visibilityState !== 'visible') return;
  render();
  if (connectionMode === 'cloud') setConnection(connectionAlive);
}, 30_000);

// 曲线卡只在一屏放得下时出现：转屏、展开明细都要重新量一次。
window.addEventListener('resize', () => fitPaceCard());
document.addEventListener('toggle', () => fitPaceCard(), true);

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
    await ensureSession();
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
