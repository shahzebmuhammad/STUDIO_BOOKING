"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { openStoredMedia } from "@/lib/prototype-data";

export default function LocalPhoto({ mediaId, alt, className, fallback }: { mediaId?: string; alt: string; className: string; fallback: ReactNode }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    if (!mediaId) return;
    let active = true;
    let objectUrl = "";
    openStoredMedia(mediaId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => { if (active) setSource(""); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);
  return source ? <Image className={className} src={source} alt={alt} width={160} height={160} unoptimized /> : <span className={className} aria-label={alt}>{fallback}</span>;
}
