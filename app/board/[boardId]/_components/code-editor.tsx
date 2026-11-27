"use client";

import { useEffect, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";

interface CodeEditorProps {
    value: string;
    fontSize: number;
    showLineNumbers: boolean;
    onChange: (value: string) => void;
}

export function CodeEditor({ value, fontSize, showLineNumbers, onChange }: CodeEditorProps) {
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    const latest = useRef({ value, fontSize, showLineNumbers, onChange });
    latest.current = { value, fontSize, showLineNumbers, onChange };

    useEffect(() => {
        if (!host.current) return;
        const editor = new EditorView({
            parent: host.current,
            doc: latest.current.value,
            extensions: [
                    basicSetup,
                    javascript({ typescript: true }),
                    EditorView.updateListener.of(update => {
                        if (update.docChanged) latest.current.onChange(update.state.doc.toString());
                    }),
                    EditorView.domEventHandlers({
                        keydown(event, editor) {
                            if (event.key !== "Tab") return false;
                            event.preventDefault();
                            editor.dispatch(editor.state.replaceSelection("\t"));
                            return true;
                        },
                    }),
                    EditorView.theme({
                        "&": { height: "100%", fontSize: "var(--code-font-size)" },
                        ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-jetbrains), monospace" },
                        ".cm-content": { padding: "8px 0" },
                        ".cm-gutters": { backgroundColor: "transparent", border: "none" },
                    }),
                ],
        });
        view.current = editor;
        editor.dom.querySelector<HTMLElement>(".cm-gutters")!.style.display = latest.current.showLineNumbers ? "" : "none";
        return () => {
            editor.destroy();
            view.current = null;
        };
    }, []);

    useEffect(() => {
        const gutters = view.current?.dom.querySelector<HTMLElement>(".cm-gutters");
        if (gutters) gutters.style.display = showLineNumbers ? "" : "none";
    }, [showLineNumbers]);

    useEffect(() => {
        const editor = view.current;
        if (!editor) return;
        const current = editor.state.doc.toString();
        if (current !== value) editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }, [value]);

    useEffect(() => {
        host.current?.style.setProperty("--code-font-size", `${fontSize}px`);
    }, [fontSize]);

    return <div ref={host} className="h-full w-full overflow-hidden" aria-label="Code editor" />;
}
