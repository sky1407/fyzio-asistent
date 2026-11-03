"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ConversationSummary } from "@/lib/server/conversations";
import { Markdown } from "@/components/markdown";
import { defaultPlanTitle } from "@/lib/plans/model";
import { loadConversations, loadMessages, removeConversation } from "./actions";
import { SavePlan } from "./save-plan";

export type PatientOption = { id: string; label: string };

type UiMessage = { id: string; role: "user" | "model"; content: string; stopped?: boolean };

type StreamBody =
  | { mode: "message"; conversationId: string | null; patientId: string | null; message: string }
  | { mode: "continue"; conversationId: string; partial: string };

const BOTTOM_THRESHOLD_PX = 48;

const QUICK_ACTIONS = [
  {
    label: "Rehabilitačný plán",
    prompt:
      "Navrhni rehabilitačný plán na 4 týždne rozdelený do fáz so zameraním na diagnózy, obmedzenia a typ práce pacienta.",
  },
  {
    label: "Tréning",
    prompt:
      "Navrhni kompenzačný tréningový plán na 1 týždeň (3–4 tréningy) s ohľadom na prácu, kondíciu a obmedzenia pacienta.",
  },
  {
    label: "Jedálniček",
    prompt:
      "Navrhni orientačný jedálniček na 1 deň (5 jedál) a všeobecné stravovacie odporúčania s ohľadom na BMI, ciele a pohybovú aktivitu pacienta.",
  },
  {
    label: "Zhrnutie a riziká",
    prompt:
      "Zhrň stav pacienta: hlavné problémy, rizikové faktory z práce a životného štýlu, na čo si dať pozor (kontraindikácie, varovné príznaky) a čo by sa mala terapeutka ešte opýtať.",
  },
] as const;

function errorMessage(error: unknown): string {
  if (error instanceof TypeError) return "Nepodarilo sa spojiť so serverom. Skontrolujte pripojenie.";
  return error instanceof Error ? error.message : "Nastala chyba. Skúste to znova.";
}

export function AssistantPanel({
  patients,
  initialPatientId,
}: {
  patients: PatientOption[];
  initialPatientId: string | null;
}) {
  const [patientId, setPatientId] = useState<string | null>(initialPatientId);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const openRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    loadConversations(patientId)
      .then((list) => {
        if (active) setConversations(list);
      })
      .catch(() => {
        if (active) setError("Históriu rozhovorov sa nepodarilo načítať.");
      });
    return () => {
      active = false;
    };
  }, [patientId, historyVersion]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element && stickToBottomRef.current) element.scrollTop = element.scrollHeight;
  }, [messages]);

  function onScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < BOTTOM_THRESHOLD_PX;
    stickToBottomRef.current = nearBottom;
    setAtBottom(nearBottom);
  }

  function scrollToBottom() {
    const element = scrollRef.current;
    stickToBottomRef.current = true;
    setAtBottom(true);
    element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }

  useEffect(() => () => abortRef.current?.abort(), []);

  function resetConversation() {
    abortRef.current?.abort();
    openRequestRef.current += 1;
    setConversationId(null);
    setMessages([]);
    setError(null);
    setHistoryOpen(false);
    setLoadingMessages(false);
    stickToBottomRef.current = true;
    setAtBottom(true);
  }

  function selectPatient(value: string) {
    resetConversation();
    setConversations([]);
    setPatientId(value || null);
  }

  async function openConversation(id: string) {
    resetConversation();
    const request = openRequestRef.current;
    setConversationId(id);
    setLoadingMessages(true);
    try {
      const loaded = await loadMessages(id);
      if (request === openRequestRef.current) setMessages(loaded);
    } catch {
      if (request === openRequestRef.current) setError("Rozhovor sa nepodarilo načítať.");
    } finally {
      if (request === openRequestRef.current) setLoadingMessages(false);
    }
  }

  async function deleteConversation(conversation: ConversationSummary) {
    if (!window.confirm(`Vymazať rozhovor „${conversation.title}“? Túto akciu nie je možné vrátiť.`)) return;
    try {
      await removeConversation(conversation.id);
      if (conversation.id === conversationId) resetConversation();
      setHistoryVersion((version) => version + 1);
    } catch {
      setError("Rozhovor sa nepodarilo vymazať.");
    }
  }

  async function streamInto(
    modelId: string,
    prefix: string,
    body: StreamBody,
    controller: AbortController,
    progress: { text: string },
  ): Promise<void> {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 401) throw new Error("Prihlásenie vypršalo. Obnovte stránku a prihláste sa znova.");
    if (!response.ok || !response.body) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "AI neodpovedala. Skúste to znova.");
    }

    const newConversationId = response.headers.get("X-Conversation-Id");
    if (newConversationId) setConversationId(newConversationId);

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      progress.text += value;
      const content = prefix + progress.text;
      setMessages((previous) => previous.map((item) => (item.id === modelId ? { ...item, content } : item)));
    }
  }

  function markStopped(modelId: string) {
    setMessages((previous) =>
      previous.map((item) => (item.id === modelId && item.content ? { ...item, stopped: true } : item)),
    );
  }

  function beginStream(): AbortController {
    const controller = new AbortController();
    abortRef.current = controller;
    stickToBottomRef.current = true;
    setAtBottom(true);
    setError(null);
    setStreaming(true);
    return controller;
  }

  function endStream(modelId: string, controller: AbortController) {
    setMessages((previous) => previous.filter((item) => item.id !== modelId || item.content !== ""));
    if (abortRef.current === controller) abortRef.current = null;
    setStreaming(false);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;

    const userId = crypto.randomUUID();
    const modelId = crypto.randomUUID();
    const progress = { text: "" };
    const controller = beginStream();
    setInput("");
    setMessages((previous) => [
      ...previous,
      { id: userId, role: "user", content: message },
      { id: modelId, role: "model", content: "" },
    ]);

    try {
      await streamInto(
        modelId,
        "",
        { mode: "message", conversationId, patientId: conversationId ? null : patientId, message },
        controller,
        progress,
      );
      if (!progress.text.trim()) setError("AI nevrátila žiadnu odpoveď. Skúste otázku preformulovať.");
      setHistoryVersion((version) => version + 1);
    } catch (caught) {
      if (controller.signal.aborted) {
        markStopped(modelId);
        setHistoryVersion((version) => version + 1);
      } else if (progress.text) {
        markStopped(modelId);
        setError("Odpoveď bola prerušená. Môžete pokračovať tlačidlom Pokračovať.");
      } else {
        setError(errorMessage(caught));
        setInput(message);
        setMessages((previous) => previous.filter((item) => item.id !== userId && item.id !== modelId));
      }
    } finally {
      endStream(modelId, controller);
    }
  }

  async function continueAnswer(modelId: string) {
    const target = messages.find((item) => item.id === modelId);
    if (!target || !conversationId || streaming) return;

    const progress = { text: "" };
    const controller = beginStream();
    setMessages((previous) => previous.map((item) => (item.id === modelId ? { ...item, stopped: false } : item)));

    try {
      await streamInto(
        modelId,
        target.content,
        { mode: "continue", conversationId, partial: target.content },
        controller,
        progress,
      );
      setHistoryVersion((version) => version + 1);
    } catch (caught) {
      markStopped(modelId);
      if (!controller.signal.aborted) {
        setError(progress.text ? "Odpoveď bola prerušená. Môžete pokračovať znova." : errorMessage(caught));
      }
    } finally {
      endStream(modelId, controller);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  }

  const selectedPatient = patients.find((patient) => patient.id === patientId) ?? null;

  function planTitleSource(answerIndex: number): string {
    const question = messages[answerIndex - 1];
    if (question?.role !== "user") return "";
    return QUICK_ACTIONS.find((action) => action.prompt === question.content)?.label ?? question.content;
  }

  return (
    <div className="card relative flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold whitespace-nowrap text-teal-800">AI asistent</h2>
        <button type="button" onClick={resetConversation} className="btn-secondary px-3 py-1.5 text-sm whitespace-nowrap">
          <span>
            + Nový<span className="hidden sm:inline"> rozhovor</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
          className="btn-secondary px-3 py-1.5 text-sm whitespace-nowrap"
        >
          História ({conversations.length})
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <span className="shrink-0 font-medium">Pacient:</span>
        <select
          value={patientId ?? ""}
          onChange={(event) => selectPatient(event.target.value)}
          className="field-input py-2"
          disabled={streaming}
        >
          <option value="">Všeobecná otázka (bez pacienta)</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.label}
            </option>
          ))}
        </select>
      </label>

      {historyOpen && (
        <div className="absolute inset-x-4 top-28 z-10 max-h-80 overflow-y-auto rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
          {conversations.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">
              {selectedPatient ? "S týmto pacientom zatiaľ nie sú žiadne rozhovory." : "Zatiaľ žiadne všeobecné rozhovory."}
            </p>
          ) : (
            <ul>
              {conversations.map((conversation) => (
                <li key={conversation.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openConversation(conversation.id)}
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left hover:bg-slate-50 ${
                      conversation.id === conversationId ? "bg-teal-50" : ""
                    }`}
                  >
                    <span className="block truncate text-sm font-medium">{conversation.title}</span>
                    <span className="block text-xs text-slate-500">{conversation.updated_label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteConversation(conversation)}
                    aria-label={`Vymazať rozhovor ${conversation.title}`}
                    className="rounded-lg px-2.5 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    Vymazať
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3"
          aria-live="polite"
        >
          {loadingMessages && <p className="text-sm text-slate-500">Načítavam rozhovor…</p>}
          {!loadingMessages && messages.length === 0 && (
            <div className="space-y-2 p-2 text-sm text-slate-600">
              <p>
                {selectedPatient
                  ? `Pýtajte sa na pacienta ${selectedPatient.label} alebo použite tlačidlá nižšie.`
                  : "Vyberte pacienta, aby AI poznala jeho údaje, alebo položte všeobecnú otázku."}
              </p>
              <p className="text-xs text-slate-500">
                Údaje pacienta sa do AI posielajú bez mena. Do správ nepíšte mená ani rodné čísla.
              </p>
            </div>
          )}
          {messages.map((message, index) =>
            message.role === "user" ? (
              <div key={message.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-teal-700 px-3.5 py-2 text-white">
                {message.content}
              </div>
            ) : (
              <div key={message.id} className="max-w-full rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                {message.content ? (
                  <Markdown text={message.content} />
                ) : (
                  <p className="animate-pulse text-sm text-slate-500">AI premýšľa…</p>
                )}
                {message.stopped && !streaming && conversationId && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <span className="text-sm text-slate-500">Odpoveď bola zastavená.</span>
                    <button
                      type="button"
                      onClick={() => void continueAnswer(message.id)}
                      className="rounded-full bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800"
                    >
                      Pokračovať
                    </button>
                  </div>
                )}
                {selectedPatient && message.content && !(streaming && index === messages.length - 1) && (
                  <SavePlan
                    patientId={selectedPatient.id}
                    content={message.content}
                    defaultTitle={defaultPlanTitle(planTitleSource(index))}
                  />
                )}
              </div>
            ),
          )}
        </div>
        {!atBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-700 px-3.5 py-1.5 text-sm font-semibold text-white shadow-lg hover:bg-teal-800"
          >
            ↓ Na koniec
          </button>
        )}
      </div>

      {selectedPatient && (
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={streaming || loadingMessages}
              onClick={() => void send(action.prompt)}
              className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={4000}
          placeholder="Napíšte otázku…"
          aria-label="Otázka pre AI asistenta"
          className="field-input resize-none"
          disabled={loadingMessages}
        />
        {streaming ? (
          <button type="button" onClick={() => abortRef.current?.abort()} className="btn-secondary shrink-0">
            Zastaviť
          </button>
        ) : (
          <button type="submit" disabled={!input.trim() || loadingMessages} className="btn-primary shrink-0">
            Odoslať
          </button>
        )}
      </form>
      <p className="text-center text-xs text-slate-400">
        <span className="hidden sm:inline">Enter odošle, Shift+Enter nový riadok · </span>AI sa môže mýliť. Návrhy vždy
        odborne posúďte.
      </p>
    </div>
  );
}
