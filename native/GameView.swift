import AppKit
import WebKit

/// Small, synchronous storage API for the bundled game. Each successful mutation
/// has reached disk before the page resumes, even if the player quits immediately.
final class SaveStore {
    let file: URL
    private var values: [String: String]

    init(directory: URL) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        file = directory.appendingPathComponent("progress.plist")
        if FileManager.default.fileExists(atPath: file.path) {
            values = try PropertyListDecoder().decode([String: String].self, from: Data(contentsOf: file))
        } else {
            values = [:]
        }
    }

    func perform(_ command: [String: String]) throws -> String? {
        switch (command["op"], command["key"], command["value"]) {
        case ("get", let key?, _):
            return values[key]
        case ("set", let key?, let value?):
            var updated = values
            updated[key] = value
            try save(updated)
        case ("remove", let key?, _):
            var updated = values
            updated.removeValue(forKey: key)
            try save(updated)
        case ("clear", _, _):
            try save([:])
        default:
            throw CocoaError(.coderInvalidValue)
        }
        return nil
    }

    private func save(_ updated: [String: String]) throws {
        let data = try PropertyListEncoder().encode(updated)
        try data.write(to: file, options: .atomic)
        values = updated
    }
}

// Bundled profiles can cite a small set of educational publishers. WebKit stays on the
// local game page; only a real pointer or keyboard activation may open a system browser.
@MainActor
private final class CountrySourceLinks: NSObject, WKScriptMessageHandler {
    private static let hosts: Set<String> = [
        "data.worldbank.org", "databank.worldbank.org", "icr.ethz.ch",
        "correlatesofwar.org", "unstats.un.org", "data.un.org", "whc.unesco.org",
        "www.vaticanstate.va", "unfccc.int", "www.rug.nl", "www.naturalearthdata.com",
        "www.si.edu", "emuseum.nyhistory.org", "www.gov.uk", "www.elysee.fr", "www.bundestag.de",
        "english.president.gov.tw", "www.aboutswitzerland.eda.admin.ch", "www.gob.cl", "denmark.dk",
        "www.stortinget.no", "www.pmc.gov.au", "nzhistory.govt.nz", "www.gov.ie", "eli.gov.pl",
        "finland.fi", "www.riigikantselei.ee", "www.presidencia.pt", "www.mofa.gov.lr"
    ]
    private let entry: URL
    private let open: (URL) -> Void

    init(entry: URL, open: @escaping (URL) -> Void) {
        self.entry = entry
        self.open = open
    }

    func install(in controller: WKUserContentController) {
        // The page cannot post messages into this isolated script world.
        controller.add(self, contentWorld: .defaultClient, name: "countrySource")
        let script = """
        window.addEventListener('click', event => {
          if (!event.isTrusted || event.defaultPrevented || event.button !== 0) return;
          const anchor = event.target.closest?.('[data-country-profile] a[href]');
          if (!anchor || anchor.protocol !== 'https:') return;
          event.preventDefault();
          window.webkit.messageHandlers.countrySource.postMessage(anchor.href);
        });
        """
        controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart,
                                              forMainFrameOnly: true, in: .defaultClient))
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let frame = message.frameInfo
        guard frame.isMainFrame, let page = frame.request.url, page.isFileURL,
              page.standardizedFileURL.path == entry.path,
              let value = message.body as? String, let url = URL(string: value),
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme?.lowercased() == "https", parts.user == nil, parts.password == nil,
              parts.port == nil || parts.port == 443,
              let host = parts.host?.lowercased(), Self.hosts.contains(host) else { return }
        open(url)
    }
}

@MainActor
final class GameView: NSObject, WKUIDelegate, WKNavigationDelegate {
    let view: WKWebView
    private let store: SaveStore
    private let entry: URL
    private(set) var loaded = false
    var onFailure: ((String) -> Void)?

    init(entry: URL, store: SaveStore, openSource: @escaping (URL) -> Void = { _ = NSWorkspace.shared.open($0) }) {
        self.entry = entry.standardizedFileURL
        self.store = store
        let configuration = WKWebViewConfiguration()
        // This window loads only bundled content. The game's separately saved Music
        // switch controls its score, including resuming that choice on the next launch.
        configuration.mediaTypesRequiringUserActionForPlayback = []

        configuration.websiteDataStore = .nonPersistent()
        CountrySourceLinks(entry: self.entry, open: openSource).install(in: configuration.userContentController)
        let script = """
        (() => {
          const call = (op, key, value) => {
            const reply = JSON.parse(window.prompt("DecimalDungeon.Storage.v1", JSON.stringify({ op, key, value })));
            if (!reply || !reply.ok) throw new Error("Game progress could not be saved on this Mac.");
            return reply.value ?? null;
          };
          const api = Object.freeze({
            getItem: key => call("get", String(key)),
            setItem: (key, value) => { call("set", String(key), String(value)); },
            removeItem: key => { call("remove", String(key)); },
            clear: () => { call("clear"); }
          });
          Object.defineProperty(window, "DungeonNativeStorage", { value: api });
        })();
        """
        configuration.userContentController.addUserScript(WKUserScript(
            source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true
        ))
        view = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        view.uiDelegate = self
        view.navigationDelegate = self
        view.allowsBackForwardNavigationGestures = false
    }

    func flushForQuit(_ completion: @escaping @MainActor () -> Void) {
        guard loaded else { completion(); return }
        // Input is saved synchronously. This last dispatch also checkpoints the
        // fraction of a second of foreground battle time since the last heartbeat.
        view.evaluateJavaScript("window.dispatchEvent(new Event('dungeon-suspend'))") { _, _ in completion() }
    }

    func start() {
        loaded = false
        view.loadFileURL(entry, allowingReadAccessTo: entry.deletingLastPathComponent())
    }

    private func isEntry(_ url: URL?) -> Bool {
        guard let url, url.isFileURL else { return false }
        return url.standardizedFileURL.path == entry.path
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        decisionHandler(action.targetFrame?.isMainFrame == true && isEntry(action.request.url) ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { onFailure?(error.localizedDescription) }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { onFailure?(error.localizedDescription) }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        start()
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping @MainActor @Sendable (String?) -> Void) {
        guard frame.isMainFrame, isEntry(frame.request.url), prompt == "DecimalDungeon.Storage.v1" else {
            completionHandler(nil)
            return
        }
        do {
            let input = Data((defaultText ?? "").utf8)
            let command = try JSONDecoder().decode([String: String].self, from: input)
            let value = try store.perform(command)
            var result: [String: Any] = ["ok": true]
            if let value { result["value"] = value }
            let json = try JSONSerialization.data(withJSONObject: result)
            completionHandler(String(decoding: json, as: UTF8.self))
        } catch {
            completionHandler(#"{"ok":false}"#)
            onFailure?("Your progress could not be read or written. " + error.localizedDescription)
        }
    }
}
