"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@venore/plugin-sdk/ui";
import { reloadSchemaAction } from "./actions";

export function ReloadSchemaButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await reloadSchemaAction();
          if (result.ok) toast.success("Campos recarregados do Zammad.");
          else toast.error(result.error);
        })
      }
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
      {pending ? "Recarregando…" : "Recarregar do Zammad"}
    </Button>
  );
}
