
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function checkAscii(value) {
  return {
    exists: Boolean(value),
    length: value?.length ?? 0,
    containsNonAscii: value
      ? [...value].some((char) => char.codePointAt(0) > 127)
      : false,
  };
}

console.log(
  "SUPABASE URL CHECK:",
  JSON.stringify(checkAscii(supabaseUrl))
);

console.log(
  "SUPABASE KEY CHECK:",
  JSON.stringify(checkAscii(supabaseKey))
);

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase environment variables are missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: "implicit",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    debug: true,
  },
});
