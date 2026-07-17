/**
 * Prepare the self-hosted TinyMCE runtime for distribution.
 *
 * @author YJSoft <yjsoft@yjsoft.xyz>
 * @license GPL-2.0-or-later
 */

import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skinRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(skinRoot, 'node_modules/tinymce');
const targetRoot = resolve(skinRoot, 'vendor/tinymce');

await mkdir(targetRoot, { recursive: true });

for (const path of [
    'icons',
    'models',
    'plugins',
    'skins',
    'themes',
    'license.md',
    'tinymce.js',
    'tinymce.min.js',
]) {
    await cp(resolve(sourceRoot, path), resolve(targetRoot, path), {
        recursive: true,
        force: true,
    });
}

console.log('TinyMCE runtime copied to vendor/tinymce.');
