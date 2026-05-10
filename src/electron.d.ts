export {};

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

declare global {
  interface Window {
    electron: {
      readDirectory: (path: string) => Promise<DirectoryEntry[] | { error: string }>;
      readFile: (path: string) => Promise<{ content?: string; error?: string }>;
      writeFile: (path: string, content: string) => Promise<{ success?: boolean; error?: string }>;
      deleteFile: (path: string) => Promise<{ success?: boolean; error?: string }>;
      selectDirectory: () => Promise<{ path?: string }>;
    };
  }
}
