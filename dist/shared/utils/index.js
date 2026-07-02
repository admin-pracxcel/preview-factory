"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = cn;
/** Concatenate truthy class names. */
function cn(...classes) {
    return classes.filter(Boolean).join(" ");
}
