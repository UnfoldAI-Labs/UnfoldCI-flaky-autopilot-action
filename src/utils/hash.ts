import * as crypto from 'crypto';
import * as fs from 'fs';

export async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return 'unknown';
  }
}

export function calculateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

