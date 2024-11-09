import type { Denops } from "@denops/std";
import type { IdItem } from "@vim-fall/core/item";
import type { Projector, ProjectParams } from "@vim-fall/core/projector";

import type { FirstType, LastType } from "./util/_typeutil.ts";
import { defineSource, type Source } from "./source.ts";
import { type Curator, defineCurator } from "./curator.ts";
import {
  type Derivable,
  type DerivableArray,
  derive,
  deriveArray,
} from "./util/derivable.ts";

/**
 * Define a projector.
 *
 * @param project The function to project items.
 * @returns The projector.
 */
export function defineProjector<T, U = T>(
  project: (
    denops: Denops,
    params: ProjectParams<T>,
    options: { signal?: AbortSignal },
  ) => AsyncIterableIterator<IdItem<U>>,
): Projector<T, U> {
  return { project };
}

/**
 * Compose multiple projectors.
 *
 * The projectors are applied in the order they are passed.
 */
export function composeProjectors<
  T extends FirstType<P> extends Derivable<Projector<infer T, unknown>> ? T
    : never,
  U extends LastType<P> extends Derivable<Projector<infer _, infer U>> ? U
    : never,
  P extends DerivableArray<[
    Projector<unknown, unknown>,
    ...Projector<unknown, unknown>[],
  ]>,
>(...projectors: P): Projector<T, U> {
  return {
    project: async function* (
      denops: Denops,
      params: ProjectParams<T>,
      options: { signal?: AbortSignal },
    ) {
      let it: AsyncIterable<IdItem<unknown>> = params.items;
      for (const projector of deriveArray(projectors)) {
        it = projector.project(denops, { items: it }, options);
      }
      yield* it as AsyncIterable<IdItem<U>>;
    },
  };
}

/**
 * Pipe projectors to a source or a curator.
 *
 * The projectors are applied in the order they are passed.
 *
 * @param source The source or curator.
 * @param projectors The projectors.
 * @returns The source or curator.
 */
export function pipeProjectors<
  T,
  U extends LastType<P> extends Derivable<Projector<infer _, infer U>> ? U
    : never,
  S extends Derivable<Source<T> | Curator<T>>,
  P extends DerivableArray<[
    Projector<unknown, unknown>,
    ...Projector<unknown, unknown>[],
  ]>,
  R extends S extends Derivable<Source<unknown>> ? Source<U> : Curator<U>,
>(
  source: S,
  ...projectors: P
): R {
  const src = derive(source);
  const projector = composeProjectors(...projectors) as Projector<T, U>;
  if ("collect" in src) {
    return defineSource<U>((denops, params, options) => {
      const items = src.collect(denops, params, options);
      return projector.project(denops, { items }, options);
    }) as R;
  } else {
    return defineCurator<U>((denops, params, options) => {
      const items = src.curate(denops, params, options);
      return projector.project(denops, { items }, options);
    }) as R;
  }
}

export type * from "@vim-fall/core/projector";
