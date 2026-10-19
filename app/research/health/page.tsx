import type { Metadata } from "next";
import { Observatory } from "@/components/health/observatory";
export const metadata: Metadata = {
  title: "HEALTH · Storywalker Study 04",
  robots: { index: false, follow: false },
};
export default function HealthStudyPage() {
  return <Observatory />;
}
