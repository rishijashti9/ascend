import { DEFAULT_DAILY_LIMIT, type AskDeps } from '@/core/ask/ask';
import { buildAskContext } from '@/core/ask/context';
import { ASK_SERVICE, askFunctionProvider } from '@/core/ask/provider';
import { careerById } from '@/core/compass/pack';
import { countryFromTimeZone } from '@/core/compass/safety';
import { readOutbound } from '@/core/data/outbound';
import { db } from '@/core/db/db';
import { recordAction } from '@/core/pipeline';
import { useAccount } from '@/core/state/account';
import { useAdaptive } from '@/core/state/adaptive';
import { useAppState } from '@/core/state/app';
import { useGoals } from '@/core/state/goals';
import { useProgress } from '@/core/state/progress';
import { useSkills } from '@/core/state/skills';
import { getSupabase } from '@/core/sync/client';
import { currentTimeZone, dayOf, nowMs } from '@/core/time';

/** Everything one Ask needs, from the stores (allow-listed context only). */
export function useAskDeps(): () => Promise<AskDeps> {
  const settings = useAppState((s) => s.settings);
  const target = useAppState((s) => s.profile?.compass?.target_career ?? null);
  const signedIn = useAccount((s) => s.status === 'signed_in');
  const progress = useProgress((s) => s.progress);
  const models = useAdaptive((s) => s.models);
  const mainQuests = useGoals((s) => s.mainQuests);
  const milestones = useGoals((s) => s.milestones);
  const mainQuestProgress = useGoals((s) => s.mainQuestProgress);
  const skills = useSkills((s) => s.skills);
  const skillProgress = useSkills((s) => s.progress);

  return async () => {
    const tz = currentTimeZone();
    const dayStart = settings?.day_start_hour ?? 3;
    const today = dayOf(nowMs(), tz, dayStart);
    const sent = await readOutbound(db);
    const ps = [...models.values()]
      .filter((m) => m.done.confidence !== 'early')
      .map((m) => m.done.p);
    const client = signedIn ? getSupabase() : null;
    return {
      enabled: settings?.ai_enabled ?? false,
      provider: client ? askFunctionProvider(client) : null,
      context: buildAskContext({
        level: progress?.level.level ?? 1,
        rank: progress?.rank ?? 'E',
        streak: progress?.streak.streak ?? 0,
        completion: ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null,
        mainQuests,
        milestones,
        mainQuestProgress,
        skills,
        skillLevel: (id) => skillProgress.get(id)?.level ?? 0,
        targetCareer: target ? (careerById(target)?.title ?? null) : null,
      }),
      country: countryFromTimeZone(tz),
      usedToday: sent.filter((e) => dayOf(Date.parse(e.at), tz, dayStart) === today).length,
      dailyLimit: DEFAULT_DAILY_LIMIT,
      logOutbound: async (chars) => {
        await recordAction({
          type: 'outbound.record',
          payload: { service: ASK_SERVICE.id, kind: 'ask', chars },
        });
      },
    };
  };
}
