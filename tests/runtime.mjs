/**
 * Browser-level integration checks for the Rhymix TinyMCE 8 skin.
 *
 * @author YJSoft <yjsoft@yjsoft.xyz>
 * @license GPL-2.0-or-later
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const skinRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fallbackChromium = resolve(skinRoot, '../ckeditor5/node_modules/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome');

function escapeAttribute(value) {
	return JSON.stringify(value).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function editorConfig(overrides = {}) {
	return {
		editorSequence: 301,
		primaryKeyName: 'document_srl',
		contentKeyName: 'content',
		height: 240,
		toolbar: 'default',
		hideToolbar: false,
		focus: false,
		allowUpload: true,
		allowHtml: true,
		enableAutosave: true,
		enableComponent: true,
		enableDefaultComponent: true,
		components: { poll_maker: 'Poll maker', image_link: 'Image properties' },
		colorset: 'light',
		language: 'en',
		fontFamilyFormats: 'Arial=Arial, sans-serif;Noto Sans=Noto Sans, sans-serif',
		fontSizeFormats: '8px 10px 13px 16px 24px',
		contentCss: [],
		contentFont: 'Arial, sans-serif',
		contentFontSize: '13px',
		contentLineHeight: '1.6',
		contentWordBreak: 'break-word',
		contentParagraphSpacing: '8px',
		moduleSrl: 123,
		uploadTargetSrl: 555,
		mid: 'board',
		csrfToken: 'csrf-test',
		...overrides,
	};
}

function fixture(sequence, config, initialContent) {
	return `<form class="fixture" id="form-${sequence}">
		<input name="document_srl" value="555">
		<textarea name="content">${initialContent}</textarea>
		<div id="tinymce8_instance_${sequence}" class="rx-tinymce8 rx-tinymce8--${config.colorset}"
			data-editor-sequence="${sequence}"
			data-editor-config='${escapeAttribute(config)}'
			style="--rx-tinymce8-height:${config.height}px">
			<div class="rx-tinymce8__loading">TinyMCE 8</div>
			<textarea id="tinymce8_source_${sequence}" class="rx-tinymce8__source"></textarea>
		</div>
	</form>`;
}

const firstConfig = editorConfig();
const secondConfig = editorConfig({
	editorSequence: 302,
	toolbar: 'simple',
	hideToolbar: true,
	allowUpload: false,
	enableAutosave: false,
	enableComponent: false,
	components: {},
	language: 'ko_KR',
});

const pageHtml = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/css/rhymix.scss">
<style>body{margin:16px}.fixture{max-width:980px;margin:0 auto 24px}.fixture>textarea[name=content]{display:none}</style>
</head><body>
${fixture(301, firstConfig, '<p>Initial <strong>content</strong></p><p><img src="/files/component.png" editor_component="poll_maker" poll_srl="77"></p>')}
${fixture(302, secondConfig, '<p>두 번째 편집기</p>')}
<script>
window.editorRelKeys = [];
window.request_uri = '/upload';
window.current_mid = 'board';
window.componentCalls = [];
window.openComponent = (name, sequence) => window.componentCalls.push([name, Number(sequence)]);
window.editorEnableAutoSave = (form, sequence) => { window.autosaveSequence = Number(sequence); };
window.editorRemoveSavedDoc = () => {};
window.exec_json = (action, params, callback) => window.setTimeout(() => callback({ error: 0, files: [] }), 0);
</script>
<script src="/vendor/tinymce/tinymce.min.js"></script>
<script src="/js/rhymix.js"></script>
</body></html>`;

const mimeTypes = {
	'.css': 'text/css; charset=utf-8',
	'.gif': 'image/gif',
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
};
const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

const server = createServer(async (request, response) => {
	try {
		const url = new URL(request.url || '/', 'http://127.0.0.1');
		if (request.method === 'POST' && url.pathname === '/upload') {
			request.resume();
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end(JSON.stringify({
				error: 0,
				file_srl: 901,
				source_filename: 'uploaded.png',
				download_url: '/files/uploaded.png?download=1&token=2',
				files: [],
			}));
			return;
		}
		if (url.pathname.startsWith('/files/')) {
			response.writeHead(200, { 'content-type': 'image/png' });
			response.end(transparentPng);
			return;
		}
		if (url.pathname === '/') {
			response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
			response.end(pageHtml);
			return;
		}

		const relativePath = decodeURIComponent(url.pathname).replace(/^\//, '');
		const filePath = resolve(skinRoot, relativePath);
		if (!filePath.startsWith(`${skinRoot}${sep}`)) throw new Error('Invalid path');
		await stat(filePath);
		response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
		response.end(await readFile(filePath));
	} catch (error) {
		response.writeHead(404, { 'content-type': 'text/plain' });
		response.end('Not found');
	}
});

await new Promise(resolvePromise => server.listen(0, '127.0.0.1', resolvePromise));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

let executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || '';
if (!executablePath) {
	try {
		await access(fallbackChromium);
		executablePath = fallbackChromium;
	} catch (error) {
		// Playwright's default browser lookup will provide the actionable error.
	}
}

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
const requestErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('requestfailed', request => requestErrors.push(`${request.method()} ${request.url()}`));
page.on('response', response => {
	if (response.status() >= 400) requestErrors.push(`${response.status()} ${response.url()}`);
});

try {
	await page.goto(baseUrl, { waitUntil: 'networkidle' });
	await page.waitForFunction(() => {
		return window.TinyMCE8RhymixRegistry?.[301]?.compat && window.TinyMCE8RhymixRegistry?.[302]?.compat;
	});

	const integration = await page.evaluate(() => {
		const first = window.TinyMCE8RhymixRegistry[301];
		const second = window.TinyMCE8RhymixRegistry[302];
		return {
			version: `${tinymce.majorVersion}.${tinymce.minorVersion}`,
			firstContent: first.contentInput.value,
			secondContent: second.contentInput.value,
			firstUseEditor: first.form.elements.use_editor.value,
			firstUseHtml: first.form.elements.use_html.value,
			firstFrameSequence: first.iframe.contentDocument.body.getAttribute('editor_sequence'),
			globalInstance: _getCkeInstance(301) === first.compat,
			globalFrame: editorGetIFrame(301) === first.iframe,
			relKey: editorRelKeys[301].content === first.contentInput,
			autosaveSequence: window.autosaveSequence,
			hiddenSecond: second.wrapper.classList.contains('rx-tinymce8--toolbar-hidden'),
		};
	});
	assert.equal(integration.version, '8.8.0');
	assert.match(integration.firstContent, /Initial/);
	assert.match(integration.secondContent, /두 번째 편집기/);
	assert.equal(integration.firstUseEditor, 'Y');
	assert.equal(integration.firstUseHtml, 'Y');
	assert.equal(integration.firstFrameSequence, '301');
	assert.equal(integration.globalInstance, true);
	assert.equal(integration.globalFrame, true);
	assert.equal(integration.relKey, true);
	assert.equal(integration.autosaveSequence, 301);
	assert.equal(integration.hiddenSecond, true);
	const contentPadding = await page.evaluate(() => {
		const style = getComputedStyle(window.TinyMCE8RhymixRegistry[301].editor.getBody());
		return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
	});
	assert.deepEqual(contentPadding, ['12px', '16px', '12px', '16px']);

	const toolbarState = await page.evaluate(() => {
		const wrapper = document.querySelector('#tinymce8_instance_301');
		const labels = Array.from(wrapper.querySelectorAll('.tox-tbtn')).map(button => (
			button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent.trim()
		));
		return {
			labels,
			componentText: Array.from(wrapper.querySelectorAll('.tox-tbtn')).some(button => button.textContent.includes('Poll maker')),
			toolbarMode: tinymce.get('tinymce8_source_301').options.get('toolbar_mode'),
		};
	});
	assert.equal(toolbarState.toolbarMode, 'wrap');
	assert.equal(toolbarState.componentText, true);
	assert.equal(toolbarState.labels.some(label => /(?:Source code|소스코드)/i.test(label)), true);
	assert.ok(toolbarState.labels.findIndex(label => /(?:Undo|실행 취소)/i.test(label)) < toolbarState.labels.findIndex(label => /(?:Link|링크)/i.test(label)));
	assert.ok(toolbarState.labels.findIndex(label => /(?:^Image$|이미지)/i.test(label)) < toolbarState.labels.findIndex(label => /(?:Bold|굵게)/i.test(label)));

	await page.getByRole('button', { name: 'Poll maker' }).click();
	assert.deepEqual(await page.evaluate(() => window.componentCalls.at(-1)), ['poll_maker', 301]);
	assert.equal(await page.evaluate(() => window.editorPrevSrl), 301);

	const componentFrame = page.frameLocator('#tinymce8_instance_301 iframe');
	await componentFrame.locator('img[editor_component="poll_maker"]').dblclick();
	assert.deepEqual(await page.evaluate(() => window.componentCalls.at(-1)), ['poll_maker', 301]);
	await page.evaluate(() => window.editorPrevNode.setAttribute('poll_srl', '999'));
	await page.waitForFunction(() => document.querySelector('#form-301 textarea[name="content"]').value.includes('poll_srl="999"'));
	await page.evaluate(() => {
		editorReplaceHTML(editorGetIFrame(301), '<img src="/files/gallery.png" editor_component="image_gallery" gallery_style="slide">');
		editorRelKeys[301].pasteHTML('<img src="/files/emoticon.png" class="emoticon" alt="emoji">');
	});
	await page.waitForFunction(() => {
		const html = _getCkeInstance(301).getData();
		return html.includes('editor_component="image_gallery"') && html.includes('class="emoticon"');
	});

	await page.evaluate(() => {
		_getCkeInstance(301).insertHtml('<p><img src="/files/native.png" alt="native" editor_component="image_link" data-file-srl="777"></p>', 'unfiltered_html');
	});
	await page.waitForFunction(() => _getCkeInstance(301).getData().includes('data-file-srl="777"'));
	await page.evaluate(() => exec_json('file.procFileDelete', { file_srls: '777', editor_sequence: 301 }, () => {}));
	await page.waitForFunction(() => !_getCkeInstance(301).getData().includes('data-file-srl="777"'));
	assert.equal(await page.evaluate(() => _getCkeInstance(301).getData().includes('data-file-srl="777"')), false);

	await page.evaluate(() => {
		const editor = _getCkeInstance(301);
		editor.setData('<figure class="image"><img src="/files/caption.png" data-file-srl="778"><figcaption>caption</figcaption></figure>');
	});
	await page.evaluate(() => exec_json('file.procFileDelete', { file_srls: '778', editor_sequence: 301 }, () => {}));
	await page.waitForFunction(() => !/<figure class="image"/i.test(_getCkeInstance(301).getData()));
	assert.equal(await page.evaluate(() => /<figure class="image"/i.test(_getCkeInstance(301).getData())), false);

	const uploadResult = await page.evaluate(async () => {
		const bridge = window.TinyMCE8RhymixRegistry[301];
		const handler = bridge.editor.options.get('images_upload_handler');
		const file = new File([new Uint8Array([137, 80, 78, 71])], 'uploaded.png', { type: 'image/png' });
		const url = await handler({ blob: () => file }, () => {});
		bridge.editor.insertContent(`<p><img src="${url}"></p>`);
		return url;
	});
	assert.equal(uploadResult, '/files/uploaded.png?download=1&token=2');
	await page.waitForFunction(() => _getCkeInstance(301).getData().includes('data-file-srl="901"'));
	assert.match(await page.evaluate(() => _getCkeInstance(301).getData()), /editor_component="image_link"/);

	await page.evaluate(() => tinymce.get('tinymce8_source_301').execCommand('mceCodeEditor'));
	const sourceDialog = page.getByRole('dialog');
	await sourceDialog.waitFor();
	const sourceTextarea = sourceDialog.locator('textarea');
	await sourceTextarea.fill('<p id="source-test">Source works</p>');
	await sourceDialog.getByRole('button', { name: /(?:Save|저장)/i }).click();
	await page.waitForFunction(() => _getCkeInstance(301).getData().includes('source-test'));

	for (const sequence of [301, 302]) {
		const bounds = await page.evaluate(sequenceValue => {
			const wrapper = document.querySelector(`#tinymce8_instance_${sequenceValue}`);
			const button = wrapper.querySelector('.rx-tinymce8__toolbar-toggle');
			const outer = wrapper.getBoundingClientRect();
			const toggle = button.getBoundingClientRect();
			return { outer: { left: outer.left, right: outer.right, top: outer.top }, toggle: { left: toggle.left, right: toggle.right, top: toggle.top } };
		}, sequence);
		assert.ok(bounds.toggle.left >= bounds.outer.left);
		assert.ok(bounds.toggle.right <= bounds.outer.right + 0.5);
		assert.ok(bounds.toggle.top >= bounds.outer.top);
	}

	await page.locator('#tinymce8_instance_302 .rx-tinymce8__toolbar-toggle').click();
	assert.equal(await page.locator('#tinymce8_instance_302').evaluate(node => node.classList.contains('rx-tinymce8--toolbar-hidden')), false);

	await page.setViewportSize({ width: 390, height: 844 });
	await page.waitForTimeout(100);
	const mobileLayout = await page.evaluate(() => {
		return [301, 302].map(sequence => {
			const wrapper = document.querySelector(`#tinymce8_instance_${sequence}`);
			const button = wrapper.querySelector('.rx-tinymce8__toolbar-toggle');
			const toolbar = wrapper.querySelector('.tox-editor-header');
			const outer = wrapper.getBoundingClientRect();
			const toggle = button.getBoundingClientRect();
			const toolbarRect = toolbar.getBoundingClientRect();
			return {
				inside: toggle.left >= outer.left && toggle.right <= outer.right + 0.5 && toggle.top >= outer.top,
				toolbarFits: toolbarRect.width <= outer.width + 0.5,
				overflow: wrapper.scrollWidth <= wrapper.clientWidth + 1,
			};
		});
	});
	for (const layout of mobileLayout) {
		assert.equal(layout.inside, true);
		assert.equal(layout.toolbarFits, true);
		assert.equal(layout.overflow, true);
	}

	assert.deepEqual(pageErrors, []);
	assert.deepEqual(requestErrors, []);
	console.log('TinyMCE 8 runtime integration tests passed.');
} finally {
	await page.close();
	await browser.close();
	await new Promise(resolvePromise => server.close(resolvePromise));
}
