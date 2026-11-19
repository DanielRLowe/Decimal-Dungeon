// Run the same WebKit loader and save bridge as the released app in an isolated
// window. Supply a bundled index.html and an empty temporary save directory.
import AppKit
import WebKit

enum CheckFailure: Error, CustomStringConvertible {
    case message(String)
    var description: String {
        switch self { case .message(let detail): return detail }
    }
}

@main
struct SmokeTest {
    @MainActor
    final class TestWindow: NSWindow {
        override var canBecomeKey: Bool { true }
    }

    @MainActor
    static func focusMediaWindow(_ window: NSWindow, view: WKWebView) {
        NSApp.unhide(nil)
        window.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(view)
    }

    @MainActor
    static func runScenario(_ script: String, in game: GameView, pass: Int, scenario: String) async throws {
        let scripts = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let helpers = try ["native-arithmetic-helpers.js", "native-curriculum-helpers.js", "native-atlas-helpers.js"].map {
            try String(contentsOf: scripts.appendingPathComponent($0), encoding: .utf8)
        }.joined(separator: "\n")
        let body = try String(contentsOf: scripts.appendingPathComponent(script), encoding: .utf8)
        let result = try await game.view.callAsyncJavaScript(helpers + "\n" + body, arguments: ["pass": pass, "scenario": scenario], in: nil, contentWorld: .page)
        if let summary = result as? String { print(summary) }
    }

    /// Optional QA screenshots stay in the supplied test directory.
    @MainActor
    static func captureMap(_ game: GameView, name: String, configuration: WKSnapshotConfiguration? = nil) async throws {
        guard let path = ProcessInfo.processInfo.environment["DECIMAL_DUNGEON_QA_IMAGES"], !path.isEmpty else { return }
        let directory = URL(fileURLWithPath: path, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let snapshot = try await game.view.takeSnapshot(configuration: configuration)
        guard let data = snapshot.tiffRepresentation, let bitmap = NSBitmapImageRep(data: data),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            throw CheckFailure.message("Native map screenshot could not be encoded.")
        }
        try png.write(to: directory.appendingPathComponent(name + ".png"), options: .atomic)
    }

    /// Crop the real WebKit view to the sidebar button, preserving the rendered size.
    @MainActor
    static func capturePreview(_ game: GameView, name: String) async throws {
        guard let path = ProcessInfo.processInfo.environment["DECIMAL_DUNGEON_QA_IMAGES"], !path.isEmpty else { return }
        let position = try await game.view.callAsyncJavaScript("""
            const card = document.getElementById('empire-preview');
            const scroll = window.scrollY;
            card.scrollIntoView({block:'center',behavior:'instant'});
            const r = card.getBoundingClientRect();
            return {x:r.x,y:r.y,width:r.width,height:r.height,scroll};
            """, arguments: [:], in: nil, contentWorld: .page)
        guard let values = position as? [String: NSNumber],
              let x = values["x"], let y = values["y"], let w = values["width"], let h = values["height"],
              let scroll = values["scroll"], w.doubleValue > 20, h.doubleValue > 20 else {
            throw CheckFailure.message("The empire preview has no visible snapshot bounds.")
        }
        let config = WKSnapshotConfiguration()
        config.rect = CGRect(x: x.doubleValue, y: y.doubleValue, width: w.doubleValue, height: h.doubleValue).integral
        try await captureMap(game, name: name, configuration: config)
        _ = try await game.view.callAsyncJavaScript("window.scrollTo({top:y,behavior:'instant'});",
                    arguments: ["y": scroll], in: nil, contentWorld: .page)
    }

    // Deliver Return using the AppKit window so WebKit creates a trusted keyboard click.
    // HTML element.click() is deliberately insufficient to launch an external app.
    @MainActor
    static func pressReturn(in window: NSWindow) throws {
        let time = ProcessInfo.processInfo.systemUptime
        for type: NSEvent.EventType in [.keyDown, .keyUp] {
            guard let event = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [],
                timestamp: time, windowNumber: window.windowNumber, context: nil, characters: "\r",
                charactersIgnoringModifiers: "\r", isARepeat: false, keyCode: 36) else {
                throw CheckFailure.message("Could not create an in-window Return event.")
            }
            window.sendEvent(event)
        }
    }

    @MainActor
    static func verifyProfileLinks(_ game: GameView, window: NSWindow, pass: Int, opened: () -> [URL]) async throws {
        guard let store = try await game.view.evaluateJavaScript("DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1')") as? String else {
            throw CheckFailure.message("Could not read the isolated country profile save.")
        }
        try pressReturn(in: window)
        let selector = "document.querySelector('dialog[data-country-profile][open]')"
        let deadline = Date().addingTimeInterval(3)
        while try await game.view.evaluateJavaScript("!!" + selector) as? Bool != true && Date() < deadline {
            try await Task.sleep(nanoseconds: 30_000_000)
        }
        let prepare = """
            const panel = document.querySelector('dialog[data-country-profile][open]');
            if (!panel) throw Error('Return did not open the focused country profile');
            const links = [...panel.querySelectorAll('a[href^="https://"]')];
            const source = links.find(link => link.hostname === preferred) || links[0];
            if (!source) throw Error('Missing a real country source anchor');
            for (let el=source;el && el!==panel;el=el.parentElement) if(el.tagName==='DETAILS') el.open=true;
            source.dataset.qaSource = '';
            source.focus();
            if (document.activeElement!==source) throw Error('The educational source could not receive keyboard focus');
            source.click();
            return source.href;
            """
        guard let href = try await game.view.callAsyncJavaScript(prepare,
            arguments: ["preferred": pass == 0 ? "data.worldbank.org" : "correlatesofwar.org"],
            in: nil, contentWorld: .page) as? String else {
            throw CheckFailure.message("Could not locate a clickable citation.")
        }
        try await Task.sleep(nanoseconds: 150_000_000)
        guard opened().isEmpty else { throw CheckFailure.message("A synthetic non-user click opened a browser.") }
        try pressReturn(in: window)
        let openedDeadline = Date().addingTimeInterval(3)
        while opened().isEmpty && Date() < openedDeadline { try await Task.sleep(nanoseconds: 30_000_000) }
        guard opened().map(\.absoluteString) == [href] else {
            throw CheckFailure.message("The user-activated profile citation was not handed to the browser exactly once: " + href)
        }
        try await captureMap(game, name: pass == 0 ? "modern-country-profile" : "historical-country-profile")
        // Use the same trusted gesture on an ordinary, unlisted site.
        // All browser launches in this verifier are recorded, including unexpected ones.
        _ = try await game.view.evaluateJavaScript("""
            (() => {
              const source = document.querySelector('[data-qa-source]');
              source.href='https://example.org/';
              source.focus();
            })()
            """)
        try pressReturn(in: window)
        try await Task.sleep(nanoseconds: 180_000_000)
        let saved = try await game.view.evaluateJavaScript("DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1')") as? String
        let stillOpen = try await game.view.evaluateJavaScript("!!" + selector) as? Bool
        guard opened().count == 1, stillOpen == true, saved == store else {
            throw CheckFailure.message("Following or declining a source link changed the game or opened another app.")
        }
    }

    /// Launch Services uses the same application registration path as a Finder double-click.
    /// Its per-launch home override keeps this probe separate from the player's adventure.
    @MainActor
    static func verifyFinderLaunch(app: URL, temporaryHome: URL) async throws {
        try FileManager.default.createDirectory(at: temporaryHome, withIntermediateDirectories: true)
        let config = NSWorkspace.OpenConfiguration()
        config.createsNewApplicationInstance = true
        config.activates = false
        config.hides = true
        config.environment = ["CFFIXED_USER_HOME": temporaryHome.path]
        let running = try await NSWorkspace.shared.openApplication(at: app, configuration: config)
        defer { if !running.isTerminated { _ = running.terminate() } }
        let save = temporaryHome.appendingPathComponent("Library/Application Support/Decimal Dungeon/progress.plist")
        let deadline = Date().addingTimeInterval(20)
        var ready = false
        while !ready && !running.isTerminated && Date() < deadline {
            try await Task.sleep(nanoseconds: 50_000_000)
            if let data = try? Data(contentsOf: save),
               let store = try? PropertyListDecoder().decode([String: String].self, from: data) {
                ready = !store.isEmpty
            }
        }
        guard ready else { throw CheckFailure.message("The packaged app did not create its first isolated save.") }
        guard running.terminate() else { throw CheckFailure.message("Could not close the test instance cleanly.") }
        let quitDeadline = Date().addingTimeInterval(5)
        while !running.isTerminated && Date() < quitDeadline {
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        guard running.isTerminated else { throw CheckFailure.message("Test instance did not quit.") }
        print("Finder launch verified with a fresh save under the isolated test home.")
    }

    @MainActor
    static func verifyScenario(entry: URL, directory: URL, window: NSWindow, script: String?, passes: Int) async throws {
        for pass in 0..<passes {
            var openedSources: [URL] = []
            let game = try GameView(entry: entry, store: SaveStore(directory: directory)) { openedSources.append($0) }
            var failure: String?
            game.onFailure = { failure = $0 }
            window.contentView = game.view
            let playTools = directory.lastPathComponent == "play-tools"
            let battleMusic = directory.lastPathComponent == "battle-music"
            let profiles = directory.lastPathComponent == "country-profiles"
            let foregroundMedia = playTools || battleMusic
            let foreground = foregroundMedia || profiles
            if foreground {
                NSApplication.shared.setActivationPolicy(.regular)
                window.level = .floating
                window.center()
                focusMediaWindow(window, view: game.view)
            }
            game.start()
            let deadline = Date().addingTimeInterval(20)
            while !game.loaded && failure == nil && Date() < deadline {
                try await Task.sleep(nanoseconds: 20_000_000)
            }
            guard game.loaded else { throw CheckFailure.message(failure ?? "The bundled page did not finish loading.") }
            var js = """
            const store = window.DungeonNativeStorage;
            if (document.readyState !== "complete") throw Error("Page is not ready");
            if (!crypto.subtle) throw Error("PIN encryption needs Web Crypto");
            if (document.querySelectorAll("script[src]").length === 0) throw Error("No game scripts loaded");
            """
            if pass == 0 {
                js += #"store.setItem("native-smoke", "save ♦🐲");"#
            }
            js += #"if (store.getItem("native-smoke") !== "save ♦🐲") throw Error("Save failed across launches");"#
            if pass == passes - 1 {
                js += """
                store.removeItem("native-smoke");
                if (store.getItem("native-smoke") !== null) throw Error("Remove failed");
                """
            }
            if script != nil {
                js += """
                if (!window.DungeonMath || !window.MathWorkbench || !window.DungeonCampaignMap) throw Error("Game modules failed to initialize");
                if (Array.from(document.images).some(img => img.getClientRects().length && (!img.complete || !img.naturalWidth))) throw Error("Visible artwork missing");
                """
            }
            let value = try await game.view.evaluateJavaScript("(() => { " + js + "; return document.title; })()")
            print("Native load \(pass + 1): \(value as? String ?? "")")
            if directory.lastPathComponent == "campaign" && pass == 0 {
                try await captureMap(game, name: "choose-country")
            }
            if foreground {
                try await Task.sleep(nanoseconds: 250_000_000)
                window.makeKeyAndOrderFront(nil)
                window.makeFirstResponder(game.view)
                print("Native play window visible=\(window.isVisible), key=\(window.isKeyWindow), active=\(NSApp.isActive), unobscured=\(window.occlusionState.contains(.visible)).")
            }
            if let script {
                // A foreground audio assertion requires a genuinely active window.
                // A desktop launcher can reclaim focus after opening the verifier.
                // Restore real AppKit focus briefly if that interrupts this pass.
                // Stop before the separate deliberate window-hiding assertions.
                let refocus: Task<Void, Never>? = foregroundMedia ? Task { @MainActor in
                    var attempts = 0
                    while attempts < 3 {
                        do { try await Task.sleep(nanoseconds: 200_000_000) } catch { return }
                        if !NSApp.isActive || !window.isKeyWindow || !window.occlusionState.contains(.visible) {
                            focusMediaWindow(window, view: game.view)
                            attempts += 1
                        }
                    }
                } : nil
                defer { refocus?.cancel() }
                try await runScenario(script, in: game, pass: pass, scenario: directory.lastPathComponent)
            }
            if profiles {
                try await verifyProfileLinks(game, window: window, pass: pass) { openedSources }
            }
            if directory.lastPathComponent == "fraction-clarity" && pass == 0 {
                try await captureMap(game, name: "rename-four-and-three-quarters")
            }
            if playTools && pass < 2 {
                try await captureMap(game, name: pass == 0 ? "fraction-workmat" : "critical-spell")
            }
            if playTools && pass == 0 {
                window.orderOut(nil)
                try await Task.sleep(nanoseconds: 420_000_000)
                let paused = try await game.view.evaluateJavaScript("""
                    document.querySelector('audio[data-dungeon-music]').paused &&
                    document.querySelector('#battle-timer [data-pace="paused"]') !== null
                    """) as? Bool
                guard paused == true else { throw CheckFailure.message("Hiding the native window did not suspend both music and battle time.") }
                window.makeKeyAndOrderFront(nil)
                window.makeFirstResponder(game.view)
                try await Task.sleep(nanoseconds: 450_000_000)
                await withCheckedContinuation { continuation in
                    game.flushForQuit { continuation.resume() }
                }
                let flushed = try await game.view.evaluateJavaScript("""
                    const save = JSON.parse(DungeonNativeStorage.getItem('decimal-dungeon.adventure.v1'));
                    Number(save.round.timing?.elapsedMs) > 0 && document.querySelector('#battle-timer [data-pace="paused"]') !== null
                    """) as? Bool
                guard flushed == true else { throw CheckFailure.message("The native clean-quit handoff did not checkpoint and stop the active spell.") }
            }
            if battleMusic {
                await withCheckedContinuation { continuation in
                    game.flushForQuit { continuation.resume() }
                }
            }
            if foreground && pass == passes - 1 { window.orderOut(nil); window.level = .normal }
            if directory.lastPathComponent == "rivals" && pass > 0 {
                let snapshots = ["", "", "first-sum-carry", "second-sum-carry", "worked-sums-receipt", "competing-empires"]
                if !snapshots[pass].isEmpty { try await captureMap(game, name: snapshots[pass]) }
            }
            if directory.lastPathComponent == "campaign" && pass == 0 {
                try await capturePreview(game, name: "empire-preview-modern")
            }
            if directory.lastPathComponent == "rivals" && pass == 2 {
                try await capturePreview(game, name: "empire-preview-rivals")
            }
            if directory.lastPathComponent == "eras" && pass == 2 {
                try await capturePreview(game, name: "empire-preview-1914")
            }
            if directory.lastPathComponent == "schoolwork" && pass == 0 {
                try await captureMap(game, name: "schoolwork-regrouping")
            }
            if directory.lastPathComponent == "curriculum" && pass == 2 {
                try await captureMap(game, name: "coordinate-practice")
            }
            if directory.lastPathComponent == "eras" && pass == 1 {
                try await captureMap(game, name: "historical-campaign")
            }
            if directory.lastPathComponent == "lessons" {
                let snapshots = ["lesson-problem", "lesson-review", "lesson-progress"]
                try await captureMap(game, name: snapshots[pass])
            }
            if directory.lastPathComponent == "lessons" && pass == 2 && ProcessInfo.processInfo.environment["DECIMAL_DUNGEON_QA_IMAGES"] != nil {
                _ = try await game.view.evaluateJavaScript("""
                    document.querySelector('dialog.dp-dialog[open]')?.close();
                    document.querySelector('[data-panel=map]').click();
                    """)
                try await captureMap(game, name: "lesson-library")
            }
            if directory.lastPathComponent == "manual-empires" && pass == 1 {
                try await captureMap(game, name: "brazil-manual-frontier")
            }
            if directory.lastPathComponent == "campaign" && pass > 0 {
                try await captureMap(game, name: ["", "captured-border", "renamed-capital", "reopened-border"][pass])
            }
            // An external navigation must be cancelled before WebKit fetches anything.
            _ = try await game.view.evaluateJavaScript("void (location.href = 'https://offline-check.invalid/')")
            try await Task.sleep(nanoseconds: 250_000_000)
            guard game.view.url?.standardizedFileURL.path == entry.standardizedFileURL.path else {
                throw CheckFailure.message("External navigation was allowed.")
            }
            window.contentView = nil
        }
    }

    @MainActor
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        Task { @MainActor in await run() }
        app.run()
    }

    @MainActor
    static func run() async {
        guard CommandLine.arguments.count >= 3 else {
            fputs("Usage: verify-native path/to/index.html path/to/temporary-save [fixture|game|lessons|curriculum|eras|play-tools|battle-music|fraction-clarity] [path/to/application]\n", stderr)
            exit(2)
        }
        let entry = URL(fileURLWithPath: CommandLine.arguments[1])
        let directory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
        if FileManager.default.fileExists(atPath: directory.path),
           (try? FileManager.default.contentsOfDirectory(atPath: directory.path).isEmpty) != true {
            fputs("Use an empty save directory for verification.\n", stderr)
            exit(2)
        }
        let window = TestWindow(contentRect: NSRect(x: 0, y: 0, width: 1160, height: 800),
                              styleMask: [.titled], backing: .buffered, defer: false)
        do {
            if CommandLine.arguments.count > 3 && CommandLine.arguments[3] == "game" {
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("campaign"),
                                         window: window, script: "native-campaign-playthrough.js", passes: 4)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("rivals"),
                                         window: window, script: "native-empire-race.js", passes: 6)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("legacy-work"),
                                         window: window, script: "native-work-migration.js", passes: 3)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("island"),
                                         window: window, script: "native-campaign-playthrough.js", passes: 1)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("practice"),
                                         window: window, script: "native-playthrough.js", passes: 2)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("schoolwork"),
                                         window: window, script: "native-playthrough.js", passes: 2)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("lessons"),
                                         window: window, script: "native-lessons.js", passes: 3)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("curriculum"),
                                         window: window, script: "native-curriculum.js", passes: 4)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("eras"),
                                         window: window, script: "native-eras.js", passes: 3)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("play-tools"),
                                         window: window, script: "native-play-tools.js", passes: 3)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("fraction-clarity"),
                                         window: window, script: "native-play-tools.js", passes: 3)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("battle-music"),
                                         window: window, script: "native-battle-music.js", passes: 3)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("country-profiles"),
                                         window: window, script: "native-country-profiles.js", passes: 2)
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("manual-empires"),
                                         window: window, script: "native-manual-empires.js", passes: 2)
            } else if CommandLine.arguments.count > 3 && CommandLine.arguments[3] == "manual-empires" {
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("manual-empires"),
                                         window: window, script: "native-manual-empires.js", passes: 2)
            } else if CommandLine.arguments.count > 3 && CommandLine.arguments[3] == "profiles" {
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("country-profiles"),
                                         window: window, script: "native-country-profiles.js", passes: 2)
            } else if CommandLine.arguments.count > 3 && CommandLine.arguments[3] == "fraction-clarity" {
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("fraction-clarity"),
                                         window: window, script: "native-play-tools.js", passes: 3)
            } else if CommandLine.arguments.count > 3 && CommandLine.arguments[3] == "battle-music" {
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("battle-music"),
                                         window: window, script: "native-battle-music.js", passes: 3)
            } else if CommandLine.arguments.count > 3 && CommandLine.arguments[3] == "play-tools" {
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("play-tools"),
                                         window: window, script: "native-play-tools.js", passes: 3)
            } else if CommandLine.arguments.count > 3 && CommandLine.arguments[3] == "curriculum" {
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("curriculum"),
                                         window: window, script: "native-curriculum.js", passes: 4)
            } else if CommandLine.arguments.count > 3 && CommandLine.arguments[3] == "eras" {
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("eras"),
                                         window: window, script: "native-eras.js", passes: 3)
            } else if CommandLine.arguments.count > 3 && CommandLine.arguments[3] == "lessons" {
                try await verifyScenario(entry: entry, directory: directory.appendingPathComponent("lessons"),
                                         window: window, script: "native-lessons.js", passes: 3)
            } else {
                try await verifyScenario(entry: entry, directory: directory, window: window, script: nil, passes: 2)
            }
            if CommandLine.arguments.count == 5 {
                let bundle = URL(fileURLWithPath: CommandLine.arguments[4], isDirectory: true)
                try await verifyFinderLaunch(app: bundle, temporaryHome: directory.appendingPathComponent("user"))
            }
            print("Verified bundled loading, offline navigation, Web Crypto and a durable save across fresh WebKit instances.")
            exit(0)
        } catch {
            let detail = (error as NSError).userInfo["WKJavaScriptExceptionMessage"] as? String
            fputs("Native verification failed: \(detail ?? String(describing: error))\n", stderr)
            exit(1)
        }
    }
}
