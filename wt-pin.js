/* WorkTime Pro 2.1 PIN verifier.
 * Does not encrypt work records. A short PIN cannot provide robust protection
 * against anyone with direct access to the device's local storage or backups.
 * An existing plaintext PIN is migrated only after successful unlock.
 */
(function (root) {
  "use strict";
  const ITERATIONS = 210000;
  const VERSION = 1;
  function cryptoApi() {
    return root.crypto && root.crypto.subtle && root.crypto.getRandomValues
      ? root.crypto : null;
  }
  function toBase64(bytes) {
    let value = "";
    for (const byte of bytes) value += String.fromCharCode(byte);
    return root.btoa(value);
  }
  function fromBase64(text) {
    if (typeof text !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(text))
      throw new Error("Invalid verifier encoding");
    const str = root.atob(text);
    return Uint8Array.from(str, c => c.charCodeAt(0));
  }
  async function derive(pin, salt, rounds) {
    const api = cryptoApi();
    if (!api) throw new Error("Secure cryptography is unavailable");
    const key = await api.subtle.importKey(
      "raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    const raw = await api.subtle.deriveBits(
      {name:"PBKDF2", hash:"SHA-256", salt, iterations:rounds}, key, 256);
    return new Uint8Array(raw);
  }
  async function create(pin) {
    if (!/^\d{4}$/.test(pin)) throw new Error("Invalid PIN");
    const api = cryptoApi();
    if (!api) throw new Error("Secure cryptography is unavailable");
    const salt = new Uint8Array(16);
    api.getRandomValues(salt);
    const hash = await derive(pin, salt, ITERATIONS);
    return {version:VERSION, algorithm:"PBKDF2-SHA256",
      iterations:ITERATIONS, salt:toBase64(salt), hash:toBase64(hash)};
  }
  function valid(verifier) {
    return verifier && typeof verifier === "object" &&
      verifier.version === VERSION && verifier.algorithm === "PBKDF2-SHA256" &&
      Number.isInteger(verifier.iterations) && verifier.iterations >= 100000 &&
      verifier.iterations <= 1000000 &&
      typeof verifier.salt === "string" && typeof verifier.hash === "string";
  }
  async function verify(pin, verifier) {
    if (!/^\d{4}$/.test(pin) || !valid(verifier)) return false;
    try {
      const salt = fromBase64(verifier.salt), expected = fromBase64(verifier.hash);
      if (salt.length !== 16 || expected.length !== 32) return false;
      const actual = await derive(pin, salt, verifier.iterations);
      let difference = 0;
      for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i];
      return difference === 0;
    } catch (_) { return false; }
  }
  root.WTPin = Object.freeze({available:() => !!cryptoApi(), create, verify, valid});
})(window);

/* Portable encrypted backups. Web Crypto only: PBKDF2-SHA256 + AES-256-GCM.
 * No keys or passwords are persisted. Encryption authenticates the payload.
 */
(function(root){
  "use strict";
  const TYPE="worktime-encrypted-backup", VERSION=1, ITERATIONS=600000, MAX_BYTES=12*1024*1024;
  const api=()=>root.crypto&&root.crypto.subtle&&root.crypto.getRandomValues?root.crypto:null;
  const validPassword=p=>typeof p==="string"&&p.length>=12&&p.length<=1024;
  function encode(bytes){
    let s="";
    for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return root.btoa(s);
  }
  function decode(value,max){
    if(typeof value!=="string"||value.length>Math.ceil(max/3)*4||value.length%4!==0||/[^A-Za-z0-9+/=]/.test(value)||/=/.test(value.replace(/={1,2}$/,"")))throw Error("Invalid backup encoding");
    const binary=root.atob(value);
    if(binary.length>max)throw Error("Backup exceeds size limit");
    return Uint8Array.from(binary,c=>c.charCodeAt(0));
  }
  async function key(password,salt,usage){
    const crypto=api();
    if(!crypto||!validPassword(password))throw Error("Secure crypto or password unavailable");
    const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt,iterations:ITERATIONS},base,{name:"AES-GCM",length:256},false,[usage]);
  }
  const aad=()=>new TextEncoder().encode(TYPE+":"+VERSION+":"+ITERATIONS);
  async function encrypt(payload,password){
    const crypto=api();
    if(!crypto||!validPassword(password))throw Error("Use a password of at least 12 characters");
    const plain=new TextEncoder().encode(JSON.stringify(payload));
    if(plain.length>MAX_BYTES)throw Error("Backup exceeds size limit");
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:aad(),tagLength:128},await key(password,salt,"encrypt"),plain);
    return {backupType:TYPE,version:VERSION,kdf:"PBKDF2-SHA256",iterations:ITERATIONS,cipher:"AES-256-GCM",salt:encode(salt),iv:encode(iv),data:encode(new Uint8Array(encrypted))};
  }
  function isEncrypted(value){return !!value&&value.backupType===TYPE;}
  async function decrypt(value,password){
    if(!isEncrypted(value)||value.version!==VERSION||value.kdf!=="PBKDF2-SHA256"||value.iterations!==ITERATIONS||value.cipher!=="AES-256-GCM")throw Error("Unsupported encrypted backup");
    const salt=decode(value.salt,16),iv=decode(value.iv,12),data=decode(value.data,MAX_BYTES+16);
    if(salt.length!==16||iv.length!==12||data.length<16)throw Error("Invalid encrypted backup");
    const crypto=api();if(!crypto)throw Error("Secure crypto unavailable");
    const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:aad(),tagLength:128},await key(password,salt,"decrypt"),data);
    return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(plain));
  }
  root.WTBackupCrypto=Object.freeze({available:()=>!!api(),validPassword,isEncrypted,encrypt,decrypt});
})(window);
