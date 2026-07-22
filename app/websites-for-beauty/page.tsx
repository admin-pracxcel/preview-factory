import NicheHomeLanding, { type NicheHomeLandingConfig } from "@/app/components/NicheHomeLanding";

export const metadata = {
  title: "Websites for Beauty & Aesthetics | Launcharoo",
  description:
    "A gallery-forward beauty website live in minutes, not months. Hair, nails, brows, cosmetic clinics. Booking-ready, mobile-first, built from your Google listing.",
  alternates: { canonical: "https://launcharoo.online/websites-for-beauty" },
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
  tag: "For Beauty & Aesthetics",
  heroHeadline1: "A website as gorgeous",
  heroHeadline2: "as your work.",
  heroSub:
    "Hair salons, nail bars, brow bars, cosmetic clinics. Gallery-forward, booking-ready, mobile-first. Live in minutes, not months, ready to send to your Instagram bio.",
  accentClass: "bg-fuchsia-600 hover:bg-fuchsia-500 active:bg-fuchsia-700",
  exampleHref: "/preview/beauty-aesthetics",
  exampleAlt: "Hair salon example site",
  stats: [
    { value: "400+", label: "salons live" },
    { value: "6.1×", label: "more DM bookings" },
    { value: "Minutes", label: "average build time" },
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
      body: "Fresha, Timely, Booktopia, Vagaro. Submit your booking link or embed via a change request, we drop it into the booking block for you.",
    },
    {
      icon: "💅",
      title: "Treatment menu with prices",
      body: "Full service list with duration and price. Submit updates via a quick change request the day after a price change. No admin work on your end.",
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
      a: "Yes. Fresha, Timely, Booktopia, Vagaro, Square, whatever you use. Submit the booking link or embed via a change request from your dashboard and we will wire it in within 2 hours.",
    },
    {
      q: "Can I show my Instagram feed?",
      a: "Yes. We can embed your Instagram gallery on the home page. Fresh work shows up automatically as you post.",
    },
    {
      q: "How do I update my price list?",
      a: "Submit the new prices via a change request from your dashboard. We update your site within 2 hours. No wrestling with a page builder.",
    },
    {
      q: "What if my Google profile has wrong information?",
      a: "You can edit key details right on your preview page. After you subscribe, submit anything else through the change request form on your dashboard. We action requests within 2 hours.",
    },
    {
      q: "What does it cost?",
      a: "Free to preview. Plans start at $29/month once you decide to keep it. No setup fee, no contracts, cancel anytime.",
    },
  ],
  ctaHeadline: "See your beauty website in minutes.",
  ctaSub: "No credit card. No commitment. Just your site, live, now.",
};

export default function BeautyLandingPage() {
  return <NicheHomeLanding config={CONFIG} />;
}
