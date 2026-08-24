declare module '*/config/automations.json' {
  const automations: {
    name: string;
    parameters?: Record<string, unknown>;
  }[];

  export default automations;
}
