import dynamic from "next/dynamic";

const MediatorPanelClient = dynamic(() => import("./MediatorPanelClient"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[50vh] items-center justify-center p-6 text-sm text-muted-foreground"
    >
      Loading dispute panel…
    </div>
  ),
});

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MediatorPanelClient disputeId={id} />;
}