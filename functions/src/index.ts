// functions/src/index.ts — Cloud Functions VoxMeet
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: 'southamerica-east1' });

const RETENTION_DAYS: Record<string, number | null> = {
  starter: 7,
  pro: 90,
  pro_monthly: 90,
  ultra: 365,
  pro_annual: 365,
  power: null,
};

export const expireMeetings = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'America/Sao_Paulo' },
  async () => {
    const now = Date.now();
    let totalDeleted = 0;

    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
      const plan = userDoc.data().plan || 'starter';
      const retentionDays = RETENTION_DAYS[plan];

      if (retentionDays === null) continue;

      const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;

      const meetingsSnap = await db
        .collection(`users/${userDoc.id}/meetings`)
        .where('createdAt', '<', cutoff)
        .get();

      if (meetingsSnap.size > 0) {
        const docs = meetingsSnap.docs;
        for (let i = 0; i < docs.length; i += 450) {
          const batch = db.batch();
          docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
        totalDeleted += meetingsSnap.size;
        console.log(`Usuario ${userDoc.id} (${plan}): ${meetingsSnap.size} reunioes expiradas removidas`);
      }
    }

    console.log(`Limpeza concluida: ${totalDeleted} reunioes expiradas removidas no total`);
  }
);
