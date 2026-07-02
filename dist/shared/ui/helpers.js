"use strict";
/** Niche-agnostic helpers shared across the multi-page site system. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = void 0;
exports.telHref = telHref;
exports.href = href;
exports.currentYear = currentYear;
var utils_1 = require("@/shared/utils");
Object.defineProperty(exports, "cn", { enumerable: true, get: function () { return utils_1.cn; } });
/** Build a safe `tel:` href from a display phone string. */
function telHref(phone) {
    return "tel:" + phone.replace(/[^\d+]/g, "");
}
/**
 * Join a base path and any number of slug segments into a clean absolute URL.
 * `href("/preview/trades", "services", "switchboard")` -> "/preview/trades/services/switchboard"
 * `href("/preview/trades")` -> "/preview/trades"
 */
function href(base, ...segments) {
    const cleanBase = base.replace(/\/+$/, "");
    const parts = segments.filter((s) => !!s && s.length > 0);
    return parts.length ? `${cleanBase}/${parts.join("/")}` : cleanBase || "/";
}
function currentYear() {
    return new Date().getFullYear();
}
