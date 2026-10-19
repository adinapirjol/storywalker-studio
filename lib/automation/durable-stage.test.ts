import {afterEach,expect,it,vi} from 'vitest';
vi.mock('node:fs',async()=>{const actual=await vi.importActual<typeof import('node:fs')>('node:fs');return {...actual,fsyncSync:vi.fn(actual.fsyncSync)};});
import * as fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {replacePrivateStage,StageCommitUncertain} from './durable-stage';
const folders:string[]=[];
afterEach(()=>{vi.restoreAllMocks();for(const folder of folders.splice(0))fs.rmSync(folder,{recursive:true,force:true});});
function folder(){const directory=fs.mkdtempSync(join(tmpdir(),'fictional-calendar-durable-'));folders.push(directory);fs.writeFileSync(join(directory,'catalog.json'),'old',{mode:0o600});return directory;}
it('keeps the old catalog when selection changes before replacement and cleans its temporary file',()=>{
 const directory=folder();expect(()=>replacePrivateStage(directory,'catalog.json','new',()=>{throw Error('changed selection');})).toThrow('changed selection');
 expect(fs.readFileSync(join(directory,'catalog.json'),'utf8')).toBe('old');expect(fs.readdirSync(directory)).toEqual(['catalog.json']);
});
it('saves a private replacement only after the final selection check',()=>{
 const directory=folder();const check=vi.fn(()=>expect(fs.readFileSync(join(directory,'catalog.json'),'utf8')).toBe('old'));
 replacePrivateStage(directory,'catalog.json','new',check);expect(check).toHaveBeenCalledOnce();
 expect(fs.readFileSync(join(directory,'catalog.json'),'utf8')).toBe('new');expect(fs.statSync(join(directory,'catalog.json')).mode&0o777).toBe(0o600);
});
it('reports uncertainty rather than claiming no write after directory-sync failure',async()=>{
 const directory=folder();
 const original=(await vi.importActual<typeof import('node:fs')>('node:fs')).fsyncSync;
 vi.mocked(fs.fsyncSync).mockImplementationOnce(original).mockImplementationOnce(()=>{throw Error('fictional directory fault');});
 expect(()=>replacePrivateStage(directory,'catalog.json','new',()=>{})).toThrow(StageCommitUncertain);
 expect(fs.readFileSync(join(directory,'catalog.json'),'utf8')).toBe('new');
});
