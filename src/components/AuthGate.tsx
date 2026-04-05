"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/password") {
      setChecked(true);
      return;
    }

    const authed = localStorage.getItem("cartmate_auth") === "true";
    if (!authed) {
      router.replace("/password");
    } else {
      setChecked(true);
    }
  }, [pathname, router]);

  if (!checked) return null;

  return <>{children}</>;
}
