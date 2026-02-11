import { Injectable, inject } from '@angular/core';
import { HttpAgent } from '@ag-ui/client';
import { BaseEvent } from '@ag-ui/core';
import { ChatStateService } from './chat-state.service';
import { SharedStateService } from './shared-state.service';
import { A2UIEventService } from './a2ui-event.service';
import { environment } from '../../../environments/environment';

/**
 * AgUiService
 *
 * Wraps @ag-ui/client HttpAgent and bridges AG-UI events to Angular signals.
 * Orchestrates all agent communication via SSE streaming.
 *
 * CRITICAL SERVICE: All agent interactions flow through here.
 */
@Injectable({
  providedIn: 'root',
})
export class AgUiService {
  private chatState = inject(ChatStateService);
  private sharedState = inject(SharedStateService);
  private a2uiEventService = inject(A2UIEventService);

  private agent: HttpAgent;
  private streamTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly STREAM_TIMEOUT_MS = 180_000; // 3 minutes

  constructor() {
    // Initialize the HttpAgent with backend endpoint and thread ID
    this.agent = new HttpAgent({
      url: `${environment.apiUrl}${environment.agentEndpoint}`,
      threadId: 'default-thread', // Will be updated with actual session ID
    });
  }

  /**
   * Run the agent with current messages and shared state
   * Uses HttpAgent from @ag-ui/client to handle request formatting
   */
  async runAgent(): Promise<void> {
    try {
      // Update agent's thread ID with current session
      const sessionId = this.chatState.sessionId() || `session-${Date.now()}`;
      this.agent = new HttpAgent({
        url: `${environment.apiUrl}${environment.agentEndpoint}`,
        threadId: sessionId,
        initialMessages: this.chatState
          .messages()
          .filter((msg) => msg.role === 'user')
          .slice(-environment.maxMessageHistory)
          .map((msg, index) => ({
            id: msg.id || `msg-${index}`,
            role: 'user' as const,
            content: [{ type: 'text' as const, text: msg.content }],
          })),
        initialState: this.sharedState.agentContext(),
      });

      // Start streaming
      this.chatState.isStreaming.set(true);

      // Set stream timeout to prevent infinite hangs
      this.streamTimeout = setTimeout(() => {
        console.warn(`Agent stream timeout after ${this.STREAM_TIMEOUT_MS / 1000}s, aborting`);
        this.cancel();
        this.chatState.setError('Agent response timed out — please try again');
      }, this.STREAM_TIMEOUT_MS);

      // Run agent with subscriber for events
      await this.agent.runAgent(
        {
          runId: `run-${Date.now()}`,
          tools: [],
          context: [],
          forwardedProps: {},
        },
        {
          onEvent: ({ event }) => {
            this.handleEvent(event);
          },
          onRunFailed: ({ error }) => {
            this.clearStreamTimeout();
            // Suppress noisy AGUIError and user-initiated aborts
            const msg = error?.message || '';
            if (msg.includes('The run has already errored') || msg.includes('aborted')) {
              return;
            }
            console.error('Agent error:', error);
            this.chatState.setError(msg || 'Failed to connect to agent');
            this.chatState.isStreaming.set(false);
          },
          onRunFinalized: () => {
            this.clearStreamTimeout();
            console.log('Agent stream complete');
            this.chatState.finalizeStreamingMessage();
            this.chatState.isStreaming.set(false);
          },
        }
      );
    } catch (error: any) {
      this.clearStreamTimeout();
      // Suppress noisy AGUIError when library sends RUN_FINISHED after RUN_ERROR
      const msg = error?.message || '';
      if (msg.includes('The run has already errored')) {
        return;
      }
      console.error('Agent error:', error);
      this.chatState.setError(msg || 'Failed to connect to agent');
      this.chatState.isStreaming.set(false);
    }
  }

  /**
   * Clear the stream timeout if active
   */
  private clearStreamTimeout(): void {
    if (this.streamTimeout) {
      clearTimeout(this.streamTimeout);
      this.streamTimeout = null;
    }
  }

  /**
   * Cancel the current agent stream
   */
  cancel(): void {
    this.clearStreamTimeout();
    this.agent.abortRun();
    this.chatState.finalizeStreamingMessage();
    this.chatState.isStreaming.set(false);
  }

  /**
   * Handle individual AG-UI events from the agent
   */
  private handleEvent(event: BaseEvent): void {
    console.log('AG-UI Event:', event.type, event);

    switch (event.type) {
      case 'RUN_STARTED':
        this.chatState.isStreaming.set(true);
        break;

      case 'TEXT_MESSAGE_START':
        this.chatState.startAssistantMessage();
        break;

      case 'TEXT_MESSAGE_CONTENT':
        // Events use 'delta' property, not 'content'
        if ('delta' in event && typeof event['delta'] === 'string') {
          this.chatState.appendStreamingContent(event['delta']);
        }
        break;

      case 'TEXT_MESSAGE_END':
        // Check if the completed message is raw chart JSON (not meant for display).
        // We must read the accumulated content from the messages array, NOT from
        // currentStreamingMessage(), because appendStreamingContent() creates new
        // objects in the messages array while currentStreamingMessage still holds
        // the original object with content: ''.
        const streamingMsg = this.chatState.currentStreamingMessage();
        if (streamingMsg) {
          const actualMessage = this.chatState
            .messages()
            .find((m) => m.id === streamingMsg.id);
          if (
            actualMessage &&
            this.isChartJsonContent(actualMessage.content)
          ) {
            // Remove this message - it's chart config, not a user-facing response
            this.chatState.removeMessage(streamingMsg.id);
            this.chatState.currentStreamingMessage.set(null);
            this.chatState.isStreaming.set(false);
          } else {
            this.chatState.finalizeStreamingMessage();
          }
        } else {
          this.chatState.finalizeStreamingMessage();
        }
        break;

      case 'TOOL_CALL_START':
        // Events use 'toolCallName' property, not 'toolName'
        if ('toolCallName' in event) {
          this.chatState.addToolCall({
            toolName: String(event['toolCallName']),
            status: 'running',
          });
        }
        break;

      case 'TOOL_CALL_ARGS':
        // Events use 'toolCallName' property, not 'toolName'
        if ('toolCallName' in event && 'args' in event) {
          this.chatState.addToolCall({
            toolName: String(event['toolCallName']),
            status: 'running',
            arguments: event['args'] as Record<string, any>,
          });
        }
        break;

      case 'TOOL_CALL_END':
        // Events use 'toolCallName' property, not 'toolName'
        if ('toolCallName' in event) {
          this.chatState.addToolCall({
            toolName: String(event['toolCallName']),
            status: 'complete',
            executionTimeMs: 'executionTimeMs' in event ? Number(event['executionTimeMs']) : undefined,
          });
        }
        break;

      case 'TOOL_CALL_RESULT':
        // Handle tool call results - check for A2UI payload in content
        if ('content' in event && event['content']) {
          const content = event['content'];

          // Content is typically a JSON string, so parse it first
          try {
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;

            // Check if this is an A2UI visualization payload
            // Backend returns: {a2ui: true, surfaceId: "...", messages: [{beginRendering: ...}, {surfaceUpdate: ...}, ...]}
            if (parsed && parsed.a2ui === true && parsed.surfaceId && parsed.messages && Array.isArray(parsed.messages)) {
              console.log('A2UI visualization detected:', parsed.surfaceId);
              console.log('A2UI messages from backend:', parsed.messages);

              // Pass the messages directly to the A2UIEventService
              // The MessageProcessor will handle them properly
              this.a2uiEventService.handleA2UIMessages(parsed.surfaceId, parsed.messages);
            }
          } catch (e) {
            // Not JSON or not A2UI payload - ignore
            console.debug('Non-JSON tool result:', content);
          }
        }
        break;

      case 'STATE_DELTA':
        if ('delta' in event && event['delta']) {
          this.sharedState.applyJsonPatch(event['delta'] as any);
        }
        break;

      case 'STATE_SNAPSHOT':
        // Handle full state snapshots
        if ('state' in event && event['state']) {
          // For now, just log it - we could update the full context if needed
          console.log('State snapshot received:', event['state']);
        }
        break;

      case 'CUSTOM':
        if ('name' in event && event['name'] === 'a2ui_surface_update' && 'data' in event) {
          const data = event['data'] as any;
          // Check if this is the new message format
          if (data && data.surfaceId && data.messages && Array.isArray(data.messages)) {
            this.a2uiEventService.handleA2UIMessages(data.surfaceId, data.messages);
          }
        }
        break;

      case 'RUN_FINISHED':
        this.chatState.isStreaming.set(false);
        break;

      case 'RUN_ERROR':
        // Suppress user-initiated abort — not an actual error
        if (('code' in event && event['code'] === 'abort') ||
            ('message' in event && String(event['message']).includes('aborted'))) {
          break;
        }
        // Finalize any in-progress streaming message before setting error
        if (this.chatState.currentStreamingMessage()) {
          this.chatState.finalizeStreamingMessage();
        }
        const errorMessage =
          'error' in event && typeof event['error'] === 'string'
            ? event['error']
            : 'Agent error';
        this.chatState.setError(errorMessage);
        this.chatState.isStreaming.set(false);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }
  }

  /**
   * Detect if message content is raw chart JSON config (not user-facing text).
   * Handles both pure JSON and content where JSON is wrapped with minor
   * surrounding text or markdown fences.
   */
  private isChartJsonContent(content: string): boolean {
    if (!content || !content.trim()) return false;

    const jsonCandidate = this.extractJsonObject(content);
    if (!jsonCandidate) return false;

    try {
      const parsed = JSON.parse(jsonCandidate);
      if (!parsed || typeof parsed !== 'object') return false;

      // Chart configuration: has chart_type/graphType + data keys
      if (
        ('chart_type' in parsed || 'graphType' in parsed) &&
        ('labels' in parsed || 'datasets' in parsed || 'data' in parsed)
      ) {
        return true;
      }

      // Chart reference map: all keys match "chart-XXXX" pattern with string values
      const keys = Object.keys(parsed);
      if (
        keys.length > 0 &&
        keys.every((k) => /^chart-/.test(k) && typeof parsed[k] === 'string')
      ) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Extract a JSON object string from content that may have surrounding text.
   * Returns the JSON substring if found, or null.
   */
  private extractJsonObject(content: string): string | null {
    let trimmed = content.trim();

    // Pure JSON case (most common)
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    // Strip markdown code fences: ```json ... ``` or ``` ... ```
    const fenceMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (fenceMatch) {
      return fenceMatch[1].trim();
    }

    // Find the outermost { ... } in the content
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.substring(firstBrace, lastBrace + 1);
    }

    return null;
  }
}
