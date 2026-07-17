@php

/**
 * TinyMCE 8 skin configuration for Rhymix.
 *
 * @author YJSoft <yjsoft@yjsoft.xyz>
 * @license GPL-2.0-or-later
 */

// TinyMCE 라이선스가 있다면 아래 GPL을 실제 라이선스 키로 교체해주세요.
$tinymce8_license = 'GPL';

// 이 아래부터는 수정하지 말아주세요.
$tinymce8_sequence = (int)($editor_sequence ?? 0);
$_tinymce8_upload_info = $_SESSION['upload_info'][$tinymce8_sequence] ?? null;
$_tinymce8_module_info = isset($module_info) && is_object($module_info)
    ? $module_info
    : Context::get('current_module_info');

$tinymce8_requested_colorset = $colorset ?? 'auto';
$tinymce8_colorset = in_array($tinymce8_requested_colorset, ['auto', 'light', 'dark'], true)
    ? $tinymce8_requested_colorset
    : 'auto';
$tinymce8_language = str_replace('jp', 'ja', (string)Context::getLangType());
if ($tinymce8_language === 'ko') {
    $tinymce8_language = 'ko_KR';
} elseif ($tinymce8_language !== 'ja') {
    $tinymce8_language = 'en';
}

$tinymce8_default_font = (string)($content_font ?: 'default');
$tinymce8_default_font_size = max(8, (int)preg_replace('/\D/', '', (string)($content_font_size ?? '13')));
$tinymce8_fonts = array_values(array_filter(array_map('strval', $lang->edit->fontlist ?? [])));
if ($tinymce8_default_font !== 'default' && !in_array($tinymce8_default_font, $tinymce8_fonts, true)) {
    array_unshift($tinymce8_fonts, $tinymce8_default_font);
}

$tinymce8_font_family_formats = [];
foreach ($tinymce8_fonts as $_tinymce8_font) {
    $_tinymce8_font_label = trim(array_first(explode(',', $_tinymce8_font, 2)));
    $tinymce8_font_family_formats[] = $_tinymce8_font_label . '=' . $_tinymce8_font;
}
$tinymce8_font_size_formats = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 48];
if (!in_array($tinymce8_default_font_size, $tinymce8_font_size_formats, true)) {
    $tinymce8_font_size_formats[] = $tinymce8_default_font_size;
    sort($tinymce8_font_size_formats);
}

$tinymce8_components = [];
foreach ($component_list ?? [] as $_tinymce8_component_name => $_tinymce8_component) {
    $tinymce8_components[(string)$_tinymce8_component_name] = escape($_tinymce8_component->title, false);
}

$tinymce8_config = [
    'license' => $tinymce8_license,
    'editorSequence' => $tinymce8_sequence,
    'primaryKeyName' => (string)($editor_primary_key_name ?? 'document_srl'),
    'contentKeyName' => (string)($editor_content_key_name ?? 'content'),
    'height' => max(100, (int)($editor_height ?? 300)),
    'toolbar' => (string)($editor_toolbar ?? 'default'),
    'hideToolbar' => (bool)($editor_toolbar_hide ?? false),
    'focus' => (bool)($editor_focus ?? false),
    'allowUpload' => (bool)($allow_fileupload ?? false),
    'allowHtml' => (bool)($html_mode ?? false),
    'enableAutosave' => (bool)($enable_autosave ?? false),
    'enableComponent' => (bool)($enable_component ?? false),
    'enableDefaultComponent' => (bool)($enable_default_component ?? false),
    'components' => $tinymce8_components,
    'colorset' => $tinymce8_colorset,
    'language' => $tinymce8_language,
    'fontFamilyFormats' => implode(';', $tinymce8_font_family_formats),
    'fontSizeFormats' => implode('px ', $tinymce8_font_size_formats) . 'px',
    'defaultFont' => $tinymce8_default_font,
    'defaultFontSize' => $tinymce8_default_font_size,
    'contentCss' => array_values($editor_additional_css ?: []),
    'contentFont' => (string)($content_font ?: 'inherit'),
    'contentFontSize' => (string)($content_font_size ?: '13px'),
    'contentLineHeight' => (string)($content_line_height ?: 'normal'),
    'contentWordBreak' => (string)($content_word_break ?: 'normal'),
    'contentParagraphSpacing' => (string)($content_paragraph_spacing ?: '0'),
    'moduleSrl' => (int)(is_object($_tinymce8_upload_info)
        ? ($_tinymce8_upload_info->module_srl ?? 0)
        : (is_object($_tinymce8_module_info) ? ($_tinymce8_module_info->module_srl ?? 0) : 0)),
    'uploadTargetSrl' => (int)(is_object($_tinymce8_upload_info)
        ? ($_tinymce8_upload_info->upload_target_srl ?? 0)
        : ($document_srl ?? ($upload_target_srl ?? 0))),
    'mid' => (string)($mid ?? (is_object($_tinymce8_module_info) ? ($_tinymce8_module_info->mid ?? '') : (Context::get('mid') ?? ''))),
    'csrfToken' => (string)(Context::get('_rx_csrf_token') ?? ''),
];

$tinymce8_config_json = json_encode(
    $tinymce8_config,
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);

$tinymce8_css_vars = (object)[
    'colorset' => $tinymce8_colorset,
];

unset(
    $_tinymce8_upload_info,
    $_tinymce8_module_info,
    $_tinymce8_font,
    $_tinymce8_font_label,
    $_tinymce8_component,
    $_tinymce8_component_name,
    $tinymce8_requested_colorset
);

@endphp
