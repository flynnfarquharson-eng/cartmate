"use client";

export default function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200";
  const variants = {
    primary: disabled
      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
      : "bg-primary text-white active:bg-primary-dark shadow-sm",
    secondary:
      "bg-white text-gray-700 border border-gray-200 active:bg-gray-50",
    danger: "bg-red-50 text-red-600 active:bg-red-100",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
