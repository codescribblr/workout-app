"use client";

import Link from "next/link";
import { Timer, FileText, ClipboardList, BarChart3 } from "lucide-react";

interface DashboardCardsProps {
  totalWorkoutsCount: number;
}

export default function DashboardCards({ totalWorkoutsCount }: DashboardCardsProps) {
  const cards = [
    {
      href: "/plans",
      icon: Timer,
      title: "Start New Workout",
      subtitle: "Choose a plan",
    },
    {
      href: "/plans",
      icon: FileText,
      title: "Workout Plans",
      subtitle: "View and manage",
    },
    {
      href: "/history",
      icon: ClipboardList,
      title: "Workout History",
      subtitle: `${totalWorkoutsCount || 0} sessions`,
    },
    {
      href: "/progress",
      icon: BarChart3,
      title: "Progress",
      subtitle: "Charts & insights",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ href, icon: Icon, title, subtitle }) => (
        <Link
          key={title}
          href={href}
          className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-lg transition"
        >
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Icon size={28} strokeWidth={2} className="text-gray-600 dark:text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-lg font-medium text-gray-900 dark:text-white truncate">
                    {title}
                  </dt>
                  <dd className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {subtitle}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
