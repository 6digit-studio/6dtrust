// Generate the Ed25519 issuer keypair for Beji standing claims.
//
//   bun scripts/gen-beji-claim-key.ts
//
// Prints both halves and where each one goes. They are asymmetric on purpose:
// Beji holds ONLY the public half, so a compromise of Beji cannot mint standing,
// and verification needs no live call to this service — a trust-service blip can
// never silently downgrade an invitee to level 0 at the moment they register.
//
// Rotation: issue the new public key to Beji first, then switch this side. A claim
// already in flight is signed by the old key and will stop verifying the moment
// Beji's key changes, so rotate when nothing is outstanding, or accept that
// outstanding invitations must be reissued.

import { generateIssuerKeypair } from '../src/lib/server/beji-claim';

const kp = await generateIssuerKeypair();

console.log('');
console.log('Beji claim issuer keypair (Ed25519)');
console.log('───────────────────────────────────────────────────────────────');
console.log('');
console.log('PRIVATE — keep here, in 6dtrust. Never leaves this side:');
console.log('');
console.log(`  BEJI_CLAIM_PRIVATE_KEY=${kp.privateKey}`);
console.log('');
console.log('PUBLIC — give to Beji. Safe to publish:');
console.log('');
console.log(`  bunx convex env set BEJI_CLAIM_PUBKEY '${kp.publicKey}' --prod`);
console.log('');
console.log('Then mint invitations with scripts/issue-beji-claim.ts.');
console.log('');
