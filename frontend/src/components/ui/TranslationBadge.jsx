"use client"

import { useMemo } from "react"

const ISO_TO_DISPLAY_NAME = {
  'bn': 'Bengali', 'hi': 'Hindi', 'ta': 'Tamil', 'te': 'Telugu',
  'mr': 'Marathi', 'gu': 'Gujarati', 'kn': 'Kannada', 'ml': 'Malayalam',
  'pa': 'Punjabi', 'ur': 'Urdu', 'ar': 'Arabic', 'zh': 'Chinese',
  'ja': 'Japanese', 'ko': 'Korean', 'fr': 'French', 'de': 'German',
  'es': 'Spanish', 'pt': 'Portuguese', 'ru': 'Russian', 'it': 'Italian'
}

export default function TranslationBadge({ originalLanguage }) {
  const languageName = useMemo(() => {
    if (!originalLanguage) return "another language"
    return ISO_TO_DISPLAY_NAME[originalLanguage] || originalLanguage.toUpperCase()
  }, [originalLanguage])

  return (
    <div className="border-[1.5px] border-indigo-600 p-3 flex items-center justify-center space-x-2 bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-400 mt-4 shadow-[2px_2px_0px_#4f46e5]">
      <span className="material-symbols-outlined text-[16px] font-bold">translate</span>
      <span className="font-label text-[10px] uppercase tracking-[0.2em] font-black">
        TRANSLATED FROM {languageName.toUpperCase()}
      </span>
    </div>
  )
}
