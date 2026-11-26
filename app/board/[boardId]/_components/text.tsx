"use client";

import dynamic from "next/dynamic";
import localFont from "next/font/local";
import { useState } from "react";
import { colorToCss } from "@/lib/utils";
import { displayRichText } from "@/lib/rich-text";
import type { TextLayer } from "@/types/canvas";
import { useMutation } from "@/hooks/use-local-board";

const RichTextEditor = dynamic(() => import("./rich-text-editor").then(module => module.RichTextEditor), { ssr: false });
const inter = localFont({ src: "../../../../public/fonts/inter-latin.woff2", variable: "--font-inter" });
const kalam = localFont({ src: "../../../../public/fonts/kalam-latin.woff2", variable: "--font-kalam" });
const sourceSerif = localFont({ src: "../../../../public/fonts/source-serif-4-latin.woff2", variable: "--font-source-serif" });
const jetbrains = localFont({ src: "../../../../public/fonts/jetbrains-mono-latin.woff2", variable: "--font-jetbrains" });

interface TextProps {
    id: string;
    layer: TextLayer;
    onPointerDown: (e: React.PointerEvent, id: string) => void;
    selectionColor?: string;
}

const calculateFontSize = (width: number, height: number) => Math.min(96, height * 0.5, width * 0.5);

export const Text = ({ id, layer, onPointerDown, selectionColor }: TextProps) => {
    const { x, y, width, height, fill, value } = layer;
    const [editing, setEditing] = useState(false);
    const updateValue = useMutation(({ storage }, newValue: string) => storage.get("layers").get(id)?.set("value", newValue), []);
    const content = displayRichText(value);
    const fontClasses = `${inter.variable} ${kalam.variable} ${sourceSerif.variable} ${jetbrains.variable}`;
    const textStyle = { color: fill ? colorToCss(fill) : "#000", fontSize: calculateFontSize(width, height), fontFamily: "var(--font-kalam)" };

    return (
        <foreignObject x={x} y={y} width={width} height={height} className={fontClasses}
            onPointerDown={event => editing ? event.stopPropagation() : onPointerDown(event, id)}
            onDoubleClick={event => { event.stopPropagation(); setEditing(true); }}
            style={{ outline: selectionColor ? `1px solid ${selectionColor}` : "none" }}>
            {editing ? <RichTextEditor value={value} onChange={updateValue} color={textStyle.color} className="min-h-0 flex-1" style={textStyle} onDone={() => setEditing(false)} /> :
                <div role="textbox" aria-label="Board text" aria-readonly="true" tabIndex={0}
                    className="h-full w-full flex items-center justify-center drop-shadow-md outline-none overflow-hidden"
                    style={textStyle} dangerouslySetInnerHTML={{ __html: content.html || "Text" }} />}
        </foreignObject>
    );
};
