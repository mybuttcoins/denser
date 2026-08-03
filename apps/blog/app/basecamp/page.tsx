import BasecampContent from './content';

// Non-async: this page has no server-fetched data of its own (matches app/communities/page.tsx),
// avoiding the loading.tsx Suspense skeleton during streaming SSR.
const BasecampPage = () => {
  return <BasecampContent />;
};

export default BasecampPage;
