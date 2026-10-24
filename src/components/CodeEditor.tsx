import { autocompletion, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  codeFolding,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting
} from "@codemirror/language";
import { clike } from "@codemirror/legacy-modes/mode/clike";
import { python } from "@codemirror/legacy-modes/mode/python";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
  type DecorationSet,
  type ViewUpdate
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

export type EditorLanguage = "json" | "html" | "xml" | "javascript" | "python" | "shell" | "java" | "text";

const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--syn-key)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--syn-string)" },
  { tag: [tags.number, tags.integer, tags.float], color: "var(--syn-number)" },
  { tag: [tags.bool, tags.atom, tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.modifier], color: "var(--syn-bool)" },
  { tag: tags.null, color: "var(--syn-null)" },
  { tag: [tags.punctuation, tags.bracket, tags.separator, tags.operator], color: "var(--syn-punct)" },
  { tag: [tags.tagName, tags.typeName, tags.className], color: "var(--syn-tag)" },
  { tag: [tags.attributeName, tags.variableName, tags.function(tags.variableName)], color: "var(--syn-attr)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.meta], color: "var(--syn-comment)", fontStyle: "italic" }
]);

function languageExtension(language: EditorLanguage): Extension {
  switch (language) {
    case "json":
      return json();
    case "html":
      return html();
    case "xml":
      return xml();
    case "javascript":
      return javascript();
    case "python":
      return StreamLanguage.define(python);
    case "shell":
      return StreamLanguage.define(shell);
    case "java":
      return StreamLanguage.define(clike({ name: "java", keywords: Object.fromEntries("import new public class static final void return throws".split(" ").map((k) => [k, true])) }));
    default:
      return [];
  }
}

/** Highlights {{variables}}: green when the active environment defines them, red otherwise. */
function variableHighlighter(isDefined: () => (name: string) => boolean) {
  const ok = Decoration.mark({ class: "cm-variable-ok" });
  const missing = Decoration.mark({ class: "cm-variable-missing" });
  const decorator = new MatchDecorator({
    regexp: /\{\{\s*([\w.-]+)\s*\}\}/g,
    decoration: (match) => (isDefined()(match[1]) ? ok : missing)
  });
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = decorator.createDeco(view);
      }
      update(update: ViewUpdate) {
        this.decorations = decorator.updateDeco(update, this.decorations);
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );
}

type Props = {
  value: string;
  onChange?: (value: string) => void;
  language: EditorLanguage;
  readOnly?: boolean;
  placeholder?: string;
  isVariableDefined?: (name: string) => boolean;
  wrap?: boolean;
};

export function CodeEditor({ value, onChange, language, readOnly = false, placeholder, isVariableDefined, wrap = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const definedRef = useRef(isVariableDefined ?? (() => true));
  const languageSlot = useRef(new Compartment());
  const wrapSlot = useRef(new Compartment());
  const syncing = useRef(false);
  onChangeRef.current = onChange;
  definedRef.current = isVariableDefined ?? (() => true);

  useEffect(() => {
    const extensions: Extension[] = [
      lineNumbers(),
      foldGutter({ openText: "▾", closedText: "▸" }),
      codeFolding(),
      drawSelection(),
      bracketMatching(),
      highlightSelectionMatches(),
      search({ top: true }),
      syntaxHighlighting(highlight),
      languageSlot.current.of(languageExtension(language)),
      wrapSlot.current.of(wrap ? EditorView.lineWrapping : []),
      EditorState.readOnly.of(readOnly),
      keymap.of([...searchKeymap, ...foldKeymap, ...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !syncing.current) onChangeRef.current?.(update.state.doc.toString());
      })
    ];
    if (readOnly) {
      extensions.push(EditorView.editable.of(false));
    } else {
      extensions.push(
        history(),
        indentOnInput(),
        closeBrackets(),
        autocompletion({ activateOnTyping: false }),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        keymap.of([...closeBracketsKeymap, indentWithTab]),
        variableHighlighter(() => definedRef.current)
      );
      if (placeholder) extensions.push(placeholderExt(placeholder));
    }

    view.current = new EditorView({
      parent: host.current!,
      state: EditorState.create({ doc: value, extensions })
    });
    return () => view.current?.destroy();
    // The editor is created once; value, language and wrap are synced by the effects below.
  }, [readOnly]);

  useEffect(() => {
    const current = view.current;
    if (current && current.state.doc.toString() !== value) {
      // Changes pushed in from outside should not echo back through onChange.
      syncing.current = true;
      current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: value } });
      syncing.current = false;
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: languageSlot.current.reconfigure(languageExtension(language)) });
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({ effects: wrapSlot.current.reconfigure(wrap ? EditorView.lineWrapping : []) });
  }, [wrap]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
