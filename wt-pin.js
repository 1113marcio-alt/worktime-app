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
