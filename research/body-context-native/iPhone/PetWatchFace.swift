import SwiftUI
import CollectorCore
import RealityKit
import simd

/// Watch-sized composition, also shown on the phone. All expression ranges are authored poses.
struct PetWatchFace:View {
    @ObservedObject var health:HealthSession
    @Environment(\.scenePhase) private var phase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var reading:HeartReview?
    @State private var epoch:UInt64?
    @State private var greeting=false
    @State private var expression="By reading"
    @State private var turn=CGSize.zero
    @State private var startTurn=CGSize.zero
    @State private var zoom:CGFloat=1
    @State private var startZoom:CGFloat=1
    var body:some View {
        Section("Your companion") {
            TimelineView(.periodic(from:.now,by:1)) { context in
                VStack(spacing:10) {
                    HStack {
                        Text("BODY").font(.caption2).tracking(3).foregroundStyle(.secondary)
                        Spacer()
                        Text(context.date,style:.time).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                    PetMineralScene(bpm:reading?.bpm,greeting:greeting,expression:expression,turn:turn,zoom:zoom)
                        .frame(width:210,height:210)
                        .gesture(DragGesture(minimumDistance:8).onChanged{value in turn=CGSize(width:startTurn.width+value.translation.width*0.3,height:max(-35,min(35,startTurn.height-value.translation.height*0.3)))}.onEnded{_ in startTurn=turn})
                        .simultaneousGesture(MagnifyGesture().onChanged{value in zoom=max(0.8,min(1.2,startZoom*value.magnification))}.onEnded{_ in startZoom=zoom})
                        .onTapGesture(count:2){turn = .zero;startTurn = .zero;zoom=1;startZoom=1}
                        .accessibilityLabel("Warm mineral pet. Character expression is an artistic pose.")
                        .onTapGesture {
                            if reduceMotion { greeting.toggle() }
                            else { withAnimation(.easeOut(duration:0.25)){greeting=true};Task{try? await Task.sleep(nanoseconds:1_200_000_000);withAnimation(.easeOut(duration:0.3)){greeting=false}} }
                        }
                    if let reading {
                        HStack(spacing:5) {
                            Text("Last registered")
                            Text("\(Int(reading.bpm.rounded())) bpm").foregroundStyle(Color(red:0.84,green:0.74,blue:0.6))
                            Text("·")
                            Text(reading.measured,format:.dateTime.hour().minute().second())
                        }.font(.caption2).foregroundStyle(.secondary)
                        Text(reading.measured,style:.relative).font(.caption2).foregroundStyle(.secondary)
                        if context.date.timeIntervalSince(reading.measured)>120 { Text("Last-known pose").font(.caption2).foregroundStyle(.secondary) }
                    } else { Text("Waiting for an available Watch reading").font(.caption2).foregroundStyle(.secondary) }
                    Text("Tap to greet · drag in 3D · pinch to zoom").font(.caption2).foregroundStyle(.secondary)
                }.padding(16).frame(maxWidth:.infinity)
                    .background(Color(red:0.035,green:0.06,blue:0.1),in:RoundedRectangle(cornerRadius:34))
            }
            Picker("Character pose",selection:$expression) {
                Text("By reading").tag("By reading")
                Text("Soft").tag("Soft")
                Text("Curious").tag("Curious")
                Text("Side-eye").tag("Side-eye")
            }
            DisclosureGroup("Inspect reading") {
                if let reading {
                    Text("Measured \(reading.measured.formatted(date:.abbreviated,time:.standard))")
                    Text("Arrived on phone \(reading.received.formatted(date:.omitted,time:.standard))")
                    Text("Before phone arrival: \(Int(reading.deliveryLag.rounded())) seconds")
                    Text(reading.source == "studio.storywalker.watch" ? "Direct Watch feed · temporary pose" : "iPhone Health store · synced evidence")
                }
            }.font(.caption)
            Text("Warm mineral · solid 3D orb and wire study. Expressions are visual choices; they do not describe how you feel.").font(.caption)
        }
        .task(id:RefreshKey(active:phase == .active,revision:health.queueRevision)){
            guard phase == .active else{reading=nil;return}
            while !Task.isCancelled {
                if let queue=health.queue {
                    let snapshot=await queue.snapshot()
                    guard !Task.isCancelled else{return}
                    let deleted=Set(snapshot.pending.filter(\.deletion).compactMap{$0.packet.flatMap{String(data:$0,encoding:.utf8)}})
                    if epoch != snapshot.epoch || snapshot.collection?.enabled != true || reading.map({deleted.contains($0.id)}) == true {reading=nil}
                    epoch=snapshot.epoch
                    if snapshot.collection?.enabled == true,let latest=HeartReview.recent(snapshot,limit:200).first(where:{$0.watchRecorded && $0.measured<=Date()}) {
                        if reading == nil || latest.measured>=reading!.measured {reading=latest}
                    }
                    if snapshot.collection?.enabled == true,let direct=health.watchReading,direct.measured<=Date(),reading == nil || direct.measured>=reading!.measured { reading=direct }
                } else {reading=nil}
                do{try await Task.sleep(nanoseconds:5_000_000_000)}catch{return}
            }
        }
    }
}

private struct RefreshKey:Equatable { let active:Bool;let revision:Int }

/// A non-AR stage: actual meshes, perspective and lights. No camera or world tracking.
private struct PetMineralScene:UIViewRepresentable {
    let bpm:Double?
    let greeting:Bool
    let expression:String
    let turn:CGSize
    let zoom:CGFloat
    func makeCoordinator()->Stage { Stage() }
    func makeUIView(context:Context)->ARView {
        let view=ARView(frame:.zero,cameraMode:.nonAR,automaticallyConfigureSession:false)
        view.environment.background = .color(UIColor(red:0.035,green:0.06,blue:0.1,alpha:1))
        view.renderOptions.insert(.disableMotionBlur)
        context.coordinator.install(in:view)
        return view
    }
    func updateUIView(_ view:ARView,context:Context) {
        context.coordinator.update(bpm:bpm,greeting:greeting,expression:expression,turn:turn,zoom:zoom)
    }
    static func dismantleUIView(_ view:ARView,coordinator:Stage) { view.scene.anchors.removeAll() }
    @MainActor final class Stage {
        let root=Entity(),camera=PerspectiveCamera(),eyes=Entity(),softEyes=Entity()
        let smile=Entity(),curious=Entity(),smirk=Entity()
        var openEyes:[ModelEntity]=[]
        func install(in view:ARView) {
            let anchor=AnchorEntity(world:.zero)
            view.scene.addAnchor(anchor);anchor.addChild(root);anchor.addChild(camera)
            camera.camera.fieldOfViewInDegrees=42
            camera.position=[0,0,3.45]
            let key=DirectionalLight();key.light.color=UIColor(red:1,green:0.78,blue:0.58,alpha:1);key.light.intensity=2200
            key.look(at:.zero,from:[-2,3,4],relativeTo:nil);anchor.addChild(key)
            let fill=PointLight();fill.light.color=UIColor(red:0.64,green:0.59,blue:0.82,alpha:1);fill.light.intensity=1100;fill.light.attenuationRadius=8;fill.position=[2,-1,3];anchor.addChild(fill)
            let rim=PointLight();rim.light.color=UIColor(red:0.83,green:0.64,blue:0.42,alpha:1);rim.light.intensity=1700;rim.position=[-1,1,-2];anchor.addChild(rim)
            let mineral=SimpleMaterial(color:UIColor(red:0.45,green:0.29,blue:0.36,alpha:1),roughness:0.5,isMetallic:true)
            let orb=ModelEntity(mesh:.generateSphere(radius:0.67),materials:[mineral]);root.addChild(orb)
            let wire=SimpleMaterial(color:UIColor(red:0.79,green:0.6,blue:0.38,alpha:1),roughness:0.38,isMetallic:true)
            var paths:[[SIMD3<Float>]]=[]
            // Surface rings are real tubes on a sphere, rather than ellipses on a plane.
            for y:Float in [-0.48,-0.25,0,0.25,0.48] {
                let r=sqrt(0.68*0.68-y*y)
                paths.append((0...64).map{ i in let a=Float(i)*2*Float.pi/64;return [r*cos(a),y,r*sin(a)] })
            }
            for angle:Float in [0,Float.pi/4,Float.pi/2,3*Float.pi/4] {
                paths.append((0...64).map{ i in let a=Float(i)*2*Float.pi/64;return [0.68*cos(a)*cos(angle),0.68*sin(a),0.68*cos(a)*sin(angle)] })
            }
            if let mesh=try? Self.tubes(paths,radius:0.0025) {root.addChild(ModelEntity(mesh:mesh,materials:[wire]))}
            for side:Float in [-1,1] {
                if let mesh=try? Self.shard(side:side) {
                    let fin=ModelEntity(mesh:mesh,materials:[SimpleMaterial(color:UIColor(red:0.4,green:0.26,blue:0.29,alpha:1),roughness:0.65,isMetallic:false)])
                    root.addChild(fin)
                }
            }
            for index in 0..<8 {
                let a=Float(index)*Float.pi/4
                let antenna=ModelEntity(mesh:.generateSphere(radius:1),materials:[wire])
                antenna.scale=[0.007,0.0425,0.007]
                antenna.position=[sin(a)*0.9,cos(a)*0.9,0]
                antenna.orientation=simd_quatf(angle:-a,axis:[0,0,1]);root.addChild(antenna)
            }
            let face=UnlitMaterial(color:UIColor(red:1,green:0.88,blue:0.66,alpha:1))
            for x:Float in [-0.19,0.19] {
                let eye=ModelEntity(mesh:.generateSphere(radius:1),materials:[face])
                eye.position=[x,0.045,sqrt(0.69*0.69-x*x)];eye.scale=[0.024,0.066,0.019]
                eyes.addChild(eye);openEyes.append(eye)
                let path=(0...16).map{ i -> SIMD3<Float> in let t=Float(i)/16;let xx=x+(t-0.5)*0.1;let y=0.04-0.028*sin(t*Float.pi);return [xx,y,sqrt(0.69*0.69-xx*xx-y*y)] }
                if let mesh=try? Self.tubes([path],radius:0.008) {softEyes.addChild(ModelEntity(mesh:mesh,materials:[face]))}
            }
            let grin=(0...20).map{ i -> SIMD3<Float> in let t=Float(i)/20;let x=(t-0.5)*0.15;let y = -0.16-0.045*sin(t*Float.pi);return [x,y,sqrt(0.69*0.69-x*x-y*y)] }
            let oh=(0...32).map{ i -> SIMD3<Float> in let a=Float(i)*2*Float.pi/32;let x=0.033*cos(a);let y = -0.17+0.048*sin(a);return [x,y,sqrt(0.69*0.69-x*x-y*y)] }
            let aside:[SIMD3<Float>]=[[-0.06,-0.17,0.67],[0.06,-0.15,0.675]]
            for (entity,path) in [(smile,grin),(curious,oh),(smirk,aside)] {
                if let mesh=try? Self.tubes([path],radius:0.006) {entity.addChild(ModelEntity(mesh:mesh,materials:[face]))}
                root.addChild(entity)
            }
            root.addChild(eyes);root.addChild(softEyes)
        }
        func update(bpm:Double?,greeting:Bool,expression:String,turn:CGSize,zoom:CGFloat) {
            let soft=greeting || expression == "Soft" || (expression == "By reading" && bpm.map{$0<80} == true)
            let inquisitive = !greeting && (expression == "Curious" || (expression == "By reading" && bpm.map{$0>=120} == true))
            eyes.isEnabled = !soft;softEyes.isEnabled=soft
            smile.isEnabled = !inquisitive && (expression != "Side-eye" || greeting)
            curious.isEnabled=inquisitive;smirk.isEnabled = expression == "Side-eye" && !greeting
            for (i,eye) in openEyes.enumerated() {
                eye.scale=[0.024,expression == "Side-eye" && i == 1 ? 0.026 : bpm.map{$0>=160} == true ? 0.085:0.066,0.019]
            }
            let yaw=Float(turn.width)*Float.pi/180-0.2,pitch=Float(turn.height)*Float.pi/180-0.12
            root.orientation=simd_quatf(angle:0.13,axis:[0,0,1])*simd_quatf(angle:yaw,axis:[0,1,0])*simd_quatf(angle:pitch,axis:[1,0,0])
            root.scale=[1,1.08,1]
            camera.position=[0,0,3.45/Float(zoom)]
        }
        static func tubes(_ paths:[[SIMD3<Float>]],radius:Float)throws->MeshResource {
            var positions:[SIMD3<Float>]=[],normals:[SIMD3<Float>]=[],indices:[UInt32]=[]
            let sides=6
            for path in paths where path.count>=2 {
                let base=positions.count
                for i in path.indices {
                    let tangent=simd_normalize(path[min(i+1,path.count-1)]-path[max(0,i-1)])
                    let reference:SIMD3<Float>=abs(tangent.y)>0.9 ? [1,0,0]:[0,1,0]
                    let u=simd_normalize(simd_cross(tangent,reference)),v=simd_cross(tangent,u)
                    for j in 0..<sides {
                        let a=Float(j)*2*Float.pi/Float(sides),n=u*cos(a)+v*sin(a)
                        positions.append(path[i]+radius*n);normals.append(n)
                    }
                }
                for i in 0..<(path.count-1) { for j in 0..<sides {
                    let a=UInt32(base+i*sides+j),b=UInt32(base+i*sides+(j+1)%sides),c=a+UInt32(sides),d=b+UInt32(sides)
                    indices += [a,b,c,b,d,c]
                }}
            }
            var descriptor=MeshDescriptor(name:"mineral-wire")
            descriptor.positions=MeshBuffers.Positions(positions);descriptor.normals=MeshBuffers.Normals(normals);descriptor.primitives = .triangles(indices)
            return try MeshResource.generate(from:[descriptor])
        }
        static func shard(side:Float)throws->MeshResource {
            let vertices:[SIMD3<Float>]=[[side*0.49,-0.26,0],[side*0.94,0.34,-0.08],[side*0.55,0.43,0.02],[side*0.68,0.06,0.2]]
            var positions:[SIMD3<Float>]=[],normals:[SIMD3<Float>]=[],indices:[UInt32]=[]
            let center=vertices.reduce(SIMD3<Float>.zero,+)/4
            for face in [[0,1,2],[0,3,1],[1,3,2],[2,3,0]] {
                var a=vertices[face[0]],b=vertices[face[1]],c=vertices[face[2]]
                if simd_dot(simd_cross(b-a,c-a),(a+b+c)/3-center)<0 {swap(&a,&b)}
                let n=simd_normalize(simd_cross(b-a,c-a)),base=UInt32(positions.count)
                positions += [a,b,c];normals += [n,n,n];indices += [base,base+1,base+2]
            }
            var descriptor=MeshDescriptor(name:"solid-shard")
            descriptor.positions=MeshBuffers.Positions(positions);descriptor.normals=MeshBuffers.Normals(normals);descriptor.primitives = .triangles(indices)
            return try MeshResource.generate(from:[descriptor])
        }
    }
}
