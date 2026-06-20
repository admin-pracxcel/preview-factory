import NicheLanding from "@/app/components/NicheLanding";

export const metadata = {
  title: "Website for Fitness & Wellness | Preview Factory",
  description: "Get more clients and prove your results. A high-energy fitness website, live in 60 seconds.",
};

const TESTIMONIALS = [
  {
    name: "Jake M.",
    role: "Personal Trainer, South Yarra VIC",
    quote:
      "Went from 8 clients to 22 in 3 months. The site shows up when people search 'personal trainer South Yarra' and the phone rings.",
    rating: 5 as const,
  },
  {
    name: "Anika S.",
    role: "Yoga Studio, Newtown NSW",
    quote:
      "I needed something that looked premium without a premium price. This was exactly that. The site has been running for 4 months and I have had zero complaints about how it looks.",
    rating: 5 as const,
  },
  {
    name: "Chris W.",
    role: "Gym Owner, Fortitude Valley QLD",
    quote:
      "Best $49 I spend each month. Hands down. The local SEO means people find me when they are searching nearby.",
    rating: 5 as const,
  },
];

const FAQS = [
  {
    q: "Can I show class timetables?",
    a: "Yes. Your timetable can be embedded directly from your booking platform, or listed as structured text on a dedicated page.",
  },
  {
    q: "Does it work for group classes and 1-on-1?",
    a: "Yes. Both formats get their own service pages with pricing and booking links.",
  },
  {
    q: "Can I add transformation photos?",
    a: "Yes. Your Google Business Profile photos appear in the gallery. You can update photos via your Google listing at any time.",
  },
  {
    q: "Is it mobile-first?",
    a: "Yes. Most of your clients will find you on mobile. Every page is built mobile-first and loads fast.",
  },
];

export default function FitnessPage() {
  return (
    <NicheLanding
      category="fitness"
      heroImage="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80"
      tag="For Fitness & Wellness"
      headline="Get more clients. Prove your results."
      subheadline="A high-energy website built from your Google profile. Live in 60 seconds."
      subNiches={[
        "Personal Trainer",
        "Yoga Studio",
        "Pilates Studio",
        "Gym",
        "Martial Arts",
        "Dance Studio",
        "Crossfit Box",
        "Other fitness",
      ]}
      previewRoute="/preview/fitness-wellness"
      previewCaption="Your site will include class pages, a timetable section, and local SEO. Built in under 60 seconds."
      testimonials={TESTIMONIALS}
      faqs={FAQS}
      accentClass="bg-violet-600 hover:bg-violet-500 active:bg-violet-700"
    />
  );
}
