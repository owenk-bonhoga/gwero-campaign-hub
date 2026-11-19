import { validateContract } from "./input-contract";
import { createServerFn } from "@tanstack/react-start";
import { permissionMiddleware } from "./auth.middleware";
import type { DocumentAccessLevel, ManagedAttachment } from "./documents.types";

const documentPermission = permissionMiddleware("documents.manage");

export const getDocumentWorkspace = createServerFn({ method: "GET" })
  .middleware([documentPermission])
  .handler(async ({ context }) => {
    const { getDocumentWorkspaceServer } = await import("./documents.server");
    return getDocumentWorkspaceServer(context.user);
  });

export const createDocumentCategory = createServerFn({ method: "POST" })
  .middleware([documentPermission])
  .validator((data: { name: string; description?: string; color?: string }) =>
    validateContract(data, "createDocumentCategory"),
  )
  .handler(async ({ data, context }) => {
    const { createDocumentCategoryServer } = await import("./documents.server");
    return createDocumentCategoryServer(data, context.user);
  });

export const createManagedDocument = createServerFn({ method: "POST" })
  .middleware([documentPermission])
  .validator(
    (data: {
      id: string;
      title: string;
      categoryId?: string;
      ownerId?: string;
      entityType?: string;
      entityId?: string;
      issueDate?: string;
      expiryDate?: string;
      notes?: string;
      attachment: ManagedAttachment;
      versionNotes?: string;
    }) => validateContract(data, "createManagedDocument"),
  )
  .handler(async ({ data, context }) => {
    const { createDocumentServer } = await import("./documents.server");
    return createDocumentServer(data, context.user);
  });

export const addManagedDocumentVersion = createServerFn({ method: "POST" })
  .middleware([documentPermission])
  .validator((data: { documentId: string; attachment: ManagedAttachment; notes?: string }) =>
    validateContract(data, "addManagedDocumentVersion"),
  )
  .handler(async ({ data, context }) => {
    const { addDocumentVersionServer } = await import("./documents.server");
    return addDocumentVersionServer(data, context.user);
  });

export const updateManagedDocument = createServerFn({ method: "POST" })
  .middleware([documentPermission])
  .validator(
    (data: {
      id: string;
      title: string;
      categoryId?: string;
      ownerId?: string;
      status?: string;
      entityType?: string;
      issueDate?: string;
      expiryDate?: string;
      notes?: string;
    }) => validateContract(data, "updateManagedDocument"),
  )
  .handler(async ({ data, context }) => {
    const { updateDocumentServer } = await import("./documents.server");
    return updateDocumentServer(data, context.user);
  });

export const setManagedDocumentAccess = createServerFn({ method: "POST" })
  .middleware([documentPermission])
  .validator(
    (data: {
      documentId: string;
      grants: Array<{ userId: string; accessLevel: DocumentAccessLevel }>;
    }) => validateContract(data, "setManagedDocumentAccess"),
  )
  .handler(async ({ data, context }) => {
    const { setDocumentAccessServer } = await import("./documents.server");
    return setDocumentAccessServer(data, context.user);
  });
