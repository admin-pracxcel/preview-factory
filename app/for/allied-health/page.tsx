import NicheLanding from "@/app/components/NicheLanding";

export const metadata = {
  title: "Website for Allied Health | Launcharoo",
  description: "Fill your appointment book with a professional clinic website, live in 60 seconds. Built from your Google Business Profile.",
};

const TESTIMONIALS = [
  {
    name: "Maria C.",
    role: "Physiotherapist, Chatswood NSW",
    quote:
      "I had no website at all. Three weeks after going live I was getting enquiries from Google for the first time.",
    rating: 5 as const,
  },
  {
    name: "Ben A.",
    role: "Osteopath, Fitzroy VIC",
    quote:
      "Setup took literally one minute. My Google profile already had all my info — the site just appeared.",
    rating: 5 as const,
  },
  {
    name: "Priya S.",
    role: "Massage Therapist, Bondi NSW",
    quote:
      "Clients tell me they found me on Google now. Before, they would just walk past.",
    rating: 5 as const,
  },
];

const FAQS = [
  {
    q: "Is the site AHPRA compliant?",
    a: "Yes. We do not include patient testimonials about clinical outcomes, and we never fabricate credentials or treatment claims. All content is based on your Google Business Profile data.",
  },
  {
    q: "Can I list my AHPRA registration number?",
    a: "Yes. After your preview goes live, SMS us your registration number and we will add it to your about page within 2 hours.",
  },
  {
    q: "What if my Google profile has wrong information?",
    a: "SMS us after you receive your preview link. We will update any details within 2 hours.",
  },
];

export default function AlliedHealthPage() {
  return (
    <NicheLanding
      category="allied-health"
      heroImage="/images/categories/allied-health-v2.png"
      tag="For Allied Health"
      headline="More local patients. Starting this week."
      subheadline="See your finished allied health website in 60 seconds. AHPRA-compliant, built from your Google listing."
      subNiches={[
        "Physiotherapist",
        "Chiropractor",
        "Osteopath",
        "Massage Therapist",
        "Occupational Therapist",
        "Psychologist",
        "Dietitian",
        "Speech Therapist",
        "Other allied health",
      ]}
      previewRoute="/preview/allied-health"
      previewCaption="Your site will include a homepage, 6 service pages, 8 suburb pages, and your AHPRA details."
      testimonials={TESTIMONIALS}
      faqs={FAQS}
      accentClass="bg-teal-600 hover:bg-teal-500 active:bg-teal-700"
    />
  );
}
