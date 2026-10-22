# Vue Message Lens

**See the JSON message owned by a Vue component, then jump to its source.**

A free, read-only VS Code research demo for teams keeping translations in component-local `<i18n>` blocks or relative JSON files. Built with AI assistance. This is an early experiment, not a complete translation manager.

[Download v0.0.2](https://github.com/johnny-fridburg/vue-message-lens/releases/tag/v0.0.2) · [Report a trial result](https://github.com/johnny-fridburg/vue-message-lens/issues/new?template=trial.yml)

## Try it in five minutes

1. Download `vue-message-lens-0.0.2.vsix` from the release. Requires VS Code 1.104 or newer. This is a manually installed prerelease, not a Marketplace listing; the source is available here for inspection.
2. In VS Code, run **Extensions: Install from VSIX…** and select the file. A separate temporary VS Code profile makes comparison easier.
3. Open [example/Checkout.vue](example/Checkout.vue) and [example/Checkout.i18n.json](example/Checkout.i18n.json) in the same folder. No app build is needed for editor inspection.
4. Hover over `hello` inside `{{ t('hello') }}`. Expect `en: Checkout title` and `fr: Titre du paiement`. Use **Go to Definition** to select the JSON value. Multiple locales produce multiple destinations.
5. Try the same pattern in a sanitized copy of your own component. Disable other translation extensions in the temporary profile if their hover entries make attribution unclear.

To remove the demo, uninstall **Vue Message Lens — research demo** from Extensions. No account, payment, project upload or API key is needed. The extension reads local files and open document buffers; it contains no telemetry or network calls and does not edit your translations. GitHub itself can record visits and downloads.

## Supported shape

```vue
<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n({ useScope: 'local' })
</script>

<template>
  <h1>{{ t('hello') }}</h1>
</template>

<i18n lang="json" src="./Checkout.i18n.json" />
```

```json
{
  "en": { "hello": "Checkout title" },
  "fr": { "hello": "Titre du paiement" }
}
```

Inline JSON and `<i18n locale="en">` blocks are also supported. Files may be shared by components. The hover displays stored scalar values, not rendered pluralization, interpolation or linked-message output.

Version 0.0.2 intentionally recognizes only direct literal `t('key')` template interpolations, with the explicit unaliased import and local binding shown above. It skips script calls, directive/attribute expressions, `$t`, aliased bindings, extra composer options, slots and loops, escaped or dynamic keys, imported `messages`, global fallback, YAML and source aliases. Unsupported expressions return no preview. No renaming, extraction, synchronization, translation generation or global locale management is included.

## Why try this?

In a small runnable Vue 3 comparison, an external component-local JSON file rendered correctly while tested i18n Ally 2.13.1 and i18n Editor 1.0.1 configurations previewed a conflicting global value. This is a bounded observation, not a claim about all configurations or current releases. [An existing external-file report](https://github.com/lokalise/i18n-ally/issues/1392) describes related behavior.

Conventional global locale files worked in the comparison, and inline blocks restored i18n Ally previews. Those may already solve your problem. This demo tests whether preserving local or shared external files is useful enough to justify a separate tool.

## Tell us what actually happened

[Open a trial result](https://github.com/johnny-fridburg/vue-message-lens/issues/new?template=trial.yml) with your editor/translation tooling, the pattern you tested, expected vs observed text/navigation, and whether an inline/global workaround is acceptable. Please use invented messages and sanitized snippets: issues are public. No sales call or payment is involved. Reports that an existing tool already solves this are useful too.

## Development and checks

```sh
npm ci --ignore-scripts
npm test
```

The core tests cover external/inline JSON, definition offsets, missing/invalid files, component isolation, and rejection of ambiguous bindings. The packaged prerelease is additionally checked in an isolated VS Code profile against six synthetic components; four supported local cases should preview and navigate, while imported-message/global controls should return no result.

MIT licensed. See [LICENSE](LICENSE). Dependencies retain their own licenses.
