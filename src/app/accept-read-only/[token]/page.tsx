import {
  acceptReadOnlyAccess,
  ReadOnlyAccessExpiredError,
  ReadOnlyAccessNotFoundError,
  ReadOnlyAccessUsedError,
} from "@/lib/admin/read-only-service";

export const dynamic = "force-dynamic";

function Message({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}

export default async function AcceptReadOnlyAccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let result;
  try {
    result = await acceptReadOnlyAccess(token);
  } catch (error) {
    if (error instanceof ReadOnlyAccessUsedError) {
      return (
        <Message
          title="Link already used"
          body={error.message}
        />
      );
    }
    if (error instanceof ReadOnlyAccessExpiredError) {
      return (
        <Message
          title="Link expired"
          body={error.message}
        />
      );
    }
    if (error instanceof ReadOnlyAccessNotFoundError) {
      return (
        <Message
          title="Invalid link"
          body={error.message}
        />
      );
    }
    throw error;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold">Read-only access granted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Read-only access to <span className="font-medium text-foreground">{result.workspaceName}</span>{" "}
          was granted for {result.email}. The link was marked as used.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Note: read-only access is validated by this token at acceptance time.
          A full read-only session (cookie flag + data views) is not implemented
          yet — see the T-038 acceptance note.
        </p>
      </div>
    </main>
  );
}
