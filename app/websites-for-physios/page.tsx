import NicheHomeLanding, { type NicheHomeLandingConfig } from "@/app/components/NicheHomeLanding";

export const metadata = {
  title: "Websites for Allied Health Clinics | Launcharoo",
  description:
    "A professional clinic website live in 60 seconds. Physios, chiros, massage, podiatry, psych. Online booking ready, AHPRA-compliant, built from your Google listing.",
  alternates: { canonical: "https://launcharoo.online/websites-for-physios" },
};

const CONFIG: NicheHomeLandingConfig = {
  category: "allied-health",
  subNiches: [
    "Physiotherapist",
    "Chiropractor",
    "Osteopath",
    "Massage Therapist",
    "Occupational Therapist",
    "Podiatrist",
    "Psychologist",
    "Speech Pathologist",
    "Other allied health",
  ],
  tag: "For allied health clinics",
  heroHeadline1: "Websites that fill your",
  heroHeadline2: "appointment book.",
  heroSub:
    "Physios, chiros, massage therapists, podiatrists, psychologists. Online booking, patient forms, and HICAPS-ready copy. Live in under a minute. AHPRA-compliant by default.",
  accentClass: "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700",
  exampleHref: "/preview/allied-health",
  exampleAlt: "Physiotherapy clinic example site",
  stats: [
    { value: "300+", label: "clinics live" },
    { value: "4.7×", label: "more booked appointments" },
    { value: "60 sec", label: "average build time" },
    { value: "$0", label: "setup fee" },
  ],
  painPoints: [
    {
      quote: "Patients call to book because the site has no way to.",
      detail:
        "Every incoming booking call ties up your receptionist. Prospective patients under 40 will just book somewhere else that offers online booking.",
    },
    {
      quote: "Reception spends 2 hours a day on booking calls.",
      detail:
        "That is 10 hours a week your reception could be handling actual patients. Online booking recovers that time in the first month.",
    },
    {
      quote: "My site still does not mention telehealth.",
      detail:
        "The 2020 site is still up in 2026. Every week you delay a rebuild is another week of patients bouncing to the clinic that clearly offers what they need.",
    },
  ],
  features: [
    {
      icon: "📅",
      title: "Online booking, ready to wire",
      body: "A booking block that connects to Cliniko, Halaxy, Nookal, or your existing scheduler. If you use one, we can display it.",
    },
    {
      icon: "💳",
      title: "HICAPS-ready private health copy",
      body: "Private health cover, HICAPS on the spot, rebate at the counter. All the trust cues patients are looking for, worded correctly.",
    },
    {
      icon: "👥",
      title: "Practitioner bios with photos",
      body: "One profile page per clinician. Qualifications, AHPRA number, special interests. Patients pick who they want to see.",
    },
    {
      icon: "🏥",
      title: "Treatment library",
      body: "Individual pages for every treatment you offer. Great for SEO — patients searching for 'shockwave therapy Chatswood' will find you.",
    },
    {
      icon: "🕒",
      title: "Opening hours that sync",
      body: "Your hours block reads from your Google Business Profile. Update Google once, updated everywhere. No more 'Sunday closed' shown on the site when you have Sunday clinics running.",
    },
    {
      icon: "📋",
      title: "New patient intake form",
      body: "A quick intake form that emails you before the first appointment. Fewer no-shows and faster triage on the day.",
    },
  ],
  testimonials: [
    {
      name: "Maria C.",
      role: "Physiotherapist, Chatswood NSW",
      quote:
        "I had no website at all. Three weeks after going live I was getting enquiries from Google for the first time.",
      rating: 5,
    },
    {
      name: "Ben A.",
      role: "Osteopath, Fitzroy VIC",
      quote:
        "Setup took literally one minute. My Google profile already had all my info, and the site just appeared.",
      rating: 5,
    },
    {
      name: "Priya S.",
      role: "Massage Therapist, Bondi NSW",
      quote:
        "Clients tell me they found me on Google now. Before, they would just walk past.",
      rating: 5,
    },
  ],
  faqs: [
    {
      q: "Is the site AHPRA compliant?",
      a: "Yes. We do not include patient testimonials about clinical outcomes, and we never fabricate credentials or treatment claims. All content is based on your Google Business Profile data.",
    },
    {
      q: "Can I list my AHPRA registration number?",
      a: "Yes. After your preview goes live, SMS us your registration number and we will add it to your about page within 2 hours.",
    },
    {
      q: "Does it connect to Cliniko / Halaxy / Nookal?",
      a: "Yes. Send us your booking widget embed code after your preview and we will drop it into the booking block within 2 hours.",
    },
    {
      q: "What if my Google profile has wrong information?",
      a: "SMS us after you receive your preview link. We will update any details within 2 hours.",
    },
    {
      q: "What does it cost?",
      a: "Free to preview. Plans start at $19/month once you decide to keep it. No setup fee, no contracts, cancel anytime.",
    },
  ],
  ctaHeadline: "See your clinic website in 60 seconds.",
  ctaSub: "No credit card. No commitment. Just your site, live, now.",
};

export default function AlliedHealthLandingPage() {
  return <NicheHomeLanding config={CONFIG} />;
}
