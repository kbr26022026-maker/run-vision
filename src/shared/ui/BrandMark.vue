<script setup lang="ts">
defineProps<{
  compact?: boolean;
}>();
</script>

<template>
  <span class="brand" :class="{ 'brand--compact': compact }">
    <svg class="brand__mark" viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="116" fill="#d4ff3f" />
      <path
        d="M112 360c62 0 54-118 132-104s58 132 156-96"
        fill="none"
        stroke="#0a0a0b"
        stroke-width="44"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="400" cy="160" r="34" fill="#0a0a0b" />
    </svg>
    <span v-if="!compact" class="brand__name">RunVision</span>
  </span>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--rv-text);
}

.brand__mark {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
}

.brand__name {
  font-family: var(--rv-font-display);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.03em;
}
</style>
