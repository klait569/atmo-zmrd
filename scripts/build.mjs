import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const srcDir = resolve(root, 'src');

if (!existsSync(srcDir)) {
  throw new Error('Missing src directory');
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

cpSync(resolve(root, 'index.html'), resolve(distDir, 'index.html'));
cpSync(srcDir, resolve(distDir, 'src'), { recursive: true });

console.log('Build complete: dist/');
