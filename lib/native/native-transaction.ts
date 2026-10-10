/** Shared by loopback review and the paired receiver; source changes commit serially. */
const store=globalThis as typeof globalThis&{__nativeTransaction?:Promise<unknown>};
export function nativeTransaction<T>(work:()=>Promise<T>):Promise<T>{
 const next=(store.__nativeTransaction??Promise.resolve()).then(work);
 store.__nativeTransaction=next.catch(()=>undefined);return next;
}
