"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BackLinkProps {
  href: string;
  "aria-label"?: string;
}

const defaultClassName =
  "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 -ml-2 inline-flex items-center touch-manipulation";

export function BackLink({ href, "aria-label": ariaLabel = "Back" }: BackLinkProps) {
  return (
    <Link href={href} className={defaultClassName} aria-label={ariaLabel}>
      <ArrowLeft size={24} strokeWidth={2} />
    </Link>
  );
}
