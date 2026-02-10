import Claude from "@lobehub/icons/es/Claude";
import DeepSeek from "@lobehub/icons/es/DeepSeek";
import Gemini from "@lobehub/icons/es/Gemini";
import Grok from "@lobehub/icons/es/Grok";
import Meta from "@lobehub/icons/es/Meta";
import Mistral from "@lobehub/icons/es/Mistral";
import Nova from "@lobehub/icons/es/Nova";
import OpenAI from "@lobehub/icons/es/OpenAI";
import Qwen from "@lobehub/icons/es/Qwen";

export const BRAND_COLORS: Record<string, string> = {
  anthropic: "#D97757",
  openai: "#E0E0E0",
  google: "#F94543",
  xai: "#B4B4B4",
  deepseek: "#4D6BFE",
  meta: "#1d65c1",
  mistral: "#FA520F",
  nova: "#8B5CF6",
  qwen: "#615ced",
};

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
  if (avatar === "deepseek") return <DeepSeek.Color style={style} />;
  if (avatar === "meta") return <Meta.Color style={style} />;
  if (avatar === "mistral") return <Mistral.Color style={style} />;
  if (avatar === "nova") return <Nova.Color style={style} />;
  if (avatar === "qwen") return <Qwen.Color style={style} />;
  return <Claude.Color style={style} />;
}
