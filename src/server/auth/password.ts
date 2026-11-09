import { hash, verify } from "@node-rs/argon2";

// argon2id с настройките по подразбиране на библиотеката: 19 MiB памет, 2 итерации, 1 нишка
// (минимумът, който препоръчва OWASP).

export const MIN_PASSWORD_LENGTH = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
