import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  experimental: {
    serverAppConfig: false,
  },
  css: ['./app/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    rootAttrs: {
      class: 'h-full flex flex-col',
    },
  },
  runtimeConfig: {
    public: {
      TYPEBASE_APP_URL: process.env.TYPEBASE_APP_URL_DEV ?? process.env.TYPEBASE_APP_URL,
    },
  },
});
