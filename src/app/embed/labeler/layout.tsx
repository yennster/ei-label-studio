export const dynamic = "force-dynamic";

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh w-full bg-white">{children}</div>;
}
