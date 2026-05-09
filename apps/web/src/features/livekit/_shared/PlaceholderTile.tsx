/**
 * LiveKit 미연결 또는 dev test placeholder용 빈 카드.
 * 부모가 width/height를 결정하면 그 안에 채워짐.
 */
export function PlaceholderTile({
  avatar,
  name,
}: {
  avatar: string;
  name: string;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border-2 border-felt-800/80 bg-felt-950 opacity-60">
      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-felt-900 to-felt-950">
        <span className="text-3xl grayscale">{avatar}</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
        <span className="truncate text-[11px] font-bold text-white">{name}</span>
      </div>
    </div>
  );
}
