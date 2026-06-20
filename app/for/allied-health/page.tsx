import NicheLanding from "@/app/components/NicheLanding";

export const metadata = {
  title: "Website for Allied Health | Preview Factory",
  description: "Fill your appointment book with a professional clinic website, live in 60 seconds. Built from your Google Business Profile.",
};

const TESTIMONIALS = [
  {
    name: "Sarah K.",
    role: "Physiotherapist, Chatswood NSW",
    quote:
      "I was relying on word of mouth. Three weeks after my site went live I had 11 new bookings from Google searches. It just works.",
    rating: 5 as const,
  },
  {
    name: "Emma R.",
    role: "Chiropractor, Brisbane QLD",
    quote:
      "The site looked professional from day one. AHPRA-compliant, my services listed properly, showing up in local searches. I could not have built this myself.",
    rating: 5 as const,
  },
  {
    name: "Tom H.",
    role: "Osteopath, South Yarra VIC",
    quote:
      "I was sceptical about a 60-second website but the result was genuinely impressive. My patients comment on how professional it looks.",
    rating: 5 as const,
  },
];

const FAQS = [
  {
    q: "Is the site AHPRA-compliant?",
    a: "Yes. Sites for regulated health professions avoid testimonial claims about clinical outcomes and do not include guarantee language. Your registration details are shown as supplied.",
  },
  {
    q: "Can patients book directly from the site?",
    a: "Yes. Your phone number and a booking link (if you have one) are featured prominently on every page.",
  },
  {
    q: "What if I work from multiple locations?",
    a: "Each location gets its own page with locally-relevant content. Let us know your locations when you sign up.",
  },
  {
    q: "How long does it take to set up?",
    a: "Your preview is live in under 60 seconds. Full site with your branding takes about 10 minutes.",
  },
];

export default function AlliedHealthPage() {
  return (
    <NicheLanding
      category="allied-health"
      heroImage="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600&q=80"
      tag="For Allied Health"
      headline="Fill your appointment book."
      subheadline="A professional clinic website, live in 60 seconds. No web designer needed."
      subNiches={[
        "Physiotherapist",
        "Chiropractor",
        "Massage Therapist",
        "Osteopath",
        "Podiatrist",
        "Occupational Therapist",
        "Dietitian",
        "Other allied health",
      ]}
      previewRoute="/preview/allied-health"
      previewCaption="Your site will include clinic pages, an appointment booking link, and local SEO. Built in under 60 seconds."
      testimonials={TESTIMONIALS}
      faqs={FAQS}
      accentClass="bg-teal-600 hover:bg-teal-500 active:bg-teal-700"
    />
  );
}
