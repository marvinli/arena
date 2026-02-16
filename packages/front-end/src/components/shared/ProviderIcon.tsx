import { getCharacterImage } from "../../characterImages";

export function CharacterAvatar({
  name,
  style,
}: {
  name: string;
  style?: React.CSSProperties;
}) {
  const src = getCharacterImage(name);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={name}
      style={{ width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
}
