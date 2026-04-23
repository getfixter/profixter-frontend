"use client";

import type { ComponentType, SVGProps } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface PopularTaskCardProps {
  title: string;
  subtitle?: string;
  Icon: IconType;
  onClick?: () => void;
}

export default function PopularTaskCard({
  title,
  subtitle,
  Icon,
  onClick,
}: PopularTaskCardProps) {
  const isInteractive = typeof onClick === "function";

  const content = (
    <div
      className={[
        "rounded-[18px] border border-[#E6E8EF] bg-white p-4 sm:p-5 h-full",
        "shadow-sm transition-all duration-200",
        isInteractive ? "hover:-translate-y-[2px] hover:shadow-md" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-[14px] bg-[#EEF2FF] border border-[#C5CBD8] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#306EEC]" />
        </div>

        <div className="min-w-0">
          <div className="text-[#313234] text-sm sm:text-[15px] font-extrabold leading-tight">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1 text-[#6A6D71] text-xs sm:text-[13px] leading-relaxed">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!isInteractive) {
    return content;
  }

  return (
    <button type="button" onClick={onClick} className="text-left w-full h-full">
      {content}
    </button>
  );
}
