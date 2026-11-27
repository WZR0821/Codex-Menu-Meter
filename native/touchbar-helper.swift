import AppKit
import Darwin

@_silgen_name("DFRElementSetControlStripPresenceForIdentifier")
func DFRElementSetControlStripPresenceForIdentifier(_ identifier: NSString, _ visible: Bool)

@_silgen_name("DFRSystemModalShowsCloseBoxWhenFrontMost")
func DFRSystemModalShowsCloseBoxWhenFrontMost(_ show: Bool)

let trayIdentifier = NSTouchBarItem.Identifier("local.codex-menu-meter.touchbar.tray")

func presentSystemModal(_ bar: NSTouchBar, trayId: NSTouchBarItem.Identifier) {
    let placementSel = NSSelectorFromString("presentSystemModalTouchBar:placement:systemTrayItemIdentifier:")
    if let method = class_getClassMethod(NSTouchBar.self, placementSel) {
        typealias Fn = @convention(c) (AnyObject, Selector, AnyObject?, Int64, AnyObject?) -> Void
        let fn = unsafeBitCast(method_getImplementation(method), to: Fn.self)
        fn(NSTouchBar.self, placementSel, bar, 0, trayId.rawValue as AnyObject)
        return
    }

    let cls: AnyObject = NSTouchBar.self as AnyObject
    let newSel = NSSelectorFromString("presentSystemModalTouchBar:systemTrayItemIdentifier:")
    let oldSel = NSSelectorFromString("presentSystemModalFunctionBar:systemTrayItemIdentifier:")
    if cls.responds(to: newSel) {
        _ = cls.perform(newSel, with: bar, with: trayId.rawValue)
    } else if cls.responds(to: oldSel) {
        _ = cls.perform(oldSel, with: bar, with: trayId.rawValue)
    }
}

func addSystemTrayItem(_ item: NSTouchBarItem) {
    let cls: AnyObject = NSTouchBarItem.self as AnyObject
    let sel = NSSelectorFromString("addSystemTrayItem:")
    if cls.responds(to: sel) {
        _ = cls.perform(sel, with: item)
    }
}

struct TouchPayload: Decodable {
    var preferredProvider: String?
    var providerOrder: [String]?
    var providers: [String: TouchProvider]?
    var usage: TouchUsage?
    var iq: [TouchIq]?
}

struct TouchProvider: Decodable {
    var label: String?
    var usage: TouchUsage?
    var iq: [TouchIq]?
}

struct TouchUsage: Decodable {
    var five: TouchQuota?
    var week: TouchQuota?
    // 按模型划分的专项限额（例如 Claude 的 Fable 周限额）。
    var extra: [TouchQuota]?
}

struct TouchQuota: Decodable {
    var label: String
    var remainingPercent: Double?
    var resetAt: Double?
    var unlimited: Bool?
    // 节奏（来自主进程的 usage-pace.js）：tier 决定颜色；windowMs 用来画匀速刻度。
    var tier: String?
    var status: String?
    var windowMs: Double?
}

struct TouchIq: Decodable {
    var label: String
    var compactLabel: String?
    var score: Double?
    var status: String?
}

final class DashboardView: NSView {
    // 整条 30pt 高，每一块都是系统 Touch Bar 按钮那样的灰色圆角块，块与块之间留 6pt。
    static let viewWidth: CGFloat = 604
    static let barHeight: CGFloat = 30
    static let gap: CGFloat = 6
    static let switchWidth: CGFloat = 44
    static let switchStartX: CGFloat = viewWidth - switchWidth
    static let contentWidth: CGFloat = switchStartX - gap
    static let quotaWidth: CGFloat = 150
    static let iqStartX: CGFloat = (quotaWidth + gap) * 2
    static let cornerRadius: CGFloat = 6
    private static let pillColor = NSColor(calibratedWhite: 0.16, alpha: 1)
    private static let trackColor = NSColor(calibratedWhite: 0.30, alpha: 1)
    private static let secondaryText = NSColor(calibratedWhite: 0.66, alpha: 1)
    private static let tertiaryText = NSColor(calibratedWhite: 0.50, alpha: 1)

    private let statePath: String
    private var payload: TouchPayload?
    private var activeProvider = "codex"
    private var iqPages: [String: Int] = [:]
    private var lastStateData: Data?
    private var lastCountdownTick = 0
    private var providerButton: NSButton!
    private var iqButton: NSButton!
    private var quotaButton: NSButton!
    private let iqPageSize = 3

    init(statePath: String) {
        self.statePath = statePath
        super.init(frame: NSRect(x: 0, y: 0, width: DashboardView.viewWidth, height: DashboardView.barHeight))
        // 额度块可点：打开面板并刷新。没有 IQ 数据时额度块铺满整条，按钮也跟着铺满（见 layoutButtons）。
        quotaButton = NSButton(frame: NSRect(x: 0, y: 0, width: DashboardView.iqStartX - DashboardView.gap, height: DashboardView.barHeight))
        quotaButton.title = ""
        quotaButton.isBordered = false
        quotaButton.focusRingType = .none
        quotaButton.setAccessibilityLabel("Open usage panel")
        quotaButton.target = self
        quotaButton.action = #selector(handleQuotaButton)
        addSubview(quotaButton)

        iqButton = NSButton(frame: NSRect(
            x: DashboardView.iqStartX,
            y: 0,
            width: DashboardView.contentWidth - DashboardView.iqStartX,
            height: DashboardView.barHeight
        ))
        iqButton.title = ""
        iqButton.isBordered = false
        iqButton.focusRingType = .none
        iqButton.setAccessibilityLabel("Next IQ page")
        iqButton.target = self
        iqButton.action = #selector(handleIqButton)
        addSubview(iqButton)

        providerButton = NSButton(frame: NSRect(
            x: DashboardView.switchStartX,
            y: 0,
            width: DashboardView.switchWidth,
            height: DashboardView.barHeight
        ))
        providerButton.title = ""
        providerButton.isBordered = false
        providerButton.focusRingType = .none
        providerButton.setAccessibilityLabel("Switch usage provider")
        providerButton.target = self
        providerButton.action = #selector(handleProviderButton)
        addSubview(providerButton)
        readState()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var isFlipped: Bool { true }
    override var intrinsicContentSize: NSSize { NSSize(width: DashboardView.viewWidth, height: DashboardView.barHeight) }

    func readState() {
        refreshCountdownIfNeeded()
        guard let data = FileManager.default.contents(atPath: statePath), data != lastStateData,
              let decoded = try? JSONDecoder().decode(TouchPayload.self, from: data) else {
            return
        }
        lastStateData = data
        payload = decoded
        let providers = availableProviderIds()
        if let preferred = decoded.preferredProvider?.lowercased(), providers.contains(preferred) {
            activeProvider = preferred
        } else if !providers.contains(activeProvider) {
            activeProvider = providers.first ?? "codex"
        }
        providerButton.isEnabled = providers.count > 1
        normalizeIqPage()
        layoutButtons()
        needsDisplay = true
    }

    private func layoutButtons() {
        let hasIq = !(currentProviderPayload()?.iq ?? []).isEmpty
        iqButton.isHidden = !hasIq
        quotaButton.frame = NSRect(
            x: 0,
            y: 0,
            width: hasIq ? DashboardView.iqStartX - DashboardView.gap : DashboardView.contentWidth,
            height: DashboardView.barHeight
        )
    }

    // 重置倒计时按分钟显示：数据没变时也要每半分钟重画一次。
    private func refreshCountdownIfNeeded() {
        let tick = Int(Date().timeIntervalSince1970 / 30)
        if tick != lastCountdownTick {
            lastCountdownTick = tick
            needsDisplay = true
        }
    }

    // 只给离屏渲染（--render）用：指定平台和 IQ 页，不向主进程回报。
    func selectForSnapshot(provider: String?, iqPage: Int) {
        if let provider = provider?.lowercased(), availableProviderIds().contains(provider) {
            activeProvider = provider
        }
        iqPages[activeProvider] = max(0, iqPage)
        normalizeIqPage()
        layoutButtons()
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        let provider = currentProviderPayload()
        let iqItems = provider?.iq ?? []
        let usage = provider?.usage

        if iqItems.isEmpty {
            // 没有 IQ 数据的平台：额度块铺满整条，专项限额（如 Fable）也有自己的一块。
            var quotas: [TouchQuota?] = [usage?.five, usage?.week]
            for extra in (usage?.extra ?? []).prefix(2) { quotas.append(extra) }
            let count = CGFloat(quotas.count)
            let width = floor((DashboardView.contentWidth - DashboardView.gap * (count - 1)) / count)
            var x: CGFloat = 0
            for quota in quotas {
                drawQuota(quota, at: x, width: width)
                x += width + DashboardView.gap
            }
        } else {
            drawQuota(usage?.five, at: 0, width: DashboardView.quotaWidth)
            drawQuota(usage?.week, at: DashboardView.quotaWidth + DashboardView.gap, width: DashboardView.quotaWidth)
            drawIqItems(
                iqItems,
                startX: DashboardView.iqStartX,
                availableWidth: DashboardView.contentWidth - DashboardView.iqStartX
            )
        }
        drawProviderSwitch()
    }

    private func drawPill(_ frame: NSRect, color: NSColor = DashboardView.pillColor) {
        color.setFill()
        NSBezierPath(roundedRect: frame, xRadius: DashboardView.cornerRadius, yRadius: DashboardView.cornerRadius).fill()
    }

    private func drawQuota(_ quota: TouchQuota?, at x: CGFloat, width: CGFloat) {
        let label = quota?.label ?? "--"
        let pct = quota?.remainingPercent
        let isUnlimited = quota?.unlimited == true
        let color: (bar: NSColor, text: NSColor) = isUnlimited ? (.systemGreen, .white) : quotaColor(quota)
        let inset: CGFloat = 10
        drawPill(NSRect(x: x, y: 0, width: width, height: DashboardView.barHeight))
        let barRect = NSRect(x: x + inset, y: 21.5, width: width - inset * 2, height: 4)
        let now = Date().timeIntervalSince1970
        let resetSeconds = quota?.resetAt.map { $0 > 100_000_000_000 ? $0 / 1000 : $0 }
        let resetPassed = !isUnlimited && (resetSeconds.map { $0 <= now } ?? false)
        let exhausted = !isUnlimited && !resetPassed
            && (quota?.status == "exhausted" || (pct.map { $0 <= 0 } ?? false))
            && (resetSeconds.map { $0 > now } ?? false)

        // 用尽：右侧换成大号的恢复倒计时（红色），进度条整条暗红。
        if exhausted, let countdown = countdownText(quota?.resetAt) {
            let labelWidth = drawText(label, at: NSPoint(x: x + inset, y: 4.5), color: DashboardView.secondaryText, size: 11, weight: .semibold)
            let countdownWidth = drawRightText(countdown, rightX: x + width - inset, y: 1, color: .systemRed, size: 15, weight: .bold)
            let symbolX = x + width - inset - countdownWidth - 14
            if symbolX > x + inset + labelWidth + 6 {
                _ = drawSymbol("hourglass", at: NSPoint(x: symbolX, y: 5), pointSize: 10, color: .systemRed)
            }
            NSColor.systemRed.withAlphaComponent(0.4).setFill()
            NSBezierPath(roundedRect: barRect, xRadius: 2, yRadius: 2).fill()
            return
        }

        // 过了重置时间而数据还没换新窗口：数字换成 ↻，和菜单栏一致。
        let pctText = isUnlimited ? "∞" : resetPassed ? "↻" : (pct == nil ? "--" : "\(Int(round(min(max(pct ?? 0, 0), 100))))%")
        let pctWidth = drawRightText(pctText, rightX: x + width - inset, y: 3, color: resetPassed ? DashboardView.secondaryText : color.text, size: 13, weight: .bold)

        // 左侧：窗口名 + 距离重置还有多久。空间不够时倒计时让位。
        let labelWidth = drawText(label, at: NSPoint(x: x + inset, y: 4.5), color: DashboardView.secondaryText, size: 11, weight: .semibold)
        if !isUnlimited, let countdown = countdownText(quota?.resetAt) {
            let countdownX = x + inset + labelWidth + 7
            let room = (x + width - inset - pctWidth - 6) - countdownX
            let symbolWidth: CGFloat = 11
            if room >= symbolWidth + textWidth(countdown, size: 10, weight: .medium) {
                let drawn = drawSymbol("arrow.clockwise", at: NSPoint(x: countdownX, y: 7), pointSize: 8, color: DashboardView.tertiaryText)
                drawText(countdown, at: NSPoint(x: countdownX + (drawn > 0 ? drawn + 2 : 0), y: 5.5), color: DashboardView.tertiaryText, size: 10, weight: .medium)
            }
        }

        DashboardView.trackColor.setFill()
        NSBezierPath(roundedRect: barRect, xRadius: 2, yRadius: 2).fill()

        let normalized = isUnlimited ? 100 : min(max(pct ?? 0, 0), 100)
        if normalized > 0 {
            let fillRect = NSRect(x: barRect.minX, y: barRect.minY, width: max(4, barRect.width * CGFloat(normalized) / 100), height: barRect.height)
            color.bar.setFill()
            NSBezierPath(roundedRect: fillRect, xRadius: 2, yRadius: 2).fill()
        }
        if !isUnlimited && !resetPassed {
            drawPaceTick(quota, in: barRect, now: now, resetSeconds: resetSeconds)
        }
    }

    // 匀速刻度：落在「此刻按匀速应剩」的位置，填充短于刻度就是用得比匀速快。
    // 和 usage-pace.js 一样，窗口刚开始（不到 5% 且不足 10 分钟）时不画。
    private func drawPaceTick(_ quota: TouchQuota?, in barRect: NSRect, now: TimeInterval, resetSeconds: Double?) {
        guard let windowMs = quota?.windowMs, windowMs > 0, let reset = resetSeconds, reset > now else { return }
        let windowSeconds = windowMs / 1000
        let elapsed = min(max(windowSeconds - (reset - now), 0), windowSeconds)
        guard elapsed >= max(windowSeconds * 0.05, 600) else { return }
        let expected = 100 - elapsed / windowSeconds * 100
        let tickX = barRect.minX + barRect.width * CGFloat(expected / 100)
        let tickRect = NSRect(x: tickX - 1, y: barRect.minY - 2, width: 2, height: barRect.height + 4)
        DashboardView.pillColor.setFill()
        NSBezierPath(roundedRect: tickRect.insetBy(dx: -1, dy: 0), xRadius: 1.5, yRadius: 1.5).fill()
        NSColor(calibratedWhite: 0.88, alpha: 1).setFill()
        NSBezierPath(roundedRect: tickRect, xRadius: 1, yRadius: 1).fill()
    }

    // resetAt 是毫秒时间戳；个别来源给的是秒，一并兼容。
    private func countdownText(_ resetAt: Double?) -> String? {
        guard let resetAt, resetAt > 0 else { return nil }
        let resetSeconds = resetAt > 100_000_000_000 ? resetAt / 1000 : resetAt
        let remaining = resetSeconds - Date().timeIntervalSince1970
        // 与面板的 formatReset 一样四舍五入到分钟，两边显示的数字才对得上。
        let minutes = Int((remaining / 60).rounded())
        guard minutes > 0 else { return nil }
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        if hours < 24 {
            let rest = minutes % 60
            return rest == 0 ? "\(hours)h" : "\(hours)h\(rest)m"
        }
        let days = hours / 24
        let restHours = hours % 24
        return restHours == 0 ? "\(days)d" : "\(days)d\(restHours)h"
    }

    private func drawIqItems(_ items: [TouchIq], startX: CGFloat, availableWidth: CGFloat) {
        let pageCount = max(1, Int(ceil(Double(items.count) / Double(iqPageSize))))
        let currentPage = min(iqPages[activeProvider] ?? 0, pageCount - 1)
        let pageStart = currentPage * iqPageSize
        let pageEnd = min(pageStart + iqPageSize, items.count)
        let visibleItems = Array(items[pageStart..<pageEnd])
        let indicatorWidth: CGFloat = pageCount > 1 ? 16 : 0
        let contentWidth = availableWidth - indicatorWidth
        let gap: CGFloat = 4
        let cardWidth = floor((contentWidth - gap * CGFloat(max(0, visibleItems.count - 1))) / CGFloat(visibleItems.count))
        var x = startX
        for item in visibleItems {
            drawPill(NSRect(x: x, y: 0, width: cardWidth, height: DashboardView.barHeight))
            drawCenteredText(item.compactLabel ?? shortModel(item.label), in: NSRect(x: x + 3, y: 3, width: cardWidth - 6, height: 12), color: DashboardView.secondaryText, size: 9, weight: .semibold)
            let score = item.score == nil ? "--" : String(format: "%.1f", item.score ?? 0)
            drawCenteredText(score, in: NSRect(x: x + 3, y: 13, width: cardWidth - 6, height: 15), color: statusColor(item.status), size: 12, weight: .bold)
            x += cardWidth + gap
        }

        if pageCount > 1 {
            drawPageDots(pageCount: pageCount, currentPage: currentPage, x: startX + availableWidth - indicatorWidth, width: indicatorWidth)
        }
    }

    private func normalizeIqPage() {
        let itemCount = currentProviderPayload()?.iq?.count ?? 0
        let pageCount = max(1, Int(ceil(Double(itemCount) / Double(iqPageSize))))
        if (iqPages[activeProvider] ?? 0) >= pageCount { iqPages[activeProvider] = 0 }
    }

    @objc func advanceIqPage() {
        let itemCount = currentProviderPayload()?.iq?.count ?? 0
        let pageCount = max(1, Int(ceil(Double(itemCount) / Double(iqPageSize))))
        guard pageCount > 1 else { return }
        iqPages[activeProvider] = ((iqPages[activeProvider] ?? 0) + 1) % pageCount
        needsDisplay = true
    }

    @objc private func handleIqButton() {
        advanceIqPage()
    }

    @objc private func handleQuotaButton() {
        FileHandle.standardOutput.write(Data("touchbar-open-panel\n".utf8))
    }

    @objc private func handleProviderButton() {
        let providers = availableProviderIds()
        guard providers.count > 1 else { return }
        let currentIndex = providers.firstIndex(of: activeProvider) ?? 0
        activeProvider = providers[(currentIndex + 1) % providers.count]
        normalizeIqPage()
        layoutButtons()
        needsDisplay = true
        FileHandle.standardOutput.write(Data("touchbar-provider:\(activeProvider)\n".utf8))
    }

    private func currentProviderPayload() -> TouchProvider? {
        if let provider = payload?.providers?[activeProvider] { return provider }
        if activeProvider == "codex", payload?.usage != nil || payload?.iq != nil {
            return TouchProvider(label: "GPT", usage: payload?.usage, iq: payload?.iq)
        }
        return nil
    }

    private func availableProviderIds() -> [String] {
        let configured = payload?.providerOrder ?? []
        let available = configured.filter { payload?.providers?[$0] != nil }
        if !available.isEmpty { return available }

        if let keys = payload?.providers?.keys, !keys.isEmpty {
            return keys.sorted { left, right in
                if left == "codex" { return true }
                if right == "codex" { return false }
                return left < right
            }
        }
        return ["codex"]
    }

    // 平台切换：能切换时用平台色实心块（像系统的主操作按钮），只有一个平台时退成普通灰块。
    private func drawProviderSwitch() {
        let frame = NSRect(x: DashboardView.switchStartX, y: 0, width: DashboardView.switchWidth, height: DashboardView.barHeight)
        let canSwitch = availableProviderIds().count > 1
        let fill = canSwitch
            ? (providerAccentColor().blended(withFraction: 0.18, of: .black) ?? providerAccentColor())
            : DashboardView.pillColor
        drawPill(frame, color: fill)
        drawCenteredText(
            currentProviderPayload()?.label ?? "GPT",
            in: NSRect(x: frame.minX + 2, y: 7.5, width: frame.width - 4, height: 16),
            color: canSwitch ? .white : DashboardView.secondaryText,
            size: 11.5,
            weight: .bold
        )
    }

    private func drawPageDots(pageCount: Int, currentPage: Int, x: CGFloat, width: CGFloat) {
        let dotSize: CGFloat = 4
        let dotGap: CGFloat = 3
        let totalWidth = CGFloat(pageCount) * dotSize + CGFloat(max(0, pageCount - 1)) * dotGap
        var dotX = x + width - totalWidth
        for page in 0..<pageCount {
            let color = page == currentPage ? NSColor.white : NSColor(calibratedWhite: 0.38, alpha: 1)
            color.setFill()
            NSBezierPath(ovalIn: NSRect(x: dotX, y: (DashboardView.barHeight - dotSize) / 2, width: dotSize, height: dotSize)).fill()
            dotX += dotSize + dotGap
        }
    }

    private func providerAccentColor() -> NSColor {
        switch activeProvider {
        case "claude": return .systemOrange
        case "antigravity": return .systemGreen
        case "kimi": return .systemPink
        case "glm": return .systemPurple
        case "qwen": return .systemTeal
        default: return .systemBlue
        }
    }

    // 颜色跟节奏走：剩余 ≤10% 或已用尽是红色，明显偏快橙色，偏快黄色，其余绿色。
    // 没有节奏信息的平台（Kimi / GLM / Qwen）沿用按剩余百分比的老规则。
    private func quotaColor(_ quota: TouchQuota?) -> (bar: NSColor, text: NSColor) {
        guard let percent = quota?.remainingPercent else {
            return (NSColor(calibratedWhite: 0.55, alpha: 1), NSColor(calibratedWhite: 0.70, alpha: 1))
        }
        if percent <= 10 { return (.systemRed, .systemRed) }
        if let tier = quota?.tier {
            switch tier {
            case "critical": return (.systemRed, .systemRed)
            case "serious": return (.systemOrange, .systemOrange)
            case "warning": return (.systemYellow, .systemYellow)
            default: return (.systemGreen, .white)
            }
        }
        if percent <= 20 { return (.systemRed, .systemRed) }
        if percent <= 50 { return (.systemYellow, .systemYellow) }
        return (.systemGreen, .white)
    }

    // IQ 分数的文字颜色：正常是白色，只有需要留意的状态才上色。
    private func statusColor(_ status: String?) -> NSColor {
        switch status {
        case "green": return .systemGreen
        case "yellow": return .systemYellow
        case "red": return .systemRed
        case "invalid": return .systemOrange
        default: return .white
        }
    }

    private func shortModel(_ label: String) -> String {
        label
            .replacingOccurrences(of: "GPT-", with: "")
            .replacingOccurrences(of: "xhigh", with: "xh")
            .replacingOccurrences(of: "medium", with: "md")
            .replacingOccurrences(of: "high", with: "hi")
            .replacingOccurrences(of: "low", with: "lo")
    }

    private func textAttributes(color: NSColor, size: CGFloat, weight: NSFont.Weight) -> [NSAttributedString.Key: Any] {
        [
            .font: NSFont.monospacedDigitSystemFont(ofSize: size, weight: weight),
            .foregroundColor: color
        ]
    }

    private func textWidth(_ text: String, size: CGFloat, weight: NSFont.Weight) -> CGFloat {
        ceil((text as NSString).size(withAttributes: textAttributes(color: .white, size: size, weight: weight)).width)
    }

    @discardableResult
    private func drawText(_ text: String, at point: NSPoint, color: NSColor, size: CGFloat, weight: NSFont.Weight) -> CGFloat {
        let attrs = textAttributes(color: color, size: size, weight: weight)
        (text as NSString).draw(at: point, withAttributes: attrs)
        return ceil((text as NSString).size(withAttributes: attrs).width)
    }

    @discardableResult
    private func drawRightText(_ text: String, rightX: CGFloat, y: CGFloat, color: NSColor, size: CGFloat, weight: NSFont.Weight) -> CGFloat {
        let attrs = textAttributes(color: color, size: size, weight: weight)
        let textSize = (text as NSString).size(withAttributes: attrs)
        (text as NSString).draw(at: NSPoint(x: rightX - textSize.width, y: y), withAttributes: attrs)
        return ceil(textSize.width)
    }

    private func drawCenteredText(_ text: String, in rect: NSRect, color: NSColor, size: CGFloat, weight: NSFont.Weight) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        paragraph.lineBreakMode = .byTruncatingMiddle
        var attrs = textAttributes(color: color, size: size, weight: weight)
        attrs[.paragraphStyle] = paragraph
        (text as NSString).draw(in: rect, withAttributes: attrs)
    }

    // 画一个着色的 SF Symbol，返回占用宽度；系统没有这个符号时返回 0，调用方只画文字。
    private func drawSymbol(_ name: String, at point: NSPoint, pointSize: CGFloat, color: NSColor) -> CGFloat {
        guard let base = NSImage(systemSymbolName: name, accessibilityDescription: nil),
              let symbol = base.withSymbolConfiguration(NSImage.SymbolConfiguration(pointSize: pointSize, weight: .bold)) else {
            return 0
        }
        let size = symbol.size
        guard size.width > 0, size.height > 0 else { return 0 }
        let tinted = NSImage(size: size, flipped: false) { rect in
            symbol.draw(in: rect)
            color.set()
            rect.fill(using: .sourceAtop)
            return true
        }
        tinted.draw(
            in: NSRect(origin: point, size: size),
            from: .zero,
            operation: .sourceOver,
            fraction: 1,
            respectFlipped: true,
            hints: nil
        )
        return ceil(size.width)
    }
}

extension NSTouchBarItem.Identifier {
    static let dashboard = NSTouchBarItem.Identifier("local.codex-menu-meter.touchbar.dashboard")
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSTouchBarDelegate {
    private let statePath: String
    private let parentPid: pid_t?
    private var bar: NSTouchBar!
    private var dashboard: DashboardView!
    private var refreshTimer: Timer?
    private var parentTimer: Timer?
    private var mouseMonitor: Any?
    private var inputBuffer = ""
    private var trayItem: NSCustomTouchBarItem?

    init(statePath: String, parentPid: pid_t?) {
        self.statePath = statePath
        self.parentPid = parentPid
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        dashboard = DashboardView(statePath: statePath)
        bar = NSTouchBar()
        bar.delegate = self
        bar.defaultItemIdentifiers = [.dashboard]
        present()
        startCommandReader()

        refreshTimer = Timer.scheduledTimer(timeInterval: 0.5, target: self, selector: #selector(refreshState), userInfo: nil, repeats: true)
        parentTimer = Timer.scheduledTimer(timeInterval: 5, target: self, selector: #selector(checkParent), userInfo: nil, repeats: true)
        mouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown]) { [weak self] _ in
            self?.emitPointerDown()
        }
        let workspaceNotifications = NSWorkspace.shared.notificationCenter
        workspaceNotifications.addObserver(self, selector: #selector(present), name: NSWorkspace.didWakeNotification, object: nil)
        workspaceNotifications.addObserver(
            self,
            selector: #selector(foregroundApplicationChanged(_:)),
            name: NSWorkspace.didActivateApplicationNotification,
            object: nil
        )
        emitForegroundApplication(NSWorkspace.shared.frontmostApplication)
    }

    func applicationWillTerminate(_ notification: Notification) {
        FileHandle.standardInput.readabilityHandler = nil
        if let mouseMonitor {
            NSEvent.removeMonitor(mouseMonitor)
        }
        NSWorkspace.shared.notificationCenter.removeObserver(self)
    }

    @objc private func refreshState() {
        dashboard.readState()
    }

    private func startCommandReader() {
        FileHandle.standardInput.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty {
                handle.readabilityHandler = nil
                return
            }
            guard let text = String(data: data, encoding: .utf8) else { return }
            DispatchQueue.main.async { [weak self] in
                self?.consumeCommands(text)
            }
        }
    }

    private func consumeCommands(_ text: String) {
        inputBuffer.append(text)
        while let newline = inputBuffer.firstIndex(of: "\n") {
            let command = String(inputBuffer[..<newline])
            inputBuffer.removeSubrange(...newline)
            if command.trimmingCharacters(in: .whitespacesAndNewlines) == "present" {
                present()
            }
        }
    }

    @objc private func checkParent() {
        guard let parentPid else { return }
        if getppid() != parentPid || kill(parentPid, 0) != 0 {
            NSApp.terminate(nil)
        }
    }

    private func emitPointerDown() {
        FileHandle.standardOutput.write(Data("pointer-down\n".utf8))
    }

    @objc private func foregroundApplicationChanged(_ notification: Notification) {
        let runningApplication = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
        emitForegroundApplication(runningApplication)
    }

    private func emitForegroundApplication(_ runningApplication: NSRunningApplication?) {
        let fields = [
            runningApplication?.bundleIdentifier ?? "",
            runningApplication?.localizedName ?? "",
            runningApplication?.bundleURL?.path ?? "",
            runningApplication.map { String($0.processIdentifier) } ?? ""
        ].map { value in
            value.replacingOccurrences(of: "\t", with: " ")
                .replacingOccurrences(of: "\n", with: " ")
                .replacingOccurrences(of: "\r", with: " ")
        }
        FileHandle.standardOutput.write(Data("foreground-app:\(fields.joined(separator: "\t"))\n".utf8))
    }

    @objc private func present() {
        DFRSystemModalShowsCloseBoxWhenFrontMost(false)
        if trayItem == nil {
            let tray = NSCustomTouchBarItem(identifier: trayIdentifier)
            tray.view = NSButton(title: "用量", target: self, action: #selector(present))
            trayItem = tray
            addSystemTrayItem(tray)
        }
        DFRElementSetControlStripPresenceForIdentifier(trayIdentifier.rawValue as NSString, true)
        presentSystemModal(bar, trayId: trayIdentifier)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            DFRSystemModalShowsCloseBoxWhenFrontMost(false)
        }
    }

    func touchBar(_ touchBar: NSTouchBar, makeItemForIdentifier identifier: NSTouchBarItem.Identifier) -> NSTouchBarItem? {
        guard identifier == .dashboard else { return nil }
        let item = NSCustomTouchBarItem(identifier: identifier)
        item.view = dashboard
        dashboard.widthAnchor.constraint(equalToConstant: DashboardView.viewWidth).isActive = true
        return item
    }
}

// 离屏渲染，给界面核对用：touchbar-helper --render <state.json> <out.png> [平台] [IQ 页]
// 不接触真实的 Touch Bar，也不需要主进程在运行。
func renderSnapshot(_ arguments: [String]) -> Int32 {
    guard arguments.count >= 3 else {
        FileHandle.standardError.write(Data("usage: touchbar-helper --render <state.json> <out.png> [provider] [iqPage]\n".utf8))
        return 64
    }
    _ = NSApplication.shared
    let view = DashboardView(statePath: arguments[1])
    view.appearance = NSAppearance(named: .darkAqua)
    view.selectForSnapshot(
        provider: arguments.count >= 4 ? arguments[3] : nil,
        iqPage: arguments.count >= 5 ? Int(arguments[4]) ?? 0 : 0
    )

    let scale: CGFloat = 2
    let size = view.bounds.size
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(size.width * scale),
        pixelsHigh: Int(size.height * scale),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .calibratedRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else { return 1 }
    rep.size = size
    guard let context = NSGraphicsContext(bitmapImageRep: rep) else { return 1 }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    NSColor.black.setFill()
    NSRect(origin: .zero, size: size).fill()
    NSGraphicsContext.restoreGraphicsState()
    view.displayIgnoringOpacity(view.bounds, in: context)

    guard let png = rep.representation(using: .png, properties: [:]) else { return 1 }
    do {
        try png.write(to: URL(fileURLWithPath: arguments[2]))
    } catch {
        FileHandle.standardError.write(Data("write failed: \(error.localizedDescription)\n".utf8))
        return 1
    }
    return 0
}

let launchArguments = Array(CommandLine.arguments.dropFirst())
if launchArguments.first == "--render" {
    exit(renderSnapshot(launchArguments))
}

let statePath = launchArguments.first ?? (NSHomeDirectory() + "/Library/Application Support/codex-menu-meter/touchbar-state.json")
let parentPid = launchArguments.dropFirst().first.flatMap { pid_t($0) }
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate(statePath: statePath, parentPid: parentPid)
app.delegate = delegate
app.run()
