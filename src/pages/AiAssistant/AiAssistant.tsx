import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheck,
  FaEdit,
  FaMicrophone,
  FaPaperPlane,
  FaTimes,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import { useSettings } from "../../hooks/useSettings";
import "./AiAssistant.css";

type ApiMessage = { role: "user" | "assistant"; content: any };
type Bubble = { id: string; role: "user" | "assistant"; text: string };

type Draft = {
  kind: "create_lesson" | "create_invoice";
  data: any;
  toolUseId?: string;
  assistantContent: any[];
};

export default function AiAssistant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { coachId, identityLoading } = useCoachIdentity();
  const { settings } = useSettings();

  const { data: coachRatesData } = useQuery({
    queryKey: ["coach-rates", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaches")
        .select("default_hourly_rate, custom_rates")
        .eq("id", coachId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!coachId,
  });

  const { data: coachStudents = [] } = useQuery({
    queryKey: ["coach-students", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_students")
        .select(`student_id, students(id, student_name)`)
        .eq("coach_id", coachId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId,
  });

  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, draft, sending]);

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript;
      if (transcript) sendText(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setMicSupported(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleListening() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setErrorMsg("");
      recognitionRef.current.start();
      setListening(true);
    }
  }

  function addBubble(role: "user" | "assistant", text: string) {
    setBubbles((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, role, text }]);
  }

  function pushAssistantConfirmation(text: string) {
    addBubble("assistant", text);
    setApiHistory((prev) => [...prev, { role: "assistant", content: text }]);
  }

  function localISOWithOffset() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    const offsetMin = -d.getTimezoneOffset();
    const offsetSign = offsetMin >= 0 ? "+" : "-";
    const offsetH = pad(Math.floor(Math.abs(offsetMin) / 60));
    const offsetM = pad(Math.abs(offsetMin) % 60);

    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
      `${offsetSign}${offsetH}:${offsetM}`
    );
  }

  function buildContext() {
    return {
      // Local wall-clock time with the local UTC offset already baked in, so
      // the assistant never has to convert UTC -> local itself (that's what
      // caused "tomorrow" to land a day late near midnight UTC).
      now: localISOWithOffset(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      students: coachStudents.map((link: any) => link.students?.student_name).filter(Boolean),
      defaultHourlyRate: coachRatesData?.default_hourly_rate ?? null,
      defaultLessonDuration: settings.defaultLessonDuration,
    };
  }

  async function callAssistant(history: ApiMessage[]) {
    const { data, error } = await supabase.functions.invoke("assistant", {
      body: { messages: history, context: buildContext() },
    });
    if (error) throw new Error(error.message);
    if (data?.type === "error") throw new Error(data.message || "Assistant error.");
    return data;
  }

  async function sendText(rawText: string) {
    const text = rawText.trim();
    if (!text || sending) return;
    setInputText("");
    setErrorMsg("");

    let nextHistory: ApiMessage[];

    if (editing && draft) {
      addBubble("user", text);
      nextHistory = [
        ...apiHistory,
        { role: "assistant", content: draft.assistantContent },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: draft.toolUseId,
              content: "Not confirmed yet — the user wants to make changes before saving.",
            },
            { type: "text", text },
          ],
        },
      ];
      setDraft(null);
      setEditing(false);
    } else {
      addBubble("user", text);
      nextHistory = [...apiHistory, { role: "user", content: text }];
    }

    setApiHistory(nextHistory);
    setSending(true);

    try {
      const data = await callAssistant(nextHistory);

      if (data.type === "draft") {
        const toolUseBlock = (data.assistantContent || []).find((b: any) => b.type === "tool_use");
        setDraft({
          kind: data.kind,
          data: data.data,
          toolUseId: toolUseBlock?.id,
          assistantContent: data.assistantContent,
        });
      } else {
        addBubble("assistant", data.text);
        setApiHistory((prev) => [...prev, { role: "assistant", content: data.assistantContent }]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function resolveStudentId(studentName: string): Promise<string> {
    const clean = studentName.trim();
    if (!clean || !coachId) throw new Error("Could not determine the student.");

    const existingLink = coachStudents.find(
      (link: any) => link.students?.student_name?.trim().toLowerCase() === clean.toLowerCase()
    );
    if (existingLink) return existingLink.student_id;

    const { data: newStudent, error: studentError } = await supabase
      .from("students")
      .insert({ student_name: clean, active: true })
      .select()
      .single();
    if (studentError || !newStudent) {
      throw new Error(studentError?.message || "Could not create student.");
    }

    const { error: linkError } = await supabase
      .from("coach_students")
      .insert({ coach_id: coachId, student_id: newStudent.id });
    if (linkError) throw new Error(linkError.message);

    queryClient.invalidateQueries({ queryKey: ["coach-students", coachId] });
    return newStudent.id;
  }

  async function createLessonFromDraft(data: any): Promise<string> {
    if (!coachId) throw new Error("Not signed in.");
    const studentId = await resolveStudentId(data.student_name);

    const startDate = new Date(data.start);
    if (Number.isNaN(startDate.getTime())) {
      throw new Error("Could not understand the lesson time.");
    }

    const lessonDate = startDate.toLocaleDateString("en-CA");
    const startTime = startDate.toTimeString().slice(0, 5);
    const durationMinutes = Math.max(
      1,
      Math.round(Number(data.duration_min) || settings.defaultLessonDuration)
    );
    const hourlyRate = Number(data.rate ?? coachRatesData?.default_hourly_rate ?? 0);
    const rate = parseFloat(((hourlyRate * durationMinutes) / 60).toFixed(2));

    const { error } = await supabase.from("lessons").insert({
      coach_id: coachId,
      student_id: studentId,
      lesson_date: lessonDate,
      start_time: startTime,
      duration_minutes: durationMinutes,
      lesson_type: data.lesson_type || null,
      hourly_rate: hourlyRate,
      rate,
      notes: data.notes || null,
      billing_status: "unbilled",
    });
    if (error) throw new Error(error.message);

    queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
    queryClient.invalidateQueries({ queryKey: ["coach-students", coachId] });

    return `Lesson with ${data.student_name} created for ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString(
      [],
      { hour: "numeric", minute: "2-digit" }
    )}.`;
  }

  async function createInvoiceFromDraft(
    data: any
  ): Promise<{ noLessons: boolean; total?: number; count?: number; invoiceNumber?: string }> {
    if (!coachId) throw new Error("Not signed in.");

    const link = coachStudents.find(
      (l: any) =>
        l.students?.student_name?.trim().toLowerCase() === String(data.student_name).trim().toLowerCase()
    );
    if (!link) throw new Error(`Could not find a student named "${data.student_name}".`);
    const studentId = link.student_id;

    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("*")
      .eq("coach_id", coachId)
      .eq("student_id", studentId)
      .eq("billing_status", "unbilled")
      .gte("lesson_date", data.range_start)
      .lte("lesson_date", data.range_end)
      .order("lesson_date", { ascending: true });
    if (lessonsError) throw new Error(lessonsError.message);

    if (!lessons || lessons.length === 0) {
      return { noLessons: true };
    }

    const total = lessons.reduce((sum: number, l: any) => sum + Number(l.rate || 0), 0);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const { data: invoiceData, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        coach_id: coachId,
        student_id: studentId,
        status: "unbilled",
        subtotal: total,
        total,
        issue_date: new Date().toISOString().split("T")[0],
        notes: null,
      })
      .select()
      .single();
    if (invoiceError) throw new Error(invoiceError.message);

    const invoiceLessonRows = lessons.map((l: any) => ({ invoice_id: invoiceData.id, lesson_id: l.id }));
    const { error: linkError } = await supabase.from("invoice_lessons").insert(invoiceLessonRows);
    if (linkError) throw new Error(linkError.message);

    queryClient.invalidateQueries({ queryKey: ["invoices", coachId] });

    return { noLessons: false, total, count: lessons.length, invoiceNumber };
  }

  async function handleConfirm() {
    if (!draft || confirming) return;
    setConfirming(true);
    setErrorMsg("");

    try {
      if (draft.kind === "create_lesson") {
        const summary = await createLessonFromDraft(draft.data);
        pushAssistantConfirmation(`✅ ${summary}`);
      } else {
        const result = await createInvoiceFromDraft(draft.data);
        if (result.noLessons) {
          pushAssistantConfirmation(
            `I couldn't find any unbilled lessons for ${draft.data.student_name} between ${draft.data.range_start} and ${draft.data.range_end}, so no invoice was created.`
          );
        } else {
          pushAssistantConfirmation(
            `✅ Invoice ${result.invoiceNumber} created for ${draft.data.student_name} — ${result.count} lesson${
              result.count === 1 ? "" : "s"
            }, $${Number(result.total).toFixed(2)} total.`
          );
        }
      }
      setDraft(null);
      setEditing(false);
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong saving that.");
    } finally {
      setConfirming(false);
    }
  }

  function handleEdit() {
    setEditing(true);
    setErrorMsg("");
    inputRef.current?.focus();
  }

  function handleCancelDraft() {
    setDraft(null);
    setEditing(false);
  }

  const loading = identityLoading;

  return (
    <div className="ai-assistant-page">
      <div className="ai-assistant-header">
        <div className="ai-assistant-header logo-wrapper">
          <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <img src="/logo.png" alt="Billio" />
        </div>
        <h1>AI Assistant</h1>
        <p>Create lessons and invoices by chatting or speaking naturally.</p>
      </div>

      <div className="ai-assistant-body">
        {bubbles.length === 0 && !draft && (
          <p className="ai-assistant-empty">
            Try "create a lesson with [student] tomorrow at 3pm" or "invoice [student] for this
            month."
          </p>
        )}

        {bubbles.map((bubble) => (
          <div key={bubble.id} className={`ai-assistant-bubble ${bubble.role}`}>
            {bubble.text}
          </div>
        ))}

        {sending && (
          <div className="ai-assistant-bubble assistant ai-assistant-typing">
            <span />
            <span />
            <span />
          </div>
        )}

        {draft && (
          <div className="ai-assistant-draft-card">
            {draft.kind === "create_lesson" ? (
              <>
                <h3>New Lesson</h3>
                <p className="ai-assistant-draft-name">{draft.data.student_name}</p>
                <p>
                  {Number.isNaN(new Date(draft.data.start).getTime())
                    ? draft.data.start
                    : new Date(draft.data.start).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                </p>
                <p>
                  {draft.data.duration_min} min
                  {draft.data.rate ? ` • $${Number(draft.data.rate)}/hr` : " • default rate"}
                </p>
                {draft.data.lesson_type && <p>{draft.data.lesson_type}</p>}
                {draft.data.notes && (
                  <p className="ai-assistant-draft-notes">{draft.data.notes}</p>
                )}
              </>
            ) : (
              <>
                <h3>New Invoice</h3>
                <p className="ai-assistant-draft-name">{draft.data.student_name}</p>
                <p>
                  {draft.data.range_start} – {draft.data.range_end}
                </p>
                <p className="ai-assistant-draft-notes">
                  Bills all of this student's unbilled lessons in that range.
                </p>
              </>
            )}

            <div className="ai-assistant-draft-actions">
              <button
                type="button"
                className="ai-assistant-draft-cancel"
                onClick={handleCancelDraft}
                disabled={confirming}
              >
                <FaTimes />
              </button>
              <button
                type="button"
                className="ai-assistant-draft-edit"
                onClick={handleEdit}
                disabled={confirming}
              >
                <FaEdit /> Edit
              </button>
              <button
                type="button"
                className="ai-assistant-draft-confirm"
                onClick={handleConfirm}
                disabled={confirming}
              >
                <FaCheck /> {confirming ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        )}

        {errorMsg && <p className="ai-assistant-error">{errorMsg}</p>}

        <div ref={bottomRef} />
      </div>

      <div className="ai-assistant-input-row">
        {editing && (
          <div className="ai-assistant-editing-pill">
            Editing draft — describe the change
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          placeholder={loading ? "Loading..." : "Type a request..."}
          disabled={loading}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendText(inputText);
          }}
        />
        {micSupported && (
          <button
            type="button"
            className={`ai-assistant-mic-btn ${listening ? "listening" : ""}`}
            onClick={toggleListening}
            disabled={loading}
            aria-label="Use voice input"
          >
            <FaMicrophone />
          </button>
        )}
        <button
          type="button"
          className="ai-assistant-send-btn"
          onClick={() => sendText(inputText)}
          disabled={loading || !inputText.trim() || sending}
          aria-label="Send"
        >
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
}
