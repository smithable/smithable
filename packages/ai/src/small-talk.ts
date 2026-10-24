// Smith talks like a chat (A 151, Johan 2026-10-24): a greeting, thanks or small talk gets a short
// answer that suggests what to do and leads back to the app, by rule where the words are plain
// (no model), never "No operation can do this". Anything else goes on to the change and question
// tiers as before.
import { humanize, plural, type SpecIR } from "@smithable/core";

/** The request's words, lower case, without punctuation or a closing name ("hi smith!"). */
const plain = (request: string) =>
  request
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ (smith|agent smith|there)$/, "");

const GREETING =
  /^(hi|hello|hey|hej|hiya|howdy|yo|greetings|good (morning|afternoon|evening|day))$/;
const THANKS =
  /^((many )?thanks|thank you|thx|ty|cheers|(great|perfect|nice|cool) thanks)( (so|very) much| a lot)?$/;
const HOW = /^how are you( doing| today)?$|^how's it going$/;
const WHO =
  /^(who are you|what are you|what can you do|what do you do|help|what can i (ask|do)|what now)$/;
const BYE = /^(bye|goodbye|see you|that's all|nothing more|no thanks|done)$/;
const OK = /^(ok|okay|cool|nice|great|good|perfect|awesome)$/;

/** Something to try in this app: a change and a question, named from its own spec. */
function tryThis(ir?: SpecIR): string {
  const model = ir?.models[0];
  const page = ir?.pages[0];
  const records = model ? humanize(plural(model.name)).toLowerCase() : "records";
  const question = page
    ? `“Who can open the ${humanize(page.id).toLowerCase()} page?”`
    : "“Who can see what?”";
  return `For example “Add a notes field to ${records}” or ${question}`;
}

/** A short answer to small talk, or undefined when the request is not small talk. */
export function smallTalk(request: string, ir?: SpecIR): string | undefined {
  const words = plain(request);
  const app = ir?.app.name ?? "your app";
  if (GREETING.test(words))
    return `Hello! I'm Smith. Tell me what to change in ${app}, or ask me how it works. ${tryThis(ir)}.`;
  if (THANKS.test(words)) return `You're welcome! Anything else to change in ${app}?`;
  if (HOW.test(words)) return `I'm well, thank you. What shall we do with ${app}?`;
  if (WHO.test(words))
    return `I'm Smith. I change ${app} when you describe the change in your own words, and I answer questions about it: who can see what, what a page shows, what happens when. ${tryThis(ir)}.`;
  if (BYE.test(words)) return "Bye for now. Your changes are kept; I'm here when you need me.";
  if (OK.test(words)) return `Good. What next for ${app}?`;
  return undefined;
}
