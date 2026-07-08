// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://41364203f2edd782a7c8054cb14939d8@o4511697917837312.ingest.us.sentry.io/4511697954799616",

  // 10% sampling keeps us inside the free tier's 10k perf events/month.
  // Bump when we upgrade the plan.
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  dataCollection: {
    // PII off by default. userInfo would ship headers (potentially auth
    // cookies), httpBodies would ship request bodies (magic-link emails,
    // lead form contents). Neither is worth the privacy exposure.
    userInfo: false,
    httpBodies: [],
  },
});
