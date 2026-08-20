# Future notes

Parked ideas that should not be lost. Notes, not tasks: nothing in this file
is a commitment, and nothing here should be built without Bryan.

## OpenAttribute (revisit only after the Basecamp write path is proven on mainnet)

OpenAttribute.app, by @rubencress, is a public directory where Hive
developers declare what their json_metadata keys mean, so other frontends
can read and render each other's objects. No signup, no permission, apps
that do not recognize a key ignore it. It solves cross-frontend legibility:
the same problem our SDK ambition has, where Basecamp state should be
readable by PeakD, Ecency, Snapie, etc.

Why it is parked, not adopted now:

- Basecamp has never broadcast to mainnet. The write path is unproven.
- The resource-credit cost for brand-new accounts is untested and is the
  most likely thing to force a redesign.
- The game broadcasts nothing per player, so most of OpenAttribute does not
  apply to the game at all, only potentially to Basecamp records.

Revisit when: the Basecamp custom_json write path has been proven with a
real mainnet broadcast, AND the trust-model conversation has happened.
At that point, consider declaring the basecamp custom_json id and its
schema (from lib/protocol.ts) through OpenAttribute so other frontends can
read a Basecamp profile.

Do not act on this without Bryan. This is a note, not a task.
