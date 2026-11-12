<template>
  <span class="logo">
    <svg class="logo__mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="2" width="18" height="28" rx="6" fill="var(--caption)" />
      <path
        d="M13.5 11.2v9.6a.8.8 0 0 0 1.2.7l7.6-4.8a.8.8 0 0 0 0-1.4l-7.6-4.8a.8.8 0 0 0-1.2.7z"
        fill="var(--ink)"
      />
    </svg>
    <span class="logo__word">repo-motion</span>
  </span>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--display);
  font-weight: 800;
  font-size: 1.15rem;
  letter-spacing: -0.04em;
  color: var(--text);
}

.logo__mark {
  width: 26px;
  height: 26px;
}
</style>
