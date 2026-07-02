"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reveal = Reveal;
exports.Stars = Stars;
exports.CountdownBanner = CountdownBanner;
const jsx_runtime_1 = require("react/jsx-runtime");
/** Client-only interactive primitives: scroll reveal, star rating, countdown. */
const framer_motion_1 = require("framer-motion");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0 },
};
/** One-shot fade-up that triggers when scrolled into view. */
function Reveal({ children, delay = 0, className, }) {
    return ((0, jsx_runtime_1.jsx)(framer_motion_1.motion.div, { className: className, variants: fadeUp, initial: "hidden", whileInView: "show", viewport: { once: true, margin: "-80px" }, transition: { duration: 0.5, ease: "easeOut", delay }, children: children }));
}
/** Row of 1–5 rating stars. */
function Stars({ rating }) {
    const r = Math.round(rating);
    return ((0, jsx_runtime_1.jsx)("div", { className: "flex gap-0.5", "aria-label": `${r} out of 5 stars`, children: Array.from({ length: 5 }).map((_, i) => ((0, jsx_runtime_1.jsx)(lucide_react_1.Star, { className: "h-4 w-4 " +
                (i < r ? "fill-[var(--accent)] text-[var(--accent)]" : "text-zinc-300") }, i))) }));
}
function getTimeLeft(target) {
    const end = new Date(target).getTime();
    if (Number.isNaN(end))
        return null;
    const diff = end - Date.now();
    if (diff <= 0)
        return null;
    return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60),
    };
}
/** Thin promo countdown bar shown at the very top during the preview window. */
function CountdownBanner({ label, target }) {
    const [left, setLeft] = (0, react_1.useState)(() => target ? getTimeLeft(target) : null);
    (0, react_1.useEffect)(() => {
        if (!target)
            return;
        const id = setInterval(() => setLeft(getTimeLeft(target)), 1000);
        return () => clearInterval(id);
    }, [target]);
    const unit = (n, suffix) => `${n}${suffix}`;
    return ((0, jsx_runtime_1.jsx)("div", { className: "bg-[var(--accent)] text-white", children: (0, jsx_runtime_1.jsxs)("div", { className: "mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold tracking-wide sm:text-sm", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "h-4 w-4 shrink-0" }), (0, jsx_runtime_1.jsx)("span", { children: label ?? "Limited-time offer" }), left && ((0, jsx_runtime_1.jsxs)("span", { className: "tabular-nums", children: [unit(left.days, "d"), " ", unit(left.hours, "h"), " ", unit(left.minutes, "m"), " ", unit(left.seconds, "s")] }))] }) }));
}
