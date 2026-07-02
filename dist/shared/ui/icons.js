"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ICONS = void 0;
exports.resolveIcon = resolveIcon;
/**
 * Central lucide-react icon registry. Templates reference icons by string name
 * in props (e.g. `service.icon = "Wrench"`); this resolves them at render time.
 * Pure module (no "use client") so it is importable from server or client.
 */
const lucide_react_1 = require("lucide-react");
exports.ICONS = {
    Phone: lucide_react_1.Phone,
    Mail: lucide_react_1.Mail,
    MapPin: lucide_react_1.MapPin,
    Clock: lucide_react_1.Clock,
    ChevronRight: lucide_react_1.ChevronRight,
    Star: lucide_react_1.Star,
    Quote: lucide_react_1.Quote,
    Wrench: lucide_react_1.Wrench,
    Hammer: lucide_react_1.Hammer,
    Flame: lucide_react_1.Flame,
    Siren: lucide_react_1.Siren,
    Waves: lucide_react_1.Waves,
    ShieldCheck: lucide_react_1.ShieldCheck,
    BadgeCheck: lucide_react_1.BadgeCheck,
    DollarSign: lucide_react_1.DollarSign,
    CheckCircle2: lucide_react_1.CheckCircle2,
    Sparkles: lucide_react_1.Sparkles,
    Tag: lucide_react_1.Tag,
    Zap: lucide_react_1.Zap,
    Plug: lucide_react_1.Plug,
    Lightbulb: lucide_react_1.Lightbulb,
    BatteryCharging: lucide_react_1.BatteryCharging,
    Sun: lucide_react_1.Sun,
    Car: lucide_react_1.Car,
    Home: lucide_react_1.Home,
    Building2: lucide_react_1.Building2,
    Wind: lucide_react_1.Wind,
    Snowflake: lucide_react_1.Snowflake,
    Droplets: lucide_react_1.Droplets,
    Paintbrush: lucide_react_1.Paintbrush,
    Trees: lucide_react_1.Trees,
    Sparkle: lucide_react_1.Sparkle,
    Brush: lucide_react_1.Brush,
    Truck: lucide_react_1.Truck,
    CalendarCheck: lucide_react_1.CalendarCheck,
    HeartHandshake: lucide_react_1.HeartHandshake,
    Award: lucide_react_1.Award,
    ThumbsUp: lucide_react_1.ThumbsUp,
    Timer: lucide_react_1.Timer,
    Leaf: lucide_react_1.Leaf,
};
/** Resolve an icon by name, with a sensible fallback. */
function resolveIcon(name, fallback = lucide_react_1.Wrench) {
    return (name && exports.ICONS[name]) || fallback;
}
