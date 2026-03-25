import {
  defineEventHandler,
  getQuery,
  setResponseHeaders,
  setResponseStatus,
} from "h3";
import {
  getCommandReceipt,
  getCommandReceiptByReceiptId,
} from "../../services/command-handlers";

export default defineEventHandler((event) => {
  setResponseHeaders(event, { "Content-Type": "application/json" });

  const { commandId, receiptId } = getQuery(event) as {
    commandId?: string;
    receiptId?: string;
  };

  const normalizedCommandId = commandId?.trim();
  const normalizedReceiptId = receiptId?.trim();

  if (!normalizedCommandId && !normalizedReceiptId) {
    setResponseStatus(event, 400);
    return {
      error: "Missing required query parameter: commandId or receiptId",
    };
  }

  const byCommandId = normalizedCommandId
    ? getCommandReceipt(normalizedCommandId)
    : undefined;
  const byReceiptId = normalizedReceiptId
    ? getCommandReceiptByReceiptId(normalizedReceiptId)
    : undefined;

  if (
    byCommandId &&
    byReceiptId &&
    byCommandId.commandId !== byReceiptId.commandId
  ) {
    setResponseStatus(event, 409);
    return {
      error: "commandId and receiptId refer to different command receipts",
    };
  }

  const receipt = byCommandId ?? byReceiptId;
  if (!receipt) {
    setResponseStatus(event, 404);
    return { error: "Command receipt not found" };
  }

  return { receipt };
});
