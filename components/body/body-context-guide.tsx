'use client';
import {useState} from 'react';
import css from './body-composition.module.css';

/** Author-entered context is never inferred from a measurement or transmitted. */
export function BodyContextGuide(){
 const [age,setAge]=useState(''),[context,setContext]=useState('unknown'),[feeling,setFeeling]=useState('unlabelled');
 const years=Number(age),valid=age!==''&&Number.isInteger(years)&&years>=18&&years<=100,max=220-years;
 return <details className={css.persona}><summary>Workout context and your own reflection</summary>
  <p>Heart rate alone cannot identify danger, a workout, anxiety or a “nirvana” state. Low readings can occur during sleep or in trained people; movement, illness and medicines can change readings. Missing context stays unknown.</p>
  <label>Context you observed<select value={context} onChange={e=>setContext(e.target.value)}><option value="unknown">Unknown</option><option value="rest">Awake and resting</option><option value="workout">Exercising</option><option value="recovery">Recovering after exercise</option><option value="sleep">Sleeping</option></select></label>
  <label>Your own description<select value={feeling} onChange={e=>setFeeling(e.target.value)}><option value="unlabelled">Unlabelled</option><option value="clear">Clear-headed / relaxed</option><option value="tense">Feeling tense</option><option value="energised">Feeling energised</option></select></label>
  <p>These are temporary Author notes for this view. They are not saved or sent to Pydantic, and no BPM range is assigned to them.</p>
  <label>Age for an exercise reference<input type="number" min="18" max="100" value={age} onChange={e=>setAge(e.target.value)}/></label>
  {valid&&<p>Approximate age-predicted maximum: {max} bpm. General moderate-intensity reference: {Math.round(max*.5)}–{Math.round(max*.7)} bpm; vigorous: {Math.round(max*.7)}–{Math.round(max*.85)} bpm. These population estimates are not your measured maximum, a prescription or a safety boundary. Fitness, conditions and medicines can change appropriate targets.</p>}
  <p>High/low bounds below create historical review markers only. There is no universal dangerous BPM cutoff. Discuss personal alert limits with a clinician; this delayed transfer cannot provide emergency monitoring. With chest pain, fainting or severe breathlessness, seek urgent medical help rather than waiting for a marker.</p>
  <p><a href="https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates" target="_blank" rel="noreferrer">AHA exercise reference</a> · <a href="https://www.heart.org/en/health-topics/arrhythmia/about-arrhythmia/bradycardia--slow-heart-rate" target="_blank" rel="noreferrer">Low heart-rate context</a> · <a href="https://www.heart.org/en/health-topics/arrhythmia/about-arrhythmia/tachycardia--fast-heart-rate" target="_blank" rel="noreferrer">High heart-rate context</a></p>
 </details>;
}
