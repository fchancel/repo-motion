export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  css: ['~/assets/main.css'],
  devtools: { enabled: false },
  typescript: { strict: true },
  // Pages cross-fade like cuts between shots.
  experimental: { viewTransition: true },
  app: {
    head: {
      title: 'repo-motion',
      htmlAttrs: { lang: 'fr' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'dark' },
        { name: 'theme-color', content: '#09090e' },
        { name: 'description', content: 'Donnez un dossier : Claude Code comprend votre produit et prépare des vidéos courtes pour chaque persona.' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },
  // Workspace packages ship TypeScript sources: bundle them instead of loading them from node_modules.
  build: { transpile: ['@repo-motion/core', '@repo-motion/infrastructure'] },
  nitro: { externals: { inline: ['@repo-motion/core', '@repo-motion/infrastructure'] } },
})
