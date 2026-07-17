import NicheLanding from "@/app/components/NicheLanding";

export const metadata = {
  title: "Website for Fitness & Wellness | Launcharoo",
  description: "Get more clients and fill your classes. A fitness website live in 60 seconds, built from your Google profile.",
};

const TESTIMONIALS = [
  {
    name: "Marcus R.",
    role: "Personal Trainer, South Yarra VIC",
    quote:
      "I went from zero enquiries online to 8 new client enquiries in my first 2 weeks. The local SEO actually works.",
    rating: 5 as const,
  },
  {
    name: "Tara H.",
    role: "Yoga Studio, Brunswick VIC",
    quote:
      "My studio fills up now via Google. Before this, people only found me through Instagram or word of mouth.",
    rating: 5 as const,
  },
  {
    name: "Josh K.",
    role: "Boxing Coach, Bankstown NSW",
    quote:
      "I had no idea how to get a website. This did it for me in under a minute. My clients send me compliments about it.",
    rating: 5 as const,
  },
];

const FAQS = [
  {
    q: "Will my class schedule show up?",
    a: "Not automatically — but once your site is live, SMS us your timetable link or PDF and we will add it to your homepage within 2 hours.",
  },
  {
    q: "Can I take online bookings?",
    a: "Yes. SMS us your booking link (Mindbody, Acuity, etc.) and we will add it to your homepage and service pages.",
  },
  {
    q: "I train clients at different locations. Is that a problem?",
    a: "No. We can add multiple locations to your site. SMS us the locations after your preview goes live.",
  },
];

export default function FitnessPage() {
  return (
    <NicheLanding
      category="fitness"
      heroImage="/images/categories/fitness-wellness.png"
      tag="For Fitness & Wellness"
      headline="Fill your classes and your calendar. From today."
      subheadline="Get your fitness or wellness business online in 60 seconds. Built from your Google listing."
      subNiches={[
        "Personal Trainer",
        "Gym",
        "Yoga Studio",
        "Pilates Studio",
        "Boxing Gym",
        "CrossFit Box",
        "Dance Studio",
        "Martial Arts",
        "Other fitness",
      ]}
      previewRoute="/preview/fitness-wellness"
      previewCaption="Your site will include a homepage, 6 service pages, 8 suburb pages, and your class or session info."
      testimonials={TESTIMONIALS}
      faqs={FAQS}
      accentClass="bg-red-600 hover:bg-red-500 active:bg-red-700"
    />
  );
}
