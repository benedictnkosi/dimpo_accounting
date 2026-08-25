import { Platform, Share } from 'react-native';

export type ShareMethod = 'native' | 'clipboard';

export interface ShareAttemptResult {
  ok: boolean;
  method?: ShareMethod;
}

export async function shareContent(params: {
  message: string;
  url?: string;
  title?: string;
}): Promise<ShareAttemptResult> {
  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? {
            message: params.message,
            url: params.url,
            title: params.title || 'Accounting CPA QUIZ',
          }
        : {
            message: params.message,
            title: params.title || 'Accounting CPA QUIZ',
          }
    );
    if (result.action === Share.dismissedAction) return { ok: false };
    return { ok: true, method: 'native' };
  } catch (error) {
    console.error('Share failed:', error);
    return { ok: false };
  }
}
