'use strict';

/**
 * TinyMCE 8 adapter for Rhymix.
 *
 * @author YJSoft <yjsoft@yjsoft.xyz>
 * @license GPL-2.0-or-later
 */

(function(window, document) {
	const registry = window.TinyMCE8RhymixRegistry = window.TinyMCE8RhymixRegistry || Object.create(null);

	function normalizeSequence(value) {
		const sequence = Number.parseInt(value, 10);
		return Number.isFinite(sequence) ? sequence : 0;
	}

	function normalizeRhymixUrl(value) {
		return String(value || '').replace(/&(?:amp|#0*38|#x0*26);/gi, '&');
	}

	function absoluteUrl(value) {
		try {
			return new URL(normalizeRhymixUrl(value), document.baseURI).href;
		} catch (error) {
			return normalizeRhymixUrl(value);
		}
	}

	function readConfig(wrapper) {
		try {
			return JSON.parse(wrapper.getAttribute('data-editor-config') || '{}');
		} catch (error) {
			throw new Error(`Invalid TinyMCE 8 configuration: ${error.message}`);
		}
	}

	function findNamedControl(form, name) {
		if (!form || !name) return null;
		return Array.from(form.elements || []).find(control => control.name === name) || null;
	}

	function ensureHiddenField(form, name, value) {
		let input = findNamedControl(form, name);
		if (!input) {
			input = document.createElement('input');
			input.type = 'hidden';
			input.name = name;
			form.appendChild(input);
		}
		input.value = value;
		return input;
	}

	function getSkinRootUrl() {
		const baseUrl = String(window.tinymce && window.tinymce.baseURL || '');
		try {
			return new URL('../../', new URL(`${baseUrl.replace(/\/$/, '')}/`, document.baseURI)).href.replace(/\/$/, '');
		} catch (error) {
			return baseUrl.replace(/\/vendor\/tinymce\/?$/, '');
		}
	}

	function isDarkMode(config) {
		if (config.colorset === 'dark') return true;
		if (config.colorset === 'light') return false;
		return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
	}

	function componentButtonName(index) {
		return `rhymixcomponent${index}`;
	}

	function componentEntries(config) {
		return config.enableComponent ? Object.entries(config.components || {}) : [];
	}

	function createToolbar(config) {
		if (!config.enableDefaultComponent) return false;

		const components = componentEntries(config).map((entry, index) => componentButtonName(index));
		const source = config.allowHtml ? ['code'] : [];
		const simple = [
			'fontfamily', 'fontsize', '|',
			'bold', 'italic', 'underline', 'strikethrough', 'forecolor', 'backcolor', '|',
			'alignleft', 'aligncenter', 'alignright', '|',
			'link', 'image', 'table',
			...components,
			'|', 'fullscreen', ...source,
		];
		const full = [
			'undo', 'redo', '|',
			'searchreplace', 'selectall', '|',
			'link', 'unlink', '|',
			'image', 'media', 'table', 'charmap', 'insertdatetime', '|',
			'fullscreen', ...source, '|',
			'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'removeformat', '|',
			'alignleft', 'aligncenter', 'alignright', 'alignjustify',
			'bullist', 'numlist', 'outdent', 'indent', 'blockquote', '|',
			'blocks', 'fontfamily', 'fontsize', '|',
			'forecolor', 'backcolor',
			...components,
			'|', 'help',
		];

		return (config.toolbar === 'simple' ? simple : full).filter(Boolean).join(' ');
	}

	function createPlugins(config) {
		const plugins = [
			'advlist', 'anchor', 'autolink', 'charmap', 'fullscreen', 'help', 'image',
			'insertdatetime', 'link', 'lists', 'media', 'preview', 'searchreplace',
			'table', 'visualblocks', 'visualchars', 'wordcount',
		];
		if (config.allowHtml) plugins.push('code');
		return plugins.join(' ');
	}

	function cssValue(value, fallback) {
		const normalized = String(value || '').trim();
		return normalized && !/[{};]/.test(normalized) ? normalized : fallback;
	}

	function createContentStyle(config) {
		const font = cssValue(config.contentFont, 'inherit');
		const size = cssValue(config.contentFontSize, '13px');
		const lineHeight = cssValue(config.contentLineHeight, 'normal');
		const paragraphSpacing = cssValue(config.contentParagraphSpacing, '0');
		const wordBreak = cssValue(config.contentWordBreak, 'normal');
		const wrapping = wordBreak === 'none'
			? 'white-space:nowrap;'
			: `word-break:${wordBreak};overflow-wrap:break-word;`;

		return [
			`body.rhymix_content{box-sizing:border-box;margin:0!important;padding:12px 16px!important;font-family:${font};font-size:${size};line-height:${lineHeight};${wrapping}}`,
			`body.rhymix_content p{margin-top:0;margin-bottom:${paragraphSpacing};line-height:${lineHeight};}`,
			'body.rhymix_content img,body.rhymix_content video{max-width:100%;height:auto;}',
		].join('');
	}

	function collectContentCss(config, darkMode) {
		const baseUrl = String(window.tinymce.baseURL || '').replace(/\/$/, '');
		const contentSkin = darkMode ? 'dark' : 'default';
		const stylesheets = [
			`${baseUrl}/skins/content/${contentSkin}/content.min.css`,
			...(Array.isArray(config.contentCss) ? config.contentCss : []),
		];

		document.querySelectorAll('link[rel~="stylesheet"][href]').forEach(link => {
			if (link.href && !stylesheets.includes(link.href)) stylesheets.push(link.href);
		});
		return stylesheets;
	}

	function restoreSavedDocument(bridge) {
		const form = bridge.form;
		const savedTitle = findNamedControl(form, '_saved_doc_title');
		const savedContent = findNamedControl(form, '_saved_doc_content');
		const savedMessage = findNamedControl(form, '_saved_doc_message');
		if (!savedTitle || !savedContent || (!savedTitle.value && !savedContent.value)) {
			return bridge.contentInput.value || '';
		}

		if (!window.confirm(savedMessage ? savedMessage.value : 'Load the autosaved document?')) {
			if (typeof window.editorRemoveSavedDoc === 'function') window.editorRemoveSavedDoc();
			return bridge.contentInput.value || '';
		}

		const titleInput = findNamedControl(form, 'title');
		if (titleInput) titleInput.value = savedTitle.value;

		if (typeof window.exec_json === 'function') {
			window.exec_json('editor.procEditorLoadSavedDocument', {
				editor_sequence: bridge.sequence,
				primary_key: bridge.config.primaryKeyName,
				mid: window.current_mid || bridge.config.mid || '',
			}, response => {
				if (response && response.document_srl && bridge.primaryInput) {
					bridge.primaryInput.value = response.document_srl;
				}
				if (typeof window.reloadUploader === 'function') window.reloadUploader(bridge.sequence);
			});
		}
		return savedContent.value;
	}

	function uploadErrorMessage(detail = '') {
		let message = 'File upload failed.';
		if (window.Rhymix && typeof window.Rhymix.lang === 'function') {
			message = window.Rhymix.lang('msg_file_upload_error') || message;
		} else if (window.xe && window.xe.lang && window.xe.lang.msg_file_upload_error) {
			message = window.xe.lang.msg_file_upload_error;
		}
		return detail ? `${message}\n${detail}` : message;
	}

	function refreshUploader(sequence, response, attempt = 0) {
		if (!window.jQuery) return;
		const container = window.jQuery(`#xefu-container-${sequence}`);
		if (!container.length) return;
		const instance = container.data('instance');
		if (instance && typeof instance.loadFilelist === 'function') {
			container.data('editorStatus', response);
			instance.loadFilelist(container, true);
		} else if (attempt < 20) {
			window.setTimeout(() => refreshUploader(sequence, response, attempt + 1), 100);
		}
	}

	function uploadFile(file, bridge, progress) {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			const formData = new FormData();
			const config = bridge.config;

			xhr.open('POST', window.request_uri || window.location.pathname || '/', true);
			xhr.responseType = 'json';
			xhr.withCredentials = true;
			xhr.addEventListener('error', () => reject(uploadErrorMessage()));
			xhr.addEventListener('abort', () => reject(uploadErrorMessage()));
			xhr.addEventListener('load', () => {
				let response = xhr.response;
				if (!response) {
					try {
						response = JSON.parse(xhr.responseText || 'null');
					} catch (error) {
						reject(uploadErrorMessage());
						return;
					}
				}
				if (!response || Number(response.error) !== 0 || !response.download_url) {
					reject(response && response.message ? response.message : uploadErrorMessage());
					return;
				}

				refreshUploader(bridge.sequence, response);
				resolve(response);
			});

			if (xhr.upload && typeof progress === 'function') {
				xhr.upload.addEventListener('progress', event => {
					if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100));
				});
			}

			formData.append('act', 'procFileUpload');
			formData.append('editor_sequence', String(bridge.sequence));
			formData.append('Filedata', file, file.name || 'upload');
			if (config.mid) formData.append('mid', config.mid);
			if (config.moduleSrl) formData.append('module_srl', String(config.moduleSrl));
			if (config.uploadTargetSrl) formData.append('upload_target_srl', String(config.uploadTargetSrl));
			if (config.csrfToken) formData.append('_rx_csrf_token', config.csrfToken);
			xhr.send(formData);
		});
	}

	function applyUploadMetadata(bridge, pending, attempt = 0) {
		if (!bridge.editor || !pending) return;
		const body = bridge.editor.getBody();
		const expectedUrl = absoluteUrl(pending.download_url);
		const image = Array.from(body.querySelectorAll('img')).find(node => {
			return absoluteUrl(node.getAttribute('src')) === expectedUrl ||
				absoluteUrl(node.getAttribute('data-mce-src')) === expectedUrl;
		});

		if (image) {
			if (pending.file_srl) image.setAttribute('data-file-srl', String(pending.file_srl));
			image.setAttribute('editor_component', 'image_link');
			if (!image.getAttribute('alt') && pending.source_filename) {
				image.setAttribute('alt', String(pending.source_filename));
			}
			bridge.sync();
			return;
		}
		if (attempt < 30) {
			window.setTimeout(() => applyUploadMetadata(bridge, pending, attempt + 1), 50);
		}
	}

	function createImageUploadHandler(bridge) {
		return (blobInfo, progress) => uploadFile(blobInfo.blob(), bridge, progress).then(response => {
			applyUploadMetadata(bridge, response);
			return normalizeRhymixUrl(response.download_url);
		});
	}

	function createFilePicker(bridge) {
		return (callback, value, meta) => {
			const input = document.createElement('input');
			input.type = 'file';
			if (meta.filetype === 'image') input.accept = 'image/*';
			if (meta.filetype === 'media') input.accept = 'audio/*,video/*';
			input.addEventListener('change', () => {
				const file = input.files && input.files[0];
				if (!file) return;
				uploadFile(file, bridge).then(response => {
					const metadata = { title: String(response.source_filename || file.name || '') };
					if (meta.filetype === 'image') {
						metadata.alt = String(response.source_filename || file.name || '');
						applyUploadMetadata(bridge, response);
					}
					callback(normalizeRhymixUrl(response.download_url), metadata);
				}).catch(error => {
					bridge.editor.notificationManager.open({
						text: String(error && error.message || error),
						type: 'error',
					});
				});
			}, { once: true });
			input.click();
		};
	}

	function openRhymixComponent(editor, bridge, name) {
		if (typeof window.openComponent !== 'function') return;
		window.editorPrevNode = null;
		window.editorPrevSrl = bridge.sequence;
		editor.focus();
		window.openComponent(name, bridge.sequence);
	}

	function registerComponentButtons(editor, bridge) {
		componentEntries(bridge.config).forEach(([name, title], index) => {
			editor.ui.registry.addButton(componentButtonName(index), {
				text: String(title || name),
				tooltip: String(title || name),
				onAction: () => openRhymixComponent(editor, bridge, name),
			});
		});
	}

	function installComponentEditing(bridge) {
		if (!bridge.config.enableComponent) return;
		const body = bridge.editor.getBody();
		bridge.editor.on('dblclick', event => {
			let node = event.target && event.target.nodeType === 1 ? event.target : null;
			if (!node) return;
			const componentNode = node.closest ? node.closest('[editor_component]') : null;
			if (componentNode && body.contains(componentNode)) node = componentNode;

			let componentName = node.getAttribute('editor_component');
			if (!componentName && node.nodeName === 'IMG') componentName = 'image_link';
			if (!componentName || !Object.prototype.hasOwnProperty.call(bridge.config.components || {}, componentName)) return;

			event.preventDefault();
			event.stopPropagation();
			window.editorPrevNode = node;
			window.editorPrevSrl = bridge.sequence;
			window.openComponent(componentName, bridge.sequence);
		});
	}

	function removeEmptyImageFigures(html) {
		const template = document.createElement('template');
		template.innerHTML = String(html || '');
		template.content.querySelectorAll('figure.image').forEach(figure => {
			if (!figure.querySelector('img, picture, video, audio, table, iframe, object, embed')) figure.remove();
		});
		return template.innerHTML;
	}

	function insertHtml(bridge, html) {
		if (!bridge.editor) return;
		bridge.editor.insertContent(String(html || ''));
		bridge.sync();
	}

	function createCompat(bridge) {
		return {
			mode: 'wysiwyg',
			getData: () => bridge.sync(),
			setData: html => {
				bridge.editor.setContent(removeEmptyImageFigures(html));
				bridge.sync();
			},
			insertHtml: html => insertHtml(bridge, html),
			getText: () => bridge.editor.getContent({ format: 'text' }),
			getSelection: () => ({
				getSelectedText: () => bridge.editor.selection.getContent({ format: 'text' }),
			}),
			focus: () => bridge.editor.focus(),
		};
	}

	function findBridgeForFrame(frame) {
		const element = frame && frame.jquery ? frame[0] : frame;
		const candidates = [
			element && element.editor_sequence,
			element && element.dataset && element.dataset.editorSequence,
			typeof (element && element.getAttribute) === 'function' ? element.getAttribute('editor_sequence') : null,
			typeof (element && element.getAttribute) === 'function' ? element.getAttribute('data-editor-sequence') : null,
			String(element && element.id || '').match(/_(\d+)$/)?.[1],
		];

		try {
			candidates.push(element && element.contentDocument && element.contentDocument.body && element.contentDocument.body.getAttribute('editor_sequence'));
		} catch (error) {
			// A foreign iframe may not expose its document. Try the remaining identifiers.
		}

		if (typeof (element && element.closest) === 'function') {
			const wrapper = element.closest('[data-editor-sequence]');
			candidates.push(wrapper && wrapper.dataset.editorSequence);
		}

		for (const candidate of candidates) {
			const bridge = registry[normalizeSequence(candidate)];
			if (bridge) return bridge;
		}

		for (const bridge of Object.values(registry)) {
			if (element === bridge.iframe || element === bridge.wrapper || element === bridge.editor?.getBody()) return bridge;
			try {
				if (element && bridge.wrapper.contains(element)) return bridge;
			} catch (error) {
				// Non-DOM compatibility objects cannot be passed to Node.contains().
			}
		}

		// Rhymix sets editorPrevSrl before opening every editor component popup.
		return registry[normalizeSequence(window.editorPrevSrl)] || null;
	}

	function removeDeletedFiles(bridge, fileSrls) {
		if (!bridge || !bridge.editor || !fileSrls.length) return;
		const body = bridge.editor.getBody();
		const deleted = new Set(fileSrls.map(String));
		const matchingNodes = Array.from(body.querySelectorAll('[data-file-srl]')).filter(node => {
			return deleted.has(String(node.getAttribute('data-file-srl') || ''));
		});
		if (!matchingNodes.length) return;

		const targets = new Set();
		const parents = new Set();
		matchingNodes.forEach(node => {
			const figure = node.closest('figure.image');
			const target = figure || node;
			targets.add(target);
			if (target.parentElement) parents.add(target.parentElement);
		});

		bridge.editor.undoManager.transact(() => {
			Array.from(targets).forEach(target => {
				if (target.isConnected) bridge.editor.dom.remove(target);
			});
			parents.forEach(parent => {
				if (!parent.isConnected || parent.nodeName !== 'P') return;
				const clone = parent.cloneNode(true);
				clone.querySelectorAll('br').forEach(node => node.remove());
				if (!clone.children.length && !clone.textContent.replace(/\u00a0/g, ' ').trim()) {
					bridge.editor.dom.remove(parent);
				}
			});
			body.querySelectorAll('figure.image').forEach(figure => {
				if (!figure.querySelector('img, picture, video, audio, table, iframe, object, embed')) {
					bridge.editor.dom.remove(figure);
				}
			});
		});
		bridge.editor.nodeChanged();
		bridge.sync();
	}

	function installFileDeleteBridge() {
		if (window.TinyMCE8RhymixFileDeleteBridgeInstalled || typeof window.exec_json !== 'function') return;
		window.TinyMCE8RhymixFileDeleteBridgeInstalled = true;
		const previousExecJson = window.exec_json;

		window.exec_json = function(action, params, callback, ...rest) {
			if (action !== 'file.procFileDelete' || !params) {
				return previousExecJson.call(this, action, params, callback, ...rest);
			}

			const bridge = registry[normalizeSequence(params.editor_sequence)];
			const fileSrls = String(params.file_srls || '').split(',').map(value => value.trim()).filter(Boolean);
			if (!bridge || !fileSrls.length) {
				return previousExecJson.call(this, action, params, callback, ...rest);
			}

			const wrappedCallback = function(result) {
				if (result && Number(result.error) === 0) removeDeletedFiles(bridge, fileSrls);
				if (typeof callback === 'function') return callback.apply(this, arguments);
			};
			return previousExecJson.call(this, action, params, wrappedCallback, ...rest);
		};
	}

	function installGlobals() {
		if (window.TinyMCE8RhymixGlobalsInstalled) return;
		window.TinyMCE8RhymixGlobalsInstalled = true;

		const previous = {
			getInstance: window._getCkeInstance,
			getContainer: window._getCkeContainer,
			getFrame: window.editorGetIFrame,
			replaceHtml: window.editorReplaceHTML,
			getContent: window.editorGetContent,
			getText: window.editorGetContentTextarea_xe,
			getSelected: window.editorGetSelectedHtml,
		};

		window._getCkeInstance = sequence => {
			const bridge = registry[normalizeSequence(sequence)];
			return bridge && bridge.compat
				? bridge.compat
				: (typeof previous.getInstance === 'function' ? previous.getInstance(sequence) : undefined);
		};
		window._getCkeContainer = sequence => {
			const bridge = registry[normalizeSequence(sequence)];
			if (bridge) return window.jQuery ? window.jQuery(bridge.wrapper) : bridge.wrapper;
			return typeof previous.getContainer === 'function' ? previous.getContainer(sequence) : undefined;
		};
		window.editorGetIFrame = sequence => {
			const bridge = registry[normalizeSequence(sequence)];
			return bridge && bridge.iframe
				? bridge.iframe
				: (typeof previous.getFrame === 'function' ? previous.getFrame(sequence) : null);
		};
		window.editorReplaceHTML = (frame, html) => {
			const bridge = findBridgeForFrame(frame);
			if (bridge) return insertHtml(bridge, html);
			if (typeof previous.replaceHtml === 'function') return previous.replaceHtml(frame, html);
		};
		window.editorGetContent = sequence => {
			const bridge = registry[normalizeSequence(sequence)];
			if (bridge) return bridge.sync();
			return typeof previous.getContent === 'function' ? previous.getContent(sequence) : '';
		};
		window.editorGetContentTextarea_xe = sequence => {
			const bridge = registry[normalizeSequence(sequence)];
			if (bridge && bridge.compat) return bridge.compat.getText();
			return typeof previous.getText === 'function' ? previous.getText(sequence) : '';
		};
		window.editorGetSelectedHtml = sequence => {
			const bridge = registry[normalizeSequence(sequence)];
			if (bridge && bridge.editor) return bridge.editor.selection.getContent({ format: 'html' });
			return typeof previous.getSelected === 'function' ? previous.getSelected(sequence) : '';
		};
	}

	function toolbarLabels(language, hidden) {
		const labels = language === 'ko_KR'
			? ['에디터 툴바 접기', '에디터 툴바 펼치기']
			: language === 'ja'
				? ['エディターツールバーを折りたたむ', 'エディターツールバーを展開する']
				: ['Collapse editor toolbar', 'Expand editor toolbar'];
		return hidden ? labels[1] : labels[0];
	}

	function addToolbarToggle(bridge) {
		if (!bridge.config.enableDefaultComponent) {
			bridge.wrapper.classList.add('rx-tinymce8--toolbar-disabled');
			return;
		}
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'rx-tinymce8__toolbar-toggle';
		button.textContent = '≡';

		const setState = hidden => {
			bridge.wrapper.classList.toggle('rx-tinymce8--toolbar-hidden', hidden);
			button.setAttribute('aria-expanded', String(!hidden));
			button.setAttribute('aria-label', toolbarLabels(bridge.config.language, hidden));
			button.title = toolbarLabels(bridge.config.language, hidden);
		};
		button.addEventListener('click', () => {
			setState(!bridge.wrapper.classList.contains('rx-tinymce8--toolbar-hidden'));
		});
		bridge.wrapper.appendChild(button);
		setState(Boolean(bridge.config.hideToolbar));
	}

	function createEditorConfig(bridge) {
		const config = bridge.config;
		const darkMode = isDarkMode(config);
		const skinRootUrl = getSkinRootUrl();
		const toolbar = createToolbar(config);
		const toolbarHeight = toolbar === false ? 24 : config.toolbar === 'simple' ? 86 : 150;
		const editorConfig = {
			target: bridge.target,
			base_url: window.tinymce.baseURL,
			suffix: '.min',
			license_key: config.license || 'gpl',
			plugins: createPlugins(config),
			toolbar,
			toolbar_mode: 'wrap',
			menubar: false,
			statusbar: true,
			branding: false,
			promotion: false,
			resize: true,
			height: Math.max(180, Number(config.height || 300) + toolbarHeight),
			min_height: 180,
			skin: darkMode ? 'oxide-dark' : 'oxide',
			content_css: collectContentCss(config, darkMode),
			content_style: createContentStyle(config),
			body_class: `rhymix_content xe_content editable color_scheme_${darkMode ? 'dark' : 'light'}`,
			language: config.language || 'en',
			convert_urls: false,
			entity_encoding: 'raw',
			browser_spellcheck: true,
			contextmenu: 'link image table',
			image_advtab: true,
			image_caption: true,
			object_resizing: true,
			valid_children: '+figure[figcaption]',
			extended_valid_elements: [
				'img[src|srcset|sizes|alt|title|width|height|class|style|id|loading|decoding|usemap|ismap|crossorigin|referrerpolicy|editor_component|data-file-srl|widget|poll_srl|skin|gallery_style|align|gallery_align|border_thickness|border_color|bg_color|images_list|link_url|open_window|border|margin]',
				'a[href|target|rel|download|class|style|id|name|title|data-file-srl|editor_component]',
				'audio[src|controls|autoplay|loop|muted|preload|class|style|id|data-file-srl|editor_component]',
				'video[src|poster|controls|autoplay|loop|muted|playsinline|preload|width|height|class|style|id|data-file-srl|editor_component]',
				'source[src|srcset|sizes|type|media|width|height]',
				'iframe[src|width|height|name|title|class|style|allow|allowfullscreen|loading|referrerpolicy|sandbox|frameborder]',
			].join(','),
			invalid_elements: 'script,style,form,input,button,select,option,textarea',
			setup: editor => registerComponentButtons(editor, bridge),
		};

		if (config.language !== 'en') editorConfig.language_url = `${skinRootUrl}/langs/${config.language}.js`;
		if (config.fontFamilyFormats) editorConfig.font_family_formats = config.fontFamilyFormats;
		if (config.fontSizeFormats) editorConfig.font_size_formats = config.fontSizeFormats;
		if (config.allowUpload) {
			editorConfig.automatic_uploads = true;
			editorConfig.paste_data_images = true;
			editorConfig.images_reuse_filename = true;
			editorConfig.images_upload_handler = createImageUploadHandler(bridge);
			editorConfig.file_picker_types = 'file image media';
			editorConfig.file_picker_callback = createFilePicker(bridge);
		}
		return editorConfig;
	}

	function installContentSync(bridge) {
		let queued = false;
		const queueSync = () => {
			if (queued) return;
			queued = true;
			queueMicrotask(() => {
				queued = false;
				bridge.sync();
			});
		};

		bridge.editor.on('change input undo redo SetContent ExecCommand', queueSync);
		bridge.observer = new MutationObserver(queueSync);
		bridge.observer.observe(bridge.editor.getBody(), {
			subtree: true,
			childList: true,
			attributes: true,
			characterData: true,
		});
		bridge.editor.on('remove', () => bridge.observer.disconnect());
		bridge.form.addEventListener('submit', () => bridge.sync(), true);
	}

	function showError(wrapper, error) {
		wrapper.classList.add('rx-tinymce8--ready');
		const loading = wrapper.querySelector('.rx-tinymce8__loading');
		if (loading) {
			loading.className = 'rx-tinymce8__error';
			loading.textContent = `TinyMCE 8 could not be initialized.\n${error.message || error}`;
		}
		console.error('[TinyMCE8/Rhymix] Initialization failed.', error);
	}

	async function initialize(wrapper) {
		if (!window.tinymce || typeof window.tinymce.init !== 'function') {
			throw new Error('The self-hosted TinyMCE runtime was not loaded.');
		}

		const config = readConfig(wrapper);
		const sequence = normalizeSequence(config.editorSequence || wrapper.dataset.editorSequence);
		const form = wrapper.closest('form');
		if (!sequence || !form) throw new Error('The editor sequence or parent form is missing.');

		const primaryInput = findNamedControl(form, config.primaryKeyName);
		const contentInput = findNamedControl(form, config.contentKeyName);
		const target = wrapper.querySelector('.rx-tinymce8__source');
		if (!contentInput) throw new Error(`The Rhymix content field "${config.contentKeyName}" was not found.`);
		if (!target) throw new Error('The TinyMCE source element was not found.');

		const bridge = {
			wrapper,
			form,
			config,
			sequence,
			primaryInput: primaryInput || { value: '' },
			contentInput,
			target,
			editor: null,
			iframe: null,
			compat: null,
			observer: null,
			sync() {
				if (this.editor) this.contentInput.value = this.editor.getContent({ format: 'html' });
				return this.contentInput.value;
			},
		};
		registry[sequence] = bridge;
		installFileDeleteBridge();

		form.setAttribute('editor_sequence', String(sequence));
		ensureHiddenField(form, 'use_editor', 'Y');
		ensureHiddenField(form, 'use_html', 'Y');
		target.value = restoreSavedDocument(bridge);

		const editors = await window.tinymce.init(createEditorConfig(bridge));
		const editor = bridge.editor = editors && editors[0];
		if (!editor) throw new Error('TinyMCE did not return an editor instance.');

		bridge.iframe = editor.iframeElement || editor.getContainer().querySelector('iframe');
		if (!bridge.iframe) throw new Error('The TinyMCE editing iframe was not found.');
		bridge.iframe.dataset.editorSequence = String(sequence);
		bridge.iframe.editor_sequence = sequence;
		bridge.iframe.setFocus = () => editor.focus();
		editor.getBody().setAttribute('editor_sequence', String(sequence));
		bridge.compat = createCompat(bridge);

		installComponentEditing(bridge);
		installContentSync(bridge);
		addToolbarToggle(bridge);

		window.editorRelKeys = window.editorRelKeys || [];
		window.editorRelKeys[sequence] = {
			primary: bridge.primaryInput,
			content: contentInput,
			func: () => bridge.sync(),
			pasteHTML: html => insertHtml(bridge, html),
			editor: { getFrame: () => bridge.iframe },
		};

		bridge.sync();
		if (config.enableAutosave && typeof window.editorEnableAutoSave === 'function') {
			window.editorEnableAutoSave(form, sequence);
		}
		wrapper.classList.add('rx-tinymce8--ready');
		if (config.focus) editor.focus();
	}

	function boot() {
		document.querySelectorAll('.rx-tinymce8:not([data-tinymce8-started])').forEach(wrapper => {
			wrapper.setAttribute('data-tinymce8-started', 'true');
			initialize(wrapper).catch(error => showError(wrapper, error));
		});
	}

	installGlobals();
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot, { once: true });
	} else {
		boot();
	}
	window.addEventListener('pageshow', boot);
})(window, document);
