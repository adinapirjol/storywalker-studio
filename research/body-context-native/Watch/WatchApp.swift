import SwiftUI
import HealthKit
import WatchConnectivity

/// Explicit Author choice; never inferred from heart rate or motion.
private enum PetSessionActivity: String, CaseIterable, Identifiable {
    case meditation = "Meditation"
    case walking = "Walking"
    case running = "Running"
    case cycling = "Indoor cycling"

    var id: String { rawValue }
    var actionName: String { rawValue.lowercased() }
    var healthKitType: HKWorkoutActivityType {
        switch self {
        case .meditation: return .mindAndBody
        case .walking: return .walking
        case .running: return .running
        case .cycling: return .cycling
        }
    }
}

@main struct StorywalkerWatchApp:App {
    @StateObject private var model=WatchCollector()
    var body:some Scene { WindowGroup { WatchPetScreen(model:model) } }
}

@MainActor private final class WatchCollector:NSObject,ObservableObject,WCSessionDelegate,HKWorkoutSessionDelegate,HKLiveWorkoutBuilderDelegate {
    @Published private(set) var signal:WatchSignal?
    @Published private(set) var status="Start readings when you want to connect your pet."
    @Published private(set) var delivery="Phone feed off."
    @Published private(set) var reading=false
    @Published private(set) var working=false
    @Published private(set) var workoutActive=false
    @Published var activity: PetSessionActivity = .meditation
    @Published private(set) var activeActivity: PetSessionActivity?
    private let store=HKHealthStore()
    private var observer:HKObserverQuery?
    private var latestQuery:HKSampleQuery?
    private var workout:HKWorkoutSession?
    private var builder:HKLiveWorkoutBuilder?
    private var epoch=0
    private var inFlight=false
    private var lastSent:String?
    private var lastContact=Date.distantPast
    override init() {
        super.init()
        if WCSession.isSupported(){WCSession.default.delegate=self;WCSession.default.activate()}
    }
    private var heart:HKQuantityType {HKObjectType.quantityType(forIdentifier:.heartRate)!}
    func startReadings() async {
        guard !working else{return};working=true;defer{working=false}
        do {
            try await store.requestAuthorization(toShare:[],read:[heart])
            reading=true;epoch += 1;installObserver();checkLatest()
            status="Watching available Health readings. Background intervals vary."
        }catch{status="Health request unavailable. Check Watch permissions."}
    }
    private func installObserver() {
        guard observer == nil else{return}
        let query=HKObserverQuery(sampleType:heart,predicate:nil){[weak self] _,done,_ in
            Task { @MainActor in self?.checkLatest();done() }
        }
        observer=query;store.execute(query)
        // No background entitlement or fake workout: ordinary sampling remains system controlled.
    }
    func checkLatest() {
        guard reading,!workoutActive,latestQuery == nil else{return}
        let token=epoch
        let query=HKSampleQuery(sampleType:heart,predicate:HKQuery.predicateForSamples(withStart:Date().addingTimeInterval(-120),end:nil,options:.strictStartDate),limit:1,sortDescriptors:[NSSortDescriptor(key:HKSampleSortIdentifierStartDate,ascending:false)]){[weak self] _,samples,error in
            Task { @MainActor in
                guard let self else{return};self.latestQuery=nil
                guard self.reading,self.epoch==token else{return}
                guard error == nil,let sample=samples?.first as? HKQuantitySample else {
                    self.status="Waiting for a new Watch reading; read permission cannot be inferred.";return
                }
                self.receive(bpm:sample.quantity.doubleValue(for:HKUnit.count().unitDivided(by:.minute())),measured:sample.startDate,origin:"watch-health",id:sample.uuid.uuidString)
            }
        }
        latestQuery=query;store.execute(query)
    }
    private func receive(bpm:Double,measured:Date,origin:String,id:String=UUID().uuidString) {
        guard reading,measured<=Date(),Date().timeIntervalSince(measured)<=120,
              signal == nil || measured>signal!.measured else{return}
        let next=WatchSignal(id:id,bpm:bpm,measured:measured,origin:origin)
        guard (try? WatchSignal.decode(next.encoded())) != nil else{return}
        signal=next
        status=workoutActive
            ? "\(activeActivity?.rawValue ?? "Session") reading · live builder"
            : "Watch Health reading · latest available"
        pushLatest()
    }
    func pushLatest() {
        guard reading,let signal,Date().timeIntervalSince(signal.measured)<=120 else{delivery="Waiting for a fresh Watch reading.";return}
        let session=WCSession.default
        guard session.activationState == .activated,session.isReachable else{delivery="Phone unreachable. Pet stays on this Watch; no stale replay.";return}
        guard !inFlight,signal.id != lastSent,Date().timeIntervalSince(lastContact)>=0.5,let data=try? signal.encoded() else{return}
        inFlight=true;lastContact=Date();let token=epoch,id=signal.id
        session.sendMessageData(data,replyHandler:{[weak self] response in
            Task { @MainActor in
                guard let self else{return};self.inFlight=false
                guard self.epoch==token,self.reading else{return}
                if response == Data("received".utf8){self.lastSent=id;self.delivery="Received by phone · Mac feed is separate."}
                else{self.delivery="Phone not collecting. Start selected collection there."}
                if self.signal?.id != id{self.pushLatest()}
            }
        },errorHandler:{[weak self] _ in
            Task { @MainActor in self?.inFlight=false;guard self?.epoch==token else{return};self?.delivery="Phone connection interrupted. Latest fresh reading retries on reconnect." }
        })
    }
    func startSession() async {
        guard !working,workout == nil else{return};working=true;defer{working=false}
        let chosenActivity = activity
        do {
            try await store.requestAuthorization(toShare:[HKObjectType.workoutType()],read:[heart])
            let config=HKWorkoutConfiguration()
            config.activityType=chosenActivity.healthKitType
            config.locationType = .indoor
            let session=try HKWorkoutSession(healthStore:store,configuration:config)
            let live=session.associatedWorkoutBuilder()
            live.dataSource=HKLiveWorkoutDataSource(healthStore:store,workoutConfiguration:config)
            live.delegate=self;session.delegate=self;workout=session;builder=live
            reading=true;epoch += 1;activeActivity=chosenActivity;workoutActive=true
            if let latestQuery{store.stop(latestQuery)};latestQuery=nil
            let start=Date();session.startActivity(with:start)
            try await live.beginCollection(at:start)
            status="\(chosenActivity.rawValue) active. End it when your session ends."
        }catch {
            workout?.end();builder?.discardWorkout();workout=nil;builder=nil;workoutActive=false;activeActivity=nil
            status="\(chosenActivity.rawValue) could not start. No active session retained."
            if reading { installObserver();checkLatest() }
        }
    }
    func endSession() {workout?.end();status="Finishing \(activeActivity?.actionName ?? "session")…"}
    func stopReadings() {
        reading=false;epoch += 1;signal=nil;lastSent=nil
        if let observer{store.stop(observer)};observer=nil
        if let latestQuery{store.stop(latestQuery)};latestQuery=nil
        if workout != nil{endSession()}
        delivery="Phone feed off.";status="Readings stopped. Apple Health records retained."
    }
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder:HKLiveWorkoutBuilder) {}
    nonisolated func workoutBuilder(_ workoutBuilder:HKLiveWorkoutBuilder,didCollectDataOf collectedTypes:Set<HKSampleType>) {
        Task { @MainActor [weak self] in
            guard let self,self.workoutActive,self.builder === workoutBuilder,collectedTypes.contains(self.heart),
                  let statistics=workoutBuilder.statistics(for:self.heart),let quantity=statistics.mostRecentQuantity(),let dates=statistics.mostRecentQuantityDateInterval() else{return}
            self.receive(bpm:quantity.doubleValue(for:HKUnit.count().unitDivided(by:.minute())),measured:dates.end,origin:"watch-workout")
        }
    }
    nonisolated func workoutSession(_ workoutSession:HKWorkoutSession,didChangeTo toState:HKWorkoutSessionState,from fromState:HKWorkoutSessionState,date:Date) {
        guard toState == .ended else{return}
        Task { @MainActor [weak self] in
            guard let self,self.workout === workoutSession,let live=self.builder else{return}
            let name=self.activeActivity?.rawValue ?? "Session"
            self.working=true;self.workoutActive=false
            do {
                try await live.endCollection(at:date)
                _ = try await live.finishWorkout()
                let nextState = self.reading ? "Ordinary sampling resumed." : "Pet readings stopped."
                self.status="\(name) saved to Apple Health. \(nextState)"
            }
            catch{live.discardWorkout();self.status="\(name) save failed. Check Apple Health before relying on its record."}
            self.builder=nil;self.workout=nil;self.activeActivity=nil;self.working=false
            if self.reading{self.installObserver();self.checkLatest()}
        }
    }
    nonisolated func workoutSession(_ workoutSession:HKWorkoutSession,didFailWithError error:Error) {
        Task { @MainActor [weak self] in
            guard let self,self.workout === workoutSession else{return}
            let name=self.activeActivity?.rawValue ?? "Session"
            self.builder?.discardWorkout();self.builder=nil;self.workout=nil;self.workoutActive=false;self.activeActivity=nil;self.working=false
            self.status="\(name) interrupted. Check the Watch and reopen the app."
            if self.reading { self.installObserver();self.checkLatest() }
        }
    }
    nonisolated func session(_ session:WCSession,activationDidCompleteWith activationState:WCSessionActivationState,error:Error?) {Task { @MainActor [weak self] in self?.pushLatest() }}
    nonisolated func sessionReachabilityDidChange(_ session:WCSession) {Task { @MainActor [weak self] in self?.pushLatest() }}
}

private struct WatchPetScreen:View {
    @ObservedObject var model:WatchCollector
    @Environment(\.scenePhase) private var phase
    @State private var turn=0.0
    @State private var greeting=false
    @State private var rotating=false
    var body:some View {
        ScrollView {
            VStack(spacing:8) {
                Text("BODY").font(.caption2).tracking(3).foregroundStyle(.secondary)
                WatchMineralPet(bpm:model.signal?.bpm,turn:turn,greeting:greeting)
                    .frame(height:145).contentShape(Rectangle())
                    .onTapGesture{greeting.toggle()}
                    .accessibilityLabel("Mineral pet. Tap to greet.")
                    .accessibilityHint("Swipe to scroll. Use Rotate pet to turn the companion.")
                WatchSessionControls(model:model)
                Button("Rotate pet"){rotating=true}
                TimelineView(.periodic(from:.now,by:1)){context in
                    if let signal=model.signal {
                        Text("\(Int(signal.bpm.rounded())) bpm · \(signal.measured.formatted(date:.omitted,time:.standard))").font(.system(size:10)).foregroundStyle(.secondary)
                        Text(context.date.timeIntervalSince(signal.measured)>120 ? "Last-known pose":"Last registered Watch reading").font(.system(size:10)).foregroundStyle(.secondary)
                    }else{Text("Waiting for a reading").font(.caption2).foregroundStyle(.secondary)}
                }
                Text(model.status).font(.caption2)
                Text(model.delivery).font(.caption2).foregroundStyle(.secondary)
                if !model.reading {Button("Start pet readings"){Task{await model.startReadings()}}.disabled(model.working)}
                else {Button("Check available reading"){model.checkLatest();model.pushLatest()}.disabled(model.working)}
                if model.reading {Button("Stop pet readings",role:.destructive){model.stopReadings()}}
                Text("Personal companion · artistic expressions, not health or emotion labels. Direct phone messages need reachability; cellular alone does not connect to your Mac.").font(.system(size:10)).foregroundStyle(.secondary)
            }
        }.background(Color(red:0.035,green:0.06,blue:0.1))
         .sheet(isPresented:$rotating){WatchPetRotation(bpm:model.signal?.bpm,turn:$turn,greeting:$greeting)}
         .onChange(of:phase){_,value in if value == .active{model.checkLatest();model.pushLatest()}}
    }
}

private struct WatchSessionControls: View {
    @ObservedObject var model: WatchCollector

    var body: some View {
        VStack(spacing: 6) {
            if model.workoutActive {
                Button("End \(model.activeActivity?.actionName ?? "session")", role: .destructive) {
                    model.endSession()
                }
            } else {
                Picker("Session", selection: $model.activity) {
                    ForEach(PetSessionActivity.allCases) { activity in
                        Text(activity.rawValue).tag(activity)
                    }
                }
                Button("Start \(model.activity.actionName)") {
                    Task { await model.startSession() }
                }
                Text(model.activity == .meditation
                     ? "For your meditation practice. Saved as Mind and Body in Apple Health; uses more battery."
                     : "For your actual activity. Saved to Apple Health; uses more battery.")
                    .font(.system(size: 10)).foregroundStyle(.secondary)
            }
        }.disabled(model.working)
    }
}

/// Dragging belongs in this explicit view, never in the scrolling readings page.
private struct WatchPetRotation:View {
    let bpm:Double?
    @Binding var turn:Double
    @Binding var greeting:Bool
    @Environment(\.dismiss) private var dismiss
    @GestureState private var dragTurn=0.0
    var body:some View {
        VStack(spacing:6) {
            WatchMineralPet(bpm:bpm,turn:turn+dragTurn,greeting:greeting)
                .frame(maxWidth:.infinity,maxHeight:.infinity)
                .contentShape(Rectangle())
                .gesture(DragGesture()
                    .updating($dragTurn){value,offset,_ in offset=Double(value.translation.width)/100}
                    .onEnded{value in turn=(turn+Double(value.translation.width)/100).truncatingRemainder(dividingBy:2 * .pi)})
                .onTapGesture{greeting.toggle()}
                .accessibilityLabel("Mineral pet. Drag to turn; tap to greet.")
                .accessibilityAdjustableAction{direction in
                    switch direction {
                    case .increment:turn += .pi/8
                    case .decrement:turn -= .pi/8
                    @unknown default:break
                    }
                }
            HStack {
                Button("Reset"){turn=0}
                Button("Done"){dismiss()}
            }
        }.padding(.horizontal,4).background(Color(red:0.035,green:0.06,blue:0.1))
    }
}
