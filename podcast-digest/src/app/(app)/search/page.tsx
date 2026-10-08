import { redirect } from "next/navigation";

// Search now lives at the top of Discover.
export default function SearchPage() {
  redirect("/discover");
}
