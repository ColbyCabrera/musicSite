import Note from './note';
import { getNotes } from '@/app/lib/data';

export default async function Notes({
  entity,
  entityId,
  visibility,
}: {
  entity: string;
  entityId: number;
  visibility: 'public' | 'internal';
}) {
  const notes = await getNotes(entity, entityId, visibility);

  if (notes.length === 0) {
    return <span className="text-muted-foreground">No notes yet</span>;
  }

  return notes.map((note) => {
    return (
      <div key={note.id}>
        <Note note={note} />
      </div>
    );
  });
}
