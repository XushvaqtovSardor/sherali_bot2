import { Injectable } from "@nestjs/common";

export type Language = "ru" | "en" | "uz";

interface Translations {
  ru: Record<string, string>;
  en: Record<string, string>;
  uz: Record<string, string>;
}

@Injectable()
export class TranslationService {
  private translations: Translations = {
    ru: {
      
      selectLanguage: "🌐 Выберите язык / Choose language / Tilni tanlang",
      languageSelected: "✅ Язык успешно изменен на русский!",

      
      welcome:
        "👋 Добро пожаловать в бот расписания ТГЭУ!\n\nВыберите категорию:",
      mainMenu: "📋 Главное меню",
      backToMenu: "◀️ Назад в меню",

      
      bakalavr: "🎓 Бакалавриат",
      kechki: "🌙 Вечернее отделение",
      masofaviy: "💻 Дистанционное",
      magistr: "🎯 Магистратура",
      teachers: "👨‍🏫 Преподаватели",
      kabinets: "🚪 Кабинеты",

      
      selectFaculty: "🏛 Выберите факультет:",
      selectCourse: "📚 Выберите курс:",
      selectGroup: "👥 Выберите группу:",

      
      loading: "⏳ Загрузка расписания...",
      refresh: "🔄 Обновить",
      error: "❌ Произошла ошибка. Попробуйте позже.",
      noSchedule: "📭 Расписание не найдено",

      
      statusTitle: "📊 Статус системы",
      statusBot: "🤖 Бот: Работает",
      statusDb: "🗄 База данных: Подключена",
      statusCache: "💾 Кеш: Активен",

      
      menuCommand: "📋 Главное меню",
      statusCommand: "📊 Статус",
      helpCommand: "ℹ️ Помощь",

      
      course1: "1-курс",
      course2: "2-курс",
      course3: "3-курс",
      course4: "4-курс",

      
      magistr1: "1-курс магистратура",
      magistr2: "2-курс магистратура",

      
      underDevelopment: "🚧 Этот раздел находится в разработке. Скоро будет доступен!",
    },
    en: {
      
      selectLanguage: "🌐 Выберите язык / Choose language / Tilni tanlang",
      languageSelected: "✅ Language successfully changed to English!",

      
      welcome: "👋 Welcome to TSUE Schedule Bot!\n\nSelect category:",
      mainMenu: "📋 Main Menu",
      backToMenu: "◀️ Back to Menu",

      
      bakalavr: "🎓 Bachelor",
      kechki: "🌙 Evening",
      masofaviy: "💻 Distance",
      magistr: "🎯 Master",
      teachers: "👨‍🏫 Teachers",
      kabinets: "🚪 Rooms",

      
      selectFaculty: "🏛 Select faculty:",
      selectCourse: "📚 Select course:",
      selectGroup: "👥 Select group:",

      
      loading: "⏳ Loading schedule...",
      refresh: "🔄 Refresh",
      error: "❌ An error occurred. Try again later.",
      noSchedule: "📭 Schedule not found",

      
      statusTitle: "📊 System Status",
      statusBot: "🤖 Bot: Running",
      statusDb: "🗄 Database: Connected",
      statusCache: "💾 Cache: Active",

      
      menuCommand: "📋 Main Menu",
      statusCommand: "📊 Status",
      helpCommand: "ℹ️ Help",

      
      course1: "1st year",
      course2: "2nd year",
      course3: "3rd year",
      course4: "4th year",

      
      magistr1: "1st year master",
      magistr2: "2nd year master",

      
      underDevelopment: "🚧 This section is under development. Coming soon!",
    },
    uz: {
      
      selectLanguage: "🌐 Выберите язык / Choose language / Tilni tanlang",
      languageSelected: "✅ Til muvaffaqiyatli o'zgartirildi - O'zbek tili!",

      
      welcome:
        "👋 TDIU dars jadvali botiga xush kelibsiz!\n\nKategoriyani tanlang:",
      mainMenu: "📋 Asosiy menyu",
      backToMenu: "◀️ Menyuga qaytish",

      
      bakalavr: "🎓 Bakalavr",
      kechki: "🌙 Kechki ta'lim",
      masofaviy: "💻 Masofaviy",
      magistr: "🎯 Magistratura",
      teachers: "👨‍🏫 O'qituvchilar",
      kabinets: "🚪 Xonalar",

      
      selectFaculty: "🏛 Fakultetni tanlang:",
      selectCourse: "📚 Kursni tanlang:",
      selectGroup: "👥 Guruhni tanlang:",

      
      loading: "⏳ Jadval yuklanmoqda...",
      refresh: "🔄 Yangilash",
      error: "❌ Xatolik yuz berdi. Keyinroq urinib ko'ring.",
      noSchedule: "📭 Jadval topilmadi",

      
      statusTitle: "📊 Tizim holati",
      statusBot: "🤖 Bot: Ishlayapti",
      statusDb: "🗄 Ma'lumotlar bazasi: Ulangan",
      statusCache: "💾 Kesh: Faol",

      
      menuCommand: "📋 Asosiy menyu",
      statusCommand: "📊 Holat",
      helpCommand: "ℹ️ Yordam",

      
      course1: "1-kurs",
      course2: "2-kurs",
      course3: "3-kurs",
      course4: "4-kurs",

      
      magistr1: "1-kurs magistratura",
      magistr2: "2-kurs magistratura",

      
      underDevelopment: "🚧 Bu bo'lim ustida tuzatish ishlari olib borilmoqda. Tez orada!",
    },
  };

  t(key: string, lang: Language = "uz"): string {
    return this.translations[lang][key] || key;
  }

  getLanguageKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🇷🇺 Русский", callback_data: "lang_ru" },
          { text: "🇬🇧 English", callback_data: "lang_en" },
          { text: "🇺🇿 O'zbek", callback_data: "lang_uz" },
        ],
      ],
    };
  }
}
