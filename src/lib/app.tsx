import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export type Current = NonNullable<FunctionReturnType<typeof api.households.current>>;
export type Dog = Current["dogs"][number];
export type Member = Current["members"][number];

type AppCtx = {
  me: Current["me"];
  household: NonNullable<Current["household"]>;
  members: Member[];
  dogs: Dog[];
  dog: Dog;
  setDogId: (id: Id<"dogs">) => void;
  memberName: (id: Id<"users"> | undefined) => string;
  realName: (id: Id<"users"> | undefined) => string;
};

const Ctx = createContext<AppCtx | null>(null);
const KEY = "pawlog:dog";

export function AppProvider({ current, children }: { current: Current & { household: NonNullable<Current["household"]> }; children: ReactNode }) {
  const [dogId, setDogIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });
  const dog = current.dogs.find((d) => d._id === dogId) ?? current.dogs[0];
  useEffect(() => {
    if (dog && dog._id !== dogId) setDogIdState(dog._id);
  }, [dog, dogId]);

  const value = useMemo<AppCtx>(
    () => ({
      me: current.me,
      household: current.household,
      members: current.members,
      dogs: current.dogs,
      dog,
      setDogId: (id) => {
        setDogIdState(id);
        try {
          localStorage.setItem(KEY, id);
        } catch {
          /* private mode */
        }
      },
      realName: (id) => {
        const m = current.members.find((m) => m._id === id);
        return m?.name ?? m?.username ?? "?";
      },
      memberName: (id) => {
        if (!id) return "Someone";
        if (id === current.me._id) return "You";
        const m = current.members.find((m) => m._id === id);
        return m?.name ?? m?.username ?? "Someone";
      },
    }),
    [current, dog],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}
