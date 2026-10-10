import SwiftUI

/// Lightweight Watch renderer: perspective-projected wires and fins retain volume as they turn.
struct WatchMineralPet:View {
    let bpm:Double?
    let turn:Double
    let greeting:Bool
    private let wire=Color(red:0.79,green:0.6,blue:0.38)
    var body:some View {
        Canvas { context,size in
            let scale=min(size.width,size.height)*0.43,center=CGPoint(x:size.width/2,y:size.height/2)
            func project(_ x:Double,_ y:Double,_ z:Double)->(CGPoint,Double) {
                let a=turn-0.18,xx=x*cos(a)+z*sin(a),zz = -x*sin(a)+z*cos(a),p=3/(3-zz)
                return (CGPoint(x:center.x+xx*scale*p,y:center.y-y*scale*p),zz)
            }
            for side in [-1.0,1.0] {
                let points=[project(side*0.48,-0.24,0).0,project(side*0.96,0.38,-0.08).0,project(side*0.55,0.43,0.13).0]
                var fin=Path();fin.addLines(points);fin.closeSubpath()
                context.fill(fin,with:.linearGradient(Gradient(colors:[Color(red:0.5,green:0.33,blue:0.36),Color(red:0.24,green:0.16,blue:0.22)]),startPoint:points[2],endPoint:points[1]))
            }
            let rect=CGRect(x:center.x-scale*0.67,y:center.y-scale*0.72,width:scale*1.34,height:scale*1.44)
            context.fill(Path(ellipseIn:rect),with:.radialGradient(Gradient(colors:[Color(red:0.8,green:0.56,blue:0.39),Color(red:0.47,green:0.31,blue:0.4),Color(red:0.17,green:0.14,blue:0.23)]),center:CGPoint(x:center.x-scale*0.21,y:center.y-scale*0.24),startRadius:0,endRadius:scale*1.1))
            var rings:[[(Double,Double,Double)]]=[]
            for y in [-0.46,-0.24,0.0,0.24,0.46] {
                let r=sqrt(0.68*0.68-y*y)
                rings.append((0...48).map{i in let a=Double(i)*2*Double.pi/48;return (r*cos(a),y,r*sin(a))})
            }
            for angle in [0.0,Double.pi/3,2*Double.pi/3] {
                rings.append((0...48).map{i in let a=Double(i)*2*Double.pi/48;return (0.68*cos(a)*cos(angle),0.68*sin(a),0.68*cos(a)*sin(angle))})
            }
            for ring in rings {for i in 1..<ring.count {
                let a=ring[i-1],b=ring[i],p=project(a.0,a.1,a.2),q=project(b.0,b.1,b.2)
                guard p.1+q.1>0 else{continue}
                var path=Path();path.move(to:p.0);path.addLine(to:q.0)
                context.stroke(path,with:.color(wire.opacity(0.55)),lineWidth:0.55)
            }}
            for i in 0..<8 {
                let a=Double(i)*Double.pi/4,p=project(sin(a)*0.85,cos(a)*0.85,0).0,q=project(sin(a)*0.92,cos(a)*0.92,0).0
                var path=Path();path.move(to:p);path.addLine(to:q);context.stroke(path,with:.color(wire),lineWidth:1)
            }
            if cos(turn-0.18)>0.15 {
                for x in [-0.19,0.19] {
                    let point=project(x,0.04,0.65).0
                    if greeting || (bpm.map{$0<80} ?? false) {
                        var eye=Path();eye.move(to:CGPoint(x:point.x-3,y:point.y));eye.addQuadCurve(to:CGPoint(x:point.x+3,y:point.y),control:CGPoint(x:point.x,y:point.y+4));context.stroke(eye,with:.color(.init(red:1,green:0.88,blue:0.66)),lineWidth:1.6)
                    }else{context.fill(Path(roundedRect:CGRect(x:point.x-1.5,y:point.y-4,width:3,height:8),cornerRadius:1.5),with:.color(.init(red:1,green:0.88,blue:0.66)))}
                }
                let point=project(0,-0.16,0.67).0
                var mouth=Path();mouth.move(to:CGPoint(x:point.x-4,y:point.y));mouth.addQuadCurve(to:CGPoint(x:point.x+4,y:point.y),control:CGPoint(x:point.x,y:point.y+4))
                context.stroke(mouth,with:.color(wire),lineWidth:1)
            }
        }
    }
}
