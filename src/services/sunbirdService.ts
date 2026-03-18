import { UgandanLanguage } from '../types';

const SUNBIRD_API_BASE = 'https://api.sunbird.ai';
const API_KEY = process.env.SUNBIRD_API_KEY;

export interface TranslationResponse {
  output: {
    translated_text: string;
  };
}

export interface TTSResponse {
  base64_audio: string;
}

export const sunbirdService = {
  async translate(text: string, source: UgandanLanguage, target: UgandanLanguage): Promise<string> {
    if (!API_KEY) throw new Error('SUNBIRD_API_KEY is not configured');
    if (source === target) return text;

    try {
      const response = await fetch(`${SUNBIRD_API_BASE}/tasks/translate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_language: source === 'en' ? 'English' : this.getLanguageName(source),
          target_language: target === 'en' ? 'English' : this.getLanguageName(target),
          text: text,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Translation failed');
      }

      const data: TranslationResponse = await response.json();
      return data.output.translated_text;
    } catch (error) {
      console.error('Sunbird Translation Error:', error);
      return text; // Fallback to original text
    }
  },

  async textToSpeech(text: string, language: UgandanLanguage): Promise<string | null> {
    if (!API_KEY) throw new Error('SUNBIRD_API_KEY is not configured');
    if (language === 'en') return null; // Use Gemini's native audio for English

    try {
      const response = await fetch(`${SUNBIRD_API_BASE}/tasks/tts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          language: this.getLanguageName(language),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'TTS failed');
      }

      const data: TTSResponse = await response.json();
      return data.base64_audio;
    } catch (error) {
      console.error('Sunbird TTS Error:', error);
      return null;
    }
  },

  getLanguageName(code: UgandanLanguage): string {
    const names: Record<UgandanLanguage, string> = {
      en: 'English',
      lug: 'Luganda',
      nyn: 'Runyankore',
      ach: 'Acholi',
      teo: 'Ateso',
      lgg: 'Lugbara'
    };
    return names[code];
  }
};
