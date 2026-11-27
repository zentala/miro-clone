"use client";

import { Extension } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decodeRichText, encodeRichText, legacyText, type RichTextDocument } from "@/lib/rich-text";

const FontSize = Extension.create({
    name: "fontSize",
    addGlobalAttributes() {
        return [{ types: ["textStyle"], attributes: {
            fontSize: {
                default: null,
                parseHTML: element => element.style.fontSize || null,
                renderHTML: attributes => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
            },
        } }];
    },
});

const extensions = [StarterKit, TextStyle, Color, FontFamily, FontSize];
const FONT_OPTIONS = [
    ["Inter", "var(--font-inter)"], ["Kalam", "var(--font-kalam)"],
    ["Source Serif 4", "var(--font-source-serif)"], ["JetBrains Mono", "var(--font-jetbrains)"],
];

function initialContent(value: string | undefined): RichTextDocument {
    return decodeRichText(value) ?? { type: "doc", content: [{ type: "paragraph", content: legacyText(value)
        ? [{ type: "text", text: legacyText(value) }]
        : [] }] };
}

interface RichTextEditorProps {
    value?: string;
    onChange: (value: string) => void;
    color: string;
    className: string;
    style?: React.CSSProperties;
    onDone: () => void;
}

export function RichTextEditor({ value, onChange, color, className, style, onDone }: RichTextEditorProps) {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
    const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
    const editor = useEditor({
        extensions,
        content: initialContent(value),
        immediatelyRender: false,
        editorProps: {
            attributes: { class: "h-full w-full overflow-auto outline-none", "aria-label": "Board text" },
            handleDOMEvents: { keydown: (_view, event) => { event.stopPropagation(); return false; } },
        },
        onUpdate: ({ editor: current }) => onChange(encodeRichText(current.getJSON())),
    });

    useEffect(() => {
        if (!editor) return;
        const next = initialContent(value);
        if (encodeRichText(editor.getJSON()) !== encodeRichText(next)) editor.commands.setContent(next, { emitUpdate: false });
    }, [editor, value]);

    useEffect(() => {
        editor?.commands.focus();
    }, [editor]);

    useLayoutEffect(() => {
        setPortalHost(document.querySelector<HTMLElement>('[data-canvas-overlay="rich-text-toolbar"]'));
    }, []);

    useLayoutEffect(() => {
        if (!editor || !portalHost) return;
        const updatePosition = () => {
            const anchor = editorContainerRef.current?.getBoundingClientRect();
            const toolbar = toolbarRef.current?.getBoundingClientRect();
            if (!anchor || !toolbar) return;

            const margin = 8;
            const maxLeft = Math.max(margin, window.innerWidth - toolbar.width - margin);
            const left = Math.min(Math.max(margin, anchor.left + (anchor.width - toolbar.width) / 2), maxLeft);
            let top = anchor.top - toolbar.height - margin;
            if (top < margin) top = Math.min(anchor.bottom + margin, Math.max(margin, window.innerHeight - toolbar.height - margin));
            setToolbarPosition(current => current && Math.abs(current.top - top) < 0.5 && Math.abs(current.left - left) < 0.5
                ? current
                : { top, left });
        };
        const observer = new ResizeObserver(updatePosition);
        if (editorContainerRef.current) observer.observe(editorContainerRef.current);
        if (toolbarRef.current) observer.observe(toolbarRef.current);
        const updateAfterWheel = () => requestAnimationFrame(updatePosition);
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("wheel", updateAfterWheel, true);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("wheel", updateAfterWheel, true);
        };
    }, [editor, portalHost]);

    if (!editor) return null;
    const command = (run: () => void) => (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        editor.commands.focus();
        run();
    };
    const preserveSelection = (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault();
    const explicitSize = editor.getAttributes("textStyle").fontSize;
    const inheritedSize = style?.fontSize;
    const currentSize = explicitSize?.replace("px", "") ?? (typeof inheritedSize === "number"
        ? String(inheritedSize)
        : inheritedSize?.replace("px", "") ?? "24");

    const toolbar = portalHost ? createPortal(
        <div
            ref={toolbarRef}
            className="fixed z-50 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 shadow-sm select-none"
            style={{
                top: toolbarPosition?.top ?? 0,
                left: toolbarPosition?.left ?? 0,
                maxWidth: "calc(100vw - 16px)",
                maxHeight: "calc(100vh - 16px)",
                overflowY: "auto",
                visibility: toolbarPosition ? "visible" : "hidden",
                pointerEvents: "auto",
            }}
            onPointerDown={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
        >
                <select aria-label="Font family" className="h-10 max-w-40 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={editor.getAttributes("textStyle").fontFamily ?? "var(--font-kalam)"}
                    onChange={event => editor.chain().focus().setFontFamily(event.target.value).run()}>
                    {FONT_OPTIONS.map(([label, value]) => <option key={label} value={value}>{label}</option>)}
                </select>
                <Input aria-label="Font size" className="w-20" type="number" min="8" max="120" value={currentSize}
                    onChange={event => {
                        const size = Math.max(8, Math.min(120, Number(event.target.value) || 24));
                        editor.chain().focus().setMark("textStyle", { fontSize: `${size}px` }).run();
                    }} />
                <Button type="button" variant="board" size="icon" aria-label="Bold" aria-pressed={editor.isActive("bold")} className="font-bold"
                    onMouseDown={preserveSelection} onClick={command(() => editor.chain().toggleBold().run())}>B</Button>
                <Button type="button" variant="board" size="icon" aria-label="Italic" aria-pressed={editor.isActive("italic")} className="italic"
                    onMouseDown={preserveSelection} onClick={command(() => editor.chain().toggleItalic().run())}>I</Button>
                <Input aria-label="Text color" title="Text color" className="w-10 cursor-pointer p-1" type="color" value={editor.getAttributes("textStyle").color ?? color}
                    onChange={event => editor.chain().focus().setColor(event.target.value).run()} />
                <Button type="button" variant="board" onMouseDown={preserveSelection} onClick={command(onDone)} className="ml-auto">Done</Button>
        </div>,
        portalHost
    ) : null;

    return (
        <div ref={editorContainerRef} className="h-full w-full flex flex-col" onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
            <EditorContent editor={editor} className={className} style={style} />
            {toolbar}
        </div>
    );
}
