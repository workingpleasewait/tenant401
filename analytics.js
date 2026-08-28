// Shared PostHog analytics — included by every protected page
// Usage: <script src="/analytics.js"></script>
// Reads data-page attribute from <body> for the page name.
// Suppressed when ?is_test=1 or sessionStorage t401_test_mode=1.

(function () {
  // Bootstrap PostHog stub
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}var c=t.createElement("script");c.type="text/javascript",c.crossOrigin="anonymous",c.async=!0,c.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js";var l=t.getElementsByTagName("script")[0];l.parentNode.insertBefore(c,l);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+" (stub)"},n="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId setPersonPropertiesForFlags".split(" "),p=0;p<n.length;p++)g(u,n[p]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  var isTest = new URLSearchParams(location.search).get('is_test') === '1';
  try { isTest = isTest || sessionStorage.getItem('t401_test_mode') === '1'; } catch(e) {}

  if (!isTest) {
    posthog.init('phc_uY5md7SXOeMdNmMPiDi8rkp14ioLWGViqitHfvWLfhR', {
      api_host: 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      persistence: 'localStorage+cookie',
    });
  }

  function capture(event, props) {
    if (!isTest) posthog.capture(event, props);
  }

  var page = document.body.getAttribute('data-page') || location.pathname.replace(/^\/|\.html$/g, '') || 'unknown';

  // Fire gate_success once when landing on playbook after a form submission
  if (page === 'playbook') {
    var submitted = false;
    try { submitted = sessionStorage.getItem('t401_gate_submitted') === '1'; sessionStorage.removeItem('t401_gate_submitted'); } catch(e) {}
    if (submitted) capture('gate_success', { page: page });
  }

  capture('$pageview', { $current_url: location.href, page: page });
  capture('playbook_viewed', { page: page });
})();
