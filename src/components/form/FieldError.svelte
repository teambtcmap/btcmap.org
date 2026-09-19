<script lang="ts">
// A field's inline validation message (#1404, #1406). The id is the
// contract: the invalid control points its aria-describedby at it, so the
// message is read as focus lands — render it before moving focus. The
// caller owns placement through `class`; the default sits under a label
// that has `mb-2`.
type Props = {
	id: string;
	message: string;
	class?: string;
};
let { id, message, class: placement = "-mt-1 mb-2" }: Props = $props();
</script>

<p {id} class="text-sm font-semibold text-error {placement}">{message}</p>
