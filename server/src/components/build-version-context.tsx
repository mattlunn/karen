import React, { createContext, useContext, useEffect, useState } from 'react';

const Ctx = createContext<string | null>(null);

let listener: ((v: string) => void) | null = null;

export function recordBuildVersion(version: string) {
  if (listener) {
    listener(version);
  }
}

export function BuildVersionProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    listener = setVersion;
    return () => {
      listener = null;
    };
  }, []);

  return <Ctx.Provider value={version}>{children}</Ctx.Provider>;
}

export function useBuildVersion() {
  return useContext(Ctx);
}
