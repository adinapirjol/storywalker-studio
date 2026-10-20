import type { HandPoint } from './finger-tracking';
export type PalmPose = 'gathered' | 'open' | 'other' | 'missing';
export function palmPose(hands: HandPoint[][]): PalmPose {
 if(hands.length!==1||hands[0].length!==21)return 'missing';
 const p=hands[0];if(!p.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)))return 'missing';
 const d=(a:number,b:number)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y);
 const scale=d(5,17);if(scale<.025)return 'missing';
 const tips=[4,8,12,16,20];const spread=Math.max(...tips.flatMap(a=>tips.map(b=>d(a,b))))/scale;
 if(spread<1.15)return 'gathered';
 const extended=[8,12,16,20].filter(t=>d(t,0)>d(t-2,0)*1.1).length;
 return spread>2&&d(8,20)/scale>1.2&&extended>=3?'open':'other';
}
/** Requires a held gathered pose followed by a held open pose, not an open hand alone. */
export class PalmOpen {
 constructor(private readonly reverse = false) {}
 phase:'idle'|'gathering'|'armed'|'opening'|'cooldown'='idle';
 private since=0;private last=0;private until=0;
 sample(pose:PalmPose,now:number):boolean {
  if(this.reverse)pose=pose==='open'?'gathered':pose==='gathered'?'open':pose;
  if(now<this.last||now-this.last>800){this.phase='idle';this.since=now;}
  this.last=now;
  if(now<this.until){this.phase='cooldown';return false;}
  if(this.phase==='cooldown')this.phase='idle';
  if(pose==='missing'){this.phase='idle';return false;}
  if(pose==='gathered'){
   if(this.phase!=='gathering'&&this.phase!=='armed'){this.phase='gathering';this.since=now;}
   if(now-this.since>=250)this.phase='armed';return false;
  }
  if(this.phase==='armed'&&pose==='open'){this.phase='opening';this.since=now;return false;}
  if(this.phase==='opening'){
   if(pose!=='open'){this.phase='armed';return false;}
   if(now-this.since>=150){this.phase='cooldown';this.until=now+1200;return true;}
  }
  return false;
 }
}

/** Size-normalized openness, independent of the hand's distance from the camera. */
export function fingerSpread(hands: HandPoint[][]): number | null {
 if(hands.length!==1||hands[0].length!==21)return null;
 const p=hands[0];if(!p.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)))return null;
 const d=(a:number,b:number)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y);
 const scale=d(5,17);if(scale<.025)return null;
 const tips=[4,8,12,16,20];const span=Math.max(...tips.flatMap(a=>tips.map(b=>d(a,b))))/scale;
 return Math.max(0,Math.min(1,(span-1.15)/1.45));
}
export class PalmZoom {
 active=false;
 private since:number|null=null;
 private last:number|null=null;
 sample(hands:HandPoint[][],isOpen:boolean,now:number):number|null {
  const amount=fingerSpread(hands),pose=palmPose(hands);
  if(amount===null||this.last!==null&&(now<=this.last||now-this.last>800)){
   this.active=false;this.since=null;this.last=now;return null;
  }
  this.last=now;
  if(!this.active){
   if(pose!==(isOpen?'open':'gathered')){this.since=null;return null;}
   this.since??=now;
   if(now-this.since<250)return null;
   this.active=true;
  }
  return amount;
 }
}
