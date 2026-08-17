const CANONICAL_HOST = 'arca.computer';
const WWW_HOST = `www.${CANONICAL_HOST}`;

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === WWW_HOST || (url.hostname === CANONICAL_HOST && url.protocol !== 'https:')) {
      url.hostname = CANONICAL_HOST;
      url.protocol = 'https:';
      return Response.redirect(url, 308);
    }
    return env.ASSETS.fetch(request);
  },
};
