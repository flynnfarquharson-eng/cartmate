import Link from "next/link";
import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-24 sm:pb-8">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/feed" className="font-semibold tracking-tight">
            Podcast Digest
          </Link>
          <div className="hidden sm:block">
            <TabBar />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
      <div className="sm:hidden">
        <TabBar />
      </div>
    </div>
  );
}
