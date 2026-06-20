import type { Metadata } from "next";
import TradiesTemplate from "@/templates/tradies/page";
import { templatePropsSchema } from "@/shared/types/template-props";
import tradiesData from "@/shared/types/example-data/tradies.json";

/**
 * Preview route: renders the tradies template with the canonical example data.
 * Visit http://localhost:3000/preview/tradies to view it.
 *
 * The raw JSON is validated/normalised through the canonical schema so defaults
 * are applied and the data is guaranteed to match `TemplateProps`.
 */
const props = templatePropsSchema.parse(tradiesData);

export const metadata: Metadata = {
  title: props.seo?.title ?? props.business.name,
  description: props.seo?.description ?? props.business.tagline,
};

export default function TradiesPreviewPage() {
  return <TradiesTemplate props={props} />;
}
