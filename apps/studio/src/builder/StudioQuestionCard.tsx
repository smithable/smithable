import { useId } from "react";
import type { StudioQuestion } from "../studio-questions";
import { cx } from "../ui";
import { CHIP, SMITHS } from "./chat-style";

export function StudioQuestionCard({
  question,
  stopSpeaking,
}: {
  question: StudioQuestion;
  stopSpeaking: () => void;
}) {
  const id = useId();
  const choose = (choice: StudioQuestion["choices"][number]) => {
    stopSpeaking();
    choice.act();
  };
  return (
    <section
      data-studio-question={question.id}
      data-part={
        question.email || question.id.startsWith("ownerAsked:") ? "owner-check" : "time-zone-check"
      }
      aria-label="A question from Smith"
      className={cx(SMITHS, "relative space-y-3 pr-9")}
    >
      <button
        type="button"
        aria-label="Close question"
        title="Keep what was assumed"
        onClick={() => {
          stopSpeaking();
          question.close();
        }}
        className="absolute right-2 top-2 grid size-6 place-items-center rounded text-muted hover:bg-hover"
      >
        ✕
      </button>
      <p>{question.text}</p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const submit = question.choices.find((c) => c.label === "Make them the administrator");
          if (submit && !submit.disabled) choose(submit);
        }}
      >
        {question.email && (
          <>
            <label className="block space-y-1" htmlFor={id}>
              <span>The owner's email address</span>
              <input
                id={id}
                type="email"
                required
                value={question.email.value}
                onChange={(event) =>
                  question.email?.change(event.target.value, event.target.validity.valid)
                }
                className="block w-full rounded border border-line bg-panel px-3 py-2 text-sm"
              />
            </label>
            {question.email.hasAdmins && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={question.email.alongside}
                  onChange={(event) => question.email?.setAlongside(event.target.checked)}
                />
                I help run it too
              </label>
            )}
          </>
        )}
        <div className="grid gap-2">
          {question.choices.map((choice) => (
            <button
              key={choice.label}
              type={
                question.email && choice.label === "Make them the administrator"
                  ? "submit"
                  : "button"
              }
              disabled={choice.disabled}
              onClick={
                question.email && choice.label === "Make them the administrator"
                  ? undefined
                  : () => choose(choice)
              }
              className={cx(
                CHIP,
                "w-full px-4 py-3 text-left whitespace-normal disabled:opacity-50",
              )}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
