/**
 * The built-in entertainment app list (SPEC 6.8). An app counts as entertainment when its
 * package name OR its app name (as the phone shows it, ignoring case) matches an entry, or
 * when Android marks it as a game. Rishi can add and remove apps on top of this list.
 *
 * Package names were checked on 2026-11-04 where public listings exist; the app name is the
 * fallback when a package isn't certain (e.g. aha) or an app ships under another id.
 */
export interface EntertainmentApp {
  /** Stable key for this entry (used when an entry has several packages). */
  key: string;
  name: string;
  packages: string[];
  /** App names as shown on the phone (lower case). */
  labels: string[];
}

export const ENTERTAINMENT_APPS: readonly EntertainmentApp[] = [
  {
    key: 'youtube',
    name: 'YouTube',
    packages: ['com.google.android.youtube'],
    labels: ['youtube'],
  },
  {
    key: 'instagram',
    name: 'Instagram',
    packages: ['com.instagram.android'],
    labels: ['instagram'],
  },
  {
    key: 'facebook',
    name: 'Facebook',
    packages: ['com.facebook.katana', 'com.facebook.lite'],
    labels: ['facebook', 'facebook lite'],
  },
  { key: 'x', name: 'X', packages: ['com.twitter.android'], labels: ['x', 'twitter'] },
  { key: 'snapchat', name: 'Snapchat', packages: ['com.snapchat.android'], labels: ['snapchat'] },
  { key: 'netflix', name: 'Netflix', packages: ['com.netflix.mediaclient'], labels: ['netflix'] },
  {
    key: 'prime_video',
    name: 'Prime Video',
    packages: ['com.amazon.avod.thirdpartyclient'],
    labels: ['prime video', 'amazon prime video'],
  },
  {
    key: 'jiohotstar',
    name: 'JioHotstar',
    packages: ['in.startv.hotstar', 'in.startv.hotstaronly'],
    labels: ['jiohotstar', 'hotstar', 'disney+ hotstar'],
  },
  { key: 'sonyliv', name: 'SonyLIV', packages: ['com.sonyliv'], labels: ['sonyliv', 'sony liv'] },
  { key: 'zee5', name: 'ZEE5', packages: ['com.graymatrix.did'], labels: ['zee5'] },
  { key: 'aha', name: 'aha', packages: ['ahaflix.tv'], labels: ['aha'] },
  {
    key: 'mx_player',
    name: 'MX Player',
    packages: ['com.mxtech.videoplayer.ad', 'com.mxtech.videoplayer.pro'],
    labels: ['mx player', 'mx player pro'],
  },
  {
    key: 'crunchyroll',
    name: 'Crunchyroll',
    packages: ['com.crunchyroll.crunchyroid'],
    labels: ['crunchyroll'],
  },
  { key: 'twitch', name: 'Twitch', packages: ['tv.twitch.android.app'], labels: ['twitch'] },
  {
    key: 'webtoon',
    name: 'Webtoon',
    packages: ['com.naver.linewebtoon'],
    labels: ['webtoon', 'line webtoon'],
  },
  { key: 'cricbuzz', name: 'Cricbuzz', packages: ['com.cricbuzz.android'], labels: ['cricbuzz'] },
  {
    key: 'dream11',
    name: 'Dream11',
    // Play Store app, and the app from dream11.com.
    packages: ['com.dream11.fantasy.cricket.football.kabaddi', 'com.app.dream11Pro'],
    labels: ['dream11'],
  },
];

/** YouTube doesn't count during a focus session (SPEC 6.8). */
export const YOUTUBE_PACKAGES: readonly string[] = ['com.google.android.youtube'];
