"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { Reply } from "lucide-react";

// Mensagem que a pessoa escolheu responder ("Responder", como no WhatsApp). Estado compartilhado entre
// o botão em cada mensagem (servidor renderiza a lista) e a caixa de resposta lá embaixo.
// internal: a mensagem citada é uma nota interna (só pode ser citada em outra nota interna).
export type QuotedMessage = { articleId: number; author: string; preview: string; internal?: boolean };

type ReplyState = { quote: QuotedMessage | null; setQuote: (quote: QuotedMessage | null) => void };

const ReplyContext = createContext<ReplyState | null>(null);

export function ReplyProvider({ children }: { children: React.ReactNode }) {
  const [quote, setQuote] = useState<QuotedMessage | null>(null);
  const value = useMemo(() => ({ quote, setQuote }), [quote]);
  return <ReplyContext.Provider value={value}>{children}</ReplyContext.Provider>;
}

export function useReplyQuote(): ReplyState {
  const state = useContext(ReplyContext);
  if (!state) throw new Error("useReplyQuote precisa estar dentro de <ReplyProvider>.");
  return state;
}

export function ReplyToButton({ quote }: { quote: QuotedMessage }) {
  const { setQuote } = useReplyQuote();
  return (
    <button
      type="button"
      onClick={() => {
        setQuote(quote);
        // Leva a pessoa até a caixa de resposta e já deixa o cursor lá.
        document.getElementById("responder")?.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => document.getElementById("reply-message")?.focus({ preventScroll: true }), 350);
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label={`Responder a mensagem de ${quote.author}`}
    >
      <Reply className="size-3.5" />
      Responder
    </button>
  );
}
