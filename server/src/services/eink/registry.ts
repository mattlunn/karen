export interface EinkPanel {
  id: string;
  width: number;
  height: number;
  // Both read whatever the panel's own cron last rendered - neither computes
  // on the request path, so a slow render never holds up the HTTP response.
  renderPng(): Buffer;
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
