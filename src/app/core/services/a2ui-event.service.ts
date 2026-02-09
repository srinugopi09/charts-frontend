import { Injectable, signal, inject, computed, Injector, OnDestroy } from '@angular/core';
import { MessageProcessor } from '@a2ui/angular';
import { Subscription } from 'rxjs';
import { ChatStateService } from './chat-state.service';
import { AgUiService } from './ag-ui.service';
import { SharedStateService } from './shared-state.service';
import { FEATURE_FLAGS } from '../config/feature-flags';

/**
 * A2UIEventService
 *
 * Bridges AG-UI custom events to A2UI Angular renderer with fallback strategy.
 * Validates A2UI payloads against the registered catalog.
 */
@Injectable({
  providedIn: 'root',
})
export class A2UIEventService implements OnDestroy {
  private messageProcessor = inject(MessageProcessor);
  private injector = inject(Injector);
  private eventsSubscription: Subscription;

  constructor() {
    // Subscribe to A2UI events from the MessageProcessor
    this.eventsSubscription = this.messageProcessor.events.subscribe((event) => {
      console.log('MessageProcessor event:', event);

      // Always complete the event to prevent MessageProcessor from hanging
      try {
        // Check if this is a user action (e.g., chart click)
        if (!FEATURE_FLAGS.DRILL_DOWN_ENABLED) {
          return;
        }
        if (event.message && event.message.userAction) {
          const userAction = event.message.userAction;
          console.log('User action detected:', userAction);
          console.log('Context type:', typeof userAction.context, 'isArray:', Array.isArray(userAction.context));
          console.log('Context value:', JSON.stringify(userAction.context, null, 2));

          // Build action object from the userAction
          // The context can be either:
          // 1. An array of {key, value} pairs (A2UI spec format)
          // 2. A flat object (A2UI library auto-transforms arrays to objects)
          const contextProps: any = {};

          if (Array.isArray(userAction.context)) {
            console.log('Parsing context array with', userAction.context.length, 'items');
            for (const item of userAction.context) {
              console.log('Context item:', item);
              if (item.key && item.value) {
                // Extract the actual value from the literal wrapper
                const actualValue = item.value.literalString
                  ?? item.value.literalNumber
                  ?? item.value.literalBoolean
                  ?? item.value.path;
                console.log(`Extracted ${item.key} =`, actualValue);
                contextProps[item.key] = actualValue;
              }
            }
          } else if (typeof userAction.context === 'object' && userAction.context !== null) {
            // Context is already a flat object - A2UI library auto-transformed it
            console.log('Context is already a flat object, using directly');
            Object.assign(contextProps, userAction.context);
          }
          console.log('Final contextProps:', contextProps);

          const action = {
            type: userAction.name,
            actionType: userAction.name,
            surfaceId: userAction.surfaceId,
            sourceComponentId: userAction.sourceComponentId,
            timestamp: userAction.timestamp,
            ...contextProps, // Spread the parsed context properties (label, value, datasetLabel)
          };

          console.log('Action to handle:', action);

          // Handle the action
          this.handleA2UIAction(action);
        }
      } finally {
        // Complete the event on every path (required by MessageProcessor)
        event.completion.next([]);
        event.completion.complete();
      }
    });
  }

  ngOnDestroy(): void {
    this.eventsSubscription.unsubscribe();
  }

  // Core signals - currentSurfaceId tracks which surface to display
  readonly currentSurfaceId = signal<string | null>(null);
  readonly catalogValidationError = signal<string | null>(null);

  // Computed signal that gets the actual surface from the processor
  readonly currentSurface = computed(() => {
    const surfaceId = this.currentSurfaceId();
    if (!surfaceId) return null;

    const surfaces = this.messageProcessor.getSurfaces();
    return surfaces.get(surfaceId) || null;
  });

  readonly thumbnailSurface = computed(() => this.currentSurface());

  /**
   * Handle A2UI messages from the backend.
   *
   * Backend sends its own format:
   *   { beginRendering: {root, surfaceId} }
   *   { updateComponents: { components: [ {id, component: "Graph", ...props} ] } }
   *
   * We transform this into proper A2UI ServerToClientMessage format:
   *   { beginRendering: {root, surfaceId} }
   *   { surfaceUpdate:  { surfaceId, components: [ {id, component: {Graph: {...props}}} ] } }
   *
   * Then feed it to MessageProcessor.processMessages() which builds the
   * resolved component tree automatically.
   */
  handleA2UIMessages(surfaceId: string, messages: any[]): void {
    console.log('A2UIEventService.handleA2UIMessages called with:', { surfaceId, messages });

    try {
      // 1. Extract updateComponents (required)
      const updateMsg = messages.find((m: any) => 'updateComponents' in m);
      if (!updateMsg?.updateComponents?.components?.length) {
        console.error('No updateComponents message found');
        return;
      }

      // Flatten backend components into A2UI ComponentInstance format
      const a2uiComponents: any[] = [];
      for (const backendComp of updateMsg.updateComponents.components) {
        this.flattenBackendComponent(backendComp, a2uiComponents);
      }

      // Determine root component ID: prefer beginRendering.root,
      // fall back to first backend component's id
      const beginMsg = messages.find((m: any) => 'beginRendering' in m);
      const rootId =
        beginMsg?.beginRendering?.root ??
        beginMsg?.beginRendering?.rootComponentId ??
        updateMsg.updateComponents.components[0].id;

      console.log('A2UI transform:', { rootId, components: a2uiComponents });

      // 2. Build proper ServerToClientMessage array
      //    IMPORTANT: surfaceUpdate MUST come before beginRendering so components
      //    are registered before the tree is built. Actually, beginRendering must
      //    come first to create the surface, but processMessages calls
      //    rebuildComponentTree after each message. So we send surfaceUpdate first
      //    (it creates the surface + registers components), then beginRendering
      //    (sets root + triggers final tree build).
      //    OR: send both in correct order - beginRendering first, surfaceUpdate second.
      //    The processor calls rebuildComponentTree after surfaceUpdate too, which
      //    will find the root because components are now registered.
      const a2uiMessages: any[] = [
        {
          beginRendering: {
            surfaceId,
            root: rootId,
          },
        },
        {
          surfaceUpdate: {
            surfaceId,
            components: a2uiComponents,
          },
        },
      ];

      // 3. Feed properly formatted messages to the MessageProcessor
      this.messageProcessor.processMessages(a2uiMessages);

      // 4. Update the current surface ID (triggers computed signal)
      this.currentSurfaceId.set(surfaceId);

      console.log('Surface set via processMessages, componentTree type:',
        this.currentSurface()?.componentTree?.['type']);
      this.catalogValidationError.set(null);
    } catch (error: any) {
      console.error('Failed to process A2UI messages:', error);
      console.error('Error stack:', error.stack);
      this.catalogValidationError.set(error.message || 'Failed to process visualization');
    }
  }

  /**
   * Transform a backend component into A2UI ComponentInstance format and
   * recursively flatten any nested children into separate ComponentInstance entries.
   *
   * Backend format (flat):
   *   { id: "root", component: "CompositeDashboard", title: "...", children: { kpis: [...], charts: [...] } }
   *
   * A2UI format (nested key = type):
   *   { id: "root", component: { CompositeDashboard: { title: "...", children: { explicitList: [...] } } } }
   *
   * Children are extracted, given their own ComponentInstance entries, and
   * referenced via explicitList IDs.
   */
  private flattenBackendComponent(backendComp: any, result: any[]): void {
    const { id, component: componentType, children, ...props } = backendComp;

    // Collect child IDs if this component has nested children
    const childIds: string[] = [];

    if (children && typeof children === 'object') {
      // children can be:
      // - An object with category keys: { kpis: [...], charts: [...] }
      // - An array of child components: [{ id, component, ... }, ...]
      const childComponents: any[] = [];

      if (Array.isArray(children)) {
        childComponents.push(...children);
      } else {
        // Object with category keys — flatten all arrays
        for (const category of Object.values(children)) {
          if (Array.isArray(category)) {
            childComponents.push(...category);
          }
        }
      }

      // Recursively flatten each child component
      for (const child of childComponents) {
        if (child && child.id && child.component) {
          childIds.push(child.id);
          this.flattenBackendComponent(child, result);
        }
      }
    }

    // Build the A2UI ComponentInstance
    const componentProps: any = { ...props };

    // Replace raw children with ComponentArrayReference if we have child IDs
    if (childIds.length > 0) {
      componentProps.children = { explicitList: childIds };
    }

    result.push({
      id,
      component: {
        [componentType]: componentProps,
      },
    });
  }

  /**
   * Clear all surfaces
   */
  clearSurface(): void {
    this.messageProcessor.clearSurfaces();
    this.currentSurfaceId.set(null);
    this.catalogValidationError.set(null);
  }

  /**
   * Handle A2UI action events (drill-downs, detail requests)
   * Generates natural language follow-up messages and triggers agent
   */
  async handleA2UIAction(action: any): Promise<void> {
    let message = '';
    let filterContext: any = {};

    // Generate message based on action type
    switch (action.actionType || action.type) {
      case 'drill_down':
        if (action.label && action.value !== undefined) {
          message = `Show details for ${action.label}`;
          if (action.datasetLabel) {
            message += ` from ${action.datasetLabel}`;
          }
          filterContext = {
            drillDownLabel: action.label,
            drillDownValue: action.value,
            drillDownDataset: action.datasetLabel,
          };
        } else if (action.row) {
          // Table row drill-down
          const firstValue = Object.values(action.row)[0];
          message = `Show details for ${firstValue}`;
          filterContext = {
            drillDownRow: action.row,
          };
        }
        break;

      case 'detail_request':
        message = `Tell me more about ${action.label || 'this item'}`;
        filterContext = {
          detailRequest: action.label,
        };
        break;

      default:
        console.warn('Unknown A2UI action type:', action.actionType || action.type);
        return;
    }

    if (!message) return;

    console.log('A2UI action generated message:', message, 'Context:', filterContext);

    // Lazy inject services to avoid circular dependencies
    const chatState = this.injector.get(ChatStateService);
    const sharedState = this.injector.get(SharedStateService);
    const agUiService = this.injector.get(AgUiService);

    // Update shared state with drill-down context
    if (Object.keys(filterContext).length > 0) {
      sharedState.updateContext({
        activeFilters: filterContext,
      });
    }

    // Add user message and trigger agent
    chatState.addUserMessage(message);

    try {
      await agUiService.runAgent();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to process drill-down';
      console.error('Failed to run agent after drill-down:', error);
      chatState.setError(errorMsg);
    }
  }
}
