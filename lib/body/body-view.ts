/** Artistic camera and face controls; never a health classifier. */
export type BodyView={yaw:number;pitch:number;zoom:number};
export const defaultBodyView:BodyView={yaw:0,pitch:0,zoom:1};
export type BodyFace='neutral'|'crescent'|'arc'|'round'|'wide';
export function bodyFace(heart:number|null):BodyFace{
 if(heart===null||!Number.isFinite(heart)||heart<=0)return 'neutral';
 return heart<80?'crescent':heart<120?'arc':heart<160?'round':'wide';
}
export function orbitBody(view:BodyView,dx:number,dy:number):BodyView{
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return view;
 return {...view,yaw:((view.yaw+dx*.008+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI,pitch:Math.max(-1.15,Math.min(1.15,view.pitch+dy*.008))};
}
export function zoomBody(view:BodyView,factor:number):BodyView{
 if(!Number.isFinite(factor)||factor<=0)return view;
 return {...view,zoom:Math.max(.65,Math.min(1.6,view.zoom*factor))};
}
export function rotateBodyPoint(x:number,y:number,z:number,yaw:number,pitch:number){
 const rx=x*Math.cos(yaw)+z*Math.sin(yaw),rz=z*Math.cos(yaw)-x*Math.sin(yaw);
 return {x:rx,y:y*Math.cos(pitch)-rz*Math.sin(pitch),z:y*Math.sin(pitch)+rz*Math.cos(pitch)};
}
export type BodyPet={x:number;y:number;strength:number};
/** Pointer coordinates only, deliberately independent of all body measurements. */
export function bodyPetAt(x:number,y:number,width:number,height:number,zoom:number):BodyPet|null{
 const radius=Math.min(width*.22,height*.21)*zoom;
 if(radius<=0||![x,y,width,height,zoom].every(Number.isFinite))return null;
 const dx=(x-width/2)/radius,dy=(y-height*.44)/radius,distance=Math.hypot(dx,dy);
 if(distance>=1.7)return null;
 return {x:Math.max(-1,Math.min(1,dx)),y:Math.max(-1,Math.min(1,dy)),strength:Math.max(0,Math.min(1,(1.7-distance)/.9))};
}
