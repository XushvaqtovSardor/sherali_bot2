import { Injectable } from "@nestjs/common";
import { InlineKeyboard } from "grammy";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class KeyboardService {
  private bakalavr: any;
  private kechki: any;
  private masofaviy: any;
  private magistr: any;
  private teachers: any;
  private kabinets: any;

  constructor() {
    
    this.bakalavr = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../data.json"), "utf8")
    );
    this.kechki = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../kechki.json"), "utf8")
    );
    this.masofaviy = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../masofaviy.json"), "utf8")
    );
    this.magistr = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../magistratura.json"), "utf8")
    );
    this.teachers = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../teachers.json"), "utf8")
    );
    this.kabinets = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../kabinets.json"), "utf8")
    );
  }

  getCategoryKeyboard(lang: string = "uz"): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const categories = {
      uz: [
        { text: "🎓 Bakalavr", data: "cat:bakalavr" },
        { text: "🌙 Kechki ta'lim", data: "cat:kechki" },
        { text: "💻 Masofaviy", data: "cat:masofaviy" },
        { text: "🎯 Magistratura", data: "cat:magistr" },
        { text: "👨‍🏫 O'qituvchilar", data: "cat:teachers" },
        { text: "🚪 Xonalar", data: "cat:kabinets" },
      ],
      ru: [
        { text: "🎓 Бакалавриат", data: "cat:bakalavr" },
        { text: "🌙 Вечернее", data: "cat:kechki" },
        { text: "💻 Дистанционное", data: "cat:masofaviy" },
        { text: "🎯 Магистратура", data: "cat:magistr" },
        { text: "👨‍🏫 Преподаватели", data: "cat:teachers" },
        { text: "🚪 Кабинеты", data: "cat:kabinets" },
      ],
      en: [
        { text: "🎓 Bachelor", data: "cat:bakalavr" },
        { text: "🌙 Evening", data: "cat:kechki" },
        { text: "💻 Distance", data: "cat:masofaviy" },
        { text: "🎯 Master", data: "cat:magistr" },
        { text: "👨‍🏫 Teachers", data: "cat:teachers" },
        { text: "🚪 Rooms", data: "cat:kabinets" },
      ],
    };

    const langCategories = categories[lang] || categories.uz;
    langCategories.forEach((cat, idx) => {
      keyboard.text(cat.text, cat.data);
      keyboard.row();
    });

    return keyboard;
  }

  getFakultetKeyboard(category: string, lang: string = "uz"): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    let data: any;

    switch (category) {
      case "bakalavr":
        data = this.bakalavr;
        break;
      case "kechki":
        data = this.kechki.Kechki_talim;
        break;
      case "masofaviy":
        data = this.masofaviy.Masofaviy_talim;
        break;
      case "magistr":
        data = this.magistr.Magistratura;
        break;
      case "teachers":
        data = this.teachers.Teachers;
        break;
      case "kabinets":
        data = this.kabinets.Kabinets;
        break;
      default:
        data = this.bakalavr;
    }

    
    if (
      category === "kechki" ||
      category === "masofaviy" ||
      category === "magistr"
    ) {
      const courses = Object.keys(data);
      courses.forEach((course, idx) => {
        keyboard.text(course, `kurs:${category}:${course}`);
        keyboard.row();
      });
    } else if (category === "teachers" || category === "kabinets") {
      
      const groups = Object.keys(data);
      groups.forEach((group, idx) => {
        keyboard.text(group, `kurs:${category}:${group}`);
        keyboard.row();
      });
    } else {
      
      const faculties = Object.keys(data);
      faculties.forEach((fak, idx) => {
        const displayName = this.getFacultyDisplayName(fak, lang);
        keyboard.text(displayName, `fak:${category}:${fak}`);
        keyboard.row();
      });
    }

    keyboard.row();
    keyboard.text(
      lang === "ru" ? "◀️ Назад" : lang === "en" ? "◀️ Back" : "◀️ Orqaga",
      "back:category"
    );

    return keyboard;
  }

  getKursKeyboard(
    category: string,
    fakultet: string,
    lang: string = "uz"
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    let data: any;

    if (category === "bakalavr") {
      data = this.bakalavr[fakultet];
    } else if (category === "kechki") {
      data = this.kechki.Kechki_talim;
    } else if (category === "masofaviy") {
      data = this.masofaviy.Masofaviy_talim;
    } else if (category === "magistr") {
      data = this.magistr.Magistratura;
    } else if (category === "teachers") {
      data = this.teachers.Teachers[fakultet]; 
    } else if (category === "kabinets") {
      data = this.kabinets.Kabinets[fakultet]; 
    }

    
    if (category === "teachers" || category === "kabinets") {
      const items = Object.keys(data);
      items.forEach((item, idx) => {
        keyboard.text(item, `guruh:${category}:${fakultet}:${item}`);
        keyboard.row();
      });
    } else {
      
      const courses = Object.keys(data);
      courses.forEach((kurs, idx) => {
        keyboard.text(kurs, `kurs:${category}:${fakultet || "none"}:${kurs}`);
        keyboard.row();
      });
    }

    keyboard.row();
    const backTo =
      category === "bakalavr" ? `back:fakultet:${category}` : "back:category";
    keyboard.text(
      lang === "ru" ? "◀️ Назад" : lang === "en" ? "◀️ Back" : "◀️ Orqaga",
      backTo
    );

    return keyboard;
  }

  getGuruhKeyboard(
    category: string,
    fakultet: string,
    kurs: string,
    lang: string = "uz"
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    let groups: any;

    if (category === "bakalavr") {
      groups = this.bakalavr[fakultet]?.[kurs] || {};
    } else if (category === "kechki") {
      groups = this.kechki.Kechki_talim[kurs] || {};
    } else if (category === "masofaviy") {
      groups = this.masofaviy.Masofaviy_talim[kurs] || {};
    } else if (category === "magistr") {
      groups = this.magistr.Magistratura[kurs] || {};
    }

    const groupNames = Object.keys(groups);
    groupNames.forEach((guruh, idx) => {
      keyboard.text(
        guruh,
        `guruh:${category}:${fakultet || "none"}:${kurs}:${guruh}`
      );
      if ((idx + 1) % 3 === 0) keyboard.row();
    });

    keyboard.row();
    keyboard.text(
      lang === "ru" ? "◀️ Назад" : lang === "en" ? "◀️ Back" : "◀️ Orqaga",
      `back:kurs:${category}:${fakultet || "none"}`
    );

    return keyboard;
  }

  getScheduleActionsKeyboard(
    category: string,
    fakultet: string,
    kurs: string,
    guruh: string,
    lang: string = "uz"
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    keyboard.text(
      lang === "ru"
        ? "🔄 Обновить"
        : lang === "en"
        ? "🔄 Refresh"
        : "🔄 Yangilash",
      `refresh:${category}:${fakultet || "none"}:${kurs}:${guruh}`
    );
    keyboard.row();
    keyboard.text(
      lang === "ru" ? "◀️ В меню" : lang === "en" ? "◀️ Menu" : "◀️ Menyuga",
      "back:category"
    );

    return keyboard;
  }

  private getFacultyDisplayName(key: string, lang: string): string {
    const names = {
      "menejment fakulteti": {
        uz: "Menejment fakulteti",
        ru: "Факультет менеджмента",
        en: "Management Faculty",
      },
      "IQTISODIYOT FAKULTETI": {
        uz: "Iqtisodiyot fakulteti",
        ru: "Факультет экономики",
        en: "Economics Faculty",
      },
      "Raqamli Iqtisodiyot Fakulteti": {
        uz: "Raqamli iqtisodiyot fakulteti",
        ru: "Факультет цифровой экономики",
        en: "Digital Economics Faculty",
      },
      "Turizm Fakulteti": {
        uz: "Turizm fakulteti",
        ru: "Факультет туризма",
        en: "Tourism Faculty",
      },
      "SOLIQ VA BUDJET HISOBI": {
        uz: "Soliq va budjet hisobi",
        ru: "Налоги и бюджетный учет",
        en: "Tax and Budget Accounting",
      },
      "BUXGALTERIYA HISOBI": {
        uz: "Buxgalteriya hisobi",
        ru: "Бухгалтерский учет",
        en: "Accounting",
      },
      "MOLIYA FAKULTETI": {
        uz: "Moliya fakulteti",
        ru: "Финансовый факультет",
        en: "Finance Faculty",
      },
      "BANK ISHI FAKULTETI": {
        uz: "Bank ishi fakulteti",
        ru: "Факультет банковского дела",
        en: "Banking Faculty",
      },
      POLOTSKIY: { uz: "Polotskiy", ru: "Полоцкий", en: "Polotskiy" },
    };

    return names[key]?.[lang] || key;
  }

  getUrlForGroup(
    category: string,
    fakultet: string,
    kurs: string,
    guruh: string
  ): string | null {
    let data: any;

    if (category === "bakalavr") {
      data = this.bakalavr[fakultet]?.[kurs]?.[guruh];
    } else if (category === "kechki") {
      data = this.kechki.Kechki_talim[kurs]?.[guruh];
    } else if (category === "masofaviy") {
      data = this.masofaviy.Masofaviy_talim[kurs]?.[guruh];
    } else if (category === "magistr") {
      data = this.magistr.Magistratura[kurs]?.[guruh];
    } else if (category === "teachers") {
      
      data = this.teachers.Teachers[fakultet]?.[kurs];
    } else if (category === "kabinets") {
      
      data = this.kabinets.Kabinets[fakultet]?.[kurs];
    }

    return data || null;
  }

  getAdminKeyboard(lang: string = "uz"): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    keyboard.text(
      lang === "ru"
        ? "📊 Статистика"
        : lang === "en"
        ? "📊 Statistics"
        : "📊 Statistika",
      "admin:stats"
    );
    keyboard.text(
      lang === "ru"
        ? "👥 Пользователи"
        : lang === "en"
        ? "👥 Users"
        : "👥 Foydalanuvchilar",
      "admin:users"
    );
    keyboard.row();
    keyboard.text(
      lang === "ru"
        ? "🗑 Очистить кэш"
        : lang === "en"
        ? "🗑 Clear cache"
        : "🗑 Keshni tozalash",
      "admin:clear_cache"
    );
    keyboard.text(
      lang === "ru" ? "📝 Логи" : lang === "en" ? "📝 Logs" : "📝 Loglar",
      "admin:logs"
    );
    keyboard.row();
    keyboard.text(
      lang === "ru"
        ? "📢 Рассылка"
        : lang === "en"
        ? "📢 Broadcast"
        : "📢 Xabar yuborish",
      "admin:broadcast"
    );
    keyboard.row();
    keyboard.text(
      lang === "ru" ? "◀️ Назад" : lang === "en" ? "◀️ Back" : "◀️ Ortga",
      "back:admin"
    );
    keyboard.text(
      lang === "ru"
        ? "🏠 Главное меню"
        : lang === "en"
        ? "🏠 Main menu"
        : "🏠 Asosiy menyu",
      "back:main"
    );

    return keyboard;
  }
}
