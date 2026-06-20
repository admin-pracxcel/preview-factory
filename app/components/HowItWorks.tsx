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
    <section className="w-full bg-white py-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            From zero to live in 60 seconds
          </h2>
          <p className="text-slate-500 mt-4 text-lg max-w-2xl mx-auto">
            No web designer. No agency fees. No months of back-and-forth. Just your business, online, now.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative flex flex-col gap-5 bg-slate-50 border border-slate-100 rounded-2xl p-8 hover:shadow-md transition-shadow"
              >
                {/* Number pill */}
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 tracking-widest">
                    {step.number}
                  </span>
                </div>

                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                  <Icon className="w-5 h-5 text-white" />
                </div>

                {/* Text */}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {step.heading}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {step.body}
                  </p>
                </div>

                {/* Connector line (hidden on mobile, hidden on last item) */}
                {step.number !== "03" && (
                  <div className="hidden md:block absolute top-16 right-0 w-8 h-px bg-slate-200 translate-x-full" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
