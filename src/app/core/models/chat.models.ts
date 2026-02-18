/**
 * Represents a single message in the chat conversation
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;

  /** Role of the message sender */
  role: 'user' | 'assistant';

  /** Message content in markdown format */
  content: string;

  /** Timestamp when the message was created */
  timestamp: Date;

  /** Whether the message is currently being streamed */
  isStreaming: boolean;

  /** Tool calls made by the agent (for transparency) */
  toolCalls: ToolCallInfo[] | null;
}

/**
 * Information about a tool call made by the agent
 */
export interface ToolCallInfo {
  /** Name of the tool that was called */
  toolName: string;

  /** Current status of the tool call */
  status: 'running' | 'complete' | 'error';

  /** Time taken to execute the tool (in milliseconds) */
  executionTimeMs?: number;

  /** Arguments passed to the tool */
  arguments?: Record<string, any>;

  /** Result returned by the tool */
  result?: any;
}
