import AppKit
import WebKit

@MainActor
final class DungeonApplication: NSObject, NSApplicationDelegate {
    var window: NSWindow?
    var game: GameView?
    private var awaitingQuit = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu()
        do {
            guard let entry = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") else {
                throw CocoaError(.fileNoSuchFile)
            }
            let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                   appropriateFor: nil, create: true)
            let store = try SaveStore(directory: base.appendingPathComponent("Decimal Dungeon", isDirectory: true))
            let game = GameView(entry: entry, store: store)
            self.game = game
            game.onFailure = { [weak self] message in self?.showError(message) }
            let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
            let size = NSSize(width: min(1360, screen.width - 32), height: min(930, screen.height - 50))
            let window = NSWindow(contentRect: NSRect(origin: .zero, size: size),
                                  styleMask: [.titled, .closable, .resizable, .miniaturizable],
                                  backing: .buffered, defer: false)
            self.window = window
            window.title = "Decimal Dungeon"
            window.appearance = NSAppearance(named: .darkAqua)
            window.contentMinSize = NSSize(width: 520, height: 440)
            window.isReleasedWhenClosed = false
            window.contentView = game.view
            window.center()
            window.setFrameAutosaveName("AdventureWindow")
            window.makeKeyAndOrderFront(nil)
            game.start()
        } catch {
            showError("The game could not open its files. " + error.localizedDescription)
            NSApp.terminate(nil)
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
