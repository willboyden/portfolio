import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { StrictMode, createContext, createElement, forwardRef, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region vendor/router/src/index.tsx
/**
* A tiny history-based router.
*
* WHY: `react-router-dom` is not installable in this offline container. This
* covers exactly what a portfolio needs: declarative path matching with
* `:params`, `<Link>` with modifier-key handling, programmatic navigation, hash
* fallback for `file://` previews, and scroll restoration. It is deliberately
* NOT a general-purpose router — if you need nested layouts, data loaders or
* search-param objects, install react-router-dom and swap the import in
* src/app/routes.tsx (the API mirrors its subset closely on purpose).
*/
var RouterContext = createContext(null);
function parseLocation(href) {
	const withoutOrigin = href.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "");
	const hashIndex = withoutOrigin.indexOf("#");
	const hash = hashIndex === -1 ? "" : withoutOrigin.slice(hashIndex);
	const beforeHash = hashIndex === -1 ? withoutOrigin : withoutOrigin.slice(0, hashIndex);
	const queryIndex = beforeHash.indexOf("?");
	const pathname = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
	const search = queryIndex === -1 ? "" : beforeHash.slice(queryIndex);
	return {
		pathname: pathname || "/",
		search,
		hash
	};
}
function normalize(path) {
	if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
	return path || "/";
}
/** Compile `/blog/:slug` into a matcher. Only `:param` segments supported. */
function compilePath(pattern) {
	const keys = [];
	const source = normalize(pattern).split("/").map((segment) => {
		if (segment.startsWith(":")) {
			keys.push(segment.slice(1));
			return "([^/]+)";
		}
		return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}).join("/");
	return {
		regex: new RegExp(`^${source}/?$`),
		keys
	};
}
function matchRoute(pattern, pathname) {
	const { regex, keys } = compilePath(pattern);
	const found = regex.exec(normalize(pathname));
	if (!found) return null;
	const params = {};
	keys.forEach((key, index) => {
		const raw = found[index + 1];
		if (raw !== void 0) params[key] = decodeURIComponent(raw);
	});
	return params;
}
/** Choose the most specific route (exact matches beat `:param` segments). */
function resolveRoute(routes, pathname) {
	let best = null;
	for (const route of routes) {
		if (route.path === "*") continue;
		const params = matchRoute(route.path, pathname);
		if (params === null) continue;
		const specificity = route.path.split("/").filter((s) => s && !s.startsWith(":")).length * 100;
		if (!best || specificity > best.specificity) best = {
			match: {
				path: route.path,
				params
			},
			specificity
		};
	}
	if (best) return best.match;
	return routes.find((route) => route.path === "*") ? {
		path: "*",
		params: {}
	} : null;
}
function readBrowserLocation() {
	if (typeof window === "undefined") return {
		pathname: "/",
		search: "",
		hash: ""
	};
	return parseLocation(window.location.pathname + window.location.search + window.location.hash);
}
function RouterProvider({ routes, children, initialPath }) {
	const [location, setLocation] = useState(() => initialPath !== void 0 ? parseLocation(initialPath) : readBrowserLocation());
	useEffect(() => {
		if (typeof window === "undefined") return void 0;
		let lastHref = null;
		const sync = () => {
			const next = readBrowserLocation();
			const key = `${next.pathname}|${next.search}|${next.hash}`;
			if (key === lastHref) return;
			lastHref = key;
			setLocation(next);
		};
		window.addEventListener("popstate", sync);
		window.addEventListener("hashchange", sync);
		return () => {
			window.removeEventListener("popstate", sync);
			window.removeEventListener("hashchange", sync);
		};
	}, []);
	const navigate = useCallback((to, options) => {
		if (typeof window === "undefined") return;
		const next = to.startsWith("#") ? to : to;
		if (options?.replace) window.history.replaceState(null, "", next);
		else window.history.pushState(null, "", next);
		setLocation(parseLocation(next));
		const anchor = next.includes("#") ? next.slice(next.indexOf("#") + 1) : null;
		if (anchor) document.getElementById(anchor)?.scrollIntoView({
			behavior: "auto",
			block: "start"
		});
		else window.scrollTo({
			top: 0,
			behavior: "auto"
		});
	}, []);
	const match = useMemo(() => resolveRoute(routes, location.pathname), [routes, location.pathname]);
	const value = useMemo(() => ({
		location,
		navigate,
		match,
		routes
	}), [
		location,
		navigate,
		match,
		routes
	]);
	return createElement(RouterContext.Provider, { value }, children);
}
function useRouter() {
	const value = useContext(RouterContext);
	if (!value) throw new Error("[router] useRouter must be used inside <RouterProvider>");
	return value;
}
function useLocation() {
	return useRouter().location;
}
function useParams() {
	return useRouter().match?.params ?? {};
}
/**
* Anchor that routes client-side while staying a real link: middle-click,
* cmd-click, and download targets fall through to the browser.
*/
function Link$1({ to, children, onClick, onNavigate, ...rest }) {
	const navigate = useRouter().navigate;
	const handleClick = (event) => {
		onClick?.(event);
		if (event.defaultPrevented) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		if (rest.target && rest.target !== "_self") return;
		if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(to)) return;
		event.preventDefault();
		navigate(to);
		onNavigate?.();
	};
	return createElement("a", {
		href: to,
		onClick: handleClick,
		...rest
	}, children);
}
/** Render the matched route (routes come from RouterProvider), or NotFound. */
function Outlet({ NotFound }) {
	const { match, routes } = useRouter();
	if (!match) return createElement(NotFound);
	const route = routes.find((candidate) => candidate.path === match.path);
	if (!route) return createElement(NotFound);
	const Component = route.component;
	return createElement(Component, { params: match.params });
}
//#endregion
//#region vendor/emotion/core/src/hash.ts
/**
* Deterministic string hash.
*
* Mirrors the algorithm shape used by emotion's `@emotion/hash`: a djb2-family
* rolling hash over UTF-16 code units, rendered base36. Byte-identical output
* with the published package is NOT guaranteed and is not required — what
* matters for us is that identical CSS always yields the same class name across
* server prerender and client hydration, and that collisions are rare enough to
* be ignorable.
*/
function hash(input) {
	let h = 5381;
	let i = input.length;
	while (i) h = h * 33 ^ input.charCodeAt(--i);
	return (h >>> 0).toString(36);
}
//#endregion
//#region vendor/emotion/core/src/serialize.ts
var CONDITIONAL_AT = /^@(media|supports|container|layer|scope)\b/;
var VERBATIM_AT = /^@(keyframes|-webkit-keyframes|font-face|page|viewport|counter-style|property)\b/;
var SUSPECT_VALUE = /(^|[;{\s(,])(undefined|NaN|\[object Object])(\s|$|[;)}])/;
/** Reject declarations that would silently emit broken CSS. */
function assertValidDeclaration(decl, context) {
	const colon = decl.indexOf(":");
	if (colon === -1) throw new Error(`[css-mini] not a declaration (missing ':')${context}: "${decl.slice(0, 60)}"`);
	const property = decl.slice(0, colon).trim();
	const value = decl.slice(colon + 1).trim().replace(/;+$/, "");
	if (!property) throw new Error(`[css-mini] declaration has an empty property name${context}: "${decl.slice(0, 60)}"`);
	if (!value) throw new Error(`[css-mini] declaration "${property}" has an empty value${context} — an interpolation resolved to nothing (check the theme token path): "${decl.slice(0, 60)}"`);
	if (SUSPECT_VALUE.test(` ${value} `)) throw new Error(`[css-mini] declaration resolved to a non-CSS value${context}: "${decl.slice(0, 80)}" — an interpolation returned undefined/NaN/[object Object]`);
}
/** Strip `//` line comments that live outside strings and block comments. */
function stripLineComments(css) {
	let out = "";
	let inString = null;
	let inComment = false;
	for (let i = 0; i < css.length; i += 1) {
		const ch = css[i];
		const next = css[i + 1];
		if (inComment) {
			if (ch === "*" && next === "/") {
				i += 1;
				inComment = false;
			}
			continue;
		}
		if (inString) {
			out += ch;
			if (ch === "\\") {
				out += next ?? "";
				i += 1;
			} else if (ch === inString) inString = null;
			continue;
		}
		if (ch === "/" && next === "*") {
			i += 1;
			inComment = true;
			continue;
		}
		if (ch === "\"" || ch === "'") {
			inString = ch;
			out += ch;
			continue;
		}
		if (ch === "/" && next === "/") {
			while (i < css.length && css[i] !== "\n") i += 1;
			out += "\n";
			continue;
		}
		out += ch;
	}
	return out;
}
/** Skip whitespace and block comments starting at `i`; returns the new index. */
function skipTrivia(css, i) {
	for (;;) {
		while (i < css.length && /\s/.test(css.charAt(i))) i += 1;
		if (css.charAt(i) === "/" && css.charAt(i + 1) === "*") {
			const end = css.indexOf("*/", i + 2);
			i = end === -1 ? css.length : end + 2;
			continue;
		}
		return i;
	}
}
/**
* Read one statement: either `...;` or `... { ... }`.
* Returns the head text (before `{` or `;`), the body text (for blocks), and the
* next index. `body === null` means the statement ended with `;`.
*/
function readStatement(css, start) {
	let i = start;
	let depth = 0;
	while (i < css.length) {
		const ch = css[i];
		if (ch === "\"" || ch === "'") {
			const quote = ch;
			i += 1;
			while (i < css.length) {
				if (css[i] === "\\") {
					i += 2;
					continue;
				}
				if (css[i] === quote) {
					i += 1;
					break;
				}
				i += 1;
			}
			continue;
		}
		if (ch === "/" && css[i + 1] === "*") {
			const end = css.indexOf("*/", i + 2);
			i = end === -1 ? css.length : end + 2;
			continue;
		}
		if (ch === "(" || ch === "[") {
			depth += 1;
			i += 1;
			continue;
		}
		if (ch === ")" || ch === "]") {
			depth -= 1;
			i += 1;
			continue;
		}
		if (depth === 0 && ch === ";") return {
			head: css.slice(start, i),
			body: null,
			next: i + 1
		};
		if (depth === 0 && ch === "{") {
			let j = i + 1;
			let braces = 1;
			while (j < css.length && braces > 0) {
				const c = css[j];
				if (c === "\"" || c === "'") {
					const quote = c;
					j += 1;
					while (j < css.length) {
						if (css[j] === "\\") {
							j += 2;
							continue;
						}
						if (css[j] === quote) {
							j += 1;
							break;
						}
						j += 1;
					}
					continue;
				}
				if (c === "/" && css[j + 1] === "*") {
					const end = css.indexOf("*/", j + 2);
					j = end === -1 ? css.length : end + 2;
					continue;
				}
				if (c === "{") braces += 1;
				else if (c === "}") braces -= 1;
				j += 1;
			}
			if (braces !== 0) throw new Error(`[css-mini] unbalanced braces near "${css.slice(start, start + 48)}"`);
			return {
				head: css.slice(start, i),
				body: css.slice(i + 1, j - 1),
				next: j
			};
		}
		i += 1;
	}
	return {
		head: css.slice(start, i),
		body: null,
		next: i
	};
}
/** Parse a nested CSS string into a node tree. Declarations at this level are `decl` nodes. */
function parse(css, contextForErrors = "") {
	const cleaned = stripLineComments(css);
	const nodes = [];
	let i = skipTrivia(cleaned, 0);
	while (i < cleaned.length) {
		const { head, body, next } = readStatement(cleaned, i);
		const trimmed = head.trim();
		const advanced = skipTrivia(cleaned, next);
		if (advanced <= i) {
			if (!trimmed) break;
			i = cleaned.length;
		} else i = advanced;
		if (!trimmed) continue;
		if (body === null) {
			if (trimmed.startsWith("@")) {
				nodes.push({
					kind: "stmt",
					text: trimmed
				});
				continue;
			}
			for (const part of splitDeclarations(trimmed)) {
				const decl = part.trim();
				if (!decl) continue;
				assertValidDeclaration(decl, contextForErrors);
				nodes.push({
					kind: "decl",
					text: decl.replace(/\s+/g, " ")
				});
			}
			continue;
		}
		if (trimmed.startsWith("@")) {
			if (VERBATIM_AT.test(trimmed)) nodes.push({
				kind: "at",
				name: trimmed,
				body: null,
				raw: body
			});
			else nodes.push({
				kind: "at",
				name: trimmed,
				body: parse(body, contextForErrors),
				raw: null
			});
			continue;
		}
		nodes.push({
			kind: "rule",
			selector: trimmed,
			body: parse(body, ` in "${trimmed.slice(0, 32)}"`)
		});
	}
	return nodes;
}
/** Substitute `&` in a nested selector for its parent, Emotion-style. */
function joinSelectors(parent, nested) {
	if (!parent) return nested;
	return nested.split(",").map((part) => {
		const p = part.trim();
		if (!p) return parent;
		if (p.includes("&")) return p.replace(/&/g, parent);
		return `${parent} ${p}`;
	}).join(", ");
}
function normalizeDecls(nodes) {
	return nodes.filter((n) => n.kind === "decl").map((n) => n.text);
}
function indent(text, pad = "  ") {
	return text.split("\n").map((line) => line.trim() ? pad + line : line).join("\n");
}
/** Split declarations on top-level ';' only, respecting strings and () / []. */
function splitDeclarations(input) {
	const out = [];
	let depth = 0;
	let quote = null;
	let current = "";
	for (let i = 0; i < input.length; i += 1) {
		const ch = input.charAt(i);
		if (quote) {
			current += ch;
			if (ch === "\\") {
				current += input.charAt(i + 1);
				i += 1;
			} else if (ch === quote) quote = null;
			continue;
		}
		if (ch === "\"" || ch === "'") {
			quote = ch;
			current += ch;
			continue;
		}
		if (ch === "(" || ch === "[") depth += 1;
		if (ch === ")" || ch === "]") depth -= 1;
		if (ch === ";" && depth === 0) {
			out.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	out.push(current);
	return out;
}
/** Split a comma-separated selector list, respecting functional notation. */
function splitSelectors(selector) {
	const out = [];
	let depth = 0;
	let current = "";
	for (const ch of selector) {
		if (ch === "(" || ch === "[") depth += 1;
		if (ch === ")" || ch === "]") depth -= 1;
		if (ch === "," && depth === 0) {
			out.push(current.trim());
			current = "";
			continue;
		}
		current += ch;
	}
	out.push(current.trim());
	return out.filter(Boolean);
}
function flattenNodes(nodes, selector) {
	const out = [];
	let pending = [];
	const flush = () => {
		if (pending.length === 0) return;
		const declBlock = `  ${pending.join("; ")};`;
		for (const sel of splitSelectors(selector)) out.push(`${sel} {\n${declBlock}\n}`);
		pending = [];
	};
	for (const node of nodes) {
		if (node.kind === "decl") {
			pending.push(node.text);
			continue;
		}
		if (node.kind === "at") {
			if (node.raw !== null) {
				flush();
				out.push(`${node.name} {\n${indent(node.raw.trim())}\n}`);
				continue;
			}
			const innerSelector = CONDITIONAL_AT.test(node.name) ? selector : "";
			const inner = flattenNodes(node.body ?? [], innerSelector);
			if (!inner.trim()) continue;
			flush();
			out.push(`${node.name} {\n${indent(inner)}\n}`);
			continue;
		}
		if (node.kind === "stmt") {
			flush();
			out.push(`${node.text};`);
			continue;
		}
		const joined = joinSelectors(selector, node.selector);
		const own = normalizeDecls(node.body);
		const rest = node.body.filter((n) => n.kind !== "decl");
		if (own.length > 0) {
			flush();
			const declBlock = `  ${own.join("; ")};`;
			for (const sel of splitSelectors(joined)) out.push(`${sel} {\n${declBlock}\n}`);
		}
		if (rest.length > 0) {
			flush();
			out.push(flattenNodes(rest, joined));
		}
	}
	flush();
	return out.filter(Boolean).join("\n");
}
/**
* Flatten nested CSS into plain CSS rules. `selector` is the base selector that
* `&` refers to. Declarations written at the root of a `css` template land on
* `selector` itself.
*/
function flatten(nested, selector) {
	const nodes = parse(nested);
	const rootDecls = normalizeDecls(nodes);
	const rest = nodes.filter((n) => n.kind !== "decl");
	const out = [];
	if (rootDecls.length > 0) out.push(`${selector} {\n  ${rootDecls.join("; ")};\n}`);
	if (rest.length > 0) out.push(flattenNodes(rest, selector));
	return out.filter(Boolean).join("\n").trim();
}
//#endregion
//#region vendor/emotion/core/src/object-styles.ts
var camelToKebabCache = /* @__PURE__ */ new Map();
function camelToKebab(prop) {
	const cached = camelToKebabCache.get(prop);
	if (cached) return cached;
	if (prop.startsWith("--") || prop.startsWith("-webkit-") || prop.startsWith("-moz-")) {
		camelToKebabCache.set(prop, prop);
		return prop;
	}
	const kebab = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
	camelToKebabCache.set(prop, kebab);
	return kebab;
}
function isObjectStyle(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Serialize one style object into nested CSS text (no selector wrapping). */
function objectToCss(style) {
	let css = "";
	for (const [key, value] of Object.entries(style)) {
		if (value === null || value === void 0 || value === false) continue;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			if (value.every((v) => typeof v === "string" || typeof v === "number")) {
				css += `${camelToKebab(key)}:${value.join(",")};`;
				continue;
			}
			for (const entry of value) if (isObjectStyle(entry)) css += objectToCss(entry);
			continue;
		}
		if (isObjectStyle(value)) {
			css += `${key} {${objectToCss(value)}}`;
			continue;
		}
		css += `${camelToKebab(key)}:${String(value)};`;
	}
	return css;
}
//#endregion
//#region vendor/emotion/core/src/index.ts
/**
* emotion-mini core — hashing, nesting, sheet management, style registration.
*
* See vendor/emotion/README.md for the parity contract and known divergences.
*/
var SHEET_KEY = "__emotionMiniSheet__";
function getSheet() {
	const g = globalThis;
	const existing = g[SHEET_KEY];
	if (existing) return existing;
	const created = {
		inserted: /* @__PURE__ */ new Map(),
		container: null,
		tag: null
	};
	Object.defineProperty(g, SHEET_KEY, {
		value: created,
		writable: true,
		configurable: true
	});
	return created;
}
/** Render the inserted map into plain CSS text, in insertion order. */
function sheetToCss(inserted) {
	return [...inserted.values()].join("\n");
}
function writeRule(sheet, key, styles) {
	if (sheet.inserted.get(key) === styles) return;
	sheet.inserted.set(key, styles);
	if (typeof document === "undefined") return;
	const container = sheet.container ?? document.head;
	if (!sheet.tag || !container.contains(sheet.tag)) {
		sheet.tag = document.createElement("style");
		sheet.tag.setAttribute("data-emotion", "mini");
		container.appendChild(sheet.tag);
	}
	sheet.tag.textContent = sheetToCss(sheet.inserted);
}
/** Test/prerender helper: forget all generated CSS. */
function __resetSheet() {
	const sheet = getSheet();
	sheet.inserted.clear();
	if (sheet.tag) sheet.tag.textContent = "";
}
/** Remove the retired prerender <style> — call from a post-commit effect. */
function retirePrerenderedTag() {
	if (typeof document === "undefined") return;
	for (const el of Array.from(document.querySelectorAll("style[data-emotion-retire]"))) el.remove();
}
/** Test/prerender helper: CSS generated so far, insertion ordered. */
function __sheetCss() {
	return sheetToCss(getSheet().inserted);
}
function isTemplateStrings(value) {
	return Array.isArray(value) && "raw" in value;
}
/**
* Normalize tagged-template call arguments into a flat, correctly interleaved
* argument list: [strings[0],interp[0],strings[1],interp[1],...,strings[n]].
*
* Without this, flattening the TemplateStringsArray first would emit
* `color: ;red` instead of `color: red` — the pairing of static text with its
* interpolations would be lost.
*/
function interpolate(args) {
	if (!isTemplateStrings(args[0])) return args;
	const strings = args[0];
	const interpolations = args.slice(1);
	const out = [];
	strings.forEach((part, index) => {
		out.push(part);
		if (index < interpolations.length) out.push(interpolations[index]);
	});
	return out;
}
/**
* Turn Emotion-style arguments (template literals, objects, arrays, theme
* functions) into one nested CSS string.
*/
function serializeArgs(args, theme) {
	let out = "";
	const consume = (value) => {
		if (value === null || value === void 0 || value === false) return;
		if (typeof value === "number") {
			out += String(value);
			return;
		}
		if (typeof value === "string") {
			out += value;
			return;
		}
		if (Array.isArray(value)) {
			for (const item of value) consume(item);
			return;
		}
		if (typeof value === "function") {
			consume(value(theme));
			return;
		}
		if (typeof value === "object") {
			out += objectToCss(value);
			return;
		}
		throw new Error(`[emotion-mini] unsupported style argument of type ${typeof value}`);
	};
	for (const arg of args) consume(arg);
	return out;
}
/**
* Serialize a styled component's styles for a concrete props object.
*
* The class name is a hash of the resolved rule text, exactly like Emotion: two
* instances of one component with different dynamic props get two class names,
* and identical rules dedupe to one class regardless of which component produced
* them. Prerender and client therefore agree without sharing any counter state.
*/
function serializeStyles(displayName, args, props) {
	const nested = serializeArgs(args, props);
	if (!nested.trim()) return {
		name: "",
		styles: ""
	};
	const name = hash(`${displayName}{${nested}}`);
	return {
		name,
		styles: flatten(nested, `.css-${name}`)
	};
}
/**
* Register a flattened rule under `.css-<name>` and return the class name.
* Idempotent: re-registering identical text is free, and because the name is
* derived from the text, a changed rule always yields a fresh class.
*/
function registerStyle(name, styles) {
	if (!name || !styles) return "";
	writeRule(getSheet(), `.css-${name}`, styles);
	return `css-${name}`;
}
/** Register a raw rule (Global styles, `@keyframes`, `@font-face`) verbatim. */
function registerRaw(key, css) {
	writeRule(getSheet(), key, css);
}
//#endregion
//#region vendor/emotion/react/src/index.ts
/**
* @emotion/react (vendored subset) — theme context, css(), Global, keyframes.
*
* Parity + divergence notes: see vendor/emotion/README.md. The headline
* divergence is that the `css` JSX prop transform is NOT provided (it needs a
* Babel plugin); application code uses `styled(...)` or `css()` + className.
*/
var emptyTheme = {};
var ThemeContext = createContext(null);
function ThemeProvider({ theme, children }) {
	const outer = useContext(ThemeContext) ?? emptyTheme;
	const value = useMemo(() => typeof theme === "function" ? theme(outer) : theme, [theme, outer]);
	return createElement(ThemeContext.Provider, { value }, children);
}
function useTheme() {
	const theme = useContext(ThemeContext);
	if (theme === null) throw new Error("[emotion-mini] useTheme returned undefined — render the tree inside <ThemeProvider>.");
	return theme;
}
/**
* Read the theme, tolerating calls made outside a render.
*
* `keyframes()` and static `css()` are legitimately called at module scope in
* Emotion codebases, where hook access is illegal: React logs an "Invalid hook
* call" warning and throws, which we catch. Module-scope callers simply get an
* empty theme (no theme interpolation resolves there — same as upstream
* Emotion). Inside a component render the context read succeeds normally.
*/
function useContextSafe() {
	try {
		return useContext(ThemeContext) ?? emptyTheme;
	} catch {
		return emptyTheme;
	}
}
function css(...args) {
	const theme = useContextSafe();
	const { name, styles } = serializeStyles("css", interpolate(args), { theme });
	return registerStyle(name, styles);
}
/**
* <Global styles={...} /> — emits unscoped CSS (element selectors, @font-face,
* :root custom properties). Styles are registered during render, and removed on
* unmount ONLY if nothing else registered the same text meanwhile.
*/
function Global({ styles }) {
	const theme = useContextSafe();
	const list = Array.isArray(styles) ? styles : [styles];
	const cssText = useMemo(() => serializeArgs(list, theme), [styles, theme]);
	if (cssText.trim()) registerRaw(`global:${hash(cssText)}`, cssText);
	useEffect(() => {}, [cssText]);
	return null;
}
//#endregion
//#region src/lib/format.ts
/**
* Deterministic formatting primitives.
*
* Everything here is pure and timezone-pinned to UTC: the site is prerendered
* at build time and hydrated on client machines in arbitrary timezones, so a
* date derived from the reader's local zone would differ between server HTML
* and client render. Pinned month names + UTC epoch math guarantee the two
* agree byte-for-byte without depending on the host ICU data.
*/
var MONTHS_SHORT = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec"
];
/** Matches a strict ISO date or ISO datetime; anything else is unparseable. */
var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
/**
* Parse an `YYYY-MM-DD` (or ISO datetime) string as a UTC epoch.
* A bare date is read as UTC midnight — NOT the local zone (that is the whole
* point: prerender and client must agree). Returns null for anything that is
* not an ISO string.
*/
function parseIsoUtc(iso) {
	if (typeof iso !== "string") return null;
	const m = ISO_RE.exec(iso.trim());
	if (!m) return null;
	const [, y, mo, d, hh, mm, ss, zone] = m;
	const year = Number(y);
	const month = Number(mo);
	const day = Number(d);
	const hour = Number(hh ?? "0");
	const min = Number(mm ?? "0");
	const sec = Number(ss ?? "0");
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	let epoch = Date.UTC(year, month - 1, day, hour, min, sec);
	if (zone && zone !== "Z") {
		const sign = zone.startsWith("-") ? -1 : 1;
		const oh = Number(zone.slice(1, 3));
		const om = Number(zone.slice(4).replace(":", "") || "0");
		epoch -= sign * (oh * 36e5 + om * 6e4);
	}
	const date = new Date(epoch);
	return Number.isNaN(date.getTime()) ? null : date;
}
var LONG_MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];
/**
* `2026-03-14` → `Mar 14, 2026` (UTC-pinned). Returns '' for unparseable
* input rather than "Invalid Date" — a blank is honest, a bogus date is not.
*/
function formatDate(iso, options = {}) {
	const date = parseIsoUtc(iso);
	if (!date) return "";
	const month = (options.style === "long" ? LONG_MONTHS : MONTHS_SHORT)[date.getUTCMonth()];
	if (month === void 0) return "";
	let out = `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
	if (options.withTime) {
		const hh = String(date.getUTCHours()).padStart(2, "0");
		const mi = String(date.getUTCMinutes()).padStart(2, "0");
		out += ` ${hh}:${mi} UTC`;
	}
	return out;
}
/** `5` → `5 min read`; clamps to a minimum of 1 minute. */
function formatReadingTime(minutes) {
	if (!Number.isFinite(minutes) || minutes <= 0) return "1 min read";
	return `${Math.max(1, Math.round(minutes))} min read`;
}
/** `pluralize(2, 'post')` → `2 posts`; `pluralize(1, 'box', 'boxes')` → `1 box`. */
function pluralize(count, singular, plural) {
	return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}
/**
* Cut `text` at or before `max` characters, never mid-word, and append
* `ellipsis` (default `…`) when anything was removed. If a single word is
* longer than `max`, the word itself is cut (no empty result) — the cut still
* gets the ellipsis. `max <= 0` → just the ellipsis for non-empty text.
*/
function truncateAtWordBoundary(text, max, ellipsis = "…") {
	if (typeof text !== "string" || text.length === 0) return "";
	if (max <= 0) return ellipsis;
	if (text.length <= max) return text;
	const slice = text.slice(0, max);
	const boundary = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\xA0"), slice.lastIndexOf("\n"));
	return (boundary > 0 ? slice.slice(0, boundary) : slice).trimEnd() + ellipsis;
}
//#endregion
//#region src/lib/seo.ts
/**
* SEO / document-head primitives — one source of truth for the prerenderer AND
* the runtime (document.title + meta sync).
*
* Pinned CONTRACT §4 API:
*   pageMeta(opts) → MetaResult
*   buildHead(meta) → string[]        // ordered tag markup
*
* Honesty rules baked in:
* - Titles are capped at 60 chars (Google's visual cut); we shorten the page
*   part before dropping words, and the <title> text is HTML-escaped.
* - Descriptions are capped at 160 chars and only get `…` when characters
*   were actually removed (truncateAtWordBoundary never mid-cuts a word
*   unless a single word overflows).
* - Every URL goes through joinUrl(), so a SITE.url with a trailing slash or
*   a path without a leading one can never produce `//`.
* - JSON-LD is returned as a plain object; JSON.stringify happens in
*   buildHead with `<` escaped so the output is safe inside <script> and
*   still valid JSON after unescaping. Tests JSON.parse it back.
*/
var SITE = {
	name: "Alex Rivera",
	url: "https://alexrivera.dev",
	title: "Alex Rivera — AI Engineering & Technical Consulting",
	/** Short name for OG cards / manifest (R1-C #10: was referenced before it existed). */
	shortTitle: "Alex Rivera",
	/** Tagline appended to the home <title> only. */
	tagline: "Technical Consulting",
	description: "Portfolio of Alex Rivera, technical consultant and AI engineer: LLM systems, data platforms, full-stack builds, writing and talks.",
	author: "Alex Rivera",
	/**
	* R2-A A3: hire-me metadata a recruiter looks for in 20 seconds. UNSET =
	* hidden (never fabricated). Owner: set these before launching the job push —
	*   hiring: one line, e.g. "Seeking senior AI-platform / full-stack roles —
	*           remote (UTC-5 ±3) — available from Nov 2026"
	*   email:  the mailbox that receives engagements and recruiter mail
	*   resume: path to a PDF in public/ (e.g. '/alex-rivera-resume.pdf')
	*/
	hiring: null,
	email: null,
	resume: null,
	/** DRAFT: replace with the real X handle before launch (no @ prefix here). */
	twitter: "alexriveradev",
	lang: "en",
	rssPath: "/rss.xml",
	defaultImagePath: "/og-default.png"
};
/** Escape a string for interpolation into HTML text or a double-quoted attribute. */
function escapeHtml(input) {
	return String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
/** Join a base URL and path segments without ever emitting `//` (scheme aside). */
function joinUrl(base, ...segments) {
	const baseTrim = base.replace(/\/+$/, "");
	const tail = segments.filter((s) => s.length > 0).map((s) => s.replace(/^\/+|\/+$/g, "")).filter((s) => s.length > 0).join("/");
	return tail.length === 0 ? `${baseTrim}/` : `${baseTrim}/${tail}`;
}
/** Absolute URL for a route path; paths that are already absolute pass through. */
function absoluteUrl(path) {
	if (/^https?:\/\//i.test(path)) return path;
	return joinUrl(SITE.url, path);
}
function normalizePath$1(path) {
	if (/^https?:\/\//i.test(path)) try {
		path = new URL(path).pathname;
	} catch {}
	let p = path.replace(/\/{2,}/g, "/");
	if (!p.startsWith("/")) p = `/${p}`;
	if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
	return p;
}
/** Cap a page title so `page — SITE.name` fits 60 chars total. */
function capTitle(rawTitle, cap = 60) {
	const suffix = ` — ${SITE.name}`;
	const title = rawTitle.trim();
	const full = title.length > 0 ? `${title}${suffix}` : SITE.title;
	if (full.length <= cap) return full;
	if (title.length === 0) return truncateAtWordBoundary(SITE.title, cap);
	const budget = cap - suffix.length;
	if (budget < 10) return `${truncateAtWordBoundary(title, cap)}…`;
	return `${truncateAtWordBoundary(title, budget)}${suffix}`;
}
function buildJsonLd(opts, kind, canonical) {
	if (kind === "person") return {
		"@context": "https://schema.org",
		"@type": "Person",
		name: SITE.author,
		url: SITE.url,
		description: opts.description.trim() || SITE.description,
		jobTitle: "AI Engineer & Technical Consultant",
		knowsAbout: [
			"LLM systems",
			"data platforms",
			"full-stack engineering"
		]
	};
	if (kind === "article") return {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: opts.title.trim(),
		description: opts.description.trim(),
		inLanguage: SITE.lang,
		author: {
			"@type": "Person",
			name: SITE.author
		},
		publisher: {
			"@type": "Person",
			name: SITE.author
		},
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": canonical
		},
		image: absoluteUrl(opts.image ?? SITE.defaultImagePath),
		...opts.publishedTime ? { datePublished: opts.publishedTime } : {}
	};
	return {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		name: opts.title.trim(),
		description: opts.description.trim(),
		url: canonical,
		inLanguage: SITE.lang,
		isPartOf: {
			"@type": "WebSite",
			name: SITE.name,
			url: SITE.url
		}
	};
}
/** Build the complete meta bundle for one route. Pure — no window access. */
function pageMeta(opts) {
	const path = normalizePath$1(opts.path);
	const canonical = absoluteUrl(path);
	const isHome = path === "/";
	const type = opts.type ?? (opts.publishedTime ? "article" : "website");
	const ogType = opts.ogType ?? (type === "article" ? "article" : isHome ? "website" : "website");
	const titlePlain = capTitle(opts.title);
	const descriptionRaw = opts.description.trim() || SITE.description;
	const description = descriptionRaw.length > 160 ? truncateAtWordBoundary(descriptionRaw, 159) : descriptionRaw;
	const kind = opts.jsonLdKind ?? (isHome ? "person" : type === "article" ? "article" : "collection");
	return {
		title: escapeHtml(titlePlain),
		titlePlain,
		description,
		canonical,
		path,
		image: absoluteUrl(opts.image ?? SITE.defaultImagePath),
		type,
		ogType,
		...opts.publishedTime ? { publishedTime: opts.publishedTime } : {},
		robots: (opts.robots ?? ["index", "follow"]).join(","),
		lang: "en_US",
		twitterCard: opts.image ? "summary_large_image" : "summary",
		jsonLd: buildJsonLd({
			...opts,
			description
		}, kind, canonical),
		rssUrl: absoluteUrl(SITE.rssPath)
	};
}
/**
* Ordered markup tags for the document <head>. Order is pinned (tests assert
* it): title → meta charset-free essentials → description → canonical → RSS →
* robots → OG block → Twitter block → JSON-LD.
*
* The prerenderer joins these into index.html; the runtime uses `titlePlain`
* (see applyDocumentMeta) so DOM and prerender never disagree.
*/
function buildHead(meta) {
	const tags = [];
	tags.push(`<title>${meta.title}</title>`);
	tags.push(`<meta name="description" content="${escapeHtml(meta.description)}">`);
	tags.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}">`);
	tags.push(`<link rel="alternate" type="application/rss+xml" title="${escapeHtml(`${SITE.name} RSS`)}" href="${escapeHtml(meta.rssUrl)}">`);
	tags.push(`<meta name="robots" content="${escapeHtml(meta.robots)}">`);
	tags.push(`<meta property="og:site_name" content="${escapeHtml(SITE.name)}">`);
	tags.push(`<meta property="og:type" content="${escapeHtml(meta.ogType)}">`);
	tags.push(`<meta property="og:title" content="${escapeHtml(meta.titlePlain)}">`);
	tags.push(`<meta property="og:description" content="${escapeHtml(meta.description)}">`);
	tags.push(`<meta property="og:url" content="${escapeHtml(meta.canonical)}">`);
	tags.push(`<meta property="og:image" content="${escapeHtml(meta.image)}">`);
	tags.push(`<meta property="og:locale" content="${escapeHtml(meta.lang)}">`);
	if (meta.publishedTime) tags.push(`<meta property="article:published_time" content="${escapeHtml(meta.publishedTime)}">`);
	tags.push(`<meta name="twitter:card" content="${escapeHtml(meta.twitterCard)}">`);
	tags.push(`<meta name="twitter:site" content="@${escapeHtml(SITE.twitter)}">`);
	tags.push(`<meta name="twitter:title" content="${escapeHtml(meta.titlePlain)}">`);
	tags.push(`<meta name="twitter:description" content="${escapeHtml(meta.description)}">`);
	tags.push(`<meta name="twitter:image" content="${escapeHtml(meta.image)}">`);
	const ld = JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
	tags.push(`<script type="application/ld+json">${ld}<\/script>`);
	return tags;
}
/**
* Runtime counterpart (client only): set document.title + description +
* canonical on route change. Guarded so importing this module in Node never
* touches document.
*/
function applyDocumentMeta(meta) {
	if (typeof document === "undefined") return;
	try {
		document.title = meta.titlePlain;
		const set = (selector, create, attrName, value) => {
			let el = document.head.querySelector(selector);
			if (!el) {
				el = create();
				document.head.appendChild(el);
			}
			el.setAttribute(attrName, value);
		};
		set("meta[name=\"description\"]", () => document.createElement("meta"), "content", meta.description);
		set("link[rel=\"canonical\"]", () => document.createElement("link"), "href", meta.canonical);
	} catch {}
}
var content_default = {
	generatedAt: "2026-10-08T06:02:42.526Z",
	projects: [
		{
			"slug": "system-monitor",
			"title": "System Monitor MCP Fleet",
			"summary": "Three local monitoring services built on pure-stdlib /proc readers — a FastMCP query server with 8 telemetry tools, a sqlite-backed threshold alerting server with a CLI exit-code contract, and a unified FastAPI dashboard rendering Rich-styled gauges, tasks and violations across four routes. 61 tests, all load-independent via known-answer fixtures.",
			"tags": [
				"mcp",
				"fastapi",
				"python",
				"monitoring",
				"testing"
			],
			"date": "2026-10-07",
			"role": "Design and implementation (solo)",
			"status": "shipped",
			"period": "2026",
			"highlights": [
				"8 MCP tools for CPU, memory, disk, network, processes, uptime, health verdicts and a full snapshot — exact integer bytes from /proc and statvfs, CPU% from a two-sample /proc/stat delta",
				"Every reading flows through a keyword-free module-level seam the tests monkeypatch with fixture files, so known-answer assertions (exact CPU%, exact memory bytes, exactly 2 violations on a breach fixture) pass identically under any machine load",
				"Alert rules persist in a private sqlite db via ALERT_MCP_DB; the server refuses to open kanban.db/tasks.db and never writes outside /tmp, and the CLI exits 2 when any rule fires",
				"The dashboard imports the two MCP modules read-only — neither file modified — and mounts HTML, /metrics, /tasks and /alerts routes; its tests use starlette TestClient with tmp dbs only",
				"Hardened 2026-10-07 under mypy strict after an initial 2026-07-10 FastMCP build"
			],
			"stack": [
				"Python 3.13",
				"mcp SDK (FastMCP)",
				"FastAPI + Jinja2",
				"sqlite3",
				"/proc"
			],
			"metrics": [
				{
					"label": "tests",
					"value": "61 passed (verified 2026-10-08)"
				},
				{
					"label": "MCP query tools",
					"value": "8"
				},
				{
					"label": "dashboard routes",
					"value": "4"
				}
			],
			"featured": false
		},
		{
			"slug": "ds-core",
			"title": "ds_core Data Science Toolkit",
			"summary": "Pure-Python data science toolkit backed by the DuckDB CLI subprocess — 38 modules covering a DuckDB DataFrame, statistics, clustering, dimensionality reduction, ensembles, calibration and conformal prediction intervals, with no Python duckdb binding and no numpy at runtime. Survived a five-reviewer, module-by-module audit that confirmed 26 bugs (5 critical) — every one fixed and verified against a concrete reproduction.",
			"tags": [
				"data-science",
				"duckdb",
				"python",
				"ml",
				"testing"
			],
			"date": "2026-08-16",
			"role": "Design, implementation and adversarial audit (solo)",
			"status": "shipped",
			"period": "2026",
			"highlights": [
				"38 modules, all running on stdlib + subprocess calls to the duckdb binary — genuine Lloyd's k-means, power-iteration PCA, Lee & Seung NMF, logistic-loss gradient boosting, bootstrap random forests, all hand-rolled and audit-verified",
				"2026-07-12 full-codebase audit by 5 reviewers found 26 confirmed findings (5 CRITICAL, 16 HIGH, 4 MEDIUM, 1 LOW); all fixed with 72 inline AUDIT FIX comments, plus 3 extra bugs surfaced only while verifying",
				"Fixes proven by measurement, not inspection — t-SNE same-cluster 5-NN accuracy 0.57 to 0.97, UMAP cluster separation chance to 1.0, AutoML selection leakage removed (validation 0.95 vs honest test 0.90), new Platt/isotonic calibrators cut ECE 0.221 to 0.019",
				"Security hardening in the same pass — HTML/JS escaping in report and dashboard generators, a trusted_sql opt-in gate on Pipeline.load, and path-traversal refusal in the model downloader",
				"One honest gap: the seeded fractional-sample test intermittently fails its tolerance band — 294/295 tests pass on a fresh 2026-10-08 run and the flake is documented, not deleted"
			],
			"stack": [
				"Python 3.11+",
				"DuckDB CLI subprocess",
				"stdlib only",
				"pytest"
			],
			"metrics": [
				{
					"label": "modules",
					"value": "38"
				},
				{
					"label": "audit findings fixed",
					"value": "26 (+3 found during verification)"
				},
				{
					"label": "test suite",
					"value": "295 tests"
				}
			],
			"featured": true
		},
		{
			"slug": "gov-payroll-workbench",
			"title": "Gov Payroll Analytics Workbench",
			"summary": "End-to-end analytics pipeline over a 23-table, ~279M-row ClickHouse database of government payroll, PPP loans and federal spending: a JSON-RPC/SSE query client, 14 re-runnable probe datasets that embed their own SQL and timings, and a single self-contained dark-theme dashboard with a 51-tile US map, dual-axis SVG trends and a full SQL provenance section.",
			"tags": [
				"data-viz",
				"clickhouse",
				"python",
				"analytics",
				"dashboards"
			],
			"date": "2026-08-16",
			"role": "Design and implementation (solo)",
			"status": "shipped",
			"period": "2026-08",
			"highlights": [
				"The sandbox cannot reach the ClickHouse HTTP port directly — the query layer drives the clickhouse-mcp server over JSON-RPC with SSE responses, session-id handshakes, retry and stale-session re-handshake",
				"Every dataset is self-documenting — each data/*.json embeds the exact SQL, per-attempt elapsed time and row count, and the dashboard ships a provenance section exposing all of it",
				"Three real ClickHouse quirks diagnosed and worked around — missing arbitrary() (error 46), alias-shadowing ILLEGAL_AGGREGATION (error 184), and non-uniform column names like fiscal_year stored as the string FY2026",
				"Two coverage traps caught before they lied — QCEW carries 9 aggregation levels per county (~9x overstate unless filtered to agglvl_code 70) and federal awards store cumulative modifications (~12x overstate until deduped to final obligation per award)",
				"KPIs are recomputed from the rows at build time, never hardcoded; the single index.html embeds data as a JSON island and opens over file:// with zero network requests"
			],
			"stack": [
				"Python 3.13 stdlib",
				"ClickHouse 24.3",
				"MCP JSON-RPC + SSE",
				"vanilla JS/CSS"
			],
			"metrics": [
				{
					"label": "database",
					"value": "23 tables, ~279M rows"
				},
				{
					"label": "probe datasets",
					"value": "14, each under 0.3 s server-side"
				},
				{
					"label": "dashboard",
					"value": "1 self-contained HTML file"
				}
			],
			"featured": false
		},
		{
			"slug": "langfuse-dashboard",
			"title": "Langfuse Observability Dashboard",
			"summary": "Air-gapped observability dashboard for Langfuse traces: a re-runnable fetch pipeline (traces, observations, sessions, scores) plus a single-file, dark-theme dashboard with KPIs, time-series, model breakdown and a trace drill-down. The ingestion broker's whitelist blocks data-plane reads (403), so the shipped build honestly renders a \"no data — read blocked at broker\" state with the 403 evidence recorded verbatim in the fetched JSON.",
			"tags": [
				"llm",
				"observability",
				"langfuse",
				"python",
				"dashboards"
			],
			"date": "2026-08-16",
			"role": "Design and implementation (solo)",
			"status": "active",
			"period": "2026-08",
			"highlights": [
				"Idempotent fetch pipeline: atomic rewrites, page- and cursor-based pagination, ~5000-item caps per collection",
				"Credentials from environment only; no secret ever printed or written to disk",
				"Single-file dashboard, zero network requests, data embedded as a JS const so it opens over file://",
				"Trace explorer drills into the observations parent/child tree with latency, usage and I/O previews",
				"Verified broker behaviour endpoint by endpoint: health/projects OK, traces/observations/sessions/scores all 403 — failure recorded, nothing fabricated"
			],
			"stack": [
				"Python",
				"Langfuse SDK v4.14.3",
				"Langfuse 3.200.0",
				"vanilla JS/CSS"
			],
			"featured": false
		},
		{
			"slug": "model-quality-harness",
			"title": "Model Quality Harness",
			"summary": "Deterministic tool-calling reliability benchmark for local LLMs behind an OpenAI-compatible LiteLLM broker: a fixed 8-scenario suite, simulated tool execution, rule-by-rule scoring with no LLM judge, and a standalone HTML dashboard rendered from the real results JSON.",
			"tags": [
				"evals",
				"llm",
				"testing",
				"python",
				"dashboards"
			],
			"date": "2026-08-16",
			"role": "Design and implementation (solo)",
			"status": "shipped",
			"period": "2026-08",
			"highlights": [
				"8-scenario fixed suite: single-tool lookups, multi-constraint calls, two-step dependencies, and a retry scenario where the simulator rejects the first call",
				"Deterministic judge only — schema-valid tool-call JSON, parameter accuracy under normalization, and success criteria like call_made / params_exact / param_absent / answer_contains",
				"Tracks silent failures HTTP 200 hides: empty_content_turns, reasoning_burn_turns (finish_reason=length with content null), finish_reason per turn",
				"Proved the broker response-cached identical request bodies (~0.01 s replays); cache-busting user stamps restored real latency distributions (min 0.83 s / med 1.31 s / max 3.72 s)",
				"Broker outages are recorded as failures with the real HTTP error body, never papered over"
			],
			"stack": [
				"Python 3.13",
				"stdlib only",
				"LiteLLM broker",
				"OpenAI-compatible API",
				"vanilla JS/CSS"
			],
			"metrics": [{
				"label": "scenarios x models x reps",
				"value": "8 x 3 x 2"
			}, {
				"label": "best model run (cache-bust re-run)",
				"value": "16/16 completed, 100% valid calls"
			}],
			"featured": true
		},
		{
			"slug": "code-quality-dashboard",
			"title": "Code Quality Metrics MCP",
			"summary": "FastMCP server computing AST-based Python code-quality metrics with only the stdlib ast module — line classification, cyclomatic complexity per function, import inventory and static detection of bare excepts, print calls and oversized parameter lists, exposed as four scan/query/compare/alert tools. Its own scanner flagged its own code, and the findings were fixed.",
			"tags": [
				"mcp",
				"python",
				"static-analysis",
				"developer-tools",
				"testing"
			],
			"date": "2026-08-04",
			"role": "Design and implementation (solo)",
			"status": "shipped",
			"period": "2026",
			"highlights": [
				"Cyclomatic complexity straight from the AST — branch points counted for If, IfExp, For, While, ExceptHandler, With, Assert plus BoolOp AND/OR chains",
				"Three anti-pattern detectors (bare except, print instead of logging, functions over 5 params) turned into file- and function-level alerts with warning/error severities at configurable thresholds (default complexity 10, LOC 500)",
				"Four MCP tools — scan a directory, query files by complexity/LOC ranges, compare two directories, list threshold breaches; the recursive scanner skips venv, __pycache__ and node_modules",
				"Dogfooding closed the loop — its own scan flagged print statements and bare excepts in this codebase, and a follow-up commit replaced them with logging on 2026-08-04",
				"Complexity of the scanner itself was refactored down (72 to 66 total, alert logic 9 to 7) under test coverage"
			],
			"stack": [
				"Python 3.13",
				"stdlib ast",
				"mcp SDK (FastMCP)",
				"pytest"
			],
			"metrics": [
				{
					"label": "MCP tools",
					"value": "4"
				},
				{
					"label": "tests",
					"value": "26 passed (verified 2026-10-08)"
				},
				{
					"label": "detectors",
					"value": "3 anti-patterns"
				}
			],
			"featured": false
		},
		{
			"slug": "duckdb-mcp",
			"title": "DuckDB MCP Server",
			"summary": "Model Context Protocol server exposing 15 DuckDB database tools — query, schema, import/export, profiling, cross-database operations — over stdio JSON-RPC. Drives the DuckDB CLI binary via subprocess (no Python duckdb binding), and encodes 9 benchmark-proven best practices as tested utilities and SQL recipes.",
			"tags": [
				"mcp",
				"duckdb",
				"analytics",
				"python",
				"agents"
			],
			"date": "2026-07-15",
			"role": "Design and implementation (solo)",
			"status": "shipped",
			"period": "2026",
			"highlights": [
				"15 tools spanning query, DDL/DML, CSV/Parquet import-export, profiling, ATTACH-based cross-DB joins",
				"CLI subprocess over the Python binding: no version drift, -json output parsed with recursive type coercion to int/float/bool/None",
				"Multi-statement SQL via temp files and duckdb -f, dodging argument-length limits",
				"9 benchmark-proven best practices as code (bulk insert via generate_series: 100K users in 27 ms; 3x100K cross-DB join in 8 ms; Parquet at ~27% of CSV size), each pinned by an integration test",
				"Pitfall guard for the real DuckDB failure mode: IDENTITY/SERIAL fails, so auto-increment goes through CREATE SEQUENCE + nextval()"
			],
			"stack": [
				"Python 3.11+",
				"mcp SDK",
				"DuckDB CLI 1.5.4+",
				"stdio JSON-RPC",
				"pytest"
			],
			"metrics": [
				{
					"label": "tools exposed",
					"value": "15"
				},
				{
					"label": "benchmark suite",
					"value": "14 benchmarks"
				},
				{
					"label": "100K bulk insert",
					"value": "27 ms"
				}
			],
			"featured": true
		},
		{
			"slug": "orchestrator",
			"title": "Multi-MCP Orchestrator",
			"summary": "Unified CLI over six imported MCP servers — code-quality metrics, tasks, system telemetry, static-site, wiki search, DuckDB analytics — plus a sandbox-wide wiki engine, exposed as ten subcommands with a chained pipeline mode and DuckDB-backed trend queries.",
			"tags": [
				"mcp",
				"cli",
				"python",
				"orchestration",
				"duckdb"
			],
			"date": "2026-06-20",
			"role": "Design and implementation (solo)",
			"status": "shipped",
			"period": "2026",
			"highlights": [
				"Direct Python import of six MCP server modules bypasses stdio/JSON-RPC overhead for same-process composition",
				"Single _call_tool dispatcher normalizes divergent handler return shapes (tuple-with-dict vs list-of-TextContent) behind asyncio.run wrapping",
				"Chained pipeline actions: scan, find, tasks, wiki, db, trends run as one command",
				"Documented integration pitfalls: import order after sys.path setup, _tool_manager._tools vs _tool_map, dispatcher registration order"
			],
			"stack": [
				"Python",
				"MCP servers",
				"DuckDB",
				"asyncio"
			],
			"featured": false
		}
	],
	posts: [
		{
			"slug": "testing-half-your-system-is-a-prompt",
			"title": "Testing when half your system is a prompt",
			"summary": "You cannot unit-test a prompt, so stop trying. Deterministic boundaries, a build that fails on a typo, golden output validated as an artifact, and statistical assertions with reps — the four patterns behind 491 unit tests and 49 browser checks on a site whose content pipeline eats markdown.",
			"tags": [
				"testing",
				"llm",
				"evals",
				"typescript",
				"python"
			],
			"date": "2026-10-06",
			"readingMinutes": 4,
			"series": "AI engineering notes",
			"html": "<p>The honest architecture of most AI systems is: a deterministic shell, a\nstochastic core, and a prompt holding them together. Testing advice usually\nfails at the boundary: teams either unit-test the shell and pretend that\ncovers the system, or give up on automation and QA by vibes. The pattern that\nsurvived contact with two real projects (an LLM eval harness, and this\nportfolio site, which is a markdown-to-browser pipeline the content plan\nhopes counts as a credible prop) is boring and general: <strong>move work across\nthe boundary into the deterministic side, then test the deterministic side\nruthlessly.</strong></p>\n<h2 id=\"boundary-one-the-eval-harness-judges-with-rules-not-opinions\">Boundary one: the eval harness judges with rules, not opinions</h2>\n<p>The harness runs eight tool-calling scenarios against three models with two\nrepetitions each: 48 recorded runs. There is no LLM-as-judge anywhere in the\nscoring path. Every emitted tool call is validated against the scenario's\nJSON function schema, and every final answer is graded by rules like\n<code>answer_contains</code>, which match case-insensitively and tolerate thousands\nseparators (<code>1301.04</code> matches <code>1,301.04</code>). Substring checks are dull. They\nare also reproducible, and reproducibility is the entire job.</p>\n<p>Because the core is stochastic, the assertions get two tools the shell never\nneeds. First, repetitions: two reps per (model, scenario) pair turn &quot;it\nfailed&quot; into &quot;it failed 1 of 2 times,&quot; which is a different bug and a\ndifferent fix. Second, failure modes get named instead of bucketed: the\nharness records <code>empty_content_turns</code> (HTTP 200, <code>content: null</code>) and\n<code>reasoning_burn_turns</code> (<code>finish_reason=length</code> with empty content while\nreasoning tokens burn), because a 200-with-nothing and a budget artifact are\nnot the same incident.</p>\n<p>The shipped run shows why honesty at the boundary matters. One model\ncompleted 16/16 runs at 100% valid calls, and recorded 20 empty-content\nturns anyway: it kept hitting turns that returned nothing usable, and the\nmetric says so. The other two models were down at the broker (a 404 &quot;model\ndoes not exist&quot; and a 500 connection error); both recorded as failures with\nthe real HTTP error bodies attached rather than dropped from the comparison.\nLatency after the cache-bust fix reported an honest distribution: min 0.83\ns, median 1.31 s, max 3.72 s. A harness that hides any of this is marketing.</p>\n<h2 id=\"boundary-two-a-content-pipeline-that-refuses-to-be-fuzzy\">Boundary two: a content pipeline that refuses to be fuzzy</h2>\n<p>This site renders markdown written by the same author who is trying to test\nit, which is exactly the trust problem a prompt layer creates. The answer was\nto make every step deterministic and loud.</p>\n<p><strong>A parser with opinions.</strong> The frontmatter format is a deliberately small\nYAML subset — scalars, inline arrays, one-level nesting, folded blocks — and\nanything outside the grammar throws with the offending line number. Flow\nmappings, tabs, anchors: rejected. Guessing silently is how content\npipelines rot, so the subset guesses nothing.</p>\n<p><strong>Schemas that are <code>.strict()</code> by contract.</strong> Unknown frontmatter keys are a\nbuild error, not a silent no-op: <code>scripts/build-content.mjs</code> runs every file\nthrough zod and exits 1 on any failure, with messages like <code>file: posts/x.md\n› title: &lt;msg&gt;</code>. A typo'd field name cannot become a feature that quietly\nnever renders.</p>\n<p><strong>Output invariants as tests.</strong> <code>src/content/content.test.ts</code> validates the\ngenerated bundle against the whole-bundle schema, asserts unique slugs per\ncollection, date format everywhere, date-descending order, non-empty rendered\nHTML per post, excerpts capped at 140 characters plus an ellipsis, and\ninteger reading minutes. The build sorts with slug tie-breaks so identical\ninputs produce byte-stable output — which makes <code>generated/content.json</code> a\ngolden file: a build artifact the test suite re-validates rather than a\nmystery blob.</p>\n<p><strong>One security policy, both entry points.</strong> The markdown engine's\n<code>sanitizeUrl</code> allows only http/https/mailto and relative URLs (including\nrejecting obfuscation like <code>java\\nscript:</code>), and the frontmatter URL field is\na zod <code>SafeUrl</code> enforcing the same scheme allowlist, because <code>z.string().url()</code>\nalone happily accepts <code>javascript:</code> and <code>data:</code>. One policy, two entry points,\nasserted from both sides: unit tests check the generated HTML never contains\nraw script tags or <code>javascript:</code> hrefs; the browser suite refetches a post\npage and fails if any inline, execution-capable script survived.</p>\n<h2 id=\"the-pyramid-you-can-actually-run-offline\">The pyramid you can actually run offline</h2>\n<p>The container is air-gapped, so the harness is plain Node. Vitest runs in the\n<code>node</code> environment only — there is no jsdom package — so component tests\nrender through <code>renderToStaticMarkup</code> and assert structure: heading order,\nhrefs, rendered content. That is 491 tests across 20 files in about 0.8\nseconds, and it is genuinely useful because SSR caught a class of bugs\n(client hydration) that jsdom fakes anyway.</p>\n<p>Real behavior then moves to the browser: a self-written ~700-line CDP harness\ndrives real Chromium through 49 checks in 7 spec files. Security asserts CSP\n<code>script-src 'self'</code> and <code>frame-ancestors 'none'</code>, nosniff and frame-deny\nheaders, and greps shipped markup for secret shapes (<code>sk-…</code>, <code>AKIA…</code>, bearer\ntokens). Performance enforces budgets rather than aspirations: under 250 kB\nof JS+CSS transferred on the home page, client-side navigation under 1500\nms, and an <code>&lt;h1&gt;</code> present in prerendered HTML so LCP never paints from zero.\nEven nginx gets tested without nginx: <code>config-lint</code> parses the deploy config\nand enforces the add_header inheritance invariant, since one location\ndeclaring a header silently loses every server-level one.</p>\n<p>The prompt half still needs humans, of course — that is what the two\nrepetitions and the named failure modes are for. Everything around it does\nnot, and that is the point. Push the boundary out, name what crosses it, and\ntest the rest like it's a compiler, because from the user's side it is.</p>",
			"excerpt": "The honest architecture of most AI systems is: a deterministic shell, a stochastic core, and a prompt holding them together. Testing advice …"
		},
		{
			"slug": "agent-proof-your-data-layer",
			"title": "Agent-proof your data layer",
			"summary": "Lessons from a 279M-row payroll ETL that an agent could query safely: the aggregation traps that overstate numbers 9x and 12x, why every dataset carries its own SQL, and what idempotency buys you when the re-run is free.",
			"tags": [
				"data-engineering",
				"clickhouse",
				"etl",
				"agents",
				"python"
			],
			"date": "2026-10-04",
			"readingMinutes": 5,
			"series": "AI engineering notes",
			"html": "<p>A human analyst learns the hard way that a table's grain is not what its name\nsuggests. An agent never learns it — it queries whatever you give it,\nconfidently, every time. I built an analytics pipeline over the <code>gov_payroll</code>\nClickHouse database (23 tables, ~279M rows) in the local-ai-lab sandbox, and\nthe process of making it safe to point an agent at it taught me more about\ndata hygiene than any governance framework deck.</p>\n<p>The pipeline is three stages: a query layer, a probe script that materializes\n14 datasets as JSON, and a build step that compiles them into a single\nself-contained dashboard. Python 3.13 stdlib only, no pip, no CDN, and a\nread-only ClickHouse MCP server as the only data path. The read-only part is\nload-bearing: DDL and DML are refused at the server, so the probe script is\naggregate-only by construction, not by discipline.</p>\n<h2 id=\"the-traps-are-in-the-grain-not-the-syntax\">The traps are in the grain, not the syntax</h2>\n<p>Three ClickHouse quirks broke naive queries first (all verified against\n24.3.18): <code>arbitrary()</code> does not exist (error 46, even on literals — use\n<code>any()</code>); aliasing <code>sum(x) AS x</code> then writing <code>avg(x)</code> triggers error 184\nbecause the parser resolves the second <code>x</code> to the alias; and column names\ndrift per table — <code>irs_soi_zip.tax_year</code> instead of <code>year</code>, and\n<code>federal_spending_awards.fiscal_year</code> is the string <code>'FY2026'</code>, so <code>int()</code>\nthrows and a regex parse is mandatory. These fail loudly, which is the good\ncategory of failure.</p>\n<p>The dangerous ones distort silently. <code>bls_qcew_ma</code> stores nine <code>agglvl_code</code>\naggregation levels per county; summing all levels overstates employment\nroughly 9x. The fix is a one-token predicate, <code>agglvl_code = '70'</code>, on every\nQCEW query. <code>federal_spending_awards</code> stores cumulative modifications per\n<code>award_id</code>, so a raw <code>SUM(total_obligated_amount)</code> overstates spending about\n12x; the two federal datasets dedupe to <code>max(total_obligated_amount)</code> per\naward before summing. And <code>municipal_payroll</code> only ever covers one to four\ncities per fiscal year (FY2027: one city, FY2026: two): a &quot;top cities&quot;\nchart built on a partial year ranks a rounding error. The city ranking\ntherefore runs on 2025, the best-coverage year, and the trend view carries a\n<code>cities</code> column so the reader cannot forget the grain.</p>\n<p>None of these raise an exception. A capable agent will write the\nreasonable-looking query, get a number, and cite it. That is the definition\nof an unagent-proofed data layer: correctness depends on tribal knowledge\nthat lives outside the schema.</p>\n<h2 id=\"lineage-is-a-metadata-field-not-a-wiki-page\">Lineage is a metadata field, not a wiki page</h2>\n<p>Every dataset file embeds its own provenance in <code>meta</code>: the exact SQL used,\nper-attempt timings, row count, notes, and a <code>failed</code> flag. The dashboard\ncarries a provenance section rendering the SQL behind every dataset. When a\nnumber looks wrong, the audit path is: open the JSON, read the SQL, re-run\nit. No archaeology.</p>\n<p>This costs nothing if you generate the files programmatically, and it turns\nthe dataset itself into the documentation. When an agent (or a new human)\nwants to know why the federal totals look small, the dedupe CTE is right\nthere in <code>meta.sql</code> — the tribal knowledge moved inside the artifact.</p>\n<h2 id=\"checkpoints-where-the-fan-out-starts\">Checkpoints where the fan-out starts</h2>\n<p><code>00_ranges</code> is the first query: min/max year per core table, one row. It is\ncached, and every subsequent query derives its year filters from it rather\nthan hardcoding 2024 or guessing. That makes the whole 14-query fan-out\ndate-correct without anyone editing files when new years land, and it gives\nthe probe one natural checkpoint: if ranges look wrong, nothing downstream is\ntrusted.</p>\n<p>The rest is boring in the right way. <code>probe.py</code> is idempotent — rewrites\n<code>data/*.json</code> on every run, server-side aggregation keeps every query under\n0.3 s (the shipped run's slowest query: 0.21 s), and re-running is cheap\nenough that refresh is a habit, not an event. The FEC tables, 216M rows of\nthem, were deliberately excluded under the performance rules; a dataset that\ndoes not fit the budget is cut, not apologized for. KPIs on the dashboard are\nrecomputed from the embedded rows at build time, never hardcoded, so the\nheadline numbers and the drill-downs cannot drift apart.</p>\n<h2 id=\"the-transport-is-part-of-the-data-layer\">The transport is part of the data layer</h2>\n<p>The ClickHouse HTTP endpoint is not reachable directly from the sandbox; the\nonly working path is the clickhouse-mcp JSON-RPC server over HTTP plus\nServer-Sent-Events. Four handshakes, one per-session token: send\n<code>Accept: application/json, text/event-stream</code> with <em>both</em> media types or the\nserver rejects you with 406; capture <code>Mcp-Session-Id</code> from the <em>response\nheaders</em> and replay it on every later request; post\n<code>notifications/initialized</code> and expect 202; then <code>tools/call run_query</code> and\nparse the SSE <code>data:</code> line. The query wrapper hides timeout handling, one\nretry, and a stale-session re-handshake, plus normalization of the\n<code>{columns, rows}</code> result shape into dicts.</p>\n<p>That is an unglamorous 279-line module (<code>ch_client.py</code>), and it is why the\nagent-facing interface is one function — <code>query(sql) -&gt; list[dict]</code> —\ninstead of a protocol the model would have to get right at generation time.\nWrap the transport; do not prompt for it.</p>\n<h2 id=\"why-agents-raise-the-stakes\">Why agents raise the stakes</h2>\n<p>A junior analyst who sums nine aggregation levels gets corrected in code\nreview. An agent doing the same thing produces a dashboard, a summary of the\ndashboard, and three confident sentences about it before anyone asks. The\nmitigations are old data-engineering virtues with new urgency: filters that\nencode grain go <em>in</em> the query templates; provenance travels with the data;\nrefresh is idempotent so stale numbers never accumulate; and the server says\nread-only even when the prompt says otherwise. None of it is glamorous. All\nof it is what &quot;the agent can be trusted with this data&quot; actually means.</p>",
			"excerpt": "A human analyst learns the hard way that a table's grain is not what its name suggests. An agent never learns it — it queries whatever you …"
		},
		{
			"slug": "langfuse-observability-pragmatic",
			"title": "Pragmatic LLM observability with Langfuse",
			"summary": "What an air-gapped Langfuse dashboard actually needs: the three numbers you check daily, a fetch pipeline that survives a hostile broker, and a shipped empty state that tells the truth about a 403.",
			"tags": [
				"llm",
				"observability",
				"langfuse",
				"python",
				"dashboards"
			],
			"date": "2026-10-02",
			"readingMinutes": 4,
			"series": "AI engineering notes",
			"html": "<p>Every LLM observability demo opens on a gorgeous trace explorer with data in\nit. Nobody demos the part where the dashboard is the deliverable and the data\nplane refuses to cooperate. I built that dashboard for the traces of project\n<code>mesh</code> (org <code>local-ai-lab</code>) on a Langfuse 3.200.0 instance, and it taught me\nmore about observability than any panel layout did.</p>\n<p>The shape: two scripts. <code>fetch_traces.py</code> pulls traces, observations,\nsessions and scores into local JSON; <code>build_dashboard.py</code> compiles them into\na single dark-theme <code>index.html</code>: vanilla JS/CSS, no CDN, zero network\nrequests once built. Both use the SDK client (Langfuse SDK 4.14.3) from the\nsame code path as the <code>langfuse</code> MCP server, so the fetch layer is the one\npiece I'd reuse verbatim under different infrastructure.</p>\n<h2 id=\"the-triangle-you-actually-check-daily\">The triangle you actually check daily</h2>\n<p>Cost, latency, quality, but checked in that order, because that's the order\nthings catch you flat-footed. My KPI header is deliberately small: total\ncost, total tokens split in/out, average trace latency, error count, plus\nsession and trace counts over the date range. Then exactly three drill-downs:</p>\n<ul>\n<li><p><strong>Time series</strong> — per-day trace count as bars, average latency as a line,\ninline SVG with hover tooltips. Latency drift shows up here first.</p></li>\n<li><p><strong>Model breakdown</strong> — per-model calls, tokens, cost, and average latency\nas a table. This is where a cheap-looking model turns into your most\nexpensive one once you multiply by its call volume.</p></li>\n<li><p><strong>Trace explorer</strong> — searchable by name, id, user, tags and model, with a\nclick-through panel showing each trace's observations as a parent/child\ntree linked by <code>parentObservationId</code>, each node carrying level, latency,\nusage and expandable input/output previews.\nEverything the dashboard renders comes from those four collections. Nothing\nis synthesized at build time; KPIs are computed from the fetched rows.</p></li>\n</ul>\n<h2 id=\"the-broker-said-no\">The broker said no</h2>\n<p>Verified on 2026-08-16 (<code>data/step1_verification.txt</code>): the instance answers\n<code>GET /api/public/health</code> with <code>{'version': '3.200.0', 'status': 'OK'}</code> and\n<code>GET /api/public/projects</code> with the <code>lab-project</code> / <code>mesh</code> / <code>local-ai-lab</code>\nmetadata. That's control plane. For data plane:</p>\n<table>\n<thead><tr><th>endpoint</th><th>result</th></tr></thead>\n<tbody>\n<tr><td><code>/api/public/traces</code></td><td>403 — <code>path not allowed by hermes-local langfuse ingestion broker</code></td></tr>\n<tr><td><code>/api/public/v2/observations</code></td><td>403 (same)</td></tr>\n<tr><td><code>/api/public/sessions</code></td><td>403 (same)</td></tr>\n<tr><td><code>/api/public/scores</code></td><td>403 (same)</td></tr>\n</tbody>\n</table>\n<p>An ingestion broker fronting the instance whitelists only a few public API\npaths, and the SDK's read calls hit exactly the blocked ones. Zero traces,\nzero observations, zero sessions, zero scores at build time.</p>\n<p>The interesting decision is what a dashboard does with that. The lazy answer\nis a spinner that never ends. The dishonest answer is demo data. This one\nships in a clean &quot;no data — data-plane read blocked at broker&quot; state: a red\nbanner quoting the 403, zeroed KPIs, and empty states in all four views.\nEach <code>data/*.json</code> records the broker's error verbatim in its <code>error</code> field,\nand <code>fetch_report.json</code> records the whole per-collection picture.</p>\n<h2 id=\"a-fetch-pipeline-built-to-be-re-run\">A fetch pipeline built to be re-run</h2>\n<p>Observability pipelines fail in boring ways, so the boring parts are\nexplicit:</p>\n<ul>\n<li><strong>Idempotent and atomic.</strong> Every run rewrites each JSON file wholesale via\na temp-file-and-replace. Re-running is always safe; partial writes aren't.</li>\n<li><strong>Capped pagination.</strong> Page-based collections (traces, sessions, scores)\nwalk <code>page</code>/<code>limit</code> with <code>limit=100</code> and honor <code>meta.total_pages</code>;\nobservations use the v2 cursor endpoint with <code>limit=1000</code>; the scores API\nhard-caps <code>limit</code> at 100, so the fetcher doesn't fight it. Each collection\nis capped at 5000 items: enough for a dashboard, small enough that the\nembedding step never chokes.</li>\n<li><strong>Field groups requested explicitly.</strong> The observations call names its\nfield groups (<code>core,basic,time,io,metadata,model,usage,metrics,trace_context</code>)\ninstead of accepting whatever default the API guesses for you.</li>\n<li><strong>Credentials from the environment only.</strong> Base URL, public/secret keys and\nenv come from the environment; no secret is ever printed or written to\ndisk, and the JSON files are safe to commit.</li>\n</ul>\n<h2 id=\"rendering-for-a-world-without\">Rendering for a world without <code>fetch()</code></h2>\n<p>The dashboard must open from <code>file://</code>, which means it cannot fetch its own\ndata — the data is embedded as a JS constant in the HTML. Embedding author-\nuncontrolled JSON inside <code>&lt;script&gt;</code> needs one guard most people forget:\n<code>&lt;/</code> is escaped to <code>&lt;\\/</code> during serialization, so a trace name containing\n<code>&lt;/script&gt;</code> cannot end the script tag early. Prose fields are additionally\nescaped on render (<code>&amp; &lt; &gt; &quot;</code> to entities), and the shipped artifact makes\nzero external requests.</p>\n<p>How do you test all that with no data? A throwaway synthetic dataset: charts,\nKPIs, model table, tree nesting, error badges all validated against fake\nrows, then the synthetic data was deleted. The shipped <code>index.html</code> contains\nonly the real (empty) collections. That ordering matters — validate the\nrendering logic while the fake data is obviously fake and quarantined, not\nafter it has been quietly promoted to &quot;sample data.&quot;</p>\n<p>The payoff of this design is that the blocked state is temporary by\nconstruction. The moment the broker allows the read paths, re-running\n<code>fetch_traces.py</code> populates the JSON files, <code>build_dashboard.py</code> re-renders,\nand real KPIs appear with no code changes. Observability infrastructure that\nneeds surgery to become useful is just a screenshot with extra steps.</p>",
			"excerpt": "Every LLM observability demo opens on a gorgeous trace explorer with data in it. Nobody demos the part where the dashboard is the …"
		},
		{
			"slug": "duckdb-for-agent-workflows",
			"title": "DuckDB is the analytics database your agent workflows needed",
			"summary": "What a 14-benchmark suite says about wiring agents to DuckDB: 100K inserts in 27 ms, cross-database joins in 8 ms, Parquet at a quarter of CSV's size — and the DDL shapes that fail loudly when you least expect it.",
			"tags": [
				"duckdb",
				"analytics",
				"agents",
				"python",
				"performance"
			],
			"date": "2026-09-15",
			"readingMinutes": 3,
			"series": "AI engineering notes",
			"html": "<p>When you build tools that let an LLM agent query data, the database choice\nstops being an architecture-slide decision and becomes a <em>failure-mode</em>\ndecision: what happens when the model does something reasonable-sounding but\nslow, or generates DDL that quietly does not work. I benchmarked that question\nthe slow way — a 14-benchmark suite behind the duckdb-mcp server, measuring\neverything from DDL speed to MCP round-trip overhead. The numbers argued for\nDuckDB, and the gotchas were worth the exercise by themselves.</p>\n<h2 id=\"the-numbers-that-changed-my-defaults\">The numbers that changed my defaults</h2>\n<p>All figures below come from the project's benchmark suite (<code>test_benchmarks.py</code>\nand the integration tests that pin each practice), run against DuckDB CLI\nv1.5.4. One machine: 8-core laptop, NVMe, DuckDB 1.5.4 (Variegata) defaults,\nsingle run, warm cache. Treat the ratios as the finding and the absolutes as\nindicative.</p>\n<p><strong>Bulk insert: <code>generate_series</code>, never <code>INSERT VALUES</code>.</strong> 100,000 users land\nin 27 ms via a select-from-generate_series. Hand the same task to a model's\nnatural instinct — long <code>INSERT INTO ... VALUES (...), (...)</code> lists — and you\nare paying parse costs per statement, and the practice guide's rule of thumb\nis to stop generating them past a thousand rows anyway.</p>\n<p><strong>Parquet as the ingest format, not CSV.</strong> Parquet files came in around 27%\nof the equivalent CSV size, and <code>read_parquet</code> queries the file zero-copy\nwithout loading it into a database first. For agent pipelines this matters\ntwice: smaller files mean faster handoffs between pipeline stages and\ncheaper multi-copy retention — files are what agents pass around, after all.</p>\n<p><strong>Cross-database joins are instant.</strong> Three attached databases of 100K rows\neach joined in 8 ms. One caveat that cost me an hour: <code>ATTACH</code> needs a path\nwithin reach of the session doing the attaching (attached <code>:memory:</code>\ndatabases, for what it is worth, do join fine within a single v1.5.4\nsession), and every CLI invocation is a fresh session — so anything doing\ncross-process cross-DB work still means temp files, which the server does\nfor you.</p>\n<p><strong>Window functions scale flat-ish.</strong> ROW_NUMBER, RANK, LAG/LEAD, running\nsums and NTILE at 100K rows all landed in a uniform 6.9–7.5 ms band. The\nkind of analysis an agent is most likely to be asked for is exactly what\ncolumnar engines are boringly good at.</p>\n<p><strong>JSON output is affordable.</strong> The CLI's <code>-json</code> mode adds 9–15% overhead\nversus plain text. For machine-readable tool responses, that is a tax worth\npaying — but see the coercion post, because the JSON types need re-hydration.</p>\n<h2 id=\"the-failure-you-will-only-find-at-runtime\">The failure you will only find at runtime</h2>\n<p>Here is the one the documentation under-sells: on DuckDB v1.5.4, <code>DEFAULT</code>,\n<code>UNIQUE</code>, <code>CHECK</code> and <code>FOREIGN KEY</code> constraints all work fine.\n<code>IDENTITY</code> fails with <code>Constraint not implemented!</code>. <code>SERIAL</code> fails earlier,\nat parse time: v1.5.4 has no <code>SERIAL</code> type at all (<code>Catalog Error: Type with\nname SERIAL does not exist!</code>). Any model\ntrained on Postgres-heavy corpora will generate <code>SERIAL PRIMARY KEY</code> on\ndemand, all day, and every one of those calls dies.</p>\n<p>The fix belongs below the prompt, at the tool level:</p>\n<pre><code class=\"language-sql\">CREATE SEQUENCE user_id_seq;\nCREATE TABLE users (\n  id BIGINT DEFAULT nextval('user_id_seq') PRIMARY KEY,\n  email TEXT UNIQUE CHECK (email LIKE '%@%')\n);\n</code></pre>\n<p>Auto-increment through <code>CREATE SEQUENCE</code> + <code>nextval()</code> works and keeps the\nIDs in the database, where they belong — the practice notes are blunt about\nit: <em>never generate IDs in Python, use DuckDB-native bulk patterns</em>. Because\nthe MCP server exposes schema creation through recipes that already use the\nworking pattern, the model never gets the chance to discover the failure at\n3 a.m. on someone's pipeline.</p>\n<h2 id=\"why-this-matters-for-agents-specifically\">Why this matters for agents specifically</h2>\n<p>An agent workflow is an unpredictable query generator with a budget. Three\nproperties of DuckDB line up with that: it is a library-grade database that\nneeds no server to administer (an agent can be handed a file path and be\nproductive immediately), it is columnar and fast on exactly the analytical\nshapes models tend to write, and its failure modes are loud exceptions\nrather than silent plan degradations.</p>\n<p>The benchmark suite is not an argument that DuckDB beats a warehouse for\neverything — 500K rows is not big data. It is an argument that for the\nagent-tooling niche — single-node files, sub-second interactive queries,\nParquet in the middle, JSON out the other side — the boring choice is the\ndatabase that lets your tools encode the three patterns that work\n(<code>generate_series</code> bulk insert, <code>SEQUENCE</code> auto-increment, Parquet ingest)\nand make the wrong ones impossible.</p>",
			"excerpt": "When you build tools that let an LLM agent query data, the database choice stops being an architecture-slide decision and becomes a …"
		},
		{
			"slug": "mcp-production-lessons",
			"title": "MCP in production: what the spec doesn't tell you",
			"summary": "Field notes from shipping a 15-tool DuckDB MCP server and a six-server orchestrator: stdio lifecycle quirks, argument-length walls, JSON type erosion, return-shape chaos, and why direct imports beat JSON-RPC in-process.",
			"tags": [
				"mcp",
				"agents",
				"python",
				"duckdb",
				"architecture"
			],
			"date": "2026-09-02",
			"readingMinutes": 4,
			"series": "AI engineering notes",
			"html": "<p>The MCP spec is short enough to read in an afternoon and vague enough to hide\nabout a week of debugging in every one of its &quot;implementations MAY&quot; clauses.\nI shipped two projects that live on both sides of that vagueness: <code>duckdb-mcp</code>,\na stdio MCP server exposing 15 DuckDB tools, and <code>orchestrator</code>, a CLI that\ncomposes six MCP servers in one process. Here is what the spec did not warn\nme about.</p>\n<h2 id=\"1-fastmcp-gets-you-a-hello-world-the-low-level-server-is-the-job\">1. FastMCP gets you a hello world; the low-level server is the job</h2>\n<p><code>FastMCP</code> gets you a hello world in ten lines — then hides the three things\nyou need to control. The moment you need a tool\nrouter, structured error semantics, or control over the JSON-RPC lifecycle,\nyou want the lower-level <code>mcp.server.stdio</code> API with an explicit <code>Server</code>\ninstance. The DuckDB server ends up as three pieces: a <code>TOOLS</code> list of\ntool-definition objects with input schemas, a <code>HANDLERS</code> dict mapping tool\nnames to async functions, and a <code>call_tool</code> router that dispatches by name.\nThat separation costs you nothing and pays for itself the first time a tool\nneeds to return a structured error instead of crashing the connection.</p>\n<h2 id=\"2-you-will-hit-the-argument-length-wall\">2. You will hit the argument-length wall</h2>\n<p>My first instinct for running SQL through the DuckDB CLI was\n<code>duckdb -c &quot;SELECT ...&quot;</code>. Multi-statement scripts, or anything with bulk\ndata, eventually dies on the OS argument-length limit. The pattern that\nholds: write the SQL to a temp file and run <code>duckdb -f tmpfile.sql</code>. Same\nfor results: <code>-json</code> mode gives you structured output that you parse\nyourself. Which leads to the next one.</p>\n<h2 id=\"3-json-over-stdio-erodes-your-types\">3. JSON over stdio erodes your types</h2>\n<p>DuckDB's <code>-json</code> output stringifies more than you would guess, though not\nuniformly: ints and bools come back as real JSON types, while\nfloats/decimals/dates are strings — <code>SELECT 42 AS i, 1.23::DECIMAL(18,2) AS d</code>\nreturns <code>{&quot;i&quot;:42,&quot;d&quot;:&quot;1.23&quot;}</code>. Older CLI versions stringified numbers\nwholesale, so pin the version you test against. If you hand that straight to\na model, the model will learn\nthat <code>count</code> looks like <code>&quot;42&quot;</code> and start emitting comparisons against\nstrings. The server has a recursive <code>_coerce_types()</code> pass that walks parsed\nJSON and converts strings back to <code>int</code>, <code>float</code>, <code>bool</code>, and <code>None</code>. Every\ntool boundary where you serialize through the weakest format in the pipe\nneeds a re-hydration step on the way back. Nobody tells you this in the\nprotocol docs because the protocol has no types to lose — your data does.</p>\n<h2 id=\"4-return-shapes-are-folklore-not-a-standard\">4. Return shapes are folklore, not a standard</h2>\n<p>When the orchestrator imports six MCP server modules directly (more on that\nbelow), I found their <code>call_tool</code> implementations do not agree on anything:\none returns a <code>tuple</code> of <code>(list_of_TextContent, dict)</code> where the useful\npayload lives at index 1; the rest return a bare list of <code>TextContent</code> whose\n<code>.text</code> is a JSON string. The dispatcher is 15 lines of shape-sniffing. The\nspec describes what a wire response looks like, not what your in-process\nhandler function returns, so every server you import is a small archaeology\ndig. Two more discoveries, filed under &quot;why are these not in the README&quot;:\ntool listing lives on the private <code>_tool_manager</code>, not the name you will\nguess, so plan on reading the SDK source once; and server\nmodules with top-level imports must be imported <em>after</em> <code>sys.path</code> is set up.</p>\n<h2 id=\"5-in-process-skip-the-wire-entirely\">5. In-process, skip the wire entirely</h2>\n<p>JSON-RPC over stdio exists to cross a process boundary. When the consumer is\nyour own Python CLI, that boundary is pure overhead — serialization,\nsubprocess lifecycle, an event loop per server. The orchestrator imports the\nserver modules directly and calls <code>asyncio.run(server.call_tool(name, kwargs))</code>.\nThat collapses &quot;run a code-quality scan, log the findings as tasks, write a\nwiki report, query the trend in DuckDB&quot; from a distributed-systems problem\ninto one command. The stdio transport stays where it belongs: for external\nclients like Claude Desktop or IDE integrations.</p>\n<h2 id=\"6-the-server-is-where-the-lessons-belong\">6. The server is where the lessons belong</h2>\n<p>duckdb-mcp's most useful feature isn't query execution. It's that\nnine benchmark-proven practices are encoded in the tools themselves: bulk\ninsert via <code>generate_series</code> instead of <code>INSERT VALUES</code>, <code>CREATE SEQUENCE</code>\ninstead of broken <code>IDENTITY</code>/<code>SERIAL</code>, Parquet-first ingest. The server stops\nthe model from choosing the wrong pattern, which is worth more than any\nprompt that says &quot;please prefer bulk inserts&quot;. Treat your MCP server as the\nplace where operational knowledge becomes a tool constraint.</p>\n<p>The spec covers the handshake. Everything above is the part you learn by\nhaving the thing fail at 2 a.m., and all of it is now a unit test.</p>",
			"excerpt": "The MCP spec is short enough to read in an afternoon and vague enough to hide about a week of debugging in every one of its …"
		},
		{
			"slug": "eval-harness-silent-regressions",
			"title": "Building an eval harness that catches silent model regressions",
			"summary": "How a deterministic, no-LLM-judge harness for tool-calling reliability instruments three classes of failure HTTP 200 hides — and the first run caught two of them outright.",
			"tags": [
				"evals",
				"llm",
				"testing",
				"python"
			],
			"date": "2026-08-20",
			"readingMinutes": 4,
			"series": "AI engineering notes",
			"html": "<p>Every team that ships an LLM feature eventually builds an eval harness, and\nevery harness eventually answers the same question wrong: <em>did the model\nsucceed, or did the HTTP layer just return 200?</em> This post is the methodology\nbehind the harness I built for local models behind an OpenAI-compatible\nLiteLLM broker — eight scenarios, three models, two repetitions, and a\nscoring pass that never asks another model for its opinion.</p>\n<h2 id=\"the-scenario-suite-is-fixed-and-adversarial\">The scenario suite is fixed and adversarial</h2>\n<p>The suite ships as eight JSON files. Each scenario defines an OpenAI function\nschema, a user prompt, simulated tool implementations, and success criteria.\nThe scenarios escalate deliberately:</p>\n<ul>\n<li><p><code>weather_tokyo</code>: one tool call, final answer must cite the tool's value.</p></li>\n<li><p><code>table_booking</code>: argument extraction. &quot;Eight people&quot; and &quot;7:30 PM&quot; must\narrive as <code>party_size: 8</code> and <code>19:30</code>.</p></li>\n<li><p><code>pizza_distractor</code>: an expired coupon in context that must <strong>not</strong> appear\nin the call (<code>param_absent</code>).</p></li>\n<li><p><code>inventory_then_reserve</code>: a two-step dependency. Query the catalog, take\nthe SKU from the tool result, reserve with it.</p></li>\n<li><p><code>fx_conversion_retry</code>: the first call uses non-ISO currency names and the\nsimulator <em>rejects</em> it; the model must retry with <code>EUR</code>/<code>USD</code>.\nThe retry scenario is the one that separates models. A single-shot accuracy\nmetric says nothing about whether a model can consume a tool error and\nrecover, which is most of what agent loops actually do.</p></li>\n</ul>\n<h2 id=\"deterministic-judging-on-purpose\">Deterministic judging, on purpose</h2>\n<p>There is no LLM-as-judge anywhere in the pipeline. Each emitted tool call is\nvalidated against the scenario's function schema: no missing required keys,\nno extras, no mistyped params. Parameter accuracy is checked under\nnormalization (numbers compared as floats, strings trimmed and\ncase-insensitive). The final answer is graded with criteria like:</p>\n<pre><code class=\"language-json\">{\n  &quot;type&quot;: &quot;params_exact_any&quot;,\n  &quot;name&quot;: &quot;get_fx_rate&quot;,\n  &quot;params&quot;: { &quot;from_ccy&quot;: &quot;EUR&quot;, &quot;to_ccy&quot;: &quot;USD&quot;, &quot;amount&quot;: 1200 }\n}\n</code></pre>\n<p>(Judge output and results JSON use the key <code>kind</code> for the same concept;\nscenario files, shown above, use <code>type</code>.)</p>\n<p>A fluent-but-wrong answer passes only if it actually states the expected\nvalues (<code>answer_contains</code> matches case-insensitively and tolerates thousands\nseparators, so <code>1,301.04</code> matches <code>1301.04</code>). Yes, substring checks are\ndull. They are also reproducible, which is the property an eval needs when\nits whole job is telling you that Tuesday's deploy made Thursday worse.</p>\n<h2 id=\"what-http-200-hides\">What HTTP 200 hides</h2>\n<p>Three real findings, all from logging one field deeper than the status code.</p>\n<p><strong>Empty content turns.</strong> A turn can return 200 with <code>content: null</code>. The\nharness records <code>empty_content_turns</code> per scenario; a model that &quot;completed&quot;\nwithout ever producing usable content now fails loudly instead of silently.</p>\n<p><strong>Reasoning burn.</strong> One of the tested models is a reasoning model served by\nvLLM. With a small <code>max_tokens</code> the entire output budget disappears into\n<code>reasoning_content</code> while <code>content</code> stays null and <code>finish_reason</code> reads\n<code>length</code>. That combination (<code>finish_reason=length</code> plus empty content plus\nnon-zero reasoning) is scored as a distinct failure mode\n(<code>reasoning_burn_turns</code>). The shipped run recorded zero burn turns; the\nmetric exists because the failure is cheap to instrument and invisible\notherwise. It is also why the reasoning model under test gets\n<code>max_tokens=2048</code> on its generation calls while the others run 1024: at\n1024, its failure looks like model incompetence when it is really a sampling-budget artifact.</p>\n<p><strong>The cache that flattered everyone.</strong> The broker response-caches identical\nrequest bodies. Sending the same JSON body twice returned the cached\ncompletion in ~0.01 s with the same <code>id</code>, which made rep-to-rep variance\nlook near zero and latency look phenomenal. Proof: a repeated body came back\nin 0.01 s versus ~1.4 s for a distinct one. The fix is one field: every\nrequest gets a unique <code>user: mqh-&lt;uuid&gt;</code> stamp to bust the cache. After the\nfix the same model's per-turn latency showed a real distribution: min\n0.83 s, median 1.29 s, max 3.72 s; before the fix it showed a flat line that\nwas never real.</p>\n<h2 id=\"outages-are-data-not-footnotes\">Outages are data, not footnotes</h2>\n<p>During one re-run, two of the three models were down at the broker: one\nreturned a LiteLLM 404 (the upstream model does not exist), the other a 500\nconnection error. Both ran anyway and both were recorded as failures with\nthe real HTTP error bodies attached, and the dashboard shows that honestly\nrather than silently shrinking the comparison to the one live model. Only\ntimeouts and transient codes fail open: 408, 429, and 5xx get the single\nretry; everything else 4xx (a 404 &quot;model does not exist&quot;, a bad request)\nfails fast with the error body attached. A harness\nthat quietly drops unavailable models is not an eval, it is marketing.</p>\n<p>The whole thing is Python 3.13 stdlib only: no pip, no framework, ~5–10\nminutes for a full run, and a standalone vanilla-JS dashboard rendered from\nthe results JSON. An eval harness earns its keep on reproducibility, not\nsophistication: the same input gives you the same number twice, so the day\nthe number moves, you can believe it.</p>",
			"excerpt": "Every team that ships an LLM feature eventually builds an eval harness, and every harness eventually answers the same question wrong: did …"
		}
	],
	videos: [],
	talks: []
};
//#endregion
//#region src/content/schema.ts
/**
* Content schema (CONTRACT.md §4) — the single validation contract between
* content/*.md files, `scripts/build-content.mjs`, and the app.
*
* Every entry carries the shared fields (slug/title/summary/tags/date) plus
* type-specific fields. All schemas are `.strict()`: an unknown frontmatter
* key is a build error, not a silent no-op — that is how content rot gets
* caught at build time instead of at read time.
*/
/** `YYYY-MM-DD`, enforced as a string (JSON has no date type). */
var IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");
/** kebab-case, matching the content file name minus `.md`. */
var Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected a kebab-case slug");
/**
* R1-C #2: z.string().url() is scheme-agnostic — it accepts javascript:,
* data:, file:. Frontmatter URLs render straight into <a href>, so the
* schema must enforce the SAME scheme allowlist the markdown engine's
* sanitizeUrl applies to prose links. One policy, both entry points.
*/
var SafeUrl = z.string().url("expected an absolute URL").refine((u) => /^(https?:|mailto:)/i.test(u), "only http(s)/mailto URLs are allowed");
var baseShape = {
	slug: Slug,
	title: z.string().min(1),
	summary: z.string().min(1),
	tags: z.array(z.string().min(1)),
	date: IsoDate
};
var ProjectLinksSchema = z.object({
	source: SafeUrl.optional(),
	demo: SafeUrl.optional(),
	paper: SafeUrl.optional()
}).strict();
var ProjectMetricSchema = z.object({
	label: z.string().min(1),
	value: z.string().min(1)
}).strict();
var ProjectSchema = z.object({
	...baseShape,
	role: z.string().min(1),
	status: z.enum([
		"shipped",
		"active",
		"archived"
	]),
	period: z.string().min(1),
	highlights: z.array(z.string().min(1)).min(1),
	stack: z.array(z.string().min(1)).min(1),
	/** R2-A A2: links are optional — a project with no *verified* URL shows
	* no link button at all (fabricated source URLs 404 and read as fake). */
	links: ProjectLinksSchema.optional(),
	metrics: z.array(ProjectMetricSchema).optional(),
	featured: z.boolean(),
	accent: z.string().min(1).optional(),
	/** Optional long-form body rendered from the markdown below frontmatter. */
	html: z.string().optional()
}).strict();
var PostSchema = z.object({
	...baseShape,
	readingMinutes: z.number().int().positive(),
	series: z.string().min(1).optional(),
	heroImage: z.string().min(1).optional(),
	/** Sanitized rendered markdown — the build pipeline's output. */
	html: z.string().min(1),
	excerpt: z.string().min(1)
}).strict();
var VideoSchema = z.object({
	...baseShape,
	url: SafeUrl,
	embedId: z.string().min(1).optional(),
	provider: z.enum([
		"youtube",
		"vimeo",
		"other"
	]),
	duration: z.string().min(1),
	speakers: z.array(z.string().min(1)).optional(),
	event: z.string().min(1).optional()
}).strict();
var TalkSchema = z.object({
	...baseShape,
	event: z.string().min(1),
	location: z.string().min(1),
	slidesUrl: SafeUrl.optional(),
	videoUrl: SafeUrl.optional(),
	abstract: z.string().min(1)
}).strict();
/** Whole generated bundle — what `src/content/generated/content.json` must satisfy. */
var SiteContentSchema = z.object({
	generatedAt: z.string().min(1),
	projects: z.array(ProjectSchema),
	posts: z.array(PostSchema),
	videos: z.array(VideoSchema),
	talks: z.array(TalkSchema)
}).strict();
//#endregion
//#region src/content/index.ts
/**
* Content access layer — the app's only door to `src/content/generated/content.json`
* (produced by scripts/build-content.mjs from content/*.md; CONTRACT §4/§5).
*
* The bundle is re-validated with the zod schema at import time. The build
* script already validates, so a failure here means the JSON was hand-edited
* or generated by a stale/mismatched pipeline — throw loudly, do not degrade.
*/
function validate() {
	const parsed = SiteContentSchema.safeParse(content_default);
	if (!parsed.success) {
		const first = parsed.error.issues.slice(0, 5).map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
		throw new Error(`content: generated/content.json does not match SiteContentSchema — rebuild with \`node scripts/build-content.mjs\`.\n${first}`);
	}
	const { generatedAt: _generatedAt, ...site } = parsed.data;
	return site;
}
var content = validate();
function getProject(slug) {
	return content.projects.find((p) => p.slug === slug);
}
function getPost(slug) {
	return content.posts.find((p) => p.slug === slug);
}
/** Newest first; date-identical entries keep stable slug order. */
function postsByDate() {
	return [...content.posts].sort((a, b) => a.date === b.date ? a.slug.localeCompare(b.slug) : a.date < b.date ? 1 : -1);
}
function featuredProjects() {
	return content.projects.filter((p) => p.featured);
}
//#endregion
//#region src/lib/route-meta.ts
/**
* Route metadata — the single source of truth for per-route <title> /
* description / og:image, shared between prerender (build time) and the
* client (SPA navigation, R2C-3).
*
* Keeping it here (rather than inside prerender/entry.ts) means an SPA
* navigation updates the head with EXACTLY the values the prerendered page
* shipped — DOM and prerender can never drift.
*/
var SITE_FALLBACK_DESCRIPTION = SITE.description;
function titleFor(path) {
	if (path === "/") return "";
	if (path === "/404") return "Page not found";
	const seg = path.split("/")[1];
	const pageNames = {
		about: "About",
		now: "Now",
		projects: "Projects",
		writing: "Writing",
		videos: "Videos",
		talks: "Talks",
		contact: "Contact"
	};
	if (seg === "projects") {
		const slug = path.split("/")[2];
		if (slug) return `${content.projects.find((p) => p.slug === slug)?.title ?? "Project"} — Projects`;
		return "Projects";
	}
	if (seg === "writing") {
		const slug = path.split("/")[2];
		if (slug) return `${content.posts.find((p) => p.slug === slug)?.title ?? "Post"} — Writing`;
		return "Writing";
	}
	return seg ? pageNames[seg] ?? "" : "";
}
function descriptionFor(path) {
	if (path.startsWith("/projects/")) {
		const slug = path.split("/")[2];
		return content.projects.find((p) => p.slug === slug)?.summary ?? SITE_FALLBACK_DESCRIPTION;
	}
	if (path.startsWith("/writing/")) {
		const slug = path.split("/")[2];
		const post = content.posts.find((p) => p.slug === slug);
		return post?.excerpt || post?.summary || SITE_FALLBACK_DESCRIPTION;
	}
	return SITE_FALLBACK_DESCRIPTION;
}
var SECTION_OG = {
	projects: "/og/projects.png",
	writing: "/og/writing.png"
};
function ogImageFor(path) {
	const seg = path.split("/")[1];
	return seg && SECTION_OG[seg] ? SECTION_OG[seg] : void 0;
}
function publishedFor(path) {
	const slug = path.split("/")[2];
	const post = content.posts.find((p) => p.slug === slug);
	return post ? {
		publishedTime: post.date,
		type: "article"
	} : {};
}
/** Full MetaResult for a route — identical at build time and in the browser. */
function metaFor(path) {
	return pageMeta({
		title: titleFor(path),
		description: descriptionFor(path),
		path,
		...ogImageFor(path) ? { image: ogImageFor(path) } : {},
		...path === "/404" ? { robots: ["noindex", "nofollow"] } : {},
		...path.startsWith("/writing/") ? publishedFor(path) : {}
	});
}
/** Shared across themes: geometry and typography never flip with the theme. */
var shared = {
	font: {
		sans: "'Inter var', 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
		mono: "'JetBrains Mono var', 'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
		sizes: {
			xs: "0.75rem",
			sm: "0.875rem",
			md: "1rem",
			lg: "1.125rem",
			xl: "1.375rem",
			"2xl": "1.75rem",
			"3xl": "2.25rem",
			"4xl": "3rem",
			"5xl": "clamp(2.75rem, 6vw, 4.25rem)"
		},
		weights: {
			normal: 400,
			medium: 500,
			semibold: 600,
			bold: 700
		},
		leading: {
			none: 1,
			tight: 1.15,
			snug: 1.3,
			normal: 1.6,
			relaxed: 1.75
		},
		tracking: {
			tight: "-0.02em",
			normal: "0",
			wide: "0.04em",
			wider: "0.09em"
		}
	},
	space: {
		"0": "0",
		"1": "0.25rem",
		"2": "0.5rem",
		"3": "0.75rem",
		"4": "1rem",
		"5": "1.5rem",
		"6": "2rem",
		"7": "3rem",
		"8": "4rem",
		"9": "6rem",
		"10": "8rem",
		"12": "12rem"
	},
	radius: {
		sm: "4px",
		md: "8px",
		lg: "14px",
		xl: "22px",
		full: "9999px"
	},
	layout: {
		maxWidth: "78rem",
		maxWidthProse: "46rem",
		navHeight: "4.25rem",
		gutter: "clamp(1.25rem, 5vw, 3rem)"
	},
	breakpoint: {
		sm: "480px",
		md: "768px",
		lg: "1024px",
		xl: "1280px"
	},
	motion: {
		fast: "120ms",
		base: "220ms",
		slow: "400ms",
		ease: "cubic-bezier(0.2, 0, 0, 1)",
		easeOut: "cubic-bezier(0, 0, 0.2, 1)"
	},
	z: {
		nav: 50,
		dropdown: 60,
		overlay: 80,
		toast: 90
	}
};
var darkTheme = {
	...shared,
	color: {
		bg: "#0b0e14",
		bgElevated: "#11151f",
		bgSunken: "#070910",
		surface: "#151a26",
		surfaceHover: "#1b2130",
		border: "#232a3a",
		borderStrong: "#33405a",
		text: "#eef1f8",
		textMuted: "#9aa5bd",
		textSubtle: "#7c88a3",
		accent: "#5b8cff",
		accentText: "#ffffff",
		accentSoft: "rgba(91, 140, 255, 0.14)",
		accentBorder: "rgba(91, 140, 255, 0.4)",
		success: "#3ddc97",
		warning: "#ffb454",
		danger: "#ff6b81",
		focus: "#7ea2ff",
		scrim: "rgba(4, 6, 12, 0.72)",
		skeleton: "rgba(255, 255, 255, 0.07)"
	},
	shadow: {
		sm: "0 1px 2px rgba(0, 0, 0, 0.4)",
		md: "0 4px 16px rgba(0, 0, 0, 0.45)",
		lg: "0 16px 48px rgba(0, 0, 0, 0.55)",
		glow: "0 0 0 1px rgba(91, 140, 255, 0.35), 0 8px 32px rgba(91, 140, 255, 0.18)"
	}
};
var lightTheme = {
	...shared,
	color: {
		bg: "#eef1f6",
		bgElevated: "#ffffff",
		bgSunken: "#e3e7f0",
		surface: "#ffffff",
		surfaceHover: "#f1f4fa",
		border: "#ccd4e4",
		borderStrong: "#b6c0d4",
		text: "#101725",
		textMuted: "#4a5568",
		textSubtle: "#5d6880",
		accent: "#2f5fe0",
		accentText: "#ffffff",
		accentSoft: "rgba(47, 95, 224, 0.1)",
		accentBorder: "rgba(47, 95, 224, 0.35)",
		success: "#0b7a53",
		warning: "#8f5b04",
		danger: "#c2273f",
		focus: "#2f5fe0",
		scrim: "rgba(16, 23, 37, 0.55)",
		skeleton: "rgba(16, 23, 37, 0.06)"
	},
	shadow: {
		sm: "0 1px 2px rgba(16, 23, 37, 0.06), 0 1px 3px rgba(16, 23, 37, 0.08)",
		md: "0 2px 4px rgba(16, 23, 37, 0.06), 0 8px 24px rgba(16, 23, 37, 0.1)",
		lg: "0 16px 48px rgba(16, 23, 37, 0.16)",
		glow: "0 0 0 1px rgba(47, 95, 224, 0.3), 0 8px 32px rgba(47, 95, 224, 0.14)"
	}
};
var themes = {
	dark: darkTheme,
	light: lightTheme
};
/**
* CSS custom properties mirroring the theme, emitted by <Global>. Useful for
* anything outside React (prerender placeholder states, `prefers-color-scheme`
* in the static shell before hydration).
*/
function themeToCssVars(theme, prefix = "--") {
	const vars = {};
	for (const [key, value] of Object.entries(theme.color)) vars[`${prefix}c-${kebab(key)}`] = value;
	for (const [key, value] of Object.entries(theme.space)) vars[`${prefix}s-${key}`] = value;
	for (const [key, value] of Object.entries(theme.radius)) vars[`${prefix}r-${key}`] = value;
	for (const [key, value] of Object.entries(theme.shadow)) vars[`${prefix}sh-${kebab(key)}`] = value;
	vars[`${prefix}font-sans`] = theme.font.sans;
	vars[`${prefix}font-mono`] = theme.font.mono;
	return vars;
}
function kebab(input) {
	return input.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
/** Concrete palette values expressed as CSS custom-property refs. Values match
* `themeToCssVars` keys exactly; fallbacks mirror the :root defaults. */
var colorVarRefs = Object.fromEntries(Object.keys(darkTheme.color).map((k) => [k, `var(--c-${kebab(k)}, ${darkTheme.color[k]})`]));
var shadowVarRefs = Object.fromEntries(Object.keys(darkTheme.shadow).map((k) => [k, `var(--sh-${kebab(k)}, ${darkTheme.shadow[k]})`]));
/** The theme object components render against: identical object identity
* regardless of active palette (CSS variables carry the difference). */
var appTokens = {
	...darkTheme,
	color: colorVarRefs,
	shadow: shadowVarRefs
};
//#endregion
//#region src/theme/global-styles.ts
function buildGlobalStyles(theme) {
	const cssVars = themeToCssVars(theme);
	return {
		"*, *::before, *::after": { boxSizing: "border-box" },
		html: {
			WebkitTextSizeAdjust: "100%",
			textSizeAdjust: "100%",
			/**
			* Colour-scheme is also set imperatively by ThemeProvider (and by the
			* init script before paint) so native form controls/scrollbars flip;
			* the static value here covers the prerender shell.
			*/
			colorScheme: "dark light",
			scrollBehavior: "smooth"
		},
		body: {
			margin: 0,
			minHeight: "100vh",
			background: `var(--c-bg, ${theme.color.bg})`,
			color: `var(--c-text, ${theme.color.text})`,
			fontFamily: theme.font.sans,
			fontSize: theme.font.sizes.md,
			lineHeight: theme.font.leading.normal,
			WebkitFontSmoothing: "antialiased",
			MozOsxFontSmoothing: "grayscale",
			textRendering: "optimizeLegibility"
		},
		h1: {
			fontSize: theme.font.sizes["4xl"],
			lineHeight: theme.font.leading.tight,
			margin: 0
		},
		h2: {
			fontSize: theme.font.sizes["3xl"],
			lineHeight: theme.font.leading.tight,
			margin: 0
		},
		h3: {
			fontSize: theme.font.sizes["2xl"],
			lineHeight: theme.font.leading.snug,
			margin: 0
		},
		h4: {
			fontSize: theme.font.sizes.xl,
			lineHeight: theme.font.leading.snug,
			margin: 0
		},
		p: {
			marginTop: 0,
			marginBottom: "1em"
		},
		a: {
			color: "var(--c-accent, " + theme.color.accent + ")",
			textDecorationColor: "var(--c-accentBorder, " + theme.color.accentBorder + ")",
			textDecorationThickness: "from-font"
		},
		"a:hover": { textDecoration: "underline" },
		code,
		kbd,
		pre,
		img,
		svg,
		video,
		"input, button, textarea, select": {
			font: "inherit",
			color: "inherit"
		},
		button: {
			cursor: "pointer",
			background: "none",
			border: "none",
			padding: 0
		},
		table: {
			borderCollapse: "collapse",
			borderSpacing: 0
		},
		hr: {
			border: "none",
			borderTop: "1px solid var(--c-border, " + theme.color.border + ")",
			margin: `${theme.space[6]} 0`
		},
		":root": cssVars,
		":root[data-theme=dark]": themeToCssVars(darkTheme),
		":root[data-theme=light]": themeToCssVars(lightTheme),
		":focus-visible": {
			outline: "2px solid var(--c-focus, " + theme.color.focus + ")",
			outlineOffset: "2px",
			borderRadius: theme.radius.sm
		},
		"::selection": {
			background: "var(--c-accentSoft, " + theme.color.accentSoft + ")",
			color: "var(--c-text, " + theme.color.text + ")"
		},
		"@media (prefers-reduced-motion: reduce)": { "*, *::before, *::after": {
			animationDuration: "0.01ms !important",
			animationIterationCount: "1 !important",
			transitionDuration: "0.01ms !important",
			scrollBehavior: "auto !important"
		} }
	};
}
var monoStack = "'JetBrains Mono var', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
var code = {
	fontFamily: monoStack,
	fontSize: "0.9375em",
	background: "var(--c-bg-sunken, rgba(127,127,127,0.12))",
	padding: "0.125em 0.3em",
	borderRadius: "4px"
};
var kbd = {
	fontFamily: monoStack,
	fontSize: "0.875em",
	border: "1px solid var(--c-border, #888)",
	borderRadius: "4px",
	padding: "0.1em 0.35em"
};
var pre = {
	margin: "0",
	overflowX: "auto",
	fontFamily: monoStack,
	lineHeight: "1.6"
};
var img = {
	maxWidth: "100%",
	height: "auto",
	display: "block"
};
var svg = {
	display: "block",
	fill: "currentColor"
};
var video = {
	maxWidth: "100%",
	height: "auto",
	display: "block"
};
//#endregion
//#region src/lib/storage.ts
/**
* Typed, SSR-safe localStorage wrapper.
*
* Three rules govern this file:
* 1. A read NEVER throws. Private-mode Safari throws on `localStorage`
*    *property access itself*, let alone getItem; quota errors throw on set.
*    Everything is wrapped and failures degrade to "no stored value".
* 2. A stored value is only trusted after JSON.parse AND a zod parse. Stale
*    or corrupt data (schema drift, a user pasting junk into devtools) is
*    treated as absent — and removed, so it can't poison later reads.
* 3. Nothing touches `window` unless `typeof window !== 'undefined'`. The
*    site is prerendered in Node; a bare reference during render would crash
*    the build.
*/
/** The preference record persisted by AppThemeProvider (pinned shape). */
var ThemePrefSchema = z.object({ theme: z.enum([
	"system",
	"dark",
	"light"
]) });
/** Storage key used for the theme preference (shared with themeInitScript). */
var THEME_STORAGE_KEY$1 = "portfolio.theme";
var registry = /* @__PURE__ */ new Map();
/** Read + JSON.parse + zod-validate. Any failure (including absent) → undefined. */
function getItem(key, schema) {
	if (typeof window === "undefined") return void 0;
	let raw;
	try {
		raw = window.localStorage.getItem(key);
	} catch {
		return;
	}
	if (raw === null) return void 0;
	let json;
	try {
		json = JSON.parse(raw);
	} catch {
		removeItem(key);
		return;
	}
	const parsed = schema.safeParse(json);
	if (!parsed.success) {
		removeItem(key);
		return;
	}
	return parsed.data;
}
/** Returns false (never throws) on quota errors / private-mode blocks. */
function setItem(key, value) {
	if (typeof window === "undefined") return false;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}
function removeItem(key) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(key);
	} catch {}
}
/**
* A single keyed slot with reactive subscribers — the bridge between
* localStorage (imperative, same-tab silent) and React (needs notifications).
* `set`/`remove` notify synchronously; `get` re-validates every time so an
* external devtools edit is caught, not cached blindly.
*/
function createStore(key, schema) {
	const listeners = /* @__PURE__ */ new Set();
	const notify = (value) => {
		for (const listener of [...listeners]) listener(value);
	};
	let cachedRaw;
	let cachedValue;
	const invalidate = () => {
		cachedRaw = void 0;
	};
	const store = {
		key,
		get: () => {
			if (typeof window === "undefined") return void 0;
			let raw;
			try {
				raw = window.localStorage.getItem(key);
			} catch {
				return cachedValue;
			}
			if (raw === cachedRaw) return cachedValue;
			cachedValue = getItem(key, schema);
			cachedRaw = raw;
			return cachedValue;
		},
		set: (value) => {
			setItem(key, value);
			invalidate();
			notify(value);
		},
		remove: () => {
			removeItem(key);
			invalidate();
			notify(void 0);
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
	};
	registry.set(key, {
		store,
		schema,
		notify
	});
	return store;
}
/** The one store the app ships with: theme preference. */
var themeStore = createStore(THEME_STORAGE_KEY$1, ThemePrefSchema);
if (typeof window !== "undefined") try {
	window.addEventListener("storage", (event) => {
		if (!event.key) return;
		const slot = registry.get(event.key);
		if (!slot) return;
		slot.notify(event.newValue === null ? void 0 : getItem(event.key, slot.schema));
	});
} catch {}
typeof window !== "undefined" && window.document;
/**
* Subscribe to a `store` (src/lib/storage) with React 19's useSyncExternalStore.
* On the server the snapshot is always `undefined`, so server HTML renders the
* "no stored preference" state; the client picks up the stored value on mount.
*/
function useStore(store) {
	return useSyncExternalStore((onChange) => store.subscribe(() => onChange()), () => store.get(), () => void 0);
}
/** Read a media query, never throwing (SSR, old browsers, locked-down iframes). */
function readMediaQuery(query) {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
	try {
		return window.matchMedia(query).matches;
	} catch {
		return false;
	}
}
/**
* Live `window.matchMedia(query)` result. SSR-safe: false on the server and on
* the first client paint, corrected in the effect, updated on every change.
*/
function useMediaQuery(query) {
	const subscribe = useCallback((onChange) => {
		if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
		let mql;
		try {
			mql = window.matchMedia(query);
		} catch {
			return () => {};
		}
		const handler = () => onChange();
		try {
			mql.addEventListener("change", handler);
			return () => mql.removeEventListener("change", handler);
		} catch {
			try {
				mql.addListener(handler);
				return () => mql.removeListener(handler);
			} catch {
				return () => {};
			}
		}
	}, [query]);
	return useSyncExternalStore(subscribe, () => readMediaQuery(query), () => false);
}
/** True when the user asked the OS to reduce motion. Used by every animation. */
function useReducedMotion() {
	return useMediaQuery("(prefers-reduced-motion: reduce)");
}
Object.freeze({
	progress: 0,
	scrolled: 0,
	total: 0
});
/** Pure: modern API vs execCommand fallback (older/insecure-origins browsers). */
async function writeClipboardText(text) {
	if (typeof navigator === "undefined") return false;
	try {
		if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {}
	if (typeof document === "undefined") return false;
	try {
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.setAttribute("readonly", "");
		ta.style.position = "fixed";
		ta.style.left = "-9999px";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		const ok = document.execCommand("copy");
		ta.remove();
		return ok;
	} catch {
		return false;
	}
}
/**
* Copy-to-clipboard with success/failed state and auto-reset. Returns
* `copy(text)` + whether the last copy succeeded. Never throws.
*/
function useCopyToClipboard(resetMs = 2e3) {
	const [copied, setCopied] = useState(false);
	const [failed, setFailed] = useState(false);
	const timerRef = useRef(null);
	useEffect(() => () => {
		if (timerRef.current !== null) clearTimeout(timerRef.current);
	}, []);
	return {
		copy: useCallback(async (text) => {
			const ok = await writeClipboardText(text);
			setCopied(ok);
			setFailed(!ok);
			if (timerRef.current !== null) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				setCopied(false);
				setFailed(false);
				timerRef.current = null;
			}, resetMs);
			return ok;
		}, [resetMs]),
		copied,
		failed
	};
}
/** Debounced mirror of a fast-changing value (search inputs). Leading-edge free by design. */
function useDebouncedValue(value, delayMs = 200) {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(timer);
	}, [value, delayMs]);
	return debounced;
}
/** Resolve a preference + system setting to a concrete theme. Pure, testable. */
function resolveTheme(pref, systemDark) {
	if (pref === "dark" || pref === "light") return pref;
	return systemDark ? "dark" : "light";
}
/**
* The concrete theme + preference, wired to localStorage AND the OS setting.
* Derived from the store: theme-init.js already fixed `data-theme` before
* paint, so server and first client paint agree without an effect-sync pass.
*/
function useThemeNameState() {
	const stored = useStore(themeStore);
	const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
	const preference = stored?.theme ?? "system";
	const themeName = typeof window === "undefined" ? "dark" : resolveTheme(preference, systemDark);
	const setThemeName = useCallback((name) => {
		const pref = { theme: name };
		themeStore.set(pref);
		if (typeof document !== "undefined") try {
			document.documentElement.setAttribute("data-theme", name);
			document.documentElement.style.colorScheme = name;
		} catch {}
	}, []);
	return {
		themeName,
		preference,
		setThemeName,
		cycle: useCallback(() => {
			const next = preference === "system" ? "light" : preference === "light" ? "dark" : "system";
			if (next === "system") {
				themeStore.remove();
				if (typeof document !== "undefined") try {
					const name = resolveTheme("system", systemDark);
					document.documentElement.setAttribute("data-theme", name);
					document.documentElement.style.colorScheme = "dark light";
				} catch {}
			} else setThemeName(next);
		}, [
			preference,
			systemDark,
			setThemeName
		]),
		store: themeStore
	};
}
//#endregion
//#region src/components/layout/ThemePreference.tsx
/**
* ThemePreference — owns *which* theme the visitor wants (dark | light) and the
* DOM side effects that go with it. It does NOT own the Emotion theme itself.
*
* WHY THE SPLIT
* `src/theme/ThemeProvider.tsx` (owned by platform-primitives, CONTRACT §4)
* renders `<ThemeProvider theme={...}>` from `@emotion/react`. Someone still
* has to answer three questions that are awkward to answer inside an Emotion
* provider: where does the preference come from, where is it persisted, and how
* does the document (`data-theme`, `color-scheme`) learn about it before and
* after hydration. That is this file. It is deliberately dependency-free apart
* from tokens, so it can be mounted above the Emotion provider.
*
* SSR SAFETY
* This site is prerendered. No browser global is touched unguarded:
*  - storage / matchMedia reads go through `readStoredTheme()` /
*    `readSystemPreference()`, both `typeof window` guarded and try/catch'd;
*  - the React value comes from `useSyncExternalStore`, whose *server* snapshot
*    is `defaultTheme` — so prerender markup and the first hydration render
*    agree, and the stored preference is applied in a follow-up render. That is
*    the canonical React pattern for "client knows something the server did not"
*    and it avoids the hydration mismatch a naive lazy `useState` would cause.
*  - document mutation happens in effects / event handlers only.
*
* See README.md for the (short) public API and how the platform provider wires
* `activeTheme` into `<ThemeProvider>`.
*/
/** Key used for the persisted preference. Namespaced to survive sibling apps. */
var THEME_STORAGE_KEY = "portfolio.theme";
/** What the prerender and the first hydration render both see. */
var DEFAULT_THEME = "dark";
function isThemeName(value) {
	return value === "dark" || value === "light";
}
/**
* Preference order: explicit storage → OS `prefers-color-scheme` → default.
* `system: undefined` means "unknown" (server, or a browser without
* matchMedia) and must not override the default.
*/
function resolveThemeName(input) {
	if (isThemeName(input.stored)) return input.stored;
	if (input.system === true) return "dark";
	if (input.system === false) return "light";
	return input.defaultTheme ?? "dark";
}
/**
* The document attributes a theme implies. Kept as data (not DOM calls) so it
* can be asserted in a node-environment unit test and reused by the prerender.
*/
function themeDocumentAttributes(name) {
	return {
		rootAttributes: {
			"data-theme": name,
			"data-emotion-theme": name
		},
		metaContent: name
	};
}
function readStoredTheme() {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
		if (raw === null) return null;
		if (raw === "dark" || raw === "light") return raw;
		const parsed = JSON.parse(raw);
		return parsed && (parsed.theme === "dark" || parsed.theme === "light") ? parsed.theme : null;
	} catch {
		return null;
	}
}
function writeStoredTheme(name) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme: name }));
	} catch {}
}
/** true = prefers dark, false = prefers light, undefined = cannot tell. */
function readSystemPreference() {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return void 0;
	try {
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	} catch {
		return;
	}
}
function watchSystemPreference(onChange) {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => void 0;
	let query;
	try {
		query = window.matchMedia("(prefers-color-scheme: dark)");
	} catch {
		return () => void 0;
	}
	const handler = (event) => onChange(event.matches ? "dark" : "light");
	if (typeof query.addEventListener === "function") {
		query.addEventListener("change", handler);
		return () => query.removeEventListener("change", handler);
	}
	const legacy = query;
	legacy.addListener(handler);
	return () => legacy.removeListener(handler);
}
/**
* Mirror the preference onto the document so CSS outside React, the browser
* chrome (form controls, scrollbars, `color-scheme`), and the prerendered shell
* all agree with the React tree.
*/
function applyThemeToDocument(name) {
	if (typeof document === "undefined") return;
	const { rootAttributes, metaContent } = themeDocumentAttributes(name);
	const root = document.documentElement;
	for (const [key, value] of Object.entries(rootAttributes)) root.setAttribute(key, value);
	root.style.colorScheme = name;
	let meta = document.querySelector("meta[name=\"color-scheme\"]");
	if (!meta) {
		meta = document.createElement("meta");
		meta.setAttribute("name", "color-scheme");
		document.head.appendChild(meta);
	}
	meta.setAttribute("content", metaContent);
}
function initialSnapshot() {
	const stored = readStoredTheme();
	const system = readSystemPreference();
	const themeName = resolveThemeName({
		stored,
		system
	});
	if (isThemeName(stored)) return {
		themeName,
		resolvedFrom: "storage"
	};
	if (system !== void 0 && system !== null) return {
		themeName,
		resolvedFrom: "system"
	};
	return {
		themeName,
		resolvedFrom: "default"
	};
}
var snapshot = initialSnapshot();
var listeners = /* @__PURE__ */ new Set();
function emit() {
	for (const listener of listeners) listener();
}
function subscribe(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
function getSnapshot() {
	return snapshot;
}
/**
* Change the preference. Persist + document side effects happen here rather than
* in an effect because callers are event handlers (client-only by definition)
* and we want the `data-theme` flip and the React re-render in the same frame —
* an effect-scheduled flip visibly repaints the document background.
*/
function setThemePreference(name, source = "user") {
	if (!isThemeName(name)) return;
	if (snapshot.themeName === name && snapshot.resolvedFrom === source) return;
	snapshot = {
		themeName: name,
		resolvedFrom: source
	};
	writeStoredTheme(name);
	applyThemeToDocument(name);
	emit();
}
var ThemePreferenceContext = createContext(null);
function ThemePreferenceProvider({ children, defaultTheme = DEFAULT_THEME, followSystem = true }) {
	const serverSnapshot = useMemo(() => ({
		themeName: defaultTheme,
		resolvedFrom: "default"
	}), [defaultTheme]);
	const current = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
	useEffect(() => {
		applyThemeToDocument(snapshot.themeName);
	}, [current.themeName]);
	useEffect(() => {
		if (!followSystem) return void 0;
		return watchSystemPreference((name) => {
			if (isThemeName(readStoredTheme())) return;
			setThemePreference(name, "system");
		});
	}, [followSystem]);
	const setThemeName = useCallback((name) => setThemePreference(name, "user"), []);
	const toggleTheme = useCallback(() => setThemePreference(snapshot.themeName === "dark" ? "light" : "dark", "user"), []);
	const value = useMemo(() => ({
		themeName: current.themeName,
		resolvedFrom: current.resolvedFrom,
		setThemeName,
		toggleTheme,
		activeTheme: themes[current.themeName]
	}), [
		current.themeName,
		current.resolvedFrom,
		setThemeName,
		toggleTheme
	]);
	return /* @__PURE__ */ jsx(ThemePreferenceContext.Provider, {
		value,
		children
	});
}
function useThemePreference() {
	const value = useContext(ThemePreferenceContext);
	if (!value) throw new Error("[layout] useThemePreference must be used inside <ThemePreferenceProvider> — render it above the Emotion ThemeProvider.");
	return value;
}
/**
* Non-throwing probe used by AppThemeProvider (platform) when ThemePreference
* (chrome) may or may not be mounted above it. Present → chrome owns the
* preference and the Emotion theme delegates to it. Absent (unit tests, or a
* future embed) → the platform provider falls back to its own storage logic.
*/
function useThemePreferenceIfPresent() {
	return useContext(ThemePreferenceContext);
}
/**
* Typed view of the Emotion theme. `@emotion/react`'s `useTheme()` returns an
* index-signature `Theme`, which makes `theme.color.accent` untyped; every
* component in this folder goes through here instead.
*/
function useThemeTokens() {
	return useTheme();
}
/**
* True when the visitor asked the OS to reduce motion. `undefined` while
* server-rendering; callers treat that as "no transition" (the CSS side is
* covered by `@media (prefers-reduced-motion: reduce)` regardless).
*/
function usePrefersReducedMotion() {
	const server = useMemo(() => false, []);
	return useSyncExternalStore((listener) => {
		if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => void 0;
		let query;
		try {
			query = window.matchMedia("(prefers-reduced-motion: reduce)");
		} catch {
			return () => void 0;
		}
		const handler = () => listener();
		if (typeof query.addEventListener !== "function") return () => void 0;
		query.addEventListener("change", handler);
		return () => query.removeEventListener("change", handler);
	}, () => readSystemPreferenceReducedMotion(), () => server);
}
function readSystemPreferenceReducedMotion() {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
	try {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
}
/** Respect the preference when calling `scrollTo` / `scrollIntoView`. */
function scrollBehaviorFor(reduced) {
	return reduced ? "auto" : "smooth";
}
var ThemeControllerContext = createContext(null);
/**
* Wrap the whole app. Provides the Emotion theme (tokens), the global stylesheet
* (single source: buildGlobalStyles), document attributes, and the theme
* controller. Renders DARK tokens on the server so the static shell is stable.
*/
function AppThemeProvider({ children, forcedTheme }) {
	const chrome = useThemePreferenceIfPresent();
	const platform = useThemeNameState();
	const controller = useMemo(() => {
		if (!chrome) return platform;
		return {
			themeName: chrome.themeName,
			preference: chrome.resolvedFrom === "user" ? chrome.themeName : "system",
			setThemeName: chrome.setThemeName,
			cycle: () => chrome.setThemeName(chrome.themeName === "dark" ? "light" : "dark")
		};
	}, [chrome, platform]);
	const themeName = forcedTheme ?? controller.themeName;
	const theme = appTokens;
	const concreteTheme = themes[forcedTheme ?? controller.themeName];
	const globalStyles = useMemo(() => buildGlobalStyles(concreteTheme), [concreteTheme]);
	useEffect(() => {
		if (typeof document === "undefined" || chrome) return;
		try {
			document.documentElement.setAttribute("data-theme", themeName);
			document.documentElement.style.colorScheme = controller.preference === "system" ? "dark light" : themeName;
		} catch {}
	}, [
		themeName,
		controller.preference,
		chrome
	]);
	return createElement(ThemeControllerContext.Provider, { value: controller }, createElement(ThemeProvider, { theme }, createElement(Global, { styles: globalStyles }), children));
}
//#endregion
//#region vendor/emotion/styled/src/index.ts
/**
* @emotion/styled (vendored subset).
*
* styled.tag`css`  |  styled(Component)`css`  |  .attrs()  |  .withConfig()
*
* Behaviour:
*  - resolves theme functions against ThemeContext on every render
*  - class name = hash of resolved CSS text (dedupe + prerender/client agreement)
*  - consumer `className` is appended AFTER its own styles (last-wins parity)
*  - `shouldForwardProp` option, plus the transient `$prop` convention: props
*    starting with `$` are available to styles but never reach the DOM
*  - unknown props are filtered out for intrinsic elements (see isPropValid)
*
* Intentionally NOT supported (would silently do the wrong thing if faked):
*  - function-call styles `styled.div({ ... })` return the same as a template —
*    object styles are supported, but the `.withConfig` chained form is limited
*    to options; styles cannot be re-passed there.
*/
var RESERVED = /* @__PURE__ */ new Set([
	"css",
	"className",
	"theme",
	"as",
	"forwardedAs",
	"innerRef"
]);
var ALWAYS_SAFE = /^(data-|aria-)/;
/**
* A pragmatic allow-list of intrinsic-element props. Emotion uses
* `@emotion/is-prop-valid` (a generated DOM prop table); we inline a curated
* equivalent because that package is not installable here. Anything unknown and
* non-DOM-looking is dropped — the safe direction, since it cannot emit a
* "React does not recognize the props" warning. Styling hooks should use
* `$`-transients, which are always consumed.
*/
var SAFE_DOM_PROPS = /* @__PURE__ */ new Set([
	"abbr",
	"accept",
	"acceptCharset",
	"accessKey",
	"action",
	"allow",
	"alt",
	"as",
	"async",
	"autoCapitalize",
	"autoComplete",
	"autoCorrect",
	"autoFocus",
	"autoPlay",
	"autoSave",
	"capture",
	"cellPadding",
	"cellSpacing",
	"charSet",
	"challenge",
	"checked",
	"children",
	"cite",
	"classID",
	"className",
	"colSpan",
	"cols",
	"content",
	"contentEditable",
	"controls",
	"controlsList",
	"coords",
	"crossOrigin",
	"dangerouslySetInnerHTML",
	"dateTime",
	"default",
	"defer",
	"dir",
	"disabled",
	"disablePictureInPicture",
	"download",
	"draggable",
	"encType",
	"enterKeyHint",
	"form",
	"formAction",
	"formEncType",
	"formMethod",
	"formNoValidate",
	"formTarget",
	"frameBorder",
	"headers",
	"height",
	"hidden",
	"high",
	"href",
	"hrefLang",
	"htmlFor",
	"httpEquiv",
	"id",
	"inputMode",
	"integrity",
	"is",
	"keyParams",
	"keyType",
	"kind",
	"label",
	"lang",
	"list",
	"loop",
	"low",
	"manifest",
	"marginHeight",
	"marginWidth",
	"max",
	"maxLength",
	"media",
	"mediaGroup",
	"method",
	"min",
	"minLength",
	"multiple",
	"muted",
	"name",
	"noValidate",
	"nonce",
	"open",
	"optimum",
	"pattern",
	"placeholder",
	"playsInline",
	"poster",
	"preload",
	"profile",
	"readOnly",
	"referrerPolicy",
	"rel",
	"required",
	"reversed",
	"rows",
	"rowSpan",
	"sandbox",
	"scope",
	"scoped",
	"scrolling",
	"seamless",
	"selected",
	"shape",
	"size",
	"sizes",
	"slot",
	"span",
	"spellCheck",
	"src",
	"srcDoc",
	"srcLang",
	"srcSet",
	"start",
	"style",
	"summary",
	"tabIndex",
	"target",
	"title",
	"translate",
	"type",
	"useMap",
	"value",
	"width",
	"window",
	"wrap",
	"role",
	"onCopy",
	"onCut",
	"onPaste",
	"onCompositionEnd",
	"onCompositionStart",
	"onCompositionUpdate",
	"onKeyDown",
	"onKeyPress",
	"onKeyUp",
	"onFocus",
	"onBlur",
	"onChange",
	"onInput",
	"onInvalid",
	"onReset",
	"onSubmit",
	"onClick",
	"onContextMenu",
	"onDoubleClick",
	"onDrag",
	"onDragEnd",
	"onDragEnter",
	"onDragExit",
	"onDragLeave",
	"onDragOver",
	"onDragStart",
	"onDrop",
	"onMouseDown",
	"onMouseEnter",
	"onMouseLeave",
	"onMouseMove",
	"onMouseOut",
	"onMouseOver",
	"onMouseUp",
	"onSelect",
	"onTouchCancel",
	"onTouchEnd",
	"onTouchMove",
	"onTouchStart",
	"onScroll",
	"onWheel",
	"onAbort",
	"onCanPlay",
	"onCanPlayThrough",
	"onDurationChange",
	"onEmptied",
	"onEncrypted",
	"onEnded",
	"onError",
	"onLoadedData",
	"onLoadedMetadata",
	"onLoadStart",
	"onPause",
	"onPlay",
	"onPlaying",
	"onProgress",
	"onRateChange",
	"onSeeked",
	"onSeeking",
	"onStalled",
	"onTimeUpdate",
	"onVolumeChange",
	"onWaiting",
	"onLoad",
	"onAuxClick",
	"onToggle",
	"onPointerDown",
	"onPointerUp",
	"onPointerMove",
	"onPointerEnter",
	"onPointerLeave",
	"onGotPointerCapture",
	"onLostPointerCapture",
	"focusable",
	"viewBox",
	"preserveAspectRatio",
	"d",
	"cx",
	"cy",
	"r",
	"rx",
	"ry",
	"x",
	"x1",
	"x2",
	"y",
	"y1",
	"y2",
	"points",
	"fill",
	"fillOpacity",
	"fillRule",
	"stroke",
	"strokeOpacity",
	"strokeWidth",
	"strokeLinecap",
	"strokeLinejoin",
	"strokeDasharray",
	"strokeDashoffset",
	"strokeMiterlimit",
	"clipPath",
	"clipRule",
	"stopColor",
	"stopOpacity",
	"offset",
	"textAnchor",
	"dominantBaseline",
	"vectorEffect",
	"shapeRendering",
	"transform",
	"transformOrigin",
	"markerEnd",
	"markerStart",
	"markerMid",
	"targetX",
	"targetY",
	"aspectRatio",
	"xmlns",
	"xmlnsXLink"
]);
function isPropValid(prop) {
	return RESERVED.has(prop) || ALWAYS_SAFE.test(prop) || SAFE_DOM_PROPS.has(prop);
}
function mergeForward(base, parent) {
	if (!base) return parent ?? isPropValid;
	if (!parent) return base;
	return (prop) => parent(prop) && base(prop);
}
function buildComponent(tag, displayName, parsers, forward, options) {
	const Inner = forwardRef((rawProps, ref) => {
		const theme = useContext(ThemeContext) ?? emptyTheme;
		const localTheme = rawProps.theme ?? theme;
		const asElement = rawProps.as ?? rawProps.forwardedAs ?? tag;
		const propsForStyles = {
			...rawProps,
			theme: localTheme
		};
		const { name, styles } = serializeStyles(displayName, parsers.map((parse) => {
			const value = parse(propsForStyles);
			return typeof value === "function" ? value(propsForStyles) : value;
		}), propsForStyles);
		const ownClass = registerStyle(name, styles);
		const domProps = {};
		for (const [key, value] of Object.entries(rawProps)) {
			if (key === "as" || key === "forwardedAs" || key === "css" || key === "theme" || key === "className") continue;
			if (typeof asElement === "string") {
				if (key.startsWith("$")) continue;
				if (!forward(key)) continue;
			}
			domProps[key] = value;
		}
		const classNames = [ownClass, rawProps.className].filter(Boolean).join(" ");
		const finalProps = { ...domProps };
		if (classNames) finalProps.className = classNames;
		if (ref) finalProps.ref = ref;
		return createElement(asElement, finalProps);
	});
	Inner.displayName = displayName;
	Inner.__emotionStyled = true;
	Inner.__emotionForwardProp = forward;
	const component = Inner;
	component.withConfig = (nextOptions) => buildComponent(tag, nextOptions.label ?? displayName, parsers, mergeForward(nextOptions.shouldForwardProp, forward), {
		...options,
		...nextOptions
	});
	component.attrs = (attrsInput) => {
		const AttrsComponent = forwardRef((rawProps, ref) => {
			const theme = useContext(ThemeContext) ?? emptyTheme;
			const ctx = {
				...rawProps,
				theme
			};
			const extra = typeof attrsInput === "function" ? attrsInput(ctx) : attrsInput;
			const merged = {
				...rawProps,
				...extra
			};
			if (ref) merged.ref = ref;
			return createElement(component, merged);
		});
		AttrsComponent.displayName = displayName;
		AttrsComponent.__emotionStyled = true;
		const out = AttrsComponent;
		out.withConfig = component.withConfig;
		out.attrs = component.attrs;
		return out;
	};
	return component;
}
function styledCall(tag, options = {}) {
	const label = options.label ?? (typeof tag === "string" ? `styled.${tag}` : tag?.displayName || tag?.name || "Styled");
	const parentForward = typeof tag !== "string" ? tag?.__emotionForwardProp : void 0;
	return ((...args) => buildComponent(tag, label, [() => interpolate(args)], mergeForward(options.shouldForwardProp, parentForward), options));
}
var DOM_TAGS = [
	"a",
	"abbr",
	"address",
	"article",
	"aside",
	"audio",
	"b",
	"bdi",
	"blockquote",
	"body",
	"br",
	"button",
	"canvas",
	"caption",
	"cite",
	"code",
	"col",
	"colgroup",
	"data",
	"dd",
	"del",
	"details",
	"dfn",
	"dialog",
	"div",
	"dl",
	"dt",
	"em",
	"embed",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hr",
	"i",
	"iframe",
	"img",
	"input",
	"ins",
	"kbd",
	"label",
	"legend",
	"li",
	"link",
	"main",
	"map",
	"mark",
	"menu",
	"nav",
	"ol",
	"optgroup",
	"option",
	"output",
	"p",
	"picture",
	"pre",
	"progress",
	"q",
	"s",
	"samp",
	"section",
	"select",
	"slot",
	"small",
	"source",
	"span",
	"strong",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"textarea",
	"tfoot",
	"th",
	"thead",
	"time",
	"tr",
	"u",
	"ul",
	"var",
	"video",
	"wbr",
	"svg",
	"path",
	"circle",
	"rect",
	"line",
	"polyline",
	"polygon",
	"g",
	"defs",
	"stop",
	"linearGradient",
	"radialGradient"
];
/**
* Build the tag map.
*
* `styledCall` is generic over its props, so the returned builder for `'a'` and
* the builder for `'div'` are unrelated types: an array of all 60 tag builders
* is both unassignable to any one of them and too large a union for TypeScript
* to represent. Rather than fight variance inside the loop (where it buys
* nothing), the value is produced untyped and the SINGLE cast at the bottom
* gives `styled` its precise public type. `TagFactory` is the one honest hop —
* everything consumers see is still fully typed, and a mistake in `DOM_TAGS`
* would show up as a missing key on `styled.something`, not a silent `any`.
*/
function buildTagMap() {
	const create = (tag, label) => styledCall(tag, { label });
	const entries = DOM_TAGS.map((tag) => [tag, create(tag, `styled.${tag}`)]);
	return Object.fromEntries(entries);
}
var styled = Object.assign(styledCall, buildTagMap());
//#endregion
//#region src/components/layout/Nav.tsx
/** ROUTES from CONTRACT §3. Detail templates (`/projects/:slug`,
* `/writing/:slug`) and the 404 are deliberately absent: a template is not a
* destination a visitor can choose. */
var NAV_ITEMS = [
	{
		label: "Home",
		to: "/",
		exact: true
	},
	{
		label: "Projects",
		to: "/projects"
	},
	{
		label: "Writing",
		to: "/writing"
	},
	{
		label: "Videos",
		to: "/videos"
	},
	{
		label: "Talks",
		to: "/talks"
	},
	{
		label: "Now",
		to: "/now"
	},
	{
		label: "About",
		to: "/about"
	},
	{
		label: "Contact",
		to: "/contact"
	}
];
/**
* R2-A A7/A11: nav is content-driven. Sections with zero entries (Videos,
* Talks) stay OUT of chrome until seeded — empty-but-advertised tabs read as
* inexperience. The routes still prerender (deep links never 404). `Now` is
* always present: recruiters check it, and it renders honest static copy
* regardless of content counts.
*/
function availableNavItems() {
	return NAV_ITEMS.filter((item) => {
		if (item.to === "/videos") return content.videos.length > 0;
		if (item.to === "/talks") return content.talks.length > 0;
		return true;
	});
}
/** Same normalisation the router applies (`vendor/router` `normalize`). */
function normalizePath(path) {
	if (!path) return "/";
	const withoutQuery = path.split(/[?#]/)[0] ?? "/";
	if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) return withoutQuery.slice(0, -1);
	return withoutQuery || "/";
}
/**
* Active iff the target is the current route or a parent of it — mirrors
* `useIsActive` in `vendor/router` so prop-driven and router-driven rendering
* agree. `exact` exists because `/` would otherwise prefix-match everything.
*/
function isNavActive(item, currentPath) {
	const current = normalizePath(currentPath);
	const target = normalizePath(item.to);
	if (item.exact || target === "/") return current === target;
	return current === target || current.startsWith(`${target}/`);
}
/** Items with their active flag resolved — shared by desktop nav and MobileMenu. */
function decorateNavItems(items, currentPath) {
	return items.map((item) => ({
		...item,
		active: isNavActive(item, currentPath)
	}));
}
var List$1 = styled.ul`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  margin: 0;
  padding: 0;
  list-style: none;

  /* Inside the mobile dialog the same list stacks and grows its hit targets. */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    flex-direction: column;
    align-items: stretch;
    gap: ${(p) => p.theme.space[1]};
  }
`;
var Item$2 = styled.li`
  margin: 0;
`;
/**
* One nav link. Active state is conveyed three ways — colour, a dot marker
* (survives greyscale / colour vision deficiency) and `aria-current="page"` —
* so it never depends on colour alone.
*/
function navLinkClass(active, tokens) {
	return css`
    display: flex;
    align-items: center;
    gap: ${tokens.space[2]};
    min-height: 44px;
    padding: ${tokens.space[2]} ${tokens.space[3]};
    border-radius: ${tokens.radius.md};
    font-family: ${tokens.font.sans};
    font-size: ${tokens.font.sizes.sm};
    font-weight: ${tokens.font.weights.medium};
    line-height: ${tokens.font.leading.snug};
    letter-spacing: ${tokens.font.tracking.normal};
    text-decoration: none;
    white-space: nowrap;
    color: ${active ? tokens.color.text : tokens.color.textMuted};
    background: ${active ? tokens.color.accentSoft : "transparent"};
    transition:
      color ${tokens.motion.fast} ${tokens.motion.ease},
      background-color ${tokens.motion.fast} ${tokens.motion.ease};

    &::after {
      content: '';
      flex: none;
      width: ${active ? "6px" : "0"};
      height: 6px;
      border-radius: ${tokens.radius.full};
      background: ${active ? tokens.color.accent : "transparent"};
    }

    &:hover {
      color: ${tokens.color.text};
      background: ${tokens.color.surfaceHover};
    }

    &:focus-visible {
      outline: 2px solid ${tokens.color.focus};
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `;
}
function Nav$1({ currentPath, items = availableNavItems(), onNavigate, label = "Primary", id, className }) {
	const tokens = useThemeTokens();
	const routerPath = useLocation().pathname;
	const path = currentPath ?? routerPath;
	const decorated = decorateNavItems(items, path);
	return /* @__PURE__ */ jsx(List$1, {
		id,
		className,
		role: "list",
		"aria-label": label,
		"data-testid": "nav-list",
		"data-current-path": path,
		children: decorated.map((item) => /* @__PURE__ */ jsx(Item$2, { children: /* @__PURE__ */ jsx(Link$1, {
			to: item.to,
			className: navLinkClass(item.active, tokens),
			"aria-current": item.active ? "page" : void 0,
			"data-testid": `nav-link-${item.label.toLowerCase()}`,
			"data-active": item.active ? "true" : "false",
			onNavigate,
			children: item.label
		}) }, item.to))
	});
}
//#endregion
//#region src/components/layout/ThemeToggle.tsx
var Button$1 = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => p.theme.space[2]};
  min-width: 44px;
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: transparent;
  color: ${(p) => p.theme.color.textMuted};
  cursor: pointer;
  transition:
    color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    background-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  &:hover {
    color: ${(p) => p.theme.color.text};
    background: ${(p) => p.theme.color.surfaceHover};
    border-color: ${(p) => p.theme.color.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
var Icon$1 = styled.svg`
  width: 18px;
  height: 18px;
  flex: none;
  display: block;
`;
/** Hand-drawn inline SVG — no icon package is installed (CONTRACT §0). */
function SunIcon() {
	return /* @__PURE__ */ jsxs(Icon$1, {
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.8",
		strokeLinecap: "round",
		"aria-hidden": "true",
		focusable: "false",
		"data-testid": "icon-sun",
		children: [/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "4.2"
		}), /* @__PURE__ */ jsx("path", { d: "M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" })]
	});
}
function MoonIcon() {
	return /* @__PURE__ */ jsx(Icon$1, {
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.8",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		focusable: "false",
		"data-testid": "icon-moon",
		children: /* @__PURE__ */ jsx("path", { d: "M20 14.2A8.2 8.2 0 0 1 9.8 4a7.2 7.2 0 1 0 10.2 10.2z" })
	});
}
/** Human label for the theme the button will switch *to*. */
function nextThemeLabel(current) {
	return current === "dark" ? "Switch to light theme" : "Switch to dark theme";
}
function themeAnnouncement(name) {
	return name === "dark" ? "Dark theme" : "Light theme";
}
function ThemeToggle({ showLabel = false, className }) {
	const tokens = useThemeTokens();
	const { themeName, toggleTheme } = useThemePreference();
	const label = nextThemeLabel(themeName);
	const labelClass = css`
    font-family: ${tokens.font.sans};
    font-size: ${tokens.font.sizes.sm};
    font-weight: ${tokens.font.weights.medium};
    color: ${tokens.color.textMuted};
  `;
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Button$1, {
		type: "button",
		onClick: toggleTheme,
		"aria-label": label,
		title: label,
		"data-testid": "theme-toggle",
		"data-theme": themeName,
		className,
		children: [themeName === "dark" ? /* @__PURE__ */ jsx(SunIcon, {}) : /* @__PURE__ */ jsx(MoonIcon, {}), showLabel ? /* @__PURE__ */ jsx("span", {
			className: labelClass,
			children: label
		}) : null]
	}), /* @__PURE__ */ jsx("span", {
		"data-testid": "theme-announcement",
		role: "status",
		"aria-live": "polite",
		className: srClass,
		children: themeAnnouncement(themeName)
	})] });
}
var srClass = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;
//#endregion
//#region src/components/layout/MobileMenu.tsx
/**
* MobileMenu — the small-screen navigation, as a real modal dialog.
*
* No dialog/focus library is installable (CONTRACT §0), so focus handling is
* written here. The parts that can be pure functions are pure and exported for
* direct unit testing, because the offline test environment has no DOM
* (`environment: 'node'`, no jsdom) and cannot simulate a Tab keypress:
*
*   FOCUSABLE_SELECTOR  · the selector the trap queries with
*   nextFocusIndex      · Tab / Shift+Tab cycling, given a count
*   isEscape            · which keydowns close the dialog
*   shouldLockScroll    · body scroll policy while open
*
* The imperative parts (focus(), keydown listener, scroll lock) live in effects
* that only run on the client, so prerendering never touches `document`.
*/
/** id of the element the menu button points at with aria-controls. */
var MOBILE_MENU_ID = "mobile-nav-dialog";
var MOBILE_MENU_LABEL_ID = "mobile-nav-title";
/**
* Focusable elements inside a container, in DOM order. Deliberately excludes
* `[tabindex="-1"]`, disabled controls, and elements hidden by `hidden`.
*/
var FOCUSABLE_SELECTOR = [
	"a[href]",
	"area[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"summary",
	"[tabindex]:not([tabindex=\"-1\"])",
	"details",
	"iframe",
	"[contenteditable]"
].join(", ");
/** Where Tab lands from `index` given `count` focusables, wrapping at the ends. */
function nextFocusIndex(index, count) {
	if (count <= 0) return -1;
	if (index < 0) return 0;
	return (index + 1) % count;
}
/** Same walking backwards (Shift+Tab). */
function prevFocusIndex(index, count) {
	if (count <= 0) return -1;
	if (index < 0) return count - 1;
	return (index - 1 + count) % count;
}
/** Escape closes; nothing else does (not Alt+Escape, not a repeating key). */
function isEscape(event) {
	return event.key === "Escape" && event.repeat !== true;
}
/** Body scroll policy while the dialog is open. */
function shouldLockScroll(open) {
	return open === true;
}
var Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${(p) => p.theme.z.overlay};
  background: ${(p) => p.theme.color.scrim};
  animation: fade-in ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.easeOut};

  /* R1A-06: these were referenced but never defined — the open animation was
   * dead CSS. Nested @keyframes (the Spinner.tsx pattern) flatten verbatim,
   * so the rule ships in the same sheet as the component that uses it. */
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
var Panel$3 = styled.div`
  position: fixed;
  inset: 0 0 auto 0;
  z-index: ${(p) => p.theme.z.overlay + 1};
  max-height: 100dvh;
  overflow-y: auto;
  /* Extreme-mobile (M4): safe-area insets both ends — top for standalone/
   * fullscreen notches, bottom for home-indicator devices. */
  padding: calc(${(p) => p.theme.space[5]} + env(safe-area-inset-top))
    ${(p) => p.theme.layout.gutter}
    calc(${(p) => p.theme.space[6]} + env(safe-area-inset-bottom));
  background: ${(p) => p.theme.color.bgElevated};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
  box-shadow: ${(p) => p.theme.shadow.lg};
  font-family: ${(p) => p.theme.font.sans};
  animation: slide-down ${(p) => p.theme.motion.base} ${(p) => p.theme.motion.easeOut};

  /* R1A-06: defined alongside the reference (see Backdrop note). */
  @keyframes slide-down {
    from {
      transform: translateY(-8px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
var HeaderRow$1 = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[3]};
  margin-bottom: ${(p) => p.theme.space[4]};
`;
var Title$1 = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;
var CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => p.theme.space[2]};
  min-width: 44px;
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]} ${(p) => p.theme.space[3]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: transparent;
  color: ${(p) => p.theme.color.text};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  cursor: pointer;

  &:hover {
    background: ${(p) => p.theme.color.surfaceHover};
    border-color: ${(p) => p.theme.color.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;
var FooterRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[5]};
  padding-top: ${(p) => p.theme.space[4]};
  border-top: 1px solid ${(p) => p.theme.color.border};
`;
var Hint = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};

  /* R2-D V9: "Press Escape" is a keyboard-only affordance — hidden on
   * touch-primary devices, where the tap-outside backdrop closes it. */
  @media (hover: none) {
    display: none;
  }
`;
function MobileMenu({ open, onClose, currentPath, returnFocusRef, staticRender = false }) {
	const panelRef = useRef(null);
	const restoreTarget = useRef(null);
	const titleId = useId();
	useEffect(() => {
		if (!open) return;
		if (!returnFocusRef?.current && typeof document !== "undefined") restoreTarget.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		else restoreTarget.current = returnFocusRef?.current ?? null;
	}, [open, returnFocusRef]);
	useEffect(() => {
		if (staticRender) return;
		if (!open) {
			const target = restoreTarget.current;
			restoreTarget.current = null;
			if (target && typeof target.focus === "function" && target.isConnected && target.offsetParent !== null) target.focus();
			return;
		}
		const panel = panelRef.current;
		if (!panel) return;
		(panel.querySelector(FOCUSABLE_SELECTOR) ?? panel).focus({ preventScroll: true });
	}, [open, staticRender]);
	useEffect(() => {
		if (staticRender || !open || typeof document === "undefined") return;
		const dialog = panelRef.current;
		if (!dialog) return;
		const inerted = [];
		for (const el of Array.from(document.body.children)) {
			if (el.contains(dialog) || el === dialog) continue;
			if (!(el instanceof HTMLElement)) continue;
			if (el.tagName === "SCRIPT" || el.tagName === "TEMPLATE") continue;
			if (el.hasAttribute("inert")) continue;
			el.setAttribute("inert", "");
			inerted.push(el);
		}
		return () => {
			for (const el of inerted) el.removeAttribute("inert");
		};
	}, [open, staticRender]);
	useEffect(() => {
		if (staticRender || !open || typeof document === "undefined") return;
		const onKeyDown = (event) => {
			if (isEscape(event)) {
				event.preventDefault();
				onClose();
				return;
			}
			if (event.key !== "Tab") return;
			const panel = panelRef.current;
			if (!panel) return;
			const focusables = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));
			if (focusables.length === 0) return;
			const active = document.activeElement;
			const index = active ? focusables.indexOf(active) : -1;
			const target = focusables[event.shiftKey ? prevFocusIndex(index, focusables.length) : nextFocusIndex(index, focusables.length)];
			if (target) {
				event.preventDefault();
				target.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [
		open,
		onClose,
		staticRender
	]);
	useEffect(() => {
		if (staticRender || !shouldLockScroll(open) || typeof document === "undefined") return;
		const body = document.body;
		const previous = body.style.overflow;
		body.style.overflow = "hidden";
		return () => {
			body.style.overflow = previous;
		};
	}, [open, staticRender]);
	if (!open) return null;
	const labelId = `${titleId}-${MOBILE_MENU_LABEL_ID}`;
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Backdrop, {
		"data-testid": "menu-backdrop",
		onClick: onClose,
		"aria-hidden": "true"
	}), /* @__PURE__ */ jsxs(Panel$3, {
		ref: panelRef,
		id: MOBILE_MENU_ID,
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": labelId,
		tabIndex: -1,
		"data-testid": "mobile-menu",
		className: css`
          outline: none;
        `,
		children: [
			/* @__PURE__ */ jsxs(HeaderRow$1, { children: [/* @__PURE__ */ jsx(Title$1, {
				id: labelId,
				children: "Navigation"
			}), /* @__PURE__ */ jsxs(CloseButton, {
				type: "button",
				onClick: onClose,
				"data-testid": "menu-close",
				"aria-label": "Close menu",
				children: [/* @__PURE__ */ jsx("svg", {
					viewBox: "0 0 24 24",
					width: "16",
					height: "16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round",
					"aria-hidden": "true",
					focusable: "false",
					children: /* @__PURE__ */ jsx("path", { d: "M6 6l12 12M18 6L6 18" })
				}), "Close"]
			})] }),
			/* @__PURE__ */ jsx(Nav$1, {
				currentPath,
				onNavigate: onClose,
				label: "Mobile",
				id: "mobile-nav-list"
			}),
			/* @__PURE__ */ jsxs(FooterRow, { children: [/* @__PURE__ */ jsx(ThemeToggle, { showLabel: true }), /* @__PURE__ */ jsx(Hint, { children: "Press Escape to close" })] })
		]
	})] });
}
//#endregion
//#region src/components/layout/Header.tsx
/**
* Header — sticky, translucent site header with wordmark, desktop nav,
* theme toggle, and the small-screen menu button + MobileMenu dialog.
*
* Layout notes
* - `position: sticky; top: 0` + `z-index: theme.z.nav`.
* - The blur is `@supports`-gated with a solid fallback colour underneath, so a
*   browser without `backdrop-filter` gets an opaque bar rather than a
*   see-through one (WCAG: text stays legible either way).
* - Desktop nav / mobile button swap purely on CSS breakpoints (`md`), so
*   prerendered markup always contains both and hydration cannot disagree.
* - `aria-expanded` / `aria-controls` on the button describe the dialog that
*   MobileMenu renders; `aria-controls` is present in the CLOSED state too and
*   points at an id that only exists while open — the pattern ARIA permits
*   (`aria-controls` may reference a not-yet-rendered element) and the one the
*   unit tests assert on.
*/
var Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: ${(p) => p.theme.z.nav};
  /* Opaque first, translucent on top where supported — never transparent. */
  background: ${(p) => p.theme.color.bg};
  background: ${(p) => `color-mix(in srgb, ${p.theme.color.bg} 88%, transparent)`};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
  font-family: ${(p) => p.theme.font.sans};

  @supports (backdrop-filter: blur(12px)) {
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
    /* R1-B F7: at 72% opacity the header composites to ~rgb(79,81,86) over
     * white content — nav text fell to 3.19:1 transiently. >=85% keeps every
     * nav pair above AA regardless of what scrolls underneath. */
    background: ${(p) => `color-mix(in srgb, ${p.theme.color.bg} 88%, transparent)`};
  }
`;
var Inner$1 = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[4]};
  min-height: ${(p) => p.theme.layout.navHeight};
  max-width: ${(p) => p.theme.layout.maxWidth};
  margin: 0 auto;
  padding: 0 ${(p) => p.theme.layout.gutter};
`;
function wordmarkClass(tokens) {
	return css`
    display: inline-flex;
    align-items: center;
    gap: ${tokens.space[2]};
    min-height: 44px;
    padding: ${tokens.space[1]};
    border-radius: ${tokens.radius.sm};
    font-family: ${tokens.font.mono};
    font-size: ${tokens.font.sizes.md};
    font-weight: ${tokens.font.weights.bold};
    letter-spacing: ${tokens.font.tracking.tight};
    color: ${tokens.color.text};
    text-decoration: none;

    &:hover {
      color: ${tokens.color.accent};
    }

    &:focus-visible {
      outline: 2px solid ${tokens.color.focus};
      outline-offset: 3px;
    }
  `;
}
var WordmarkMark = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  border-radius: ${(p) => p.theme.radius.sm};
  background: ${(p) => p.theme.color.accent};
  /* R1-B F5: accentText (#fff) on accent is only 3.16:1 in dark — exactly the
   * combo Button.tsx documents as rejected. bg-on-accent is the verified
   * primary pair (6.11 dark / 5.16 light). */
  color: ${(p) => p.theme.color.bg};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.bold};
`;
var DesktopNav = styled.nav`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  margin-left: auto;

  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    display: none;
  }
`;
var Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  flex: none;
`;
var MenuSlot = styled.div`
  display: none;
  align-items: center;

  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    display: flex;
  }
`;
var MenuButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => p.theme.space[2]};
  min-width: 44px;
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]} ${(p) => p.theme.space[3]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: transparent;
  color: ${(p) => p.theme.color.text};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  cursor: pointer;

  &:hover {
    background: ${(p) => p.theme.color.surfaceHover};
    border-color: ${(p) => p.theme.color.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;
var Bars = styled.span`
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  width: 18px;
  height: 18px;

  & i {
    display: block;
    height: 2px;
    width: 100%;
    border-radius: ${(p) => p.theme.radius.full};
    background: currentColor;
    transform-origin: center;
    transition:
      transform ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
      opacity ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};
  }

  & i:nth-child(1) {
    transform: ${(p) => p.$open ? "translateY(5px) rotate(45deg)" : "none"};
  }
  & i:nth-child(2) {
    opacity: ${(p) => p.$open ? 0 : 1};
  }
  & i:nth-child(3) {
    transform: ${(p) => p.$open ? "translateY(-5px) rotate(-45deg)" : "none"};
  }

  @media (prefers-reduced-motion: reduce) {
    & i {
      transition: none;
    }
  }
`;
function Header({ currentPath, menuOpen = false, name = "Alex Rivera" }) {
	const [open, setOpen] = useState(menuOpen);
	const triggerRef = useRef(null);
	const tokens = useThemeTokens();
	const { themeName } = useThemePreference();
	const close = useCallback(() => setOpen(false), []);
	const toggle = useCallback(() => setOpen((value) => !value), []);
	const srOnly = css`
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  `;
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Bar, {
		"data-testid": "site-header",
		"data-theme": themeName,
		children: /* @__PURE__ */ jsxs(Inner$1, { children: [
			/* @__PURE__ */ jsxs(Link$1, {
				to: "/",
				className: wordmarkClass(tokens),
				"data-testid": "wordmark",
				"aria-label": `${name} — home`,
				children: [/* @__PURE__ */ jsx(WordmarkMark, {
					"aria-hidden": "true",
					children: "AR"
				}), name]
			}),
			/* @__PURE__ */ jsx(DesktopNav, {
				"aria-label": "Primary",
				"data-testid": "desktop-nav",
				children: /* @__PURE__ */ jsx(Nav$1, {
					currentPath,
					label: "Primary",
					id: "primary-nav-list"
				})
			}),
			/* @__PURE__ */ jsxs(Actions, {
				"data-testid": "header-actions",
				children: [/* @__PURE__ */ jsx(ThemeToggle, {}), /* @__PURE__ */ jsx(MenuSlot, { children: /* @__PURE__ */ jsxs(MenuButton, {
					type: "button",
					ref: triggerRef,
					onClick: toggle,
					"aria-expanded": open,
					"aria-controls": "mobile-nav-dialog",
					"aria-haspopup": "dialog",
					"data-testid": "menu-button",
					"data-open": open ? "true" : "false",
					children: [/* @__PURE__ */ jsxs(Bars, {
						$open: open,
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ jsx("i", {}),
							/* @__PURE__ */ jsx("i", {}),
							/* @__PURE__ */ jsx("i", {})
						]
					}), /* @__PURE__ */ jsx("span", {
						className: srOnly,
						children: open ? "Close navigation menu" : "Open navigation menu"
					})]
				}) })]
			})
		] })
	}), /* @__PURE__ */ jsx(MobileMenu, {
		open,
		onClose: close,
		currentPath,
		returnFocusRef: triggerRef
	})] });
}
//#endregion
//#region src/components/layout/Footer.tsx
/**
* Handles are NOT known. Each entry is a slot for the site owner to fill; the
* labels are the platforms a technical consultant typically lists.
*/
var SOCIAL_LINKS = [
	{
		label: "GitHub",
		url: "",
		handle: "@your-handle"
	},
	{
		label: "LinkedIn",
		url: "",
		handle: "@your-handle"
	},
	{
		label: "Bluesky",
		url: "",
		handle: "@your-handle"
	}
];
var RSS_HREF = "/rss.xml";
var Shell$3 = styled.footer`
  border-top: 1px solid ${(p) => p.theme.color.border};
  background: ${(p) => p.theme.color.bgSunken};
  color: ${(p) => p.theme.color.textMuted};
  font-family: ${(p) => p.theme.font.sans};
  /* R2-D V3: no margin-top — Layout Main's padding-bottom is the single gap.
   * Both stacked = a 224px dead band above the footer on short pages. */
`;
var Inner = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: ${(p) => p.theme.space[6]};
  max-width: ${(p) => p.theme.layout.maxWidth};
  margin: 0 auto;
  padding: ${(p) => p.theme.space[8]} ${(p) => p.theme.layout.gutter}
    ${(p) => p.theme.space[6]};

  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: minmax(0, 1fr);
    gap: ${(p) => p.theme.space[5]};
    padding-top: ${(p) => p.theme.space[6]};
  }
`;
var Identity = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
`;
var Name = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;
var Role = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
  max-width: ${(p) => p.theme.layout.maxWidthProse};
`;
var Column = styled.nav`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: ${(p) => p.theme.space[5]};
`;
var Heading$1 = styled.h2`
  margin: 0 0 ${(p) => p.theme.space[3]};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;
var LinkLine = styled.li`
  margin: 0;
`;
var ExternalNote = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;
var BottomRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[3]};
  max-width: ${(p) => p.theme.layout.maxWidth};
  margin: 0 auto;
  padding: ${(p) => p.theme.space[4]} ${(p) => p.theme.layout.gutter}
    ${(p) => p.theme.space[6]};
  border-top: 1px solid ${(p) => p.theme.color.border};
`;
var Copy = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;
var TopButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]} ${(p) => p.theme.space[3]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: transparent;
  color: ${(p) => p.theme.color.textMuted};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  cursor: pointer;

  &:hover {
    color: ${(p) => p.theme.color.text};
    background: ${(p) => p.theme.color.surfaceHover};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;
/** Four-digit year, guarded: a bad clock must not print `NaN`. */
function currentYear(now = /* @__PURE__ */ new Date()) {
	const year = now.getFullYear();
	return Number.isFinite(year) && year > 1970 ? year : 2026;
}
function copyrightLine(name, year) {
	return `© ${year} ${name}. All rights reserved.`;
}
function linkClass(tokens) {
	return css`
    display: inline-flex;
    align-items: center;
    gap: ${tokens.space[2]};
    min-height: 44px;
    font-size: ${tokens.font.sizes.sm};
    font-weight: ${tokens.font.weights.medium};
    color: ${tokens.color.textMuted};
    text-decoration: none;
    border-radius: ${tokens.radius.sm};
    transition: color ${tokens.motion.fast} ${tokens.motion.ease};

    &:hover {
      color: ${tokens.color.accent};
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    &:focus-visible {
      outline: 2px solid ${tokens.color.focus};
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `;
}
function Footer({ name = "Alex Rivera", role = "Technical consultant — LLM systems, data platforms, full-stack engineering", now, social = SOCIAL_LINKS, email = "" }) {
	const tokens = useThemeTokens();
	const reduced = usePrefersReducedMotion();
	const year = currentYear(now ?? /* @__PURE__ */ new Date());
	const classes = linkClass(tokens);
	const toTop = () => {
		if (typeof window === "undefined") return;
		window.scrollTo({
			top: 0,
			behavior: scrollBehaviorFor(reduced)
		});
	};
	return /* @__PURE__ */ jsxs(Shell$3, {
		"data-testid": "site-footer",
		children: [/* @__PURE__ */ jsxs(Inner, { children: [/* @__PURE__ */ jsxs(Identity, { children: [/* @__PURE__ */ jsx(Name, { children: name }), /* @__PURE__ */ jsx(Role, { children: role })] }), /* @__PURE__ */ jsxs(Column, {
			"aria-label": "Footer",
			"data-testid": "footer-nav",
			children: [
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(Heading$1, {
					id: "footer-sites-heading",
					children: "Sitemap"
				}), /* @__PURE__ */ jsx("ul", {
					role: "list",
					"aria-labelledby": "footer-sites-heading",
					"data-testid": "footer-sitemap",
					children: availableNavItems().map((item) => /* @__PURE__ */ jsx(LinkLine, { children: /* @__PURE__ */ jsx(Link$1, {
						to: normalizePath(item.to),
						className: classes,
						"data-testid": `footer-link-${item.label.toLowerCase()}`,
						children: item.label
					}) }, item.to))
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(Heading$1, {
					id: "footer-more-heading",
					children: "More"
				}), /* @__PURE__ */ jsxs("ul", {
					role: "list",
					"aria-labelledby": "footer-more-heading",
					"data-testid": "footer-more",
					children: [
						/* @__PURE__ */ jsx(LinkLine, { children: /* @__PURE__ */ jsxs("a", {
							href: RSS_HREF,
							type: "application/rss+xml",
							className: classes,
							"data-testid": "footer-rss",
							children: ["RSS feed", /* @__PURE__ */ jsx(ExternalNote, {
								"aria-hidden": "true",
								children: "/rss.xml"
							})]
						}) }),
						/* @__PURE__ */ jsx(LinkLine, { children: /* @__PURE__ */ jsx("a", {
							href: "/sitemap.xml",
							className: classes,
							"data-testid": "footer-sitemap-link",
							children: "Sitemap"
						}) }),
						/* @__PURE__ */ jsx(LinkLine, { children: email ? /* @__PURE__ */ jsx("a", {
							href: `mailto:${email}`,
							className: classes,
							"data-testid": "footer-email",
							children: "Email"
						}) : /* @__PURE__ */ jsx("span", { dangerouslySetInnerHTML: { __html: "<!-- DRAFT: replace email address in src/lib/seo.ts -->" } }) })
					]
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(Heading$1, {
					id: "footer-social-heading",
					children: "Elsewhere"
				}), /* @__PURE__ */ jsx("ul", {
					role: "list",
					"aria-labelledby": "footer-social-heading",
					"data-testid": "footer-social",
					children: social.map((entry) => /* @__PURE__ */ jsx(LinkLine, { children: entry.url ? /* @__PURE__ */ jsx("a", {
						href: entry.url,
						className: classes,
						target: "_blank",
						rel: "noreferrer noopener",
						"data-testid": `footer-social-${entry.label.toLowerCase()}`,
						children: entry.label
					}) : /* @__PURE__ */ jsx("span", { dangerouslySetInnerHTML: { __html: `<!-- DRAFT: replace handle for ${entry.label} in Footer SOCIAL_LINKS -->` } }) }, entry.label))
				})] })
			]
		})] }), /* @__PURE__ */ jsxs(BottomRow, { children: [/* @__PURE__ */ jsx(Copy, {
			"data-testid": "footer-copyright",
			children: copyrightLine(name, year)
		}), /* @__PURE__ */ jsxs(TopButton, {
			type: "button",
			onClick: toTop,
			"data-testid": "back-to-top",
			"aria-label": "Back to top",
			children: [/* @__PURE__ */ jsx("svg", {
				viewBox: "0 0 24 24",
				width: "16",
				height: "16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				focusable: "false",
				children: /* @__PURE__ */ jsx("path", { d: "M12 19V5M5 12l7-7 7 7" })
			}), "Back to top"]
		})] })]
	});
}
//#endregion
//#region src/components/layout/Layout.tsx
var Shell$2 = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: ${(p) => p.theme.color.bg};
  color: ${(p) => p.theme.color.text};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  -webkit-font-smoothing: antialiased;
`;
var Main = styled.main`
  flex: 1 1 auto;
  width: 100%;
  max-width: ${(p) => p.theme.layout.maxWidth};
  margin: 0 auto;
  padding: ${(p) => p.theme.space[7]} ${(p) => p.theme.layout.gutter}
    ${(p) => p.theme.space[9]};
  outline: none;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: -2px;
  }

  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    padding-top: ${(p) => p.theme.space[5]};
  }
`;
function skipLinkClass(tokens) {
	return css`
    position: absolute;
    top: ${tokens.space[2]};
    left: ${tokens.space[2]};
    z-index: ${tokens.z.toast + 1};
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: ${tokens.space[2]} ${tokens.space[4]};
    border-radius: ${tokens.radius.md};
    background: ${tokens.color.accent};
    color: ${tokens.color.accentText};
    font-family: ${tokens.font.sans};
    font-size: ${tokens.font.sizes.sm};
    font-weight: ${tokens.font.weights.semibold};
    text-decoration: none;
    /* Hidden off-canvas rather than display:none — a hidden element that is
       still focusable is the whole point of a skip link. */
    clip-path: inset(50%);
    clip: rect(0 0 0 0);
    width: 1px;
    height: 1px;
    overflow: hidden;
    white-space: nowrap;

    &:focus,
    &:focus-visible {
      clip-path: none;
      clip: auto;
      width: auto;
      height: auto;
      overflow: visible;
      outline: 2px solid ${tokens.color.focus};
      outline-offset: 2px;
    }
  `;
}
function Layout({ children, currentPath, name = "Alex Rivera", role, menuOpen = false, chrome = true }) {
	const tokens = useThemeTokens();
	const skip = skipLinkClass(tokens);
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Global, { styles: {
		"::selection": {
			background: tokens.color.accentSoft,
			color: tokens.color.text
		},
		"[id]": { scrollMarginTop: tokens.layout.navHeight }
	} }), /* @__PURE__ */ jsxs(Shell$2, {
		"data-testid": "site-shell",
		children: [
			/* @__PURE__ */ jsx("a", {
				href: "#main",
				className: skip,
				"data-testid": "skip-link",
				children: "Skip to main content"
			}),
			chrome ? /* @__PURE__ */ jsx(Header, {
				currentPath,
				name,
				menuOpen
			}) : null,
			/* @__PURE__ */ jsx(Main, {
				id: "main",
				tabIndex: -1,
				"data-testid": "main",
				children
			}),
			chrome ? /* @__PURE__ */ jsx(Footer, {
				name,
				...role ? { role } : {}
			}) : null
		]
	})] });
}
//#endregion
//#region src/components/ui/Icon.tsx
/** 24x24 grid. Strokes use currentColor via the svg's `stroke` attr. */
var PATHS = {
	"arrow-right": /* @__PURE__ */ jsx("path", { d: "M4 12h15m0 0-6-6m6 6-6 6" }),
	"arrow-up": /* @__PURE__ */ jsx("path", { d: "M12 20V5m0 0-6 6m6-6 6 6" }),
	"chevron-left": /* @__PURE__ */ jsx("path", { d: "m15 5-7 7 7 7" }),
	"chevron-right": /* @__PURE__ */ jsx("path", { d: "m9 5 7 7-7 7" }),
	github: /* @__PURE__ */ jsx("path", { d: "M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" }),
	linkedin: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("path", { d: "M5 9v10M5 4.5v.01M10 19v-5.5a3 3 0 0 1 6 0V19" }), /* @__PURE__ */ jsx("path", { d: "M10 9v10" })] }),
	mail: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("rect", {
		x: "3",
		y: "5",
		width: "18",
		height: "14",
		rx: "2"
	}), /* @__PURE__ */ jsx("path", { d: "m3.5 7 8.5 6 8.5-6" })] }),
	rss: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("path", { d: "M5 19a1 1 0 1 0 0-.01M5 12a7 7 0 0 1 7 7M5 5a14 14 0 0 1 14 14" }), /* @__PURE__ */ jsx("circle", {
		cx: "5",
		cy: "19",
		r: "1"
	})] }),
	"external-link": /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx("path", { d: "M14 4h6v6" }),
		/* @__PURE__ */ jsx("path", { d: "M20 4 11 13" }),
		/* @__PURE__ */ jsx("path", { d: "M18 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" })
	] }),
	play: /* @__PURE__ */ jsx("path", { d: "M8 5.5v13l11-6.5-11-6.5Z" }),
	clock: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("circle", {
		cx: "12",
		cy: "12",
		r: "9"
	}), /* @__PURE__ */ jsx("path", { d: "M12 7v5l3.5 2" })] }),
	search: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("circle", {
		cx: "11",
		cy: "11",
		r: "6.5"
	}), /* @__PURE__ */ jsx("path", { d: "m20 20-4.4-4.4" })] }),
	sun: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("circle", {
		cx: "12",
		cy: "12",
		r: "4"
	}), /* @__PURE__ */ jsx("path", { d: "M12 2.5v2.5m0 14v2.5M2.5 12H5m14 0h2.5M4.9 4.9 6.7 6.7m10.6 10.6 1.8 1.8m0-14.2-1.8 1.8M6.7 17.3l-1.8 1.8" })] }),
	moon: /* @__PURE__ */ jsx("path", { d: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" }),
	menu: /* @__PURE__ */ jsx("path", { d: "M4 7h16M4 12h16M4 17h16" }),
	close: /* @__PURE__ */ jsx("path", { d: "M6 6l12 12M18 6 6 18" }),
	download: /* @__PURE__ */ jsx("path", { d: "M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M4 19.5h16" }),
	calendar: /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("rect", {
		x: "3.5",
		y: "5",
		width: "17",
		height: "15.5",
		rx: "2"
	}), /* @__PURE__ */ jsx("path", { d: "M3.5 10h17M8 3.5V6m8-2.5V6" })] }),
	check: /* @__PURE__ */ jsx("path", { d: "m4.5 12.5 5 5L19.5 7" })
};
function Icon({ name, size = 20, label, className, ...rest }) {
	const cls = css({
		display: "inline-block",
		flex: "none",
		verticalAlign: "middle",
		color: "inherit",
		width: `${size}px`,
		height: `${size}px`,
		fill: name === "github" || name === "play" || name === "moon" ? "currentColor" : "none",
		stroke: name === "github" || name === "play" || name === "moon" ? "none" : "currentColor",
		"stroke-width": 2,
		"stroke-linecap": "round",
		"stroke-linejoin": "round"
	});
	return /* @__PURE__ */ jsx("svg", {
		viewBox: "0 0 24 24",
		className: `${cls}${className ? ` ${className}` : ""}`,
		role: label ? "img" : void 0,
		"aria-label": label,
		"aria-hidden": label ? void 0 : true,
		focusable: "false",
		"data-icon": name,
		"data-testid": rest["data-testid"] ?? `icon-${name}`,
		children: PATHS[name]
	});
}
//#endregion
//#region src/components/ui/Spinner.tsx
/**
* Spinner — determinate-looking loading indicator.
*
* The @keyframes rule is nested INSIDE the styled component (verified to
* flatten correctly) so it emits without a module-scope registration order
* dependency, and `prefers-reduced-motion` swaps the rotation for a gentle
* opacity pulse (still communicates "busy" without spinning).
*/
var Ring = styled.span`
  display: inline-block;
  flex: none;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: ${(p) => p.theme.radius.full};
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-right-color: transparent;
  animation: ui-spin 720ms ${(p) => p.theme.motion.ease} infinite;

  @keyframes ui-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: ui-pulse 1200ms ${(p) => p.theme.motion.ease} infinite;
    border-top-color: currentColor;
    border-right-color: currentColor;
    opacity: 0.55;
  }

  @keyframes ui-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 0.9;
    }
  }
`;
function Spinner({ size = 16, label = "Loading", className, ...rest }) {
	return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx(Ring, {
		$size: size,
		className,
		role: "status",
		"aria-live": "polite",
		"aria-label": label,
		"data-testid": rest["data-testid"] ?? "spinner"
	}) });
}
//#endregion
//#region src/components/ui/Button.tsx
var heights = (t) => ({
	sm: `calc(${t.space[5]} + ${t.space[4]} + ${t.space[1]})`,
	md: `calc(${t.space[6]} + ${t.space[4]})`,
	lg: `calc(${t.space[6]} + ${t.space[5]})`
});
var iconSize = {
	sm: 16,
	md: 18,
	lg: 20
};
function buttonStyles(theme, variant, size) {
	const t = theme;
	const tone = variant === "primary" ? {
		background: t.color.accent,
		color: t.color.bg,
		borderColor: t.color.accent,
		hover: {
			background: t.color.bgElevated,
			color: t.color.accent,
			borderColor: t.color.accent
		}
	} : variant === "secondary" ? {
		background: t.color.bgElevated,
		color: t.color.text,
		borderColor: t.color.borderStrong,
		hover: {
			background: t.color.accentSoft,
			color: t.color.accent,
			borderColor: t.color.accentBorder
		}
	} : variant === "danger" ? {
		background: t.color.danger,
		color: t.color.bgElevated,
		borderColor: t.color.danger,
		hover: {
			background: t.color.bgElevated,
			color: t.color.danger,
			borderColor: t.color.danger
		}
	} : {
		background: "transparent",
		color: t.color.accent,
		borderColor: "transparent",
		hover: {
			background: t.color.accentSoft,
			color: t.color.accent,
			borderColor: t.color.accentBorder
		}
	};
	return {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: t.space[2],
		boxSizing: "border-box",
		minHeight: heights(t)[size],
		paddingInline: size === "sm" ? t.space[3] : size === "lg" ? t.space[6] : t.space[5],
		fontFamily: t.font.sans,
		fontSize: size === "sm" ? t.font.sizes.sm : t.font.sizes.md,
		fontWeight: t.font.weights.semibold,
		lineHeight: t.font.leading.none,
		letterSpacing: t.font.tracking.normal,
		textDecoration: "none",
		cursor: "pointer",
		userSelect: "none",
		borderRadius: t.radius.md,
		border: `1px solid ${tone.borderColor}`,
		background: tone.background,
		color: tone.color,
		transition: `background ${t.motion.fast} ${t.motion.ease}, color ${t.motion.fast} ${t.motion.ease}, border-color ${t.motion.fast} ${t.motion.ease}, box-shadow ${t.motion.base} ${t.motion.ease}`,
		"&:hover": tone.hover,
		"&:active": { transform: "translateY(1px)" },
		"&:focus-visible": {
			outline: `2px solid ${t.color.focus}`,
			outlineOffset: "2px"
		},
		"&[disabled], &[aria-disabled=\"true\"]": {
			cursor: "not-allowed",
			background: t.color.bgSunken,
			color: t.color.textSubtle,
			borderColor: t.color.border,
			boxShadow: "none",
			transform: "none"
		},
		"@media (prefers-reduced-motion: reduce)": {
			transition: "none",
			"&:active": { transform: "none" }
		}
	};
}
var Base = styled.button((p) => buttonStyles(p.theme, p.$variant, p.$size));
function renderSlot(slot, n) {
	if (slot === void 0 || slot === null) return null;
	if (typeof slot === "string") return /* @__PURE__ */ jsx(Icon, {
		name: slot,
		size: n
	});
	return slot;
}
function Button({ variant = "primary", size = "md", as, href, iconLeft, iconRight, loading = false, disabled = false, type = "button", className, children, ...rest }) {
	const theme = useTheme();
	const inactive = disabled || loading;
	const target = as ?? (href ? "a" : "button");
	const isNative = target === "button" || typeof target === "string" && target !== "";
	const label = /* @__PURE__ */ jsxs(Fragment, { children: [
		loading ? /* @__PURE__ */ jsx(Spinner, {
			size: iconSize[size],
			label: "Loading"
		}) : renderSlot(iconLeft, iconSize[size]),
		children !== void 0 && children !== null && /* @__PURE__ */ jsx("span", {
			"data-slot": "label",
			children
		}),
		loading ? null : renderSlot(iconRight, iconSize[size])
	] });
	const common = {
		"data-testid": rest["data-testid"] ?? "button",
		"data-variant": variant,
		"data-size": size,
		"data-loading": loading ? "true" : "false",
		"aria-busy": loading ? true : void 0,
		"aria-disabled": !isNative && inactive ? true : void 0,
		"aria-label": rest["aria-label"],
		onClick: inactive ? (event) => event.preventDefault() : rest.onClick
	};
	if (!isNative && typeof target !== "string") {
		const Cmp = target;
		const cls = css(buttonStyles(theme, variant, size));
		const passThrough = { ...rest };
		delete passThrough["data-testid"];
		delete passThrough["aria-label"];
		delete passThrough.onClick;
		return /* @__PURE__ */ jsx(Cmp, {
			...passThrough,
			className: className ? `${cls} ${className}` : cls,
			"aria-label": common["aria-label"],
			"aria-busy": common["aria-busy"],
			"aria-disabled": common["aria-disabled"],
			"data-testid": common["data-testid"],
			"data-variant": common["data-variant"],
			"data-size": common["data-size"],
			"data-loading": common["data-loading"],
			onClick: common.onClick,
			children: label
		});
	}
	const element = target === "submit" ? "button" : target;
	return /* @__PURE__ */ jsx(Base, {
		...Object.fromEntries(Object.entries(rest).filter(([key]) => key !== "data-testid" && key !== "aria-label")),
		as: element,
		href,
		$variant: variant,
		$size: size,
		type: element === "button" ? target === "submit" ? "submit" : type : void 0,
		disabled: element === "button" && inactive ? true : void 0,
		className,
		"aria-busy": common["aria-busy"],
		"aria-disabled": common["aria-disabled"],
		"aria-label": common["aria-label"],
		"data-testid": common["data-testid"],
		"data-variant": common["data-variant"],
		"data-size": common["data-size"],
		"data-loading": common["data-loading"],
		onClick: common.onClick,
		children: label
	});
}
//#endregion
//#region src/components/ui/Tag.tsx
var Pill = styled.span`
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  font-family: ${(p) => p.theme.font.sans};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.none};
  letter-spacing: ${(p) => p.theme.font.tracking.normal};
  border-radius: ${(p) => p.theme.radius.full};
  border: 1px solid transparent;
  font-size: ${(p) => p.$size === "sm" ? p.theme.font.sizes.xs : p.theme.font.sizes.sm};
  padding: ${(p) => p.$size === "sm" ? `${p.theme.space["0"]} ${p.theme.space[2]}` : `${p.theme.space["1"]} ${p.theme.space[3]}`};

  /* default */
  ${(p) => p.$tone === "default" && `background: ${p.theme.color.bgSunken}; color: ${p.theme.color.textMuted}; border-color: ${p.theme.color.border};`}

  /* accent — text sits on the translucent soft fill; checked >= 4.5:1 */
  ${(p) => p.$tone === "accent" && `background: ${p.theme.color.accentSoft}; color: ${p.theme.color.accent}; border-color: ${p.theme.color.accentBorder};`}

  /* outline — transparent background, works on bg and surface alike */
  ${(p) => p.$tone === "outline" && `background: transparent; color: ${p.theme.color.textMuted}; border-color: ${p.theme.color.borderStrong};`}
`;
function Tag({ tone = "default", size = "md", className, children, ...rest }) {
	return /* @__PURE__ */ jsx(Pill, {
		$tone: tone,
		$size: size,
		className,
		"data-testid": rest["data-testid"] ?? "tag",
		children
	});
}
//#endregion
//#region src/components/ui/Card.tsx
/**
* Card — the surface every list item and panel sits on.
*
* Renders <article> by default, <a> when `href` is given, and any element via
* `as` (a router Link works: it lands as the styled `as` target and keeps the
* card styles — verified in ui.test.tsx).
*
* `interactive` adds hover/focus affordances. The whole card must NOT be the
* only link when the title also links — page builders keep a real link inside
* and pass interactive here; that's the non-duplicate-link pattern.
*/
var Surface = styled.article`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => p.$pad === "sm" ? p.theme.space[4] : p.$pad === "lg" ? p.theme.space[6] : p.theme.space[5]};
  background: ${(p) => p.theme.color.surface};
  color: ${(p) => p.theme.color.text};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
  box-shadow: ${(p) => p.theme.shadow.sm};
  text-decoration: none;
  transition:
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    box-shadow ${(p) => p.theme.motion.base} ${(p) => p.theme.motion.ease},
    transform ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  ${(p) => p.$interactive && `
    cursor: pointer;
    &:hover {
      border-color: ${p.theme.color.borderStrong};
      box-shadow: ${p.theme.shadow.md};
      transform: translateY(-2px);
    }
    &:focus-visible {
      outline: 2px solid ${p.theme.color.focus};
      outline-offset: 3px;
    }
  `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover {
      transform: none;
    }
  }
`;
function Card({ interactive = false, href, as, pad = "md", className, children, ...rest }) {
	return /* @__PURE__ */ jsx(Surface, {
		as: as ?? (href ? "a" : "article"),
		href,
		$interactive: interactive || Boolean(href),
		$pad: pad,
		className,
		"aria-label": rest["aria-label"],
		"data-testid": rest["data-testid"] ?? "card",
		children
	});
}
//#endregion
//#region src/components/ui/Heading.tsx
var defaultSize = {
	1: "4xl",
	2: "2xl",
	3: "xl",
	4: "lg"
};
function headingCss(theme, size) {
	return css({
		margin: "0",
		fontFamily: theme.font.sans,
		fontWeight: theme.font.weights.bold,
		lineHeight: theme.font.leading.tight,
		letterSpacing: theme.font.tracking.tight,
		color: theme.color.text,
		fontSize: theme.font.sizes[size],
		"scroll-margin-top": theme.layout.navHeight
	});
}
function Heading({ level, size, className, id, children, ...rest }) {
	const cls = `${headingCss(useTheme(), size ?? defaultSize[level])}${className ? ` ${className}` : ""}`;
	const Tag = `h${level}`;
	return /* @__PURE__ */ jsx(Tag, {
		id,
		className: cls,
		"data-testid": rest["data-testid"] ?? `heading-${level}`,
		children
	});
}
//#endregion
//#region src/components/ui/Section.tsx
/**
* Section — a landmark region with optional eyebrow/title/description header.
* When `title` is given it renders an h2 (id-linked via aria-labelledby) so
* screen readers announce the region name and heading order stays h1 > h2.
*/
var Root = styled.section`
  position: relative;
  width: 100%;
  margin: 0 auto;
  padding-block: ${(p) => p.$size === "compact" ? p.theme.space[7] : p.$size === "wide" ? p.theme.space[9] : p.theme.space[8]};
  /* R2-D V1: NO padding-inline — Layout Main owns the single content gutter.
   * Sections used to add their own, doubling the inset (measured: header rail
   * at x=144 vs section text at x=192). max-width still caps prose widths. */
  max-width: ${(p) => p.$size === "compact" ? p.theme.layout.maxWidthProse : p.theme.layout.maxWidth};

  &:not(:last-of-type) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }
`;
var Eyebrow$1 = styled.p`
  margin: 0 0 ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.accent};
`;
var Description$1 = styled.p`
  margin: 0 0 ${(p) => p.theme.space[5]};
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;
function Section({ id, size = "default", eyebrow, title, description, className, children, ...rest }) {
	const theme = useTheme();
	const headingId = id ? `${id}-title` : void 0;
	const titleClass = css({ margin: `0 0 ${theme.space[3]}` });
	return /* @__PURE__ */ jsxs(Root, {
		id,
		$size: size,
		className,
		"aria-labelledby": title ? headingId : void 0,
		"data-testid": rest["data-testid"] ?? "section",
		children: [(eyebrow || title || description) && /* @__PURE__ */ jsxs("header", { children: [
			eyebrow && /* @__PURE__ */ jsx(Eyebrow$1, {
				"data-testid": "section-eyebrow",
				children: eyebrow
			}),
			title && /* @__PURE__ */ jsx(Heading, {
				level: 2,
				id: headingId,
				className: titleClass,
				"data-testid": "section-title",
				children: title
			}),
			description && /* @__PURE__ */ jsx(Description$1, { children: description })
		] }), children]
	});
}
//#endregion
//#region src/components/ui/Container.tsx
/**
* Container — the page-width wrapper. Everything on a page lives in one.
* `size="prose"` narrows to the reading measure; "narrow" is for forms/404s.
*/
var Box = styled.div`
  width: 100%;
  margin: 0 auto;
  /* R2-D V1: gutter ownership lives in Layout Main — no inline padding here
   * (was double-inset content vs the header/footer rail). */
  max-width: ${(p) => p.$size === "prose" ? p.theme.layout.maxWidthProse : p.$size === "narrow" ? `calc(${p.theme.layout.maxWidth} * 0.58)` : p.theme.layout.maxWidth};
`;
function Container({ size = "default", className, children, id, ...rest }) {
	return /* @__PURE__ */ jsx(Box, {
		$size: size,
		id,
		className,
		"data-testid": rest["data-testid"] ?? "container",
		children
	});
}
//#endregion
//#region src/components/ui/Stack.tsx
var Flex = styled.div`
  display: flex;
  flex-direction: ${(p) => p.$direction};
  flex-wrap: ${(p) => p.$wrap ? "wrap" : "nowrap"};
  gap: ${(p) => p.theme.space[p.$gap]};
  align-items: ${(p) => p.$align === "start" ? "flex-start" : p.$align === "end" ? "flex-end" : p.$align};
  justify-content: ${(p) => p.$justify === "between" ? "space-between" : p.$justify === "center" ? "center" : p.$justify === "end" ? "flex-end" : "flex-start"};
`;
function Stack({ gap = "4", direction = "column", wrap = false, align = "stretch", justify = "start", className, children, as = "div", ...rest }) {
	return /* @__PURE__ */ jsx(Flex, {
		as,
		$gap: gap,
		$direction: direction,
		$wrap: wrap,
		$align: align,
		$justify: justify,
		className,
		"data-testid": rest["data-testid"] ?? "stack",
		children
	});
}
//#endregion
//#region src/components/ui/Prose.tsx
/**
* Prose — styles *generated markdown HTML* (h2/h3 anchors, lists, blockquote,
* code, pre>code, tables, images, hr) at a ~68ch reading measure.
*
* All descendant selectors are scoped under the wrapper's own class
* (`.css-x h2 { … }`), which is what keeps Prose from restyling the site
* chrome — verified in ui.test.tsx by asserting every rule starts with the
* wrapper class.
*
* Heading anchors: the markdown engine emits `<h2 id="…">`; the `a` is added
* client-side nowhere — instead CSS shows a "#" ::before on hover/focus of an
* `a.anchor` child if the renderer produced one, and ids get scroll-margin so
* the sticky header never covers the target.
*/
function proseCss(theme) {
	const t = theme;
	return css({
		"--measure": "68ch",
		maxWidth: "var(--measure)",
		fontFamily: t.font.sans,
		fontSize: t.font.sizes.md,
		lineHeight: t.font.leading.normal,
		color: t.color.text,
		"> *:first-of-type": { marginTop: "0" },
		"> *:last-child": { marginBottom: "0" },
		"h2, h3, h4": {
			fontFamily: t.font.sans,
			fontWeight: t.font.weights.bold,
			lineHeight: t.font.leading.snug,
			letterSpacing: t.font.tracking.tight,
			color: t.color.text,
			scrollMarginTop: t.layout.navHeight
		},
		h2: {
			fontSize: t.font.sizes["2xl"],
			margin: `${t.space[8]} 0 ${t.space[4]}`
		},
		h3: {
			fontSize: t.font.sizes.xl,
			margin: `${t.space[7]} 0 ${t.space[3]}`
		},
		h4: {
			fontSize: t.font.sizes.lg,
			margin: `${t.space[6]} 0 ${t.space[2]}`
		},
		"h2 .anchor, h3 .anchor, h4 .anchor": {
			marginLeft: t.space[2],
			color: t.color.accent,
			textDecoration: "none",
			opacity: "0",
			fontWeight: t.font.weights.medium
		},
		"h2:hover .anchor, h3:hover .anchor, h4:hover .anchor, .anchor:focus-visible": { opacity: "1" },
		".anchor:focus-visible": {
			outline: `2px solid ${t.color.focus}`,
			outlineOffset: "2px",
			borderRadius: t.radius.sm
		},
		p: { margin: `0 0 ${t.space[4]}` },
		"p, li": { maxWidth: "var(--measure)" },
		strong: {
			fontWeight: t.font.weights.semibold,
			color: t.color.text
		},
		em: { fontStyle: "italic" },
		a: {
			color: t.color.accent,
			textDecoration: "underline",
			textDecorationColor: t.color.accentBorder,
			textUnderlineOffset: "3px",
			"&:hover": { textDecorationColor: t.color.accent },
			"&:focus-visible": {
				outline: `2px solid ${t.color.focus}`,
				outlineOffset: "2px",
				borderRadius: t.radius.sm
			}
		},
		"ul, ol": {
			margin: `0 0 ${t.space[4]}`,
			paddingLeft: t.space[6]
		},
		li: { marginBottom: t.space[2] },
		"li::marker": { color: t.color.textMuted },
		blockquote: {
			margin: `${t.space[5]} 0`,
			padding: `${t.space[1]} ${t.space[5]}`,
			borderLeft: `3px solid ${t.color.accentBorder}`,
			color: t.color.textMuted,
			fontStyle: "italic",
			"p:last-child": { marginBottom: "0" }
		},
		code: {
			fontFamily: t.font.mono,
			fontSize: `calc(${t.font.sizes.sm} * 0.94)`,
			background: t.color.bgSunken,
			color: t.color.text,
			border: `1px solid ${t.color.border}`,
			borderRadius: t.radius.sm,
			padding: `0 ${t.space[1]}`
		},
		"pre": {
			margin: `${t.space[5]} 0`,
			padding: t.space[4],
			background: t.color.bgSunken,
			border: `1px solid ${t.color.border}`,
			borderRadius: t.radius.md,
			overflowX: "auto",
			overflowY: "auto",
			maxHeight: "80vh"
		},
		"pre code": {
			display: "block",
			background: "transparent",
			border: "none",
			padding: "0",
			fontSize: t.font.sizes.sm,
			lineHeight: t.font.leading.snug,
			whiteSpace: "pre"
		},
		"table": {
			width: "100%",
			margin: `${t.space[5]} 0`,
			borderCollapse: "collapse",
			display: "block",
			overflowX: "auto",
			fontSize: t.font.sizes.sm
		},
		"th, td": {
			border: `1px solid ${t.color.border}`,
			padding: `${t.space[2]} ${t.space[3]}`,
			textAlign: "left"
		},
		th: {
			background: t.color.bgSunken,
			fontWeight: t.font.weights.semibold,
			color: t.color.text
		},
		"tbody tr:nth-child(even)": { background: t.color.bgSunken },
		img: {
			maxWidth: "100%",
			height: "auto",
			borderRadius: t.radius.md,
			border: `1px solid ${t.color.border}`,
			display: "block",
			margin: `${t.space[5]} auto`
		},
		hr: {
			border: "none",
			borderTop: `1px solid ${t.color.border}`,
			margin: `${t.space[7]} 0`
		}
	});
}
function Prose({ className, children, ...rest }) {
	const cls = proseCss(useTheme());
	return /* @__PURE__ */ jsx("div", {
		className: className ? `${cls} ${className}` : cls,
		"data-prose": "true",
		"data-testid": rest["data-testid"] ?? "prose",
		children
	});
}
//#endregion
//#region src/components/ui/EmptyState.tsx
/**
* EmptyState — the "nothing here yet / no results" panel every list page
* needs. Optional CTA is a real focusable child passed in by the caller
* (never a fake onClick on the panel).
*/
var Panel$2 = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => p.theme.space[8]} ${(p) => p.theme.space[5]};
  border: 1px dashed ${(p) => p.theme.color.borderStrong};
  border-radius: ${(p) => p.theme.radius.lg};
  background: ${(p) => p.theme.color.bgElevated};
`;
var Glyph$1 = styled.span`
  color: ${(p) => p.theme.color.textSubtle};
  display: inline-flex;
`;
var Title = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  color: ${(p) => p.theme.color.text};
`;
var Description = styled.p`
  margin: 0;
  max-width: 46ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;
function EmptyState({ icon = "search", title, description, action, className, ...rest }) {
	return /* @__PURE__ */ jsxs(Panel$2, {
		role: "status",
		className,
		"data-testid": rest["data-testid"] ?? "empty-state",
		children: [
			/* @__PURE__ */ jsx(Glyph$1, { children: /* @__PURE__ */ jsx(Icon, {
				name: icon,
				size: 28
			}) }),
			/* @__PURE__ */ jsx(Title, { children: title }),
			description && /* @__PURE__ */ jsx(Description, { children: description }),
			action
		]
	});
}
styled.a`
  position: absolute;
  top: ${(p) => p.theme.space["2"]};
  left: ${(p) => p.theme.space["2"]};
  z-index: ${(p) => p.theme.z.nav + 10};
  transform: translateY(-1000px);
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: ${(p) => p.theme.space[3]} ${(p) => p.theme.space[5]};
  background: ${(p) => p.theme.color.bgElevated};
  color: ${(p) => p.theme.color.text};
  border: 1px solid ${(p) => p.theme.color.borderStrong};
  border-radius: ${(p) => p.theme.radius.md};
  box-shadow: ${(p) => p.theme.shadow.md};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  text-decoration: none;
  transition: transform ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  &:focus,
  &:focus-visible {
    position: fixed;
    transform: translateY(0);
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
//#endregion
//#region src/components/ui/VisuallyHidden.tsx
/**
* VisuallyHidden — content for screen readers only.
*
* Uses the canonical clip technique (not display:none / visibility:hidden,
* which remove the content from the accessibility tree entirely). The element
* keeps 1px of box so focus can still land inside it if a control lives there.
*/
var Hidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;
function VisuallyHidden({ className, children, ...rest }) {
	return /* @__PURE__ */ jsx(Hidden, {
		className,
		"data-testid": rest["data-testid"] ?? "visually-hidden",
		children
	});
}
//#endregion
//#region src/components/ui/Pagination.tsx
/**
* Pagination — accessible paging for the project/post indexes.
*
* Semantics: <nav aria-label="Pagination"> > <ul> of links. The active page is
* NOT a link (aria-disabled, no href) and carries aria-current="page". Previous
* / next become aria-disabled with their href removed on the boundary pages so
* they are not tabbable — the CDP suite can assert both states.
*
* Pages are windowed (first, last, +/-1 around current) with "…" gaps.
*/
var Nav = styled.nav`
  display: flex;
  justify-content: center;
`;
var List = styled.ul`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  margin: 0;
  padding: 0;
  list-style: none;
`;
var Item$1 = styled.li`
  display: flex;
`;
var Page = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]};
  box-sizing: border-box;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.none};
  border-radius: ${(p) => p.theme.radius.md};
  border: 1px solid ${(p) => p.theme.color.border};
  text-decoration: none;
  transition:
    background ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  /* current page: solid accent with bg-colored text (>= 5.16:1 both themes) */
  ${(p) => p.$current && `background: ${p.theme.color.accent}; color: ${p.theme.color.bg}; border-color: ${p.theme.color.accent};`}
  ${(p) => !p.$current && `background: ${p.theme.color.surface}; color: ${p.theme.color.text}; &:hover { background: ${p.theme.color.accentSoft}; color: ${p.theme.color.accent}; border-color: ${p.theme.color.accentBorder}; }`}

  &[aria-disabled='true'] {
    background: ${(p) => p.theme.color.bgSunken};
    color: ${(p) => p.theme.color.textSubtle};
    border-color: ${(p) => p.theme.color.border};
    cursor: default;
    text-decoration: none;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
var Edge = styled(Page)`
  gap: ${(p) => p.theme.space[1]};
  padding-inline: ${(p) => p.theme.space[3]};
`;
var Gap = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 44px;
  color: ${(p) => p.theme.color.textSubtle};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
`;
/** 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page, total, around = 1) {
	const keep = /* @__PURE__ */ new Set([1, total]);
	for (let i = page - around; i <= page + around; i += 1) if (i >= 1 && i <= total) keep.add(i);
	const sorted = [...keep].sort((a, b) => a - b);
	const out = [];
	for (const n of sorted) {
		const prev = out[out.length - 1];
		if (prev !== void 0 && n - prev > 1) out.push(-1);
		out.push(n);
	}
	return out;
}
function Pagination({ page, total, hrefFor = (n) => n === 1 ? "?" : `?page=${n}`, label = "Pagination", className, ...rest }) {
	const clamped = Math.max(1, Math.min(page, total));
	const items = pageWindow(clamped, total);
	const linkProps = (target, current) => current || target < 1 || target > total ? {
		href: void 0,
		"aria-disabled": true,
		"aria-label": current ? `Page ${target}, current page` : `Page ${target}`
	} : {
		href: hrefFor(target),
		"aria-disabled": void 0,
		"aria-label": `Go to page ${target}`
	};
	const edgeTabIndex = (enabled) => enabled ? void 0 : 0;
	return /* @__PURE__ */ jsx(Nav, {
		"aria-label": label,
		className,
		"data-testid": rest["data-testid"] ?? "pagination",
		children: /* @__PURE__ */ jsxs(List, { children: [
			/* @__PURE__ */ jsx(Item$1, { children: /* @__PURE__ */ jsx(Edge, {
				...linkProps(clamped - 1, false),
				href: clamped > 1 ? hrefFor(clamped - 1) : void 0,
				"aria-disabled": clamped > 1 ? void 0 : true,
				tabIndex: edgeTabIndex(clamped > 1),
				"aria-label": "Previous page",
				$current: false,
				"data-edge": "prev",
				children: "‹ Prev"
			}) }),
			items.map((n, index) => n === -1 ? /* @__PURE__ */ jsx(Item$1, { children: /* @__PURE__ */ jsx(Gap, {
				"aria-hidden": "true",
				children: "…"
			}) }, `gap-${index}`) : /* @__PURE__ */ jsx(Item$1, { children: /* @__PURE__ */ jsx(Page, {
				...linkProps(n, n === clamped),
				"aria-current": n === clamped ? "page" : void 0,
				$current: n === clamped,
				"data-page": n,
				children: n
			}) }, n)),
			/* @__PURE__ */ jsx(Item$1, { children: /* @__PURE__ */ jsx(Edge, {
				...linkProps(clamped + 1, false),
				href: clamped < total ? hrefFor(clamped + 1) : void 0,
				"aria-disabled": clamped < total ? void 0 : true,
				tabIndex: edgeTabIndex(clamped < total),
				"aria-label": "Next page",
				$current: false,
				"data-edge": "next",
				children: "Next ›"
			}) })
		] })
	});
}
//#endregion
//#region src/pages/Home.tsx
/**
* Home — the landing page: a positioning hero, featured work, latest writing.
*
* DATA POSTURE: content.json starts EMPTY (the content pipeline fills it
* later). Every block here is data-driven AND empty-safe: zero rows renders a
* designed empty state, never a crash, never a hole in the layout.
*
* A11Y: exactly one h1 (the name lockup); every later heading is an h2 via
* Section; featured cards keep a real link inside the title (the card is
* `interactive` but is not the only affordance); CTAs are anchors, focus
* rings come from Button.
*/
var ROUTER_LINK$4 = Link$1;
var HeroShell = styled.section`
  position: relative;
  width: 100%;
  /* R2-D V1/V8: no second max-width/padding-inline (Main owns the rail), and
   * no extra top padding — Main's space[7] is the single top gutter. The old
   * stack wasted ~144px above the eyebrow at 375 and ate the mobile fold. */
  padding-block: 0 ${(p) => p.theme.space[6]};
`;
var Eyebrow = styled.p`
  margin: 0 0 ${(p) => p.theme.space[4]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.accent};

  /* R2-D V8: at 375 the mono eyebrow wrapped to 3 lines and split
   * "FULL-STACK" mid-token. Tighter tracking + smaller size keep it to two
   * lines; text uses non-breaking hyphens (see the JSX). */
  @media (max-width: ${(p) => p.theme.breakpoint.sm}) {
    font-size: ${(p) => p.theme.font.sizes.xs};
    letter-spacing: ${(p) => p.theme.font.tracking.wide};
  }
`;
/** Second line of the h1 lockup — the tagline reads as one heading, two voices. */
var Tagline = styled.span`
  display: block;
  margin-top: ${(p) => p.theme.space[3]};
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.normal};
  color: ${(p) => p.theme.color.textMuted};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    font-size: ${(p) => p.theme.font.sizes["2xl"]};
  }

  /* Extreme mobile (M2): part of the compacted hero ramp. */
  @media (max-width: ${(p) => p.theme.breakpoint.sm}) {
    margin-top: ${(p) => p.theme.space[2]};
    font-size: ${(p) => p.theme.font.sizes.lg};
  }
`;
var Lede$6 = styled.p`
  margin: ${(p) => `${p.theme.space[5]} 0 0`};
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};

  /* Extreme mobile (M2): at 320x568 the full-size lockup pushed the CTAs
   * ~280px below the fold. Compact the type ramp on short/narrow screens —
   * content intact, rhythm tightened. */
  @media (max-width: ${(p) => p.theme.breakpoint.sm}) {
    margin-top: ${(p) => p.theme.space[4]};
    font-size: ${(p) => p.theme.font.sizes.md};
    line-height: ${(p) => p.theme.font.leading.normal};
  }
`;
var CtaRow$2 = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[6]};

  @media (max-width: ${(p) => p.theme.breakpoint.sm}) {
    margin-top: ${(p) => p.theme.space[5]};
  }
`;
var HeroRule = styled.hr`
  margin: ${(p) => `${p.theme.space[8]} 0 0`};
  border: none;
  border-top: 1px solid ${(p) => p.theme.color.border};
`;
var HiringLine = styled.p`
  margin: ${(p) => `${p.theme.space[5]} 0 0`};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  font-size: ${(p) => p.theme.font.sizes.md};
  color: ${(p) => p.theme.color.textMuted};
`;
var Grid$1 = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: ${(p) => p.theme.breakpoint.lg}) {
    /* R2-D V2: auto-fit, not a fixed 3 — with 2 featured projects a fixed
     * 3-col grid renders a dangling empty third column (reads as a missing
     * card). auto-fit lets 2 cards span full width and 3+ fill naturally. */
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  }
`;
var MetaLine$5 = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;
var CardTitle$1 = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
`;
function inlineLinkClass(theme) {
	return css({
		display: "inline-flex",
		alignItems: "center",
		gap: theme.space[1],
		minHeight: "44px",
		color: theme.color.accent,
		textDecoration: "none",
		borderRadius: theme.radius.sm,
		"&:hover": {
			textDecoration: "underline",
			textUnderlineOffset: "3px"
		},
		"&:focus-visible": {
			outline: `2px solid ${theme.color.focus}`,
			outlineOffset: "2px"
		}
	});
}
function titleLinkClass$1(theme) {
	return css({
		color: theme.color.text,
		textDecoration: "none",
		borderRadius: theme.radius.sm,
		display: "inline-block",
		minHeight: "28px",
		["@media (max-width: " + theme.breakpoint.md + ")"]: { minHeight: "44px" },
		"&:hover": {
			color: theme.color.accent,
			textDecoration: "underline",
			textUnderlineOffset: "3px"
		},
		"&:focus-visible": {
			outline: `2px solid ${theme.color.focus}`,
			outlineOffset: "3px"
		}
	});
}
var CardSummary$1 = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;
var CardFooter$1 = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[3]};
`;
/**
* The three cards the landing page shows: featured first; if nothing is
* flagged featured yet, the first three projects step in; if there are no
* projects at all the caller renders EmptyState instead.
*/
function heroProjects() {
	const featured = featuredProjects();
	return (featured.length > 0 ? featured : content.projects).slice(0, 3);
}
function ProjectCard$1({ project, links }) {
	const detailHref = `/projects/${project.slug}`;
	return /* @__PURE__ */ jsxs(Card, {
		interactive: true,
		"data-testid": "featured-project",
		children: [
			/* @__PURE__ */ jsxs(MetaLine$5, { children: [
				/* @__PURE__ */ jsx("span", { children: project.status }),
				/* @__PURE__ */ jsx("span", {
					"aria-hidden": "true",
					children: "·"
				}),
				/* @__PURE__ */ jsx("span", { children: project.period })
			] }),
			/* @__PURE__ */ jsx(CardTitle$1, {
				"data-testid": "featured-project-title",
				children: /* @__PURE__ */ jsx(Link$1, {
					to: detailHref,
					className: links.title,
					children: project.title
				})
			}),
			/* @__PURE__ */ jsx(CardSummary$1, { children: project.summary }),
			/* @__PURE__ */ jsx(Stack, {
				direction: "row",
				wrap: true,
				gap: "2",
				children: project.tags.slice(0, 4).map((tag) => /* @__PURE__ */ jsx(Tag, {
					size: "sm",
					tone: "outline",
					children: tag
				}, tag))
			}),
			/* @__PURE__ */ jsx(CardFooter$1, { children: /* @__PURE__ */ jsxs(Link$1, {
				to: detailHref,
				className: links.inline,
				children: ["Read the case study ", /* @__PURE__ */ jsx("span", {
					"aria-hidden": "true",
					children: "→"
				})]
			}) })
		]
	});
}
var PostList$1 = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;
var PostRow = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[1]};
  padding-block: ${(p) => p.theme.space[4]};

  &:not(:last-child) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: calc(${(p) => p.theme.space[10]} + ${(p) => p.theme.space[4]}) minmax(0, 1fr) auto;
    align-items: baseline;
    gap: ${(p) => p.theme.space[4]};
  }
`;
var PostDate = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};
`;
var PostTitle$1 = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
`;
var PostMeta = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
  justify-self: start;

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    justify-self: end;
  }
`;
function Home() {
	const theme = useTheme();
	const links = {
		inline: inlineLinkClass(theme),
		title: titleLinkClass$1(theme)
	};
	const projects = heroProjects();
	const latestPosts = postsByDate().slice(0, 3);
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs(HeroShell, {
			"aria-labelledby": "home-title",
			"data-testid": "home-hero",
			children: [
				/* @__PURE__ */ jsx(Eyebrow, { children: "Technical consultant · Full‑stack engineer · Data scientist" }),
				/* @__PURE__ */ jsxs(Heading, {
					level: 1,
					id: "home-title",
					size: "5xl",
					"data-testid": "home-title",
					children: ["Alex Rivera", /* @__PURE__ */ jsx(Tagline, { children: "I turn analytical work into software that survives production — and production realities back into the analysis." })]
				}),
				/* @__PURE__ */ jsx(Lede$6, { children: "I advise teams on the hard middle of technical work: where a data-science result has to become a maintained service, and “it runs on my machine” has to become “it runs, and we know why.”" }),
				/* @__PURE__ */ jsxs(CtaRow$2, { children: [/* @__PURE__ */ jsx(Button, {
					as: ROUTER_LINK$4,
					to: "/projects",
					variant: "primary",
					size: "lg",
					"data-testid": "home-cta-projects",
					children: "View projects"
				}), /* @__PURE__ */ jsx(Button, {
					as: ROUTER_LINK$4,
					to: "/contact",
					variant: "secondary",
					size: "lg",
					"data-testid": "home-cta-contact",
					children: "Get in touch"
				})] }),
				/* @__PURE__ */ jsx(HeroRule, {}),
				(SITE.hiring || SITE.resume) && /* @__PURE__ */ jsxs(HiringLine, {
					"data-testid": "home-hiring",
					children: [SITE.hiring && /* @__PURE__ */ jsx("span", { children: SITE.hiring }), SITE.resume && /* @__PURE__ */ jsx(Button, {
						as: "a",
						href: SITE.resume,
						variant: "ghost",
						size: "sm",
						iconRight: "download",
						children: "Résumé (PDF)"
					})]
				})
			]
		}),
		/* @__PURE__ */ jsx(Section, {
			id: "featured",
			eyebrow: "Selected work",
			title: "Projects I would put in front of a client",
			description: "A short, deliberate list: systems that shipped, the reasoning behind them, and the numbers that judged them.",
			children: projects.length > 0 ? /* @__PURE__ */ jsx(Grid$1, {
				"data-testid": "featured-grid",
				children: projects.map((project) => /* @__PURE__ */ jsx(ProjectCard$1, {
					project,
					links
				}, project.slug))
			}) : /* @__PURE__ */ jsx(EmptyState, {
				icon: "search",
				title: "Case studies are being written up",
				description: "Each engagement gets a public write-up once it is shipped and\n            sanitized. In the meantime, the projects index is where they will\n            land — and email is the fastest way to ask about work in progress.",
				action: /* @__PURE__ */ jsx(Button, {
					as: ROUTER_LINK$4,
					to: "/projects",
					variant: "secondary",
					"data-testid": "home-featured-empty-cta",
					children: "Browse all projects"
				})
			})
		}),
		/* @__PURE__ */ jsx(Section, {
			id: "writing",
			eyebrow: "Latest writing",
			title: "Notes from the work",
			description: "Engineering and data-science notes — written for the teammate who has to maintain what I built.",
			children: latestPosts.length > 0 ? /* @__PURE__ */ jsx(PostList$1, {
				"data-testid": "latest-writing",
				children: latestPosts.map((post) => /* @__PURE__ */ jsxs(PostRow, { children: [
					/* @__PURE__ */ jsx(PostDate, { children: formatDate(post.date) }),
					/* @__PURE__ */ jsx(PostTitle$1, { children: /* @__PURE__ */ jsx(Link$1, {
						to: `/writing/${post.slug}`,
						className: links.title,
						children: post.title
					}) }),
					/* @__PURE__ */ jsxs(PostMeta, { children: [post.readingMinutes, " min read"] })
				] }, post.slug))
			}) : /* @__PURE__ */ jsx(EmptyState, {
				icon: "calendar",
				title: "Writing starts soon",
				description: "The first posts are drafted and in review. Subscribe via the RSS\n            link in the footer to hear about them the day they publish.",
				action: /* @__PURE__ */ jsx(Button, {
					as: ROUTER_LINK$4,
					to: "/writing",
					variant: "secondary",
					"data-testid": "home-writing-empty-cta",
					children: "Go to the writing index"
				})
			})
		})
	] });
}
//#endregion
//#region src/pages/About.tsx
/**
* About — the narrative profile: who I am, the toolkit, how I work.
*
* HONESTY RULE (CONTRACT §8): role-level descriptions only. No invented
* employers, clients, or projects. The story is about the shape of the
* career, not fabricated names in it.
*
* A11Y: one h1; sections are labelled landmarks with h2 headings via Section;
* the skills grid is a real <dl> (term = category, definition = tool list).
*/
var ROUTER_LINK$3 = Link$1;
var Lede$5 = styled.p`
  margin: 0 0 ${(p) => p.theme.space[5]};
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;
var Paragraph = styled.p`
  margin: 0 0 ${(p) => p.theme.space[5]};
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};

  &:last-of-type {
    margin-bottom: 0;
  }

  strong {
    color: ${(p) => p.theme.color.text};
    font-weight: ${(p) => p.theme.font.weights.semibold};
  }
`;
var Figure = styled.aside`
  margin: ${(p) => `${p.theme.space[6]} 0`};
  padding: ${(p) => p.theme.space[5]};
  border-left: 3px solid ${(p) => p.theme.color.accent};
  background: ${(p) => p.theme.color.bgElevated};
  border-radius: 0 ${(p) => p.theme.radius.md} ${(p) => p.theme.radius.md} 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  font-style: italic;
  color: ${(p) => p.theme.color.textMuted};
`;
var SkillGrid = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};
  margin: ${(p) => p.theme.space[2]} 0 0;

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${(p) => `${p.theme.space[6]} ${p.theme.space[8]}`};
  }
`;
var SkillGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
`;
var SkillTerm = styled.dt`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.accent};
`;
var SkillDefinition = styled.dd`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
var PrincipleList = styled.ol`
  list-style: none;
  counter-reset: principle;
  margin: ${(p) => p.theme.space[2]} 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[5]};
  max-width: 68ch;
`;
var Principle = styled.li`
  counter-increment: principle;
  position: relative;
  padding-left: ${(p) => `${p.theme.space[7]}`};

  &::before {
    content: counter(principle, decimal-leading-zero);
    position: absolute;
    left: 0;
    top: 0;
    font-family: ${(p) => p.theme.font.mono};
    font-size: ${(p) => p.theme.font.sizes.sm};
    font-weight: ${(p) => p.theme.font.weights.semibold};
    color: ${(p) => p.theme.color.accent};
  }

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    padding-left: ${(p) => `${p.theme.space[8]}`};
  }
`;
var PrincipleTitle = styled.p`
  margin: 0 0 ${(p) => p.theme.space[1]};
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;
var PrincipleBody = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
var ClosingRow$1 = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[6]};
`;
var SKILL_AREAS = [
	{
		area: "Languages",
		detail: "Python and TypeScript carry most of my production work; SQL is a first language, not an afterthought. Comfortable adding whatever the problem actually needs — Go for services, R for statistics, shell when it is honestly the right tool."
	},
	{
		area: "Frontend",
		detail: "React with TypeScript, component systems built on design tokens, server-rendering and prerendering, accessibility as an acceptance criterion. I care about the boring parts: state management, error surfaces, load behaviour on real connections."
	},
	{
		area: "Data",
		detail: "Analytics, feature pipelines, and model evaluation that would survive review. DuckDB and Postgres for storage, experiment design for decisions, and a healthy distrust of a metric that only moves in one demo."
	},
	{
		area: "Infrastructure",
		detail: "Containers, CI/CD, IaC, and observability that answers on-call questions at 3 a.m. Infrastructure is product surface: if the team cannot deploy it confidently on a Friday, it is not shipped."
	}
];
var PRINCIPLES = [
	{
		title: "Diagnose before prescribing",
		body: "The first deliverable on any engagement is a shared, honest picture of the problem — usually a short written one. Plans built on the wrong problem are the expensive kind of failure."
	},
	{
		title: "Prototype to answer, production to last",
		body: "Throwaway code is a tool, not a deliverable. Once a prototype has answered the question, the keepers get rewritten with tests, monitoring, and documentation before anyone calls it done."
	},
	{
		title: "Leave the team stronger",
		body: "Consulting that creates dependency is a retainer, not a result. Every handover includes the reasoning, not just the code — runbooks, decision logs, and pairing sessions while the context is still warm."
	},
	{
		title: "Numbers over vibes",
		body: "Every recommendation traces to a measurement: a latency histogram, an error budget, an evaluation curve. Where it cannot, I say so explicitly and treat the claim as provisional."
	}
];
function About() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs(Section, {
			id: "intro",
			eyebrow: "About",
			size: "wide",
			children: [/* @__PURE__ */ jsx(Heading, {
				level: 1,
				"data-testid": "about-title",
				size: "4xl",
				children: "Consultant by title, engineer by habit."
			}), /* @__PURE__ */ jsxs(Stack, {
				gap: "4",
				className: "lede-block",
				children: [
					/* @__PURE__ */ jsx(Lede$5, { children: "I am Alex Rivera — a technical consultant who came through full-stack web engineering and a data-science degree, and who still writes the code he recommends." }),
					/* @__PURE__ */ jsxs(Paragraph, { children: [
						"My path is the one I recommend to teams hiring for the fuzzy boundary between “data” and “engineering”: I started building web applications — interfaces, APIs, the whole request-to-database loop — and went back for a",
						" ",
						/* @__PURE__ */ jsx("strong", { children: "B.S. in Data Science" }),
						" because I kept meeting problems where the interesting decision was statistical, not structural. That order matters. I learned to build first, so when an analysis says “deploy this model,” I know exactly what deploying it costs."
					] }),
					/* @__PURE__ */ jsxs(Paragraph, { children: [
						"Today I work as a ",
						/* @__PURE__ */ jsx("strong", { children: "technical consultant" }),
						": embedded with engineering and data teams long enough to feel their pain, short enough to keep asking the naive questions they stopped asking. Engagements usually run the same arc — diagnose the real constraint, prototype against it, then engineer the survivor into production alongside the people who will own it after I leave."
					] }),
					/* @__PURE__ */ jsx(Figure, { children: "The most useful sentence in consulting is not “trust me, I’ve done this before.” It is “here is how you will know I was wrong.”" }),
					/* @__PURE__ */ jsx(Paragraph, { children: "What I am good at, specifically: translating between layers. Explaining a recall/precision tradeoff to the team shipping the feature. Explaining a latency budget to the model. Turning a half-formed “can AI do this for us?” into a scoped, testable plan — and then being accountable for the numbers in it." })
				]
			})]
		}),
		/* @__PURE__ */ jsx(Section, {
			id: "toolkit",
			eyebrow: "Toolkit",
			title: "What I actually reach for",
			description: "Tools are choices with consequences. These are mine, grouped the way problems arrive — not as an endorsement list.",
			children: /* @__PURE__ */ jsx(SkillGrid, {
				"data-testid": "about-skills",
				children: SKILL_AREAS.map((group) => /* @__PURE__ */ jsxs(SkillGroup, { children: [/* @__PURE__ */ jsx(SkillTerm, { children: group.area }), /* @__PURE__ */ jsx(SkillDefinition, { children: group.detail })] }, group.area))
			})
		}),
		/* @__PURE__ */ jsxs(Section, {
			id: "how-i-work",
			eyebrow: "Method",
			title: "How I work",
			description: "Four rules that have survived every engagement so far. They are also what you should hold me to.",
			children: [/* @__PURE__ */ jsx(PrincipleList, {
				"data-testid": "about-principles",
				children: PRINCIPLES.map((principle) => /* @__PURE__ */ jsxs(Principle, { children: [/* @__PURE__ */ jsx(PrincipleTitle, { children: principle.title }), /* @__PURE__ */ jsx(PrincipleBody, { children: principle.body })] }, principle.title))
			}), /* @__PURE__ */ jsxs(ClosingRow$1, { children: [/* @__PURE__ */ jsx(Button, {
				as: ROUTER_LINK$3,
				to: "/contact",
				variant: "primary",
				"data-testid": "about-cta-contact",
				children: "Start a conversation"
			}), /* @__PURE__ */ jsx(Button, {
				as: ROUTER_LINK$3,
				to: "/now",
				variant: "ghost",
				"data-testid": "about-cta-now",
				children: "What I’m focused on now"
			})] })]
		})
	] });
}
//#endregion
//#region src/pages/Now.tsx
/**
* Now — a /now-page: what I am pointed at *this quarter*, not a résumé in
* present tense. Date-stamped per the now-page convention so staleness is
* visible instead of dishonest.
*
* A11Y: one h1; each panel is a labelled section with an h2; "available for"
* is a real list of commitments, not decorative bullets.
*/
var ROUTER_LINK$2 = Link$1;
var Stamp = styled.p`
  margin: ${(p) => p.theme.space[4]} 0 0;
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  color: ${(p) => p.theme.color.textSubtle};
`;
var Dot = styled.span`
  width: ${(p) => p.theme.space[2]};
  height: ${(p) => p.theme.space[2]};
  border-radius: ${(p) => p.theme.radius.full};
  background: ${(p) => p.theme.color.success};
  flex: none;
`;
var Intro = styled.p`
  margin: ${(p) => p.theme.space[5]} 0 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
var Panels = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};
  align-items: start;

  @media (min-width: ${(p) => p.theme.breakpoint.lg}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;
var Panel$1 = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => p.theme.space[5]};
  background: ${(p) => p.theme.color.surface};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
`;
var PanelTitle$1 = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;
var ItemList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
`;
var Item = styled.li`
  position: relative;
  padding-left: ${(p) => p.theme.space[5]};
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.65em;
    width: ${(p) => p.theme.space[2]};
    height: 1px;
    background: ${(p) => p.theme.color.accent};
  }

  strong {
    color: ${(p) => p.theme.color.text};
    font-weight: ${(p) => p.theme.font.weights.semibold};
  }
`;
var FullPanel = styled(Panel$1)`
  grid-column: 1 / -1;
`;
var ClosingRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[6]};
`;
var FOCUS_AREAS = [
	{
		title: "LLM systems that survive review",
		detail: "Evaluation harnesses, retrieval architectures, and cost/latency budgets for teams moving AI features from demo to production — where the hard part is proving the answer is good enough, on purpose, continuously."
	},
	{
		title: "Data platforms sized to their teams",
		detail: "Warehouses, pipelines and storage engines matched to the people who will operate them. DuckDB when DuckDB is right; a warehouse when the concurrency says so; always the boring, observable choice first."
	},
	{
		title: "Front-end craft as an engineering discipline",
		detail: "Design-token systems, SSR/prerender pipelines, and accessibility treated like performance: measured, regression-tested, and owned by the same engineers who ship features."
	}
];
var LEARNING = [
	"Formalizing evaluation practice for retrieval systems — the gap between a good demo and a statistically defensible eval is where most AI projects quietly stall.",
	"Query-engine internals (DuckDB in particular): reading the execution engine makes better schema and file-layout decisions upstream.",
	"Writing more, in the open — turning repeated consulting answers into posts so the same advice is given once, properly."
];
var AVAILABLE_FOR = [
	"Technical due diligence and architecture reviews — a short, sharp engagement that ends in a written assessment your team can act on.",
	"Embedded consulting for data and platform work: 2–6 months, hands on keyboard, with an explicit handover plan from day one.",
	"Rescuing stalled AI/data projects: honest evaluation, a scoped path to production, or a credible recommendation to stop.",
	"Workshop-style knowledge transfer on evaluation, pipeline design, and production-readiness for engineering teams."
];
function Now() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Section, {
		id: "now-intro",
		eyebrow: "Now",
		size: "wide",
		children: [
			/* @__PURE__ */ jsx(Heading, {
				level: 1,
				"data-testid": "now-title",
				size: "4xl",
				children: "Last updated October 2026"
			}),
			/* @__PURE__ */ jsxs(Stamp, {
				"data-testid": "now-stamp",
				children: [/* @__PURE__ */ jsx(Dot, { "aria-hidden": "true" }), "Updated when the picture changes — not on a calendar."]
			}),
			/* @__PURE__ */ jsx(Intro, { children: "A standing answer to “what are you working on these days?” — published in the spirit of thenowpage.com, so you know what to expect from me before you email me." })
		]
	}), /* @__PURE__ */ jsx(Section, {
		size: "default",
		"data-testid": "now-panels",
		children: /* @__PURE__ */ jsxs(Panels, { children: [
			/* @__PURE__ */ jsxs(Panel$1, {
				"aria-labelledby": "now-focused-title",
				children: [/* @__PURE__ */ jsx(PanelTitle$1, {
					id: "now-focused-title",
					children: "Focused areas"
				}), /* @__PURE__ */ jsx(ItemList, {
					"data-testid": "now-focused",
					children: FOCUS_AREAS.map((focus) => /* @__PURE__ */ jsxs(Item, { children: [
						/* @__PURE__ */ jsxs("strong", { children: [focus.title, "."] }),
						" ",
						focus.detail
					] }, focus.title))
				})]
			}),
			/* @__PURE__ */ jsxs(Panel$1, {
				"aria-labelledby": "now-learning-title",
				children: [/* @__PURE__ */ jsx(PanelTitle$1, {
					id: "now-learning-title",
					children: "Currently learning"
				}), /* @__PURE__ */ jsx(ItemList, {
					"data-testid": "now-learning",
					children: LEARNING.map((line) => /* @__PURE__ */ jsx(Item, { children: line }, line))
				})]
			}),
			/* @__PURE__ */ jsxs(FullPanel, {
				"aria-labelledby": "now-available-title",
				children: [
					/* @__PURE__ */ jsx(PanelTitle$1, {
						id: "now-available-title",
						children: "Available for"
					}),
					/* @__PURE__ */ jsx(ItemList, {
						"data-testid": "now-available",
						children: AVAILABLE_FOR.map((line) => /* @__PURE__ */ jsx(Item, { children: line }, line))
					}),
					/* @__PURE__ */ jsxs(ClosingRow, { children: [/* @__PURE__ */ jsx(Button, {
						as: ROUTER_LINK$2,
						to: "/contact",
						variant: "primary",
						"data-testid": "now-cta-contact",
						children: "Check availability"
					}), /* @__PURE__ */ jsx(Button, {
						as: ROUTER_LINK$2,
						to: "/about",
						variant: "ghost",
						"data-testid": "now-cta-about",
						children: "Why this mix of work"
					})] })
				]
			})
		] })
	})] });
}
//#endregion
//#region src/pages/Projects.tsx
/**
* Projects — the project index: h1 "Selected work", client-side tag filter
* chips (scoped to projects only — `allTags()` is site-wide, so counts here
* come from project tags via `projectTagCounts`), a responsive card grid,
* status badges, metrics strips, and a designed EmptyState for both the
* nothing-published-yet and the filter-matches-nothing cases.
*
* DATA POSTURE: content.json starts EMPTY (CONTRACT §5 — the pipeline fills
* it later). Every list branch is empty-safe. The filtering logic is exported
* as PURE functions (`visibleProjects`, `projectTagCounts`, `statusTone`) so
* populated states are unit-testable without touching content.json.
*
* A11Y: one h1; filter chips are real <button type="button"> with
* aria-pressed (toggle semantics, keyboard-reachable, focus ring from the
* token); the result line is role="status" so SRs announce filter changes;
* each card keeps a real link inside the title (the card is `interactive`
* but is never the only affordance — Card's own guidance).
*/
/** Same shape/sort as `allTags()` (count desc, then alpha), but projects only. */
function projectTagCounts(all) {
	const counts = /* @__PURE__ */ new Map();
	for (const project of all) for (const tag of project.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	return [...counts.entries()].map(([tag, count]) => ({
		tag,
		count
	})).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
/**
* The grid contents for the active filter. `tag === null` shows everything;
* output is always newest-first (date desc, title alpha as tiebreak) so the
* grid order never depends on the input array order.
*/
function visibleProjects(all, tag) {
	return (tag === null ? [...all] : all.filter((p) => p.tags.includes(tag))).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title));
}
/** Contrast-checked Tag tone per status (all tones verified in Tag.tsx). */
function statusTone(status) {
	return status === "shipped" ? "accent" : status === "archived" ? "outline" : "default";
}
var MetaLine$4 = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;
var CardTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
`;
var CardSummary = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;
var CardFooter = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[3]};
`;
function titleLinkClass(theme) {
	return css({
		color: theme.color.text,
		textDecoration: "none",
		borderRadius: theme.radius.sm,
		display: "inline-block",
		minHeight: "28px",
		["@media (max-width: " + theme.breakpoint.md + ")"]: { minHeight: "44px" },
		"&:hover": {
			color: theme.color.accent,
			textDecoration: "underline",
			textUnderlineOffset: "3px"
		},
		"&:focus-visible": {
			outline: `2px solid ${theme.color.focus}`,
			outlineOffset: "3px"
		}
	});
}
function ctaLinkClass(theme) {
	return css({
		display: "inline-flex",
		alignItems: "center",
		minHeight: "28px",
		color: theme.color.accent,
		textDecoration: "none",
		borderRadius: theme.radius.sm,
		["@media (max-width: " + theme.breakpoint.md + ")"]: { minHeight: "44px" },
		"&:hover": {
			textDecoration: "underline",
			textUnderlineOffset: "3px"
		},
		"&:focus-visible": {
			outline: `2px solid ${theme.color.focus}`,
			outlineOffset: "3px"
		}
	});
}
var MetricsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => `${p.theme.space[2]} ${p.theme.space[5]}`};
  padding: ${(p) => `${p.theme.space[2]} 0`};
  border-top: 1px solid ${(p) => p.theme.color.border};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
`;
var MetricBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space["0"]};
`;
var MetricLabel = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;
var MetricValue = styled.span`
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  color: ${(p) => p.theme.color.text};
`;
/** Empty-safe metrics strip — returns null with no metrics, so callers never
*  render a bare bordered band. Shared with ProjectDetail. */
function ProjectMetrics({ metrics, testid = "project-metrics" }) {
	if (!metrics || metrics.length === 0) return null;
	return /* @__PURE__ */ jsx(MetricsRow, {
		"data-testid": testid,
		children: metrics.map((metric) => /* @__PURE__ */ jsxs(MetricBlock, { children: [/* @__PURE__ */ jsx(MetricLabel, { children: metric.label }), /* @__PURE__ */ jsx(MetricValue, { children: metric.value })] }, metric.label))
	});
}
function ProjectCard({ project }) {
	const theme = useTheme();
	const href = `/projects/${project.slug}`;
	return /* @__PURE__ */ jsxs(Card, {
		interactive: true,
		"data-testid": "project-card",
		children: [
			/* @__PURE__ */ jsxs(MetaLine$4, { children: [
				/* @__PURE__ */ jsx(Tag, {
					size: "sm",
					tone: statusTone(project.status),
					"data-testid": "project-status",
					children: project.status
				}),
				/* @__PURE__ */ jsx("span", {
					"aria-hidden": "true",
					children: "·"
				}),
				/* @__PURE__ */ jsx("span", { children: project.period })
			] }),
			/* @__PURE__ */ jsx(CardTitle, { children: /* @__PURE__ */ jsx(Link$1, {
				to: href,
				className: titleLinkClass(theme),
				"data-testid": "project-card-title",
				children: project.title
			}) }),
			/* @__PURE__ */ jsx(CardSummary, { children: project.summary }),
			/* @__PURE__ */ jsx(ProjectMetrics, { metrics: project.metrics }),
			/* @__PURE__ */ jsx(Stack, {
				direction: "row",
				wrap: true,
				gap: "2",
				children: project.tags.slice(0, 5).map((tag) => /* @__PURE__ */ jsx(Tag, {
					size: "sm",
					tone: "outline",
					children: tag
				}, tag))
			}),
			/* @__PURE__ */ jsx(CardFooter, { children: /* @__PURE__ */ jsxs(Link$1, {
				to: href,
				className: ctaLinkClass(theme),
				"data-testid": "project-card-cta",
				children: ["View case study ", /* @__PURE__ */ jsx("span", {
					"aria-hidden": "true",
					children: "→"
				})]
			}) })
		]
	});
}
var PageHeader$3 = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  padding-block-end: ${(p) => p.theme.space[6]};
`;
var Lede$4 = styled.p`
  margin: 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
var FilterBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
`;
var Chip$1 = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  /* R2-D V6: same control, same height as Writing chips + search input row. */
  min-height: calc(${(p) => p.theme.space[6]} + ${(p) => p.theme.space[1]});

  /* R3-D: filter chips are THE primary mobile interaction on this page —
   * phone widths get the full 44px target (WCAG 2.5.5 territory). */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    min-height: 44px;
  }
  padding: ${(p) => `${p.theme.space["1"]} ${p.theme.space[3]}`};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.none};
  border-radius: ${(p) => p.theme.radius.full};
  border: 1px solid ${(p) => p.theme.color.border};
  cursor: pointer;
  transition:
    background ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  /* Whole declarations gated on $active — never a value-level ternary that
   * resolves to false (the vendored Emotion rejects empty declarations). */
  ${(p) => p.$active && `background: ${p.theme.color.accent}; color: ${p.theme.color.bg}; border-color: ${p.theme.color.accent}; font-weight: ${p.theme.font.weights.semibold};`}
  ${(p) => !p.$active && `background: ${p.theme.color.bgElevated}; color: ${p.theme.color.textMuted}; &:hover { color: ${p.theme.color.text}; border-color: ${p.theme.color.borderStrong}; }`}

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
var ChipCount = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;
var ResultCount = styled.p`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};
`;
var Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};
  margin-top: ${(p) => p.theme.space[5]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: ${(p) => p.theme.breakpoint.lg}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;
function Projects() {
	const [tag, setTag] = useState(null);
	const all = content.projects;
	const tagCounts = projectTagCounts(all);
	const visible = visibleProjects(all, tag);
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(PageHeader$3, { children: [
		/* @__PURE__ */ jsx(Heading, {
			level: 1,
			"data-testid": "projects-title",
			children: "Selected work"
		}),
		/* @__PURE__ */ jsx(Lede$4, { children: "Systems that shipped — the reasoning behind them, the stack that carried them, and the numbers that judged them. Filter by tag to cut to one thread of the work." }),
		all.length > 0 && /* @__PURE__ */ jsxs(FilterBar, {
			role: "group",
			"aria-label": "Filter projects by tag",
			"data-testid": "tag-filter",
			children: [/* @__PURE__ */ jsxs(Chip$1, {
				type: "button",
				$active: tag === null,
				"aria-pressed": tag === null,
				onClick: () => setTag(null),
				children: ["All ", /* @__PURE__ */ jsx(ChipCount, { children: all.length })]
			}), tagCounts.map((entry) => /* @__PURE__ */ jsxs(Chip$1, {
				type: "button",
				$active: tag === entry.tag,
				"aria-pressed": tag === entry.tag,
				"aria-label": `Filter by ${entry.tag}, ${pluralize(entry.count, "project")}`,
				onClick: () => setTag(tag === entry.tag ? null : entry.tag),
				children: [
					entry.tag,
					" ",
					/* @__PURE__ */ jsx(ChipCount, { children: entry.count })
				]
			}, entry.tag))]
		}),
		all.length > 0 && /* @__PURE__ */ jsxs(ResultCount, {
			role: "status",
			children: [
				"Showing ",
				pluralize(visible.length, "project"),
				tag !== null ? ` tagged “${tag}”` : "",
				"."
			]
		})
	] }), visible.length > 0 ? /* @__PURE__ */ jsx(Grid, {
		"data-testid": "projects-grid",
		children: visible.map((project) => /* @__PURE__ */ jsx(ProjectCard, { project }, project.slug))
	}) : /* @__PURE__ */ jsx(EmptyState, {
		icon: "search",
		title: tag === null ? "No projects published yet" : `Nothing tagged “${tag}”`,
		description: tag === null ? "The case studies are still being written. Check back soon — or read the writing while you wait." : "That tag has no projects yet. Clear the filter to see the full list.",
		action: tag !== null ? /* @__PURE__ */ jsx(Button, {
			variant: "secondary",
			size: "sm",
			onClick: () => setTag(null),
			children: "Clear filter"
		}) : void 0
	})] });
}
//#endregion
//#region src/pages/NotFound.tsx
/**
* NotFound — the 404 that behaves like a host, not a wall.
*
* Renders in two contexts: the router's `*` fallback / prerendered /404 page
* (via Outlet) AND as the in-page fallback when a detail slug misses. It must
* therefore work standalone — no params, no data, no router assumptions
* beyond Link (which RouterProvider always supplies).
*
* A11Y: the h1 states the situation plainly; recovery links are real anchors
* in reading order so keyboard users escape in one Tab pass; the big glyph is
* aria-hidden decoration.
*/
var ROUTER_LINK$1 = Link$1;
function textLinkClass(theme) {
	return css({
		color: theme.color.accent,
		textDecoration: "none",
		borderRadius: theme.radius.sm,
		"&:hover": {
			textDecoration: "underline",
			textUnderlineOffset: "3px"
		},
		"&:focus-visible": {
			outline: `2px solid ${theme.color.focus}`,
			outlineOffset: "2px"
		}
	});
}
var Shell$1 = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${(p) => p.theme.space[5]};
  padding-block: ${(p) => `${p.theme.space[10]} ${p.theme.space[12]}`};
`;
var Glyph = styled.p`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes["5xl"]};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.none};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.accentSoft};
  /* The glyph is decoration; the h1 carries the meaning. Contrast rules are
   * for text that communicates — this color is deliberately background-grade. */
  user-select: none;
`;
var Body$2 = styled.p`
  margin: 0;
  max-width: 56ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
var CtaRow$1 = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[2]};
`;
var TextLinkList = styled.ul`
  list-style: none;
  margin: ${(p) => p.theme.space[4]} 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => `${p.theme.space[2]} ${p.theme.space[5]}`};
`;
var TextLinkItem = styled.li`
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-family: ${(p) => p.theme.font.mono};
  color: ${(p) => p.theme.color.textSubtle};
`;
function NotFound() {
	const linkClass = textLinkClass(useTheme());
	return /* @__PURE__ */ jsx(Container, {
		"data-testid": "not-found",
		children: /* @__PURE__ */ jsxs(Shell$1, { children: [
			/* @__PURE__ */ jsx(Glyph, {
				"aria-hidden": "true",
				children: "404"
			}),
			/* @__PURE__ */ jsx(Heading, {
				level: 1,
				"data-testid": "notfound-title",
				size: "3xl",
				children: "This page doesn’t exist — yet."
			}),
			/* @__PURE__ */ jsx(Body$2, { children: "A 404 here usually means one of three things: a project write-up is still in review, a link outlived a refactor, or you typed something creative. None of those are your problem to solve — the three links below cover almost every path through this site." }),
			/* @__PURE__ */ jsxs(CtaRow$1, { children: [
				/* @__PURE__ */ jsx(Button, {
					as: ROUTER_LINK$1,
					to: "/",
					variant: "primary",
					"data-testid": "notfound-cta-home",
					children: "Back to home"
				}),
				/* @__PURE__ */ jsx(Button, {
					as: ROUTER_LINK$1,
					to: "/projects",
					variant: "secondary",
					"data-testid": "notfound-cta-projects",
					children: "Browse projects"
				}),
				/* @__PURE__ */ jsx(Button, {
					as: ROUTER_LINK$1,
					to: "/writing",
					variant: "ghost",
					"data-testid": "notfound-cta-writing",
					children: "Read the writing"
				})
			] }),
			/* @__PURE__ */ jsxs(TextLinkList, {
				"aria-label": "Recovery links",
				children: [
					/* @__PURE__ */ jsxs(TextLinkItem, { children: ["or jump straight to ", /* @__PURE__ */ jsx(Link$1, {
						to: "/contact",
						className: linkClass,
						children: "contact"
					})] }),
					/* @__PURE__ */ jsxs(TextLinkItem, { children: ["· ", /* @__PURE__ */ jsx(Link$1, {
						to: "/about",
						className: linkClass,
						children: "about"
					})] }),
					/* @__PURE__ */ jsxs(TextLinkItem, { children: ["· ", /* @__PURE__ */ jsx(Link$1, {
						to: "/now",
						className: linkClass,
						children: "now"
					})] })
				]
			})
		] })
	});
}
//#endregion
//#region src/pages/ProjectDetail.tsx
/**
* ProjectDetail — /projects/:slug. Hero (title, role, period, status badge,
* stack tags, source/demo/paper buttons), highlights, metrics strip, then the
* build-time-rendered markdown body inside <Prose>.
*
* HTML SAFETY: `project.html` is produced at BUILD time by
* scripts/build-content.mjs from repo-owned markdown, validated with zod
* (CONTRACT §5). It is trusted content, not user input — same posture as
* prerendered HTML anywhere. dangerouslySetInnerHTML is confined to this one
* element; nothing runtime-supplied ever reaches it.
*
* UNKNOWN SLUG: getProject() miss → renders <NotFound/> (the router's
* fallback component, reused per CONTRACT §4b) and never crashes.
*
* A11Y: h1 project title; sections are landmark sections with h2s in order;
* external links get rel="noopener noreferrer" and a screen-reader suffix
* "(opens in a new tab)" via VisuallyHidden-free text (SSR-testable); related
* projects are real links.
*/
/**
* Related projects by tag overlap: shared-tag count desc, then newest first,
* then alpha; the project itself is never related to itself; max `limit`.
*/
function relatedProjects(all, current, limit = 3) {
	return all.filter((p) => p.slug !== current.slug).map((p) => ({
		project: p,
		overlap: p.tags.filter((t) => current.tags.includes(t)).length
	})).filter((entry) => entry.overlap > 0).sort((a, b) => b.overlap - a.overlap || (a.project.date < b.project.date ? 1 : a.project.date > b.project.date ? -1 : a.project.title.localeCompare(b.project.title))).slice(0, limit).map((entry) => entry.project);
}
/** Which of source/demo/paper links are present, in render order.
*  R2-A A2: `links` is optional (a project with no verified URL has none). */
function projectLinkEntries(links) {
	const entries = [];
	if (!links) return entries;
	if (links.source) entries.push({
		kind: "source",
		url: links.source
	});
	if (links.demo) entries.push({
		kind: "demo",
		url: links.demo
	});
	if (links.paper) entries.push({
		kind: "paper",
		url: links.paper
	});
	return entries;
}
var Hero = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  padding-block-end: ${(p) => p.theme.space[6]};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
`;
var MetaLine$3 = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;
var Lede$3 = styled.p`
  margin: 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
var LinkRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
`;
var Block = styled.section`
  padding-block: ${(p) => p.theme.space[6]};

  &:not(:last-of-type) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }
`;
var BlockTitle = styled.h2`
  margin: 0 0 ${(p) => p.theme.space[4]};
  font-size: ${(p) => p.theme.font.sizes["2xl"]};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.tight};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;
var PanelBody$1 = styled.p`
  margin: 0;
  max-width: 65ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
var HighlightList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  max-width: 68ch;
`;
var HighlightItem = styled.li`
  display: flex;
  gap: ${(p) => p.theme.space[3]};
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.normal};

  & svg {
    margin-top: ${(p) => p.theme.space[1]};
    color: ${(p) => p.theme.color.accent};
    flex: none;
  }
`;
var RelatedGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[4]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;
var RelatedTitle = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
`;
function relatedLinkClass(theme) {
	return css({
		display: "block",
		color: theme.color.text,
		textDecoration: "none",
		borderRadius: theme.radius.sm,
		minHeight: "28px",
		["@media (max-width: " + theme.breakpoint.md + ")"]: { minHeight: "44px" },
		"&:hover": {
			color: theme.color.accent,
			textDecoration: "underline",
			textUnderlineOffset: "3px"
		},
		"&:focus-visible": {
			outline: `2px solid ${theme.color.focus}`,
			outlineOffset: "3px"
		}
	});
}
function crumbClass(theme) {
	return css({
		display: "inline-flex",
		alignItems: "center",
		gap: theme.space[1],
		fontFamily: theme.font.mono,
		fontSize: theme.font.sizes.sm,
		color: theme.color.textSubtle,
		textDecoration: "none",
		borderRadius: theme.radius.sm,
		"&:hover": {
			color: theme.color.accent,
			textDecoration: "underline",
			textUnderlineOffset: "3px"
		},
		"&:focus-visible": {
			outline: `2px solid ${theme.color.focus}`,
			outlineOffset: "2px"
		}
	});
}
var CrumbNav = styled.nav`
  margin-bottom: ${(p) => p.theme.space[5]};
`;
var buttonLink = css({ textDecoration: "none" });
var LINK_LABEL = {
	source: "Source",
	demo: "Live demo",
	paper: "Paper"
};
function ProjectDetail() {
	const { slug } = useParams();
	const project = slug !== void 0 ? getProject(slug) : void 0;
	const theme = useTheme();
	if (!project) return /* @__PURE__ */ jsx(NotFound, {});
	const links = projectLinkEntries(project.links);
	const related = relatedProjects(content.projects, project);
	return /* @__PURE__ */ jsxs(Container, {
		"data-testid": "project-detail",
		children: [
			/* @__PURE__ */ jsx(CrumbNav, {
				"aria-label": "Breadcrumb",
				children: /* @__PURE__ */ jsx(Link$1, {
					to: "/projects",
					className: crumbClass(theme),
					children: "← All projects"
				})
			}),
			/* @__PURE__ */ jsxs(Hero, { children: [
				/* @__PURE__ */ jsxs(MetaLine$3, { children: [
					/* @__PURE__ */ jsx(Tag, {
						tone: statusTone(project.status),
						"data-testid": "project-status",
						children: project.status
					}),
					/* @__PURE__ */ jsx("span", {
						"aria-hidden": "true",
						children: "·"
					}),
					/* @__PURE__ */ jsx("span", { children: project.period }),
					/* @__PURE__ */ jsx("span", {
						"aria-hidden": "true",
						children: "·"
					}),
					/* @__PURE__ */ jsx("span", { children: formatDate(project.date) })
				] }),
				/* @__PURE__ */ jsx(Heading, {
					level: 1,
					size: "4xl",
					"data-testid": "detail-title",
					children: project.title
				}),
				/* @__PURE__ */ jsx(MetaLine$3, {
					"data-testid": "detail-role",
					children: project.role
				}),
				/* @__PURE__ */ jsx(Lede$3, { children: project.summary }),
				/* @__PURE__ */ jsx(Stack, {
					direction: "row",
					wrap: true,
					gap: "2",
					children: project.stack.map((tech) => /* @__PURE__ */ jsx(Tag, {
						size: "sm",
						tone: "accent",
						children: tech
					}, tech))
				}),
				links.length > 0 && /* @__PURE__ */ jsx(LinkRow, {
					"aria-label": "Project links",
					"data-testid": "detail-links",
					children: links.map((entry) => /* @__PURE__ */ jsxs(Button, {
						as: "a",
						href: entry.url,
						target: "_blank",
						rel: "noopener noreferrer",
						variant: entry.kind === "demo" ? "primary" : "secondary",
						className: buttonLink,
						iconRight: "external-link",
						children: [LINK_LABEL[entry.kind], /* @__PURE__ */ jsx(VisuallyHidden, { children: "(opens in a new tab)" })]
					}, entry.kind))
				}),
				/* @__PURE__ */ jsx(ProjectMetrics, {
					metrics: project.metrics,
					testid: "detail-metrics"
				})
			] }),
			project.highlights.length > 0 && /* @__PURE__ */ jsxs(Block, {
				"aria-labelledby": "highlights-title",
				children: [/* @__PURE__ */ jsx(BlockTitle, {
					id: "highlights-title",
					children: "Highlights"
				}), /* @__PURE__ */ jsx(HighlightList, {
					"data-testid": "detail-highlights",
					children: project.highlights.map((highlight) => /* @__PURE__ */ jsxs(HighlightItem, { children: [/* @__PURE__ */ jsx(Icon, {
						name: "check",
						size: 18
					}), /* @__PURE__ */ jsx("span", { children: highlight })] }, highlight))
				})]
			}),
			project.html ? /* @__PURE__ */ jsxs(Block, {
				"aria-labelledby": "case-study-title",
				children: [/* @__PURE__ */ jsx(BlockTitle, {
					id: "case-study-title",
					children: "Case study"
				}), /* @__PURE__ */ jsx(Prose, {
					"data-testid": "detail-body",
					children: /* @__PURE__ */ jsx("div", { dangerouslySetInnerHTML: { __html: project.html } })
				})]
			}) : /* @__PURE__ */ jsxs(Block, {
				"aria-labelledby": "case-study-title",
				children: [/* @__PURE__ */ jsx(BlockTitle, {
					id: "case-study-title",
					children: "Case study"
				}), /* @__PURE__ */ jsx(PanelBody$1, {
					"data-testid": "detail-body-pending",
					children: "The full write-up for this project is in review. The highlights above are the short version; email me for the long one — I keep the design docs."
				})]
			}),
			related.length > 0 && /* @__PURE__ */ jsxs(Block, {
				"aria-labelledby": "related-title",
				children: [/* @__PURE__ */ jsx(BlockTitle, {
					id: "related-title",
					children: "Related projects"
				}), /* @__PURE__ */ jsx(RelatedGrid, {
					"data-testid": "related-grid",
					children: related.map((item) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(RelatedTitle, { children: /* @__PURE__ */ jsx(Link$1, {
						to: `/projects/${item.slug}`,
						className: relatedLinkClass(theme),
						children: item.title
					}) }), /* @__PURE__ */ jsx(MetaLine$3, { children: item.summary })] }, item.slug))
				})]
			})
		]
	});
}
//#endregion
//#region src/lib/search.ts
/**
* Small deterministic client-side search for the writing + projects indexes.
*
* Design constraints (CONTRACT §0: no packages, prerendered static site):
* - O(n) per query over the record set, one pass, no index rebuild per call.
*   Records are re-normalized per query; n is tens of entries, so an upfront
*   inverted index would be more machinery than the problem deserves. If the
*   corpus ever grows past ~5k records, memoize `indexRecords()` output.
* - Deterministic ranking: score is pure arithmetic over normalized strings;
*   ties break by date (newest), then by input order (stable). Same input →
*   same output on every machine, so prerender and client agree.
* - Diacritic-insensitive: everything is NFD-normalized and combining marks
*   are stripped ("Café" matches "cafe", and vice versa).
*/
var DEFAULT_WEIGHTS = {
	title: 8,
	summary: 3,
	tags: 5,
	extra: 2
};
/** Lowercase + strip diacritics + collapse whitespace. Idempotent. */
function normalizeText(input) {
	return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
/** Split normalized text into word tokens (punctuation dropped). */
function tokenize(text) {
	const norm = normalizeText(text);
	return norm.length === 0 ? [] : norm.split(" ").flatMap((word) => word.split(/[^\p{L}\p{N}]+/u)).filter(Boolean);
}
/**
* Score one haystack against the query terms:
* +3 per term that appears as a whole token (exact word),
* +2 per term that is a prefix of a token,
* +1 per term that merely occurs as a substring,
* with an extra +4 bonus when the whole normalized query occurs in the field
* (a phrase match). Score is multiplied by the field weight.
*/
function scoreField(queryTerms, fullQuery, haystack, weight) {
	if (haystack.length === 0 || queryTerms.length === 0) return 0;
	const tokens = haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
	const tokenSet = new Set(tokens);
	let raw = 0;
	for (const term of queryTerms) if (tokenSet.has(term)) raw += 3;
	else if (tokens.some((t) => t.startsWith(term))) raw += 2;
	else if (haystack.includes(term)) raw += 1;
	if (queryTerms.length > 1 && haystack.includes(fullQuery)) raw += 4;
	return raw === 0 ? 0 : raw * weight;
}
/** True when the record passes filters (tags ⊇ filter, date within bounds). */
function passesFilters(record, filters) {
	if (!filters) return true;
	if (filters.tags && filters.tags.length > 0) {
		const recordTags = new Set((record.tags ?? []).map(normalizeText));
		for (const tag of filters.tags) if (!recordTags.has(normalizeText(tag))) return false;
	}
	if (filters.dateFrom || filters.dateTo) {
		const when = record.date ? parseIsoUtc(record.date) : null;
		if (!when) return false;
		if (filters.dateFrom) {
			const from = parseIsoUtc(filters.dateFrom);
			if (from && when < from) return false;
		}
		if (filters.dateTo) {
			const to = parseIsoUtc(filters.dateTo);
			if (to && when > to) return false;
		}
	}
	return true;
}
/** Newest-first comparator on ISO dates; undated sorts last, then slug (stable). */
function byDateDesc(a, b) {
	const ta = a.date ? parseIsoUtc(a.date)?.getTime() ?? 0 : 0;
	const tb = b.date ? parseIsoUtc(b.date)?.getTime() ?? 0 : 0;
	if (tb !== ta) return tb - ta;
	return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}
/**
* Search `records` for `query`.
*
* - Empty/whitespace query → ALL records (filters still apply), newest-first,
*   each with `score: 0` and `matchedFields: []`. The index pages use this as
*   their default listing so the list and the search share one code path.
* - Non-empty query → records with score > 0, ranked by score desc, then
*   date desc, then slug. Deterministic on every platform.
*/
function search(query, records, options = {}) {
	const { limit = 50, weights = {}, filters, extraFields } = options;
	const w = {
		...DEFAULT_WEIGHTS,
		...weights
	};
	const kept = records.filter((r) => passesFilters(r, filters));
	const normQuery = normalizeText(query);
	if (normQuery.length === 0) return [...kept].sort(byDateDesc).slice(0, Math.max(0, limit)).map((record) => ({
		record,
		score: 0,
		matchedFields: []
	}));
	const terms = tokenize(normQuery);
	const hits = [];
	for (const record of kept) {
		const fields = [
			[
				"title",
				normalizeText(record.title),
				w.title
			],
			[
				"summary",
				normalizeText(record.summary ?? ""),
				w.summary
			],
			[
				"tags",
				(record.tags ?? []).map(normalizeText).join(" "),
				w.tags
			]
		];
		if (extraFields) for (const [name, text] of Object.entries(extraFields(record))) fields.push([
			name,
			normalizeText(text),
			w.extra
		]);
		let score = 0;
		const matchedFields = [];
		for (const [name, text, weight] of fields) {
			const fieldScore = scoreField(terms, normQuery, text, weight);
			if (fieldScore > 0) {
				score += fieldScore;
				matchedFields.push(name);
			}
		}
		if (score > 0) hits.push({
			record,
			score,
			matchedFields
		});
	}
	hits.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const dateCmp = byDateDesc(a.record, b.record);
		if (dateCmp !== 0) return dateCmp;
		return a.record.slug < b.record.slug ? -1 : a.record.slug > b.record.slug ? 1 : 0;
	});
	return hits.slice(0, Math.max(0, limit));
}
/** Slice a list into 1-based pages; out-of-range pages clamp, never crash. */
function paginate(posts, page, perPage = 8) {
	const per = Math.max(1, Math.floor(perPage));
	const pageCount = Math.max(1, Math.ceil(posts.length / per));
	const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
	const start = (current - 1) * per;
	const items = posts.slice(start, start + per);
	return {
		items,
		page: current,
		pageCount,
		total: posts.length,
		firstIndex: items.length === 0 ? 0 : start + 1,
		lastIndex: start + items.length
	};
}
/** Tag list for the filter chips: count desc, then alphabetical (content API order). */
function tagsFromPosts(posts) {
	const counts = /* @__PURE__ */ new Map();
	for (const post of posts) for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	return [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
}
/**
* Filter posts by free-text query (title/summary/tags/excerpt) and/or one
* tag. Empty query → every post, newest first — the same code path, so the
* default listing and search results are ranked identically.
*/
function filterPosts(posts, query, tag) {
	return search(query, posts, {
		limit: posts.length,
		...tag !== void 0 && tag !== "" ? { filters: { tags: [tag] } } : {},
		extraFields: (post) => ({ excerpt: post.excerpt })
	}).map((hit) => hit.record);
}
var Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  margin-bottom: ${(p) => p.theme.space[6]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${(p) => p.theme.space[6]};
  }
`;
var PageHeader$2 = styled.header`
  margin: ${(p) => p.theme.space[6]} 0;
`;
var Lead = styled.p`
  margin: ${(p) => p.theme.space[3]} 0 0;
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;
var PostTitle = styled.h2`
  margin: 0;
`;
var SearchForm = styled.form`
  position: relative;
  display: flex;
  flex: 1 1 auto;
  max-width: 28rem;
  width: 100%;
`;
var SearchGlyph = styled.span`
  position: absolute;
  left: ${(p) => p.theme.space[3]};
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  color: ${(p) => p.theme.color.textSubtle};
  pointer-events: none;
`;
var SearchInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  min-height: calc(${(p) => p.theme.space[6]} + ${(p) => p.theme.space[4]});
  padding-block: ${(p) => p.theme.space[2]};
  padding-inline-start: calc(${(p) => p.theme.space[2]} + ${(p) => p.theme.space[6]});
  padding-inline-end: ${(p) => p.theme.space[4]};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.md};
  color: ${(p) => p.theme.color.text};
  background: ${(p) => p.theme.color.surface};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  transition: border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  &::placeholder {
    color: ${(p) => p.theme.color.textSubtle};
  }
  &:hover {
    border-color: ${(p) => p.theme.color.borderStrong};
  }
  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;
var ChipGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
`;
var ChipLabel = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
  margin-inline-end: ${(p) => p.theme.space[1]};
`;
var Chip = styled.button`
  display: inline-flex;
  align-items: center;
  min-height: calc(${(p) => p.theme.space[6]} + ${(p) => p.theme.space[1]});
  /* R3-D: 44px touch targets at phone widths (tag filtering is the main
   * mobile affordance on this page). */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    min-height: 44px;
  }
  padding: ${(p) => p.theme.space["0"]} ${(p) => p.theme.space[3]};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  line-height: ${(p) => p.theme.font.leading.none};
  border-radius: ${(p) => p.theme.radius.full};
  border: 1px solid ${(p) => p.theme.color.border};
  cursor: pointer;
  transition:
    background ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease},
    border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  ${(p) => p.$active && `background: ${p.theme.color.accent}; color: ${p.theme.color.bg}; border-color: ${p.theme.color.accent};`}
  ${(p) => !p.$active && `background: ${p.theme.color.surface}; color: ${p.theme.color.text}; &:hover { background: ${p.theme.color.accentSoft}; color: ${p.theme.color.accent}; border-color: ${p.theme.color.accentBorder}; }`}

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
var StatusLine = styled.p`
  margin: 0 0 ${(p) => p.theme.space[4]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};
`;
var PostList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[5]};
`;
var PostItem = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  padding: ${(p) => p.theme.space[4]};
  background: ${(p) => p.theme.color.surface};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
  transition: border-color ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  &:hover {
    border-color: ${(p) => p.theme.color.borderStrong};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
var MetaLine$2 = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;
var Sep$1 = styled.span`
  color: ${(p) => p.theme.color.textSubtle};
`;
var Summary$1 = styled.p`
  margin: 0;
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;
var TagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[2]};
`;
function titleLinkCss(theme) {
	return css({
		margin: 0,
		fontFamily: theme.font.sans,
		fontSize: theme.font.sizes.xl,
		fontWeight: theme.font.weights.bold,
		lineHeight: theme.font.leading.snug,
		letterSpacing: theme.font.tracking.tight,
		color: theme.color.text,
		textDecoration: "none",
		"&:hover": { color: theme.color.accent },
		"&:focus-visible": {
			outline: `2px solid ${theme.color.focus}`,
			outlineOffset: "2px",
			borderRadius: theme.radius.sm
		}
	});
}
function Writing() {
	const theme = useTheme();
	const reducedMotion = useReducedMotion();
	const [query, setQuery] = useState("");
	const [activeTag, setActiveTag] = useState(void 0);
	const [page, setPage] = useState(1);
	const debouncedQuery = useDebouncedValue(query, 200);
	const allPosts = useMemo(() => postsByDate(), []);
	const availableTags = useMemo(() => tagsFromPosts(allPosts), [allPosts]);
	const filtered = useMemo(() => filterPosts(allPosts, debouncedQuery, activeTag), [
		allPosts,
		debouncedQuery,
		activeTag
	]);
	const pageData = paginate(filtered, page);
	const clearFilters = () => {
		setQuery("");
		setActiveTag(void 0);
		setPage(1);
	};
	/**
	* Pagination links keep real hrefs (`/writing?page=N`) for middle-click and
	* no-JS; here we intercept the click so paging stays in the SPA and updates
	* state. Keyboard Enter on a link dispatches a click, so the keyboard path
	* takes exactly the same route.
	*/
	const onPaginate = (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const anchor = target.closest("a");
		if (!anchor || anchor.getAttribute("aria-disabled") === "true") return;
		const href = anchor.getAttribute("href") ?? "";
		const match = /[?&]page=(\d+)/.exec(href);
		if (!match) return;
		event.preventDefault();
		const next = Number(match[1]);
		if (next === pageData.page) return;
		setPage(next);
		if (typeof document !== "undefined") document.getElementById("post-list")?.scrollIntoView({
			behavior: reducedMotion ? "auto" : "smooth",
			block: "start"
		});
	};
	const linkCls = titleLinkCss(theme);
	const filtering = debouncedQuery.trim() !== "" || activeTag !== void 0;
	return /* @__PURE__ */ jsxs(Container, {
		"data-testid": "writing-page",
		children: [
			/* @__PURE__ */ jsxs(PageHeader$2, { children: [/* @__PURE__ */ jsx(Heading, {
				level: 1,
				"data-testid": "writing-title",
				children: "Writing"
			}), /* @__PURE__ */ jsx(Lead, { children: "Notes on building software — architecture, data, and the occasional post-mortem." })] }),
			/* @__PURE__ */ jsxs(Toolbar, { children: [/* @__PURE__ */ jsxs(SearchForm, {
				role: "search",
				onSubmit: (e) => e.preventDefault(),
				"data-testid": "post-search-form",
				children: [
					/* @__PURE__ */ jsx(VisuallyHidden, { children: /* @__PURE__ */ jsx("label", {
						htmlFor: "post-search",
						children: "Search posts by title, tag, or summary"
					}) }),
					/* @__PURE__ */ jsx(SearchGlyph, { children: /* @__PURE__ */ jsx(Icon, {
						name: "search",
						size: 16
					}) }),
					/* @__PURE__ */ jsx(SearchInput, {
						id: "post-search",
						type: "search",
						autoComplete: "off",
						placeholder: "Search posts…",
						value: query,
						onChange: (e) => {
							setQuery(e.target.value);
							setPage(1);
						},
						"data-testid": "post-search"
					})
				]
			}), availableTags.length > 0 && /* @__PURE__ */ jsxs(ChipGroup, {
				role: "group",
				"aria-label": "Filter posts by tag",
				"data-testid": "tag-filters",
				children: [
					/* @__PURE__ */ jsx(ChipLabel, {
						id: "tag-filter-label",
						"aria-hidden": "true",
						children: "Filter"
					}),
					/* @__PURE__ */ jsx(Chip, {
						type: "button",
						$active: activeTag === void 0,
						"aria-pressed": activeTag === void 0,
						onClick: () => {
							setActiveTag(void 0);
							setPage(1);
						},
						"data-testid": "tag-chip-all",
						children: "All"
					}),
					availableTags.map((tag) => /* @__PURE__ */ jsx(Chip, {
						type: "button",
						$active: activeTag === tag,
						"aria-pressed": activeTag === tag,
						onClick: () => {
							setActiveTag(activeTag === tag ? void 0 : tag);
							setPage(1);
						},
						"data-testid": `tag-chip-${tag}`,
						children: tag
					}, tag))
				]
			})] }),
			filtered.length === 0 ? allPosts.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
				icon: "calendar",
				title: "No posts yet",
				description: "Essays land here as they are published. Check back soon, or subscribe via RSS."
			}) : /* @__PURE__ */ jsx(EmptyState, {
				icon: "search",
				title: "No posts match",
				description: filtering ? "Try a different phrase, or clear the tag filter to see everything." : "Nothing to show here yet.",
				action: /* @__PURE__ */ jsx(Button, {
					variant: "secondary",
					size: "sm",
					onClick: clearFilters,
					"data-testid": "clear-filters",
					children: "Clear search and filters"
				})
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx(StatusLine, {
					role: "status",
					"data-testid": "post-count",
					children: pageData.total > 8 ? `Showing ${pageData.firstIndex}–${pageData.lastIndex} of ${pluralize(pageData.total, "post")}` : `Showing all ${pluralize(pageData.total, "post")}`
				}),
				/* @__PURE__ */ jsx(PostList, {
					id: "post-list",
					"data-testid": "post-list",
					children: pageData.items.map((post) => /* @__PURE__ */ jsxs(PostItem, { children: [
						/* @__PURE__ */ jsxs(MetaLine$2, { children: [
							/* @__PURE__ */ jsx("time", {
								dateTime: post.date,
								children: formatDate(post.date)
							}),
							/* @__PURE__ */ jsx(Sep$1, {
								"aria-hidden": "true",
								children: "·"
							}),
							/* @__PURE__ */ jsx("span", { children: formatReadingTime(post.readingMinutes) }),
							post.series !== void 0 && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Sep$1, {
								"aria-hidden": "true",
								children: "·"
							}), /* @__PURE__ */ jsx(Tag, {
								tone: "accent",
								size: "sm",
								children: post.series
							})] })
						] }),
						/* @__PURE__ */ jsx(PostTitle, { children: /* @__PURE__ */ jsx(Link$1, {
							to: `/writing/${post.slug}`,
							className: linkCls,
							"data-testid": `post-link-${post.slug}`,
							children: post.title
						}) }),
						/* @__PURE__ */ jsx(Summary$1, { children: post.summary }),
						post.tags.length > 0 && /* @__PURE__ */ jsx(TagRow, { children: post.tags.map((tag) => /* @__PURE__ */ jsx(Tag, {
							size: "sm",
							children: tag
						}, tag)) })
					] }, post.slug))
				}),
				pageData.pageCount > 1 && /* @__PURE__ */ jsx("div", {
					onClick: onPaginate,
					"data-testid": "pagination-host",
					children: /* @__PURE__ */ jsx(Pagination, {
						page: pageData.page,
						total: pageData.pageCount,
						hrefFor: (n) => n === 1 ? "/writing" : `/writing?page=${n}`,
						label: "Writing pages"
					})
				})
			] })
		]
	});
}
//#endregion
//#region src/pages/PostDetail.tsx
/**
* PostDetail — a single essay.
*
* Renders the build-time validated markdown (`post.html` is produced by
* scripts/build-content.mjs through the vetted vendor/markdown engine — the
* one place dangerouslySetInnerHTML is honest, CONTRACT §5) inside <Prose>,
* which owns the article typography.
*
* Semantics:
*  - back link to /writing (real router Link, keeps section nav active);
*  - <article> around the post; h1 → meta row (<time>, reading time, series
*    Tag) → prose; heading order never skips;
*  - prev/next navigation by date order in a labelled <nav> (newer post is
*    "Previous", older is "Next" on a newest-first timeline — labelled
*    explicitly so direction is never ambiguous);
*  - copy-link button announces via role="status" and never throws (the hook
*    falls back to execCommand; SSR renders the idle state).
*/
/**
* Neighbours of `slug` in a list ALREADY sorted newest-first. Undefined for
* unknown slugs and at the ends — callers must never crash on the edges.
*/
function neighboursByDate(postsNewestFirst, slug) {
	const index = postsNewestFirst.findIndex((post) => post.slug === slug);
	if (index === -1) return {
		previous: void 0,
		next: void 0
	};
	return {
		previous: index > 0 ? postsNewestFirst[index - 1] : void 0,
		next: index < postsNewestFirst.length - 1 ? postsNewestFirst[index + 1] : void 0
	};
}
/** The absolute URL to copy, computed browser-side only (SSR-safe pure form). */
function shareUrl(origin, slug) {
	return `${origin.replace(/\/+$/, "")}/writing/${slug}`;
}
var Article = styled.article`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[5]};
  margin-block: ${(p) => p.theme.space[6]};
`;
var BackRow = styled.p`
  margin: 0;
`;
var HeaderRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${(p) => p.theme.space[3]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: ${(p) => p.theme.space[4]};
  }
`;
var TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  min-width: 0;
`;
var MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;
var Sep = styled.span`
  color: ${(p) => p.theme.color.textSubtle};
`;
var ShareWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${(p) => p.theme.space[1]};
`;
var ShareStatus = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.success};
  min-height: 1lh;
`;
var Body$1 = styled.div`
  border-top: 1px solid ${(p) => p.theme.color.border};
  padding-top: ${(p) => p.theme.space[6]};
`;
var Pager = styled.nav`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${(p) => p.theme.space[4]};
  margin-block: ${(p) => p.theme.space[7]} ${(p) => p.theme.space[4]};
  padding-top: ${(p) => p.theme.space[6]};
  border-top: 1px solid ${(p) => p.theme.color.border};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: 1fr 1fr;
  }
`;
var PagerItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
  ${(p) => p.$align === "end" && "align-items: flex-end; text-align: end;"}
`;
var PagerHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;
var PagerSpacer = styled.div``;
/**
* Link skinning: styled(Link) would strip the router `to` prop (the vendored
* prop filter drops non-DOM props from component targets — see Button.tsx),
* so links get a css() class instead. Identical rule text, no middleman.
*/
function linkSkin(theme, opts) {
	const t = theme;
	return css({
		textDecoration: "none",
		color: opts.size === "back" ? t.color.textMuted : t.color.text,
		fontFamily: opts.size === "back" ? t.font.mono : t.font.sans,
		fontSize: opts.size === "back" ? t.font.sizes.sm : t.font.sizes.lg,
		fontWeight: opts.size === "back" ? t.font.weights.normal : t.font.weights.semibold,
		lineHeight: t.font.leading.snug,
		display: opts.size === "back" ? "inline-flex" : "block",
		alignItems: "center",
		gap: t.space[1],
		"&:hover": { color: t.color.accent },
		"&:focus-visible": {
			outline: `2px solid ${t.color.focus}`,
			outlineOffset: "2px",
			borderRadius: t.radius.sm
		}
	});
}
function PostDetail() {
	const theme = useTheme();
	const { slug } = useParams();
	const post = slug !== void 0 ? getPost(slug) : void 0;
	const [shareError, setShareError] = useState(false);
	const { copy, copied } = useCopyToClipboard();
	const neighbours = useMemo(() => post ? neighboursByDate(postsByDate(), post.slug) : {
		previous: void 0,
		next: void 0
	}, [post]);
	if (!post) return /* @__PURE__ */ jsx(NotFound, {});
	const backCls = linkSkin(theme, { size: "back" });
	const pagerCls = linkSkin(theme, { size: "pager" });
	const copyLink = async () => {
		setShareError(false);
		const url = typeof window !== "undefined" ? window.location.href : shareUrl("http://localhost:4173", post.slug);
		if (!await copy(url)) setShareError(true);
	};
	const shareMessage = shareError ? "Copy failed — select the address bar to copy the link." : copied ? "Link copied to clipboard." : "";
	return /* @__PURE__ */ jsx(Container, {
		size: "prose",
		"data-testid": "post-page",
		children: /* @__PURE__ */ jsxs(Article, {
			"data-testid": "post-article",
			children: [
				/* @__PURE__ */ jsx(BackRow, { children: /* @__PURE__ */ jsxs(Link$1, {
					to: "/writing",
					className: backCls,
					"data-testid": "back-to-writing",
					children: [/* @__PURE__ */ jsx(Icon, {
						name: "chevron-left",
						size: 14
					}), "All writing"]
				}) }),
				/* @__PURE__ */ jsxs(HeaderRow, { children: [/* @__PURE__ */ jsxs(TitleBlock, { children: [/* @__PURE__ */ jsx(Heading, {
					level: 1,
					"data-testid": "post-title",
					children: post.title
				}), /* @__PURE__ */ jsxs(MetaRow, {
					"data-testid": "post-meta",
					children: [
						/* @__PURE__ */ jsx("time", {
							dateTime: post.date,
							children: formatDate(post.date, { style: "long" })
						}),
						/* @__PURE__ */ jsx(Sep, {
							"aria-hidden": "true",
							children: "·"
						}),
						/* @__PURE__ */ jsx("span", { children: formatReadingTime(post.readingMinutes) }),
						post.series !== void 0 && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Sep, {
							"aria-hidden": "true",
							children: "·"
						}), /* @__PURE__ */ jsx(Tag, {
							tone: "accent",
							size: "sm",
							"data-testid": "series-badge",
							children: post.series
						})] })
					]
				})] }), /* @__PURE__ */ jsxs(ShareWrap, { children: [/* @__PURE__ */ jsx(Button, {
					variant: "secondary",
					size: "sm",
					iconLeft: copied ? "check" : "external-link",
					onClick: () => void copyLink(),
					"aria-label": "Copy link to this post",
					"data-testid": "copy-link",
					children: copied ? "Copied" : "Copy link"
				}), /* @__PURE__ */ jsx(ShareStatus, {
					role: "status",
					"aria-live": "polite",
					"data-testid": "share-status",
					children: shareMessage
				})] })] }),
				/* @__PURE__ */ jsx(Body$1, { children: /* @__PURE__ */ jsx(Prose, {
					"data-testid": "post-prose",
					children: /* @__PURE__ */ jsx("div", { dangerouslySetInnerHTML: { __html: post.html } })
				}) }),
				(neighbours.previous !== void 0 || neighbours.next !== void 0) && /* @__PURE__ */ jsxs(Pager, {
					"aria-label": "Post navigation",
					"data-testid": "post-nav",
					children: [neighbours.previous !== void 0 ? /* @__PURE__ */ jsxs(PagerItem, {
						$align: "start",
						children: [/* @__PURE__ */ jsxs(PagerHint, { children: [/* @__PURE__ */ jsx(Icon, {
							name: "chevron-left",
							size: 12
						}), "Previous (newer)"] }), /* @__PURE__ */ jsx(Link$1, {
							to: `/writing/${neighbours.previous.slug}`,
							className: pagerCls,
							"data-testid": "prev-post",
							children: neighbours.previous.title
						})]
					}) : /* @__PURE__ */ jsx(PagerSpacer, { "aria-hidden": "true" }), neighbours.next !== void 0 ? /* @__PURE__ */ jsxs(PagerItem, {
						$align: "end",
						children: [/* @__PURE__ */ jsxs(PagerHint, { children: ["Next (older)", /* @__PURE__ */ jsx(Icon, {
							name: "chevron-right",
							size: 12
						})] }), /* @__PURE__ */ jsx(Link$1, {
							to: `/writing/${neighbours.next.slug}`,
							className: pagerCls,
							"data-testid": "next-post",
							children: neighbours.next.title
						})]
					}) : /* @__PURE__ */ jsx(PagerSpacer, { "aria-hidden": "true" })]
				})
			]
		})
	});
}
//#endregion
//#region src/pages/Videos.tsx
/**
* Videos — the video library. Honest links, not fake players: every row is an
* external anchor (target="_blank", rel="noopener noreferrer") to the host —
* no embed placeholders that pretend to play (a dead play button is the
* classic portfolio lie; the brief bans fake embed players outright).
*
* Grouping: videos dated in the FUTURE are "Upcoming" (premiere/announced
* slots), the rest are "Past videos", newest first. "Today" is pinned to UTC
* (src/lib/format.ts posture — the prerendered shell and the hydrated client
* must agree), and the cutoff is passed INTO the pure helper (`splitByDate`)
* so unit tests are deterministic.
*
* A11Y: one h1; groups are landmark sections named by h2s; the provider badge
* is text (never colour-only); each row's title is a real anchor carrying the
* external affordance + a VisuallyHidden "opens in a new tab" suffix; focus
* rings come from the token palette.
*/
/** Newest-first order (ISO dates sort lexically; title breaks ties). */
function videosByDate(all) {
	return [...all].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title));
}
/**
* Split into (upcoming, past) around `todayIso` (inclusive: a video premiering
* TODAY is upcoming). `todayIso` is a parameter — never Date.now() inside —
* so prerender output is reproducible and unit tests are deterministic.
*/
function splitByDate(all, todayIso) {
	const sorted = videosByDate(all);
	return {
		upcoming: sorted.filter((v) => v.date >= todayIso),
		past: sorted.filter((v) => v.date < todayIso)
	};
}
/** Display label for the provider badge. */
function providerLabel(provider) {
	return provider === "youtube" ? "YouTube" : provider === "vimeo" ? "Vimeo" : "Other";
}
/** TODAY under UTC — zone-pinned so server and client group identically. */
function todayUtcIso(now = /* @__PURE__ */ new Date()) {
	return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}
var GroupSection = styled.section`
  padding-block: ${(p) => p.theme.space[6]};

  &:not(:last-of-type) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }
`;
var GroupTitle = styled.h2`
  margin: 0 0 ${(p) => p.theme.space[4]};
  font-size: ${(p) => p.theme.font.sizes["2xl"]};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.tight};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;
var VideoList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;
var VideoRow = styled.li`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[4]};
  padding-block: ${(p) => p.theme.space[4]};
  flex-wrap: wrap;

  &:not(:last-child) {
    border-bottom: 1px solid ${(p) => p.theme.color.border};
  }
`;
var RowMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
  min-width: 0;
  flex: 1 1 auto;
`;
var TitleRow = styled.h3`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
`;
var Summary = styled.p`
  margin: 0;
  max-width: 68ch;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.normal};
  color: ${(p) => p.theme.color.textMuted};
`;
var MetaLine$1 = styled.p`
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;
var DurationBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[1]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textMuted};
`;
var RowAside = styled.div`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  flex: none;
`;
function videoTitleClass(theme) {
	return css({
		color: theme.color.text,
		textDecoration: "none",
		borderRadius: theme.radius.sm,
		display: "inline",
		"&:hover": {
			color: theme.color.accent,
			textDecoration: "underline",
			textUnderlineOffset: "3px"
		},
		"&:focus-visible": {
			outline: `2px solid ${theme.color.focus}`,
			outlineOffset: "3px"
		}
	});
}
var InlineIcon = styled.span`
  display: inline-flex;
  align-items: center;
  vertical-align: -0.15em;
  color: ${(p) => p.theme.color.accent};
`;
function VideoRowItem({ video }) {
	const theme = useTheme();
	return /* @__PURE__ */ jsxs(VideoRow, {
		"data-testid": "video-row",
		children: [/* @__PURE__ */ jsxs(RowMain, { children: [
			/* @__PURE__ */ jsx(TitleRow, { children: /* @__PURE__ */ jsxs("a", {
				href: video.url,
				target: "_blank",
				rel: "noopener noreferrer",
				className: videoTitleClass(theme),
				"data-testid": "video-link",
				children: [
					/* @__PURE__ */ jsx(InlineIcon, { children: /* @__PURE__ */ jsx(Icon, {
						name: "play",
						size: 16
					}) }),
					" ",
					video.title,
					/* @__PURE__ */ jsx(VisuallyHidden, { children: "(opens in a new tab)" })
				]
			}) }),
			/* @__PURE__ */ jsx(Summary, { children: video.summary }),
			/* @__PURE__ */ jsxs(MetaLine$1, { children: [
				/* @__PURE__ */ jsx("span", { children: formatDate(video.date) }),
				video.event && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("span", {
					"aria-hidden": "true",
					children: "·"
				}), /* @__PURE__ */ jsx("span", { children: video.event })] }),
				video.speakers && video.speakers.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("span", {
					"aria-hidden": "true",
					children: "·"
				}), /* @__PURE__ */ jsx("span", { children: video.speakers.join(", ") })] })
			] })
		] }), /* @__PURE__ */ jsxs(RowAside, { children: [/* @__PURE__ */ jsx(Tag, {
			size: "sm",
			tone: "outline",
			"data-testid": "video-provider",
			children: providerLabel(video.provider)
		}), /* @__PURE__ */ jsxs(DurationBadge, {
			"data-testid": "video-duration",
			children: [/* @__PURE__ */ jsx(Icon, {
				name: "clock",
				size: 14
			}), video.duration]
		})] })]
	});
}
var PageHeader$1 = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  padding-block-end: ${(p) => p.theme.space[6]};
`;
var Lede$2 = styled.p`
  margin: 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
function Videos() {
	const { upcoming, past } = splitByDate(content.videos, todayUtcIso());
	const total = content.videos.length;
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(PageHeader$1, { children: [
		/* @__PURE__ */ jsx(Heading, {
			level: 1,
			"data-testid": "videos-title",
			children: "Videos"
		}),
		/* @__PURE__ */ jsx(Lede$2, { children: "Conference talks, meet-up demos, and interviews — every entry links out to the host where it actually plays." }),
		total > 0 && /* @__PURE__ */ jsxs(MetaLine$1, {
			role: "status",
			"data-testid": "videos-count",
			children: [pluralize(total, "video"), " in the library."]
		})
	] }), total === 0 ? /* @__PURE__ */ jsx(EmptyState, {
		icon: "play",
		title: "No videos yet",
		description: "Recording links land here as talks and demos go up. Nothing to watch today."
	}) : /* @__PURE__ */ jsxs(Fragment, { children: [upcoming.length > 0 && /* @__PURE__ */ jsxs(GroupSection, {
		"aria-labelledby": "videos-upcoming-title",
		"data-testid": "videos-upcoming",
		children: [/* @__PURE__ */ jsx(GroupTitle, {
			id: "videos-upcoming-title",
			children: "Upcoming"
		}), /* @__PURE__ */ jsx(VideoList, { children: upcoming.map((video) => /* @__PURE__ */ jsx(VideoRowItem, { video }, video.slug)) })]
	}), past.length > 0 && /* @__PURE__ */ jsxs(GroupSection, {
		"aria-labelledby": "videos-past-title",
		"data-testid": "videos-past",
		children: [/* @__PURE__ */ jsx(GroupTitle, {
			id: "videos-past-title",
			children: "Past videos"
		}), /* @__PURE__ */ jsx(VideoList, { children: past.map((video) => /* @__PURE__ */ jsx(VideoRowItem, { video }, video.slug)) })]
	})] })] });
}
//#endregion
//#region src/pages/Talks.tsx
/**
* Talks — speaking history as a list of expandable cards: event, date,
* location, abstract behind a native <details>/<summary> (keyboard-usable
* with zero JS, works prerendered, and toggles are announced), plus slides /
* video links when present (external, rel="noopener noreferrer").
*
* Native <details> is deliberate: no fake accordion, no aria-expanded lying
* about a state we don't own — the browser keeps the disclosure semantics and
* the summary is a real focusable control.
*
* A11Y: one h1; each talk is an <li> whose summary carries the event + title;
* slides/video anchors get the external icon and a VisuallyHidden "opens in a
* new tab" suffix; dates are <time datetime> so ATs get the machine date.
*/
/** Newest-first (ISO dates sort lexically; title breaks ties). */
function talksByDate(all) {
	return [...all].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title));
}
/** Which of slides/video are present, in render order. */
function talkResourceEntries(talk) {
	const entries = [];
	if (talk.slidesUrl) entries.push({
		kind: "slides",
		url: talk.slidesUrl
	});
	if (talk.videoUrl) entries.push({
		kind: "video",
		url: talk.videoUrl
	});
	return entries;
}
var TalkList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
`;
var TalkItem = styled.li`
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
  background: ${(p) => p.theme.color.surface};
  box-shadow: ${(p) => p.theme.shadow.sm};
`;
var Disclosure = styled.details`
  & > summary {
    cursor: pointer;
    list-style: none;
    padding: ${(p) => `${p.theme.space[4]} ${p.theme.space[5]}`};
    border-radius: ${(p) => p.theme.radius.lg};
    display: grid;
    gap: ${(p) => p.theme.space[2]};
    transition: background ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

    &::-webkit-details-marker {
      display: none;
    }

    &:hover {
      background: ${(p) => p.theme.color.surfaceHover};
    }

    &:focus-visible {
      outline: 2px solid ${(p) => p.theme.color.focus};
      outline-offset: -2px;
    }
  }

  /* Chevron rotation follows the native disclosure state — no JS, so the
   * prerendered shell behaves exactly like the live page. */
  &[open] > summary svg {
    transform: rotate(90deg);
  }

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    & > summary {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: baseline;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    & > summary {
      transition: none;
    }
  }
`;
var SummaryMain = styled.span`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
  min-width: 0;
`;
var EventName = styled.span`
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.accent};
`;
var TalkTitle = styled.span`
  font-size: ${(p) => p.theme.font.sizes.lg};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;
var SummaryAside = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.sm};
  color: ${(p) => p.theme.color.textSubtle};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    justify-content: end;
  }
`;
var Chevron = styled.span`
  display: inline-block;
  color: ${(p) => p.theme.color.textSubtle};
  transform: rotate(0deg);
  transition: transform ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.ease};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;
var Body = styled.div`
  padding: ${(p) => `0 ${p.theme.space[5]} ${p.theme.space[5]}`};
  border-top: 1px solid ${(p) => p.theme.color.border};
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
`;
var Abstract = styled.div`
  margin: ${(p) => p.theme.space[4]} 0 0;
  max-width: 68ch;
  white-space: pre-line;
  color: ${(p) => p.theme.color.text};
  line-height: ${(p) => p.theme.font.leading.normal};
`;
var ResourceRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
`;
function resourceLinkClass(theme) {
	return css({
		display: "inline-flex",
		alignItems: "center",
		gap: theme.space[2],
		minHeight: "44px",
		padding: `${theme.space["1"]} ${theme.space["3"]}`,
		fontFamily: theme.font.sans,
		fontSize: theme.font.sizes.sm,
		fontWeight: theme.font.weights.semibold,
		color: theme.color.accent,
		textDecoration: "none",
		border: `1px solid ${theme.color.accentBorder}`,
		borderRadius: theme.radius.md,
		"&:hover": { background: theme.color.accentSoft },
		"&:focus-visible": {
			outline: `2px solid ${theme.color.focus}`,
			outlineOffset: "2px"
		}
	});
}
function TalkCard({ talk }) {
	const theme = useTheme();
	const resources = talkResourceEntries(talk);
	return /* @__PURE__ */ jsx(TalkItem, {
		"data-testid": "talk-card",
		children: /* @__PURE__ */ jsxs(Disclosure, { children: [/* @__PURE__ */ jsxs("summary", {
			"data-testid": "talk-summary",
			children: [/* @__PURE__ */ jsxs(SummaryMain, { children: [/* @__PURE__ */ jsx(EventName, { children: talk.event }), /* @__PURE__ */ jsx(TalkTitle, { children: talk.title })] }), /* @__PURE__ */ jsxs(SummaryAside, { children: [
				/* @__PURE__ */ jsx("time", {
					dateTime: talk.date,
					children: formatDate(talk.date)
				}),
				/* @__PURE__ */ jsx("span", {
					"aria-hidden": "true",
					children: "·"
				}),
				/* @__PURE__ */ jsx("span", { children: talk.location }),
				/* @__PURE__ */ jsx(Chevron, {
					"aria-hidden": "true",
					children: /* @__PURE__ */ jsx(Icon, {
						name: "chevron-right",
						size: 16
					})
				})
			] })]
		}), /* @__PURE__ */ jsxs(Body, { children: [/* @__PURE__ */ jsx(Abstract, {
			"data-testid": "talk-abstract",
			children: talk.abstract
		}), resources.length > 0 && /* @__PURE__ */ jsx(ResourceRow, {
			"aria-label": "Talk resources",
			"data-testid": "talk-resources",
			children: resources.map((entry) => /* @__PURE__ */ jsxs("a", {
				href: entry.url,
				target: "_blank",
				rel: "noopener noreferrer",
				className: resourceLinkClass(theme),
				"data-testid": `talk-${entry.kind}-link`,
				children: [
					/* @__PURE__ */ jsx(Icon, {
						name: entry.kind === "slides" ? "download" : "play",
						size: 16
					}),
					entry.kind === "slides" ? "Slides" : "Watch",
					/* @__PURE__ */ jsx(VisuallyHidden, { children: "(opens in a new tab)" })
				]
			}, entry.kind))
		})] })] })
	});
}
var PageHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[4]};
  padding-block-end: ${(p) => p.theme.space[6]};
`;
var Lede$1 = styled.p`
  margin: 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
var MetaLine = styled.p`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  letter-spacing: ${(p) => p.theme.font.tracking.wide};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;
function Talks() {
	const talks = talksByDate(content.talks);
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(PageHeader, { children: [
		/* @__PURE__ */ jsx(Heading, {
			level: 1,
			"data-testid": "talks-title",
			children: "Talks"
		}),
		/* @__PURE__ */ jsx(Lede$1, { children: "Where I have spoken, what I said, and the slides that carried it. Each entry expands to the abstract; slides and recordings link out when they exist." }),
		talks.length > 0 && /* @__PURE__ */ jsxs(MetaLine, {
			role: "status",
			"data-testid": "talks-count",
			children: [pluralize(talks.length, "talk", "talks"), "."]
		})
	] }), talks.length === 0 ? /* @__PURE__ */ jsx(EmptyState, {
		icon: "calendar",
		title: "No talks listed yet",
		description: "Past and upcoming appearances show up here. Reach out if you would like me to speak."
	}) : /* @__PURE__ */ jsx(TalkList, { children: talks.map((talk) => /* @__PURE__ */ jsx(TalkCard, { talk }, talk.slug)) })] });
}
//#endregion
//#region src/pages/Contact.tsx
/**
* Contact — the conversion page: one honest email CTA, the real social
* slots, and what working together actually looks like.
*
* NO FAKE FORM: there is no backend in this stack (static nginx, no server,
* no network egress) and CONTRACT §8 forbids pretending otherwise. A form
* that silently went nowhere would be worse than none. The deliverable is a
* mailto: CTA — it composes in the visitor's own client, works with zero
* infrastructure, and degrades honestly. If a real form is ever added, it
* needs a documented form backend first.
*
* A11Y: one h1; labelled regions; every link has a visible focus ring; the
* email address is present as real text, not trapped inside a button label.
*/
var ROUTER_LINK = Link$1;
var CONTACT_EMAIL = SITE.email ?? null;
var Lede = styled.p`
  margin: ${(p) => p.theme.space[5]} 0 0;
  max-width: 62ch;
  font-size: ${(p) => p.theme.font.sizes.lg};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
var CardRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[5]};
  align-items: stretch;
  margin-top: ${(p) => p.theme.space[6]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;
var Panel = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[3]};
  padding: ${(p) => p.theme.space[6]};
  background: ${(p) => p.theme.color.bgElevated};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.lg};
`;
var EmailPanel = styled(Panel)`
  border-color: ${(p) => p.theme.color.accentBorder};
  background: ${(p) => p.theme.color.surface};
`;
var PanelTitle = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xl};
  font-weight: ${(p) => p.theme.font.weights.bold};
  line-height: ${(p) => p.theme.font.leading.snug};
  letter-spacing: ${(p) => p.theme.font.tracking.tight};
  color: ${(p) => p.theme.color.text};
`;
var PanelBody = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
var AddressLine = styled.a`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.md};
  color: ${(p) => p.theme.color.accent};
  text-decoration: none;
  border-radius: ${(p) => p.theme.radius.sm};
  padding-block: ${(p) => p.theme.space[1]};

  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 3px;
  }
`;
var CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[2]};
`;
var SocialList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[2]};
`;
var SocialItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  min-height: 44px;
  font-size: ${(p) => p.theme.font.sizes.md};
`;
var SocialAnchor = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  color: ${(p) => p.theme.color.text};
  text-decoration: none;
  border-radius: ${(p) => p.theme.radius.sm};

  &:hover {
    color: ${(p) => p.theme.color.accent};
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 3px;
  }
`;
var ExpectList = styled.dl`
  margin: ${(p) => p.theme.space[2]} 0 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${(p) => p.theme.space[4]};

  @media (min-width: ${(p) => p.theme.breakpoint.md}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: ${(p) => p.theme.space[6]};
  }
`;
var ExpectGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space[1]};
`;
var ExpectTerm = styled.dt`
  margin: 0;
  font-family: ${(p) => p.theme.font.mono};
  font-size: ${(p) => p.theme.font.sizes.xs};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.accent};
`;
var ExpectBody = styled.dd`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.md};
  line-height: ${(p) => p.theme.font.leading.relaxed};
  color: ${(p) => p.theme.color.textMuted};
`;
function socialIcon(label) {
	if (label.toLowerCase().includes("github")) return "github";
	if (label.toLowerCase().includes("linkedin")) return "linkedin";
	return "external-link";
}
function Contact() {
	const contactEmail = CONTACT_EMAIL;
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs(Section, {
			id: "contact-intro",
			eyebrow: "Contact",
			size: "wide",
			children: [/* @__PURE__ */ jsx(Heading, {
				level: 1,
				"data-testid": "contact-title",
				size: "4xl",
				children: "Tell me what is actually broken."
			}), /* @__PURE__ */ jsx(Lede, { children: "The best first email is a paragraph of unpolished context: the system, the constraint, the deadline you are worried about. I read everything myself, and a concrete “no” or a referral is a real answer — you will never be left in silence." })]
		}),
		/* @__PURE__ */ jsx(Section, {
			size: "default",
			"data-testid": "contact-panels",
			children: /* @__PURE__ */ jsxs(CardRow, { children: [/* @__PURE__ */ jsxs(EmailPanel, {
				"aria-labelledby": "contact-email-title",
				children: [
					/* @__PURE__ */ jsx(PanelTitle, {
						id: "contact-email-title",
						children: "Email"
					}),
					/* @__PURE__ */ jsx(PanelBody, { children: "The fastest route for everything: engagements, architecture reviews, or a hard question you want a second opinion on. Include a link to context — a repo, a doc, an incident timeline — and I will come prepared instead of billable for warm-up." }),
					contactEmail ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(AddressLine, {
						href: `mailto:${contactEmail}`,
						"data-testid": "contact-email-link",
						children: [/* @__PURE__ */ jsx(Icon, {
							name: "mail",
							size: 16
						}), contactEmail]
					}), /* @__PURE__ */ jsx(CtaRow, { children: /* @__PURE__ */ jsx(Button, {
						as: "a",
						href: `mailto:${contactEmail}`,
						variant: "primary",
						size: "lg",
						iconRight: "arrow-right",
						"data-testid": "contact-cta-email",
						children: "Start the conversation"
					}) })] }) : /* @__PURE__ */ jsx(PanelBody, {
						"data-testid": "contact-email-unset",
						children: "Email contact is being set up. In the meantime, the work on this site is real — start from the projects."
					})
				]
			}), /* @__PURE__ */ jsxs(Panel, {
				"aria-labelledby": "contact-social-title",
				children: [
					/* @__PURE__ */ jsx(PanelTitle, {
						id: "contact-social-title",
						children: "Elsewhere"
					}),
					/* @__PURE__ */ jsx(PanelBody, { children: "Where the work shows up before it shows up here. Slower than email, better for follow-ups than for first contact." }),
					/* @__PURE__ */ jsx(SocialList, {
						"data-testid": "contact-social-list",
						children: SOCIAL_LINKS.filter((link) => link.url).map((link) => /* @__PURE__ */ jsx(SocialItem, { children: /* @__PURE__ */ jsxs(SocialAnchor, {
							href: link.url,
							rel: "me noopener noreferrer",
							children: [
								/* @__PURE__ */ jsx(Icon, {
									name: socialIcon(link.label),
									size: 16
								}),
								link.label,
								link.handle ? ` — ${link.handle}` : ""
							]
						}) }, link.label))
					})
				]
			})] })
		}),
		/* @__PURE__ */ jsxs(Section, {
			id: "expectations",
			eyebrow: "Working together",
			title: "What to expect",
			description: "No sales sequence, no discovery-call gauntlet. Three commitments that hold on every engagement.",
			children: [/* @__PURE__ */ jsxs(ExpectList, {
				"data-testid": "contact-expectations",
				children: [
					/* @__PURE__ */ jsxs(ExpectGroup, { children: [/* @__PURE__ */ jsx(ExpectTerm, { children: "Reply, honestly" }), /* @__PURE__ */ jsx(ExpectBody, { children: "A considered response — including when the answer is that I am not the right person for it. Silence is the failure mode I promise to avoid." })] }),
					/* @__PURE__ */ jsxs(ExpectGroup, { children: [/* @__PURE__ */ jsx(ExpectTerm, { children: "Fixed scope, written down" }), /* @__PURE__ */ jsx(ExpectBody, { children: "Before work starts: the question, the deliverable, and what “done” means, in one page. If scope changes, the page changes — visibly." })] }),
					/* @__PURE__ */ jsxs(ExpectGroup, { children: [/* @__PURE__ */ jsx(ExpectTerm, { children: "Handover included" }), /* @__PURE__ */ jsx(ExpectBody, { children: "Every engagement ends with the team able to run and extend the result without me. Dependency is a defect, not a business model." })] })
				]
			}), /* @__PURE__ */ jsxs(CtaRow, { children: [/* @__PURE__ */ jsx(Button, {
				as: ROUTER_LINK,
				to: "/projects",
				variant: "ghost",
				"data-testid": "contact-cta-projects",
				children: "See the work first"
			}), /* @__PURE__ */ jsx(Button, {
				as: ROUTER_LINK,
				to: "/now",
				variant: "ghost",
				"data-testid": "contact-cta-now",
				children: "Current availability"
			})] })]
		})
	] });
}
//#endregion
//#region src/app/App.tsx
/**
* App shell: the single tree both the client (src/main.tsx) and the prerender
* pass (prerender/entry.mjs) mount. Keeping it one factory is what guarantees
* prerendered HTML and hydrated client markup agree.
*/
var routes = [
	{
		path: "/",
		component: Home
	},
	{
		path: "/about",
		component: About
	},
	{
		path: "/now",
		component: Now
	},
	{
		path: "/projects",
		component: Projects
	},
	{
		path: "/projects/:slug",
		component: ProjectDetail
	},
	{
		path: "/writing",
		component: Writing
	},
	{
		path: "/writing/:slug",
		component: PostDetail
	},
	{
		path: "/videos",
		component: Videos
	},
	{
		path: "/talks",
		component: Talks
	},
	{
		path: "/contact",
		component: Contact
	}
];
function Shell() {
	useEffect(() => {
		retirePrerenderedTag();
	}, []);
	const location = useLocation();
	useEffect(() => {
		applyDocumentMeta(metaFor(location.pathname));
	}, [location.pathname]);
	return createElement(Layout, { children: createElement(Outlet, { NotFound }) });
}
/**
* Build the full app element, optionally pinned to a path (prerender/tests).
* `standalone` skips StrictMode's double-render noise in the static pass.
*/
function createApp(path) {
	return createElement(StrictMode, null, createElement(ThemePreferenceProvider, null, createElement(AppThemeProvider, null, createElement(RouterProvider, {
		routes,
		...path !== void 0 ? { initialPath: path } : {}
	}, createElement(Shell, { children: null })))));
}
//#endregion
//#region prerender/entry.ts
/**
* Prerender entry — built by vite into prerender/entry.mjs (node target).
*
* Exports consumed by scripts/prerender.mjs:
*   prerenderPaths(): string[]
*   renderRoute(path): { html: string; cssErrors: string[] }
*   siteMeta, feedItems, sitemapPaths
*
* The app shell (src/app/App.tsx) exports `createApp(path)` so the same tree
* renders on both sides of the build.
*/
function prerenderPaths() {
	return [
		"/",
		"/about",
		"/now",
		"/projects",
		"/writing",
		"/videos",
		"/talks",
		"/contact",
		"/404",
		...content.projects.map((p) => `/projects/${p.slug}`),
		...content.posts.map((p) => `/writing/${p.slug}`)
	];
}
var sitemapPaths = prerenderPaths().filter((p) => p !== "/404");
var siteMeta = {
	title: SITE.title,
	description: SITE.description,
	shortTitle: SITE.shortTitle ?? "Portfolio",
	url: SITE.url.replace(/\/$/, "")
};
var feedItems = content.posts.slice().sort((a, b) => a.date < b.date ? 1 : -1).map((post) => ({
	slug: post.slug,
	title: post.title,
	summary: post.excerpt || post.summary,
	date: post.date,
	tags: post.tags,
	path: `/writing/${post.slug}`
}));
function renderRoute(path) {
	__resetSheet();
	const body = renderToStaticMarkup(createApp(path));
	const css = __sheetCss();
	const cssErrors = [];
	if (/undefined|NaN|\[object Object\]/.test(css)) {
		const line = css.split("\n").find((l) => /undefined|NaN|\[object Object\]/.test(l)) ?? "";
		cssErrors.push(line.slice(0, 160));
	}
	const head = buildHead(metaFor(path)).join("\n    ");
	const scriptSrc = assetHref();
	const preloads = chunkHrefs().filter((href) => href !== scriptSrc).map((href) => `    <link rel="modulepreload" href="${href}" />`).join("\n");
	return {
		html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
${head}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/site.webmanifest" />
${preloads ? preloads + "\n" : ""}    <script src="/theme-init.js"><\/script>
    <style id="emotion-prerender">${css}</style>
  </head>
  <body>
    <div id="root">${body}</div>
    <script type="module" src="${scriptSrc}"><\/script>
  </body>
</html>`,
		cssErrors
	};
}
function readManifest() {
	try {
		const manifestPath = new URL("../dist/.vite/manifest.json", import.meta.url);
		return JSON.parse(readFileSync(manifestPath, "utf8"));
	} catch {
		return null;
	}
}
/** Every JS asset in the manifest (entry + its imported chunks), as /hrefs. */
function chunkHrefs() {
	const manifest = readManifest();
	if (!manifest) return [];
	return Object.values(manifest).flatMap((e) => typeof e.file === "string" && e.file.endsWith(".js") ? [`/${e.file}`] : []);
}
function assetHref() {
	try {
		const manifestPath = new URL("../dist/.vite/manifest.json", import.meta.url);
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		const entry = manifest["index.html"] ?? manifest["src/main.tsx"];
		const file = entry?.file ?? entry?.src;
		if (typeof file === "string" && file.startsWith("assets/")) return `/${file}`;
	} catch {}
	return "/assets/index.js";
}
//#endregion
export { feedItems, prerenderPaths, renderRoute, siteMeta, sitemapPaths };
