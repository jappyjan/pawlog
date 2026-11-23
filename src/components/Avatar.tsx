import { Dog as DogIcon } from "lucide-react";

export function DogAvatar({ url, name, size = "size-12" }: { url?: string | null; name: string; size?: string }) {
  return url ? (
    <img src={url} alt={name} className={`${size} shrink-0 rounded-full object-cover ring-2 ring-brand-soft`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink`} aria-hidden>
      <DogIcon className="size-1/2" />
    </span>
  );
}

const COLORS = ["bg-sky-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500"];
export function UserBadge({ name, id }: { name: string; id: string }) {
  const color = COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span className={`inline-grid size-5 place-items-center rounded-full text-[10px] font-bold text-white ${color}`} title={name}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
