"use client";

import { Download } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@venore/plugin-sdk/ui";

// Miniatura que abre a imagem grande sobre a página (lightbox), sem sair da conversa.
export function ImageLightbox({ src, filename }: { src: string; filename: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title={filename}
          aria-label={`Ampliar ${filename}`}
          className="block cursor-zoom-in overflow-hidden rounded-lg border bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={filename} loading="lazy" className="max-h-40 w-auto max-w-full object-cover" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-auto max-w-[calc(100%-2rem)] gap-3 p-3 sm:max-w-[min(90vw,64rem)]">
        <DialogTitle className="truncate pe-10 text-sm font-medium">{filename}</DialogTitle>
        <DialogDescription className="sr-only">Imagem anexada ao chamado, em tamanho ampliado.</DialogDescription>
        <div className="flex max-h-[76vh] items-center justify-center overflow-auto rounded-lg bg-muted/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={filename} className="max-h-[76vh] w-auto max-w-full object-contain" />
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <a href={src} download={filename}>
              <Download className="size-3.5" />
              Baixar
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
