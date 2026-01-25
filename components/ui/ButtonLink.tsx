import Link, { LinkProps } from "next/link";
import { cn } from "@/lib/utils";
import { ButtonVariant, ButtonSize } from "./Button";

export interface ButtonLinkProps extends Omit<LinkProps, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}

const ButtonLink = ({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) => {
  const baseStyles =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variants = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
    secondary:
      "bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
    purple: "bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500",
    ghost:
      "text-gray-700 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800",
    outline:
      "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <Link
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        // Force text color for dark buttons to override any inherited colors
        variant !== "ghost" && variant !== "outline" && "!text-white",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
};

export default ButtonLink;
