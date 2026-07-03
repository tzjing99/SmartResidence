import type { Options } from 'argon2';

/**
 * Explicit argon2id parameters for user password hashing, pinned rather than
 * relying on the library's bundled defaults (which could silently change —
 * weaker or stronger — across dependency upgrades). These match OWASP's
 * Password Storage Cheat Sheet "config 1" recommendation (>= 19 MiB, t=2)
 * with extra margin: 64 MiB memory, 3 iterations, 4-way parallelism.
 */
export const PASSWORD_HASH_OPTIONS: Options = {
  type: 2, // argon2id
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
};
