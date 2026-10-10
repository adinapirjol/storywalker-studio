import Link from 'next/link';
import {BodyStudy} from '@/components/body/body-study';

export default function BodyPreviewPage(){
 return <main style={{maxWidth:1400,margin:'0 auto',padding:'1.5rem',background:'#090f1b',color:'#e8edf0',minHeight:'100vh'}}>
  <Link href="/research/xr">← XR sketchbook · WORLD / TIME / MEMORY</Link>
  <h1>BODY · companion evolution</h1>
  <p>Explore a silent fictional companion, or open selected accepted HealthKit evidence privately from your Vault.</p>
  <BodyStudy/>
 </main>;
}
