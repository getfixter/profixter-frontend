"use client";

import dynamic from "next/dynamic";
import PlanComparisonSection from "../components/sections/PlanComparisonSection";
import TestimonialsSection from "../components/sections/TestimonialsSection";
import ValuePropsSection from "../components/sections/ValuePropsSection";
import DepartmentsSection from "../components/sections/DepartmentsSection";

/**
 * Plans Page
 *
 * A dedicated page for visitors to explore Profixter's subscription plans in
 * detail.  It contains a comparison table, value propositions, testimonials
 * and a brief overview of other services to cross sell.  The page is fully
 * responsive and does not rely on any backend at this stage.  If you need to
 * fetch plan pricing dynamically, you can replace the hard coded values in
 * PlanComparisonSection with data fetched from an API.
 */
export default function PlansPage() {
  return (
    <div className="min-h-screen">
      <PlanComparisonSection />
      <ValuePropsSection />
      <TestimonialsSection />
      <DepartmentsSection />
    </div>
  );
}