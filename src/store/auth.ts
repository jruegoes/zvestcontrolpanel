import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "#/supabase";

export type UserRole = "super_admin" | "shop_owner";
export type UserType = "admin";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  userType: UserType | null;
  shopId: string | null;
  shopName: string | null;
  firstName: string | null;
  lastName: string | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

function extractMeta(user: User | null) {
  const meta = user?.user_metadata;
  return {
    role: (meta?.role as UserRole) ?? null,
    userType: (meta?.user_type as UserType) ?? null,
    shopId: (meta?.shop_id as string) ?? null,
    shopName: (meta?.shop_name as string) ?? null,
    firstName: (meta?.first_name as string) ?? null,
    lastName: (meta?.last_name as string) ?? null,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  userType: null,
  shopId: null,
  shopName: null,
  firstName: null,
  lastName: null,
  loading: true,

  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    set({ session, user, ...extractMeta(user), loading: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      set({ session, user, ...extractMeta(user) });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, role: null, userType: null, shopId: null, shopName: null, firstName: null, lastName: null });
  },
}));
