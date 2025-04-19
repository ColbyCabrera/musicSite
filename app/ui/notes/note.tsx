'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '../shadcn/lib/utils';
import { Note } from '@/app/lib/definitions';
import { deleteNoteById } from '@/app/lib/actions';
import { Button } from '../shadcn/components/ui/button';
import { MouseEvent, useEffect, useState } from 'react';
import { toast } from '../shadcn/components/ui/use-toast';
import { NewspaperIcon } from '@heroicons/react/24/outline';
import { get24hrTime, to12hrTimeString, trimText } from '@/app/lib/utils';

type FileInfo = {
  pathname: string;
  url: string;
};

export default function Note({ note }: { note: Note }) {
  const [clicked, setClicked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    setDate(
      new Date(note.date_created).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      }),
    );
    const time24hr = get24hrTime(note.date_created);
    const formattedTime = to12hrTimeString(time24hr);
    setTime(formattedTime);
  }, []);

  function onNoteClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    // If delete button or file clicked, don't close for better UX
    if (
      target.id !== `note-delete-button${note.id}` &&
      !target.className.includes('file')
    ) {
      setClicked(!clicked);
    }
  }

  // Parse files from JSON if they exist in the note
  const files = note.files ? JSON.parse(note.files) : [];
  const imageTypes = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  const images = files.filter((file: FileInfo) => {
    const ext = file.pathname
      .toLowerCase()
      .substring(file.pathname.lastIndexOf('.'));
    return imageTypes.has(ext);
  });
  const nonImageFiles = files.filter((file: FileInfo) => {
    const ext = file.pathname
      .toLowerCase()
      .substring(file.pathname.lastIndexOf('.'));
    return !imageTypes.has(ext); // Filter out files *not* in the imageTypes set
  });

  function FileList() {
    return nonImageFiles.map((file: FileInfo, index: number) => (
      <div key={index} className="text-xs text-blue-600 underline">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="file flex w-fit items-center gap-2"
        >
          <NewspaperIcon className="pointer-events-none h-5 min-w-5" />
          <p className="file max-w-none overflow-hidden text-nowrap text-ellipsis">
            {file.pathname}
          </p>
        </a>
      </div>
    ));
  }

  function ImagesDisplay() {
    return (
      <div className="flex gap-2.5 overflow-x-auto pt-4 pb-0.5 empty:hidden">
        {images.map((image: FileInfo) => (
          <Link
            href={image.url}
            key={image.url}
            className="h-16 w-16 shrink-0 scroll-p-1"
          >
            <img
              src={image.url}
              alt=""
              className="h-full w-full rounded-lg object-cover transition-all hover:scale-105"
            />
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col rounded-lg py-2 pr-4 transition-all hover:bg-blue-50 hover:pr-2 hover:pl-2"
      onClick={onNoteClick}
      onBlur={(event: React.FocusEvent<HTMLElement>) => {
        const relatedTarget = event.relatedTarget as HTMLElement;

        // Use related target to get to get element where focused moved to.
        // Use optional chaining to safely access 'relatedTarget' properties, as it can be null.
        if (
          relatedTarget?.id === `note-delete-button${note.id}` ||
          relatedTarget?.className.includes('file')
        ) {
          return;
        }

        setClicked(false);
      }}
      tabIndex={-1}
    >
      <div className="flex items-center gap-2">
        {note.author && <p className="font-medium">{note.author}</p>}
        {date ? (
          <p className="text-muted-foreground text-xs">{`${date} ${time}`}</p>
        ) : (
          <div className="mb-1 h-3 w-28 animate-pulse rounded-lg bg-slate-100"></div>
        )}
      </div>

      <p className="overflow-hidden text-ellipsis whitespace-pre-wrap">{note.text}</p>
      <div className="mt-2 flex flex-col gap-1 empty:hidden">
        <FileList />
      </div>

      <ImagesDisplay />

      <Button
        id={`note-delete-button${note.id}`}
        className={cn('h-0 w-fit overflow-hidden py-0 transition-all', {
          'mt-2 h-9 py-2': clicked,
        })}
        variant="destructive"
        onClick={async () => {
          setLoading(true);
          if (note.entity_id) {
            await deleteNoteById(note.id);
            toast({
              title: 'Note deleted',
              description: trimText(note.text, 40),
            });
          }
        }}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Deleting...
          </>
        ) : (
          'Delete'
        )}
      </Button>
    </div>
  );
}
