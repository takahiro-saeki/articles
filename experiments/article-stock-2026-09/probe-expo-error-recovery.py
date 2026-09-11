"""Compile expo-updates' exact Swift recovery class on macOS with explicit stubs.

The React bridge, update database, downloader and relaunch are test doubles.
The original task pipeline, DispatchQueue and timers execute unchanged. No EAS
account, phone or app data is accessed. Error logs go into a temporary directory.
"""
import hashlib,json,os,pathlib,subprocess,tempfile,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'production/2026-09/batch-07'
PKG=ROOT.parent/'voice-training-log/apps/mobile/node_modules/expo-updates'
source=(PKG/'ios/EXUpdates/ErrorRecovery.swift').read_bytes()
version=json.loads((PKG/'package.json').read_text())['version']
assert version=='29.0.18'
# Official package gitHead from npm view expo-updates@29.0.18 gitHead.
# Compare source bytes instead of assuming installed node_modules is original.
commit='45c60e10956764bbac6c62454890eeb25c74bbd6'
url=f'https://raw.githubusercontent.com/expo/expo/{commit}/packages/expo-updates/ios/EXUpdates/ErrorRecovery.swift'
remote=urllib.request.urlopen(url).read()
assert source==remote
react='''import Foundation
public typealias RCTFatalHandler = (NSError?) -> Void
public typealias RCTFatalExceptionHandler = (NSException?) -> Void
private var fatal: RCTFatalHandler?
private var fatalException: RCTFatalExceptionHandler?
public func RCTGetFatalHandler() -> RCTFatalHandler? { fatal }
public func RCTSetFatalHandler(_ value: RCTFatalHandler?) { fatal = value }
public func RCTGetFatalExceptionHandler() -> RCTFatalExceptionHandler? { fatalException }
public func RCTSetFatalExceptionHandler(_ value: RCTFatalExceptionHandler?) { fatalException = value }
public let RCTFatalExceptionName = "TestFatal"
public let RCTJSStackTraceKey = "TestJSStack"
public func RCTFormatError(_ message: String, _ stack: [[String:Any]]?, _ limit: Int) -> String { message }
public extension NSNotification.Name {
  static let RCTJavaScriptDidFailToLoad = NSNotification.Name("TestFailedLoad")
  static let RCTContentDidAppear = NSNotification.Name("TestContentAppeared")
}
'''
stubs='''import Foundation
public enum CheckOnLaunch { case Always, Never }
public final class UpdatesConfig: NSObject { var checkOnLaunch = CheckOnLaunch.Always }
public final class Update: NSObject { var successfulLaunchCount = 0 }
public enum UpdatesErrorCode { case unknown, updateFailedToLoad, jsRuntimeError }
public enum UpdatesError: Error {
  case errorRecoveryCrashing
  case errorRecoveryFatalException(serializedError: String)
  case errorRecoveryCouldNotWriteToLog(cause: Error)
}
public final class UpdatesLogger: NSObject {
  var messages: [String] = []
  func info(message: String) { messages.append(message) }
  func warn(message: String, code: UpdatesErrorCode) {}
  func error(cause: UpdatesError, code: UpdatesErrorCode? = nil) {}
}
enum UpdatesUtils {
  static func updatesApplicationDocumentsDirectory() -> URL { URL(fileURLWithPath:CommandLine.arguments[1]) }
}
internal extension Array where Element: Equatable {
  mutating func remove(_ element: Element) {
    if let index = firstIndex(of: element) {
      remove(at: index)
    }
  }
}
'''
main='''import Foundation
import React
final class Delegate: ErrorRecoveryDelegate {
  let config = UpdatesConfig()
  var remoteLoadStatus = RemoteLoadStatus.Idle
  let update = Update()
  var relaunchSuccess = true
  var actions: [String] = []
  let relaunched = DispatchSemaphore(value:0)
  func launchedUpdate() -> Update? { update }
  func relaunch(completion: @escaping (Error?,Bool)->Void) { actions.append("relaunch"); completion(nil,relaunchSuccess); relaunched.signal() }
  func loadRemoteUpdate() { actions.append("download") }
  func markFailedLaunchForLaunchedUpdate() { actions.append("markFailed") }
  func markSuccessfulLaunchForLaunchedUpdate() { actions.append("markSuccessful");update.successfulLaunchCount += 1 }
  func throwException(_ exception: NSException) { actions.append("crash") }
}
let specs: [(String,Bool,Int,RemoteLoadStatus,CheckOnLaunch,Bool,[String])] = [
  ("before-new-ready",false,0,.NewUpdateLoaded,.Always,true,["markFailed","relaunch"]),
  ("before-no-remote-cached-works",false,0,.Idle,.Never,true,["markFailed","relaunch"]),
  ("before-no-remote-relaunch-fails",false,0,.Idle,.Never,false,["markFailed","relaunch","crash"]),
  ("content-appeared-new-ready",true,0,.NewUpdateLoaded,.Always,true,["markSuccessful","crash"]),
  ("prior-success-no-remote",false,1,.Idle,.Never,true,["crash"]),
  ("prior-success-new-ready",false,1,.NewUpdateLoaded,.Always,true,["relaunch"]),
  ("before-remote-timeout",false,0,.Idle,.Always,true,["markFailed","download","relaunch"])
]
var records: [[String:Any]] = []
for (name,appeared,previous,status,check,relaunch,expected) in specs {
  let queue = DispatchQueue(label:"article.recovery."+name)
  let logger = UpdatesLogger()
  let recovery = ErrorRecovery(logger:logger,errorRecoveryQueue:queue,remoteLoadTimeout:5000)
  let delegate = Delegate()
  delegate.remoteLoadStatus=status;delegate.config.checkOnLaunch=check
  delegate.update.successfulLaunchCount=previous;delegate.relaunchSuccess=relaunch
  recovery.delegate=delegate
  if appeared {
    recovery.startMonitoring();queue.sync {}
    NotificationCenter.default.post(name:.RCTContentDidAppear,object:nil)
    queue.sync {}
  }
  let start=DispatchTime.now().uptimeNanoseconds
  recovery.handle(error:NSError(domain:"article-fixture",code:1))
  for _ in 0..<10 { queue.sync {} }
  if name == "before-remote-timeout" {
    _ = delegate.relaunched.wait(timeout: .now()+15)
    for _ in 0..<10 { queue.sync {} }
  }
  precondition(delegate.actions == expected, "Unexpected actions: \\(name) \\(delegate.actions)")
  records.append(["case":name,"actions":delegate.actions,"pipelineLogs":logger.messages,"expected":expected,"passed":delegate.actions == expected,"observedElapsedMs":Double(DispatchTime.now().uptimeNanoseconds-start)/1_000_000])
}
print(String(data:try! JSONSerialization.data(withJSONObject:records,options:[.sortedKeys]),encoding:.utf8)!)
'''
with tempfile.TemporaryDirectory(prefix='article-expo-swift-') as tmp:
    p=pathlib.Path(tmp)
    for name,code in [('React.swift',react),('Stubs.swift',stubs),('main.swift',main)]: (p/name).write_text(code)
    (p/'ErrorRecovery.swift').write_bytes(source)
    def run(args,**kw): return subprocess.check_output(args,cwd=p,text=True,stderr=subprocess.STDOUT,**kw)
    try:
        run(['swiftc','-swift-version','5','-emit-library','-emit-module','-module-name','React','React.swift','-o','libReact.dylib'])
        run(['swiftc','-swift-version','5','-I',tmp,'-L',tmp,'-lReact','ErrorRecovery.swift','Stubs.swift','main.swift','-o','probe'])
        cases=json.loads(run([str(p/'probe'),tmp],env={**os.environ,'DYLD_LIBRARY_PATH':tmp}))
    except subprocess.CalledProcessError as e: print(e.output);raise
    result={'packageVersion':version,'sourceURL':url,'sourceSHA256':hashlib.sha256(source).hexdigest(),'swift':run(['swiftc','--version']).strip(),'scope':'original iOS Swift pipeline compiled on macOS; bridge/storage/network/relaunch stubbed; actual DispatchQueue and 5000ms timer; not an iOS end-to-end update test','cases':cases}
    (OUT/'expo-error-recovery.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    assert all(x["passed"] for x in cases)
