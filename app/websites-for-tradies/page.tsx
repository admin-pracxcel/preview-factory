import NicheHomeLanding, { type NicheHomeLandingConfig } from "@/app/components/NicheHomeLanding";

export const metadata = {
  title: "Websites for Australian Tradies | Launcharoo",
  description:
    "A professional tradie website live in 60 seconds. Sparkies, plumbers, chippies, roofers, painters. Built from your Google Business Profile. No web designer needed.",
  alternates: { canonical: "https://launcharoo.online/websites-for-tradies" },
};

const CONFIG: NicheHomeLandingConfig = {
  category: "trades",
  subNiches: [
    "Electrician",
    "Plumber",
    "Roofer",
    "Carpenter",
    "Painter",
    "Tiler",
    "Concreter",
    "Gardener",
    "Other trade",
  ],
  tag: "For Australian tradies",
  heroHeadline1: "The website every Aussie tradie",
  heroHeadline2: "should have.",
  heroSub:
    "Sparkies, plumbers, chippies, roofers, painters. We pull your Google listing and build the whole site in under a minute. No agency. No designer. No stuffing around.",
  accentClass: "bg-orange-600 hover:bg-orange-500 active:bg-orange-700",
  exampleHref: "/preview/trades",
  exampleAlt: "Electrician example site",
  stats: [
    { value: "800+", label: "tradies live" },
    { value: "3.2×", label: "more calls in 60 days" },
    { value: "60 sec", label: "average build time" },
    { value: "$0", label: "setup fee" },
  ],
  painPoints: [
    {
      quote: "My website is a Facebook page from 2018.",
      detail:
        "Locals searching for a sparkie in your area find your competitors first. If they land on your Facebook page they scroll past.",
    },
    {
      quote: "Paid an agency $5k, waited three months, got ghosted.",
      detail:
        "You are still chasing invoices for a half-built site. Meanwhile jobs go to the bloke with a working phone number on Google.",
    },
    {
      quote: "Missed calls at 6pm because I am on the tools all day.",
      detail:
        "Every missed call is a job someone else got. Your site should book the enquiry for you, not force a phone call at 6pm.",
    },
  ],
  features: [
    {
      icon: "📞",
      title: "Tap-to-call, everywhere",
      body: "Every page has your phone number as a big obvious button. One tap and the call is on. No fishing through menus.",
    },
    {
      icon: "🚨",
      title: "Emergency callout badge",
      body: "24/7 or after-hours? A prominent callout badge tells the customer you can be there tonight. Big lever for high-value jobs.",
    },
    {
      icon: "📍",
      title: "Real service-area map",
      body: "Suburbs you cover, marked on an actual map. Locals in Chatswood searching for a plumber know instantly whether you serve them.",
    },
    {
      icon: "📷",
      title: "Before-and-after gallery",
      body: "Pull your best work from your phone or Instagram. Nothing sells a job like a photo of a job well done.",
    },
    {
      icon: "🪪",
      title: "Licence numbers displayed",
      body: "ARC, Master Builders, electrical licence, plumbing licence. Every credential shown up front. Instant trust with anyone comparing quotes.",
    },
    {
      icon: "📝",
      title: "Quote form that emails you instantly",
      body: "Address, job description, photos of the issue. Straight to your inbox. Quote it while you are between jobs, not at 10pm.",
    },
  ],
  testimonials: [
    {
      name: "Dave S.",
      role: "Electrician, Penrith NSW",
      quote:
        "I was getting maybe 5 calls a week from Google. Now I get 22. The site went live in about 45 seconds and looked exactly like what I would pay an agency $5,000 for.",
      rating: 5,
    },
    {
      name: "Mike T.",
      role: "Plumber, Brunswick VIC",
      quote:
        "Tried every website builder. Nothing stuck. This pulled my Google listing and built the whole thing automatically. I had it live before my coffee was finished.",
      rating: 5,
    },
    {
      name: "Jake R.",
      role: "Roofer, Parramatta NSW",
      quote:
        "Booked 3 new jobs in the first week from people finding me on Google. The local SEO stuff actually works.",
      rating: 5,
    },
  ],
  faqs: [
    {
      q: "Will my site show up on Google?",
      a: "Yes. Every site includes 20-40 locally-optimised pages built around your suburb and services. Most tradies see movement in Google rankings within 2-4 weeks.",
    },
    {
      q: "What if my Google Business Profile has wrong info?",
      a: "You can update any details before your site goes live. Just message us via SMS after you receive your preview link.",
    },
    {
      q: "Can I display my licence numbers?",
      a: "Yes. ARC, Master Builders, electrical or plumbing licence, whichever you have. Add them via SMS after your preview and we will publish them within 2 hours.",
    },
    {
      q: "Do I need a designer?",
      a: "No. Everything is pre-styled and mobile-optimised. You can change the colours and logo from your dashboard if you want. Most tradies never touch it.",
    },
    {
      q: "What does it cost?",
      a: "Free to preview. Plans start at $19/month once you decide to keep it. No setup fee, no contracts, cancel anytime.",
    },
  ],
  ctaHeadline: "See your tradie website in 60 seconds.",
  ctaSub: "No credit card. No commitment. Just your site, live, now.",
};

export default function TradiesLandingPage() {
  return <NicheHomeLanding config={CONFIG} />;
}
