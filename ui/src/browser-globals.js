// Aliases the legacy global helpers loaded from server/lib/*.js (see server/lib/globals.js
// for the Node-side equivalent) to the bare global names `utility/common.ts` expects
// (`declare const md5`, `declare const formatDate`).
formatDate = globalFormatDate;
