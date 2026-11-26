import { GoogleAnalytics } from "@next/third-parties/google";

interface AnalyticsProps {
  measurementId: string | undefined;
}

// Renders nothing until a GA4 property exists, so local dev and previews
// without NEXT_PUBLIC_GA_MEASUREMENT_ID load no third-party script.
export function Analytics({ measurementId }: AnalyticsProps) {
  const gaId = measurementId?.trim();
  if (!gaId) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
