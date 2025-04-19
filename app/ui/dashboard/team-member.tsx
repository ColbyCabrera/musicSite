export default function TeamMember({
  teamMember,
}: {
  teamMember: string | null;
}) {
  return (
    <div className="mr-1 mt-1 w-fit rounded-lg bg-slate-100 px-2 py-1">
      <p className="text-sm text-muted-foreground">{teamMember}</p>
    </div>
  );
}
