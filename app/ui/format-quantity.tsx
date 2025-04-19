export default function formatQuantity(
  quantity: number,
  descriptor: string,
  pluralDescriptor: string,
) {
  return (
    <div className="flex max-w-96 gap-1">
      <p className="font-semibold">{quantity}</p>
      <p className="text-muted-foreground">
        {quantity === 1 ? descriptor : pluralDescriptor}
      </p>
    </div>
  );
}
