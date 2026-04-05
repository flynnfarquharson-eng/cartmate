export default function Badge({
  variant,
  children,
}: {
  variant: "paid" | "pending";
  children: React.ReactNode;
}) {
  const styles =
    variant === "paid"
      ? "bg-green-100 text-green-800"
      : "bg-amber-100 text-amber-800";

  return (
    <span
      className={`${styles} text-xs font-medium px-2 py-0.5 rounded-full`}
    >
      {children}
    </span>
  );
}
