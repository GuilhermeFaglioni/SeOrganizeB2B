export function getUnsubmittedAIStudioImageIds(
  uploadedImageIds: Iterable<string>,
  submittedImageIds: readonly string[],
): string[] {
  const submitted = new Set(submittedImageIds);
  return Array.from(new Set(uploadedImageIds)).filter((imageId) => !submitted.has(imageId));
}

export function getAIStudioCleanupImageIds(
  attachedImageIds: readonly string[],
  uploadedImageIds: Iterable<string>,
): string[] {
  return Array.from(new Set([
    ...attachedImageIds,
    ...uploadedImageIds,
  ]));
}

export interface AIStudioUploadRegistration {
  complete(imageId: string): void;
  fail(): void;
}

export function registerAIStudioUpload(input: {
  uploadId: string;
  controller: AbortController;
  pendingControllers: Set<AbortController>;
  uploadedImageIds: Set<string>;
}): AIStudioUploadRegistration {
  input.pendingControllers.add(input.controller);
  input.uploadedImageIds.add(input.uploadId);

  return {
    complete(imageId) {
      input.pendingControllers.delete(input.controller);
      input.uploadedImageIds.delete(input.uploadId);
      input.uploadedImageIds.add(imageId);
    },
    fail() {
      input.pendingControllers.delete(input.controller);
      input.uploadedImageIds.delete(input.uploadId);
    },
  };
}
