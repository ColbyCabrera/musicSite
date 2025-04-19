import Tag from './tag';

export default function TagsDisplay({
  tags,
  selected,
  onChange,
}: {
  tags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  if (tags[0] === null || tags[0] === undefined) {
    return null;
  } else {
    return tags.map((tag: string | null, index) => {
      if (tag === null) return;
      return (
        <Tag tag={tag} selected={selected} onChange={onChange} key={index} />
      );
    });
  }
}
