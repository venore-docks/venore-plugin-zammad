import { resolveRequester } from "../../shared/requester";
import { downloadAttachment } from "./service";
import type { DownloadAttachmentInput, DownloadAttachmentResult } from "./types";

export async function downloadAttachmentHandler(input: DownloadAttachmentInput): Promise<DownloadAttachmentResult> {
  const requester = await resolveRequester();
  if (!requester.success) return requester;
  return downloadAttachment(requester.data, input);
}
