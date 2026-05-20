import { useState } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import type { EmbedInstallMode } from './PublishWorkspaceContext';
import { ws } from './workspace';

type StackEntry = {
  id: string;
  label: string;
  /** Iconify icon id, or `img:` + absolute URL for favicon / external SVG */
  icon: string;
  instructions: string[];
};

/** Official Simple Icons brand hex (no #); Duda approximates their primary blue. */
const PLATFORM_BRAND_HEX: Record<string, string> = {
  react: '61DAFB',
  next: '000000',
  vue: '4FC08D',
  angular: 'DD0031',
  svelte: 'FF3E00',
  nuxt: '00DC82',
  remix: '000000',
  astro: 'BC52EE',
  solid: '446B9E',
  qwik: '18B6F6',
  gatsby: '663399',
  vite: '646CFF',
  preact: '673AB8',
  eleventy: '000000',
  wordpress: '21759B',
  shopify: '7AB55C',
  webflow: '146EF5',
  squarespace: '000000',
  wix: '0C6EFC',
  drupal: '0678BE',
  joomla: '5091CD',
  ghost: '15171A',
  contentful: '2478CC',
  sanity: 'F03E2F',
  strapi: '2F2E8B',
  storyblok: '09B3AF',
  prismic: '484A7A',
  hubspot: 'FF7A59',
  framer: '0055FF',
  duda: '0066FF',
  magento: 'EE672F',
  bigcommerce: '121118',
  sitecore: 'E0005A',
  aem: 'FF0000',
  kentico: 'F9A61C',
  payload: '000000',
};

const FE_STACKS: StackEntry[] = [
  {
    id: 'react',
    label: 'React',
    icon: 'simple-icons:react',
    instructions: [
      'CRA or Vite: edit `public/index.html` (or the root HTML your build ships) and place the snippet immediately before `</body>`.',
      'Ship the same change to production—don’t rely on a dev-only HTML file if that isn’t what users load.',
    ],
  },
  {
    id: 'next',
    label: 'Next.js',
    icon: 'simple-icons:nextdotjs',
    instructions: [
      'App Router: in `app/layout.tsx`, add `next/script` with `strategy="afterInteractive"` pointing at your snippet URL, or inject the inline script once in the root layout.',
      'Pages Router: prefer `pages/_document.tsx` (inside `<body>`) or a single `next/script` in `_app` so every route inherits it.',
    ],
  },
  {
    id: 'vue',
    label: 'Vue',
    icon: 'simple-icons:vuedotjs',
    instructions: [
      'Vite / Vue CLI: add the snippet to `index.html` before `</body>`, or inject once from `main.ts` after app mount if you must avoid editing HTML.',
      'Put it on every layout or wrapper that should show the widget site-wide.',
    ],
  },
  {
    id: 'angular',
    label: 'Angular',
    icon: 'simple-icons:angular',
    instructions: [
      'Default: `src/index.html` before `</body>`, or list the script in `angular.json` under `scripts` if your team centralizes vendors there.',
      'With SSR / Universal, ensure the script executes in the browser bundle, not only on the server.',
    ],
  },
  {
    id: 'svelte',
    label: 'Svelte',
    icon: 'simple-icons:svelte',
    instructions: [
      'SvelteKit: add to `src/app.html` before `</body>`, or inject via `+layout.svelte` / `handle` so it applies to all routes.',
      'Vanilla Svelte: same pattern as other SPAs—one global include in `index.html`.',
    ],
  },
  {
    id: 'nuxt',
    label: 'Nuxt',
    icon: 'simple-icons:nuxt',
    instructions: [
      'Nuxt 3: use `nuxt.config` → `app.head.script`, or `app.vue` / a default layout with `useHead` so the tag isn’t duplicated per page.',
      'Pick one injection path and stick to it (avoid the same script in both SSR HTML and a client-only plugin).',
    ],
  },
  {
    id: 'remix',
    label: 'Remix',
    icon: 'simple-icons:remix',
    instructions: [
      'Add the snippet in `root.tsx` near the end of `<body>`, or export it from `links` / `scripts` in the root route if you consolidate third-party tags.',
      'Confirm it loads on all routes where the widget should appear (usually the root layout only).',
    ],
  },
  {
    id: 'astro',
    label: 'Astro',
    icon: 'simple-icons:astro',
    instructions: [
      'Use a shared layout component and add a plain `<script>` with `is:inline` so Astro does not bundle or strip the embed.',
      'Include that layout on every page template that should load the widget.',
    ],
  },
  {
    id: 'solid',
    label: 'Solid',
    icon: 'simple-icons:solid',
    instructions: [
      'SolidStart / Vite: `index.html` before `</body>`, or one injection in your root layout component.',
      'The deployed hostname must appear under **Allowed websites** above.',
    ],
  },
  {
    id: 'qwik',
    label: 'Qwik',
    icon: 'simple-icons:qwik',
    instructions: [
      'Add to the document shell (`src/root.tsx` or the HTML template Qwik uses) so resumable routes still load the script once.',
      'Avoid registering the same tag in multiple entry points.',
    ],
  },
  {
    id: 'gatsby',
    label: 'Gatsby',
    icon: 'simple-icons:gatsby',
    instructions: [
      'Use `gatsby-ssr.js` → `onRenderBody` to append before `</body>` for consistent SSR HTML, or `gatsby-browser.js` if you only need client-side injection.',
      'Don’t inject twice—choose one hook or guard with a global flag.',
    ],
  },
  {
    id: 'vite',
    label: 'Vite',
    icon: 'simple-icons:vite',
    instructions: [
      'Single-page: `index.html` before `</body>`.',
      'Multi-page: add the snippet only to HTML entry points where the widget should run.',
    ],
  },
  {
    id: 'preact',
    label: 'Preact',
    icon: 'simple-icons:preact',
    instructions: [
      'Same as React: root `index.html` or one root component that injects the script a single time.',
    ],
  },
  {
    id: 'eleventy',
    label: 'Eleventy',
    icon: 'simple-icons:eleventy',
    instructions: [
      'Add to your base layout (e.g. `_includes/layout.njk`) before `</body>` so all templates inherit it.',
      'Rebuild so static output includes the tag.',
    ],
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    icon: 'simple-icons:wordpress',
    instructions: [
      'Classic / PHP themes: `footer.php` before `</body>`, or a “Insert Headers and Footers”–style plugin.',
      'Block / FSE: use `wp_footer` in `functions.php` or a reputable plugin that prints footer scripts.',
    ],
  },
  {
    id: 'shopify',
    label: 'Shopify',
    icon: 'simple-icons:shopify',
    instructions: [
      'Online Store → Themes → Edit code → `theme.liquid` before `</body>`, or an app embed block if your theme supports it.',
      'Whitelist the storefront domain (or custom domain) under **Allowed websites**.',
    ],
  },
  {
    id: 'webflow',
    label: 'Webflow',
    icon: 'simple-icons:webflow',
    instructions: [
      'Project settings → Custom Code → Footer: paste, then publish.',
      'After you connect a custom domain, add that exact HTTPS origin to **Allowed websites**.',
    ],
  },
  {
    id: 'squarespace',
    label: 'Squarespace',
    icon: 'simple-icons:squarespace',
    instructions: [
      'Settings → Advanced → Code Injection → Footer, then save.',
      'Allow the primary or custom domain you use for the live site.',
    ],
  },
  {
    id: 'wix',
    label: 'Wix',
    icon: 'simple-icons:wix',
    instructions: [
      'Settings → Custom Code → Body – end, then publish.',
      'Use the same URL visitors use when adding allowed origins.',
    ],
  },
  {
    id: 'drupal',
    label: 'Drupal',
    icon: 'simple-icons:drupal',
    instructions: [
      'Block layout: footer region with a Full HTML block, or override `html.html.twig` before `</body>`.',
      'Clear caches after theme or block changes.',
    ],
  },
  {
    id: 'joomla',
    label: 'Joomla',
    icon: 'simple-icons:joomla',
    instructions: [
      'Template `index.php` or custom HTML module in a footer position assigned to all relevant menus.',
      'One global include is enough for the whole site.',
    ],
  },
  {
    id: 'ghost',
    label: 'Ghost',
    icon: 'simple-icons:ghost',
    instructions: [
      'Admin → Settings → Code injection → Site footer.',
      'Ghost uses one theme shell—usually a single footer injection covers all posts and pages.',
    ],
  },
  {
    id: 'contentful',
    label: 'Contentful',
    icon: 'simple-icons:contentful',
    instructions: [
      'Headless: put the snippet in your real front-end (Next, Gatsby, etc.)—not inside individual Contentful entries.',
      'Add staging preview URLs to **Allowed websites** only if you load the widget there.',
    ],
  },
  {
    id: 'sanity',
    label: 'Sanity',
    icon: 'simple-icons:sanity',
    instructions: [
      'Studio ≠ public site: embed in the deployed site’s layout, not only in Sanity Studio.',
      'Allow the public site origin; the studio domain is separate unless you need the widget there too.',
    ],
  },
  {
    id: 'strapi',
    label: 'Strapi',
    icon: 'simple-icons:strapi',
    instructions: [
      'Strapi serves API/admin: add the snippet to the customer-facing app that renders HTML.',
      'Skip the admin URL unless you intentionally want chat inside Strapi Admin.',
    ],
  },
  {
    id: 'storyblok',
    label: 'Storyblok',
    icon: 'simple-icons:storyblok',
    instructions: [
      'Inject in the global layout of your Nuxt/Next/Svelte app that consumes Storyblok content.',
      'If you test inside Storyblok’s visual preview, add that preview origin too.',
    ],
  },
  {
    id: 'prismic',
    label: 'Prismic',
    icon: 'simple-icons:prismic',
    instructions: [
      'Add once in your app shell (Next/Nuxt/SvelteKit); slices don’t replace a global script.',
      'Add Prismic preview domains only if the widget runs in preview.',
    ],
  },
  {
    id: 'hubspot',
    label: 'HubSpot CMS',
    icon: 'simple-icons:hubspot',
    instructions: [
      'Design Manager → base template / `base.html` before `</body>`, or hub-level site settings where your plan allows global HTML.',
      'Match **Allowed websites** to `*.hs-sites.com` and/or your connected custom domain.',
    ],
  },
  {
    id: 'framer',
    label: 'Framer',
    icon: 'simple-icons:framer',
    instructions: [
      'Site settings → General → Custom Code → end of `<body>`, then publish.',
      'Allow the exact custom domain you publish on.',
    ],
  },
  {
    id: 'duda',
    label: 'Duda',
    icon: 'img:https://www.google.com/s2/favicons?domain=duda.co&sz=64',
    instructions: [
      'Site-wide custom HTML / body-end field in Duda: paste and republish.',
      'Allow your live site or connected custom domain.',
    ],
  },
  {
    id: 'magento',
    label: 'Magento',
    icon: 'simple-icons:magento',
    instructions: [
      'Magento 2: Content → Design → Configuration, or layout XML / `default.xml` to inject before `</body>` on the storefront.',
      'Flush cache; whitelist the storefront origin, not only Admin.',
    ],
  },
  {
    id: 'bigcommerce',
    label: 'BigCommerce',
    icon: 'simple-icons:bigcommerce',
    instructions: [
      'Script Manager (footer) or Stencil `templates/layout/base.html` / footer partial.',
      'After theme edits, rebuild and push if you use Stencil CLI.',
    ],
  },
  {
    id: 'sitecore',
    label: 'Sitecore',
    icon: 'simple-icons:sitecore',
    instructions: [
      'MVC / SXA / headless: add to the shared layout or a footer rendering available on every page.',
      'Headless: inject in your JS app’s HTML shell or SSR template, not only in Experience Editor-only views.',
    ],
  },
  {
    id: 'aem',
    label: 'Adobe AEM',
    icon: 'simple-icons:adobe',
    instructions: [
      'Use ClientLibs + footer inclusion, or a component that emits the snippet once per published page.',
      'Test on **publish** URLs and allow those HTTPS origins (author is optional).',
    ],
  },
  {
    id: 'kentico',
    label: 'Kentico',
    icon: 'simple-icons:kentico',
    instructions: [
      'Xperience: master page / portal layout before `</body>`, or a shared web part in the footer.',
      'Kontent (headless): same as other headless stacks—embed in the public front-end layout.',
    ],
  },
  {
    id: 'payload',
    label: 'Payload',
    icon: 'simple-icons:payloadcms',
    instructions: [
      'Payload Admin is not your public site: add the snippet to the Next/Express (etc.) app that serves visitors.',
      'API-only Payload still needs a separate HTML app for the embed.',
    ],
  },
];

const tagClass =
  'inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200/85 bg-white px-2 py-1 text-[0.6875rem] font-medium leading-none text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.03]';

function StackPillIcon({ icon, brandHex, size = 12 }: { icon: string; brandHex: string; size?: number }) {
  const color = `#${brandHex}`;
  const isDarkIcon = brandHex === '000000' || brandHex === '121118' || brandHex === '15171A';

  if (icon.startsWith('img:')) {
    return (
      <span
        className="inline-flex shrink-0 rounded-full p-0.5 ring-1 ring-inset"
        style={{ backgroundColor: `${color}18`, boxShadow: `inset 0 0 0 1px ${color}40` }}
      >
        <img
          src={icon.slice(4)}
          alt=""
          width={size}
          height={size}
          className="object-contain"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <Icon
      icon={icon}
      width={size}
      height={size}
      className={cn('block shrink-0', isDarkIcon && 'drop-shadow-[0_0_0.5px_rgba(255,255,255,0.9)]')}
      style={{ color }}
      aria-hidden
    />
  );
}

export function FeStackTags({ embedInstallMode }: { embedInstallMode: EmbedInstallMode }) {
  const [activeId, setActiveId] = useState<string>(FE_STACKS[0].id);
  const active = FE_STACKS.find((s) => s.id === activeId) ?? FE_STACKS[0];
  const activeHex = PLATFORM_BRAND_HEX[active.id] ?? '64748B';

  const embedStepClass = cn(
    ws.workspaceEditorHelperText,
    'm-0 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-slate-800',
  );

  const stackListClass = cn(
    ws.workspaceEditorHelperText,
    'm-0 list-disc space-y-1.5 pl-4 text-slate-800/95',
  );

  return (
    <div className="w-full min-w-0 border-t border-slate-200/80 pt-5">
      <div
        className="mb-4 rounded-lg border border-slate-200/80 bg-slate-50/90 px-3.5 py-3 sm:px-4"
        role="note"
        aria-label="Instructions for choosing a platform"
      >
        <p className="m-0 text-sm font-medium leading-snug text-slate-700">Choose your platform</p>
        <p
          className={cn(
            ws.workspaceEditorHelperText,
            'm-0 mt-3 max-w-prose text-pretty leading-relaxed text-slate-600',
          )}
        >
          Pick the framework or CMS closest to your site—we’ll show where to paste the embed for that stack.
        </p>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" role="list">
        {FE_STACKS.map((stack) => {
          const selected = stack.id === activeId;
          const hex = PLATFORM_BRAND_HEX[stack.id] ?? '64748B';
          return (
            <li key={stack.id}>
              <button
                type="button"
                onClick={() => setActiveId(stack.id)}
                className={cn(
                  tagClass,
                  'cursor-pointer transition-colors',
                  selected
                    ? 'border-blue-300/90 bg-blue-50/90 text-slate-900 ring-blue-200/50'
                    : 'hover:border-slate-300 hover:bg-slate-50/80',
                )}
                aria-pressed={selected}
              >
                <StackPillIcon icon={stack.icon} brandHex={hex} />
                <span>{stack.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        className="mt-3 rounded-lg border border-blue-200/90 bg-blue-50/95 px-3 py-3 shadow-sm ring-1 ring-blue-100/50"
        role="region"
        aria-live="polite"
        aria-label={
          embedInstallMode === 'chat-widget'
            ? `Chat widget install steps and ${active.label} tips`
            : `Iframe install steps and ${active.label} tips`
        }
      >
        <p className={cn(ws.workspaceEditorSubsectionTitle, 'mb-2 text-slate-900')}>
          {embedInstallMode === 'chat-widget' ? 'Chat widget instructions' : 'Iframe embed'}
        </p>
        {embedInstallMode === 'chat-widget' ? (
          <ol className={embedStepClass}>
            <li>
              Copy the snippet from <span className="font-semibold text-slate-900">Install code</span> on the right, or use{' '}
              <span className="font-semibold text-slate-900">Embed bot</span> in the page header.
            </li>
            <li>
              Add it once in your site-wide scripts or layout so it loads on every page where chat should appear—see{' '}
              <span className="font-semibold text-slate-900">{active.label}</span> below for the exact spot.
            </li>
            <li>
              The page must be served from a URL that matches one of your <span className="font-semibold text-slate-900">Allowed websites</span>{' '}
              above.
            </li>
          </ol>
        ) : (
          <ol className={embedStepClass}>
            <li>
              Add your site under <span className="font-semibold text-slate-900">Allowed websites</span>—the parent page embedding the iframe must match.
            </li>
            <li>
              Copy the iframe HTML from <span className="font-semibold text-slate-900">Install code</span> and paste it where the full chat panel should appear.
            </li>
            <li>
              Visitors chat on an Assistrio-hosted page inside the iframe; microphone may require your browser to allow it for the iframe.
            </li>
          </ol>
        )}

        <div className="mt-3 border-t border-blue-200/80 pt-3">
          <p className={cn(ws.workspaceEditorFieldCaption, 'mb-2 text-blue-950/80')}>
            <span className="inline-flex items-center gap-1.5">
              <StackPillIcon icon={active.icon} brandHex={activeHex} size={14} />
              {active.label} — where to put it
            </span>
          </p>
          <ul className={stackListClass}>
            {active.instructions.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
