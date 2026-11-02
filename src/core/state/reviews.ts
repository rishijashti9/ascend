import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { Review } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** All reviews (daily check-ins, weekly / monthly / yearly), newest period first. */
export interface ReviewsState {
  status: 'loading' | 'ready';
  reviews: Review[];
}

export const reviewsStore = createStore<ReviewsState>(() => ({ status: 'loading', reviews: [] }));

export function useReviews<T>(selector: (state: ReviewsState) => T): T {
  return useStore(reviewsStore, selector);
}

export async function loadReviews(database: AscendDB = defaultDb): Promise<void> {
  try {
    const reviews = (await database.reviews.toArray())
      .filter((r) => r.deleted_at === null)
      .sort((a, b) => b.period.localeCompare(a.period));
    reviewsStore.setState({ status: 'ready', reviews });
  } catch (error) {
    logError(error, 'reviews.load');
  }
}

export async function startReviews(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll(() => loadReviews(database));
  await loadReviews(database);
  return unsubscribe;
}
