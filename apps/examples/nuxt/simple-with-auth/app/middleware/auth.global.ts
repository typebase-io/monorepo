export default defineNuxtRouteMiddleware(async (to) => {
  const { $auth } = useNuxtApp();
  const { data: session } = await $auth.useSession(useFetch);

  if (!session.value && to.path !== '/auth') {
    return navigateTo('/auth');
  }

  if (session.value && to.path === '/auth') {
    return navigateTo('/');
  }
});
