"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BlogFaq } from "@/lib/blog-posts-store";

export function FaqAccordion({ faqs }: { faqs: BlogFaq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
      {faqs.map((faq, i) => {
        const open = openIndex === i;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-zinc-50"
            >
              <span className="text-base font-semibold text-zinc-900">
                {faq.question}
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-base leading-relaxed text-zinc-700">
                  {faq.answer}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
