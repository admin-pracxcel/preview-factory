import NicheHomeLanding, { type NicheHomeLandingConfig } from "@/app/components/NicheHomeLanding";

export const metadata = {
  title: "Websites for Hair Salons & Beauty Clinics | Launcharoo",
  description:
    "A gallery-forward salon website live in 60 seconds. Hair, nails, brows, cosmetic clinics. Booking-ready, mobile-first, built from your Google listing.",
  alternates: { canonical: "https://launcharoo.online/websites-for-hair-salons" },
};

const CONFIG: NicheHomeLandingConfig = {
  category: "beauty-aesthetics",
  subNiches: [
    "Hair Salon",
    "Nail Salon",
    "Brow & Lash Bar",
    "Cosmetic Clinic",
    "Waxing & Beauty",
    "Barber",
    "Makeup Artist",
    "Other beauty",
  ],
  tag: "For salons and clinics",
  heroHeadline1: "A website as gorgeous",
  heroHeadline2: "as your work.",
  heroSub:
    "Hair salons, nail bars, brow bars, cosmetic clinics. Gallery-forward, booking-ready, mobile-first. Live in under a minute, ready to send to your Instagram bio.",
  accentClass: "bg-fuchsia-600 hover:bg-fuchsia-500 active:bg-fuchsia-700",
  exampleHref: "/preview/beauty-aesthetics",
  exampleAlt: "Hair salon example site",
  stats: [
    { value: "400+", label: "salons live" },
    { value: "6.1×", label: "more DM bookings" },
    { value: "60 sec", label: "average build time" },
    { value: "$0", label: "setup fee" },
  ],
  painPoints: [
    {
      quote: "All my best work is trapped in Instagram Stories.",
      detail:
        "24 hours later it is gone. A gallery-forward website turns your work into a searchable, Google-indexed portfolio that keeps earning bookings.",
    },
    {
      quote: "Clients still book via DM at midnight.",
      detail:
        "You wake up to 12 half-conversations. Every one is a booking that could have happened in a proper booking widget while you slept.",
    },
    {
      quote: "The Linktree in my bio is a mess.",
      detail:
        "Your bio needs one link. That link should show your services, prices, gallery, and let clients book. Not a stack of Linktree buttons that go nowhere.",
    },
  ],
  features: [
    {
      icon: "🖼️",
      title: "Gallery-first layout",
      body: "Your work is the hero. Big, edge-to-edge photos on every page. Not another cookie-cutter template full of stock photography.",
    },
    {
      icon: "🎨",
      title: "Before-and-after slider",
      body: "Every service page can include a before-and-after slider. Nothing sells a colour or a set of extensions like the transformation.",
    },
    {
      icon: "📅",
      title: "Bring your own booking",
      body: "Fresha, Timely, Booktopia, Vagaro. Send us your booking link or embed after preview, we drop it into the booking block for you.",
    },
    {
      icon: "💅",
      title: "Treatment menu with prices",
      body: "Full service list with duration and price. Updated by SMS the day after a price change, no admin work.",
    },
    {
      icon: "👩‍🎨",
      title: "Artist bio pages",
      body: "One page per stylist, therapist, or artist. Portfolio, specialties, and a direct booking link. Client picks who they want.",
    },
    {
      icon: "🕒",
      title: "Opening hours plus Google Maps",
      body: "Your salon on the map, hours pulled from your Google listing. Two things clients search for the most, front and centre.",
    },
  ],
  testimonials: [
    {
      name: "Chloe M.",
      role: "Hair Salon Owner, Newtown NSW",
      quote:
        "My bio link finally goes somewhere that shows off my work. Bookings via the site tripled in the first month.",
      rating: 5,
    },
    {
      name: "Sarah L.",
      role: "Brow & Lash Bar, Melbourne VIC",
      quote:
        "The gallery makes such a difference. Clients scroll through actual work and book on the same page. Setup took a minute.",
      rating: 5,
    },
    {
      name: "Renata P.",
      role: "Cosmetic Clinic, Brisbane QLD",
      quote:
        "I had a $12k site that was 3 years old. This looks better and I built it in a coffee break.",
      rating: 5,
    },
  ],
  faqs: [
    {
      q: "Can I use my existing booking system?",
      a: "Yes. Fresha, Timely, Booktopia, Vagaro, Square, whatever you use. After your preview, send us the booking link or embed and we will wire it in within 2 hours.",
    },
    {
      q: "Can I show my Instagram feed?",
      a: "Yes. We can embed your Instagram gallery on the home page. Fresh work shows up automatically as you post.",
    },
    {
      q: "How do I update my price list?",
      a: "Text us the new prices. We update your site within 2 hours. No portal, no logins, no wrestling with a page builder.",
    },
    {
      q: "What if my Google profile has wrong information?",
      a: "SMS us after your preview link arrives. We update any details within 2 hours.",
    },
    {
      q: "What does it cost?",
      a: "Free to preview. Plans start at $19/month once you decide to keep it. No setup fee, no contracts, cancel anytime.",
    },
  ],
  ctaHeadline: "See your salon website in 60 seconds.",
  ctaSub: "No credit card. No commitment. Just your site, live, now.",
};

export default function BeautyLandingPage() {
  return <NicheHomeLanding config={CONFIG} />;
}
