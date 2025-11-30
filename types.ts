
export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: LogLevel;
}

export interface CryptoProgress {
  percent: number;
  currentFile: string;
  bytesProcessed: number;
  totalBytes: number;
  speed: number; // MB/s
  eta: number; // Seconds remaining
}

export interface ProcessedResult {
  fileName: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  error?: string;
}

export interface AuthSession {
  password: string;
  keyFile: File | null;
  keyFileBuffer: ArrayBuffer | null;
}
