import {describe,it,expect} from 'vitest';
import {isNativeTransferKey,nativeTransferErrorMessage} from './native-transfer-errors';
describe('private transfer failure messages',()=>{
 it('checks key format locally without truncating pasted text',()=>{
  const fictionalKey='A'.repeat(43)+'=';
  expect(isNativeTransferKey(' '+fictionalKey+'\n')).toBe(true);
  expect(isNativeTransferKey('Transfer key: '+fictionalKey)).toBe(false);
  expect(isNativeTransferKey('not-a-transfer-key')).toBe(false);
 });
 it('distinguishes decryption, validation, session and stale review failures',()=>{
  expect(nativeTransferErrorMessage('TRANSFER_INVALID')).toContain('matching separate transfer key');
  expect(nativeTransferErrorMessage('TRANSFER_SCHEMA_INVALID')).toContain('file decrypted');
  expect(nativeTransferErrorMessage('VAULT_LOCKED')).toContain('separate unlock sessions');
  expect(nativeTransferErrorMessage('STALE_REVIEW')).toContain('current revision');
 });
 it('never displays untrusted server details or inherited object properties',()=>{
  for(const value of ['sensitive-value-canary','constructor','__proto__',{message:'sensitive-value-canary'},null]){
   const message=nativeTransferErrorMessage(value);
   expect(message).toContain('Open saved transfers');
   expect(message).not.toContain('sensitive-value-canary');
  }
 });
});
