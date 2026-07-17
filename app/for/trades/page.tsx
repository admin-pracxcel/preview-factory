import NicheLanding from "@/app/components/NicheLanding";

export const metadata = {
  title: "Website for Tradies | Launcharoo",
  description: "Get a professional tradie website live in 60 seconds. Built from your Google Business Profile. No web designer needed.",
};

const TESTIMONIALS = [
  {
    name: "Dave S.",
    role: "Electrician, Penrith NSW",
    quote:
      "I was getting maybe 5 calls a week from Google. Now I get 22. The site went live in about 45 seconds and looked exactly like what I'd pay an agency $5,000 for.",
    rating: 5 as const,
  },
  {
    name: "Mike T.",
    role: "Plumber, Brunswick VIC",
    quote:
      "Tried every website builder. Nothing stuck. This pulled my Google listing and built the whole thing automatically. I had it live before my coffee was finished.",
    rating: 5 as const,
  },
  {
    name: "Jake R.",
    role: "Roofer, Parramatta NSW",
    quote:
      "Booked 3 new jobs in the first week from people finding me on Google. The local SEO stuff actually works.",
    rating: 5 as const,
  },
];

const FAQS = [
  {
    q: "Will my site show up on Google?",
    a: "Yes. Every site includes 20-40 locally-optimised pages built around your suburb and services. Most businesses see movement in Google rankings within 2-4 weeks.",
  },
  {
    q: "What if my Google Business Profile has wrong info?",
    a: "You can update any details before your site goes live. Just message us via SMS after you receive your preview link.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no lock-in. Cancel with one SMS.",
  },
  {
    q: "How is this different from a $10 website builder?",
    a: "It is built specifically for trades in your suburb, using your actual Google data. It is not a template you fill in — it is a finished site from day one.",
  },
];

export default function TradesPage() {
  return (
    <NicheLanding
      category="trades"
      heroImage="/images/categories/trades.png"
      tag="For Tradies"
      headline="More local jobs. Starting today."
      subheadline="Enter your details and see your finished website in 60 seconds. Built from your Google listing — no setup, no agency."
      subNiches={[
        "Electrician",
        "Plumber",
        "Roofer",
        "Carpenter",
        "Painter",
        "Tiler",
        "Concreter",
        "Gardener",
        "Other trade",
      ]}
      previewRoute="/preview/trades"
      previewCaption="Your site will include 6 service pages, call tracking, and local SEO. Built in under 60 seconds."
      testimonials={TESTIMONIALS}
      faqs={FAQS}
      accentClass="bg-orange-600 hover:bg-orange-500 active:bg-orange-700"
    />
  );
}
