export default function BlurTransition({
  position,
}: {
  position?: 'top' | 'bottom';
}) {
  return (
    <>
      {position === 'bottom' ? (
        <div className="relative">
          {/* Top gradient for smooth transition */}
          <div className="absolute z-10 h-4 w-full bg-linear-to-t from-white to-transparent"></div>

          {/* Main blur area with refined gradient */}
          <div className="absolute h-4 w-full backdrop-blur-xs [mask-image:linear-gradient(to_bottom,transparent,white)]"></div>
        </div>
      ) : (
        <div className="relative">
          {/* Top gradient for smooth transition */}
          <div className="absolute z-10 h-4 w-full bg-linear-to-b from-white to-transparent"></div>

          {/* Main blur area with refined gradient */}
          <div className="absolute h-4 w-full backdrop-blur-xs [mask-image:linear-gradient(to_top,transparent,white)]"></div>
        </div>
      )}
    </>
  );
}
