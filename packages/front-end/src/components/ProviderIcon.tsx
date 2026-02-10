import Claude from "@lobehub/icons/es/Claude";
import Gemini from "@lobehub/icons/es/Gemini";
import Grok from "@lobehub/icons/es/Grok";
import OpenAI from "@lobehub/icons/es/OpenAI";

export function ProviderIcon({
  avatar,
  style,
}: {
  avatar: string;
  style?: React.CSSProperties;
}) {
  if (avatar === "openai") return <OpenAI style={style} />;
  if (avatar === "google") return <Gemini.Color style={style} />;
  if (avatar === "xai") return <Grok style={style} />;
  return <Claude.Color style={style} />;
}
