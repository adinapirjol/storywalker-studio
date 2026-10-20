import {expect,it} from 'vitest';
import {approachWindow,openEvidence} from './archive-spatial';
it('opens the browsed window on the visible page without changing the return camera',()=>{
 const camera={x:2.7,z:5.7,yaw:-.443,eye:1.7};
 const target=approachWindow([0,1,2,3,4,5],1,5);
 const view=openEvidence(`fictional-${target}`,camera,10);
 expect(view.phase).toBe('surface');expect(view.windowId).toBe('fictional-5');
 expect(view.origin).toEqual(camera);expect(view.origin).not.toBe(camera);
});
it('uses the current page when selection belongs to another page or group',()=>{
 expect(approachWindow([20,21,22,23,24,25],1,21)).toBe(24);
 expect(approachWindow([20,21],0,2)).toBe(20);
 expect(approachWindow([],0,null)).toBeUndefined();
});
