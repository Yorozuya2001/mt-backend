export type ImportError = {
  row: number | string;
  message: string;
};

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
};

export type ImportMode = 'merge' | 'replace';
