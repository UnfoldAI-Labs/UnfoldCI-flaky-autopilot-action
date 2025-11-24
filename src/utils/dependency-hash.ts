import * as fs from 'fs';
import * as path from 'path';
import { calculateContentHash } from './hash';
import { parseImports, detectLanguage } from './import-parser';

export async function calculateDependencyHash(testFilePath: string): Promise<string> {
  try {
    const testContent = fs.readFileSync(testFilePath, 'utf-8');
    const importPaths = parseImports(testContent, testFilePath);

    console.log(`    📦 Test: ${path.basename(testFilePath)}`);
    console.log(`    🔗 Found ${importPaths.length} local import(s)`);

    const dependencyContents: string[] = [];

    for (const importPath of importPaths) {
      const content = await readDependencyFile(importPath, testFilePath);
      if (content) {
        dependencyContents.push(content);
        console.log(`       ✅ ${path.basename(importPath)}`);
      } else {
        dependencyContents.push(`// MISSING: ${importPath}`);
        console.log(`       ⚠️  ${path.basename(importPath)} (not found locally - using placeholder)`);
      }
    }

    const combinedContent = testContent + '\n' + dependencyContents.join('\n');
    const hash = calculateContentHash(combinedContent);

    console.log(`    🔐 Combined hash: ${hash.substring(0, 12)}...`);

    return hash;

  } catch (error: any) {
    console.warn(`⚠️  Failed to calculate dependency hash for ${testFilePath}:`, error.message);
    const content = fs.readFileSync(testFilePath, 'utf-8');
    return calculateContentHash(content);
  }
}

async function readDependencyFile(importPath: string, testFilePath: string): Promise<string | null> {
  const language = detectLanguage(testFilePath);

  let extensions: string[] = [];

  if (language === 'javascript' || language === 'typescript') {
    extensions = ['.ts', '.tsx', '.js', '.jsx'];
  } else if (language === 'python') {
    extensions = ['.py', '/__init__.py'];
  } else if (language === 'java') {
    extensions = ['.java'];
  } else if (language === 'go') {
    extensions = ['.go'];
  } else if (language === 'ruby') {
    extensions = ['.rb'];
  } else if (language === 'csharp') {
    extensions = ['.cs'];
  } else if (language === 'php') {
    extensions = ['.php'];
  } else if (language === 'rust') {
    extensions = ['.rs'];
  } else if (language === 'kotlin') {
    extensions = ['.kt'];
  } else if (language === 'swift') {
    extensions = ['.swift'];
  }

  if (path.extname(importPath)) {
    try {
      return fs.readFileSync(importPath, 'utf-8');
    } catch {
      return null;
    }
  }

  for (const ext of extensions) {
    try {
      const fullPath = importPath + ext;
      return fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }
  }

  return null;
}

export function getDependencies(testFilePath: string): string[] {
  try {
    const content = fs.readFileSync(testFilePath, 'utf-8');
    return parseImports(content, testFilePath);
  } catch {
    return [];
  }
}
