import NicheHomeLanding, { type NicheHomeLandingConfig } from "@/app/components/NicheHomeLanding";

export const metadata = {
  title: "Websites for Fitness & Wellness | Launcharoo",
  description:
    "A pro fitness website live in minutes, not months. Personal trainers, CrossFit boxes, yoga, Pilates, martial arts. Class schedule, PT bios, free trial signups, built from your Google listing.",
  alternates: { canonical: "https://launcharoo.online/websites-for-fitness" },
};

const CONFIG: NicheHomeLandingConfig = {
  category: "fitness-wellness",
  subNiches: [
    "Personal Trainer",
    "CrossFit Box",
    "Yoga Studio",
    "Pilates Studio",
    "Martial Arts",
    "Boxing Gym",
    "Group Fitness",
    "Wellness Coach",
    "Other fitness",
  ],
  tag: "For Fitness & Wellness",
  heroHeadline1: "A website your clients",
  heroHeadline2: "actually want to visit.",
  heroSub:
    "Personal trainers, CrossFit boxes, yoga studios, Pilates, martial arts. Class schedule, transformation gallery, free trial form. Live in minutes, not months.",
  accentClass: "bg-lime-600 hover:bg-lime-500 active:bg-lime-700",
  exampleHref: "/preview/fitness-wellness",
  exampleAlt: "Personal trainer example site",
  stats: [
    { value: "250+", label: "gyms live" },
    { value: "5.4×", label: "more free-trial signups" },
    { value: "Minutes", label: "average build time" },
    { value: "$0", label: "setup fee" },
  ],
  painPoints: [
    {
      quote: "Prospects cannot find my class schedule.",
      detail:
        "It is buried in a PDF from 2022, or worse, a Facebook post. If a new client cannot see when your Saturday spin class runs, they book a different gym.",
    },
    {
      quote: "Free trial signups come in via Facebook DM.",
      detail:
        "Half get lost, the other half take 3 days to respond to. A signup form on your site sends the lead straight to your inbox with all the details you need.",
    },
    {
      quote: "Google says my hours are wrong.",
      detail:
        "You cannot fix your old site to match. Every prospect who checks your hours before they show up either gives up or drives to a closed door.",
    },
  ],
  features: [
    {
      icon: "🗓️",
      title: "Class schedule that looks like a timetable",
      body: "A proper weekly view, not a wall of text. New clients see exactly what runs on Tuesday at 6am and book the trial.",
    },
    {
      icon: "🏋️",
      title: "PT bios with specialties and packages",
      body: "One page per trainer. Focus areas, qualifications, package prices, direct booking. Prospective clients pick their coach.",
    },
    {
      icon: "📈",
      title: "Transformation gallery",
      body: "Before-and-after photos, weight or performance stats, a short client story. This is the single biggest lever for enquiries.",
    },
    {
      icon: "🎁",
      title: "Free trial and challenge landing pages",
      body: "6-week challenge, 7-day pass, first-class-free. Ready-to-go landing pages that convert paid ad traffic.",
    },
    {
      icon: "📨",
      title: "Free trial signup form",
      body: "Clean signup form. Emails you the moment someone signs up. No more DMs at 11pm going unanswered.",
    },
    {
      icon: "🔗",
      title: "MindBody, Glofox, Fitbox friendly",
      body: "If you already use a class booking platform, we drop your booking widget into the schedule block after your preview.",
    },
  ],
  testimonials: [
    {
      name: "Josh W.",
      role: "Personal Trainer, Bondi NSW",
      quote:
        "I had a Wix site half-built for 8 months. This one was done and live before I finished my morning coffee.",
      rating: 5,
    },
    {
      name: "Alex H.",
      role: "CrossFit Coach, Melbourne VIC",
      quote:
        "The class schedule block alone doubled our free-trial signups. Prospects can finally see what we do without messaging us.",
      rating: 5,
    },
    {
      name: "Nina R.",
      role: "Yoga Studio Owner, Byron Bay NSW",
      quote:
        "I never wanted to touch a website builder again. I did not have to. It just built itself from my Google listing.",
      rating: 5,
    },
  ],
  faqs: [
    {
      q: "Can I connect my class booking system?",
      a: "Yes. MindBody, Glofox, Fitbox, Xplor, Momence. Submit your widget or booking link via a change request from your dashboard and we drop it into the schedule block within 2 hours.",
    },
    {
      q: "Can I add my 6-week challenge landing page?",
      a: "Yes. Every fitness site comes with a challenge-style landing page you can activate. Submit the offer, price, and start date via a change request from your dashboard.",
    },
    {
      q: "How do I update my class times?",
      a: "Submit a change request from your dashboard. We update the schedule block within 2 hours.",
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
  ctaHeadline: "See your fitness website in minutes.",
  ctaSub: "No credit card. No commitment. Just your site, live, now.",
};

export default function FitnessLandingPage() {
  return <NicheHomeLanding config={CONFIG} />;
}
