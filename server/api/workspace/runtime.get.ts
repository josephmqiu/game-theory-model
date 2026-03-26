import { defineWebSocketHandler } from "h3";
import {
  closeWorkspaceRuntimeConnection,
  handleWorkspaceRuntimeMessage,
  openWorkspaceRuntimeConnection,
  recordWorkspaceRuntimeError,
} from "../../services/workspace/workspace-runtime-transport";

export default defineWebSocketHandler({
  open(peer) {
    openWorkspaceRuntimeConnection(peer);
  },
  async message(peer, message) {
    await handleWorkspaceRuntimeMessage(peer, message);
  },
  close(peer, details) {
    closeWorkspaceRuntimeConnection(peer, details);
  },
  error(peer, error) {
    recordWorkspaceRuntimeError(peer, error);
  },
});

