"use strict";
/**
 * generator/test-gbp.ts
 *
 * End-to-end test harness for the trades generator.
 * Assembles a realistic GBP payload for a Melbourne plumber and runs
 * it through the generator, writing output to generator/output/clearflow-plumbing.json.
 *
 * Run with a TypeScript runner after setting ANTHROPIC_API_KEY:
 *   npx ts-node --project tsconfig.json generator/test-gbp.ts
 *   OR
 *   node --loader ts-node/esm generator/test-gbp.ts
 *
 * Then grade the output:
 *   node scripts/grade.mjs generator/output/clearflow-plumbing.json
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
/* ------------------------------------------------------------------ payload */
const clearflowPlumbing = {
    name: "Clearflow Plumbing",
    niche: "plumber",
    suburb: "Southbank",
    state: "VIC",
    phone: "03 9012 4567",
    address: "Level 2, 101 Southbank Blvd, Southbank VIC 3006",
    description: "Clearflow Plumbing is a Melbourne-based licensed plumbing business serving the inner south and CBD fringe suburbs. We specialise in blocked drains, burst pipes, hot water systems, gas fitting, bathroom renovations, and general maintenance. Available 24/7 for emergencies — no call-out fee between 7am and 6pm weekdays.",
    years_in_business: 11,
    services: [
        "Blocked drains (drain camera inspection, hydro-jet clearing)",
        "Burst pipes and emergency repairs",
        "Hot water systems (electric, gas, heat pump, continuous flow)",
        "Gas fitting and gas appliance installation",
        "Bathroom renovations and re-piping",
        "General plumbing maintenance",
        "Toilet and cistern repairs",
        "Tap and mixer replacement",
        "Stormwater and sewer drain repairs",
        "New home and renovation rough-in plumbing",
    ],
    reviews: [
        {
            author: "Sarah L.",
            rating: 5,
            text: "Called Clearflow at 10pm for a burst pipe under the kitchen sink. They were on the door in 45 minutes and had everything fixed before midnight. Incredibly professional and the price was fair. Won't use anyone else.",
        },
        {
            author: "Marcus T.",
            rating: 5,
            text: "Had a blocked drain that three other plumbers couldn't fix. Clearflow brought a camera and found a root intrusion near the boundary. Sorted it same day. Excellent work and very tidy.",
        },
        {
            author: "Priya and James K.",
            rating: 5,
            text: "We used Clearflow for our bathroom renovation in South Melbourne — new shower, vanity rough-in and toilet relocation. Turned up on time every day, finished on schedule, and the finish was perfect. Highly recommend.",
        },
        {
            author: "David F.",
            rating: 4,
            text: "Good service for hot water system replacement. They quoted on the spot, came back the next morning, and the new unit has been running perfectly. Minor delay on the arrival time but they called ahead.",
        },
    ],
};
/* --------------------------------------------------------------- main */
async function main() {
    try {
        const outputPath = await (0, index_1.generateAndWrite)("trades", "plumber", clearflowPlumbing);
        console.log(`\nDone. Output written to: ${outputPath}`);
        console.log("Grade with: node scripts/grade.mjs generator/output/clearflow-plumbing.json");
    }
    catch (err) {
        console.error("generator: FAILED:", err);
        process.exit(1);
    }
}
main();
