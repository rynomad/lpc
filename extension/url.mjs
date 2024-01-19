export * from "../node_modules/@jspm/core/nodelibs/browser/url.js";

export const urlToHttpOptions = (url) => {
    // from https://github.com/denoland/deno/blob/c62615bfe5a070c2517f3af3208d4308c72eb054/ext/node/polyfills/internal/url.ts#L24
    // MIT licensed
    const options = {
        protocol: url.protocol,
        hostname:
            typeof url.hostname === "string" && url.hostname.startsWith("[")
                ? url.hostname.slice(1, -1)
                : url.hostname,
        hash: url.hash,
        search: url.search,
        pathname: url.pathname,
        path: `${url.pathname || ""}${url.search || ""}`,
        href: url.href,
    };
    if (url.port !== "") {
        options.port = Number(url.port);
    }
    if (url.username || url.password) {
        options.auth = `${decodeURIComponent(
            url.username
        )}:${decodeURIComponent(url.password)}`;
    }
    return options;
};
