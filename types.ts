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

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface ProcessedFileHistory {
  id: string;
  fileName: string;
  operation: 'ENCRYPT' | 'DECRYPT';
  timestamp: Date;
  status: 'SUCCESS' | 'FAILED';
}

export interface EncryptionConfig {
  password: string;
  salt?: Uint8Array; // For decryption, extracted from file
}
