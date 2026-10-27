// Smith's face beside his box (Johan's drawings, 2026-10-27): hammering while he thinks or
// the app is made, and an expression for what just happened. Small WebP copies of the drawings;
// the originals stay out of the repository.
import angry from "../brand/smith/smith-angry.webp";
import confused from "../brand/smith/smith-confused.webp";
import excited from "../brand/smith/smith-excited.webp";
import happy from "../brand/smith/smith-happy.webp";
import impatient from "../brand/smith/smith-impatient.webp";
import pointing from "../brand/smith/smith-pointing.webp";
import proud from "../brand/smith/smith-proud.webp";
import sad from "../brand/smith/smith-sad.webp";
import waiting from "../brand/smith/smith-waiting.webp";
import working from "../brand/smith/smith-working.webp";

const FACES = { angry, confused, excited, happy, impatient, pointing, proud, sad, waiting };
export type Mood = keyof typeof FACES | "working";

/** Smith at 48 px: the hammering frames as a sprite (styles.css .smith-working), or one face. */
export function SmithFace({ mood }: { mood: Mood }) {
  return (
    <span data-mood={mood} aria-hidden="true" className="grid size-12 shrink-0 place-items-center">
      {mood === "working" ? (
        <span className="smith-working" style={{ backgroundImage: `url(${working})` }} />
      ) : (
        <img src={FACES[mood]} alt="" width={48} height={48} className="size-12" />
      )}
    </span>
  );
}
