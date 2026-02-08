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

  // Short ID mapping to keep callback data under 64 bytes
  private facultyIdMap = {
    "menejment fakulteti": "f1",
    "IQTISODIYOT FAKULTETI": "f2",
    "Raqamli Iqtisodiyot Fakulteti": "f3",
    "Turizm Fakulteti": "f4",
    "SOLIQ VA BUDJET HISOBI": "f5",
    "BUXGALTERIYA HISOBI": "f6",
    "MOLIYA FAKULTETI": "f7",
    "BANK ISHI FAKULTETI": "f8",
    POLOTSKIY: "f9",
  };

  private reverseFacultyIdMap: { [key: string]: string };

  constructor() {
    // Create reverse mapping
    this.reverseFacultyIdMap = Object.fromEntries(
      Object.entries(this.facultyIdMap).map(([k, v]) => [v, k])
    );

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

  getCategoryKeyboard(lang: string = "uz", isForSubscription: boolean = false): InlineKeyboard {
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

    // Obuna yoki bekor qilish tugmasi
    if (isForSubscription) {
      keyboard.text(
        lang === "ru" ? "❌ Отмена" : lang === "en" ? "❌ Cancel" : "❌ Bekor qilish",
        "sub:cancel"
      );
    } else {
      keyboard.text(
        lang === "ru" ? "🔔 Подписка" : lang === "en" ? "🔔 Subscription" : "🔔 Obuna",
        "menu:subscription"
      );
    }

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
        const shortId = this.encodeFacultyId(fak);
        keyboard.text(displayName, `fak:${category}:${shortId}`);
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
        // Normalize: decode if short, keep if full
        const fullFakultet = this.decodeFacultyId(fakultet);
        // Then encode to short format
        const shortFak =
          fullFakultet && fullFakultet !== "none"
            ? this.encodeFacultyId(fullFakultet)
            : "none";
        const shortKurs = this.encodeCourse(kurs);
        keyboard.text(kurs, `kurs:${category}:${shortFak}:${shortKurs}`);
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
      // Always ensure we encode - even if we received full names from old callbacks
      // First normalize: if fakultet is a full name, keep it; if it's a short ID, decode it
      const fullFakultet = this.decodeFacultyId(fakultet);
      const fullKurs = this.decodeCourse(kurs);

      // Then encode to short format for the button
      const shortFak =
        fullFakultet && fullFakultet !== "none"
          ? this.encodeFacultyId(fullFakultet)
          : "none";
      const shortKurs = this.encodeCourse(fullKurs);

      keyboard.text(
        guruh,
        `guruh:${category}:${shortFak}:${shortKurs}:${guruh}`
      );
      if ((idx + 1) % 3 === 0) keyboard.row();
    });

    keyboard.row();
    // Normalize and encode for back button
    const fullFakultet = this.decodeFacultyId(fakultet);
    const shortFak =
      fullFakultet && fullFakultet !== "none"
        ? this.encodeFacultyId(fullFakultet)
        : "none";
    keyboard.text(
      lang === "ru" ? "◀️ Назад" : lang === "en" ? "◀️ Back" : "◀️ Orqaga",
      `back:kurs:${category}:${shortFak}`
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

    // Normalize: decode if short, keep if full
    const fullFakultet = this.decodeFacultyId(fakultet);
    const fullKurs = this.decodeCourse(kurs);

    // Then encode to short format
    const shortFak =
      fullFakultet && fullFakultet !== "none"
        ? this.encodeFacultyId(fullFakultet)
        : "none";
    const shortKurs = this.encodeCourse(fullKurs);

    keyboard.text(
      lang === "ru"
        ? "🔄 Обновить"
        : lang === "en"
          ? "🔄 Refresh"
          : "🔄 Yangilash",
      `refresh:${category}:${shortFak}:${shortKurs}:${guruh}`
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

    // Decode short IDs back to full names
    const fullFakultet = this.decodeFacultyId(fakultet);
    const fullKurs = this.decodeCourse(kurs);

    if (category === "bakalavr") {
      data = this.bakalavr[fullFakultet]?.[fullKurs]?.[guruh];
    } else if (category === "kechki") {
      data = this.kechki.Kechki_talim[fullKurs]?.[guruh];
    } else if (category === "masofaviy") {
      data = this.masofaviy.Masofaviy_talim[fullKurs]?.[guruh];
    } else if (category === "magistr") {
      data = this.magistr.Magistratura[fullKurs]?.[guruh];
    } else if (category === "teachers") {
      data = this.teachers.Teachers[fullFakultet]?.[fullKurs];
    } else if (category === "kabinets") {
      data = this.kabinets.Kabinets[fullFakultet]?.[fullKurs];
    }

    return data || null;
  }

  // Encode faculty name to short ID
  private encodeFacultyId(fakultet: string): string {
    // Handle case where input might already be a short ID
    if (fakultet && fakultet.startsWith("f") && fakultet.length <= 3) {
      return fakultet;
    }
    return this.facultyIdMap[fakultet] || fakultet;
  }

  // Decode short ID back to faculty name
  decodeFacultyId(id: string): string {
    // If it's a short ID (f1, f2, etc.), decode it
    if (id && id.startsWith("f") && id.length <= 3) {
      return this.reverseFacultyIdMap[id] || id;
    }
    // Otherwise it's already a full name, return as-is
    return id;
  }

  // Encode course name to short format
  private encodeCourse(kurs: string): string {
    // Handle case where input might already be encoded
    if (kurs && kurs.endsWith("k") && kurs.length <= 3 && !kurs.includes("-")) {
      return kurs;
    }
    // Convert "1-kurs" to "1k", "2-kurs" to "2k", etc.
    return kurs.replace("-kurs", "k");
  }

  // Decode course back to full format
  decodeCourse(encoded: string): string {
    // Convert "1k" to "1-kurs", "2k" to "2-kurs", etc.
    // But only if it looks like an encoded format (short, ends with k, no hyphen)
    if (
      encoded &&
      encoded.endsWith("k") &&
      encoded.length <= 3 &&
      !encoded.includes("-")
    ) {
      return encoded.replace("k", "-kurs");
    }
    // Otherwise it's already in full format
    return encoded;
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
      lang === "ru" ? "📝 Логи" : lang === "en" ? "📝 Logs" : "📝 Loglar",
      "admin:logs"
    );
    keyboard.text(
      lang === "ru"
        ? "👨‍💼 Администраторы"
        : lang === "en"
          ? "👨‍💼 Admins"
          : "👨‍💼 Adminlar",
      "admin:admins"
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

  getSubscriptionMenuKeyboard(lang: string = "uz", hasActive: boolean = false): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    if (hasActive) {
      keyboard.text(
        lang === "ru" ? "❌ Отключить подписку" : lang === "en" ? "❌ Unsubscribe" : "❌ Obunani o'chirish",
        "sub:disable"
      );
      keyboard.row();
    }

    keyboard.text(
      lang === "ru" ? "✅ Создать подписку" : lang === "en" ? "✅ Create subscription" : "✅ Obunani yoqish",
      "sub:create"
    );

    keyboard.row();
    keyboard.text(
      lang === "ru" ? "◀️ Назад" : lang === "en" ? "◀️ Back" : "◀️ Orqaga",
      "back:main"
    );

    return keyboard;
  }

  getSubscriptionTimeKeyboard(lang: string = "uz"): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    const times = ["07:00", "07:30", "08:30", "12:00", "13:00"];
    times.forEach((time) => {
      keyboard.text(`🕐 ${time}`, `subtime:${time}`);
      if (time === "08:30" || time === "13:00") keyboard.row();
    });

    keyboard.row();
    keyboard.text(
      lang === "ru" ? "⏰ Другое время" : lang === "en" ? "⏰ Other time" : "⏰ Boshqa vaqt",
      "subtime:custom"
    );

    keyboard.row();
    keyboard.text(
      lang === "ru" ? "❌ Отмена" : lang === "en" ? "❌ Cancel" : "❌ Bekor qilish",
      "sub:cancel"
    );

    return keyboard;
  }

  getBroadcastConfirmKeyboard(lang: string = "uz"): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    keyboard.text(
      lang === "ru" ? "✅ Yuborish" : lang === "en" ? "✅ Send" : "✅ Yuborish",
      "broadcast:confirm"
    );
    keyboard.text(
      lang === "ru" ? "❌ Bekor qilish" : lang === "en" ? "❌ Cancel" : "❌ Bekor qilish",
      "broadcast:cancel"
    );

    return keyboard;
  }
}

