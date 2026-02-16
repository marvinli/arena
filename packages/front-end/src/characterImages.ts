const modules = import.meta.glob("./assets/characters/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export function getCharacterImage(name: string): string {
  return modules[`./assets/characters/${name}.png`] ?? "";
}
