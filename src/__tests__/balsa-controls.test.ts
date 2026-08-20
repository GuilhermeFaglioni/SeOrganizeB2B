import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

describe("Balsa control compatibility seams", () => {
  it("keeps legacy Button variants, loading and link composition accessible", () => {
    const button = renderToStaticMarkup(
      createElement(Button, { variant: "destructive", loading: true }, "Delete"),
    );
    const link = renderToStaticMarkup(
      createElement(
        Button,
        { asChild: true, variant: "outline" },
        createElement("a", { href: "/plans" }, "Plans"),
      ),
    );

    expect(button).toContain('data-balsa="button"');
    expect(button).toContain('aria-busy="true"');
    expect(button).toContain("disabled");
    expect(link).toContain('data-balsa="button"');
    expect(link).toContain('href="/plans"');
    expect(link).not.toContain("<button");
  });

  it("accepts the existing native Input contract", () => {
    const markup = renderToStaticMarkup(
      createElement(Input, {
        value: "Acme",
        onChange: () => undefined,
        placeholder: "Company",
      }),
    );

    expect(markup).toContain('data-balsa="input"');
    expect(markup).toContain('value="Acme"');
    expect(markup).toContain('placeholder="Company"');
  });

  it("keeps checkbox labels external when the legacy contract omits them", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "label",
        null,
        createElement(Checkbox, {
          checked: true,
          onCheckedChange: () => undefined,
        }),
        "Active",
      ),
    );

    expect(markup).toContain('data-balsa="checkbox-control"');
    expect(markup).toContain('data-state="checked"');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain("checked");
    expect(markup).toContain("Active");
  });

  it("preserves the compound Avatar consumer shape", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Avatar,
        null,
        createElement(AvatarImage, { src: "/avatar.png", alt: "Ana" }),
        createElement(AvatarFallback, null, "AN"),
      ),
    );

    expect(markup).toContain('data-balsa="avatar"');
    expect(markup).toContain('data-balsa="avatar-image"');
    expect(markup).toContain('alt="Ana"');
    expect(markup).toContain("AN");
  });

  it("maps legacy Badge variants onto the Balsa semantic recipe", () => {
    const markup = renderToStaticMarkup(
      createElement(Badge, { variant: "success" }, "Active"),
    );

    expect(markup).toContain('data-balsa="badge"');
    expect(markup).toContain('data-variant="soft"');
    expect(markup).toContain('data-color="success"');
    expect(markup).toContain("Active");
  });

  it("keeps compound Select consumers on the Balsa listbox seam", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Select,
        { value: "active", onValueChange: () => undefined },
        createElement(
          SelectTrigger,
          { "aria-label": "Status" },
          createElement(SelectValue, { placeholder: "Choose status" }),
        ),
        createElement(
          SelectContent,
          null,
          createElement(SelectItem, { value: "active" }, "Active"),
          createElement(SelectItem, { value: "archived" }, "Archived"),
        ),
      ),
    );

    expect(markup).toContain('data-balsa="select"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain("Active");
    expect(markup).toContain("Archived");
  });

  it("keeps Popover trigger composition on the official Popup primitive", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Popover,
        null,
        createElement(
          PopoverTrigger,
          { asChild: true },
          createElement("button", { type: "button", "aria-label": "Filters" }, "Filters"),
        ),
        createElement(PopoverContent, null, "Filter options"),
      ),
    );

    expect(markup).toContain('data-balsa="popup"');
    expect(markup).toContain('aria-label="Filters"');
  });

  it("keeps dropdown triggers unwrapped and checkbox callbacks on the Balsa menu", () => {
    const markup = renderToStaticMarkup(
      createElement(
        DropdownMenu,
        null,
        createElement(
          DropdownMenuTrigger,
          { asChild: true },
          createElement("button", { type: "button", "aria-label": "Actions" }, "Actions"),
        ),
        createElement(
          DropdownMenuContent,
          null,
          createElement(DropdownMenuItem, { onSelect: () => undefined }, "Edit"),
        ),
      ),
    );

    expect(markup).toContain('data-balsa="dropdown-menu"');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).not.toContain("<button><button");
  });

  it("keeps Dialog triggers and nested accessible metadata on the Modal seam", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Dialog,
        null,
        createElement(
          DialogTrigger,
          { asChild: true },
          createElement("button", { type: "button" }, "Open"),
        ),
        createElement(
          DialogContent,
          { "data-testid": "settings-dialog" },
          createElement(
            DialogHeader,
            null,
            createElement(DialogTitle, null, "Settings"),
            createElement(DialogDescription, null, "Manage settings"),
          ),
        ),
      ),
    );

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('data-testid="settings-dialog"');
    expect(markup).not.toContain("<button><button");
  });
});
