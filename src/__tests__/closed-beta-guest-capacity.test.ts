import { describe, expect, it, vi } from "vitest";
import {
  assertClosedBetaGuestSlot,
  ClosedBetaGuestCapacityError,
} from "../lib/closed-beta/service";

function clientFor({ activeGuests, pendingInvites }: { activeGuests: number; pendingInvites: number }) {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "config",
          status: "active",
          max_primary_workspaces: 30,
          max_guests_per_workspace: 3,
          plan_id: "plan",
        },
      ])
      .mockResolvedValueOnce([{ id: "enrollment", owner_profile_id: "owner" }]),
    closedBetaEnrollment: {},
    closedBetaConfig: {},
    invite: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(pendingInvites),
    },
    profile: {
      count: vi.fn().mockResolvedValue(activeGuests),
    },
  } as never;
}

describe("Closed Beta guest capacity seam", () => {
  it("rejects a fourth active or pending guest", async () => {
    await expect(
      assertClosedBetaGuestSlot(
        clientFor({ activeGuests: 1, pendingInvites: 2 }),
        "workspace-1",
      ),
    ).rejects.toBeInstanceOf(ClosedBetaGuestCapacityError);
  });

  it("allows a pending guest to accept by excluding its reservation", async () => {
    const client = clientFor({ activeGuests: 1, pendingInvites: 1 });

    await expect(
      assertClosedBetaGuestSlot(client, "workspace-1", "invite-1"),
    ).resolves.toMatchObject({ activeGuests: 1, pendingInvites: 1 });
  });
});
