<script module lang="ts">
import { createTimeLocale } from "#lib/dayjsLocale.js";
import { locale } from "#lib/i18n/index.js";

// One store for every date on the page: English until the app language's
// dayjs locale file has loaded.
const timeLocale = createTimeLocale(locale);
</script>

<script lang="ts">
import type { ComponentProps } from "svelte";
import Time from "svelte-time";

import { LOCALIZED_DATE_FORMAT } from "#lib/dayjsLocale.js";

// A <Time> in the app language (#1482, #1586): the date in the order the
// language writes it, and relative times in its words.
type Props = Omit<ComponentProps<typeof Time>, "format" | "locale">;

let props: Props = $props();
</script>

<Time {...props} format={LOCALIZED_DATE_FORMAT} locale={$timeLocale} />
