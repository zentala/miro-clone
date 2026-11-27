"use client";

import dynamic from "next/dynamic";
import localFont from "next/font/local";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@/hooks/use-local-board";
import type { CodeLayer } from "@/types/canvas";
import { LocalObject } from "@/store/use-board-store";

const CodeEditor = dynamic(() => import("./code-editor").then(module => module.CodeEditor), { ssr: false });
const jetbrains = localFont({ src: "../../../../public/fonts/jetbrains-mono-latin.woff2", variable: "--font-jetbrains" });

interface CodeProps {
    id: string;
    layer: CodeLayer;
    onPointerDown: (event: React.PointerEvent, id: string) => void;
    selectionColor?: string;
}

export function Code({ id, layer, onPointerDown, selectionColor }: CodeProps) {
    const [editing, setEditing] = useState(false);
    const updateValue = useMutation(({ storage }, value: string) => storage.get("layers").get(id)?.set("value", value), []);
    const updateFontSize = useMutation(({ storage }, value: number) => {
        const target = storage.get("layers").get(id);
        if (target && "codeBlock" in target.value && target.value.codeBlock === true) {
            (target as LocalObject<CodeLayer>).set("fontSize", value);
        }
    }, []);
    const updateLineNumbers = useMutation(({ storage }, value: boolean) => {
        const target = storage.get("layers").get(id);
        if (target && "codeBlock" in target.value && target.value.codeBlock === true) {
            (target as LocalObject<CodeLayer>).set("showLineNumbers", value);
        }
    }, []);
    const value = layer.value ?? "";
    const lines = value.split("\n");

    return (
        <foreignObject x={layer.x} y={layer.y} width={layer.width} height={layer.height} className={jetbrains.variable}
            style={{ outline: selectionColor ? `1px solid ${selectionColor}` : "none" }}
            onPointerDown={event => editing ? event.stopPropagation() : onPointerDown(event, id)}
            onPointerUp={event => { if (editing) event.stopPropagation(); }}
            onDoubleClick={event => { event.stopPropagation(); setEditing(true); }}>
            <div className="h-full w-full overflow-hidden rounded border border-neutral-300 bg-white text-neutral-900" data-code-block="true">
                {editing ? <>
                    <div className="flex h-12 items-center gap-2 border-b bg-white px-2 text-xs" onPointerDown={event => event.stopPropagation()}>
                        <label className="flex items-center gap-1">Size
                            <Input aria-label="Code font size" type="number" min="8" max="48" value={layer.fontSize}
                                onChange={event => updateFontSize(Math.max(8, Math.min(48, Number(event.target.value) || 14)))}
                                className="h-10 w-14 px-1" />
                        </label>
                        <label className="flex items-center gap-1 whitespace-nowrap">
                            <input aria-label="Show line numbers" type="checkbox" className="h-4 w-4" checked={layer.showLineNumbers}
                                onChange={event => updateLineNumbers(event.target.checked)} />
                            Line numbers
                        </label>
                        <Button type="button" variant="board" aria-label="Finish code editing" onClick={() => setEditing(false)} className="ml-auto h-10 px-3">Done</Button>
                    </div>
                    <CodeEditor value={value} fontSize={layer.fontSize} showLineNumbers={layer.showLineNumbers} onChange={updateValue} />
                </> : <pre className="h-full overflow-auto p-2" style={{ fontSize: layer.fontSize, fontFamily: "var(--font-jetbrains), monospace" }}>
                    <code className="grid" style={{ gridTemplateColumns: layer.showLineNumbers ? "auto 1fr" : "1fr" }}>
                        {lines.map((line, index) => <span key={index} className="contents">
                            {layer.showLineNumbers && <span aria-hidden="true" className="select-none pr-3 text-right text-neutral-400">{index + 1}</span>}
                            <span>{line || " "}</span>
                        </span>)}
                    </code>
                </pre>}
            </div>
        </foreignObject>
    );
}
