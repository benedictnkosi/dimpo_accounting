import { getRandomValues as expoCryptoGetRandomValues } from 'expo-crypto';

class Crypto {
  getRandomValues(array: Uint8Array) {
    return expoCryptoGetRandomValues(array);
  }
}

const webCrypto = typeof crypto !== 'undefined' ? crypto : new Crypto();

// @ts-ignore
if (!global.crypto) global.crypto = webCrypto; 