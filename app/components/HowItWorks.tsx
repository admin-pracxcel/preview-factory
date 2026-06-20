import { PenLine, Zap, Globe } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: PenLine,
    heading: "Enter your details",
    body: "Tell us your business name, what you specialise in, and your suburb. That is it. Takes under 30 seconds.",
  },
  {
    number: "02",
    icon: Zap,
    heading: "We build your site",
    body: "We pull your Google Business Profile and generate a complete multi-page website in under 60 seconds. No templates, no filler content.",
  },
  {
    number: "03",
    icon: Globe,
    heading: "Go live or customise",
    body: "Your site is live on a real URL. Change colours, add your logo, swap the hero image. No web designer. No waiting.",
  },
];

export default function HowItWorks() {
  return (
    <section className="w-full bg-[#040812] py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-14">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
            How it works
          </p>
          <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl text-white tracking-tight mb-4">
            From zero to live in 60 seconds
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            No agency. No designer. No waiting.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative flex flex-col gap-5 bg-white/5 border border-white/10 rounded-2xl p-8"
              >
                {/* Number pill */}
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-blue-400 bg-blue-600/20 border border-blue-600/30 rounded-full px-3 py-1 tracking-widest">
                    {step.number}
                  </span>
                </div>

                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <Icon className="w-5 h-5 text-white" />
                </div>

                {/* Text */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {step.heading}
                  </h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
