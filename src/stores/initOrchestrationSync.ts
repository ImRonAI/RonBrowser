/**
 * Orchestration Synchronization Initialization
 *
 * Sets up listeners to sync agentStore streaming events with orchestrationStore.
 * Call this once during app initialization to enable orchestration visualization.
 */

import { useAgentStore } from './agentStore';
import { useOrchestrationStore } from './orchestrationStore';

let isInitialized = false;

/**
 * Initializes the synchronization between agentStore and orchestrationStore.
 * Should be called once during app startup.
 *
 * This sets up listeners that:
 * 1. Map streaming events to orchestration node updates
 * 2. Track active agents during execution
 * 3. Clear streaming data when agents complete
 *
 * @returns Cleanup function to remove listeners
 */
export function initOrchestrationSync(): () => void {
  if (isInitialized) {
    console.warn('Orchestration sync already initialized');
    return () => {};
  }

  isInitialized = true;

  // Subscribe to agentStore changes
  const unsubscribe = useAgentStore.subscribe((state, prevState) => {
    // For now, we use a simplified agent ID.
    // In production, this should come from proper agent identification.
    const agentId = 'default-agent';

    // Sync current tool use
    if (state.currentToolUse !== prevState.currentToolUse && state.currentToolUse) {
      useOrchestrationStore.getState().syncStreamingData(agentId, {
        tools: [
          {
            id: state.currentToolUse.id || `tool-${Date.now()}`,
            name: state.currentToolUse.name || 'unknown',
            status: 'running',
            input: state.currentToolUse.input,
          },
        ],
      });
    }

    // Sync streaming message as reasoning
    if (
      state.currentStreamingMessage !== prevState.currentStreamingMessage &&
      state.currentStreamingMessage
    ) {
      useOrchestrationStore.getState().syncStreamingData(agentId, {
        reasoning: {
          content: state.currentStreamingMessage,
        },
      });
    }

    // Mark agent as active when streaming starts
    if (state.isStreaming && !prevState.isStreaming) {
      useOrchestrationStore.getState().setActiveAgents([agentId]);
    }

    // Clear streaming data when agent completes
    if (!state.isStreaming && prevState.isStreaming) {
      useOrchestrationStore.getState().clearStreamingData(agentId);
      useOrchestrationStore.getState().setActiveAgents([]);
    }
  });

  console.log('[OrchestrationSync] Initialization complete');

  // Return cleanup function
  return () => {
    unsubscribe();
    isInitialized = false;
    console.log('[OrchestrationSync] Cleanup complete');
  };
}

/**
 * Alternative approach: Manual sync for explicit control.
 * Call this when you want to manually sync a specific agent's streaming state.
 *
 * @param agentId The agent ID to sync
 */
export function syncAgentStreamingState(agentId: string) {
  const agentState = useAgentStore.getState();
  const orchestrationState = useOrchestrationStore.getState();

  // Build streaming data from current agent state
  const streamingData = {
    reasoning: agentState.currentStreamingMessage
      ? { content: agentState.currentStreamingMessage }
      : undefined,
    tools: agentState.currentToolUse
      ? [
          {
            id: agentState.currentToolUse.id || `tool-${Date.now()}`,
            name: agentState.currentToolUse.name || 'unknown',
            status: 'running' as const,
            input: agentState.currentToolUse.input,
          },
        ]
      : undefined,
    // chainOfThought and images would be extracted from messages
  };

  orchestrationState.syncStreamingData(agentId, streamingData);

  // Mark as active if streaming
  if (agentState.isStreaming) {
    orchestrationState.setActiveAgents([agentId]);
  }
}
