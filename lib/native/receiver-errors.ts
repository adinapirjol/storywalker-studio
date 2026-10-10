/** Closed recovery messages; never expose exceptions, addresses or pairing secrets. */
export function receiverErrorCode(error:unknown){
 const code=(error as {code?:unknown})?.code;
 if(code==='EADDRINUSE')return 'PORT_BUSY';
 const value=error instanceof Error?error.message:'';
 return ['PAIRING_REQUIRED','HEALTHKIT_PAIRING_REQUIRED','ADDRESS_CHANGED','HEALTHKIT_RECEIVER_REQUIRED'].includes(value)?value:'RECEIVER_UNAVAILABLE';
}
export function receiverRecovery(code:unknown){
 switch(code){
  case 'VIEWER_REPLACED':return 'Another BODY view took over the live feed. Click Go live here only if you want this view to follow it.';
  case 'STREAM_INVALID':return 'The live connection could not be read. Click Go live to reconnect.';
  case 'STREAM_INTERRUPTED':return 'The live connection dropped. Click Go live to reconnect; your saved event settings are unchanged.';
  case 'VAULT_LOCKED':return 'Your Vault session expired. Click Go live to unlock and resume.';
  case 'PAIRING_REQUIRED':return 'No saved pairing is available. Open Automatic iPhone → Mac delivery below, create a Selected HealthKit queue pairing, and import it on your iPhone.';
  case 'HEALTHKIT_PAIRING_REQUIRED':return 'The saved pairing uses fictional data. Create a Selected HealthKit queue pairing below and import it on your iPhone.';
  case 'ADDRESS_CHANGED':return 'The Mac’s network address changed. Check local addresses below, create a new HealthKit pairing, and import it on your iPhone.';
  case 'PORT_BUSY':return 'Another process is using receiver port 8766. Stop the other receiver before trying again.';
  case 'HEALTHKIT_RECEIVER_REQUIRED':return 'The HealthKit receiver stopped. Click Go live to resume your saved pairing.';
  default:return 'Could not start the Mac receiver. Check Automatic iPhone → Mac delivery below and try again.';
 }
}
