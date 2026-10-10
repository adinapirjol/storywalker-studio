/** Original local synthesis. No samples, Spotify content, microphone or network. */
export type RhythmPalette = 'warm' | 'glass' | 'deep';
export const rhythmPalettes: Record<RhythmPalette, {label:string; notes:number[]; texture:string}> = {
 warm:{label:'Warm pulse',notes:[110,130.81,164.81,146.83],texture:'warm rounded bass and soft wooden-like plucks'},
 glass:{label:'Glass garden',notes:[220,261.63,329.63,293.66],texture:'clear bell-like plucks and spacious high tones'},
 deep:{label:'Deep orbit',notes:[55,65.41,82.41,73.42],texture:'deep sine bass and sparse soft percussion'},
};
export function rhythmTempo(value:number){return Number.isFinite(value)?Math.round(Math.max(30,Math.min(240,value))):96;}
/** Only explicit creative choices enter this portable text. No body values/history. */
export function musicalBrief(palette:RhythmPalette,groove:'steady'|'broken',atmosphere:'spacious'|'intimate'|'restless'){
 return `Create an original instrumental loop with ${rhythmPalettes[palette].texture}, a ${groove==='steady'?'steady, even':'broken, syncopated'} groove and a ${atmosphere} atmosphere. Choose the musical tempo independently. Leave room between phrases, avoid vocals and harsh transients, and make the ending loop smoothly. This is a manually authored creative direction, not an inferred listening profile. Do not imitate a named artist or reuse an existing recording.`;
}
/** Eight logarithmic audio bands, bounded for geometry rather than loudness claims. */
export function rhythmBands(data:Uint8Array,sampleRate:number,fftSize:number):number[]{
 const edges=[30,80,160,320,640,1280,2560,5120,12000];
 if(!data.length||!Number.isFinite(sampleRate)||sampleRate<=0||fftSize<=0)return Array(8).fill(0);
 return edges.slice(0,-1).map((edge,i)=>{
  const from=Math.max(0,Math.floor(edge*fftSize/sampleRate)),to=Math.min(data.length,Math.ceil(edges[i+1]*fftSize/sampleRate));
  let peak=0;for(let bin=from;bin<to;bin++)peak=Math.max(peak,data[bin]);return peak/255;
 });
}
export class BodyRhythm {
 private context:AudioContext;
 private master:GainNode;
 private analyser:AnalyserNode;
 private spectrum:Uint8Array<ArrayBuffer>;
 private timer:ReturnType<typeof setInterval>|undefined;
 private stopped=false;
 private next=0;
 private step=0;
 private tempo=96;
 private palette:RhythmPalette='warm';
 private groove:'steady'|'broken'='steady';
 constructor(){
  this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=.12;
  this.analyser=this.context.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=.8;
  this.spectrum=new Uint8Array(this.analyser.frequencyBinCount);
  this.master.connect(this.analyser);this.analyser.connect(this.context.destination);
 }
 configure(tempo:number,volume:number,palette:RhythmPalette,groove:'steady'|'broken'){
  this.tempo=rhythmTempo(tempo);this.palette=palette;this.groove=groove;
  this.master.gain.setTargetAtTime(Math.max(0,Math.min(.3,volume)),this.context.currentTime,.04);
 }
 async start(){
  await this.context.resume();if(this.stopped)return;
  this.next=this.context.currentTime+.04;this.schedule();this.timer=setInterval(()=>this.schedule(),25);
 }
 private voice(frequency:number,time:number,length:number,level:number,type:OscillatorType='sine',kick=false){
  const oscillator=this.context.createOscillator(),envelope=this.context.createGain();
  oscillator.type=type;oscillator.frequency.setValueAtTime(kick?130:frequency,time);
  if(kick)oscillator.frequency.exponentialRampToValueAtTime(45,time+.14);
  envelope.gain.setValueAtTime(.0001,time);envelope.gain.exponentialRampToValueAtTime(level,time+.008);
  envelope.gain.exponentialRampToValueAtTime(.0001,time+length);
  oscillator.connect(envelope);envelope.connect(this.master);oscillator.start(time);oscillator.stop(time+length+.02);
  oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
 }
 private schedule(){
  if(this.stopped||this.context.state!=='running')return;
  // Never replay a backlog after the browser was suspended.
  if(this.next<this.context.currentTime)this.next=this.context.currentTime+.02;
  while(this.next<this.context.currentTime+.12){
   const step=this.step%8,notes=rhythmPalettes[this.palette].notes;
   if(step%2===0)this.voice(45,this.next,.22,.55,'sine',true);
   if(this.groove==='steady'?step%2===0:[0,3,5,6].includes(step))this.voice(notes[Math.floor(step/2)],this.next,.3,.28,this.palette==='glass'?'sine':'triangle');
   this.voice(step%2?1760:1320,this.next,.045,.055,'sine');
   this.next+=30/this.tempo;this.step++;
  }
 }
 levels(){
  if(this.stopped||this.context.state!=='running')return Array(8).fill(0);
  this.analyser.getByteFrequencyData(this.spectrum);return rhythmBands(this.spectrum,this.context.sampleRate,this.analyser.fftSize);
 }
 stop(){this.stopped=true;if(this.timer)clearInterval(this.timer);this.master.disconnect();void this.context.close().catch(()=>{});}
}
