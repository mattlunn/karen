export interface EinkPanel {
  id: string;
  width: number;
  height: number;
  // Implementations return their own cached render; null before the first one.
  renderPng(): Buffer | null;
  renderJson(): unknown;
}

const panels = new Map<string, EinkPanel>();

export function registerPanel(panel: EinkPanel): void {
  if (panels.has(panel.id)) {
    throw new Error(`Eink panel "${panel.id}" is already registered`);
  }

  panels.set(panel.id, panel);
}

export function getPanel(id: string): EinkPanel | undefined {
  return panels.get(id);
}
