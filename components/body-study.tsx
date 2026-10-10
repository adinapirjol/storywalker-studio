'use client';
import {useState} from 'react';
import {BodyComposition} from './body-composition';
import {PrivateBodyReview} from './private-body-review';
import type {ContextState} from '@/lib/context-contract';
import fixture from '@/lib/body-preview.fictional.json';
export function BodyStudy(){
 const [source,setSource]=useState<'fictional'|'private'>('fictional');
 return <><div role="group" aria-label="BODY evidence source"><button aria-pressed={source==='fictional'} onClick={()=>setSource('fictional')}>Fictional design preview</button><button aria-pressed={source==='private'} onClick={()=>setSource('private')}>My private HealthKit data</button></div>
 {source==='private'?<PrivateBodyReview/>:<BodyComposition state={fixture as ContextState} designOnly/>}</>;
}
