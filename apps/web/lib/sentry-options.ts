/**
 * What Sentry may collect. Chat requests carry patients' messages, names
 * and phone numbers, so nothing beyond the error itself is sent: no
 * bodies, headers, cookies, query strings, user info, SQL values or AI
 * prompts.
 */
export const privateDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
};
