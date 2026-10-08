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

import {
  createElement,
  forwardRef,
  useContext,
  type ComponentType,
  type JSX,
  type ReactNode,
  type Ref,
} from 'react';
import { interpolate, registerStyle, serializeStyles, type StyleObject, type StyleValue } from '@emotion-mini/core';
import { ThemeContext, emptyTheme, type Theme } from '@emotion-mini/react';

const RESERVED = new Set(['css', 'className', 'theme', 'as', 'forwardedAs', 'innerRef']);

/* Props that are valid HTML/ARIA attributes and must always pass through. */
const ALWAYS_SAFE = /^(data-|aria-)/;

/**
 * A pragmatic allow-list of intrinsic-element props. Emotion uses
 * `@emotion/is-prop-valid` (a generated DOM prop table); we inline a curated
 * equivalent because that package is not installable here. Anything unknown and
 * non-DOM-looking is dropped — the safe direction, since it cannot emit a
 * "React does not recognize the props" warning. Styling hooks should use
 * `$`-transients, which are always consumed.
 */
const SAFE_DOM_PROPS = new Set([
  'abbr','accept','acceptCharset','accessKey','action','allow','alt','as','async','autoCapitalize',
  'autoComplete','autoCorrect','autoFocus','autoPlay','autoSave','capture','cellPadding','cellSpacing',
  'charSet','challenge','checked','children','cite','classID','className','colSpan','cols','content',
  'contentEditable','controls','controlsList','coords','crossOrigin','dangerouslySetInnerHTML','dateTime',
  'default','defer','dir','disabled','disablePictureInPicture','download','draggable','encType','enterKeyHint',
  'form','formAction','formEncType','formMethod','formNoValidate','formTarget','frameBorder','headers','height',
  'hidden','high','href','hrefLang','htmlFor','httpEquiv','id','inputMode','integrity','is','keyParams',
  'keyType','kind','label','lang','list','loop','low','manifest','marginHeight','marginWidth','max','maxLength',
  'media','mediaGroup','method','min','minLength','multiple','muted','name','noValidate','nonce','open','optimum',
  'pattern','placeholder','playsInline','poster','preload','profile','readOnly','referrerPolicy','rel','required',
  'reversed','rows','rowSpan','sandbox','scope','scoped','scrolling','seamless','selected','shape','size','sizes',
  'slot','span','spellCheck','src','srcDoc','srcLang','srcSet','start','style','summary','tabIndex','target',
  'title','translate','type','useMap','value','width','window','wrap','role',
  'onCopy','onCut','onPaste','onCompositionEnd','onCompositionStart','onCompositionUpdate','onKeyDown','onKeyPress',
  'onKeyUp','onFocus','onBlur','onChange','onInput','onInvalid','onReset','onSubmit','onClick','onContextMenu',
  'onDoubleClick','onDrag','onDragEnd','onDragEnter','onDragExit','onDragLeave','onDragOver','onDragStart','onDrop',
  'onMouseDown','onMouseEnter','onMouseLeave','onMouseMove','onMouseOut','onMouseOver','onMouseUp','onSelect',
  'onTouchCancel','onTouchEnd','onTouchMove','onTouchStart','onScroll','onWheel','onAbort','onCanPlay',
  'onCanPlayThrough','onDurationChange','onEmptied','onEncrypted','onEnded','onError','onLoadedData',
  'onLoadedMetadata','onLoadStart','onPause','onPlay','onPlaying','onProgress','onRateChange','onSeeked','onSeeking',
  'onStalled','onTimeUpdate','onVolumeChange','onWaiting','onLoad','onAuxClick','onToggle','onPointerDown',
  'onPointerUp','onPointerMove','onPointerEnter','onPointerLeave','onGotPointerCapture','onLostPointerCapture',
]);

export function isPropValid(prop: string): boolean {
  return RESERVED.has(prop) || ALWAYS_SAFE.test(prop) || SAFE_DOM_PROPS.has(prop);
}

export interface StyledOptions {
  shouldForwardProp?: (prop: string) => boolean;
  label?: string;
}

type Parser = (props: Record<string, unknown>) => StyleValue;

export type HtmlTag =
  | 'a' | 'abbr' | 'address' | 'article' | 'aside' | 'audio' | 'b' | 'bdi' | 'blockquote' | 'body'
  | 'br' | 'button' | 'canvas' | 'caption' | 'cite' | 'code' | 'col' | 'colgroup' | 'data' | 'dd' | 'del'
  | 'details' | 'dfn' | 'dialog' | 'div' | 'dl' | 'dt' | 'em' | 'embed' | 'fieldset' | 'figcaption' | 'figure'
  | 'footer' | 'form' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'header' | 'hr' | 'i' | 'iframe' | 'img'
  | 'input' | 'ins' | 'kbd' | 'label' | 'legend' | 'li' | 'link' | 'main' | 'map' | 'mark' | 'menu' | 'nav'
  | 'ol' | 'optgroup' | 'option' | 'output' | 'p' | 'picture' | 'pre' | 'progress' | 'q' | 's' | 'samp'
  | 'section' | 'select' | 'slot' | 'small' | 'source' | 'span' | 'strong' | 'sub' | 'summary' | 'sup'
  | 'table' | 'tbody' | 'td' | 'textarea' | 'tfoot' | 'th' | 'thead' | 'time' | 'tr' | 'u' | 'ul' | 'var'
  | 'video' | 'wbr';

export interface StyledProps {
  as?: HtmlTag | ComponentType<any>;
  forwardedAs?: HtmlTag | ComponentType<any>;
  className?: string;
  theme?: Theme;
  ref?: Ref<any>;
}

export interface StyledComponent<P extends object> {
  (props: P & StyledProps & Record<string, unknown>): ReactNode;
  displayName: string;
  __emotionStyled: true;
  withConfig(options: StyledOptions): StyledComponent<P>;
  attrs<A extends object>(attrs: A | ((props: P & { theme: Theme }) => A)): StyledComponent<P & A>;
}

/** A styled-component interpolation: CSS text, a style object, or a props function. */
export type Interpolation<TProps extends object> =
  | StyleValue
  | ((props: TProps & { theme: Theme }) => StyleValue);

/**
 * Builder returned by `styled.div` / `styled(Component)`.
 *
 * `TBaseProps` is the element/component's own props, so `(p) => p.theme.space[4]`
 * is always contextually typed. Pass an explicit type argument to add
 * styling-only props: `styled.div<{ $active: boolean }>\`...\``.
 *
 * The non-generic signatures come FIRST: overload resolution only considers a
 * signature with type parameters when type arguments are supplied, so the plain
 * `styled.div\`...\`` form reliably binds `p` instead of falling through to an
 * untyped rest signature (which used to make every interpolation parameter
 * implicitly `any`).
 */
export interface StyledBuilder<TBaseProps extends object> {
  (
    strings: TemplateStringsArray,
    ...interpolations: Array<Interpolation<TBaseProps>>
  ): StyledComponent<TBaseProps>;
  (style: StyleObject | StyleObject[]): StyledComponent<TBaseProps>;
  <TExtraProps extends object>(
    strings: TemplateStringsArray,
    ...interpolations: Array<Interpolation<TBaseProps & TExtraProps>>
  ): StyledComponent<TBaseProps & TExtraProps>;
  <TExtraProps extends object>(
    style: StyleObject | StyleObject[] | ((props: TBaseProps & TExtraProps & { theme: Theme }) => StyleObject)
  ): StyledComponent<TBaseProps & TExtraProps>;
}

function mergeForward(
  base: ((prop: string) => boolean) | undefined,
  parent: ((prop: string) => boolean) | undefined,
): (prop: string) => boolean {
  if (!base) return parent ?? isPropValid;
  if (!parent) return base;
  return (prop) => parent(prop) && base(prop);
}

function buildComponent<P extends object>(
  tag: HtmlTag | ComponentType<P>,
  displayName: string,
  parsers: Parser[],
  forward: (prop: string) => boolean,
  options: StyledOptions,
): StyledComponent<P> {
  const isTagString = typeof tag === 'string';

  const Inner = forwardRef<any, any>((rawProps: Record<string, unknown>, ref: Ref<any>) => {
    const theme = useContext(ThemeContext) ?? emptyTheme;

    /* Theme may be overridden per-element (`theme` prop, Emotion parity). */
    const localTheme = (rawProps.theme as Theme | undefined) ?? theme;
    const asElement = (rawProps.as ?? rawProps.forwardedAs ?? tag) as HtmlTag | ComponentType<any>;

    const propsForStyles = { ...rawProps, theme: localTheme };
    const resolved: StyleValue[] = parsers.map((parse) => {
      const value = parse(propsForStyles);
      return typeof value === 'function' ? (value as (p: unknown) => StyleValue)(propsForStyles) : value;
    });

    const { name, styles } = serializeStyles(displayName, resolved, propsForStyles);
    const ownClass = registerStyle(name, styles);

    const domProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawProps)) {
      if (key === 'as' || key === 'forwardedAs' || key === 'css' || key === 'theme' || key === 'className') continue;
      if (key.startsWith('$')) continue; /* transient — styling only */
      const keep = typeof asElement === 'string' ? forward(key) : isPropValid(key);
      if (!keep) continue;
      domProps[key] = value;
    }

    const classNames = [ownClass, rawProps.className as string | undefined].filter(Boolean).join(' ');
    const finalProps: Record<string, unknown> = { ...domProps };
    if (classNames) finalProps.className = classNames;
    if (ref) finalProps.ref = ref;

    return createElement(asElement as any, finalProps);
  });

  Inner.displayName = displayName;
  (Inner as any).__emotionStyled = true;
  /* Let a composed `styled(Inner)` inherit our forwarding rule. */
  (Inner as any).__emotionForwardProp = forward;

  const component = Inner as unknown as StyledComponent<P>;

  component.withConfig = (nextOptions) =>
    buildComponent<P>(
      tag,
      nextOptions.label ?? displayName,
      parsers,
      mergeForward(nextOptions.shouldForwardProp, forward),
      { ...options, ...nextOptions },
    );

  component.attrs = (attrsInput) => {
    const AttrsComponent = forwardRef<any, any>((rawProps: Record<string, unknown>, ref: Ref<any>) => {
      const theme = useContext(ThemeContext) ?? emptyTheme;
      const ctx = { ...rawProps, theme };
      const extra =
        typeof attrsInput === 'function'
          ? (attrsInput as (p: Record<string, unknown>) => Record<string, unknown>)(ctx)
          : (attrsInput as Record<string, unknown>);
      const merged = { ...rawProps, ...extra };
      if (ref) merged.ref = ref;
      return createElement(component as ComponentType<any>, merged);
    });
    AttrsComponent.displayName = displayName;
    (AttrsComponent as any).__emotionStyled = true;
    const out = AttrsComponent as unknown as StyledComponent<P & Record<string, unknown>>;
    out.withConfig = component.withConfig as StyledComponent<P & Record<string, unknown>>['withConfig'];
    out.attrs = component.attrs as StyledComponent<P & Record<string, unknown>>['attrs'];
    return out as StyledComponent<P>;
  };

  return component;
}

function styledCall<P extends object>(
  tag: HtmlTag | ComponentType<P>,
  options: StyledOptions = {},
): StyledBuilder<P> {
  const label =
    options.label ??
    (typeof tag === 'string' ? `styled.${tag}` : (tag as any)?.displayName || (tag as any)?.name || 'Styled');
  const parentForward: ((prop: string) => boolean) | undefined =
    typeof tag !== 'string' ? (tag as any)?.__emotionForwardProp : undefined;

  return ((...args: StyleValue[]) =>
    buildComponent<P>(
      tag,
      label,
      [() => interpolate(args) as unknown as StyleValue],
      mergeForward(options.shouldForwardProp, parentForward),
      options,
    )) as unknown as StyledBuilder<P>;
}

const DOM_TAGS: HtmlTag[] = [
  'a','abbr','address','article','aside','audio','b','bdi','blockquote','body','br','button','canvas',
  'caption','cite','code','col','colgroup','data','dd','del','details','dfn','dialog','div','dl','dt',
  'em','embed','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hr',
  'i','iframe','img','input','ins','kbd','label','legend','li','link','main','map','mark','menu','nav',
  'ol','optgroup','option','output','p','picture','pre','progress','q','s','samp','section','select','slot',
  'small','source','span','strong','sub','summary','sup','table','tbody','td','textarea','tfoot','th','thead',
  'time','tr','u','ul','var','video','wbr',
];

/**
 * `styled.div` is the builder itself — callable as a template tag or with an
 * object style — matching Emotion. For the options form use
 * `styled('div', { shouldForwardProp })`.
 */
/**
 * Props for each intrinsic tag. Deriving these from React's JSX namespace means
 * interpolations see real element props — `p.disabled` on a button, `p.href` on
 * an anchor — instead of `any`, so a typo in a styled interpolation is a compile
 * error rather than a runtime `undefined` in CSS.
 */
type JSXElementProps = JSX.IntrinsicElements;
type TagMap = { [K in HtmlTag]: StyledBuilder<JSXElementProps[K]> };

export type StyledFnCall = <P extends object>(
  tag: HtmlTag | ComponentType<P>,
  options?: StyledOptions,
) => StyledBuilder<any>;

export type StyledFn = StyledFnCall & TagMap;

type TagFactory = (tag: HtmlTag, label: string) => unknown;

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
function buildTagMap(): TagMap {
  const create: TagFactory = (tag, label) => styledCall(tag, { label });
  const entries = DOM_TAGS.map((tag) => [tag, create(tag, `styled.${tag}`)] as const);
  return Object.fromEntries(entries) as TagMap;
}

const styledCallTyped = styledCall as StyledFnCall;

const styled = Object.assign(styledCallTyped, buildTagMap());

export default styled;
export { styledCall as styled };
