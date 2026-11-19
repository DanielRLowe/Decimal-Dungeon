import AppKit
import WebKit

@MainActor
final class DungeonApplication: NSObject, NSApplicationDelegate {
    var window: NSWindow?
    var game: GameView?
    private var awaitingQuit = false

    private let host = NSView()
    private var status: NSView?
    private var startupFailed = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu()
        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let size = NSSize(width: min(1360, screen.width - 32), height: min(930, screen.height - 50))
        let window = NSWindow(contentRect: NSRect(origin: .zero, size: size),
                              styleMask: [.titled, .closable, .resizable, .miniaturizable],
                              backing: .buffered, defer: false)
        self.window = window
        window.title = "Decimal Dungeon"
        window.appearance = NSAppearance(named: .darkAqua)
        window.contentMinSize = NSSize(width: min(520, size.width), height: min(440, size.height))
        window.isReleasedWhenClosed = false
        window.contentView = host
        window.center()
        window.setFrameAutosaveName("AdventureWindow")
        showStatus("Opening your saved adventure…")
        revealWindow()
        window.displayIfNeeded()
        // AppKit can present the loading window before reading the save or constructing WebKit.
        DispatchQueue.main.async { [weak self] in self?.openGame() }
    }

    private func revealWindow() {
        guard let window else { return }
        if window.isMiniaturized { window.deminiaturize(nil) }
        let displays = NSScreen.screens.map(\.visibleFrame)
        let frame = window.frame
        if !window.styleMask.contains(.fullScreen), !displays.contains(where: { $0.contains(frame) }),
           let main = NSScreen.main?.visibleFrame {
            func overlap(_ display: NSRect) -> CGFloat {
                let rect = frame.intersection(display)
                return rect.isNull ? 0 : rect.width * rect.height
            }
            let closest = displays.max { overlap($0) < overlap($1) } ?? main
            let screen = overlap(closest) > 0 ? closest : main
            let w = min(frame.width, screen.width), h = min(frame.height, screen.height)
            let x = overlap(screen) > 0 ? frame.minX : screen.midX - w / 2
            let y = overlap(screen) > 0 ? frame.minY : screen.midY - h / 2
            window.setFrame(NSRect(x: min(max(x, screen.minX), screen.maxX - w),
                                   y: min(max(y, screen.minY), screen.maxY - h),
                                   width: w, height: h), display: true)
        }
        NSApp.unhide(nil)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        revealWindow()
        return window == nil
    }

    private func showStatus(_ message: String, failed: Bool = false) {
        status?.removeFromSuperview()
        let panel = NSView(frame: host.bounds)
        panel.autoresizingMask = [.width, .height]
        panel.wantsLayer = true
        panel.layer?.backgroundColor = NSColor(calibratedRed: 0.09, green: 0.13, blue: 0.18, alpha: 1).cgColor
        let label = NSTextField(wrappingLabelWithString: message)
        label.alignment = .center
        label.font = .systemFont(ofSize: 17, weight: .medium)
        label.textColor = .white
        let stack = NSStackView(views: [label])
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = 14
        if failed {
            let retry = NSButton(title: "Try Again", target: self, action: #selector(retryStartup))
            stack.addArrangedSubview(retry)
        }
        stack.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: panel.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: panel.centerYAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualTo: panel.widthAnchor, constant: -48),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 540)
        ])
        host.addSubview(panel)
        status = panel
    }

    @objc private func retryStartup() {
        showStatus("Opening your saved adventure…")
        DispatchQueue.main.async { [weak self] in self?.openGame() }
    }

    private func openGame() {
        game?.view.removeFromSuperview()
        game = nil
        startupFailed = false
        do {
            guard let entry = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") else {
                showStatus("The game page is missing from this copy of Decimal Dungeon. Open a complete copy of the app.", failed: true)
                return
            }
            let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                   appropriateFor: nil, create: true)
            let store = try SaveStore(directory: base.appendingPathComponent("Decimal Dungeon", isDirectory: true))
            showStatus("Starting the game view…")
            window?.displayIfNeeded()
            let game = GameView(entry: entry, store: store)
            self.game = game
            game.onLoaded = { [weak self, weak game] in
                guard let self, let game, self.game === game, !self.startupFailed, let status = self.status else { return }
                status.removeFromSuperview()
                self.status = nil
                self.window?.makeFirstResponder(game.view)
            }
            game.onFailure = { [weak self, weak game] message in
                guard let self, let game, self.game === game else { return }
                if self.status != nil {
                    self.startupFailed = true
                    self.showStatus("Decimal Dungeon could not finish opening. " + message, failed: true)
                } else {
                    self.showError(message)
                }
            }
            game.view.frame = host.bounds
            game.view.autoresizingMask = [.width, .height]
            host.addSubview(game.view, positioned: .below, relativeTo: status)
            game.start()
        } catch {
            showStatus("Decimal Dungeon could not open your saved progress. " + error.localizedDescription, failed: true)
        }
    }

    private func installMenu() {
        let bar = NSMenu()
        func addMenu(_ title: String, items: [(String, Selector, String)]) {
            let parent = NSMenuItem()
            let menu = NSMenu(title: title)
            parent.submenu = menu
            bar.addItem(parent)
            for (label, action, shortcut) in items {
                menu.addItem(withTitle: label, action: action, keyEquivalent: shortcut)
            }
        }
        addMenu("Decimal Dungeon", items: [
            ("About Decimal Dungeon", #selector(NSApplication.orderFrontStandardAboutPanel(_:)), ""),
            ("Hide Decimal Dungeon", #selector(NSApplication.hide(_:)), "h"),
            ("Quit Decimal Dungeon", #selector(NSApplication.terminate(_:)), "q")
        ])
        addMenu("Edit", items: [
            ("Undo", Selector(("undo:")), "z"), ("Redo", Selector(("redo:")), "Z"),
            ("Cut", #selector(NSText.cut(_:)), "x"), ("Copy", #selector(NSText.copy(_:)), "c"),
            ("Paste", #selector(NSText.paste(_:)), "v"), ("Select All", #selector(NSText.selectAll(_:)), "a")
        ])
        addMenu("Window", items: [
            ("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"),
            ("Close", #selector(NSWindow.performClose(_:)), "w"),
            ("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f")
        ])
        bar.items.last?.submenu?.items.last?.keyEquivalentModifierMask = [.control, .command]
        NSApp.mainMenu = bar
    }

    private func showError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "Decimal Dungeon needs attention"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        if let window { alert.beginSheetModal(for: window) } else { alert.runModal() }
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard let game, game.loaded else { return .terminateNow }
        if awaitingQuit { return .terminateLater }
        awaitingQuit = true
        let finish: @MainActor () -> Void = { [weak self] in
            guard let self, self.awaitingQuit else { return }
            self.awaitingQuit = false
            sender.reply(toApplicationShouldTerminate: true)
        }
        game.flushForQuit(finish)
        // A hung web content process must still permit quitting.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { finish() }
        return .terminateLater
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let application = NSApplication.shared
let delegate = DungeonApplication()
application.setActivationPolicy(.regular)
application.delegate = delegate
application.run()
