import AppKit
import Cocoa
import Foundation

let session = URLSession.shared
let url = URL(string: "https://innei.ren/api/v2/fn/ps/update")!

class AppDelegate: NSObject, NSApplicationDelegate {
  let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
  var timer: Timer? = nil
  var isReporting = true

  var apiKey: String? {
    didSet {
      UserDefaults.standard.set(apiKey, forKey: "apiKey")
      startReporting()  // 只有在接收到有效的 apiKey 后才开始上报数据
    }
  }

  override init() {
    super.init()
    self.apiKey = UserDefaults.standard.string(forKey: "apiKey")
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    guard let button = statusItem.button else {
      print("failed to create status item")
      NSApp.terminate(nil)
      return
    }

    // 添加一个 icon，这里仅使用一个简单的文字代替
    button.title = "🚀"

    constructMenu()

    if apiKey != nil {
      startReporting()
    } else {
      promptForAPIKey()
    }

  }

  func startReporting() {
    timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { timer in
      // 发送请求的代码
      print("上报数据")

      debugPrint("apiKey: \(self.apiKey ?? "nil")")

      let workspace = NSWorkspace.shared
      let frontmostApp = workspace.frontmostApplication
      let processName = frontmostApp?.localizedName ?? "未知"

      let timestamp = Date().timeIntervalSince1970

      let postData: [String: Any] = [
        "process": processName,
        "timestamp": timestamp,
        "key": self.apiKey ?? "",
      ]

      var request = URLRequest(url: url)
      request.httpMethod = "POST"
      request.addValue("application/json", forHTTPHeaderField: "Content-Type")
      request.httpBody = try? JSONSerialization.data(withJSONObject: postData)

      let task = session.dataTask(with: request) { (data, response, error) in
        if let error = error {
          debugPrint(postData)
          debugPrint("发生错误：\(error)")
        } else {
          debugPrint("请求成功")
        }
      }

      task.resume()
    }
  }

  func stopReporting() {
    timer?.invalidate()
    timer = nil
  }

  func promptForAPIKey() {
    guard let window = NSApplication.shared.windows.first else {
      print("无法找到窗口")
      NSApp.terminate(nil)
      return
    }

    let alert = NSAlert()
    alert.messageText = "请输入你的 API key"
    alert.alertStyle = .informational
    alert.addButton(withTitle: "确定")
    alert.addButton(withTitle: "取消")

    // 创建一个包含 "🚀" 的 NSImage，并设置为 alert 的图标
    let image = NSImage(size: NSSize(width: 64, height: 64), flipped: false) { rect in
      let attributes = [NSAttributedString.Key.font: NSFont.systemFont(ofSize: 64)]
      let attributedString = NSAttributedString(string: "🚀", attributes: attributes)
      attributedString.draw(in: rect)
      return true
    }
    alert.icon = image

    let textField = NSTextField(frame: NSRect(x: 0, y: 0, width: 200, height: 24))
    textField.stringValue = ""
    textField.isEditable = true
    textField.isEnabled = true
    alert.accessoryView = textField

    alert.beginSheetModal(for: window) { (response) in
      if response == .alertFirstButtonReturn {
        self.apiKey = textField.stringValue
      } else {
        NSApp.terminate(nil)
      }
    }
  }
  func constructMenu() {
    let menu = NSMenu()

    menu.addItem(
      withTitle: isReporting ? "暂停上报" : "开始上报", action: #selector(toggleReporting),
      keyEquivalent: "")
    menu.addItem(NSMenuItem.separator())
    menu.addItem(withTitle: "退出", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "")

    statusItem.menu = menu
  }

  @objc func toggleReporting() {
    if isReporting {
      stopReporting()
    } else {
      startReporting()
    }
    isReporting.toggle()

    // 更新菜单
    constructMenu()
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()

app.delegate = delegate
app.run()
