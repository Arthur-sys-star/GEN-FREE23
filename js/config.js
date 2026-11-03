/* GEN-FREE runtime configuration.
   Change the public backend URL here once instead of editing every page.
   - Opened via localhost / 127.0.0.1 (node backend/server.js): uses the same-origin API.
   - Anywhere else (GitHub Pages, file://): uses the hosted Render backend.
   A page can still override this by defining window.GENFREE_API_URL before this file loads. */
(function () {
    "use strict";
    var HOSTED_BACKEND = "https://gen-free.onrender.com";
    var isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (typeof window.GENFREE_API_URL === "undefined") {
        window.GENFREE_API_URL = isLocal ? "" : HOSTED_BACKEND;
    }
})();
