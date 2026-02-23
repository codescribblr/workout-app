"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";
import type { WeeklyActivity, ExerciseProgression, ProgressStats } from "@/lib/progress/aggregate";

interface ProgressChartsProps {
  weeklyData: WeeklyActivity[];
  exerciseProgress: ExerciseProgression[];
  stats: ProgressStats;
  goals: string[];
}

const chartColors = {
  primary: "#6366f1",
  primaryLight: "#818cf8",
  secondary: "#22c55e",
  tertiary: "#f59e0b",
};

export default function ProgressCharts({
  weeklyData,
  exerciseProgress,
  stats,
  goals,
}: ProgressChartsProps) {
  const hasStrengthGoal =
    goals.some(
      (g) =>
        g.toLowerCase().includes("strength") ||
        g.toLowerCase().includes("muscle") ||
        g.toLowerCase().includes("build")
    ) || goals.length === 0;

  const hasCardioGoal =
    goals.some(
      (g) =>
        g.toLowerCase().includes("cardio") ||
        g.toLowerCase().includes("cardiovascular") ||
        g.toLowerCase().includes("fat") ||
        g.toLowerCase().includes("weight")
    ) || goals.length === 0;

  const tooltipStyle = {
    backgroundColor: "var(--tooltip-bg)",
    color: "var(--tooltip-fg)",
    border: "1px solid var(--tooltip-border)",
    borderRadius: "8px",
  };

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Stats cards - 2x2 on mobile, 4 cols on md+ */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard
          label="Workouts completed"
          value={stats.completedSessions}
          subtext="all time"
        />
        <StatCard
          label="Current streak"
          value={stats.currentStreak}
          subtext={stats.currentStreak === 1 ? "day" : stats.currentStreak === 0 ? "" : "days"}
        />
        <StatCard
          label="Avg. duration"
          value={`${stats.avgDurationMinutes} min`}
          subtext="per workout"
        />
        <StatCard
          label="Volume (30 days)"
          value={stats.totalVolumeLast30Days.toLocaleString()}
          subtext="lbs × reps"
        />
      </div>

      {/* Weekly activity */}
      {weeklyData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
            Weekly Activity
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
            Workouts and total volume over time
          </p>
          <div className="h-48 sm:h-56 md:h-64 -mx-2 sm:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData.slice(-12)}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  tickFormatter={(v) => {
                    const m = v.match(/Week of (\w+ \d+)/);
                    return m ? m[1] : v.slice(0, 10);
                  }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  label={{ value: "Sessions", angle: -90, position: "insideLeft", fontSize: 10 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                  label={{ value: "Volume", angle: 90, position: "insideRight", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    (name ?? "") === "sessions" ? (value ?? 0) : (value ?? 0).toLocaleString(),
                    (name ?? "") === "sessions" ? "Workouts" : "Volume",
                  ]}
                  labelFormatter={(label) => label}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="sessions"
                  stroke={chartColors.primary}
                  fill="url(#colorSessions)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalVolume"
                  stroke={chartColors.secondary}
                  strokeOpacity={0.8}
                  fill="transparent"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Workouts per week bar chart */}
      {weeklyData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
            Consistency
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
            Workouts per week
          </p>
          <div className="h-40 sm:h-48 -mx-2 sm:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData.slice(-8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "currentColor" }}
                  tickFormatter={(v) => {
                    const m = v.match(/Week of (\w+ \d+)/);
                    return m ? m[1] : v.slice(0, 8);
                  }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="sessions" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Strength progression - top exercises */}
      {hasStrengthGoal && exerciseProgress.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
            Strength Progression
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
            Heaviest weight used per workout for your top exercises
          </p>
          <div className="space-y-4 sm:space-y-6">
            {exerciseProgress.slice(0, 3).map((ex) => (
              <div key={ex.exerciseId}>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                  {ex.exerciseName}
                </p>
                <div className="h-36 sm:h-40 -mx-2 sm:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ex.dataPoints}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "currentColor" }}
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        label={{ value: "lbs", angle: 0, position: "insideTopRight", fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [`${value ?? 0} lbs`, "Weight"]}
                        labelFormatter={(label) =>
                          new Date(label).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="bestWeight"
                        stroke={chartColors.primary}
                        strokeWidth={2}
                        dot={{ fill: chartColors.primary, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {weeklyData.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center border border-gray-200 dark:border-gray-600">
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            No workout data yet
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Complete a few workouts to see your progress charts here.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow border border-gray-200 dark:border-gray-600">
      <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5 sm:mt-1">
        {value}
        {subtext && (
          <span className="text-xs sm:text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
            {subtext}
          </span>
        )}
      </p>
    </div>
  );
}
