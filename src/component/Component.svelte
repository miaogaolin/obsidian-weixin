<script lang="ts">
	export let markdown: string;

	function copy() {
		console.log(111);
	}
</script>

<button on:click={copy}>Copy</button>
<div class="output">{@html markdown}</div>

<style>
</style>
