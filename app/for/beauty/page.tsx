import NicheLanding from "@/app/components/NicheLanding";

export const metadata = {
  title: "Website for Beauty & Aesthetics | Preview Factory",
  description: "Show your work and book more clients. A gallery-forward beauty website, live in 60 seconds.",
};

const TESTIMONIALS = [
  {
    name: "Jessica L.",
    role: "Hair Stylist, Fitzroy VIC",
    quote:
      "My Instagram was getting likes but not bookings. My new site converts. I picked up 14 new clients in the first month.",
    rating: 5 as const,
  },
  {
    name: "Priya M.",
    role: "Nail Artist, Surry Hills NSW",
    quote:
      "The gallery section shows my work exactly right. Clients come in already knowing what they want because they have seen it on my site.",
    rating: 5 as const,
  },
  {
    name: "Lisa T.",
    role: "Beauty Therapist, Bondi NSW",
    quote:
      "Went live in under a minute. Looked like a $3,000 website. Had 4 new bookings that same afternoon.",
    rating: 5 as const,
  },
];

const FAQS = [
  {
    q: "Can I show my portfolio on the site?",
    a: "Yes. Your Google Business Profile photos appear in a gallery section on your homepage and service pages.",
  },
  {
    q: "Does it work for booking platforms like Fresha or Timely?",
    a: "Yes. We link your existing booking page from every CTA on the site.",
  },
  {
    q: "Can I change the colours to match my brand?",
    a: "Yes. You choose from 8 preset palettes or enter your own hex code. Changes go live in seconds.",
  },
  {
    q: "What if I do not have a Google Business Profile?",
    a: "We will guide you through a short form to capture your services, location and contact details instead.",
  },
];

export default function BeautyPage() {
  return (
    <NicheLanding
      category="beauty"
      heroImage="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&q=80"
      tag="For Beauty & Aesthetics"
      headline="Show your work. Book more clients."
      subheadline="A gallery-forward website that converts scrollers into bookings. Live in 60 seconds."
      subNiches={[
        "Hair Salon",
        "Nail Salon",
        "Beauty Therapist",
        "Makeup Artist",
        "Barber",
        "Eyebrow Artist",
        "Waxing Studio",
        "Other beauty",
      ]}
      previewRoute="/preview/beauty-aesthetics"
      previewCaption="Your site will include a photo gallery, service menu, and booking links. Built in under 60 seconds."
      testimonials={TESTIMONIALS}
      faqs={FAQS}
      accentClass="bg-rose-600 hover:bg-rose-500 active:bg-rose-700"
    />
  );
}
