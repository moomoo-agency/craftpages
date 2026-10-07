import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto'

/**
 * Encryption for sync stores on ordinary servers, where the folder might end up readable
 * on the web. AES-256-GCM with a key derived from the sync passphrase (scrypt, with a
 * salt kept next to the data). Without the passphrase the store is unreadable noise.
 */

const MAGIC = Buffer.from('CPS1')

export function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      passphrase,
      salt,
      32,
      { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key))
    )
  )
}

export function encrypt(key: Buffer, data: Buffer): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(data), cipher.final()])
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body])
}

export function decrypt(key: Buffer, data: Buffer): Buffer {
  if (data.length < 32 || !data.subarray(0, 4).equals(MAGIC))
    throw new Error('Not a CraftPages sync file.')
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(4, 16))
  decipher.setAuthTag(data.subarray(16, 32))
  try {
    return Buffer.concat([decipher.update(data.subarray(32)), decipher.final()])
  } catch {
    throw new Error('The sync passphrase is wrong, or the file is damaged.')
  }
}
