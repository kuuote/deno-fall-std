import * as fn from "@denops/std/function";
import { type Action, defineAction } from "../../action.ts";

type Detail = {
  path: string;
  line?: number;
  column?: number;
  length?: number;
  context?: string;
} | {
  bufname: string;
  line?: number;
  column?: number;
  length?: number;
  context?: string;
};

type What = {
  context?: unknown;
  id?: number;
  idx?: number | string;
  nr?: number;
  title?: string;
};

export type QuickfixOptions = {
  /**
   * Specifies additional parameters for the quickfix list, such as `id`, `idx`, `nr`, etc.
   */
  what?: What;
  /**
   * Action type for modifying the quickfix list:
   * - "a": Append to the list
   * - "r": Replace the list
   * - "f": Refill the list
   * - " ": Set the list
   */
  action?: "a" | "r" | "f" | " ";
  /**
   * Command to execute after setting the quickfix list.
   */
  after?: string;
  /**
   * Whether to keep the picker window open after setting the quickfix list.
   */
  continue?: boolean;
};

/**
 * Creates an action that populates the quickfix list with specified items.
 *
 * @param options - Configuration options for setting the quickfix list.
 * @returns An action that sets the quickfix list and optionally opens it.
 */
export function quickfix(
  options: QuickfixOptions = {},
): Action<Detail> {
  const what = options.what ?? {};
  const action = options.action ?? " ";
  const after = options.after ?? "";

  return defineAction<Detail>(
    async (denops, { selectedItems, filteredItems }, { signal }) => {
      const source = selectedItems ?? filteredItems;

      const items = source.map((item) => {
        const filename = "bufname" in item.detail
          ? item.detail.bufname
          : item.detail.path;
        return {
          filename,
          lnum: item.detail.line,
          col: item.detail.column,
          end_col: item.detail.column && item.detail.length
            ? item.detail.column + item.detail.length
            : undefined,
          text: item.detail.context,
        };
      });

      signal?.throwIfAborted();

      await fn.setqflist(denops, [], action, {
        ...what,
        items,
      });

      if (after) {
        signal?.throwIfAborted();
        await denops.cmd(after);
      }
      if (options.continue) {
        return true;
      }
    },
  );
}

/**
 * Default action for managing the quickfix list.
 */
export const defaultQuickfixActions: {
  quickfix: Action<Detail>;
  "quickfix:copen": Action<Detail>;
} = {
  quickfix: quickfix({ continue: true }),
  "quickfix:copen": quickfix({ after: "copen" }),
};
