import { SiteHeader } from "@/components/site-header";
import { Workspace } from "@/components/workspace";

export default function LabelPage() {
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <main className="flex min-h-0 flex-1 flex-col">
        <Workspace />
      </main>
    </div>
  );
}
