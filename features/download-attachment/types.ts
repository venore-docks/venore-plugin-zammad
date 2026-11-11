import type { OperationResult } from "@venore/plugin-sdk";

export type DownloadAttachmentInput = { ticketId: number; articleId: number; attachmentId: number };
export type AttachmentStream = {
  body: ReadableStream<Uint8Array> | null;
  contentType: string;
  filename: string;
  size: number | null;
  inline: boolean;
};
export type DownloadAttachmentResult = OperationResult<AttachmentStream>;
