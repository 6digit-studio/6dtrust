/// <reference types="bun" />
import { test, expect } from 'bun:test';
import { httpUrlOrNull } from './web-url';

test('accepts http and https, normalized', () => {
	expect(httpUrlOrNull('https://example.com')).toBe('https://example.com/');
	expect(httpUrlOrNull('http://example.com/path?q=1')).toBe('http://example.com/path?q=1');
	expect(httpUrlOrNull('  https://trimmed.dev  ')).toBe('https://trimmed.dev/');
});

test('rejects dangerous and non-http schemes (the XSS vectors)', () => {
	expect(httpUrlOrNull('javascript:alert(document.domain)')).toBeNull();
	expect(httpUrlOrNull('JavaScript:alert(1)')).toBeNull();
	expect(httpUrlOrNull('data:text/html,<script>alert(1)</script>')).toBeNull();
	expect(httpUrlOrNull('vbscript:msgbox(1)')).toBeNull();
	expect(httpUrlOrNull('file:///etc/passwd')).toBeNull();
});

test('rejects empty / unparseable input', () => {
	expect(httpUrlOrNull(null)).toBeNull();
	expect(httpUrlOrNull(undefined)).toBeNull();
	expect(httpUrlOrNull('')).toBeNull();
	expect(httpUrlOrNull('   ')).toBeNull();
	expect(httpUrlOrNull('not a url')).toBeNull();
});
