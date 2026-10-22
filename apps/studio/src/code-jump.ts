// Asking Studio to show a setting in Code (Who can's Why?, A 127): the window event, and the jump
// App hands the Code window, which selects the setting once it is on screen.
import type { EditableFile } from "@smithable/core";

/** Dispatched with a CodeJump's file and path as detail: App puts Code on screen and jumps there. */
export const SHOW_CODE = "smithable:show-code";

/** A file and a dotted path in it (`roles.member.create`); `at` makes a repeat a new jump. */
export interface CodeJump {
  file: EditableFile;
  path: string;
  at: number;
}
