import { isSafeAvatar } from "../data/image";

function initials(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ name, foto, size = 36 }: { name: string; foto: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (foto && isSafeAvatar(foto)) {
    return <img className="avatar avatar-img" src={foto} alt="" width={size} height={size} style={style} />;
  }
  return (
    <span className="avatar" style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
