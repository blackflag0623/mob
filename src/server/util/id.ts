import crypto from 'crypto';

export function generateInstanceId(): string {
  return `mob-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}
