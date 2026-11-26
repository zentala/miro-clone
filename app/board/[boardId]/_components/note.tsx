"use client";

import dynamic from "next/dynamic";
import localFont from "next/font/local";
import { useState } from "react";
import { colorToCss, getContrastingTextColor } from "@/lib/utils";
import { displayRichText } from "@/lib/rich-text";
import type { NoteLayer } from "@/types/canvas";
import { useMutation } from "@/hooks/use-local-board";

const RichTextEditor = dynamic(() => import("./rich-text-editor").then(module => module.RichTextEditor), { ssr: false });
const inter = localFont({ src: "../../../../public/fonts/inter-latin.woff2", variable: "--font-inter" });
const kalam = localFont({ src: "../../../../public/fonts/kalam-latin.woff2", variable: "--font-kalam" });
const sourceSerif = localFont({ src: "../../../../public/fonts/source-serif-4-latin.woff2", variable: "--font-source-serif" });
const jetbrains = localFont({ src: "../../../../public/fonts/jetbrains-mono-latin.woff2", variable: "--font-jetbrains" });

interface NoteProps {
    id: string;
    layer: NoteLayer;
    onPointerDown: (e: React.PointerEvent, id: string) => void;
    selectionColor?: string;
}

const calculateFontSize = (width: number, height: number) => Math.min(96, height * 0.15, width * 0.15);

export const Note = ({ id, layer, onPointerDown, selectionColor }: NoteProps) => {
    const { x, y, width, height, fill, value } = layer;
    const [editing, setEditing] = useState(false);
    const updateValue = useMutation(({ storage }, newValue: string) => storage.get("layers").get(id)?.set("value", newValue), []);
    const content = displayRichText(value);
    const fontClasses = `${inter.variable} ${kalam.variable} ${sourceSerif.variable} ${jetbrains.variable}`;
    const textColor = fill ? getContrastingTextColor(fill) : "#fff";
    const textStyle = { color: textColor, fontSize: calculateFontSize(width, height), fontFamily: "var(--font-kalam)" };

    return (
        <foreignObject x={x} y={y} width={width} height={height} className={fontClasses}
            onPointerDown={event => editing ? event.stopPropagation() : onPointerDown(event, id)}
            onDoubleClick={event => { event.stopPropagation(); setEditing(true); }}
            style={{ outline: selectionColor ? `1px solid ${selectionColor}` : "none", backgroundColor: fill ? colorToCss(fill) : "#000" }}>
            {editing ? <RichTextEditor value={value} onChange={updateValue} color={textColor} className="min-h-0 flex-1" style={textStyle} onDone={() => setEditing(false)} /> :
                <div role="textbox" aria-label="Board note" aria-readonly="true" tabIndex={0}
                    className="h-full w-full flex items-center justify-center outline-none overflow-hidden"
                    style={textStyle} dangerouslySetInnerHTML={{ __html: content.html || "Text" }} />}
        </foreignObject>
    );
};
