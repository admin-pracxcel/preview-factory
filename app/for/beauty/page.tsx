import NicheLanding from "@/app/components/NicheLanding";

export const metadata = {
  title: "Website for Beauty & Aesthetics | Launcharoo",
  description: "Show your work and book more clients. A gallery-forward beauty website, live in 60 seconds.",
};

const TESTIMONIALS = [
  {
    name: "Jessica L.",
    role: "Hair Stylist, Fitzroy VIC",
    quote:
      "My Instagram was getting likes but not bookings. The website converts. Picked up 14 new clients in the first month.",
    rating: 5 as const,
  },
  {
    name: "Amy P.",
    role: "Beauty Therapist, Newtown NSW",
    quote:
      "The site looks exactly like what I wanted but could never afford. My booking link is right on the homepage.",
    rating: 5 as const,
  },
  {
    name: "Cam T.",
    role: "Barber, Collingwood VIC",
    quote:
      "I was invisible on Google. Now I come up first for barbershop Collingwood and I am booked solid Tuesdays to Saturdays.",
    rating: 5 as const,
  },
];

const FAQS = [
  {
    q: "Will my gallery photos show up?",
    a: "Yes. We pull all photos from your Google Business Profile, including your work portfolio, and display them on your homepage and service pages.",
  },
  {
    q: "Can I add a booking link?",
    a: "Yes. After your preview goes live, SMS us your booking link (Bookwell, Timely, Fresha, Square, etc.) and we will add it to every page within 2 hours.",
  },
  {
    q: "How do I update my prices?",
    a: "Just SMS us. We update your site within 2 hours, no login required.",
  },
];

export default function BeautyPage() {
  return (
    <NicheLanding
      category="beauty"
      heroImage="/images/categories/beauty-aesthetics-v2.png"
      tag="For Beauty & Aesthetics"
      headline="A website your clients will love. Live in 60 seconds."
      subheadline="Built from your Google listing. Show off your work, fill your appointment book."
      subNiches={[
        "Hair Salon",
        "Nail Bar",
        "Beauty Therapist",
        "Makeup Artist",
        "Skin Clinic",
        "Laser Clinic",
        "Eyebrow & Lash",
        "Barber Shop",
        "Other beauty",
      ]}
      previewRoute="/preview/beauty-aesthetics"
      previewCaption="Your site will include a homepage, gallery, 6 service pages, and 8 suburb pages."
      testimonials={TESTIMONIALS}
      faqs={FAQS}
      accentClass="bg-rose-600 hover:bg-rose-500 active:bg-rose-700"
    />
  );
}
