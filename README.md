# SYMBIOTES website (LEO Phase 3 - fixed)

## Update steps
1. Supabase > SQL Editor > run `supabase/SYMBIOTES_LEO_PET.sql` (safe to re-run). This fixes the
   "operator does not exist: integer = integer[]" error and adds the wardrobe, room and unlock functions.
2. Replace the website files with these and redeploy (Netlify).
3. Open LEO space. If it ever fails, the card now shows a friendly message and "Technical details".

## Changed files
LeoSpace.tsx, PetContext.tsx, petCore.ts, auth.tsx, index.css (+ the SQL file).
