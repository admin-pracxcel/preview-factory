/**
 * Central lucide-react icon registry. Templates reference icons by string name
 * in props (e.g. `service.icon = "Wrench"`); this resolves them at render time.
 * Pure module (no "use client") so it is importable from server or client.
 */
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ChevronRight,
  Star,
  Quote,
  Wrench,
  Hammer,
  Flame,
  Siren,
  Waves,
  ShieldCheck,
  BadgeCheck,
  DollarSign,
  CheckCircle2,
  Sparkles,
  Tag,
  Zap,
  Plug,
  Lightbulb,
  BatteryCharging,
  Sun,
  Car,
  Home,
  Building2,
  Wind,
  Snowflake,
  Droplets,
  Paintbrush,
  Trees,
  Sparkle,
  Brush,
  Truck,
  CalendarCheck,
  HeartHandshake,
  Award,
  ThumbsUp,
  Timer,
  Leaf,
} from "lucide-react";

export type IconComponent = React.ComponentType<{
  className?: string;
  strokeWidth?: number;
}>;

export const ICONS: Record<string, IconComponent> = {
  Phone,
  Mail,
  MapPin,
  Clock,
  ChevronRight,
  Star,
  Quote,
  Wrench,
  Hammer,
  Flame,
  Siren,
  Waves,
  ShieldCheck,
  BadgeCheck,
  DollarSign,
  CheckCircle2,
  Sparkles,
  Tag,
  Zap,
  Plug,
  Lightbulb,
  BatteryCharging,
  Sun,
  Car,
  Home,
  Building2,
  Wind,
  Snowflake,
  Droplets,
  Paintbrush,
  Trees,
  Sparkle,
  Brush,
  Truck,
  CalendarCheck,
  HeartHandshake,
  Award,
  ThumbsUp,
  Timer,
  Leaf,
};

/** Resolve an icon by name, with a sensible fallback. */
export function resolveIcon(name?: string, fallback: IconComponent = Wrench): IconComponent {
  return (name && ICONS[name]) || fallback;
}
